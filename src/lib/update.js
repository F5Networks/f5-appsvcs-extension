/**
 * Copyright 2023 F5, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const asmUtil = require('./util/asmUtil');
const util = require('./util/util');
const log = require('./log');
const authHeaderUtil = require('./util/authHeaderUtil');
const Config = require('./config');

/**
 * return a promise to ensure AS3 cli script file
 * has been added to TMOS whitelist of permitted
 * cli script files
 *
 * @private
 * @param {object} context
 * @param {object} whitelistOptions - contains path to TMOS whitelist
 * @param {string} whitelist - current (just-fetched) whitelist
 * @param {array} whitelistFiles
 * @returns {undefined}
 */
const setWhitelist = function (context, whitelistOptions, whitelist, whitelistFiles) {
    // TODO:  consolidate get/test/set whitelist in this
    // method rather than submit() doing get separately

    const appsvcsFile = ' {/var/config/rest/downloads/appsvcs_update.cli}';
    let filePaths = '';
    if (whitelist.includes(appsvcsFile) && whitelistFiles.length === 0) {
        return Promise.resolve();
    }
    if (!whitelist.includes(appsvcsFile)) {
        filePaths += appsvcsFile;
    }

    for (let i = 0; i < whitelistFiles.length; i += 1) {
        filePaths += ` {${whitelistFiles[i]}}`;
    }

    const payload = `{"fileWhitelistPathPrefix":"${whitelist}${filePaths}"}`;

    const icrOptions = {
        path: whitelistOptions.path,
        why: 'patch whitelist',
        method: 'PATCH',
        send: payload
    };
    return util.iControlRequest(context, icrOptions);
}; // setWhitelist()

const executeIControlCall = function (context, call) {
    if (call.command === 'iControl_post') {
        // handle simple posts to the bigip
        if (call.properties.why.startsWith('upload asm policy')) {
            return asmUtil.applyAs3Settings(
                call.properties.send,
                call.properties.settings,
                call.properties.reference,
                context.tasks[context.currentIndex].declaration
            ).then((response) => {
                call.properties.send = response;
                return util.iControlRequest(context, call.properties);
            });
        }
        return util.iControlRequest(context, call.properties);
    }

    if (call.command === 'iControl_postFromRemote') {
        // handle getting a file from somewhere and uploading it to the bigip

        const reqOpts = {};
        Object.assign(reqOpts, call.properties.get);
        const url = call.properties.get.path;
        // path here for GETs is the full URL
        // so remove path from opts, otherwise it gets appended
        delete reqOpts.path;

        return Promise.resolve()
            .then(() => authHeaderUtil.getAuthHeader(context, reqOpts.authentication))
            .then((authHeader) => {
                reqOpts.headers = Object.assign({}, reqOpts.headers, authHeader);
            })
            .then(() => getExtraHeaders(url))
            .then((extraHeaders) => Object.assign(reqOpts.headers, extraHeaders))
            .then(() => {
                delete reqOpts.authentication;
                return util.httpRequest(url, reqOpts);
            })
            .then((response) => {
                if (!call.properties.get.why.startsWith('get asm policy')) {
                    return response;
                }

                return asmUtil.applyAs3Settings(
                    response,
                    call.properties.post.settings,
                    call.properties.post.reference,
                    context.tasks[context.currentIndex].declaration
                );
            })
            .then((response) => {
                call.properties.post.send = response;
                return util.iControlRequest(context,
                    call.properties.post);
            });
    }

    return Promise.resolve();
};

function getExtraHeaders(url) {
    const extraHeaders = {};

    if (url.indexOf('windows.net') >= 0) {
        extraHeaders['x-ms-version'] = '2017-11-09';
    }

    return extraHeaders;
}

class Update {
    /**
     * return a promise to run a CLI script on the
     * target device
     *
     * @public
     * @param {object} context
     * @param {object} updates
     * @param {object} diff
     * @returns {Promise}
     */
    static submit(context, updates, diff) {
        const whitelistOptions = {
            path: '/mgmt/tm/sys/global-settings',
            why: 'get whitelist'
        };
        const uploadLineCount = (updates.script.match(/\n/g) || []).length;

        if (context.tasks[context.currentIndex].dryRun === true) {
            const response = {
                dryRun: true,
                lineCount: uploadLineCount
            };

            if (log.getGlobalSettings().logLevel === 'debug') {
                response.changes = diff;
            }
            return Promise.resolve(response);
        }

        const uploadOptions = {
            path: '/mgmt/shared/file-transfer/uploads/appsvcs_update.cli',
            why: 'upload cli script',
            method: 'POST',
            send: updates.script,
            ctype: 'application/octet-stream'
        };
        const mergeOptions = {
            path: '/mgmt/tm/sys/config',
            why: 'merge cli script',
            method: 'POST',
            send: '{"command":"load","options":[{"file":"/var/config/rest/downloads/appsvcs_update.cli","merge":true}]}'
        };
        const verifyOptions = {
            path: '/mgmt/tm/ltm/data-group/internal/~Common~__appsvcs_update',
            why: 'verify cli script'
        };
        /* var deleteOptions = {
        path: '/mgmt/tm/cli/script/~Common~__appsvcs_update',
        why: 'delete cli script',
        method: 'DELETE'
    }; */

        let time;
        let settings;
        let scriptFailure = null;
        return Promise.resolve()
            .then(() => Config.getAllSettings())
            .then((allSettings) => {
                settings = util.simpleCopy(allSettings);
            })
            .then(() => {
                log.debug('getting whitelist');
                return util.iControlRequest(context, whitelistOptions);
            })
            .then((whitelistResponse) => {
                log.debug('setting whitelist');
                return setWhitelist(
                    context,
                    whitelistOptions,
                    whitelistResponse.fileWhitelistPathPrefix,
                    updates.whitelistFiles
                );
            })
            .then(() => {
                log.debug('executing pre-script iControl calls');
                time = new Date();
                if (settings.serializeFileUploads) {
                    const promiseFuncs = updates.iControlCalls.map((c) => () => executeIControlCall(context, c));
                    return promiseUtil.series(promiseFuncs);
                }
                return Promise.all(updates.iControlCalls.map(
                    (c) => executeIControlCall(context, c)
                ));
            })
            .then(() => {
                log.debug(`Executing pre-script time: ${new Date() - time} milliseconds`);
                log.debug('uploading cli script');
                time = new Date();
                return util.iControlRequest(context, uploadOptions);
            })
            .then(() => {
                log.debug(`Uploading time: ${new Date() - time} milliseconds`);
                log.debug('merging cli script');
                time = new Date();
                return util.iControlRequest(context, mergeOptions);
            })
            .then(() => {
                log.debug(`Merging time: ${new Date() - time} milliseconds`);
                log.debug('running cli script');
                time = new Date();
                return this.runScript(context).catch((error) => {
                    scriptFailure = error.message;
                });
            })
            .then(() => {
                log.debug(`Running time: ${new Date() - time} milliseconds`);
                log.debug('verifying cli script');
                time = new Date();
                return util.iControlRequest(context, verifyOptions);
            })
            .then((verifyResponse) => {
                log.debug(`Verify time: ${new Date() - time} milliseconds`);
                const records = verifyResponse.records;
                if (records && records[0] && records[0].data) {
                    scriptFailure = records[0].data;
                }

                uploadOptions.why = 'overwrite finished cli script';
                uploadOptions.send = '.';
                log.debug('overwriting finished cli script');
                time = new Date();
                return util.iControlRequest(context, uploadOptions);
            })
        // remove leftover config data for better security
        // .then(() => {
        //  return util.iControlRequest(context, deleteOptions);
        // })
            .then(() => {
                log.debug(`Overwriting time: ${new Date() - time} milliseconds`);
                if (scriptFailure) {
                    log.error(`Declaration failed: ${scriptFailure}`);
                    const error = new Error(scriptFailure);
                    error.code = 422;
                    throw error;
                }
                return { lineCount: uploadLineCount };
            })
            .catch((err) => {
                err.code = err.code || 500;
                throw err;
            });
    } // submit()

    static runScript(context) {
        let id = null;
        function waitForCompletion(remainingRetries) {
            const checkOptions = {
                path: `/mgmt/tm/task/cli/script/${id}`,
                why: 'checking cli script status',
                method: 'GET',
                targetTimeout: 240
            };
            return util.iControlRequest(context, checkOptions)
                .then((response) => {
                    if (response._taskState === 'VALIDATING') {
                        if (remainingRetries > 0) {
                            return promiseUtil.delay(500)
                                .then(() => waitForCompletion(remainingRetries - 1));
                        }
                        throw new Error('TMSH CLI script taking longer than expected');
                    }

                    if (response._taskState === 'FAILED') {
                        throw new Error('TMSH CLI script failed during execution');
                    }

                    return Promise.resolve();
                })
                .catch((error) => {
                    function isAllowedError() {
                        if (error.message.indexOf('TimeoutException') > -1) {
                            return true;
                        }

                        if (error.message.indexOf('response=400') > -1) {
                            return true;
                        }

                        if (error.message.indexOf('response=504') > -1) {
                            return true;
                        }

                        return false;
                    }

                    if (remainingRetries > 0 && isAllowedError()) {
                        return promiseUtil.delay(500)
                            .then(() => waitForCompletion(remainingRetries - 1));
                    }

                    if (error.message.indexOf('Task not found') > -1) {
                        error.message = 'Record no longer exists on BIG-IP for TMSH CLI script task'
                        + ` (ID: ${id}). To avoid this issue in the future, try increasing the`
                        + ' following DB variables: icrd.timeout, restjavad.timeout, restnoded.timeout';
                    }

                    throw error;
                });
        }

        return Promise.resolve()
            .then(() => {
                const runOptions = {
                    path: '/mgmt/tm/task/cli/script',
                    why: 'run cli script',
                    method: 'POST',
                    send: '{"command":"run","name":"__appsvcs_update"}'
                };
                return util.iControlRequest(context, runOptions);
            })
            .then((resp) => {
                id = resp._taskId;
                const startOptions = {
                    path: `/mgmt/tm/task/cli/script/${id}`,
                    why: 'start cli script',
                    method: 'PUT',
                    send: '{"_taskState": "VALIDATING"}'
                };
                return util.iControlRequest(context, startOptions);
            })
            .then(() => waitForCompletion(60));
    }
}

module.exports = Update;

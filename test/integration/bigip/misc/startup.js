/**
 * Copyright 2023 F5 Networks, Inc.
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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;

const oauth = require('../../../common/oauth');
const requestUtil = require('../../../common/requestUtilPromise');
const { validateEnvVars } = require('../../../common/checkEnv');

chai.use(chaiAsPromised);
const assert = chai.assert;

const policyHost = `${process.env.TEST_RESOURCES_URL}`;

const {
    assertModuleProvisioned,
    sendDeclaration,
    deleteDeclaration,
    logEvent,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('startup', function () {
    this.timeout(GLOBAL_TIMEOUT);

    before(() => {
        validateEnvVars(['TEST_RESOURCES_URL']);
    });

    let accessToken;

    beforeEach(() => {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    it('should cancel pending tasks on startup', function () {
        assertModuleProvisioned.call(this, 'asm');

        const urlObject = {
            url: `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`,
            skipCertificateCheck: true
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            urlObject.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        const decl = {
            class: 'ADC',
            schemaVersion: '3.9.0',
            id: 'Pool',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_Pool: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    template: 'generic',
                    wafPolicy: {
                        class: 'WAF_Policy',
                        url: urlObject
                    }
                }
            }
        };

        const checkTask = (taskId) => {
            const reqOpts = {
                path: `/mgmt/shared/appsvcs/task/${taskId}`
            };
            logEvent(`checking task ${taskId}`);
            return requestUtil.get(reqOpts)
                .then((response) => {
                    if (response.statusCode !== 200) {
                        throw new Error(`status code: ${response.statusCode}`);
                    }
                    return response.body.results[0];
                })
                .catch((err) => {
                    const message = err.message;
                    if (message && message.indexOf(`No record found with ID of ${taskId}`) !== -1) {
                        return {
                            code: 404,
                            message
                        };
                    }
                    throw err;
                });
        };

        const retryOpts = {
            retries: 20,
            delay: 1000
        };

        let taskId;

        return Promise.resolve()
            .then(() => sendDeclaration(decl, '?async=true'))
            .then((response) => {
                taskId = response.body.id;
            })
            .then(() => {
                const body = {
                    command: 'run',
                    utilCmdArgs: '-c "bigstart restart restnoded"'
                };
                const reqOpts = {
                    path: '/mgmt/tm/util/bash',
                    body
                };
                return requestUtil.post(reqOpts);
            })
            .then(() => promiseUtil.retryPromise(checkTask, retryOpts, [taskId]))
            .then((taskResult) => {
                // If all goes well, we get 'task cancelled'. However, restnoded often loses our
                // data on restart and we get 404 with a message of 'No record found'
                if (taskResult && taskResult.code === 0) {
                    assert.strictEqual(taskResult.message, 'task cancelled');
                } else if (taskResult && taskResult.code === 404) {
                    assert.notStrictEqual(taskResult.message.indexOf(`No record found with ID of ${taskId}`), -1);
                } else {
                    assert.ok(false, `Unexpected taskResult: ${taskResult}`);
                }
            });
    });
});

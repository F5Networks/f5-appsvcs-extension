/**
 * Copyright 2022 F5 Networks, Inc.
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

const fs = require('fs');

const semver = require('semver');

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const log = require('../log');
const util = require('./util');
const iappUtil = require('./iappUtil');
const constants = require('../constants');

const DEVICE_TYPES = require('../constants').DEVICE_TYPES;
const BUILD_TYPES = require('../constants').BUILD_TYPES;

const SOURCE_PATH = '/var/config/rest/iapps/f5-appsvcs/packages';
const IAPP_DIR = '/var/config/rest/iapps/f5-appsvcs';

const RETRY_OPTIONS = {
    retries: 5,
    delay: 1000
};

const readFile = function (path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, data) => {
            if (error) reject(error);
            else resolve(data);
        });
    });
};

const getIControlPromise = (context, iControlOptions, failureMessage, options) => {
    const promiseOptions = Object.assign({}, { checkStatus: true }, options);
    return util.iControlRequest(context, iControlOptions)
        .then((response) => {
            if (promiseOptions.checkStatus && response.statusCode !== 200 && response.statusCode !== 202) {
                throw new Error(`${failureMessage}: ${response.statusCode}`);
            }
            return response;
        });
};

const install = function (context) {
    log.info('Installing service discovery worker');

    return Promise.resolve()
        .then(() => getDiscoveryRpm(context, 'packageName'))
        .then((discoveryRpmName) => uninstallDiscoveryRpm(context, discoveryRpmName))
        .then(() => installDiscoveryRpm(context))
        .then(() => waitForDiscoveryInit(context));
};

function getDiscoveryRpm(context, property) {
    const options = {
        path: '/mgmt/shared/iapp/package-management-tasks',
        method: 'POST',
        ctype: 'application/json',
        why: 'Get query',
        crude: true,
        send: JSON.stringify({ operation: 'QUERY' })
    };

    const args = [context, options, 'Failed to get discovery RPM'];
    return promiseUtil.retryPromise(getIControlPromise, RETRY_OPTIONS, args)
        // give the request a moment to complete
        .then((response) => promiseUtil.delay(200, response))
        .then((response) => {
            const opts = {
                path: `/mgmt/shared/iapp/package-management-tasks/${JSON.parse(response.body).id}`,
                method: 'GET',
                ctype: 'application/json',
                why: 'Get from response id',
                crude: true
            };
            return getRPMInfo(context, opts, 1)
                .then((info) => (property ? (info || {})[property] : info));
        });
}

function getRPMInfo(context, options, attempts) {
    if (attempts >= 5) {
        log.debug('cloudLibUtils.getRPMName: Aborting after max retry attempts');
        return undefined;
    }
    return util.iControlRequest(context, options)
        .then((res) => {
            const body = JSON.parse(res.body);
            if (body.status !== 'FINISHED') {
                return promiseUtil.delay(200)
                    .then(() => getRPMInfo(context, options, attempts + 1));
            }
            let discoveryRpm;
            body.queryResponse.forEach((pack) => {
                if (pack.name === 'f5-service-discovery') {
                    discoveryRpm = pack;
                }
            });

            return discoveryRpm;
        })
        .catch(() => getRPMInfo(context, options, attempts + 1));
}

function checkUninstallTask(context, options, attempts) {
    if (attempts >= 5) {
        log.debug('cloudLibUtils.checkUninstallTask: Aborting after max retry attempts');
        return false;
    }
    return util.iControlRequest(context, options)
        .then((res) => {
            const body = JSON.parse(res.body);
            if (body.status !== 'FINISHED') {
                return promiseUtil.delay(200)
                    .then(() => checkUninstallTask(context, options, attempts + 1));
            }
            return true;
        })
        .catch(() => checkUninstallTask(context, options, attempts + 1));
}

function uninstallDiscoveryRpm(context, discoveryRpm) {
    // not installed
    if (typeof discoveryRpm === 'undefined') {
        return Promise.resolve(true);
    }
    const options = {
        path: '/mgmt/shared/iapp/package-management-tasks',
        method: 'POST',
        ctype: 'application/json',
        why: 'Uninstall discovery worker',
        send: JSON.stringify({ operation: 'UNINSTALL', packageName: discoveryRpm }),
        crude: true
    };
    log.debug('Uninstalling service discovery worker');

    const args = [context, options, 'Failed to uninstall RPM'];
    return promiseUtil.retryPromise(getIControlPromise, RETRY_OPTIONS, args)
        // give the request a moment to complete
        .then((response) => promiseUtil.delay(200, response))
        .then((response) => {
            const uninstallTaskId = JSON.parse(response.body).id;
            const opts = {
                path: `/mgmt/shared/iapp/package-management-tasks/${uninstallTaskId}`,
                method: 'GET',
                ctype: 'application/json',
                why: 'Get status of uninstall',
                crude: true
            };
            return checkUninstallTask(context, opts, 1);
        })
        .then((uninstalled) => {
            if (!uninstalled) {
                log.debug('Warning: Uninstall may not have completely finished.');
            }
            return undefined;
        })
        .catch((e) => {
            log.debug(`Error during discoveryWorker uninstall: ${e.message} at ${e.stackTrace}`);
            return undefined;
        });
}

function copyDiscoveryRpm(context) {
    const fileName = fs.readdirSync(SOURCE_PATH).find((name) => name.indexOf('f5-service-discovery') >= 0);
    return new Promise((resolve, reject) => {
        iappUtil.copyToHost(
            context,
            `${SOURCE_PATH}/${fileName}`,
            (error) => {
                if (error) reject(error);
                else resolve(fileName);
            }
        );
    });
}

function installDiscoveryRpm(context) {
    // TODO add version checking
    return promiseUtil.retryPromise(copyDiscoveryRpm, RETRY_OPTIONS, [context])
        .then((fileName) => {
            const options = {
                path: '/mgmt/shared/iapp/package-management-tasks',
                method: 'POST',
                ctype: 'application/json',
                why: 'Install discovery worker',
                crude: true,
                send: JSON.stringify({
                    operation: 'INSTALL',
                    packageFilePath: `/var/config/rest/downloads/${fileName}`
                })
            };
            log.debug('Installing discovery worker');

            // There is no status code returned for this request
            const args = [context, options, 'Failed to install discovery RPM', { checkStatus: false }];
            return promiseUtil.retryPromise(getIControlPromise, RETRY_OPTIONS, args);
        });
}

function waitForDiscoveryInit(context) {
    const options = {
        path: '/mgmt/shared/service-discovery/info',
        method: 'GET',
        why: 'Get discovery worker info',
        crude: true
    };

    const args = [context, options, 'Failed waiting for discovery to start'];
    return promiseUtil.retryPromise(getIControlPromise, { retries: 60, delay: 1000 }, args);
}

function checkVersions(desiredVersions, foundVersions) {
    if (desiredVersions.length !== foundVersions.length) {
        let message = `Length of desired versions (${desiredVersions.length}) `;
        message += `does not equal length of found versions (${foundVersions.length})`;
        throw new Error(message);
    }

    return desiredVersions.every((desired, i) => semver.eq(desired, foundVersions[i]));
}

function getDesiredVersions() {
    return readFile(`${IAPP_DIR}/lib/versions.json`)
        .then((data) => JSON.parse(data));
}

function findCloudLibVersions(context) {
    const versions = {};
    const requests = [];

    requests.push(
        getDiscoveryRpm(context)
            .then((rpmInfo) => {
                versions.discoveryWorker = rpmInfo ? `${rpmInfo.version}-${rpmInfo.release}` : '0.0.0';
            })
    );

    return Promise.all(requests).then(() => versions);
}

function getFoundVersions(context) {
    return Promise.resolve({})
        .then((versions) => findCloudLibVersions(context).then((results) => Object.assign(versions, results)));
}

function needCloudLibsInstall(context, fromStartup) {
    if (context.host.deviceType === DEVICE_TYPES.BIG_IQ) {
        return false;
    }
    // We can't install SD when running in a container on startup (no target),
    // But we still need to when it's during a request
    if (fromStartup && context.host.deviceType === DEVICE_TYPES.CONTAINER) {
        return false;
    }
    return true;
}

function getIsInstalled(context) {
    if (!needCloudLibsInstall(context)) {
        return Promise.resolve(true);
    }

    function toArray(versions) {
        return [
            versions.discoveryWorker
        ];
    }

    let desiredVersions = [];
    let foundVersions = [];

    log.debug('Checking cloud-libs versions');
    return getDesiredVersions()
        .then((o) => {
            log.debug(`Desired versions: ${JSON.stringify(o)}`);
            desiredVersions = toArray(o);
        })
        .then(() => getFoundVersions(context))
        .then((o) => {
            log.debug(`Discovered versions: ${JSON.stringify(o)}`);
            foundVersions = toArray(o);
        })
        .then(() => checkVersions(desiredVersions, foundVersions))
        .then((result) => {
            log.debug(`Versions match: ${result}`);
            return result;
        });
}

function ensureInstall(context) {
    return getIsInstalled(context)
        .then((isInstalled) => (isInstalled ? Promise.resolve() : install(context)));
}

function ensureUninstall(context) {
    return getDiscoveryRpm(context, 'packageName')
        .then((discoveryRpmName) => uninstallDiscoveryRpm(context, discoveryRpmName));
}

function cleanupStoredDecl(context) {
    if (context.target.deviceType !== DEVICE_TYPES.BIG_IP || context.host.buildType !== BUILD_TYPES.CLOUD) {
        const message = 'cleanupStoredDecl can only be called when AS3 is running on a bigip!';
        log.error(message);
        throw new Error(message);
    }
    const cmd = `rm -f ${constants.encryptedDeclLocation} ${constants.encryptedDeclCounter}`;
    return util.executeBashCommandExec(cmd)
        .catch((error) => {
            log.error(`An error occured while deleting stored declaration: ${error}`);
        });
}

let IS_AVAILABLE;
function getIsAvailable() {
    if (typeof IS_AVAILABLE !== 'undefined') {
        return Promise.resolve(IS_AVAILABLE);
    }

    return new Promise((resolve) => {
        fs.access(SOURCE_PATH, fs.R_OK, (error) => {
            if (error) {
                log.debug(`cloud-lib directory ${SOURCE_PATH} not found/readable`);
                resolve(false);
                return;
            }
            resolve(true);
        });
    })
        .then((isAvailable) => {
            IS_AVAILABLE = isAvailable;
            return isAvailable;
        });
}

function decryptFromRemote(context, secret) {
    const postOptions = {
        path: '/mgmt/shared/service-discovery/encryption',
        method: 'POST',
        send: JSON.stringify({
            action: 'decrypt',
            data: secret
        })
    };

    return util.iControlRequest(context, postOptions)
        .then((response) => response.result)
        .catch((e) => {
            e.message = `Failed decrypting cloud credentials: ${e.message}`;
            throw e;
        });
}

module.exports = {
    checkVersions,
    getIsAvailable,
    getIsInstalled,
    install,
    ensureInstall,
    ensureUninstall,
    cleanupStoredDecl,
    needCloudLibsInstall,
    getDiscoveryRpm,
    uninstallDiscoveryRpm,
    decryptFromRemote,
    waitForDiscoveryInit
};

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

/*
 * Host Context holds information on the Host Machine. These fields are:
 *
 * deviceType - e.g. BIG_IP or BIG_IQ
 * schemaIds - List of IDs returned from parsing the schema(s)
 * as3VersionInfo - Version of AS3, e.g. 3.15.0
 * buildType - e.g. CLOUD or BIG_IP
 * dataStore - AS3 DataGroup used for setting up the AsyncHandler
 *
 * These larger objects are also stored, but should they be?
 * parser - Configured As3Parser
 * asyncHandler - Configured AsyncHandler
 * teemDevice - Configured TEEM Device for the host machine
 */

const fs = require('fs');
const path = require('path');

const TeemDevice = require('@f5devcentral/f5-teem').Device;
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const constants = require('../constants');
const util = require('../util/util');
const log = require('../log');
const As3Parser = require('../adcParser');
const AsyncHandler = require('../asyncHandler');
const cloudLibUtils = require('../util/cloudLibUtils');
const DataGroupDataStore = require('../DataGroupDataStore');
const JsonDataStore = require('../JsonDataStore');
const Context = require('./context');
const config = require('../config');

const CHECK_INTERVAL_MS = 10000;
const CHECK_TIMEOUT_MS = 2 * 60 * 1000;

class HostContext {
    constructor(initialContext) {
        this.initialContext = initialContext ? util.simpleCopy(initialContext) : {};
        this.context = util.simpleCopy(this.initialContext);
    }

    get() {
        let promise = Promise.resolve(this.context);
        if (Object.keys(this.context).length === Object.keys(this.initialContext).length) {
            promise = buildContext.call(this, this.initialContext);
        }
        return promise.then((context) => {
            this.context = context;
            return Promise.resolve(this.context);
        })
            .catch((err) => Promise.reject(err));
    }
}

function buildContext(initialContext) {
    const context = {};

    return getDeviceType(initialContext)
        .then((deviceType) => {
            context.deviceType = deviceType;
            const urls = ['http://localhost:8100/tm/util/available', 'http://localhost:8100/mgmt/tm/sys/provision'];
            const promises = urls.map((url) => () => checkAddtlDependencies(url, CHECK_TIMEOUT_MS, CHECK_INTERVAL_MS)
                .then((result) => {
                    if (!result.success) {
                        throw new Error(`Unable to verify additional dependencies: ${result.errorMessage}}`);
                    }
                    return Promise.resolve();
                }));
            return promiseUtil.series(promises);
        })
        .then(() => {
            context.parser = new As3Parser(context.deviceType);
            return context.parser.loadSchemas();
        })
        .then((schemaIds) => {
            context.schemaIds = schemaIds;
            context.as3VersionInfo = initAs3VersionInfo(context);
            return initServiceDiscovery.call(this, context);
        })
        .then((buildType) => {
            context.buildType = buildType;
        })
        .then(() => clearLocalMutex(context.deviceType))
        .then(() => initAsyncDataStore(context.deviceType))
        .then((dataStore) => {
            context.asyncDataStore = dataStore;
            return initAsyncHandler(dataStore);
        })
        .then((asyncHandler) => {
            context.asyncHandler = asyncHandler;
            const assetInfo = {
                name: 'Application Services',
                version: context.as3VersionInfo.version
            };
            context.teemDevice = new TeemDevice(assetInfo);
        })
        .then(() => Promise.resolve(context));
} // buildContext()

function getDeviceType(initialContext) {
    if (initialContext && initialContext.deviceType) {
        return Promise.resolve(initialContext.deviceType);
    }
    let deviceType = constants.DEVICE_TYPES.CONTAINER;
    return util.getDeviceInfo()
        .then((deviceInfo) => {
            if (typeof deviceInfo !== 'undefined') {
                // sometimes icontrol returns just the product without the slots
                // if so, check deviceInfo.product first, and then override with active slot if present
                if (deviceInfo.product) {
                    deviceType = deviceInfo.product;
                }

                if (deviceInfo.slots) {
                    const activeSlot = deviceInfo.slots.find((slot) => slot.isActive && slot.product);

                    if (activeSlot) {
                        deviceType = activeSlot.product;
                    }
                }
            }

            return deviceType;
        })
        .catch((e) => {
            log.warning(`Unable to get device type. Assigning default device type "Container". Error: ${e.message}.`);
            return deviceType;
        });
}

function checkAddtlDependencies(url, timeout, interval) {
    // deps that cannot be handled by the availability monitor
    // requires user context/auth so manually build check
    const result = {
        success: true
    };

    if (timeout <= 0) {
        result.success = false;
        result.errorMessage = 'Dependencies Check failed: Timed out waiting for dependencies to load';
        return Promise.resolve(result);
    }

    const options = {
        why: 'Check if dependency endpoint is up',
        crude: true,
        method: 'GET',
        retry503: 5,
        host: 'localhost',
        auth: 'admin:',
        port: 8100
    };
    return util.httpRequest(url, options)
        .then((response) => {
            if (response.statusCode !== 200) {
                log.warning('Dependencies Check failed, retrying.');
                return promiseUtil.delay(interval)
                    .then(() => checkAddtlDependencies(url, timeout - interval, interval));
            }
            return result;
        })
        .catch((e) => {
            log.warning(`Dependencies Check failed, retrying. ${e}`);
            timeout -= interval;
            return promiseUtil.delay(interval)
                .then(() => checkAddtlDependencies(url, timeout - interval, interval));
        });
}

function initAs3VersionInfo(context) {
    const versionInfo = fs.readFileSync(path.join(__dirname, '../../version'), 'ascii').split('-');
    const schema = context.parser.schemas.find((s) => s.$id === constants.adcSchemaId);
    const as3Info = {
        version: versionInfo[0],
        release: versionInfo[1],
        schemaCurrent: schema.properties.schemaVersion.enum[0],
        schemaMinimum: schema.properties.schemaVersion.enum.reverse()[0]
    };
    log.warning(`AS3 version: ${as3Info.version}`);
    return as3Info;
}

function initServiceDiscovery(context) {
    const deviceType = context.deviceType;
    let buildType;

    context.sdInstalled = false;

    if (deviceType !== constants.DEVICE_TYPES.BIG_IP) {
        return Promise.resolve();
    }

    return cloudLibUtils.getIsAvailable()
        .then((isAvailable) => {
            if (!isAvailable) {
                return Promise.resolve();
            }

            buildType = constants.BUILD_TYPES.CLOUD;
            const newContext = Context.build({ deviceType, buildType });
            newContext.request.basicAuth = `Basic ${util.base64Encode('admin:')}`;
            newContext.target.host = newContext.target.host || constants.defaultHost;
            newContext.target.port = newContext.target.port || constants.defaultPort;
            newContext.tasks = [{ protocol: 'http', urlPrefix: 'http://localhost:8100' }];

            return config.getAllSettings()
                .then((settings) => {
                    if (settings.serviceDiscoveryEnabled) {
                        return cloudLibUtils.ensureInstall(newContext)
                            .then(() => {
                                // Toggle SD installed state only after installation is complete
                                context.sdInstalled = true;
                            });
                    }
                    return cloudLibUtils.ensureUninstall(newContext);
                });
        })
        .then(() => buildType);
}

function clearLocalMutex(deviceType) {
    if (deviceType === constants.DEVICE_TYPES.CONTAINER) {
        return Promise.resolve();
    }

    const url = `http://127.0.0.1/mgmt/tm/ltm/data-group/internal/~Common~${constants.as3CommonFolder}~____appsvcs_lock`;
    const options = {
        why: 'Delete mutex lock on startup',
        crude: true,
        method: 'DELETE',
        retry503: 5,
        host: '127.0.0.1',
        auth: 'admin:',
        port: 8100
    };
    return util.httpRequest(url, options);
}

function makeDataStore(type, name) {
    switch (type) {
    case 'memory': return new JsonDataStore();
    case 'data-group': return new DataGroupDataStore(`/Common/appsvcs/${name}`);
    default: throw new Error(`Unknown data store type: ${type}`);
    }
}

function initAsyncDataStore(deviceType) {
    return Promise.resolve()
        .then(() => {
            // Containers do not have data groups, so use in memory storage for now
            if (deviceType === constants.DEVICE_TYPES.CONTAINER) {
                return config.updateSettings({
                    asyncTaskStorage: 'memory'
                });
            }
            return Promise.resolve();
        })
        .then(() => config.getAllSettings())
        .then((settings) => makeDataStore(
            settings.asyncTaskStorage || 'data-group',
            'dataStore'
        ));
}

function initAsyncHandler(dataStore) {
    const asyncHandler = new AsyncHandler(dataStore);
    return asyncHandler.restoreState()
        .then(() => asyncHandler);
}

module.exports = HostContext;

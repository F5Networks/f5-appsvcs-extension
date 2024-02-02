/**
 * Copyright 2024 F5, Inc.
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
const UpdaterTmsh = require('./updaterTmsh');
const UpdaterRest = require('./updaterRest');
const DiffProcessor = require('./diffProcessor');
const tracerUtil = require('./tracer').Util;
const fetch = require('./fetch');
const bigiq = require('./bigiq');
const util = require('./util/util');
const log = require('./log');
const hash = require('./util/hashUtil');
const constants = require('./constants');

const DEVICE_TYPES = require('./constants').DEVICE_TYPES;

const postProcessInfo = {};

const reportTime = function (taskName, promiseFunction) {
    log.debug(`Begin ${taskName}`);
    const time = new Date();
    return promiseFunction()
        .then((result) => {
            log.notice(`${taskName} time: ${(new Date() - time) / 1000} seconds`);
            return result;
        });
};

const updateTenant = function (updaters, context, desired, current, diff) {
    if (diff.length === 0) {
        context.tasks[context.currentIndex].firstPassNoDelete = false;
        return Promise.resolve(log.debug({
            code: 200,
            message: 'no change'
        }));
    }

    // Run updaters
    const updates = updaters.map((u) => () => {
        const filteredDiff = diff.filter((d) => d.tags.indexOf(u.tag) > -1);
        return u.update(desired, current, filteredDiff);
    });
    return promiseUtil.series(updates)
        .then((results) => results.reduce(
            (all, result) => Object.assign(all, result),
            {
                code: 200,
                message: 'success'
            }
        ))
        .catch((error) => ({
            code: error.code,
            message: 'declaration failed',
            response: error.message
        }));
};

const postProcessUpdateAllTenants = function (updaters, context) {
    // Run updaters
    const updateInfo = postProcessInfo[context.tasks[context.currentIndex].uuid];
    if (!updateInfo) {
        return Promise.resolve();
    }

    let result;
    const updates = updaters.map((u) => () => u.postProcessUpdate(updateInfo));
    return promiseUtil.series(updates)
        .then((results) => {
            results = results.filter((elem) => elem); // filter out empty values
            if (results.length > 0) {
                result = results
                    .reduce(
                        (all, thisResult) => Object.assign(all, thisResult),
                        {
                            code: 200,
                            message: 'success'
                        }
                    );
            }
            return result;
        })
        .catch((error) => {
            result = {
                code: (error).code,
                message: 'declaration failed',
                response: error.message
            };
            return result;
        })
        .then(() => {
            delete postProcessInfo[context.tasks[context.currentIndex].uuid];
            return result;
        });
};

const fetchCurrentConfigFromPrev = function (context, tenantId, commonConfig, previousDeclaration) {
    const prevDecl = util.simpleCopy(previousDeclaration);

    return Promise.resolve()
        .then(() => context.host.parser.digest(context, prevDecl, {
            copySecrets: true,
            baseDeclaration: previousDeclaration
        }))
        .then(() => reportTime(
            `parsing current ${tenantId} config`,
            () => fetch.getDesiredConfig(context, tenantId, prevDecl, commonConfig)
        ));
};

/**
 * Will gather all new SD tasks and DELETE them when AS3 fails.
 *
 * @param {object} context
 * @param {array} diffs
 */
const handleServiceDiscoveryTasks = function (context, diffs) {
    const sdTasks = [];
    diffs.forEach((d) => {
        if (d.kind === 'N' && d.rhs && d.rhs.command === 'mgmt shared service-discovery task') {
            sdTasks.push(d);
        }
    });

    sdTasks.forEach((task) => {
        const options = {
            method: 'DELETE',
            path: `/mgmt/shared/service-discovery/task/${task.rhs.properties.id}?ignoreMissing=true`,
            ctype: 'application/json',
            why: 'Clean up SD task'
        };
        return util.iControlRequest(context, options);
    });
};

const handleAPMProfileUpdatedEvent = function (eventInfo) {
    const uuid = eventInfo.uuid;
    const profilePath = `/${eventInfo.tenant}/${eventInfo.oldName}`;
    if (!postProcessInfo[uuid]) {
        postProcessInfo[uuid] = {};
    }

    if (!postProcessInfo[uuid].apmProfileUpdates) {
        postProcessInfo[uuid].apmProfileUpdates = {};
    }

    postProcessInfo[uuid].apmProfileUpdates[profilePath] = util.simpleCopy(eventInfo);
};

const handleProfileReferencedEvent = function (eventInfo) {
    const uuid = eventInfo.uuid;
    if (!postProcessInfo[uuid]) {
        postProcessInfo[uuid] = {};
    }

    if (!postProcessInfo[uuid].profileReferences) {
        postProcessInfo[uuid].profileReferences = {};
    }

    if (!postProcessInfo[uuid].profileReferences[eventInfo.profilePath]) {
        postProcessInfo[uuid].profileReferences[eventInfo.profilePath] = {
            virtuals: [],
            iRules: {}
        };
    }

    if (eventInfo.virtualPath) {
        const virtuals = postProcessInfo[uuid].profileReferences[eventInfo.profilePath].virtuals;
        if (virtuals.indexOf(eventInfo.virtualPath) === -1) {
            virtuals.push(eventInfo.virtualPath);
        }
    }

    if (eventInfo.iRule) {
        const iRules = postProcessInfo[uuid].profileReferences[eventInfo.profilePath].iRules;
        if (!iRules[eventInfo.iRule.name]) {
            iRules[eventInfo.iRule.name] = eventInfo.iRule.text;
        }
    }
};

const registerForRequestEvents = function (context) {
    context.request.eventEmitter.on(constants.EVENTS.APM_PROFILE_UPDATED, handleAPMProfileUpdatedEvent);
    context.request.eventEmitter.on(constants.EVENTS.PROFILE_REFERENCED, handleProfileReferencedEvent);
};

const postAuditAllTenants = function (context) {
    const startTime = new Date();
    const updaters = [
        new UpdaterRest(context, 'all_tenants', context.control),
        new UpdaterTmsh(context, 'all_tenants', context.control)
    ];

    return reportTime(
        'post process updating all_tenants',
        () => postProcessUpdateAllTenants(updaters, context)
    )
        .then((response) => {
            if (!response) {
                return [];
            }

            response.host = context.target.host;
            response.tenant = 'all_tenants';
            response.runTime = new Date() - startTime;
            return log.debug(response);
        })
        .catch((err) => {
            const response = {};
            response.message = err.message;
            response.host = context.target.host;
            response.tenant = 'all_tenants';
            response.code = err.code;
            log.error(err);
            return log.debug(response); // intentionally not reject()
        });
};

// Need this setter/getter for testing as stubbing auditTenant is difficult
const setPostProcessInfo = function (uuid, info) {
    postProcessInfo[uuid] = util.simpleCopy(info);
};
const getPostProcessInfo = function () {
    return postProcessInfo;
};

const isSharedNeeded = (declaration, tenant) => {
    let sharedRefRegex = /"Shared\//;
    const declString = JSON.stringify(declaration);

    if (sharedRefRegex.test(declString)) {
        return true;
    }

    sharedRefRegex = new RegExp(`"/${tenant}/Shared/`);
    if (sharedRefRegex.test(declString)) {
        return true;
    }

    return false;
};

const filterConfigForPerApp = function (context, config, declaration) {
    const filteredConfig = util.simpleCopy(config);

    if (!context.request.isPerApp) {
        return filteredConfig;
    }

    const alwaysNeededCommands = [
        'auth partition',
        'ltm node',
        'ltm virtual-address'
    ];

    function isNeeded(tenantName, itemName, configItem, requiredApps) {
        if (alwaysNeededCommands.indexOf(configItem.command) !== -1) {
            return true;
        }

        let needed = false;
        requiredApps.forEach((appName) => {
            if (itemName.startsWith(`/${tenantName}/${appName}/`)) {
                needed = true;
            }
        });

        return needed;
    }

    const requiredApps = context.request.perAppInfo.apps.slice();
    if (isSharedNeeded(declaration, context.request.perAppInfo.tenant)) {
        requiredApps.push('Shared');
    }

    const configKeys = Object.keys(filteredConfig);
    configKeys.forEach((configKey) => {
        if (!isNeeded(context.request.perAppInfo.tenant, configKey, filteredConfig[configKey], requiredApps)) {
            delete filteredConfig[configKey];
        }
    });

    return filteredConfig;
};

/**
 * audit specified Tenant
 *
 * @param {object} context
 * @param {string} tenantId
 * @param {object} declaration
 * @param {object} commonConfig
 * @param {object} previousDeclaration
 * @param {object} uncheckedDiff
 * returns {Promise} - resolves to status response
 */
const auditTenant = function (context, tenantId, declaration, commonConfig, previousDeclaration, uncheckedDiff) {
    log.debug(`audit ${tenantId}`);

    const traceSpan = context.request.tracer.startChildSpan(
        'audit.auditTenant',
        context.request.rootSpan
    );
    traceSpan.log(
        {
            event: 'classes_in_declaration',
            value: tracerUtil.getClassList(context.request.tracer, declaration)
        }
    );

    const tenantControls = util.simpleCopy(context.control);

    // Update tenantControls object with any tenant controls from the declaration
    util.updateControlsWithDecl(tenantControls, declaration[tenantId].controls);

    log.updateGlobalSettings(tenantControls);

    if (typeof tenantControls.fortune !== 'undefined') {
        context.request.fortune = tenantControls.fortune;
        // Remove the fortune object after it is no longer needed
        delete context.control.fortune;
        delete declaration[tenantId].controls.fortune;
    }

    const startTime = new Date();
    let configuredTenant = tenantId;
    if (tenantId !== 'Common' && declaration.Common) {
        configuredTenant = `${configuredTenant}, Common`;
    }

    if (context.target.deviceType === DEVICE_TYPES.BIG_IQ) {
        return bigiq.deployTenant(context, tenantId, declaration)
            .then((response) => {
                log.notice(`${tenantId} update time: ${(new Date() - startTime) / 1000} seconds`);
                response.host = context.target.host;
                response.tenant = configuredTenant;
                response.runTime = new Date() - startTime;
                return log.debug(response);
            })
            .catch((err) => {
                const response = {};
                response.message = err.message;
                response.host = context.target.host;
                response.tenant = configuredTenant;
                log.error(err);
                traceSpan.log(err);
                return log.debug(response); // intentionally not reject()
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    }
    const traceResponse = typeof tenantControls.traceResponse !== 'undefined'
        ? tenantControls.traceResponse : context.tasks[context.currentIndex].traceResponse;
    tenantControls.traceResponse = traceResponse;
    context.tasks[context.currentIndex].traceResponse = traceResponse;

    // Initialize updaters
    const updaters = [
        new UpdaterRest(context, tenantId),
        new UpdaterTmsh(context, tenantId)
    ];

    let tenantDesiredConfig = null;
    let tenantCurrentConfig = null;
    let tenantConfigDiff = null;
    let diffProcessor = null;

    return Promise.resolve()
        .then(() => {
            // PerApp does not support optimisticLockKey, yet 5/22/2023
            if (!context.request.isPerApp && declaration[tenantId].optimisticLockKey
                && previousDeclaration[tenantId] !== undefined) {
                delete previousDeclaration[tenantId].optimisticLockKey;
                const localHash = hash.hashTenant(JSON.stringify(previousDeclaration[tenantId]));
                if (localHash !== declaration[tenantId].optimisticLockKey) {
                    const message = 'The hash you submitted does not match the hash on the current Tenant. This usually indicates there was a change to the Tenant since you pulled this hash. You will want to do a GET and see what the changes are.';
                    log.debug(message);
                    throw new Error(message);
                }
            }
            return Promise.resolve();
        })
        .then(() => reportTime(
            `parsing desired ${tenantId} config`,
            () => fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
        ))
        .then((result) => {
            if (!context.request.isPerApp) {
                return result;
            }

            return filterConfigForPerApp(context, result, declaration);
        })
        .then((result) => {
            tenantDesiredConfig = result;
            log.writeTraceFile(tenantId, 'desired', JSON.stringify(result, undefined, 2), context);
        })
        .then(() => fetch.checkDesiredForReferencedProfiles(context, tenantDesiredConfig))
        .then(() => {
            if (tenantId === 'Common') {
                const dataGroupInfo = {
                    name: 'commonAccessProfiles',
                    storageName: 'accessProfiles'
                };
                return fetch.getDataGroupData(context, dataGroupInfo)
                    .then(() => {
                        dataGroupInfo.name = 'commonRouteDomains';
                        dataGroupInfo.storageName = 'routeDomains';
                        return fetch.getDataGroupData(context, dataGroupInfo);
                    });
            }
            return Promise.resolve();
        })
        .then(() => {
            if (context.tasks[context.currentIndex].unchecked) {
                return fetchCurrentConfigFromPrev(context, tenantId, commonConfig, previousDeclaration);
            }

            return reportTime(
                `parsing current ${tenantId} config`,
                () => fetch.getTenantConfig(context, tenantId, commonConfig)
            );
        })
        .then((result) => {
            if (!context.request.isPerApp) {
                return result;
            }

            return filterConfigForPerApp(context, result, declaration);
        })
        .then((result) => {
            tenantCurrentConfig = result;
            if (context.tasks[context.currentIndex].unchecked && context.tasks[context.currentIndex].firstPassNoDelete === false && tenantId === 'Common') {
                Object.keys(uncheckedDiff).forEach((key) => {
                    tenantCurrentConfig[key] = util.simpleCopy(uncheckedDiff[key]);
                });
            }
            log.writeTraceFile(tenantId, 'current', JSON.stringify(result, undefined, 2), context);
        })
        .then(() => reportTime(
            `generating ${tenantId} diff`,
            () => fetch.getDiff(
                context,
                tenantCurrentConfig,
                tenantDesiredConfig,
                commonConfig,
                tenantId,
                uncheckedDiff
            )
        ))
        .then((result) => {
            tenantConfigDiff = result;
            diffProcessor = new DiffProcessor(result, tenantCurrentConfig, tenantDesiredConfig);
        })
        .then(() => {
            if (traceResponse) {
                context.log[`${tenantId}Desired`] = tenantDesiredConfig;
                context.log[`${tenantId}Current`] = tenantCurrentConfig;
                context.log[`${tenantId}Diff`] = tenantConfigDiff;
            }
        })
        .then(() => diffProcessor.process())
        .then(() => {
            // Tag diff entries for updaters
            updaters.forEach((u) => u.tagDiff(tenantConfigDiff));
            log.writeTraceFile(tenantId, 'diff', JSON.stringify(tenantConfigDiff, undefined, 2), context);
        })
        .then(() => diffProcessor.validate().catch((error) => {
            context.tasks[context.currentIndex].firstPassNoDelete = false;
            throw error;
        }))
        .then(() => reportTime(
            `updating ${tenantId}`,
            () => updateTenant(updaters, context, tenantDesiredConfig, tenantCurrentConfig, tenantConfigDiff)
        ))
        .then((response) => {
            if (response.code !== 200) {
                handleServiceDiscoveryTasks(context, tenantConfigDiff);
            }
            return response;
        })
        .then((response) => {
            if (tenantId === 'Common' && !context.tasks[context.currentIndex].firstPassNoDelete) {
                const dataGroupInfo = {
                    command: 'apm profile access',
                    name: 'commonAccessProfiles',
                    storageName: 'accessProfiles'
                };
                return fetch.updateDataGroup(context, tenantDesiredConfig, dataGroupInfo)
                    .then(() => {
                        dataGroupInfo.name = 'commonRouteDomains';
                        dataGroupInfo.storageName = 'routeDomains';
                        dataGroupInfo.command = 'net route-domain';
                        return fetch.updateDataGroup(context, tenantDesiredConfig, dataGroupInfo);
                    })
                    .then(() => response);
            }
            return response;
        })
        .then((response) => {
            context.tasks[context.currentIndex].firstPassNoDelete = false;
            response.host = context.target.host;
            response.tenant = tenantId;
            response.runTime = new Date() - startTime;
            response.declarationId = declaration.id;
            return log.info(response);
        })
        .catch((err) => {
            const response = {};
            response.message = err.message;
            response.host = context.target.host;
            response.tenant = tenantId;
            response.code = err.code;
            log.error(err);
            traceSpan.logError(err);
            return log.debug(response); // intentionally not reject()
        })
        .then((result) => {
            traceSpan.finish();
            return result;
        });
}; // auditTenant()

/**
 * give list of Tenants to process, invoke
 * auditTenant() for each one
 *
 * @public
 * @param {object} context
 * @param {array} tenantList - list of tenants to audit
 * @param {object} declaration - the declaration
 * @param {object} commonConfig
 * @param {object} previousDeclaration
 * @param {number} [index] - index in list of tenants we should process next. default is 0
 * @param {object} uncheckedDiff - calculated correction due to being unchecked
 * @returns {Promise} - resolves to array of per-Tenant responses
 */
const allTenants = function (context, tenantList, declaration, commonConfig, previousDeclaration, index,
    uncheckedDiff) {
    let responses = [];

    if (!tenantList.length) {
        return Promise.resolve([{
            message: 'no change',
            host: context.target.host
        }]);
    }

    let i = index || 0;

    if (i === 0) {
        registerForRequestEvents(context);
    }

    if (context.tasks[context.currentIndex].unchecked && typeof uncheckedDiff === 'undefined') {
        uncheckedDiff = {};
    }

    const tenantId = tenantList[i];
    const decl = util.simpleCopy(declaration);
    // Deepcopy of declaration is required if Common is a tenantId - appears twice in tenantList
    return auditTenant(context, tenantId, decl, commonConfig, previousDeclaration, uncheckedDiff)
        .then((response) => {
            responses.push(response);
            i += 1;
            if (i < tenantList.length) {
                return allTenants(context, tenantList, declaration, commonConfig, previousDeclaration, i, uncheckedDiff)
                    .then((res) => {
                        responses = responses.concat(res);
                        return responses;
                    });
            }
            return postAuditAllTenants(context)
                .then((postAuditResponses) => responses.concat(postAuditResponses));
        });
}; // allTenants()

module.exports = {
    allTenants,
    handleServiceDiscoveryTasks,
    auditTenant,
    setPostProcessInfo,
    getPostProcessInfo
};

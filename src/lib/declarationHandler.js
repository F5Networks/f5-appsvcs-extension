/**
 * Copyright 2026 F5, Inc.
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

const jiff = require('jiff');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const TeemRecord = require('@f5devcentral/f5-teem').Record;

const schemaOverlay = require('./schemaOverlay');
const audit = require('./audit');
const fetch = require('./fetch');
const log = require('./log');
const util = require('./util/util');
const DeclarationProvider = require('./declarationProvider');
const TargetContext = require('./context/targetContext');
const cloudLibUtils = require('./util/cloudLibUtils');
const fortunes = require('./fortunes.json');
const mutex = require('./mutex');
const hash = require('./util/hashUtil');
const constants = require('./constants');
const declartionUtil = require('./util/declarationUtil');
const perAppUtil = require('./util/perAppUtil');
const { getAffectedTenant } = require('./util/extractUtil');

const STATUS_CODES = require('./constants').STATUS_CODES;
const DEVICE_TYPES = require('./constants').DEVICE_TYPES;
const BUILD_TYPES = require('./constants').BUILD_TYPES;

const REGEX_COMMON_REF = /"\/Common\/Shared/;

// This is a result of refactoring validate.js
// The core logic was preserved with minimal changes (method extractions).
// Some names and variables have been updated for clarity.
// There are also some eslint-related formatting.
// Declaration processing (get, store, list) have now been moved to declarationProvider.

// Originally declaration request logic was on the rest handler onDeclare.js
// Then the bulk was moved to validate.js (See commit f8184a0155600cf523e441c7f9ad2aa9dc41698e)
// Subsequent comments are from the original unless otherwise noted.
// - @austria

class DeclarationHandler {
    constructor() {
        this.declarationProvider = new DeclarationProvider();
    }

    static buildResult(statusCode, errorMessage, body) {
        if (!statusCode) {
            statusCode = errorMessage ? STATUS_CODES.BAD_REQUEST : STATUS_CODES.OK;
        }
        return {
            body,
            errorMessage,
            statusCode
        };
    }

    /**
     * return a Promise to retrieve a saved declaration
     * of specified age from target.  If age is "list"
     * then list the available declarations.  Resolves
     * to a declaration or an array of objects describing
     * available declarations, or to undefined if the
     * requested declaration is not available
     *
     * @param {object} context - info needed to access BIG-IP
     * @param {number|string} age - zero is most recent
     * @param {boolean} includeMetadata - return metadata info
     * @returns {Promise}
     */
    getSavedDeclarations(context, age, includeMetadata) {
        const traceSpan = context.request.tracer.startChildSpan(
            'declarationHandler.getSavedDeclarations',
            context.request.rootSpan
        );
        if (includeMetadata === undefined) {
            includeMetadata = false;
        }
        if (context.target.deviceType === DEVICE_TYPES.BIG_IQ) {
            if (age !== 0 || age === 'list') {
                log.debug('Get stored declaration failed. "age" property not supported on BIG-IQ');
            }
            return this.declarationProvider.getBigiqDeclaration(context, includeMetadata)
                .catch((e) => {
                    e.message = `cannot fetch declaration from ${context.tasks[context.currentIndex].targetHost} (${e.message})`;
                    traceSpan.logError(e);
                    traceSpan.finish();
                    log.warning(e);
                    throw e;
                })
                .then((result) => {
                    traceSpan.finish();
                    return result;
                });
        }
        return ((age === 'list')
            ? this.declarationProvider.listBigipDeclarations(context)
            : this.declarationProvider.getBigipDeclaration(context, age, includeMetadata))
            .catch((e) => {
                e.message = `cannot fetch declaration ${age} from ${context.tasks[context.currentIndex].targetHost} (${e.message})`;
                traceSpan.logError(e);
                traceSpan.finish();
                log.error(e);
                throw e;
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    } //

    /**
     * exclude non-selected Tenants, other than Common,
     * from a declaration.  SIDE EFFECT: modifies decl
     *
     * @param {object} decl - the declaration
     * @param {array} tenants - tenants to look for in decl. empty is okay
     * @param {boolean} trackTenants - boolean to determine if declaration came from an array
     * @param {boolean} ignoreMissingTenant - boolean to indicate whether or not the function should error if
     *                                        a tenant in the tenants array is missing from the decl
     * @returns {object} - upon success property statusCode is 200
     */
    filterTenantsInDeclaration(decl, tenants, trackTenants, ignoreMissingTenant) {
        const statusCodeOk = { statusCode: STATUS_CODES.OK };
        const tenantsFound = [];

        if (!tenants.length) { return statusCodeOk; }

        const desiredTenants = util.simpleCopy(tenants);
        const keys = Object.keys(decl);
        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            const index = desiredTenants.indexOf(key);
            if (declartionUtil.isTenant(decl[key])) {
                // found a Tenant
                if ((index < 0) && (key !== 'Common')) {
                    // but it's not wanted
                    delete decl[key];
                } else if (index >= 0) {
                    // otherwise
                    // one less to watch for (no dup keys from JSON)
                    desiredTenants.splice(index, 1);
                    tenantsFound.push(key);
                }
            } else if (index >= 0) {
                // caller named a non-Tenant
                return {
                    statusCode: STATUS_CODES.CONFLICT,
                    message: (`specified Tenant name '${key}' matches non-Tenant property`)
                };
            }
        }

        if (ignoreMissingTenant !== true && ((!trackTenants && desiredTenants.length)
            || desiredTenants.length === tenants.length)) {
            return {
                statusCode: STATUS_CODES.NOT_FOUND,
                message: (`specified Tenant(s) '${desiredTenants.toString()}' not found in declaration`)
            };
        }

        if (tenantsFound.length) {
            statusCodeOk.tenantsFound = tenantsFound;
        }

        return statusCodeOk; // success
    }

    /**
     * Retrieves stored declaration, filters it for specific tenants, and parses (digests) it
     *
     * @param {object} context - The context.
     * @param {boolean} ignoreMissingTenant - Whether or not the function should error if a tenant in the
     *                                        current tasks list of desired tenants is not in the declaration.
     */
    getFilteredDeclaration(context, ignoreMissingTenant) {
        const currentTask = context.tasks[context.currentIndex];
        function extractTenants(decl) {
            if (typeof decl === 'undefined' || decl === null) {
                return undefined;
            }

            let tenants = [];
            Object.keys(decl).forEach((key) => {
                const value = decl[key];
                if (declartionUtil.isTenant(value)) {
                    tenants.push(value);
                } else if (value.age) {
                    tenants.push(value);
                } else if (declartionUtil.isADC(value)) {
                    const nestedTenants = extractTenants(value);
                    tenants = tenants.concat(nestedTenants);
                }
            });
            return tenants;
        }
        return Promise.resolve()
            .then(() => this.getSavedDeclarations(context, currentTask.showAge))
            .then((savedDecl) => {
                const tenants = extractTenants(savedDecl);
                if (typeof savedDecl === 'undefined' || !tenants || tenants.length === 0) {
                    // account for existing behavior with the extra /
                    const path = currentTask.fullPath.split('?')[0].split('/');

                    if ((path[path.length - 1] === 'declare' && !tenants) || (tenants && tenants.length === 0)) {
                        return DeclarationHandler.buildResult(STATUS_CODES.NO_CONTENT, 'no declarations found');
                    }
                    return DeclarationHandler.buildResult(STATUS_CODES.NOT_FOUND, 'declaration in specified path not found');
                }

                if (typeof savedDecl.class !== 'string') {
                    if (Array.isArray(savedDecl) && !savedDecl.length) {
                        return DeclarationHandler.buildResult(STATUS_CODES.NOT_FOUND, `no stored declarations found on ${currentTask.host}`);
                    }

                    const filterResults = [];
                    const decls = [];
                    const tenantsNotFound = util.simpleCopy(currentTask.tenantsInPath);

                    savedDecl.forEach((decl, index) => {
                        filterResults.push(
                            this.filterTenantsInDeclaration(
                                decl,
                                currentTask.tenantsInPath,
                                true,
                                ignoreMissingTenant
                            )
                        );

                        (filterResults[index].tenantsFound || []).forEach((found) => {
                            if (tenantsNotFound.indexOf(found) >= 0) {
                                tenantsNotFound.splice(tenantsNotFound.indexOf(found), 1);
                            }
                        });
                    });

                    if (tenantsNotFound.length && !ignoreMissingTenant) {
                        return DeclarationHandler.buildResult(STATUS_CODES.NOT_FOUND,
                            `specified Tenant(s) '${tenantsNotFound.toString()}' not found in declaration`);
                    }

                    if (filterResults.find((result) => result.statusCode === 200)) {
                        filterResults.forEach((filterResult, index) => {
                            if (filterResult.statusCode === 200) {
                                decls.push(savedDecl[index]);
                            }
                        });

                        decls.map((decl) => {
                            decl = filterAndDigest(context, decl, currentTask);
                            return decl;
                        });
                    } else {
                        const errorResult = filterResults.find((result) => result.statusCode !== 200);
                        return DeclarationHandler.buildResult(errorResult.statusCode, errorResult.message);
                    }

                    return decls;
                }

                const decl = savedDecl;
                const filterResult = this.filterTenantsInDeclaration(
                    decl,
                    currentTask.tenantsInPath,
                    undefined,
                    ignoreMissingTenant
                );
                if (filterResult.statusCode !== STATUS_CODES.OK) {
                    return DeclarationHandler.buildResult(
                        filterResult.statusCode, filterResult.message
                    );
                }

                return Promise.resolve()
                    .then(() => filterAndDigest(context, decl, currentTask))
                    .then((digestDeclaration) => {
                        // POST creates missing tenant and apps, so no need to check if they exist in the declaration
                        if (context.request.isPerApp && context.request.method !== 'Post') {
                            const verifyResults = perAppUtil.verifyResourcesExist(
                                digestDeclaration,
                                context.request.perAppInfo
                            );

                            if (verifyResults.statusCode !== STATUS_CODES.OK) {
                                return DeclarationHandler.buildResult(verifyResults.statusCode, verifyResults.message);
                            }
                        }

                        return digestDeclaration;
                    });
            });
    }

    checkForTenantDelete(newDeclaration) {
        // Check objects in newDeclaration and delete if there are no found classes
        let deleteTenant = true;

        Object.keys(newDeclaration).forEach((o) => {
            if (typeof newDeclaration[o] === 'object' && newDeclaration[o].class !== undefined) {
                deleteTenant = false;
            }
        });

        return deleteTenant;
    }

    getOptimisticLockKeys(declaration) {
        fetch.tenantList(declaration).list.forEach((field) => {
            if (!declaration[field].optimisticLockKey) {
                const tenantHash = hash.hashTenant(JSON.stringify(declaration[field]));
                declaration[field].optimisticLockKey = tenantHash;
            }
        });
    }

    handleRead(context) {
        return this.getFilteredDeclaration(context)
            .then((declaration) => {
                let statusCode;
                let body;
                const errMessage = declaration.errorMessage;
                if (typeof declaration.statusCode !== 'undefined') {
                    statusCode = declaration.statusCode;
                    if (declaration.statusCode !== STATUS_CODES.NO_CONTENT
                        && context.tasks[context.currentIndex].showHash) {
                        this.getOptimisticLockKeys(declaration);
                        body = declaration;
                    }
                } else {
                    if (context.tasks[context.currentIndex].showHash) {
                        this.getOptimisticLockKeys(declaration);
                    }
                    body = declaration;
                }
                return DeclarationHandler.buildResult(statusCode, errMessage, body);
            })
            .catch((e) => {
                log.error(e);

                return DeclarationHandler.buildResult(
                    STATUS_CODES.INTERNAL_SERVER_ERROR,
                    `Unable to retrieve declaration: ${e ? e.message : 'reason unknown'}`
                );
            });
    }

    handleCreateUpdateOrDelete(context) {
        const traceSpan = context.request.tracer.startChildSpan(
            'declarationHandler.handleCreateUpdateOrDelete',
            context.request.rootSpan
        );

        const warnings = {};

        // this is what user supplied,
        // with unwanted Tenants edited out and cryptograms replaced
        let baseDecl;
        let prevDecl; // previous decl retrieved from target
        let newDecl; // results of applying declaration
        let age = 0; // non-zero when redeploying historical decl

        let haveMutex = false;
        let auditResults;
        let succeeded = [];
        let failed = [];
        let changeCount = 0;
        let declarationFullId = '';
        const currentTask = context.tasks[context.currentIndex];
        let decl = currentTask.declaration; // may be a stub
        if (!context.request.isPerApp) {
            decl.updateMode = decl.updateMode || 'selective';
        } else {
            // perApp mode relies on selective updates to prevent requests from overwriting each other
            decl.updateMode = 'selective';
        }
        let mutexRefresher = null;
        const commonConfig = {};

        traceSpan.log(
            {
                event: 'task_action',
                value: currentTask.action
            }
        );

        let opResult = {};
        const needsCleanUp = context.target.deviceType === DEVICE_TYPES.BIG_IP
            && context.host.buildType === BUILD_TYPES.CLOUD;

        if (currentTask.showHash) {
            this.getOptimisticLockKeys(decl);
        }

        // Update controls object with any ADC controls from the declaration
        util.updateControlsWithDecl(currentTask, decl.controls);
        log.updateGlobalSettings(currentTask);
        if (currentTask.action === 'redeploy') {
            age = currentTask.redeployAge || 1;
        } else {
            if (currentTask.tenantsInPath.length) {
                const filterTenantsResult = this.filterTenantsInDeclaration(decl,
                    currentTask.tenantsInPath);
                if (filterTenantsResult.statusCode !== STATUS_CODES.OK) {
                    return Promise.resolve()
                        .then(() => DeclarationHandler.buildResult(
                            filterTenantsResult.statusCode,
                            'filterTenantsInDecl failed',
                            filterTenantsResult
                        ))
                        .then((result) => {
                            traceSpan.finish();
                            return result;
                        });
                }
            }
            baseDecl = util.simpleCopy(decl); // save for later
        }

        return Promise.resolve()
            .then(() => {
                const options = {
                    path: `/mgmt/tm/sys/folder/${constants.as3CommonFolder}`,
                    method: 'GET',
                    ctype: 'application/json',
                    why: `Check if ${constants.as3CommonFolder} folder exists`
                };

                return util.iControlRequest(context, options).catch(() => {});
            })
            .then((folderCheck) => {
                if (!folderCheck) {
                    const options = {
                        path: '/mgmt/tm/sys/folder',
                        method: 'POST',
                        ctype: 'application/json',
                        why: `Create ${constants.as3CommonFolder} folder`, // we do not know if its created yet or not
                        send: JSON.stringify({ name: `/Common/${constants.as3CommonFolder}` })
                    };

                    // we dont care about the results here.  Either its already there or the next step will fail.
                    return util.iControlRequest(context, options).catch(() => {});
                }

                return true;
            })
            .then(() => mutex.acquireMutexLock(context))
            .then((refresher) => {
                haveMutex = true;
                mutexRefresher = refresher;

                if (context.target.deviceType === DEVICE_TYPES.BIG_IQ) {
                    context.tasks[context.currentIndex].target = decl.target;
                }

                return handleServiceDiscovery(context);
            })
            .then(() => this.getSavedDeclarations(context, age, true))
            .then((savedDeclWithMetadata) => {
                log.debug(`${(savedDeclWithMetadata.metadata.blocks) ? 'got' : 'did not get'
                } age ${age} declaration`);

                if (currentTask.action !== 'redeploy') {
                    return savedDeclWithMetadata;
                }
                // otherwise, want to redeploy old declaration

                if (!savedDeclWithMetadata.metadata.blocks) {
                    opResult = DeclarationHandler.buildResult(STATUS_CODES.NOT_FOUND, `cannot retrieve declaration of age ${age} from ${currentTask.host}`);
                    return Promise.reject(opResult);
                }

                // TODO: not sure why this is "redeployed" and filter is applied again.
                // There's already a previous call, around line 280
                // see else lines for this:  if (request.action === 'redeploy') {
                // - @austria

                decl = savedDeclWithMetadata.declaration; // re-deploying this one...
                if (currentTask.tenantsInPath.length) {
                    const filterTenantsResult = this.filterTenantsInDeclaration(decl,
                        currentTask.tenantsInPath);
                    if (filterTenantsResult.statusCode !== STATUS_CODES.OK) {
                        opResult = DeclarationHandler.buildResult(
                            filterTenantsResult.statusCode, filterTenantsResult.message, filterTenantsResult
                        );
                        return Promise.reject(opResult);
                    }
                }
                baseDecl = util.simpleCopy(decl);
                if (currentTask.redeployUpdateMode !== 'original') {
                    // to make 'redeploy' a clean roll-back facility,
                    // always deploy "complete" declarations
                    decl.updateMode = currentTask.redeployUpdateMode;
                }
                return this.getSavedDeclarations(context, 0, true);
            })
            .then((info) => {
                log.debug(((info.metadata.blocks)
                    ? 'got most-recent declaration'
                    : 'found no stored declaration'));
                prevDecl = info.declaration;
                if (!decl.target && prevDecl.target) {
                    decl.target = prevDecl.target;
                }

                if (currentTask.action === 'remove' && prevDecl.schemaVersion) {
                    baseDecl.schemaVersion = prevDecl.schemaVersion;
                }

                if (decl.updateMode === 'complete' && !context.request.isPerApp) {
                    // mark unwanted Tenants for deletion
                    info.metadata.tenants.forEach((t) => {
                        // If the last operation was a 'delete' then t will be an empty string, so ignore.
                        if (t) {
                            if (Object.prototype.hasOwnProperty.call(decl, t)) {
                                return; // this one is wanted
                            }
                            // otherwise
                            decl[t] = { class: 'Tenant' };
                        }
                    });
                }

                // if DELETE, update controls object from the saved declaration
                if (currentTask.action === 'remove' && !context.request.isPerApp) {
                    // Update ADC controls
                    util.updateControlsWithDecl(currentTask, prevDecl.controls);
                    log.updateGlobalSettings(currentTask);

                    // Update per-tenant controls
                    info.metadata.tenants.forEach((t) => {
                        if (
                            Object.prototype.hasOwnProperty.call(decl, t)
                            && Object.prototype.hasOwnProperty.call(prevDecl, t)
                            && prevDecl[t].controls
                        ) {
                            decl[t].controls = util.simpleCopy(prevDecl[t].controls);
                        }
                    });
                    return decl;
                }
                return schemaOverlay.applyOverlay(context, decl);
            })
            .then((d) => {
                if (currentTask.action === 'remove' && !context.request.isPerApp) {
                    return Promise.resolve();
                }

                function isCommonNeeded(declaration) {
                    const declString = JSON.stringify(declaration);
                    return REGEX_COMMON_REF.test(declString);
                }

                return Promise.resolve()
                    .then(() => {
                        if (!context.request.isPerApp) {
                            return Promise.resolve();
                        }

                        return this.getFilteredDeclaration(context)
                            .then((allConfig) => {
                                const tenant = context.request.perAppInfo.tenant;
                                let hasControls = false;
                                if (allConfig[tenant]) {
                                    // Even though we probably shouldn't, AS3 has historically allowed the
                                    // controls object to be named 'controls' without a class property.
                                    if (context.request.method !== 'Get' && context.request.method !== 'Delete') {
                                        if (d[tenant].controls || util.getObjectNameWithClassName(d[tenant], 'Controls')) {
                                            hasControls = true;
                                        }
                                    }
                                    d = perAppUtil.mergePreviousTenant(d, allConfig, tenant);
                                    if (!hasControls) {
                                        // Since 'controls' are stored with the declaration and we are now merging
                                        // in the stored declaration, we need to delete controls if they are not in the
                                        // incoming declaration
                                        const controlsName = util.getObjectNameWithClassName(d[tenant], 'Controls') || 'controls';
                                        delete d[tenant][controlsName];
                                    }
                                    if (currentTask.action === 'remove') {
                                        perAppUtil.deleteAppsFromTenant(d, context.request.perAppInfo);
                                    }
                                }
                                return allConfig;
                            });
                    })
                    .then((filteredDecl) => {
                        if (d.Common || !isCommonNeeded(d)) {
                            return Promise.resolve();
                        }

                        // Make sure we have Common tenant for use-pointers
                        return (filteredDecl ? Promise.resolve(filteredDecl) : this.getFilteredDeclaration(context))
                            .then((allConfig) => {
                                if (allConfig.Common) {
                                    d.Common = allConfig.Common;
                                    baseDecl.Common = util.simpleCopy(allConfig.Common);
                                }
                            });
                    })
                    .then(() => context.host.parser.digest(context, d, {
                        copySecrets: true,
                        baseDeclaration: baseDecl,
                        previousDeclaration: prevDecl
                    }));
            })
            .then((results) => {
                if (results && results.warnings) {
                    results.warnings.forEach((warning) => {
                        if (!warnings[warning.tenant]) {
                            warnings[warning.tenant] = [];
                        }
                        warnings[warning.tenant].push(warning);
                    });
                }
                if (currentTask.warnings) {
                    currentTask.warnings.forEach((warning) => {
                        if (!warnings[warning.tenant]) {
                            warnings[warning.tenant] = [];
                        }
                        warnings[warning.tenant].push(warning);
                    });
                }
            })
            .then(() => {
                // Nodelist is acquired by a call to util.getNodelist in adcParser.
                // However, in the case of 'remove' we do not run parser.digest
                // and nodelist needs to be updated in case of external modifications.
                // Except for per-app which is done previously
                if (currentTask.action === 'remove' && !context.request.isPerApp) {
                    return util.getNodelist(context);
                }
                return context.host.parser.nodelist;
            })
            .then((commonNodeList) => {
                context.host.parser.nodelist = commonNodeList;
                commonConfig.nodeList = commonNodeList;
                commonConfig.virtualAddressList = context.host.parser.virtualAddressList;
                commonConfig.addressListList = context.host.parser.addressListList;
                commonConfig.snatTranslationList = context.host.parser.snatTranslationList;

                let x;
                declarationFullId = decl.id;
                if (typeof decl.constants === 'object' && decl.constants !== null) {
                    x = decl.constants;
                    if ((typeof x.version === 'string') && (x.version !== '')) {
                        declarationFullId += ` version ${x.version}`;
                    }
                    if ((typeof x.timestamp === 'string') && (x.timestamp !== '')) {
                        declarationFullId += ` dated ${x.timestamp}`;
                    }
                }
                if ((typeof decl.label === 'string') && (decl.label !== '')) {
                    const regex = /[']/g;
                    declarationFullId += `|${decl.label.replace(regex, '.')}`;
                }

                const tenantListResult = fetch.tenantList(decl, context.request.perAppInfo);
                context.tasks[context.currentIndex].firstPassNoDelete = tenantListResult.firstPassNoDelete;
                const tenantList = tenantListResult.list;
                const constantsMaskedDecl = util.maskSensitiveConstants(decl);
                log.debug({ message: 'All Tenants declaration', declaration: constantsMaskedDecl });

                return Promise.resolve()
                    .then(() => {
                        if (context.host.teemDevice) {
                            const record = new TeemRecord('Application Services Telemetry Data', '1');

                            const extraFields = {};
                            if (currentTask.userAgent) {
                                extraFields.userAgent = currentTask.userAgent;
                            }

                            // Run report concurrently so declaration handling is not delayed
                            Promise.resolve()
                                .then(() => this.getFilteredDeclaration(context))
                                .then((allConfig) => record.addClassCount(allConfig))
                                .then(() => record.addClassCount(decl))
                                .then(() => record.addJsonObject(extraFields))
                                .then(() => record.addPlatformInfo())
                                .then(() => record.addProvisionedModules())
                                .then(() => record.calculateAssetId())
                                .then(() => record.addRegKey())
                                .then(() => context.host.teemDevice.reportRecord(record))
                                .catch((error) => {
                                    log.warning(`Unable to send telemetry data: ${error.message}`);
                                });
                        }
                        return Promise.resolve();
                    })
                    .then(() => audit.allTenants(context, tenantList, decl, commonConfig, prevDecl));
            })
            .then((results) => {
                auditResults = results;

                fetch.tenantList(decl).list.forEach((tenant) => {
                    // Remove optimisticLockKey from the baseDeclaration
                    if (decl[tenant].optimisticLockKey) {
                        delete decl[tenant].optimisticLockKey;
                        delete baseDecl[tenant].optimisticLockKey;
                    }
                });

                succeeded = [];
                failed = [];
                auditResults.forEach((auditResult, index) => {
                    if (auditResult.message.match(/^(success|no change)/)) {
                        succeeded.push(auditResult.tenant);
                        auditResults[index].code = 200;
                        if (auditResult.message.match(/^success/)) { changeCount += 1; }
                    } else {
                        auditResults[index].code = auditResult.code || 422;
                        failed.push(auditResult.tenant);
                    }
                    auditResult.warnings = warnings[auditResult.tenant];
                });
                log.debug(`deployed= ${succeeded.length} good ${
                    failed.length} bad ${
                    changeCount} changes`);

                // it should be as if the bad ones weren't in decl
                failed.forEach((t) => { delete decl[t]; });

                newDecl = prevDecl;

                // strip out all old stuff except Tenants
                Object.keys(newDecl).forEach((key) => {
                    if ((typeof newDecl[key] !== 'object')
                                || (newDecl[key] === null)
                                        || (newDecl[key].class !== 'Tenant')) {
                        delete newDecl[key];
                    }
                });

                // merge current declaration's stuff and previous tenants
                // (decl is expanded and crufty so we copy from baseDecl)

                // NOTE: if declaration was updated in "selective" mode,
                // an attempt to GET the whole declaration and then POST
                // it back can now potentially fail due to changes in the
                // "constants" property (and/or Tenant /Common/Shared),
                // even though the running config is valid (some tenant
                // configured previously may have copied some item then
                // which is not in the declaration now)

                // TODO:  should we do anything about that?

                Object.keys(decl).forEach((key) => {
                    if (declartionUtil.isTenant(decl[key]) && Object.keys(decl[key]).length < 2) {
                        // empty tenant no longer exists on target device
                        if (Object.prototype.hasOwnProperty.call(newDecl, key)) {
                            delete newDecl[key];
                        }
                    } else if (context.request.perAppInfo && newDecl[key]) {
                        newDecl[key] = Object.assign(newDecl[key], util.simpleCopy(baseDecl[key]));
                        if (currentTask.action === 'remove') {
                            // remove specific application from declaration, so that datagroup is updated properly
                            perAppUtil.deleteAppsFromTenant(newDecl, context.request.perAppInfo);
                        }
                    } else {
                        newDecl[key] = util.simpleCopy(baseDecl[key]);
                    }
                });

                // do any Tenants remain on target?
                Object.keys(newDecl).forEach((k) => {
                    if (declartionUtil.isTenant(newDecl[k])) {
                        if (this.checkForTenantDelete(newDecl[k])) {
                            delete newDecl[k]; // belt and suspenders
                        }
                    }
                });

                if (typeof newDecl.controls !== 'object') {
                    newDecl.controls = {};
                }
                newDecl.controls.archiveTimestamp = (new Date(Date.now())).toISOString();

                if ((!currentTask.dryRun)) {
                    log.debug(`${changeCount.toString()} changes, save current declaration for later`);
                    return this.declarationProvider.storeBigipDeclaration(
                        context, newDecl, currentTask.historyLimit
                    );
                }
                log.debug('dry-run requested so skip updating declaration history');
                return true;
            })
            // okay returned but was not being used
            .then(() => mutex.releaseMutexLock(context, mutexRefresher))
            .then(() => {
                haveMutex = false;
                log.debug('All tenant locks released');
            })
            // resp returned but was not being used
            .then(() => {
                if (currentTask.showValues === 'base') {
                    return newDecl.id;
                }
                if (currentTask.showValues !== 'expanded') {
                    newDecl.scratch = 'defaults-only';
                }
                return context.host.parser.digest(context, newDecl);
            })
            // id returned but was not being used
            .then(() => {
                let tenants;
                let keys;
                let i;
                let key;
                let x;

                if (currentTask.showHash) {
                    this.getOptimisticLockKeys(newDecl);
                }

                if (Object.prototype.hasOwnProperty.call(newDecl, 'scratch')) { delete newDecl.scratch; }

                if (currentTask.tenantsInPath.length) {
                    tenants = currentTask.tenantsInPath;
                    keys = Object.keys(newDecl);
                    for (i = 0; i < keys.length; i += 1) {
                        key = keys[i];
                        x = tenants.indexOf(key);
                        if (declartionUtil.isTenant(newDecl[key])) {
                            // found a Tenant
                            if (x < 0) { // match not found in tenantsInPath
                                if (key !== 'Common') {
                                    delete newDecl[key];
                                }
                            } else { // match found in tenantsInPath
                                // one less to watch for (no dup keys from JSON)
                                tenants.splice(x, 1);
                            }
                        } else if (x >= 0) {
                            // caller named a non-Tenant
                            // -- but at this point declaration has
                            // been deployed, so what can we do?
                            log.warning(`bogus Tenant ${key} requested`);
                            tenants.splice(x, 1);
                        }
                    }
                }

                if (currentTask.filterClass) {
                    newDecl = util.filterObject(newDecl,
                        (obj) => obj.class === currentTask.filterClass);
                }

                // Only return tenants affected (i.e. included in request)
                Object.keys(newDecl).forEach((tenant) => {
                    if (declartionUtil.isTenant(newDecl[tenant])) {
                        if (!auditResults.find((result) => result.tenant === tenant)) {
                            delete newDecl[tenant];
                        }
                    }
                });

                const response = {
                    results: auditResults,
                    declaration: newDecl
                };

                if (Object.keys(context.log).find((element) => element.endsWith('Desired'))) {
                    response.traces = {};
                    Object.keys(context.log).forEach((prop) => {
                        if (prop.endsWith('Desired') || prop.endsWith('Current')
                            || prop.endsWith('Diff') || prop.endsWith('Script')) {
                            response.traces[prop] = context.log[prop];
                        }
                    });
                }

                if (currentTask.dryRun) {
                    response.dryRun = true;
                }

                if (needsCleanUp) {
                    cloudLibUtils.cleanupStoredDecl(context);
                }

                let statusCode = 0;
                if (succeeded.length === 0) {
                    statusCode = STATUS_CODES.UNPROCESSABLE_ENTITY;
                } else if (failed.length === 0) {
                    statusCode = STATUS_CODES.OK;
                } else {
                    statusCode = STATUS_CODES.MULTI_STATUS;
                }

                // decl.controls can be undefined
                // decl can be a stub or .controls just not provided by client
                if (typeof context.request.fortune !== 'undefined') {
                    if (context.request.fortune) {
                        response.fortune = getFortune();
                    }
                }

                let promise = Promise.resolve();
                if ((!currentTask.dryRun)) {
                    // does customer want to save or sync updated config?

                    if (currentTask.persist) {
                        promise = promise
                            .then(() => persistConfig(context))
                            .then((status) => {
                                if (status.warning) {
                                    response.results.forEach((result) => {
                                        result.warnings = result.warnings || [];
                                        result.warnings.push(status.warning);
                                    });
                                }
                            });
                    }
                    if (currentTask.syncToGroup !== '') {
                        promise = promise.then(() => configSync(context,
                            currentTask.syncToGroup));
                    }
                }

                return promise.then(() => {
                    opResult = DeclarationHandler.buildResult(statusCode, undefined, response);
                    return opResult;
                });
            })
            .catch((e) => {
                if (haveMutex) {
                    mutex.releaseMutexLock(context, mutexRefresher)
                        .then(log.debug('Global lock released')).catch();
                }
                log.info(e);

                traceSpan.logError(e);

                let statusCode;

                if ((typeof e === 'object') && (e !== null)
                    && (typeof e.statusCode === 'number')) {
                    statusCode = e.statusCode;
                } else {
                    statusCode = (e.status) ? e.status : STATUS_CODES.INTERNAL_SERVER_ERROR;

                    // ID706165 iLX framework, headers broken
                    // For some statuses would like to do:
                    // restOperation.setHeaders({
                    //     "Retry-After": some_time
                    // });
                }

                if (needsCleanUp) {
                    cloudLibUtils.cleanupStoredDecl(context);
                }

                const body = {
                    code: statusCode,
                    errors: e.errors,
                    message: e.message,
                    host: context.target.host
                };
                const tenants = fetch.tenantList(decl).list;
                if (tenants.length === 1) {
                    body.tenant = tenants;
                } else if (tenants.length > 1) {
                    if (body.code === 422 && typeof body.errors !== 'undefined' && body.errors.length > 0) {
                        body.tenant = getAffectedTenant(body.errors, tenants);
                    }
                }
                if (declarationFullId) {
                    body.declarationFullId = declarationFullId;
                }
                if (decl && decl.id) {
                    body.declarationId = decl.id;
                }
                log.info(body);

                const result = DeclarationHandler.buildResult(statusCode, e.message, body);

                return result;
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    }

    getObjectNamesToPatch(body) {
        return body.map((patch) => {
            const parts = patch.path.split('/');
            return parts[0] || parts[1];
        });
    }

    handlePatch(context) {
        const currentTask = context.tasks[context.currentIndex];
        let jsonPatch = currentTask;
        // jiff expects an array and will "fail" silently if given anything else
        if (typeof jsonPatch === 'object') {
            if (Object.prototype.hasOwnProperty.call(jsonPatch, 'class')) {
                // This may be from a POST with action = patch
                if (declartionUtil.isAS3(jsonPatch)) {
                    jsonPatch = currentTask.patchBody;
                } else {
                    return DeclarationHandler.buildResult(STATUS_CODES.BAD_REQUEST, 'invalid patch body - refer to AS3 docs for correct syntax.');
                }
            }
            if (!Array.isArray(jsonPatch)) {
                jsonPatch = [jsonPatch];
            }
        } else {
            return DeclarationHandler.buildResult(STATUS_CODES.BAD_REQUEST, 'invalid patch body - refer to AS3 docs for correct syntax.');
        }
        const testPatches = jsonPatch.filter((patch) => patch.op === 'test');
        if (testPatches.length > 0) {
            return DeclarationHandler.buildResult(STATUS_CODES.UNPROCESSABLE_ENTITY, 'invalid patch - op \'test\' is not supported');
        }

        const updateModePatch = jsonPatch.filter((patch) => patch.path === '/updateMode' && patch.value !== 'selective');
        if (updateModePatch.length > 0) {
            return DeclarationHandler.buildResult(STATUS_CODES.UNPROCESSABLE_ENTITY, 'invalid patch - updateMode value can only be \'selective\'');
        }

        let target;
        const targets = jsonPatch.map((p) => {
            if (typeof p.target !== 'undefined') {
                target = p.target;
                return p.target.hostname || p.target.address;
            }
            return undefined;
        })
            .filter((value, index, self) => self.indexOf(value) === index && typeof value !== 'undefined');
        if (targets.length > 0) {
            if (context.target.deviceType === DEVICE_TYPES.BIG_IQ) {
                if (targets.length > 1) {
                    return DeclarationHandler.buildResult(STATUS_CODES.UNPROCESSABLE_ENTITY, 'invalid patch - cannot specify more than one declaration target per request');
                }
                // set target so declaration can be filtered
                context.tasks[context.currentIndex].target = target;
            } else {
                return DeclarationHandler.buildResult(STATUS_CODES.UNPROCESSABLE_ENTITY, 'invalid patch - declaration target can only be used when running on BIG-IQ');
            }
        }

        const origShowValues = currentTask.showValues;
        const origFilterClass = currentTask.filterClass;
        let currentConfig;
        currentTask.action = 'retrieve';
        currentTask.showValues = 'base';
        delete currentTask.filterClass;

        context.control.objectNamesToPatch = this.getObjectNamesToPatch(jsonPatch);

        // In order to support PATCH adding new tenants, we need to skip the missing tenant checks
        // So we need to check the op and that the op matches the desired tenant(s)
        const ignoreMissingTenant = jsonPatch.filter((patch) => patch.op === 'add'
            && currentTask.tenantsInPath.find((tenant) => `/${tenant}` === patch.path)).length > 0;

        return this.getFilteredDeclaration(context, ignoreMissingTenant)
            .then((savedConfig) => {
                if (savedConfig.statusCode === 204) {
                    currentConfig = {};
                } else {
                    currentConfig = savedConfig;
                }
                return jiff.patch(jsonPatch, currentConfig);
            })
            .then((updatedConfig) => {
                currentTask.action = 'deploy';
                currentTask.declaration = updatedConfig;
                currentTask.showValues = origShowValues;
                currentTask.filterClass = origFilterClass;
                return this.handleCreateUpdateOrDelete(context);
            })
            .catch((ex) => {
                if (typeof (ex) === 'object' && ex.name === jiff.InvalidPatchOperationError.name) {
                    return DeclarationHandler.buildResult(STATUS_CODES.UNPROCESSABLE_ENTITY, `${ex.name}: ${ex.message}`);
                }

                return DeclarationHandler.buildResult(
                    ex.statusCode || STATUS_CODES.BAD_REQUEST,
                    `patch operation failed - see logs for details. ${ex.message}`
                );
            });
    }

    /**
     * given a request object, return a promise to do
     * the needful and respond to the caller.  The
     * various HTTP methods (GET/POST/PATCH/DELETE)
     * just map whatever they get from caller and/or
     * framework to a request object and send it here
     *
     * @param {object} context - full AS3 context object
     * @returns {Promise}
     */
    process(context) {
        const traceSpan = context.request.tracer.startChildSpan(
            'declarationHandler.process',
            context.request.rootSpan
        );

        // store values for use by iControlRequest()
        this.parser = context.host.parser;
        context.control.timeSlip = 0;

        log.updateGlobalSettings(context.tasks[context.currentIndex]);

        return TargetContext.get(context)
            .then((targetContext) => {
                context.target = targetContext;
                log.updateGlobalSettings(context.tasks[context.currentIndex]);

                switch (context.tasks[context.currentIndex].action) {
                case 'retrieve':
                    return this.handleRead(context);

                case 'deploy':
                case 'redeploy':
                case 'remove':
                    return this.handleCreateUpdateOrDelete(context);

                case 'patch':
                    return this.handlePatch(context);

                default: {
                    const err = new Error(`unrecognized context.request.action '${context.request.action}'`);
                    err.statusCode = STATUS_CODES.BAD_REQUEST;
                    throw err;
                }
                }
            })
            .catch((e) => {
                log.error(e);

                traceSpan.logError(e);

                if (e.statusCode) {
                    return DeclarationHandler.buildResult(e.statusCode, e.message);
                }

                // If there is no statusCode or identified case throw the error higher
                throw e;
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    }
}

// TODO: Left the following functions intact for now
// I believe we can do more work on these, e.g.
// Some can be moved onto a separate bigIpProvider (e.g. configSync, save sys config)
// The actual token processing (without side effects) can be extracted out of getBigIpToken
// - @austria

/**
 * return a promise to save config on target
 * Resolves true if command succeeds. Rejects on error.
 *
 * @public
 * @param {object} context - full AS3 context object
 * @returns {Promise}
 */
function persistConfig(context) {
    let id = null;
    function waitForCompletion(remainingRetries) {
        const checkOptions = {
            path: `/mgmt/tm/task/sys/config/${id}`,
            why: 'checking config save status',
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
                    throw new Error('Configuration save taking longer than expected');
                }

                if (response._taskState === 'FAILED') {
                    throw new Error('Configuration save failed during execution');
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

                    if (error.message.indexOf('Connection refused') > -1) {
                        return true;
                    }

                    return false;
                }

                if (remainingRetries > 0 && isAllowedError()) {
                    return promiseUtil.delay(500)
                        .then(() => waitForCompletion(remainingRetries - 1));
                }

                if (error.message.indexOf('Task not found') > -1) {
                    const warning = 'AS3 was unable to verify that the configuration was persisted.'
                    + ' To avoid this issue in the future, try increasing the'
                    + ' following DB variables: icrd.timeout, restjavad.timeout, restnoded.timeout';
                    log.warning(warning);
                    return Promise.resolve({ warning });
                }

                throw error;
            });
    }

    return Promise.resolve()
        .then(() => {
            const runOptions = {
                path: '/mgmt/tm/task/sys/config',
                why: 'create task save sys config',
                method: 'POST',
                send: JSON.stringify({ command: 'save' })
            };
            return util.iControlRequest(context, runOptions);
        })
        .then((resp) => {
            id = resp._taskId;
            const startOptions = {
                path: resp.selfLink.replace(/^.*(\x2fmgmt\x2f[^&]+).*$/, '$1'),
                why: 'launch task save sys config',
                method: 'PUT',
                send: JSON.stringify({ _taskState: 'VALIDATING' })
            };
            return util.iControlRequest(context, startOptions);
        })
        .then(() => waitForCompletion(120))
        .then((result) => {
            log.debug('BIG-IP config saved');
            return typeof result !== 'undefined' ? result : true;
        })
        .catch((e) => {
            e.message = `failed to save BIG-IP config (${e.message})`;
            log.warning(e);
            throw e;
        });
} // persistConfig()

/**
 * return a promise to sync target's config to
 * device group.  Resolves true if command
 * launched-- doesn't wait for results.
 * Rejects on error.
 *
 * @public
 * @param {object} context - full AS3 context object
 * @param {string} group - like /Common/my_dg
 * @returns {Promise}
 */
function configSync(context, group) {
    if (group === '') { return Promise.resolve(true); }

    let opts = {
        path: '/mgmt/tm/task/cm/config-sync',
        why: 'create task config sync',
        method: 'POST',
        send: JSON.stringify({
            command: 'run',
            options: [{ 'to-group': group }]
        })
    };

    return util.iControlRequest(context, opts)
        .then((resp) => {
            opts = {
                path: resp.selfLink.replace(/^.*(\x2fmgmt\x2f[^&]+).*$/, '$1'),
                why: 'launch task config sync',
                method: 'PUT',
                send: JSON.stringify({ _taskState: 'VALIDATING' })
            };

            return util.iControlRequest(context, opts);
        })
        // resp returned but not used
        .then(() => {
            log.debug(`launched config-sync to ${group}`);
            return true;
        })
        .catch((e) => {
            e.message = `failed to launch config-sync to ${
                group} (${e.message})`;
            log.warning(e);
            throw e;
        });
} // configSync()

function getFortune() {
    return fortunes.fortunes[
        Math.floor(Math.random() * fortunes.fortunes.length)
    ];
}

function handleServiceDiscovery(context) {
    const traceSpan = context.request.tracer.startChildSpan(
        'declarationHandler.handleServiceDiscovery',
        context.request.rootSpan
    );

    if (context.tasks[context.currentIndex].installServiceDiscovery) {
        return cloudLibUtils.install(context, context.control)
            .catch((e) => {
                const message = `Warning: Error encountered while installing service discovery: ${e.message}`;
                log.error(message);
                traceSpan.logError(new Error(message));
                return undefined;
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    }
    if (context.tasks[context.currentIndex].uninstallServiceDiscovery) {
        return cloudLibUtils.ensureUninstall(context)
            .catch((e) => {
                const message = `Warning: Error encountered while uninstalling service discovery: ${e.message}`;
                log.error(message);
                traceSpan.logError(new Error(message));
                return undefined;
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    }
    traceSpan.finish();
    return Promise.resolve();
}

function filterAndDigest(context, decl, currentTask) {
    if (currentTask.showValues === 'base') {
        if (currentTask.filterClass) {
            return util.filterObject(decl,
                (obj) => obj.class === currentTask.filterClass);
        }
        return decl;
    }
    if (currentTask.showValues !== 'expanded') {
        decl.scratch = 'defaults-only';
    }

    return context.host.parser.digest(context, decl)
        // id is returned but was not being used
        .then(() => {
            if (Object.prototype.hasOwnProperty.call(decl, 'scratch')) {
                delete decl.scratch;
            }
            if (currentTask.filterClass) {
                return util.filterObject(decl,
                    (obj) => obj.class === currentTask.filterClass);
            }
            return decl;
        });
}

module.exports = DeclarationHandler;
module.exports.persistConfig = persistConfig;

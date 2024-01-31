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
const uuid = require('uuid');
const networkUtil = require('./util/networkUtil');
const util = require('./util/util');
const cloudLibUtils = require('./util/cloudLibUtils');
const DeclarationHandler = require('./declarationHandler');
const validator = require('./validator');
const declarationUtil = require('./util/declarationUtil');
const restUtil = require('./util/restUtil');
const Queue = require('./queue');
const QueueConsumer = require('./queueConsumer');
const log = require('./log');
const Config = require('./config');

const DEVICE_TYPES = require('./constants').DEVICE_TYPES;
const STATUS_CODES = require('./constants').STATUS_CODES;

const VALIDATOR_ERR_PREFIX = 'Invalid data property:';

class DeclareHandler {
    constructor() {
        this.queue = new Queue();
        this.queueConsumer = new QueueConsumer(this.queue);
        this.queueConsumer.delegate((data) => processRequest(data.item));
    }

    process(context, restOperation) {
        const traceSpan = context.request.tracer.startSpan('declareHandler.process');
        context.request.rootSpan = traceSpan;
        context.request.timedOut = false;
        // TODO: remove the restOperation from declareHandler, the wrapper should hold the restOperation
        context.request.restOp = restOperation;

        // send response early if async is specified but request invalid
        const asyncParamResult = parseAsyncParam(context.request, context.tasks);
        if (asyncParamResult.errorResponse) {
            const result = restUtil.buildOpResult(
                asyncParamResult.errorResponse.statusCode,
                asyncParamResult.errorResponse.errorMessage
            );
            restUtil.completeRequest(context.request.restOp, result);
            return Promise.resolve(result);
        }

        let settings;
        return Config.getAllSettings()
            .then((settingsResponse) => {
                settings = settingsResponse;
                if (context.request.isPerApp && !settings.perAppDeploymentAllowed) {
                    const e = new Error('Per-application deployment has been disabled on the settings endpoint');
                    e.badRequest = true;
                    throw e;
                }
                return getInitialControls(context, settings);
            })
            .then((controls) => {
                // Convert request.controls values to tasks
                controls.forEach((control, idx) => {
                    context.tasks[idx].asyncUuid = controls[idx].asyncUuid;
                    delete controls[idx].asyncUuid;
                });

                // TODO: Update to not have the controls object
                context.request.controls = controls;

                // if at least one needs cloudlibs install, make request async
                context.request.async = shouldGoAsync(context, asyncParamResult);

                return context.request.async ? processAsync(context) : processSync(context);
            })
            .then(() => {
                // if burst handling disabled, skip queue and process immediately
                if (!settings.burstHandlingEnabled) {
                    return processRequest(context);
                }

                // if GET request, skip queue and process immediately
                if (context.request.method === 'Get' || context.tasks[0].action === 'retrieve') {
                    return processRequest(context);
                }

                this.queue.enqueue(context);
                return Promise.resolve();
            })
            .catch((err) => {
                if (context.request.timeoutId) {
                    clearTimeout(context.request.timeoutId);
                }

                traceSpan.logError(err);
                reportError(context, err);
            })
            .then(() => {
                traceSpan.finish();
                context.request.tracer.close();
            });
    }
}

/**
 * builds the result of parsing a request
 * no errorMessage returns success:true
 *
 * @private
 * @returns {object} - returns ```{ success: boolean, errorMessage: string }```
 */
function buildParseResult(errorMessage, statusCode) {
    return {
        errorMessage,
        success: !errorMessage,
        statusCode: statusCode || (errorMessage ? STATUS_CODES.BAD_REQUEST : STATUS_CODES.OK)
    };
}

/**
 * Parse through the subPath to handle multiple tenants in the path
 *
 * @param {object} requestContextCopy
 * @param {object} task
 */
function parsePerTenantPath(requestContextCopy, task) {
    if (requestContextCopy.subPath.length && requestContextCopy.subPath !== '*') {
        requestContextCopy.subPath.replace(/%2[Cc]/g, ',')
            .replace(/^,+(.*),+$/, '$1')
            .replace(/,[, ]+/g, ',')
            .split(',')
            .forEach((e) => {
                if (requestContextCopy.tenantsInPath.indexOf(e) === -1) {
                    if (requestContextCopy.method === 'Post') {
                        if (task.declaration && task.declaration[e]) {
                            requestContextCopy.tenantsInPath.push(e);
                        }
                    } else {
                        requestContextCopy.tenantsInPath.push(e);
                    }
                }
            });
    }

    if (requestContextCopy.method === 'Post' && task.declaration) {
        // Remove Tenants from the declaration that are not in the URI
        Object.keys(task.declaration).forEach((decl) => {
            if (declarationUtil.isTenant(task.declaration[decl])
                && requestContextCopy.tenantsInPath.indexOf(decl) < 0) {
                delete task.declaration[decl];
            }
        });
    }
}

/**
 * parses a client http request and checks URI for path additions
 * requestContextCopy.subPath should be similar to one of the following:
 *   per tenant: "/declare/{commaDelimitedTenantList}"
 *   per app: "/declare/{nameOfTenant}/applications/{optionalApplicationName}"
 *
 * @private
 * @returns {object} - returns ```{ success: boolean, errorMessage: string }```
 */
function parseSubPath(requestContextCopy, task) {
    if (requestContextCopy.subPath) {
        // remove trailing '/'
        if (requestContextCopy.subPath.charAt(requestContextCopy.subPath.length - 1) === '/') {
            requestContextCopy.subPath = requestContextCopy.subPath.slice(0, -1);
        }

        if (!requestContextCopy.isPerApp) {
            parsePerTenantPath(requestContextCopy, task);
        }
    }

    if (tenantsInDeclMustMatchPath(requestContextCopy, task)) {
        let mismatchedTenants = '';
        const declKeys = Object.keys(task.declaration);
        declKeys.forEach((declKey) => {
            if (isItemNonMatchingTenant(
                task.declaration, declKey, requestContextCopy.tenantsInPath
            )) {
                mismatchedTenants += declKey;
            }
        });
        if (mismatchedTenants) {
            return buildParseResult(`tenant(s) in the declaration does not match tenant(s) in the specified URI path. Tenants: ${mismatchedTenants}`);
        }
    }
    return buildParseResult();
}

function tenantsInDeclMustMatchPath(requestContextCopy, task) {
    if (util.isEmptyOrUndefined(requestContextCopy.tenantsInPath)) return false;
    if (!task.declaration) return false;
    if (requestContextCopy.method === 'Post') return false;
    return true;
}

function isItemNonMatchingTenant(declaration, key, tenantsToMatch) {
    const declItem = declaration[key];
    if (declarationUtil.isTenant(declItem)) {
        return !tenantsToMatch.find((tenant) => tenant === key);
    }
    return false;
}
/**
 * parses a client http request and checks URI for query strings
 *
 * @private
 * @returns {object}  - returns ```{ success: boolean, errorMessage: string }```
 */
function parseQueryStrings(requestContextCopy, task) {
    if (requestContextCopy.queryParams) {
        if (requestContextCopy.queryParams.find((param) => param.key.startsWith('controls'))) {
            task.queryParamControls = {};
        }
        for (let i = 0; i < requestContextCopy.queryParams.length; i += 1) {
            const keyValuePair = requestContextCopy.queryParams[i];
            let paramKey = keyValuePair.key;
            let paramValue = keyValuePair.value;
            switch (paramKey) {
            case 'show':
                paramValue = paramValue.toLowerCase();
                if (paramValue.length) {
                    if (!paramValue.match(/^(base|full|expanded)$/)) {
                        return buildParseResult('show must be "base", "full", or "expanded"');
                    }
                    requestContextCopy.showValues = paramValue;
                }
                break;

            case 'age':
                if (requestContextCopy.method !== 'Get') {
                    return buildParseResult(`query param "age" is not allowed for method ${requestContextCopy.method}`);
                }

                if (paramValue.match(/^[0-9]{1,2}$/)) {
                    requestContextCopy.showAge = parseInt(paramValue, 10);
                    if (requestContextCopy.showAge > 15) {
                        return buildParseResult(`invalid age value "${paramValue}" - must be between 0-15 or "list"`);
                    }
                } else if (paramValue === 'list') {
                    requestContextCopy.showAge = paramValue;
                } else {
                    return buildParseResult(`invalid age value "${paramValue}" - must be a number between 0-15 or "list"`);
                }
                break;

            case 'filterClass':
                if (requestContextCopy.method === 'Delete') {
                    return buildParseResult(`query param "filterClass" is not allowed for method ${requestContextCopy.method}`);
                }
                requestContextCopy.filterClass = paramValue;
                break;

            case 'showHash':
                if (requestContextCopy.method === 'Delete') {
                    return buildParseResult(`query param "showHash" is not allowed for method ${requestContextCopy.method}`);
                }

                if (paramValue.length) {
                    paramValue = paramValue.toLowerCase();
                    if (!paramValue.match(/^(false|true)$/)) {
                        return buildParseResult('showHash must be "true" or "false"');
                    }
                    requestContextCopy.showHash = (paramValue === 'true');
                }
                break;
            case 'async':
                // parseAsync param already called earlier
                break;
            case 'unsafe':
            case 'unchecked':
                if (paramValue.length) {
                    paramValue = paramValue.toLowerCase();
                    if (!paramValue.match(/^(false|true)$/)) {
                        return buildParseResult('unchecked must be "true" or "false"');
                    }
                    requestContextCopy.unchecked = (paramValue === 'true');
                }
                break;
            case 'controls.logLevel':
                paramValue = paramValue.toLowerCase();
                if (!paramValue.match(/^(emergency|alert|critical|error|warning|notice|info|debug)$/)) {
                    return buildParseResult('logLevel must be "emergency", "alert", "critical", "error", "warning", "notice", "info", or "debug"');
                }

                task.queryParamControls.logLevel = paramValue;
                break;
            case 'controls.trace':
            case 'controls.traceResponse':
            case 'controls.dryRun':
                paramValue = paramValue.toLowerCase();
                paramKey = paramKey.split('.').pop();
                if (!paramValue.match(/^(false|true)$/)) {
                    return buildParseResult(`${paramKey} must be "true" or "false"`);
                }

                task.queryParamControls[paramKey] = paramValue === 'true';
                break;
            case 'controls.userAgent':
                task.queryParamControls.userAgent = paramValue;
                break;
            default:
                return buildParseResult(`unrecognized URL query parameter "${paramKey}"`);
            }
        }
    }
    return buildParseResult();
}

/**
 * parses a client http request and checks JSON body for AS3 class properties
 *
 * @private
 * @returns {undefined} - throws on error
 */
function parseAS3ClassProperties(requestContextCopy, task) {
    if (task.retrieveAge && task.action !== 'retrieve') {
        return buildParseResult(`retrieveAge value is not allowed for action "${task.action}". use only with "retrieve"`);
    }

    if (task.action !== 'redeploy') {
        if (task.redeployAge && task.redeployAge > 0) {
            return buildParseResult('redeployAge is valid only with action "redeploy"');
        }
        if (task.redeployUpdateMode && task.redeployUpdateMode !== 'original') {
            return buildParseResult('redeployUpdateMode is valid only with action "redeploy"');
        }
    }

    if (task.action === 'patch' && !task.patchBody) {
        return buildParseResult('for action \'patch\', a patchBody must be included - refer to AS3 docs for details');
    }

    if (task.action !== 'patch' && task.patchBody) {
        return buildParseResult('patchBody is valid only with action \'patch\'');
    }

    if (task.declaration && !declarationAllowedForAction(task.action)) {
        return buildParseResult(`for action "${task.action}", a declaration is not allowed.`);
    }

    if (!task.declaration && declarationRequiredForAction(task.action)) {
        return buildParseResult(`for action "${task.action}", a declaration is required.`);
    }

    // if this action is on the tenant subpath
    if (requestContextCopy.tenantsInPath.length > 0 && task.action === 'redeploy') {
        return buildParseResult(`action "${task.action}" is not allowed for URI ${requestContextCopy.fullPath}`);
    }
    return buildParseResult();
}

function declarationAllowedForAction(action) {
    switch (action) {
    case 'retrieve':
    case 'remove':
    case 'redeploy':
    case 'patch':
        return false;
    default:
        return true;
    }
}

function declarationRequiredForAction(action) {
    switch (action) {
    case 'deploy':
        return true;
    default:
        return false;
    }
}

function parsePatchBodies(requestContextCopy, task) {
    if (task.action === 'patch') {
        requestContextCopy.body.patchBody.forEach((patchOp) => {
            if (patchOp.path) {
                const tenant = patchOp.path.split('/')[1];
                if (requestContextCopy.tenantsInPath.indexOf(tenant) === -1) {
                    requestContextCopy.tenantsInPath.push(tenant);
                }
            }
        });
    }
    return buildParseResult();
}

function assignBodyDefaults(requestContextCopy, task) {
    const needAutogenId = ['generate', '', undefined, null];
    if (!task.declaration) {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: Date.now().toString()
        };
        if (task.action === 'remove') {
            // stub out tenants with empty decl
            decl.updateMode = requestContextCopy.tenantsInPath.length ? 'selective' : 'complete';

            requestContextCopy.tenantsInPath.forEach((tenant) => {
                decl[tenant] = { class: 'Tenant' };
            });
            task.declaration = decl;
        }

        if (task.action === 'redeploy') {
            if (typeof task.historyLimit !== 'number') {
                // unless user says so, redeploy should not trim history
                task.historyLimit = 15;
            }
            task.declaration = decl;
        }
    } else if (needAutogenId.indexOf(task.declaration.id) > -1) {
        task.declaration.id = `autogen_${uuid.v4()}`;
    }
}

function parseDeclRequest(requestContextCopy, task) {
    let result;

    requestContextCopy.tenantsInPath = [];
    requestContextCopy.showValues = 'base';
    requestContextCopy.showAge = task.retrieveAge || 0;

    const parseMethods = [
        parseSubPath,
        parseQueryStrings,
        parseAS3ClassProperties,
        parsePatchBodies
    ];

    for (let i = 0; i < parseMethods.length; i += 1) {
        result = parseMethods[i](requestContextCopy, task);
        if (!result.success) {
            return Promise.resolve(result);
        }
    }

    // transform into a DeclarationRequest
    assignBodyDefaults(requestContextCopy, task);
    const declReq = Object.assign({}, requestContextCopy);
    Object.assign(declReq, task);
    delete declReq.body;
    delete declReq.hostContext;
    delete declReq.restOp;
    delete declReq.controls;
    delete declReq.basicAuth;
    delete declReq.isPerApp;
    delete declReq.perAppInfo;

    return Promise.resolve(declReq);
}

// bare minimum to create data-groups
function buildControlsFromTask(task) {
    return {
        targetHost: task.targetHost,
        targetPort: task.targetPort,
        protocol: task.protocol,
        timeSlip: 0,
        urlPrefix: task.urlPrefix,
        targetTokens: task.targetTokens || {},
        asyncUuid: uuid.v4()
    };
}

function getInitialControls(context, settings) {
    const promises = context.tasks.map(
        (task, index) => () => {
            context.currentIndex = index;
            return networkUtil.setAuthzToken(context)
                .then(() => buildControlsFromTask(task))
                .then((controls) => {
                    if (context.request.pathName !== 'declare') return Promise.resolve(controls);
                    if (task.action === 'retrieve') return Promise.resolve(controls);

                    return getAsyncVerifiedControls(context, controls, settings);
                });
        }
    );

    return promiseUtil.series(promises)
        .then((controls) => {
            context.currentIndex = 0; // Must reset currentIndex after being done with it
            return controls;
        });
}

function processDeclInArray(item, index, context) {
    let declResult;

    if (item.hasDuplicate) {
        let errorMessage = 'Error(s): \'Invalid/Duplicate\': another request exists with the same targetHost-declaration tenant, declaration target, and/or declaration tenant-app';
        if (!item.validatorResult.isValid) {
            errorMessage += `${VALIDATOR_ERR_PREFIX} ${item.validatorResult.data}`;
        }
        declResult = restUtil.buildOpResult(STATUS_CODES.UNPROCESSABLE_ENTITY, errorMessage);
        return Promise.resolve(declResult);
    }
    if (!item.validatorResult.isValid) {
        const errorMessage = `${VALIDATOR_ERR_PREFIX} ${item.validatorResult.data}`;
        declResult = restUtil.buildOpResult(STATUS_CODES.UNPROCESSABLE_ENTITY, errorMessage);
        return Promise.resolve(declResult);
    }

    return Promise.resolve()
        .then(() => {
            if (context.request.isPerApp && context.request.method !== 'Get' && context.request.method !== 'Delete') {
                // validate the per-app declaration
                return Promise.resolve()
                    .then(() => context.host.parser.digest(
                        context,
                        context.request.perAppInfo.decl,
                        { isPerApp: true } // Runs in perApp verification mode (e.g. skips PostProcess)
                    ))
                    .catch((e) => {
                        if (typeof e.errors === 'undefined') {
                            // Continue on if there are no actual errors
                            return Promise.resolve();
                        }
                        log.error(e);

                        const body = {
                            code: STATUS_CODES.UNPROCESSABLE_ENTITY,
                            errors: e.errors,
                            message: e.message
                        };
                        declResult = restUtil.buildOpResult(STATUS_CODES.UNPROCESSABLE_ENTITY, e.message, body);
                        return Promise.resolve(declResult);
                    });
            }
            return Promise.resolve();
        })
        .then((perAppError) => {
            if (perAppError && typeof perAppError.message !== 'undefined') {
                // If we have an error return it like the validation failures above
                return Promise.resolve(perAppError);
            }

            const reqCopy = Object.assign({}, context.request);
            const task = Object.assign({}, context.tasks[index]);

            return parseDeclRequest(reqCopy, task)
                .then((declReq) => {
                    if (typeof declReq.success !== 'undefined' && !declReq.success) {
                        return declReq;
                    }

                    // TODO: Review these values being saved into context object
                    context.currentIndex = index;
                    context.control = context.request.controls[index];
                    context.tasks[index] = declReq;
                    context.tasks[index].control = context.request.controls[index];
                    context.tasks[index].uuid = uuid.v4();
                    const handler = new DeclarationHandler();
                    return handler.process(context);
                })
                .then((result) => {
                    declResult = restUtil.buildOpResult(result.statusCode, result.errorMessage, result.body);
                    return declResult;
                });
        });
}

function processRequest(context) {
    const validatorResults = validator.validateDeclarationArray(context);
    return validatorResults.reduce(
        (prev, curr, index) => prev.then(
            (results) => processDeclInArray(curr, index, context)
                .then((r) => results.concat(r))
        ),
        Promise.resolve([])
    )
        .then((allResults) => {
            // To maintain API we have to keep the responses unique between multi and single declarations
            if (context.request.isMultiDecl) {
                return restUtil.buildOpResultMulti(allResults);
            }
            return allResults[0];
        })
        .then((declResult) => {
            updateAsyncRecords(context, declResult);
            return declResult;
        })
        .then((result) => {
            if (context.request.timeoutId) {
                clearTimeout(context.request.timeoutId);
            }
            if (!context.request.async && !context.request.timedOut) {
                if (context.request.isMultiDecl) {
                    restUtil.completeRequestMultiStatus(context.request.restOp, result);
                } else {
                    restUtil.completeRequest(context.request.restOp, result, context.request.perAppInfo);
                }
            }
            return result;
        })
        .then((result) => {
            if (context.request.async) {
                // For async requests, completeRequest (which checks the webhook) was called
                // previously to send the task id, so we still need to check for the webhook here
                // to send the actual result
                restUtil.checkWebhook(context.request.restOp, result);
            }
            return result;
        })
        .catch((err) => {
            reportError(context, err);
        });
}

function createAsyncRecord(logPrefix, context, index) {
    let message = 'Declaration successfully submitted';
    if (context.tasks[index].installServiceDiscovery || context.tasks[index].uninstallServiceDiscovery) {
        message = `${context.tasks[index].installServiceDiscovery ? 'Installing' : 'Uninstalling'}`
            + ' service discovery components. The results of your request may be retrieved by'
            + ' sending a GET request to selfLink provided.';
    }
    log.debug(`${logPrefix}: creating data-group async task ${context.tasks[index].asyncUuid} and responding with 202 while we continue processing.`);

    return context.host.asyncHandler.handleRecord(context, 'POST', context.tasks[index].asyncUuid, null, message)
        .then((result) => restUtil.buildOpResult(result.statusCode, result.message, result.body));
}

function prepAsyncRecords(context, logPrefix) {
    if (context.request.isMultiDecl) {
        const promises = context.tasks.map((decl, index) => createAsyncRecord(
            `${logPrefix} declarationID: ${decl.id}`, context, index
        ));
        return Promise.all(promises)
            .then((results) => restUtil.buildOpResultMulti(results));
    }
    return createAsyncRecord(logPrefix, context, 0);
}

function updateAsyncRecords(context, declResult) {
    const isArray = context.request.controls.length > 1;
    const promises = context.tasks.map((task, index) => {
        const asyncMethod = 'PATCH';
        const asyncMsg = `Finishing async request, setting data-group async task ${task.asyncUuid} to indicate the request is completed.`;
        log.debug(asyncMsg);

        const results = {
            status: isArray ? (declResult.items[index].code || declResult.code)
                : declResult.code,
            response: isArray ? (declResult.items[index].body || declResult.items[index])
                : (declResult.body || declResult)
        };
        return context.host.asyncHandler.handleRecord(context, asyncMethod, task.asyncUuid, results);
    });
    if (isArray) {
        return Promise.all(promises)[0];
    }
    return Promise.all(promises);
}

function parseAsyncParam(requestContext, tasks) {
    const parseResult = {
        isAsync: false
    };
    const queryParams = requestContext.queryParams;
    if (queryParams) {
        let asyncParam = queryParams.find((p) => p.key === 'async');

        if (!asyncParam) {
            parseResult.asyncSpecified = false;
        } else {
            parseResult.asyncSpecified = true;
            if (requestContext.method === 'Get' || tasks[0].action === 'retrieve') {
                parseResult.errorResponse = buildParseResult('query param "async" is not allowed for method=GET or action=retrieve.');
            }

            asyncParam = asyncParam.value.toLowerCase();
            if (asyncParam.length) {
                if (!asyncParam.match(/^(false|true)$/)) {
                    parseResult.errorResponse = buildParseResult('async must be "true" or "false"');
                }
                parseResult.isAsync = (asyncParam === 'true');
            }
        }
    }
    return parseResult;
}

function getAsyncVerifiedControls(context, controls, settings) {
    // if BIG-IQ, the install on bigip target should be handled on AS3 installation
    // also we can't check the target since we have BIG-IQ creds but not declaration.target(e.g. BIG-IP) creds
    if (context.host.deviceType === DEVICE_TYPES.BIG_IQ) {
        return (Promise.resolve(controls));
    }

    const task = context.tasks[context.currentIndex];

    return networkUtil.resolveDomainToIp(controls.targetHost)
        .then((ip) => {
            // if localhost, the install on bigip target should be handled on AS3 installation
            task.resolvedHostIp = ip;
            if (ip === '127.0.0.1') {
                return controls;
            }

            return Promise.resolve()
                .then(() => {
                    // Check if the tokens was set in controls, if not throw an error
                    if (util.isEmptyObject(controls.targetTokens)) {
                        throw new Error('Unable to retrieve authorization tokens from target device, skipping install');
                    }

                    // cloudLibs requires the controls object values
                    context.control = controls;
                    return cloudLibUtils.getIsInstalled(context);
                })
                .then((isInstalled) => {
                    // resets the context.control object
                    context.control = {};
                    task.installServiceDiscovery = (settings.serviceDiscoveryEnabled && !isInstalled);
                    task.uninstallServiceDiscovery = (!settings.serviceDiscoveryEnabled && isInstalled);
                    return controls;
                })
                .catch((e) => {
                    log.warning(`Warning: Error encountered while getting cloudlibs installation status: ${e.message}`);
                    return controls;
                });
        });
}

function processSync(context) {
    return prepAsyncRecords(context, 'Auto async (on timeout)')
        .then((result) => {
            context.request.timeoutId = setTimeout(() => {
                context.request.timedOut = true;
                if (context.request.isMultiDecl) {
                    restUtil.completeRequestMultiStatus(context.request.restOp, result);
                } else {
                    restUtil.completeRequest(context.request.restOp, result, context.request.perAppInfo);
                }
            }, 45000);
        });
}

function processAsync(context) {
    return prepAsyncRecords(context, 'Request ?async=true')
        .then((result) => {
            if (context.request.isMultiDecl) {
                restUtil.completeRequestMultiStatus(context.request.restOp, result);
            } else {
                restUtil.completeRequest(context.request.restOp, result, context.request.perAppInfo);
            }
        });
}

function shouldGoAsync(context, asyncParamResult) {
    if (asyncParamResult.asyncSpecified && asyncParamResult.isAsync) {
        return true;
    }

    return context.tasks.some((task) => (task.installServiceDiscovery || task.uninstallServiceDiscovery));
}

function reportError(context, error) {
    // ensure err response sent to user
    let message;
    let code;

    if (error.code === STATUS_CODES.SERVICE_UNAVAILABLE_ERROR) {
        message = `Error: ${error.message}`;
        log.error(`ERROR: ${error.message}`);
        code = error.code;
        const cancelRecord = context.host.asyncHandler.records
            .find((record) => record.name === context.tasks[0].asyncUuid);
        cancelRecord.status = 'cancelled';
    } else if (error.badRequest) {
        message = `Error: ${error.message}`;
        log.error(`ERROR: ${error.message}`);
        code = STATUS_CODES.BAD_REQUEST;
    } else {
        message = `An unexpected error occurred. See logs for details. Error: ${error.message}`;
        log.error(`ERROR: ${error.message} : ${error.stack}`);
        code = STATUS_CODES.INTERNAL_SERVER_ERROR;
    }

    const opResult = restUtil.buildOpResult(code, message);
    restUtil.completeRequest(context.request.restOp, opResult);
}

module.exports = DeclareHandler;

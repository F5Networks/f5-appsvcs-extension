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
 * Request Context holds information regarding the original request to AS3.
 *
 * Note: As of 1/7/2020 the request Context's scope covers the entire request.
 *
 * method - e.g. Get, Patch, Delete
 * error - error message that may happen during configuration
 * errorCode - error code that may happen during configuration
 * eventEmitter - enables and holds events in AS3 such as APM_PROFILE_UPDATED
 * body - The JSON request body with modifications from tryConvertToPost()
 * fullPath - Full URL used in the request
 * pathName - A subsect of the fullPath
 * subPath - A formatted subPath of the fullPath, reconfigured in declareHandler
 * queryParams - The query parameters supplied as part of the URL
 * basicAuth - Is the basic authorization in the restOperation
 * token - Is the token from the request headers. Note it is different than
 *   target context tokens, which can be set per declaration.
 * isMultiDecl - Only set to true if the request is a multideclaration.
 *   Otherwise it is undefined.
 * declarations - An array of wrapped and normalized subdeclarations
 * dryRun - A boolean to indicate if the task is to run as a dry-run
 *
 * TODO: These are elsewhere, should be set here instead, in a different
 *   subobject, or outside the context object if possible.
 * restOp - Set in declareHandler.process(). Mostly used in declareHandler.
 *   TODO: We could move this to restWorker and have the results bubble up
 * controls - Set in declareHandler.process(), after gathering the values.
 *   The controls are an array, each value derived from the subdeclarations.
 * async - Seems to be a boolean set in declarationHandler.process().
 * timedOut - A boolean set in declarationHandler.process().
 * timeoutId - The ID returned by declareHandler.setTimeout().
 * action - This is set in as3request.
 *   TODO: Determine if the action is per subdeclaration.
 *   TODO: Update the code to use request.action or the sub-declaration's
 *   action exclusively.
 */

const EventEmitter = require('events');
const log = require('../log');
const constants = require('../constants');
const config = require('../config');
const util = require('../util/util');
const As3Request = require('../as3request');
const Tracer = require('../tracer').Tracer;
const tracerUtil = require('../tracer').Util;
const tracerTags = require('../tracer').Tags;
const STATUS_CODES = require('../util/restUtil').STATUS_CODES;

class RequestContext {
    static get(restOperation, hostContext) {
        if (!this.as3Wrapper) {
            this.as3Wrapper = new As3Request(constants.reqSchemaFile);
        }
        const initialContext = buildInitialContext(restOperation);
        const allowedCheck = checkIfAllowed(initialContext, hostContext);
        if (allowedCheck.failed) {
            initialContext.error = allowedCheck.error;
            initialContext.errorCode = allowedCheck.errorCode;
            return Promise.resolve(initialContext);
        }

        return Promise.resolve()
            .then(() => tryConvertToPost(initialContext))
            .then((reqContext) => {
                if (reqContext.error) {
                    return reqContext;
                }

                reqContext.basicAuth = restOperation.getBasicAuthorization();

                // obtain token auth from AS3 wrapper class or headers.
                // headers are only available in BIG-IP 14.0+ and BIG-IQ 6.1+
                if (restOperation.getHeader) {
                    reqContext.token = restOperation.getHeader('X-F5-Auth-Token');
                }

                return reqContext;
            })
            .then((reqContext) => setTracer(hostContext, reqContext))
            .then((reqContext) => {
                if (reqContext.error) {
                    return reqContext;
                }

                const validated = this.as3Wrapper.validateAndWrap(reqContext, hostContext);

                if (validated.error) {
                    reqContext.error = validated.error;
                    reqContext.errorCode = STATUS_CODES.UNPROCESSABLE_ENTITY;
                    return reqContext;
                }

                let tasks = validated.request;

                // Iterate through all the declarations looking for controls
                tasks.forEach((task) => {
                    if (task.declaration) {
                        const controlsName = Object.keys(task.declaration)
                            .find((key) => task.declaration[key].class === 'Controls');

                        if (controlsName) {
                            if (task.declaration[controlsName].internalUse) {
                                if (task.declaration[controlsName].internalUse.action) {
                                    task.action = task.declaration[controlsName].internalUse.action;
                                }
                                delete task.declaration[controlsName].internalUse;
                            }
                            task.dryRun = task.declaration[controlsName].dryRun || false;
                        }
                    }
                    task.dryRun = task.dryRun || false; // Enforce default if there is no declaration
                    if (task.action === 'dry-run') {
                        task.dryRun = true; // action takes precedence
                        task.action = 'deploy'; // Treat all dry-runs as a deploy with dryRun true
                    }
                });

                return As3Request.configureOptions(reqContext, tasks)
                    .then((configuredDeclarations) => {
                        tasks = configuredDeclarations;
                        reqContext.isMultiDecl = tasks.length > 1;
                        reqContext.postProcessing = [];
                        return { request: reqContext, tasks };
                    });
            })
            .catch((err) => {
                log.error(`Error encountered while building requestContext. ${err.message}`);
                return {
                    error: err.message,
                    errorCode: STATUS_CODES.INTERNAL_SERVER_ERROR
                };
            });
    }
}

function checkIfAllowed(reqContext, hostContext) {
    const method = reqContext.method;
    const deviceType = hostContext.deviceType;
    let allowed = true;
    let postAction = '';

    switch (method) {
    case 'Get':
        if (deviceType === constants.DEVICE_TYPES.CONTAINER && reqContext.pathName === 'declare') {
            allowed = false;
            postAction = 'retrieve';
        }
        break;
    case 'Patch':
        if (deviceType === constants.DEVICE_TYPES.CONTAINER) {
            allowed = false;
            postAction = 'patch';
        }
        break;
    case 'Delete':
        if (deviceType === constants.DEVICE_TYPES.BIG_IQ || deviceType === constants.DEVICE_TYPES.CONTAINER) {
            allowed = false;
            postAction = 'remove';
        }
        break;
    default:
        allowed = true;
        break;
    }

    const result = {
        failed: !allowed
    };

    if (!allowed) {
        result.errorCode = STATUS_CODES.METHOD_NOT_ALLOWED;
        result.error = `${method.toUpperCase()} method is not allowed on ${deviceType}. Please use POST method with an action of "${postAction}".`;
    }

    return result;
}

function tryConvertToPost(reqContext) {
    let body = reqContext.body;
    let bodyCheck;

    switch (reqContext.method) {
    case 'Get':
        body = { class: 'AS3', action: 'retrieve' };
        break;
    case 'Delete':
        body = { class: 'AS3', action: 'remove' };
        break;
    case 'Patch':
        bodyCheck = checkPayload(body);
        body = bodyCheck.body;
        if (body && (typeof body.class === 'undefined' || body.class !== 'AS3')) {
            body = {
                class: 'AS3',
                action: 'patch',
                patchBody: bodyCheck.body
            };
        }
        break;
    case 'Post':
        bodyCheck = checkPayload(body);
        body = bodyCheck.body;
        break;
    default:
        break;
    }

    if (bodyCheck && bodyCheck.error) {
        reqContext.error = bodyCheck.error;
        reqContext.errorCode = bodyCheck.errorCode;
    }
    reqContext.body = body;
    return reqContext;
}

function getFullPath(restOperation) {
    // returns /shared/appsvcs/{resource}{/subPaths}{?queryParams}
    return restOperation.getUri().path;
}

function getPathName(fullPath) {
    const pathVals = fullPath.split('?')[0].split('/');
    return pathVals[3];
}

function getComponentsAfterPathName(fullPath, pathName) {
    const uriComponents = fullPath.substring(`/shared/appsvcs/${pathName}`.length).split('?');

    if (uriComponents[0].charAt(0) === '/') {
        uriComponents[0] = uriComponents[0].slice(1);
    }
    // returns [ '{subpPath1/subpath2/..}', '{queryParams}' ];
    return uriComponents;
}

function getQueryParams(fullPath, pathName) {
    const queryParams = [];
    const uriComponents = getComponentsAfterPathName(fullPath, pathName);
    if (uriComponents.length > 1) {
        const params = uriComponents[1].split('&');
        params.forEach((param) => {
            if (param !== '') {
                const keyVal = param.split('=');
                queryParams.push({
                    key: keyVal[0],
                    value: keyVal[1]
                });
            }
        });
    }
    return queryParams;
}

function buildInitialContext(restOperation) {
    const context = {
        method: restOperation.method,
        error: undefined,
        body: restOperation.getBody()
    };
    context.fullPath = getFullPath(restOperation);
    context.pathName = getPathName(context.fullPath);
    context.subPath = getComponentsAfterPathName(context.fullPath, context.pathName)[0];
    context.queryParams = getQueryParams(context.fullPath, context.pathName);
    if (context.subPath === '') {
        delete context.subPath;
    }
    context.eventEmitter = new EventEmitter();
    return context;
}

function checkPayload(body) {
    const result = {};

    // A user cannot send an undefined body, but the iControl LX framework will on a timeout
    if (!body) {
        result.error = 'Request exceeded iControl LX timeout';
        result.errorCode = STATUS_CODES.REQUEST_TIMEOUT;
        return result;
    }

    // if client sends POST with Content-Type: application/json, getBody() yields object
    // otherwise, getBody() yields string
    try {
        result.body = typeof body === 'object' ? body : JSON.parse(body);
    } catch (e) {
        e.message = `cannot parse JSON POST payload (${e.message})`;
        log.info(e);
        // this might not be needed when running on REST framework
        // as the framework catches this early and returns 500 Error
        result.errorCode = STATUS_CODES.BAD_REQUEST;
        result.error = e.message;
        result.body = body;
    }
    return result;
}

function setTracer(hostContext, reqContext) {
    const tracerOpts = {
        logger: log,
        tags: {
            [tracerTags.APP.VERSION]: hostContext.as3VersionInfo
        }
    };

    return config.getAllSettings()
        .then((settings) => {
            tracerOpts.enabled = settings.performanceTracingEnabled;
            tracerOpts.endpoint = settings.performanceTracingEndpoint;
            return util.getDeviceInfo();
        })
        .then((deviceInfo) => {
            Object.assign(tracerOpts.tags, tracerUtil.buildDeviceTags(deviceInfo));
            reqContext.tracer = new Tracer('f5-appsvcs', tracerOpts);
            return reqContext;
        });
}

module.exports = RequestContext;
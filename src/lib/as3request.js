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

const Ajv = require('ajv');
const fs = require('fs');
const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;
const util = require('./util/util');
const declarationUtil = require('./util/declarationUtil');
const tmshUtil = require('./util/tmshUtil');
const constants = require('./constants');

class As3Request {
    /**
     * This builds an AS3Request object.
     *
     * @param {string} schemaPath - REQUIRED: The path to the schema
     * @param {object} ajvOptions - An object with various booleans see getDefaultAjvOptions()
     */
    constructor(schemaPath, ajvOptions) {
        if (!schemaPath) {
            throw new Error('A path to the schema is required');
        }
        this.schemaPath = schemaPath;
        this.ajvOptions = ajvOptions || this.getDefaultAjvOptions();
        this.validator = this.getAjvValidatorInstance();
    }

    getDefaultAjvOptions() {
        return {
            allErrors: false,
            verbose: true,
            useDefaults: true,
            jsonPointers: true,
            async: false
        };
    }

    getAjvValidatorInstance() {
        const ajv = new Ajv(this.ajvOptions);

        // test if string is an f5 IP, which means valid IPv4 or IPv6
        // with optional %route-domain and/or /mask-length appended.
        const IPrex = /^((((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d))|(::(([0-9a-f]{1,4}:){0,5}((([0-9a-f]{1,4}:)?[0-9a-f]{1,4})|(((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d))))?)|([0-9a-f]{1,4}::(([0-9a-f]{1,4}:){0,4}((([0-9a-f]{1,4}:)?[0-9a-f]{1,4})|(((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d))))?)|([0-9a-f]{1,4}:[0-9a-f]{1,4}::(([0-9a-f]{1,4}:){0,3}((([0-9a-f]{1,4}:)?[0-9a-f]{1,4})|(((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d))))?)|([0-9a-f]{1,4}(:[0-9a-f]{1,4}){2}::(([0-9a-f]{1,4}:){0,2}((([0-9a-f]{1,4}:)?[0-9a-f]{1,4})|(((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d))))?)|([0-9a-f]{1,4}(:[0-9a-f]{1,4}){3}::(([0-9a-f]{1,4}:)?((([0-9a-f]{1,4}:)?[0-9a-f]{1,4})|(((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d))))?)|([0-9a-f]{1,4}(:[0-9a-f]{1,4}){4}::((([0-9a-f]{1,4}:)?[0-9a-f]{1,4})|(((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)[.]){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)))?)|([0-9a-f]{1,4}(:[0-9a-f]{1,4}){5}::([0-9a-f]{1,4})?)|([0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}::)|(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}))(%(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{3}|[1-9]\d{2}|[1-9]?\d))?(\x2f(12[0-8]|1[01]\d|[1-9]?\d))?$/;
        ajv.addFormat('f5ip', (s) => {
            if (s === '') return true;
            return ((s.toLowerCase().match(/[^0-9a-f:.%\x2f]/) === null) && IPrex.test(s));
        });

        return ajv.compile(JSON.parse(fs.readFileSync(this.schemaPath, 'utf8')));
    }

    getValidatorError() {
        let error;
        if (!util.isEmptyOrUndefined(this.validator.errors)) {
            error = this.validator.errors[0];
            error = `Invalid request value '${error.data}' (path: ${error.dataPath}) : ${error.message} ${JSON.stringify(error.params)}`;
        }
        return error;
    }

    static setTargetDefaults(request, basicAuth, token) {
        if (util.isEmptyOrUndefined(request.targetUsername)) {
            request.targetUsername = '';
            request.targetPassphrase = '';
            if ((typeof basicAuth === 'string') && (basicAuth !== '')) {
                const authHeaderStringItems = basicAuth.split('\x20');
                if (authHeaderStringItems[0] === 'Basic') {
                    const authHeaderItem = authHeaderStringItems[authHeaderStringItems.length - 1];
                    request.targetUsername = util.fromBase64(authHeaderItem).toString().slice(0, -1);
                }
            }
        }

        let promise = Promise.resolve();
        if (!request.targetPort) {
            promise = promise
                .then(() => util.getMgmtPort(request.targetHost))
                .then((port) => {
                    request.targetPort = port;
                });
        }

        return promise.then(() => {
            if (request.targetHost && request.targetHost !== 'localhost') {
                request.targetHost = request.targetHost.toLowerCase();
                request.targetPort = request.targetPort || 443;
                request.protocol = 'https';
                request.urlPrefix = `https://${request.targetHost}:${request.targetPort}`;
                request.localBigip = false;
                if (!request.basicAuth && util.isEmptyOrUndefined(request.targetTokens)) {
                    // don't muck with creds
                    const creds = util.base64Encode(`${request.targetUsername}:${request.targetPassphrase}`);
                    request.basicAuth = `Basic ${creds}`;
                }
                return Promise.resolve();
            }
            return tmshUtil.getPrimaryAdminUser();
        })
            .then((primaryAdminUser) => {
                if (primaryAdminUser) {
                // if targetHost is not supplied, use localhost port 8100
                    request.targetHost = 'localhost';
                    request.targetPort = 8100;
                    request.protocol = 'http';
                    request.urlPrefix = `http://${primaryAdminUser}:@${request.targetHost}:${request.targetPort}`;
                    request.localBigip = true;
                }

                if (typeof request.targetTokens !== 'object') {
                    request.targetTokens = {};
                }
                if (typeof token === 'string' && token.length) {
                    request.targetTokens['X-F5-Auth-Token'] = token;
                }

                const minimizedHost = ipUtil.minimizeIP(request.targetHost);
                if (request.targetHost === undefined || request.targetHost === '' || minimizedHost === '::1' || minimizedHost === '127.0.0.1') {
                    request.targetHost = 'localhost';
                } else {
                    request.targetHost = request.targetHost.toLowerCase();
                }
                return request;
            });
    }

    // wrap to get/set the context of the AS3 host and the targeted device
    // For container, target* properties in AS3 class determines the device to deploy config to
    // For bigiq, target* properties refer to itself, and decl.target determines the device to deploy config to
    wrapWithAS3Class(request, endpoint) {
        if (request.class === undefined || declarationUtil.isADC(request)) {
            if (endpoint === 'declare') {
                // patch will automatically be wrapped in patchBody so no need to check here (for now)
                if (Array.isArray(request)) {
                    const decls = request.map((req) => this.wrapWithAS3Class(req, endpoint));
                    request = decls;
                } else if (!request.declaration) {
                    request = {
                        class: 'AS3',
                        action: 'deploy',
                        declaration: request
                    };
                }
            } else {
                request.action = request.action || 'deploy';
                request.class = 'AS3';
            }
        }
        return request;
    }

    static configureOptions(requestContext, tasks) {
        const declarations = tasks;
        const basicAuth = requestContext.basicAuth;
        const token = requestContext.token;

        // set target* defaults for each declaration
        const setTargetPromises = declarations.map((decl) => this.setTargetDefaults(decl, basicAuth, token));

        return Promise.all(setTargetPromises);
    }

    /**
     * Expected to be called early in the processing. Uses the original declaration as the base,
     * then normalizes and returns the result.
     *
     * @param {object} requestContext - A partially completed requestContext
     * @param {object} requestContext.body - the nearly original request body, should not be modified
     * @param {string} requestContext.pathName - the endpoint the code is ran against (e.g. declare)
     * @param {object} hostContext - The full hostContext
     *
     * @returns {object} - returns an object with two properties request and error
     * @returns {array} <object> request - An array of normalized declarations from the body
     * @returns {object} error - Any errors encountered during the process
     */
    validateAndWrap(requestContext, hostContext) {
        let error;
        let request = util.simpleCopy(requestContext.body);

        // populate AS3 class prop defaults from schema if req === [ADC]
        request = this.wrapWithAS3Class(request, requestContext.pathName);

        if (!this.validator(request)) {
            error = this.getValidatorError();
        }

        if (!Array.isArray(request)) {
            request = [request];
        }

        if (hostContext.deviceType === constants.DEVICE_TYPES.CONTAINER && requestContext.pathName === 'declare') {
            const req = request[0];
            if (req.class !== 'AS3' || (util.isEmptyOrUndefined(req.targetUsername)
                && util.isEmptyOrUndefined(req.targetTokens))) {
                error = 'Requests via containers must be wrapped in an AS3 class with target*** properties';
            }
        }

        return { request, error };
    }
}

module.exports = As3Request;

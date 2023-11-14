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

const log = require('../log');
const util = require('./util');
const Config = require('../config');
const STATUS_CODES = require('../constants').STATUS_CODES;
const perAppUtil = require('./perAppUtil');

/**
 * builds an operation result
 *
 * @returns {object} - restOpResult ```{ errorMessage: string, body: object, statusCode: number }```
 */
const buildOpResult = function (statusCode, message, body) {
    return {
        body,
        message,
        code: statusCode || STATUS_CODES.OK
    };
};

const getMultiStatusCode = function (results) {
    const statusCodes = results.map((result) => result.code)
        .filter((value, index, self) => self.indexOf(value) === index);

    let statusCode = statusCodes.length === 1 ? statusCodes[0] : STATUS_CODES.MULTI_STATUS;
    if (statusCode === STATUS_CODES.NO_CONTENT) {
        // ensure we can set a response body with the details
        // change code to 200 so rest framework will not hang
        statusCode = STATUS_CODES.OK;
    }

    return statusCode;
};

const getMultiBody = function (results, statusCode) {
    // each result can be something like
    // { results: [ { message: "success"...}, { message: "declaration failed"} ] }
    // { message: schemaErrorMessage }

    // standardize for multi op to return items array
    // {
    //     code: STATUSCODE,
    //     items: [ results1, results2 ]
    // }
    return {
        code: statusCode,
        items: results.map((result) => {
            let res;
            if (result.body) {
                // already formatted
                res = result.body;
            } else {
                res = {
                    code: result.code,
                    message: result.message || result
                };
            }
            return res;
        })
    };
};

const buildOpResultMulti = function (results) {
    const statusCode = getMultiStatusCode(results);
    const body = getMultiBody(results, statusCode);
    return body;
};

const excludeCodeFromBody = function (code) {
    const noCodeInBody = [STATUS_CODES.OK, STATUS_CODES.CREATED, STATUS_CODES.ACCEPTED, STATUS_CODES.NO_CONTENT];
    return noCodeInBody.indexOf(code) > -1;
};

function formatResult(result) {
    if (!result.body && result.code !== STATUS_CODES.NO_CONTENT) {
        result.body = {
            code: result.code,
            message: result.message.body || result.message
        };
    }

    // standardize formatting
    if (result.body && !result.body.code && !excludeCodeFromBody(result.code)) {
        result.body.code = result.code;
    }

    if (result.body && result.body.code && excludeCodeFromBody(result.body.code)) {
        delete result.body.code;
    }
}

/**
 * This function finishes a multi-declaration request the user
 *   submitted and returns a formatted result
 * Eng Note: Per-App API should never hit this function, as
 *   multi-declaration is incompatible with the API
 *
 * @param {object} restOperation - RestOperation object
 * @param {object} result - Response back to user
 * @param {boolean} [format] - determines the format response
 */
const completeRequestMultiStatus = function (restOperation, results, format) {
    if (format) {
        const statusCode = getMultiStatusCode(results);
        const body = getMultiBody(results, statusCode);
        restOperation.setStatusCode(statusCode);
        restOperation.setBody(body);
    } else {
        restOperation.setStatusCode(results.code);
        restOperation.setBody(results.body || results);
    }

    restOperation.complete();
    checkWebhook(restOperation, results.body || results);
};

/**
 * This function finishes the request the user made and returns
 * the results.
 *
 * @param {object} restOperation - RestOperation object
 * @param {object} result - Response back to user
 * @param {object} [perAppInfo] - Holds tenant, application, and original
 *                                  declaration for per-app requests.
 * Eng Note: perAppInfo should be provided when NOT expecting an error
 */
const completeRequest = function (restOperation, result, perAppInfo) {
    formatResult(result);

    let body = util.simpleCopy(result.body);

    // ONLY transform non-error per-app declarations
    if (perAppInfo && body && !body.errors) {
        if (restOperation.method === 'Post') {
            body.declaration = perAppUtil.convertToPerApp(body.declaration, perAppInfo);
        } else if (restOperation.method === 'Get') {
            body = perAppUtil.convertToPerApp(body, perAppInfo);
        }
    }

    restOperation.setStatusCode(result.code);
    restOperation.setBody(body);

    restOperation.complete();
    checkWebhook(restOperation, result);
};

function checkWebhook(restOperation, result) {
    if (restOperation.method.toUpperCase() === 'POST') {
        Config.getAllSettings()
            .then((settings) => {
                if (settings.webhook) {
                    const options = {
                        why: 'Sending response to webhook',
                        method: 'POST',
                        send: JSON.stringify(result.body || result),
                        headers: { 'Content-Type': 'application/json' }
                    };
                    util.httpRequest(settings.webhook, options);
                }
            })
            .catch((err) => {
                // Don't fail the request just because the webhook fails
                log.error(`Failed sending response to webhook: ${err.message}`);
            });
    }
}

module.exports = {
    getMultiBody,
    getMultiStatusCode,
    buildOpResult,
    buildOpResultMulti,
    checkWebhook,
    completeRequest,
    completeRequestMultiStatus,
    formatResult
};

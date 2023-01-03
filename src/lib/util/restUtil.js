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

const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    MULTI_STATUS: 207,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE_ERROR: 503,
    GATEWAY_TIMEOUT: 504
};

const excludeCodeFromBody = function (code) {
    const noCodeInBody = [STATUS_CODES.OK, STATUS_CODES.CREATED, STATUS_CODES.ACCEPTED, STATUS_CODES.NO_CONTENT];
    return noCodeInBody.indexOf(code) > -1;
};

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
};

const completeRequest = function (restOperation, result) {
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
    restOperation.setStatusCode(result.code);
    restOperation.setBody(result.body);
    restOperation.complete();
};

module.exports = {
    STATUS_CODES,
    getMultiBody,
    getMultiStatusCode,
    buildOpResult,
    buildOpResultMulti,
    completeRequest,
    completeRequestMultiStatus
};

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

const https = require('https');
const http = require('http');
const simpleCopy = require('../../src/lib/util/util').simpleCopy;
const validateEnvVars = require('./checkEnv').validateEnvVars;

const REQUEST_TIMEOUT = 180000;

function responseHandler(response, options, callback) {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
        if (response.statusCode >= 400) {
            callback(new Error(`Received unexpected ${response.statusCode} status code: ${data}`));
            return;
        }

        response.body = data;
        if (!response.body) {
            callback(null, response);
            return;
        }

        if (!options.skipParse) {
            try {
                response.body = JSON.parse(data);
            } catch (error) {
                const body = JSON.stringify(response.body, null, 2);
                error.message = `Unable to parse response body.\nReceived:${body}\nParse Error:${error.message}`;
                callback(error, response);
                return;
            }
        }
        callback(null, response);
    });
}

function requestCommon(requestOptions, callback) {
    if (requestOptions.headers && requestOptions.headers['X-F5-Auth-Token']) {
        delete requestOptions.auth;
    }

    const sanitizedOptions = simpleCopy(requestOptions);
    if (requestOptions.retryIf) {
        sanitizedOptions.retryIf = requestOptions.retryIf;
    }
    const options = Object.assign(
        {
            retryCount: 3,
            retryInterval: 500,
            retryIf: (error) => error,
            rejectUnauthorized: false
        },
        sanitizedOptions
    );

    // Check host for port
    const splitHost = options.host.split(':');
    if (splitHost.length > 1) {
        options.host = splitHost[0];
        options.port = splitHost[1];
    }

    let bodyData = null;
    if (typeof options.body !== 'undefined' && options.body !== null) {
        bodyData = options.body;
        if (typeof bodyData !== 'string') {
            bodyData = JSON.stringify(bodyData);
        }
    }

    function errorHandler(error, response) {
        if (options.retryIf(error, response) && options.retryCount > 0) {
            options.retryCount -= 1;
            setTimeout(() => requestCommon(options, callback), options.retryInterval);
            return;
        }
        callback(error, response);
    }

    const requestLib = (options.protocol === 'http:') ? http : https;
    const request = requestLib.request(
        options,
        (response) => responseHandler(response, options, errorHandler)
    );

    request.on('error', errorHandler);
    request.on('timeout', () => {
        request.abort();
        errorHandler(new Error('timeout'));
    });

    request.setTimeout(REQUEST_TIMEOUT);

    if (bodyData) {
        const chunk = function (step, offset = 0) {
            const size = Math.min(bodyData.length - offset, step);
            if (size < 1) {
                request.end();
                return;
            }
            request.write(bodyData.slice(offset, offset + size), () => {
                chunk(step, offset + size);
            });
        };

        // update the int to indicate the number of bytes per chunk, 2K is the suggested value
        chunk(2000);
    } else {
        request.end();
    }
}

function validateRequestEnvVars(requestOptions) {
    if (typeof requestOptions.host === 'undefined') {
        validateEnvVars(['AS3_HOST']);
    }
    if (typeof requestOptions.auth === 'undefined') {
        validateEnvVars(['AS3_USERNAME', 'AS3_PASSWORD']);
    }
}

function get(requestOptions, callback) {
    validateRequestEnvVars(requestOptions);

    const options = Object.assign(
        {
            host: requestOptions.host || process.env.AS3_HOST,
            auth: `${process.env.AS3_USERNAME}:${process.env.AS3_PASSWORD}`,
            method: 'GET'
        },
        requestOptions
    );
    requestCommon(options, callback);
}

function post(requestOptions, callback) {
    validateRequestEnvVars(requestOptions);

    let bodyData = requestOptions.body;

    if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData);
    }

    const options = Object.assign(
        {
            host: requestOptions.host || process.env.AS3_HOST,
            auth: `${process.env.AS3_USERNAME}:${process.env.AS3_PASSWORD}`,
            method: 'POST'
        },
        requestOptions
    );

    options.headers = Object.assign(
        {
            'Content-Type': 'application/json',
            'Content-Length': bodyData.length
        },
        requestOptions.headers
    );
    requestCommon(options, callback);
}

function patch(requestOptions, callback) {
    validateRequestEnvVars(requestOptions);

    let bodyData = requestOptions.body;

    if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData);
    }

    const options = Object.assign(
        {
            host: requestOptions.host || process.env.AS3_HOST,
            auth: `${process.env.AS3_USERNAME}:${process.env.AS3_PASSWORD}`,
            method: 'PATCH',
            headers: Object.assign(
                {
                    'Content-Type': 'application/json',
                    'Content-Length': bodyData.length
                },
                requestOptions.headers
            )
        },
        requestOptions
    );
    requestCommon(options, callback);
}

function put(requestOptions, callback) {
    validateRequestEnvVars(requestOptions);

    let bodyData = requestOptions.body;

    if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData);
    }

    const options = Object.assign(
        {
            host: requestOptions.host || process.env.AS3_HOST,
            auth: `${process.env.AS3_USERNAME}:${process.env.AS3_PASSWORD}`,
            method: 'PUT',
            headers: Object.assign(
                {
                    'Content-Type': 'application/json',
                    'Content-Length': bodyData.length
                },
                requestOptions.headers
            )
        },
        requestOptions
    );
    requestCommon(options, callback);
}

function deleteRequest(requestOptions, callback) {
    validateRequestEnvVars(requestOptions);

    const options = Object.assign(
        {
            host: requestOptions.host || process.env.AS3_HOST,
            auth: `${process.env.AS3_USERNAME}:${process.env.AS3_PASSWORD}`,
            method: 'DELETE'
        },
        requestOptions
    );
    requestCommon(options, callback);
}

module.exports = {
    get,
    post,
    delete: deleteRequest,
    patch,
    put
};

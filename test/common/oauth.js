/**
 * Copyright 2025 F5, Inc.
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

const querystring = require('querystring');
const requestUtilPromise = require('./requestUtilPromise');
const { validateEnvVars } = require('./checkEnv');

function getTokenForTest() {
    validateEnvVars(
        [
            'ARM_TENANT_ID',
            'ARM_CLIENT_ID',
            'ARM_CLIENT_SECRET'
        ]
    );

    return getToken(
        'login.microsoftonline.com:443',
        `/${process.env.ARM_TENANT_ID}/oauth2/token`,
        'client_credentials',
        process.env.ARM_CLIENT_ID,
        process.env.ARM_CLIENT_SECRET,
        'https://storage.azure.com/'
    );
}

function getToken(host, path, grantType, clientId, clientSecret, resource) {
    const bodyData = {
        grant_type: grantType,
        client_id: clientId,
        client_secret: clientSecret,
        resource
    };

    const options = {
        host,
        path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
        },
        auth: null,
        body: querystring.stringify(bodyData)
    };
    return requestUtilPromise.post(options)
        .then((response) => {
            if (!response.body.access_token) {
                return Promise.reject(new Error('No access token found in response'));
            }
            return Promise.resolve(response.body.access_token);
        });
}

module.exports = {
    getTokenForTest
};

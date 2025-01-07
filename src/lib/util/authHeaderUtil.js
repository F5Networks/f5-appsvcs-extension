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

const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const util = require('./util');

function getAuthHeader(context, auth) {
    if (!auth) {
        return Promise.resolve();
    }

    switch (auth.method) {
    case 'basic':
        return getBasicAuthHeader(context, auth);
    case 'bearer-token':
        return getBearerTokenAuthHeader(context, auth);
    default:
        return Promise.reject(new Error(`unimplemented auth type=${auth.method}`));
    }
}

function getBasicAuthHeader(context, auth) {
    let encryptedString = auth.passphrase;

    if (typeof encryptedString === 'object') {
        encryptedString = util.fromBase64(encryptedString.ciphertext).toString();
    }

    return secureVault.decrypt(encryptedString)
        .then((plainPwd) => ({
            Authorization: `Basic ${util.base64Encode(`${auth.username}:${plainPwd}`)}`
        }));
}

function getBearerTokenAuthHeader(context, auth) {
    let encryptedToken = auth.token;

    if (typeof encryptedToken === 'object') {
        encryptedToken = util.fromBase64(encryptedToken.ciphertext).toString();
    }

    return secureVault.decrypt(encryptedToken)
        .then((plainToken) => ({
            Authorization: `Bearer ${plainToken}`
        }));
}

module.exports = {
    getAuthHeader
};

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

const AJV = require('ajv');
const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const util = require('../util/util');
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;
const SecretTag = require('./secretTag');

const TAG = 'longSecret';

/**
 * Process long secret data that was tagged by the f5PostProcess keyword during AJV validation.
 * Encrypt secret that is too long to be handled by f5PostProcess(secret).
 * Hopefully we can convert f5PostProcess(secret) and cloudLibsEncrypt to this
 * someday but it only runs locally (as does f5PostProcess(secret)).
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [longSecrets] - The array of long secrets that will be processed
 * @param {*} longSecrets[].data - The long secret data from the declaration
 * @param {*} longSecrets[].parentData - The long secret's parent data from the declaration
 * @param {string} longSecrets[].instancePath - The json pointer that was used to fetch the data
 * @param {string} longSecrets[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, longSecrets) {
    if (!longSecrets) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        // don't want to encrypt secrets right now
        return Promise.resolve();
    }

    const promises = longSecrets.map((s) => {
        if (isAlreadyEncrypted(s.data, s.instancePath)) {
            return Promise.resolve();
        }

        if (util.getDeepValue(context, 'target.deviceType') === DEVICE_TYPES.BIG_IQ) {
            if (typeof s.data === 'string') {
                if (s.data.length > 2000) {
                    return Promise.resolve();
                }

                s.parentData[s.parentDataProperty] = {
                    ciphertext: util.base64Encode(s.data),
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                    miniJWE: true,
                    ignoreChanges: false
                };
                s.data = s.parentData[s.parentDataProperty];
                return SecretTag.process(context, declaration, [s]);
            }
            const errMsg = 'BIG-IQ received the following already encrypted data, instead'
                + ` of a string: ${JSON.stringify(s.data)}`;
            return Promise.reject(new Error(errMsg));
        }

        if (typeof s.data !== 'string') {
            s.data = util.base64Decode(s.data.ciphertext).toString();
        }

        return encryptLongSecret(context, {
            parent: s.parentData,
            key: s.parentDataProperty,
            secret: s.data
        });
    });

    return Promise.all(promises)
        .then(() => Promise.resolve());
}

function isAlreadyEncrypted(data, dataPath) {
    let JOSE = { enc: 'none' };

    if (typeof data === 'object' && data.protected) {
        const joseString = util.fromBase64(data.protected).toString();
        try {
            JOSE = JSON.parse(joseString);
        } catch (e) {
            const myerror = {
                dataPath: dataPath || 'unknown path',
                keyword: 'f5PostProcess(longSecret)',
                params: {},
                message: `Error parsing 'protected' property: ${e.message}`
            };
            throw new AJV.ValidationError([myerror]);
        }
    }

    return JOSE.enc !== 'none';
}

function encryptLongSecret(context, data) {
    return secureVault.encrypt(data.secret)
        .then((response) => {
            data.parent[data.key] = {
                ciphertext: util.base64Encode(response),
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0',
                miniJWE: true
            };
        })
        .catch((e) => {
            e.message = `Failed encrypting credential with secureVault: ${e.message}`;
            throw e;
        });
}

module.exports = {
    process,
    TAG
};

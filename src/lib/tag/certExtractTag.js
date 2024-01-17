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

const fetchValue = require('../util/fetchUtil').fetchValue;
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

const TAG = 'certExtract';

/**
 * Process cert data that was tagged by the f5PostProcess keyword during AJV validation.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [certs] - The array of cert data that will be processed
 * @param {*} certs[].data - The cert data from the declaration
 * @param {*} certs[].parentData - The cert parent data from the declaration
 * @param {string} certs[].instancePath - The json pointer that was used to fetch the data
 * @param {string} certs[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, certs) {
    if (!certs) {
        return Promise.resolve();
    }

    if (context.host.deviceType === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    const promises = certs.map((cert) => Promise.resolve()
        .then(() => {
            const opts = cert.parentData.pkcs12Options;

            if (typeof cert.data !== 'string' || cert.parentDataProperty !== 'pkcs12') {
                return Promise.resolve();
            }

            if (opts && opts.internalOnly && opts.internalOnly.length > 0) {
                return Promise.resolve();
            }

            // transform str to obj to trigger a fetch
            cert.data = { base64: cert.data };
            cert.schemaData = 'pkcs12';

            return fetchValue(context, declaration, cert);
        }));

    return Promise.all(promises)
        .then(() => Promise.resolve());
}

module.exports = {
    process,
    TAG
};

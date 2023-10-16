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

const util = require('../util/util');
const authHeaderUtil = require('../util/authHeaderUtil');
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

const TAG = 'checkResource';

/**
 * This tag check external paths to confirm the resource exists
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [checks] - The array of resources that will be processed "checked"
 * @param {*} checks[].data - The node data from the declaration
 * @param {string} checks[].instancePath - The json pointer that was used to fetch the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, checks) {
    if (!checks || checks.length === 0 || context.host.deviceType === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve(); // Skip checks if there is nothing to check or on BIG_IQ
    }
    return Promise.all(checks.map((check) => checkResourceTag(check.data, check.instancePath, context)))
        .then(() => Promise.resolve()); // Must resolve undefined
}

function checkResourceTag(data, instancePath, context) {
    const urlObj = Object.assign(
        { skipCertificateCheck: false },
        !data.url ? { url: data } : data
    );

    if (urlObj.url.startsWith('file:')) {
        return Promise.resolve();
    }

    const hdrs = {};
    return Promise.resolve()
        .then(() => authHeaderUtil.getAuthHeader(context, urlObj.authentication))
        .then((authHeader) => Object.assign(hdrs, authHeader))
        .then(() => util.getExtraHeaders(urlObj))
        .then((extraHeaders) => Object.assign(hdrs, extraHeaders))
        .then(() => {
            const timeout = util.getDeepValue(context, `tasks.${context.currentIndex}.resourceTimeout`);
            const options = {
                method: 'HEAD',
                headers: hdrs,
                why: (`for ${instancePath}`),
                rejectUnauthorized: !urlObj.skipCertificateCheck,
                timeout
            };
            return util.httpRequest(urlObj.url, options);
        })
        .then(() => Promise.resolve())
        .catch((error) => {
            error.status = 422;
            error.message = `Could not reach ${urlObj.url} for ${instancePath}`;
            throw error;
        });
}

module.exports = {
    process,
    TAG
};

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

const fetchValue = require('../util/fetchUtil').fetchValue;
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

const TAG = 'include';

/**
 * Process include data that was tagged by the f5PostProcess keyword during AJV validation.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [includeList] - The array of include data that will be processed
 * @param {*} includeList[].data - The include data from the declaration
 * @param {*} includeList[].parentData - The include parent data from the declaration
 * @param {string} includeList[].instancePath - The json pointer that was used to fetch the data
 * @param {string} includeList[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, includeList) {
    if (!includeList) {
        return Promise.resolve();
    }

    if (context.host.deviceType === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    const promises = includeList.map((include) => Promise.resolve()
        .then(() => {
            const arrayData = Array.isArray(include.data) ? include.data : [include.data];
            const fetchPromises = arrayData.map((item) => {
                include.data = { include: item };
                return fetchValue(context, declaration, include);
            });
            return Promise.all(fetchPromises);
        }));

    return Promise.all(promises)
        .then(() => Promise.resolve());
}

module.exports = {
    process,
    TAG
};

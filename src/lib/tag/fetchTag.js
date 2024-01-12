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

const TAG = 'fetch';

/**
 * Process fetch data that was tagged by the f5PostProcess keyword during AJV validation.
 * Copies values into declarations from anywhere (in the world!)
 *
 * If special property 'scratch' in the root of the document exists, this becomes a no-op.  That
 * is so we can avoid re-compiling the schema when we just want to fill defaults in some
 * declaration without fetching remote resources.
 *
 * TODO: we *could* support 'file:' url, but maybe that would be a bridge too far-- we're not sure
 * what platform AS3 is running on, are we?
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [fetchList] - The array of fetch data that will be processed
 * @param {*} fetchList[].data - The fetch data from the declaration
 * @param {*} fetchList[].parentData - The fetch parent data from the declaration
 * @param {string} fetchList[].instancePath - The json pointer that was used to fetch the data
 * @param {string} fetchList[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, fetchList) {
    if (!fetchList) {
        return Promise.resolve();
    }

    if (context.host.deviceType === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    const promises = fetchList.map((fetch) => Promise.resolve()
        .then(() => {
            const dataType = typeof fetch.data;

            if (dataType !== 'string' && dataType !== 'object') {
                return Promise.resolve();
            }

            if (dataType === 'string') {
                fetch.data = {
                    [fetch.parentDataProperty]: fetch.data
                };
            }

            return fetchValue(context, declaration, fetch);
        }));

    return Promise.all(promises)
        .then(() => Promise.resolve());
}

module.exports = {
    process,
    TAG
};

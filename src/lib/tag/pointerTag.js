/**
 * Copyright 2026 F5, Inc.
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
const log = require('../log');
const extractUtil = require('../util/extractUtil');

const TAG = 'pointer';

const babyAjv = new AJV({
    allErrors: false,
    verbose: true,
    useDefaults: true
});

/**
 * Process pointer data that was tagged by the f5PostProcess keyword during AJV validation.
 * Both validates and fixes up AS3 pointers. We needn't provide meta-schema for this tag since
 * we will detect any errors while compiling the target-testing schema anyway.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [pointers] - The array of pointers that will be processed
 * @param {*} pointers[].data - The pointer data from the declaration
 * @param {*} pointers[].parentData - The pointers's parent data from the declaration
 * @param {string} pointers[].instancePath - The json pointer that was used to fetch the data
 * @param {string} pointers[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, pointers) {
    if (!pointers) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    const promises = pointers.map((p) => Promise.resolve()
        .then(() => {
            const myerror = {
                dataPath: p.instancePath || 'unknown path',
                keyword: 'f5PostProcess(pointer)',
                params: {},
                message: ''
            };
            let v;
            let tgt;

            if (typeof p.data !== 'string' || p.data === '') {
                return Promise.resolve();
            }

            try {
                v = babyAjv.compile(p.schemaData);
            } catch (e) {
                log.warning(`invalid schema for f5PostProcess(pointer): ${
                    JSON.stringify(p.schemaData)}`);
                throw (e);
            }

            try {
                tgt = extractUtil.getAs3Object(
                    p.data,
                    p.instancePath,
                    p.parentData,
                    declaration,
                    true,
                    p.parentData,
                    p.parentDataProperty,
                    '',
                    null,
                    ''
                );
            } catch (e) {
                myerror.message = e.message;
                throw new AJV.ValidationError([myerror]);
            }

            // does pointed-to data match required schema?
            if (!v(tgt)) {
                myerror.message = `AS3 pointer ${p.data
                } does not point to required object type`;
                throw new AJV.ValidationError([myerror]);
            }

            return Promise.resolve();
        }));

    return Promise.all(promises)
        .then(() => Promise.resolve());
}

module.exports = {
    process,
    TAG
};

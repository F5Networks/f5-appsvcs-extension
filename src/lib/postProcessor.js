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

const jsonpointer = require('jsonpointer');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const Tag = require('./tag');

/**
 * An object that describes how to fetch the target declaration data
 * @typedef {Object} PostProcessInfo
 * @property {string} instancePath - JSON pointer that references data in the declaration
 * @property {Object} [schemaData] - additional arbitrary data that is included in the
 *                                   f5PostProcess keyword instance
 */

class PostProcessor {
    /**
     * Process declaration data that was tagged by the f5PostProcess keyword during AJV validation.
     * DECLARATION IS MODIFIED!
     *
     * Each tag processor should throw an error or return a promise which is either:
     *     - resolved with 'undefined' or
     *     - resolved with an object with the format
     *         {
     *             warnings: [<array_of_processing_warnings]
     *         }
     * @param {Object} context - The current context object
     * @param {Object} declaration - The current declaration that was validated by AJV
     * @param {Object} originalDeclaration - The original declaration that was sent by the user
     * @param {Object.<PostProcessInfo>[]} [postProcess] - The saved info that will be used to
     *                                                     gather and process declaration data
     * @param {Object} options - Options provided to augment how the postProcessor functions
     * @param {Object} options.includeList - Limits the tags that will be processed to only
     *                                       these values
     * @param {Object} options.excludeList - Limits the tags so that the supplied tags will
     *                                       not be run
     * @returns {Promise} - Promise resolves when all data is processed
     */
    static process(context, declaration, originalDeclaration, postProcess, options) {
        options = options || {};
        if (!context) {
            return Promise.reject(new Error('Context is required.'));
        }
        if (!declaration) {
            return Promise.reject(new Error('Declaration is required.'));
        }

        const processors = getProcessorsByTag();
        const processFunctions = (postProcess || []).map((info) => () => {
            if (options.includeList) {
                if (options.includeList.indexOf(info.tag) === -1) {
                    return Promise.resolve();
                }
            } else if (options.excludeList) {
                if (options.excludeList.indexOf(info.tag) > -1) {
                    return Promise.resolve(); // Note: includeList supercedes excludeList
                }
            }
            const processor = processors[info.tag];
            if (typeof processor === 'undefined') {
                return Promise.resolve({
                    warnings: [`Schema tag ${info.tag} is an unknown tag and was not processed`]
                });
            }

            const data = gatherData(declaration, info);
            return processor.process(context, declaration, [data], originalDeclaration);
        });

        return promiseUtil.series(processFunctions)
            .then((results) => results.reduce(
                (acc, curVal) => {
                    if (curVal) {
                        acc.warnings = acc.warnings.concat(curVal.warnings);
                    }
                    return acc;
                },
                { warnings: [] }
            ));
    }
}

/**
 * Creates a lookup table where the key is the tag and the value is the associated processor.
 * @returns {Object} - Object with tag/processor pairs
 */
function getProcessorsByTag() {
    return Object.keys(Tag).reduce((obj, tagKey) => {
        const processor = Tag[tagKey];
        obj[processor.TAG] = processor;
        return obj;
    }, {});
}

/**
 * Gathers the necessary declaration data using the provided info.
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {PostProcessInfo} [info] - The info that will be used to fetch the declaration data
 * @returns {Object} - Data object that includes declaration data and original info
 */
function gatherData(declaration, info) {
    return {
        tenant: info.instancePath ? info.instancePath.split('/')[1] : 'unknown tenant',
        instancePath: info.instancePath,
        parentDataProperty: info.parentDataProperty,
        schemaData: info.schemaData,
        data: jsonpointer.get(declaration, info.instancePath),
        parentData: jsonpointer.get(declaration, info.instancePath.split('/').slice(0, -1).join('/'))
    };
}

module.exports = PostProcessor;

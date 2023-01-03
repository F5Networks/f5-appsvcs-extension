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
const extractUtil = require('../util/extractUtil');
const expandUtil = require('../util/expandUtil');
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

const TAG = 'expand';

/**
 * Process expand data that was tagged by the f5PostProcess keyword during AJV validation.
 * Replaces backquote escapes in strings in declarations.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [expandList] - The array of expand data that will be processed
 * @param {*} expandList[].data - The expand data from the declaration
 * @param {*} expandList[].parentData - The expand parent data from the declaration
 * @param {string} expandList[].instancePath - The json pointer that was used to fetch the data
 * @param {string} expandList[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, expandList) {
    if (!expandList) {
        return Promise.resolve();
    }

    if (context.target.deviceType === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    const promises = expandList.map((expand) => Promise.resolve()
        .then(() => {
            if (typeof expand.data !== 'string') {
                // shucks, we can only expand a string!  (We
                // check here instead of using 'type' option
                // with addKeyword because ajv looks at
                // object-type only once, so if f5PostProcess(fetch) gets
                // us a string from an F5string url or wherever,
                // thus replacing 'data' object with string,
                // ajv won't know about that, so it wouldn't
                // call us if options contained type:"string"
                return Promise.resolve();
            }

            let schema = expand.schemaData;
            let parentDataProperty = expand.parentDataProperty;

            // validate expand schema
            switch (typeof schema) {
            case 'undefined':
                break;
            case 'object': {
                const allowedKeys = ['when', 'to'];
                Object.keys(schema).forEach((key) => {
                    if (allowedKeys.indexOf(key) === -1) {
                        throw new Error(`f5PostProcess(expand) schema property "${key}" not allowed`);
                    }
                    const val = schema[key];
                    if (typeof val !== 'string') {
                        throw new Error(`f5PostProcess(expand) schema property "${key}" must have string value`);
                    }
                });
                break;
            }
            default:
                throw new Error('f5PostProcess(expand) schema must be undefined or an object');
            }

            const myerror = {
                dataPath: expand.instancePath,
                keyword: 'f5PostProcess(expand)',
                params: {},
                message: ''
            };

            // schema property "when" (if any) is AS3 pointer to
            // boolean value in declaration that says whether
            // or not target should be expanded
            const rv = { now: (schema || true).toString() };
            schema = schema || {};
            if (Object.prototype.hasOwnProperty.call(schema, 'when') && (schema.when !== '')) {
                try {
                    extractUtil.getAs3Object(
                        schema.when,
                        expand.instancePath,
                        expand.parentData,
                        declaration,
                        false,
                        expand.parentData,
                        parentDataProperty,
                        'string',
                        rv,
                        'now'
                    );
                } catch (e) {
                    myerror.message = `${schema.when} ${e.message}`;
                    throw new AJV.ValidationError([myerror]);
                }
            }

            // rv.now is string, not boolean
            if (rv.now !== 'true') {
                return Promise.resolve(); // success (no expansion wanted)
            }

            // schema property "to" (if any) names another
            // property of 'parent_data' we should put expansion
            // into, rather than default 'ppty_name'
            if (Object.prototype.hasOwnProperty.call(schema, 'to') && (schema.to !== '')) {
                parentDataProperty = schema.to;
            }

            try {
                expandUtil.backquoteExpand(
                    expand.data,
                    expand.instancePath,
                    expand.parentData,
                    declaration,
                    expand.parentData,
                    parentDataProperty
                );
            } catch (e) {
                myerror.message = e.message;
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

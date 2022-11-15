/**
 * Copyright 2022 F5 Networks, Inc.
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

const util = require('../util/util');
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

const TAG = 'modules';

/**
 * This Tag checks if required modules are provisioned on the target BIG-IP.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [modules] - The array of modules that will be processed
 * @param {*} modules[].data - The pointer data from the declaration
 * @param {*} modules[].parentData - The modules's parent data from the declaration
 * @param {string} modules[].instancePath - The json pointer that was used to fetch the data
 * @param {string} modules[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, modules) {
    const myErrors = [];

    if (!modules || context.target.deviceType === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve();
    }

    if (typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    // this is to help with readability
    const target = context.target;

    modules.forEach((m) => {
        if (typeof m.schemaData === 'object' && !Array.isArray(m.schemaData)) {
            myErrors.push({
                keyword: 'f5PostProcess(modules)',
                params: { keyword: 'f5PostProcess(modules)' },
                message: 'Received unprocessable object as module data instead of a String or Array<String>'
            });
            return;
        }

        const modulesToCheck = (typeof m.schemaData === 'string') ? [m.schemaData] : m.schemaData;
        if (util.isOneOfProvisioned(target, modulesToCheck)) {
            return;
        }

        myErrors.push({
            keyword: 'f5PostProcess(modules)',
            params: { keyword: 'f5PostProcess(modules)' },
            message: `One of these F5 modules needs to be provisioned: ${modulesToCheck.join(', ')}`
        });
    });

    if (myErrors.length > 0) {
        return Promise.reject(new AJV.ValidationError(myErrors));
    }

    return Promise.resolve();
}

module.exports = {
    process,
    TAG
};

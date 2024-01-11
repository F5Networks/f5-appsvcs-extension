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

const TAG = 'aliases';

/**
 * Process aliases data that was tagged by the f5PostProcess keyword during AJV validation.
 *
 * Prioritizes aliased keyword if exists, otherwise maps the original property value to
 * the missing alias key. The original property is deleted in either case.
 * Should be specified in the parent object, not the target properties themselves.
 *
 * Example: f5aliases: {
 *                         aliasPropertyNameOne: 'originalPropertyNameOne',
 *                         aliasPropertyNameTwo: 'originalPropertyNameTwo'
 *                     }
 *
 * Note: The alias property should not have a default value, even if the original
 * property does. This is because of the 'useDefaults' AJV option and how it
 * auto-fills the defaults for each undefined property. We are not able to determine
 * if a user specified the orignal property or the alias property in this case and
 * the user defined property can end up being overwritten. See 'synCookieAllowlist'
 * in TCP_Profile as an example of a correctly defined alias with the default removed.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [aliases] - The list of aliases that will be processed
 * @param {Object} aliases[].data - The tagged data object from the declaration
 * @param {Object} aliases[].schemaData - The alias schema data for the tagged object
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, aliases) {
    (aliases || []).forEach(processAlias);

    return Promise.resolve(); // Must resolve undefined
}

function processAlias(alias) {
    const data = alias.data;
    const schema = alias.schemaData;
    Object.keys(schema).forEach((key) => {
        if (typeof data[schema[key]] === 'undefined') {
            return;
        }
        if (typeof data[key] === 'undefined') {
            data[key] = data[schema[key]];
        }
        delete data[schema[key]];
    });
}

module.exports = {
    process,
    TAG
};

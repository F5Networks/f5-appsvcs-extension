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

const jsonpointer = require('jsonpointer');
const util = require('../util/util');

const TAG = 'minVersion';

/**
 * Process min version data that was tagged by the f5PostProcess keyword during AJV validation.
 * Check the version of BIG-IP that we are running on and if it is lower than the min version then
 * remove the property
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [minVersions] - The array of min versions that will be processed
 * @param {Object} originalDeclaration - The original declaration that was sent by the user
 * @param {*} minVersions[].schemaData - The min version data from the declaration
 * @param {*} minVersions[].parentData - The min version's parent data from the declaration
 * @param {string} minVersions[].instancePath - The json pointer that was used to fetch the data
 * @param {string} minVersions[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed.
 */
function process(context, declaration, minVersions, originalDeclaration) {
    if (!minVersions) {
        return Promise.resolve();
    }

    const warnings = minVersions
        .map((minVersion) => {
            if (isDeviceVersionTooLow(context, minVersion.schemaData)) {
                removeProperty(declaration, minVersion.instancePath);
                return getWarning(
                    originalDeclaration,
                    minVersion.tenant,
                    minVersion.instancePath,
                    minVersion.schemaData,
                    minVersion.parentData.class,
                    minVersion.parentDataProperty
                );
            }
            return undefined;
        })
        .filter(Boolean);

    return Promise.resolve({ warnings });
}

function isDeviceVersionTooLow(context, minVersionAllowed) {
    return util.versionLessThan(context.target.tmosVersion, minVersionAllowed);
}

function removeProperty(declaration, dataPath) {
    jsonpointer.set(declaration, dataPath, undefined);
}

function getWarning(declaration, tenant, dataPath, minVersionAllowed, propertyClass, propertyName) {
    // If the setting was also in the original declaration (and not just a default that we added)
    // issue a warning
    let warning;
    if (typeof jsonpointer.get(declaration, dataPath) !== 'undefined') {
        warning = {
            tenant,
            dataPath: dataPath || 'unknown path',
            keyword: 'f5PostProcess(minVersion)',
            params: {},
            message: `${propertyClass}.${propertyName} ignored. This is only valid on BIG-IP versions ${minVersionAllowed} and above.`
        };
    }
    return warning;
}

module.exports = {
    process,
    TAG
};

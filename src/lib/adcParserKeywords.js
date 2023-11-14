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

const keywords = [
    {
        name: 'f5PostProcess',
        definition: (that) => ({
            metaSchema: {
                type: 'object',
                properties: {
                    tag: {
                        type: 'string',
                        minLength: 1
                    },
                    data: {
                        type: ['string', 'object', 'array']
                    }
                },
                required: ['tag'],
                additionalProperties: false
            },
            validate() {
                const args = Array.from(arguments);
                const schema = args[0];
                let instancePath;
                let parentDataProperty;

                if (typeof args[3] === 'object') {
                    // Fetch data from AJV 7+
                    instancePath = args[3].instancePath;
                    parentDataProperty = args[3].parentDataProperty;
                } else {
                    // Fetch data from AJV 6
                    instancePath = args[3];
                    parentDataProperty = args[5];
                }

                that.postProcess.push({
                    instancePath,
                    parentDataProperty,
                    tag: schema.tag,
                    schemaData: schema.data
                });

                return true;
            }
        })
    },
    /*
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
     */
    {
        name: 'f5aliases',
        definition: () => ({
            modifying: true,
            compile(aliasObj) {
                return function f5aliases(data) {
                    Object.keys(aliasObj).forEach((alias) => {
                        if (typeof data[aliasObj[alias]] === 'undefined') {
                            return;
                        }
                        if (typeof data[alias] === 'undefined') {
                            data[alias] = data[aliasObj[alias]];
                        }
                        delete data[aliasObj[alias]];
                    });
                    return true;
                };
            }
        })
    }
];

module.exports = {
    keywords
};

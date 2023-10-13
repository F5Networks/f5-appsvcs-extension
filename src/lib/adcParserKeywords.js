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
    }
];

module.exports = {
    keywords
};

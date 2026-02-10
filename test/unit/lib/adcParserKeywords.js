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

const assert = require('assert');

const keywords = require('../../../src/lib/adcParserKeywords').keywords;
const Context = require('../../../src/lib/context/context');

describe('adcParserKeywords', () => {
    describe('f5PostProcess', () => {
        const f5PostProcess = keywords.find((keyword) => keyword.name === 'f5PostProcess').definition;
        let that = null;
        let context;
        let declaration;

        beforeEach(() => {
            context = Context.build();
            that = {
                _postProcess: [],
                context
            };
            declaration = {
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            virtualAddresses: ['192.0.2.10'],
                            profileHTTP: {
                                use: 'httpProfile'
                            }
                        },
                        httpProfile: {
                            class: 'HTTP_Profile',
                            webSocketsEnabled: true,
                            webSocketMasking: 'preserve'
                        }
                    }
                }
            };
        });

        it('should handle validating postProcess', () => {
            const p = {
                tenant: 'tenant',
                data: declaration.tenant.application.service.profileHTTP.use,
                parentData: declaration.tenant.application.service.profileHTTP,
                parentDataProperty: 'use',
                instancePath: '/tenant/application/service/profileHTTP/use',
                schema: {
                    tag: 'pointer',
                    data: {
                        properties: {
                            class: {
                                const: 'HTTP_Profile'
                            }
                        },
                        required: [
                            'class'
                        ]
                    }
                }
            };

            const results = f5PostProcess(that).validate(
                p.schema, p.data, p.parentSchema, p.instancePath, p.parentData, p.parentDataProperty, declaration
            );
            assert.strictEqual(results, true);
            assert.deepStrictEqual(
                that._postProcess,
                [
                    {
                        instancePath: '/tenant/application/service/profileHTTP/use',
                        parentDataProperty: 'use',
                        tag: 'pointer',
                        schemaData: {
                            properties: {
                                class: {
                                    const: 'HTTP_Profile'
                                }
                            },
                            required: [
                                'class'
                            ]

                        }
                    }
                ]
            );
        });
    });
});

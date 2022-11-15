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
                postProcess: [],
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
                that.postProcess,
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

    describe('f5aliases', () => {
        let that;
        let f5aliases;

        beforeEach(() => {
            const compileData = {
                aliasOne: 'originalOne',
                aliasTwo: 'originalTwo'
            };
            const context = Context.build();
            that = { context };
            f5aliases = keywords.find((keyword) => keyword.name === 'f5aliases')
                .definition(that).compile(compileData);
        });

        it('should replace original properties with alias name', () => {
            const validateData = {
                originalOne: { subData: 'test' },
                originalTwo: true
            };
            const expected = {
                aliasOne: { subData: 'test' },
                aliasTwo: true
            };
            assert.strictEqual(f5aliases(validateData), true);
            assert.deepStrictEqual(validateData, expected);
        });

        it('should prioritize alias properties and remove originals', () => {
            const validateData = {
                originalOne: { oldSubData: 'oldValue' },
                originalTwo: true,
                aliasOne: { newSubData: 'newValue' },
                aliasTwo: false
            };
            const expected = {
                aliasOne: { newSubData: 'newValue' },
                aliasTwo: false
            };
            assert.strictEqual(f5aliases(validateData), true);
            assert.deepStrictEqual(validateData, expected);
        });

        it('should do nothing if only alias properties are provided', () => {
            const validateData = {
                aliasOne: { newSubData: 'newValue' },
                aliasTwo: false
            };
            const expected = {
                aliasOne: { newSubData: 'newValue' },
                aliasTwo: false
            };
            assert.strictEqual(f5aliases(validateData), true);
            assert.deepStrictEqual(validateData, expected);
        });

        it('should do nothing if neither alias or original properties are provided', () => {
            const validateData = {
                foo: 'bar'
            };
            const expected = {
                foo: 'bar'
            };
            assert.strictEqual(f5aliases(validateData), true);
            assert.deepStrictEqual(validateData, expected);
        });
    });

    describe('f5serviceDiscovery', () => {
        it('should succeed when serviceDiscoveryEnabled is true and service discovery is installed', () => {
            const that = {
                settings: {
                    serviceDiscoveryEnabled: true
                },
                context: {
                    host: {
                        sdInstalled: true
                    }
                }
            };
            const f5serviceDiscovery = keywords.find((keyword) => keyword.name === 'f5serviceDiscovery').definition(that).compile({});
            assert.strictEqual(f5serviceDiscovery('event', '/path/to/item'), true);
        });

        it('should throw when serviceDiscoveryEnabled is false', () => {
            const that = {
                settings: {
                    serviceDiscoveryEnabled: false
                }
            };
            const f5serviceDiscovery = keywords.find((keyword) => keyword.name === 'f5serviceDiscovery').definition(that).compile({});
            assert.throws(
                () => f5serviceDiscovery('aws', '/path/to/item'),
                (err) => (err.message === '/path/to/item requires Service Discovery to be enabled' && err.status === 422)
            );
        });

        it('should succeed when part of exceptions', () => {
            const schema = {
                exceptions: ['static', 'fqdn']
            };
            const f5serviceDiscovery = keywords.find((keyword) => keyword.name === 'f5serviceDiscovery').definition().compile(schema);
            assert.strictEqual(f5serviceDiscovery('static', '/path/to/item'), true);
        });

        it('should throw when service discovery is not installed and task is for localhost', () => {
            const that = {
                settings: {
                    serviceDiscoveryEnabled: true
                },
                context: {
                    host: {
                        sdInstalled: false
                    },
                    tasks: [{
                        resolvedHostIp: '127.0.0.1'
                    }],
                    currentIndex: 0
                }
            };
            const f5serviceDiscovery = keywords.find((keyword) => keyword.name === 'f5serviceDiscovery').definition(that).compile({});
            assert.throws(
                () => f5serviceDiscovery('aws', '/path/to/item'),
                (err) => (err.message === '/path/to/item requires Service Discovery to be installed. Service Discovery will be installed the next time AS3 starts up' && err.status === 422)
            );
        });

        it('should succeed when service discovery is not installed and task is for remote host', () => {
            const that = {
                settings: {
                    serviceDiscoveryEnabled: true
                },
                context: {
                    host: {
                        sdInstalled: false
                    },
                    tasks: [{
                        resolvedHostIp: '192.0.2.10'
                    }],
                    currentIndex: 0
                }
            };
            const f5serviceDiscovery = keywords.find((keyword) => keyword.name === 'f5serviceDiscovery').definition(that).compile({});
            assert.strictEqual(f5serviceDiscovery('event', '/path/to/item'), true);
        });
    });
});

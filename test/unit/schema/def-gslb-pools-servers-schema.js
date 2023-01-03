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

const assert = require('assert');
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const formats = require('../../../src/lib/adcParserFormats');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const validate = ajv
    .compile(adcSchema);

describe('def-gslb-pools-servers-schema.json', () => {
    describe('describe-on', () => {
        function buildDeclaration(resourceRecordType, members) {
            return {
                class: 'ADC',
                schemaVersion: '3.24.0',
                id: 'GSLB_Sample',
                theTenant: {
                    class: 'Tenant',
                    theApplication: {
                        class: 'Application',
                        testDomain: {
                            class: 'GSLB_Domain',
                            domainName: 'example.edu',
                            resourceRecordType,
                            pools: [
                                {
                                    ratio: 2,
                                    use: 'testPool'
                                }
                            ],
                            iRules: [
                                '/Tenant/App/rule1',
                                { use: '/Tenant/App/rule2' },
                                { bigip: '/Common/rule3' }
                            ]
                        },
                        testPool: {
                            class: 'GSLB_Pool',
                            resourceRecordType,
                            members
                        }
                    }
                }
            };
        }

        describe('valid', () => {
            it('should validate with depends-on set to none and resourceRecordType is A', () => {
                // Note: this validation should also happen with AAAA
                const members = [
                    {
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: 'none'
                    }
                ];
                const decl = buildDeclaration('A', members);
                assert.ok(validate(decl), getErrorString(validate));
            });

            it('should validate with depends-on set to an array', () => {
                // Note: this validation should also happen with A
                const members = [
                    {
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: [
                            '/Common/Shared/testServer:0'
                        ]
                    }
                ];
                const decl = buildDeclaration('AAAA', members);

                assert.ok(validate(decl), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should invalidate with depends-on set to an array but the string lacks /Common/Shared', () => {
                // Note: this validation should also happen with A
                const members = [
                    {
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: [
                            'testServer:0'
                        ]
                    }
                ];
                const decl = buildDeclaration('AAAA', members);

                assert.strictEqual(validate(decl), false, 'dependsOn must start with /Common/Shared');
                assert.notStrictEqual(
                    getErrorString(validate)
                        .indexOf('"message": "should match pattern \\"^/Common/Shared/.*:.*\\""'),
                    -1,
                    'The error be: "should match pattern "^/Common/Shared/.*:.*"'
                );
            });

            it('should invalidate if the depends-on is none and resourceRecordType is CNAME', () => {
                // Note: this failure should also happen with MX
                const members = [
                    {
                        domainName: 'example.edu',
                        dependsOn: 'none'
                    }
                ];
                const decl = buildDeclaration('CNAME', members);

                assert.strictEqual(validate(decl), false, 'CNAME members do not have the depends-on property and so should fail when it is set');
                assert.notStrictEqual(
                    getErrorString(validate)
                        .indexOf('"message": "should NOT have additional properties"'),
                    -1,
                    'CNAME should not accept the dependsOn property'
                );
            });

            it('should invalidate if the depends-on is set as an array and resourceRecordType is MX', () => {
                // Note: this failure should also happen with CNAME
                const members = [
                    {
                        domainName: {
                            use: '/Common/Shared/testDomain'
                        },
                        dependsOn: [
                            '/Common/Shared/testServer'
                        ]
                    }
                ];
                const decl = buildDeclaration('MX', members);

                assert.strictEqual(validate(decl), false, 'MX members do not have the depends-on property and so should fail when it is set');
                assert.notStrictEqual(
                    getErrorString(validate)
                        .indexOf('"message": "should NOT have additional properties"'),
                    -1,
                    'CNAME should not accept the dependsOn property'
                );
            });

            it('should invalidate if dependsOn is anything but none', () => {
                const members = [
                    {
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: 'foo:bar'
                    }
                ];
                const decl = buildDeclaration('A', members);

                assert.strictEqual(validate(decl), false, 'dependsOn only accepts none or an array');
                assert.notStrictEqual(
                    getErrorString(validate)
                        .indexOf('"message": "should be equal to constant"'),
                    -1,
                    'dependsOn should only allow "none" or an array'
                );
            });
        });
    });

    describe('serverType property', () => {
        function buildDeclaration(desiredServerType) {
            return {
                class: 'ADC',
                schemaVersion: '3.35.0',
                id: 'GSLB_Sample',
                testTenant: {
                    class: 'Tenant',
                    testApplication: {
                        class: 'Application',
                        testServer: {
                            class: 'GSLB_Server',
                            dataCenter: {
                                use: 'testDataCenter'
                            },
                            devices: [
                                {
                                    address: '1.2.3.4'
                                }
                            ],
                            serverType: desiredServerType,
                            virtualServers: [
                                {
                                    address: '1.2.3.5',
                                    port: 1000,
                                    enabled: true,
                                    addressTranslationPort: 0
                                }
                            ],
                            monitors: [{ bigip: '/Common/bigip' }]
                        }
                    }
                }
            };
        }

        // Dynamically assign serverType-specific properties to generated declaration.
        function assignProperty(decl, properties) {
            Object.keys(properties).forEach((propertyKey) => {
                decl.testTenant.testApplication.testServer[propertyKey] = properties[propertyKey];
            });
            return decl;
        }

        describe('valid', () => {
            it('should validate bigip as serverType', () => {
                const bigipProperties = {
                    serviceCheckProbeEnabled: true,
                    pathProbeEnabled: true,
                    snmpProbeEnabled: true
                };
                let decl = buildDeclaration('bigip');
                decl = assignProperty(decl, bigipProperties);
                assert.ok(validate(decl), getErrorString(validate));
            });

            it('should validate generic-host as serverType', () => {
                const genericProperties = {
                    cpuUsageLimit: 0,
                    cpuUsageLimitEnabled: false,
                    memoryLimit: 0,
                    memoryLimitEnabled: false
                };
                let decl = buildDeclaration('generic-host');
                decl = assignProperty(decl, genericProperties);
                assert.ok(validate(decl), getErrorString(validate));
            });
            it('should validate undefined as serverType', () => {
                const bigipProperties = {
                    serviceCheckProbeEnabled: true,
                    pathProbeEnabled: true,
                    snmpProbeEnabled: true
                };
                let decl = buildDeclaration(undefined);
                decl = assignProperty(decl, bigipProperties);
                assert.ok(validate(decl), getErrorString(validate));
            });
        });
        describe('invalid', () => {
            it('should invalidate number of generic host devices', () => {
                const devices = [
                    {
                        address: '1.2.3.3'
                    },
                    {
                        address: '1.2.3.4'
                    }
                ];
                const decl = buildDeclaration('generic-host');
                decl.testTenant.testApplication.testServer.devices = devices;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'Number of generic hosts is limited to 1'
                );
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

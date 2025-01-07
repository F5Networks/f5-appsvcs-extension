/**
 * Copyright 2025 F5, Inc.
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

describe('def-gslb-domain-schema.json', () => {
    describe('all properties', () => {
        function buildDeclaration(resourceRecordType, members) {
            return {
                class: 'ADC',
                schemaVersion: '3.41.0',
                id: 'GSLB_Sample',
                theTenant: {
                    class: 'Tenant',
                    theApplication: {
                        class: 'Application',
                        testDomain: {
                            class: 'GSLB_Domain',
                            domainName: 'example.edu',
                            resourceRecordType,
                            loadBalancingDecisionLogVerbosity: [
                                'pool-member-selection',
                                'pool-member-traversal',
                                'pool-selection',
                                'pool-traversal'
                            ],
                            pools: [
                                {
                                    ratio: 2,
                                    use: 'testPool'
                                }
                            ],
                            poolLbMode: 'ratio',
                            iRules: [
                                '/Tenant/App/rule1',
                                { use: '/Tenant/App/rule2' },
                                { bigip: '/Common/rule3' }
                            ],
                            persistenceEnabled: true,
                            persistCidrIpv4: 24,
                            persistCidrIpv6: 64,
                            ttlPersistence: 3601,
                            failureRcodeResponse: true,
                            failureRcode: 'refused',
                            failureRcodeTtl: 1000

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
            it('should validate all properties with A', () => {
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

            it('should validate all properties with AAAA', () => {
                const members = [
                    {
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: 'none'
                    }
                ];

                const decl = buildDeclaration('AAAA', members);
                assert.ok(validate(decl), getErrorString(validate));
            });

            it('should validate all properties with CNAME', () => {
                const members = [
                    {
                        domainName: 'example.edu',
                        enabled: false
                    }
                ];

                const decl = buildDeclaration('CNAME', members);
                assert.ok(validate(decl), getErrorString(validate));
            });

            it('should validate all properties with MX', () => {
                const members = [
                    {
                        domainName: {
                            use: '/Common/Shared/testDomain'
                        },
                        enabled: true
                    }
                ];

                const decl = buildDeclaration('MX', members);
                assert.ok(validate(decl), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should invalidate persistCidrIpv4', () => {
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
                decl.theTenant.theApplication.testDomain.persistCidrIpv4 = 128;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'persistCidrIpv4 should be <= 32'
                );
            });

            it('should invalidate persistCidrIpv4 with string', () => {
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
                decl.theTenant.theApplication.testDomain.persistCidrIpv4 = '32';
                assert.strictEqual(
                    validate(decl),
                    false,
                    'persistCidrIpv4 should be integer'
                );
            });

            it('should invalidate persistCidrIpv4 with minimum value', () => {
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
                decl.theTenant.theApplication.testDomain.persistCidrIpv4 = -1;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'persistCidrIpv4 should be >= 0'
                );
            });

            it('should invalidate PersistCidrIpv6', () => {
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
                decl.theTenant.theApplication.testDomain.persistCidrIpv6 = 1024;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'persistCidrIpv6 should be <= 128'
                );
            });

            it('should invalidate persistCidrIpv6 with string', () => {
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
                decl.theTenant.theApplication.testDomain.persistCidrIpv6 = '64';
                assert.strictEqual(
                    validate(decl),
                    false,
                    'persistCidrIpv6 should be integer'
                );
            });

            it('should invalidate persistCidrIpv6 with minimum value', () => {
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
                decl.theTenant.theApplication.testDomain.persistCidrIpv6 = -1;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'persistCidrIpv6 should be >= 0'
                );
            });

            it('should invalidate ttlPersistence', () => {
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
                decl.theTenant.theApplication.testDomain.ttlPersistence = 4294967296;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'ttlPersistence should be <= 4294967295'
                );
            });

            it('should invalidate ttlPersistence with string', () => {
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
                decl.theTenant.theApplication.testDomain.ttlPersistence = '64';
                assert.strictEqual(
                    validate(decl),
                    false,
                    'ttlPersistence should be integer'
                );
            });

            it('should invalidate ttlPersistence with minimum value', () => {
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
                decl.theTenant.theApplication.testDomain.ttlPersistence = -1;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'ttlPersistence should be >= 0'
                );
            });

            it('should invalidate failureRcode with integer value', () => {
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
                decl.theTenant.theApplication.testDomain.failureRcode = 1;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'failureRcode should be string'
                );
            });

            it('should invalidate failureRcodeResponse with integer value', () => {
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
                decl.theTenant.theApplication.testDomain.failureRcodeResponse = 1;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'failureRcodeResponse should be boolean'
                );
            });

            it('should invalidate failureRcodeTtl with negative value', () => {
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
                decl.theTenant.theApplication.testDomain.failureRcodeTtl = -1;
                assert.strictEqual(
                    validate(decl),
                    false,
                    'failureRcodeTtl should be => 0'
                );
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

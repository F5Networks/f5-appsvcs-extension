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

const assert = require('assert');
const Ajv = require('ajv');
const simpleCopy = require('../../../src/lib/util/util').simpleCopy;

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

describe('def-afm-schema.json', () => {
    describe('Protocol_Inspection_Profile', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    pip: {
                        class: 'Protocol_Inspection_Profile'
                    }
                }
            }
        };
        describe('invalid', () => {
            const invalidTestCases = [
                {
                    name: 'invalidate Protocol_Inspection_Profile with additional properties',
                    properties: {
                        madeUpProperty: true
                    },
                    assertMessage: 'additional properties are not allowed'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid collectAVRStats',
                    properties: {
                        collectAVRStats: 'sure, please'
                    },
                    assertMessage: 'collect AVR stats should be a boolean'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid enableComplianceChecks',
                    properties: {
                        enableComplianceChecks: 'no, thanks'
                    },
                    assertMessage: 'enable compliance checks should be a boolean'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid enableSignatureChecks',
                    properties: {
                        enableSignatureChecks: 'no, thanks'
                    },
                    assertMessage: 'enable signature checks should be a boolean'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid autoAddNewInspections',
                    properties: {
                        autoAddNewInspections: 'yeah!'
                    },
                    assertMessage: 'auto add new inspections should be a boolean'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid autoPublish',
                    properties: {
                        autoPublish: 'whatever'
                    },
                    assertMessage: 'auto publish should be a boolean'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid defaultFromProfile',
                    properties: {
                        defaultFromProfile: {}
                    },
                    assertMessage: 'default from profile should be a string'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid services as boolean',
                    properties: {
                        services: true
                    },
                    assertMessage: 'services should be an array'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid services as array',
                    properties: {
                        services: {
                            type: ['dns', 'mysql']
                        }
                    },
                    assertMessage: 'services type should be a string'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with service type not in enum',
                    properties: {
                        services: {
                            type: 'websockets'
                        }
                    },
                    assertMessage: 'services type should be in enum'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with no service check property',
                    properties: {
                        services: [{
                            type: 'dns',
                            compliance: [{
                                myCheck: 'check this out'
                            }]
                        }]
                    },
                    assertMessage: 'compliance check should have valid check sub-property'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid service action property',
                    properties: {
                        services: [{
                            type: 'dns',
                            compliance: [{
                                check: 'tictactoe',
                                action: 'drop on floor'
                            }]
                        }]
                    },
                    assertMessage: 'compliance check action should be in enum'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid service log property',
                    properties: {
                        services: [{
                            type: 'dns',
                            compliance: [{
                                check: 'tictactoe',
                                log: 'to splunk'
                            }]
                        }]
                    },
                    assertMessage: 'compliance check log should be boolean'
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with invalid signature property',
                    properties: {
                        service: [{
                            type: 'dns',
                            signature: [{
                                check: 'dns_dns_query_amplification_attempt',
                                value: 'test input'
                            }]
                        }]
                    }
                },
                {
                    name: 'invalidate Protocol_Inspection_Profile with non-string compliance value',
                    properties: {
                        service: [{
                            type: 'dns',
                            compliance: [{
                                check: 'dns_maximum_reply_length',
                                value: 1000
                            }]
                        }]
                    }
                }
            ];
            invalidTestCases.forEach((testCase) => {
                it(`should ${testCase.name}`, () => {
                    const testData = simpleCopy(baseDecl);
                    Object.keys(testCase.properties).forEach((propertyKey) => {
                        testData.theTenant.A1.pip[propertyKey] = testCase.properties[propertyKey];
                    });
                    assert.strictEqual(validate(testData), false, testCase.assertMessage);
                });
            });
        });

        describe('valid', () => {
            it('should validate with minimal properties', () => {
                assert.ok(validate(baseDecl), getErrorString(validate));
            });

            it('should validate with ALL properties', () => {
                const testData = simpleCopy(baseDecl);
                testData.theTenant.A1.pip = {
                    class: 'Protocol_Inspection_Profile',
                    remark: 'The description',
                    collectAVRStats: true,
                    enableComplianceChecks: true,
                    enableSignatureChecks: true,
                    defaultFromProfile: 'parentProfile',
                    autoAddNewInspections: true,
                    autoPublish: true,
                    services: [
                        {
                            type: 'dns',
                            compliance: [
                                {
                                    check: 'dns_maximum_reply_length',
                                    action: 'accept',
                                    log: false,
                                    value: '1000'
                                },
                                {
                                    check: 'dns_disallowed_query_type',
                                    action: 'accept',
                                    log: true,
                                    value: 'IQUERY'
                                }
                            ],
                            signature: [
                                {
                                    check: 'dns_dns_query_amplification_attempt',
                                    action: 'reject',
                                    log: true
                                }
                            ]
                        },
                        {
                            type: 'mysql',
                            compliance: [
                                {
                                    check: 'mysql_malformed_packet',
                                    action: 'accept',
                                    log: true
                                }
                            ]
                        },
                        {
                            type: 'dhcp',
                            signature: [
                                {
                                    check: 'dhcp_os_other_malicious_dhcp_server_bash_environment_variable_injection_attempt',
                                    action: 'accept',
                                    log: true
                                }
                            ]
                        }
                    ]
                };
                assert.ok(validate(testData), getErrorString(validate));
            });

            describe('service checks', () => {
                const serviceCheckTestCases = [
                    {
                        name: 'validate with minimal service property',
                        services: [{
                            type: 'dns'
                        }]
                    },
                    {
                        name: 'validate with minimal service compliance check property',
                        services: [{
                            type: 'dns',
                            compliance: [{
                                check: 'my_check'
                            }]
                        }]
                    },
                    {
                        name: 'validate with minimal service signature check property',
                        services: [{
                            type: 'dns',
                            signature: [{
                                check: 'my siggy'
                            }]
                        }]
                    },
                    {
                        name: 'validate with complete service signature check property',
                        services: [{
                            type: 'dns',
                            signature: [{
                                check: 'my siggy',
                                action: 'reject',
                                log: true
                            }]
                        }]
                    },
                    {
                        name: 'validate with complete protocol inspection profile',
                        services: [{
                            type: 'dns',
                            compliance: [{
                                check: 'my_check',
                                action: 'reject',
                                log: true,
                                value: '123'
                            }],
                            signature: [{
                                check: 'my siggy',
                                action: 'reject',
                                log: true
                            }]
                        }]
                    }
                ];

                serviceCheckTestCases.forEach((testCase) => {
                    it(`should ${testCase.name}`, () => {
                        const testData = simpleCopy(baseDecl);
                        testData.theTenant.A1.pip.services = testCase.services;
                        assert.ok(validate(testData), getErrorString(validate));
                    });
                });
            });
        });
    });

    describe('NAT_Source_Translation', () => {
        const baseDeclaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    natSourceTranslation: {
                        class: 'NAT_Source_Translation',
                        addresses: [
                            '192.0.2.236'
                        ],
                        type: 'dynamic-pat'
                    }
                }
            }
        };
        describe('invalid', () => {
            const invalidTestCases = [
                {
                    name: 'invalidate NAT_Source_Translation with invalid excludeAddresses as string',
                    properties: {
                        excludeAddresses: ''
                    },
                    assertMessage: 'excludeAddresses should be an array'
                },
                {
                    name: 'invalidate NAT_Source_Translation with invalid excludeAddresses as boolean',
                    properties: {
                        excludeAddresses: false
                    },
                    assertMessage: 'excludeAddresses should be an array'
                },
                {
                    name: 'invalidate NAT_Source_Translation with invalid excludeAddresses as integer',
                    properties: {
                        excludeAddresses: 123
                    },
                    assertMessage: 'excludeAddresses should be an array'
                },
                {
                    name: 'invalidate NAT_Source_Translation with invalid excludeAddresses as object',
                    properties: {
                        excludeAddresses: {}
                    },
                    assertMessage: 'excludeAddresses should be an array'
                },
                {
                    name: 'invalidate NAT_Source_Translation with invalid excludeAddresses with invalid integer in an array',
                    properties: {
                        excludeAddresses: [1]
                    },
                    assertMessage: 'excludeAddresses type should be an array with string or object'
                },
                {
                    name: 'invalidate NAT_Source_Translation with invalid excludeAddresses with invalid boolean in an array',
                    properties: {
                        excludeAddresses: [false]
                    },
                    assertMessage: 'excludeAddresses type should be an array with string or object'
                }
            ];
            invalidTestCases.forEach((testCase) => {
                it(`should ${testCase.name}`, () => {
                    const testData = simpleCopy(baseDeclaration);
                    Object.keys(testCase.properties).forEach((propertyKey) => {
                        testData.theTenant.A1.natSourceTranslation[propertyKey] = testCase.properties[propertyKey];
                    });
                    assert.strictEqual(validate(testData), false, testCase.assertMessage);
                });
            });
        });

        describe('valid', () => {
            it('validate NAT_Source_Translation with valid excludeAddresses as an empty array', () => {
                const testData = simpleCopy(baseDeclaration);
                testData.theTenant.A1.natSourceTranslation.excludeAddresses = [];
                assert.ok(validate(testData), getErrorString(validate));
            });

            it('validate NAT_Source_Translation with valid excludeAddresses as an array with valid string value', () => {
                const testData = simpleCopy(baseDeclaration);
                testData.theTenant.A1.natSourceTranslation.excludeAddresses = ['192.0.2.4'];
                assert.ok(validate(testData), getErrorString(validate));
            });

            it('validate NAT_Source_Translation with valid excludeAddresses as an array with valid object', () => {
                const testData = simpleCopy(baseDeclaration);
                testData.theTenant.A1.natSourceTranslation.excludeAddresses = [{ use: 'fwAllowedAddressList' }];
                assert.ok(validate(testData), getErrorString(validate));
            });
        });
    });

    describe('Firewall_Address_List', () => {
        const baseDeclaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    firewallAddressList: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '192.0.2.0/24'
                        ]
                    }
                }
            }
        };

        describe('valid', () => {
            it('should validate the minimum for firewallAddressList', () => {
                const testData = simpleCopy(baseDeclaration);
                assert.ok(validate(testData), getErrorString(validate));
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

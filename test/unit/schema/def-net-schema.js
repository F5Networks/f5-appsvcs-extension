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

describe('def-net-schema.json', () => {
    describe('Idle_Timeout_Policy', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    itp: {
                        class: 'Idle_Timeout_Policy'
                    }
                }
            }
        };

        describe('valid', () => {
            it('should validate with minimal properties', () => {
                assert.ok(validate(baseDecl), getErrorString(validate));
            });

            it('should validate with ALL properties', () => {
                const testData = simpleCopy(baseDecl);
                testData.theTenant.A1.itp = {
                    class: 'Idle_Timeout_Policy',
                    remark: 'The description',
                    rules: [
                        {
                            name: 'myTCP',
                            remark: 'TCP rule',
                            protocol: 'tcp',
                            destinationPorts: [
                                80,
                                443
                            ],
                            idleTimeout: 'unspecified'
                        },
                        {
                            name: 'allOther',
                            remark: 'allOther rule',
                            protocol: 'all-other',
                            destinationPorts: [
                                '50000-50020',
                                50030
                            ],
                            idleTimeout: 10
                        }
                    ]
                };
                assert.ok(validate(testData), getErrorString(validate));
            });

            it('should validate tmsh help page example', () => {
                const testData = simpleCopy(baseDecl);
                testData.theTenant.A1.itp = {
                    class: 'Idle_Timeout_Policy',
                    rules: [
                        {
                            name: 'r1',
                            protocol: 'tcp',
                            destinationPorts: [
                                'all-other'
                            ],
                            idleTimeout: 120

                        },
                        {
                            name: 'r2',
                            protocol: 'udp',
                            destinationPorts: [
                                9090
                            ],
                            idleTimeout: 300
                        },
                        {
                            name: 'r3',
                            protocol: 'all-other',
                            destinationPorts: [
                                'all-other'
                            ],
                            idleTimeout: 40
                        },
                        {
                            name: 'r4',
                            protocol: 'udp',
                            destinationPorts: [
                                'all-other'
                            ],
                            idleTimeout: 60
                        }
                    ]
                };
                assert.ok(validate(testData), getErrorString(validate));
            });

            describe('rules checks', () => {
                const rulesCheckTestCases = [
                    {
                        name: 'validate empty rules',
                        rules: [],
                        assertMessage: 'rules can be empty'
                    },
                    {
                        name: 'validate rule with only a name',
                        rules: [
                            {
                                name: 'validation'
                            }
                        ],
                        assertMessage: 'rule can have just a name'
                    },
                    {
                        name: 'validate rule with uppercase',
                        rules: [
                            {
                                name: 'VALIDATION'
                            }
                        ],
                        assertMessage: 'rule name can be uppercase'
                    },
                    {
                        name: 'validate rule name beginning with underscore',
                        rules: [
                            {
                                name: '_rule'
                            }
                        ],
                        assertMessage: 'rule name can start with underscore'
                    },
                    {
                        name: 'validate rule name with non-leading digits',
                        rules: [
                            {
                                name: 'rule3rule4'
                            }
                        ],
                        assertMessage: 'rule name can have non-leading digits'
                    },
                    {
                        name: 'validate rule name with non-leading dashes',
                        rules: [
                            {
                                name: 'rule-3-'
                            }
                        ],
                        assertMessage: 'rule name can have non-leading dashes'
                    },
                    {
                        name: 'validate rule name with non-leading underscores',
                        rules: [
                            {
                                name: 'rule_3_'
                            }
                        ],
                        assertMessage: 'rule name can have non-leading underscores'
                    }
                ];

                rulesCheckTestCases.forEach((testCase) => {
                    it(`should ${testCase.name}`, () => {
                        const testData = simpleCopy(baseDecl);
                        testData.theTenant.A1.itp.rules = testCase.rules;
                        assert.ok(validate(testData), getErrorString(validate));
                    });
                });
            });
        });

        describe('invalid', () => {
            const invalidTestCases = [
                {
                    name: 'invalidate missing rule name',
                    properties: {
                        rules: [
                            {
                                protocol: 'tcp',
                                destinationPorts: [80],
                                idleTimeout: 5
                            }
                        ]
                    },
                    assertMessage: 'rule name is required'
                },
                {
                    name: 'invalidate Idle_Timeout_Policy with additional properties',
                    properties: {
                        rules: [
                            {
                                madeUpProperty: true
                            }
                        ]
                    },
                    assertMessage: 'additional properties are not allowed'
                },
                {
                    name: 'invalidate Idle_Timeout_Policy with additional rule properties',
                    properties: {
                        rules: [
                            {
                                name: 'rule',
                                madeUpProperty: true
                            }
                        ]
                    },
                    assertMessage: 'additional rule properties are not allowed'
                },
                {
                    name: 'invalidate Idle_Timeout_Policy with invalid idleTimeout enum',
                    properties: {
                        rules: [
                            {
                                name: 'rule',
                                idleTimeout: 'now'
                            }
                        ]
                    },
                    assertMessage: 'idleTimeout should match enum'
                },
                {
                    name: 'invalidate rule name beginning with number',
                    properties: {
                        rules: [
                            {
                                name: '1rule'
                            }
                        ]
                    },
                    assertMessage: 'rule name cannot start with number'
                },
                {
                    name: 'invalidate rule name beginning with dash',
                    properties: {
                        rules: [
                            {
                                name: '-rule'
                            }
                        ]
                    },
                    assertMessage: 'rule name cannot start with dash'
                }

            ];
            invalidTestCases.forEach((testCase) => {
                it(`should ${testCase.name}`, () => {
                    const testData = simpleCopy(baseDecl);
                    Object.keys(testCase.properties).forEach((propertyKey) => {
                        testData.theTenant.A1.itp[propertyKey] = testCase.properties[propertyKey];
                    });
                    assert.strictEqual(validate(testData), false, testCase.assertMessage);
                });
            });
        });
    });

    describe('Net_Address_List', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    nal: {
                        class: 'Net_Address_List',
                        addresses: [
                            '192.0.2.0/24'
                        ]
                    }
                }
            }
        };

        describe('valid', () => {
            it('should validate with minimal properties', () => {
                assert.ok(validate(baseDecl), getErrorString(validate));
            });

            it('should validate with ALL properties', () => {
                const testData = simpleCopy(baseDecl);
                testData.theTenant.A1.nal.remark = 'The description';
                assert.ok(validate(testData), getErrorString(validate));
            });

            it('should validate with addressLists', () => {
                const testData = simpleCopy(baseDecl);
                testData.Common = {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        sharedNal: {
                            class: 'Net_Address_List',
                            addresses: [
                                '233.252.0.0/24'
                            ]
                        }
                    }
                };
                testData.theTenant.A1.nal.addressLists = [{ use: '/Common/Shared/sharedNal' }];
                assert.ok(validate(testData), getErrorString(validate));
            });
        });
    });

    describe('Net_Port_List', () => {
        let baseDecl;
        beforeEach(() => {
            baseDecl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        template: 'generic',
                        npl: {
                            class: 'Net_Port_List',
                            ports: [
                                80,
                                443,
                                '8080-8088'
                            ]
                        }
                    }
                }
            };
        });

        describe('valid', () => {
            it('should validate with just ports', () => {
                assert.ok(validate(baseDecl), getErrorString(validate));
            });

            it('should validate with just port-lists', () => {
                delete baseDecl.theTenant.A1.npl.ports;
                baseDecl.theTenant.A1.npl.portLists = [
                    { use: '/Common/myPortList' }
                ];
                assert.ok(validate(baseDecl), getErrorString(validate));
            });

            it('should validate with ALL properties', () => {
                baseDecl.theTenant.A1.npl.remark = 'The description';
                baseDecl.theTenant.A1.npl.portLists = [
                    { use: '/Common/myPortList' }
                ];
                assert.ok(validate(baseDecl), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should invalidate with neither ports nor port-lists', () => {
                delete baseDecl.theTenant.A1.npl.ports;
                assert.strictEqual(validate(baseDecl), false, 'must have at least one of ports or port-lists');
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

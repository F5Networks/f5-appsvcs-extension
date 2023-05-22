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

describe('def-log-schema.json', () => {
    describe('ALG_Log_Profile', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    alp: {
                        class: 'ALG_Log_Profile'
                    }
                }
            }
        };

        describe('valid', () => {
            it('should accept minimal properties and fully populate default values', () => {
                const testData = simpleCopy(baseDecl);
                assert.ok(validate(testData), getErrorString(validate));
                assert.deepStrictEqual(testData, {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            template: 'generic',
                            alp: {
                                class: 'ALG_Log_Profile',
                                csvFormat: false,
                                startControlChannel: {
                                    action: 'disabled',
                                    includeDestination: false
                                },
                                endControlChannel: {
                                    action: 'enabled',
                                    includeDestination: false
                                },
                                startDataChannel: {
                                    action: 'disabled',
                                    includeDestination: false
                                },
                                endDataChannel: {
                                    action: 'enabled',
                                    includeDestination: false
                                },
                                inboundTransaction: {
                                    action: 'disabled'
                                }
                            },
                            enable: true
                        },
                        enable: true,
                        defaultRouteDomain: 0,
                        optimisticLockKey: ''
                    },
                    updateMode: 'selective'
                });
            });

            it('should fully populate default values in empty objects', () => {
                const testData = simpleCopy(baseDecl);
                testData.theTenant.A1.alp = {
                    class: 'ALG_Log_Profile',
                    startControlChannel: {},
                    endControlChannel: {},
                    startDataChannel: {},
                    endDataChannel: {},
                    inboundTransaction: {}
                };
                assert.ok(validate(testData), getErrorString(validate));
                assert.deepStrictEqual(testData, {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            template: 'generic',
                            alp: {
                                class: 'ALG_Log_Profile',
                                csvFormat: false,
                                startControlChannel: {
                                    action: 'disabled',
                                    includeDestination: false
                                },
                                endControlChannel: {
                                    action: 'enabled',
                                    includeDestination: false
                                },
                                startDataChannel: {
                                    action: 'disabled',
                                    includeDestination: false
                                },
                                endDataChannel: {
                                    action: 'enabled',
                                    includeDestination: false
                                },
                                inboundTransaction: {
                                    action: 'disabled'
                                }
                            },
                            enable: true
                        },
                        enable: true,
                        defaultRouteDomain: 0,
                        optimisticLockKey: ''
                    },
                    updateMode: 'selective'
                });
            });

            it('should accept fully populated properties', () => {
                const testData = simpleCopy(baseDecl);
                testData.theTenant.A1.alp = {
                    class: 'ALG_Log_Profile',
                    label: 'My Label',
                    remark: 'My Remark',
                    csvFormat: true,
                    startControlChannel: {
                        action: 'enabled',
                        includeDestination: false
                    },
                    endControlChannel: {
                        action: 'disabled',
                        includeDestination: true
                    },
                    startDataChannel: {
                        action: 'enabled',
                        includeDestination: false
                    },
                    endDataChannel: {
                        action: 'backup-allocation-only',
                        includeDestination: true
                    },
                    inboundTransaction: {
                        action: 'disabled'
                    }
                };
                assert.ok(validate(testData), getErrorString(validate));
            });
        });
    });

    describe('Security_Log_Profile', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    slp: {
                        class: 'Security_Log_Profile'
                    }
                }
            }
        };

        describe('.protocolInspection', () => {
            describe('valid', () => {
                it('should accept minimal properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.slp.protocolInspection = {};
                    assert.ok(validate(testData), getErrorString(validate));
                });

                it('should accept full properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.slp.protocolInspection = {
                        publisher: { use: 'logPub' },
                        logPacketPayloadEnabled: true
                    };
                    assert.ok(validate(testData), getErrorString(validate));
                });
            });

            describe('invalid', () => {
                it('should not accept invalid properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.slp.protocolInspection = {
                        badProp: 'test'
                    };
                    assert.strictEqual(validate(testData), false);
                });
            });
        });

        describe('.nat', () => {
            describe('valid', () => {
                it('should accept full properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.slp.nat = {
                        publisher: {
                            bigip: '/Common/default-ipsec-log-publisher'
                        },
                        logErrors: true,
                        logSubscriberId: true,
                        logQuotaExceeded: true,
                        logStartInboundSession: true,
                        logEndInboundSession: true,
                        logStartOutboundSession: true,
                        logStartOutboundSessionDestination: true,
                        logEndOutboundSession: true,
                        logEndOutboundSessionDestination: true,
                        lsnLegacyMode: false,
                        rateLimitAggregate: 100,
                        rateLimitErrors: 10,
                        rateLimitQuotaExceeded: 20,
                        rateLimitStartInboundSession: 30,
                        rateLimitEndInboundSession: 40,
                        rateLimitStartOutboundSession: 50,
                        rateLimitEndOutboundSession: 60,
                        formatErrors: {
                            fields: [
                                'context-name',
                                'event-name',
                                'dest-ip'
                            ],
                            delimiter: '.'
                        }
                    };
                    assert.ok(validate(testData), getErrorString(validate));
                });
            });

            describe('invalid', () => {
                it('should disallow setting logStartOutboundSessionDestination without logStartOutboundSession', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.slp.nat = {
                        publisher: {
                            bigip: '/Common/default-ipsec-log-publisher'
                        },
                        logStartOutboundSession: false,
                        logStartOutboundSessionDestination: true
                    };
                    assert.strictEqual(validate(testData), false);
                });

                it('should disallow setting logEndOutboundSessionDestination without logEndOutboundSession', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.slp.nat = {
                        publisher: {
                            bigip: '/Common/default-ipsec-log-publisher'
                        },
                        logEndOutboundSession: false,
                        logEndOutboundSessionDestination: true
                    };
                    assert.strictEqual(validate(testData), false);
                });
            });
        });
    });

    describe('Log_Destination', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'generic',
                    logDest: {
                        class: 'Log_Destination'
                    }
                }
            }
        };

        describe('type: management-port', () => {
            baseDecl.theTenant.A1.logDest.type = 'management-port';

            describe('valid', () => {
                it('should accept minimal properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.logDest.address = '192.0.2.4';
                    testData.theTenant.A1.logDest.port = 80;
                    assert.ok(validate(testData), getErrorString(validate));
                });

                it('should accept all properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.logDest.address = '192.0.2.4';
                    testData.theTenant.A1.logDest.port = 80;
                    testData.theTenant.A1.logDest.protocol = 'tcp';
                    assert.ok(validate(testData), getErrorString(validate));
                });
            });

            describe('invalid', () => {
                it('should require an address', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.logDest.port = 80;
                    assert.strictEqual(validate(testData), false);
                });

                it('should require a port', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.logDest.address = '192.0.2.4';
                    assert.strictEqual(validate(testData), false);
                });
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

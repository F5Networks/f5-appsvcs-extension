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

let data;

describe('def-ltm-policy-schema.json', () => {
    beforeEach(() => {
        data = {
            class: 'ADC',
            schemaVersion: '3.17.0',
            id: 'negativeConditionStrings',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    template: 'generic',
                    test1: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: '-_.:%foobar',
                                actions: [
                                    {
                                        type: 'httpRedirect',
                                        location: 'http://localhost',
                                        code: 300
                                    }
                                ],
                                conditions: [
                                    {
                                        type: 'httpUri',
                                        host: {
                                            operand: 'equals',
                                            values: [
                                                'site.com'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'httpUri',
                                        port: {
                                            operand: 'equals',
                                            values: [
                                                80
                                            ]
                                        }
                                    },
                                    {
                                        type: 'tcp',
                                        address: {
                                            operand: 'matches',
                                            values: [
                                                '1.2.3.4'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'httpUri',
                                        host: {
                                            operand: 'equals',
                                            datagroup: {
                                                bigip: '/Common/myDatagroup'
                                            }
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        continent: {
                                            operand: 'matches',
                                            values: [
                                                'AF'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        countryCode: {
                                            operand: 'matches',
                                            values: [
                                                'AT'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        countryName: {
                                            operand: 'matches',
                                            values: [
                                                'Germany'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        isp: {
                                            operand: 'matches',
                                            values: [
                                                'AT&T'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        org: {
                                            operand: 'matches',
                                            values: [
                                                'myOrg'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        regionCode: {
                                            operand: 'matches',
                                            values: [
                                                'OR'
                                            ]
                                        }
                                    },
                                    {
                                        type: 'geoip',
                                        regionName: {
                                            operand: 'matches',
                                            values: [
                                                'Ohio'
                                            ]
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };
    });

    describe('Policy_Compare_String', () => {
        describe('invalid', () => {
            it('invalid operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'lots';
                assert.strictEqual(validate(data), false);
            });

            it('number operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'greater-or-equal';
                assert.strictEqual(validate(data), false);
            });

            it('values and datagroup', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.datagroup = { bigip: '/Common/myDatagroup' };
                assert.strictEqual(validate(data), false);
            });
        });

        describe('valid', () => {
            it('operand: equals', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'equals';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-equal', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'does-not-equal';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: starts-with', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'starts-with';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-start-with', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'does-not-start-with';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: ends-with', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'ends-with';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-end-with', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'does-not-end-with';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: contains', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'contains';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-contain', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host.operand = 'does-not-contain';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: exists', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host = { operand: 'exists' };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-exist', () => {
                data.Tenant.Application.test1.rules[0].conditions[0].host = { operand: 'does-not-exist' };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Policy_Compare_Number', () => {
        describe('invalid', () => {
            it('invalid operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'plus-plus';
                assert.strictEqual(validate(data), false);
            });

            it('string operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'starts-with';
                assert.strictEqual(validate(data), false);
            });
        });

        describe('valid', () => {
            it('operand: equals', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'equals';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-equal', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'does-not-equal';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: less', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'less';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: greater', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'greater';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: less-or-equal', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'less-or-equal';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: greater-or-equal', () => {
                data.Tenant.Application.test1.rules[0].conditions[1].port.operand = 'greater-or-equal';
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Policy_Match_String', () => {
        describe('invalid', () => {
            it('invalid operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[2].address.operand = 'test';
                assert.strictEqual(validate(data), false);
            });

            it('number operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[2].address.operand = 'greater-or-equal';
                assert.strictEqual(validate(data), false);
            });

            it('string operand', () => {
                data.Tenant.Application.test1.rules[0].conditions[2].address.operand = 'contains';
                assert.strictEqual(validate(data), false);
            });

            it('values and datagroup', () => {
                data.Tenant.Application.test1.rules[0].conditions[2].address.datagroup = { bigip: '/Common/myDatagroup' };
                assert.strictEqual(validate(data), false);
            });
        });

        describe('valid', () => {
            it('operand: matches', () => {
                data.Tenant.Application.test1.rules[0].conditions[2].address.operand = 'matches';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-match', () => {
                data.Tenant.Application.test1.rules[0].conditions[2].address.operand = 'does-not-match';
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: matches datagroup', () => {
                data.Tenant.Application.test1.rules[0].conditions.push({
                    type: 'tcp',
                    address: {
                        operand: 'matches',
                        datagroup: {
                            bigip: '/Common/private-net'
                        }
                    }
                });
                assert.ok(validate(data), getErrorString(validate));
            });

            it('operand: does-not-match datagroup', () => {
                data.Tenant.Application.test1.rules[0].conditions.push({
                    type: 'tcp',
                    address: {
                        operand: 'does-not-match',
                        datagroup: {
                            bigip: '/Common/aol'
                        }
                    }
                });
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Policy_Action', () => {
        describe('Policy_Action_TCL', () => {
            beforeEach(() => {
                data.Tenant.Application.test1.rules[0].actions.push(
                    {
                        type: 'tcl',
                        setVariable: {
                            expression: 'exampleExpression',
                            name: 'variableName'
                        }
                    }
                );
            });

            describe('valid', () => {
                it('should validate with required properties', () => assert.ok(validate(data), getErrorString(validate)));

                it('should validate updating event to a valid event type', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].event = 'ssl-client-hello';
                    assert.ok(validate(data), getErrorString(validate));
                });
            });

            describe('invalid', () => {
                it('should invalidate invalid event type', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].event = 'ws-request';
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate when missing name', () => {
                    delete data.Tenant.Application.test1.rules[0].actions[1].setVariable.name;
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate when missing expression', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].setVariable.name = 'variableName';
                    delete data.Tenant.Application.test1.rules[0].actions[1].setVariable.expression;
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate when missing setVariable', () => {
                    delete data.Tenant.Application.test1.rules[0].actions[1].setVariable;
                    assert.strictEqual(validate(data), false);
                });
            });
        });

        describe('Policy_Action_Log', () => {
            beforeEach(() => {
                data.Tenant.Application.test1.rules[0].actions.push(
                    {
                        type: 'log',
                        write: {
                            message: 'The message'
                        }
                    }
                );
            });

            describe('valid', () => {
                it('should validate with required properties', () => assert.ok(validate(data), getErrorString(validate)));

                it('should validate updating event to a valid event type', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].event = 'proxy-request';
                    assert.ok(validate(data), getErrorString(validate));
                });

                it('should validate when all properties are specified', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].event = 'proxy-request';
                    data.Tenant.Application.test1.rules[0].actions[1].write.facility = 'local1';
                    data.Tenant.Application.test1.rules[0].actions[1].write.priority = 'debug';
                    data.Tenant.Application.test1.rules[0].actions[1].write.ipAddress = '1.2.3.4';
                    data.Tenant.Application.test1.rules[0].actions[1].write.port = 123;
                    assert.ok(validate(data), getErrorString(validate));
                });
            });

            describe('invalid', () => {
                it('should invalidate invalid event type', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].event = 'invalid-event';
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate invalid facility', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].write.facility = 'invalidFacility';
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate invalid priority', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].write.priority = 'invalidPriority';
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate invalid ipAddress', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].write.priority = 'notAnIpAddress';
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate when port is too large', () => {
                    data.Tenant.Application.test1.rules[0].actions[1].write.port = 123456;
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate when missing write', () => {
                    delete data.Tenant.Application.test1.rules[0].actions[1].write;
                    assert.strictEqual(validate(data), false);
                });

                it('should invalidate when missing write.message', () => {
                    delete data.Tenant.Application.test1.rules[0].actions[1].write.message;
                    assert.strictEqual(validate(data), false);
                });
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

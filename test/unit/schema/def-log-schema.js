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
                    testData.theTenant.A1.logDest.address = '1.2.3.4';
                    testData.theTenant.A1.logDest.port = 80;
                    assert.ok(validate(testData), getErrorString(validate));
                });

                it('should accept all properties', () => {
                    const testData = simpleCopy(baseDecl);
                    testData.theTenant.A1.logDest.address = '1.2.3.4';
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
                    testData.theTenant.A1.logDest.address = '1.2.3.4';
                    assert.strictEqual(validate(testData), false);
                });
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

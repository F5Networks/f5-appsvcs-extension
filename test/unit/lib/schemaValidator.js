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

const sinon = require('sinon');
const AJV = require('ajv');
const assert = require('assert');
const SchemaValidator = require('../../../src/lib/schemaValidator');
const util = require('../../../src/lib/util/util');
const log = require('../../../src/lib/log');
const DEVICE_TYPES = require('../../../src/lib/constants').DEVICE_TYPES;
const SCHEMA_ID = require('../../../src/lib/constants').SCHEMA_ID;

describe('schemaValidator', () => {
    const as3SchemaPath = 'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/as3-request-schema.json';
    const adcSchemaPath = 'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/adc-schema.json';
    const appSchemaPath = 'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/app-schema.json';
    let loadJSONStub;

    beforeEach(() => {
        sinon.stub(log, 'error');
        loadJSONStub = sinon.stub(util, 'loadJSON').callsFake((schemaPath) => {
            const f5PostProcess = {
                tag: 'testTag',
                data: ['test data']
            };
            switch (schemaPath) {
            case as3SchemaPath:
                return Promise.resolve({ $id: SCHEMA_ID.AS3, type: 'object', f5PostProcess });
            case adcSchemaPath:
                return Promise.resolve({ $id: SCHEMA_ID.ADC, type: 'object', f5PostProcess });
            case appSchemaPath:
                return Promise.resolve({ $id: SCHEMA_ID.APP, type: 'object', f5PostProcess });
            default:
                return Promise.reject(new Error('schema path not found'));
            }
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('constructor', () => {
        it('should configure validator with default BIG-IP schema config', () => {
            const schemaValidatorBigIp = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            assert.deepStrictEqual(
                schemaValidatorBigIp._schemaConfigs,
                [
                    {
                        paths: [
                            'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/as3-request-schema.json'
                        ]
                    },
                    {
                        paths: [
                            'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/adc-schema.json',
                            'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/app-schema.json'
                        ],
                        options: {
                            useDefaults: true
                        }
                    }
                ]
            );
        });

        it('should configure validator with default BIG-IQ schema config', () => {
            const schemaValidatorBigIq = new SchemaValidator(DEVICE_TYPES.BIG_IQ);
            assert.deepStrictEqual(
                schemaValidatorBigIq._schemaConfigs,
                [
                    {
                        paths: [
                            'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/as3-request-schema.json'
                        ]
                    },
                    {
                        paths: [
                            'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/adc-schema.json',
                            'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/app-schema.json'
                        ],
                        options: {
                            useDefaults: false
                        }
                    }
                ]
            );
        });

        it('should configure validator with custom schema config', () => {
            const schemaValidatorCustom = new SchemaValidator(DEVICE_TYPES.BIG_IP, [{ paths: ['./test/path'] }]);
            assert.deepStrictEqual(
                schemaValidatorCustom._schemaConfigs,
                [{
                    paths: ['./test/path']
                }]
            );
        });
    });

    describe('.init', () => {
        it('should reject if schema config paths are missing', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP, [{}]);
            let rejected = false;
            return schemaValidator.init()
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(err.message, 'schema file paths not defined');
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if loaded schema $id is missing', () => {
            loadJSONStub.restore();
            sinon.stub(util, 'loadJSON').resolves({});
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            let rejected = false;
            return schemaValidator.init()
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(
                        err.message,
                        `loading schema "${as3SchemaPath}" failed, error: AS3 schema must contain an $id property`
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if validating schema fails', () => {
            loadJSONStub.restore();
            sinon.stub(util, 'loadJSON').resolves({ $id: 1234 });
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            let rejected = false;
            return schemaValidator.init()
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(err.message, 'compiling schema 1234 failed, error: schema id must be string');
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if compiling schema fails', () => {
            loadJSONStub.restore();
            sinon.stub(util, 'loadJSON').resolves({ $id: 'testId', $ref: '#/bad/path' });
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            let rejected = false;
            return schemaValidator.init()
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(
                        err.message,
                        'compiling schema testId failed, error: can\'t resolve reference #/bad/path from id testId#'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if unexpected error occurs while compiling schemas', () => {
            sinon.stub(AJV.prototype, 'addFormat').throws(new Error('test error'));
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            let rejected = false;
            return schemaValidator.init()
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(err.message, 'compiling schemas failed, error: test error');
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should load and compile schemas', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            assert.deepStrictEqual(Object.keys(schemaValidator._schemas), [], 'schemas should not be loaded yet');
            assert.deepStrictEqual(Object.keys(schemaValidator._validators), [], 'validators should not be compiled yet');
            return schemaValidator.init()
                .then(() => {
                    assert.deepStrictEqual(
                        Object.keys(schemaValidator._schemas),
                        [as3SchemaPath, adcSchemaPath, appSchemaPath],
                        'schemas should be loaded'
                    );
                    assert.deepStrictEqual(
                        Object.keys(schemaValidator._validators),
                        [SCHEMA_ID.AS3, SCHEMA_ID.ADC, SCHEMA_ID.APP],
                        'validators should be compiled'
                    );
                });
        });

        it('should skip loading identical schemas', () => {
            const duplicateConfigs = [
                { paths: [as3SchemaPath] },
                { paths: [adcSchemaPath] },
                { paths: [as3SchemaPath] }
            ];
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP, duplicateConfigs);
            return schemaValidator.init()
                .then(() => {
                    assert.strictEqual(loadJSONStub.callCount, 2, 'loadJSON should have only been called twice');
                    assert.deepStrictEqual(
                        Object.keys(schemaValidator._schemas),
                        [as3SchemaPath, adcSchemaPath],
                        'schemas should be loaded'
                    );
                });
        });
    });

    describe('.getDeviceType', () => {
        it('should return device type', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            assert.strictEqual(schemaValidator.getDeviceType(), DEVICE_TYPES.BIG_IP);
        });
    });

    describe('.getSchemas', () => {
        it('should return schemas', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            assert.deepStrictEqual(schemaValidator.getSchemas(), []);
            return schemaValidator.init()
                .then(() => {
                    assert.deepStrictEqual(
                        schemaValidator.getSchemas(),
                        [
                            {
                                $id: SCHEMA_ID.AS3,
                                type: 'object',
                                f5PostProcess: { tag: 'testTag', data: ['test data'] }
                            },
                            {
                                $id: SCHEMA_ID.ADC,
                                type: 'object',
                                f5PostProcess: { tag: 'testTag', data: ['test data'] }
                            },
                            {
                                $id: SCHEMA_ID.APP,
                                type: 'object',
                                f5PostProcess: { tag: 'testTag', data: ['test data'] }
                            }
                        ]
                    );
                });
        });
    });

    describe('.getSchemaIds', () => {
        it('should return schema ids', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            assert.deepStrictEqual(schemaValidator.getSchemaIds(), []);
            return schemaValidator.init()
                .then(() => {
                    assert.deepStrictEqual(
                        schemaValidator.getSchemaIds(),
                        [SCHEMA_ID.AS3, SCHEMA_ID.ADC, SCHEMA_ID.APP]
                    );
                });
        });
    });

    describe('.validate', () => {
        it('should reject if validator function not found', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            let rejected = false;
            return schemaValidator.init()
                .then(() => { schemaValidator.validate('badId', {}); })
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(err.message, 'Schema validator badId not found');
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should return results of valid declaration', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            return schemaValidator.init()
                .then(() => {
                    assert.deepStrictEqual(
                        schemaValidator.validate(SCHEMA_ID.ADC, {}),
                        {
                            valid: true,
                            errors: undefined,
                            postProcess: [{
                                instancePath: '',
                                schemaData: ['test data'],
                                tag: 'testTag'
                            }]
                        }
                    );
                });
        });

        it('should return results of invalid declaration', () => {
            const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP);
            return schemaValidator.init()
                .then(() => {
                    assert.deepStrictEqual(
                        schemaValidator.validate(SCHEMA_ID.ADC, []),
                        {
                            valid: false,
                            errors: [{
                                data: [],
                                dataPath: '',
                                keyword: 'type',
                                message: 'should be object',
                                params: {
                                    type: 'object'
                                },
                                parentSchema: {
                                    $id: SCHEMA_ID.ADC,
                                    type: 'object',
                                    f5PostProcess: {
                                        tag: 'testTag',
                                        data: ['test data']
                                    }
                                },
                                schema: 'object',
                                schemaPath: '#/type'
                            }],
                            postProcess: []
                        }
                    );
                });
        });
    });
});

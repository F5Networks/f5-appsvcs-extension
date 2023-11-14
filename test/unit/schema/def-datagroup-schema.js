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

describe('def-datagroup-schema.json', () => {
    describe('Data_Group', () => {
        function testDecl(value, expected) {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: '',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        test: value
                    }
                }
            };

            assert.strictEqual(
                validate(data),
                expected,
                JSON.stringify(validate.errors, null, 2)
            );
        }

        describe('.keyDataType', () => {
            function testValue(value, expected) {
                return testDecl({
                    class: 'Data_Group',
                    storageType: 'internal',
                    keyDataType: value,
                    records: []
                }, expected);
            }

            it('should allow "integer"', () => testValue('integer', true));
            it('should allow "ip"', () => testValue('ip', true));
            it('should allow "string"', () => testValue('string', true));
            it('should not allow "error"', () => testValue('error', false));
            it('should not allow false', () => testValue(false, false));
        });

        function testRecords(type) {
            function testValue(value, expected) {
                return testDecl({
                    class: 'Data_Group',
                    storageType: 'internal',
                    keyDataType: type,
                    records: value
                }, expected);
            }

            const goodKey = (type === 'integer') ? 42 : '192.0.2.1';
            it('should allow good key/value', () => testValue(
                [{
                    key: goodKey,
                    value: 'data'
                }],
                true
            ));

            it('should require key', () => testValue([{ value: '' }], false));

            const badKey = (type === 'integer') ? 'bad' : {};
            it('should not allow bad key type', () => testValue(
                [{
                    key: badKey,
                    value: ''
                }],
                false
            ));
            it('should not allow false', () => testValue(false, false));
        }

        describe('.records (string)', () => testRecords('string'));
        describe('.records (integer)', () => testRecords('integer'));
        describe('.records (ip)', () => testRecords('ip'));
    });
});

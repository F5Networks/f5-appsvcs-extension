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
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const settingSchema = require('../../../src/schema/latest/settings-schema.json');

const validate = ajv
    .compile(settingSchema);

describe('settings-schema.json', () => {
    describe('burstHandlingEnabled', () => {
        describe('Valid', () => {
            it('should use the default value of false', () => {
                const data = {};
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should accept a boolean', () => {
                const data = {
                    burstHandlingEnabled: true
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('Invalid', () => {
            it('should error if non-schema values are provided', () => {
                const data = {
                    funky: 'monkey'
                };
                assert.strictEqual(validate(data), false, 'Additional Properties should not be allowed');
            });
        });
    });

    describe('asyncTaskStorage', () => {
        describe('Valid', () => {
            it('should use the default value of "data-group"', () => {
                const data = {};
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should accept a value of "memory"', () => {
                const data = {
                    asyncTaskStorage: 'memory'
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('Invalid', () => {
            it('should error if non-schema values are provided', () => {
                const data = {
                    asyncTaskStorage: 'monkey'
                };
                assert.strictEqual(validate(data), false);
            });
        });
    });

    describe('serviceDiscoveryEnabled', () => {
        describe('valid', () => {
            it('should use the default value of true', () => {
                const data = {};
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should accept a value of false', () => {
                const data = {
                    serviceDiscoveryEnabled: false
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should error if not true or false', () => {
                const data = {
                    serviceDiscoveryEnabled: 'monkey'
                };
                assert.strictEqual(validate(data), false);
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

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

const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const validator = require('../../../src/lib/validator');

describe('validator', () => {
    describe('.hasDuplicate', () => {
        function assertPass(valueToCheck) {
            assert.strictEqual(validator.hasDuplicate(valueToCheck).isDuplicate, false);
        }

        function assertFail(valueToCheck) {
            const decl = { members: valueToCheck };
            assert.strictEqual(validator.hasDuplicate(decl).isDuplicate, true);
        }

        it('should pass on an empty array', () => {
            assertPass([]);
        });

        it('should pass on an array with no duplicates', () => {
            assertPass(['spam', 'and', 'eggs']);
        });

        it('should pass when using hasDuplicate props as keys in declaration', () => {
            const decl = {
                rules: {
                    class: 'Tenant',
                    members: {
                        class: 'Application',
                        iRules: {
                            class: 'iRule'
                        },
                        certificates: {
                            class: 'Certificate'
                        }
                    }
                }
            };
            assertPass(decl);
        });

        it('should fail with duplicate strings', () => {
            assertFail(['foo', 'foo']);
        });

        it('should fail with duplicate objects', () => {
            assertFail([
                { hello: 'there' },
                { hello: 'there' }
            ]);
        });
    });

    describe('.setDeclProps', () => {
        it('should return id in array', () => {
            const decl = {
                id: null
            };
            const result = validator.setDeclProps(decl, []);
            assert.deepEqual(result, ['id']);
        });
    });

    describe('.setAllProps', () => {
        it('should split patternProperties separately from properties keys', () => {
            const results = validator.setAllProps(adcSchema, new Set(), new Set(), false);
            const allKeys = Array.from(results[0]);
            const allPatternPropKeys = Array.from(results[1]);

            assert.strictEqual(allKeys.indexOf('^field(3[0-2]|[1-2][0-9]|[1-9])$') === -1, true);
            assert.strictEqual(validator.matchPatternProp(allPatternPropKeys, 'field1'), true);
        });
    });
});

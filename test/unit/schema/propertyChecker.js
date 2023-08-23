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
const as3Schema = require('../../../src/schema/latest/adc-schema.json');

// does not search through AS3 class keys or class-property keys
const IGNORE_PARENT_KEY = [
    'default',
    'definitions',
    'dependencies',
    'patternProperties',
    'properties',
    'f5aliases'
];

// does not search through object with custom/dynamic keys
const IGNORE_CHILD_KEYS = [
    'f5PostProcess'
];

const EXPECTED_KEYS = [
    '$comment',
    '$id',
    '$ref',
    '$schema',
    'additionalProperties',
    'allOf',
    'anyOf',
    'bigip',
    'cloudLibsEncrypt',
    'const',
    'data',
    'default',
    'definitions',
    'dependencies',
    'description',
    'else',
    'enum',
    'errorMessage',
    'f5PostProcess',
    'f5aliases',
    'f5serviceDiscovery',
    'exceptions',
    'format',
    'if',
    'items',
    'maxItems',
    'maxLength',
    'maxProperties',
    'maximum',
    'minItems',
    'minLength',
    'minProperties',
    'minimum',
    'multipleOf',
    'not',
    'oneOf',
    'pattern',
    'patternProperties',
    'properties',
    'propertyNames',
    'readOnly',
    'required',
    'then',
    'title',
    'type',
    'uniqueItems',
    'when'
];

function getSchemaKeys(schema) {
    const keys = [];

    function parseKeys(item, parentKey) {
        if (typeof item !== 'object' || item === null) {
            return;
        }
        if (Array.isArray(item)) {
            item.forEach((subItem) => {
                parseKeys(subItem, parentKey);
            });
            return;
        }
        Object.keys(item).forEach((key) => {
            if (IGNORE_CHILD_KEYS.indexOf(key) > -1) {
                return;
            }
            if (IGNORE_PARENT_KEY.indexOf(parentKey) === -1 && keys.indexOf(key) === -1) {
                keys.push(key);
            }
            parseKeys(item[key], key);
        });
    }

    parseKeys(schema);
    return keys.sort();
}

describe('propertyChecker.js', () => {
    describe('invalid', () => {
        it('should alert on non-allowlisted schema keys', () => {
            getSchemaKeys({ bogus: true }).forEach((key) => {
                assert(EXPECTED_KEYS.indexOf(key) === -1);
            });
        });
    });

    describe('valid', () => {
        it('should have allowlisted all schema keys (not including AS3 classes)', () => {
            getSchemaKeys(as3Schema).forEach((key) => {
                assert((EXPECTED_KEYS.indexOf(key) !== -1), `Missing key '${key}'`);
            });
        });
    });
});

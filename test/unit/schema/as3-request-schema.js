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

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const as3RequestSchema = require('../../../src/schema/latest/as3-request-schema.json');
const formats = require('../../../src/lib/adcParserFormats');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const validate = ajv
    .compile(as3RequestSchema);

describe('as3-request-schema.json', () => {
    describe('valid', () => {
        it('should succeed with AS3', () => {
            const data = {
                class: 'AS3',
                action: 'redeploy',
                targetHost: '192.0.2.1',
                targetUsername: 'user',
                targetPassphrase: 'password'
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should succeed with AS3 array', () => {
            const data = [
                {
                    class: 'AS3',
                    action: 'retrieve',
                    targetHost: '192.0.2.1',
                    targetUsername: 'user',
                    targetPassphrase: 'password'
                },
                {
                    class: 'AS3',
                    action: 'redeploy',
                    targetHost: '192.0.2.2',
                    targetUsername: 'user',
                    targetPassphrase: 'password'
                }
            ];
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should succeed with ADC', () => {
            const data = {
                class: 'ADC',
                id: 'test1111',
                schemaVersion: '3.0.0'
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should succeed with ADC array', () => {
            const data = [
                {
                    class: 'ADC',
                    id: 'test1111',
                    schemaVersion: '3.10.0'
                },
                {
                    class: 'ADC',
                    id: 'test2222',
                    schemaVersion: '3.10.0'
                }
            ];
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should succeed with patch single', () => {
            const data = [{
                op: 'add',
                path: '/some/test',
                value: 'to add'

            }];
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should succeed with patch multiple', () => {
            const data = [
                {
                    op: 'add',
                    path: '/some/test',
                    value: 'to add'
                },
                {
                    op: 'remove',
                    path: '/some/test'
                }
            ];
            assert.ok(validate(data), getErrorString(validate));
        });
    });

    describe('invalid', () => {
        it('should fail on empty object', () => {
            assert.strictEqual(validate({}), false);
        });

        it('should fail on empty array', () => {
            assert.strictEqual(validate([]), false);
        });

        it('should fail when class is specified and invalid', () => {
            assert.strictEqual(validate({ class: 'mumble' }), false);
        });

        it('should fail with invalid AS3', () => {
            const data = {
                class: 'AS3',
                action: 'magically transform'
            };
            assert.strictEqual(validate(data), false);
        });

        it('should fail with invalid patch body', () => {
            const data = [{
                op: 'add',
                value: 'to add'
            }];
            assert.strictEqual(validate(data), false);
        });

        it('should fail with array containing both ADC item and AS3 item', () => {
            const data = [
                {
                    class: 'AS3',
                    action: 'remove'
                },
                {
                    class: 'ADC',
                    id: 'test1111',
                    schemaVersion: '3.10.0'
                }
            ];
            assert.strictEqual(validate(data), false);
        });

        it('should fail with array containing ADC item and patchBody item', () => {
            const data = [
                {
                    class: 'ADC',
                    id: 'test1111',
                    schemaVersion: '3.10.0'
                },
                {
                    op: 'add',
                    path: '/some/test',
                    value: 'to add'
                }
            ];
            assert.strictEqual(validate(data), false);
        });

        it('should fail with array containing AS3 item and patchBody item', () => {
            const data = [
                {
                    op: 'add',
                    path: '/some/test',
                    value: 'to add'
                },
                {
                    class: 'AS3',
                    action: 'retrieve'
                }
            ];
            assert.strictEqual(validate(data), false);
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

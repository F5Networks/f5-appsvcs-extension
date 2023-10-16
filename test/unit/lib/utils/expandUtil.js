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
const sinon = require('sinon');

const log = require('../../../../src/lib/log');
const backquoteExpand = require('../../../../src/lib/util/expandUtil').backquoteExpand;

describe('expandUtil', () => {
    let src;
    let origin;
    let root;
    let dest;
    let destPpty;

    function assertExpansion(input, expected) {
        origin.property = input;
        root.Tenant.Application.item2.property = input;
        backquoteExpand(input, src, origin, root, dest.Tenant.Application.item1, destPpty);
        assert.strictEqual(dest.Tenant.Application.item1.property, expected);
    }

    beforeEach(() => {
        origin = {
            class: 'classToExpand',
            expand: true
        };
        root = {
            class: 'ADC',
            id: '12345',
            family: 'myFamily',
            Tenant: {
                class: 'myTenantClass',
                Application: {
                    class: 'myApplicationClass',
                    template: 'https',
                    item1: {
                        property: 'myProperty'
                    },
                    item2: {
                        class: 'mySubClass',
                        expand: true
                    },
                    item3: 'myItem3',
                    item4: 'bXlJdGVtNA==',
                    pointerToNowhere: ''
                }
            }
        };

        src = '/Tenant/Application/item2/property';

        dest = {
            Tenant: {
                Application: {
                    item1: {
                        property: ''
                    }
                }
            }
        };
        destPpty = 'property';
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('expansion test cases', () => {
        const testCases = [
            ['copy source if no escapes are found', 'no escape', 'no escape'],
            ['replace with a backquote', 'pre ``-item', 'pre `-item'],
            ['replace with an empty string', 'pre `~`-item', 'pre -item'],
            ['should expand to id', 'pre `I`-item', 'pre 12345-item'],
            ['should expand to family', 'pre `F`-item', 'pre myFamily-item'],
            ['should expand to Tenant', 'pre `T`-item', 'pre Tenant-item'],
            ['should expand to application', 'pre `A`-item', 'pre Application-item'],
            ['should expand to type', 'pre `Y`://example.com', 'pre https://example.com'],
            ['should expand to base member', 'pre `M`-item', 'pre property-item'],
            ['should expand to full member', 'pre `N`-item', 'pre /Tenant/Application/item2/property-item'],
            ['should expand to containing class name', 'pre `O`-item', 'pre item2-item'],
            ['should expand to containing class pointer', 'pre `P`-item', 'pre /Tenant/Application-item'],
            ['should expand to containing class member pointer', 'pre `Q`-item', 'pre /Tenant/Application/item2-item'],
            ['should expand to class name', 'pre `C`-item', 'pre mySubClass-item'],
            ['should expand to pointed to object', 'pre `=/@/Application/item3`-item', 'pre myItem3-item'],
            ['should expand to a base64 decoded object', 'pre `+/@/Application/item4`-item', 'pre myItem4-item'],
            ['should expand to a full path', 'pre `*item1`-item', 'pre /Tenant/Application/item1-item']
        ];

        testCases.forEach((testCase) => {
            it(testCase[0], () => {
                const input = testCase[1];
                const expected = testCase[2];
                assertExpansion(input, expected);
            });
        });
    });

    describe('non-expansion test cases', () => {
        function assertError(input, expectedMessage) {
            origin.property = input;
            root.Tenant.Application.item2.property = input;
            assert.throws(() => backquoteExpand(input, src, origin, root, dest.Tenant.Application.item1, destPpty),
                (err) => err.message.indexOf(expectedMessage) !== -1);
        }

        it('should throw if non-~ escape is missing second backquote', () => {
            const input = 'pre `I-item';
            assertError(input, 'missing second backquote');
        });

        it('should throw if ~ escape is missing second backquote', () => {
            const input = 'pre `~';
            assertError(input, 'missing second backquote');
        });

        it('should throw for an unsupported expansion', () => {
            const input = 'pre `B-item';
            assertError(input, 'unrecognized escape');
        });

        it('should throw error for a missing pointer', () => {
            const input = 'pre `*`-item';
            assertError(input, 'missing pointer');
        });

        it('should throw error for a pointer to undefined', () => {
            const input = 'pre `*noSuchItem`-item';
            assertError(input, '`*noSuchItem` at');
        });

        it('should log message for ! escape', () => {
            const logSpy = sinon.spy(log, 'notice');
            const input = 'pre `!item1`-item';
            const expected = 'pre -item';
            assertExpansion(input, expected);
            assert(logSpy.calledOnce);
            assert(logSpy.getCall(0).args[0].startsWith('alert (item1) expanding'));
        });
    });
});

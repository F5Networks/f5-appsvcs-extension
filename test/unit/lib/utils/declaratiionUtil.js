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

const declarationUtil = require('../../../../src/lib/util/declarationUtil');

describe('declarationUtil', () => {
    describe('isClass', () => {
        it('should return false if there is no class property', () => {
            const obj = {
                noClass: 'bar'
            };

            assert.strictEqual(declarationUtil.isClass(obj, 'bar'), false);
        });

        it('should return false if there object is not an object', () => {
            assert.strictEqual(declarationUtil.isClass(undefined, 'bar'), false);
        });
    });

    describe('isX', () => {
        const methodsToTest = [
            'isADC',
            'isAS3',
            'isApplication',
            'isTenant',
            'isCertificate'
        ];

        methodsToTest.forEach((method) => {
            const methodRegex = /is(.*)/;
            const className = methodRegex.exec(method)[1];

            it(`should return true if the object class is ${className}`, () => {
                const obj = {
                    class: className
                };

                assert.strictEqual(declarationUtil[method].call(this, obj), true);
            });

            it(`should return false if the object class is not ${className}`, () => {
                const obj = {
                    class: `foo${className}`
                };

                assert.strictEqual(declarationUtil[method].call(this, obj), false);
            });
        });
    });
});

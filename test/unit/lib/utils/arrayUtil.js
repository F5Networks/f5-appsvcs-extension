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

const arrayUtil = require('../../../../src/lib/util/arrayUtil');

describe('arrayUtil', () => {
    describe('.ensureArray', () => {
        it('should return an empty array', () => {
            assert.deepStrictEqual(arrayUtil.ensureArray(), []);
        });

        it('should return an empty array', () => {
            assert.deepStrictEqual(arrayUtil.ensureArray({}), [{}]);
        });

        it('should return an array with values in it', () => {
            assert.deepStrictEqual(arrayUtil.ensureArray({ foo: 'bar' }), [{ foo: 'bar' }]);
        });

        it('should return the same object as before', () => {
            assert.deepStrictEqual(arrayUtil.ensureArray(['foo-bar']), ['foo-bar']);
        });
    });

    describe('.doesArrayContain', () => {
        it('should return true if the array does contain the target object', () => {
            const array = ['funky'];
            const target = 'funky';
            assert.strictEqual(arrayUtil.doesArrayContain(array, target), true);
        });

        it('should return false if the array does NOT contain the target object', () => {
            const array = ['funky'];
            const target = 'monkey';
            assert.strictEqual(arrayUtil.doesArrayContain(array, target), false);
        });

        it('should return false if the array is empty', () => {
            const array = [];
            const target = '1';
            assert.strictEqual(arrayUtil.doesArrayContain(array, target), false);
        });

        it('should return false if the array is undefined', () => {
            const target = '1';
            assert.strictEqual(arrayUtil.doesArrayContain(undefined, target), false);
        });

        it('should return false if the target is undefined', () => {
            const array = [];
            assert.strictEqual(arrayUtil.doesArrayContain(array, undefined), false);
        });
    });

    describe('.doesArrayContainAny', () => {
        it('should return true if the arr1 contains any of the arr2', () => {
            const arr1 = [1, 2, 3];
            const arr2 = [4, 1];
            assert.strictEqual(arrayUtil.doesArrayContainAnyOf(arr1, arr2), true);
        });

        it('should return false if the arr1 does NOT contain any of the arr2', () => {
            const arr1 = [1, 2, 3];
            const arr2 = [4];
            assert.strictEqual(arrayUtil.doesArrayContainAnyOf(arr1, arr2), false);
        });

        it('should return false if the arr1 is undefined', () => {
            const arr2 = [1];
            assert.strictEqual(arrayUtil.doesArrayContainAnyOf(undefined, arr2), false);
        });

        it('should return false if the arr2 is undefined', () => {
            const arr1 = [1, 2, 3];
            assert.strictEqual(arrayUtil.doesArrayContainAnyOf(arr1, undefined), false);
        });
    });
});

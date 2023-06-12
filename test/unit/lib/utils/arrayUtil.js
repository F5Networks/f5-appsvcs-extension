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

    describe('.insertAfterOrAtBeginning', () => {
        it('should insert after last specified element for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertAfterOrAtBeginning(arr, '1', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', 'insertMe', '2', '3']);
        });

        it('should insert after last specified element for eq comparison with duplicates', () => {
            const arr = ['1', '1', '2', '3'];
            arrayUtil.insertAfterOrAtBeginning(arr, '1', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', '1', 'insertMe', '2', '3']);
        });

        it('should insert after specified element for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertAfterOrAtBeginning(arr, '1', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'insertMe', 'two 2 two', 'three 3 three']);
        });

        it('should insert after specified element for inc comparison with duplicates', () => {
            const arr = ['one 1 one', 'one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertAfterOrAtBeginning(arr, '1', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'one 1 one', 'insertMe', 'two 2 two', 'three 3 three']);
        });

        it('should insert at beginning of array for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertAfterOrAtBeginning(arr, 'notInList', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['insertMe', '1', '2', '3']);
        });

        it('should insert at beginning of array for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertAfterOrAtBeginning(arr, 'notInList', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['insertMe', 'one 1 one', 'two 2 two', 'three 3 three']);
        });

        it('should insert at beginning of array when there are duplicates', () => {
            const arr = ['one 1 one', 'two 2 two', 'one 1 one', 'three 3 three'];
            arrayUtil.insertAfterOrAtBeginning(arr, 'notInList', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['insertMe', 'one 1 one', 'two 2 two', 'one 1 one', 'three 3 three']);
        });
    });

    describe('.insertBeforeOrAtBeginning', () => {
        it('should insert before specified element for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertBeforeOrAtBeginning(arr, '3', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', '2', 'insertMe', '3']);
        });

        it('should insert before specified element for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertBeforeOrAtBeginning(arr, '3', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'two 2 two', 'insertMe', 'three 3 three']);
        });

        it('should insert at beginning of array for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertBeforeOrAtBeginning(arr, 'notInList', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['insertMe', '1', '2', '3']);
        });

        it('should insert at beginning of array for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertBeforeOrAtBeginning(arr, 'notInList', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['insertMe', 'one 1 one', 'two 2 two', 'three 3 three']);
        });

        it('should insert at beginning of array when there are duplicates', () => {
            const arr = ['one 1 one', 'two 2 two', 'one 1 one', 'three 3 three'];
            arrayUtil.insertBeforeOrAtBeginning(arr, 'notInList', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['insertMe', 'one 1 one', 'two 2 two', 'one 1 one', 'three 3 three']);
        });
    });

    describe('.insertAfterOrAtEnd', () => {
        it('should insert after specified element for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertAfterOrAtEnd(arr, '1', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', 'insertMe', '2', '3']);
        });

        it('should insert after specified element for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertAfterOrAtEnd(arr, '1', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'insertMe', 'two 2 two', 'three 3 three']);
        });

        it('should insert at end of array for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertAfterOrAtEnd(arr, 'notInList', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', '2', '3', 'insertMe']);
        });

        it('should insert at end of array for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertAfterOrAtEnd(arr, 'notInList', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'two 2 two', 'three 3 three', 'insertMe']);
        });
    });

    describe('.insertBeforeOrAtEnd', () => {
        it('should insert before specified element for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertBeforeOrAtEnd(arr, '3', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', '2', 'insertMe', '3']);
        });

        it('should insert before specified element for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertBeforeOrAtEnd(arr, '3', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'two 2 two', 'insertMe', 'three 3 three']);
        });

        it('should insert at end of array for eq comparison', () => {
            const arr = ['1', '2', '3'];
            arrayUtil.insertBeforeOrAtEnd(arr, 'notInList', 'insertMe', 'eq');
            assert.deepStrictEqual(arr, ['1', '2', '3', 'insertMe']);
        });

        it('should insert at end of array for inc comparison', () => {
            const arr = ['one 1 one', 'two 2 two', 'three 3 three'];
            arrayUtil.insertBeforeOrAtEnd(arr, 'notInList', 'insertMe', 'inc');
            assert.deepStrictEqual(arr, ['one 1 one', 'two 2 two', 'three 3 three', 'insertMe']);
        });
    });
});

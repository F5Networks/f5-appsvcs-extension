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

/* Borrowed and modified from f5-icontrollx-dev-kit (github.com/f5devcentral/f5-icontrollx-dev-kit) */
/* eslint-disable object-shorthand */

'use strict';

const ensureArray = function (input) {
    if (typeof input === 'undefined') {
        return [];
    }
    return (Array.isArray(input)) ? input : [input];
};

/**
 * Checks if any member of tArray is present in array
 *
 * @public
 * @param {array} arr1 - check base array
 * @param {array} arr2 - the target array to compare with
 * @returns {boolean} - true any of arr2 is in arr1, else false
 */
const doesArrayContainAnyOf = function (arr1, arr2) {
    if (typeof arr1 === 'undefined' || typeof arr2 === 'undefined') {
        return false;
    }
    return arr1.some((r) => arr2.indexOf(r) >= 0);
};

/**
 * Checks if any member of tArray is present in array
 *
 * @public
 * @param {array} array - check base array
 * @param {value} target - the target value of any type
 * @returns {boolean} - true if target is in the array, else false
 */
const doesArrayContain = function (array, target) {
    if (typeof array === 'undefined') {
        return false;
    }
    return array.indexOf(target) !== -1;
};

const getIndex = function (array, target, comparison) {
    let targetIndex;
    if (comparison === 'eq') {
        targetIndex = array.findIndex((element) => element === target);
    } else {
        targetIndex = array.findIndex((element) => element.indexOf(target) > -1);
    }
    return targetIndex;
};

const getLastIndex = function (array, target, comparison) {
    let targetIndex;
    for (targetIndex = array.length - 1; targetIndex >= 0; targetIndex -= 1) {
        if (comparison === 'eq') {
            if (array[targetIndex] === target) {
                break;
            }
        } else if (array[targetIndex].indexOf(target) > -1) {
            break;
        }
    }
    return targetIndex;
};

/**
 * Inserts an item after another item in an array or at the beginning of the array.
 *
 * @param {array} array - The array into which to insert
 * @param {string} target - The string to search for
 * @param {string} item - The item to insert
 * @param {string} comparison - The type of comparison to perform.
 *     'eq' to do an '===' comparison
 *     'inc' to see if the item is contained in an element of the array
 */
const insertAfterOrAtBeginning = function (array, target, item, comparison) {
    const targetIndex = getLastIndex(array, target, comparison);

    if (targetIndex > -1) {
        array.splice(targetIndex + 1, 0, item);
    } else {
        array.unshift(item);
    }
};

/**
 * Inserts an item before another item in an array or at the beginning of the array.
 *
 * @param {array} array - The array into which to insert
 * @param {string} target - The string to search for
 * @param {string} item - The item to insert
 * @param {string} comparison - The type of comparison to perform.
 *     'eq' to do an '===' comparison
 *     'inc' to see if the item is contained in an element of the array
 */
const insertBeforeOrAtBeginning = function (array, target, item, comparison) {
    const targetIndex = getIndex(array, target, comparison);

    if (targetIndex > -1) {
        array.splice(targetIndex, 0, item);
    } else {
        array.unshift(item);
    }
};

/**
 * Inserts an item after another item in an array or at the end of the array.
 *
 * @param {array} array - The array into which to insert
 * @param {string} target - The string to search for
 * @param {string} item - The item to insert
 * @param {string} comparison - The type of comparison to perform.
 *     'eq' to do an '===' comparison
 *     'inc' to see if the item is contained in an element of the array
 */
const insertAfterOrAtEnd = function (array, target, item, comparison) {
    const targetIndex = getLastIndex(array, target, comparison);

    if (targetIndex > -1) {
        array.splice(targetIndex + 1, 0, item);
    } else {
        array.push(item);
    }
};

/**
 * Inserts an item before another item in an array or at the end of the array.
 *
 * @param {array} array - The array into which to insert
 * @param {string} target - The string to search for
 * @param {string} item - The item to insert
 * @param {string} comparison - The type of comparison to perform.
 *     'eq' to do an '===' comparison
 *     'inc' to see if the item is contained in an element of the array
 */
const insertBeforeOrAtEnd = function (array, target, item, comparison) {
    const targetIndex = getIndex(array, target, comparison);

    if (targetIndex > -1) {
        array.splice(targetIndex, 0, item);
    } else {
        array.push(item);
    }
};

module.exports = {
    ensureArray,
    doesArrayContainAnyOf,
    doesArrayContain,
    insertAfterOrAtBeginning,
    insertAfterOrAtEnd,
    insertBeforeOrAtBeginning,
    insertBeforeOrAtEnd
};

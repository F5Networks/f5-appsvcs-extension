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

module.exports = {
    ensureArray,
    doesArrayContainAnyOf,
    doesArrayContain
};

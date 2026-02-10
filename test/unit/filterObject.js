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

const util = require('../../src/lib/util/util');

describe('Object Filtering', () => {
    const complexObj = {
        name: 'Jim',
        age: 21,
        friends: [
            {
                name: 'Sara',
                age: 23,
                friends: [
                    {
                        name: 'Bob',
                        age: 45,
                        friends: ['Joe', 'Steve']
                    }
                ]
            },
            'Sal',
            {
                name: 'George',
                age: 22,
                friends: [],
                description: {}
            }
        ],
        description: {
            eyeColor: 'blue',
            hairColor: 'brown'
        }
    };

    describe('Bad Parameters', () => {
        it('should throw error when object is undefined', () => {
            assert.throws(() => util.filterObject(undefined, () => true));
        });
        it('should throw error when filter is undefined', () => {
            assert.throws(() => util.filterObject(complexObj));
        });
        it('should throw error when object is null', () => {
            assert.throws(() => util.filterObject(null, () => true));
        });
        it('should throw error when object is array', () => {
            assert.throws(() => util.filterObject([], () => true));
        });
        it('should throw error when object is string', () => {
            assert.throws(() => util.filterObject('hello', () => true));
        });
    });

    describe('Empty Objects', () => {
        it('should return empty object when object is empty', () => {
            const obj = util.filterObject({}, () => true);
            assert.deepEqual(obj, {});
        });
        it('should return empty object when no match', () => {
            const obj = util.filterObject(complexObj, () => false);
            assert.deepEqual(obj, {});
        });
    });

    describe('Object Filtering', () => {
        it('should return filtered object where name equals "Sarah"', () => {
            const obj = util.filterObject(complexObj, (o) => o.name === 'Sara');
            assert.deepEqual(obj, {
                friends: [
                    {
                        name: 'Sara',
                        age: 23,
                        friends: [
                            {
                                name: 'Bob',
                                age: 45,
                                friends: ['Joe', 'Steve']
                            }
                        ]
                    }
                ]
            });
        });
        it('should return filtered objects where age equals 45 or eye color equals blue', () => {
            const obj = util.filterObject(complexObj, (o) => o.age === 45 || o.eyeColor === 'blue');
            assert.deepEqual(obj, {
                friends: [
                    {
                        friends: [
                            {
                                name: 'Bob',
                                age: 45,
                                friends: ['Joe', 'Steve']
                            }
                        ]
                    }
                ],
                description: {
                    eyeColor: 'blue',
                    hairColor: 'brown'
                }
            });
        });
    });
});

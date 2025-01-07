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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const Context = require('../../../../src/lib/context/context');

describe('context', () => {
    describe('.build', () => {
        it('should return a default context object', () => assert.deepEqual(
            Context.build(),
            {
                host: {},
                request: {},
                target: {},
                timeSlip: 0,
                currentIndex: 0,
                log: {},
                tasks: [],
                control: {
                    tokens: []
                }
            }
        ));

        it('should return an object with hostContext values', () => {
            const hostContext = { someValue: {} };
            return assert.deepEqual(
                Context.build(hostContext),
                {
                    host: { someValue: {} },
                    request: {},
                    target: {},
                    timeSlip: 0,
                    currentIndex: 0,
                    log: {},
                    tasks: [],
                    control: {
                        tokens: []
                    }
                }
            );
        });

        it('should return an object with requestContext values', () => {
            const requestContext = { someOtherValue: {} };
            return assert.deepEqual(
                Context.build(undefined, requestContext),
                {
                    host: {},
                    request: { someOtherValue: {} },
                    target: {},
                    timeSlip: 0,
                    currentIndex: 0,
                    log: {},
                    tasks: [],
                    control: {
                        tokens: []
                    }
                }
            );
        });

        it('should return an object with targetContext values', () => {
            const targetContext = { somethingMore: {} };
            return assert.deepEqual(
                Context.build(undefined, undefined, targetContext),
                {
                    host: {},
                    request: {},
                    target: { somethingMore: {} },
                    timeSlip: 0,
                    currentIndex: 0,
                    log: {},
                    tasks: [],
                    control: {
                        tokens: []
                    }
                }
            );
        });

        it('should return an object with tasks value', () => {
            const tasks = [{ task1: {} }];
            return assert.deepEqual(
                Context.build(undefined, undefined, undefined, tasks),
                {
                    host: {},
                    request: {},
                    target: {},
                    timeSlip: 0,
                    currentIndex: 0,
                    log: {},
                    tasks: [{ task1: {} }],
                    control: {
                        tokens: []
                    }
                }
            );
        });

        it('should return an object with hostContext, requestContext, targetContext, and tasks values', () => {
            const hostContext = { someValue: {} };
            const requestContext = { someOtherValue: {} };
            const targetContext = { somethingMore: {} };
            const tasks = [{ task1: {} }];
            const tracer = { _enabled: true };
            return assert.deepEqual(
                Context.build(hostContext, requestContext, targetContext, tasks, tracer),
                {
                    host: { someValue: {} },
                    request: { someOtherValue: {} },
                    target: { somethingMore: {} },
                    timeSlip: 0,
                    currentIndex: 0,
                    log: {},
                    tasks: [{ task1: {} }],
                    control: {
                        tokens: []
                    }
                }
            );
        });
    });
});

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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const DiffProcessor = require('../../../src/lib/diffProcessor');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('DiffProcessor', () => {
    describe('.process()', () => {
        it('should initialize tags', () => {
            const rawDiff = [{
                kind: 'N',
                rhs: { command: 'ltm virtual' }
            }];
            const processor = new DiffProcessor(rawDiff, {}, {});
            return processor.process()
                .then(() => {
                    assert.deepEqual(processor.diff[0].tags, []);
                });
        });

        it('should make command available on all entries', () => {
            const command = 'ltm virtual';
            const properties = { spam: 'eggs' };
            const diff = [
                {
                    kind: 'N',
                    rhs: {
                        command,
                        properties
                    }
                },
                {
                    kind: 'D',
                    lhs: {
                        command,
                        properties
                    }
                },
                {
                    kind: 'E',
                    path: ['edit', 'color'],
                    rhs: 'red',
                    lhs: 'green'
                }
            ];
            const current = {
                virtual0: {
                    command,
                    properties
                },
                edit: {
                    command,
                    properites: {
                        color: 'green'
                    }
                }
            };
            const desired = {
                virtual1: {
                    command,
                    properties
                },
                edit: {
                    command,
                    properites: {
                        color: 'red'
                    }
                }
            };
            const processor = new DiffProcessor(diff, desired, current);
            return processor.process()
                .then(() => {
                    diff.forEach((entry, i) => {
                        const message = `Diff entry ${i} is missing a command`;
                        assert.deepEqual(entry.command, command, message);
                    });
                });
        });
    });

    describe('.validate()', () => {
        it('should resolve if there are no diffs', () => {
            const processor = new DiffProcessor([], {}, {});
            return assert.isFulfilled(processor.validate());
        });

        it('should reject on renames', () => {
            const desired = {
                '/Common/virtual': {
                    command: 'ltm virtual',
                    properties: {}
                }
            };
            const current = {
                '/Common/virtaul': {
                    command: 'ltm virtual',
                    properties: {}
                }
            };
            const diff = [{
                kind: 'R',
                path: '/Common/virtaul',
                rhs: '/Common/virtual'
            }];

            const processor = new DiffProcessor(diff, desired, current);
            return assert.isRejected(processor.validate());
        });
    });
});

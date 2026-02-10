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

const Queue = require('../../../src/lib/queue');

describe('queue', () => {
    let queue;

    beforeEach(() => {
        queue = new Queue();
    });

    describe('.constructor', () => {
        it('should create a queue with zero entries', () => {
            assert.deepStrictEqual(queue.entries, []);
        });

        it('should create a queue with a limit of 10', () => {
            assert.strictEqual(queue.limit, 10);
        });
    });

    describe('.enqueue', () => {
        it('should add item to end of queue', () => {
            const uuidRegExp = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

            const uuid1 = queue.enqueue(1);
            const uuid2 = queue.enqueue(2);
            assert.ok(uuid1.match(uuidRegExp));
            assert.ok(uuid2.match(uuidRegExp));
            assert.deepStrictEqual(queue.entries, [
                { item: 1, uuid: uuid1 },
                { item: 2, uuid: uuid2 }
            ]);
        });

        it('should fire enqueue event', (done) => {
            queue.once('enqueue', () => {
                done();
            });
            queue.enqueue(1);
        });

        it('should fill queue to limit', () => {
            for (let i = 0; i < queue.limit; i += 1) {
                queue.enqueue(i);
            }
            assert.equal(queue.entries.length, queue.limit);
        });

        it('should error when entries.length is equal to limit', () => {
            for (let i = 0; i < queue.limit; i += 1) {
                queue.enqueue(i);
            }
            assert.throws(() => queue.enqueue(queue.limit + 1), 'Error: Too many configuration operations are in progress on the device. Please try again later');
        });
    });

    describe('.dequeue', () => {
        it('should remove item from front of queue', () => {
            const uuid1 = queue.enqueue(1);
            const uuid2 = queue.enqueue(2);
            assert.deepStrictEqual(queue.dequeue(), { item: 1, uuid: uuid1 });
            assert.deepStrictEqual(queue.entries, [{ item: 2, uuid: uuid2 }]);
        });

        it('should return undefined if queue is empty', () => {
            assert.strictEqual(queue.dequeue(), undefined);
        });
    });

    describe('.isEmpty', () => {
        it('should return true if queue is empty', () => {
            assert.strictEqual(queue.isEmpty(), true);
        });

        it('should return false if queue is not empty', () => {
            queue.enqueue(1);
            assert.strictEqual(queue.isEmpty(), false);
        });
    });
});

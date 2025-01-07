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
const sinon = require('sinon');

const QueueConsumer = require('../../../src/lib/queueConsumer');
const Queue = require('../../../src/lib/queue');
const log = require('../../../src/lib/log');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('queue', () => {
    let queue;
    let queueConsumer;

    beforeEach(() => {
        queue = new Queue();
        queueConsumer = new QueueConsumer(queue);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('.constructor', () => {
        it('should create a queueConsumer', () => {
            assert.deepStrictEqual(queueConsumer.queue, queue);
        });
    });

    describe('.consume', () => {
        it('should reject if already waiting to consume', () => {
            queueConsumer.consume();
            return assert.isRejected(queueConsumer.consume(), /Already waiting to consume/);
        });

        it('should resolve with item from queue', () => {
            const uuid = queue.enqueue(1);
            return assert.becomes(queueConsumer.consume(), { uuid, item: 1 })
                .then(() => {
                    assert.ok(queue.isEmpty());
                });
        });

        it('should wait and resolve with item from queue once one is available', (done) => {
            let item;
            queueConsumer.consume()
                .then((dequeuedItem) => {
                    item = dequeuedItem;
                });

            const uuid = queue.enqueue(1);
            setImmediate(() => {
                assert.deepStrictEqual(item, { uuid, item: 1 });
                done();
            });
        });
    });

    describe('.delegate', () => {
        it('should continue on error', (done) => {
            sinon.stub(log, 'error').callsFake((e) => {
                assert.ok(e.match(/^Error: Test Error/));
            });

            queue.enqueue(1);
            queue.enqueue(2);
            queueConsumer.delegate(() => Promise.reject(new Error('Test Error')));

            setImmediate(() => {
                assert.ok(queue.isEmpty());
                done();
            });
        });

        it('should process queue items', (done) => {
            const expected = [];
            const errors = [];
            let processCount = 0;

            queueConsumer.delegate((item) => {
                processCount += 1;
                try {
                    assert.deepStrictEqual(item, expected.shift());
                } catch (e) {
                    errors.push(e);
                }
            });

            // Add 2 items to queue after consumer starts
            const uuid1 = queue.enqueue(1);
            const uuid2 = queue.enqueue(2);
            expected.push({ uuid: uuid1, item: 1 });
            expected.push({ uuid: uuid2, item: 2 });

            setImmediate(() => {
                // Verify items were processed
                assert.strictEqual(processCount, 2);
                assert.strictEqual(errors.length, 0);
                assert.ok(queue.isEmpty());

                // Add 1 more item to queue now that consumer is waiting
                const uuid3 = queue.enqueue(3);
                expected.push({ uuid: uuid3, item: 3 });

                setImmediate(() => {
                    // Verify item was processed
                    assert.strictEqual(processCount, 3);
                    assert.strictEqual(errors.length, 0);
                    assert.ok(queue.isEmpty());
                    done();
                });
            });
        });
    });
});

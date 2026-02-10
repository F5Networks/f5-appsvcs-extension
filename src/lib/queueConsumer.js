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

const log = require('./log');

class QueueConsumer {
    /**
     * A queue consumer class.
     * @constructor
     */
    constructor(queue) {
        this._waitingToConsume = false;
        this.queue = queue;
    }

    /**
     * Consumes, or waits to consume, the next item on the queue.
     * @returns {Promise} A promise that will resolve with the next item on the queue.
     */
    consume() {
        if (this._waitingToConsume) {
            return Promise.reject(new Error('Already waiting to consume'));
        }

        if (!this.queue.isEmpty()) {
            return Promise.resolve(this.queue.dequeue());
        }

        this._waitingToConsume = true;
        return new Promise((resolve) => {
            this.queue.once('enqueue', () => {
                this._waitingToConsume = false;
                resolve(this.queue.dequeue());
            });
        });
    }

    /**
     * Delegates all consumption and processing of queue items to the consumer.
     * @param {function} callback - A function that accepts queue item and returns promise to
     *                              process data
     */
    delegate(callback) {
        this.consume()
            .then((data) => callback(data))
            .catch((error) => {
                log.error(error.stack);
            })
            .then(() => {
                this.delegate(callback);
            });
    }
}

module.exports = QueueConsumer;

/**
 * Copyright 2024 F5, Inc.
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

const EventEmitter = require('events').EventEmitter;
const uuid = require('uuid');

const STATUSES = require('./constants').STATUS_CODES;

class Queue extends EventEmitter {
    /**
     * A generic queue class.
     * @constructor
     */
    constructor() {
        super();
        this.entries = [];
        this.limit = 10;
    }

    /**
     * Pushes the item to the back of the queue.
     * @param {*} item - The data to add to the queue.
     * @returns {string} The uuid associated with the queued item.
     */
    enqueue(item) {
        if (this.entries.length === this.limit) {
            const error = new Error('Too many configuration operations are in progress on the device. Please try again later');
            error.code = STATUSES.SERVICE_UNAVAILABLE_ERROR;
            throw error;
        }

        const itemUuid = uuid.v4();

        this.entries.push({
            item,
            uuid: itemUuid
        });
        this.emit('enqueue');

        return itemUuid;
    }

    /**
     * Shifts the first item from the front of the queue.
     * @returns {object} The uuid and item.
     */
    dequeue() {
        return this.entries.shift();
    }

    /**
     * Checks if queue is empty.
     * @returns {boolean}
     */
    isEmpty() {
        return this.entries.length === 0;
    }
}

module.exports = Queue;

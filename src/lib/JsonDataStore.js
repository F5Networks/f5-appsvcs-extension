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

class JsonDataStore {
    constructor() {
        this.data = {};
    }

    save(recordName, data) {
        this.data[recordName] = JSON.stringify(data);
        return Promise.resolve();
    }

    load(recordName) {
        if (!this.data[recordName]) {
            return Promise.reject(new Error(`The record ${recordName} was not found.`));
        }
        return Promise.resolve(JSON.parse(this.data[recordName]));
    }
}

module.exports = JsonDataStore;

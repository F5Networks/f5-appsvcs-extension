/**
 * Copyright 2022 F5 Networks, Inc.
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

const dataGroupUtil = require('./util/dataGroupUtil');
const TmshUtil = require('./util/tmshUtil');

class DataGroupDataStore {
    constructor(path) {
        this.path = path;
    }

    ensureFolder() {
        const path = this.path.split('/').slice(0, -1).join('/');
        return TmshUtil.folderExists(path)
            .then((exists) => {
                if (exists) {
                    return Promise.resolve();
                }
                return TmshUtil.addFolder(path);
            });
    }

    ensureDataGroup() {
        return TmshUtil.dataGroupExists(this.path)
            .then((exists) => {
                if (exists) {
                    return Promise.resolve();
                }
                return TmshUtil.addDataGroup(this.path);
            });
    }

    save(recordName, data) {
        return Promise.resolve()
            .then(() => this.ensureFolder())
            .then(() => this.ensureDataGroup())
            .then(() => {
                const string = JSON.stringify(data);
                const records = dataGroupUtil.stringToRecords(recordName, string);
                return TmshUtil.updateDataGroup(this.path, records);
            });
    }

    load(recordName) {
        return Promise.resolve()
            .then(() => TmshUtil.readDataGroup(this.path))
            .then((data) => {
                const match = (data.records || []).find((r) => r.name.startsWith(recordName));
                if (!match) {
                    throw new Error(`The record ${recordName} was not found.`);
                }
                return data.records;
            })
            .then((data) => dataGroupUtil.recordsToString(data, recordName))
            .then((data) => JSON.parse(data));
    }
}

module.exports = DataGroupDataStore;

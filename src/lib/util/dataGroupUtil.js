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

const zlib = require('zlib');

const util = require('./util');

const ZLIB_OPTIONS = {
    level: zlib.Z_BEST_COMPRESSION,
    windowBits: 15
};

function stringToRecords(baseKey, string, offset) {
    const compressedString = zlib.deflateSync(string, ZLIB_OPTIONS);

    const records = [];
    let base64String = compressedString.toString('base64');
    for (let counter = offset || 0; base64String.length; counter += 1) {
        const chunk = base64String.substr(0, 64512);
        records.push({
            name: `${baseKey}${counter}`,
            data: chunk
        });
        base64String = base64String.substr(64512);
    }

    return records;
}

function recordsToString(records, baseKey, offset) {
    let base64String = '';
    for (let i = offset || 0; i < records.length; i += 1) {
        const recordName = `${baseKey}${i}`;
        const record = records.find((r) => r.name === recordName);
        if (record) {
            base64String += record.data;
        }
    }
    const compresedString = util.fromBase64(base64String);
    const finalString = zlib.inflateSync(compresedString, ZLIB_OPTIONS).toString();
    return finalString;
}

module.exports = {
    stringToRecords,
    recordsToString
};

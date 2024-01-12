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

const assert = require('assert');

const dataGroupUtil = require('../../../../src/lib/util/dataGroupUtil');

describe('dataGroupUtil', () => {
    it('should round trip records', () => {
        let initial = '.';
        for (let i = 32; i < 127; i += 1) initial += String.fromCharCode(i);
        const baseKey = 'unit';
        const records = dataGroupUtil.stringToRecords(baseKey, initial);
        const final = dataGroupUtil.recordsToString(records, baseKey);
        assert.strictEqual(final, initial);
    });
});

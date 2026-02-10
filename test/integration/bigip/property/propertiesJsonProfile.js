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

const {
    assertClass,
    GLOBAL_TIMEOUT,
    getBigIpVersion
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

describe('JSON_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All properties', function () {
        // JSON Profiles are first supported on v21.0
        if (util.versionLessThan(getBigIpVersion(), '21.0')) {
            this.skip();
        }
        const properties = [
            {
                name: 'maximumBytes',
                inputValue: [undefined, 64000, undefined],
                expectedValue: [65536, 64000, 65536]
            },
            {
                name: 'maximumEntries',
                inputValue: [undefined, 2000, undefined],
                expectedValue: [2048, 2000, 2048]
            },
            {
                name: 'maximumNonJsonBytes',
                inputValue: [undefined, 32000, undefined],
                expectedValue: [32768, 32000, 32768]
            }
        ];
        return assertClass('JSON_Profile', properties);
    });
});

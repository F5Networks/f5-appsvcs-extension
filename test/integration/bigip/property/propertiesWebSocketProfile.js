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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('WebSocket_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertWebSocketProfileClass(properties) {
        return assertClass('WebSocket_Profile', properties);
    }

    it('All properties', () => {
        let properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'A WebSocket Profile', undefined],
                expectedValue: ['none', 'A WebSocket Profile', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'masking',
                inputValue: [undefined, 'unmask', undefined],
                expectedValue: ['selective', 'unmask', 'selective']
            },
            {
                name: 'compressMode',
                inputValue: [undefined, 'typed', undefined],
                expectedValue: ['preserved', 'typed', 'preserved']
            },
            {
                name: 'compression',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'maximumWindowSize',
                inputValue: [10, 15, 10],
                expectedValue: [10, 15, 10]
            },
            {
                name: 'noDelay',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            }
        ];

        if (util.versionLessThan(getBigIpVersion(), '16.1')) {
            properties = properties.slice(0, 2);
        }

        return assertWebSocketProfileClass(properties);
    });
});

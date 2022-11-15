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

const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Multiplex_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertMultiplexProfileClass(properties) {
        return assertClass('Multiplex_Profile', properties);
    }

    it('All properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'maxConnections',
                inputValue: [undefined, 4294967295, undefined],
                expectedValue: [10000, 4294967295, 10000]
            },
            {
                name: 'maxConnectionAge',
                inputValue: [undefined, 4294967295, undefined],
                expectedValue: [86400, 4294967295, 86400]
            },
            {
                name: 'maxConnectionReuse',
                inputValue: [undefined, 4294967295, undefined],
                expectedValue: [1000, 4294967295, 1000]
            },
            {
                name: 'idleTimeoutOverride',
                inputValue: [undefined, 500, 4294967295, undefined],
                expectedValue: ['disabled', 500, 'indefinite', 'disabled']
            },
            {
                name: 'connectionLimitEnforcement',
                inputValue: ['none', 'idle', 'none'],
                expectedValue: ['none', 'idle', 'none']
            },
            {
                name: 'sharePools',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'sourceMask',
                inputValue: [undefined, '255.255.255.0', undefined],
                expectedValue: ['any', '255.255.255.0', 'any']
            }
        ];

        return assertMultiplexProfileClass(properties);
    });
});

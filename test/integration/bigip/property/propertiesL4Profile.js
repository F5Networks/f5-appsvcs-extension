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

describe('L4_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertL4ProfileClass(properties, declarationCount) {
        return assertClass('L4_Profile', properties, declarationCount);
    }

    it('All Properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'L4_Profile', undefined],
                expectedValue: ['none', 'L4_Profile', 'none']
            },
            {
                name: 'clientTimeout',
                inputValue: [undefined, 60, undefined],
                expectedValue: [30, 60, 30]
            },
            {
                name: 'idleTimeout',
                inputValue: [undefined, 600, undefined],
                expectedValue: ['300', '600', '300']
            },
            {
                name: 'keepAliveInterval',
                inputValue: [undefined, 600, undefined],
                expectedValue: ['disabled', '600', 'disabled']
            },
            {
                name: 'looseClose',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'looseInitialization',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'maxSegmentSize',
                inputValue: [undefined, 4096, undefined],
                expectedValue: [0, 4096, 0]
            },
            {
                name: 'resetOnTimeout',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'synCookieAllowlist',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'synCookieEnable',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'tcpCloseTimeout',
                inputValue: [undefined, 43200, undefined],
                expectedValue: ['5', '43200', '5']
            },
            {
                name: 'tcpHandshakeTimeout',
                inputValue: [undefined, 43200, undefined],
                expectedValue: ['5', '43200', '5']
            }
        ];

        return assertL4ProfileClass(properties, 3);
    });
});

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

describe('UDP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertUdpProfileClass(properties, declarationCount) {
        return assertClass('UDP_Profile', properties, declarationCount);
    }

    it('All Properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'allowNoPayload',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'bufferMaxBytes',
                inputValue: [undefined, 12599295, undefined],
                expectedValue: [655350, 12599295, 655350]
            },
            {
                name: 'bufferMaxPackets',
                inputValue: [undefined, 192, undefined],
                expectedValue: [0, 192, 0]
            },
            {
                name: 'datagramLoadBalancing',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'idleTimeout',
                inputValue: [undefined, 86400, undefined],
                expectedValue: ['60', '86400', '60']
            },
            {
                name: 'ipDfMode',
                inputValue: [undefined, 'preserve', undefined],
                expectedValue: ['pmtu', 'preserve', 'pmtu']
            },
            {
                name: 'ipTosToClient',
                inputValue: [undefined, 240, undefined],
                expectedValue: ['0', '240', '0']
            },
            {
                name: 'linkQosToClient',
                inputValue: [undefined, 3, undefined],
                expectedValue: ['0', '3', '0']
            },
            {
                name: 'proxyMSS',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'ttlMode',
                inputValue: [undefined, 'decrement', undefined],
                expectedValue: ['proxy', 'decrement', 'proxy']
            },
            {
                name: 'ttlIPv4',
                inputValue: [undefined, 200, undefined],
                expectedValue: [255, 200, 255]
            },
            {
                name: 'ttlIPv6',
                inputValue: [undefined, 255, undefined],
                expectedValue: [64, 255, 64]
            },
            {
                name: 'useChecksum',
                inputValue: [undefined, true, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            }
        ];

        return assertUdpProfileClass(properties, 3);
    });
});

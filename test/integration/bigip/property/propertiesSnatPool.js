/**
 * Copyright 2023 F5, Inc.
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

describe('SNAT_Pool', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertSnatPoolClass(properties, options) {
        return assertClass('SNAT_Pool', properties, options);
    }

    function getAddresses(responseBody) {
        const addrs = [];
        responseBody.members.forEach((member) => {
            addrs.push(member.address);
        });
        return addrs;
    }

    const ipv4Addrs = [
        '198.19.192.17',
        '198.19.192.18',
        '198.19.192.19',
        '198.19.192.20',
        '198.19.192.21',
        '198.19.192.22'
    ];
    const ipv6Addrs = [
        'fdf5:4153:3300::a',
        'fdf5:4153:3300::b',
        'fdf5:4153:3300::c',
        'fdf5:4153:3300::d',
        'fdf5:4153:3300::e',
        'fdf5:4153:3300::f'
    ];
    const mixAddrs = [
        '198.19.192.23',
        '198.19.192.24',
        '198.19.192.25',
        'fdf5:4153:3300::10',
        'fdf5:4153:3300::11',
        'fdf5:4153:3300::12'
    ];

    let commonSharedOptions;

    this.beforeEach(() => {
        commonSharedOptions = {
            tenantName: 'Common',
            applicationName: 'Shared'
        };
    });

    it('IPv4', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [ipv4Addrs],
                expectedValue: [ipv4Addrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties);
    });

    it('IPv4 in Common-Shared', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [ipv4Addrs],
                expectedValue: [ipv4Addrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties, commonSharedOptions);
    });

    it('IPv6', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [ipv6Addrs],
                expectedValue: [ipv6Addrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties);
    });

    it('IPv6 in Common-Shared', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [ipv6Addrs],
                expectedValue: [ipv6Addrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties, commonSharedOptions);
    });

    it('Mix address types', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [mixAddrs],
                expectedValue: [mixAddrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties);
    });

    it('Mix address types in Common-Shared', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [mixAddrs],
                expectedValue: [mixAddrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties, commonSharedOptions);
    });

    it('Update from IPv4 to mix', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [ipv4Addrs, mixAddrs],
                expectedValue: [ipv4Addrs, mixAddrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties);
    });

    it('Update from IPv4 to mix in Common-Shared', () => {
        const properties = [
            {
                name: 'snatAddresses',
                inputValue: [ipv4Addrs, mixAddrs],
                expectedValue: [ipv4Addrs, mixAddrs],
                extractFunction: getAddresses
            }
        ];
        return assertSnatPoolClass(properties, commonSharedOptions);
    });
});

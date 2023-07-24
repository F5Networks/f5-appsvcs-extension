/**
 * Copyright 2023 F5 Networks, Inc.
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

describe('SOCKS_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertSocksProfile(properties, options) {
        return assertClass('SOCKS_Profile', properties, options);
    }

    it('All properties', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: 'socksDnsResolver1',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: 'socksDnsResolver2',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '2600' }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: 'id-2601', id: '2601' }
                }
            ]
        };

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'This is a description', undefined],
                expectedValue: ['none', 'This is a description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'protocolVersions',
                inputValue: [undefined, ['socks4'], undefined],
                expectedValue: [
                    ['socks4', 'socks4a', 'socks5'],
                    ['socks4'],
                    ['socks4', 'socks4a', 'socks5']
                ]
            },
            {
                name: 'resolver',
                inputValue: [
                    { bigip: '/Common/socksDnsResolver1' },
                    { bigip: '/Common/socksDnsResolver2' },
                    { bigip: '/Common/socksDnsResolver1' }
                ],
                expectedValue: ['/Common/socksDnsResolver1', '/Common/socksDnsResolver2', '/Common/socksDnsResolver1'],
                extractFunction: (o) => o.dnsResolver.fullPath
            },
            {
                name: 'ipv6First',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'routeDomain',
                inputValue: [undefined, 2600, 'id-2601', undefined],
                expectedValue: ['/Common/0', '/Common/2600', '/Common/id-2601', '/Common/0'],
                extractFunction: (o) => o.routeDomain.fullPath
            },
            {
                name: 'tunnelName',
                inputValue: [undefined, 'http-tunnel', undefined],
                expectedValue: ['/Common/socks-tunnel', '/Common/http-tunnel', '/Common/socks-tunnel'],
                extractFunction: (o) => o.tunnelName.fullPath
            },
            {
                name: 'defaultConnectAction',
                inputValue: [undefined, 'allow', undefined],
                expectedValue: ['deny', 'allow', 'deny']
            }
        ];

        return assertSocksProfile(properties, options);
    });
});

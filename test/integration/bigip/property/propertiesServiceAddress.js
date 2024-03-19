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

const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Service_Address', function () {
    this.timeout(GLOBAL_TIMEOUT);

    const options = {
        getMcpObject: {
            itemKind: 'tm:ltm:virtual-address:virtual-addressstate'
        },
        bigipItems: [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '1010' }
            },
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '2323' }
            }
        ]
    };

    function assertServiceAddressClass(properties, tenantRD) {
        if (tenantRD) {
            options.tenantRouteDomain = tenantRD;
        }
        return assertClass('Service_Address', properties, options);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['123.123.123.123', '123.123.123.123/0', '123.123.123.123/13'],
                expectedValue: ['123.123.123.123'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['255.255.255.255', 'any', '255.248.0.0']
            },
            {
                name: 'arpEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                extractFunction: (o) => o.arp
            },
            {
                name: 'icmpEcho',
                inputValue: [undefined, 'disable', undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                extractFunction: (o) => o.icmpEcho
            },
            {
                name: 'routeAdvertisement',
                inputValue: [undefined, 'enable', undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.routeAdvertisement
            },
            {
                name: 'serverScope',
                inputValue: [undefined, 'all', 'none', undefined, 'all', undefined],
                expectedValue: ['any', 'all', 'none', 'any', 'all', 'any'],
                extractFunction: (o) => o.serverScope
            },
            {
                name: 'spanningEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.spanning
            },
            {
                name: 'trafficGroup',
                inputValue: [undefined, '/Common/traffic-group-local-only', undefined],
                expectedValue: [
                    '/Common/traffic-group-1',
                    '/Common/traffic-group-local-only',
                    '/Common/traffic-group-1'
                ],
                extractFunction: (o) => o.trafficGroup.fullPath
            }
        ];

        return assertServiceAddressClass(properties);
    });

    it('Wildcard IPv4', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['0.0.0.0'],
                expectedValue: ['any'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['any']
            }
        ];
        return assertServiceAddressClass(properties);
    });

    it('Wildcard-like IPv4', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['100.0.0.0', '100.0.0.0/16', '100.0.0.0/1'],
                expectedValue: ['100.0.0.0', '100.0.0.0', '100.0.0.0'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['255.255.255.255', '255.255.0.0', '128.0.0.0']
            }
        ];
        return assertServiceAddressClass(properties);
    });

    it('Wildcard-like IPv4 in IPv6', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['2001::100.0.0.0', '2001::100.0.0.0/16', '2001::100.0.0.0/1'],
                expectedValue: ['2001::6400:0', '2001::6400:0', '2001::6400:0'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'ffff::', '8000::']
            }
        ];
        return assertServiceAddressClass(properties);
    });

    it('Wildcard IPv6', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['::'],
                expectedValue: ['any6']
            }
        ];
        return assertServiceAddressClass(properties);
    });

    it('Wildcard with tenant defaultRouteDomain', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['0.0.0.0'],
                expectedValue: ['any%2323'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['any']
            }
        ];
        return assertServiceAddressClass(properties, 2323);
    });

    it('Wildcard with tenant defaultRouteDomain and destination routeDomain', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['0.0.0.0%1010'],
                expectedValue: ['any%1010'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['any']
            }
        ];
        return assertServiceAddressClass(properties, 2323);
    });

    it('Wildcard IPv6 with default RD', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['::'],
                expectedValue: ['any6%2323']
            }
        ];
        return assertServiceAddressClass(properties, 2323);
    });

    it('Wildcard IPv6 with RD', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['::%1010'],
                expectedValue: ['any6%1010']
            }
        ];
        return assertServiceAddressClass(properties);
    });

    it('Host address with tenant defaultRouteDomain and destination routeDomain', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['10.0.0.1%1010'],
                expectedValue: ['10.0.0.1%1010'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['255.255.255.255']
            }
        ];
        return assertServiceAddressClass(properties, 2323);
    });

    it('Wildcard-like IPv4 with routeDomain', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['100.0.0.0%2323', '100.0.0.0%2323/16', '100.0.0.0%2323/1'],
                expectedValue: ['100.0.0.0%2323', '100.0.0.0%2323', '100.0.0.0%2323'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['255.255.255.255', '255.255.0.0', '128.0.0.0']
            }
        ];
        return assertServiceAddressClass(properties, 2323);
    });

    it('Wildcard-like IPv4 in IPv6 with routeDomain', function () {
        const properties = [
            {
                name: 'virtualAddress',
                inputValue: ['2001::100.0.0.0%2323', '2001::100.0.0.0%2323/16', '2001::100.0.0.0%2323/1'],
                expectedValue: ['2001::6400:0%2323', '2001::6400:0%2323', '2001::6400:0%2323'],
                extractFunction: (o) => o.address
            },
            {
                // The expected values are based on the supplied /CIDR address
                name: 'netmask',
                expectedValue: ['ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'ffff::', '8000::']
            }
        ];
        return assertServiceAddressClass(properties, 2323);
    });
});

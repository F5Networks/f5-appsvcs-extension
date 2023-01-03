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
    assertModuleProvisioned,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const requestUtil = require('../../../common/requestUtilPromise');

describe('Firewall_Address_List', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertFirewallAddressListClass(properties, options) {
        return assertClass('Firewall_Address_List', properties, options);
    }

    const addresses = [
        '10.2.10.10',
        '10.3.10.10-10.9.10.10',
        '10.10.10.0/24',
        'fdf5:4153:3300::a',
        'fdf5:4153:3300::b-fdf5:4153:3300::f',
        'fdf5:4153:6600::/54'
    ];

    const geo = [
        'US:California',
        'US:Washington'
    ];

    // TODO: add "fqdns" property once AS3 supports setting global-fqdn-policy
    it('All Properties', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'addresses',
                inputValue: [['10.1.10.10'], addresses, ['10.1.10.10']],
                expectedValue: [
                    [{ name: '10.1.10.10' }],
                    addresses.map((a) => ({ name: a })),
                    [{ name: '10.1.10.10' }]
                ]
            },
            {
                name: 'geo',
                inputValue: [undefined, geo, undefined],
                expectedValue: [undefined, geo.map((g) => ({ name: g })), undefined]
            },
            {
                name: 'addressLists',
                inputValue: [undefined, [{ use: 'addressListChild' }], undefined],
                expectedValue: [undefined, 'addressListChild', undefined],
                extractFunction: (o) => ((o.addressLists || [])[0] || {}).name,
                referenceObjects: {
                    addressListChild: {
                        class: 'Firewall_Address_List',
                        addresses: ['10.11.10.10']
                    }
                }
            }/* ,
            {
                name: 'fqdns',
                inputValue: [undefined, ['example.com'], undefined],
                expectedValue: [undefined, ['example.com'], undefined]
            } */
        ];

        return assertFirewallAddressListClass(properties);
    });

    it('Undefined Addresses', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'addresses',
                inputValue: [undefined, addresses, undefined],
                expectedValue: [undefined, addresses.map((a) => ({ name: a })), undefined]
            },
            {
                name: 'geo',
                inputValue: [['US:Oregon'], geo, ['US:Oregon']],
                expectedValue: [
                    [{ name: 'US:Oregon' }],
                    geo.map((g) => ({ name: g })),
                    [{ name: 'US:Oregon' }]
                ]
            }
        ];

        return assertFirewallAddressListClass(properties);
    });

    it('Service Discovery Addresses', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'addresses',
                inputValue: [
                    undefined,
                    addresses.concat([{ addressDiscovery: 'event' }]),
                    undefined],
                expectedValue: [
                    undefined,
                    addresses.reduce((arr, a) => {
                        arr.push({ name: a });
                        if (a === '10.10.10.0/24') {
                            arr.push({ name: '192.0.2.3' });
                            arr.push({ name: '192.0.2.4' });
                        }
                        return arr;
                    }, []),
                    undefined],
                preFetchFunction: (index) => {
                    if (index !== 1) {
                        return Promise.resolve();
                    }

                    const options = {
                        body: [
                            {
                                id: 'spam',
                                ip: '192.0.2.3'
                            },
                            {
                                id: 'eggs',
                                ip: '192.0.2.4'
                            }
                        ],
                        path: `/mgmt/shared/service-discovery/task/~TEST_Firewall_Address_List~Application~${getItemName({ tenantName: 'TEST_Firewall_Address_List' })}/nodes`,
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil.post(options);
                }
            },
            {
                name: 'geo',
                inputValue: [['US:Oregon'], geo, ['US:Oregon']],
                expectedValue: [
                    [{ name: 'US:Oregon' }],
                    geo.map((g) => ({ name: g })),
                    [{ name: 'US:Oregon' }]
                ]
            }
        ];

        return assertFirewallAddressListClass(properties, { maxMcpRetries: -1 });
    });

    it('Empty Address List', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'addresses',
                inputValue: [
                    [{ addressDiscovery: 'event' }],
                    ['192.0.2.3'],
                    [{ addressDiscovery: 'event' }]
                ],
                expectedValue: [
                    [{ name: '::1:5ee:bad:c0de' }],
                    [{ name: '192.0.2.3' }],
                    [{ name: '::1:5ee:bad:c0de' }]
                ]
            }
        ];

        return assertFirewallAddressListClass(properties, { maxMcpRetries: -1 });
    });
});

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
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('NAT_Source_Translation', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertNatSourceTranslationClass(properties) {
        return assertClass('NAT_Source_Translation', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'addresses',
                inputValue: [['3.4.5.6'], ['3.4.5.6', '4.5.6.7'], ['3.4.5.6']],
                expectedValue: [
                    [
                        {
                            name: '3.4.5.6'
                        }
                    ],
                    [
                        {
                            name: '3.4.5.6'
                        },
                        {
                            name: '4.5.6.7'
                        }
                    ],
                    [
                        {
                            name: '3.4.5.6'
                        }
                    ]
                ]
            },
            {
                name: 'allowEgressInterfaces',
                inputValue: [
                    undefined,
                    [
                        {
                            bigip: '/Common/http-tunnel'
                        }
                    ],
                    undefined,
                    undefined
                ],
                expectedValue: [
                    undefined,
                    true,
                    undefined,
                    undefined
                ],
                extractFunction: (o) => o.egressInterfacesEnabled
            },
            {
                name: 'clientConnectionLimit',
                inputValue: [undefined, 1234567, undefined],
                expectedValue: [0, 1234567, 0]
            },
            {
                name: 'disallowEgressInterfaces',
                inputValue: [
                    undefined,
                    undefined,
                    [
                        {
                            bigip: '/Common/socks-tunnel'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    true,
                    undefined,
                    true,
                    true
                ],
                extractFunction: (o) => o.egressInterfacesDisabled
            },
            {
                name: 'hairpinModeEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'inboundMode',
                inputValue: [undefined, 'endpoint-independent-filtering', undefined],
                expectedValue: ['none', 'endpoint-independent-filtering', 'none']
            },
            {
                name: 'mapping',
                inputValue: [
                    undefined,
                    {
                        mode: 'endpoint-independent-mapping',
                        timeout: 301
                    },
                    undefined
                ],
                expectedValue: [
                    {
                        mode: 'address-pooling-paired',
                        timeout: 300
                    },
                    {
                        mode: 'endpoint-independent-mapping',
                        timeout: 301
                    },
                    {
                        mode: 'address-pooling-paired',
                        timeout: 300
                    }
                ]
            },
            {
                name: 'patMode',
                inputValue: [undefined, 'pba', undefined],
                expectedValue: ['napt', 'pba', 'napt']
            },
            {
                name: 'portBlockAllocation',
                inputValue: [
                    undefined,
                    {
                        blockIdleTimeout: 3700,
                        blockLifetime: 10000,
                        blockSize: 1,
                        clientBlockLimit: 2,
                        zombieTimeout: 1700
                    },
                    undefined
                ],
                expectedValue: [
                    {
                        blockIdleTimeout: 3600,
                        blockLifetime: 0,
                        blockSize: 64,
                        clientBlockLimit: 1,
                        zombieTimeout: 0
                    },
                    {
                        blockIdleTimeout: 3700,
                        blockLifetime: 10000,
                        blockSize: 1,
                        clientBlockLimit: 2,
                        zombieTimeout: 1700
                    },
                    {
                        blockIdleTimeout: 3600,
                        blockLifetime: 0,
                        blockSize: 64,
                        clientBlockLimit: 1,
                        zombieTimeout: 0
                    }
                ]
            },
            {
                name: 'ports',
                inputValue: [
                    [321],
                    [123],
                    [321]
                ],
                expectedValue: [
                    [
                        {
                            name: '321'
                        }
                    ],
                    [
                        {
                            name: '123'
                        }
                    ],
                    [
                        {
                            name: '321'
                        }
                    ]
                ]
            },
            {
                name: 'routeAdvertisement',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'type',
                inputValue: ['dynamic-pat'],
                expectedValue: ['dynamic-pat']
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            properties.push({
                name: 'excludeAddresses',
                inputValue: [undefined, ['3.4.5.8', '4.5.6.9/32', '10.0.0.0-10.0.0.255', { use: 'addressListChild' }], undefined],
                extractFunction: (o) => {
                    const excludeAddress = [];
                    (o.excludeAddresses || []).forEach((addr) => {
                        excludeAddress.push(addr.name);
                    });
                    (o.excludeAddressLists || []).forEach((addr) => {
                        excludeAddress.push(addr.addresses.map((a) => a.name));
                    });
                    return excludeAddress;
                },
                expectedValue: [
                    [],
                    ['3.4.5.8', '4.5.6.9/32', '10.0.0.0-10.0.0.255', ['10.11.10.10']],
                    []
                ],
                referenceObjects: {
                    addressListChild: {
                        class: 'Firewall_Address_List',
                        addresses: ['10.11.10.10']
                    }
                }
            });
        }

        return assertNatSourceTranslationClass(properties);
    });
});

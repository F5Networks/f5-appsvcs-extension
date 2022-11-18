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
    assertMultipleItems,
    deleteBigipItems,
    extractProfile,
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT,
    logEvent
} = require('./propertiesCommon');
const requestUtil = require('../../../common/requestUtilPromise');
const util = require('../../../../src/lib/util/util');

// Just missing allowVlans and rejectVlans
describe('Service_Generic', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertServiceGenericClass(properties, options) {
        return assertClass('Service_Generic', properties, options);
    }

    function assertMultiple(properties) {
        return assertMultipleItems('Service_Generic', properties, 2);
    }

    function testCleanup() {
        return Promise.resolve()
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/virtual-address?$filter=partition+eq+Common' }))
            .then((result) => {
                const addr = (result.body.items || [])
                    .find((a) => a.fullPath === '/Common/any6');
                if (addr) {
                    const msg = 'Virtual address /Common/any6 found after test. Will try to delete.';
                    console.log(msg);
                    logEvent(msg);

                    return deleteBigipItems(
                        [
                            {
                                endpoint: '/mgmt/tm/ltm/virtual-address',
                                data: {
                                    name: 'any6',
                                    partition: 'Common'
                                }
                            }
                        ]
                    );
                }
                return Promise.resolve();
            });
    }

    it('Basic properties', function () {
        const properties = [
            // REQUIRED
            {
                name: 'virtualPort',
                inputValue: [100, 200, 100],
                expectedValue: ['100', '200', '100'],
                extractFunction: (o) => {
                    // if it's IPv6 there'll be greater more than 1 ':', so we indicate virtualPort with a '.'
                    const delimiter = ((o.destination.split(':').length > 2) ? '.' : ':');
                    return o.destination.split(delimiter)[1];
                }
            },
            {
                name: 'virtualAddresses',
                inputValue: [
                    ['20.16.0.0/12'],
                    [['21.21.21.16/28', '12.12.12.0/28']],
                    ['2001:0db8:85a3:0:0:0:0:0/64']
                ],
                expectedValue: [
                    {
                        destination: '/TEST_Service_Generic/20.16.0.0:100',
                        netmask: '255.240.0.0',
                        source: '0.0.0.0/0'
                    },
                    {
                        destination: '/TEST_Service_Generic/21.21.21.16:200',
                        netmask: '255.255.255.240',
                        source: '12.12.12.0/28'
                    },
                    {
                        destination: '/TEST_Service_Generic/2001:db8:85a3::.100',
                        netmask: 'ffff:ffff:ffff:ffff::',
                        source: '::/0'
                    }
                ],
                extractFunction: (o) => {
                    const destination = o.destination;
                    const netmask = o.mask;
                    const source = o.source;
                    return { destination, netmask, source };
                }
            },

            // TESTED
            {
                name: 'layer4',
                inputValue: ['any', 'tcp', 'any'],
                expectedValue: ['any', 'tcp', 'any']
            },
            {
                name: 'profileIPOther',
                inputValue: [
                    undefined, { use: 'ipotherProfile' }, undefined
                ],
                expectedValue: ['ipother', 'ipotherProfile', 'ipother'],
                extractFunction: extractProfile,
                referenceObjects: {
                    ipotherProfile: {
                        class: 'IP_Other_Profile'
                    }
                }
            },
            {
                name: 'maxConnections',
                inputValue: [0, 150, 0],
                expectedValue: [0, 150, 0]
            },
            {
                name: 'rateLimit',
                inputValue: [0, 100, 0],
                expectedValue: ['disabled', 100, 'disabled']
            },
            {
                name: 'snat',
                inputValue: [undefined, 'none', undefined],
                expectedValue: ['automap', 'none', 'automap'],
                extractFunction: (o) => o.sourceAddressTranslation.type
            },
            {
                name: 'iRules',
                inputValue: [
                    [],
                    [
                        'theRule1',
                        { use: 'theRule2' }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        '/TEST_Service_Generic/Application/theRule1',
                        '/TEST_Service_Generic/Application/theRule2'
                    ],
                    []
                ],
                extractFunction: (o) => {
                    const values = [];
                    if (o.rules) {
                        o.rules.forEach((r) => values.push(r.fullPath));
                    }
                    return values;
                },
                referenceObjects: {
                    theRule1: {
                        class: 'iRule',
                        iRule: 'when CLIENT_ACCEPTED { }'
                    },
                    theRule2: {
                        class: 'iRule',
                        iRule: 'when CLIENT_ACCEPTED { }'
                    }
                }
            },
            {
                name: 'pool',
                inputValue: [
                    undefined,
                    'testPool1',
                    { use: 'testPool2' },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    '/TEST_Service_Generic/Application/testPool1',
                    '/TEST_Service_Generic/Application/testPool2',
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.pool) {
                        return o.pool.fullPath;
                    }
                    return undefined;
                },
                referenceObjects: {
                    testPool1: {
                        class: 'Pool',
                        serviceDownAction: 'reset'
                    },
                    testPool2: {
                        class: 'Pool'
                    }
                }
            },
            {
                name: 'addressStatus',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'mirroring',
                inputValue: [undefined, 'L4', undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'lastHop',
                inputValue: [undefined, 'disable', undefined],
                expectedValue: ['default', 'disabled', 'default'],
                extractFunction: (o) => o.autoLasthop
            },
            {
                name: 'translateClientPort',
                inputValue: [undefined, true, undefined],
                expectedValue: ['preserve', 'change', 'preserve']
            },
            {
                name: 'translateServerAddress',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'translateServerPort',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'nat64Enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'persistenceMethods',
                inputValue: [
                    [],
                    ['destination-address'],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['dest_addr'],
                    []
                ],
                extractFunction: (o) => {
                    if (o.persist) {
                        return o.persist.map((p) => p.name);
                    }
                    return [];
                }
            },
            {
                name: 'fallbackPersistenceMethod',
                inputValue: [undefined, 'source-address', undefined],
                expectedValue: [undefined, 'source_addr', undefined],
                extractFunction: (o) => {
                    if (o.fallbackPersistence) {
                        return o.fallbackPersistence.name;
                    }
                    return undefined;
                }
            },
            {
                name: 'metadata',
                inputValue: [
                    undefined,
                    {
                        testFalse: {
                            value: 'test Other Value',
                            persist: false
                        }
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    [{
                        name: 'testFalse',
                        value: 'test Other Value',
                        persist: 'false'
                    }],
                    undefined
                ]
            },
            {
                name: 'clonePools',
                inputValue: [
                    undefined,
                    {
                        ingress: { use: 'testPool1' },
                        egress: { use: 'testPool2' }
                    },
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            name: 'testPool1',
                            partition: 'TEST_Service_Generic',
                            subPath: 'Application',
                            context: 'clientside'
                        },
                        {
                            name: 'testPool2',
                            partition: 'TEST_Service_Generic',
                            subPath: 'Application',
                            context: 'serverside'
                        }
                    ],
                    []
                ],
                extractFunction: (o) => (o.clonePools || []).map((p) => ({
                    name: p.name,
                    partition: p.partition,
                    subPath: p.subPath,
                    context: p.context
                })),
                referenceObjects: {
                    testPool1: {
                        class: 'Pool'
                    },
                    testPool2: {
                        class: 'Pool'
                    }
                }
            },
            {
                name: 'policyBandwidthControl',
                inputValue: [undefined, { use: 'bwcPolicy' }, undefined],
                expectedValue: [undefined, 'bwcPolicy', undefined],
                extractFunction: (o) => ((o.bwcPolicy) ? o.bwcPolicy.name : undefined),
                referenceObjects: {
                    bwcPolicy: {
                        class: 'Bandwidth_Control_Policy',
                        maxBandwidth: 10
                    }
                }
            },
            {
                name: 'adminState',
                inputValue: [undefined, 'disable', undefined],
                expectedValue: [true, false, true],
                extractFunction: (o) => o.enabled === true
            }

            // REQUIRE MODULES
            /*
            {
                name: 'securityLogProfiles',
                inputValue: [
                    [
                        { use: 'securityLogProfile1' }
                    ],
                    [
                        { use: 'securityLogProfile2' }
                    ]
                ],
                expectedValue: [
                    ['/TEST_Service_Generic/Application/securityLogProfile1'],
                    ['/TEST_Service_Generic/Application/securityLogProfile2']
                ],
                extractFunction: (o) => {
                    const values = [];
                    o.securityLogProfiles.forEach(r => values.push(r.fullPath));
                    return values;
                },
                referenceObjects: {
                    securityLogProfile1: {
                        class: 'Security_Log_Profile'
                    },
                    securityLogProfile2: {
                        class: 'Security_Log_Profile'
                    }
                }
            } */

            // Still need tested
            /*
            {
                name: 'allowVlans',
                inputvalue: [],
                expectedValue: []
            },
            {
                name: 'rejectVlans',
                inputvalue: [],
                expectedValue: []
            } */
        ];
        return assertServiceGenericClass(properties);
    });

    it('virtualAddresses 0.0.0.0 and double colon should be idempotent', () => {
        // windows cannot unzip test logs when there is a '::' in the test name
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [80],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [
                    ['0.0.0.0'],
                    ['::'],
                    [['0.0.0.0', '12.12.12.0/28']]
                ],
                expectedValue: [
                    {
                        destination: '/Common/any:80',
                        netmask: 'any',
                        source: '0.0.0.0/0'
                    },
                    {
                        destination: '/Common/any6.80',
                        netmask: 'any6',
                        source: '::/0'
                    },
                    {
                        destination: '/Common/any:80',
                        netmask: 'any',
                        source: '12.12.12.0/28'
                    }
                ],
                extractFunction: (o) => {
                    const destination = o.destination;
                    const netmask = o.mask;
                    const source = o.source;
                    return { destination, netmask, source };
                }
            },
            {
                name: 'shareAddresses',
                inputValue: [true],
                skipAssert: true
            }
        ];

        return assertServiceGenericClass(properties)
            .finally(() => testCleanup());
    });

    it('virtualAddresses 0.0.0.0 and double colon with RD should be idempotent', () => {
        // windows cannot unzip test logs when there is a '::' in the test name
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '1111' }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '2222' }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [80],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [
                    ['0.0.0.0%1111'],
                    ['::'], // Note: We cannot use RD on this input till AUTOTOOL-3517 is fixed
                    [['0.0.0.0%1111', '12.12.12.0%1111/28']]
                ],
                expectedValue: [
                    {
                        destination: '/Common/any%1111:80',
                        netmask: 'any',
                        source: '0.0.0.0%1111/0'
                    },
                    {
                        destination: '/Common/any6.80',
                        netmask: 'any6',
                        source: '::/0'
                    },
                    {
                        destination: '/Common/any%1111:80',
                        netmask: 'any',
                        source: '12.12.12.0%1111/28'
                    }
                ],
                extractFunction: (o) => {
                    const destination = o.destination;
                    const netmask = o.mask;
                    const source = o.source;
                    return { destination, netmask, source };
                }
            },
            {
                name: 'shareAddresses',
                inputValue: [true],
                skipAssert: true
            }
        ];

        return assertServiceGenericClass(properties, options)
            .finally(() => testCleanup());
    });

    it('AFM properties', function () {
        assertModuleProvisioned.call(this, 'afm');

        const references = {
            firewallPolicy1: {
                class: 'Firewall_Policy',
                rules: [
                    {
                        use: 'ruleList'
                    }
                ]
            },
            firewallPolicy2: {
                class: 'Firewall_Policy',
                rules: [
                    {
                        use: 'ruleList'
                    }
                ]
            },
            ruleList: {
                class: 'Firewall_Rule_List',
                rules: [
                    {
                        name: 'theRule',
                        action: 'accept'
                    }
                ]
            }
        };

        let infiniteBandwidthValue = 'infinite';
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            infiniteBandwidthValue = 0;
        }

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'snat',
                inputValue: ['none'],
                expectedValue: ['none'],
                extractFunction: (o) => o.sourceAddressTranslation.type
            },
            {
                name: 'policyNAT',
                inputValue: [
                    { use: 'natPolicy1' },
                    { use: 'natPolicy2' }
                ],
                expectedValue: [
                    '/TEST_Service_Generic/Application/natPolicy1',
                    '/TEST_Service_Generic/Application/natPolicy2'
                ],
                extractFunction: (o) => o.securityNatPolicy.policy,
                referenceObjects: {
                    natPolicy1: {
                        class: 'NAT_Policy'
                    },
                    natPolicy2: {
                        class: 'NAT_Policy'
                    }
                }
            },
            {
                name: 'policyFirewallStaged',
                inputValue: [
                    { use: 'firewallPolicy1' },
                    { use: 'firewallPolicy2' },
                    undefined
                ],
                expectedValue: ['firewallPolicy1', 'firewallPolicy2', undefined],
                extractFunction: (o) => ((o.fwStagedPolicy) ? o.fwStagedPolicy.name : undefined),
                referenceObjects: references
            },
            {
                name: 'policyFirewallEnforced',
                inputValue: [
                    { use: 'firewallPolicy2' },
                    { use: 'firewallPolicy1' },
                    undefined
                ],
                expectedValue: ['firewallPolicy2', 'firewallPolicy1', undefined],
                extractFunction: (o) => ((o.fwEnforcedPolicy) ? o.fwEnforcedPolicy.name : undefined),
                referenceObjects: references
            },
            {
                name: 'maximumBandwidth',
                inputValue: [undefined, 10, undefined],
                expectedValue: [infiniteBandwidthValue, 10, infiniteBandwidthValue]
            }
        ];

        return assertServiceGenericClass(properties);
    });

    it('PEM properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'profileClassification',
                inputValue: [
                    undefined,
                    { bigip: '/Common/classification' },
                    { bigip: '/Common/classification_pem' },
                    undefined
                ],
                expectedValue: [undefined, 'classification', 'classification_pem', undefined],
                extractFunction: extractProfile
            },
            {
                name: 'profileEnforcement',
                inputValue: [
                    undefined,
                    { bigip: '/Common/spm' },
                    { use: 'pemProfile' },
                    undefined
                ],
                expectedValue: [undefined, 'spm', 'pemProfile', undefined],
                extractFunction: extractProfile,
                referenceObjects: {
                    pemProfile: {
                        class: 'Enforcement_Profile'
                    }
                }
            },
            {
                name: 'profileSubscriberManagement',
                inputValue: [
                    undefined,
                    { bigip: '/Common/subscriber-mgmt' },
                    { use: 'subManProfile' },
                    undefined
                ],
                expectedValue: [undefined, 'subscriber-mgmt', 'subManProfile', undefined],
                extractFunction: extractProfile,
                referenceObjects: {
                    subManProfile: {
                        class: 'Enforcement_Subscriber_Management_Profile'
                    }
                }
            }
        ];

        return assertServiceGenericClass(properties);
    });

    it('Analytics TCP profile properties', function () {
        assertModuleProvisioned.call(this, 'avr');

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'profileAnalyticsTcp',
                inputValue: [
                    undefined,
                    { bigip: '/Common/tcp-analytics' },
                    { use: 'analyticsTcpProfile' },
                    undefined
                ],
                expectedValue: [undefined, 'tcp-analytics', 'analyticsTcpProfile', undefined],
                extractFunction: extractProfile,
                referenceObjects: {
                    analyticsTcpProfile: {
                        class: 'Analytics_TCP_Profile'
                    }
                }
            }
        ];

        return assertServiceGenericClass(properties);
    });

    it('Test for Multiple Virtuals', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [100],
                expectedValue: ['100'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.2', '1.2.3.4']],
                expectedValue: ['1.1.1.2'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            }
        ];

        return assertMultiple(properties, 2);
    });

    it('Share address with pool', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [3868],
                expectedValue: ['3868'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['10.1.40.8']],
                expectedValue: ['10.1.40.8'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            },
            {
                name: 'pool',
                inputValue: ['testPool'],
                expectedValue: ['/TEST_Service_Generic/Application/testPool'],
                extractFunction: (o) => o.pool.fullPath,
                referenceObjects: {
                    testPool: {
                        class: 'Pool',
                        members: [{
                            servicePort: 3868,
                            serverAddresses: ['10.1.40.8']
                        }]
                    }
                }
            }
        ];

        return assertServiceGenericClass(properties);
    });

    it('Should create a snat pool', () => {
        const properties = [
            // REQUIRED
            {
                name: 'virtualPort',
                inputValue: [100, 200, 100],
                expectedValue: ['100', '200', '100'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'snat',
                inputValue: [undefined, 'self', undefined],
                expectedValue: ['automap', 'snat', 'automap'],
                extractFunction: (o) => o.sourceAddressTranslation.type
            },
            {
                name: 'virtualAddresses',
                inputValue: [
                    ['20.20.20.20'],
                    ['21.21.21.21'],
                    ['20.20.20.20']
                ],
                expectedValue: ['20.20.20.20', '21.21.21.21', '20.20.20.20'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            }
        ];

        return assertServiceGenericClass(properties);
    });

    it('Should config enum translateClientPort', () => {
        const properties = [
            // 'Basic properties' handles boolean
            {
                name: 'virtualPort',
                inputValue: [100, 200, 100],
                expectedValue: ['100', '200', '100'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'translateClientPort',
                inputValue: [undefined, 'preserve-strict', undefined],
                expectedValue: ['preserve', 'preserve-strict', 'preserve']
            },
            {
                name: 'virtualAddresses',
                inputValue: [
                    ['20.20.20.20'],
                    ['21.21.21.21'],
                    ['20.20.20.20']
                ],
                expectedValue: ['20.20.20.20', '21.21.21.21', '20.20.20.20'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            }
        ];

        return assertServiceGenericClass(properties);
    });

    it('should configure idle timeout policies', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'policyIdleTimeout',
                inputValue: [
                    undefined,
                    { use: 'idleTimeoutPolicy' },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    '/TEST_Service_Generic/Application/f5_appsvcs_26baeb37811d8ff2a7634baeeb6b1349',
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.servicePolicy) {
                        return o.servicePolicy.fullPath;
                    }
                    return undefined;
                },
                referenceObjects: {
                    idleTimeoutPolicy: {
                        class: 'Idle_Timeout_Policy'
                    }
                }
            }
        ];
        return assertServiceGenericClass(properties);
    });

    it('should update iRule order', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [80],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [
                    ['20.16.0.0/12']
                ],
                skipAssert: true
            },
            {
                name: 'iRules',
                inputValue: [
                    [
                        'theRule1',
                        'theRule2'
                    ],
                    [
                        'theRule2',
                        'theRule1'
                    ],
                    undefined
                ],
                expectedValue: [
                    [
                        '/TEST_Service_Generic/Application/theRule1',
                        '/TEST_Service_Generic/Application/theRule2'
                    ],
                    [
                        '/TEST_Service_Generic/Application/theRule2',
                        '/TEST_Service_Generic/Application/theRule1'
                    ],
                    []
                ],
                extractFunction: (o) => {
                    const values = [];
                    if (o.rules) {
                        o.rules.forEach((r) => values.push(r.fullPath));
                    }
                    return values;
                },
                referenceObjects: {
                    theRule1: {
                        class: 'iRule',
                        iRule: 'when CLIENT_ACCEPTED { }'
                    },
                    theRule2: {
                        class: 'iRule',
                        iRule: 'when CLIENT_ACCEPTED { }'
                    }
                }
            }
        ];
        return assertServiceGenericClass(properties);
    });
});

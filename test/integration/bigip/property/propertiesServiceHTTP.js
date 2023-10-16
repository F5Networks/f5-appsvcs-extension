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
    getProvisionedModules,
    extractPolicy,
    extractProfile,
    getBigIpVersion,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');
const constants = require('../../../../src/lib/constants');
const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

describe('Service_HTTP', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertServiceHTTPClass(properties, options) {
        return assertClass('Service_HTTP', properties, options);
    }

    it('policyEndpoint As Array, Websocket Profile, HTTP Proxy Connect Profile, and IP Intelligence Policy', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const tenantName = 'test.tenant.name-with-dots-and-dashes-';
        const applicationName = 'test.app-name.';

        let dosProfileExpected = ['dosProfile'];
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            dosProfileExpected = ['dosProfile', 'f5_appsvcs_dosProfile_botDefense'];
        }

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/policy',
                    data: {
                        name: 'ltmPolicy',
                        strategy: '/Common/first-match',
                        legacy: true,
                        rules: [{ name: 'rule' }]
                    }
                }
            ],
            maxPathLength: constants.MAX_PATH_LENGTH - tenantName.length - applicationName.length,
            tenantName,
            applicationName
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [undefined, 8000, undefined],
                expectedValue: ['80', '8000', '80'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'policyEndpoint',
                inputValue: [
                    { use: 'endpointPolicy' },
                    ['endpointPolicy', { bigip: '/Common/ltmPolicy' }],
                    undefined
                ],
                expectedValue: [
                    ['endpointPolicy'],
                    ['ltmPolicy', 'endpointPolicy'],
                    []
                ],
                extractFunction: (o) => {
                    const policies = [];
                    o.policies.forEach((pol) => policies.push(pol.name));
                    return policies;
                },
                referenceObjects: {
                    endpointPolicy: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'rule'
                            }
                        ]
                    }
                }
            },
            {
                name: 'profileHTTP',
                inputValue: [undefined, { use: 'httpProfile' }, undefined],
                expectedValue: [
                    undefined,
                    [
                        `/${tenantName}/${applicationName}/f5_appsvcs_httpProfile_proxyConnect`,
                        `/${tenantName}/${applicationName}/httpProfile`
                    ],
                    undefined
                ],
                referenceObjects: {
                    httpProfile: {
                        class: 'HTTP_Profile',
                        proxyConnectEnabled: true
                    }
                },
                extractFunction: (o) => {
                    const profiles = o.profiles
                        .filter((p) => p.name === 'httpProfile' || p.name === 'f5_appsvcs_httpProfile_proxyConnect')
                        .map((profile) => profile.fullPath);
                    return (profiles.length > 0) ? profiles : undefined;
                }
            },
            {
                name: 'profileWebSocket',
                inputValue: [undefined, { use: 'webSocketProfile' }, undefined],
                expectedValue: [
                    undefined,
                    [`/${tenantName}/${applicationName}/webSocketProfile`],
                    undefined
                ],
                referenceObjects: {
                    webSocketProfile: {
                        class: 'WebSocket_Profile'
                    }
                },
                extractFunction: (o) => {
                    const profiles = o.profiles
                        .filter((p) => p.name === 'webSocketProfile')
                        .map((profile) => profile.fullPath);
                    return (profiles.length > 0) ? profiles : undefined;
                }
            },
            {
                name: 'profileDOS',
                inputValue: [
                    undefined,
                    { use: 'dosProfile' },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    dosProfileExpected,
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.profiles.find((p) => p.name === 'dosProfile')) {
                        const profiles = [];
                        profiles.push('dosProfile');
                        if (!util.versionLessThan(getBigIpVersion(), '14.1')
                        && o.profiles.find((p) => p.name === 'f5_appsvcs_dosProfile_botDefense')) {
                            profiles.push('f5_appsvcs_dosProfile_botDefense');
                        }
                        return profiles;
                    }
                    return undefined;
                },
                referenceObjects: {
                    dosProfile: {
                        class: 'DOS_Profile'
                    }
                }
            },
            {
                name: 'profileRewrite',
                inputValue: [undefined, { use: 'rewriteProfile' }, undefined],
                expectedValue: [undefined, 'rewriteProfile', undefined],
                referenceObjects: {
                    rewriteProfile: {
                        class: 'Rewrite_Profile',
                        rewriteMode: 'uri-translation'
                    }
                },
                extractFunction: (o) => {
                    const profile = o.profiles.find((p) => p.name === 'rewriteProfile');
                    return (profile !== undefined) ? profile.name : profile;
                }
            },
            {
                name: 'profileHTTPAcceleration',
                inputValue: [undefined, { use: 'accel' }, undefined],
                expectedValue: [undefined, 'accel', undefined],
                referenceObjects: {
                    accel: {
                        class: 'HTTP_Acceleration_Profile'
                    }
                },
                extractFunction: (o) => {
                    const profile = o.profiles.find((p) => p.name === 'accel');
                    return (profile !== undefined) ? profile.name : profile;
                }
            },
            {
                name: 'profileStream',
                inputValue: [undefined, { use: 'streamProfile' }, undefined],
                expectedValue: [undefined, 'streamProfile', undefined],
                extractFunction: (o) => {
                    const profile = o.profiles.find((p) => p.name === 'streamProfile');
                    return (profile !== undefined) ? profile.name : profile;
                },
                referenceObjects: {
                    streamProfile: {
                        class: 'Stream_Profile'
                    }
                }
            },
            {
                name: 'serviceDownImmediateAction',
                inputValue: [undefined, 'drop', undefined],
                expectedValue: ['none', 'drop', 'none']
            },
            {
                name: 'ipIntelligencePolicy',
                inputValue: [
                    undefined,
                    {
                        bigip: '/Common/ip-intelligence'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    '/Common/ip-intelligence',
                    undefined
                ],
                extractFunction: (o) => (o.ipIntelligencePolicy ? o.ipIntelligencePolicy.fullPath : undefined)
            }
        ];

        return assertServiceHTTPClass(properties, options);
    });

    it('IPv4 virtualAddresses list with route domain', function () {
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
            ],
            tenantRouteDomain: 1111
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.13'], ['1.1.1.14%2222'], ['1.1.1.15%1111']],
                expectedValue: ['1.1.1.13%1111', '1.1.1.14%2222', '1.1.1.15%1111'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('IPv6 virtualAddresses list with route domain', function () {
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
            ],
            tenantRouteDomain: 1111
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['2001:db8::13'], ['::ffff:10.0.0.1%2222'], ['2001:db8::15%1111']],
                expectedValue: ['2001:db8::13%1111', '::ffff:a00:1%2222', '2001:db8::15%1111'],
                extractFunction: (o) => o.destination.split('.')[0].split('/')[2]
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('IPv4 virtualAddresses list with changing default route domains', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '1111' }
                }
            ],
            tenantRouteDomain: [undefined, 1111, undefined]
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.13'], ['1.1.1.14'], ['1.1.1.15']],
                expectedValue: ['1.1.1.13', '1.1.1.14%1111', '1.1.1.15'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('IPv6 virtualAddresses list with changing default route domains', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '1111' }
                }
            ],
            tenantRouteDomain: [undefined, 1111, undefined]
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['2001:db8::13'], ['2001:db8::14'], ['2001:db8::15']],
                expectedValue: ['2001:db8::13', '2001:db8::14%1111', '2001:db8::15'],
                extractFunction: (o) => o.destination.split('.')[0].split('/')[2]
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('virtualAddresses bigip ref', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/virtual-address',
                    data: { name: '1.2.3.4' },
                    skipDelete: true
                }
            ]
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [[{ bigip: '/Common/1.2.3.4' }]],
                expectedValue: ['1.2.3.4'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('virtualAddresses bigip named ref with route-domain', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '1111' }
                },
                {
                    endpoint: '/mgmt/tm/ltm/virtual-address',
                    data: {
                        name: 'wildcard_v4_rtd1111',
                        address: 'any%1111',
                        partition: 'Common',
                        state: 'enabled'
                    },
                    skipDelete: true
                }
            ],
            skipIdempotentCheck: true
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [[{ bigip: '/Common/wildcard_v4_rtd1111' }]],
                skipAssert: true
            }
        ];

        return assertServiceHTTPClass(properties, options);
    });

    it('virtualAddresses use ref', function () {
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
            ],
            tenantRouteDomain: 1111
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [[{ use: 'testAddr' }], [{ use: 'testAddrIpv6' }]],
                expectedValue: ['testAddr', 'testAddrIpv6'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2],
                referenceObjects: {
                    testAddr: {
                        class: 'Service_Address',
                        virtualAddress: '0.0.0.0%2222'
                    },
                    testAddrIpv6: {
                        class: 'Service_Address',
                        virtualAddress: '::/0%2222'
                    }
                }
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('virtualAddresses bigip ref and source address', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/virtual-address',
                    data: { name: '1.2.3.4' },
                    skipDelete: true
                }
            ]
        };
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [
                    [[{ bigip: '/Common/1.2.3.4' }, '12.12.12.0/28']]
                ],
                expectedValue: [
                    {
                        destination: '/Common/1.2.3.4:80',
                        netmask: '255.255.255.255',
                        source: '12.12.12.0/28'
                    }
                ],
                extractFunction: (o) => {
                    const destination = o.destination;
                    const netmask = o.mask;
                    const source = o.source;
                    return { destination, netmask, source };
                }
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('virtualAddresses use ref and source address', function () {
        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [
                    [[{ use: 'testAddr' }, '12.12.12.0/28']]
                ],
                expectedValue: [
                    {
                        destination: '/TEST_Service_HTTP/testAddr:80',
                        netmask: '255.255.255.255',
                        source: '12.12.12.0/28'
                    }
                ],
                extractFunction: (o) => {
                    const destination = o.destination;
                    const netmask = o.mask;
                    const source = o.source;
                    return { destination, netmask, source };
                },
                referenceObjects: {
                    testAddr: {
                        class: 'Service_Address',
                        virtualAddress: '1.1.1.1/32'
                    }
                }
            }
        ];
        return assertServiceHTTPClass(properties);
    });

    it('policyWAF property', function () {
        assertModuleProvisioned.call(this, 'asm');

        validateEnvVars(['TEST_RESOURCES_URL']);

        // the bigd service sometimes restarts causing the next set of tests to fail
        const options = { checkServices: true };

        const policyHost = `${process.env.TEST_RESOURCES_URL}`;
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.1']],
                skipAssert: true
            }
        ];

        return Promise.resolve()
            .then(() => {
                const policyProperty = {
                    name: 'policyWAF',
                    inputValue: [
                        undefined,
                        { use: 'testWaf' },
                        undefined
                    ],
                    expectedValue: [
                        undefined,
                        `_WAF_${getItemName({ tenantName: 'TEST_Service_HTTP' })}`,
                        undefined
                    ],
                    extractFunction: extractPolicy,
                    referenceObjects: {
                        testWaf: {
                            class: 'WAF_Policy',
                            url: {
                                url: `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`
                            },
                            ignoreChanges: true
                        }
                    }
                };

                if (process.env.TEST_IN_AZURE === 'true') {
                    return oauth.getTokenForTest()
                        .then((token) => {
                            policyProperty.referenceObjects.testWaf.url.authentication = {
                                method: 'bearer-token',
                                token
                            };
                            properties.push(policyProperty);
                        });
                }

                properties.push(policyProperty);
                return Promise.resolve();
            })
            .then(() => assertServiceHTTPClass(properties, options));
    });

    it('profileAnalytics and profileAnalyticsTcp properties', function () {
        assertModuleProvisioned.call(this, 'avr');

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.1']],
                skipAssert: true
            },
            {
                name: 'profileAnalytics',
                inputValue: [undefined, { bigip: '/Common/analytics' }, undefined],
                expectedValue: [undefined, 'analytics', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'analytics')
            },
            {
                name: 'profileAnalyticsTcp',
                inputValue: [undefined, { bigip: '/Common/tcp-analytics' }, undefined],
                expectedValue: [undefined, 'tcp-analytics', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'tcp-analytics')
            }
        ];

        return assertServiceHTTPClass(properties);
    });

    it('profileAccess, profileConnectivity, and profileVdi properties', function () {
        assertModuleProvisioned.call(this, 'apm');

        const options = {
            useTransaction: true,
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/apm/policy/agent/ending-allow',
                    data: {
                        name: 'endAllowAgent'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'endAllowItem',
                        agents: [
                            {
                                name: '/Common/endAllowAgent',
                                type: 'ending-allow'
                            }
                        ],
                        caption: 'Allow',
                        color: 1,
                        'item-type': 'ending'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'startItem',
                        caption: 'Start',
                        color: 1,
                        rules: [
                            {
                                caption: 'fallback',
                                'next-item': '/Common/endAllowItem'
                            }
                        ]
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/access-policy',
                    data: {
                        name: 'accessPolicy',
                        'default-ending': '/Common/endAllowItem',
                        items: [
                            {
                                name: 'endAllowItem'
                            },
                            {
                                name: 'startItem'
                            }
                        ],
                        'start-item': 'startItem'
                    }
                },
                {
                    endpoint: '/mgmt/tm/apm/profile/access',
                    data: {
                        name: 'accessProfile',
                        'accept-languages': ['en'],
                        'access-policy': '/Common/accessPolicy',
                        'log-settings': ['default-log-setting']
                    }
                },
                {
                    endpoint: '/mgmt/tm/apm/profile/connectivity',
                    data: {
                        name: 'connectivityProfile'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.1']],
                skipAssert: true
            },
            {
                name: 'profileAccess',
                inputValue: [undefined, { bigip: '/Common/accessProfile' }, undefined],
                expectedValue: [undefined, 'accessProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'accessProfile')
            },
            {
                name: 'profileConnectivity',
                inputValue: [undefined, { bigip: '/Common/connectivityProfile' }, undefined],
                expectedValue: [undefined, 'connectivityProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'connectivityProfile')
            },
            {
                name: 'profileVdi',
                inputValue: [undefined, { bigip: '/Common/vdi' }, undefined],
                expectedValue: [undefined, 'vdi', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'vdi')
            }
        ];

        return assertServiceHTTPClass(properties, options);
    });

    it('policyIAM and perRequestAccessPolicy properties', function () {
        assertModuleProvisioned.call(this, 'apm');

        const options = {
            useTransaction: true,
            bigipItems: [
                // policyIAM dependencies
                {
                    endpoint: '/mgmt/tm/apm/policy/agent/ending-allow',
                    data: {
                        name: 'endAllowAgent'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'endAllowItem',
                        agents: [
                            {
                                name: '/Common/endAllowAgent',
                                type: 'ending-allow'
                            }
                        ],
                        caption: 'Allow',
                        color: 1,
                        'item-type': 'ending'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'startItem',
                        caption: 'Start',
                        color: 1,
                        rules: [
                            {
                                caption: 'fallback',
                                'next-item': '/Common/endAllowItem'
                            }
                        ]
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/access-policy',
                    data: {
                        name: 'accessPolicy',
                        'default-ending': '/Common/endAllowItem',
                        items: [
                            {
                                name: 'endAllowItem'
                            },
                            {
                                name: 'startItem'
                            }
                        ],
                        'start-item': 'startItem'
                    }
                },
                {
                    endpoint: '/mgmt/tm/apm/profile/access',
                    data: {
                        name: 'accessProfile',
                        'accept-languages': ['en'],
                        'access-policy': '/Common/accessPolicy',
                        'log-settings': ['default-log-setting']
                    }
                },
                {
                    endpoint: '/mgmt/tm/apm/profile/connectivity',
                    data: {
                        name: 'connectivityProfile'
                    }
                },
                // perRequestAccessPolicy dependencies
                {
                    endpoint: '/mgmt/tm/apm/policy/agent/ending-allow',
                    data: {
                        name: 'perRequestAccess_end_allow_ag'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/agent/ending-reject',
                    data: {
                        name: 'perRequestAccess_end_reject_ag'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'perRequestAccess_end_allow',
                        agents: [
                            {
                                name: '/Common/perRequestAccess_end_allow_ag',
                                type: 'ending-allow'
                            }
                        ],
                        caption: 'Allow',
                        color: 1,
                        'item-type': 'ending'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'perRequestAccess_end_reject',
                        agents: [
                            {
                                name: '/Common/perRequestAccess_end_reject_ag',
                                type: 'ending-reject'
                            }
                        ],
                        caption: 'Reject',
                        color: 2,
                        'item-type': 'ending'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/policy-item',
                    data: {
                        name: 'perRequestAccess_ent',
                        caption: 'Start',
                        color: 1,
                        rules: [
                            {
                                caption: 'fallback',
                                'next-item': '/Common/perRequestAccess_end_reject'
                            }
                        ]
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/apm/policy/access-policy',
                    data: {
                        name: 'perRequestAccess',
                        'default-ending': '/Common/perRequestAccess_end_reject',
                        items: [
                            {
                                name: 'perRequestAccess_end_allow'
                            },
                            {
                                name: 'perRequestAccess_end_reject'
                            },
                            {
                                name: 'perRequestAccess_ent'
                            }
                        ],
                        'start-item': 'perRequestAccess_ent',
                        type: 'per-rq-policy'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.1']],
                skipAssert: true
            },
            {
                name: 'policyIAM',
                inputValue: [undefined, { bigip: '/Common/accessProfile' }, undefined],
                expectedValue: [undefined, 'accessProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'accessProfile')
            },
            {
                name: 'profileConnectivity',
                inputValue: [undefined, { bigip: '/Common/connectivityProfile' }, undefined],
                expectedValue: [undefined, 'connectivityProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'connectivityProfile')
            },
            {
                name: 'policyPerRequestAccess',
                inputValue: [undefined, { bigip: '/Common/perRequestAccess' }, undefined],
                expectedValue: [undefined, 'perRequestAccess', undefined],
                extractFunction: (o) => (o.perFlowRequestAccessPolicy
                    === undefined ? undefined : o.perFlowRequestAccessPolicy.name)
            }
        ];

        return assertServiceHTTPClass(properties, options);
    });

    it('profileRequestAdapt and profileResponseAdapt properties', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.1']],
                skipAssert: true
            },
            {
                name: 'profileRequestAdapt',
                inputValue: [undefined, { bigip: '/Common/requestadapt' }, undefined],
                expectedValue: [undefined, 'requestadapt', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'requestadapt')
            },
            {
                name: 'profileResponseAdapt',
                inputValue: [undefined, { bigip: '/Common/responseadapt' }, undefined],
                expectedValue: [undefined, 'responseadapt', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'responseadapt')
            }
        ];

        return assertServiceHTTPClass(properties);
    });

    it('should reuse existing address on device', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.2.3.4']],
                expectedValue: ['/Common/1.2.3.4:123'],
                extractFunction: (o) => o.destination
            }
        ];

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/virtual-address',
                    data: { name: '1.2.3.4' },
                    skipDelete: true
                }
            ]
        };

        return assertServiceHTTPClass(properties, options);
    });

    it('bot defense and use ref DOS profile', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1') || !getProvisionedModules().includes('asm')) {
            this.skip();
        }
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileBotDefense',
                inputValue: [undefined, { bigip: '/Common/bot-defense' }, undefined],
                expectedValue: [undefined, 'bot-defense', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'bot-defense')
            },
            {
                name: 'profileDOS',
                inputValue: [undefined, { use: 'dosProfile' }, undefined],
                expectedValue: [undefined, 'dosProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'dosProfile'),
                referenceObjects: {
                    dosProfile: {
                        class: 'DOS_Profile'
                    }
                }
            }
        ];
        return assertServiceHTTPClass(properties);
    });

    it('HTML Profile', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileHTML',
                inputValue: [undefined, { bigip: '/Common/html' }, undefined],
                expectedValue: [undefined, 'html', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'html')
            }
        ];
        return assertServiceHTTPClass(properties);
    });

    it('LTM Profiles', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileNTLM',
                inputValue: [undefined, { bigip: '/Common/ntlm' }, undefined],
                expectedValue: [undefined, 'ntlm', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'ntlm')
            },
            {
                name: 'profileMultiplex',
                inputValue: [undefined, { bigip: '/Common/oneconnect' }, undefined],
                expectedValue: [undefined, 'oneconnect', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'oneconnect')
            }
        ];
        return assertServiceHTTPClass(properties);
    });

    it('HTTP MRF Router', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'httpMrfRoutingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, 'httprouter', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'httprouter')
            }
        ];
        return assertServiceHTTPClass(properties);
    });

    it('API protection profile bigip ref', function () {
        assertModuleProvisioned.call(this, 'apm');
        assertModuleProvisioned.call(this, 'asm');

        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/api-protection/response',
                    data: {
                        name: 'apiProtectionProfileResponse',
                        statusCode: 404,
                        statusString: 'Not Found'
                    },
                    skipDelete: true
                },
                {
                    endpoint: '/mgmt/tm/api-protection/profile/apiprotection',
                    data: {
                        name: 'apiProtectionProfile',
                        defaultResponse: 'apiProtectionProfileResponse',
                        responses: ['apiProtectionProfileResponse']
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileApiProtection',
                inputValue: [undefined, { bigip: '/Common/apiProtectionProfile' }, undefined],
                expectedValue: [undefined, 'apiProtectionProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'apiProtectionProfile')
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('Integrated Bot Defense profile bigip ref', function () {
        if (util.versionLessThan(getBigIpVersion(), '17.0')) {
            this.skip();
        }

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/pool',
                    data: {
                        name: 'testPool'
                    }
                },
                {
                    endpoint: '/mgmt/tm/saas/bd/profile',
                    data: {
                        name: 'testBd',
                        applicationId: 'applicationIdApplicationId123456',
                        tenantId: 'tenantId1234',
                        apiKey: '12345678901234567890123456789012',
                        shapeProtectionPool: '/Common/testPool',
                        protectedEndpoints: [
                            {
                                name: 'default_0001',
                                host: '1.2.3.4',
                                endpoint: '/endpoint',
                                post: 'enabled'
                            }
                        ],
                        sslProfile: '/Common/serverssl'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileIntegratedBotDefense',
                inputValue: [undefined, { bigip: '/Common/testBd' }, undefined],
                expectedValue: [undefined, 'testBd', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'testBd')
            }
        ];
        return assertServiceHTTPClass(properties, options);
    });

    it('should attach WebSocket profile with profileHTTP method', () => {
        const tenantName = 'Tenant';
        const applicationName = 'Application';

        const options = {
            tenantName,
            applicationName
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [80],
                expectedValue: ['80'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'profileHTTP',
                inputValue: [undefined, { use: 'httpProfile' }, undefined],
                expectedValue: [
                    undefined,
                    [
                        `/${tenantName}/${applicationName}/f5_appsvcs_httpProfile_proxyConnect`,
                        `/${tenantName}/${applicationName}/webSocketProfile`
                    ],
                    undefined
                ],
                referenceObjects: {
                    httpProfile: {
                        class: 'HTTP_Profile',
                        profileWebSocket: {
                            use: 'webSocketProfile'
                        },
                        proxyConnectEnabled: true
                    },
                    webSocketProfile: {
                        class: 'WebSocket_Profile'
                    }
                },
                extractFunction: (o) => {
                    const profiles = o.profiles
                        .filter((p) => p.name === 'webSocketProfile' || p.name === 'f5_appsvcs_httpProfile_proxyConnect')
                        .map((profile) => profile.fullPath);
                    return (profiles.length > 0) ? profiles : undefined;
                }
            }
        ];

        return assertServiceHTTPClass(properties, options);
    });

    it('deprecated WebSocket profile', function () {
        const tenantName = 'Tenant';
        const applicationName = 'Application';

        const options = {
            tenantName,
            applicationName
        };

        const properties = [
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.0']],
                skipAssert: true
            },
            {
                name: 'profileHTTP',
                inputValue: [undefined, { use: 'httpProfile' }, undefined],
                expectedValue: [
                    undefined,
                    [
                        `/${tenantName}/${applicationName}/f5_appsvcs_preserve`
                    ],
                    undefined
                ],
                referenceObjects: {
                    httpProfile: {
                        class: 'HTTP_Profile',
                        webSocketsEnabled: true,
                        webSocketMasking: 'preserve'
                    }
                },
                extractFunction: (o) => {
                    const profiles = o.profiles
                        .filter((p) => p.name === 'f5_appsvcs_preserve')
                        .map((profile) => profile.fullPath);
                    return (profiles.length > 0) ? profiles : undefined;
                }
            }
        ];

        return assertServiceHTTPClass(properties, options);
    });
});

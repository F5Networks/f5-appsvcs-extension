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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

describe('GSLB Pool', function () {
    this.timeout(GLOBAL_TIMEOUT);

    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    // Throw a gtm pool in Common to make sure it is not deleted on 12.1
    const bigipItems = [
        {
            endpoint: '/mgmt/tm/gtm/pool/a',
            data: { name: 'shouldNotBeDeletedByAS3' }
        },
        {
            endpoint: '/mgmt/tm/gtm/pool/aaaa',
            data: { name: 'shouldNotBeDeletedByAS3' }
        },
        {
            endpoint: '/mgmt/tm/gtm/pool/cname',
            data: { name: 'shouldNotBeDeletedByAS3' }
        },
        {
            endpoint: '/mgmt/tm/gtm/pool/mx',
            data: { name: 'shouldNotBeDeletedByAS3' }
        }
    ];

    const sharedObjects = {
        Common: {
            class: 'Tenant',
            Shared: {
                class: 'Application',
                template: 'shared',
                testServerOne: {
                    class: 'GSLB_Server',
                    dataCenter: { use: 'testDataCenter' },
                    devices: [{ address: '1.2.3.7' }],
                    virtualServers: [
                        {
                            address: '1.2.3.8',
                            port: 5050
                        },
                        {
                            address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
                            port: 5051
                        }
                    ]
                },
                testServerTwo: {
                    class: 'GSLB_Server',
                    dataCenter: { use: 'testDataCenter' },
                    devices: [{ address: '1.2.3.6' }],
                    virtualServers: [
                        {
                            address: '1.2.3.9',
                            port: 5052
                        },
                        {
                            address: '1234:0000:0000:0000:0000:0000:0000:0000',
                            port: 5053
                        }
                    ]
                },
                testServerVirtualDiscovery: {
                    class: 'GSLB_Server',
                    dataCenter: { use: 'testDataCenter' },
                    devices: [{ address: '10.10.5.5' }],
                    virtualServerDiscoveryMode: 'enabled-no-delete'
                },
                testDataCenter: {
                    class: 'GSLB_Data_Center'
                },
                testDomainOne: {
                    class: 'GSLB_Domain',
                    domainName: 'example1.edu',
                    resourceRecordType: 'A'
                },
                testDomainTwo: {
                    class: 'GSLB_Domain',
                    domainName: 'example2.edu',
                    resourceRecordType: 'A'
                }
            }
        }
    };

    function assertGTMPoolClass(properties, options) {
        return assertClass('GSLB_Pool', properties, Object.assign({ bigipItems }, options), sharedObjects);
    }

    function extractMemberServer(pool, i) {
        const member = pool.members[i];
        if (!member) return undefined;
        return member.name.split(':')[0];
    }

    function extractMemberVirtual(pool, i) {
        const member = pool.members[i];
        if (!member) return undefined;
        return member.name.split(':')[1];
    }

    function extractDependsOn(pool, i) {
        const member = pool.members[i];
        if (!member) return undefined;
        return member.dependsOn;
    }

    function extractMemberEnabled(pool, i) {
        const member = pool.members[i];
        if (!member) return undefined;
        return !member.disabled;
    }

    const commonProperties = [
        {
            name: 'enabled',
            inputValue: [undefined, false, undefined],
            expectedValue: [true, undefined, true]
        },
        {
            name: 'lbModeAlternate',
            inputValue: [undefined, 'ratio', undefined],
            expectedValue: ['round-robin', 'ratio', 'round-robin']
        },
        {
            name: 'lbModeFallback',
            inputValue: [undefined, 'ratio', undefined],
            expectedValue: ['return-to-dns', 'ratio', 'return-to-dns']
        },
        {
            name: 'manualResumeEnabled',
            inputValue: [undefined, true, undefined],
            expectedValue: ['disabled', 'enabled', 'disabled']
        },
        {
            name: 'verifyMemberEnabled',
            inputValue: [undefined, false, undefined],
            expectedValue: ['enabled', 'disabled', 'enabled']
        },
        {
            name: 'qosHitRatio',
            inputValue: [undefined, 10, undefined],
            expectedValue: [5, 10, 5]
        },
        {
            name: 'qosHops',
            inputValue: [undefined, 11, undefined],
            expectedValue: [0, 11, 0]
        },
        {
            name: 'qosKbps',
            inputValue: [undefined, 8, undefined],
            expectedValue: [3, 8, 3]
        },
        {
            name: 'qosLinkCapacity',
            inputValue: [undefined, 35, undefined],
            expectedValue: [30, 35, 30]
        },
        {
            name: 'qosPacketRate',
            inputValue: [undefined, 5, undefined],
            expectedValue: [1, 5, 1]
        },
        {
            name: 'qosRoundTripTime',
            inputValue: [undefined, 75, undefined],
            expectedValue: [50, 75, 50]
        },
        {
            name: 'qosTopology',
            inputValue: [undefined, 3, undefined],
            expectedValue: [0, 3, 0]
        },
        {
            name: 'qosVirtualServerCapacity',
            inputValue: [undefined, 2, undefined],
            expectedValue: [0, 2, 0]
        },
        {
            name: 'qosVirtualServerScore',
            inputValue: [undefined, 1, undefined],
            expectedValue: [0, 1, 0]
        },
        {
            name: 'members',
            inputValue: [undefined, [], undefined],
            skipAssert: true
        },
        {
            name: 'members.0',
            inputValue: [undefined, {}, undefined],
            skipAssert: true
        },
        {
            name: 'members.0.ratio',
            inputValue: [undefined, 10, undefined],
            expectedValue: [undefined, 10, undefined],
            extractFunction: (o) => (o.members[0] ? o.members[0].ratio : undefined)
        },
        {
            name: 'members.1',
            inputValue: [undefined, {}, undefined],
            skipAssert: true
        }
    ];

    const aProperties = commonProperties.concat([
        {
            name: 'bpsLimit',
            inputValue: [undefined, 5, undefined],
            expectedValue: [0, 5, 0]
        },
        {
            name: 'bpsLimitEnabled',
            inputValue: [undefined, true, undefined],
            expectedValue: ['disabled', 'enabled', 'disabled']
        },
        {
            name: 'ppsLimit',
            inputValue: [undefined, 4, undefined],
            expectedValue: [0, 4, 0]
        },
        {
            name: 'ppsLimitEnabled',
            inputValue: [undefined, true, undefined],
            expectedValue: ['disabled', 'enabled', 'disabled']
        },
        {
            name: 'connectionsLimit',
            inputValue: [undefined, 3, undefined],
            expectedValue: [0, 3, 0]
        },
        {
            name: 'connectionsLimitEnabled',
            inputValue: [undefined, true, undefined],
            expectedValue: ['disabled', 'enabled', 'disabled']
        },
        {
            name: 'maxAnswersReturned',
            inputValue: [undefined, 10, undefined],
            expectedValue: [1, 10, 1]
        },
        {
            name: 'monitors',
            inputValue: [
                undefined,
                [
                    { bigip: '/Common/http' },
                    { bigip: '/Common/https' }
                ],
                undefined
            ],
            expectedValue: ['default', '/Common/http and /Common/https', 'default'],
            extractFunction: (o) => o.monitor.trim()
        }
    ]);

    it('A', function () {
        const properties = aProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['A'],
                skipAssert: true
            },
            {
                name: 'fallbackIP',
                inputValue: [undefined, '1.1.1.1', undefined],
                expectedValue: ['any', '1.1.1.1', 'any']
            },
            {
                name: 'members.0.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerOne' }, undefined],
                expectedValue: [undefined, 'testServerOne', undefined],
                extractFunction: (o) => extractMemberServer(o, 0)
            },
            {
                name: 'members.0.virtualServer',
                inputValue: [undefined, '0', undefined],
                expectedValue: [undefined, '0', undefined],
                extractFunction: (o) => extractMemberVirtual(o, 0)
            },
            {
                name: 'members.0.dependsOn',
                inputValue: [undefined, ['/Common/Shared/testServerOne:1'], undefined],
                expectedValue: [undefined, [{ name: '/Common/testServerOne:1' }], undefined],
                extractFunction: (o) => extractDependsOn(o, 0)
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerTwo' }, undefined],
                skipAssert: true
            },
            {
                name: 'members.1.virtualServer',
                inputValue: [undefined, '0', undefined],
                skipAssert: true
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties);
    });

    it('AAAA', function () {
        const properties = aProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['AAAA'],
                skipAssert: true
            },
            {
                name: 'fallbackIP',
                inputValue: [undefined, '::1:1:1', undefined],
                expectedValue: ['any', '::1:1:1', 'any']
            },
            {
                name: 'members.0.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerOne' }, undefined],
                expectedValue: [undefined, 'testServerOne', undefined],
                extractFunction: (o) => extractMemberServer(o, 0)
            },
            {
                name: 'members.0.virtualServer',
                inputValue: [undefined, '1', undefined],
                expectedValue: [undefined, '1', undefined],
                extractFunction: (o) => extractMemberVirtual(o, 0)
            },
            {
                name: 'members.0.dependsOn',
                inputValue: [undefined, ['/Common/Shared/testServerOne:0'], undefined],
                expectedValue: [undefined, [{ name: '/Common/testServerOne:0' }], undefined],
                extractFunction: (o) => extractDependsOn(o, 0)
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerTwo' }, undefined],
                skipAssert: true
            },
            {
                name: 'members.1.virtualServer',
                inputValue: [undefined, '1', undefined],
                skipAssert: true
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties);
    });

    it('CNAME', function () {
        // TODO static-target on members
        const properties = commonProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['CNAME'],
                skipAssert: true
            },
            {
                name: 'members.0.domainName',
                inputValue: [undefined, 'example1.com', undefined],
                skipAssert: true
            },
            {
                name: 'members.0.isDomainNameStatic',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, 'yes', undefined],
                extractFunction: (o) => (o.members[0] ? o.members[0].staticTarget : undefined)
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.domainName',
                inputValue: [undefined, 'example2.com', undefined],
                skipAssert: true
            },
            {
                name: 'members.1.isDomainNameStatic',
                inputValue: [undefined, true, undefined],
                skipAssert: true
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties);
    });

    it('MX', function () {
        const properties = commonProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['MX'],
                skipAssert: true
            },
            {
                name: 'maxAnswersReturned',
                inputValue: [undefined, 12, undefined],
                expectedValue: [1, 12, 1]
            },
            {
                name: 'members.0.domainName',
                inputValue: [undefined, { use: '/Common/Shared/testDomainOne' }, undefined],
                expectedValue: [undefined, 'example1.edu', undefined],
                extractFunction: (o) => (o.members[0] ? o.members[0].name : undefined)
            },
            {
                name: 'members.0.priority',
                inputValue: [undefined, 42, undefined],
                expectedValue: [undefined, 42, undefined],
                extractFunction: (o) => (o.members[0] ? o.members[0].priority : undefined)
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.domainName',
                inputValue: [undefined, { use: '/Common/Shared/testDomainTwo' }, undefined],
                skipAssert: true
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties);
    });

    it('should be idempotent when created in Common', () => {
        const properties = aProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['A'],
                skipAssert: true
            },
            {
                name: 'fallbackIP',
                inputValue: [undefined, '1.1.1.1', undefined],
                expectedValue: ['any', '1.1.1.1', 'any']
            },
            {
                name: 'members.0.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerOne' }, undefined],
                expectedValue: [undefined, 'testServerOne', undefined],
                extractFunction: (o) => extractMemberServer(o, 0)
            },
            {
                name: 'members.0.virtualServer',
                inputValue: [undefined, '0', undefined],
                expectedValue: [undefined, '0', undefined],
                extractFunction: (o) => extractMemberVirtual(o, 0)
            },
            {
                name: 'members.0.dependsOn',
                inputValue: [undefined, ['/Common/Shared/testServerOne:1'], undefined],
                expectedValue: [undefined, [{ name: '/Common/testServerOne:1' }], undefined],
                extractFunction: (o) => extractDependsOn(o, 0)
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerTwo' }, undefined],
                skipAssert: true
            },
            {
                name: 'members.1.virtualServer',
                inputValue: [undefined, '0', undefined],
                skipAssert: true
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties, { tenantName: 'Common', applicationName: 'Shared' });
    });

    it('should create GSLB_Pool that uses a use pointer', function () {
        // On versions less than 14.1, we can't create a self-ip on single-nic
        // unless it matches the admin IP.
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/self',
                    data: {
                        name: 'testSelf',
                        address: '10.10.5.5/32',
                        vlan: '/Common/internal'
                    }
                }
            ]
        };
        const properties = aProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['A'],
                skipAssert: true
            },
            {
                name: 'fallbackIP',
                inputValue: [undefined, '1.1.1.1', undefined],
                expectedValue: ['any', '1.1.1.1', 'any']
            },
            {
                name: 'members.0.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerTwo' }, undefined],
                skipAssert: true
            },
            {
                name: 'members.0.virtualServer',
                inputValue: [undefined, '0', undefined],
                skipAssert: true
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerVirtualDiscovery' }, undefined],
                expectedValue: [undefined, '/Common/testServerVirtualDiscovery', undefined],
                extractFunction: (o) => (o.members[1] ? o.members[1].fullPath.split(':')[0] : undefined)
            },
            {
                name: 'members.1.virtualServer',
                inputValue: [undefined, { use: 'testVirtual' }, undefined],
                expectedValue: [undefined, 'testVirtual', undefined],
                extractFunction: (o) => (o.members[1] ? o.members[1].name : undefined),
                referenceObjects: {
                    testVirtual: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '1.2.3.4'
                        ]
                    }
                }
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties, options);
    });
});

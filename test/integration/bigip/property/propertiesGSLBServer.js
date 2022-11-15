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

const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;
const {
    assertClass,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('GSLB_Server', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    const bigipItems = [
        {
            endpoint: '/mgmt/tm/gtm/datacenter',
            data: { name: 'datacenter' }
        },
        {
            endpoint: '/mgmt/tm/gtm/prober-pool',
            data: { name: 'proberPool' }
        }
    ];

    const options = {
        bigipItems,
        tenantName: 'Common',
        applicationName: 'Shared',
        mcpPath: '/Common/'
    };

    it('All Properties', function () {
        const inputDevices = [{ address: '10.0.0.1' }];

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            },
            {
                name: 'devices',
                inputValue: [inputDevices],
                skipAssert: true
            },
            {
                name: 'dataCenter',
                inputValue: [{ bigip: '/Common/datacenter' }],
                expectedValue: ['/Common/datacenter'],
                extractFunction: (o) => o.datacenter.fullPath
            },
            {
                name: 'enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [true, undefined, true]
            },
            {
                name: 'serverType',
                inputValue: [undefined],
                expectedValue: ['bigip']
            },
            {
                name: 'proberPreferred',
                inputValue: [undefined, 'inside-datacenter', undefined],
                expectedValue: ['inherit', 'inside-datacenter', 'inherit']
            },
            {
                name: 'proberFallback',
                inputValue: [undefined, 'any-available', undefined],
                expectedValue: ['inherit', 'any-available', 'inherit']
            },
            {
                name: 'monitors',
                inputValue: [
                    [],
                    [
                        { bigip: '/Common/http' },
                        { bigip: '/Common/https' }
                    ],
                    undefined
                ],
                expectedValue: [
                    '/Common/bigip',
                    '/Common/http and /Common/https',
                    '/Common/bigip'
                ],
                extractFunction: (o) => o.monitor.trim()
            },
            {
                name: 'bpsLimit',
                inputValue: [undefined, 50, undefined],
                expectedValue: [0, 50, 0]
            },
            {
                name: 'bpsLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'ppsLimit',
                inputValue: [undefined, 60, undefined],
                expectedValue: [0, 60, 0]
            },
            {
                name: 'ppsLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'connectionsLimit',
                inputValue: [undefined, 70, undefined],
                expectedValue: [0, 70, 0]
            },
            {
                name: 'connectionsLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'serviceCheckProbeEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'pathProbeEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'snmpProbeEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'virtualServerDiscoveryMode',
                inputValue: [undefined, 'enabled', 'enabled-no-delete'],
                expectedValue: ['disabled', 'enabled', 'enabled-no-delete']
            },
            {
                name: 'exposeRouteDomainsEnabled',
                inputValue: [undefined, true, false],
                expectedValue: ['no', 'yes', 'no']
            }
        ];

        return assertClass('GSLB_Server', properties, options);
    });

    it('Generic Host Properties', function () {
        const properties = [
            {
                name: 'devices',
                inputValue: [[{ address: '10.0.0.1' }]],
                skipAssert: true
            },
            {
                name: 'dataCenter',
                inputValue: [{ bigip: '/Common/datacenter' }, { use: 'refDataCenter' }, { bigip: '/Common/datacenter' }],
                expectedValue: ['/Common/datacenter', '/Common/refDataCenter', '/Common/datacenter'],
                referenceObjects: {
                    refDataCenter: {
                        class: 'GSLB_Data_Center'
                    }
                },
                extractFunction: (o) => o.datacenter.fullPath
            },
            {
                name: 'serverType',
                inputValue: ['generic-host'],
                expectedValue: ['generic-host']
            },
            {
                name: 'cpuUsageLimit',
                inputValue: [undefined, 50, undefined],
                expectedValue: [0, 50, 0]
            },
            {
                name: 'cpuUsageLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'memoryLimit',
                inputValue: [undefined, 60, undefined],
                expectedValue: [0, 60, 0]
            },
            {
                name: 'memoryLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'proberPreferred',
                inputValue: ['pool'],
                expectedValue: ['pool']
            },
            {
                name: 'proberPool',
                inputValue: [{ bigip: '/Common/proberPool' }, { use: 'refProberPool' }, { bigip: '/Common/proberPool' }],
                expectedValue: ['/Common/proberPool', '/Common/refProberPool', '/Common/proberPool'],
                referenceObjects: {
                    refProberPool: {
                        class: 'GSLB_Prober_Pool'
                    }
                },
                extractFunction: (o) => o.proberPool.fullPath
            },
            {
                name: 'monitors',
                inputValue: [
                    [],
                    [
                        { bigip: '/Common/http' },
                        { bigip: '/Common/https' }
                    ],
                    []
                ],
                expectedValue: [
                    undefined,
                    '/Common/http and /Common/https',
                    undefined
                ],
                extractFunction: (o) => (o.monitor ? o.monitor.trim() : undefined)
            }
        ];

        return assertClass('GSLB_Server', properties, options);
    });

    it('Device Properties', function () {
        function getAddress(obj, n) {
            if (obj.devices) {
                return obj.devices[n].addresses[0];
            }
            return obj.addresses[n];
        }

        function checkDevice(obj, n) {
            if (obj.devices) {
                return obj.devices[n];
            }
            return getAddress(obj, n);
        }

        const properties = [
            {
                name: 'dataCenter',
                inputValue: [{ bigip: '/Common/datacenter' }],
                skipAssert: true
            },
            {
                name: 'devices',
                inputValue: [[]],
                skipAssert: true
            },
            {
                name: 'devices.0',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'devices.0.address',
                inputValue: ['10.0.0.1'],
                expectedValue: ['10.0.0.1'],
                extractFunction: (o) => getAddress(o, 0).name
            },
            {
                name: 'devices.0.addressTranslation',
                inputValue: [undefined, '10.0.0.2', undefined],
                expectedValue: ['none', '10.0.0.2', 'none'],
                extractFunction: (o) => getAddress(o, 0).translation
            },
            {
                name: 'devices.1',
                inputValue: [undefined, { address: '10.0.0.3' }, undefined],
                expectedValue: [false, true, false],
                extractFunction: (o) => typeof checkDevice(o, 1) !== 'undefined'
            }
        ];

        return assertClass('GSLB_Server', properties, options);
    });

    it('Virtual Server Properties', function () {
        function splitAddress(combined) {
            if (!combined) return [combined, combined];
            return ipUtil.splitAddress(combined);
        }

        const properties = [
            {
                name: 'devices',
                inputValue: [[{ address: '10.0.0.1' }]],
                skipAssert: true
            },
            {
                name: 'dataCenter',
                inputValue: [{ bigip: '/Common/datacenter' }],
                skipAssert: true
            },
            {
                name: 'virtualServers',
                inputValue: [[]],
                skipAssert: true
            },
            {
                name: 'virtualServers.0',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'virtualServers.0.address',
                inputValue: ['10.0.0.12', '2001:0db8:85a3:0000:0000:8a2e:0370:7334', '10.0.0.12'],
                expectedValue: ['10.0.0.12', '2001:db8:85a3::8a2e:370:7334', '10.0.0.12'],
                extractFunction: (o) => splitAddress(o.virtualServers[0].destination)[0]
            },
            {
                name: 'virtualServers.0.port',
                inputValue: [0, 5060, 5050],
                expectedValue: [0, 5060, 5050],
                extractFunction: (o) => splitAddress(o.virtualServers[0].destination)[1]
            },
            {
                name: 'virtualServers.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [true, undefined, true]
            },
            {
                name: 'virtualServers.0.addressTranslation',
                inputValue: [undefined, '10.0.0.13', undefined],
                expectedValue: ['none', '10.0.0.13', 'none']
            },
            {
                name: 'virtualServers.0.addressTranslationPort',
                inputValue: [0, 5051, undefined],
                expectedValue: [0, 5051, 0]
            },
            {
                name: 'virtualServers.0.monitors',
                inputValue: [
                    [],
                    [
                        { bigip: '/Common/http' },
                        { bigip: '/Common/https' }
                    ],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    '/Common/http and /Common/https',
                    undefined
                ],
                extractFunction: (o) => (o.virtualServers[0].monitor ? o.virtualServers[0].monitor.trim() : undefined)
            },
            {
                name: 'virtualServers.0.name',
                inputValue: [undefined, 'foobar', undefined],
                expectedValue: [0, 'foobar', 0]
            }
        ];

        return assertClass('GSLB_Server', properties, options);
    });
});

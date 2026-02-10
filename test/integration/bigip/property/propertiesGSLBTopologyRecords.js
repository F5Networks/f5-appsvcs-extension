/**
 * Copyright 2026 F5, Inc.
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

const gtmUtil = require('../../../../src/lib/util/gtmUtil');
const util = require('../../../../src/lib/util/util');

const GLOBAL_SETTINGS_KIND = 'tm:gtm:global-settings:load-balancing:load-balancingstate';
const TOPOLOGY_KIND = 'tm:gtm:topology:topologystate';

const mcpRetries = {
    mcpRetryDelay: 5000,
    maxMcpRetries: 12
};

const extractFunctions = {
    longestMatchEnabled(result) {
        const settings = result.find((r) => r.kind === GLOBAL_SETTINGS_KIND);
        return settings.topologyLongestMatch === 'yes';
    },
    records(result) {
        const mapToRecord = function (item) {
            const rec = {
                matchOperator: item.not === 'not' ? 'not-equals' : 'equals',
                matchType: item.type,
                matchValue: item.value.indexOf('"') > -1
                    ? item.value.substring(item.value.indexOf('"') + 1, item.value.lastIndexOf('"'))
                    : item.value
            };
            if (item.type === 'region') {
                rec.matchValue = { bigip: rec.matchValue };
            }
            if (item.type === 'datacenter') {
                rec.matchValue = { use: rec.matchValue.replace('/Common/', '/Common/Shared/') };
            }
            if (item.type === 'pool') {
                rec.matchValue = { use: rec.matchValue };
            }
            return rec;
        };
        return result.filter((r) => r.kind === TOPOLOGY_KIND).map((item) => {
            const record = {};
            const itemName = item.name;
            const ldnsIndex = itemName.indexOf('ldns: ') + 6;
            const serverIndex = itemName.indexOf('server: ');
            record.source = mapToRecord(gtmUtil.parseTopologyItem(
                itemName.substring(ldnsIndex, serverIndex).trim()
            ));
            record.destination = mapToRecord(gtmUtil.parseTopologyItem(
                itemName.substring(serverIndex + 8).trim()
            ));
            record.weight = item.score;
            return record;
        });
    }
};

const options = {
    findAll: true,
    tenantName: 'Common',
    applicationName: 'Shared',
    getMcpObject: {
        itemName: '',
        itemKind: TOPOLOGY_KIND,
        refItemKind: GLOBAL_SETTINGS_KIND,
        skipNameCheck: true
    },
    getMcpValueDelay: 1000,
    mcpPath: '/Common/',
    mcpRetries,
    bigipItems: [
        {
            endpoint: '/mgmt/tm/gtm/region',
            data: { name: 'topologyTestRegion' }
        }
    ]
};

describe('GSLB_Topology_Records', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    it('All Properties (longestMatchEnabled = false)', function () {
        const records = [
            {
                source: {
                    matchType: 'isp',
                    matchOperator: 'equals',
                    matchValue: 'Earthlink'
                },
                destination: {
                    matchType: 'subnet',
                    matchOperator: 'equals',
                    matchValue: '192.168.4.0/24'
                },
                weight: 1
            },
            {
                source: {
                    matchType: 'geoip-isp',
                    matchOperator: 'not-equals',
                    matchValue: 'Some ISP Value'
                },
                destination: {
                    matchType: 'subnet',
                    matchOperator: 'equals',
                    matchValue: '192.168.3.0/24'
                },
                weight: 11
            },
            {
                source: {
                    matchType: 'region',
                    matchOperator: 'equals',
                    matchValue: {
                        bigip: '/Common/topologyTestRegion'
                    }
                },
                destination: {
                    matchType: 'state',
                    matchOperator: 'not-equals',
                    matchValue: 'US/New York'
                },
                weight: 256
            },
            {
                source: {
                    matchType: 'continent',
                    matchOperator: 'not-equals',
                    matchValue: 'OC'
                },
                destination: {
                    matchType: 'country',
                    matchOperator: 'not-equals',
                    matchValue: 'ZW'
                },
                weight: 10
            }

        ];
        const properties = [
            {
                name: 'longestMatchEnabled',
                inputValue: [false],
                expectedValue: [false],
                extractFunction: extractFunctions.longestMatchEnabled
            },
            {
                name: 'records',
                inputValue: [records],
                expectedValue: [records],
                extractFunction: extractFunctions.records
            }

        ];
        return assertClass('GSLB_Topology_Records', properties, options);
    });

    it('Update Order', function () {
        const country = {
            source: {
                matchType: 'country',
                matchOperator: 'equals',
                matchValue: 'AD'
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.10.0.0/21'
            },
            weight: 100
        };

        const continent = {
            source: {
                matchType: 'continent',
                matchOperator: 'equals',
                matchValue: 'AF'
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.30.10.0/24'
            },
            weight: 100
        };

        const isp = {
            source: {
                matchType: 'isp',
                matchOperator: 'equals',
                matchValue: 'Comcast'
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.10.20.0/24'
            },
            weight: 100
        };

        const region = {
            source: {
                matchType: 'region',
                matchOperator: 'equals',
                matchValue: {
                    bigip: '/Common/topologyTestRegion'
                }
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.10.10.0/24'
            },
            weight: 100
        };

        const actualRecords = [
            country,
            isp,
            continent,
            region
        ];
        // For longest match algorithm, see https://support.f5.com/csp/article/K14284
        const orderedRecords = [
            region,
            isp,
            country,
            continent
        ];

        const properties = [
            {
                name: 'longestMatchEnabled',
                inputValue: [undefined, false],
                expectedValue: [true, false],
                extractFunction: extractFunctions.longestMatchEnabled
            },
            {
                name: 'records',
                inputValue: [actualRecords, actualRecords],
                expectedValue: [orderedRecords, actualRecords],
                extractFunction: extractFunctions.records
            }

        ];
        return assertClass('GSLB_Topology_Records', properties, options);
    });

    it('References (14.1+)', function () {
        // References in 14.0 and older can still fail due to the "order" property not being
        // supported and AS3 needing to pull record handling outside of the main transaction.
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        const sharedObjects = {
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    gslbPool: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'A'
                    },
                    gslbDataCenter: {
                        class: 'GSLB_Data_Center'
                    }
                }
            }
        };

        const records = [
            {
                destination: {
                    matchType: 'pool',
                    matchOperator: 'equals',
                    matchValue: {
                        use: '/Common/Shared/gslbPool'
                    }
                },
                source: {
                    matchType: 'subnet',
                    matchOperator: 'equals',
                    matchValue: '192.0.2.10/32'
                },
                weight: 100
            },
            {
                destination: {
                    matchType: 'datacenter',
                    matchOperator: 'equals',
                    matchValue: {
                        use: '/Common/Shared/gslbDataCenter'
                    }
                },
                source: {
                    matchType: 'subnet',
                    matchOperator: 'equals',
                    matchValue: '192.0.2.11/32'
                },
                weight: 5
            }
        ];
        const properties = [
            {
                name: 'longestMatchEnabled',
                inputValue: [false],
                expectedValue: [false],
                extractFunction: extractFunctions.longestMatchEnabled
            },
            {
                name: 'records',
                inputValue: [records],
                expectedValue: [records],
                extractFunction: extractFunctions.records
            }

        ];
        const opts = util.simpleCopy(options);
        delete opts.bigipItems;
        return assertClass('GSLB_Topology_Records', properties, opts, sharedObjects);
    });
});

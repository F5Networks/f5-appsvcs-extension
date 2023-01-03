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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const gtmUtil = require('../../../../src/lib/util/gtmUtil');

const mcpRetries = {
    mcpRetryDelay: 5000,
    maxMcpRetries: 12
};

const members = [
    {
        matchType: 'continent',
        matchOperator: 'equals',
        matchValue: 'SA'
    },
    {
        matchType: 'country',
        matchOperator: 'not-equals',
        matchValue: '--'
    },
    {
        matchType: 'datacenter',
        matchOperator: 'equals',
        matchValue: {
            bigip: '/Common/aTestDataCenter'
        }
    },
    {
        matchType: 'geoip-isp',
        matchOperator: 'not-equals',
        matchValue: 'some-geolocation-isp-value'
    },
    {
        matchType: 'isp',
        matchOperator: 'equals',
        matchValue: 'Comcast'
    },
    {
        matchType: 'pool',
        matchOperator: 'equals',
        matchValue: {
            bigip: '/Common/aTestPool'
        }
    },
    {
        matchType: 'region',
        matchOperator: 'not-equals',
        matchValue: {
            bigip: '/Common/aTestRegion'
        }
    },
    {
        matchType: 'state',
        matchOperator: 'equals',
        matchValue: 'US/New Hampshire'
    },
    {
        matchType: 'state',
        matchOperator: 'equals',
        matchValue: 'US/Pennsylvania'
    },
    {
        matchType: 'subnet',
        matchOperator: 'equals',
        matchValue: '192.168.3.0/28'
    }
];

const extractFunctions = {
    members(result) {
        if (!result.regionMembers) {
            return undefined;
        }
        return result.regionMembers.map((regionMember) => {
            const member = gtmUtil.parseTopologyItem(regionMember.name);
            const parsedMember = {
                matchOperator: member.not === 'not' ? 'not-equals' : 'equals',
                matchType: member.type,
                matchValue: member.value.indexOf('"') > -1
                    ? member.value.substring(member.value.indexOf('"') + 1, member.value.lastIndexOf('"'))
                    : member.value
            };
            if (member.type === 'region' || member.type === 'pool' || member.type === 'datacenter') {
                parsedMember.matchValue = { bigip: parsedMember.matchValue };
            }
            return parsedMember;
        });
    }
};

const sortRegions = function (a, b) {
    const aPrefix = a.matchOperator === 'equals' ? '' : 'not ';
    const bPrefix = b.matchOperator === 'equals' ? '' : 'not ';
    const aName = `${aPrefix}${a.matchType} ${a.matchValue}`;
    const bName = `${bPrefix}${b.matchType} ${b.matchValue}`;

    return aName.toLowerCase().localeCompare(bName.toLowerCase());
};

describe('GSLB_Topology_Region', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    it('Different Types', function () {
        const properties = [
            {
                name: 'members',
                inputValue: [[], members, undefined],
                expectedValue: [undefined, members.sort(sortRegions), undefined],
                extractFunction: extractFunctions.members
            }
        ];

        const options = {
            tenantName: 'Common',
            applicationName: 'Shared',
            getMcpValueDelay: 1000,
            mcpPath: '/Common/',
            mcpRetries,
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/gtm/region',
                    data: { name: 'aTestRegion' }
                },
                {
                    endpoint: '/mgmt/tm/gtm/datacenter',
                    data: { name: 'aTestDataCenter' }
                },
                {
                    endpoint: '/mgmt/tm/gtm/pool/a',
                    data: { name: 'aTestPool' }
                }
            ]
        };

        return assertClass('GSLB_Topology_Region', properties, options);
    });

    it('handles referencing another GSLB_Topology_Region', () => {
        const sharedObjects = {
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    otherTestRegion: {
                        class: 'GSLB_Topology_Region',
                        members: []
                    }
                }
            }
        };

        const refRegion = {
            matchType: 'region',
            matchOperator: 'equals',
            matchValue: {
                use: '/Common/Shared/otherTestRegion'
            }
        };

        const properties = [
            {
                name: 'members',
                inputValue: [[], [refRegion], undefined],
                expectedValue: [[], ['region /Common/otherTestRegion'], []],
                extractFunction: (o) => (o.regionMembers || []).map((x) => x.name)
            }
        ];

        const options = {
            tenantName: 'Common',
            applicationName: 'Shared',
            getMcpValueDelay: 1000,
            mcpPath: '/Common/',
            mcpRetries
        };

        return assertClass('GSLB_Topology_Region', properties, options, sharedObjects);
    });
});

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
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('GSLB Prober Pool', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    const bigipItems = [
        {
            endpoint: '/mgmt/tm/gtm/datacenter',
            data: {
                name: 'bigipDataCenter'
            }
        },
        {
            endpoint: '/mgmt/tm/gtm/wideip/a',
            data: {
                name: 'example.edu'
            }
        },
        {
            endpoint: '/mgmt/tm/gtm/server',
            data: {
                name: 'bigipServer',
                datacenter: '/Common/bigipDataCenter',
                addresses: '1.2.3.12'
            }
        }
    ];

    const options = {
        bigipItems,
        tenantName: 'Common',
        applicationName: 'Shared',
        mcpPath: '/Common/'
    };

    function assertProberPoolClass(properties) {
        return assertClass('GSLB_Prober_Pool', properties, options);
    }

    function extractMemberServer(pool, i) {
        const member = pool.members[i];
        if (!member) return undefined;
        return member.name.split('/Common/')[1];
    }

    it('All Properties', () => {
        const properties = [
            {
                name: 'enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [true, undefined, true]
            },
            {
                name: 'lbMode',
                inputValue: [undefined, 'round-robin', undefined],
                expectedValue: ['global-availability', 'round-robin', 'global-availability']
            },
            {
                name: 'members',
                inputValue: [[], [], undefined],
                skipAssert: true
            },
            {
                name: 'members.0',
                inputValue: [undefined, {}, undefined],
                skipAssert: true
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, undefined, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => (o.members[0] ? o.members[0].enabled : undefined)
            },
            {
                name: 'members.0.server',
                inputValue: [undefined, { use: '/Common/bigipServer' }, undefined],
                expectedValue: [undefined, 'bigipServer', undefined],
                extractFunction: (o) => extractMemberServer(o, 0)
            }
        ];

        return assertProberPoolClass(properties);
    });
});

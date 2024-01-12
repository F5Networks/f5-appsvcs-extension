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
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('GSLB_Data_Center', function () {
    // These GSLB tests on 14.0+ seem to take about 70-80 seconds to run completely
    this.timeout(GLOBAL_TIMEOUT);

    it('All Properties', function () {
        assertModuleProvisioned.call(this, 'gtm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            },
            {
                name: 'enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [true, undefined, true]
            },
            {
                name: 'location',
                inputValue: [undefined, 'hello there', undefined],
                expectedValue: [undefined, 'hello there', undefined]
            },
            {
                name: 'contact',
                inputValue: [undefined, 'General Kenobi', undefined],
                expectedValue: [undefined, 'General Kenobi', undefined]
            },
            {
                name: 'proberPreferred',
                inputValue: [undefined, 'pool', undefined],
                expectedValue: ['inside-datacenter', 'pool', 'inside-datacenter']
            },
            {
                name: 'proberFallback',
                inputValue: [undefined, 'none', undefined],
                expectedValue: ['any-available', 'none', 'any-available']
            },
            {
                name: 'proberPool',
                inputValue: [undefined, { bigip: '/Common/proberPool' }, undefined],
                expectedValue: [undefined, '/Common/proberPool', undefined],
                extractFunction: (o) => ((o.proberPool) ? o.proberPool.fullPath : undefined)
            }
        ];

        const options = {
            tenantName: 'Common',
            applicationName: 'Shared',
            mcpPath: '/Common/',
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/gtm/prober-pool',
                    data: { name: 'proberPool' }
                }
            ]
        };

        return assertClass('GSLB_Data_Center', properties, options);
    });
});

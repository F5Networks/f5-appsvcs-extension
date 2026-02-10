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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const requestUtil = require('../../../common/requestUtilPromise');

describe('Firewall_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertFirewallPolicyClass(properties, options) {
        return assertClass('Firewall_Policy', properties, options);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'afm');

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '10' }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '100' }
                }
            ],
            tenantName: 'Common',
            applicationName: 'Shared'
        };

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'rules',
                inputValue: [
                    [],
                    [
                        {
                            use: 'theRules'
                        }
                    ],
                    []
                ],
                expectedValue: [
                    [],
                    ['theRules'],
                    []
                ],
                referenceObjects: {
                    theRules: {
                        class: 'Firewall_Rule_List'
                    }
                },
                extractFunction: (o) => {
                    const rules = [];
                    o.rules.forEach((rule) => {
                        rules.push(rule.name);
                    });
                    return rules;
                }
            },
            {
                name: 'routeDomainEnforcement',
                inputValue: [
                    undefined,
                    [
                        {
                            bigip: '/Common/10'
                        },
                        {
                            bigip: '/Common/100'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        '/Common/10',
                        '/Common/100'
                    ],
                    []
                ],
                extractFunction: (o) => {
                    const requestOptions = {
                        path: '/mgmt/tm/net/route-domain',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil.get(requestOptions)
                        .then((routeDomains) => {
                            const rds = [];
                            (routeDomains.body.items || []).forEach((rd) => {
                                if (rd.fwEnforcedPolicy === o.fullPath) {
                                    rds.push(rd.fullPath);
                                }
                            });
                            return rds;
                        });
                }
            }
        ];
        return assertFirewallPolicyClass(properties, options);
    });
});

/**
 * Copyright 2025 F5, Inc.
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

describe('Enforcement_Listener', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementListenerClass(properties) {
        return assertClass('Enforcement_Listener', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'enforcementProfile',
                inputValue: [
                    {
                        use: 'enfProf1'
                    },
                    {
                        use: 'enfProf2'
                    },
                    {
                        use: 'enfProf1'
                    }
                ],
                expectedValue: ['enfProf1', 'enfProf2', 'enfProf1'],
                referenceObjects: {
                    enfProf1: {
                        class: 'Enforcement_Profile'
                    },
                    enfProf2: {
                        class: 'Enforcement_Profile'
                    }
                },
                extractFunction: (o) => o.profileSpm.name
            },
            {
                name: 'subscriberManagementProfile',
                inputValue: [
                    undefined,
                    {
                        use: 'subMangProf'
                    },
                    undefined
                ],
                expectedValue: ['none', 'subMangProf', 'none'],
                referenceObjects: {
                    subMangProf: {
                        class: 'Enforcement_Subscriber_Management_Profile'
                    }
                },
                extractFunction: (o) => {
                    const profile = (o.profileSubscriberMgmt) ? o.profileSubscriberMgmt.name : 'none';
                    return profile;
                }
            },
            {
                name: 'services',
                inputValue: [
                    [
                        {
                            use: 'service1'
                        }
                    ],
                    [
                        {
                            use: 'service1'
                        },
                        {
                            use: 'service2'
                        }
                    ],
                    [
                        {
                            use: 'service1'
                        }
                    ]
                ],
                expectedValue: [
                    ['service1'],
                    ['service1', 'service2'],
                    ['service1']
                ],
                referenceObjects: {
                    service1: {
                        class: 'Service_Generic',
                        virtualAddresses: ['2.2.3.3'],
                        virtualPort: 111
                    },
                    service2: {
                        class: 'Service_Generic',
                        virtualAddresses: ['2.2.3.4'],
                        virtualPort: 112
                    }
                },
                extractFunction: (o) => {
                    const servers = [];
                    o.virtualServers.forEach((server) => {
                        servers.push(server.name);
                    });
                    return servers;
                }
            }
        ];
        return assertEnforcementListenerClass(properties);
    });
});

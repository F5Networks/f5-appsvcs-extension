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

describe('NAT_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertNatPolicyClass(properties, options) {
        return assertClass('NAT_Policy', properties, options);
    }

    it('All properties without rules', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            }
        ];
        return assertNatPolicyClass(properties);
    });

    it('should test rules', function () {
        assertModuleProvisioned.call(this, 'afm');

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/security/log/profile',
                    data: {
                        name: 'Test_Security_Log_Profile',
                        partition: '/Common'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'rules',
                inputValue: [[]],
                skipAssert: true
            },
            {
                name: 'rules.0',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'rules.0.name',
                inputValue: ['theRule1'],
                expectedValue: ['theRule1']
            },
            {
                name: 'rules.0.source',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'rules.0.source.addressLists',
                inputValue: [
                    undefined,
                    [{ use: 'addList' }],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    ['/TEST_NAT_Policy/Application/addList'],
                    undefined
                ],
                referenceObjects: {
                    addList: {
                        class: 'Firewall_Address_List',
                        addresses: ['50.50.50.50']
                    }
                }
            },
            {
                name: 'rules.0.source.portLists',
                inputValue: [
                    undefined,
                    [{ use: 'portList' }],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    ['/TEST_NAT_Policy/Application/portList'],
                    undefined
                ],
                referenceObjects: {
                    portList: {
                        class: 'Firewall_Port_List',
                        ports: [123]
                    }
                }
            },
            {
                name: 'rules.0.destination',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'rules.0.destination.addressLists',
                inputValue: [
                    undefined,
                    [{ use: 'addList' }],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    ['/TEST_NAT_Policy/Application/addList'],
                    undefined
                ],
                referenceObjects: {
                    addList: {
                        class: 'Firewall_Address_List',
                        addresses: ['50.50.50.50']
                    }
                }
            },
            {
                name: 'rules.0.destination.portLists',
                inputValue: [
                    undefined,
                    [{ use: 'portList' }],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    ['/TEST_NAT_Policy/Application/portList'],
                    undefined
                ],
                referenceObjects: {
                    portList: {
                        class: 'Firewall_Port_List',
                        ports: [123]
                    }
                }
            },
            {
                name: 'rules.0.protocol',
                inputValue: [undefined, 'tcp', undefined],
                expectedValue: ['any', 'tcp', 'any']
            },
            {
                name: 'rules.0.sourceTranslation',
                inputValue: [undefined, { use: 'sourceTrans' }, undefined],
                expectedValue: [undefined, '/TEST_NAT_Policy/Application/sourceTrans', undefined],
                extractFunction: (o) => o.rules[0].translation.source,
                referenceObjects: {
                    sourceTrans: {
                        class: 'NAT_Source_Translation',
                        type: 'dynamic-pat',
                        addresses: ['40.40.40.40'],
                        ports: [234]
                    }
                }
            },
            {
                name: 'rules.1',
                inputValue: [undefined, {}, undefined],
                skipAssert: true
            },
            {
                name: 'rules.1.name',
                inputValue: [undefined, 'theRule2', undefined],
                expectedValue: [undefined, 'theRule2', undefined]
            }
        ];
        return assertNatPolicyClass(properties, options);
    });

    it('should test rules with Security_Log_Profiles', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/security/log/profile',
                    data: {
                        name: 'Test_Security_Log_Profile',
                        partition: '/Common'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'rules',
                inputValue: [[]],
                skipAssert: true
            },
            {
                name: 'rules.0',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'rules.0.name',
                inputValue: ['theRule1'],
                expectedValue: ['theRule1']
            },
            {
                name: 'rules.0.securityLogProfile',
                inputValue: [undefined, { bigip: '/Common/Test_Security_Log_Profile' }, undefined],
                expectedValue: [undefined, '/Common/Test_Security_Log_Profile', undefined],
                extractFunction: (o) => {
                    if (o.rules[0].logProfile) {
                        return o.rules[0].logProfile.fullPath;
                    }
                    return o.rules[0].logProfile;
                }
            },
            {
                name: 'rules.1',
                inputValue: [undefined, {}, undefined],
                skipAssert: true
            },
            {
                name: 'rules.1.name',
                inputValue: [undefined, 'theRule2', undefined],
                expectedValue: [undefined, 'theRule2', undefined]
            },
            {
                name: 'rules.1.securityLogProfile',
                inputValue: [undefined, { use: 'secLogProfile' }, undefined],
                expectedValue: [undefined, '/TEST_NAT_Policy/Application/secLogProfile', undefined],
                extractFunction: (o) => {
                    if (o.rules[1]) {
                        return o.rules[1].logProfile.fullPath;
                    }
                    return o.rules[1];
                },
                referenceObjects: {
                    secLogProfile: {
                        class: 'Security_Log_Profile',
                        application: {}
                    }
                }
            }
        ];
        return assertNatPolicyClass(properties, options);
    });
});

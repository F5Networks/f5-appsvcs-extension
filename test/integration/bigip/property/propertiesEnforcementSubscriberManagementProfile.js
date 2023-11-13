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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Enforcement_Subscriber_Management_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementSubscriberManagementProfileClass(properties) {
        return assertClass('Enforcement_Subscriber_Management_Profile', properties);
    }

    const dhcpInput = {
        enabled: true,
        service: {
            use: 'service'
        }
    };

    const dhcpExpected = 'service';

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
                name: 'parentProfile',
                inputValue: [
                    undefined,
                    {
                        use: 'subMangProf'
                    },
                    undefined
                ],
                expectedValue: ['subscriber-mgmt', 'subMangProf', 'subscriber-mgmt'],
                referenceObjects: {
                    subMangProf: {
                        class: 'Enforcement_Subscriber_Management_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'dhcpLeaseQuery',
                inputValue: [
                    undefined,
                    dhcpInput,
                    undefined
                ],
                expectedValue: [
                    undefined,
                    dhcpExpected,
                    undefined
                ],
                referenceObjects: {
                    service: {
                        class: 'Service_Generic',
                        virtualAddresses: ['3.3.3.3'],
                        virtualPort: 110
                    }
                },
                extractFunction: (o) => {
                    const result = (o.dhcpLeaseQuery && o.dhcpLeaseQuery.vsName) ? o.dhcpLeaseQuery.vsName.split('/').pop() : undefined;
                    return result;
                }
            },
            {
                name: 'serverSideSessionsEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            }
        ];
        return assertEnforcementSubscriberManagementProfileClass(properties);
    });
});

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

describe('Enforcement_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementProfileClass(properties) {
        return assertClass('Enforcement_Profile', properties);
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
                name: 'parentProfile',
                inputValue: [
                    undefined,
                    {
                        use: 'enfProf'
                    },
                    undefined
                ],
                expectedValue: ['spm', 'enfProf', 'spm'],
                referenceObjects: {
                    enfProf: {
                        class: 'Enforcement_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'policiesGlobalHighPrecedence',
                inputValue: [
                    undefined,
                    [
                        {
                            use: 'enfPolicy1'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['enfPolicy1'],
                    []
                ],
                referenceObjects: {
                    enfPolicy1: {
                        class: 'Enforcement_Policy'
                    }
                },
                extractFunction: (o) => {
                    const names = [];
                    if (o.globalPoliciesHighPrecedence) {
                        o.globalPoliciesHighPrecedence.forEach((pol) => {
                            names.push(pol.name);
                        });
                    }
                    return names;
                }
            },
            {
                name: 'policiesGlobalLowPrecedence',
                inputValue: [
                    undefined,
                    [
                        {
                            use: 'enfPolicy2'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['enfPolicy2'],
                    []
                ],
                referenceObjects: {
                    enfPolicy2: {
                        class: 'Enforcement_Policy'
                    }
                },
                extractFunction: (o) => {
                    const names = [];
                    if (o.globalPoliciesLowPrecedence) {
                        o.globalPoliciesLowPrecedence.forEach((pol) => {
                            names.push(pol.name);
                        });
                    }
                    return names;
                }
            },
            {
                name: 'policiesUnknownSubscribers',
                inputValue: [
                    undefined,
                    [
                        {
                            use: 'enfPolicy3'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['enfPolicy3'],
                    []
                ],
                referenceObjects: {
                    enfPolicy3: {
                        class: 'Enforcement_Policy'
                    }
                },
                extractFunction: (o) => {
                    const names = [];
                    if (o.unknownSubscriberPolicies) {
                        o.unknownSubscriberPolicies.forEach((pol) => {
                            names.push(pol.name);
                        });
                    }
                    return names;
                }
            },
            {
                name: 'connectionOptimizationEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'connectionOptimizationService',
                inputValue: [
                    undefined,
                    {
                        use: 'service'
                    },
                    undefined
                ],
                expectedValue: [undefined, 'service', undefined],
                referenceObjects: {
                    service: {
                        class: 'Service_Generic',
                        virtualAddresses: ['4.4.4.4'],
                        virtualPort: 100
                    }
                },
                extractFunction: (o) => {
                    const result = (o.fastVsName) ? o.fastVsName.name : undefined;
                    return result;
                }
            }
        ];
        return assertEnforcementProfileClass(properties);
    });
});

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

describe('Enforcement_Forwarding_Endpoint', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementForwardingEndpointClass(properties) {
        return assertClass('Enforcement_Forwarding_Endpoint', properties);
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
                name: 'pool',
                inputValue: [
                    {
                        use: 'thePool1'
                    },
                    {
                        use: 'thePool2'
                    },
                    {
                        use: 'thePool1'
                    }
                ],
                expectedValue: ['thePool1', 'thePool2', 'thePool1'],
                referenceObjects: {
                    thePool1: {
                        class: 'Pool'
                    },
                    thePool2: {
                        class: 'Pool'
                    }
                },
                extractFunction: (o) => o.pool.name
            },
            {
                name: 'SNATPool',
                inputValue: [
                    undefined,
                    {
                        use: 'snatPool'
                    },
                    undefined
                ],
                expectedValue: [undefined, 'snatPool', undefined],
                referenceObjects: {
                    snatPool: {
                        class: 'SNAT_Pool',
                        snatAddresses: [
                            '4.3.2.1'
                        ]
                    }
                },
                extractFunction: (o) => (o.snatPool ? o.snatPool.name : undefined)
            },
            {
                name: 'sourcePortAction',
                inputValue: [undefined, 'change', undefined],
                expectedValue: ['preserve', 'change', 'preserve']
            },
            {
                name: 'addressTranslationEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'portTranslationEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'defaultPersistenceType',
                inputValue: [undefined, 'source-ip', undefined],
                expectedValue: ['disabled', 'source-ip', 'disabled'],
                extractFunction: (o) => o.persistence.type
            },
            {
                name: 'fallbackPersistenceType',
                inputValue: [undefined, 'source-ip', undefined],
                expectedValue: ['disabled', 'source-ip', 'disabled'],
                extractFunction: (o) => o.persistence.fallback
            },
            {
                name: 'persistenceHashSettings',
                inputValue: [
                    undefined,
                    {
                        length: 2048,
                        offset: 1000,
                        tclScript: 'unsigned value = 27, ch; for (ch = *string++; ch; ch = *string++) { value += (value << 6) + ch; } return value;'
                    },
                    undefined
                ],
                expectedValue: [
                    {
                        algorithm: 'carp',
                        length: 1024,
                        offset: 0,
                        source: 'uri'
                    },
                    {
                        algorithm: 'carp',
                        length: 2048,
                        offset: 1000,
                        source: 'tcl-snippet',
                        tclValue: 'unsigned value = 27, ch; for (ch = *string++; ch; ch = *string++) { value += (value << 6) + ch; } return value;'
                    },
                    {
                        algorithm: 'carp',
                        length: 1024,
                        offset: 0,
                        source: 'uri'
                    }
                ],
                extractFunction: (o) => o.persistence.hashSettings
            }
        ];
        return assertEnforcementForwardingEndpointClass(properties);
    });
});

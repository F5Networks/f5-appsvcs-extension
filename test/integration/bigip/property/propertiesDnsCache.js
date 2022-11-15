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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('DNS_Cache', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDnsCacheClass(properties, options) {
        return assertClass('DNS_Cache', properties, options);
    }

    const commonProperties = [
        {
            name: 'remark',
            inputValue: [undefined, 'DNS Cache', undefined],
            expectedValue: [undefined, 'DNS Cache', undefined]
        },
        {
            name: 'answerDefaultZones',
            inputValue: [undefined, true, undefined],
            expectedValue: ['no', 'yes', 'no']
        },
        {
            name: 'messageCacheSize',
            inputValue: [undefined, 0, undefined],
            expectedValue: [1048576, 0, 1048576]
        },
        {
            name: 'recordCacheSize',
            inputValue: [undefined, 1, undefined],
            expectedValue: [10485760, 1, 10485760]
        },
        {
            name: 'recordRotationMethod',
            inputValue: [undefined, 'query-id', undefined],
            expectedValue: ['none', 'query-id', 'none']
        },
        {
            name: 'localZones',
            inputValue: [
                undefined,
                {
                    'norecords.com': {
                        type: 'type-transparent',
                        records: []
                    },
                    '_sip._tcp.example.com': {
                        type: 'transparent',
                        records: [
                            '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                        ]
                    },
                    'tworecords.com': {
                        type: 'transparent',
                        records: [
                            'wiki.tworecords.com 300 IN A 10.10.10.125',
                            'wiki.tworecords.com 300 IN A 10.10.10.126'
                        ]
                    }
                },
                undefined
            ],
            expectedValue: [
                undefined,
                [
                    {
                        tmName: 'norecords.com',
                        type: 'type-transparent'
                    },
                    {
                        tmName: '_sip._tcp.example.com',
                        records: [
                            '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                        ],
                        type: 'transparent'
                    },
                    {
                        tmName: 'tworecords.com',
                        records: [
                            'wiki.tworecords.com 300 IN A 10.10.10.125',
                            'wiki.tworecords.com 300 IN A 10.10.10.126'
                        ],
                        type: 'transparent'
                    }
                ],
                undefined
            ]
        }
    ];

    it('Transparent', () => {
        const properties = commonProperties.concat([
            {
                name: 'type',
                inputValue: ['transparent'],
                expectedValue: ['tm:ltm:dns:cache:transparent:transparentstate'],
                extractFunction: (o) => o.kind
            }
        ]);
        return assertDnsCacheClass(properties);
    });

    // TODO: Enable when other types are support
    it.skip('Resolver', () => {
        const properties = commonProperties.concat([
            {
                name: 'type',
                inputValue: ['resolver'],
                expectedValue: ['tm:ltm:dns:cache:resolver:resolverstate'],
                extractFunction: (o) => o.kind
            }
        ]);
        return assertDnsCacheClass(properties);
    });
});

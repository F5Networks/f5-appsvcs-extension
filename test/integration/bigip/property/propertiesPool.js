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
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const requestUtil = require('../../../common/requestUtilPromise');

describe('Pool', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertPoolClass(properties, options) {
        return assertClass('Pool', properties, options);
    }

    it('All Properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'loadBalancingMode',
                inputValue: [undefined, 'dynamic-ratio-member', undefined],
                expectedValue: ['round-robin', 'dynamic-ratio-member', 'round-robin']
            },
            {
                name: 'allowNATEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'allowSNATEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'minimumMembersActive',
                inputValue: [undefined, 2, undefined],
                expectedValue: [1, 2, 1]
            },
            {
                name: 'minimumMonitors',
                inputValue: [undefined, 2, 'all', 1],
                expectedValue: [undefined, '2', 'all', undefined],
                extractFunction: (o) => {
                    if (!o.monitor) {
                        return undefined;
                    }
                    if (o.monitor.includes('min')) {
                        return o.monitor.split(' ')[1];
                    }
                    return 'all';
                }
            },
            {
                name: 'monitors',
                inputValue: [undefined, ['https', 'http'], ['https', 'tcp', 'http'], undefined],
                expectedValue: [
                    undefined,
                    'min 2 of { /Common/https /Common/http }',
                    '/Common/https and /Common/tcp and /Common/http',
                    undefined
                ],
                extractFunction: (o) => ((o.monitor) ? o.monitor.trim() : undefined)
            },
            {
                name: 'members',
                inputValue: [
                    [],
                    [
                        {
                            servicePort: 400,
                            connectionLimit: 1000,
                            rateLimit: 100,
                            dynamicRatio: 50,
                            ratio: 50,
                            priorityGroup: 4,
                            monitors: ['http'],
                            minimumMonitors: 1,
                            adminState: 'disable',
                            addressDiscovery: 'static',
                            serverAddresses: ['2.2.2.2', '3.3.3.3'],
                            description: 'Test Description',
                            routeDomain: 1,
                            metadata: {
                                example: {
                                    value: 'test'
                                },
                                example1: {
                                    value: '123',
                                    persist: false
                                }
                            }
                        }
                    ],
                    [
                        {
                            servicePort: 400,
                            connectionLimit: 1000,
                            rateLimit: 100,
                            dynamicRatio: 50,
                            ratio: 50,
                            priorityGroup: 4,
                            monitors: ['http', 'https'],
                            minimumMonitors: 'all',
                            adminState: 'disable',
                            addressDiscovery: 'static',
                            serverAddresses: ['5.5.5.5'],
                            description: 'Test Description',
                            routeDomain: 1,
                            metadata: {
                                example: {
                                    value: 'test'
                                },
                                example1: {
                                    value: '123',
                                    persist: false
                                }
                            }
                        }
                    ],
                    [
                        {
                            servicePort: 400,
                            connectionLimit: 1000,
                            rateLimit: 100,
                            dynamicRatio: 50,
                            ratio: 50,
                            priorityGroup: 4,
                            monitors: ['http'],
                            minimumMonitors: 1,
                            adminState: 'disable',
                            addressDiscovery: 'static',
                            serverAddresses: ['3.3.3.3', '4.4.4.4'],
                            description: 'Test Description',
                            routeDomain: 1,
                            metadata: {
                                example: {
                                    value: 'test'
                                },
                                example1: {
                                    value: '123',
                                    persist: false
                                }
                            }
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            address: '2.2.2.2%1',
                            connectionLimit: 1000,
                            dynamicRatio: 50,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/2.2.2.2%1:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                },
                                {
                                    name: 'example1',
                                    persist: 'false',
                                    value: '123'
                                }
                            ],
                            monitor: 'min 1 of { /Common/http }',
                            name: '2.2.2.2%1:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 4,
                            rateLimit: '100',
                            ratio: 50,
                            session: 'user-disabled',
                            description: 'Test Description'
                        },
                        {
                            address: '3.3.3.3%1',
                            connectionLimit: 1000,
                            dynamicRatio: 50,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/3.3.3.3%1:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                },
                                {
                                    name: 'example1',
                                    persist: 'false',
                                    value: '123'
                                }
                            ],
                            monitor: 'min 1 of { /Common/http }',
                            name: '3.3.3.3%1:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 4,
                            rateLimit: '100',
                            ratio: 50,
                            session: 'user-disabled',
                            description: 'Test Description'
                        }
                    ],
                    [
                        {
                            address: '5.5.5.5%1',
                            connectionLimit: 1000,
                            dynamicRatio: 50,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/5.5.5.5%1:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                },
                                {
                                    name: 'example1',
                                    persist: 'false',
                                    value: '123'
                                }
                            ],
                            monitor: '/Common/http and /Common/https',
                            name: '5.5.5.5%1:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 4,
                            rateLimit: '100',
                            ratio: 50,
                            session: 'user-disabled',
                            description: 'Test Description'
                        }
                    ],
                    [
                        {
                            address: '3.3.3.3%1',
                            connectionLimit: 1000,
                            dynamicRatio: 50,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/3.3.3.3%1:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                },
                                {
                                    name: 'example1',
                                    persist: 'false',
                                    value: '123'
                                }
                            ],
                            monitor: 'min 1 of { /Common/http }',
                            name: '3.3.3.3%1:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 4,
                            rateLimit: '100',
                            ratio: 50,
                            session: 'user-disabled',
                            description: 'Test Description'
                        },
                        {
                            address: '4.4.4.4%1',
                            connectionLimit: 1000,
                            dynamicRatio: 50,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/4.4.4.4%1:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                },
                                {
                                    name: 'example1',
                                    persist: 'false',
                                    value: '123'
                                }
                            ],
                            monitor: 'min 1 of { /Common/http }',
                            name: '4.4.4.4%1:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 4,
                            rateLimit: '100',
                            ratio: 50,
                            session: 'user-disabled',
                            description: 'Test Description'
                        }
                    ],
                    []
                ],
                extractFunction: (o) => {
                    o.members.forEach((member) => {
                        delete member.kind;
                        delete member.generation;
                        delete member.selfLink;
                        delete member.state;
                    });
                    return o.members;
                }
            },
            {
                name: 'metadata',
                inputValue: [
                    undefined,
                    {
                        example: { value: 'test' },
                        example1: { value: '123', persist: false }
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    [
                        { name: 'example', persist: 'true', value: 'test' },
                        { name: 'example1', persist: 'false', value: '123' }
                    ],
                    undefined
                ]
            },
            {
                name: 'reselectTries',
                inputValue: [undefined, 10, undefined],
                expectedValue: [0, 10, 0]
            },
            {
                name: 'serviceDownAction',
                inputValue: [undefined, 'drop', undefined],
                expectedValue: ['none', 'drop', 'none']
            },
            {
                name: 'slowRampTime',
                inputValue: [undefined, 23, undefined],
                expectedValue: [10, 23, 10]
            }
        ];

        const bigipItems = [{
            endpoint: '/mgmt/tm/net/route-domain',
            data: {
                name: '1',
                id: 1
            }
        }];

        return assertPoolClass(properties, { bigipItems });
    });

    it('should be able to connect to a custom monitor, modify other monitors, and delete it', () => {
        const properties = [
            {
                name: 'minimumMonitors',
                inputValue: [1],
                skipAssert: true
            },
            {
                name: 'monitors',
                inputValue: [
                    ['https', { bigip: '/Common/customMonitor' }],
                    ['tcp', { bigip: '/Common/customMonitor' }],
                    ['https', 'tcp', 'http']
                ],
                expectedValue: [
                    'min 1 of { /Common/https /Common/customMonitor }',
                    'min 1 of { /Common/tcp /Common/customMonitor }',
                    'min 1 of { /Common/https /Common/tcp /Common/http }'
                ],
                extractFunction: (o) => ((o.monitor) ? o.monitor.trim() : undefined)
            }
        ];

        const bigipItems = [{
            endpoint: '/mgmt/tm/ltm/monitor/http',
            data: { name: 'customMonitor' }
        }];

        return assertPoolClass(properties, { bigipItems });
    });

    it('Mix Common and AS3 nodes', () => {
        const properties = [
            {
                name: 'members',
                inputValue: [[{
                    servicePort: 8080,
                    serverAddresses: [
                        '1.1.1.1',
                        '2.2.2.2'
                    ]
                }]],
                expectedValue: ['1.1.1.1,2.2.2.2'],
                extractFunction: (o) => o.members.map((m) => m.address).join(',')

            }
        ];

        const bigipItems = [{
            endpoint: '/mgmt/tm/ltm/node',
            data: {
                name: '1.1.1.1',
                address: '1.1.1.1'
            }
        }];

        return assertPoolClass(properties, { bigipItems });
    });

    it('Remove metadata', () => {
        const properties = [
            {
                name: 'members',
                inputValue: [
                    [
                        {
                            servicePort: 80,
                            serverAddresses: ['2.2.2.2'],
                            metadata: {
                                example: {
                                    value: 'test'
                                },
                                example1: {
                                    value: '123',
                                    persist: false
                                }
                            }
                        }
                    ],
                    [
                        {
                            servicePort: 80,
                            serverAddresses: ['2.2.2.2'],
                            metadata: {
                                example: {
                                    value: 'test'
                                }
                            }
                        }
                    ],
                    [
                        {
                            servicePort: 80,
                            serverAddresses: ['2.2.2.2'],
                            metadata: {}
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [
                        {
                            address: '2.2.2.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/2.2.2.2:80',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                },
                                {
                                    name: 'example1',
                                    persist: 'false',
                                    value: '123'
                                }
                            ],
                            monitor: 'default',
                            name: '2.2.2.2:80',
                            partition: 'TEST_Pool',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        }
                    ],
                    [
                        {
                            address: '2.2.2.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/2.2.2.2:80',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            metadata: [
                                {
                                    name: 'example',
                                    persist: 'true',
                                    value: 'test'
                                }
                            ],
                            monitor: 'default',
                            name: '2.2.2.2:80',
                            partition: 'TEST_Pool',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        }
                    ],
                    [
                        {
                            address: '2.2.2.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/2.2.2.2:80',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: '2.2.2.2:80',
                            partition: 'TEST_Pool',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        }
                    ],
                    []
                ],
                extractFunction: (o) => {
                    o.members.forEach((member) => {
                        delete member.kind;
                        delete member.generation;
                        delete member.selfLink;
                    });
                    return o.members;
                }
            }
        ];

        return assertPoolClass(properties);
    });

    describe('FQDN members', function () {
        function extractFunction(o) {
            const fqdnMember = o.members.find((member) => member.ephemeral === 'false');
            if (fqdnMember) {
                return {
                    fullPath: fqdnMember.fullPath,
                    name: fqdnMember.name,
                    fqdn: fqdnMember.fqdn
                };
            }
            return undefined;
        }

        it('regular nodes', function () {
            const properties = [
                {
                    name: 'members',
                    inputValue: [
                        undefined,
                        [{
                            servicePort: 80,
                            addressDiscovery: 'fqdn',
                            autoPopulate: true,
                            hostname: 'www.f5.com',
                            queryInterval: 0,
                            shareNodes: false,
                            fqdnPrefix: 'node-'
                        }]
                    ],
                    expectedValue: [
                        undefined,
                        {
                            fullPath: '/TEST_Pool/node-www.f5.com:80',
                            name: 'node-www.f5.com:80',
                            fqdn: {
                                autopopulate: 'enabled',
                                tmName: 'www.f5.com'
                            }
                        },
                        undefined
                    ],
                    extractFunction
                }
            ];
            return assertPoolClass(properties);
        });

        it('shared nodes', function () {
            const properties = [
                {
                    name: 'members',
                    inputValue: [
                        undefined,
                        [{
                            servicePort: 80,
                            addressDiscovery: 'fqdn',
                            autoPopulate: true,
                            hostname: 'www.f5.com',
                            queryInterval: 0,
                            shareNodes: true,
                            fqdnPrefix: 'node-'
                        }]
                    ],
                    expectedValue: [
                        undefined,
                        {
                            fullPath: '/Common/node-www.f5.com:80',
                            name: 'node-www.f5.com:80',
                            fqdn: {
                                autopopulate: 'enabled',
                                tmName: 'www.f5.com'
                            }
                        },
                        undefined
                    ],
                    extractFunction
                }
            ];
            return assertPoolClass(properties);
        });

        it('modify autopopulate', () => {
            const properties = [
                {
                    name: 'members',
                    inputValue: [
                        [{
                            servicePort: 80,
                            addressDiscovery: 'fqdn',
                            autoPopulate: true,
                            hostname: 'www.f5.com',
                            queryInterval: 0,
                            shareNodes: false,
                            fqdnPrefix: 'node-'
                        }],
                        [{
                            servicePort: 80,
                            addressDiscovery: 'fqdn',
                            autoPopulate: false,
                            hostname: 'www.f5.com',
                            queryInterval: 0,
                            shareNodes: false,
                            fqdnPrefix: 'node-'
                        }]
                    ],
                    expectedValue: [
                        {
                            fullPath: '/TEST_Pool/node-www.f5.com:80',
                            name: 'node-www.f5.com:80',
                            fqdn: {
                                autopopulate: 'enabled',
                                tmName: 'www.f5.com'
                            }
                        },
                        {
                            fullPath: '/TEST_Pool/node-www.f5.com:80',
                            name: 'node-www.f5.com:80',
                            fqdn: {
                                autopopulate: 'disabled',
                                tmName: 'www.f5.com'
                            }
                        }
                    ],
                    extractFunction
                }
            ];
            return assertPoolClass(properties);
        });
    });

    it('Service discovery members', function () {
        const properties = [
            {
                name: 'members',
                inputValue: [
                    [
                        {
                            servicePort: 400,
                            addressDiscovery: 'static',
                            serverAddresses: ['192.0.2.2']
                        },
                        {
                            servicePort: 401,
                            addressDiscovery: 'event',
                            shareNodes: true
                        }
                    ],
                    [
                        {
                            servicePort: 400,
                            connectionLimit: 1000,
                            rateLimit: 100,
                            dynamicRatio: 50,
                            ratio: 50,
                            priorityGroup: 4,
                            monitors: ['http'],
                            minimumMonitors: 1,
                            adminState: 'disable',
                            addressDiscovery: 'static',
                            serverAddresses: ['192.0.2.2']
                        },
                        {
                            servicePort: 401,
                            connectionLimit: 1001,
                            rateLimit: 101,
                            dynamicRatio: 51,
                            ratio: 51,
                            priorityGroup: 5,
                            monitors: ['http', 'https'],
                            minimumMonitors: 2,
                            adminState: 'disable',
                            addressDiscovery: 'event',
                            serverAddresses: ['192.0.2.3']
                        }
                    ],
                    [
                        {
                            servicePort: 400,
                            addressDiscovery: 'static',
                            serverAddresses: ['192.0.2.2']
                        },
                        {
                            servicePort: 401,
                            shareNodes: true,
                            addressDiscovery: 'event'
                        }
                    ]
                ],
                expectedValue: [
                    [
                        {
                            address: '192.0.2.4',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/Common/eggs:401',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: 'eggs:401',
                            partition: 'Common',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            address: '192.0.2.3',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/Common/spam:401',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: 'spam:401',
                            partition: 'Common',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            address: '192.0.2.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/192.0.2.2:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: '192.0.2.2:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        }
                    ],
                    [
                        {
                            address: '192.0.2.2',
                            connectionLimit: 1000,
                            dynamicRatio: 50,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/192.0.2.2:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'min 1 of { /Common/http }',
                            name: '192.0.2.2:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 4,
                            rateLimit: '100',
                            ratio: 50,
                            session: 'user-disabled',
                            state: 'checking'
                        },
                        {
                            address: '192.0.2.4',
                            connectionLimit: 1001,
                            dynamicRatio: 51,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/eggs:401',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'min 2 of { /Common/http /Common/https }',
                            name: 'eggs:401',
                            partition: 'TEST_Pool',
                            priorityGroup: 5,
                            rateLimit: '101',
                            ratio: 51,
                            session: 'user-disabled',
                            state: 'checking'
                        },
                        {
                            address: '192.0.2.3',
                            connectionLimit: 1001,
                            dynamicRatio: 51,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/spam:401',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'min 2 of { /Common/http /Common/https }',
                            name: 'spam:401',
                            partition: 'TEST_Pool',
                            priorityGroup: 5,
                            rateLimit: '101',
                            ratio: 51,
                            session: 'user-disabled',
                            state: 'checking'
                        }
                    ],
                    [
                        {
                            address: '192.0.2.4',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/Common/eggs:401',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: 'eggs:401',
                            partition: 'Common',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            address: '192.0.2.3',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/Common/spam:401',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: 'spam:401',
                            partition: 'Common',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            address: '192.0.2.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            fullPath: '/TEST_Pool/192.0.2.2:400',
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            name: '192.0.2.2:400',
                            partition: 'TEST_Pool',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        }
                    ]
                ],
                extractFunction: (o) => {
                    o.members.forEach((member) => {
                        delete member.kind;
                        delete member.generation;
                        delete member.selfLink;
                        delete member.description;
                    });
                    return o.members;
                },
                preFetchFunction: () => {
                    const options = {
                        body: [
                            {
                                id: 'spam',
                                ip: '192.0.2.3'
                            },
                            {
                                id: 'eggs',
                                ip: '192.0.2.4'
                            }
                        ],
                        path: `/mgmt/shared/service-discovery/task/~TEST_Pool~Application~${getItemName({ tenantName: 'TEST_Pool' })}/nodes`,
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil.post(options);
                }
            }
        ];

        return assertPoolClass(properties, { maxMcpRetries: -1 });
    });

    it('static named members', function () {
        const properties = [
            {
                name: 'members',
                inputValue: [
                    [],
                    [
                        {
                            servicePort: 400,
                            addressDiscovery: 'static',
                            serverAddresses: ['192.0.1.1', '192.0.1.2'],
                            servers: [
                                {
                                    name: 'mynode1.example.com',
                                    address: '192.0.2.1'
                                },
                                {
                                    name: 'mynode2.example.com',
                                    address: '192.0.2.2'
                                }
                            ]
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            name: '192.0.1.1:400',
                            partition: 'TEST_Pool',
                            fullPath: '/TEST_Pool/192.0.1.1:400',
                            address: '192.0.1.1',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            name: '192.0.1.2:400',
                            partition: 'TEST_Pool',
                            fullPath: '/TEST_Pool/192.0.1.2:400',
                            address: '192.0.1.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            name: 'mynode1.example.com:400',
                            partition: 'TEST_Pool',
                            fullPath: '/TEST_Pool/mynode1.example.com:400',
                            address: '192.0.2.1',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        },
                        {
                            name: 'mynode2.example.com:400',
                            partition: 'TEST_Pool',
                            fullPath: '/TEST_Pool/mynode2.example.com:400',
                            address: '192.0.2.2',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            ephemeral: 'false',
                            fqdn: {
                                autopopulate: 'disabled'
                            },
                            inheritProfile: 'enabled',
                            logging: 'disabled',
                            monitor: 'default',
                            priorityGroup: 0,
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked'
                        }
                    ],
                    []
                ],
                extractFunction: (o) => {
                    o.members.forEach((member) => {
                        delete member.kind;
                        delete member.generation;
                        delete member.selfLink;
                        delete member.description;
                    });
                    return o.members;
                }
            }
        ];

        return assertPoolClass(properties, { maxMcpRetries: -1 });
    });
});

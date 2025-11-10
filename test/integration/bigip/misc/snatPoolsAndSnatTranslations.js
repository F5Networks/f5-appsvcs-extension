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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const requestUtil = require('../../../common/requestUtilPromise');
const {
    postDeclaration,
    deleteDeclaration,
    postBigipItems,
    deleteBigipItems,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');
const {
    simpleCopy
} = require('../../../../src/lib/util/util');

describe('SNAT Pools and SNAT Translations', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should share translations between snat pools', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    snatPool1: {
                        class: 'SNAT_Pool',
                        snatAddresses: [
                            '192.0.96.10', // unique to snat pool 1
                            '192.0.96.11', // specified snat translation to share with snat pool 2
                            '192.0.96.12' // auto generated snat translation to share with snat pool 2
                        ]
                    },
                    snatTranslation: {
                        class: 'SNAT_Translation',
                        address: '192.0.96.11',
                        arpEnabled: false
                    }
                }
            }
        };

        const snatPoolDecl = simpleCopy(baseDecl);
        snatPoolDecl.Tenant.Application.snatPool2 = {
            class: 'SNAT_Pool',
            snatAddresses: [
                '192.0.96.11', // specified snat translation to share with snat pool 1
                '192.0.96.12', // auto generated snat translation to share with snat pool 1
                '192.0.96.13' // unique to snat pool 2
            ]
        };

        return Promise.resolve()
        // POST #1
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // POST #2
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatPoolDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatPoolDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // check results 1
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snatpool' }))
            .then((response) => {
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/Application/snatPool1') || {};
                assert.deepStrictEqual(result.members, [
                    '/Tenant/192.0.96.10',
                    '/Tenant/192.0.96.11',
                    '/Tenant/192.0.96.12'
                ], 'snatPool1 should have 192.0.96.[10-12] as members');
                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/Application/snatPool2') || {};
                assert.deepStrictEqual(result.members, [
                    '/Tenant/192.0.96.11',
                    '/Tenant/192.0.96.12',
                    '/Tenant/192.0.96.13'
                ], 'snatPool1 should have 192.0.96.[11-13] as members');
            })
            // check results 2
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snat-translation' }))
            .then((response) => {
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.10') || {};
                assert.strictEqual(result.arp, 'enabled', '192.0.96.10 should exist and have arp enabled');

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.11') || {};
                assert.strictEqual(result.arp, 'disabled', '192.0.96.11 should exist and have arp disabled');

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.12') || {};
                assert.strictEqual(result.arp, 'enabled', '192.0.96.11 should exist and have arp enabled');

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.12') || {};
                assert.strictEqual(result.arp, 'enabled', '192.0.96.13 should exist and have arp enabled');
            })
            // POST #0 again
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotentcy check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });

    it('should transition between autogenerated and specified snat translations', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    snatPool: {
                        class: 'SNAT_Pool',
                        snatAddresses: [
                            '192.0.96.10', // auto generated snat translation
                            '192.0.96.11' // transition between auto generated and specified snat translation
                        ]
                    }
                }
            }
        };

        const snatTranslationDecl = simpleCopy(baseDecl);
        snatTranslationDecl.Tenant.Application.snatTranslation = {
            class: 'SNAT_Translation',
            address: '192.0.96.11',
            arpEnabled: false
        };

        return Promise.resolve()
            // POST #1
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // POST #2
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatTranslationDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatTranslationDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // check results - filter
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snat-translation' }))
            .then((response) => {
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.10') || {};
                assert.strictEqual(result.arp, 'enabled');
                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.11') || {};
                assert.strictEqual(result.arp, 'disabled');
            })
            // POST #0 again
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotentcy check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });

    it('should allow POST declaration when snat and snatpool are created outside AS3', () => {
        const dec0 = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: '00547273-declaration-01',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    http_custom: {
                        class: 'HTTP_Profile',
                        remark: 'Test http profile'
                    },
                    tcp_custom: {
                        class: 'TCP_Profile',
                        remark: 'Test tcp profile'
                    }
                }
            }
        };
        const dec1 = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: '00547273-declaration-02',
            MyTenant1: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '10.0.1.10'
                        ],
                        pool: 'web_pool',
                        profileHTTP: {
                            bigip: '/Common/Shared/http_custom'
                        }
                    },
                    web_pool: {
                        class: 'Pool',
                        monitors: [
                            'http'
                        ],
                        members: [{
                            servicePort: 80,
                            serverAddresses: [
                                '192.0.1.10',
                                '192.0.1.11'
                            ]
                        }]
                    }
                }
            }
        };
        const bigipSnatItems = [
            {
                endpoint: '/mgmt/tm/ltm/snat',
                data: {
                    name: 'my_snat',
                    translation: '10.10.10.1',
                    origins: [
                        {
                            name: '6.6.6.1'
                        },
                        {
                            name: '6.6.6.2'
                        }
                    ]
                }
            }
        ];
        const bigipSnatPoolItems = [
            {
                endpoint: '/mgmt/tm/ltm/snatpool',
                data: {
                    name: 'non_as3_snatpool',
                    members: [
                        '/Common/3.3.3.1',
                        '/Common/3.3.3.2'
                    ]
                }
            }
        ];

        return Promise.resolve()
            .then(() => postDeclaration(dec0, { declarationIndex: 0 }))
            .then(() => postBigipItems(bigipSnatPoolItems))
            .then(() => postDeclaration(dec1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => postBigipItems(bigipSnatItems))
            .then(() => postDeclaration(dec1, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].message, 'no change');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipSnatItems))
                .then(() => deleteBigipItems(bigipSnatPoolItems)));
    });

    it('should create snat translation if an existing pool member is used as snat', () => {
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '2549', id: 2549 }
            }
        ];
        const dec0 = {
            schemaVersion: '3.52.0',
            updateMode: 'selective',
            class: 'ADC',
            SampleTenant: {
                defaultRouteDomain: 2549,
                class: 'Tenant',
                SampleApp: {
                    template: 'generic',
                    class: 'Application',
                    SampleServiceL4A: {
                        virtualAddresses: [
                            '192.168.0.1'
                        ],
                        virtualPort: 3200,
                        persistenceMethods: [],
                        iRules: [],
                        policyEndpoint: [],
                        label: '',
                        pool: 'SamplePool',
                        profileL4: {
                            bigip: '/Common/fastL4'
                        },
                        snat: 'self',
                        class: 'Service_L4'
                    },
                    SampleMonitor: {
                        monitorType: 'tcp',
                        send: '',
                        receive: '',
                        interval: 20,
                        timeout: 61,
                        class: 'Monitor'
                    },
                    SamplePool: {
                        loadBalancingMode: 'round-robin',
                        members: [
                            {
                                enable: true,
                                servicePort: 31214,
                                serverAddresses: [
                                    '192.168.0.2'
                                ],
                                adminState: 'enable',
                                ratio: 1
                            },
                            {
                                enable: true,
                                servicePort: 31214,
                                serverAddresses: [
                                    '192.168.0.3'
                                ],
                                adminState: 'enable',
                                ratio: 1
                            }
                        ],
                        monitors: [
                            {
                                use: 'SampleMonitor'
                            }
                        ],
                        class: 'Pool'
                    }
                }
            }
        };
        const dec1 = {
            schemaVersion: '3.52.0',
            updateMode: 'selective',
            class: 'ADC',
            SampleTenant: {
                defaultRouteDomain: 2549,
                class: 'Tenant',
                SampleApp: {
                    template: 'generic',
                    class: 'Application',
                    SampleServiceL4A: {
                        virtualAddresses: [
                            '192.168.0.1'
                        ],
                        virtualPort: 3200,
                        persistenceMethods: [],
                        iRules: [],
                        policyEndpoint: [],
                        label: '',
                        pool: 'SamplePool',
                        profileL4: {
                            bigip: '/Common/fastL4'
                        },
                        snat: 'self',
                        class: 'Service_L4'
                    },
                    SampleServiceL4B: {
                        virtualAddresses: [
                            '192.168.0.3'
                        ],
                        virtualPort: 3200,
                        persistenceMethods: [],
                        iRules: [],
                        policyEndpoint: [],
                        label: '',
                        pool: 'SamplePool',
                        profileL4: {
                            bigip: '/Common/fastL4'
                        },
                        snat: 'self',
                        class: 'Service_L4'
                    },
                    SampleMonitor: {
                        monitorType: 'tcp',
                        send: '',
                        receive: '',
                        interval: 20,
                        timeout: 61,
                        class: 'Monitor'
                    },
                    SamplePool: {
                        loadBalancingMode: 'round-robin',
                        members: [
                            {
                                enable: true,
                                servicePort: 31214,
                                serverAddresses: [
                                    '192.168.0.2'
                                ],
                                adminState: 'enable',
                                ratio: 1
                            }
                        ],
                        monitors: [
                            {
                                use: 'SampleMonitor'
                            }
                        ],
                        class: 'Pool'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(dec0, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(dec1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snat-translation' }))
            .then((response) => {
                assert.strictEqual(response.body.items.length, 2);
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/SampleTenant/192.168.0.1%2549');
                assert(result);

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/SampleTenant/192.168.0.3%2549');
                assert(result);
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    it('should handle to create node when same IP SNAT Translation exists', () => {
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '2742', id: 2742 }
            }
        ];
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            updateMode: 'selective',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 2742,
                app: {
                    class: 'Application',
                    L4Service1: {
                        class: 'Service_L4',
                        iRules: [],
                        label: '',
                        persistenceMethods: [],
                        policyEndpoint: [],
                        pool: 'pool_L4',
                        profileL4: {
                            bigip: '/Common/fastL4'
                        },
                        snat: 'self',
                        virtualAddresses: [
                            '192.0.2.0'
                        ],
                        virtualPort: 30010
                    },
                    pool_L4: {
                        class: 'Pool',
                        label: '',
                        loadBalancingMode: 'round-robin',
                        members: [
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 1,
                                remark: '0ec91a62-2abc-492d-9848-3a7b42c39e9d',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 32651
                            }
                        ],
                        monitors: [
                            {
                                bigip: '/Common/http'
                            }
                        ]
                    },
                    template: 'generic'
                }
            }
        };
        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            updateMode: 'selective',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 2742,
                app: {
                    class: 'Application',
                    L4Service1: {
                        class: 'Service_L4',
                        iRules: [],
                        label: '',
                        persistenceMethods: [],
                        policyEndpoint: [],
                        pool: 'pool_L4',
                        profileL4: {
                            bigip: '/Common/fastL4'
                        },
                        snat: 'self',
                        virtualAddresses: [
                            '192.0.2.3'
                        ],
                        virtualPort: 30010
                    },
                    pool_L4: {
                        class: 'Pool',
                        label: '',
                        loadBalancingMode: 'round-robin',
                        members: [
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 1,
                                remark: '0ec91a62-2abc-492d-9848-3a7b42c39e9d',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 32651
                            },
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 1,
                                remark: '0ec91a62-2abc-492d-9848-3a7b42c39e9d',
                                serverAddresses: [
                                    '192.0.2.4'
                                ],
                                servicePort: 32651
                            },
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 1,
                                remark: '0ec91a62-2abc-492d-9848-3a7b42c39e9d',
                                serverAddresses: [
                                    '192.0.2.0'
                                ],
                                servicePort: 32651
                            }
                        ],
                        monitors: [
                            {
                                bigip: '/Common/http'
                            }
                        ]
                    },
                    template: 'generic'
                }
            }
        };

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~app~L4Service1'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/tenant/app/L4Service1');
                assert.strictEqual(response.destination, '/tenant/192.0.2.0%2742:30010');
                assert.strictEqual(response.pool, '/tenant/app/pool_L4');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool_L4/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].fullPath, '/tenant/192.0.2.1%2742:32651');
                assert.strictEqual(response.items[0].address, '192.0.2.1%2742');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~app~L4Service1'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/tenant/app/L4Service1');
                assert.strictEqual(response.destination, '/tenant/192.0.2.3%2742:30010');
                assert.strictEqual(response.pool, '/tenant/app/pool_L4');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool_L4/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 3);
                const expectedNames = ['192.0.2.0%2742:32651', '192.0.2.1%2742:32651', '192.0.2.4%2742:32651'];
                const expectedAddresses = ['192.0.2.0%2742', '192.0.2.1%2742', '192.0.2.4%2742'];
                const names = response.items.map((item) => item.name);
                const addresses = response.items.map((item) => item.address);
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(addresses, expectedAddresses);
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });
});

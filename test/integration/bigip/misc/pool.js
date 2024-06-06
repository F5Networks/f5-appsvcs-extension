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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    postBigipItems,
    deleteBigipItems,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Pool', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());

    it('should handle member rollback', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.42.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 80
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'tcp'
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
            })
            .then(() => {
                declaration.tenant.app.pool.members[0].servicePort = 0;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => assert.strictEqual(response.results[0].code, 422))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
            });
    });

    it('should add pool with updated monitor', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.47.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '10.0.0.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https'
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.47.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '10.0.0.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    pool1: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '10.0.0.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https',
                        targetPort: 9631
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/app/testMonitor }');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool1/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/app/testMonitor }');
            });
    });

    it('should ref poolMonitor by pool using @ special character', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.51.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: '/@/@/testMonitor'
                            }
                        ]
                    },
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https'
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.51.0',
            tenant: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    testRefMonitor: {
                        class: 'Monitor',
                        monitorType: 'https',
                        targetPort: 9631
                    }
                },
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: '/@/Shared/testRefMonitor'
                            }
                        ]
                    },
                    pool1: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.2'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: '/@/Shared/testRefMonitor'
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/app/testMonitor }');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool1/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/Shared/testRefMonitor }');
            });
    });

    it('should handle iRule containing special characters with VS having both pool and monitor config', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.51.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    virtual_service: {
                        class: 'Service_HTTP',
                        iRules: [
                            '/tenant/app/myIrule'
                        ],
                        shareAddresses: true,
                        virtualAddresses: [
                            '192.0.2.1'
                        ],
                        virtualPort: 45324,
                        pool: 'pool'
                    },
                    myIrule: {
                        class: 'iRule',
                        iRule: `# Hi test iRule with Special Characters at (end)
                                # [test1]
                                # (test2)
                                # {test3}
                                # <test4>
                                # "test5"
                                # 'test6'
                                when HTTP_REQUEST {
                                set path [HTTP::path]
                                set requestPath [lrange [split $path ";"] 0 0]
                                # !test7!
                                # @test8@
                                # $test9$
                            }`
                    },
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '198.51.100.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https'
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/app/testMonitor }');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~app~virtual_service/'))
            .then((response) => {
                assert.strictEqual(response.name, 'virtual_service');
                assert.strictEqual(response.rules[0], '/tenant/app/myIrule');
                assert.strictEqual(response.pool, '/tenant/app/pool');
            });
    });
    it('should cleanup ephemeral nodes', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.48.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'fqdn',
                                servicePort: 80,
                                autoPopulate: true,
                                hostname: 'f5.com'
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => promiseUtil.delay(5000))
            .then(() => getPath('/mgmt/tm/ltm/node'))
            .then((results) => {
                const ephemeralNodes = (results.items || []).filter((node) => node.name.includes('_auto_'));
                return assert.strictEqual(
                    ephemeralNodes.length > 0,
                    true
                );
            })
            .then(() => deleteDeclaration())
            .then(() => promiseUtil.delay(5000))
            .then(() => getPath('/mgmt/tm/ltm/node'))
            .then((results) => {
                const ephemeralNodes = (results.items || []).filter((node) => node.name.includes('_auto_'));
                return assert.strictEqual(
                    ephemeralNodes.length > 0,
                    false
                );
            });
    });

    it('should post shared fqdn nodes in Common', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.48.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'fqdn',
                                servicePort: 80,
                                autoPopulate: true,
                                shareNodes: true,
                                hostname: 'f5.com'
                            }
                        ]
                    }
                }
            }
        };

        const expectedReferences = {
            name: 'references',
            persist: 'true',
            value: '1'
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/node'))
            .then((response) => {
                const fqdnNode = (response.items || []).filter((node) => node.name === 'f5.com');
                assert.strictEqual(fqdnNode.length, 1);
                assert.strictEqual(fqdnNode[0].fqdn.tmName, 'f5.com');
                assert.strictEqual(fqdnNode[0].metadata.length, 2);
                assert.deepStrictEqual(fqdnNode[0].metadata[1], expectedReferences);
            });
    });

    it('should modify pool, existing pool member and create new pool member in single declaration', () => {
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '2' }
            }
        ];
        const decl0 = {
            class: 'ADC',
            id: 'abc',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 2,
                app: {
                    class: 'Application',
                    label: '5599f0fe-3ad1-42ee-a761-7f86674a34d5',
                    pool: {
                        class: 'Pool',
                        loadBalancingMode: 'ratio-member',
                        members: [
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 20,
                                serverAddresses: [
                                    '192.0.2.25'
                                ],
                                servicePort: 80
                            }
                        ]
                    },
                    template: 'generic'
                }
            },
            schemaVersion: '3.51.0',
            updateMode: 'selective'
        };

        const decl1 = {
            class: 'ADC',
            id: 'abc',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 2,
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        loadBalancingMode: 'dynamic-ratio-node',
                        members: [
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 20,
                                priorityGroup: 10,
                                serverAddresses: [
                                    '192.0.2.25'
                                ],
                                servicePort: 80
                            },
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 20,
                                serverAddresses: [
                                    '192.0.2.26'
                                ],
                                servicePort: 81
                            }
                        ]
                    },
                    template: 'generic'
                }
            },
            schemaVersion: '3.51.0',
            updateMode: 'selective'
        };

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(decl0, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/'))
            .then((response) => {
                assert.strictEqual(response.loadBalancingMode, 'dynamic-ratio-node');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members/'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members/~tenant~192.0.2.25%252:80'))
            .then((response) => {
                assert.strictEqual(response.priorityGroup, 10);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members/~tenant~192.0.2.26%252:81'))
            .then((response) => {
                assert.strictEqual(response.address, '192.0.2.26%2');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    it('TEST useCommonRouteDomainTenant property', () => {
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/auth/partition',
                data: { name: 'tenant' }
            },
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '2', partition: 'tenant', id: 2 }
            }
        ];
        const deleteRouteDomain = [

            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '~tenant~2', partition: 'tenant' }
            }

        ];

        const decl0 = {
            class: 'ADC',
            id: 'abc',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 2,
                useCommonRouteDomainTenant: false,
                app: {
                    class: 'Application',
                    label: '5599f0fe-3ad1-42ee-a761-7f86674a34d5',
                    pool: {
                        class: 'Pool',
                        loadBalancingMode: 'ratio-member',
                        members: [
                            {
                                adminState: 'enable',
                                enable: true,
                                ratio: 20,
                                serverAddresses: [
                                    '192.0.2.25'
                                ],
                                servicePort: 80
                            }
                        ]
                    },
                    template: 'generic'
                }
            },
            schemaVersion: '3.51.0',
            updateMode: 'selective'
        };
        const setDefaultRouteDomainDecl = {
            class: 'ADC',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 0,
                useCommonRouteDomainTenant: false,
                app: {
                    class: 'Application',
                    template: 'generic'
                }
            },
            schemaVersion: '3.51.0'
        };

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(decl0, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(decl0, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/'))
            .then((response) => {
                assert.strictEqual(response.loadBalancingMode, 'ratio-member');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members/'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members/~tenant~192.0.2.25%252:80'))
            .then((response) => {
                assert.strictEqual(response.priorityGroup, 0);
                assert.strictEqual(response.address, '192.0.2.25%2');
            })
            .then(() => getPath('/mgmt/tm/ltm/node/~tenant~192.0.2.25%252'))
            .then((response) => {
                assert.strictEqual(response.address, '192.0.2.25%2');
            })
            .finally(() => postDeclaration(setDefaultRouteDomainDecl, { declarationIndex: 1 })
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                }))
            .then(() => deleteBigipItems(deleteRouteDomain))
            .then(() => deleteDeclaration());
    });
});

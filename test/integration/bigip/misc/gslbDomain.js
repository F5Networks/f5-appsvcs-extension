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

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('GSLB_Domain', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        assertModuleProvisioned.call(this, 'gtm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should create multiple domains sharing the same domain name', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.11.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    WIP_AAAA_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'AAAA',
                        domainName: 'wip.example.com'
                    },
                    WIP_A_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'A',
                        domainName: 'wip.example.com'
                    },
                    WIP_MX_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'MX',
                        domainName: 'wip.example.com'
                    },
                    WIP_CNAME_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'CNAME',
                        domainName: 'wip.example.com'
                    },
                    WIP_NAPTR_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'NAPTR',
                        domainName: 'wip.example.com'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/a'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/aaaa'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/mx'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/cname'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/naptr'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            });
    });

    it('should create a Wide-IP domain with two pools, A and CNAME', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.53.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    testDataCenter: {
                        class: 'GSLB_Data_Center'
                    },
                    testServer: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'testDataCenter'
                        },
                        devices: [
                            {
                                address: '192.0.2.0'
                            }
                        ],
                        virtualServers: [
                            {
                                address: '192.0.2.1',
                                port: 5050
                            }
                        ]
                    }
                }
            },
            ExampleTenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    testDomain: {
                        class: 'GSLB_Domain',
                        domainName: 'a_wip.local',
                        aliases: [],
                        resourceRecordType: 'A',
                        poolLbMode: 'global-availability',
                        pools: [
                            {
                                use: 'a_pool'
                            }
                        ],
                        poolsCname: [
                            {
                                use: 'cname_pool'
                            }
                        ],
                        iRules: [],
                        persistCidrIpv4: 24,
                        persistenceEnabled: false,
                        clientSubnetPreferred: true,
                        ttlPersistence: 3600
                    },
                    a_pool: {
                        class: 'GSLB_Pool',
                        members: [
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/testServer'
                                },
                                virtualServer: '0',
                                enabled: true,
                                dependsOn: 'none'
                            }
                        ],
                        resourceRecordType: 'A',
                        enabled: true,
                        lbModePreferred: 'round-robin',
                        lbModeAlternate: 'round-robin',
                        lbModeFallback: 'return-to-dns',
                        ttl: 5,
                        verifyMemberEnabled: true,
                        maxAnswersReturned: 1
                    },
                    cname_pool: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'CNAME',
                        enabled: true,
                        members: [
                            {
                                domainName: 'google.com',
                                isDomainNameStatic: true,
                                enabled: true
                            }
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[2].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~ExampleTenant~Application~a_pool'))
            .then((response) => {
                assert.strictEqual(response.kind, 'tm:gtm:pool:a:astate');
                assert.strictEqual(response.name, 'a_pool');
                assert.strictEqual(response.partition, 'ExampleTenant');
                assert.strictEqual(response.subPath, 'Application');
                assert.strictEqual(response.fullPath, '/ExampleTenant/Application/a_pool');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/cname/~ExampleTenant~Application~cname_pool'))
            .then((response) => {
                assert.strictEqual(response.kind, 'tm:gtm:pool:cname:cnamestate');
                assert.strictEqual(response.name, 'cname_pool');
                assert.strictEqual(response.partition, 'ExampleTenant');
                assert.strictEqual(response.subPath, 'Application');
                assert.strictEqual(response.fullPath, '/ExampleTenant/Application/cname_pool');
            });
    });

    it('create GSLB DC, Server, Prober Pool, Prober Pool should be assigned to the DC', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.53.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    testDC: {
                        class: 'GSLB_Data_Center',
                        enabled: true,
                        location: 'NYC',
                        proberPool: {
                            use: 'testPool'
                        },
                        proberPreferred: 'pool'
                    },
                    testPool: {
                        class: 'GSLB_Prober_Pool',
                        members: [
                            {
                                memberOrder: 0,
                                server: {
                                    use: 'testServer'
                                }
                            }
                        ]
                    },
                    testServer: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'testDC'
                        },
                        devices: [
                            {
                                address: '192.0.2.0'
                            },
                            {
                                address: '192.0.2.1'
                            }
                        ],
                        exposeRouteDomainsEnabled: true,
                        serverType: 'bigip',
                        virtualServerDiscoveryMode: 'disabled'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~testDC'))
            .then((response) => {
                assert.strictEqual(response.name, 'testDC');
                assert.strictEqual(response.fullPath, '/Common/testDC');
                assert.strictEqual(response.proberPool, '/Common/testPool');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer'))
            .then((response) => {
                assert.strictEqual(response.name, 'testServer');
                assert.strictEqual(response.fullPath, '/Common/testServer');
                assert.strictEqual(response.datacenter, '/Common/testDC');
            })
            .then(() => getPath('/mgmt/tm/gtm/prober-pool/~Common~testPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'testPool');
                assert.strictEqual(response.fullPath, '/Common/testPool');
            });
    });
});

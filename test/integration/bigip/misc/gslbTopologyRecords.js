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
const util = require('../../../../src/lib/util/util');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getBigIpVersion,
    getPath,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('GSLB_Topology_Records', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('version and provision check and clean up', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'gtm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should preserve topology records created in Common', () => {
        // Topology records and topology-longest-match live in Common but can be created from any tenant. This test
        // verifies that once they are created from the Common tenant they will not be modified when a non-Common tenant
        // is modified. If they are unintentionally destroyed the records will disappear and topology-longest-match will
        // reset to 'yes'. It has been shown as a likely side effect that the declaration will not be idempotent with
        // the second pass through Common re-creating these (if the user has not filtered Common out).
        const declUp = {
            class: 'ADC',
            id: 'maintenance',
            label: 'GCP Cloud LB responder',
            remark: 'GCP Cloud LB Healthcheck responder',
            schemaVersion: '3.47.0',
            updateMode: 'selective',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    TestDC: {
                        class: 'GSLB_Data_Center'
                    },
                    TopologyRecords: {
                        class: 'GSLB_Topology_Records',
                        longestMatchEnabled: false,
                        records: [
                            {
                                destination: {
                                    matchType: 'datacenter',
                                    matchValue: {
                                        use: 'TestDC'
                                    }
                                },
                                source: {
                                    matchType: 'subnet',
                                    matchValue: '192.0.2.0/24'
                                },
                                weight: 1000
                            }
                        ]
                    }
                }
            },
            Healthcheck: {
                class: 'Tenant',
                GLB_Probe: {
                    class: 'Application',
                    'glb-probe-responder': {
                        class: 'Service_HTTP',
                        iRules: [
                            'monitor_respond_200'
                        ],
                        remark: 'Health check listener for external GLB',
                        virtualAddresses: [
                            {
                                use: '/Healthcheck/Shared/GLB_serviceAddress'
                            }
                        ],
                        virtualPort: 40000
                    },
                    monitor_respond_200: {
                        class: 'iRule',
                        iRule: 'when HTTP_REQUEST { HTTP::respond 200 -version 1.1 content Healthy Content-Type text/plain }'
                    }
                },
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    GLB_serviceAddress: {
                        class: 'Service_Address',
                        virtualAddress: '192.0.2.0/24'
                    }
                }
            }
        };

        const declDown = util.simpleCopy(declUp);
        declDown.Healthcheck.GLB_Probe.monitor_respond_200.iRule = 'when HTTP_REQUEST { HTTP::respond 503 -version 1.1 content Maintenance Content-Type text/plain }';

        return Promise.resolve()
            // initial check
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                if (util.versionLessThan(getBigIpVersion(), '14.0')) {
                    assert.isUndefined(response.items);
                } else {
                    assert.strictEqual(response.items.length, 0);
                }
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'yes');
            })
            // first decl, first post
            .then(() => assert.isFulfilled(
                postDeclaration(declUp, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'Common');
                assert.strictEqual(response.results[0].message, 'success');

                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].tenant, 'Healthcheck');
                assert.strictEqual(response.results[1].message, 'success');

                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].tenant, 'Common');
                assert.strictEqual(response.results[2].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            })
            // first decl, second post
            .then(() => assert.isFulfilled(
                postDeclaration(declUp, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'Common');
                assert.strictEqual(response.results[0].message, 'no change');

                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].tenant, 'Healthcheck');
                assert.strictEqual(response.results[1].message, 'no change');

                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].tenant, 'Common');
                assert.strictEqual(response.results[2].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            })
            // second decl, first post
            .then(() => assert.isFulfilled(
                postDeclaration(declDown, { declarationIndex: 2 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'Common');
                assert.strictEqual(response.results[0].message, 'no change');

                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].tenant, 'Healthcheck');
                assert.strictEqual(response.results[1].message, 'success');

                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].tenant, 'Common');
                assert.strictEqual(response.results[2].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            })
            // second decl, second post
            .then(() => assert.isFulfilled(
                postDeclaration(declDown, { declarationIndex: 3 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'Common');
                assert.strictEqual(response.results[0].message, 'no change');

                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].tenant, 'Healthcheck');
                assert.strictEqual(response.results[1].message, 'no change');

                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].tenant, 'Common');
                assert.strictEqual(response.results[2].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            });
    });

    it('should preserve topology records created in non-Common', () => {
        // Topology records and topology-longest-match live in Common but can be created from any tenant. This test
        // verifies that once they are created from the non-Common tenant they will not be modified when a Common tenant
        // is modified. If they are unintentionally destroyed the records will disappear and topology-longest-match will
        // reset to 'yes'. It has been shown as a likely side effect that the declaration will not be idempotent with
        // the second pass through Common re-creating these.
        const declTenant = {
            class: 'AS3',
            action: 'deploy',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.45.0',
                'gslb-test': {
                    class: 'Tenant',
                    'topology-test': {
                        class: 'Application',
                        wip: {
                            class: 'GSLB_Domain',
                            domainName: 'mywideip.com',
                            resourceRecordType: 'A',
                            pools: [
                                {
                                    use: 'gslb-pool-1'
                                },
                                {
                                    use: 'gslb-pool-2'
                                }
                            ],
                            poolLbMode: 'topology'
                        },
                        'gslb-pool-1': {
                            class: 'GSLB_Pool',
                            resourceRecordType: 'A'
                        },
                        'gslb-pool-2': {
                            class: 'GSLB_Pool',
                            resourceRecordType: 'A'
                        },
                        'gslb-topology': {
                            class: 'GSLB_Topology_Records',
                            longestMatchEnabled: false,
                            records: [
                                {
                                    source: {
                                        matchType: 'subnet',
                                        matchOperator: 'equals',
                                        matchValue: '192.0.2.0/24'
                                    },
                                    destination: {
                                        matchType: 'pool',
                                        matchOperator: 'equals',
                                        matchValue: {
                                            use: 'gslb-pool-1'
                                        }
                                    },
                                    weight: 1
                                },
                                {
                                    source: {
                                        matchType: 'subnet',
                                        matchOperator: 'not-equals',
                                        matchValue: '192.0.2.0/24'
                                    },
                                    destination: {
                                        matchType: 'pool',
                                        matchOperator: 'equals',
                                        matchValue: {
                                            use: 'gslb-pool-2'
                                        }
                                    },
                                    weight: 1
                                }
                            ]
                        }
                    }
                }
            }
        };

        const declCommon = {
            class: 'AS3',
            action: 'deploy',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.45.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared'
                    }
                }
            }
        };

        return Promise.resolve()
            // initial check
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                if (util.versionLessThan(getBigIpVersion(), '14.0')) {
                    assert.isUndefined(response.items);
                } else {
                    assert.strictEqual(response.items.length, 0);
                }
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'yes');
            })
            // first decl, first post
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'gslb-test');
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            })
            // first decl, second post
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'gslb-test');
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            })
            // second decl, first post
            .then(() => assert.isFulfilled(
                postDeclaration(declCommon, { declarationIndex: 2 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'Common');
                assert.strictEqual(response.results[0].message, 'success');

                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].tenant, 'Common');
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            })
            // second decl, second post
            .then(() => assert.isFulfilled(
                postDeclaration(declCommon, { declarationIndex: 3 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].tenant, 'Common');
                assert.strictEqual(response.results[0].message, 'no change');

                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].tenant, 'Common');
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/gtm/topology'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
            })
            .then(() => getPath('/mgmt/tm/gtm/global-settings/load-balancing'))
            .then((response) => {
                assert.strictEqual(response.topologyLongestMatch, 'no');
            });
    });

    it('should set monitor as none if serverType is generic-host ', () => {
        const declTenant = {
            class: 'ADC',
            schemaVersion: '3.52.0',
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
                                address: '192.0.0.1'
                            }
                        ],
                        virtualServerDiscoveryMode: 'enabled-no-delete',
                        exposeRouteDomainsEnabled: true,
                        serverType: 'generic-host'
                    }
                }
            }
        };
        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer'))
            .then((response) => {
                assert.strictEqual(response.monitor, undefined);
            });
    });

    it('should set monitor and minimumMonitor', () => {
        const declTenant = {
            class: 'ADC',
            schemaVersion: '3.52.0',
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
                        minimumMonitors: 1,
                        devices: [
                            {
                                address: '192.0.0.1'
                            }
                        ],
                        virtualServerDiscoveryMode: 'enabled-no-delete',
                        exposeRouteDomainsEnabled: true
                    }
                }
            }
        };
        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /Common/bigip }');
            });
    });

    it('should set minimumMonitor only for GSLB_Virtual_Server', () => {
        const declTenant = {
            class: 'ADC',
            schemaVersion: '3.52.0',
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
                                address: '192.0.0.1'
                            }
                        ],
                        virtualServerDiscoveryMode: 'enabled-no-delete',
                        exposeRouteDomainsEnabled: true,
                        virtualServers: [
                            {
                                address: '192.0.0.2',
                                port: 5050,
                                monitors: [
                                    {
                                        bigip: '/Common/bigip'
                                    },
                                    {
                                        bigip: '/Common/http'
                                    }
                                ],
                                minimumMonitors: 2
                            }
                        ]
                    }
                }
            }
        };
        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer'))
            .then((response) => {
                assert.strictEqual(response.monitor, '/Common/bigip');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer/virtual-servers'))
            .then((response) => {
                assert.strictEqual(response.items[0].monitor, 'min 2 of { /Common/bigip /Common/http }');
            });
    });

    it('should set  minimumMonitor only for GSLB_Server', () => {
        const declTenant = {
            class: 'ADC',
            schemaVersion: '3.52.0',
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
                        minimumMonitors: 1,
                        devices: [
                            {
                                address: '192.0.0.1'
                            }
                        ],
                        virtualServerDiscoveryMode: 'enabled-no-delete',
                        exposeRouteDomainsEnabled: true,
                        virtualServers: [
                            {
                                address: '192.0.0.2',
                                port: 5050,
                                monitors: [
                                    {
                                        bigip: '/Common/bigip'
                                    },
                                    {
                                        bigip: '/Common/http'
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };
        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /Common/bigip }');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~testServer/virtual-servers'))
            .then((response) => {
                assert.strictEqual(response.items[0].monitor, '/Common/bigip and /Common/http');
            });
    });

    it('should set member order for gslb pools members', () => {
        const declTenant0 = {
            class: 'ADC',
            schemaVersion: '3.52.0',
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
                                address: '192.0.0.2'
                            }
                        ],
                        virtualServerDiscoveryMode: 'enabled-no-delete',
                        exposeRouteDomainsEnabled: true
                    }
                }
            }
        };
        const declTenant1 = {
            class: 'AS3',
            declaration: {
                class: 'ADC',
                controls: {
                    trace: true,
                    logLevel: 'debug'
                },
                schemaVersion: '3.52.0',
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
                                    address: '192.0.0.2'
                                }
                            ],
                            virtualServerDiscoveryMode: 'enabled-no-delete',
                            exposeRouteDomainsEnabled: true,
                            virtualServers: [
                                {
                                    address: '192.0.0.2',
                                    port: 5050
                                },
                                {
                                    address: '192.0.0.4',
                                    port: 5051
                                }
                            ]
                        },
                        testPool: {
                            members: [
                                {
                                    server: {
                                        bigip: '/Common/testServer'
                                    },
                                    virtualServer: '0',
                                    memberOrder: 1
                                },
                                {
                                    server: {
                                        bigip: '/Common/testServer'
                                    },
                                    virtualServer: '1',
                                    memberOrder: 0
                                }
                            ],
                            class: 'GSLB_Pool',
                            resourceRecordType: 'A'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant0, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declTenant1, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~Common~Shared~testPool/members'))
            .then((response) => {
                assert.strictEqual(response.items[0].memberOrder, 1);
                assert.strictEqual(response.items[1].memberOrder, 0);
            });
    });
});

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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const requestUtil = require('../../../common/requestUtilPromise');
const {
    postDeclaration,
    deleteDeclaration,
    deleteBigipItems,
    logEvent,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('shareNodes', function () {
    this.timeout(GLOBAL_TIMEOUT);

    let tenantDef;
    let commonDef;
    beforeEach(() => {
        tenantDef = {
            class: 'Tenant',
            application: {
                class: 'Application',
                pool: {
                    class: 'Pool',
                    members: [
                        {
                            servicePort: 80,
                            addressDiscovery: 'static',
                            serverAddresses: [
                                '192.0.2.1'
                            ]
                        }
                    ]
                }
            }
        };
        commonDef = {
            class: 'Tenant',
            Shared: {
                class: 'Application',
                template: 'shared',
                pool: {
                    class: 'Pool',
                    members: [
                        {
                            servicePort: 8080,
                            addressDiscovery: 'static',
                            serverAddresses: [
                                '192.0.2.1'
                            ]
                        }
                    ]
                }
            }
        };
    });

    /**
     * Some tests require node /Common/192.0.2.1 to not exist before running.  Checks if node exists and deletes it
     */
    function testPrep() {
        return Promise.resolve()
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node?$filter=partition+eq+Common' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/192.0.2.1');
                if (node) {
                    const msg = 'Node /Common/192.0.2.1 already exists before test.  Will try to delete first.';
                    console.log(msg);
                    logEvent(msg);

                    return deleteBigipItems(
                        [
                            {
                                endpoint: '/mgmt/tm/ltm/node',
                                data: {
                                    name: '192.0.2.1',
                                    partition: 'Common'
                                }
                            }
                        ]
                    );
                }
                return Promise.resolve();
            });
    }

    it('should create multiple tenants with a sharedNode: true', () => {
        tenantDef.application.pool.members[0].shareNodes = true;
        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(
                    {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        tenantOne: tenantDef,
                        tenantTwo: tenantDef
                    },
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => deleteDeclaration());
    });

    it('should fail to create multiple tenants with sharedNode: false', () => {
        tenantDef.application.pool.members[0].shareNodes = false;
        return Promise.resolve()
            .then(() => testPrep())
            .then(() => assert.isFulfilled(
                postDeclaration(
                    {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        tenantOne: tenantDef,
                        tenantTwo: tenantDef
                    },
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 422);
                assert.match(response.results[1].response,
                    /Invalid Node, the IP address 192.0.2.1 already exists./);
            })
            .then(() => deleteDeclaration());
    });

    it('should update existing shareNode when handling Common tenant with shareNode', () => {
        tenantDef.application.pool.members[0].shareNodes = true;
        commonDef.Shared.pool.members[0].shareNodes = true;
        const tenantDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: tenantDef
        };

        const commonDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: commonDef
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => assert.isFulfilled(postDeclaration(commonDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => assert.isFulfilled(postDeclaration(commonDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => deleteDeclaration())
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].message, 'success');
            });
    });

    it('should handle overlapping shareNode with service discovery', () => {
        tenantDef.application.pool.members[0].shareNodes = true;
        const tenantDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: tenantDef
        };

        const sdTenantDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            sdTenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 8080,
                                addressDiscovery: 'event',
                                shareNodes: true
                            }
                        ]
                    }
                }
            }
        };

        const sdEventDecl = [
            {
                id: 'newNode1',
                ip: '192.0.2.1'
            }
        ];

        return Promise.resolve()
            .then(() => testPrep())
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node?$filter=partition+eq+Common' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/192.0.2.1') || {};
                assert.deepStrictEqual(
                    node.metadata,
                    [{
                        name: 'references',
                        persist: 'true',
                        value: '1'
                    }]
                );
            })
            .then(() => assert.isFulfilled(postDeclaration(sdTenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => requestUtil.post({
                path: '/mgmt/shared/service-discovery/task/~sdTenant~application~pool/nodes',
                body: sdEventDecl
            }))
            .then((result) => {
                assert.strictEqual(result.body.code, 200);
                assert.deepStrictEqual(
                    result.body.providerOptions.nodeList,
                    sdEventDecl
                );
            })
            .then(() => promiseUtil.delay(5000))
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node?$filter=partition+eq+Common' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/192.0.2.1') || {};
                assert.deepStrictEqual(
                    node.metadata,
                    [
                        {
                            name: 'appsvcs-discovery',
                            persist: 'true'
                        },
                        {
                            name: 'references',
                            persist: 'true',
                            value: '1'
                        }
                    ]
                );
            })
            .then(() => assert.isFulfilled(postDeclaration(sdTenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration('sdTenant'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => deleteDeclaration('tenant'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node?$filter=partition+eq+Common' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/192.0.2.1');
                assert.strictEqual(node, undefined, 'Node should have been deleted from BIG-IP');
            });
    });

    it('should error if the value of shareNodes is changed to false', () => {
        tenantDef.application.pool.members[0].shareNodes = true;
        tenantDef.newApplication = {
            class: 'Application',
            pool: {
                class: 'Pool',
                members: [
                    {
                        servicePort: 80,
                        addressDiscovery: 'static',
                        serverAddresses: [
                            '192.0.2.1'
                        ],
                        shareNodes: true
                    }
                ]
            }
        };
        const tenantDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: tenantDef
        };

        return Promise.resolve()
            .then(() => testPrep())
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 })))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => {
                tenantDef.newApplication.pool.members[0].shareNodes = false;
                return assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 1 }));
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].errors[0], '/tenant/newApplication/pool/members: The node /tenant/192.0.2.1 conflicts with /Common/192.0.2.1');
            })
            .then(() => deleteDeclaration())
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            });
    });

    it('pre-existing node should remain during tenants manipulations', () => {
        const multipleTenantsDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'TEST_POOL_MEMBERS',
            remark: 'Test pool members',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_POOL_MEMBERS: {
                class: 'Tenant',
                TEST_Pool_Members: {
                    class: 'Application',
                    template: 'generic',
                    pEnable: {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        members: [
                            {
                                connectionLimit: 21448347,
                                servicePort: 443,
                                serverAddresses: [
                                    '198.19.192.60',
                                    '198.19.192.62'
                                ],
                                shareNodes: true
                            },
                            {
                                connectionLimit: 214483647,
                                servicePort: 444,
                                serverAddresses: [
                                    '198.19.192.60'
                                ],
                                shareNodes: true
                            },
                            {
                                connectionLimit: 21448347,
                                servicePort: 443,
                                serverAddresses: [
                                    '198.19.192.72',
                                    '198.19.192.73'
                                ]
                            }
                        ]
                    }
                }
            },
            TEST_POOL_MEMBERS2: {
                class: 'Tenant',
                TEST_Pool_Members: {
                    class: 'Application',
                    template: 'generic',
                    pEnable: {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        members: [
                            {
                                connectionLimit: 21448347,
                                servicePort: 9090,
                                serverAddresses: [
                                    '198.19.192.60',
                                    '198.19.192.62'
                                ],
                                shareNodes: true
                            },
                            {
                                connectionLimit: 21448347,
                                servicePort: 443,
                                serverAddresses: [
                                    '198.19.192.60',
                                    '198.19.192.62'
                                ],
                                shareNodes: true
                            },
                            {
                                connectionLimit: 214483647,
                                servicePort: 444,
                                serverAddresses: [
                                    '198.19.192.60'
                                ],
                                shareNodes: true
                            },
                            {
                                connectionLimit: 21448347,
                                servicePort: 443,
                                serverAddresses: [
                                    '198.19.192.70',
                                    '198.19.192.71'
                                ]
                            }
                        ]
                    }
                }
            }
        };

        const commonNode = {
            name: '198.19.192.60',
            address: '198.19.192.60'
        };

        return Promise.resolve()
            .then(() => requestUtil.post(
                {
                    path: '/mgmt/tm/ltm/node',
                    body: commonNode
                }
            ))
            // Post declaration with 2 tenants.
            .then(() => assert.isFulfilled(
                postDeclaration(multipleTenantsDecl, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node' }))
            // Check that pre-existing node is still there.
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/198.19.192.60');
                assert.notStrictEqual(
                    node, undefined, 'Pre-existing node should remain.'
                );
            })
            // Delete member from second tenant's pool.
            .then(() => delete multipleTenantsDecl.TEST_POOL_MEMBERS2
                .TEST_Pool_Members.pEnable.members[1].serverAddresses.splice(1, 1))
            .then(() => assert.isFulfilled(
                postDeclaration(multipleTenantsDecl, { declarationIndex: 1 })
            ))
            // Check that reference number is reduced to 2.
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/198.19.192.62') || {};
                assert.deepStrictEqual(
                    node.metadata,
                    [
                        {
                            name: 'references',
                            persist: 'true',
                            value: '2'
                        }
                    ],
                    'Number of references should be reduced to 2.'
                );
            })
            // Reduce number of references by deleting pool member from
            // TEST_POOL_MEMBERS tenant's pool.
            .then(() => delete multipleTenantsDecl.TEST_POOL_MEMBERS
                .TEST_Pool_Members.pEnable.members[0].serverAddresses.splice(1, 1))
            .then(() => assert.isFulfilled(
                postDeclaration(multipleTenantsDecl, { declarationIndex: 2 })
            ))
            // Check that reference number is reduced to 1.
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/198.19.192.62') || {};
                assert.deepStrictEqual(
                    node.metadata,
                    [
                        {
                            name: 'references',
                            persist: 'true',
                            value: '1'
                        }
                    ],
                    'Number of references should be reduced to 1.'
                );
            })
            // Delete second tenant and check that node been deleted.
            .then(() => requestUtil.delete({
                path: '/mgmt/shared/appsvcs/declare/TEST_POOL_MEMBERS2'
            }))
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/198.19.192.62');
                assert.strictEqual(
                    node, undefined, 'Shared node should be deleted.'
                );
            })
            // Delete first tenant and check that pre-existed node still exists.
            .then(() => requestUtil.delete({
                path: '/mgmt/shared/appsvcs/declare/TEST_POOL_MEMBERS'
            }))
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node' }))
            .then((result) => {
                const node = (result.body.items || [])
                    .find((n) => n.fullPath === '/Common/198.19.192.60');
                assert.notStrictEqual(
                    node, undefined, 'Pre-existing node should remain.'
                );
            })
            // Delete node.
            .then(() => requestUtil.delete(
                {
                    path: '/mgmt/tm/ltm/node/198.19.192.60',
                    body: commonNode
                }
            ));
    });
});

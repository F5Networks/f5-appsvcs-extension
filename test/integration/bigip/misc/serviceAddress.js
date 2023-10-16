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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    postBigipItems,
    deleteBigipItems,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('serviceAddress', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());

    it('should throw an error if a Service Address address is modified', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    vaddr: {
                        class: 'Service_Address',
                        virtualAddress: '10.0.1.2'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                // modify the virtual address for testing
                decl.tenant.app.vaddr.virtualAddress = '10.0.2.2';
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, 'The Service Address virtualAddress property cannot be modified. Please delete /tenant/vaddr and recreate it.');
            });
    });

    it('should POST twice with mask and route domain', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 1000,
                app: {
                    class: 'Application',
                    address: {
                        class: 'Service_Address',
                        virtualAddress: '10.11.0.0/16'
                    },
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '10.10.0.0/16'
                        ]
                    }
                }
            }
        };
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '1000' }
            }
        ];

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    it('should allow switch back and forth between virtual with redirect to one without when there is a route-domain', () => {
        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 1000,
                app: {
                    class: 'Application',
                    'address-10.10.1.1': {
                        class: 'Service_Address',
                        virtualAddress: '10.10.1.1'
                    },
                    service: {
                        class: 'Service_HTTPS',
                        redirect80: true,
                        servicePort: 443,
                        routeAdvertisement: 'selective',
                        pool: 'pool423',
                        virtualAddresses: [
                            {
                                use: 'address-10.10.1.1'
                            }
                        ],
                        serverTLS: {
                            bigip: '/Common/clientssl'
                        }
                    },
                    pool423: {
                        class: 'Pool',
                        members: [
                            {
                                serverAddresses: ['10.1.1.1'],
                                servicePort: 443
                            }
                        ]
                    }
                }
            }
        };
        const decl2 = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 1000,
                app: {
                    class: 'Application',
                    'address-10.10.1.1': {
                        class: 'Service_Address',
                        virtualAddress: '10.10.1.1'
                    },
                    service: {
                        class: 'Service_HTTPS',
                        redirect80: false,
                        servicePort: 443,
                        routeAdvertisement: 'selective',
                        pool: 'pool123',
                        virtualAddresses: [
                            {
                                use: 'address-10.10.1.1'
                            }
                        ],
                        serverTLS: {
                            bigip: '/Common/clientssl'
                        }
                    },
                    pool123: {
                        class: 'Pool',
                        members: [
                            {
                                serverAddresses: ['10.1.1.1'],
                                servicePort: 123
                            }
                        ]
                    }
                }
            }
        };

        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '1000' }
            }
        ];

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(decl1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(decl2, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    describe('per-app', () => {
        let Shared;
        let serviceApp;

        before('activate perAppDeploymentAllowed', () => postDeclaration(
            {
                betaOptions: {
                    perAppDeploymentAllowed: true
                }
            },
            undefined,
            '?async=false',
            '/mgmt/shared/appsvcs/settings'
        ));

        beforeEach(() => {
            Shared = {
                class: 'Application',
                template: 'shared',
                ServiceAddress: {
                    class: 'Service_Address',
                    virtualAddress: '192.0.2.10'
                }
            };
            serviceApp = {
                class: 'Application',
                template: 'generic',
                Service: {
                    class: 'Service_Generic',
                    virtualAddresses: [],
                    virtualPort: 8080,
                    shareAddresses: false
                }
            };
        });

        it('should share Service_Address in Tenant with other apps in the same tenant', () => {
            const perAppPath = '/mgmt/shared/appsvcs/declare/Tenant/applications';
            serviceApp.Service.virtualAddresses.push({ use: '/Tenant/Shared/ServiceAddress' });
            return Promise.resolve()
                .then(() => postDeclaration({ Shared, serviceApp }, { declarationIndex: 0 }, undefined, perAppPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Tenant~ServiceAddress'))
                // Virtual-address should be removed from /Tenant once associated app is removed
                .then(() => deleteDeclaration(undefined, { path: `${perAppPath}/serviceApp?async=true`, sendDelete: true }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => assert.isRejected(
                    getPath('/mgmt/tm/ltm/virtual-address/~Tenant~ServiceAddress'),
                    /The requested Virtual Address \(\/Tenant\/ServiceAddress\) was not found/,
                    'virtual-address should have been deleted'
                ));
        });

        it('should share Service_Address in Common with other apps in other tenants', () => {
            const perAppCommonPath = '/mgmt/shared/appsvcs/declare/Common/applications';
            const perAppTenantPath = '/mgmt/shared/appsvcs/declare/Tenant/applications';
            serviceApp.Service.virtualAddresses.push({ use: '/Common/Shared/ServiceAddress' });
            return Promise.resolve()
                .then(() => postDeclaration({ Shared }, { declarationIndex: 0 }, undefined, perAppCommonPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~ServiceAddress'))
                .then(() => postDeclaration({ serviceApp }, { declarationIndex: 1 }, undefined, perAppTenantPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                // Virtual-address should be removed from /Common/Shared once associated app is removed
                .then(() => deleteDeclaration(undefined, { path: `${perAppTenantPath}/serviceApp?async=true`, sendDelete: true }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => assert.isRejected(
                    getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~ServiceAddress'),
                    /The requested Virtual Address \(\/Common\/Shared\/ServiceAddress\) was not found/,
                    'virtual-address should have been deleted'
                ));
        });
    });
});

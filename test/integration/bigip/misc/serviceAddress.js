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

    it('should not be thrown an error if the Service Address autoDelete field is enabled on non-common partitions', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    vaddr: {
                        class: 'Service_Address',
                        virtualAddress: '10.0.1.2',
                        autoDelete: true
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            }).finally(() => deleteDeclaration());
    });

    it('should be thrown an error if the Service Address autoDelete field is disabled on non-common partitions', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    vaddr: {
                        class: 'Service_Address',
                        virtualAddress: '10.0.1.2',
                        autoDelete: false
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'Disabling auto-delete for service addresses in non-common tenants is not supported.');
            });
    });

    it('should allow non-defaultRouteDomain suffix in VirtualAddress property for Tenant with non-0 defaultRouteDomain', () => {
        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.51.0',
            tenant: {
                class: 'Tenant',
                defaultRouteDomain: 1,
                App1rd0: {
                    class: 'Application',
                    template: 'generic',
                    a1_80_vs: {
                        class: 'Service_TCP',
                        virtualAddresses: ['192.0.2.25%0'],
                        virtualPort: 80,
                        pool: 'app1_pool'
                    },
                    app1_pool: {
                        class: 'Pool',
                        monitors: [
                            'http'
                        ],
                        members: [
                            {
                                servicePort: 8081,
                                serverAddresses: []
                            }
                        ]
                    }
                },
                App1rd2: {
                    class: 'Application',
                    template: 'generic',
                    a1_80_vs: {
                        class: 'Service_TCP',
                        virtualAddresses: ['192.0.2.25%2'],
                        virtualPort: 80,
                        pool: 'app1_pool'
                    },
                    app1_pool: {
                        class: 'Pool',
                        monitors: [
                            'http'
                        ],
                        members: [
                            {
                                servicePort: 8081,
                                serverAddresses: []
                            }
                        ]
                    }
                }
            }
        };

        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '1', id: 1 }
            },
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '2', id: 2 }
            }
        ];

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(decl1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~App1rd0~a1_80_vs'))
            .then((response) => {
                assert.strictEqual(response.destination, '/tenant/192.0.2.25%0:80');
                assert.strictEqual(response.pool, '/tenant/App1rd0/app1_pool');
                assert.strictEqual(response.source, '0.0.0.0/0');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~App1rd2~a1_80_vs'))
            .then((response) => {
                assert.strictEqual(response.destination, '/tenant/192.0.2.25%2:80');
                assert.strictEqual(response.pool, '/tenant/App1rd2/app1_pool');
                assert.strictEqual(response.source, '0.0.0.0%2/0');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~App1rd0~a1_80_vs'))
            .then((response) => {
                assert.strictEqual(response.destination, '/tenant/192.0.2.25%0:80');
                assert.strictEqual(response.pool, '/tenant/App1rd0/app1_pool');
                assert.strictEqual(response.source, '0.0.0.0/0');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant~App1rd2~a1_80_vs'))
            .then((response) => {
                assert.strictEqual(response.destination, '/tenant/192.0.2.25%2:80');
                assert.strictEqual(response.pool, '/tenant/App1rd2/app1_pool');
                assert.strictEqual(response.source, '0.0.0.0%2/0');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    it('changing VirtualServer name should not change VirtualAddress properties', () => {
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '4' }
            }
        ];

        const decl0 = {
            class: 'ADC',
            Sample: {
                app0: {
                    class: 'Application',
                    'va--192.0.2.25': {
                        class: 'Service_Address',
                        routeAdvertisement: 'selective',
                        virtualAddress: '192.0.2.25'
                    },
                    'Sample--socks--8080': {
                        class: 'Service_TCP',
                        virtualAddresses: [
                            {
                                use: 'va--192.0.2.25'
                            }
                        ],
                        virtualPort: 8080
                    }
                },
                class: 'Tenant',
                defaultRouteDomain: 4
            },
            schemaVersion: '3.51.0',
            updateMode: 'selective'
        };

        const decl1 = {
            class: 'ADC',
            Sample: {
                app0: {
                    class: 'Application',
                    'va--192.0.2.25': {
                        class: 'Service_Address',
                        routeAdvertisement: 'selective',
                        virtualAddress: '192.0.2.25'
                    },
                    'Sample-http--8080': {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            {
                                use: 'va--192.0.2.25'
                            }
                        ],
                        virtualPort: 8080
                    }
                },
                class: 'Tenant',
                defaultRouteDomain: 4
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
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Sample~va--192.0.2.25'))
            .then((response) => {
                assert.strictEqual(response.routeAdvertisement, 'selective');
                assert.strictEqual(response.address, '192.0.2.25%4');
            })
            .then(() => postDeclaration(decl0, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    it('should show more information for \'Common\' tenant', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            controls: {
                class: 'Controls',
                traceResponse: true
            },
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    vsAddres: {
                        class: 'Service_Address',
                        virtualAddress: '192.0.2.0/24',
                        routeAdvertisement: 'disable'
                    }
                }
            }
        };

        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            controls: {
                class: 'Controls',
                traceResponse: true
            },
            Common: {
                class: 'Tenant'
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
                const expectedTraceKeys = ['CommonDesired', 'CommonCurrent', 'CommonDiff', 'CommonScript'];
                assert.hasAnyDeepKeys(response.traces, expectedTraceKeys);
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                const expectedTraceKeys = ['CommonDesired', 'CommonCurrent', 'CommonDiff', 'CommonScript', 'Common_0Script'];
                assert.hasAnyDeepKeys(response.traces, expectedTraceKeys);
            });
    });

    it('should pick correct virtualAddresse when \'bigip\' is used in virtualServer', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    'virtual-address_192.0.2.31': {
                        class: 'Service_Address',
                        virtualAddress: '192.0.2.31/32',
                        routeAdvertisement: 'disable'
                    },
                    'virtual-address_192.0.2.32': {
                        class: 'Service_Address',
                        virtualAddress: '192.0.2.32/32',
                        routeAdvertisement: 'disable'
                    },
                    'virtual-address_192.0.2.33': {
                        class: 'Service_Address',
                        virtualAddress: '192.0.2.33/32',
                        routeAdvertisement: 'disable'
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            testApp: {
                class: 'Tenant',
                appFront: {
                    class: 'Application',
                    template: 'generic',
                    vs1: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            {
                                bigip: '/Common/Shared/virtual-address_192.0.2.32'
                            }
                        ]
                    }
                }
            }
        };

        const declaration2 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            testApp: {
                class: 'Tenant',
                appFront1: {
                    class: 'Application',
                    template: 'generic',
                    vs1: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            {
                                bigip: '/Common/Shared/virtual-address_192.0.2.33'
                            }
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~virtual-address_192.0.2.31'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/Shared/virtual-address_192.0.2.31');
                assert.strictEqual(response.routeAdvertisement, 'disabled');
                assert.strictEqual(response.address, '192.0.2.31');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~virtual-address_192.0.2.32'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/Shared/virtual-address_192.0.2.32');
                assert.strictEqual(response.routeAdvertisement, 'disabled');
                assert.strictEqual(response.address, '192.0.2.32');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~virtual-address_192.0.2.33'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/Shared/virtual-address_192.0.2.33');
                assert.strictEqual(response.routeAdvertisement, 'disabled');
                assert.strictEqual(response.address, '192.0.2.33');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~testApp~appFront~vs1'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/testApp/appFront/vs1');
                assert.strictEqual(response.destination, '/Common/Shared/virtual-address_192.0.2.32:80');
            })
            .then(() => postDeclaration(declaration2, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~testApp~appFront1~vs1'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/testApp/appFront1/vs1');
                assert.strictEqual(response.destination, '/Common/Shared/virtual-address_192.0.2.33:80');
            })
            .finally(() => deleteDeclaration());
    });

    describe('per-app', () => {
        let Shared;
        let serviceApp;

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
                .then(() => postDeclaration({ schemaVersion: '3.50', Shared, serviceApp }, { declarationIndex: 0 }, undefined, perAppPath))
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
                .then(() => postDeclaration({ schemaVersion: '3.50', Shared }, { declarationIndex: 0 }, undefined, perAppCommonPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~ServiceAddress'))
                .then(() => postDeclaration({ schemaVersion: '3.50', serviceApp }, { declarationIndex: 1 }, undefined, perAppTenantPath))
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

        it('should delete the Service_Address in Common partition using autoDelete flag', () => {
            const perAppCommonPath = '/mgmt/shared/appsvcs/declare/Common/applications';
            const perAppTenantPath = '/mgmt/shared/appsvcs/declare/Tenant/applications';
            Shared.ServiceAddress.autoDelete = true;
            serviceApp.Service.virtualAddresses.push({ use: '/Common/Shared/ServiceAddress' });
            return Promise.resolve()
                .then(() => postDeclaration({ schemaVersion: '3.50', Shared }, { declarationIndex: 0 }, undefined, perAppCommonPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~ServiceAddress'))
                .then(() => postDeclaration({ schemaVersion: '3.50', serviceApp }, { declarationIndex: 1 }, undefined, perAppTenantPath))
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

        it('should not delete the Service_Address in Common partition using autoDelete flag', () => {
            const perAppCommonPath = '/mgmt/shared/appsvcs/declare/Common/applications';
            const perAppTenantPath = '/mgmt/shared/appsvcs/declare/Tenant/applications';
            Shared.ServiceAddress.autoDelete = false;
            serviceApp.Service.virtualAddresses.push({ use: '/Common/Shared/ServiceAddress' });
            return Promise.resolve()
                .then(() => postDeclaration({ schemaVersion: '3.50', Shared }, { declarationIndex: 0 }, undefined, perAppCommonPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~ServiceAddress'))
                .then(() => postDeclaration({ schemaVersion: '3.50', serviceApp }, { declarationIndex: 1 }, undefined, perAppTenantPath))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                // Virtual-address should not be removed from /Common/Shared once associated app is removed
                .then(() => deleteDeclaration(undefined, { path: `${perAppTenantPath}/serviceApp?async=true`, sendDelete: true }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~Shared~ServiceAddress'));
        });
    });

    describe('virtualAddress with RouteDomain ID', () => {
        let declare;
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/net/route-domain',
                data: { name: '61', id: 61 }
            },
            {
                endpoint: '/mgmt/tm/ltm/virtual-address',
                data: {
                    name: '192.0.128.10%61',
                    partition: 'Common'
                },
                skipDelete: true
            }

        ];
        beforeEach(() => {
            declare = {
                schemaVersion: '3.53.0',
                updateMode: 'selective',
                class: 'ADC',
                Tenant01: {
                    class: 'Tenant',
                    defaultRouteDomain: 61,
                    A1: {
                        class: 'Application',
                        template: 'generic',
                        vs1: {
                            class: 'Service_UDP',
                            sourceAddress: '0.0.0.0%61/0',
                            virtualAddresses: [
                                { bigip: '/Common/192.0.128.10%61' }
                            ],
                            virtualPort: 80,
                            pool: 'web_pool'
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: [{
                                bigip: '/Common/udp'
                            }],
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.1.10'
                                    ]
                                }]
                        }
                    }
                }
            };
        });

        it('should able to reference BIGIP virtualAddress object with route-domain identifier', () => {
            const Path = '/mgmt/shared/appsvcs/declare/';
            return Promise.resolve()
                .then(() => postBigipItems(bigipItems))
                .then(() => postDeclaration(declare, { declarationIndex: 0 }, undefined, Path))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address/~Common~192.0.128.10%2561'))
                // Virtual-address should be removed from /Tenant once associated app is removed
                .then(() => deleteDeclaration(undefined, { path: `${Path}?async=true`, sendDelete: true }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => assert.isRejected(
                    getPath('/mgmt/tm/ltm/virtual-address/~Common~192.0.128.10%2561'),
                    /The requested Virtual Address \(\/Common\/192.0.128.10%61\) was not found/,
                    'virtual-address should have been deleted'
                ))
                .finally(() => deleteBigipItems(bigipItems.reverse())
                    .catch((err) => {
                        console.log('Error deleting bigip items', err);
                    }));
        });
    });
});

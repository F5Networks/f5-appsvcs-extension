/**
 * Copyright 2026 F5, Inc.
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

const checkAndDelete = require('@f5devcentral/atg-shared-utilities-dev').checkAndDeleteProperty;

const oauth = require('../../../common/oauth');

const {
    getPath,
    postDeclaration,
    deleteDeclaration,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Per-app tests', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function postSettings(settings) {
        return postDeclaration(
            settings,
            undefined,
            '?async=false',
            '/mgmt/shared/appsvcs/settings'
        );
    }

    after(() => deleteDeclaration()
        .then(() => postSettings({})));

    beforeEach(() => deleteDeclaration());

    it('should handle dryRun in Tenant controls', () => {
        const decl = {
            id: 'per-app-declaration',
            schemaVersion: '3.50.0',
            controls: {
                class: 'Controls',
                dryRun: true,
                logLevel: 'debug'
            },
            Application1: {
                class: 'Application',
                service: {
                    class: 'Service_HTTP',
                    virtualAddresses: [
                        '192.0.2.1'
                    ],
                    pool: 'pool'
                },
                pool: {
                    class: 'Pool',
                    members: [
                        {
                            servicePort: 80,
                            serverAddresses: [
                                '192.0.2.10',
                                '192.0.2.20'
                            ]
                        }
                    ]
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'changes', 'object');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            dryRun: true,
                            host: 'localhost',
                            tenant: 'tenant1',
                            warnings: [
                                {
                                    tenant: 'tenant1',
                                    message: 'dryRun true found in Tenant controls'
                                }
                            ]
                        }
                    ]
                );
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should NOT modify applications outside the declaration', () => {
        const perTenDecl = {
            class: 'ADC',
            schemaVersion: '3.44.0',
            id: 'per-app_pools',
            tenant1: {
                class: 'Tenant',
                app1: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '1.1.1.12'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                },
                app2: {
                    class: 'Application',
                    template: 'generic',
                    pool1: {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        minimumMembersActive: 1,
                        reselectTries: 0,
                        serviceDownAction: 'none',
                        slowRampTime: 11
                    }
                }
            }
        };

        const app1Decl = {
            schemaVersion: '3.50',
            app1: {
                class: 'Application',
                template: 'generic',
                service: {
                    class: 'Service_HTTP',
                    virtualAddresses: ['192.0.2.10'],
                    pool: 'pool1'
                },
                pool1: {
                    class: 'Pool',
                    loadBalancingMode: 'round-robin',
                    minimumMembersActive: 1,
                    reselectTries: 0,
                    serviceDownAction: 'none',
                    slowRampTime: 11
                }
            }
        };

        const app2Decl = {
            schemaVersion: '3.50',
            app2: {
                class: 'Application',
                template: 'generic',
                pool1: {
                    class: 'Pool',
                    loadBalancingMode: 'round-robin',
                    minimumMembersActive: 1,
                    reselectTries: 0,
                    serviceDownAction: 'none',
                    slowRampTime: 11
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(perTenDecl, { declarationIndex: 0 }))
            .then((results) => {
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            declarationId: 'per-app_pools',
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((results) => {
                assert.deepStrictEqual(
                    results.tenant1,
                    {
                        class: 'Tenant',
                        app1: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'Service_TCP',
                                remark: 'description',
                                virtualPort: 123,
                                virtualAddresses: [
                                    '1.1.1.12'
                                ],
                                persistenceMethods: [
                                    'source-address'
                                ]
                            }
                        },
                        app2: {
                            class: 'Application',
                            template: 'generic',
                            pool1: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11
                            }
                        }
                    }
                );
            })
            .then(() => postDeclaration(app1Decl, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => postDeclaration(app1Decl, { declarationIndex: 2 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((results) => {
                assert.deepStrictEqual(
                    results.tenant1,
                    {
                        class: 'Tenant',
                        app1: {
                            class: 'Application',
                            template: 'generic',
                            service: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['192.0.2.10'],
                                pool: 'pool1'
                            },
                            pool1: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11
                            }
                        },
                        app2: {
                            class: 'Application',
                            pool1: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11
                            },
                            template: 'generic'
                        }
                    }
                );
            })
            .then(() => postDeclaration(app2Decl, { declarationIndex: 3 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => {
                const options = {
                    path: '/mgmt/shared/appsvcs/declare/tenant1?async=true',
                    logResponse: true
                };
                return deleteDeclaration(undefined, options);
            })
            .then((results) => {
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            });
    });

    it('should delete the tenant if the last app in the tenant is deleted', () => {
        const appDecl = {
            schemaVersion: '3.50',
            app1: {
                class: 'Application',
                template: 'generic',
                service: {
                    class: 'Service_HTTP',
                    virtualAddresses: ['192.0.2.10'],
                    pool: 'pool1'
                },
                pool1: {
                    class: 'Pool',
                    loadBalancingMode: 'round-robin',
                    minimumMembersActive: 1,
                    reselectTries: 0,
                    serviceDownAction: 'none',
                    slowRampTime: 11
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(appDecl, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => {
                const options = {
                    path: '/mgmt/shared/appsvcs/declare/tenant1/applications/app1?async=true',
                    logResponse: true,
                    sendDelete: true
                };
                return deleteDeclaration(undefined, options);
            })
            .then((results) => {
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((results) => {
                assert.strictEqual(results, '');
            });
    });

    it('should ignore apps that are not in the declaration', () => {
        assertModuleProvisioned.call(this, 'asm');

        // Use something with 'ignoreChanges: false' so we can verify this app is not considered
        // when posting just app2
        const app1Decl = {
            schemaVersion: '3.50',
            application1: {
                class: 'Application',
                item: {
                    class: 'WAF_Policy',
                    url: {
                        url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`,
                        ignoreChanges: false
                    }
                }
            }
        };
        const app2Decl = {
            schemaVersion: '3.50',
            application2: {
                class: 'Application',
                template: 'generic',
                pool1: {
                    class: 'Pool',
                    loadBalancingMode: 'round-robin',
                    minimumMembersActive: 1,
                    reselectTries: 0,
                    serviceDownAction: 'none',
                    slowRampTime: 11
                }
            }
        };

        return Promise.resolve()
            .then(() => {
                if (process.env.TEST_IN_AZURE === 'true') {
                    return oauth.getTokenForTest()
                        .then((token) => {
                            app1Decl.application1.item.url.authentication = {
                                method: 'bearer-token',
                                token
                            };
                        });
                }
                return Promise.resolve();
            })
            .then(() => postDeclaration(app1Decl, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => postDeclaration(app2Decl, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'lineCount', 'number');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            })
            .then(() => postDeclaration(app2Decl, { declarationIndex: 2 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((results) => {
                assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                results.results = checkAndDelete(results.results, 'declarationId', 'string');
                results.results = checkAndDelete(results.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    results.results,
                    [
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'tenant1'
                        }
                    ]
                );
            });
    });

    it('should handle SNAT_Translation values are not updated when deployed using per-app', () => {
        const decl = {
            id: 'per-app-declaration',
            schemaVersion: '3.56.0',
            Application1: {
                class: 'Application',
                service: {
                    class: 'Service_L4',
                    virtualPort: 123,
                    persistenceMethods: [],
                    layer4: 'udp',
                    virtualAddresses: [
                        '192.0.2.1'
                    ],
                    snat: {
                        use: 'snatPool'
                    },
                    pool: 'pool'
                },
                pool: {
                    class: 'Pool',
                    loadBalancingMode: 'least-connections-member',
                    serviceDownAction: 'reset',
                    monitors: [
                        {
                            bigip: '/Common/udp'
                        },
                        'icmp'
                    ],
                    minimumMonitors: 'all',
                    members: [
                        {
                            servicePort: 123,
                            serverAddresses: [
                                '192.0.2.10'
                            ]
                        }
                    ]
                },
                snatPool: {
                    class: 'SNAT_Pool',
                    snatAddresses: [
                        '192.0.2.5',
                        '192.0.2.6'
                    ]
                },
                snat1: {
                    class: 'SNAT_Translation',
                    address: '192.0.2.5',
                    ipIdleTimeout: 120,
                    tcpIdleTimeout: 300,
                    udpIdleTimeout: 60
                },
                snat2: {
                    class: 'SNAT_Translation',
                    address: '192.0.2.6',
                    ipIdleTimeout: 120,
                    tcpIdleTimeout: 300,
                    udpIdleTimeout: 60
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/snat-translation/~tenant1~192.0.2.5'))
            .then((response) => {
                assert.strictEqual(response.name, '192.0.2.5');
                assert.strictEqual(response.fullPath, '/tenant1/192.0.2.5');
                assert.strictEqual(response.ipIdleTimeout, '120');
                assert.strictEqual(response.tcpIdleTimeout, '300');
                assert.strictEqual(response.udpIdleTimeout, '60');
            })
            .then(() => getPath('/mgmt/tm/ltm/snat-translation/~tenant1~192.0.2.6'))
            .then((response) => {
                assert.strictEqual(response.name, '192.0.2.6');
                assert.strictEqual(response.fullPath, '/tenant1/192.0.2.6');
                assert.strictEqual(response.ipIdleTimeout, '120');
                assert.strictEqual(response.tcpIdleTimeout, '300');
                assert.strictEqual(response.udpIdleTimeout, '60');
            })
            .then(() => {
                decl.Application1.snat1.ipIdleTimeout = 500;
                decl.Application1.snat1.tcpIdleTimeout = 500;
                decl.Application1.snat1.udpIdleTimeout = 500;
                decl.Application1.snat2.ipIdleTimeout = 500;
                decl.Application1.snat2.tcpIdleTimeout = 500;
                decl.Application1.snat2.udpIdleTimeout = 500;
                return postDeclaration(decl, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications');
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/snat-translation/~tenant1~192.0.2.5'))
            .then((response) => {
                assert.strictEqual(response.name, '192.0.2.5');
                assert.strictEqual(response.fullPath, '/tenant1/192.0.2.5');
                assert.strictEqual(response.ipIdleTimeout, '500');
                assert.strictEqual(response.tcpIdleTimeout, '500');
                assert.strictEqual(response.udpIdleTimeout, '500');
            })
            .then(() => getPath('/mgmt/tm/ltm/snat-translation/~tenant1~192.0.2.6'))
            .then((response) => {
                assert.strictEqual(response.name, '192.0.2.6');
                assert.strictEqual(response.fullPath, '/tenant1/192.0.2.6');
                assert.strictEqual(response.ipIdleTimeout, '500');
                assert.strictEqual(response.tcpIdleTimeout, '500');
                assert.strictEqual(response.udpIdleTimeout, '500');
            })
            .then(() => postDeclaration(decl, { declarationIndex: 2 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => {
                const options = {
                    path: '/mgmt/shared/appsvcs/declare/tenant1?async=true',
                    logResponse: true
                };
                return deleteDeclaration(undefined, options);
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            });
    });

    it('should handle per-app deployment fails when there is existing cipherGroup configured', () => {
        const decl = {
            id: 'per-app-declaration',
            schemaVersion: '3.56.0',
            Application1: {
                class: 'Application',
                template: 'generic',
                appTestVS: {
                    class: 'Service_HTTPS',
                    virtualAddresses: ['192.0.2.11'],
                    virtualPort: 443,
                    redirect80: false,
                    profileHTTP: {
                        bigip: '/Common/http'
                    },
                    profileTCP: {
                        bigip: '/Common/tcp'
                    },
                    serverTLS: 'clientssl',
                    clientTLS: {
                        bigip: '/Common/serverssl'
                    }
                },
                clientssl: {
                    class: 'TLS_Server',
                    certificates: [
                        {
                            certificate: 'cert',
                            sniDefault: true
                        }
                    ],
                    cipherGroup: {
                        bigip: '/Common/f5-secure'
                    }
                },
                cert: {
                    class: 'Certificate',
                    certificate: {
                        bigip: '/Common/default.crt'
                    },
                    privateKey: {
                        bigip: '/Common/default.key'
                    }
                }
            }
        };

        const decl1 = {
            id: 'per-app-declaration',
            schemaVersion: '3.56.0',
            Application2: {
                class: 'Application',
                service: {
                    class: 'Service_HTTP',
                    virtualAddresses: ['192.0.2.22'],
                    pool: 'pool'
                },
                pool: {
                    class: 'Pool',
                    members: [
                        {
                            servicePort: 80,
                            serverAddresses: ['192.0.2.222'],
                            shareNodes: true
                        }
                    ]
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }, '?show=full', '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => {
                const options = {
                    path: '/mgmt/shared/appsvcs/declare/tenant1?async=true',
                    logResponse: true
                };
                return deleteDeclaration(undefined, options);
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            });
    });

    it('should disable the use of per-app', () => {
        const settingsDeclaration = { perAppDeploymentAllowed: false };
        const appDeclaration = {
            schemaVersion: '3.50',
            app: {
                class: 'Application',
                pool: {
                    class: 'Pool'
                }
            }
        };

        return Promise.resolve()
            .then(() => postSettings(settingsDeclaration))
            .then(() => postDeclaration(appDeclaration, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
            .then(() => {
                assert.fail('This should have failed');
            })
            .catch((err) => {
                assert.strictEqual(err.code, 400);
                assert.strictEqual(err.message, 'Unable to POST declaration: Error: Received unexpected 400 status code: {"code":400,"message":"Error: Per-application deployment has been disabled on the settings endpoint"}');
            });
    });
});

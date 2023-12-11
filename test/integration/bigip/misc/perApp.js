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

    before('activate perAppDeploymentAllowed', () => Promise.resolve()
        .then(() => postSettings(
            {
                betaOptions: {
                    perAppDeploymentAllowed: true
                }
            }
        )));

    after(() => deleteDeclaration()
        .then(() => postSettings({})));

    beforeEach(() => deleteDeclaration());

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
});

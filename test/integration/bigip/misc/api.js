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

const checkAndDelete = require('@f5devcentral/atg-shared-utilities-dev').checkAndDeleteProperty;

const {
    getPath,
    getPathFullResponse,
    postDeclaration,
    deleteDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const logInfo = { declarationIndex: 0 };

describe('API Testing (__smoke)', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach(() => deleteDeclaration());

    after(() => deleteDeclaration());

    describe('Age Query Parameter', function () {
        let declarations;

        beforeEach('prep', function () {
            declarations = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TEST_TENANTS',
                    updateMode: 'selective',
                    API_AGE_T1: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.201'
                                ],
                                virtualPort: 2601
                            }
                        }
                    }
                },
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TEST_TENANTS',
                    updateMode: 'complete',
                    API_AGE_T2: {
                        class: 'Tenant',
                        A2: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.202'
                                ],
                                virtualPort: 2602
                            }
                        }
                    }
                },
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TEST_TENANTS',
                    updateMode: 'complete',
                    API_AGE_T3: {
                        class: 'Tenant',
                        A3: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.203'
                                ],
                                virtualPort: 2603
                            }
                        }
                    }
                },
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TEST_TENANTS',
                    updateMode: 'complete',
                    API_AGE_T4: {
                        class: 'Tenant',
                        A4: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.204'
                                ],
                                virtualPort: 2604
                            }
                        }
                    }
                },
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TEST_TENANTS',
                    updateMode: 'complete',
                    API_AGE_T5: {
                        class: 'Tenant',
                        A5: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.205'
                                ],
                                virtualPort: 2605
                            }
                        }
                    }
                }
            ];
        });

        it('should show declarations moving through the age=list and rolling old results out', () => {
            let savedAge; // save this age and watch it move through the age=list
            return Promise.resolve()
                .then(() => assert.isFulfilled( // POST 1st declaration
                    postDeclaration(declarations[0], { declarationIndex: 0 })
                ))
                .then((response) => {
                    let result = response.results.filter((r) => r.tenant === 'API_AGE_T1')[0];
                    result = checkAndDelete([result], 'lineCount', 'number')[0];
                    result = checkAndDelete([result], 'runTime', 'number')[0];
                    assert.deepStrictEqual(
                        result,
                        {
                            code: 200,
                            declarationId: 'TEST_TENANTS',
                            message: 'success',
                            host: 'localhost',
                            tenant: 'API_AGE_T1'
                        }
                    );
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare?age=list')
                ))
                .then((response) => {
                    savedAge = response.filter((result) => result.age === 0)[0];
                })
                .then(() => assert.isFulfilled( // POST 2nd declaration
                    postDeclaration(declarations[1], { declarationIndex: 1 })
                ))
                .then((response) => {
                    let result = response.results.filter((r) => r.tenant === 'API_AGE_T1')[0]; // removed tenant
                    result = checkAndDelete([result], 'lineCount', 'number')[0];
                    result = checkAndDelete([result], 'runTime', 'number')[0];
                    assert.deepStrictEqual(
                        result,
                        {
                            code: 200,
                            declarationId: 'TEST_TENANTS',
                            message: 'success',
                            host: 'localhost',
                            tenant: 'API_AGE_T1'
                        }
                    );
                    result = response.results.filter((r) => r.tenant === 'API_AGE_T2')[0]; // added tenant
                    result = checkAndDelete([result], 'lineCount', 'number')[0];
                    result = checkAndDelete([result], 'runTime', 'number')[0];
                    assert.deepStrictEqual(
                        result,
                        {
                            code: 200,
                            declarationId: 'TEST_TENANTS',
                            message: 'success',
                            host: 'localhost',
                            tenant: 'API_AGE_T2'
                        }
                    );
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare/?age=list') // slash before ? is intentional variation here
                ))
                .then((response) => {
                    savedAge.age = 1;
                    assert.deepStrictEqual(response.filter((result) => result.age === 1)[0], savedAge);
                })
                .then(() => assert.isFulfilled( // POST 3rd declaration
                    postDeclaration(declarations[2], { declarationIndex: 2 })
                ))
                .then((response) => {
                    let result = response.results.filter((r) => r.tenant === 'API_AGE_T2')[0]; // removed tenant
                    result = checkAndDelete([result], 'lineCount', 'number')[0];
                    result = checkAndDelete([result], 'runTime', 'number')[0];
                    assert.deepStrictEqual(
                        result,
                        {
                            code: 200,
                            declarationId: 'TEST_TENANTS',
                            message: 'success',
                            host: 'localhost',
                            tenant: 'API_AGE_T2'
                        }
                    );
                    result = response.results.filter((r) => r.tenant === 'API_AGE_T3')[0]; // added tenant
                    result = checkAndDelete([result], 'lineCount', 'number')[0];
                    result = checkAndDelete([result], 'runTime', 'number')[0];
                    assert.deepStrictEqual(
                        result,
                        {
                            code: 200,
                            declarationId: 'TEST_TENANTS',
                            message: 'success',
                            host: 'localhost',
                            tenant: 'API_AGE_T3'
                        }
                    );
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare?age=list')
                ))
                .then((response) => {
                    savedAge.age = 2;
                    assert.deepStrictEqual(response.filter((result) => result.age === 2)[0], savedAge);
                })
                .then(() => assert.isFulfilled( // POST 4th declaration
                    postDeclaration(declarations[3], { declarationIndex: 3 })
                ))
                .then((response) => {
                    let result = response.results.filter((r) => r.tenant === 'API_AGE_T3')[0]; // removed tenant
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
                    result = response.results.filter((r) => r.tenant === 'API_AGE_T4')[0]; // added tenant
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare?age=list')
                ))
                .then((response) => {
                    savedAge.age = 3;
                    assert.deepStrictEqual(response.filter((result) => result.age === 3)[0], savedAge);
                })
                .then(() => assert.isFulfilled( // GET age 0
                    getPath('/mgmt/shared/appsvcs/declare?age=0')
                ))
                .then((response) => {
                    delete response.controls;
                    assert.deepStrictEqual(response, declarations[3]);
                })
                .then(() => assert.isFulfilled( // GET age 1
                    getPath('/mgmt/shared/appsvcs/declare?age=1')
                ))
                .then((response) => {
                    delete response.controls;
                    assert.deepStrictEqual(response, declarations[2]);
                })
                .then(() => assert.isFulfilled( // GET age 2
                    getPath('/mgmt/shared/appsvcs/declare?age=2')
                ))
                .then((response) => {
                    delete response.controls;
                    assert.deepStrictEqual(response, declarations[1]);
                })
                .then(() => assert.isFulfilled( // GET age 3
                    getPath('/mgmt/shared/appsvcs/declare?age=3')
                ))
                .then((response) => {
                    delete response.controls;
                    assert.deepStrictEqual(response, declarations[0]);
                })
                .then(() => assert.isFulfilled( // GET age 4
                    getPathFullResponse('/mgmt/shared/appsvcs/declare?age=4')
                ))
                .then((response) => {
                    assert.strictEqual(response.statusCode, 204);
                    assert.strictEqual(response.body, '');
                })
                .then(() => assert.isFulfilled( // POST 5th declaration
                    postDeclaration(declarations[4], { declarationIndex: 4 })
                ))
                .then((response) => {
                    let result = response.results.filter((r) => r.tenant === 'API_AGE_T4')[0]; // removed tenant
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
                    result = response.results.filter((r) => r.tenant === 'API_AGE_T5')[0]; // added tenant
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
                })
                .then(() => assert.isFulfilled( // result should of scrolled off list, default historyLimit = 4
                    getPath('/mgmt/shared/appsvcs/declare?age=list')
                ))
                .then((response) => {
                    assert.strictEqual(response.filter((result) => result.name === savedAge.name).length, 0);
                });
        });
    });

    describe('Autogen Ids', function () {
        let declaration;

        beforeEach('prep', function () {
            declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'myId',
                API_AG_Tenant: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '198.19.193.201'
                            ],
                            virtualPort: 2601
                        }
                    }
                }
            };
        });

        it('should automatically generate id when id is \'generate\'', () => {
            declaration.id = 'generate';
            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(declaration, logInfo)
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.isTrue(response.declaration.id.startsWith('autogen_'));
                });
        });

        it('should automatically generate id when id is missing', () => {
            delete declaration.id;
            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(declaration, logInfo)
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.isTrue(response.declaration.id.startsWith('autogen_'));
                });
        });

        it('should automatically generate id when id is \'\'', () => {
            declaration.id = '';
            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(declaration, logInfo)
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.isTrue(response.declaration.id.startsWith('autogen_'));
                });
        });

        it('should not generate id when id is something else', () => Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declaration, logInfo)
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.isTrue(response.declaration.id === 'myId');
            }));

        it('should automatically generate id when id is \'generate\'', () => {
            declaration.id = 'generate';
            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(declaration, logInfo)
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.isTrue(response.declaration.id.startsWith('autogen_'));
                });
        });

        it('should automatically generate id when id is missing', () => {
            delete declaration.id;
            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(declaration, logInfo)
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.isTrue(response.declaration.id.startsWith('autogen_'));
                });
        });

        it('should automatically generate id when id is \'\'', () => {
            declaration.id = '';
            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(declaration, logInfo)
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.isTrue(response.declaration.id.startsWith('autogen_'));
                });
        });

        it('should not generate id when id is something else', () => Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declaration, logInfo)
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.isTrue(response.declaration.id === 'myId');
            }));
    });

    describe('AS3 Retrieve / Remove Action', function () {
        it('should test retrieve and remove declarations', () => {
            const retrieveDecl = {
                class: 'AS3',
                action: 'retrieve',
                targetHost: 'localhost'
            };
            const removeDecl = {
                class: 'AS3',
                action: 'remove',
                targetHost: 'localhost'
            };
            const remoteSimpleDecl = {
                class: 'AS3',
                action: 'deploy',
                targetHost: 'localhost',
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TEST_Simple',
                    TEST_Simple: {
                        class: 'Tenant',
                        TEST_Simple_App: {
                            class: 'Application',
                            template: 'generic',
                            TEST_pool: {
                                class: 'Pool'
                            }
                        }
                    }
                }
            };

            return Promise.resolve()
                .then(() => assert.isFulfilled(
                    postDeclaration(retrieveDecl, logInfo, '') // Check retrieve if nothing on BIG-IP
                ))
                .then((response) => assert.strictEqual(response, ''))
                .then(() => assert.isFulfilled(
                    postDeclaration(removeDecl, logInfo, '') // Check remove if nothing on BIG-IP
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'no change');
                })
                .then(() => assert.isFulfilled(
                    postDeclaration(remoteSimpleDecl, logInfo, '') // Simple declaration
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                })
                .then(() => assert.isFulfilled(
                    postDeclaration(retrieveDecl, logInfo, '') // Check retrieve after configuration
                ))
                .then((response) => {
                    // Removing the timestamp from the response as it changes per declaration
                    response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];

                    assert.deepStrictEqual(response, {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'TEST_Simple',
                        TEST_Simple: {
                            class: 'Tenant',
                            TEST_Simple_App: {
                                class: 'Application',
                                template: 'generic',
                                TEST_pool: { class: 'Pool' }
                            }
                        },
                        updateMode: 'selective',
                        controls: {}
                    });
                })
                .then(() => assert.isFulfilled(
                    postDeclaration(removeDecl, logInfo, '') // Check remove after configuration
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                });
        });
    });

    describe('/info endpoint', () => {
        it('should verify the response for info endpoint', () => Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration({}, logInfo, '', '/mgmt/shared/appsvcs/info')
            ))
            .then((response) => {
                assert.strictEqual(typeof response.version, 'string');
                assert.strictEqual(typeof response.release, 'string');
                assert.strictEqual(typeof response.schemaCurrent, 'string');
                assert.strictEqual(typeof response.schemaMinimum, 'string');
            }));
    });

    describe('/declare endpoint', () => {
        describe('per-tenant', () => {
            it('should test GET empty tenant response', () => Promise.resolve()
                .then(() => assert.isFulfilled(deleteDeclaration()))
                .then((response) => {
                    assert.deepStrictEqual(response.results[0],
                        {
                            message: 'no change',
                            host: 'localhost',
                            code: 200
                        });
                })
                .then(() => getPathFullResponse('/mgmt/shared/appsvcs/declare'))
                .then((response) => {
                    assert.strictEqual(response.body, '');
                    assert.strictEqual(response.statusCode, 204);
                }));
        });
    });
});

describe('per-app API testing (__smoke)', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function postSettings(settings) {
        return postDeclaration(
            settings,
            undefined,
            '?async=false',
            '/mgmt/shared/appsvcs/settings'
        );
    }

    after('restore settings', () => postSettings({}));

    describe('GET', () => {
        let declaration;

        beforeEach('prep', function () {
            declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'myId',
                API_TEST_Tenant1: {
                    class: 'Tenant',
                    testApp1: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '198.19.193.201'
                            ],
                            virtualPort: 2601
                        }
                    },
                    testExampleApp2: {
                        class: 'Application',
                        accel: {
                            class: 'HTTP_Acceleration_Profile'
                        }
                    }
                },
                API_TEST_Tenant2: {
                    class: 'Tenant',
                    testExampleAppOther: {
                        class: 'Application',
                        accel: {
                            class: 'HTTP_Acceleration_Profile'
                        }
                    }
                }
            };
        });

        after(() => deleteDeclaration()); // No sense deleting the declaration till after the GETs are done querying it

        it('should handle per-app GETs with accurate tenant against applications', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_Tenant1/applications'))
            .then((response) => {
                assert.strictEqual(response.statusCode, 200);
                assert.deepStrictEqual(
                    response.body,
                    {
                        schemaVersion: '3.0.0',
                        testApp1: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.201'
                                ],
                                virtualPort: 2601
                            }
                        },
                        testExampleApp2: {
                            class: 'Application',
                            accel: {
                                class: 'HTTP_Acceleration_Profile'
                            }
                        }
                    }
                );
            }));

        it('should handle per-app GETs with accurate tenant and application', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_Tenant1/applications/testApp1'))
            .then((response) => {
                assert.strictEqual(response.statusCode, 200);
                assert.deepStrictEqual(
                    response.body,
                    {
                        schemaVersion: '3.0.0',
                        testApp1: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '198.19.193.201'
                                ],
                                virtualPort: 2601
                            }
                        }
                    }
                );
            }));

        it('should error on per-app GET if the tenant provided in the URL does not exist in the declaration', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => assert.isRejected(
                getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_TEN/applications'),
                /"code":404.*specified tenant 'API_TEST_TEN' not found in declaration/,
                'should have failed against applications due to missing tenant'
            )));

        it('should error on per-app GET if the application provided in the URL does not exist in the declaration', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => assert.isRejected(
                getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_Tenant1/applications/randomApp'),
                /"code":404.*specified Application 'randomApp' not found in 'API_TEST_Tenant1'/,
                'should have failed against applications due to unknown application'
            )));

        it('should error on per-app GET with commas in the tenant', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => assert.isRejected(
                getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_Tenant1,API_TEST_Tenant2/applications'),
                /"code":400.*declare\/API_TEST_Tenant1,API_TEST_Tenant2\/applications is an invalid path. Only 1 tenant and 1 application may be specified in the URL./,
                'should have failed against applications due to comma tenants'
            )));

        it('should error on per-app GET with commas in the application', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => assert.isRejected(
                getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_Tenant1/applications/testApp1,testExampleApp2'),
                /"code":400.*declare\/API_TEST_Tenant1\/applications\/testApp1,testExampleApp2 is an invalid path. Only 1 tenant and 1 application may be specified in the URL./,
                'should have failed against applications due to comma applications'
            )));

        it('should error on per-app GETs if applications is misspelled to application', () => Promise.resolve()
            .then(() => postDeclaration(declaration, logInfo))
            .then(() => assert.isRejected(
                getPathFullResponse('/mgmt/shared/appsvcs/declare/API_TEST_Tenant1/application/testApp1'),
                /"code":400.*Bad Request: Invalid path/,
                'should have failed with an invalid path, as application is an unsupported endpoint'
            )));
    });

    describe('POST', () => {
        afterEach(() => deleteDeclaration());

        it('should handle creating a tenant via POSTing to the applications endpoint', () => {
            const declaration = {
                schemaVersion: '3.50',
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
                }
            };

            return Promise.resolve()
                .then(() => postDeclaration(declaration, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
                .then((results) => { // Confirm results
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
                .then(() => postDeclaration(declaration, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
                .then((results) => { // Confirm results
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
                    getPath('/mgmt/shared/appsvcs/declare/tenant1/applications')
                ))
                .then((results) => {
                    assert.deepStrictEqual(results, {
                        schemaVersion: '3.50',
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
                        }
                    });
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare')
                ))
                .then((results) => {
                    assert.isTrue(results.id.startsWith('autogen_'), `${results.id} should have started with 'autogen_'`);
                    results.controls = checkAndDelete([results.controls], 'archiveTimestamp', 'string')[0];
                    results = checkAndDelete([results], 'id', 'string')[0];

                    assert.deepStrictEqual(results, {
                        class: 'ADC',
                        controls: {},
                        schemaVersion: '3.50',
                        updateMode: 'selective',
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
                            }
                        }
                    });
                });
        });
    });

    describe('DELETE', () => {
        afterEach(() => deleteDeclaration());

        it('should handle DELETE only delete targeted app via the applications endpoint', () => {
            const declaration1 = {
                schemaVersion: '3.50',
                app1: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '192.0.2.11'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                },
                app2: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '192.0.2.12'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                }
            };

            const declaration2 = {
                schemaVersion: '3.50',
                app3: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '192.0.2.13'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                }
            };

            return Promise.resolve()
                .then(() => postDeclaration(declaration1, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
                .then((results) => { // Confirm results
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
                .then(() => postDeclaration(declaration2, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant2/applications'))
                .then((results) => { // Confirm results
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
                                tenant: 'tenant2'
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
                }) // DELETE specific application
                .then((results) => {
                    assert.isTrue((typeof results.results[0].declarationId === 'string' && !Number.isNaN(results.results[0].declarationId)),
                        `${results.results[0].declarationId} is not a number and it should be`);
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
                .then(() => assert.isRejected(
                    getPath('/mgmt/shared/appsvcs/declare/tenant1/applications/app1')
                ))
                .then((results) => {
                    assert.strictEqual(results.code, 404);
                    assert.deepStrictEqual(
                        results.message,
                        'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"specified Application \'app1\' not found in \'tenant1\'"}'
                    );
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare/tenant1/applications')
                ))
                .then((results) => {
                    assert.deepStrictEqual(results, {
                        schemaVersion: '3.0.0',
                        app2: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'Service_TCP',
                                remark: 'description',
                                virtualPort: 123,
                                virtualAddresses: [
                                    '192.0.2.12'
                                ],
                                persistenceMethods: [
                                    'source-address'
                                ]
                            }
                        }
                    });
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare')
                ))
                .then((results) => {
                    results.controls = checkAndDelete([results.controls], 'archiveTimestamp', 'string')[0];
                    results = checkAndDelete([results], 'id', 'string')[0];

                    assert.deepStrictEqual(results, {
                        class: 'ADC',
                        controls: {},
                        schemaVersion: '3.0.0',
                        updateMode: 'selective',
                        tenant1: {
                            class: 'Tenant',
                            app2: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.12'
                                    ],
                                    persistenceMethods: [
                                        'source-address'
                                    ]
                                }
                            }
                        },
                        tenant2: {
                            class: 'Tenant',
                            app3: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.13'
                                    ],
                                    persistenceMethods: [
                                        'source-address'
                                    ]
                                }
                            }
                        }
                    });
                })
                .then(() => {
                    const options = {
                        path: '/mgmt/shared/appsvcs/declare/tenant2/applications/app3?async=true',
                        logResponse: true,
                        sendDelete: true
                    };
                    return deleteDeclaration(undefined, options);
                }) // DELETE specific application
                .then((results) => {
                    assert.isTrue((typeof results.results[0].declarationId === 'string' && !Number.isNaN(results.results[0].declarationId)),
                        `${results.results[0].declarationId} is not a number and it should be`);
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
                                tenant: 'tenant2'
                            }
                        ]
                    );
                })
                .then(() => assert.isRejected(
                    getPath('/mgmt/shared/appsvcs/declare/tenant2')
                ))
                .then((results) => {
                    assert.strictEqual(results.code, 404);
                    assert.deepStrictEqual(
                        results.message,
                        'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"specified Tenant(s) \'tenant2\' not found in declaration"}'
                    );
                })
                .then(() => assert.isFulfilled(
                    getPath('/mgmt/shared/appsvcs/declare')
                ))
                .then((results) => {
                    results.controls = checkAndDelete([results.controls], 'archiveTimestamp', 'string')[0];
                    results = checkAndDelete([results], 'id', 'string')[0];

                    assert.deepStrictEqual(results, {
                        class: 'ADC',
                        controls: {},
                        schemaVersion: '3.0.0',
                        updateMode: 'selective',
                        tenant1: {
                            class: 'Tenant',
                            app2: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.12'
                                    ],
                                    persistenceMethods: [
                                        'source-address'
                                    ]
                                }
                            }
                        }
                    });
                });
        });

        it('should fail to delete anything if an application is NOT specified', () => {
            const declaration1 = {
                schemaVersion: '3.50',
                app1: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '192.0.2.11'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                },
                app2: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '192.0.2.12'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                }
            };

            const declaration2 = {
                schemaVersion: '3.50',
                app3: {
                    class: 'Application',
                    template: 'generic',
                    testItem: {
                        class: 'Service_TCP',
                        remark: 'description',
                        virtualPort: 123,
                        virtualAddresses: [
                            '192.0.2.13'
                        ],
                        persistenceMethods: [
                            'source-address'
                        ]
                    }
                }
            };

            return Promise.resolve()
                .then(() => postDeclaration(declaration1, { declarationIndex: 0 }, undefined, '/mgmt/shared/appsvcs/declare/tenant1/applications'))
                .then((results) => { // Confirm results
                    assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                    assert.strictEqual(typeof results.results[0].lineCount, 'number');
                    assert.strictEqual(typeof results.results[0].runTime, 'number');
                    delete results.results[0].declarationId;
                    delete results.results[0].lineCount;
                    delete results.results[0].runTime;
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
                .then(() => postDeclaration(declaration2, { declarationIndex: 1 }, undefined, '/mgmt/shared/appsvcs/declare/tenant2/applications'))
                .then((results) => { // Confirm results
                    assert.isTrue(results.results[0].declarationId.startsWith('autogen_'), `${results.results[0].declarationId} should have started with 'autogen_'`);
                    assert.strictEqual(typeof results.results[0].lineCount, 'number');
                    assert.strictEqual(typeof results.results[0].runTime, 'number');
                    delete results.results[0].declarationId;
                    delete results.results[0].lineCount;
                    delete results.results[0].runTime;
                    assert.deepStrictEqual(
                        results.results,
                        [
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'tenant2'
                            }
                        ]
                    );
                })
                .then(() => {
                    const options = {
                        path: '/mgmt/shared/appsvcs/declare/tenant1/applications?async=true',
                        logResponse: true,
                        sendDelete: true
                    };
                    return assert.isRejected(
                        deleteDeclaration(undefined, options),
                        /Received unexpected 400 status code: {"code":400,"message":"Bad Request: Invalid path"}/,
                        'per-app DELETE without application is unsupported and should error'
                    );
                })
                .then(() => assert.isFulfilled(
                    // Confirm BIG-IP is still configured
                    getPath('/mgmt/shared/appsvcs/declare')
                ))
                .then((results) => {
                    assert.isTrue(results.id.startsWith('autogen_'), `${results.id} should have started with 'autogen_'`);
                    results.controls = checkAndDelete([results.controls], 'archiveTimestamp', 'string')[0];
                    results = checkAndDelete([results], 'id', 'string')[0];

                    assert.deepStrictEqual(results, {
                        class: 'ADC',
                        controls: {},
                        schemaVersion: '3.50',
                        updateMode: 'selective',
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
                                        '192.0.2.11'
                                    ],
                                    persistenceMethods: [
                                        'source-address'
                                    ]
                                }
                            },
                            app2: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.12'
                                    ],
                                    persistenceMethods: [
                                        'source-address'
                                    ]
                                }
                            }
                        },
                        tenant2: {
                            class: 'Tenant',
                            app3: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.13'
                                    ],
                                    persistenceMethods: [
                                        'source-address'
                                    ]
                                }
                            }
                        }
                    });
                });
        });
    });
});

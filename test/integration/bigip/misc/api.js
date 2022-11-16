/**
 * Copyright 2022 F5 Networks, Inc.
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
                    const result = response.results.filter((r) => r.tenant === 'API_AGE_T1')[0];
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
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
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
                    result = response.results.filter((r) => r.tenant === 'API_AGE_T2')[0]; // added tenant
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
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
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
                    result = response.results.filter((r) => r.tenant === 'API_AGE_T3')[0]; // added tenant
                    assert.strictEqual(result.code, 200);
                    assert.strictEqual(result.message, 'success');
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
                    delete response.controls.archiveTimestamp;

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
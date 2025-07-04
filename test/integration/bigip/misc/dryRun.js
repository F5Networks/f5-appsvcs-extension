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
    getPath,
    postDeclaration,
    deleteDeclaration,
    patch,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('dryRun testing', function () {
    this.timeout(GLOBAL_TIMEOUT);

    let decl;

    beforeEach(() => {
        decl = {
            class: 'AS3',
            persist: false,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.22.0',
                id: 'DNS_Nameserver',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug',
                    traceResponse: true
                },
                TEST_DNS_Nameserver: {
                    class: 'Tenant',
                    Awesome_Application: {
                        class: 'Application',
                        itemfoo: {
                            class: 'DNS_Nameserver'
                        },
                        tsigKey: {
                            class: 'DNS_TSIG_Key',
                            secret: {
                                ciphertext: 'ZjVmNQ==',
                                ignoreChanges: false
                            }
                        },
                        testPool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '1.2.3.4'
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };
        return deleteDeclaration();
    });

    after(() => deleteDeclaration());

    it('should run an action: dry-run declaration and not change the system', () => {
        decl.action = 'dry-run';

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should run a controls dryRun declaration and not change the system', () => {
        decl.declaration.controls.dryRun = true;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should run a Tenant level controls dryRun declaration and not change the system', () => {
        decl.declaration.TEST_DNS_Nameserver.controls = {
            class: 'Controls',
            dryRun: true,
            trace: true,
            logLevel: 'debug',
            traceResponse: true
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
                assert.strictEqual(response.results[0].warnings.length, 1);
                assert.deepStrictEqual(response.results[0].warnings[0], {
                    tenant: 'TEST_DNS_Nameserver',
                    message: 'dryRun true found in Tenant controls'
                });
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should run a single Tenant level controls dryRun declaration with 2 Tenants and not change the system', () => {
        decl.declaration.TEST_DNS_Nameserver.controls = {
            class: 'Controls',
            dryRun: true,
            trace: true,
            logLevel: 'debug',
            traceResponse: true
        };

        decl.declaration.Second_Tenant = {
            class: 'Tenant',
            Application: {
                class: 'Application',
                template: 'http',
                redirect: {
                    class: 'iRule',
                    iRule: {
                        base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICAgSFRUUDo6cmVkaXJlY3QgaHR0cHM6Ly9bZ2V0ZmllbGQgW0hUVFA6Omhvc3RdICI6IiAxXVtIVFRQOjp1cmldDQp9'
                    }
                },
                serviceMain: {
                    class: 'Service_HTTP',
                    iRules: ['redirect'],
                    virtualAddresses: ['10.10.0.1'],
                    virtualPort: 8080
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
                assert.strictEqual(response.results[0].warnings.length, 1);
                assert.deepStrictEqual(response.results[0].warnings[0], {
                    tenant: 'TEST_DNS_Nameserver',
                    message: 'dryRun true found in Tenant controls'
                });
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                assert.strictEqual(response.results[1].dryRun, true);
                assert.isUndefined(response.results[1].warnings);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should run 2 Tenant level controls dryRun declaration with 2 Tenants and not change the system', () => {
        decl.declaration.TEST_DNS_Nameserver.controls = {
            class: 'Controls',
            dryRun: true,
            trace: true,
            logLevel: 'debug',
            traceResponse: true
        };

        decl.declaration.Second_Tenant = {
            class: 'Tenant',
            controls: {
                class: 'Controls',
                dryRun: true
            },
            Application: {
                class: 'Application',
                template: 'http',
                redirect: {
                    class: 'iRule',
                    iRule: {
                        base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICAgSFRUUDo6cmVkaXJlY3QgaHR0cHM6Ly9bZ2V0ZmllbGQgW0hUVFA6Omhvc3RdICI6IiAxXVtIVFRQOjp1cmldDQp9'
                    }
                },
                serviceMain: {
                    class: 'Service_HTTP',
                    iRules: ['redirect'],
                    virtualAddresses: ['10.10.0.1'],
                    virtualPort: 8080
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
                assert.strictEqual(response.results[0].warnings.length, 1);
                assert.deepStrictEqual(response.results[0].warnings[0], {
                    tenant: 'TEST_DNS_Nameserver',
                    message: 'dryRun true found in Tenant controls'
                });
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                assert.strictEqual(response.results[1].dryRun, true);
                assert.strictEqual(response.results[1].warnings.length, 1);
                assert.deepStrictEqual(response.results[1].warnings[0], {
                    tenant: 'Second_Tenant',
                    message: 'dryRun true found in Tenant controls'
                });
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should not change the system when controls.dryRun query parameter is used', () => {
        decl.declaration.controls.dryRun = false;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=true')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should not PATCH when controls.dryRun query parameter is used', () => Promise.resolve()
        .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
        .then((response) => {
            assert.strictEqual(response, ''); // Confirm it starts in a clean state
        })
        .then(() => assert.isFulfilled(postDeclaration(decl)))
        .then((response) => {
            assert.strictEqual(response.results[0].code, 200);
            assert.strictEqual(response.results[0].message, 'success');
        })
        .then(() => {
            const patchBody = [
                {
                    op: 'add',
                    path: '/TEST_DNS_Nameserver/Awesome_Application/testPool/members/0/serverAddresses/-',
                    value: '4.3.2.1'
                }
            ];
            return assert.isFulfilled(patch(
                '/mgmt/shared/appsvcs/declare?controls.dryRun=true',
                patchBody,
                {
                    logInfo: { patchIndex: 0 }
                }
            ));
        })
        .then((response) => {
            assert.strictEqual(response.body.results[0].code, 200);
            assert.strictEqual(response.body.results[0].message, 'success');
            assert.strictEqual(response.body.results[0].dryRun, true);
        })
        .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
        .then((response) => {
            assert.deepStrictEqual(
                response.TEST_DNS_Nameserver.Awesome_Application.testPool.members,
                [
                    {
                        servicePort: 80,
                        serverAddresses: [
                            '1.2.3.4'
                        ]
                    }
                ]
            );
        }));

    it('should not send any tasks to SD when doing a dryRun', () => {
        decl.declaration.controls.dryRun = true;
        decl.declaration.TEST_DNS_Nameserver.Awesome_Application.testPool.members.push({
            servicePort: 80,
            addressDiscovery: 'aws',
            updateInterval: 1,
            tagKey: 'foo',
            tagValue: 'bar',
            addressRealm: 'private',
            accessKeyId: 'your key id',
            secretAccessKey: 'your secret access key',
            region: 'us-west-1'
        });

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[0].dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/service-discovery/task/')))
            .then((response) => {
                assert.strictEqual(response.code, 200);
                assert.deepStrictEqual(response.items, []); // Confirm that there are no SD tasks
            });
    });

    it('should change the system when false controls.dryRun and dryRun query parameter false', () => {
        decl.declaration.controls.dryRun = false;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=false')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, false);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~TEST_DNS_Nameserver~Awesome_Application~testPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'testPool');
                assert.strictEqual(response.fullPath, '/TEST_DNS_Nameserver/Awesome_Application/testPool');
            });
    });

    it('should change the system when false controls.dryRun and dryRun query parameter true', () => {
        decl.declaration.controls.dryRun = false;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=true')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should not change the system when true controls.dryRun and dryRun query parameter false', () => {
        decl.declaration.controls.dryRun = true;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=false')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, false);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~TEST_DNS_Nameserver~Awesome_Application~testPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'testPool');
                assert.strictEqual(response.fullPath, '/TEST_DNS_Nameserver/Awesome_Application/testPool');
            });
    });

    it('should not change the system when true controls.dryRun and dryRun query parameter true', () => {
        decl.declaration.controls.dryRun = true;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=true')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should change the system when false controls.dryRun and without dryRun query parameter', () => {
        decl.declaration.controls.dryRun = false;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, false);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~TEST_DNS_Nameserver~Awesome_Application~testPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'testPool');
                assert.strictEqual(response.fullPath, '/TEST_DNS_Nameserver/Awesome_Application/testPool');
            });
    });

    it('should not change the system when true controls.dryRun and without dryRun query parameter', () => {
        decl.declaration.controls.dryRun = true;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, true);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });

    it('should change the system without controls param and dryRun query parameter false', () => {
        delete decl.declaration.controls;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=false')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, undefined);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~TEST_DNS_Nameserver~Awesome_Application~testPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'testPool');
                assert.strictEqual(response.fullPath, '/TEST_DNS_Nameserver/Awesome_Application/testPool');
            });
    });

    it('should not change the system without controls param and dryRun query parameter true', () => {
        delete decl.declaration.controls;

        return Promise.resolve()
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm it starts in a clean state
            })
            .then(() => assert.isFulfilled(postDeclaration(decl, undefined, '?controls.dryRun=true')))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.declaration.controls.dryRun, undefined);
            })
            .then(() => assert.isFulfilled(getPath('/mgmt/shared/appsvcs/declare')))
            .then((response) => {
                assert.strictEqual(response, ''); // Confirm nothing happened
            });
    });
});

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

const {
    postDeclaration,
    postMultiDeclaration,
    deleteDeclaration,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const { simpleCopy } = require('../../../../src/lib/util/util');

describe('Test Tenants (__smoke)', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function getNewTenant(address, port) {
        return {
            class: 'Tenant',
            Application: {
                class: 'Application',
                template: 'http',
                serviceMain: {
                    class: 'Service_HTTP',
                    virtualAddresses: [
                        address
                    ],
                    virtualPort: port,
                    iRules: ['redirect']
                },
                redirect: {
                    class: 'iRule',
                    iRule: {
                        base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICAgSFRUUDo6cmVkaXJlY3QgaHR0cHM6Ly9bZ2V0ZmllbGQgW0hUVFA6Omhvc3RdICI6IiAxXVtIVFRQOjp1cmldDQp9'
                    }
                }
            }
        };
    }

    describe('test single tenant', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0'
        };

        beforeEach(() => Promise.resolve()
            .then(() => {
                decl.testTenant = getNewTenant('10.10.0.1', 8080);
                return postDeclaration(decl);
            }));

        after(() => deleteDeclaration()); // Clear the machine after all single tenant tests run

        it('should POST a single tenant', () => Promise.resolve()
            .then(() => deleteDeclaration()) // Clear machine for testing successful POST
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.isTrue(response.results[0].declarationId.startsWith('autogen_'), `${response.results[0].declarationId} should have started with 'autogen_'`);
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'lineCount', 'number');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant'
                        }
                    ]
                );
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.isTrue(response.results[0].declarationId.startsWith('autogen_'), `${response.results[0].declarationId} should have started with 'autogen_'`);
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant'
                        }
                    ]
                );
            }));

        it('should GET a single tenant declare show=base', () => Promise.resolve()
            // show=base is the default value so skipping just /declare test
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=base'))
            .then((response) => {
                // show=base does not seem to respond with an array, so the values are converted
                // to an array for use in the convenience function
                response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];
                response = checkAndDelete([response], 'id', 'string')[0];
                assert.deepStrictEqual(
                    response,
                    {
                        class: 'ADC',
                        updateMode: 'selective',
                        controls: {},
                        schemaVersion: '3.0.0',
                        testTenant: {
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
                        }
                    }
                );
            }));

        it('should GET a single tenant declare show=full', () => Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=full'))
            .then((response) => {
                assert.deepStrictEqual(
                    response.testTenant.Application.serviceMain,
                    {
                        class: 'Service_HTTP',
                        iRules: [
                            'redirect'
                        ],
                        virtualAddresses: [
                            '10.10.0.1'
                        ],
                        virtualPort: 8080,
                        persistenceMethods: ['cookie'],
                        profileHTTP: 'basic',
                        virtualType: 'standard',
                        layer4: 'tcp',
                        profileTCP: 'normal',
                        serviceDownImmediateAction: 'none',
                        shareAddresses: false,
                        enable: true,
                        maxConnections: 0,
                        snat: 'auto',
                        addressStatus: true,
                        mirroring: 'none',
                        lastHop: 'default',
                        translateClientPort: false,
                        translateServerAddress: true,
                        translateServerPort: true,
                        nat64Enabled: false,
                        httpMrfRoutingEnabled: false,
                        rateLimit: 0,
                        adminState: 'enable'
                    }
                );
                assert.deepStrictEqual(response.testTenant.Application.redirect.expand, true);
                response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];
                assert.deepStrictEqual(
                    response.controls,
                    {
                        class: 'Controls',
                        dryRun: false,
                        logLevel: 'error',
                        trace: false,
                        traceResponse: false
                    }
                );
            }));

        it('should GET a single tenant declare show=expanded', () => Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=expanded'))
            .then((response) => {
                assert.deepStrictEqual(
                    response.testTenant.Application.serviceMain.iRules[0],
                    '/testTenant/Application/redirect'
                );
                assert.deepStrictEqual(
                    response.testTenant.Application.redirect,
                    {
                        class: 'iRule',
                        expand: true,
                        iRule: 'when HTTP_REQUEST {\r\n   HTTP::redirect https://[getfield [HTTP::host] ":" 1][HTTP::uri]\r\n}'
                    }
                );
                response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];
                assert.deepStrictEqual(
                    response.controls,
                    {
                        class: 'Controls',
                        dryRun: false,
                        logLevel: 'error',
                        trace: false,
                        traceResponse: false
                    }
                );
            }));

        it('should GET a single tenant declare testTenant show=full', () => Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/declare/testTenant?show=full'))
            .then((response) => {
                assert.deepStrictEqual(
                    response.testTenant.Application.serviceMain,
                    {
                        class: 'Service_HTTP',
                        iRules: [
                            'redirect'
                        ],
                        virtualAddresses: [
                            '10.10.0.1'
                        ],
                        virtualPort: 8080,
                        persistenceMethods: ['cookie'],
                        profileHTTP: 'basic',
                        virtualType: 'standard',
                        layer4: 'tcp',
                        profileTCP: 'normal',
                        serviceDownImmediateAction: 'none',
                        shareAddresses: false,
                        enable: true,
                        maxConnections: 0,
                        snat: 'auto',
                        addressStatus: true,
                        mirroring: 'none',
                        lastHop: 'default',
                        translateClientPort: false,
                        translateServerAddress: true,
                        translateServerPort: true,
                        nat64Enabled: false,
                        httpMrfRoutingEnabled: false,
                        rateLimit: 0,
                        adminState: 'enable'
                    }
                );
                assert.deepStrictEqual(response.testTenant.Application.redirect.expand, true);
                response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];
                assert.deepStrictEqual(
                    response.controls,
                    {
                        class: 'Controls',
                        dryRun: false,
                        logLevel: 'error',
                        trace: false,
                        traceResponse: false
                    }
                );
            }));

        it('should GET an empty tenant with show=expanded', () => Promise.resolve()
            .then(() => deleteDeclaration()) // Clear machine for testing successful POST
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=expanded'))
            .then((response) => assert.strictEqual(response, '')));

        it('should error when running a GET against non-existing tenant', () => Promise.resolve()
            .then(() => assert.isRejected(
                getPath('/mgmt/shared/appsvcs/declare/non-existing-tenant'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"specified Tenant(s) \'non-existing-tenant\' not found in declaration"}'
            ))
            .then(() => assert.isRejected(
                getPath('/mgmt/shared/appsvcs/declare/testTenant,non-existing-tenant'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"specified Tenant(s) \'non-existing-tenant\' not found in declaration"}'
            )));

        it('should DELETE testTenant', () => Promise.resolve()
            .then(() => deleteDeclaration('testTenant'))
            .then((response) => {
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                response.results = checkAndDelete(response.results, 'lineCount', 'number');
                assert.deepStrictEqual(
                    response.results[0],
                    {
                        code: 200,
                        message: 'success',
                        host: 'localhost',
                        tenant: 'testTenant'
                    }
                );
            }));

        it('should handle DELETING a non-existing tenant', () => Promise.resolve()
            .then(() => assert.isFulfilled(deleteDeclaration('non-existing-tenant')))
            .then((response) => {
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'non-existing-tenant'
                        }
                    ]
                );
            })
            .then(() => getPath('/mgmt/shared/appsvcs/declare'))
            .then((response) => {
                // Test to confirm the tenant has NOT been deleted
                assert.deepStrictEqual(
                    response.testTenant.Application.serviceMain,
                    {
                        class: 'Service_HTTP',
                        iRules: ['redirect'],
                        virtualAddresses: ['10.10.0.1'],
                        virtualPort: 8080
                    }
                );
            })
            .then(() => assert.isFulfilled(deleteDeclaration('testTenant,non-existing-tenant')))
            .then((response) => {
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'lineCount', 'number', { skipUndefinedProperties: 'MIN1' });
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant'
                        },
                        {
                            code: 200,
                            host: 'localhost',
                            message: 'no change',
                            tenant: 'non-existing-tenant'
                        }
                    ]
                );
            })
            .then(() => getPath('/mgmt/shared/appsvcs/declare'))
            .then((response) => assert.strictEqual(response, '')));
    });

    describe('test multiple tenants', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0'
        };

        beforeEach(() => {
            decl.testTenant0 = getNewTenant('10.10.0.0', 8080);
            decl.testTenant1 = getNewTenant('10.10.0.1', 8081);
            decl.testTenant2 = getNewTenant('10.10.0.2', 8082);
            decl.testTenant3 = getNewTenant('10.10.0.3', 8083);
            decl.testTenant4 = getNewTenant('10.10.0.4', 8084);
            decl.testTenant5 = getNewTenant('10.10.0.5', 8085);

            return postDeclaration(decl);
        });

        after(() => deleteDeclaration()); // Clear the machine after all single tenant tests run

        it('should POST multiple tenants', () => Promise.resolve()
            .then(() => deleteDeclaration()) // Clear machine for testing successful POST
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                response.declaration.controls = checkAndDelete([response.declaration.controls], 'archiveTimestamp', 'string')[0];
                response.declaration = checkAndDelete([response.declaration], 'id', 'string')[0];
                response = checkAndDelete([response], 'id', 'string')[0];
                assert.isTrue(response.results[0].declarationId.startsWith('autogen_'), `${response.results[0].declarationId} should have started with 'autogen_'`);
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                response.results = checkAndDelete(response.results, 'lineCount', 'number');
                assert.deepStrictEqual(
                    response,
                    {
                        results: [
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'testTenant0'
                            },
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'testTenant1'
                            },
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'testTenant2'
                            },
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'testTenant3'
                            },
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'testTenant4'
                            },
                            {
                                code: 200,
                                message: 'success',
                                host: 'localhost',
                                tenant: 'testTenant5'
                            }
                        ],
                        declaration: {
                            class: 'ADC',
                            updateMode: 'selective',
                            controls: {},
                            schemaVersion: '3.0.0',
                            testTenant0: {
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
                                        virtualAddresses: ['10.10.0.0'],
                                        virtualPort: 8080
                                    }
                                }
                            },
                            testTenant1: {
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
                                        virtualPort: 8081
                                    }
                                }
                            },
                            testTenant2: {
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
                                        virtualAddresses: ['10.10.0.2'],
                                        virtualPort: 8082
                                    }
                                }
                            },
                            testTenant3: {
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
                                        virtualAddresses: ['10.10.0.3'],
                                        virtualPort: 8083
                                    }
                                }
                            },
                            testTenant4: {
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
                                        virtualAddresses: ['10.10.0.4'],
                                        virtualPort: 8084
                                    }
                                }
                            },
                            testTenant5: {
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
                                        virtualAddresses: ['10.10.0.5'],
                                        virtualPort: 8085
                                    }
                                }
                            }
                        }
                    }
                );
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                response.declaration.controls = checkAndDelete([response.declaration.controls], 'archiveTimestamp', 'string')[0];
                response.declaration = checkAndDelete([response.declaration], 'id', 'string')[0];
                response = checkAndDelete([response], 'id', 'string')[0];
                assert.isTrue(response.results[0].declarationId.startsWith('autogen_'), `${response.results[0].declarationId} should have started with 'autogen_'`);
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant0'
                        },
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant1'
                        },
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant2'
                        },
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant3'
                        },
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant4'
                        },
                        {
                            code: 200,
                            message: 'no change',
                            host: 'localhost',
                            tenant: 'testTenant5'
                        }
                    ]
                ); // Note: skipping declaration check as it is same as previous POST
            }));

        it('should GET all tenants declare show=base', () => Promise.resolve()
            // show=base is the default value so skipping just /declare test
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=base'))
            .then((response) => {
                response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];
                response = checkAndDelete([response], 'id', 'string')[0];
                assert.deepStrictEqual(
                    response,
                    {
                        class: 'ADC',
                        updateMode: 'selective',
                        controls: {},
                        schemaVersion: '3.0.0',
                        testTenant0: {
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
                                    virtualAddresses: ['10.10.0.0'],
                                    virtualPort: 8080
                                }
                            }
                        },
                        testTenant1: {
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
                                    virtualPort: 8081
                                }
                            }
                        },
                        testTenant2: {
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
                                    virtualAddresses: ['10.10.0.2'],
                                    virtualPort: 8082
                                }
                            }
                        },
                        testTenant3: {
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
                                    virtualAddresses: ['10.10.0.3'],
                                    virtualPort: 8083
                                }
                            }
                        },
                        testTenant4: {
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
                                    virtualAddresses: ['10.10.0.4'],
                                    virtualPort: 8084
                                }
                            }
                        },
                        testTenant5: {
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
                                    virtualAddresses: ['10.10.0.5'],
                                    virtualPort: 8085
                                }
                            }
                        }
                    }
                );
            }));

        it('should GET multiple tenants declare show=full', () => Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=full'))
            .then((response) => {
                // Note: most of GET is the same as show=base
                assert.deepStrictEqual(
                    response.testTenant0.Application.serviceMain,
                    {
                        class: 'Service_HTTP',
                        iRules: [
                            'redirect'
                        ],
                        virtualAddresses: [
                            '10.10.0.0'
                        ],
                        virtualPort: 8080,
                        persistenceMethods: ['cookie'],
                        profileHTTP: 'basic',
                        virtualType: 'standard',
                        layer4: 'tcp',
                        profileTCP: 'normal',
                        serviceDownImmediateAction: 'none',
                        shareAddresses: false,
                        enable: true,
                        maxConnections: 0,
                        snat: 'auto',
                        addressStatus: true,
                        mirroring: 'none',
                        lastHop: 'default',
                        translateClientPort: false,
                        translateServerAddress: true,
                        translateServerPort: true,
                        nat64Enabled: false,
                        httpMrfRoutingEnabled: false,
                        rateLimit: 0,
                        adminState: 'enable'
                    }
                );
                assert.deepStrictEqual(
                    response.testTenant0.Application.redirect,
                    {
                        class: 'iRule',
                        iRule: { base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICAgSFRUUDo6cmVkaXJlY3QgaHR0cHM6Ly9bZ2V0ZmllbGQgW0hUVFA6Omhvc3RdICI6IiAxXVtIVFRQOjp1cmldDQp9' },
                        expand: true
                    }
                );
                assert.strictEqual(response.testTenant0.enable, true);
                assert.strictEqual(response.testTenant0.Application.enable, true);
                assert.strictEqual(response.testTenant0.defaultRouteDomain, 0);
                assert.strictEqual(response.testTenant0.optimisticLockKey, '');
                assert.strictEqual(response.testTenant0.Application.redirect.expand, true);
                response.controls = checkAndDelete([response.controls], 'archiveTimestamp', 'string')[0];
                assert.deepStrictEqual(
                    response.controls,
                    {
                        class: 'Controls',
                        dryRun: false,
                        logLevel: 'error',
                        trace: false,
                        traceResponse: false
                    }
                );

                // Note: Other tenants should be nearly identical
                assert.deepStrictEqual(Object.keys(response),
                    [
                        'testTenant0',
                        'testTenant1',
                        'testTenant2',
                        'testTenant3',
                        'testTenant4',
                        'testTenant5',
                        'class',
                        'schemaVersion',
                        'id',
                        'updateMode',
                        'controls'
                    ]);
            }));

        it('should GET multiple tenants declare show=expanded', () => Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/declare?show=expanded'))
            .then((response) => {
                // Mostly identical to show=full, except for some values
                assert.deepStrictEqual(
                    response.testTenant0.Application.serviceMain.iRules[0],
                    '/testTenant0/Application/redirect'
                );
                assert.deepStrictEqual(
                    response.testTenant0.Application.redirect.iRule,
                    'when HTTP_REQUEST {\r\n   HTTP::redirect https://[getfield [HTTP::host] ":" 1][HTTP::uri]\r\n}'
                );
                // Note: Other tenants should be nearly identical
                assert.deepStrictEqual(Object.keys(response),
                    [
                        'testTenant0',
                        'testTenant1',
                        'testTenant2',
                        'testTenant3',
                        'testTenant4',
                        'testTenant5',
                        'class',
                        'schemaVersion',
                        'id',
                        'updateMode',
                        'controls'
                    ]);
            }));

        it('should GET specific tenants declare testTenant0,testTenant1 show=full', () => Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/declare/testTenant0,testTenant1?show=full'))
            .then((response) => {
                assert.deepStrictEqual(
                    response.testTenant0.Application.serviceMain,
                    {
                        class: 'Service_HTTP',
                        iRules: [
                            'redirect'
                        ],
                        virtualAddresses: [
                            '10.10.0.0'
                        ],
                        virtualPort: 8080,
                        persistenceMethods: ['cookie'],
                        profileHTTP: 'basic',
                        virtualType: 'standard',
                        layer4: 'tcp',
                        profileTCP: 'normal',
                        serviceDownImmediateAction: 'none',
                        shareAddresses: false,
                        enable: true,
                        maxConnections: 0,
                        snat: 'auto',
                        addressStatus: true,
                        mirroring: 'none',
                        lastHop: 'default',
                        translateClientPort: false,
                        translateServerAddress: true,
                        translateServerPort: true,
                        nat64Enabled: false,
                        httpMrfRoutingEnabled: false,
                        rateLimit: 0,
                        adminState: 'enable'
                    }
                );
                assert.deepStrictEqual(response.testTenant0.Application.redirect.expand, true);
                // Note: Other tenants should be nearly identical
                assert.deepStrictEqual(Object.keys(response),
                    [
                        'testTenant0',
                        'testTenant1',
                        'class',
                        'schemaVersion',
                        'id',
                        'updateMode',
                        'controls'
                    ]);
            }));

        it('should DELETE specific tenants testTenant2,testTenant0', () => Promise.resolve()
            .then(() => deleteDeclaration('testTenant2,testTenant0'))
            .then((response) => {
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                response.results = checkAndDelete(response.results, 'lineCount', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant2'
                        },
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant0'
                        }
                    ]
                );
            })
            .then(() => getPath('/mgmt/shared/appsvcs/declare'))
            .then((response) => assert.deepStrictEqual(Object.keys(response),
                [
                    'testTenant1',
                    'testTenant3',
                    'testTenant4',
                    'testTenant5',
                    'class',
                    'schemaVersion',
                    'id',
                    'updateMode',
                    'controls'
                ]))
            .then(() => deleteDeclaration())
            .then((response) => {
                response.results = checkAndDelete(response.results, 'declarationId', 'string');
                response.results = checkAndDelete(response.results, 'runTime', 'number');
                response.results = checkAndDelete(response.results, 'lineCount', 'number');
                assert.deepStrictEqual(
                    response.results,
                    [
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant1'
                        },
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant3'
                        },
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant4'
                        },
                        {
                            code: 200,
                            message: 'success',
                            host: 'localhost',
                            tenant: 'testTenant5'
                        }
                    ]
                );
            })
            .then(() => getPath('/mgmt/shared/appsvcs/declare'))
            .then((response) => {
                assert.strictEqual(response, '');
            }));
    });

    describe('miscellaneous tenant tests', () => {
        afterEach(() => deleteDeclaration());

        it('should delete tenant when posting empty tenant', () => {
            const decl = {
                schemaVersion: '3.0.0',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                class: 'ADC',
                testTenant: {
                    class: 'Tenant',
                    defaultRouteDomain: 0,
                    testApplication: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            pool: 'web_pool',
                            virtualAddresses: [
                                '10.168.68.6'
                            ]
                        },
                        web_pool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: [
                                        '192.168.10.100'
                                    ],
                                    servicePort: 80
                                }
                            ],
                            monitors: [
                                'http'
                            ]
                        }
                    }
                }
            };

            const deleteDecl = {
                schemaVersion: '3.0.0',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                class: 'ADC',
                testTenant: {
                    class: 'Tenant',
                    defaultRouteDomain: 0
                }
            };

            return Promise.resolve()
                // POST initial declaration
                .then(() => postDeclaration(decl, { declarationIndex: 0 }))
                .then((response) => assert.strictEqual(response.results[0].code, 200))
                .then(() => getPath('/mgmt/shared/appsvcs/declare/testTenant'))
                .then((response) => assert.deepStrictEqual(
                    response.testTenant,
                    {
                        class: 'Tenant',
                        defaultRouteDomain: 0,
                        testApplication: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                pool: 'web_pool',
                                virtualAddresses: [
                                    '10.168.68.6'
                                ]
                            },
                            web_pool: {
                                class: 'Pool',
                                members: [
                                    {
                                        serverAddresses: [
                                            '192.168.10.100'
                                        ],
                                        servicePort: 80
                                    }
                                ],
                                monitors: [
                                    'http'
                                ]
                            }
                        }
                    }
                ))
                .then(() => getPath('/mgmt/tm/sys/folder'))
                .then((response) => {
                    assert.isDefined(response.items.find((e) => e.fullPath === '/testTenant'));
                    assert.isDefined(response.items.find((e) => e.fullPath === '/testTenant/testApplication'));
                })
                // POST empty Tenant
                .then(() => postDeclaration(deleteDecl, { declarationIndex: 1 }))
                .then((response) => assert.strictEqual(response.results[0].code, 200))
                .then(() => getPath('/mgmt/shared/appsvcs/declare/testTenant'))
                .then((response) => {
                    assert.strictEqual(response, '');
                })
                .then(() => getPath('/mgmt/tm/sys/folder'))
                .then((response) => {
                    assert.isUndefined(response.items.find((e) => e.fullPath === '/testTenant'));
                    assert.isUndefined(response.items.find((e) => e.fullPath === '/testTenant/testApplication'));
                });
        });

        it('should create and delete multiple tenants across multiple declarations', () => {
            const decl = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'testTenant0'
                },
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'testTenant1'
                }
            ];

            decl[0].testTenant0 = getNewTenant('10.10.0.0', 8080);
            decl[1].testTenant1 = getNewTenant('10.10.0.1', 8081);

            return Promise.resolve()
                .then(() => postMultiDeclaration(decl, ''))
                .then((response) => {
                    assert.strictEqual(response.code, 200);
                    assert.strictEqual(response.items[0].results[0].code, 200);
                    assert.strictEqual(response.items[1].results[0].code, 200);
                })
                .then(() => getPath('/mgmt/shared/appsvcs/declare/testTenant1')) // Deep check one tenant
                .then((response) => assert.deepStrictEqual(
                    response.testTenant1,
                    {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '10.10.0.1'
                                ],
                                virtualPort: 8081,
                                iRules: ['redirect']
                            },
                            redirect: {
                                class: 'iRule',
                                iRule: {
                                    base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICAgSFRUUDo6cmVkaXJlY3QgaHR0cHM6Ly9bZ2V0ZmllbGQgW0hUVFA6Omhvc3RdICI6IiAxXVtIVFRQOjp1cmldDQp9'
                                }
                            }
                        }
                    }
                ))
                .then(() => getPath('/mgmt/shared/appsvcs/declare/'))
                .then((response) => {
                    // Check that all tenants were created
                    assert.strictEqual(response.testTenant0.Application.serviceMain.virtualAddresses[0], '10.10.0.0');
                    assert.strictEqual(response.testTenant1.Application.serviceMain.virtualAddresses[0], '10.10.0.1');
                })
                .then(() => deleteDeclaration('testTenant1')) // Delete testTenant1
                .then((response) => assert.strictEqual(response.results[0].code, 200))
                .then(() => getPath('/mgmt/shared/appsvcs/declare/'))
                .then((response) => {
                    // Confirm tenants are deleted
                    assert.strictEqual(response.testTenant0.Application.serviceMain.virtualAddresses[0], '10.10.0.0');
                    assert.strictEqual(response.testTenant1, undefined);
                });
        });

        it('should handle optimisticLockKey', () => {
            const baseDecl = {
                class: 'ADC',
                schemaVersion: '3.7.0',
                id: 'Service_Generic',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                TEST_Service_Generic: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        template: 'generic',
                        testItem: {
                            class: 'Service_Generic',
                            virtualPort: 100,
                            virtualAddresses: ['192.0.2.1']
                        }
                    }
                }
            };

            let lockKey;
            return Promise.resolve()
                // initial POST
                .then(() => postDeclaration(baseDecl, { declarationIndex: 0 }))
                .then((response) => assert.strictEqual(response.results[0].code, 200))
                .then(() => getPath('/mgmt/shared/appsvcs/declare?showHash=true'))
                .then((response) => {
                    assert.isDefined(response.TEST_Service_Generic.optimisticLockKey);
                    lockKey = response.TEST_Service_Generic.optimisticLockKey;
                })
                // second POST with same optimisticLockKey
                .then(() => {
                    const decl = simpleCopy(baseDecl);
                    decl.TEST_Service_Generic.optimisticLockKey = lockKey;
                    return postDeclaration(decl, { declarationIndex: 1 });
                })
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                // new declaration with same optimisticLockKey
                .then(() => {
                    const decl = simpleCopy(baseDecl);
                    decl.TEST_Service_Generic.optimisticLockKey = lockKey;
                    decl.TEST_Service_Generic.Application.testItem.virtualPort = 80;
                    return postDeclaration(decl, { declarationIndex: 2 });
                })
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                // declaration with old/bad optimisticLockKey
                .then(() => {
                    const decl = simpleCopy(baseDecl);
                    decl.TEST_Service_Generic.optimisticLockKey = 'zDZfC6HfJ+NCkF0lmm8wMiul+zvnJFu4Xa1AwDl/2s0=';
                    decl.TEST_Service_Generic.Application.testItem.virtualAddresses = ['192.0.2.50'];
                    return postDeclaration(decl, { declarationIndex: 3 });
                })
                .then((response) => {
                    assert.strictEqual(typeof response.results[0].host, 'string');
                    delete response.results[0].host; // Removed due to remote testing
                    assert.deepStrictEqual(
                        response.results[0],
                        {
                            code: 422,
                            message: 'The hash you submitted does not match the hash on the current Tenant. This usually indicates there was a change to the Tenant since you pulled this hash. You will want to do a GET and see what the changes are.',
                            tenant: 'TEST_Service_Generic'
                        }
                    );
                })
                // GET declaration to confirm optimisticLockKey results did not indicate a change in
                // AS3 state.
                .then(() => getPath('/mgmt/shared/appsvcs/declare'))
                .then((response) => {
                    assert.deepStrictEqual(
                        response.TEST_Service_Generic.Application.testItem.virtualAddresses,
                        ['192.0.2.1']
                    );
                })
                // GET the BIG-IP endpoint to confirm no change was done on the machine
                .then(() => getPath('/mgmt/tm/ltm/virtual/'))
                .then((response) => {
                    assert.strictEqual(response.items[0].destination, '/TEST_Service_Generic/192.0.2.1:80');
                });
        });

        it('should handle a use-ref to a single letter Tenant and Application', () => {
            // AUTOTOOL-3336
            const decl = {
                schemaVersion: '3.0.0',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                class: 'ADC',
                T: {
                    class: 'Tenant',
                    A: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            persistenceMethods: [
                                { use: 'source-ip' }
                            ],
                            pool: 'web_pool',
                            virtualAddresses: [
                                '192.0.0.68'
                            ]
                        },
                        'source-ip': {
                            class: 'Persist',
                            persistenceMethod: 'source-address'
                        },
                        web_pool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: [
                                        '192.0.0.86'
                                    ],
                                    servicePort: 80
                                }
                            ],
                            monitors: [
                                'http'
                            ]
                        }
                    }
                }
            };

            return Promise.resolve()
                .then(() => postDeclaration(decl, { declarationIndex: 0 }))
                .then((response) => assert.strictEqual(response.results[0].code, 200))
                .then(() => getPath('/mgmt/shared/appsvcs/declare/T'))
                .then((response) => assert.deepStrictEqual(
                    response.T,
                    {
                        class: 'Tenant',
                        A: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                persistenceMethods: [
                                    { use: 'source-ip' }
                                ],
                                pool: 'web_pool',
                                virtualAddresses: [
                                    '192.0.0.68'
                                ]
                            },
                            'source-ip': {
                                class: 'Persist',
                                persistenceMethod: 'source-address'
                            },
                            web_pool: {
                                class: 'Pool',
                                members: [
                                    {
                                        serverAddresses: [
                                            '192.0.0.86'
                                        ],
                                        servicePort: 80
                                    }
                                ],
                                monitors: [
                                    'http'
                                ]
                            }
                        }
                    }
                ))
                .then(() => getPath('/mgmt/tm/sys/folder'))
                .then((response) => {
                    assert.isDefined(response.items.find((e) => e.fullPath === '/T'));
                    assert.isDefined(response.items.find((e) => e.fullPath === '/T/A'));
                });
        });
    });
});

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
const util = require('../../../../src/lib/util/util');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    getBigIpVersion,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('GSLB Monitors', function () {
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

    it('GSLB MySQL Monitor', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        exampleMonitor: {
                            class: 'GSLB_Monitor',
                            monitorType: 'mysql',
                            timeout: 46,
                            interval: 10,
                            count: 10,
                            database: 'test_db.people',
                            username: 'user',
                            passphrase: {
                                ciphertext: 'ZjVmNQ==',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                                ignoreChanges: true
                            },
                            send: 'SELECT id,first_name,last_name',
                            receive: 'Thomas',
                            receiveColumn: 2,
                            receiveRow: 3
                        }
                    }
                }
            }
        };
        const responseMatchDecl = {
            class: 'GSLB_Monitor',
            monitorType: 'mysql',
            timeout: 46,
            interval: 10,
            count: 10,
            database: 'test_db.people',
            username: 'user',
            send: 'SELECT id,first_name,last_name',
            receive: 'Thomas',
            receiveColumn: 2,
            receiveRow: 3
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                delete response.exampleTenant1.exampleApp.exampleMonitor.passphrase;
                assert.deepStrictEqual(response.exampleTenant1.exampleApp.exampleMonitor, responseMatchDecl);
            })
            .then(() => deleteDeclaration());
    });

    it('GSLB SIP Monitor', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        exampleMonitor: {
                            class: 'GSLB_Monitor',
                            monitorType: 'sip',
                            protocol: 'sips',
                            request: 'testRequest',
                            headers: 'test:Header',
                            codesUp: [
                                100,
                                101,
                                102,
                                200
                            ],
                            codesDown: [
                                400,
                                500,
                                600
                            ],
                            ciphers: 'DEFAULT:+SHA:+3DES',
                            clientCertificate: 'cert'
                        },
                        cert: {
                            class: 'Certificate',
                            certificate: {
                                bigip: '/Common/default.crt'
                            }
                        }
                    }
                }
            }
        };
        const responseMatchDecl = {
            class: 'GSLB_Monitor',
            monitorType: 'sip',
            protocol: 'sips',
            request: 'testRequest',
            headers: 'test:Header',
            codesUp: [100, 101, 102, 200],
            codesDown: [400, 500, 600],
            ciphers: 'DEFAULT:+SHA:+3DES',
            clientCertificate: 'cert'
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.deepStrictEqual(response.exampleTenant1.exampleApp.exampleMonitor, responseMatchDecl);
            })
            .then(() => deleteDeclaration());
    });

    it('GSLB LDAP Monitor', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        exampleMonitor: {
                            class: 'GSLB_Monitor',
                            monitorType: 'ldap',
                            interval: 10,
                            timeout: 46,
                            base: 'dc=bigip-test,dc=org',
                            chaseReferrals: false,
                            filter: 'objectClass=employee',
                            security: 'tls',
                            mandatoryAttributes: true,
                            username: 'user',
                            passphrase: {
                                ciphertext: 'ZjVmNQ==',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                                ignoreChanges: true
                            }
                        }
                    }
                }
            }
        };
        const responseMatchDecl = {
            class: 'GSLB_Monitor',
            monitorType: 'ldap',
            interval: 10,
            timeout: 46,
            base: 'dc=bigip-test,dc=org',
            chaseReferrals: false,
            filter: 'objectClass=employee',
            security: 'tls',
            mandatoryAttributes: true,
            username: 'user'
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                delete response.exampleTenant1.exampleApp.exampleMonitor.passphrase;
                assert.deepStrictEqual(response.exampleTenant1.exampleApp.exampleMonitor, responseMatchDecl);
            })
            .then(() => deleteDeclaration());
    });

    it('GSLB SMTP Monitor', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        exampleMonitor: {
                            class: 'GSLB_Monitor',
                            monitorType: 'smtp',
                            domain: 'smtp2.org',
                            upInterval: 15,
                            timeUntilUp: 20,
                            timeout: 46
                        }
                    }
                }
            }
        };
        const responseMatchDecl = {
            class: 'GSLB_Monitor',
            monitorType: 'smtp',
            domain: 'smtp2.org',
            upInterval: 15,
            timeUntilUp: 20,
            timeout: 46
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.deepStrictEqual(response.exampleTenant1.exampleApp.exampleMonitor, responseMatchDecl);
            })
            .then(() => deleteDeclaration());
    });

    it('GSLB BIGIP Monitor', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.54.0',
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        exampleMonitor: {
                            class: 'GSLB_Monitor',
                            monitorType: 'bigip',
                            interval: 60,
                            timeout: 90,
                            ignoreDownResponseEnabled: true,
                            aggregateDynamicRatios: 'sum-nodes'
                        }
                    }
                }
            }
        };
        const responseMatchDecl = {
            class: 'GSLB_Monitor',
            monitorType: 'bigip',
            interval: 60,
            timeout: 90,
            ignoreDownResponseEnabled: true,
            aggregateDynamicRatios: 'sum-nodes'
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.deepStrictEqual(response.exampleTenant1.exampleApp.exampleMonitor, responseMatchDecl);
            })
            .then(() => getPath('/mgmt/tm/gtm/monitor/bigip/~exampleTenant1~exampleApp~exampleMonitor'))
            .then((response) => {
                assert.strictEqual(response.interval, 60);
                assert.strictEqual(response.timeout, 90);
                assert.strictEqual(response.ignoreDownResponse, 'enabled');
                assert.strictEqual(response.aggregateDynamicRatios, 'sum-nodes');
            })
            .then(() => deleteDeclaration());
    });
});

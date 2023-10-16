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
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const {
    simpleCopy
} = require('../../../../src/lib/util/util');

describe('shareAddresses', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());

    const baseDecl = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };
    const tenantDecl = {
        class: 'Tenant',
        Application: {
            class: 'Application',
            template: 'generic',
            Service: {
                class: 'Service_Generic',
                virtualAddresses: [
                    '10.10.0.111',
                    '10.10.0.1'
                ],
                virtualPort: 8080,
                shareAddresses: true
            }
        }
    };

    it('should be able to post two tenants in two declarations using the same nodes', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        const declaration2 = simpleCopy(baseDecl);
        declaration2.tenant2 = simpleCopy(tenantDecl);
        declaration2.tenant2.Application.Service.virtualPort = 80; // Ports must vary

        return Promise.resolve()
            .then(() => postDeclaration(declaration1), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => postDeclaration(declaration2), { declarationIndex: 1 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            });
    });

    it('should be able to post two tenants in one declaration', () => {
        // Currently this will fail on the second tenant, AUTOTOOL-1592 should fix this
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        declaration1.tenant2 = simpleCopy(tenantDecl);
        declaration1.tenant2.Application.Service.virtualPort = 80; // Ports must vary

        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => {
                // The first tenant should have no modifications, and therefore no change.
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                // Now that the shared address is available, it should successfully make tenant2
                assert.strictEqual(response.results[1].code, 200);
            });
    });

    it('should create two tenants, delete one, and the BIG-IP retain the shared addresses', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        const declaration2 = simpleCopy(baseDecl);
        declaration2.tenant2 = simpleCopy(tenantDecl);
        declaration2.tenant2.Application.Service.virtualPort = 80; // Ports must vary

        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => postDeclaration(declaration2, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => deleteDeclaration('tenant1'))
            .then(() => getPath('/mgmt/tm/ltm/virtual-address'))
            .then((response) => {
                // parse through the virtual-addresses to identify if the right ones remain
                let found111 = false;
                let found1 = false;

                response.items.forEach((item) => {
                    if (!found111 && item.name === '10.10.0.111') {
                        found111 = true;
                    } else if (!found1 && item.name === '10.10.0.1') {
                        found1 = true;
                    }
                });

                assert.strictEqual(
                    found111,
                    true,
                    'Service_Address for 10.10.0.111 was deleted and should not have been'
                );
                assert.strictEqual(
                    found1,
                    true,
                    'Service_Address for 10.10.0.1 was deleted and should not have been'
                );
            });
    });

    it('should be able to create a single tenant with two apps that share the same address', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        declaration1.tenant1.Application2 = {
            class: 'Application',
            template: 'generic',
            Service: {
                class: 'Service_Generic',
                virtualAddresses: [
                    '10.10.0.111',
                    '10.10.0.11'
                ],
                virtualPort: 8081,
                shareAddresses: true
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            });
    });

    it('should move the declaration from a private tenant to Common', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        declaration1.tenant1.Application.Service.shareAddresses = false;

        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then(() => getPath('/mgmt/tm/ltm/virtual-address'))
            .then((response) => {
                // parse through the virtual-addresses to identify if the right ones remain
                let found111 = false;
                let found1 = false;

                response.items.forEach((item) => {
                    if (!found111 && item.name === '10.10.0.111') {
                        found111 = true;
                        assert.strictEqual(
                            item.partition,
                            'tenant1',
                            `Service_Address for 10.10.0.111 was found in ${item.partition} instead of tenant1`
                        );
                    } else if (!found1 && item.name === '10.10.0.1') {
                        found1 = true;
                        assert.strictEqual(
                            item.partition,
                            'tenant1',
                            `Service_Address for 10.10.0.1 was found in ${item.partition} instead of tenant1`
                        );
                    }
                });

                assert.strictEqual(found111, true, 'Service_Address for 10.10.0.111 was not found');
                assert.strictEqual(found1, true, 'Service_Address for 10.10.0.1 was not found');

                declaration1.tenant1.Application.Service.shareAddresses = true;
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then(() => getPath('/mgmt/tm/ltm/virtual-address'))
            .then((response) => {
                // parse through the virtual-addresses to identify if the right ones remain
                let found111 = false;
                let found1 = false;

                response.items.forEach((item) => {
                    if (!found111 && item.name === '10.10.0.111' && item.partition === 'Common') {
                        found111 = true;
                        assert.strictEqual(
                            item.partition,
                            'Common',
                            `Service_Address for 10.10.0.111 was found in ${item.partition} instead of Common`
                        );
                    } else if (!found1 && item.name === '10.10.0.1' && item.partition === 'Common') {
                        found1 = true;
                        assert.strictEqual(
                            item.partition,
                            'Common',
                            `Service_Address for 10.10.0.1 was found in ${item.partition} instead of Common`
                        );
                    }
                });

                assert.strictEqual(found111, true, 'Service_Address for 10.10.0.111 was not found');
                assert.strictEqual(found1, true, 'Service_Address for 10.10.0.1 was not found');
            });
    });

    it('should fail if the virtual addresses are used as shared but shareAddresses is false', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        // Application2 will try to build virtualAddresses in tenant1 instead of /Common, conflict
        declaration1.tenant1.Application2 = {
            class: 'Application',
            template: 'generic',
            Service: {
                class: 'Service_Generic',
                virtualAddresses: [
                    '10.10.0.111',
                    '10.10.0.11'
                ],
                virtualPort: 8081,
                shareAddresses: false
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.match(response.results[0].response,
                    /Invalid Virtual Address, the IP address 10.10.0.111 already exists./);
            });
    });

    it('should allow for redirect server with shared addresses', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        declaration1.tenant1.Application.Service.class = 'Service_HTTPS';
        declaration1.tenant1.Application.Service.virtualPort = 443;
        declaration1.tenant1.Application.Service.redirect80 = true;
        declaration1.tenant1.Application.Service.shareAddresses = true;
        declaration1.tenant1.Application.Service.serverTLS = 'theTlsServer';

        declaration1.tenant1.Application.theTlsServer = {
            class: 'TLS_Server',
            certificates: [
                { certificate: 'theCert' }
            ],
            requireSNI: false,
            ciphers: 'DEFAULT',
            authenticationMode: 'ignore',
            authenticationFrequency: 'one-time',
            authenticationTrustCA: {
                bigip: '/Common/ca-bundle.crt'
            },
            authenticationInviteCA: {
                bigip: '/Common/ca-bundle.crt'
            }
        };

        declaration1.tenant1.Application.theCert = {
            class: 'Certificate',
            certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
            passphrase: {
                ciphertext: 'ZjVmNQ==',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                ignoreChanges: true,
                miniJWE: true,
                allowReuse: false
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant1~Application~Service'))
            .then((response) => {
                assert.strictEqual(response.destination, '/Common/10.10.0.111:443');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~tenant1~Application~Service-Redirect-'))
            .then((response) => {
                assert.strictEqual(response.destination, '/Common/10.10.0.111:80');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            });
    });

    it('should delete virtual addresses that are no longer in use', () => {
        const declaration1 = simpleCopy(baseDecl);
        declaration1.tenant1 = simpleCopy(tenantDecl);
        return Promise.resolve()
            .then(() => postDeclaration(declaration1, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
                assert.strictEqual(
                    response.items.some((item) => item.fullPath === '/Common/10.10.0.111'),
                    true,
                    'Service_Address for 10.10.0.111 was not found'
                );
                assert.strictEqual(
                    response.items.some((item) => item.fullPath === '/Common/10.10.0.1'),
                    true,
                    'Service_Address for 10.10.0.1 was not found'
                );
            })
            .then(() => {
                declaration1.tenant1.Application.Service.virtualAddresses = [
                    '10.10.0.222',
                    '10.10.0.1'
                ];
                return postDeclaration(declaration1, { declarationIndex: 1 });
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
                assert.strictEqual(
                    response.items.some((item) => item.fullPath === '/Common/10.10.0.222'),
                    true,
                    'Service_Address for 10.10.0.222 was not found'
                );
                assert.strictEqual(
                    response.items.some((item) => item.fullPath === '/Common/10.10.0.1'),
                    true,
                    'Service_Address for 10.10.0.1 was not found'
                );
            })
            .then(() => deleteDeclaration())
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address'))
            .then((response) => {
                assert.strictEqual(response.items ? response.items.length : 0, 0);
            });
    });

    describe('per-app', () => {
        let appDecl;

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
            appDecl = {
                class: 'Application',
                template: 'generic',
                Service: {
                    class: 'Service_Generic',
                    virtualAddresses: [
                        '192.0.2.10',
                        '192.0.2.11'
                    ],
                    virtualPort: 8080,
                    shareAddresses: false
                }
            };
        });

        it('should be able to create two apps that share the same address', () => {
            const perAppPath = '/mgmt/shared/appsvcs/declare/Tenant/applications';
            const appOne = simpleCopy(appDecl);
            const appTwo = simpleCopy(appDecl);
            appTwo.Service.virtualPort = 8081;
            const appThree = {
                class: 'Application',
                template: 'generic',
                httpMonitor: {
                    class: 'Monitor',
                    monitorType: 'http'
                }
            };

            return Promise.resolve()
                .then(() => postDeclaration(
                    { appOne, appTwo, appThree },
                    { declarationIndex: 0 },
                    undefined,
                    perAppPath
                ))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address?$filter=partition%20eq%20Tenant'))
                .then((response) => {
                    assert.strictEqual(response.items.length, 2, 'two virtual-addresses should exist in Tenant');
                    response.items.forEach((item) => {
                        assert.strictEqual(item.fullPath, `/Tenant/${item.name}`, 'virtual-address should exist at Tenant level');
                    });
                })
                // Virtual-addresses should be removed from /Tenant once associated apps are removed
                .then(() => deleteDeclaration(undefined, { path: `${perAppPath}/appOne?async=true`, sendDelete: true }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => deleteDeclaration(undefined, { path: `${perAppPath}/appTwo?async=true`, sendDelete: true }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                })
                .then(() => getPath('/mgmt/tm/ltm/virtual-address?$filter=partition%20eq%20Tenant'))
                .then((response) => {
                    assert.strictEqual((response.items || []).length, 0, 'virtual-addresses should be removed from Tenant');
                });
        });
    });
});

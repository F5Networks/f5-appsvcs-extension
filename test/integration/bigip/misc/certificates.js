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
    postDeclaration,
    deleteDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('certificates', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should allow references to certificates in Common Shared that use bigip pointers', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
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
            },
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    tlsServer: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: '/Common/Shared/cert'
                            }
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration), { declarationIndex: 1 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });

    it('should handle declaration with reference to chainCA in Common Shared', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    ca_bundle: {
                        bundle: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                        class: 'CA_Bundle'
                    }
                }
            },
            t1: {
                class: 'Tenant',
                t1a1: {
                    class: 'Application',
                    useCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
                        chainCA: {
                            use: '/Common/Shared/ca_bundle'
                        },
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                        }
                    },
                    stringCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
                        chainCA: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                        }
                    },
                    tlsClientWithUse: {
                        class: 'TLS_Client',
                        clientCertificate: 'useCert'
                    },
                    tlsServerWithString: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'stringCert'
                            }
                        ]
                    },
                    poolPool: {
                        class: 'Pool',
                        members: [
                            {
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 8181
                            }
                        ]
                    },
                    httpsVirtual: {
                        class: 'Service_HTTPS',
                        redirect80: false,
                        clientTLS: 'tlsClientWithUse',
                        serverTLS: 'tlsServerWithString',
                        snat: 'self',
                        pool: 'poolPool',
                        virtualAddresses: [
                            '192.0.2.2'
                        ],
                        virtualPort: 443
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => deleteDeclaration());
    });
});

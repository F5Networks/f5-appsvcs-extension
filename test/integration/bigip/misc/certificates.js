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

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
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

    it('should encrypt the private key if passphrase/bigip/url not set under class certificate', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                id: 't1a1-0001',
                schemaVersion: '3.30.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        ca_example_bundle: {
                            bundle: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                            class: 'CA_Bundle'
                        }
                    }
                },
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'as3_tls_client',
                            serverTLS: 'as3_tls_server',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: [
                                '1.1.1.2'
                            ],
                            virtualPort: 443
                        },
                        useCert: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----\nMIIDeTCCAmGgAwIBAgIJAM6s50VhmehaMA0GCSqGSIb3DQEBCwUAMFMxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UEBwwGQm9zdG9uMQswCQYDVQQKDAJG\nNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FTMzAeFw0yNDAzMTkxNjM0MTNaFw0y\nNTAzMTkxNjM0MTNaMFMxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UE\nBwwGQm9zdG9uMQswCQYDVQQKDAJGNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FT\nMzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKKNG4uPUEM8WtosRCw/\nJj7o39exnqa6hlPoCexbyh2p1AtJXZEQotrRojXbEkzwKbVpXSfAuXpN8AXoyDA4\nn37bHafC3gc+kaa+bjdS8K0zNDRe0mfIN4s9oBq41czjHGLdXW2PgaIXqOBgB1Yb\n8IkjgcwdhRb2wNN7pzJBzwcqDYOCJHXh0mDc6PDNV8nwwZjuPrksWKZ2UbuyEjCU\ns3J0R04mApHpMGdSlDQVCSCXcOFXYohGe7OI8i9QWKko+clYkHslTrjreq7d2D1I\nAmW4TlJvA9A4BO2F0w+jpizhBuv2G0J0fiZI6XwRQk9lZ9qOZhxVRY/o6untr301\njm0CAwEAAaNQME4wHQYDVR0OBBYEFFF36jdkUOriWBFdkjWygjtQk7ZZMB8GA1Ud\nIwQYMBaAFFF36jdkUOriWBFdkjWygjtQk7ZZMAwGA1UdEwQFMAMBAf8wDQYJKoZI\nhvcNAQELBQADggEBAELqKjYIrDmiWbSSIQN4Yjk6rmVvXzqc+QZQ3qdhE9PDC9Ov\nTe5e1Y+2YBjI1HbF6lc+nLRQfyTkBpY5eo8KtcPiUkJUxGpVYtg+zttNn1OXUu3a\nAU4w2u5NNklsSrZwGwwtQFXXZIcd3Ov5jaq/penvcjjModJtuA4qX2K26tkDJdE7\nfDkMWkbr6e1yxeofcmy2kYM9r7ayAEP8mVlBeeBoWKtgIzW9AXe7vLZmkBTylGTU\nEWAQSfVkVUirWDDwlZU7ru0y2SyxILRVxzrFsknsGkxHmJWjNH9Bh2RjFqulXFhz\nVuTVC6t7OW9oOTeX3FivB7mOlqTYdIF4tvkS6pM=\n-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaxy\n-----END RSA PRIVATE KEY-----', // gitleaks:allow
                            chainCA: {
                                use: '/Common/Shared/ca_example_bundle'
                            }
                        },
                        as3_tls_client: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        as3_tls_server: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    certificate: 'useCert'
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
                                    servicePort: 443
                                }
                            ]
                        }
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
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                const requestPrivateKey = declaration.declaration.exampleTenant1.exampleApp.useCert.privateKey;
                const responsePrivateKey = response.exampleTenant1.exampleApp.useCert.privateKey;
                assert.notEqual(responsePrivateKey, requestPrivateKey);
            })
            .then(() => deleteDeclaration());
    });

    it('contains multiple tenant one with encrypted private key with passphrase another has plain private key', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                id: 't1a1-0001',
                schemaVersion: '3.30.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        ca_example_bundle: {
                            bundle: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                            class: 'CA_Bundle'
                        }
                    }
                },
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'as3_tls_client',
                            serverTLS: 'as3_tls_server',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: [
                                '1.1.1.2'
                            ],
                            virtualPort: 443
                        },
                        useCert: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----\nMIIDeTCCAmGgAwIBAgIJAM6s50VhmehaMA0GCSqGSIb3DQEBCwUAMFMxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UEBwwGQm9zdG9uMQswCQYDVQQKDAJG\nNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FTMzAeFw0yNDAzMTkxNjM0MTNaFw0y\nNTAzMTkxNjM0MTNaMFMxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UE\nBwwGQm9zdG9uMQswCQYDVQQKDAJGNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FT\nMzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKKNG4uPUEM8WtosRCw/\nJj7o39exnqa6hlPoCexbyh2p1AtJXZEQotrRojXbEkzwKbVpXSfAuXpN8AXoyDA4\nn37bHafC3gc+kaa+bjdS8K0zNDRe0mfIN4s9oBq41czjHGLdXW2PgaIXqOBgB1Yb\n8IkjgcwdhRb2wNN7pzJBzwcqDYOCJHXh0mDc6PDNV8nwwZjuPrksWKZ2UbuyEjCU\ns3J0R04mApHpMGdSlDQVCSCXcOFXYohGe7OI8i9QWKko+clYkHslTrjreq7d2D1I\nAmW4TlJvA9A4BO2F0w+jpizhBuv2G0J0fiZI6XwRQk9lZ9qOZhxVRY/o6untr301\njm0CAwEAAaNQME4wHQYDVR0OBBYEFFF36jdkUOriWBFdkjWygjtQk7ZZMB8GA1Ud\nIwQYMBaAFFF36jdkUOriWBFdkjWygjtQk7ZZMAwGA1UdEwQFMAMBAf8wDQYJKoZI\nhvcNAQELBQADggEBAELqKjYIrDmiWbSSIQN4Yjk6rmVvXzqc+QZQ3qdhE9PDC9Ov\nTe5e1Y+2YBjI1HbF6lc+nLRQfyTkBpY5eo8KtcPiUkJUxGpVYtg+zttNn1OXUu3a\nAU4w2u5NNklsSrZwGwwtQFXXZIcd3Ov5jaq/penvcjjModJtuA4qX2K26tkDJdE7\nfDkMWkbr6e1yxeofcmy2kYM9r7ayAEP8mVlBeeBoWKtgIzW9AXe7vLZmkBTylGTU\nEWAQSfVkVUirWDDwlZU7ru0y2SyxILRVxzrFsknsGkxHmJWjNH9Bh2RjFqulXFhz\nVuTVC6t7OW9oOTeX3FivB7mOlqTYdIF4tvkS6pM=\n-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaxy\n-----END RSA PRIVATE KEY-----', // gitleaks:allow
                            chainCA: {
                                use: '/Common/Shared/ca_example_bundle'
                            }
                        },
                        as3_tls_client: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        as3_tls_server: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    certificate: 'useCert'
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
                                    servicePort: 443
                                }
                            ]
                        }
                    }
                },
                exampleTenant2: {
                    class: 'Tenant',
                    exampleApp2: {
                        class: 'Application',
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'as3_tls_client',
                            serverTLS: 'as3_tls_server',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: [
                                '1.1.1.3'
                            ],
                            virtualPort: 443
                        },
                        useCert: {
                            class: 'Certificate',
                            certificate: {
                                bigip: '/Common/default.crt'
                            },
                            privateKey: {
                                bigip: '/Common/default.key'
                            },

                            chainCA: {
                                use: '/Common/Shared/ca_example_bundle'
                            }
                        },
                        as3_tls_client: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        as3_tls_server: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    certificate: 'useCert'
                                }
                            ]
                        },
                        poolPool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: [
                                        '192.0.2.2'
                                    ],
                                    servicePort: 443
                                }
                            ]
                        }
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
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                const requestPrivateKey = declaration.declaration.exampleTenant1.exampleApp.useCert.privateKey;
                const requestPrivateKeyTenant2 = '/Common/default.key';
                const responsePrivateKey = response.exampleTenant1.exampleApp.useCert.privateKey;
                const responsePrivateKeyTenant2 = response.exampleTenant2.exampleApp2.useCert.privateKey.bigip;
                assert.notEqual(responsePrivateKey, requestPrivateKey);
                assert.strictEqual(responsePrivateKeyTenant2, requestPrivateKeyTenant2);
            })
            .then(() => deleteDeclaration());
    });
});

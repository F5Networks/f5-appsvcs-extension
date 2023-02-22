/**
 * Copyright 2023 F5 Networks, Inc.
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
    patch,
    deleteDeclaration,
    GLOBAL_TIMEOUT,
    getDeclaration
} = require('../property/propertiesCommon');

describe('patch', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());

    function validateAs3Result(result, expectedTenantName) {
        assert.strictEqual(result.code, 200);
        assert.strictEqual(result.message, 'success');
        assert.strictEqual(result.tenant, expectedTenantName);
    }

    it('should patch just the tenant mentioned', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                traceResponse: true,
                logLevel: 'debug'
            },
            Tenant1: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    web_pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.1'
                                ]
                            }
                        ]
                    }
                }
            },
            Tenant2: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    web_pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.2'
                                ]
                            }
                        ]
                    }
                }
            }
        };

        const patchDecl = {
            class: 'AS3',
            action: 'patch',
            controls: {
                class: 'Controls',
                trace: true,
                traceResponse: true,
                logLevel: 'debug'
            },
            patchBody: [
                {
                    op: 'add',
                    path: '/Tenant2/A1/web_pool/members/0/serverAddresses/-',
                    value: '192.0.2.10'
                }
            ]
        };

        return Promise.resolve()
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 2);
                validateAs3Result(response.results[0], 'Tenant1');
                validateAs3Result(response.results[1], 'Tenant2');
            })
            .then(() => postDeclaration(patchDecl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'Tenant2');
            });
    });

    it('should patch virtual server addresses and enable', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            Tenant: {
                class: 'Tenant',
                HTTPS_Service: {
                    class: 'Application',
                    template: 'https',
                    serviceMain: {
                        class: 'Service_HTTPS',
                        virtualAddresses: [
                            '198.19.192.145'
                        ],
                        snat: 'auto',
                        pool: 'Pool1',
                        profileHTTP: {
                            use: 'HTTP_Profile'
                        },
                        profileHTTPCompression: {
                            use: 'HTTP_Compress'
                        },
                        serverTLS: 'TLS_Offload'
                    },
                    Pool1: {
                        class: 'Pool',
                        monitors: [
                            'http'
                        ],
                        members: [
                            {
                                servicePort: 8001,
                                serverAddresses: [
                                    '198.19.192.146'
                                ]
                            },
                            {
                                servicePort: 8002,
                                serverAddresses: [
                                    '198.19.192.147'
                                ]
                            }
                        ]
                    },
                    HTTP_Profile: {
                        class: 'HTTP_Profile',
                        xForwardedFor: true
                    },
                    HTTP_Compress: {
                        class: 'HTTP_Compress',
                        cpuSaver: true,
                        cpuSaverHigh: 70,
                        cpuSaverLow: 50,
                        selective: true
                    },
                    TLS_Offload: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'TLS_KeyPair'
                            }
                        ]
                    },
                    TLS_KeyPair: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDrjCCApagAwIBAgIECrPR/zANBgkqhkiG9w0BAQsFADCBmDELMAkGA1UEBhMC\nVVMxCzAJBgNVBAgTAldBMRAwDgYDVQQHEwdTZWF0dGxlMRIwEAYDVQQKEwlNeUNv\nbXBhbnkxCzAJBgNVBAsTAklUMR4wHAYDVQQDExVsb2NhbGhvc3QubG9jYWxkb21h\naW4xKTAnBgkqhkiG9w0BCQEWGnJvb3RAbG9jYWxob3N0LmxvY2FsZG9tYWluMB4X\nDTE1MDkxMDEyNTQyM1oXDTI1MDkwNzEyNTQyM1owgZgxCzAJBgNVBAYTAlVTMQsw\nCQYDVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRsZTESMBAGA1UEChMJTXlDb21wYW55\nMQswCQYDVQQLEwJJVDEeMBwGA1UEAxMVbG9jYWxob3N0LmxvY2FsZG9tYWluMSkw\nJwYJKoZIhvcNAQkBFhpyb290QGxvY2FsaG9zdC5sb2NhbGRvbWFpbjCCASIwDQYJ\nKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL4NU/ngspr58TYRGpwDGwXYhnmKBNE0\nj9zIsAFGI///er4eEk/TuSwrmthI18a24XyZG7g8UgLaYiOCNOVma/6121ZsE2EU\nlVIp0fL+IyVPbO3q+8s73MN/aDm/F2ksvtLQ2ONPcmyYBdizyjuvzHgegMeg6BqW\nqdi3bd/7oAfObPNIrqLmuc0F2os9W8kAsMPt11QYuLxzeK1xaTflNP6tFC73Qwb1\nHjNKK9kPd/pjy3vnb3lPlxf1g1bF/u2gXHrJyNgtBuUGzNaVGs4bMrMQM4zkbBB/\nJKQbhK1NrvaeuhwwPzlW9RJnlGNvRZdb1MbrJKLKHhThtTAgZoF3DQkCAwEAATAN\nBgkqhkiG9w0BAQsFAAOCAQEAZSXy1B9BrdCvjIj50aeFWylKQ/+7ehgrHKzbVsM3\n1DFWqDhXvWrrPXYn68/p5hZi1/nnVcWvwf8EBvm6i00khiypzqgEFZPJje6OGa93\nv4fN5WgmWro/Lc6vbiGrnVhysS9yb8ult//OiocDa7XDvK8u4nVYJ+PZ12FBV5R8\nk6v5NT5sPPYM2qYXdlEpnAopMWYvAfLmSIT6l6G7yIilIDQ0BMbJz963yM4NiQLw\nkGIwd0nfbBFsTd/c3BBG9Qj4SfoXjuWz8c+lP3f0pmuSl8zADNajI27wt1BZ1m4I\nugCnZbIVvo2azInZ1RIFJtIJB6dpe+LHL/PJY5fWpjogzA==\n-----END CERTIFICATE-----',
                        chainCA: '-----BEGIN CERTIFICATE-----\nMIIE/zCCA+egAwIBAgIEUdNARDANBgkqhkiG9w0BAQsFADCBsDELMAkGA1UEBhMC\nVVMxFjAUBgNVBAoTDUVudHJ1c3QsIEluYy4xOTA3BgNVBAsTMHd3dy5lbnRydXN0\nLm5ldC9DUFMgaXMgaW5jb3Jwb3JhdGVkIGJ5IHJlZmVyZW5jZTEfMB0GA1UECxMW\nKGMpIDIwMDYgRW50cnVzdCwgSW5jLjEtMCsGA1UEAxMkRW50cnVzdCBSb290IENl\ncnRpZmljYXRpb24gQXV0aG9yaXR5MB4XDTE0MDkyMjE3MTQ1N1oXDTI0MDkyMzAx\nMzE1M1owgb4xCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1FbnRydXN0LCBJbmMuMSgw\nJgYDVQQLEx9TZWUgd3d3LmVudHJ1c3QubmV0L2xlZ2FsLXRlcm1zMTkwNwYDVQQL\nEzAoYykgMjAwOSBFbnRydXN0LCBJbmMuIC0gZm9yIGF1dGhvcml6ZWQgdXNlIG9u\nbHkxMjAwBgNVBAMTKUVudHJ1c3QgUm9vdCBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0\neSAtIEcyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuoS2ctueDGvi\nmekwAad26jK4lUEaydphTlhyz/72gnm/c2EGCqUn2LNf00VOHHLWTjLycooP94MZ\n0GqAgABFHrDH55q/ElcnHKNoLwqHvWprDl5l8xx31dSFjXAhtLMy54ui1YY5ArG4\n0kfO5MlJxDun3vtUfVe+8OhuwnmyOgtV4lCYFjITXC94VsHClLPyWuQnmp8k18bs\n0JslguPMwsRFxYyXegZrKhGfqQpuSDtv29QRGUL3jwe/9VNfnD70FyzmaaxOMkxi\nd+q36OW7NLwZi66cUee3frVTsTMi5W3PcDwa+uKbZ7aD9I2lr2JMTeBYrGQ0EgP4\nto2UYySkcQIDAQABo4IBDzCCAQswDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQI\nMAYBAf8CAQEwMwYIKwYBBQUHAQEEJzAlMCMGCCsGAQUFBzABhhdodHRwOi8vb2Nz\ncC5lbnRydXN0Lm5ldDAzBgNVHR8ELDAqMCigJqAkhiJodHRwOi8vY3JsLmVudHJ1\nc3QubmV0L3Jvb3RjYTEuY3JsMDsGA1UdIAQ0MDIwMAYEVR0gADAoMCYGCCsGAQUF\nBwIBFhpodHRwOi8vd3d3LmVudHJ1c3QubmV0L0NQUzAdBgNVHQ4EFgQUanImetAe\n733nO2lR1GyNn5ASZqswHwYDVR0jBBgwFoAUaJDkZ6SmU4DHhmak8fdLQ/uEvW0w\nDQYJKoZIhvcNAQELBQADggEBAGkzg/woem99751V68U+ep11s8zDODbZNKIoaBjq\nHmnTvefQd9q4AINOSs9v0fHBIj905PeYSZ6btp7h25h3LVY0sag82f3Azce/BQPU\nAsXx5cbaCKUTx2IjEdFhMB1ghEXveajGJpOkt800uGnFE/aRs8lFc3a2kvZ2Clvh\nA0e36SlMkTIjN0qcNdh4/R0f5IOJJICtt/nP5F2l1HHEhVtwH9s/HAHrGkUmMRTM\nZb9n3srMM2XlQZHXN75BGpad5oqXnafOrE6aPb0BoGrZTyIAi0TVaWJ7LuvMuueS\nfWlnPfy4fN5Bh9Bp6roKGHoalUOzeXEodm2h+1dK7E3IDhA=\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIFAzCCA+ugAwIBAgIEUdNg7jANBgkqhkiG9w0BAQsFADCBvjELMAkGA1UEBhMC\nVVMxFjAUBgNVBAoTDUVudHJ1c3QsIEluYy4xKDAmBgNVBAsTH1NlZSB3d3cuZW50\ncnVzdC5uZXQvbGVnYWwtdGVybXMxOTA3BgNVBAsTMChjKSAyMDA5IEVudHJ1c3Qs\nIEluYy4gLSBmb3IgYXV0aG9yaXplZCB1c2Ugb25seTEyMDAGA1UEAxMpRW50cnVz\ndCBSb290IENlcnRpZmljYXRpb24gQXV0aG9yaXR5IC0gRzIwHhcNMTQxMDIyMTcw\nNTE0WhcNMjQxMDIzMDczMzIyWjCBujELMAkGA1UEBhMCVVMxFjAUBgNVBAoTDUVu\ndHJ1c3QsIEluYy4xKDAmBgNVBAsTH1NlZSB3d3cuZW50cnVzdC5uZXQvbGVnYWwt\ndGVybXMxOTA3BgNVBAsTMChjKSAyMDEyIEVudHJ1c3QsIEluYy4gLSBmb3IgYXV0\naG9yaXplZCB1c2Ugb25seTEuMCwGA1UEAxMlRW50cnVzdCBDZXJ0aWZpY2F0aW9u\nIEF1dGhvcml0eSAtIEwxSzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANo/ltBNuS9E59s5XptQ7lylYdpBZ1MJqgCajld/KWvbx+EhJKo60I1HI9Ltchbw\nkSHSXbe4S6iDj7eRMmjPziWTLLJ9l8j+wbQXugmeA5CTe3xJgyJoipveR8MxmHou\nfUAL0u8+07KMqo9Iqf8A6ClYBve2k1qUcyYmrVgO5UK41epzeWRoUyW4hM+Ueq4G\nRQyja03Qxr7qGKQ28JKyuhyIjzpSf/debYMcnfAf5cPW3aV4kj2wbSzqyc+UQRlx\nRGi6RzwE6V26PvA19xW2nvIuFR4/R8jIOKdzRV1NsDuxjhcpN+rdBQEiu5Q2Ko1b\nNf5TGS8IRsEqsxpiHU4r2RsCAwEAAaOCAQkwggEFMA4GA1UdDwEB/wQEAwIBBjAP\nBgNVHRMECDAGAQH/AgEAMDMGCCsGAQUFBwEBBCcwJTAjBggrBgEFBQcwAYYXaHR0\ncDovL29jc3AuZW50cnVzdC5uZXQwMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL2Ny\nbC5lbnRydXN0Lm5ldC9nMmNhLmNybDA7BgNVHSAENDAyMDAGBFUdIAAwKDAmBggr\nBgEFBQcCARYaaHR0cDovL3d3dy5lbnRydXN0Lm5ldC9ycGEwHQYDVR0OBBYEFIKi\ncHTdvFM/z3vU981/p2DGCky/MB8GA1UdIwQYMBaAFGpyJnrQHu995ztpUdRsjZ+Q\nEmarMA0GCSqGSIb3DQEBCwUAA4IBAQA/HBpb/0AiHY81DC2qmSerwBEycNc2KGml\njbEnmUK+xJPrSFdDcSPE5U6trkNvknbFGe/KvG9CTBaahqkEOMdl8PUM4ErfovrO\nGhGonGkvG9/q4jLzzky8RgzAiYDRh2uiz2vUf/31YFJnV6Bt0WRBFG00Yu0GbCTy\nBrwoAq8DLcIzBfvLqhboZRBD9Wlc44FYmc1r07jHexlVyUDOeVW4c4npXEBmQxJ/\nB7hlVtWNw6f1sbZlnsCDNn8WRTx0S5OKPPEr9TVwc3vnggSxGJgO1JxvGvz8pzOl\nu7sY82t6XTKH920l5OJ2hiEeEUbNdg5vT6QhcQqEpy02qUgiUX6C\n-----END CERTIFICATE-----\n',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,B70F0ADDBA9C536F529ACBE54023BEF2\n\nKSd9q+MpBZLSHez/50G4GF9OecJxy3HLMZkvDYC/gvOT+IiWvprBru823/Gjqdt1\nopqmIjduBcZtcC6byWc6u7e2s8X1Hf/ifm+kgEhYRdEvdFC6fJnMRBHWzMnTIfX1\nEK7YNdrfnCGjszBjTPgrgYM6pwGbOS6RV6GeL6+KcvlkrR1FT9dCNX7Lz1PbrBSB\nHOz2yQUGeXbCv+zwRN88qKNZD0SgXByU4jSCDH8NMkB6FUjFROwcG4bzK0m8t8k2\nph4iNVTgEkkkBgkgmRrOb+4GWARW8VIVGzwzaeOgw8KxmNjyOgmX6vfG2DJhOhBJ\nA4Usd+TYY6ioanzodHvZLsWtzzfxqb+a9W+fUDu7DtbCOkUCpxyqgtzaULPkAXC4\nrJx8LJBvkCHmsN3iuGBQHMMNAJuljM4kO13Q3qt9bvq48BcrroVPM/7uq08jRqCo\nT60RB8ZxYfpRAXnbp6YPTOw+2+O6JLlIASNOYyk6zUkZr3dQXBzK5aACOzUwMWXu\nhS2hdQq26pPX/X5bhvFGVNcGjd+/GVNK1zSliAQOe6uiEwJWZjhigW5cMRFeoUis\ndOhUXtv7/e8g5zhyqEIv1O4RBCY/lYd7Q/IQ6cQg3qanXWuT1Zb0gMrotcH2AxuP\nCaiiJe5z0lD1r35dSRF4EWwX9p4UP3QoVZbeQByvINXZlHFPcjDHsS5MzLNZAvLz\nYmWY9W3A5HoSawbc0zAaai6bJwW4X1FBayHZkh/S1zsSEQFVKM0TrAuEWsjWpxFz\nQ2VyWHwpnCsnG3qzzI/nvxnd+PJC1QhpfBlc1toks02o1ZfSt0xGed5wRowy1kME\nIBburbAauc0d+WTiwVw9ZoKqpjPDQJF1Xg0R6aiwXJ9pOQPkSj0bIkGtIM7nXBbM\nzB5HXLbfQlnn12t61+PtzQnYlN8cuWZISzxuhqYp5qickDpQ7FAXHm77zKDr/6Hj\njoraLZG5Y1RPNES5vZvtMw23iHQBwC+Mlu8U+xmGa3fBKi/+VojkBh1X0+Lg4hZw\nwiuvSYwCt9MgXZoqHmwroS2bk1JIhPlM1aySaRjzvb9LOYwVT/UFVBfv3aC2jlI/\n5mmdEn7KxhcZarkCoZoexahhS9rDd8EuonuGud+pF9p9MtvLbDcKiq5hvp8Ib8oK\nuCgMHbOWIxfzanOiVLrxY0spj1RhahgCrFVPfHizUBvd/Zb0WJ5LTmHktHngHLVq\nLS6dZNsY6WEQa3X6XHfPje7C/3b151Io5XHYXNOW8uhXtfvRJbEaVNXl9exQomkL\n93alSXvsCh4UKgFQAKfsZ7xjXchC8WDFTLVt48GAPl65AId6vgzFq5474gazNUQk\nem/ymGGoPttA6McJxeOiPfMoUzfgneipmJMSpYN4uQZcglpIaHtkrdDZREhesiYk\n0dpYim/uGCWP2F4brUGbRcT/eWqQCT38ZrX+JJbQxQTLlw0DsCeReNU+4Q+vI33j\n9fN7uHjQFgCV97yNdt7h1eq80AScDUnoy7gtIE3CJMQ86o18dE3APErK/BaXGbiS\njcS0pLTggfQPSzEXHXz/Cx31iSGO2NAMWgtN26zAQ2esw8g8sAnxyobvDMgO7pt+\n-----END RSA PRIVATE KEY-----\n',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual'))
            .then((response) => {
                const https = response.items.find((e) => e.name === 'serviceMain');
                assert.strictEqual(https.destination, '/Tenant/198.19.192.145:443');
                const http = response.items.find((e) => e.name === 'serviceMain-Redirect-');
                assert.strictEqual(http.destination, '/Tenant/198.19.192.145:80');
            })
            // PATCH add virtual address
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'add',
                    path: '/Tenant/HTTPS_Service/serviceMain/virtualAddresses/-',
                    value: '198.19.192.144'
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual'))
            .then((response) => {
                let server = response.items.find((e) => e.name === 'serviceMain');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.145:443');
                server = response.items.find((e) => e.name === 'serviceMain-Redirect-');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.145:80');

                server = response.items.find((e) => e.name === 'serviceMain-1-');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.144:443');
                server = response.items.find((e) => e.name === 'serviceMain-Redirect--1-');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.144:80');
            })
            // PATCH replace virtual address
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'replace',
                    path: '/Tenant/HTTPS_Service/serviceMain/virtualAddresses/0',
                    value: '198.19.192.143'
                }],
                {
                    logInfo: { patchIndex: 1 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual'))
            .then((response) => {
                let server = response.items.find((e) => e.name === 'serviceMain');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.143:443');
                server = response.items.find((e) => e.name === 'serviceMain-Redirect-');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.143:80');

                server = response.items.find((e) => e.name === 'serviceMain-1-');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.144:443');
                server = response.items.find((e) => e.name === 'serviceMain-Redirect--1-');
                assert.strictEqual(server.destination, '/Tenant/198.19.192.144:80');
            })
            // PATCH disable
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'add',
                    path: '/Tenant/HTTPS_Service/serviceMain/enable',
                    value: false
                }],
                {
                    logInfo: { patchIndex: 2 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual'))
            .then((response) => {
                // response.items should not exist unless there are virtual servers outside of the test
                if (response.items) {
                    let server = response.items.find((e) => e.name === 'serviceMain');
                    assert.isUndefined(server);
                    server = response.items.find((e) => e.name === 'serviceMain-Redirect-');
                    assert.isUndefined(server);

                    server = response.items.find((e) => e.name === 'serviceMain-1-');
                    assert.isUndefined(server);
                    server = response.items.find((e) => e.name === 'serviceMain-Redirect--1-');
                    assert.isUndefined(server);
                }
            });
    });

    it('should patch pool members', () => {
        const postDecl = {
            class: 'AS3',
            action: 'deploy',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.0.0',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                Tenant: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        template: 'shared',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '10.0.1.10'
                            ],
                            pool: 'web_pool'
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: [
                                'http'
                            ],
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.1.10'
                                    ]
                                }
                            ]
                        }
                    },
                    A2: {
                        class: 'Application',
                        template: 'shared',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '10.0.1.11'
                            ],
                            pool: 'web_pool2'
                        },
                        web_pool2: {
                            class: 'Pool',
                            monitors: [
                                'http'
                            ],
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.1.11'
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A1~web_pool/members'))
            .then((response) => {
                assert.isDefined(response.items.find((e) => e.fullPath === '/Tenant/192.0.1.10:80'));
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A2~web_pool2/members'))
            .then((response) => {
                assert.isDefined(response.items.find((e) => e.fullPath === '/Tenant/192.0.1.11:80'));
            })
            // PATCH disable a pool member
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'add',
                    path: '/Tenant/A1/web_pool/members/0/enable',
                    value: false
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A1~web_pool/members'))
            .then((response) => {
                assert.isEmpty(response.items);
            })
            // PATCH rename a pool
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'move',
                    from: '/Tenant/A1/web_pool',
                    path: '/Tenant/A1/web_pool_new'
                }],
                {
                    logInfo: { patchIndex: 1 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool'))
            .then((response) => {
                assert.isUndefined(response.items.find((e) => e.name === 'web_pool'));
                assert.isDefined(response.items.find((e) => e.name === 'web_pool_new'));
            })
            // PATCH copy a pool
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'copy',
                    path: '/Tenant/A2/web_pool_clone',
                    from: '/Tenant/A1/web_pool_new'
                }],
                {
                    logInfo: { patchIndex: 2 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A1~web_pool_new/members'))
            .then((response) => {
                assert.isEmpty(response.items);
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A2~web_pool_clone/members'))
            .then((response) => {
                assert.isEmpty(response.items);
            })
            // PATCH remove a pool
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/Tenant',
                [{
                    op: 'remove',
                    path: '/Tenant/A2/web_pool_clone'
                }],
                {
                    logInfo: { patchIndex: 3 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool'))
            .then((response) => {
                assert.isUndefined(response.items.find((e) => e.name === 'web_pool_clone'));
            })
            // PATCH add a pool member
            .then(() => {
                const testNode1 = '/Tenant/A1/web_pool_new/members/0';
                const testNode2 = '/Tenant/A1/web_pool_new/members/1';
                const testNode3 = '/Tenant/A2/web_pool2/members/0';

                return patch(
                    '/mgmt/shared/appsvcs/declare/Tenant',
                    [
                        {
                            op: 'add',
                            path: `${testNode1}`,
                            value: {
                                servicePort: 8003,
                                serverAddresses: [
                                    '1.1.1.1'
                                ]
                            }
                        },
                        {
                            op: 'add',
                            path: `${testNode2}`,
                            value: {
                                servicePort: 8003,
                                serverAddresses: [
                                    '1.2.2.2'
                                ]
                            }
                        },
                        {
                            op: 'remove',
                            path: `${testNode1}`,
                            value: true
                        },
                        {
                            op: 'add',
                            path: `${testNode3}`,
                            value: {
                                servicePort: 8003,
                                serverAddresses: [
                                    '1.1.1.1'
                                ]
                            }
                        }
                    ],
                    {
                        logInfo: { patchIndex: 4 }
                    }
                );
            })
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A1~web_pool_new/members'))
            .then((response) => {
                assert.isDefined(response.items.find((e) => e.name === '1.2.2.2:8003'));
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Tenant~A2~web_pool2/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 2);
                assert.strictEqual(response.items[0].name, '1.1.1.1:8003');
                assert.strictEqual(response.items[1].name, '192.0.1.11:80');
            });
    });

    it('should patch replacing an attached iRule', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_IRULES_EXPAND: {
                class: 'Tenant',
                Test_iRules_Expand: {
                    class: 'Application',
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '10.0.1.10'
                        ],
                        iRules: [
                            { use: 'rule_expanded' }
                        ]
                    },
                    rule_expanded: {
                        class: 'iRule',
                        label: 'VGhpcyB3YXMgQmFzZTY0',
                        iRule: {
                            base64: 'd2hlbiBTRVJWRVJfQ09OTkVDVEVEDQp7DQojIGBgSWBgIHVuaXF1ZSBpZGVudGlmaWVyIG9mIGRlY2xhcmF0aW9uDQogIHNldCBpZCAiYElgIg0KIw0KIyBgYEZgYCBmYW1pbHkgbmFtZQ0KICBzZXQgZmFtaWx5ICJgRmAiDQojDQojIGBgVGBgIGN1cnJlbnQgVGVuYW50IG5hbWUNCiAgc2V0IHRlbmFudCAiYFRgIg0KIw0KIyBgYEFgYCBjdXJyZW50IEFwcGxpY2F0aW9uIG5hbWUNCiAgc2V0IGFwcGxpY2F0aW9uICJgQWAiDQojDQojIGBgWWBgIGFwcGxpY2F0aW9uIHR5cGUNCiAgc2V0IGFwcGxpY2F0aW9uX3R5cGUgImBZYCINCiMNCiMgYGBNYGAgbmFtZSBvZiBiYXNlIHByb3BlcnR5DQogIHNldCBiYXNlX3Byb3BlcnR5ICJgTWAiDQojDQojIGBgTmBgIGZ1bGwgYmFzZS1wcm9wZXJ0eSBwYXRobmFtZQ0KICBzZXQgYmFzZV9wcm9wZXJ0eV9wYXRobmFtZSAiYE5gIg0KIw0KIyBgYE9gYCBvYmplY3QtbmFtZSBvZiBuZWFyZXN0IGFuY2VzdG9yIG9mIGBgTWBgDQogIHNldCBhbmNlc3Rvcl9vYmplY3RfbmFtZSAiYE9gIg0KIw0KIyBgYFBgYCBwYXRoIG9mIGBgT2BgDQogIHNldCBhbmNlc3Rvcl9vYmplY3RfZGlyICJgUGAiDQojDQojIGBgUWBgIHBhdGggb2YgYGBPYGAgbWVtYmVyDQogIHNldCBhbmNlc3Rvcl9vYmplY3RfZnVsbHBhdGggImBRYCINCiMNCiMgYGBDYGAgY2xhc3MgbmFtZSBvZiBgYE9gYA0KICBzZXQgYW5jZXN0b3JfY2xhc3NfbmFtZSAiYENgIg0KIw0KIyBMYWJlbCBSZWY6IGA9L1RFU1RfSVJVTEVTX0VYUEFORC9UZXN0X2lSdWxlc19FeHBhbmQvcnVsZV9leHBhbmRlZC9sYWJlbGANCiMgRGVjb2RlZCBMYWJlbCBSZWY6IGArL1RFU1RfSVJVTEVTX0VYUEFORC9UZXN0X2lSdWxlc19FeHBhbmQvcnVsZV9leHBhbmRlZC9sYWJlbGANCiMNCiMgQ29uc3RhbnQgUmVmOiBgPS9URVNUX0lSVUxFU19FWFBBTkQvVGVzdF9pUnVsZXNfRXhwYW5kL2NvbnN0YW50cy9TbmFja2ANCiMNCiMgQklHSVAgcGF0aDogYCovVEVTVF9JUlVMRVNfRVhQQU5EL1Rlc3RfaVJ1bGVzX0V4cGFuZC9ydWxlX2V4cGFuZGVkYA0KfQ=='
                        },
                        expand: true
                    },
                    rule_unexpanded: {
                        class: 'iRule',
                        label: 'VGhpcyB3YXMgQmFzZTY0',
                        iRule: {
                            base64: 'd2hlbiBTRVJWRVJfQ09OTkVDVEVEDQp7DQojIFVuZXhwYW5kZWQgU3RyaW5nIEV4cGFuc2lvbnMgLS0NCiMNCiMgYGBJYGAgdW5pcXVlIGlkZW50aWZpZXIgb2YgZGVjbGFyYXRpb24NCiAgc2V0IGlkICJgSWAiDQojDQojIGBgRmBgIGZhbWlseSBuYW1lDQogIHNldCBmYW1pbHkgImBGYCINCiMNCiMgYGBUYGAgY3VycmVudCBUZW5hbnQgbmFtZQ0KICBzZXQgdGVuYW50ICJgVGAiDQojDQojIGBgQWBgIGN1cnJlbnQgQXBwbGljYXRpb24gbmFtZQ0KICBzZXQgYXBwbGljYXRpb24gImBBYCINCiMNCiMgYGBZYGAgYXBwbGljYXRpb24gdHlwZQ0KICBzZXQgYXBwbGljYXRpb25fdHlwZSAiYFlgIg0KIw0KIyBgYE1gYCBuYW1lIG9mIGJhc2UgcHJvcGVydHkNCiAgc2V0IGJhc2VfcHJvcGVydHkgImBNYCINCiMNCiMgYGBOYGAgZnVsbCBiYXNlLXByb3BlcnR5IHBhdGhuYW1lDQogIHNldCBiYXNlX3Byb3BlcnR5X3BhdGhuYW1lICJgTmAiDQojDQojIGBgT2BgIG9iamVjdC1uYW1lIG9mIG5lYXJlc3QgYW5jZXN0b3Igb2YgYGBNYGANCiAgc2V0IGFuY2VzdG9yX29iamVjdF9uYW1lICJgT2AiDQojDQojIGBgUGBgIHBhdGggb2YgYGBPYGANCiAgc2V0IGFuY2VzdG9yX29iamVjdF9kaXIgImBQYCINCiMNCiMgYGBRYGAgcGF0aCBvZiBgYE9gYCBtZW1iZXINCiAgc2V0IGFuY2VzdG9yX29iamVjdF9mdWxscGF0aCAiYFFgIg0KIw0KIyBgYENgYCBjbGFzcyBuYW1lIG9mIGBgT2BgDQogIHNldCBhbmNlc3Rvcl9jbGFzc19uYW1lICJgQ2AiDQojDQojIExhYmVsIFJlZjogYD0vVEVTVF9JUlVMRVNfRVhQQU5EL1Rlc3RfaVJ1bGVzX0V4cGFuZC9ydWxlX3VuZXhwYW5kZWQvbGFiZWxgDQojIERlY29kZWQgTGFiZWwgUmVmOiBgKy9URVNUX0lSVUxFU19FWFBBTkQvVGVzdF9pUnVsZXNfRXhwYW5kL3J1bGVfdW5leHBhbmRlZC9sYWJlbGANCiMNCiMgQ29uc3RhbnQgUmVmOiBgPS9URVNUX0lSVUxFU19FWFBBTkQvVGVzdF9pUnVsZXNfRXhwYW5kL2NvbnN0YW50cy9TbmFja2ANCiMNCiMgQklHSVAgcGF0aDogYCovVEVTVF9JUlVMRVNfRVhQQU5EL1Rlc3RfaVJ1bGVzX0V4cGFuZC9ydWxlX3VuZXhwYW5kZWRgDQp9'
                        },
                        expand: false
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'TEST_IRULES_EXPAND');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~TEST_IRULES_EXPAND~Test_iRules_Expand~serviceMain'))
            .then((response) => {
                assert.deepStrictEqual(response.rules, ['/TEST_IRULES_EXPAND/Test_iRules_Expand/rule_expanded']);
            })
            // PATCH replace an iRule
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/TEST_IRULES_EXPAND',
                [{
                    op: 'replace',
                    path: '/TEST_IRULES_EXPAND/Test_iRules_Expand/serviceMain/iRules/0',
                    value: { use: 'rule_unexpanded' }
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'TEST_IRULES_EXPAND');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~TEST_IRULES_EXPAND~Test_iRules_Expand~serviceMain'))
            .then((response) => {
                assert.deepStrictEqual(response.rules, ['/TEST_IRULES_EXPAND/Test_iRules_Expand/rule_unexpanded']);
            });
    });

    it('should patch TCP profile', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_TCP_PROFILE: {
                class: 'Tenant',
                TEST_TCP_Profile: {
                    class: 'Application',
                    template: 'generic',
                    TcpIdleTimeout: {
                        class: 'TCP_Profile',
                        idleTimeout: 300
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'TEST_TCP_PROFILE');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/tcp/~TEST_TCP_PROFILE~TEST_TCP_Profile~TcpIdleTimeout'))
            .then((response) => {
                assert.strictEqual(response.idleTimeout, 300);
            })
            // PATCH modify tcp profile idle timeout
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/TEST_TCP_PROFILE',
                [{
                    op: 'replace',
                    path: '/TEST_TCP_PROFILE/TEST_TCP_Profile/TcpIdleTimeout/idleTimeout',
                    value: 400
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'TEST_TCP_PROFILE');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/tcp/~TEST_TCP_PROFILE~TEST_TCP_Profile~TcpIdleTimeout'))
            .then((response) => {
                assert.strictEqual(response.idleTimeout, 400);
            });
    });

    it('should patch virtual server port', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_Service_HTTP: {
                class: 'Tenant',
                TEST_Service_Http_Simple: {
                    class: 'Application',
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        persistenceMethods: [],
                        profileHTTPCompression: 'wan',
                        virtualAddresses: [
                            '198.19.192.24'
                        ],
                        virtualPort: 80
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'TEST_Service_HTTP');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~TEST_Service_HTTP~TEST_Service_Http_Simple~serviceMain'))
            .then((response) => {
                assert.strictEqual(response.destination, '/TEST_Service_HTTP/198.19.192.24:80');
            })
            // PATCH modify virtualPort
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/TEST_Service_HTTP',
                [{
                    op: 'replace',
                    path: '/TEST_Service_HTTP/TEST_Service_Http_Simple/serviceMain/virtualPort',
                    value: 8080
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'TEST_Service_HTTP');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~TEST_Service_HTTP~TEST_Service_Http_Simple~serviceMain'))
            .then((response) => {
                assert.strictEqual(response.destination, '/TEST_Service_HTTP/198.19.192.24:8080');
            });
    });

    it('should patch service addresses', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_SERVICE_ADDRESS: {
                class: 'Tenant',
                TEST_Service_Address: {
                    class: 'Application',
                    template: 'generic',
                    saArpTrueEchoEnable: {
                        class: 'Service_Address',
                        virtualAddress: 'fdf5:4153:3300::1011',
                        arpEnabled: true,
                        icmpEcho: 'enable'
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'TEST_SERVICE_ADDRESS');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~TEST_SERVICE_ADDRESS~saArpTrueEchoEnable'))
            .then((response) => {
                assert.strictEqual(response.arp, 'enabled');
                assert.strictEqual(response.icmpEcho, 'enabled');
            })
            // PATCH modify service address arpEnabled
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/TEST_SERVICE_ADDRESS',
                [{
                    op: 'replace',
                    path: '/TEST_SERVICE_ADDRESS/TEST_Service_Address/saArpTrueEchoEnable/arpEnabled',
                    value: false
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'TEST_SERVICE_ADDRESS');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~TEST_SERVICE_ADDRESS~saArpTrueEchoEnable'))
            .then((response) => {
                assert.strictEqual(response.arp, 'disabled');
            })
            // PATCH modify service address icmpEcho
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/TEST_SERVICE_ADDRESS',
                [{
                    op: 'replace',
                    path: '/TEST_SERVICE_ADDRESS/TEST_Service_Address/saArpTrueEchoEnable/icmpEcho',
                    value: 'disable'
                }],
                {
                    logInfo: { patchIndex: 1 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'TEST_SERVICE_ADDRESS');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual-address/~TEST_SERVICE_ADDRESS~saArpTrueEchoEnable'))
            .then((response) => {
                assert.strictEqual(response.icmpEcho, 'disabled');
            });
    });

    it('should patch switching certificates', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_MONITOR_HTTPS: {
                class: 'Tenant',
                TEST_Monitor_HTTPS: {
                    class: 'Application',
                    template: 'generic',
                    mHttpsNonDefault: {
                        class: 'Monitor',
                        label: 'mostly non-default values',
                        monitorType: 'https',
                        send: 'HEAD / HTTP/1.1\r\n\r\n',
                        receive: 'HTTP/1.1',
                        receiveDown: 'status=(quiesce|disabled|drain)',
                        transparent: true,
                        dscp: 63,
                        targetAddress: '198.19.192.16',
                        targetPort: 443,
                        interval: 10,
                        upInterval: 11,
                        timeUntilUp: 12,
                        timeout: 31,
                        ciphers: 'DEFAULT:+SHA:+3DES:+kEDH',
                        clientCertificate: 'https_monitor_certificate'
                    },

                    https_monitor_certificate: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDXjCCAkagAwIBAgIED6B1ETANBgkqhkiG9w0BAQsFADBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwHhcNMTgwNDIzMTgwNjA5WhcNMjgwNDIwMTgwNjA5WjBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC03brx8pCY7my1CW3VEXKcoehIci6d9s6XEySQDRucQU9snY6u39WLLiBa6IFIfvVTAkMvgE3mA3uXXJTMhaOkD1k/iMiZdUGnGsDml6F14hv2PbMY9WufP0+3HYhfJpOOZl/fvK25lNvqFFGV0me5SbOSDIKc47qQBJ4rwPTJ4SeWDEkMSuCgzeuZ3SEW8SxkK4WqppvtlXEI9KnPmscqXAK+QqLrsFNf0rEbJiKFU1Ae0FMgyXuIW6OjnKg9fnozIGuocISHEB4fB6F/ywJshz56jc5SM/w4eDHYP7WYmeMX+ZiKsbp0ULsnyGwKJFkAjL/LuSvMXvkgg20F5PShAgMBAAEwDQYJKoZIhvcNAQELBQADggEBADeNPg3exjVRmsZ6Tcyt3pWdMPGDG5Sbc9hOq6yfEHB205wnWQ1J1oswFUFVKxra4dtei8ToRlaYJP7Dk2J2V4RTk33nt35hdxHDnq4Id6zDtiuWN9D3srjqLpH2RwighXn1Agx/rYAXd0jQGT4genqmHUsK5YMOtHVuR1o3PFphTVfOu4gffrmuBna/YXT1gy9XPeKG0pXnxyV/ejWtXKmUNuFAZtToaiMgCWC6evsi4bpH5qRBI3aqgnGy0YXNDfeaJ8Z9FdNlyK9C6cPiHeZWkfaJHDcxXEbJuC9JQsaH/GLpLGRJ9m3GVXUhxHQGvb/sIXDvaJZYbr9rNZ/XsTw=\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,BC7025CBA1D3347A8BD2BCF84BE65C82\n\nEcDfqRFgYjE9z51ZLf2C3FiLweX/8Bcw//avQcv4LV+gTpenyWCc1Vc8B7qtYghO\nfcLBfIjqpR6xzBLJEabAnEN1vhQ7G+12d8dxJ0IYktOsN9KyVNY6XaE39XWzOIy/\nRJ5FfQtSIatYJ4w7gXY/m2CAdth7ZoUCeaxa0YDRtv/ogd++rXbb1TwkR8JyA1ZF\n8vOPQSoM7arzHMkZTYMF3dM1PsVCAB/z8O3US0ltjwQhK9hpIu/k0Vg9urqw2rG9\nu8fEboUFfQ2UCpjDdA+oR2bBr0ZzzIM15Cqb5vd8LI8bB9mOPBYNoSC01HhDKXpT\n4edzPeYT5PD7vALr2xJxFy4W18cfKKmlY/SOpZTlgGyrdXGK+24QAnRZXyOTftqd\n6+7j0X6mokEgiesDeQF9LZROFI49ZlvoK4bZ+JqrvX2kqgaxEogHS0Txt/ZM7eJF\nz1OZPlVrdPhv5b2rVeKwNkZZ4nyYC2vRfZf5aSAA1TUXNKW1pUSNDNU04D7Priz2\n0OwjWXkVbDEMRQZ/Yy/KRleaBiYv1kuBrK776h/DFjOXw+4Qj6IBeq79LNO/7uFg\nJLUBgtJExQ3NQCB+po+SyuWIkojGh30jmlQ8dmGyoEZ9muWJg/E5mTuRPb/Zvx0Y\nkHl8MvMq+7yOTf0Z1PH30ml7o9EiNniAN87ZHiU2KjrQ10eXAVJCVmQIzUh/1/DI\n4ILnxuUtOEDhi/2aec+CJJtY0Pq4+XzHcYMte6rlKnRBiCdQ0yY87vm60BLtYTI1\n9QRf0WfJeujPMO1gq5sJbxMmwLQXgzy0tv9M5wNqkCcPGofr3zE7C1c/TjjqyDCR\nTnf3KndGrcOiMo+Ney4eC3nxoof2anjhaaE5Xbz0tivDbxQ/tVj/fu9+uogavFHL\nj3T3LOUNkjokenbA6FiPnJdhLogMBBA727pBeZ8kmCQRGDvTFvcCRwjdlt+fhVgI\n+lnrWDejbrsRYDS6jQs4ow4KQ7RnP4Cj2a+waaXh9zVHU231rasUkMKgMA/ND6ME\nb6BZzii89lG8Yl0XURWeq/2jnpASX39VwXVKlDxuOpv2CN8TKgRGGlkBy3FgVccz\nWGlqKBjHDjUAyLUoQq/cwktfgGPMD6BFlx6/5O9QMM4FXHeyl97+5pe7X5cjW/Nh\nCacfDn9iA09uijOfUoGZYknVA55I+PwUJsvH1Con6UC2FMmlDhJ3D0vWIphtERQV\nDu1SLwsgTGjb+EbbzrfuQEYntkonCyInH+BSE+H86oALy6gtxgmpFvv9nY+Zyqha\nl+b6yPZJ0RqoydhUUS5Nze+wckGUspkaaUfz19NLBax4wfl1y6ETaKQpmENBnfqJ\n2B9DA4omaECONsE1gkPkULi1fivq8TTEoFGTbHVURLzqvtf6kFlYwmbGwJh4NR50\nuv5APydh4ax2oyqqnXqbp3JolUT4/h7AyhvLm+H3Lqf4thm6HmWZPpaufCrKXw6y\nUO9Q92aa/FkSaSwhTtseFdh2pUjOdEIZuyLtxNJcmHbj/meK03sa1mjGgKAI5Wp3\nP72lhPQM07Ytk6nt2Fod3rZBCxPueB8ilo7whrM0Wdy7B3I7qqBLpqHeP4vGItYR\n-----END RSA PRIVATE KEY-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'TEST_MONITOR_HTTPS');
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~TEST_MONITOR_HTTPS~TEST_Monitor_HTTPS~mHttpsNonDefault'))
            .then((response) => {
                assert.strictEqual(response.cert, '/TEST_MONITOR_HTTPS/TEST_Monitor_HTTPS/https_monitor_certificate.crt');
            })
            // PATCH remove old cert add new cert
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare/TEST_MONITOR_HTTPS',
                [
                    {
                        op: 'remove',
                        path: '/TEST_MONITOR_HTTPS/TEST_Monitor_HTTPS/mHttpsNonDefault/clientCertificate'
                    },
                    {
                        op: 'add',
                        path: '/TEST_MONITOR_HTTPS/TEST_Monitor_HTTPS/latest_cert',
                        value: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----\nMIIDXjCCAkagAwIBAgIED6B1ETANBgkqhkiG9w0BAQsFADBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwHhcNMTgwNDIzMTgwNjA5WhcNMjgwNDIwMTgwNjA5WjBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC03brx8pCY7my1CW3VEXKcoehIci6d9s6XEySQDRucQU9snY6u39WLLiBa6IFIfvVTAkMvgE3mA3uXXJTMhaOkD1k/iMiZdUGnGsDml6F14hv2PbMY9WufP0+3HYhfJpOOZl/fvK25lNvqFFGV0me5SbOSDIKc47qQBJ4rwPTJ4SeWDEkMSuCgzeuZ3SEW8SxkK4WqppvtlXEI9KnPmscqXAK+QqLrsFNf0rEbJiKFU1Ae0FMgyXuIW6OjnKg9fnozIGuocISHEB4fB6F/ywJshz56jc5SM/w4eDHYP7WYmeMX+ZiKsbp0ULsnyGwKJFkAjL/LuSvMXvkgg20F5PShAgMBAAEwDQYJKoZIhvcNAQELBQADggEBADeNPg3exjVRmsZ6Tcyt3pWdMPGDG5Sbc9hOq6yfEHB205wnWQ1J1oswFUFVKxra4dtei8ToRlaYJP7Dk2J2V4RTk33nt35hdxHDnq4Id6zDtiuWN9D3srjqLpH2RwighXn1Agx/rYAXd0jQGT4genqmHUsK5YMOtHVuR1o3PFphTVfOu4gffrmuBna/YXT1gy9XPeKG0pXnxyV/ejWtXKmUNuFAZtToaiMgCWC6evsi4bpH5qRBI3aqgnGy0YXNDfeaJ8Z9FdNlyK9C6cPiHeZWkfaJHDcxXEbJuC9JQsaH/GLpLGRJ9m3GVXUhxHQGvb/sIXDvaJZYbr9rNZ/XsTw=\n-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,BC7025CBA1D3347A8BD2BCF84BE65C82\n\nEcDfqRFgYjE9z51ZLf2C3FiLweX/8Bcw//avQcv4LV+gTpenyWCc1Vc8B7qtYghO\nfcLBfIjqpR6xzBLJEabAnEN1vhQ7G+12d8dxJ0IYktOsN9KyVNY6XaE39XWzOIy/\nRJ5FfQtSIatYJ4w7gXY/m2CAdth7ZoUCeaxa0YDRtv/ogd++rXbb1TwkR8JyA1ZF\n8vOPQSoM7arzHMkZTYMF3dM1PsVCAB/z8O3US0ltjwQhK9hpIu/k0Vg9urqw2rG9\nu8fEboUFfQ2UCpjDdA+oR2bBr0ZzzIM15Cqb5vd8LI8bB9mOPBYNoSC01HhDKXpT\n4edzPeYT5PD7vALr2xJxFy4W18cfKKmlY/SOpZTlgGyrdXGK+24QAnRZXyOTftqd\n6+7j0X6mokEgiesDeQF9LZROFI49ZlvoK4bZ+JqrvX2kqgaxEogHS0Txt/ZM7eJF\nz1OZPlVrdPhv5b2rVeKwNkZZ4nyYC2vRfZf5aSAA1TUXNKW1pUSNDNU04D7Priz2\n0OwjWXkVbDEMRQZ/Yy/KRleaBiYv1kuBrK776h/DFjOXw+4Qj6IBeq79LNO/7uFg\nJLUBgtJExQ3NQCB+po+SyuWIkojGh30jmlQ8dmGyoEZ9muWJg/E5mTuRPb/Zvx0Y\nkHl8MvMq+7yOTf0Z1PH30ml7o9EiNniAN87ZHiU2KjrQ10eXAVJCVmQIzUh/1/DI\n4ILnxuUtOEDhi/2aec+CJJtY0Pq4+XzHcYMte6rlKnRBiCdQ0yY87vm60BLtYTI1\n9QRf0WfJeujPMO1gq5sJbxMmwLQXgzy0tv9M5wNqkCcPGofr3zE7C1c/TjjqyDCR\nTnf3KndGrcOiMo+Ney4eC3nxoof2anjhaaE5Xbz0tivDbxQ/tVj/fu9+uogavFHL\nj3T3LOUNkjokenbA6FiPnJdhLogMBBA727pBeZ8kmCQRGDvTFvcCRwjdlt+fhVgI\n+lnrWDejbrsRYDS6jQs4ow4KQ7RnP4Cj2a+waaXh9zVHU231rasUkMKgMA/ND6ME\nb6BZzii89lG8Yl0XURWeq/2jnpASX39VwXVKlDxuOpv2CN8TKgRGGlkBy3FgVccz\nWGlqKBjHDjUAyLUoQq/cwktfgGPMD6BFlx6/5O9QMM4FXHeyl97+5pe7X5cjW/Nh\nCacfDn9iA09uijOfUoGZYknVA55I+PwUJsvH1Con6UC2FMmlDhJ3D0vWIphtERQV\nDu1SLwsgTGjb+EbbzrfuQEYntkonCyInH+BSE+H86oALy6gtxgmpFvv9nY+Zyqha\nl+b6yPZJ0RqoydhUUS5Nze+wckGUspkaaUfz19NLBax4wfl1y6ETaKQpmENBnfqJ\n2B9DA4omaECONsE1gkPkULi1fivq8TTEoFGTbHVURLzqvtf6kFlYwmbGwJh4NR50\nuv5APydh4ax2oyqqnXqbp3JolUT4/h7AyhvLm+H3Lqf4thm6HmWZPpaufCrKXw6y\nUO9Q92aa/FkSaSwhTtseFdh2pUjOdEIZuyLtxNJcmHbj/meK03sa1mjGgKAI5Wp3\nP72lhPQM07Ytk6nt2Fod3rZBCxPueB8ilo7whrM0Wdy7B3I7qqBLpqHeP4vGItYR\n-----END RSA PRIVATE KEY-----',
                            passphrase: {
                                ciphertext: 'ZjVmNQ==',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                                miniJWE: true
                            }
                        }
                    },
                    {
                        op: 'add',
                        path: '/TEST_MONITOR_HTTPS/TEST_Monitor_HTTPS/mHttpsNonDefault/clientCertificate',
                        value: 'latest_cert'
                    }
                ],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'TEST_MONITOR_HTTPS');
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~TEST_MONITOR_HTTPS~TEST_Monitor_HTTPS~mHttpsNonDefault'))
            .then((response) => {
                assert.strictEqual(response.cert, '/TEST_MONITOR_HTTPS/TEST_Monitor_HTTPS/latest_cert.crt');
            });
    });

    it('should patch a new tenant into place', () => {
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                traceResponse: true,
                logLevel: 'debug'
            },
            Tenant1: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    web_pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.1'
                                ]
                            }
                        ]
                    }
                }
            }
        };

        const patchDecl = {
            class: 'AS3',
            action: 'patch',
            controls: {
                class: 'Controls',
                trace: true,
                traceResponse: true,
                logLevel: 'debug'
            },
            patchBody: [
                {
                    op: 'add',
                    path: '/Tenant2',
                    value: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application'
                        }
                    }
                }
            ]
        };

        return Promise.resolve()
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'Tenant1');
            })
            .then(() => postDeclaration(patchDecl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'Tenant2');
            })
            .then(() => getDeclaration())
            .then((response) => {
                // Confirm then Remove random values
                assert.strictEqual(typeof response.controls.archiveTimestamp, 'string');
                assert.strictEqual(typeof response.id, 'string');
                delete response.controls.archiveTimestamp;
                delete response.id;

                assert.deepStrictEqual(
                    response,
                    {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        controls: {
                            class: 'Controls',
                            trace: true,
                            traceResponse: true,
                            logLevel: 'debug'
                        },
                        updateMode: 'selective',
                        Tenant1: {
                            class: 'Tenant',
                            A1: {
                                class: 'Application',
                                web_pool: {
                                    class: 'Pool',
                                    members: [
                                        {
                                            serverAddresses: ['192.0.2.1'],
                                            servicePort: 80
                                        }
                                    ]
                                }
                            }
                        },
                        Tenant2: { class: 'Tenant', Application: { class: 'Application' } }
                    }
                );
            })
            // Manually Patch another new tenant
            .then(() => patch(
                '/mgmt/shared/appsvcs/declare',
                [{
                    op: 'add',
                    path: '/Tenant3',
                    value: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application'
                        }
                    }
                }],
                {
                    logInfo: { patchIndex: 0 }
                }
            ))
            .then((response) => {
                assert.strictEqual(response.body.results.length, 1);
                validateAs3Result(response.body.results[0], 'Tenant3');
            })
            .then(() => getDeclaration())
            .then((response) => {
                // Confirm then Remove random values
                assert.strictEqual(typeof response.controls.archiveTimestamp, 'string');
                assert.strictEqual(typeof response.id, 'string');
                delete response.controls.archiveTimestamp;
                delete response.id;

                assert.deepStrictEqual(
                    response,
                    {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        controls: {
                            class: 'Controls',
                            trace: true,
                            traceResponse: true,
                            logLevel: 'debug'
                        },
                        updateMode: 'selective',
                        Tenant1: {
                            class: 'Tenant',
                            A1: {
                                class: 'Application',
                                web_pool: {
                                    class: 'Pool',
                                    members: [
                                        {
                                            serverAddresses: ['192.0.2.1'],
                                            servicePort: 80
                                        }
                                    ]
                                }
                            }
                        },
                        Tenant2: { class: 'Tenant', Application: { class: 'Application' } },
                        Tenant3: { class: 'Tenant', Application: { class: 'Application' } }
                    }
                );
            });
    });
});

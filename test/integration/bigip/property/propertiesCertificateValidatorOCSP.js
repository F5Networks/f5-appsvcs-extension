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

const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

const CERT_OCSP = 'Certificate_Validator_OCSP';

describe(CERT_OCSP, function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('Default Update', function () {
        const properties = [
            {
                name: 'dnsResolver',
                inputValue: [{ bigip: '/Common/198.168.111.33' }],
                expectedValue: ['/Common/198.168.111.33'],
                extractFunction: (o) => o.dnsResolver.fullPath
            },
            {
                name: 'responderUrl',
                inputValue: [undefined, 'http://cert.ocsp1.localhost.com', 'http://cert.ocsp2.localhost.com'],
                expectedValue: [undefined, 'http://cert.ocsp1.localhost.com', 'http://cert.ocsp2.localhost.com']
            },
            {
                name: 'timeout',
                inputValue: [undefined, 300, 1],
                expectedValue: [8, 300, 1]
            },
            {
                name: 'signingHashAlgorithm',
                inputValue: [undefined, 'sha256', 'sha1'],
                expectedValue: ['sha256', 'sha256', 'sha1'],
                extractFunction: (o) => o.signHash
            },
            {
                name: 'signingCertificate',
                inputValue: [
                    undefined,
                    { use: 'testSignCertKey' },
                    { use: 'testSignCertKeyPassphrase' },
                    { bigip: '/Common/default.crt' }
                ],
                expectedValue: [
                    {
                        certPath: 'none',
                        keyPath: 'none',
                        passphraseSet: false
                    },
                    {
                        certPath: `/TEST_${CERT_OCSP}/Application/testSignCertKey.crt`,
                        keyPath: `/TEST_${CERT_OCSP}/Application/testSignCertKey.key`,
                        passphraseSet: false
                    },
                    {
                        certPath: `/TEST_${CERT_OCSP}/Application/testSignCertKeyPassphrase.crt`,
                        keyPath: `/TEST_${CERT_OCSP}/Application/testSignCertKeyPassphrase.key`,
                        passphraseSet: true
                    },
                    {
                        certPath: '/Common/default.crt',
                        keyPath: '/Common/default.key',
                        passphraseSet: false
                    }
                ],
                referenceObjects: {
                    testSignCertKey: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDSjCCAjKgAwIBAgIEEYGlyTANBgkqhkiG9w0BAQsFADBnMQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxCzAJBgNVBAoTAkY1MREw\nDwYDVQQLEwhEZXYvVGVzdDEZMBcGA1UEAxMQVGVzdCBPQ1NQIFNpZ25lcjAeFw0x\nOTA0MjMxNzU0MTdaFw0yNDA0MjExNzU0MTdaMGcxCzAJBgNVBAYTAlVTMQswCQYD\nVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRsZTELMAkGA1UEChMCRjUxETAPBgNVBAsT\nCERldi9UZXN0MRkwFwYDVQQDExBUZXN0IE9DU1AgU2lnbmVyMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6mUjd2Vsclqv5NDcoPyqW2RDn7bHkCj8zemZ\ntadBNDSsoCNVNu/BAptTBgD4fRHjLlHR6NOIHCzuqnklpEQze4/1SDXL1hkDBmFS\nfon2UKUvpoUWfPjt41auEfTx1DgIHoKqT+0+C5pfCRSLy1JIQBQyh7kYiIbFzYYq\nEND2GNGrHOuX0f58ae4eU/XmAZQVJXfqsyyhak0kLOxU+vIBJpweisZKxa9C7nuX\nLI2nIGIDqexK8C5RrIc0bY2OHn0pEMv1/tYgFYjOqos6/2Sl1/ZXGX/O0kyYmzai\nnkxdM3Ozj/Q9hoLbBn40pl8BhFh6oYl5g/3nhm5Mzr1lQkvPqwIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQDc3ZSvM/aez6S63kKRP79/VE9H37woZ+sDGQkjf5yoz9hm\n+3WnbpYVw93rAbf4lkASFdRvq4ZA9UG7YWUmVKB33vrSxqEttdN7szjOBrfCOmpx\nEvftuvHPOovqkiuVcDIDxoBsmeqhtprppjl+MzaibkFx9UFHLzS0ZXo85BVtwTK+\nMSj4uv9HFT+EpmlsLOZ8PiYTkIxb5FHAArXd2Q3lkHp1n//5bUE5jurBiZqx8N6F\ndVXXIA7ghE7azooDPKBtx4pcsKpyrEdao1G4wiSICyoS/EoxTm9Vd2DybMKymIbq\nzcSE8j03hrI+dqduGxmOxwYDUBSvn9SvLW9SqBGw\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDqZSN3ZWxyWq/k\n0Nyg/KpbZEOftseQKPzN6Zm1p0E0NKygI1U278ECm1MGAPh9EeMuUdHo04gcLO6q\neSWkRDN7j/VINcvWGQMGYVJ+ifZQpS+mhRZ8+O3jVq4R9PHUOAgegqpP7T4Lml8J\nFIvLUkhAFDKHuRiIhsXNhioQ0PYY0asc65fR/nxp7h5T9eYBlBUld+qzLKFqTSQs\n7FT68gEmnB6KxkrFr0Lue5csjacgYgOp7ErwLlGshzRtjY4efSkQy/X+1iAViM6q\nizr/ZKXX9lcZf87STJibNqKeTF0zc7OP9D2GgtsGfjSmXwGEWHqhiXmD/eeGbkzO\nvWVCS8+rAgMBAAECggEAAmDeWELOM+bZrA+2fWey7tR4nzFCmyLfVdON/LrivX3f\nVoylO7Z5Feavk/sEinhY/spTv/INioOmNFKgYCdVAmb2jTIGjHiagEESjjgmKLFU\nZ3MoREJeX5UslQAQSB/9bRnUUpVMsN9zIWt08641D3lk/d2R8yiy7x/yY1NLe/r3\nsc2XecCl2DmUPnYzrl61Q264xEifPNVsikyeB5N26I7HtlQX5d1eHoIJ83TGn3Wp\nBRfxkCe0sOU+iq2f6l8PjI6mbUUaY9J81zaKZpaXK4/MlgEfeM0QNCILHIX4xUQR\nmvVo5uvIQrdIe2IvK5JaFlHI2utC8ppuOt9laGVgQQKBgQD3vW+RHzfEm+gL1YdH\nW82GXPZ3PxWrtjEtNrWhMNMrKyVG475wF14WsKo6tZnPe1DqMBRZt8GjpUZnoTBK\nYyuW/WmO6JvTsm75zvE6/fTpc7ORd987zLJUmAu8cJwkI4hY05m3Aj31cIF4DORs\nrIzpZhghS8kVX9N1f9aqcea2ywKBgQDyNcxgQxbx+6vPfqU6uN+4sKTKc/Cl10Vl\njXF5lfXX5ga244tsmQq7HEPnPtpnh7NeeqCjzhJF22Ru5bUxQUtxHbOiyWqMtGAG\nP4uFJyqJIg8hU/oWUsYmS3IF6YSb5/HyyQ0zn1aJAMwnv1Vpb6eDHXcNRBhikFLq\n0xZbbGNOoQKBgFz/1hPqXisGQ9O9cq0M/1hDKZqWKfJt0IQil4hNJdh8t9+muuSl\nQQLPivfDGFxU9IkVR25ulthxwL5COjiShdiGhMvK8kREJXjNgK0ejIPelTg0ga6X\nJxKuiSlSNKs0U4jU1k1nIA81DsUcQdux4qvzUXeeVXwanuzq8pDFdVCFAoGAWIR+\nx6NdLFxsou1G11ofMPElmHOcvA8bZoy1rti2Owvu4kHwf2TC/jTLQCTBTtrSG7I3\nKQYzuWH/p2O9v118g792GgUAMqHtAfuRMr1olytiWizFlgj0L6Sc7Do2Y3/19WOy\ntm4CAxnOgqwzO9A5aPqIuslrHAJguz8fyZOoC2ECgYEA9Y+Zp+sWjlVtMi9DoewF\nblil86us3/aCT0xFeaTPEEnJqC/Zz3xF6Bxb2B3/JT+2nvlY6ewRebUYAQrkkApM\no8MrB1IiUiot0UsyxhhoGMeOa8EgkvcyGhqK4yMaIgpgZDwX6WN6XiV8bL+bltze\nV5FCB6O5SaXnYIhegxrsfHw=\n-----END PRIVATE KEY-----'
                    },
                    testSignCertKeyPassphrase: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true
                        }
                    }
                },
                extractFunction: (o) => {
                    const certObj = {
                        certPath: 'none',
                        keyPath: 'none',
                        passphraseSet: false
                    };
                    if (o.signerCert) {
                        certObj.certPath = o.signerCert.fullPath;
                        certObj.keyPath = o.signerKey.fullPath;
                        certObj.passphraseSet = !util.isEmptyOrUndefined(o.signerKeyPassphrase);
                    }
                    return certObj;
                }
            }
        ];
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: '198.168.111.33',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                }
            ]
        };
        return assertClass(CERT_OCSP, properties, options);
    });
});

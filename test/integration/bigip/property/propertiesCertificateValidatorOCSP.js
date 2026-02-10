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
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDXjCCAkagAwIBAgIED6B1ETANBgkqhkiG9w0BAQsFADBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwHhcNMTgwNDIzMTgwNjA5WhcNMjgwNDIwMTgwNjA5WjBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC03brx8pCY7my1CW3VEXKcoehIci6d9s6XEySQDRucQU9snY6u39WLLiBa6IFIfvVTAkMvgE3mA3uXXJTMhaOkD1k/iMiZdUGnGsDml6F14hv2PbMY9WufP0+3HYhfJpOOZl/fvK25lNvqFFGV0me5SbOSDIKc47qQBJ4rwPTJ4SeWDEkMSuCgzeuZ3SEW8SxkK4WqppvtlXEI9KnPmscqXAK+QqLrsFNf0rEbJiKFU1Ae0FMgyXuIW6OjnKg9fnozIGuocISHEB4fB6F/ywJshz56jc5SM/w4eDHYP7WYmeMX+ZiKsbp0ULsnyGwKJFkAjL/LuSvMXvkgg20F5PShAgMBAAEwDQYJKoZIhvcNAQELBQADggEBADeNPg3exjVRmsZ6Tcyt3pWdMPGDG5Sbc9hOq6yfEHB205wnWQ1J1oswFUFVKxra4dtei8ToRlaYJP7Dk2J2V4RTk33nt35hdxHDnq4Id6zDtiuWN9D3srjqLpH2RwighXn1Agx/rYAXd0jQGT4genqmHUsK5YMOtHVuR1o3PFphTVfOu4gffrmuBna/YXT1gy9XPeKG0pXnxyV/ejWtXKmUNuFAZtToaiMgCWC6evsi4bpH5qRBI3aqgnGy0YXNDfeaJ8Z9FdNlyK9C6cPiHeZWkfaJHDcxXEbJuC9JQsaH/GLpLGRJ9m3GVXUhxHQGvb/sIXDvaJZYbr9rNZ/XsTw=\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,BC7025CBA1D3347A8BD2BCF84BE65C82\n\nEcDfqRFgYjE9z51ZLf2C3FiLweX/8Bcw//avQcv4LV+gTpenyWCc1Vc8B7qtYghO\nfcLBfIjqpR6xzBLJEabAnEN1vhQ7G+12d8dxJ0IYktOsN9KyVNY6XaE39XWzOIy/\nRJ5FfQtSIatYJ4w7gXY/m2CAdth7ZoUCeaxa0YDRtv/ogd++rXbb1TwkR8JyA1ZF\n8vOPQSoM7arzHMkZTYMF3dM1PsVCAB/z8O3US0ltjwQhK9hpIu/k0Vg9urqw2rG9\nu8fEboUFfQ2UCpjDdA+oR2bBr0ZzzIM15Cqb5vd8LI8bB9mOPBYNoSC01HhDKXpT\n4edzPeYT5PD7vALr2xJxFy4W18cfKKmlY/SOpZTlgGyrdXGK+24QAnRZXyOTftqd\n6+7j0X6mokEgiesDeQF9LZROFI49ZlvoK4bZ+JqrvX2kqgaxEogHS0Txt/ZM7eJF\nz1OZPlVrdPhv5b2rVeKwNkZZ4nyYC2vRfZf5aSAA1TUXNKW1pUSNDNU04D7Priz2\n0OwjWXkVbDEMRQZ/Yy/KRleaBiYv1kuBrK776h/DFjOXw+4Qj6IBeq79LNO/7uFg\nJLUBgtJExQ3NQCB+po+SyuWIkojGh30jmlQ8dmGyoEZ9muWJg/E5mTuRPb/Zvx0Y\nkHl8MvMq+7yOTf0Z1PH30ml7o9EiNniAN87ZHiU2KjrQ10eXAVJCVmQIzUh/1/DI\n4ILnxuUtOEDhi/2aec+CJJtY0Pq4+XzHcYMte6rlKnRBiCdQ0yY87vm60BLtYTI1\n9QRf0WfJeujPMO1gq5sJbxMmwLQXgzy0tv9M5wNqkCcPGofr3zE7C1c/TjjqyDCR\nTnf3KndGrcOiMo+Ney4eC3nxoof2anjhaaE5Xbz0tivDbxQ/tVj/fu9+uogavFHL\nj3T3LOUNkjokenbA6FiPnJdhLogMBBA727pBeZ8kmCQRGDvTFvcCRwjdlt+fhVgI\n+lnrWDejbrsRYDS6jQs4ow4KQ7RnP4Cj2a+waaXh9zVHU231rasUkMKgMA/ND6ME\nb6BZzii89lG8Yl0XURWeq/2jnpASX39VwXVKlDxuOpv2CN8TKgRGGlkBy3FgVccz\nWGlqKBjHDjUAyLUoQq/cwktfgGPMD6BFlx6/5O9QMM4FXHeyl97+5pe7X5cjW/Nh\nCacfDn9iA09uijOfUoGZYknVA55I+PwUJsvH1Con6UC2FMmlDhJ3D0vWIphtERQV\nDu1SLwsgTGjb+EbbzrfuQEYntkonCyInH+BSE+H86oALy6gtxgmpFvv9nY+Zyqha\nl+b6yPZJ0RqoydhUUS5Nze+wckGUspkaaUfz19NLBax4wfl1y6ETaKQpmENBnfqJ\n2B9DA4omaECONsE1gkPkULi1fivq8TTEoFGTbHVURLzqvtf6kFlYwmbGwJh4NR50\nuv5APydh4ax2oyqqnXqbp3JolUT4/h7AyhvLm+H3Lqf4thm6HmWZPpaufCrKXw6y\nUO9Q92aa/FkSaSwhTtseFdh2pUjOdEIZuyLtxNJcmHbj/meK03sa1mjGgKAI5Wp3\nP72lhPQM07Ytk6nt2Fod3rZBCxPueB8ilo7whrM0Wdy7B3I7qqBLpqHeP4vGItYR\n-----END RSA PRIVATE KEY-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true,
                            miniJWE: true,
                            allowReuse: false
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

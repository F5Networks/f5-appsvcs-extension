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

const crypto = require('crypto');
const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');
const oauth = require('../../../common/oauth');

const testResourcesURL = process.env.TEST_RESOURCES_URL;
const extractFunctions = {
    p12(result) {
        const pkcs12 = {};
        const cert = result.find((r) => r.kind === 'tm:sys:file:ssl-cert:ssl-certstate');
        if (cert) {
            pkcs12.certificate = {
                serialNumber: parseInt(cert.serialNumber, 10),
                issuer: cert.issuer,
                checksum: cert.checksum
            };
        }
        return pkcs12;
    },
    privateKey(result) {
        if (!result) {
            return undefined;
        }
        let checksum;
        const key = result.find((r) => r.kind === 'tm:sys:file:ssl-key:ssl-keystate');
        if (key) {
            checksum = key.checksum;
        }
        return checksum;
    },
    passphrase(result) {
        let passphraseSet = false;
        const key = result.find((r) => r.kind === 'tm:sys:file:ssl-key:ssl-keystate');
        if (key) {
            if (key.passphrase || key.securityType === 'password') {
                passphraseSet = true;
            }
        }
        return passphraseSet;
    },
    p12Option() {
        return {};
    }
};

const options = {
    findAll: true
};

describe('Certificate', function () {
    this.timeout(GLOBAL_TIMEOUT);

    let accessToken;

    function assertCertClass(properties) {
        return assertClass('Certificate', properties, options);
    }

    const certValues = [
        '-----BEGIN CERTIFICATE-----\nMIIDoDCCAoigAwIBAgIED1feTjANBgkqhkiG9w0BAQsFADCBkTELMAkGA1UEBhMC\nVVMxCzAJBgNVBAgTAldBMRAwDgYDVQQHEwdTZWF0dGxlMQ0wCwYDVQQKEwRUZXN0\nMRwwGgYDVQQLExNQcm9kdWN0IERldmVsb3BtZW50MQ8wDQYDVQQDFAZteV9zc2wx\nJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI3\nMTYzOTQyWhcNMjgwMjI1MTYzOTQyWjCBkTELMAkGA1UEBhMCVVMxCzAJBgNVBAgT\nAldBMRAwDgYDVQQHEwdTZWF0dGxlMQ0wCwYDVQQKEwRUZXN0MRwwGgYDVQQLExNQ\ncm9kdWN0IERldmVsb3BtZW50MQ8wDQYDVQQDFAZteV9zc2wxJTAjBgkqhkiG9w0B\nCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQC0O9Qg8avVtfTpzEwjjM0e+kwFzjFdMmqMVBs6XIo37FsDjbll\nI+7VznRNJPVfRZbnTmyhtHmkpDG/ojLVg7oPWZOY9Zrn7pO96wQxBGkj3E+/3B+T\nBethgXFSLA4sbAhF3Hn+lXP+QuA4KgtcGHDq1EctwZa0/BS8eQFIiWc5c2PAai9Y\nI/nVbu4EkAhhbgTAMzgUnLeRXfyaqmsHVZOXem1ErQVC7M4qwKw2osYlM7qqCgOj\nK1hLwkd3MOIVcgAcUYEYe78dVFhOKglVATVgZhvAVqyTau7eG1sdSLY5aOgHR+Ck\nHWAacIFKKwCZZr6AGFLqxO7tCyzEimmRCBrrAgMBAAEwDQYJKoZIhvcNAQELBQAD\nggEBAHxDtjfTcwqGFuHy7wVsVTg1Mzwvzf0/MG1dstfr9q3onFMpcuZQ2DXWC0rm\ngT3KHaptM+V3iiq5mMv2pPuK4EacDPQdhWBjw5hsVaRu3V7pAo4LHC4UJ3xufXYz\nLVr8wRVMvTMOCNTR0RQ/k1XvIKG1g1H20P/8ZSPYnu05cfvKbPxf9MD5bNCTTuvV\nhAWA8hrDQ+qlAdYx2Tgv59VVkNEWTRto8TU6orREC5F+OUIq3zQcBYjRzfgi9eH6\n8yLnVUlQQX3j6Y2b+ByxBNyo5JanEFLF2s2ioGKK8u3OilPGxDQCtrcc+TJAX9pN\ndaX/vNi6ZxxPwBQx9HctryxB3cc=\n-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----\nMIIDUjCCAjqgAwIBAgIED1fylDANBgkqhkiG9w0BAQsFADBrMQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3Qx\nHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxEDAOBgNVBAMUB215X3NzbDIw\nHhcNMTgwMjI3MTgwNjEyWhcNMjgwMjI1MTgwNjEyWjBrMQswCQYDVQQGEwJVUzEL\nMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAa\nBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxEDAOBgNVBAMUB215X3NzbDIwggEi\nMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJlyIudQpecT+2tfNglb8bhQbX\ne+d5S0UvAGYNGMDXTb8X3/Y/pyo5A7K+Kc5tZ6ZFW7Tjm3Su9dNxA8teh6iDIW20\nQuj7dL2Oh3YbJuEk/aLHLy1VMgoLLm7AW0Shx8wnZ8WVX0G3vD11ZfHtOyGavvyg\nKyaA/Fo7XSWOf/nlkwVtIFAdwDxqZn+dStOslFnbyzKTupp3Ep6lWMH4U8mTIq9q\n7wlNw1CFQR86IkIRfex58SlOph58L0STPzTN4lPEC7VPMhi1/DH/nese5bbZz6VE\nDaS4n07Tmq6EVqBQxB/zEerLagVahzPBvtYsBw+qkiZWUA18XTaGB8/D0dx/AgMB\nAAEwDQYJKoZIhvcNAQELBQADggEBAAzZ/sDmcWEPcbjGhjB+PxQ82OeuAcVF3SJz\nNldCeag2Ohj1mld+AFCQW32qiKjgMmTHNwlS1biNJ0CzqkPSwJ57kuHyrpXd9iFm\n5uW1metsSSOQ8r+kOUlBMmvqcUb2VgzlpLclATMU0Pq76+bx0THi/v8Q57LjqcOJ\nhtLvvLggyKpyGxhFT/3QY/vGvFm231wJk3vziP//JGA5tapeRZ5iTwfIzeoN/Nmi\nNLWKjyYmNLu00TRxNki2D+z4XVl+hhJ4EcDPfRRwXgLv6uEmOpeRAeN2y5OtLrVJ\nxzFHVXv2f7iUOTQq/tCxmftQGc0KTFpL5GCM6tNI+Otci31xZBM=\n-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----\n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\n-----END CERTIFICATE-----'
    ];
    const certChecksums = [];
    for (let i = 0; i < certValues.length; i += 1) {
        const certHash = crypto.createHash('sha1');
        certHash.update(certValues[i]);
        certChecksums[i] = `SHA1:${certValues[i].length}:${certHash.digest('hex')}`;
    }
    const privateKeyValue = '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,BC7025CBA1D3347A8BD2BCF84BE65C82\n\nEcDfqRFgYjE9z51ZLf2C3FiLweX/8Bcw//avQcv4LV+gTpenyWCc1Vc8B7qtYghO\nfcLBfIjqpR6xzBLJEabAnEN1vhQ7G+12d8dxJ0IYktOsN9KyVNY6XaE39XWzOIy/\nRJ5FfQtSIatYJ4w7gXY/m2CAdth7ZoUCeaxa0YDRtv/ogd++rXbb1TwkR8JyA1ZF\n8vOPQSoM7arzHMkZTYMF3dM1PsVCAB/z8O3US0ltjwQhK9hpIu/k0Vg9urqw2rG9\nu8fEboUFfQ2UCpjDdA+oR2bBr0ZzzIM15Cqb5vd8LI8bB9mOPBYNoSC01HhDKXpT\n4edzPeYT5PD7vALr2xJxFy4W18cfKKmlY/SOpZTlgGyrdXGK+24QAnRZXyOTftqd\n6+7j0X6mokEgiesDeQF9LZROFI49ZlvoK4bZ+JqrvX2kqgaxEogHS0Txt/ZM7eJF\nz1OZPlVrdPhv5b2rVeKwNkZZ4nyYC2vRfZf5aSAA1TUXNKW1pUSNDNU04D7Priz2\n0OwjWXkVbDEMRQZ/Yy/KRleaBiYv1kuBrK776h/DFjOXw+4Qj6IBeq79LNO/7uFg\nJLUBgtJExQ3NQCB+po+SyuWIkojGh30jmlQ8dmGyoEZ9muWJg/E5mTuRPb/Zvx0Y\nkHl8MvMq+7yOTf0Z1PH30ml7o9EiNniAN87ZHiU2KjrQ10eXAVJCVmQIzUh/1/DI\n4ILnxuUtOEDhi/2aec+CJJtY0Pq4+XzHcYMte6rlKnRBiCdQ0yY87vm60BLtYTI1\n9QRf0WfJeujPMO1gq5sJbxMmwLQXgzy0tv9M5wNqkCcPGofr3zE7C1c/TjjqyDCR\nTnf3KndGrcOiMo+Ney4eC3nxoof2anjhaaE5Xbz0tivDbxQ/tVj/fu9+uogavFHL\nj3T3LOUNkjokenbA6FiPnJdhLogMBBA727pBeZ8kmCQRGDvTFvcCRwjdlt+fhVgI\n+lnrWDejbrsRYDS6jQs4ow4KQ7RnP4Cj2a+waaXh9zVHU231rasUkMKgMA/ND6ME\nb6BZzii89lG8Yl0XURWeq/2jnpASX39VwXVKlDxuOpv2CN8TKgRGGlkBy3FgVccz\nWGlqKBjHDjUAyLUoQq/cwktfgGPMD6BFlx6/5O9QMM4FXHeyl97+5pe7X5cjW/Nh\nCacfDn9iA09uijOfUoGZYknVA55I+PwUJsvH1Con6UC2FMmlDhJ3D0vWIphtERQV\nDu1SLwsgTGjb+EbbzrfuQEYntkonCyInH+BSE+H86oALy6gtxgmpFvv9nY+Zyqha\nl+b6yPZJ0RqoydhUUS5Nze+wckGUspkaaUfz19NLBax4wfl1y6ETaKQpmENBnfqJ\n2B9DA4omaECONsE1gkPkULi1fivq8TTEoFGTbHVURLzqvtf6kFlYwmbGwJh4NR50\nuv5APydh4ax2oyqqnXqbp3JolUT4/h7AyhvLm+H3Lqf4thm6HmWZPpaufCrKXw6y\nUO9Q92aa/FkSaSwhTtseFdh2pUjOdEIZuyLtxNJcmHbj/meK03sa1mjGgKAI5Wp3\nP72lhPQM07Ytk6nt2Fod3rZBCxPueB8ilo7whrM0Wdy7B3I7qqBLpqHeP4vGItYR\n-----END RSA PRIVATE KEY-----';
    const privateKeyHash = crypto.createHash('sha1');
    privateKeyHash.update(privateKeyValue);
    const privateKeyChecksum = `SHA1:${privateKeyValue.length}:${privateKeyHash.digest('hex')}`;

    const chainCAValue = '-----BEGIN CERTIFICATE-----\nMIIDoDCCAoigAwIBAgIED1feTjANBgkqhkiG9w0BAQsFADCBkTELMAkGA1UEBhMC\nVVMxCzAJBgNVBAgTAldBMRAwDgYDVQQHEwdTZWF0dGxlMQ0wCwYDVQQKEwRUZXN0\nMRwwGgYDVQQLExNQcm9kdWN0IERldmVsb3BtZW50MQ8wDQYDVQQDFAZteV9zc2wx\nJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI3\nMTYzOTQyWhcNMjgwMjI1MTYzOTQyWjCBkTELMAkGA1UEBhMCVVMxCzAJBgNVBAgT\nAldBMRAwDgYDVQQHEwdTZWF0dGxlMQ0wCwYDVQQKEwRUZXN0MRwwGgYDVQQLExNQ\ncm9kdWN0IERldmVsb3BtZW50MQ8wDQYDVQQDFAZteV9zc2wxJTAjBgkqhkiG9w0B\nCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQC0O9Qg8avVtfTpzEwjjM0e+kwFzjFdMmqMVBs6XIo37FsDjbll\nI+7VznRNJPVfRZbnTmyhtHmkpDG/ojLVg7oPWZOY9Zrn7pO96wQxBGkj3E+/3B+T\nBethgXFSLA4sbAhF3Hn+lXP+QuA4KgtcGHDq1EctwZa0/BS8eQFIiWc5c2PAai9Y\nI/nVbu4EkAhhbgTAMzgUnLeRXfyaqmsHVZOXem1ErQVC7M4qwKw2osYlM7qqCgOj\nK1hLwkd3MOIVcgAcUYEYe78dVFhOKglVATVgZhvAVqyTau7eG1sdSLY5aOgHR+Ck\nHWAacIFKKwCZZr6AGFLqxO7tCyzEimmRCBrrAgMBAAEwDQYJKoZIhvcNAQELBQAD\nggEBAHxDtjfTcwqGFuHy7wVsVTg1Mzwvzf0/MG1dstfr9q3onFMpcuZQ2DXWC0rm\ngT3KHaptM+V3iiq5mMv2pPuK4EacDPQdhWBjw5hsVaRu3V7pAo4LHC4UJ3xufXYz\nLVr8wRVMvTMOCNTR0RQ/k1XvIKG1g1H20P/8ZSPYnu05cfvKbPxf9MD5bNCTTuvV\nhAWA8hrDQ+qlAdYx2Tgv59VVkNEWTRto8TU6orREC5F+OUIq3zQcBYjRzfgi9eH6\n8yLnVUlQQX3j6Y2b+ByxBNyo5JanEFLF2s2ioGKK8u3OilPGxDQCtrcc+TJAX9pN\ndaX/vNi6ZxxPwBQx9HctryxB3cc=\n-----END CERTIFICATE-----';
    const chainCAHash = crypto.createHash('sha1');
    chainCAHash.update(chainCAValue);
    const chainCAChecksum = `SHA1:${chainCAValue.length}:${chainCAHash.digest('hex')}`;

    it('DefaultUpdateCert', () => {
        const properties = [
            {
                name: 'certificate',
                inputValue: [certValues[0], certValues[1], certValues[0]],
                expectedValue: [certChecksums[0], certChecksums[1], certChecksums[0]],
                extractFunction: (o) => {
                    if (o[0].name.includes('bundle')) {
                        return o[1].checksum;
                    }
                    return o[0].checksum;
                }
            },
            {
                name: 'privateKey',
                inputValue: [undefined, privateKeyValue, undefined],
                expectedValue: [undefined, privateKeyChecksum, undefined],
                extractFunction: extractFunctions.privateKey
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true,
                        miniJWE: true,
                        allowReuse: false
                    },
                    undefined
                ],
                expectedValue: [false, true, false],
                extractFunction: extractFunctions.passphrase
            },
            {
                name: 'chainCA',
                inputValue: [undefined, chainCAValue, undefined],
                expectedValue: [undefined, chainCAChecksum, undefined],
                extractFunction: (o) => {
                    if (o.length > 1) {
                        return o[0].checksum;
                    }
                    return undefined;
                }
            }
        ];

        return assertCertClass(properties);
    });

    it('base64 certificate', () => {
        const base64Values = certValues.map((certValue) => ({
            base64: Buffer.from(certValue).toString('base64')
        }));

        const properties = [
            {
                name: 'certificate',
                inputValue: [base64Values[0], base64Values[1], base64Values[0]],
                expectedValue: [certChecksums[0], certChecksums[1], certChecksums[0]],
                extractFunction: (o) => {
                    if (o[0].name.includes('bundle')) {
                        return o[1].checksum;
                    }
                    return o[0].checksum;
                }
            },
            {
                name: 'privateKey',
                inputValue: [undefined, { base64: Buffer.from(privateKeyValue).toString('base64') }, undefined],
                expectedValue: [undefined, privateKeyChecksum, undefined],
                extractFunction: extractFunctions.privateKey
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true,
                        miniJWE: true,
                        allowReuse: false
                    },
                    undefined
                ],
                expectedValue: [false, true, false],
                extractFunction: extractFunctions.passphrase
            }
        ];

        return assertCertClass(properties);
    });

    it('chainCA with use', () => {
        const properties = [
            {
                name: 'chainCA',
                inputValue: [undefined, { use: 'ca_example_bundle' }, undefined],
                expectedValue: [undefined, 'SHA1:1317:b8c8e1f56ed66e3cc75d7aa6e767953ab67de057', undefined],
                extractFunction: (o) => {
                    if (o.length > 1) {
                        return o[0].checksum;
                    }
                    return undefined;
                },
                referenceObjects: {
                    ca_example_bundle: {
                        class: 'CA_Bundle',
                        bundle: '-----BEGIN CERTIFICATE-----\nMIIFLTCCBBWgAwIBAgIMYaHn0gAAAABR02amMA0GCSqGSIb3DQEBCwUAMIG+MQswCQYDVQQGEwJVUzEWMBQGA1UEChMNRW50cnVzdCwgSW5jLjEoMCYGA1UECxMfU2VlIHd3dy5lbnRydXN0Lm5ldC9sZWdhbC10ZXJtczE5MDcGA1UECxMwKGMpIDIwMDkgRW50cnVzdCwgSW5jLiAtIGZvciBhdXRob3JpemVkIHVzZSBvbmx5MTIwMAYDVQQDEylFbnRydXN0IFJvb3QgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkgLSBHMjAeFw0xNDEyMTUxNTI1MDNaFw0zMDEwMTUxNTU1MDNaMIG6MQswCQYDVQQGEwJVUzEWMBQGA1UEChMNRW50cnVzdCwgSW5jLjEoMCYGA1UECxMfU2VlIHd3dy5lbnRydXN0Lm5ldC9sZWdhbC10ZXJtczE5MDcGA1UECxMwKGMpIDIwMTQgRW50cnVzdCwgSW5jLiAtIGZvciBhdXRob3JpemVkIHVzZSBvbmx5MS4wLAYDVQQDEyVFbnRydXN0IENlcnRpZmljYXRpb24gQXV0aG9yaXR5IC0gTDFNMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0IHBOSPCsdHs91fdVSQ2kSAiSPf8ylIKsKs/M7WwhAf23056sPuYIj0BrFb7cW2y7rmgD1J3q5iTvjOK64dex6qwymmPQwhqPyK/MzlG1ZTy4kwFItlngJHxBEoOm3yiydJs/TwJhL39axSagR3nioPvYRZ1R5gTOw2QFpi/iuInMlOZmcP7lhw192LtjL1JcdJDQ6Gh4yEqI3CodT2ybEYGYW8YZ+QpfrI8wcVfCR5uRE7sIZlYFUj0VUgqtzS0BeN8SYwAWN46lsw53GEzVc4qLj/RmWLoquY0djGqr3kplnjLgRSvadr7BLlZg0SqCU+01CwBnZuUMWstoc/B5QIDAQABo4IBKzCCAScwDgYDVR0PAQH/BAQDAgEGMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATASBgNVHRMBAf8ECDAGAQH/AgEAMDMGCCsGAQUFBwEBBCcwJTAjBggrBgEFBQcwAYYXaHR0cDovL29jc3AuZW50cnVzdC5uZXQwMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL2NybC5lbnRydXN0Lm5ldC9nMmNhLmNybDA7BgNVHSAENDAyMDAGBFUdIAAwKDAmBggrBgEFBQcCARYaaHR0cDovL3d3dy5lbnRydXN0Lm5ldC9ycGEwHQYDVR0OBBYEFMP30LUqMK2vDZEhcDlU3byJcMc6MB8GA1UdIwQYMBaAFGpyJnrQHu995ztpUdRsjZ+QEmarMA0GCSqGSIb3DQEBCwUAA4IBAQC0h8eEIhopwKR47PVPG7SEl2937tTPWa+oQ5YvHVjepvMVWy7ZQ5xMQrkXFxGttLFBx2YMIoYFp7Qi+8VoaIqIMthx1hGOjlJ+Qgld2dnADizvRGsf2yS89byxqsGK5Wbb0CTz34mmi/5e0FC6m3UAyQhKS3Q/WFOv9rihbISYJnz8/DVRZZgeO2x28JkPxLkJ1YXYJKd/KsLak0tkuHB8VCnTglTVz6WUwzOeTTRn4Dh2ZgCN0C/GqwmqcvrOLzWJ/MDtBgO334wlV/H77yiI2YIowAQPlIFpI+CRKMVe1QzX1CA778n4wI+nQc1XRG5sZ2L+hN/nYNjvv9QiHg3n\n-----END CERTIFICATE-----'
                    }
                }
            },
            {
                name: 'privateKey',
                inputValue: [undefined, privateKeyValue, undefined],
                expectedValue: [undefined, privateKeyChecksum, undefined],
                extractFunction: extractFunctions.privateKey
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true,
                        miniJWE: true,
                        allowReuse: false
                    },
                    undefined
                ],
                expectedValue: [false, true, false],
                extractFunction: extractFunctions.passphrase
            },
            {
                name: 'certificate',
                inputValue: [certValues[0]],
                expectedValue: [certChecksums[0]],
                extractFunction: (o) => {
                    if (o[0].name.includes('bundle')) {
                        return o[1].checksum;
                    }
                    return o[0].checksum;
                }
            }
        ];

        return assertCertClass(properties);
    });

    it('staplerOCSP', function () {
        options.bigipItems = [
            {
                endpoint: '/mgmt/tm/net/dns-resolver',
                data: {
                    name: '198.168.111.33',
                    partition: 'Common',
                    routeDomain: '/Common/0'
                }
            },
            {
                endpoint: '/mgmt/shared/file-transfer/uploads/testExistingCert.crt',
                data: '-----BEGIN CERTIFICATE-----\nMIIFLTCCBBWgAwIBAgIMYaHn0gAAAABR02amMA0GCSqGSIb3DQEBCwUAMIG+MQsw\nCQYDVQQGEwJVUzEWMBQGA1UEChMNRW50cnVzdCwgSW5jLjEoMCYGA1UECxMfU2Vl\nIHd3dy5lbnRydXN0Lm5ldC9sZWdhbC10ZXJtczE5MDcGA1UECxMwKGMpIDIwMDkg\nRW50cnVzdCwgSW5jLiAtIGZvciBhdXRob3JpemVkIHVzZSBvbmx5MTIwMAYDVQQD\nEylFbnRydXN0IFJvb3QgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkgLSBHMjAeFw0x\nNDEyMTUxNTI1MDNaFw0zMDEwMTUxNTU1MDNaMIG6MQswCQYDVQQGEwJVUzEWMBQG\nA1UEChMNRW50cnVzdCwgSW5jLjEoMCYGA1UECxMfU2VlIHd3dy5lbnRydXN0Lm5l\ndC9sZWdhbC10ZXJtczE5MDcGA1UECxMwKGMpIDIwMTQgRW50cnVzdCwgSW5jLiAt\nIGZvciBhdXRob3JpemVkIHVzZSBvbmx5MS4wLAYDVQQDEyVFbnRydXN0IENlcnRp\nZmljYXRpb24gQXV0aG9yaXR5IC0gTDFNMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\nMIIBCgKCAQEA0IHBOSPCsdHs91fdVSQ2kSAiSPf8ylIKsKs/M7WwhAf23056sPuY\nIj0BrFb7cW2y7rmgD1J3q5iTvjOK64dex6qwymmPQwhqPyK/MzlG1ZTy4kwFItln\ngJHxBEoOm3yiydJs/TwJhL39axSagR3nioPvYRZ1R5gTOw2QFpi/iuInMlOZmcP7\nlhw192LtjL1JcdJDQ6Gh4yEqI3CodT2ybEYGYW8YZ+QpfrI8wcVfCR5uRE7sIZlY\nFUj0VUgqtzS0BeN8SYwAWN46lsw53GEzVc4qLj/RmWLoquY0djGqr3kplnjLgRSv\nadr7BLlZg0SqCU+01CwBnZuUMWstoc/B5QIDAQABo4IBKzCCAScwDgYDVR0PAQH/\nBAQDAgEGMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATASBgNVHRMBAf8E\nCDAGAQH/AgEAMDMGCCsGAQUFBwEBBCcwJTAjBggrBgEFBQcwAYYXaHR0cDovL29j\nc3AuZW50cnVzdC5uZXQwMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL2NybC5lbnRy\ndXN0Lm5ldC9nMmNhLmNybDA7BgNVHSAENDAyMDAGBFUdIAAwKDAmBggrBgEFBQcC\nARYaaHR0cDovL3d3dy5lbnRydXN0Lm5ldC9ycGEwHQYDVR0OBBYEFMP30LUqMK2v\nDZEhcDlU3byJcMc6MB8GA1UdIwQYMBaAFGpyJnrQHu995ztpUdRsjZ+QEmarMA0G\nCSqGSIb3DQEBCwUAA4IBAQC0h8eEIhopwKR47PVPG7SEl2937tTPWa+oQ5YvHVje\npvMVWy7ZQ5xMQrkXFxGttLFBx2YMIoYFp7Qi+8VoaIqIMthx1hGOjlJ+Qgld2dnA\nDizvRGsf2yS89byxqsGK5Wbb0CTz34mmi/5e0FC6m3UAyQhKS3Q/WFOv9rihbISY\nJnz8/DVRZZgeO2x28JkPxLkJ1YXYJKd/KsLak0tkuHB8VCnTglTVz6WUwzOeTTRn\n4Dh2ZgCN0C/GqwmqcvrOLzWJ/MDtBgO334wlV/H77yiI2YIowAQPlIFpI+CRKMVe\n1QzX1CA778n4wI+nQc1XRG5sZ2L+hN/nYNjvv9QiHg3n\n-----END CERTIFICATE-----\n',
                headers: {
                    'Content-Range': '0-1853/1854',
                    'Content-Type': 'application/octet-stream'
                }
            },
            {
                endpoint: '/mgmt/tm/sys/crypto/cert',
                data: {
                    command: 'install',
                    name: 'testExistingCert.crt',
                    partition: 'Common',
                    'from-local-file': '/var/config/rest/downloads/testExistingCert.crt'
                }
            }
        ];
        const properties = [
            {
                name: 'certificate',
                inputValue: [
                    '-----BEGIN CERTIFICATE-----\nMIIHaDCCBlCgAwIBAgIQdcpDuACQkFYAAAAAVM+HXjANBgkqhkiG9w0BAQsFADCBujELMAkGA1UEBhMCVVMxFjAUBgNVBAoTDUVudHJ1c3QsIEluYy4xKDAmBgNVBAsTH1NlZSB3d3cuZW50cnVzdC5uZXQvbGVnYWwtdGVybXMxOTA3BgNVBAsTMChjKSAyMDE0IEVudHJ1c3QsIEluYy4gLSBmb3IgYXV0aG9yaXplZCB1c2Ugb25seTEuMCwGA1UEAxMlRW50cnVzdCBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eSAtIEwxTTAeFw0xOTAzMDYyMjA3NTRaFw0yMDAxMTIyMjM3NTJaMIHPMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHU2VhdHRsZTETMBEGCysGAQQBgjc8AgEDEwJVUzEbMBkGCysGAQQBgjc8AgECEwpXYXNoaW5ndG9uMRgwFgYDVQQKEw9GNSBOZXR3b3JrcyBJbmMxHTAbBgNVBA8TFFByaXZhdGUgT3JnYW5pemF0aW9uMRIwEAYDVQQFEwk2MDE2OTI0OTIxGjAYBgNVBAMTEWF1dGhvci13d3cuZjUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuoZcIQyfZHQzb0sdEOctXYOvg1bZ8FEM1UhMtK5Do4oDFMjh5qGKCb9p3YX57S6WE7UcQ2aEA45t38tsFx3YgLYtqo9DB6pkv6AYNiCvVboWLe2ZaWPKaohaJPEk9rdHCeYHPUh7PMbV4aNJUONX4jHKzlhXID0j6y17HcGWMv9rM7fib20yuJWLZ6Mxu5vPmu+sHUXWbdrIpEYM1LU0tRC0ymz3WYdp3+6QGxtL5rhl12iXPjYM/YRRo3vxd9K4FuGk00F5gdkgyxU8LMzmdhqHhqPPDqWizsdAv6FgHEUZ2d4dJcn0jRC2eNZkbi4EaJBWcx0pGu1rxl7l9c05aQIDAQABo4IDUTCCA00wbgYDVR0RBGcwZYIRYXV0aG9yLXd3dy5mNS5jb22CD3BhcnRuZXJzLmY1LmNvbYIRZGV2Y2VudHJhbC5mNS5jb22CCnd3dy5mNS5jb22CD3d3dy10ZW1wLmY1LmNvbYIPdGVjaGRvY3MuZjUuY29tMIIBfgYKKwYBBAHWeQIEAgSCAW4EggFqAWgAdgCHdb/nWXz4jEOZX73zbv9WjUdWNv9KtWDBtOr/XqCDDwAAAWlVJ/QEAAAEAwBHMEUCIFiz1MfByAMSI5zz6BrmPKyrmhjiJBjo5Vcjq7RUsN0GAiEA001Njbwau6WpV0VlEkPk4lfvmzYGCCW5V3fA+rgHjIYAdQBVgdTCFpA2AUrqC5tXPFPwwOQ4eHAlCBcvo6odBxPTDAAAAWlVJ/QdAAAEAwBGMEQCIGl+hkuMbB9QIXkFIyfPKEZ8uW3LPBhwekJHgpmVh0MsAiBjA6CRI6F1qwUvDx3dH1bw8aKoNqDXImifpk/zuifcBQB3ALvZ37wfinG1k5Qjl6qSe0c4V5UKq1LoGpCWZDaOHtGFAAABaVUn9DMAAAQDAEgwRgIhAL339KoEh1ic4fnXnWs5UtrYN+Jg5k3qSwI1nbgBVve9AiEAwPN+1DhNbGP/AHu+S+H+8eTAH5gjlPoMW5UI/qJNxggwDgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMBMGgGCCsGAQUFBwEBBFwwWjAjBggrBgEFBQcwAYYXaHR0cDovL29jc3AuZW50cnVzdC5uZXQwMwYIKwYBBQUHMAKGJ2h0dHA6Ly9haWEuZW50cnVzdC5uZXQvbDFtLWNoYWluMjU2LmNlcjAzBgNVHR8ELDAqMCigJqAkhiJodHRwOi8vY3JsLmVudHJ1c3QubmV0L2xldmVsMW0uY3JsMEoGA1UdIARDMEEwNgYKYIZIAYb6bAoBAjAoMCYGCCsGAQUFBwIBFhpodHRwOi8vd3d3LmVudHJ1c3QubmV0L3JwYTAHBgVngQwBATAfBgNVHSMEGDAWgBTD99C1KjCtrw2RIXA5VN28iXDHOjAdBgNVHQ4EFgQUQCDntrHPGlC5Q542ACpx4BKORPQwCQYDVR0TBAIwADANBgkqhkiG9w0BAQsFAAOCAQEAKVfhJ7jZ1/833HXQ1g/g19EIktbEmjexxysiqa9RNnUVrmHsFQ/kLwiNakEpElJZUgpFaPkFUUKaOuHq895gdEdyBVwimwi6CGH2VjIQlubzOHbZ2YpDABEjtBLLvfPkEkB4DFAwHXnIsG5RhIIzzBQnPVp239S/G9oBDFxGtCiP5kgn2BUUomgBtm5FsioNRAHhiq3JbLhtJzQOjHqYCS8lC/QtrRJaDG4Lpy9OLZ1Te7dsB5IAyaX/eWPA2E/JKIU3YwPoyc2qagS7XFv1opZweAgGfIyi3kzJwF88e8RScYq7xL+GIpJM8Em2l/Lb5ZVT2Sm2Bfis76Y64Gxlig==\n-----END CERTIFICATE-----'
                ],
                skipAssert: true
            },
            {
                name: 'chainCA',
                inputValue: [
                    chainCAValue
                ],
                skipAssert: true
            },
            {
                name: 'staplerOCSP',
                inputValue: [
                    undefined,
                    {
                        use: 'ocsp'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'ocsp',
                    undefined
                ],
                referenceObjects: {
                    ocsp: {
                        class: 'Certificate_Validator_OCSP',
                        dnsResolver: {
                            bigip: '/Common/198.168.111.33'
                        }
                    }
                },
                extractFunction: (o) => {
                    // Since we're adding chainCA to upload, we're going to have a list of 2 objects.
                    // First one is bundle(shouldn't have OCSP) and second is cert.
                    // So checking second one for properties.
                    const result = o[1].certValidationOptions ? o[1].certValidationOptions[0] : undefined;
                    return result;
                }
            },
            {
                name: 'issuerCertificate',
                inputValue: [
                    undefined,
                    {
                        bigip: '/Common/testExistingCert.crt'
                    },
                    {
                        use: 'testNewCert'
                    }
                ],
                expectedValue: [
                    undefined,
                    'testExistingCert.crt',
                    'testNewCert.crt'
                ],
                referenceObjects: {
                    testNewCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIFLTCCBBWgAwIBAgIMYaHn0gAAAABR02amMA0GCSqGSIb3DQEBCwUAMIG+MQswCQYDVQQGEwJVUzEWMBQGA1UEChMNRW50cnVzdCwgSW5jLjEoMCYGA1UECxMfU2VlIHd3dy5lbnRydXN0Lm5ldC9sZWdhbC10ZXJtczE5MDcGA1UECxMwKGMpIDIwMDkgRW50cnVzdCwgSW5jLiAtIGZvciBhdXRob3JpemVkIHVzZSBvbmx5MTIwMAYDVQQDEylFbnRydXN0IFJvb3QgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkgLSBHMjAeFw0xNDEyMTUxNTI1MDNaFw0zMDEwMTUxNTU1MDNaMIG6MQswCQYDVQQGEwJVUzEWMBQGA1UEChMNRW50cnVzdCwgSW5jLjEoMCYGA1UECxMfU2VlIHd3dy5lbnRydXN0Lm5ldC9sZWdhbC10ZXJtczE5MDcGA1UECxMwKGMpIDIwMTQgRW50cnVzdCwgSW5jLiAtIGZvciBhdXRob3JpemVkIHVzZSBvbmx5MS4wLAYDVQQDEyVFbnRydXN0IENlcnRpZmljYXRpb24gQXV0aG9yaXR5IC0gTDFNMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0IHBOSPCsdHs91fdVSQ2kSAiSPf8ylIKsKs/M7WwhAf23056sPuYIj0BrFb7cW2y7rmgD1J3q5iTvjOK64dex6qwymmPQwhqPyK/MzlG1ZTy4kwFItlngJHxBEoOm3yiydJs/TwJhL39axSagR3nioPvYRZ1R5gTOw2QFpi/iuInMlOZmcP7lhw192LtjL1JcdJDQ6Gh4yEqI3CodT2ybEYGYW8YZ+QpfrI8wcVfCR5uRE7sIZlYFUj0VUgqtzS0BeN8SYwAWN46lsw53GEzVc4qLj/RmWLoquY0djGqr3kplnjLgRSvadr7BLlZg0SqCU+01CwBnZuUMWstoc/B5QIDAQABo4IBKzCCAScwDgYDVR0PAQH/BAQDAgEGMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATASBgNVHRMBAf8ECDAGAQH/AgEAMDMGCCsGAQUFBwEBBCcwJTAjBggrBgEFBQcwAYYXaHR0cDovL29jc3AuZW50cnVzdC5uZXQwMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL2NybC5lbnRydXN0Lm5ldC9nMmNhLmNybDA7BgNVHSAENDAyMDAGBFUdIAAwKDAmBggrBgEFBQcCARYaaHR0cDovL3d3dy5lbnRydXN0Lm5ldC9ycGEwHQYDVR0OBBYEFMP30LUqMK2vDZEhcDlU3byJcMc6MB8GA1UdIwQYMBaAFGpyJnrQHu995ztpUdRsjZ+QEmarMA0GCSqGSIb3DQEBCwUAA4IBAQC0h8eEIhopwKR47PVPG7SEl2937tTPWa+oQ5YvHVjepvMVWy7ZQ5xMQrkXFxGttLFBx2YMIoYFp7Qi+8VoaIqIMthx1hGOjlJ+Qgld2dnADizvRGsf2yS89byxqsGK5Wbb0CTz34mmi/5e0FC6m3UAyQhKS3Q/WFOv9rihbISYJnz8/DVRZZgeO2x28JkPxLkJ1YXYJKd/KsLak0tkuHB8VCnTglTVz6WUwzOeTTRn4Dh2ZgCN0C/GqwmqcvrOLzWJ/MDtBgO334wlV/H77yiI2YIowAQPlIFpI+CRKMVe1QzX1CA778n4wI+nQc1XRG5sZ2L+hN/nYNjvv9QiHg3n\n-----END CERTIFICATE-----'
                    }
                },
                extractFunction: (o) => {
                    // Since we're adding chainCA to upload, we're going to have a list of 2 objects.
                    // First one is bundle(shouldn't have OCSP) and second is cert.
                    // So checking second one for properties.
                    if (o[1].issuerCert) {
                        return o[1].issuerCert.split('/').pop();
                    }
                    return undefined;
                }
            }
        ];

        return assertCertClass(properties);
    });

    before(() => {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    it('url', function () {
        const properties = [
            {
                name: 'certificate',
                inputValue: [
                    certValues[0],
                    {
                        url: {
                            url: `https://${testResourcesURL}/certs/cert`
                        }
                    },
                    certValues[0]
                ],
                expectedValue: [
                    certChecksums[0],
                    'SHA1:1853:aef1bb500533aa375a79c1596e4bfd1cbc3fd27a',
                    certChecksums[0]
                ],
                extractFunction: (o) => {
                    if (o[0].name.includes('bundle')) {
                        return o[1].checksum;
                    }
                    return o[0].checksum;
                }
            },
            {
                name: 'privateKey',
                inputValue: [
                    undefined,
                    {
                        url: {
                            url: `https://${testResourcesURL}/certs/key`
                        }
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'SHA1:1766:124bc1d586f259496cdbe11232a6a7a85a54fca6',
                    undefined
                ],
                extractFunction: extractFunctions.privateKey
            }
        ];

        if (process.env.TEST_IN_AZURE === 'true') {
            properties[0].inputValue[1].url.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
            properties[1].inputValue[1].url.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        return assertCertClass(properties);
    });
});

describe('Certificate - PKCS12', function () {
    this.timeout(GLOBAL_TIMEOUT);

    const p12s = {
        crtOpenssl: {
            pkcs12String: 'MIIEdAIBAzCCBDoGCSqGSIb3DQEHAaCCBCsEggQnMIIEIzCCBB8GCSqGSIb3DQEHBqCCBBAwggQMAgEAMIIEBQYJKoZIhvcNAQcBMBwGCiqGSIb3DQEMAQYwDgQIMFpvfHSvJ6sCAggAgIID2PQxcEhhEPgU+sTVw9UncA+U0QYK2/JWQAzfxfD30uR9hXMdFnCF8wJcuUL+4jR+xnrJ9i+F5mISD8zLPipCLs3JuBDGQ8CibTMjcbm54eEzcX6knoQ8r6WZh8tXL+Dniwsnl7FrTwE6br+V/1LQvc03NepYA+xDPgHCOj1qfIcqMyylsf7ZyqYp76nmlv2tkcQrM/f+hcA9UtDuseeRae4ugx5IKkrcIAVYPMfCwRSPkGFWJJofHZaCzeCT4Nq5+ocljogAlqtWSH9nIGEsYxDCrhj3qgZNAPODa1vfnMna3/1md4oRuqI5qe7UQF6e/eltAunZDUtT1vTW+O3vyt3Bqfl18moXocUOuVVi7CNejcA0+IhqryrkI3w4aIXxWVmZ4tl/El/OSjXCRMs+tnTwRZjiCd1dPnKJHjesygupnS4rHus31dQKMmxjyKVrhsl3N+oopbGVWAlaR7p/0DyTdUywBrExyi/c7QvVN/0D08F1TRed4ys3/AVl43dvM9IFGm+ZwsvYyBhRmYn/oL5Dr5u5/jHFhPrWTR35sE5uvcYsJR96hmMqxN57K95MggRcthsrdIvDN+86pqifZoVPTmezFgRuO7NfzhCj/uOd1l61dOKbFNT5DuE5DoyJ8IaVnTJvZ4CAq3O2Ix62LVw0t/lM7AXhkak52LsyJ8VGcaK8R9PhM/X0CYGoRgWyPzJ3GGNX6s9Pw6rV6k5gtYkUagElrsJbcmfabEMZAGwIsVmOpaxdpyuaoo2TR+tz/E1FasC9K3aJ0cEwt6Cm9/tW4qEsb65TBm7C2kXNglUHEmrxndVfMVzKG2dkxUhvJdqw3BxcPukjzk4lpBv2YrTeJs4+y+aRn7F7GUrR4r9Z903ZTbu2DiOEbFEERPq/08zO7zl9pD76KyJfrWWlNW+urwPqEz8i6eDj+/zBlCd6JfXxVgXy8ctHwqKChBNDyimVBvXDD6zIySnazdYVcYycfnSbNo4p2VWztF4C6CvqqOtN39I11LZZ1okZsxpacQEU3nhaRXHw+bMrHfRZNlt5RmCIYnNuB6qTBjL9yaaq/9BNzW2dQnRP2OkeIbfVJN3N00Sey0sbsXUlajEMJW7Efsz6iHtOXZkeTdu8ME7eGBsaRNAX5tcDqMJjnxhGsZSmxLNHW+5OnmNB54sdEMhyM/wYEbxGh6qQEPtbdBhSZIuXiSkfmtI64IdKhBYpLl2rUxDB+nLZisRgea3xCBDxHVd7c0e9u67lT3GetAmFX2GOTA5+a8k3zXnj6te+gN+9ZJhVCOasifNzKpk7WLwZXAgnFWtuXjAxMCEwCQYFKw4DAhoFAAQUL+jxIL4tVgP9Hb2ux92Idbur6QEECEfy4yQcB7vhAgIIAA==',
            passphraseEmpty: {
                ciphertext: 'IA==',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                ignoreChanges: true
            },
            pkcs12ObjEncr: {
                base64: 'MIIEdAIBAzCCBDoGCSqGSIb3DQEHAaCCBCsEggQnMIIEIzCCBB8GCSqGSIb3DQEHBqCCBBAwggQMAgEAMIIEBQYJKoZIhvcNAQcBMBwGCiqGSIb3DQEMAQYwDgQI/nEU2xuSAVcCAggAgIID2MNKbruh9PJGC3bsdOj/hsBAutS6hFtUXl1DJ8FZd2B+80ppRam4y8NKJz14Fkvr0qUOECIAPsv857EJ9PVAoYLaK6gf9jWe3nLCe8PyHv5MtJVEqORszIkQPUrI/Zsba46GLNPp1F4dEJsHXjK9XQ7yhQDIJr2yoMth+WmwBAZTx2jyoMc4m/4jcXvUTTHTOfOqqNzsS6fq3PAcYVDqC8iovWXwt7io31ix47qBvG1Vh6dCOTvupAv3KBDCJwLeSonIehobpS1SBQtLkot7LEzgLAVwpRRh4kFJ+R+dbmgH+xAxHJSb9BnSCBgW0ircrHrHFTwTHxjAd5HzGzxImPC/uuLIiKwa+7dajy2djfMgYSYkfM88zCo54hZfx1POBKQ3CF8NjFoOJZJvdi+2cQ5WO3+5xv9n6ZzyAO4W4sOvsxKQ8uwS7lL1vwFTnflvQx0y6RYsYww0nAR00D/Toq62mhpXx1Vx4ZGetVqiPU0NsLEr79l8yqZZAP4nQ68zXIYVDbKIASEFpbcCb7nDD4jExn68kWJpRINxbZ0z3hBN0RhM+LTC2Ybw5uYWezrlvxlnd2EU/ZHQGmFjWhbKH87AoWVpsGJPfcetBG4d2GhUO8X2BYitGQZuglNTZxCaWeem+QX19kCZvIkDgzp4Oi/MBpGkaS5Vjz8EQ6VhnMs2TncBVhPR6dgF3WpYOpmGOREz/Kg+8xWHqsEgI46RcEIJQ9gmVpbegmfFh6OmKXGOl0PY7bAhkLdybq2tJ23AVXKxsMOQW+5N8A4EQPp1QHFFpURsecQaKRjrj7px049zNG9Yts2Qc8KC6CGYARrxo5aeF3LK9CxsLbajcnGo1qytzn3y/1WB+rmiNQJx9e9lr63egfTWhpTMHkM9ayZX2td/mIbUDUNDZ9lsN6il7mY7EhBsdhdbGuv8wJDDS4jEdJaL8VFE2R7F1pAxSQkdF3mPFcePE0Me/vIjSv3sR+4Q44zw7dJaFU1eDAiQupLwctWKIkKeuEgEfetvZac5FqZ7KHv+MAr2AxO3jSau8cw5KR3mipzfN13cL0GdMQAKwhC6XZzZKmPJOxyhaT7V9hr7719Kqq3qX8JxVzkThHsFy5V1NjFdLvIcjQwDb0L74iwZ/mDiHdi4eKUkBQD5WiaTBBtZS8cFCXAfOZvprHFp3IuOxa2DkqKmBbTqficOxRom7gOKvaQzWlJqd/HFV4Ru0CjBXFnFXPk6FicZ6IdRzWJcVKJ/AjIDP1RUyu/NUNYbNNssK1tBW+IfGvESgaGqNzw4a/8H5G8UwSBO3bdt8kyqt+ioRjAxMCEwCQYFKw4DAhoFAAQUIvCNK3qldiHX2dfKVx7THPqQOvIECGiVUD1T1ujUAgIIAA=='
            },
            passphrase: {
                ciphertext: 'YXMz',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                ignoreChanges: true
            },
            output: {
                certificate: {
                    serialNumber: 257416782,
                    issuer: 'emailAddress=somebody@somewhere.com,CN=my_ssl,OU=Product Development,O=Test,L=Seattle,ST=WA,C=US',
                    // SHA 256 fingerprint only available for bigip 13.1+
                    // 1E:94:5F:7B:69:05:93:2E:38:D4:95:9A:8D:89:F7:72:73:05:EA:BC:76:5B:15:19:C4:F7:1F:34:15:EB:E0:88
                    checksum: 'SHA1:1318:d84b7644be91c477ceeac7eca40a9b3d50173cf2'
                }
            }
        },
        crtKeyEncrUrl: {
            pkcs12: {
                url: {
                    url: `https://${testResourcesURL}/certs/forge_p12.p12`
                }
            },
            passphrase: {
                ciphertext: 'cGFzc3dvcmQ=',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                ignoreChanges: true
            },
            output: {
                certificate: {
                    serialNumber: 1,
                    issuer: 'OU=Test,O=Test,L=Blacksburg,ST=Virginia,C=US,CN=example.org',
                    // SHA 256 fingerprint only available for bigip 13.1+
                    // 21:E4:52:55:6E:19:9A:93:02:C5:A2:2F:3A:3C:13:D7:E3:62:F8:51:1F:85:4C:20:BC:DD:11:89:96:7C:0D:CC
                    checksum: 'SHA1:944:2dd1a3caca26fe9d9bc0d3ad626e2a1299f5bafc'
                }
            }
        }
    };

    beforeEach(() => {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    p12s.crtKeyEncrUrl.pkcs12.url.authentication = {
                        method: 'bearer-token',
                        token
                    };
                });
        }
        return Promise.resolve();
    });

    it('pkcs12 {string} - OpenSSL CLI generated with empty passphrase', () => {
        const properties = [
            {
                name: 'pkcs12',
                inputValue: [p12s.crtOpenssl.pkcs12String],
                expectedValue: [p12s.crtOpenssl.output],
                extractFunction: extractFunctions.p12
            },
            {
                name: 'passphrase',
                inputValue: [p12s.crtOpenssl.passphraseEmpty],
                expectedValue: [false],
                extractFunction: extractFunctions.passphrase
            }
        ];

        return assertClass('Certificate', properties, options);
    });

    it('pkcs12.base64 - OpenSSL CLI generated with passphrase', () => {
        const properties = [
            {
                name: 'pkcs12',
                inputValue: [p12s.crtOpenssl.pkcs12ObjEncr],
                expectedValue: [p12s.crtOpenssl.output],
                extractFunction: extractFunctions.p12
            },
            {
                name: 'passphrase',
                inputValue: [p12s.crtOpenssl.passphrase],
                expectedValue: [false],
                extractFunction: extractFunctions.passphrase
            }
        ];

        return assertClass('Certificate', properties, options);
    });

    it('pkcs12.url {string} - Encrypted Cert and Key', function () {
        // Azure resources require auth
        if (process.env.TEST_IN_AZURE === 'true') {
            this.skip();
        }

        const p12OptionsOpenSSL = {
            keyImportFormat: 'openssl-legacy',
            ignoreChanges: true
        };
        const properties = [
            {
                name: 'pkcs12',
                inputValue: [p12s.crtKeyEncrUrl.pkcs12.url],
                expectedValue: [p12s.crtKeyEncrUrl.output],
                extractFunction: extractFunctions.p12
            },
            {
                name: 'passphrase',
                inputValue: [p12s.crtKeyEncrUrl.passphrase],
                expectedValue: [true],
                extractFunction: extractFunctions.passphrase
            },
            {
                name: 'pkcs12Options',
                inputValue: [p12OptionsOpenSSL],
                expectedValue: [{}],
                extractFunction: extractFunctions.p12Option
            }
        ];

        return assertClass('Certificate', properties, options);
    });

    it('pkcs12.url {object} - skip certificate check', () => {
        const p12OptionsOpenSSL = {
            keyImportFormat: 'openssl-legacy',
            ignoreChanges: true
        };
        const pkcs12UrlObj = util.simpleCopy(p12s.crtKeyEncrUrl.pkcs12);
        pkcs12UrlObj.url.skipCertificateCheck = true;

        const properties = [
            {
                name: 'pkcs12',
                inputValue: [pkcs12UrlObj],
                expectedValue: [p12s.crtKeyEncrUrl.output],
                extractFunction: extractFunctions.p12
            },
            {
                name: 'passphrase',
                inputValue: [p12s.crtKeyEncrUrl.passphrase],
                expectedValue: [true],
                extractFunction: extractFunctions.passphrase
            },
            {
                name: 'pkcs12Options',
                inputValue: [p12OptionsOpenSSL],
                expectedValue: [{}],
                extractFunction: extractFunctions.p12Option
            }
        ];

        return assertClass('Certificate', properties, options);
    });

    // TODO: add Update tests
    // these are a bit wonky with current tests if there is an encr key,
    // as when we update if ignoreChanges = true,then no change
    // ignoreChanges = false (will always detect a change because of encr private key)
});

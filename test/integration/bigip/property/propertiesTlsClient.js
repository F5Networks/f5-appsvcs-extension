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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');
const requestUtil = require('../../../common/requestUtilPromise');

const PATH_PREFIX = '/TEST_TLS_Client/Application';

describe('TLS_Client', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertTlsClientClass(properties, options) {
        return assertClass('TLS_Client', properties, options);
    }

    it('Default Update', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'clientCertificate',
                inputValue: [undefined, 'webCert', undefined],
                expectedValue: [
                    ['none', 'none', 'none'],
                    ['default.crt', 'default.key', 'f5-irule.crt'],
                    ['none', 'none', 'none']
                ],
                extractFunction: (o) => [
                    o.cert ? (o.cert.name || o.cert) : 'none',
                    o.key ? (o.key.name || o.key) : 'none',
                    o.chain ? (o.chain.name || o.chain) : 'none'
                ],
                referenceObjects: {
                    webCert: {
                        class: 'Certificate',
                        certificate:
                        {
                            bigip: '/Common/default.crt'
                        },
                        privateKey:
                        {
                            bigip: '/Common/default.key'
                        },
                        chainCA:
                        {
                            bigip: '/Common/f5-irule.crt'
                        }
                    }
                }
            },
            {
                name: 'sendSNI',
                inputValue: [undefined, '1.1.1.10', undefined],
                expectedValue: ['none', '1.1.1.10', 'none'],
                extractFunction: (o) => o.serverName || 'none'
            },
            {
                name: 'requireSNI',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'sniDefault',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'alertTimeout',
                inputValue: [undefined, 86400, undefined],
                expectedValue: ['indefinite', '86400', 'indefinite']
            },
            {
                name: 'cacheTimeout',
                inputValue: [undefined, 100, undefined],
                expectedValue: [3600, 100, 3600]
            },
            {
                name: 'ciphers',
                inputValue: [undefined, 'DEFAULT:+SHA:+3DES', undefined],
                expectedValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT']
            },
            {
                name: 'serverName',
                inputValue: [undefined, '1.1.1.11', undefined],
                expectedValue: ['none', '1.1.1.11', 'none'],
                extractFunction: (o) => o.authenticateName || 'none'
            },
            {
                name: 'authenticationFrequency',
                inputValue: [undefined, 'every-time', undefined],
                expectedValue: ['once', 'always', 'once']
            },
            {
                name: 'authenticationDepth',
                inputValue: [undefined, 10, undefined],
                expectedValue: [9, 10, 9]
            },
            {
                name: 'validateCertificate',
                inputValue: [undefined, true, undefined],
                expectedValue: ['ignore', 'require', 'ignore']
            },
            {
                name: 'trustCA',
                inputValue: [undefined, { bigip: '/Common/default.crt' }, undefined],
                expectedValue: ['ca-bundle.crt', 'default.crt', 'ca-bundle.crt'],
                extractFunction: (o) => o.caFile.fullPath.split('/').pop()
            },
            {
                name: 'ignoreExpired',
                inputValue: [undefined, true, undefined],
                expectedValue: ['drop', 'ignore', 'drop']
            },
            {
                name: 'ignoreUntrusted',
                inputValue: [undefined, true, undefined],
                expectedValue: ['drop', 'ignore', 'drop']
            },
            {
                name: 'sessionTickets',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'ldapStartTLS',
                inputValue: [undefined, 'require', undefined],
                expectedValue: [undefined, 'f5_appsvcs_serverside_require', undefined],
                extractFunction: (o, expected) => {
                    const RETRY_OPTIONS = {
                        retryCount: 5,
                        retryInterval: 1000,
                        retryIf: (error, response) => response && response.statusCode === 503
                    };
                    const requestOptions = {
                        path: '/mgmt/tm/ltm/profile/server-ldap',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil
                        .get(Object.assign(requestOptions, RETRY_OPTIONS))
                        .then((response) => {
                            const foundName = response.body.items.find((i) => i.name === expected);
                            return (foundName) ? foundName.name : foundName;
                        });
                }
            },
            {
                name: 'forwardProxyEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'forwardProxyBypassEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'renegotiationEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'retainCertificateEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['true', 'false', 'true']
            },
            {
                name: 'sslEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                extractFunction: (o) => (o.tmOptions.indexOf('no-ssl') >= 0 ? 'disabled' : 'enabled')
            },
            {
                name: 'ssl3Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                extractFunction: (o) => (o.tmOptions.indexOf('no-sslv3') >= 0 ? 'disabled' : 'enabled')
            },
            {
                name: 'secureRenegotiation',
                inputValue: [undefined, 'require', undefined],
                expectedValue: ['require-strict', 'require', 'require-strict']
            },
            {
                name: 'uncleanShutdownEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'renegotiatePeriod',
                inputValue: [undefined, 100, undefined],
                expectedValue: ['indefinite', '100', 'indefinite']
            },
            {
                name: 'renegotiateSize',
                inputValue: [undefined, 100, undefined],
                expectedValue: ['indefinite', '100', 'indefinite']
            },
            {
                name: 'sslSignHash',
                inputValue: [undefined, 'sha256', undefined],
                expectedValue: ['any', 'sha256', 'any']
            },
            {
                name: 'handshakeTimeout',
                inputValue: [undefined, 1234, undefined],
                expectedValue: [10, 1234, 10]
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '15.1')) {
            properties.push(
                {
                    name: 'dataZeroRoundTripTime',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.data_0rtt
                }
            );
        }

        return assertTlsClientClass(properties);
    });

    it('C3D Features (v13.1+) and CRL', function () {
        const properties = [
            {
                name: 'clientCertificate',
                inputValue: [undefined, 'defaultCert', undefined],
                expectedValue: ['none', 'default.crt', 'none'],
                extractFunction: (o) => {
                    const result = (o.cert !== undefined && o.cert.name !== undefined) ? o.cert.name : 'none';
                    return result;
                },
                referenceObjects: {
                    defaultCert: {
                        class: 'Certificate',
                        certificate:
                        {
                            bigip: '/Common/default.crt'
                        },
                        privateKey:
                        {
                            bigip: '/Common/default.key'
                        }
                    }
                }
            },
            {
                name: 'crlFile',
                inputValue: [undefined, { bigip: '/Common/testTlsClientCRL.crl' }, undefined],
                expectedValue: ['none', '/Common/testTlsClientCRL.crl', 'none'],
                extractFunction: (o) => {
                    let result = 'none';
                    if (o.crlFile) {
                        if (typeof o.crlFile === 'object') {
                            result = o.crlFile.fullPath;
                        } else {
                            result = o.crlFile;
                        }
                    }
                    return result;
                }
            },
            {
                name: 'allowExpiredCRL',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.allowExpiredCrl
            },
            {
                name: 'trustCA',
                inputValue: [{ use: 'testTrustCA' }],
                expectedValue: [`${PATH_PREFIX}/testTrustCA`],
                referenceObjects: {
                    testTrustCA: {
                        class: 'CA_Bundle',
                        bundle: '-----BEGIN CERTIFICATE-----\nMIIDxTCCA0qgAwIBAgICEAAwCgYIKoZIzj0EAwMwgZsxCzAJBgNVBAYTAlVTMQsw\nCQYDVQQIDAJXQTEQMA4GA1UEBwwHU2VhdHRsZTEcMBoGA1UECgwTR3JpbGxlZCBD\naGVlc2UgSW5jLjEfMB0GA1UECwwWR3JpbGxlZCBDaGVlc2UgUm9vdCBDQTEuMCwG\nCSqGSIb3DQEJARYfZ3JpbGxlZGNoZWVzZUB5dW1teWlubXl0dW1teS51czAeFw0x\nOTAyMDYyMDQ2NDFaFw0yODEyMTUyMDQ2NDFaMIHSMQswCQYDVQQGEwJVUzELMAkG\nA1UECAwCV0ExHDAaBgNVBAoME0dyaWxsZWQgQ2hlZXNlIEluYy4xJzAlBgNVBAsM\nHkdyaWxsZWQgQ2hlZXNlIEludGVybWVkaWFyeSBDQTE/MD0GA1UEAww2R3JpbGxl\nZCBDaGVlc2UgSW5jLiBJbnRlcm1lZGlhcnkgQ2VydGlmaWNhdGUgQXV0aG9yaXR5\nMS4wLAYJKoZIhvcNAQkBFh9ncmlsbGVkY2hlZXNlQHl1bW15aW5teXR1bW15LnVz\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAETcwKVVKK9DbghS3Dvik+OpLCzoOprWvw\nbOl/IiiX7RxdFgJWsQInI1fzKgMoq4s1aatTUry6wViTX8bUCaiCpNCw5EUZ1bf+\niabKwI42zo+muBES7myVFbFLINoyLaO/o4IBJjCCASIwHQYDVR0OBBYEFNnurRrA\nInHSRpZvxY3SbBlMSBxjMB8GA1UdIwQYMBaAFOh9I+Bl//6eA3hxheJXlhg+SeDd\nMBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgGGMEEGA1UdHwQ6MDgw\nNqA0oDKGMGh0dHA6Ly9jcmwuZ3JpbGxlZGNoZWVzZS51cy93aG9tb3ZlZG15Y2hl\nZXNlLmNybDB5BggrBgEFBQcBAQRtMGswPgYIKwYBBQUHMAKGMmh0dHA6Ly9vY3Nw\nLmdyaWxsZWRjaGVlc2UudXMvY2hlZGRhcmNoZWVzZXJvb3QuY3J0MCkGCCsGAQUF\nBzABhh1odHRwOi8vb2NzcC5ncmlsbGVkY2hlZXNlLnVzLzAKBggqhkjOPQQDAwNp\nADBmAjEA7pS9bNHyxZ7gijiWeQrN8hn+rWCgdDggdvFmhFuvmfvv25w9Bgix5AWx\nRjbdQDhYAjEA7s0DRn1xFxoRv5bYKq9BzdLs2J3Q7SKrW4TjJcMR7fg68IxrXf17\nEdC9gMyUkCGZ\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIICzzCCAlWgAwIBAgIJAJuPXU1XfaOdMAoGCCqGSM49BAMDMIGbMQswCQYDVQQG\nEwJVUzELMAkGA1UECAwCV0ExEDAOBgNVBAcMB1NlYXR0bGUxHDAaBgNVBAoME0dy\naWxsZWQgQ2hlZXNlIEluYy4xHzAdBgNVBAsMFkdyaWxsZWQgQ2hlZXNlIFJvb3Qg\nQ0ExLjAsBgkqhkiG9w0BCQEWH2dyaWxsZWRjaGVlc2VAeXVtbXlpbm15dHVtbXku\ndXMwHhcNMTkwMjA2MjAzNzE2WhcNMTkwMzA4MjAzNzE2WjCBmzELMAkGA1UEBhMC\nVVMxCzAJBgNVBAgMAldBMRAwDgYDVQQHDAdTZWF0dGxlMRwwGgYDVQQKDBNHcmls\nbGVkIENoZWVzZSBJbmMuMR8wHQYDVQQLDBZHcmlsbGVkIENoZWVzZSBSb290IENB\nMS4wLAYJKoZIhvcNAQkBFh9ncmlsbGVkY2hlZXNlQHl1bW15aW5teXR1bW15LnVz\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE18uEnJFBt+yEzbH5NOEcrPwm/Ay6DMJp\nbFkt+c9GYmwJxN7LREaV3v7CMJDiFtUsBKS7E4BzwgxE0/rsjUlBHFzrLXHBbuRR\ne1+SkBkM3TpeLwXtveNdzN2vgTghtE6/o2MwYTAdBgNVHQ4EFgQU6H0j4GX//p4D\neHGF4leWGD5J4N0wHwYDVR0jBBgwFoAU6H0j4GX//p4DeHGF4leWGD5J4N0wDwYD\nVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAYYwCgYIKoZIzj0EAwMDaAAwZQIx\nANsHvQbfAGNSbPfvmtJj8j/9iP8qhO14Rtaiv1CZ8JRCP+CuJiVZ4GVl95dRkt49\nAAIwWEXXpberWlZdTRd4sczN1S706rKZvLgScNRuEltoz/iSEh1MnYZMfuu6kXZ8\nXTuQ\n-----END CERTIFICATE-----\n'
                    }
                },
                extractFunction: (o) => o.caFile.fullPath
            },
            {
                name: 'c3dEnabled',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'c3dCertificateLifespan',
                inputValue: [undefined, 0, 8760],
                expectedValue: [24, 0, 8760],
                extractFunction: (o) => o.c3dCertLifespan
            },
            {
                name: 'c3dCertificateExtensions',
                inputValue: [undefined, ['key-usage'], ['basic-constraints', 'subject-alternative-name']],
                expectedValue: [['basic-constraints', 'extended-key-usage', 'key-usage', 'subject-alternative-name'], ['key-usage'], ['basic-constraints', 'subject-alternative-name']],
                extractFunction: (o) => o.c3dCertExtensionIncludes
            },
            {
                name: 'c3dCertificateAuthority',
                inputValue: ['c3dCA1', 'c3dCA2', 'existingCA'],
                expectedValue: [
                    {
                        cert: `${PATH_PREFIX}/c3dCA1.crt`,
                        key: `${PATH_PREFIX}/c3dCA1.key`,
                        passphrase: false
                    },
                    {
                        cert: `${PATH_PREFIX}/c3dCA2.crt`,
                        key: `${PATH_PREFIX}/c3dCA2.key`,
                        passphrase: true
                    },
                    {
                        cert: '/Common/default.crt',
                        key: '/Common/default.key',
                        passphrase: false

                    }],
                referenceObjects: {
                    c3dCA1: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDejCCAmKgAwIBAgIEEScJETANBgkqhkiG9w0BAQsFADB/MQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxCzAJBgNVBAoTAkY1MREw\nDwYDVQQLEwhEZXYvVGVzdDERMA8GA1UEAxMIYzNkLnRlc3QxHjAcBgkqhkiG9w0B\nCQEWD2MzZF90ZXN0QGY1LmNvbTAeFw0xOTAyMTQwMDIxMzdaFw0yOTAyMTEwMDIx\nMzdaMH8xCzAJBgNVBAYTAlVTMQswCQYDVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRs\nZTELMAkGA1UEChMCRjUxETAPBgNVBAsTCERldi9UZXN0MREwDwYDVQQDEwhjM2Qu\ndGVzdDEeMBwGCSqGSIb3DQEJARYPYzNkX3Rlc3RAZjUuY29tMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TewabffHuFqkGImbYeguZP528rImQBrDJ83\nFrax15gpABnpUitXPKPNxkmvi7oRAcOiXc6+6pFZioCUTw6uWL29mRByuXKqWv7c\naIvw8U8JeLtFtpZBPJNvrO1VPDcFS2FYxUS5auzJs2kDh/YmKytcU2PKe/yMd+Q9\nqAhIb10wxNFm4coq3Ezxlaw2heboyMYlAz+eRA7gDlXpv3OMCPhKo6Qx242VV0CU\nNxnqJx0MweqoQsejOF3caZRBwxmbNQMhDhrNNKv9vAGZeGCZGM/x56jJubTbJlbh\nY6CqZPdgxicc47RT8widQ+/MoHihC4rbNdUPM8tywgUJRmp91QIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQBFz5VHcF8OwjeKeJdbgoZFzOKHBATW8cUvx57d0fi5Xqck\nNCob+S91DvkCznkgrNOvcn9OotPmTXAB6uxGsnyVRo1X1Y8kUnj0KrIsPdZ+fUfS\nuPw4kUHKPY+XTLluNIXY1Yja3gXifC/0FokfMRDJQXkxmHijJqepk4UTv+A1gYYU\n2xVQ4EiX3JxB1dXqu7ov1hAEbOHHZnRNEbnHhkxBr7UCW1u5PGmBMVbOKopuVWPY\nMtYwebTv0LhPRaySE/jJekj1yxtVVlDLBOjNkrm8ubcN2apxK4HuqqdSLbmWNqSN\nAeJxKwVsp2ODpOOWU3WlDuFuuLF6NgFfu2A4Jxq+\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDhN7Bpt98e4WqQ\nYiZth6C5k/nbysiZAGsMnzcWtrHXmCkAGelSK1c8o83GSa+LuhEBw6Jdzr7qkVmK\ngJRPDq5Yvb2ZEHK5cqpa/txoi/DxTwl4u0W2lkE8k2+s7VU8NwVLYVjFRLlq7Mmz\naQOH9iYrK1xTY8p7/Ix35D2oCEhvXTDE0WbhyircTPGVrDaF5ujIxiUDP55EDuAO\nVem/c4wI+EqjpDHbjZVXQJQ3GeonHQzB6qhCx6M4XdxplEHDGZs1AyEOGs00q/28\nAZl4YJkYz/HnqMm5tNsmVuFjoKpk92DGJxzjtFPzCJ1D78ygeKELits11Q8zy3LC\nBQlGan3VAgMBAAECggEAFq69qUAYDCumyGjiNujQgrBJG15WirZUkb5dVX/L9ItC\nIdz6N0jfLd/Pgzd7oyZ3vQY/jZQbfVNrQbxGc5nmbFCbzlUuQMgwKR7/AtaJSzxr\nF0pBMKz8YAX3WuLCUWC3O0rQHnoX9JFplRSwAtsDKBjjYRCtXYRnf1Gw9gHzjaeU\nNbj6c65dcotaZTdWnXOQajp3gWI0XttCgcaDs3Nw9V7CxloJ48GAxKX7XKNu11fJ\nioVoMohXpQ39LtG4YnndI1BxjK+P7upXIiu0M/yDf2dBsuja4laaWOz4l4a8FAg/\nIUCRwXLcv3r0Ka2mpRqqjQz3RyP9qufEXKULgU4wJwKBgQD20ibjryoSh5srihUY\nqxczV/qKxMnYyWhkld73EcPN1Q/clUZWjKv8FTKgbTloLo+n1feoW5bWD11h5Pih\npKHpCBLaAOXHfT3qppSZHiEXTOnaviq9cU8u+VXIGYbqA08OtwwHki3PKWcyYmAa\nABpU4SN+Q6V6S1Tul9qeZyaXQwKBgQDpl9z7/L2k6Q33vthg+vAPgd2DGF12eMiZ\nVWb4L/CxHsL6OHSdM7dwQaguIsevphwljfS3kk7pOZ20GgfY0KLNEOTXXYbByRr0\n3qryIWZ8i1nNJ2pQf33d/nM0EhAl7fMNhqwKq9ncIy1ZF9QkARr1+iKfmAUUsGbg\nJYjVZpkJBwKBgAzt2z2oClMoKVexhwNgyvlUjXpBbrVdb4t9Uk2s743TsF4Er8eO\n3N96mMlQj2ZGsh2/lpaKHa+e5GxhWyjUf+q+Eoa6705w4BJvoW8X5fHbhJCBz6lW\nyygRxY2S0L9nZvfFXOr0nFOyvoYkIxaZlMeHd52Am6V5Vryc1cXgb2QTAoGAHPIV\njyAle97pPS7n7zSJNNK52TnWswyKhv2fMdf28mvGa209fhFfhMiOB5GFvw1NZZXu\noiS+JIZgNWYYXNSVp+WVBd7wCOlbrsY81p4u7fXyncppkSoLNcwHCIfIenq+6Iks\nnnHnIDE3uFeMkR2V8q8ZRT94ObUWOmZMS21YP1cCgYBbFGcZIhq5h/9oiuquq37W\nAEexdokvbENYVY3XChKCYwE4jCi8cqt/6TvGA8Kmp4yV4EiUdSkZ0sgi3fG1wAOJ\nDSqjcNd+f8shWI3KKiNnj2uCoymsT/Qq4X9XNYThR7IPPD4dfud9tE19eg/bywZB\n51KTyyjhxG7gylti+xOctg==\n-----END PRIVATE KEY-----'
                    },
                    c3dCA2: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDejCCAmKgAwIBAgIEEScJETANBgkqhkiG9w0BAQsFADB/MQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxCzAJBgNVBAoTAkY1MREw\nDwYDVQQLEwhEZXYvVGVzdDERMA8GA1UEAxMIYzNkLnRlc3QxHjAcBgkqhkiG9w0B\nCQEWD2MzZF90ZXN0QGY1LmNvbTAeFw0xOTAyMTQwMDIxMzdaFw0yOTAyMTEwMDIx\nMzdaMH8xCzAJBgNVBAYTAlVTMQswCQYDVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRs\nZTELMAkGA1UEChMCRjUxETAPBgNVBAsTCERldi9UZXN0MREwDwYDVQQDEwhjM2Qu\ndGVzdDEeMBwGCSqGSIb3DQEJARYPYzNkX3Rlc3RAZjUuY29tMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TewabffHuFqkGImbYeguZP528rImQBrDJ83\nFrax15gpABnpUitXPKPNxkmvi7oRAcOiXc6+6pFZioCUTw6uWL29mRByuXKqWv7c\naIvw8U8JeLtFtpZBPJNvrO1VPDcFS2FYxUS5auzJs2kDh/YmKytcU2PKe/yMd+Q9\nqAhIb10wxNFm4coq3Ezxlaw2heboyMYlAz+eRA7gDlXpv3OMCPhKo6Qx242VV0CU\nNxnqJx0MweqoQsejOF3caZRBwxmbNQMhDhrNNKv9vAGZeGCZGM/x56jJubTbJlbh\nY6CqZPdgxicc47RT8widQ+/MoHihC4rbNdUPM8tywgUJRmp91QIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQBFz5VHcF8OwjeKeJdbgoZFzOKHBATW8cUvx57d0fi5Xqck\nNCob+S91DvkCznkgrNOvcn9OotPmTXAB6uxGsnyVRo1X1Y8kUnj0KrIsPdZ+fUfS\nuPw4kUHKPY+XTLluNIXY1Yja3gXifC/0FokfMRDJQXkxmHijJqepk4UTv+A1gYYU\n2xVQ4EiX3JxB1dXqu7ov1hAEbOHHZnRNEbnHhkxBr7UCW1u5PGmBMVbOKopuVWPY\nMtYwebTv0LhPRaySE/jJekj1yxtVVlDLBOjNkrm8ubcN2apxK4HuqqdSLbmWNqSN\nAeJxKwVsp2ODpOOWU3WlDuFuuLF6NgFfu2A4Jxq+\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,88D5CDC828B89D3DAB310589A45A26A9\n\nQHdPM4CtWCHRb+K2F87UPUs5AeyVuvDe28JWA9/SV3UsTwJBHS+wPKbOHxpEBtR6\nD4Pr7cvqbnkI8WG1XS3x7aEhamzK+OT/H+IOLInOj7ir6N6YZ+W8EMQFjZoRuYlA\ntnpRSlfEMhg+EAIeqf+iRo8JC6G3HlWuow5uZuv9rJS33NcFI8zw+je+8vQTIVTN\ndTrGSqdzb/bjgbK483/lUmYTpxenO3diCNxmzVP2bvCPISAh6ODwIaQirlahWknk\nSrEQZbkjWegwCsA7J6l0MJfmBiVdRRWvHZAcskINp24gH6MSzCdPOr8w5hQt9izz\n8KtaflZLlGz+2jaZ452J7EO+DauVtKXaz7RWxZKNno22YdO3QCk098FmENa3KbIr\nehUn15jnT/EZZFyUd2G79Hff/tTNx6LrKeZiKVtAyT23qUyd+U0CohXOhNYd9UC+\nRGg0yipXewmN/dM2k9t1kDIxP2MccsmyiIS+BA5+WxtHOtRYgfHw+TI6amDS/7w0\nnvubzYgK9ZohCgRNHbp1XW4udkL53edXVybP6vmdw48ARxpzY0tlkz+KhYFFqss3\nLClT/T8il1iGWmsNhS40roQFJ/geDCoZ0pAnrULmd0YCuoSNLCsKJwtzGSY4ySIT\n5oh5jdHUNx8aNmdUiKZkGwMdrSklTOvm9SNCTWEgcJGsXrDNdX4Oz/iPNV/lNYeM\nODosXKxeriYQSgaEv+Q60sVs/PKanlDHoMlhaTpADlAezbQ9pVTKL7IUyi8pVsNG\nCKSTSR1VwYvcBqqyLJgxw946k9RS0aEPjVIrygcBRFqHeTap8H2RaWLRZJ7psuk5\nXY8cVLPldGVacW3H118SPmjuboBe0btDP30V7ZvdAlRHl24ykAaQEDNML5dzVYEh\n0RDt+hQaI2fHz03snqHS/IYfEzopuTwDforZV8/qbmIcDK9dy8DtevdShKxgMzWo\nyDCJpASHlZ8G1HMJ8/OCYMcvPcjLy5TQ4KRVyl/6F6d+RGTXFyz9UlXRZk5hS5Me\n9LngAbQxibB/IWI3FSmACUPd5Iev7ma9X9fSRKhbuHdeD7tsHofiZsl0caZupack\nVGc7DSIoz0s+gtYbNSOzfYL3h8oKstrCVkX8FixP4osjWuNrj2pyhcatyiMv2k2I\nZGctd2vTFK0H0nU8EOodrhLU/bv2g4aBWFbpHgsQPIz7zvuLYqfiYjhBp8f0KCrR\nbDuGwoDS1OL2hGJ0I4KwYDDOu2Fkezo2J1sGDLVbF9H+FgHgzY5V9CmsL7SrG34B\nq16deuwutnqo3KGeK2kGkhYhbvgBbNsOHkw6WveQga11mVlTCqzubceYl2z3PkR7\nVEhcFufm94uED+tb/xJUBtNCp4XB9UvGaPaNbwG9SAPxn/6u4rc5C3QcRwuoSIjv\nRpdLsS6w067dadQ2ejblbLe5OURjNkxoWSIJQFT7dwswPWKS64GI6YgUKF/H0oK7\nY+jF1IAI2p3wRkZLiBjUWTi9icCxLa0AJh14JFT1wds8CnvG7227pOPpDVZWd2eR\nbVHiw5qnVm6/Ib9CFgMsDn1YJJhE3I3WVkmy1mbNnoBn4Be2LUn0YltOhLpfsAlM\n-----END RSA PRIVATE KEY-----',
                        passphrase: {
                            ciphertext: 'YXMzYXMz',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true
                        }
                    },
                    existingCA: {
                        class: 'Certificate',
                        certificate: { bigip: '/Common/default.crt' },
                        privateKey: { bigip: '/Common/default.key' }
                    }
                },
                extractFunction: (o) => {
                    const result = {};
                    result.cert = o.c3dCaCert.fullPath;
                    result.key = o.c3dCaKey.fullPath;
                    result.passphrase = typeof o.c3dCaPassphrase !== 'undefined';
                    return result;
                }
            }
        ];
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/shared/file-transfer/uploads/testTlsClientCRL',
                    data: '-----BEGIN X509 CRL-----\nMIIBrjCCATQCAQEwCgYIKoZIzj0EAwMwgdIxCzAJBgNVBAYTAlVTMQswCQYDVQQI\nDAJXQTEcMBoGA1UECgwTR3JpbGxlZCBDaGVlc2UgSW5jLjEnMCUGA1UECwweR3Jp\nbGxlZCBDaGVlc2UgSW50ZXJtZWRpYXJ5IENBMT8wPQYDVQQDDDZHcmlsbGVkIENo\nZWVzZSBJbmMuIEludGVybWVkaWFyeSBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkxLjAs\nBgkqhkiG9w0BCQEWH2dyaWxsZWRjaGVlc2VAeXVtbXlpbm15dHVtbXkudXMXDTE5\nMDIwNjIwNTc1M1oXDTE5MDgwNTIwNTc1M1qgMDAuMB8GA1UdIwQYMBaAFNnurRrA\nInHSRpZvxY3SbBlMSBxjMAsGA1UdFAQEAgIQADAKBggqhkjOPQQDAwNoADBlAjEA\notYkHQXCwkuS08FVReEtSDqGX2FTUA7JusDnqv3uCG37jo4ZSHwrykJgxlTGcIlq\nAjBL0LhpeFa7rTXgxddjvy/nVy+rSydAHpNreAOrtCNDQRFrHFoQM9ihI4yXNhFG\nE6Y=\n-----END X509 CRL-----\n',
                    headers: {
                        'Content-Range': '0-637/638',
                        'Content-Type': 'text/plain'
                    }
                },
                {
                    endpoint: '/mgmt/tm/sys/file/ssl-crl',
                    data: {
                        name: 'testTlsClientCRL.crl',
                        partition: 'Common',
                        sourcePath: 'file:///var/config/rest/downloads/testTlsClientCRL'
                    }
                }
            ]
        };
        return assertTlsClientClass(properties, options);
    });

    it('Enable TLS 1.3', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            this.skip();
        }

        const enabled = 'tls 1.3 Enabled';
        const disabled = 'tls 1.3 Disabled';
        const properties = [
            {
                name: 'tls1_3Enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [disabled, enabled, disabled],
                extractFunction: (o) => (o.tmOptions.indexOf('no-tlsv1.3') >= 0 ? disabled : enabled)
            },
            {
                name: 'cipherGroup',
                inputValue: [undefined, { bigip: '/Common/f5-aes' }, undefined],
                skipAssert: true
            },
            {
                name: 'clientCertificate',
                inputValue: ['defaultCert'],
                skipAssert: true,
                referenceObjects: {
                    defaultCert: {
                        class: 'Certificate',
                        certificate:
                        {
                            bigip: '/Common/default.crt'
                        },
                        privateKey:
                        {
                            bigip: '/Common/default.key'
                        }
                    }
                }
            }
        ];
        return assertTlsClientClass(properties);
    });

    it('Test universal TLS options', function () {
        const checkEnabled = function (o, name) {
            // Later versions of BIG-IP sets the tmOptions as a string not an array
            const optionArray = (Array.isArray(o.tmOptions)) ? o.tmOptions : o.tmOptions.split(' ');
            return (optionArray.indexOf(name) >= 0 ? 'Enabled' : 'Disabled');
        };

        const properties = [
            {
                name: 'insertEmptyFragmentsEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['Enabled', 'Disabled', 'Enabled'],
                extractFunction: (o) => checkEnabled(o, 'dont-insert-empty-fragments')
            },
            {
                name: 'singleUseDhEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'single-dh-use')
            },
            {
                name: 'tls1_2Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-tlsv1.2')
            },
            {
                name: 'tls1_1Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-tlsv1.1')
            },
            {
                name: 'tls1_0Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-tlsv1')
            },
            {
                name: 'clientCertificate',
                inputValue: ['defaultCert'],
                skipAssert: true,
                referenceObjects: {
                    defaultCert: {
                        class: 'Certificate',
                        certificate:
                        {
                            bigip: '/Common/default.crt'
                        },
                        privateKey:
                        {
                            bigip: '/Common/default.key'
                        }
                    }
                }
            },
            {
                name: 'cipherGroup',
                inputValue: [undefined, { bigip: '/Common/f5-aes' }, undefined],
                skipAssert: true
            },
            {
                name: 'dtlsEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-dtls')
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '16.0')) {
            properties.push({
                name: 'dtls1_2Enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['Disabled', 'Enabled', 'Disabled'],
                extractFunction: (o) => checkEnabled(o, 'no-dtlsv1.2')
            });
        }

        return assertTlsClientClass(properties);
    });

    it('References Cipher_Group (v13.0+)', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'clientCertificate',
                inputValue: ['defaultCert'],
                skipAssert: true,
                referenceObjects: {
                    defaultCert: {
                        class: 'Certificate',
                        certificate:
                        {
                            bigip: '/Common/default.crt'
                        },
                        privateKey:
                        {
                            bigip: '/Common/default.key'
                        }
                    }
                }
            },
            {
                name: 'cipherGroup',
                inputValue: [undefined, { bigip: '/Common/f5-aes' }, undefined],
                expectedValue: ['none', '/Common/f5-aes', 'none'],
                extractFunction: (o) => o.cipherGroup.fullPath || o.cipherGroup
            }
        ];

        return assertTlsClientClass(properties);
    });

    it('proxy SSL', () => {
        const properties = [
            {
                name: 'proxySslEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'proxySslPassthroughEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];

        if (!util.versionLessThan(getBigIpVersion(), '14.0')) {
            properties.push({
                name: 'insertEmptyFragmentsEnabled',
                inputValue: [true],
                skipAssert: true
            });
        }

        return assertTlsClientClass(properties);
    });
});

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

const {
    assertClass,
    getBigIpVersion,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');
const constants = require('../../../../src/lib/constants');
const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

describe('Monitor', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('DNS', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['dns'],
                expectedValue: ['dns'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'targetAddress',
                inputValue: [undefined, '100.0.0.100', '100.0.0.200', undefined],
                expectedValue: ['*', '100.0.0.100', '100.0.0.200', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 8080, 8090, undefined],
                expectedValue: ['*', '8080', '8090', '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'interval',
                inputValue: [undefined, 10, 20, undefined],
                expectedValue: [5, 10, 20, 5]
            },
            {
                name: 'receive',
                inputValue: [undefined, '10.11.12.13', undefined, undefined],
                expectedValue: [undefined, '10.11.12.13', undefined, undefined]
            },
            {
                name: 'timeUntilUp',
                inputValue: [undefined, 20, 25, undefined],
                expectedValue: [0, 20, 25, 0]
            },
            {
                name: 'timeout',
                inputValue: [undefined, 46, 36, undefined],
                expectedValue: [16, 46, 36, 16]
            },
            {
                name: 'transparent',
                inputValue: [undefined, true, false, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled', 'disabled']
            },
            {
                name: 'upInterval',
                inputValue: [undefined, 15, 20, undefined],
                expectedValue: [0, 15, 20, 0]
            },
            {
                name: 'acceptRCODE',
                inputValue: [undefined, 'no-error', 'anything', undefined],
                expectedValue: ['no-error', 'no-error', 'anything', 'no-error']
            },
            {
                name: 'answerContains',
                inputValue: [undefined, 'query-type', 'anything', undefined],
                expectedValue: ['query-type', 'query-type', 'anything', 'query-type']
            },
            {
                name: 'queryName',
                inputValue: ['fred', 'wilma', 'barney', 'betty'],
                expectedValue: ['fred', 'wilma', 'barney', 'betty']
            },
            {
                name: 'queryType',
                inputValue: [undefined, 'a', 'aaaa', undefined],
                expectedValue: ['a', 'a', 'aaaa', 'a']
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('External Pathname', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['external'],
                expectedValue: ['external'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'pathname',
                inputValue: ['/Common/arg_example', '/Common/arg_example', '/Common/arg_example'],
                expectedValue: ['/Common/arg_example', '/Common/arg_example', '/Common/arg_example'],
                extractFunction: (o) => o.run.fullPath
            },
            {
                name: 'environmentVariables',
                inputValue: [
                    undefined,
                    {
                        USER: 'two words',
                        PASSWORD: 'secret'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    {
                        'userDefined USER': 'two words',
                        'userDefined PASSWORD': 'secret'
                    },
                    undefined
                ],
                extractFunction: (o) => o.apiRawValues
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('External Script', () => {
        const POSTFIX = '-script';
        const MAX_PATH_LENGTH = constants.MAX_PATH_LENGTH - POSTFIX.length;

        validateEnvVars(['TEST_RESOURCES_URL']);

        const properties = [
            {
                name: 'monitorType',
                inputValue: ['external'],
                expectedValue: ['external'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            // TODO add test for the expand property (a unit test would likely be more effective)
            {
                name: 'arguments',
                inputValue: [undefined, 'TEST=1', undefined],
                expectedValue: [undefined, 'TEST=1', undefined],
                extractFunction: (o) => o.args
            }
        ];

        return Promise.resolve()
            .then(() => {
                const scriptProperty = {
                    name: 'script',
                    inputValue: [{
                        url: {
                            url: `https://${process.env.TEST_RESOURCES_URL}/external-monitor/arg_example`
                        }
                    }],
                    expectedValue: [`/TEST_Monitor/Application/${getItemName({ tenantName: 'TEST_Monitor', maxPathLength: MAX_PATH_LENGTH })}${POSTFIX}`],
                    extractFunction: (o) => o.run.fullPath
                };

                if (process.env.TEST_IN_AZURE === 'true') {
                    return oauth.getTokenForTest()
                        .then((token) => {
                            scriptProperty.inputValue[0].url.authentication = {
                                method: 'bearer-token',
                                token
                            };
                            properties.push(scriptProperty);
                        });
                }

                properties.push(scriptProperty);
                return Promise.resolve();
            })
            .then(() => assertClass('Monitor', properties, { maxPathLength: MAX_PATH_LENGTH }));
    });

    it('FTP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['ftp'],
                expectedValue: ['ftp'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'mode',
                inputValue: [undefined, 'port', undefined],
                expectedValue: ['passive', 'port', 'passive']
            },
            {
                name: 'username',
                inputValue: [undefined, 'testUser', undefined],
                expectedValue: [undefined, 'testUser', undefined]
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    {
                        ciphertext: 'c2VjcmV0',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    }
                ],
                expectedValue: [true],
                extractFunction: () => true
            },
            {
                name: 'filename',
                inputValue: [undefined, 'testpath/test/', undefined],
                expectedValue: [undefined, 'testpath/test/', undefined]
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('HTTP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['http'],
                expectedValue: ['http'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'send',
                inputValue: [undefined, 'Test\\":1', undefined],
                expectedValue: ['HEAD / HTTP/1.0\\r\\n\\r\\n', 'Test\\":1', 'HEAD / HTTP/1.0\\r\\n\\r\\n']
            },
            {
                name: 'receive',
                inputValue: [undefined, '\\{\\"status\\"\\:\\"UP\\"\\}', undefined],
                expectedValue: ['HTTP/1.', '\\{\\"status\\"\\:\\"UP\\"\\}', 'HTTP/1.']
            },
            {
                name: 'reverse',
                inputValue: [false, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'username',
                inputValue: [undefined, 'testUser', undefined],
                expectedValue: [undefined, 'testUser', undefined]
            },
            {
                name: 'transparent',
                inputValue: [false, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'targetAddress',
                inputValue: ['', '100.0.0.100', ''],
                expectedValue: ['*', '100.0.0.100', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 8080, undefined],
                expectedValue: ['*', '8080', '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'dscp',
                inputValue: [0, 5, 0],
                expectedValue: [0, 5, 0]
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('HTTPS', () => {
        const clientTLSInput = [
            undefined,
            {
                use: 'webtls'
            },
            undefined
        ];
        const clientTLSExpected = [
            'none',
            'webtls',
            'none'
        ];

        const properties = [
            {
                name: 'monitorType',
                inputValue: ['https'],
                expectedValue: ['https'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'ciphers',
                inputValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT'],
                expectedValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT']
            },
            {
                name: 'clientCertificate',
                inputValue: [undefined, 'https_monitor_certificate', undefined],
                expectedValue: [undefined, 'https_monitor_certificate.crt', undefined],
                referenceObjects: {
                    https_monitor_certificate: {
                        class: 'Certificate',
                        remark: 'in practice using a passphrase is recommended',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDXjCCAkagAwIBAgIED6B1ETANBgkqhkiG9w0BAQsFADBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwHhcNMTgwNDIzMTgwNjA5WhcNMjgwNDIwMTgwNjA5WjBxMQswCQYDVQQGEwJVUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxDTALBgNVBAoTBFRlc3QxHDAaBgNVBAsTE1Byb2R1Y3QgRGV2ZWxvcG1lbnQxFjAUBgNVBAMUDWh0dHBzX21vbml0b3IwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC03brx8pCY7my1CW3VEXKcoehIci6d9s6XEySQDRucQU9snY6u39WLLiBa6IFIfvVTAkMvgE3mA3uXXJTMhaOkD1k/iMiZdUGnGsDml6F14hv2PbMY9WufP0+3HYhfJpOOZl/fvK25lNvqFFGV0me5SbOSDIKc47qQBJ4rwPTJ4SeWDEkMSuCgzeuZ3SEW8SxkK4WqppvtlXEI9KnPmscqXAK+QqLrsFNf0rEbJiKFU1Ae0FMgyXuIW6OjnKg9fnozIGuocISHEB4fB6F/ywJshz56jc5SM/w4eDHYP7WYmeMX+ZiKsbp0ULsnyGwKJFkAjL/LuSvMXvkgg20F5PShAgMBAAEwDQYJKoZIhvcNAQELBQADggEBADeNPg3exjVRmsZ6Tcyt3pWdMPGDG5Sbc9hOq6yfEHB205wnWQ1J1oswFUFVKxra4dtei8ToRlaYJP7Dk2J2V4RTk33nt35hdxHDnq4Id6zDtiuWN9D3srjqLpH2RwighXn1Agx/rYAXd0jQGT4genqmHUsK5YMOtHVuR1o3PFphTVfOu4gffrmuBna/YXT1gy9XPeKG0pXnxyV/ejWtXKmUNuFAZtToaiMgCWC6evsi4bpH5qRBI3aqgnGy0YXNDfeaJ8Z9FdNlyK9C6cPiHeZWkfaJHDcxXEbJuC9JQsaH/GLpLGRJ9m3GVXUhxHQGvb/sIXDvaJZYbr9rNZ/XsTw=\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,BC7025CBA1D3347A8BD2BCF84BE65C82\n\nEcDfqRFgYjE9z51ZLf2C3FiLweX/8Bcw//avQcv4LV+gTpenyWCc1Vc8B7qtYghO\nfcLBfIjqpR6xzBLJEabAnEN1vhQ7G+12d8dxJ0IYktOsN9KyVNY6XaE39XWzOIy/\nRJ5FfQtSIatYJ4w7gXY/m2CAdth7ZoUCeaxa0YDRtv/ogd++rXbb1TwkR8JyA1ZF\n8vOPQSoM7arzHMkZTYMF3dM1PsVCAB/z8O3US0ltjwQhK9hpIu/k0Vg9urqw2rG9\nu8fEboUFfQ2UCpjDdA+oR2bBr0ZzzIM15Cqb5vd8LI8bB9mOPBYNoSC01HhDKXpT\n4edzPeYT5PD7vALr2xJxFy4W18cfKKmlY/SOpZTlgGyrdXGK+24QAnRZXyOTftqd\n6+7j0X6mokEgiesDeQF9LZROFI49ZlvoK4bZ+JqrvX2kqgaxEogHS0Txt/ZM7eJF\nz1OZPlVrdPhv5b2rVeKwNkZZ4nyYC2vRfZf5aSAA1TUXNKW1pUSNDNU04D7Priz2\n0OwjWXkVbDEMRQZ/Yy/KRleaBiYv1kuBrK776h/DFjOXw+4Qj6IBeq79LNO/7uFg\nJLUBgtJExQ3NQCB+po+SyuWIkojGh30jmlQ8dmGyoEZ9muWJg/E5mTuRPb/Zvx0Y\nkHl8MvMq+7yOTf0Z1PH30ml7o9EiNniAN87ZHiU2KjrQ10eXAVJCVmQIzUh/1/DI\n4ILnxuUtOEDhi/2aec+CJJtY0Pq4+XzHcYMte6rlKnRBiCdQ0yY87vm60BLtYTI1\n9QRf0WfJeujPMO1gq5sJbxMmwLQXgzy0tv9M5wNqkCcPGofr3zE7C1c/TjjqyDCR\nTnf3KndGrcOiMo+Ney4eC3nxoof2anjhaaE5Xbz0tivDbxQ/tVj/fu9+uogavFHL\nj3T3LOUNkjokenbA6FiPnJdhLogMBBA727pBeZ8kmCQRGDvTFvcCRwjdlt+fhVgI\n+lnrWDejbrsRYDS6jQs4ow4KQ7RnP4Cj2a+waaXh9zVHU231rasUkMKgMA/ND6ME\nb6BZzii89lG8Yl0XURWeq/2jnpASX39VwXVKlDxuOpv2CN8TKgRGGlkBy3FgVccz\nWGlqKBjHDjUAyLUoQq/cwktfgGPMD6BFlx6/5O9QMM4FXHeyl97+5pe7X5cjW/Nh\nCacfDn9iA09uijOfUoGZYknVA55I+PwUJsvH1Con6UC2FMmlDhJ3D0vWIphtERQV\nDu1SLwsgTGjb+EbbzrfuQEYntkonCyInH+BSE+H86oALy6gtxgmpFvv9nY+Zyqha\nl+b6yPZJ0RqoydhUUS5Nze+wckGUspkaaUfz19NLBax4wfl1y6ETaKQpmENBnfqJ\n2B9DA4omaECONsE1gkPkULi1fivq8TTEoFGTbHVURLzqvtf6kFlYwmbGwJh4NR50\nuv5APydh4ax2oyqqnXqbp3JolUT4/h7AyhvLm+H3Lqf4thm6HmWZPpaufCrKXw6y\nUO9Q92aa/FkSaSwhTtseFdh2pUjOdEIZuyLtxNJcmHbj/meK03sa1mjGgKAI5Wp3\nP72lhPQM07Ytk6nt2Fod3rZBCxPueB8ilo7whrM0Wdy7B3I7qqBLpqHeP4vGItYR\n-----END RSA PRIVATE KEY-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true
                        }
                    }
                },
                extractFunction: (o) => (o.cert || {}).name
            },
            {
                name: 'clientTLS',
                inputValue: clientTLSInput,
                expectedValue: clientTLSExpected,
                extractFunction: (o) => (o.sslProfile && o.sslProfile.name ? o.sslProfile.name : 'none'),
                referenceObjects: {
                    webtls: {
                        class: 'TLS_Client',
                        trustCA: {
                            bigip: '/Common/default.crt'
                        }
                    }
                }
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('HTTP_2', function () {
        if (util.versionLessThan(getBigIpVersion(), '15.1')) {
            this.skip();
        }
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['http2'],
                expectedValue: ['http2'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'username',
                inputValue: [undefined, 'testUser', undefined],
                expectedValue: [undefined, 'testUser', undefined]
            },
            {
                name: 'clientTLS',
                inputValue: [undefined, { use: 'webtls' }, undefined],
                expectedValue: ['none', 'webtls', 'none'],
                extractFunction: (o) => (o.sslProfile && o.sslProfile.name ? o.sslProfile.name : 'none'),
                referenceObjects: {
                    webtls: {
                        class: 'TLS_Client',
                        trustCA: {
                            bigip: '/Common/default.crt'
                        }
                    }
                }
            },
            {
                name: 'transparent',
                inputValue: [false, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'targetAddress',
                inputValue: ['', '100.0.0.100', ''],
                expectedValue: ['*', '100.0.0.100', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 8080, undefined],
                expectedValue: ['*', '8080', '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'interval',
                inputValue: [undefined, 10, undefined],
                expectedValue: [5, 10, 5]
            },
            {
                name: 'receive',
                inputValue: [undefined, 'up message', undefined],
                expectedValue: ['HTTP/2.', 'up message', 'HTTP/2.']
            },
            {
                name: 'receiveDown',
                inputValue: [undefined, 'down', undefined],
                expectedValue: [undefined, 'down', undefined]
            },
            {
                name: 'send',
                inputValue: [undefined, 'send', undefined],
                expectedValue: ['GET /\\r\\n\\r\\n', 'send', 'GET /\\r\\n\\r\\n']
            },
            {
                name: 'timeUntilUp',
                inputValue: [undefined, 20, undefined],
                expectedValue: [0, 20, 0]
            },
            {
                name: 'timeout',
                inputValue: [undefined, 46, undefined],
                expectedValue: [16, 46, 16]
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('ICMP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['icmp'],
                expectedValue: ['gateway_icmp'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'transparent',
                inputValue: [false, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'targetAddress',
                inputValue: ['', '100.0.0.100', ''],
                expectedValue: ['*', '100.0.0.100', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 8080, undefined],
                expectedValue: ['*', '8080', '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('Inband', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['inband'],
                expectedValue: ['inband'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'failures',
                inputValue: [undefined, 4, undefined],
                expectedValue: [3, 4, 3]
            },
            {
                name: 'failureInterval',
                inputValue: [undefined, 31, undefined],
                expectedValue: [30, 31, 30]
            },
            {
                name: 'responseTime',
                inputValue: [undefined, 11, undefined],
                expectedValue: [10, 11, 10]
            },
            {
                name: 'retryTime',
                inputValue: [undefined, 301, undefined],
                expectedValue: [300, 301, 300]
            }
        ];
        return assertClass('Monitor', properties);
    });

    it('LDAP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['ldap'],
                expectedValue: ['ldap'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'targetAddress',
                inputValue: [undefined, '198.19.192.17', undefined],
                expectedValue: ['*', '198.19.192.17', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 1812, undefined],
                expectedValue: ['*', 1812, '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'interval',
                inputValue: [undefined, 10, undefined],
                expectedValue: [5, 10, 5]
            },
            {
                name: 'upInterval',
                inputValue: [undefined, 15, undefined],
                expectedValue: [0, 15, 0]
            },
            {
                name: 'timeUntilUp',
                inputValue: [undefined, 20, undefined],
                expectedValue: [0, 20, 0]
            },
            {
                name: 'timeout',
                inputValue: [undefined, 46, undefined],
                expectedValue: [16, 46, 16]
            },
            {
                name: 'base',
                inputValue: [undefined, 'dc=bigip-test,dc=org', undefined],
                expectedValue: [undefined, 'dc=bigip-test,dc=org', undefined]
            },
            {
                name: 'chaseReferrals',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'filter',
                inputValue: [undefined, 'objectClass=employee', undefined],
                expectedValue: [undefined, 'objectClass=employee', undefined]
            },
            {
                name: 'security',
                inputValue: [undefined, 'tls', undefined],
                expectedValue: [undefined, 'tls', undefined]
            },
            {
                name: 'mandatoryAttributes',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'username',
                inputValue: [undefined, 'Adm-nM+nkey', undefined],
                expectedValue: [undefined, 'Adm-nM+nkey', undefined]
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    undefined
                ],
                expectedValue: [true],
                extractFunction: () => true
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('RADIUS', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['radius'],
                expectedValue: ['radius'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'targetAddress',
                inputValue: [undefined, '198.19.192.17', '198.19.192.18'],
                expectedValue: ['*', '198.19.192.17', '198.19.192.18'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 1812, 1645],
                expectedValue: ['*', 1812, 1645],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'interval',
                inputValue: [undefined, 10, undefined],
                expectedValue: [5, 10, 5]
            },
            {
                name: 'upInterval',
                inputValue: [undefined, 15, undefined],
                expectedValue: [0, 15, 0]
            },
            {
                name: 'timeUntilUp',
                inputValue: [undefined, 20, undefined],
                expectedValue: [0, 20, 0]
            },
            {
                name: 'timeout',
                inputValue: [undefined, 46, undefined],
                expectedValue: [16, 46, 16]
            },
            {
                name: 'username',
                inputValue: [undefined, 'Adm-nM+nkey', 'B*zzL!ghtyear'],
                expectedValue: [undefined, 'Adm-nM+nkey', 'B*zzL!ghtyear']
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    {
                        ciphertext: 'c2VjcmV0',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    }
                ],
                expectedValue: [true],
                extractFunction: () => true
            },
            {
                name: 'secret',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'c2VjcmV0',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    }
                ],
                expectedValue: [true],
                extractFunction: () => true
            },
            {
                name: 'nasIpAddress',
                inputValue: [undefined, '198.19.192.20', '198.19.192.21'],
                expectedValue: [undefined, '198.19.192.20', '198.19.192.21']
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('SIP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['sip'],
                expectedValue: ['sip'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'protocol',
                inputValue: ['udp', 'sips', 'udp'],
                expectedValue: ['udp', 'sips', 'udp']
            },
            {
                name: 'request',
                inputValue: ['', 'testRequest', ''],
                expectedValue: [undefined, 'testRequest', undefined]
            },
            {
                name: 'headers',
                inputValue: ['', 'test:Header', ''],
                expectedValue: [undefined, 'test:Header', undefined]
            },
            {
                name: 'codesUp',
                inputValue: [[], [100, 101, 102, 200], undefined],
                expectedValue: [undefined, '100 101 102 200', undefined]
            },
            {
                name: 'codesDown',
                inputValue: [[], [400, 500, 600], undefined],
                expectedValue: [undefined, '400 500 600', undefined]
            },
            {
                name: 'ciphers',
                inputValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT'],
                expectedValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT']
            },
            {
                name: 'clientCertificate',
                inputValue: [undefined, 'cert', undefined],
                expectedValue: [undefined, 'default.crt', undefined],
                referenceObjects: {
                    cert: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        }
                    }
                },
                extractFunction: (o) => (o.cert || {}).name
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('SMTP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['smtp'],
                expectedValue: ['smtp'],
                extractFunction: (object) => {
                    if (util.versionLessThan(getBigIpVersion(), '14.0')) {
                        return object.defaultsFrom.split('/').pop();
                    }
                    const parent = object.defaultFrom || object.defaultsFrom;
                    return parent.fullPath.split('/').pop();
                }

            },
            {
                name: 'domain',
                inputValue: ['smtp1.org', 'smtp2.org', 'smtp1.org'],
                expectedValue: ['smtp1.org', 'smtp2.org', 'smtp1.org']
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('TCP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['tcp'],
                expectedValue: ['tcp'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'send',
                inputValue: [undefined, 'ping', undefined],
                expectedValue: [undefined, 'ping', undefined]
            },
            {
                name: 'receive',
                inputValue: [undefined, 'up', undefined],
                expectedValue: [undefined, 'up', undefined]
            },
            {
                name: 'receiveDown',
                inputValue: [undefined, 'down', undefined],
                expectedValue: [undefined, 'down', undefined]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 8080, undefined],
                expectedValue: ['*', '8080', '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'targetAddress',
                inputValue: ['', '100.0.0.100', ''],
                expectedValue: ['*', '100.0.0.100', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('TCP_HALF_OPEN', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['tcp-half-open'],
                expectedValue: ['tcp_half_open'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'transparent',
                inputValue: [false, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'targetAddress',
                inputValue: ['', '100.0.0.100', ''],
                expectedValue: ['*', '100.0.0.100', '*'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'targetPort',
                inputValue: [undefined, 8080, undefined],
                expectedValue: ['*', '8080', '*'],
                extractFunction: (o) => o.destination.split(':')[1]
            }
        ];

        return assertClass('Monitor', properties);
    });

    it('UDP', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['udp'],
                expectedValue: ['udp'],
                extractFunction: (o) => o.defaultsFrom.split('/').pop()
            },
            {
                name: 'send',
                inputValue: [undefined, 'ping', undefined],
                expectedValue: ['default send string', 'ping', 'default send string']
            },
            {
                name: 'receive',
                inputValue: [undefined, 'up', undefined],
                expectedValue: [undefined, 'up', undefined]
            },
            {
                name: 'receiveDown',
                inputValue: [undefined, 'down', undefined],
                expectedValue: [undefined, 'down', undefined]
            }
        ];

        return assertClass('Monitor', properties);
    });

    describe('Database Monitors', () => {
        const testCases = [
            'mysql',
            'postgresql'
        ];
        testCases.forEach((testCase) => {
            it(testCase, () => {
                const properties = [
                    {
                        name: 'monitorType',
                        inputValue: [testCase],
                        expectedValue: [testCase],
                        extractFunction: (o) => o.defaultsFrom.split('/').pop()
                    },
                    {
                        name: 'targetAddress',
                        inputValue: ['', '100.0.0.100', ''],
                        expectedValue: ['*', '100.0.0.100', '*'],
                        extractFunction: (o) => o.destination.split(':')[0]
                    },
                    {
                        name: 'targetPort',
                        inputValue: [undefined, 3306, undefined],
                        expectedValue: ['*', '3306', '*'],
                        extractFunction: (o) => o.destination.split(':')[1]
                    },
                    {
                        name: 'timeUntilUp',
                        inputValue: [undefined, 20, undefined],
                        expectedValue: [0, 20, 0]
                    },
                    {
                        name: 'timeout',
                        inputValue: [undefined, 46, undefined],
                        expectedValue: [16, 46, 16]
                    },
                    {
                        name: 'interval',
                        inputValue: [undefined, 10, undefined],
                        expectedValue: [5, 10, 5]
                    },
                    {
                        name: 'upInterval',
                        inputValue: [undefined, 15, undefined],
                        expectedValue: [0, 15, 0]
                    },
                    {
                        name: 'count',
                        inputValue: [undefined, 10, undefined],
                        expectedValue: ['0', '10', '0']
                    },
                    {
                        name: 'database',
                        inputValue: [undefined, 'test_db.people', undefined],
                        expectedValue: [undefined, 'test_db.people', undefined]
                    },
                    {
                        name: 'username',
                        inputValue: [undefined, 'sql-user', undefined],
                        expectedValue: [undefined, 'sql-user', undefined]
                    },
                    {
                        name: 'passphrase',
                        inputValue: [
                            undefined,
                            {
                                ciphertext: 'ZjVmNQ==',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                                ignoreChanges: true
                            },
                            undefined
                        ],
                        expectedValue: [true],
                        extractFunction: () => true
                    },
                    {
                        name: 'send',
                        inputValue: [undefined, 'SELECT id,first_name,last_name', undefined],
                        expectedValue: [undefined, 'SELECT id,first_name,last_name', undefined]
                    },
                    {
                        name: 'receive',
                        inputValue: [undefined, 'Thomas', undefined],
                        expectedValue: [undefined, 'Thomas', undefined]
                    },
                    {
                        name: 'receiveColumn',
                        inputValue: [undefined, 2, undefined],
                        expectedValue: [undefined, '2', undefined]
                    },
                    {
                        name: 'receiveRow',
                        inputValue: [undefined, 3, undefined],
                        expectedValue: [undefined, '3', undefined]
                    }
                ];

                return assertClass('Monitor', properties);
            });
        });
    });
});

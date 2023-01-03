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

const {
    assertClass,
    assertModuleProvisioned,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const constants = require('../../../../src/lib/constants');
const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

describe('GSLB Monitors', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    function assertGSLBMonitorClass(properties) {
        return assertClass('GSLB_Monitor', properties);
    }

    it('GSLB HTTP Monitor', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'monitorType',
                inputValue: ['http'],
                expectedValue: ['/Common/http'],
                extractFunction: (o) => o.defaultsFrom
            },
            {
                name: 'target',
                inputValue: [undefined, '1.1.1.1:80', undefined],
                expectedValue: ['*:*', '1.1.1.1:80', '*:*'],
                extractFunction: (o) => o.destination
            },
            {
                name: 'interval',
                inputValue: [undefined, 100, undefined],
                expectedValue: [30, 100, 30]
            },
            {
                name: 'timeout',
                inputValue: [undefined, 1000, undefined],
                expectedValue: [120, 1000, 120]
            },
            {
                name: 'probeTimeout',
                inputValue: [undefined, 110, undefined],
                expectedValue: [5, 110, 5]
            },
            {
                name: 'ignoreDownResponseEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.ignoreDownResponse
            },
            {
                name: 'transparent',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'reverseEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.reverse
            },
            {
                name: 'send',
                inputValue: [undefined, 'HEAD / HTTP/1.0\\r\\n', undefined],
                expectedValue: ['HEAD / HTTP/1.0\\r\\n\\r\\n', 'HEAD / HTTP/1.0\\r\\n', 'HEAD / HTTP/1.0\\r\\n\\r\\n']
            },
            {
                name: 'receive',
                inputValue: [undefined, 'HTTP', undefined],
                expectedValue: ['HTTP/1.', 'HTTP', 'HTTP/1.']
            }
        ];
        return assertGSLBMonitorClass(properties);
    });

    it('GSLB HTTPS Monitor', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['https'],
                expectedValue: ['/Common/https'],
                extractFunction: (o) => o.defaultsFrom
            },
            {
                name: 'ciphers',
                inputValue: [undefined, 'DEFAULT:+SHA:+3DES', undefined],
                expectedValue: ['DEFAULT', 'DEFAULT:+SHA:+3DES', 'DEFAULT'],
                extractFunction: (o) => o.cipherlist
            },
            {
                name: 'clientCertificate',
                inputValue: [undefined, 'theCert', undefined],
                expectedValue: [undefined, 'theCert.crt', undefined],
                extractFunction: (o) => (o.cert || {}).name,
                referenceObjects: {
                    theCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ignoreChanges: true,
                            miniJWE: true,
                            allowReuse: false
                        },
                        chainCA: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----'
                    }
                }
            }
        ];
        return assertGSLBMonitorClass(properties);
    });

    it('GSLB ICMP Monitor', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['gateway-icmp'],
                expectedValue: ['/Common/gateway_icmp'],
                extractFunction: (o) => o.defaultsFrom
            },
            {
                name: 'probeAttempts',
                inputValue: [undefined, 25, undefined],
                expectedValue: [3, 25, 3]
            },
            {
                name: 'probeInterval',
                inputValue: [undefined, 33, undefined],
                expectedValue: [1, 33, 1]
            }
        ];
        return assertGSLBMonitorClass(properties);
    });

    it('GSLB TCP Monitor', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['tcp'],
                expectedValue: ['/Common/tcp'],
                extractFunction: (o) => o.defaultsFrom
            }
        ];
        return assertGSLBMonitorClass(properties);
    });

    it('GSLB UDP Monitor', () => {
        const properties = [
            {
                name: 'monitorType',
                inputValue: ['udp'],
                expectedValue: ['/Common/udp'],
                extractFunction: (o) => o.defaultsFrom
            },
            {
                name: 'debugEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no'],
                extractFunction: (o) => o.debug
            }
        ];
        return assertGSLBMonitorClass(properties);
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
                inputValue: ['/Common/arg_example'],
                expectedValue: ['/Common/arg_example'],
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

        return assertGSLBMonitorClass(properties);
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
                    expectedValue: [`/TEST_GSLB_Monitor/Application/${getItemName({ tenantName: 'TEST_GSLB_Monitor', maxPathLength: MAX_PATH_LENGTH })}${POSTFIX}`],
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
            .then(() => assertClass('GSLB_Monitor', properties, { maxPathLength: MAX_PATH_LENGTH }));
    });
});

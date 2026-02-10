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

describe('Rewrite_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertRewriteProfileClass(properties) {
        return assertClass('Rewrite_Profile', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'bypassList',
                inputValue: [
                    undefined,
                    [
                        'https://www.google.com', 'http://www.a.uri.com'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['https://www.google.com', 'http://www.a.uri.com'],
                    []
                ]
            },
            {
                name: 'clientCachingType',
                inputValue: [undefined, 'no-cache', undefined],
                expectedValue: ['cache-css-js', 'no-cache', 'cache-css-js']
            },
            {
                name: 'javaCaFile',
                inputValue: [
                    undefined,
                    {
                        bigip: '/Common/default.crt'
                    },
                    undefined
                ],
                expectedValue: [
                    'ca-bundle.crt',
                    'default.crt',
                    'ca-bundle.crt'
                ],
                extractFunction: (o) => o.javaCaFile.name
            },
            {
                name: 'certificate',
                inputValue: [
                    undefined,
                    'cert_and_key_with_bundle',
                    undefined
                ],
                expectedValue: [
                    'default.crt',
                    'cert_and_key_with_bundle.crt',
                    'default.crt'
                ],
                referenceObjects: {
                    cert_and_key_with_bundle: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDkzCCAnsCCQCelZ2yaSZ+CzANBgkqhkiG9w0BAQUFADCBkDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxCzAJBgNVBAoMAkY1MQ0wCwYDVQQLDARUZXN0MRcwFQYDVQQDDA50ZXN0X0NBX2J1bmRsZTElMCMGCSqGSIb3DQEJARYWc29tZWJvZHlAc29tZXdoZXJlLm9yZzAeFw0xODAyMjcxOTI1MTFaFw0xODAzMjkxOTI1MTFaMIGFMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxDDAKBgNVBAMMA2NzcjElMCMGCSqGSIb3DQEJARYWc29tZWJvZHlAc29tZXdoZXJlLm9yZzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ4uYuaiZpVWDPAemHjPQNfalBkXCfht4QrrqNi9qt8CHLpk8lcLaylIrGn32OjlMQI+pyXckK08fJ7876HH5L6cHCEyqcII99L6LZFrvewXG17vP9gSYlT5i0NpPvKOCKaJ0r5evOUdzTNzC+aT5pLne1WYaw+hz8XP0R4XDKMbV6qLOuQ8/kZIMbUoOaymZ4TYHJm6cYZkzegQJSr5TRW9JwwChJdqSqji+o8f35ZTdsnAJyQp9tGIuhLu7tIaqsl/me21sGwbRp26ngPBhas4BX8WIMYWnwFn9pKDvpnegsM/eKPBNtMZkuSNhx1gdwzrbHCeFQNRQLs1nXY/08UCAwEAATANBgkqhkiG9w0BAQUFAAOCAQEATGyMBCUNgR6kJgX+R3HWLvyc6mCfgPyC6xtkv3DMgDP7j9n/8nWiiY6pvw2rT6C0PI0EmS9vn5+esOHcAfN3ftBwhEyZu3MPJYtchQVw7gnwB5EFzy8+7Y4ZGAf9mcKZuxiLXTC5H4GZ/MBia7inQPmzBNeP5T0y4WtIuQl2JOjMN8fa5yCkhV3WLBt1encAa2gPceuv21w1H29lOdNBJxCGvwGGvpEvJgqeZ8SSYcyUSfNFwQKJgZZPPfM5hQBBFj15UQoQ7GubyNfF4RpVifTVn+G+LfJ6vfVIr7hw9tBUZxnsVaZwryRdwkXifytq4JYvYUI84seDmTnJJX/TVA==\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEAni5i5qJmlVYM8B6YeM9A19qUGRcJ+G3hCuuo2L2q3wIcumTyVwtrKUisaffY6OUxAj6nJdyQrTx8nvzvocfkvpwcITKpwgj30votkWu97BcbXu8/2BJiVPmLQ2k+8o4IponSvl685R3NM3ML5pPmkud7VZhrD6HPxc/RHhcMoxtXqos65Dz+RkgxtSg5rKZnhNgcmbpxhmTN6BAlKvlNFb0nDAKEl2pKqOL6jx/fllN2ycAnJCn20Yi6Eu7u0hqqyX+Z7bWwbBtGnbqeA8GFqzgFfxYgxhafAWf2koO+md6Cwz94o8E20xmS5I2HHWB3DOtscJ4VA1FAuzWddj/TxQIDAQABAoIBAB/MpXdGGKdW6Dzxead3yspaF8G/fvKhbEdcvtHrt0kjzJCwMIPNONrQ0FBxUfrn8GVKISIcaD1bVpZDtQzp+ZNUINePrs7iLKgOQVDlvwWSU59PK5+NepUooZWIt+3dHeIU/PfmZcUNq633J+JPw1+vB31aqdM3rWRP9fM9oP289TQhrd0QdfsWTvSVUC+OFZoGJtx3nz+9AFUZZ+dPSIWPrxuGp6CoRqgGVtQvxJPODV3t+9nSzqEZ5snsg6WCSV+VjPNVlI2OKZsT9DR0Qz0XDQBtcF9qMlOPxj0P2ektgdEODUnHXUreBfVIs1n8By5OQ1j6DhtsEU8AHDigPGECgYEA3A5x3cOxzwVP6cPsmRIcmrHiWutgIzIni3cvtGLzTKNLzHmH4oqI/pcdRVqMPLPQ7HF5ATL/m2IT/t8Cd/kU7QwRx02r88kxbp4qVFKk7paES+N/Kx9T3tX6u8VlslYi3Ff1xONN6wwBIEhuUWNhEAkiqb7xYw3256Cm883Lgy0CgYEAuASofZ7MX7QSah+DAD6MQ8bl9iu/1kxiaOR0snF+poZMCKXqFbIt4xRMYphXiqS/Li9og9rEucEEEu+eZl66BZjrjHaGDpK7sU6Y1PalLL++x4LJmZdmPvW80mculYDan266zUSCKL1Vyz81829bWG9sAUGhDfQlEv8N/PF8UfkCgYEAg1CLWk6hGGyPF2w3D9DjCN0FukOjBt2zA2KIMRirHxyC6u3KzMDmpyX97Zju/no/PhkooDKSnWKVlA34JyeX+Syun0QWTE/PE7eGgvMeQNHI+JA1HsJ/BgairNJKsXT9MIe8vVT29kAfm+gdDKxFC5CoAqtS2E1I/Ue82NgBjbECgYEAkjgJVgAXbzhbpX2yj0AkHjruQWRUA8kgLS7S13O9aj6uLfUAAwtY0OYxJ+rbLKxpyR4ckyEDToJjZVSHbdp5P7dZ+3u2W+AWSfYlFJuDdgJKaqeu319g/EgxKJKafmsrzKGkxzRXpF2FzYFFslBaqfOnQ3xNqBPGXcjS6ZlM6qkCgYEAoSznkVO3Vc3aIOoTvCwVQQeCDjbYZQTH3AVH+JYiqTbjl5F+u4ccF3896vBwl+2zSDsuk4cBkQyoO5f8KLlLYTuKRaP2QS2Ubh14BXyj6kwHPXgc35meiY2tun55PuNJfNYMCzPS9NNj+GbIkaUy/oYiDQrQqLWQ73flFX/x3Po=\n-----END RSA PRIVATE KEY-----',
                        chainCA: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----'
                    }
                },
                extractFunction: (o) => o.javaSigner.name
            },
            {
                name: 'javaSignKeyPassphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    '',
                    undefined
                ],
                skipAssert: true
            },
            {
                name: 'locationSpecificEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'requestSettings',
                inputValue: [
                    undefined,
                    {
                        insertXforwardedForEnabled: false,
                        insertXforwardedHostEnabled: true,
                        insertXforwardedProtoEnabled: true,
                        rewriteHeadersEnabled: false
                    },
                    undefined
                ],
                expectedValue: [
                    {
                        insertXforwardedFor: 'enabled',
                        insertXforwardedHost: 'disabled',
                        insertXforwardedProto: 'disabled',
                        rewriteHeaders: 'enabled'
                    },
                    {
                        insertXforwardedFor: 'disabled',
                        insertXforwardedHost: 'enabled',
                        insertXforwardedProto: 'enabled',
                        rewriteHeaders: 'disabled'
                    },
                    {
                        insertXforwardedFor: 'enabled',
                        insertXforwardedHost: 'disabled',
                        insertXforwardedProto: 'disabled',
                        rewriteHeaders: 'enabled'
                    }
                ]
            },
            {
                name: 'responseSettings',
                inputValue: [
                    undefined,
                    {
                        rewriteContentEnabled: false,
                        rewriteHeadersEnabled: false
                    },
                    undefined
                ],
                expectedValue: [
                    {
                        rewriteContent: 'enabled',
                        rewriteHeaders: 'enabled'
                    },
                    {
                        rewriteContent: 'disabled',
                        rewriteHeaders: 'disabled'
                    },
                    {
                        rewriteContent: 'enabled',
                        rewriteHeaders: 'enabled'
                    }
                ]
            },
            {
                name: 'rewriteList',
                inputValue: [
                    undefined,
                    ['https://www.example.com', 'https://www.rewritethis.net'],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['https://www.example.com', 'https://www.rewritethis.net'],
                    []
                ]
            },
            {
                name: 'rewriteMode',
                inputValue: [
                    undefined,
                    'uri-translation',
                    undefined
                ],
                expectedValue: [
                    'portal', 'uri-translation', 'portal'
                ]
            },
            {
                name: 'setCookieRules',
                inputValue: [
                    undefined,
                    [
                        {
                            client: {
                                domain: 'clientDomain1',
                                path: '/'
                            },
                            server: {
                                domain: 'serverDomain1',
                                path: '/'
                            }
                        },
                        {
                            client: {
                                domain: 'clientDomain2',
                                path: '/'
                            },
                            server: {
                                domain: 'serverDomain2',
                                path: '/'
                            }
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    [
                        {
                            name: '0',
                            client: {
                                domain: 'clientDomain1',
                                path: '/'
                            },
                            server: {
                                domain: 'serverDomain1',
                                path: '/'
                            }
                        },
                        {
                            name: '1',
                            client: {
                                domain: 'clientDomain2',
                                path: '/'
                            },
                            server: {
                                domain: 'serverDomain2',
                                path: '/'
                            }
                        }
                    ],
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.setCookieRules) {
                        o.setCookieRules.forEach((rule) => {
                            delete rule.appService;
                        });
                        return o.setCookieRules;
                    }
                    return undefined;
                }
            },
            {
                name: 'splitTunnelingEnabled',
                inputValue: [
                    undefined, true, undefined
                ],
                expectedValue: [
                    'false',
                    'true',
                    'false'
                ]
            },
            {
                name: 'uriRules',
                inputValue: [
                    undefined,
                    [
                        {
                            type: 'response',
                            client: {
                                path: '/',
                                host: 'www.google.com',
                                scheme: 'https',
                                port: '100'
                            },
                            server: {
                                path: '/',
                                host: 'www.example.com',
                                scheme: 'http',
                                port: '80'
                            }
                        },
                        {
                            type: 'request',
                            client: {
                                path: '/'
                            },
                            server: {
                                path: '/'
                            }
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            name: '0',
                            type: 'response',
                            client: {
                                path: '/',
                                host: 'www.google.com',
                                scheme: 'https',
                                port: '100'
                            },
                            server: {
                                path: '/',
                                host: 'www.example.com',
                                scheme: 'http',
                                port: '80'
                            }
                        },
                        {
                            name: '1',
                            type: 'request',
                            client: {
                                path: '/',
                                host: 'none',
                                scheme: 'none',
                                port: 'none'
                            },
                            server: {
                                path: '/',
                                host: 'none',
                                scheme: 'none',
                                port: 'none'
                            }
                        }
                    ],
                    []
                ],
                extractFunction: (o) => {
                    if (o.uriRules) {
                        o.uriRules.forEach((rule) => {
                            delete rule.fullPath;
                            delete rule.generation;
                            delete rule.kind;
                            delete rule.selfLink;
                            delete rule.appService;
                        });
                        return o.uriRules;
                    }
                    return [];
                }
            }
        ];
        return assertRewriteProfileClass(properties);
    });
});

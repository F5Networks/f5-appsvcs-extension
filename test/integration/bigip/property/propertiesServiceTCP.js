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
    extractProfile,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Service_TCP', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should build a virtual server with built in SIP profile', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                expectedValue: ['8080'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.10']],
                expectedValue: ['1.1.1.10'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            },
            {
                name: 'profileSIP',
                inputValue: [undefined, { bigip: '/Common/sip' }, undefined],
                expectedValue: [undefined, 'sip', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'sip')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with built in SSH profile', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileSSHProxy',
                inputValue: [undefined, { bigip: '/Common/ssh' }, undefined],
                expectedValue: [undefined, 'ssh', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'ssh')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with built in TCP Analytics profile', function () {
        assertModuleProvisioned.call(this, 'avr');

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileAnalyticsTcp',
                inputValue: [undefined, { bigip: '/Common/tcp-analytics' }, undefined],
                expectedValue: [undefined, 'tcp-analytics', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'tcp-analytics')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with built in RTSP profile', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileRTSP',
                inputValue: [undefined, { bigip: '/Common/rtsp' }, undefined],
                expectedValue: [undefined, 'rtsp', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'rtsp')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with built in SOCKS profile', () => {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: 'testResolver',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileSOCKS',
                inputValue: [undefined, { use: 'socksProfile' }, undefined],
                expectedValue: [undefined, 'socksProfile', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'socksProfile'),
                referenceObjects: {
                    socksProfile: {
                        class: 'SOCKS_Profile',
                        resolver: {
                            bigip: '/Common/testResolver'
                        }
                    }
                }
            }
        ];
        return assertClass('Service_TCP', properties, options);
    });

    it('should build a virtual server with built in DOS profile', function () {
        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileDOS',
                inputValue: [undefined, { bigip: '/Common/dos' }, undefined],
                expectedValue: [undefined, 'dos', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'dos')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with built in PPTP profile', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profilePPTP',
                inputValue: [undefined, { bigip: '/Common/pptp' }, undefined],
                expectedValue: [undefined, 'pptp', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'pptp')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with built in MQTT profile', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'mqttEnabled',
                inputValue: [false, true, false],
                expectedValue: [undefined, 'mqtt', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'mqtt')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build an internal virtual server with built in ICAP profile', function () {
        const properties = [
            {
                name: 'virtualType',
                inputValue: ['internal'],
                skipAssert: true
            },
            {
                name: 'sourceAddress',
                inputValue: ['192.0.2.0/24'],
                skipAssert: true
            },
            {
                name: 'profileICAP',
                inputValue: [undefined, { bigip: '/Common/icap' }, undefined],
                expectedValue: [undefined, 'icap', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'icap')
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should build a virtual server with a service down immediate action', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [123],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'serviceDownImmediateAction',
                inputValue: [undefined, 'drop', undefined],
                expectedValue: ['none', 'drop', 'none']
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should be connected to both a TLS_Server and clientside LDAP Profile', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'serverTLS',
                inputValue: [undefined, 'servertls', undefined],
                expectedValue: ['undefined+undefined', 'servertls+f5_appsvcs_clientside_allow', 'undefined+undefined'],
                extractFunction: (virtual) => `${extractProfile(virtual, 'servertls')}+${extractProfile(virtual, 'f5_appsvcs_clientside_allow')}`,
                referenceObjects: {
                    servertls: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'tlsservercert'
                            }
                        ],
                        ldapStartTLS: 'allow'
                    },
                    tlsservercert: {
                        class: 'Certificate',
                        remark: 'in practice using a passphrase is recommended',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIID7TCCAtWgAwIBAgIJAJH4sMVzl1dMMA0GCSqGSIb3DQEBCwUAMIGMMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxEzARBgNVBAMMCnRscy1zZXJ2ZXIxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI4MTkwNzMyWhcNMjgwMjI2MTkwNzMyWjCBjDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxCzAJBgNVBAoMAkY1MQ0wCwYDVQQLDARUZXN0MRMwEQYDVQQDDAp0bHMtc2VydmVyMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwEMNPATg7Vz3jqInIVf2jnOi/9/HYIr8xZYgU0YHHFEiquQ6nYfX4mwezZ6zo9GJom7gHiQ3FNy3fN+RatatZmBmuyvJ+z/uZ6pbKmsuJLPLT89olO9JxMtb4a83oHDz3f6rcc2j8KwTr4lUDc452jLF4ZQ55O17s2tYMg4XW2G5DqUGzp1UKiClaDvpN23ZVOlnqDVpIlnVvJ1mz12AzFPny8xD1lhILv78yMltimdaWhyCLcFom0DbloRvYmowjGLHqLTAZ40jI3YUdw39LEqTXgfDF3DnOgZCIdRpouD9cVZBoQroXpVVfWG7sfzKLqWaAEHhjbhdK5l/p3mT7wIDAQABo1AwTjAdBgNVHQ4EFgQUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwHwYDVR0jBBgwFoAUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAuiE5MocznYDc+JHvEgSaiK9fyRBl/bitKTkiOtxWjEFpF5nH6QddV0pqQziXLb6iSbTBwlDJr9Bwzng8moOYbsD7hP2/mCKJj8o/lsRaPAk+abekWXRqYFNucct/ipBG3s+N2PH+MEpy3ioPH1OBuam6UomjE+mqoP09FrQha1hHEbabt4nN11l8fM5GW+0zRU0SwLFvnR58zUSlTMwczSPA0eUrhEU4AGPD/KN8d1fYnCcWqPF5ePcU11k7SNFl5PZQsgXv9cOc2Vq+qc/NmDBO0rQyKEAPDxbM8CK212G1M+ENTqmuePnr+mNope3AhEsqfH8IOPEoT7fIwmpqLw==\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAQw08BODtXPeOoichV/aOc6L/38dgivzFliBTRgccUSKq5Dqdh9fibB7NnrOj0YmibuAeJDcU3Ld835Fq1q1mYGa7K8n7P+5nqlsqay4ks8tPz2iU70nEy1vhrzegcPPd/qtxzaPwrBOviVQNzjnaMsXhlDnk7Xuza1gyDhdbYbkOpQbOnVQqIKVoO+k3bdlU6WeoNWkiWdW8nWbPXYDMU+fLzEPWWEgu/vzIyW2KZ1paHIItwWibQNuWhG9iajCMYseotMBnjSMjdhR3Df0sSpNeB8MXcOc6BkIh1Gmi4P1xVkGhCuhelVV9Ybux/MoupZoAQeGNuF0rmX+neZPvAgMBAAECggEAHm3eV9v7z4WRxtjiMZRO+Q/TQgUkdKK6y/jtR9DDClfLEVoK7ujTocnz/B48l1ZwHq3Gue6IazxdrB1kUhEFI7lpOQF+t83QCUc8o5OQG437RTfx+PSAa+21rpwBRVrrNfz7HIlsA4jwmq01CPRVUrQLfp7rpNBzbhu0u0Ngrf0ccOwXZkEUVvZ55WaPY1YADI9PBExQ2k04LvHJjoz/tJH3nsQLA/+90UXqy8ctUSMJ8Ko3crxJhnIO91BtCugkgS+U+pTEnvdAebE4pd7J5e6qqEyCu9F3DC5R6hH+K8bAj76VGwjxOr9a90o/js92HoCVAlQMHnW06Uk2RdIRmQKBgQD0uQPlA2PLBysWA+IQvd8oBfZuXWQjUZPBU9MK5k7bfuRbNeCA2kbTt1MVf15lv7vcwrwAbYo+Ur+L9CVL3lA8d/lQkz51r1ISChTPUiAMyU+CDDnXjQ1Gik/nC399AeluxS62Tur8hGPAb4rkVEyU60hPFVZTjmv13n81EjUoNwKBgQDJHyiPIgbwI+OoZYMUcGQrsr+yp1MdJrjpuFloc7+sdUpsvelyc146h3+TSAlhDce2BMH68kMUWUYHxHIooQjtDMu9S9b8VAF52F3E9osyjMzsywTri3hgBPy69j/Kr623gbZpbm6lYmdxRp/FKZyWtAbPts45GH1GPdv+9fUmCQKBgQCX7CfDy1fvWXLhBuYXuJfJs/HpT+bzmhgdA5nXgWRhFSRUj1zhASDJHFzi0qBakC3i/a1Soq4YxKwPCTECKXAsKdrHr7Etw/oyIroKfpRQ+8R1GnvqGbGtIf46k8PAaihtUNIP8Wwl+VYnx9c0qjSkmm/YUIm384mIKGlWHAiN/wKBgDV5bF5KLNASqsguXWDE1U1tFF0a8hVRI185HcSQ6gifku9Au14r4ITtW/U79QpyEISL1Uu0uDMj3WPZToUQ8/+bJFyrWnjymQXdimkBKFeDakUXYbKC/bmB+fR33tQ0S5r8CRUVQKQGevx6S6avfqvvJ9R4hXJW2ZAgiGrM2KaJAoGAPXuy4KHRmeeBZj8AT/shQ0VrDWIMNYDrhx0T6q9hVMahBS0SJaKDlQn6cSF7TX5N9PFAbwzcrvRKKfNjQVSZpQdR4l42f+N/5q0c1wihf43k9FgeYQ8jHGJ05uJnh3nj/O57FKgjlZ4FZVQdR8ieHN+rT4sHWj36a/FLHa6p1oo=\n-----END PRIVATE KEY-----'
                    }
                }
            }
        ];

        return assertClass('Service_TCP', properties);
    });

    it('should be connected to both a TLS_Client and serverside LDAP Profile', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'clientTLS',
                inputValue: [undefined, 'clienttls', undefined],
                expectedValue: ['undefined+undefined', 'clienttls+f5_appsvcs_serverside_require', 'undefined+undefined'],
                extractFunction: (virtual) => `${extractProfile(virtual, 'clienttls')}+${extractProfile(virtual, 'f5_appsvcs_serverside_require')}`,
                referenceObjects: {
                    clienttls: {
                        class: 'TLS_Client',
                        ldapStartTLS: 'require'
                    }
                }
            }
        ];
        return assertClass('Service_TCP', properties);
    });

    it('should create a VS referring to multiple client-ssl and server-ssl profiles', () => {
        const bigipItems = [
            {
                endpoint: '/mgmt/tm/ltm/profile/client-ssl',
                data: {
                    name: 'clientssl1',
                    serverName: 'server1.example.com',
                    sniDefault: true
                }
            },
            {
                endpoint: '/mgmt/tm/ltm/profile/client-ssl',
                data: {
                    name: 'clientssl2',
                    serverName: 'server2.example.com'
                }
            },
            {
                endpoint: '/mgmt/tm/ltm/profile/server-ssl',
                data: {
                    name: 'serverssl1',
                    sniDefault: true
                }
            },
            {
                endpoint: '/mgmt/tm/ltm/profile/server-ssl',
                data: {
                    name: 'serverssl2'
                }
            }
        ];

        const options = {
            bigipItems
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'clientTLS',
                inputValue: [undefined, [{ bigip: '/Common/serverssl1' }, { bigip: '/Common/serverssl2' }], undefined],
                expectedValue: ['undefined+undefined', 'serverssl1+serverssl2', 'undefined+undefined'],
                extractFunction: (virtual) => `${extractProfile(virtual, 'serverssl1')}+${extractProfile(virtual, 'serverssl2')}`
            },
            {
                name: 'serverTLS',
                inputValue: [undefined, [{ bigip: '/Common/clientssl1' }, { bigip: '/Common/clientssl2' }], undefined],
                expectedValue: ['undefined+undefined', 'clientssl1+clientssl2', 'undefined+undefined'],
                extractFunction: (virtual) => `${extractProfile(virtual, 'clientssl1')}+${extractProfile(virtual, 'clientssl2')}`
            }
        ];
        return assertClass('Service_TCP', properties, options);
    });

    it('should create a VS with profileILX', function () {
        assertModuleProvisioned.call(this, 'ilx');

        const bigipItems = [
            {
                endpoint: '/mgmt/tm/ilx/workspace',
                data: { name: 'Test' }
            },
            {
                endpoint: '/mgmt/tm/ilx/workspace?options=extension,TestExt',
                data: { name: 'Test' },
                skipDelete: true
            },
            {
                endpoint: '/mgmt/tm/ilx/plugin',
                data: { name: 'TestPlugin', fromWorkspace: '/Common/Test' }
            },
            {
                endpoint: '/mgmt/tm/ltm/profile/ilx',
                data: { name: 'testProfile', plugin: '/Common/TestPlugin' }
            }
        ];

        const options = {
            bigipItems
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                expectedValue: ['8080'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.10']],
                expectedValue: ['1.1.1.10'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            },
            {
                name: 'profileILX',
                inputValue: [undefined, { bigip: '/Common/testProfile' }],
                expectedValue: [undefined, 'testProfile'],
                extractFunction: (virtual) => extractProfile(virtual, 'testProfile')
            }
        ];
        return assertClass('Service_TCP', properties, options);
    });

    it('should build a virtual server in Common Shared with shareAddresses', function () {
        const options = {
            tenantName: 'Common',
            applicationName: 'Shared'
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                expectedValue: ['8080'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.10'], ['1.1.1.11'], ['1.1.1.10']],
                expectedValue: ['/Common/Shared/1.1.1.10', '/Common/1.1.1.11', '/Common/Shared/1.1.1.10'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'shareAddresses',
                inputValue: [false, true, false],
                skipAssert: true
            }
        ];
        return assertClass('Service_TCP', properties, options);
    });
});

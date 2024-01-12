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
    extractProfile,
    createVlan,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Service_UDP', function () {
    this.timeout(GLOBAL_TIMEOUT);

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

        return assertClass('Service_UDP', properties);
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
        return assertClass('Service_UDP', properties);
    });

    it('with built in SIP profile', () => {
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
                name: 'profileSIP',
                inputValue: [undefined, { bigip: '/Common/sip' }, undefined],
                expectedValue: [undefined, 'sip', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'sip')
            }
        ];
        return assertClass('Service_UDP', properties);
    });

    it('with built in statistics profile', () => {
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
                name: 'profileStatistics',
                inputValue: [undefined, { bigip: '/Common/stats' }, undefined],
                expectedValue: [undefined, 'stats', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'stats')
            }
        ];
        return assertClass('Service_UDP', properties);
    });

    it('with built in TFTP profile', () => {
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
                name: 'profileTFTP',
                inputValue: [undefined, { bigip: '/Common/tftp' }, undefined],
                expectedValue: [undefined, 'tftp', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'tftp')
            }
        ];
        return assertClass('Service_UDP', properties);
    });

    it('should handle VLANs when virtual type is standard', () => {
        // why no VLANs test for virtualType 'internal'?
        // virtualType 'internal' on BIGIP does not support VLANs
        const testVlan = 'internal';

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
                name: 'allowVlans',
                inputValue: [undefined, [{ bigip: '/Common/internal' }], undefined, undefined],
                expectedValue: ['default', 'internal', 'rejectVlans', 'default'],
                extractFunction: ((o) => {
                    if (o.vlansDisabled === true) {
                        // the allowVlans and rejectVlans properties are intertwined
                        // if the extractFunction senses this is a rejecVlans case it will return 'rejectVlans'
                        return typeof o.vlans === 'undefined' ? 'default' : 'rejectVlans';
                    }
                    if (o.vlansEnabled === true && Array.isArray(o.vlans) && o.vlans.length === 1) {
                        return o.vlans[0].name;
                    }
                    return 'failed to determine extracted value';
                })
            },
            {
                name: 'rejectVlans',
                inputValue: [undefined, undefined, [{ bigip: '/Common/internal' }], undefined],
                expectedValue: ['default', 'allowVlans', 'internal', 'default'],
                extractFunction: ((o) => {
                    if (o.vlansDisabled === true) {
                        if (typeof o.vlans === 'undefined') {
                            return 'default';
                        }
                        if (Array.isArray(o.vlans) && o.vlans.length === 1) {
                            return o.vlans[0].name;
                        }
                    }
                    // the allowVlans and rejectVlans properties are intertwined
                    // if the extractFunction senses this is an allowVlans case it will return 'allowVlans'
                    if (o.vlansEnabled === true) {
                        return 'allowVlans';
                    }
                    return 'failed to determine extracted value';
                })
            }
        ];

        return Promise.resolve()
            .then(() => {
                if (process.env.DRY_RUN !== 'true') {
                    return createVlan(testVlan);
                }
                return Promise.resolve();
            })
            .then(() => assertClass('Service_UDP', properties));
    });

    it('should handle VLANs when virtual type is stateless', () => {
        // why no VLANs test for virtualType 'internal'?
        // virtualType 'internal' on BIGIP does not support VLANs
        const testVlan = 'internal';

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/pool',
                    data: {
                        name: 'testPool',
                        partition: 'Common'
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
                name: 'virtualType',
                inputValue: ['stateless'],
                expectedValue: [true],
                extractFunction: (o) => (o.stateless ? true : 'unknown')
            },
            {
                name: 'translateClientPort',
                inputValue: [false],
                skipAssert: true
            },
            {
                name: 'translateServerPort',
                inputValue: [false],
                skipAssert: true
            },
            {
                name: 'pool',
                inputValue: [{ bigip: '/Common/testPool' }],
                skipAssert: true
            },
            {
                name: 'allowVlans',
                inputValue: [undefined, [{ bigip: '/Common/internal' }], undefined, undefined],
                expectedValue: ['default', 'internal', 'rejectVlans', 'default'],
                extractFunction: ((o) => {
                    if (o.vlansDisabled === true) {
                        // the allowVlans and rejectVlans properties are intertwined
                        // if the extractFunction senses this is a rejecVlans case it will return 'rejectVlans'
                        return typeof o.vlans === 'undefined' ? 'default' : 'rejectVlans';
                    }
                    if (o.vlansEnabled === true && Array.isArray(o.vlans) && o.vlans.length === 1) {
                        return o.vlans[0].name;
                    }
                    return 'failed to determine extracted value';
                })
            },
            {
                name: 'rejectVlans',
                inputValue: [undefined, undefined, [{ bigip: '/Common/internal' }], undefined],
                expectedValue: ['default', 'allowVlans', 'internal', 'default'],
                extractFunction: ((o) => {
                    if (o.vlansDisabled === true) {
                        if (typeof o.vlans === 'undefined') {
                            return 'default';
                        }
                        if (Array.isArray(o.vlans) && o.vlans.length === 1) {
                            return o.vlans[0].name;
                        }
                    }
                    // the allowVlans and rejectVlans properties are intertwined
                    // if the extractFunction senses this is an allowVlans case it will return 'allowVlans'
                    if (o.vlansEnabled === true) {
                        return 'allowVlans';
                    }
                    return 'failed to determine extracted value';
                })
            }
        ];

        return Promise.resolve()
            .then(() => {
                if (process.env.DRY_RUN !== 'true') {
                    return createVlan(testVlan);
                }
                return Promise.resolve();
            })
            .then(() => assertClass('Service_UDP', properties, options));
    });

    it('should transition through virtual types', () => {
        const options = {
            // the bigd service sometimes restarts causing the next set of tests to fail
            checkServices: true,
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/pool',
                    data: {
                        name: 'testPool',
                        partition: 'Common'
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080, undefined, 53, 8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'virtualType',
                inputValue: ['standard', 'internal', 'stateless', 'standard'],
                expectedValue: ['standard', 'internal', 'stateless', 'standard'],
                extractFunction: (o) => {
                    // cannot check virtualType directly
                    // use the port or destination to guide the check
                    const port = o.destination.split(':')[1];
                    if (port === '8080' && !(o.internal || o.stateless)) {
                        return 'standard';
                    }
                    if (o.destination === '0.0.0.0:0' && o.internal && !o.stateless) {
                        return 'internal';
                    }
                    if (port === '53' && o.stateless && !o.internal) {
                        return 'stateless';
                    }
                    return 'unknown';
                }
            },
            {
                name: 'translateClientPort',
                inputValue: [undefined, undefined, false, undefined],
                skipAssert: true
            },
            {
                name: 'translateServerPort',
                inputValue: [undefined, undefined, false, undefined],
                skipAssert: true
            },
            {
                name: 'pool',
                inputValue: [undefined, undefined, { bigip: '/Common/testPool' }, undefined],
                skipAssert: true
            }
        ];
        return assertClass('Service_UDP', properties, options);
    });
});

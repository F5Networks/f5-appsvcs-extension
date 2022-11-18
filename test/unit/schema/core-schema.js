/**
 * Copyright 2022 F5 Networks, Inc.
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

const assert = require('assert');
const chai = require('chai');
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const formats = require('../../../src/lib/adcParserFormats');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const validate = ajv
    .compile(adcSchema);

const assertErrorString = (expectedString) => {
    const errorString = getErrorString(validate);
    assert.ok(errorString.includes(expectedString), `Expected string "${expectedString}" to be `
    + `included in error string:\n${errorString}`);
};

describe('core-schema.json', () => {
    describe('Base', () => {
        describe('valid', () => {
            it('should $schema property', () => {
                const data = {
                    $schema: 'https://raw.githubusercontent.com/F5Networks/f5-appsvcs-extension/master/schema/latest/as3-schema.json',
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId'
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate full controls object', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.22.0',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true,
                        userAgent: 'exampleUser',
                        archiveId: 123456,
                        archiveTimestamp: '2018-06-01T16:52:07.173Z',
                        dryRun: true
                    }
                };

                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Tenant', () => {
        describe('invalid', () => {
            it('should invalidate additional properties that are not Applications', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        tenantApplication: {
                            class: 'NotAnApplication'
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'additional properties should be Application class');
            });

            it('should invalidate defaultRouteDomain that is too high', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        defaultRouteDomain: 70000
                    }
                };
                assert.strictEqual(validate(data), false, 'defaultRouteDomain should be >= 0 and <= 65535');
                assertErrorString('should be <= 65535');
            });

            it('should invalidate non-boolean enable', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        enable: 'thisIsEnabled'
                    }
                };
                assert.strictEqual(validate(data), false, 'enable must be a boolean');
            });

            it('should invalidate non-object verifiers', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        verifiers: 'verified'
                    }
                };
                assert.strictEqual(validate(data), false, 'verifiers must be of object type');
            });

            it('should invalidate Shared that is NOT Application class', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        Shared: {
                            class: 'NotShared'
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'Shared must be Application class');
            });

            it('should invalidate constants that is NOT Constants class', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        constants: {
                            class: 'NotConstants'
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'constats must be Constants class');
            });

            it('should invalidate controls that is NOT Controls class', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        constants: {
                            class: 'NotControls'
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'controls must be Controls class');
            });

            it('should invalidate optimisticLockKey that is NOT a string', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        optimisticLockKey: {}
                    }
                };
                assert.strictEqual(validate(data), false, 'optimisticLockKey must be a string');
            });

            it('should invalidate optimisticLockKey that is too long', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        optimisticLockKey: 'TooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLong'
                    }
                };
                assert.strictEqual(validate(data), false, 'optimisticLockKey must be <= 128 characters');
            });

            it('should invalidate optimisticLockKey that is NOT a string in Common', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    Common: {
                        class: 'Tenant',
                        optimisticLockKey: {}
                    }
                };
                assert.strictEqual(validate(data), false, 'optimisticLockKey must be a string');
            });

            it('should invalidate optimisticLockKey that is too long in Common', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    Common: {
                        class: 'Tenant',
                        optimisticLockKey: 'TooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLongTooLong'
                    }
                };
                assert.strictEqual(validate(data), false, 'optimisticLockKey must be <= 128 characters');
            });

            it('should invalidate Tenant with invalid name characters', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    'the*tenant': {
                        class: 'Tenant'
                    }
                };
                assert.strictEqual(validate(data), false, 'Tenant name should make this regex: ^[A-Za-z][0-9A-Za-z_.-]*$');
            });
        });

        describe('valid', () => {
            it('should validate Tenant with minimum properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Tenant with all properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        label: 'tenantLabel',
                        remark: 'Remark about the tenant',
                        verifiers: {},
                        enable: true,
                        defaultRouteDomain: 123,
                        Shared: {
                            class: 'Application',
                            template: 'shared'
                        },
                        constants: {
                            class: 'Constants'
                        },
                        controls: {
                            class: 'Controls'
                        },
                        optimisticLockKey: 'theOptimisticKeyOfLocking'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate optimisticLockKey in Common tenant', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    Common: {
                        class: 'Tenant',
                        optimisticLockKey: 'theOptimisticKeyOfLocking'
                    }
                };
                assert.strictEqual(validate(data), true, 'optimisticLockKey must be set');
            });

            it('should validate additional properties that are applications', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        tenantApplication: {
                            class: 'Application',
                            template: 'generic'
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate tenant with valid special characters in name', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    'the-tenant.-._with-special.characters123': {
                        class: 'Tenant'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Application', () => {
        describe('invalid', () => {
            it('should invalidate additional properties that are not from the list', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        tenantApplication: {
                            class: 'Application',
                            template: 'generic',
                            item: {
                                class: 'ThisDoesNotExist'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'additional properties should be one form the list');
            });

            it('should invalidate wrong type for schemaOverlay', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        tenantApplication: {
                            class: 'Application',
                            template: 'generic',
                            schemaOverlay: {}
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'schemaOverlay should be a string');
            });

            it('should invalidate wrong type for enable', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        tenantApplication: {
                            class: 'Application',
                            template: 'generic',
                            enable: 123
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'enable should be a boolean');
            });

            it('should invalidate wrong class for serviceMain', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        tenantApplication: {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_Generic'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'serviceMain should be of HTTP class');
            });

            it('should invalidate Application with invalid name characters', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'the*invalid&application^': {
                            class: 'Application',
                            template: 'generic'
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'Application name should make this regex: ^[A-Za-z][0-9A-Za-z_.-]*$');
            });
        });

        describe('valid', () => {
            it('should validate Application with minimal properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application'
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Application with all properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'http',
                            label: 'ApplicationLabel',
                            remark: 'Remark about the application',
                            schemaOverlay: 'aSchemaOverlay',
                            enable: false,
                            constants: {
                                class: 'Constants'
                            },
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '1.2.3.4'
                                ]
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Application with valid additional properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            pool1: {
                                class: 'Pool'
                            },
                            serviceHTTP: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '1.2.3.4'
                                ]
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Application with valid additional properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic'
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Application with default template', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            serviceMain: {
                                class: 'Service_Generic',
                                virtualAddresses: ['192.0.2.10']
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Cipher_Rule', () => {
        describe('invalid', () => {
            it('should invalidate Cipher_Rule with additional properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic',
                            cipherRule: {
                                class: 'Cipher_Rule',
                                newProperty: {}
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'additional properties are not allowed');
            });

            it('should invalidate Cipher_Rule with invalid cipherSuites', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic',
                            cipherRule: {
                                class: 'Cipher_Rule',
                                cipherSuites: [
                                    'DEFAULT',
                                    {
                                        cipherSuite: 'theSuite'
                                    }
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'cipher suites should be strings');
            });

            it('should invalidate Cipher_Rule with invalid namedGroups', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic',
                            cipherRule: {
                                class: 'Cipher_Rule',
                                namedGroups: [
                                    'P512'
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'named groups must be from the list');
            });

            it('should invalidate Cipher_Rule with invalid signatureAlgorithms', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic',
                            cipherRule: {
                                class: 'Cipher_Rule',
                                signatureAlgorithms: [
                                    'invalidSignatureAlgorithm'
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'signautre algorithms must be from the list');
            });
        });

        describe('valid', () => {
            it('should validate Cipher_Rule with minimal properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic',
                            cipherRule: {
                                class: 'Cipher_Rule',
                                cipherSuites: ['DEFAULT']
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Cipher_Rule with all properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        'application-name.with-special.characters123-': {
                            class: 'Application',
                            template: 'generic',
                            cipherRule: {
                                class: 'Cipher_Rule',
                                label: 'cipherRuleLabel',
                                remark: 'This is a remark',
                                cipherSuites: [
                                    'ECDHE',
                                    'RSA',
                                    '!3DES'
                                ],
                                namedGroups: [
                                    'P256'
                                ],
                                signatureAlgorithms: [
                                    'DSA-SHA1',
                                    'RSA-PSS-SHA384'
                                ]
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Cipher_Group', () => {
        describe('invalid', () => {
            it('should invalidate Cipher_Group with additional properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            cipherGroup: {
                                class: 'Cipher_Group',
                                newProperty: {}
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'additional properties are not allowed');
            });
        });

        describe('valid', () => {
            it('should validate Cipher_Group with minimal properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            cipherGroup: {
                                class: 'Cipher_Group'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate Cipher_Group with all properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            cipherGroup: {
                                class: 'Cipher_Group',
                                label: 'cipherGroupLabel',
                                remark: 'This is a remark',
                                allowCipherRules: [
                                    {
                                        bigip: '/Common/f5-default'
                                    }
                                ],
                                excludeCipherRules: [
                                    {
                                        use: '/theTenant/application/customRule'
                                    }
                                ],
                                requireCipherRules: [
                                    {
                                        bigip: '/Common/f5-secure'
                                    }
                                ],
                                order: 'speed'
                            },
                            customRule: {
                                class: 'Cipher_Rule',
                                cipherSuites: ['RSA']
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('TLS_Server', () => {
        describe('invalid', () => {
            it('should invalidate TLS_Server when both ciphers and cipherGroup are provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                ciphers: 'DEFAULT',
                                cipherGroup: {
                                    bigip: '/Common/f5-secure'
                                }
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
            });

            it('should invalidate when alertTimeout is a non-enum string', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                alertTimeout: '1234'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
            });

            it('should invalidate when forwardProxyBypassAllowlist is none', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                forwardProxyEnabled: true,
                                forwardProxyBypassEnabled: true,
                                forwardProxyBypassAllowlist: 'none'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
            });

            it('should invalidate when forwardProxyBypassAllowlist is set, but forwardProxyBypassEnabled is false', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                forwardProxyEnabled: true,
                                forwardProxyBypassEnabled: false,
                                forwardProxyBypassAllowlist: {
                                    use: 'test_data_group'
                                }
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
                assertErrorString('"allowedValue": true');
            });

            it('should invalidate when forwardProxyBypassAllowlist is set, but forwardProxyEnabled is false', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                forwardProxyEnabled: false,
                                forwardProxyBypassEnabled: true,
                                forwardProxyBypassAllowlist: {
                                    bigip: '/Common/test_data_group'
                                }
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
                assertErrorString('"allowedValue": true');
            });

            it('should invalidate certificateExtension values that are invalid', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                certificateExtensions: [
                                    'invalid'
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
                assertErrorString('should be equal to one of the allowed values');
            });

            it('should invalidate secureRenegotiation values that are invalid', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                secureRenegotiation: 'invalid'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
                assertErrorString('should be equal to one of the allowed values');
            });
        });

        describe('valid', () => {
            it('should validate when cipherGroup is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                cipherGroup: {
                                    bigip: '/Common/f5-secure'
                                }
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when ciphers is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                ciphers: 'DEFAULT'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when cacheTimeout is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                cacheTimeout: 86400
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when alertTimeout is an enum', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                alertTimeout: 'immediate'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when alertTimeout is an integer', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                alertTimeout: 86400
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when renegotiationEnabled is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                renegotiationEnabled: true
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when retainCertificateEnabled is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                retainCertificateEnabled: true
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when forwardProxyBypassAllowlist is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Server',
                                certificates: [{ certificate: 'webcert' }],
                                forwardProxyEnabled: true,
                                forwardProxyBypassEnabled: true,
                                forwardProxyBypassAllowlist: { bigip: '/Common/bypassDataGroup' }
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        it('should validate when namingScheme is provided', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            namingScheme: 'certificate'
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate when enabled is provided', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    enabled: false,
                                    certificate: 'webcert'
                                }
                            ]
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate ssl options', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            sslEnabled: false,
                            ssl3Enabled: false
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate dtls options', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            dtlsEnabled: false,
                            dtls1_2Enabled: false
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate proxy ssl settings', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            proxySslEnabled: true,
                            proxySslPassthroughEnabled: true
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate certificateExtensions', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            certificateExtensions: [
                                'authority-key-identifier',
                                'subject-key-identifier'
                            ]
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate secureRenegotiation', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            secureRenegotiation: 'request'
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate uncleanShutdownEnabled', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            uncleanShutdownEnabled: false
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate nonSslConnectionsEnabled', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        tlsserver: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'webcert' }],
                            nonSslConnectionsEnabled: true
                        }
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });
    });

    describe('TLS_Client', () => {
        describe('invalid', () => {
            it('should invalidate TLS_Client when both ciphers and cipherGroup are provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                ciphers: 'DEFAULT',
                                cipherGroup: {
                                    bigip: '/Common/f5-secure'
                                }
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
            });

            it('should invalidate when alertTimeout is a non-enum string', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                alertTimeout: '1234'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
            });

            it('should invalidate secureRenegotiation values that are invalid', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Client',
                                secureRenegotiation: 'invalid'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false);
                assertErrorString('should be equal to one of the allowed values');
            });
        });

        describe('valid', () => {
            it('should validate when cipherGroup is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                cipherGroup: {
                                    bigip: '/Common/f5-secure'
                                }
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when ciphers is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                ciphers: 'DEFAULT'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when cacheTimeout is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                cacheTimeout: 86400
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when alertTimeout is an enum', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                alertTimeout: 'immediate'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when alertTimeout is an integer', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                alertTimeout: 86400
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when renegotiationEnabled is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                renegotiationEnabled: true
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate when retainCertificateEnabled is provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                clientCertificate: 'webcert',
                                retainCertificateEnabled: true
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate ssl options', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsclient: {
                                class: 'TLS_Client',
                                sslEnabled: true,
                                ssl3Enabled: true
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate dtls options', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Client',
                                dtlsEnabled: false,
                                dtls1_2Enabled: false
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate proxy ssl settings', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Client',
                                proxySslEnabled: true,
                                proxySslPassthroughEnabled: true
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate secureRenegotiation', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Client',
                                secureRenegotiation: 'request'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate uncleanShutdownEnabled', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            tlsserver: {
                                class: 'TLS_Client',
                                uncleanShutdownEnabled: false
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('Service_Core', () => {
        describe('invalid', () => {
            it('should invalidate with no virtualAddresses', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
            });

            it('should invalidate with sourceAddress and not internal type', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                sourceAddress: '1.2.3.4'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'must be internal virtual type');
            });

            it('should invalidate with fallbackPersistenceMethod and no persistenceMethods', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                fallbackPersistenceMethod: 'cookie'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'must have persistenceMethods with fallbackPersistenceMethod');
            });

            it('should invalidate when allowVlans and rejectVlans', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                allowVlans: [
                                    {
                                        bigip: '/Common/internal'
                                    }
                                ],
                                rejectVlans: [
                                    {
                                        bigip: '/Common/external'
                                    }
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'allowVlans and rejectVlans are mutually exclusive');
            });

            it('should invalidate zero virtualAddresses', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                virtualAddresses: []
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'virtualAddresses must have at least one item');
            });

            it('should invalidate more than two items in an array inside virtualAddresses', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    ['1.2.3.4', '4.3.2.1', '2.3.4.5']
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'virtualAddresses that are array type can only have two items');
            });

            it('should invalidate bad virtualAddresses format', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    ['1.2.3']
                                ]
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'virtualAddresses must match f5ip format');
            });
        });

        describe('valid', () => {
            it('should validate with minimal properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['1.2.3.4']
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with all properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            coreService: {
                                class: 'Service_HTTP',
                                label: 'A label',
                                remark: 'description',
                                virtualAddresses: ['1.2.3.4'],
                                enable: false,
                                maxConnections: 100,
                                rateLimit: 10,
                                snat: 'self',
                                iRules: ['theIRule'],
                                pool: 'thePool',
                                addressStatus: false,
                                mirroring: 'L4',
                                policyBandwidthControl: {
                                    bigip: '/Common/bwcPolicy'
                                },
                                policyFirewallEnforced: {
                                    bigip: '/Common/firewallEnforced'
                                },
                                policyFirewallStaged: {
                                    bigip: '/Common/firewallStaged'
                                },
                                policyNAT: {
                                    use: 'natPolicy'
                                },
                                policyTimer: {
                                    bigip: '/Common/idleTimeoutPolicy'
                                },
                                lastHop: 'auto',
                                translateClientPort: true,
                                trasnlateServerAddress: false,
                                translateServerPort: false,
                                nat64Enabled: true,
                                httpMrfRoutingEnabled: true,
                                persistenceMethds: ['cookie'],
                                fallbackPersistenceMethod: 'destination-address',
                                allowVlans: [
                                    {
                                        bigip: '/Common/internal'
                                    }
                                ],
                                securityLogProfiles: [
                                    {
                                        bigip: '/Common/secureLog'
                                    }
                                ],
                                profileDiameterEndpoint: {
                                    use: 'diamEnd'
                                },
                                profileEnforcement: {
                                    bigip: '/Common/enforcement'
                                },
                                profileSubscriberManagement: {
                                    bigip: '/Common/subManage'
                                },
                                profileIPOther: {
                                    bigip: '/Common/iPOther'
                                },
                                profileClassification: {
                                    use: 'class'
                                },
                                profileDNS: {
                                    bigip: '/Common/dns'
                                },
                                profileDOS: {
                                    bigip: '/Common/dos'
                                },
                                profileTrafficLog: {
                                    bigip: '/Common/trafLog'
                                },
                                profileRewrite: {
                                    bigip: '/Common/rewrite'
                                },
                                profileBotDefense: {
                                    bigip: '/Common/bot-defense'
                                },
                                profileNTLM: {
                                    bigip: '/Common/ntlm'
                                },
                                profileMultiplex: {
                                    bigip: '/Common/oneconnect'
                                },
                                metadata: {
                                    prop: {
                                        value: 'theValue'
                                    }
                                },
                                clonePools: {
                                    ingress: {
                                        use: 'thePool'
                                    }
                                },
                                profileVdi: {
                                    bigip: '/Common/vdi'
                                },
                                profileAccess: {
                                    bigip: '/Common/access'
                                },
                                profileConnectivity: {
                                    bigip: '/Common/connectivityProfile'
                                },
                                ipIntelligencePolicy: {
                                    bigip: '/Common/ip-intelligence'
                                },
                                profileIntegratedBotDefense: {
                                    bigip: '/Common/bd'
                                },
                                adminState: 'disable'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('.maximumBandwidth', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            service: {
                                class: 'Service_Generic',
                                virtualAddresses: ['192.0.2.10'],
                                maximumBandwidth: value
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow "infinite"', () => testValue('infinite', true));
            it('should allow 10', () => testValue(10, true));
            it('should allow 1000000', () => testValue(1000000, true));
            it('should not allow "invalid"', () => testValue('invalid', false));
            it('should not allow 9', () => testValue(9, false));
            it('should not allow 1000001', () => testValue(1000001, false));
            it('should not allow true', () => testValue(true, false));
        });
    });

    describe('Service_Generic', () => {
        describe('invalid', () => {
            it('should invalidate when required property virtualAddresses is not specified', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            serviceGeneric: {
                                class: 'Service_Generic'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('Service_L4', () => {
        describe('invalid', () => {
            it('should invalidate when required property virtualAddresses is not specified', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            serviceGeneric: {
                                class: 'Service_L4',
                                virtualPort: 8080
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('Service_SCTP', () => {
        describe('invalid', () => {
            it('should invalidate when required property virtualAddresses is not specified', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            serviceGeneric: {
                                class: 'Service_SCTP',
                                virtualPort: 8080
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('Service_UDP', () => {
        let data;
        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        serviceGeneric: {
                            class: 'Service_UDP',
                            virtualPort: 8080,
                            virtualAddresses: ['192.0.0.121']
                        }
                    }
                }
            };
        });

        it('should invalidate when required property virtualAddresses is not specified', () => {
            delete data.tenant.application.serviceGeneric.virtualAddresses;
            assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
            assertErrorString('should have required property \'.virtualAddresses\'');
        });

        describe('stateless', () => {
            beforeEach(() => {
                Object.assign(data.tenant.application.serviceGeneric, {
                    virtualType: 'stateless',
                    translateClientPort: false,
                    translateServerPort: false,
                    pool: { bigip: '/Common/myPool' }
                });
            });

            it('should validate with required properties', () => {
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should invalidate if stateless server has true translateClientPort', () => {
                data.tenant.application.serviceGeneric.translateClientPort = true;
                assert.strictEqual(validate(data), false, 'should have required property translateClientPort false');
                assertErrorString('dataPath": "[\'tenant\'][\'application\'][\'serviceGeneric\'].translateClientPort');
                assertErrorString('schemaPath": "#/dependencies/virtualType/then/properties/translateClientPort/const');
                assertErrorString('"allowedValue": false');
            });

            it('should invalidate if stateless server has true translateServerPort', () => {
                data.tenant.application.serviceGeneric.translateServerPort = true;
                assert.strictEqual(validate(data), false, 'should have required property translateServerPort false');
                assertErrorString('dataPath": "[\'tenant\'][\'application\'][\'serviceGeneric\'].translateServerPort');
                assertErrorString('schemaPath": "#/dependencies/virtualType/then/properties/translateServerPort/const');
                assertErrorString('"allowedValue": false');
            });

            it('should invalidate if stateless server does not have pool', () => {
                delete data.tenant.application.serviceGeneric.pool;
                assert.strictEqual(validate(data), false, 'should have required property pool');
                assertErrorString('"should have required property \'.pool\'"');
            });
        });
    });

    describe('Service_TCP', () => {
        describe('invalid', () => {
            it('should invalidate when required property virtualAddresses is not specified', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            serviceGeneric: {
                                class: 'Service_TCP',
                                virtualPort: 8080
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('Service_Forwarding', () => {
        describe('valid', () => {
            it('should validate with policyNAT property', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            ServiceForwarding: {
                                class: 'Service_Forwarding',
                                virtualAddresses: ['192.0.2.10'],
                                policyNAT: {
                                    use: 'natPolicy'
                                },
                                forwardingType: 'l2'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should invalidate when required property virtualAddresses is not specified', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            serviceGeneric: {
                                class: 'Service_Forwarding',
                                forwardingType: 'l2'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('Service_HTTPS', () => {
        let data;
        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic'
                    }
                }
            };
        });

        describe('valid', () => {
            it('should allow minimal properties', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTPS',
                    virtualAddresses: ['1.2.3.4'],
                    serverTLS: {
                        bigip: '/Common/tlsServer'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate all properties at the Service_HTTPS level being specified', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTPS',
                    virtualAddresses: ['1.2.3.4'],
                    serverTLS: {
                        bigip: '/Common/tlsServer'
                    },
                    virtualPort: 123,
                    redirect80: false,
                    profileHTTP2: 'basic'
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should invalidate serverTLS with a length of 0', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTPS',
                    virtualAddresses: ['1.2.3.4'],
                    serverTLS: ''
                };
                assert.strictEqual(validate(data), false, 'serverTLS has a minLength of 1');
            });

            it('should invalidate ingress and egress profileHTTP2 specified at the same time', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTPS',
                    virtualAddresses: ['1.2.3.4'],
                    serverTLS: {
                        bigip: '/Common/tlsServer'
                    },
                    profileHTTP2: {
                        ingress: {
                            bigip: '/Common/http2'
                        },
                        egress: {
                            bigip: '/Common/http2'
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'profileHTTP2 cannot be both ingress and egress');
            });

            it('should invalidate when required property serverTLS is not specified', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTPS',
                    virtualAddresses: ['1.2.3.4']
                };
                assert.strictEqual(validate(data), false, 'serverTLS is required');
            });

            it('should invalidate when required property virtualAddresses is not specified', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTPS',
                    serverTLS: {
                        bigip: '/Common/tlsServer'
                    }
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('Service_HTTP', () => {
        let data;

        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4']
                        }
                    }
                }
            };
        });

        describe('valid', () => {
            it('should validate minimal properties', () => {
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate profileApiProtection property when referencing BIG-IP object', () => {
                data.theTenant.application.service.profileApiProtection = {
                    bigip: '/Common/profileApiProtection'
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('invalid', () => {
            it('should invalidate profileApiProtection property when referencing declaration object', () => {
                data.theTenant.application.service.profileApiProtection = {
                    use: 'profileApiProtection'
                };
                validate(data);
                assertErrorString('should NOT have additional properties');
            });

            it('should invalidate when required property virtualAddresses is not specified', () => {
                data.theTenant.application.service = {
                    class: 'Service_HTTP'
                };
                assert.strictEqual(validate(data), false, 'should have required property virtualAddresses');
                assertErrorString('should have required property \'.virtualAddresses\'');
            });
        });
    });

    describe('HTML_Profile', () => {
        let data;
        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic'
                    }
                }
            };
        });

        it('should validate with all fields populated', () => {
            data.theTenant.application.httpProfile = {
                class: 'HTML_Profile',
                contentDetectionEnabled: true,
                contentSelection: [
                    'text/html',
                    'text/xhtml'
                ],
                rules: [
                    { use: 'rule1' },
                    { bigip: '/Common/rule2' }
                ]
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate with minimum fields populated', () => {
            data.theTenant.application.httpProfile = {
                class: 'HTML_Profile'
            };
            assert.ok(validate(data), getErrorString(validate));
        });
    });

    describe('HTML_Rule', () => {
        let data;
        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic'
                    }
                }
            };
        });

        describe('General', () => {
            it('should invalidate if ruleType is missing', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    content: 'blah blah blah',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have ruleType property');
                assertErrorString('should have required property \'ruleType\'');
            });

            it('should invalidate if ruleType has unexpected value', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    ruleType: 'blah',
                    content: 'blah blah blah',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule ruleType property must be an expected value');
                assertErrorString('should be equal to one of the allowed values');
            });
        });

        describe('Comment Raise Event', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagCommentRaiseEventRule = {
                    class: 'HTML_Rule',
                    ruleType: 'comment-raise-event',
                    label: 'my_label',
                    remark: 'my_remark'
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('Comment Remove', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagCommentRemoveRule = {
                    class: 'HTML_Rule',
                    ruleType: 'comment-remove',
                    label: 'my_label',
                    remark: 'my_remark'
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });

        describe('Tag Append HTML', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-append-html',
                    label: 'my_label',
                    remark: 'my_remark',
                    content: '<script type="text/javascript" src="ShapeProvidedJSPath?cache"></script> <script type="text/javascript" src="/ShapeProvidedJSPath?async" async></script>',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie',
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with minimum required fields populated', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-append-html',
                    content: 'some content',
                    match: {
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should invalidate if content is missing', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-append-html',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have content property');
                assertErrorString('should have required property \'content\'');
            });

            it('should invalidate if tagName is missing', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-append-html',
                    content: 'blah blah blah',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have tagName property');
                assertErrorString('should have required property \'tagName\'');
            });

            it('should invalidate if attributeValue used without attributeName', () => {
                data.theTenant.application.tagAppendRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-append-html',
                    content: 'blah blah blah',
                    match: {
                        tagName: '/title',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have attributeName property');
                assertErrorString('should have required property \'.attributeName\'');
            });
        });

        describe('Tag Prepend HTML', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagPrependRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-prepend-html',
                    label: 'my_label',
                    remark: 'my_remark',
                    content: '<script type="text/javascript" src="ShapeProvidedJSPath?cache"></script> <script type="text/javascript" src="/ShapeProvidedJSPath?async" async></script>',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie',
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with minimum required fields populated', () => {
                data.theTenant.application.tagPrependRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-prepend-html',
                    content: 'some content',
                    match: {
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should invalidate if content is missing', () => {
                data.theTenant.application.tagPrependRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-prepend-html',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have content property');
                assertErrorString('should have required property \'content\'');
            });

            it('should invalidate if tagName is missing', () => {
                data.theTenant.application.tagPrependRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-prepend-html',
                    content: 'blah blah blah',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have tagName property');
                assertErrorString('should have required property \'tagName\'');
            });

            it('should invalidate if attributeValue used without attributeName', () => {
                data.theTenant.application.tagPrependRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-prepend-html',
                    content: 'blah blah blah',
                    match: {
                        tagName: '/title',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have attributeName property');
                assertErrorString('should have required property \'.attributeName\'');
            });
        });

        describe('Tag Raise Event', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagRaiseEventRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-raise-event',
                    label: 'my_label',
                    remark: 'my_remark',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie',
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with minimum required fields populated', () => {
                data.theTenant.application.tagRaiseEventRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-raise-event',
                    match: {
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should invalidate if tagName is missing', () => {
                data.theTenant.application.tagRaiseEventRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-raise-event',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have tagName property');
                assertErrorString('should have required property \'tagName\'');
            });

            it('should invalidate if attributeValue used without attributeName', () => {
                data.theTenant.application.tagRaiseEventRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-raise-event',
                    match: {
                        tagName: '/title',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have attributeName property');
                assertErrorString('should have required property \'.attributeName\'');
            });
        });

        describe('Tag Remove', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagRemoveRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove',
                    label: 'my_label',
                    remark: 'my_remark',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie',
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with minimum required fields populated', () => {
                data.theTenant.application.tagRemoveRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove',
                    match: {
                        tagName: '/title'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should invalidate if tagName is missing', () => {
                data.theTenant.application.tagRemoveRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have tagName property');
                assertErrorString('should have required property \'tagName\'');
            });

            it('should invalidate if attributeValue used without attributeName', () => {
                data.theTenant.application.tagRemoveRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove',
                    match: {
                        tagName: '/title',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have attributeName property');
                assertErrorString('should have required property \'.attributeName\'');
            });
        });

        describe('Tag Remove Attribute', () => {
            it('should validate with all fields populated', () => {
                data.theTenant.application.tagRemoveAttributeRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove-attribute',
                    label: 'my_label',
                    remark: 'my_remark',
                    attributeName: 'coolWhip',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'

                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with minimum required fields populated', () => {
                data.theTenant.application.tagRemoveAttributeRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove-attribute',
                    attributeName: 'chapter8',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should invalidate if attributeName is missing', () => {
                data.theTenant.application.tagRemoveAttributeRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove-attribute',
                    match: {
                        tagName: '/title',
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have attributeName property');
                assertErrorString('should have required property \'attributeName\'');
            });

            it('should invalidate if tagName is missing', () => {
                data.theTenant.application.tagRemoveAttributeRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove-attribute',
                    attributeName: 'blah',
                    match: {
                        attributeName: 'apple',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have tagName property');
                assertErrorString('should have required property \'tagName\'');
            });

            it('should invalidate if attributeValue used without attributeName', () => {
                data.theTenant.application.tagRemoveAttributeRule = {
                    class: 'HTML_Rule',
                    ruleType: 'tag-remove-attribute',
                    attributeName: 'blah',
                    match: {
                        tagName: '/title',
                        attributeValue: 'pie'
                    }
                };
                assert.strictEqual(validate(data), false, 'HTML_Rule must have attributeName property');
                assertErrorString('should have required property \'attributeName\'');
            });
        });
    });

    describe('Monitor', () => {
        describe('Inband Monitor', () => {
            let data;
            beforeEach(() => {
                data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitorInband: {
                                class: 'Monitor',
                                monitorType: 'inband'
                            },
                            monitorNotInband: {
                                class: 'Monitor',
                                monitorType: 'ftp'
                            }
                        }
                    }
                };
            });

            it('should not have any of the inherited properties as other monitors', () => {
                const keysOfInterest = ['targetAddress', 'targetPort', 'interval', 'upInterval', 'timeUntilUp', 'timeout'];
                assert.ok(validate(data), getErrorString(validate));
                chai.assert.doesNotHaveAnyKeys(data.theTenant.application.monitorInband, keysOfInterest);
                chai.assert.containsAllKeys(data.theTenant.application.monitorNotInband, keysOfInterest);
            });

            it('should have the expected default properties', () => {
                assert.ok(validate(data), getErrorString(validate));
                assert.deepStrictEqual(data.theTenant.application.monitorInband,
                    {
                        class: 'Monitor',
                        monitorType: 'inband',
                        failureInterval: 30,
                        failures: 3,
                        responseTime: 10,
                        retryTime: 300
                    });
            });
        });

        describe('Database Monitors', () => {
            let data;
            const testCases = [
                'mysql',
                'postgresql'
            ];
            testCases.forEach((testCase) => {
                beforeEach(() => {
                    data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: testCase
                                }
                            }
                        }
                    };
                });

                describe(`${testCase} valid`, () => {
                    it('should validate when send and receive provided with receiveRow', () => {
                        data.theTenant.application.monitor.receiveRow = 10;
                        data.theTenant.application.monitor.receive = 'receive';
                        data.theTenant.application.monitor.send = 'send';
                        assert.ok(validate(data), getErrorString(validate));
                    });

                    it('should validate when send and receive provided with receiveColumn', () => {
                        data.theTenant.application.monitor.receiveColumn = 10;
                        data.theTenant.application.monitor.receive = 'receive';
                        data.theTenant.application.monitor.send = 'send';
                        assert.ok(validate(data), getErrorString(validate));
                    });
                });

                describe(`${testCase} invalid`, () => {
                    it('should invalidate when no send provided with receiveRow', () => {
                        data.theTenant.application.monitor.receiveRow = 10;
                        data.theTenant.application.monitor.receive = 'receive';
                        assert.strictEqual(validate(data), false, `${testCase} monitors must have send with receiveRow`);
                    });

                    it('should invalidate when no receive provided with receiveRow', () => {
                        data.theTenant.application.monitor.receiveRow = 10;
                        data.theTenant.application.monitor.send = 'send';
                        assert.strictEqual(validate(data), false, `${testCase} monitors must have receive with receiveRow`);
                    });

                    it('should invalidate when no send provided with receiveColumn', () => {
                        data.theTenant.application.monitor.receiveColumn = 10;
                        data.theTenant.application.monitor.receive = 'receive';
                        assert.strictEqual(validate(data), false, `${testCase} monitors must have send with receiveColumn`);
                    });

                    it('should invalidate when no receive provided with receiveColumn', () => {
                        data.theTenant.application.monitor.receiveColumn = 10;
                        data.theTenant.application.monitor.send = 'send';
                        assert.strictEqual(validate(data), false, `${testCase} monitors must have receive with receiveColumn`);
                    });
                });
            });
        });

        describe('Monitor HTTP2', () => {
            describe('valid', () => {
                it('should validate with minimal properties', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'http2'
                                }
                            }
                        }
                    };
                    assert.ok(validate(data), getErrorString(validate));
                });

                it('should validate with additional properties', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'http2',
                                    interval: 10,
                                    receiveDown: 'down',
                                    receive: 'receive',
                                    send: 'send',
                                    timeUntilUp: 15,
                                    timeout: 123,
                                    clientTLS: { use: 'tlsClientProfile' }
                                }
                            }
                        }
                    };
                    assert.ok(validate(data), getErrorString(validate));
                });
            });
        });

        describe('Monitor_External', () => {
            describe('invalid', () => {
                it('should invalidate when no script or pathname provided', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'external'
                                }
                            }
                        }
                    };
                    assert.strictEqual(validate(data), false, 'external monitors must have a pathmame or script');
                    assertErrorString('should have required property \'.pathname\'');
                    assertErrorString('should have required property \'.script\'');
                });

                it('should invalidate when script and pathname are provided', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'external',
                                    pathname: '/the/path',
                                    script: {
                                        url: 'https://theurl.com'
                                    }
                                }
                            }
                        }
                    };
                    assert.strictEqual(validate(data), false, 'cannot use pathname and script together');
                    assertErrorString('should match exactly one schema in oneOf');
                });

                it('should invalidate when environment variables are not strings', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'external',
                                    pathname: '/the/file/path',
                                    environmentVariables: {
                                        USER: 42
                                    }
                                }
                            }
                        }
                    };
                    assert.strictEqual(validate(data), false, 'environment variables should be strings');
                    assertErrorString('should be string');
                });
            });

            describe('valid', () => {
                it('should validate with minimal properties', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'external',
                                    pathname: '/the/path'
                                }
                            }
                        }
                    };
                    assert.ok(validate(data), getErrorString(validate));
                });

                it('should validate with valid script and all other valid properties', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    label: 'A label',
                                    remark: 'This is an external monitor',
                                    monitorType: 'external',
                                    targetAddress: '1.2.3.4',
                                    interval: 25,
                                    upInterval: 100,
                                    timeUntilUp: 1000,
                                    timeout: 123,
                                    script: {
                                        url: 'https://the.script.com'
                                    },
                                    expand: false,
                                    arguments: 'Some arguments',
                                    environmentVariables: {
                                        USER: 'nobody'
                                    }
                                }
                            }
                        }
                    };
                    assert.ok(validate(data), getErrorString(validate));
                });

                it('should validate with valid script url object', () => {
                    const data = {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declarationId',
                        theTenant: {
                            class: 'Tenant',
                            application: {
                                class: 'Application',
                                template: 'generic',
                                monitor: {
                                    class: 'Monitor',
                                    monitorType: 'external',
                                    script: {
                                        url: {
                                            url: 'https://the.script.com',
                                            authentication: {
                                                method: 'bearer-token',
                                                token: 'myToken'
                                            }
                                        }
                                    },
                                    expand: false
                                }
                            }
                        }
                    };
                    assert.ok(validate(data), getErrorString(validate));
                });
            });
        });

        describe('Monitor TCP', () => {
            it('should validate this TCP Monitor reference', () => {
                const data = {
                    TCPTest: {
                        class: 'Tenant',
                        TCP_Monitor_Test: {
                            class: 'Application',
                            template: 'generic',
                            TCP_Monitor: {
                                class: 'Monitor',
                                monitorType: 'tcp'
                            },
                            TCP_Pool: {
                                class: 'Pool',
                                monitors: [{ use: 'TCP_Monitor' }],
                                members: [
                                    {
                                        enable: true,
                                        adminState: 'enable',
                                        shareNodes: true,
                                        serverAddresses: ['1.1.1.1'],
                                        servicePort: 1234
                                    }
                                ],
                                loadBalancingMode: 'least-connections-member'
                            }
                        }
                    },
                    class: 'ADC',
                    schemaVersion: '3.7.0',
                    id: 'dda23da4-3f9b-49c3-91e8-aa6a3f88baa5',
                    updateMode: 'selective'
                };

                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('WebSocket_Profile', () => {
        let data;

        it('should invalidate if masking preserve and compressMode typed', () => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        websocketProfile: {
                            class: 'WebSocket_Profile',
                            masking: 'preserve',
                            compressMode: 'typed'
                        }
                    }
                }
            };

            assert.strictEqual(validate(data), false, 'masking preserve with compressMode typed is invalid bigip config');
        });
    });

    describe('Statistics_Profile', () => {
        describe('fieldXX properties', () => {
            function testValue(name, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'Statistics_Profile'
                            }
                        }
                    }
                };
                data.tenant.application.test[name] = 'some string value';

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow field1', () => testValue('field1', true));
            it('should allow field9', () => testValue('field9', true));
            it('should allow field10', () => testValue('field10', true));
            it('should allow field19', () => testValue('field19', true));
            it('should allow field20', () => testValue('field20', true));
            it('should allow field29', () => testValue('field29', true));
            it('should allow field30', () => testValue('field30', true));
            it('should allow field32', () => testValue('field32', true));

            it('should not allow field', () => testValue('field', false));
            it('should not allow field0', () => testValue('field0', false));
            it('should not allow field33', () => testValue('field33', false));
            it('should not allow field40', () => testValue('field40', false));
        });
    });

    describe('HTTP_Profile', () => {
        describe('.hstsPeriod', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'HTTP_Profile',
                                hstsPeriod: value
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow 0', () => testValue(0, true));
            it('should allow 4294967295', () => testValue(4294967295, true));
            it('should not allow -1', () => testValue(-1, false));
            it('should not allow 4294967296', () => testValue(4294967296, false));
        });

        describe('HTTP_Profile_Explicit', () => {
            let data;
            beforeEach(() => {
            });

            it('should validate HTTP_Profile_Explicit with integer routeDomain', () => {
                data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            httpProfile: {
                                class: 'HTTP_Profile',
                                proxyType: 'explicit',
                                resolver: { bigip: '/Common/f5-aws' },
                                routeDomain: 123
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate HTTP_Profile_Explicit with string routeDomain', () => {
                data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            httpProfile: {
                                class: 'HTTP_Profile',
                                proxyType: 'explicit',
                                resolver: { bigip: '/Common/f5-aws' },
                                routeDomain: 'rd_one'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });

    describe('L4_Profile', () => {
        it('should support all properties', () => {
            const data = {
                class: 'ADC',
                schemaVersion: '3.31.0',
                id: '',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        testL4Profile: {
                            class: 'L4_Profile',
                            clientTimeout: 600,
                            idleTimeout: 650,
                            keepAliveInterval: 60,
                            looseClose: true,
                            looseInitialization: true,
                            maxSegmentSize: 256,
                            resetOnTimeout: false,
                            tcpCloseTimeout: 600,
                            tcpHandshakeTimeout: 600,
                            synCookieAllowlist: true,
                            synCookieEnable: true
                        }
                    }
                }
            };

            assert.ok(validate(data), getErrorString(validate));
        });

        describe('.keepAliveInterval', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'L4_Profile',
                                keepAliveInterval: value
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow 0', () => testValue(0, true));
            it('should allow 4294967295', () => testValue(4294967295, true));
            it('should not allow -1', () => testValue(-1, false));
            it('should not allow 4294967296', () => testValue(4294967296, false));
        });
    });

    describe('SNAT_Translate', () => {
        let data;
        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        test: {
                            class: 'SNAT_Translation',
                            address: '192.0.2.100'
                        }
                    }
                }
            };
        });

        it('should validate minimal values', () => {
            assert.ok(validate(data), getErrorString(validate));
            assert.deepStrictEqual(data.tenant.application.test,
                {
                    class: 'SNAT_Translation',
                    address: '192.0.2.100',
                    adminState: 'enable',
                    arpEnabled: true,
                    ipIdleTimeout: 'indefinite',
                    maxConnections: 0,
                    tcpIdleTimeout: 'indefinite',
                    trafficGroup: 'default',
                    udpIdleTimeout: 'indefinite'
                });
        });

        it('should validate when fully populated', () => {
            Object.assign(data.tenant.application.test, {
                class: 'SNAT_Translation',
                label: 'myLabel',
                remark: 'myRemark',
                adminState: 'disable',
                arpEnabled: false,
                ipIdleTimeout: 2000,
                maxConnections: 10000,
                tcpIdleTimeout: 3000,
                trafficGroup: 'someTrafficGroup',
                udpIdleTimeout: 4000
            });
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate indefinite timeouts', () => {
            Object.assign(data.tenant.application.test, {
                class: 'SNAT_Translation',
                ipIdleTimeout: 'indefinite',
                tcpIdleTimeout: 'indefinite',
                udpIdleTimeout: 'indefinite'
            });
            assert.ok(validate(data), getErrorString(validate));
        });
    });

    describe('Pool_Member', () => {
        describe('.addressDiscovery', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'Pool',
                                members: [
                                    value
                                ]
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            describe('static', () => {
                describe('valid', () => {
                    it('should allow server addresses', () => testValue(
                        {
                            addressDiscovery: 'static',
                            servicePort: 80,
                            serverAddresses: ['192.0.2.0']
                        },
                        true
                    ));

                    it('should allow servers', () => testValue(
                        {
                            addressDiscovery: 'static',
                            servicePort: 80,
                            servers: [
                                {
                                    name: 'my.named.server',
                                    address: '192.0.2.0'
                                }
                            ]
                        },
                        true
                    ));

                    it('should allow both server addresses and servers', () => testValue(
                        {
                            addressDiscovery: 'static',
                            servicePort: 80,
                            serverAddresses: ['192.0.2.0'],
                            servers: [
                                {
                                    name: 'my.named.server',
                                    address: '192.0.2.0'
                                }
                            ]
                        },
                        true
                    ));
                });

                describe('invalid', () => {
                    it('should invalidate if neither serverAddresses nor namedServers is specified', () => testValue(
                        {
                            addressDiscovery: 'static',
                            servicePort: 80
                        },
                        false
                    ));

                    it('should invalidate a server without an address', () => testValue(
                        {
                            addressDiscovery: 'static',
                            servicePort: 80,
                            servers: [
                                {
                                    name: 'my.named.server'
                                }
                            ]
                        },
                        false
                    ));

                    it('should invalidate additional properties', () => testValue(
                        {
                            addressDiscovery: 'static',
                            servicePort: 80,
                            servers: [
                                {
                                    name: 'my.named.server',
                                    address: '192.0.2.0',
                                    not: 'allowed'
                                }
                            ]
                        },
                        false
                    ));
                });
            });

            it('should allow undefined', () => testValue(
                {
                    servicePort: 80,
                    serverAddresses: ['192.0.2.0']
                },
                true
            ));

            it('should allow projectId if the addressDiscovery is "gce"', () => testValue(
                {
                    servicePort: 80,
                    addressDiscovery: 'gce',
                    projectId: 'other-project-id',
                    tagKey: 'foo',
                    tagValue: 'bar',
                    region: 'example-Region'
                },
                true
            ));

            it('should error if tagKey is not provided', () => testValue(
                {
                    servicePort: 81,
                    addressDiscovery: 'gce'
                },
                false
            ));

            it('should allow valid routeDomain value', () => testValue(
                {
                    servicePort: 80,
                    serverAddresses: ['192.0.2.0'],
                    routeDomain: 100
                },
                true
            ));

            it('should error if routeDomain is not an integer', () => testValue(
                {
                    servicePort: 80,
                    serverAddresses: ['192.0.2.0'],
                    routeDomain: '100'
                },
                false
            ));

            it('should error if routeDomain is out of range', () => testValue(
                {
                    servicePort: 80,
                    serverAddresses: ['192.0.2.0'],
                    routeDomain: 65535
                },
                false
            ));
        });

        describe('.fqdnPrefix', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'Pool',
                                members: [
                                    {
                                        addressDiscovery: 'fqdn',
                                        hostname: 'example.com',
                                        fqdnPrefix: value,
                                        servicePort: 80
                                    }
                                ]
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow undefined', () => testValue(undefined, true));
            it('should allow alpha numeric string', () => testValue('foo2-', true));
            it('should not  allow leading numbers', () => testValue('000-', false));
        });
    });

    describe('Certificate', () => {
        it('should validate a Certificate with chainCA', () => {
            const data = {
                class: 'ADC',
                id: 't1a1-0001',
                schemaVersion: '3.27.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        ca_bundle: {
                            bundle: '-----BEGIN CERTI...Bundle IN COMMON-----END CERTIFICATE-----',
                            class: 'CA_Bundle'
                        }
                    }
                },
                t1: {
                    class: 'Tenant',
                    t1a1: {
                        class: 'Application',
                        useCert: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTI...-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PR...-----END RSA PRIVATE KEY-----',
                            chainCA: { use: '/Common/Shared/ca_bundle' }
                        },
                        stringCert: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTI...-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PR...-----END RSA PRIVATE KEY-----',
                            chainCA: '-----BEGIN CERTI...Certificate as a STRING-----END CERTIFICATE-----'
                        },
                        tlsClientWithUse: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        tlsServerWithString: {
                            class: 'TLS_Server',
                            certificates: [{ certificate: 'stringCert' }]
                        },
                        poolPool: {
                            class: 'Pool',
                            members: [{ serverAddresses: ['10.100.100.100'], servicePort: 8181 }]
                        },
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'tlsClientWithUse',
                            serverTLS: 'tlsServerWithBigip',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: ['10.10.10.10'],
                            virtualPort: 443
                        }
                    }
                }
            };

            assert.ok(validate(data), getErrorString(validate));
        });
    });
});

describe('Access_Profile and Per_Request_Access_Policy', () => {
    let data;
    beforeEach(() => {
        data = {
            class: 'ADC',
            schemaVersion: '3.21.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    application: {
                        class: 'Service_HTTP',
                        virtualPort: 80,
                        virtualAddresses: [
                            '1.2.3.4'
                        ],
                        policyPerRequestAccess: {
                            bigip: '/Common/pollicyPerRequestAccess'
                        }
                    }
                }
            }
        };
    });
    describe('invalid', () => {
        it('should invalidate when neither profileAccess nor policyIAM are specified with per request policy', () => {
            data.theTenant.app.application.policyPerRequestAccess = {
                bigip: '/Common/pollicyPerRequestAccess'
            };
            assert.strictEqual(validate(data), false, 'policyPerRequestAccess must be used with profileAccess or policyIAM');
        });

        it('should invalidate when profileConnectiviy specified without profileAccess', () => {
            data.theTenant.app.application.profileConnectivity = {
                bigip: '/Common/connectivity'
            };
            assert.strictEqual(validate(data), false, 'profileConnectivity requires profileAccess');
        });

        it('should invalidate if both profileAccess and policyIAM are specified', () => {
            data.theTenant.app.application.profileAccess = {
                bigip: '/Common/profileAccess'
            };
            data.theTenant.app.application.policyIAM = {
                bigip: '/Common/policyIAM'
            };
            assert.strictEqual(validate(data), false, 'only one of profileAccess and policyIAM are allowed');
        });
    });

    describe('valid', () => {
        it('should validate per request policy with profileAccess', () => {
            data.theTenant.app.application.profileAccess = {
                bigip: '/Common/profileAccess'
            };
            data.theTenant.app.application.policyPerRequestAccess = {
                bigip: '/Common/policyPerRequestAccess'
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate per request policy with policyIAM', () => {
            data.theTenant.app.application.policyIAM = {
                bigip: '/Common/policyIAM'
            };
            data.theTenant.app.application.policyPerRequestAccess = {
                bigip: '/Common/policyPerRequestAccess'
            };
            assert.ok(validate(data), getErrorString(validate));
        });
    });
});

describe('iFile', () => {
    let data;

    beforeEach(() => {
        data = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    template: 'generic',
                    iFile: {
                        class: 'iFile',
                        label: 'iFile',
                        remark: 'The iFile',
                        iFile: {
                            bigip: '/Common/iFile'
                        }
                    }
                }
            }
        };
    });

    describe('valid', () => {
        it('should validate when all properties specified', () => assert.ok(validate(data), getErrorString(validate)));
    });

    describe('invalid', () => {
        it('should invalidate when additional properties are specified', () => {
            data.theTenant.application.iFile.invalidProperty = 'invalid';
            assert.strictEqual(validate(data), false, 'additional properties are not allowed');
        });

        it('should invalidate when multiple iFile properties are specified', () => {
            data.theTenant.application.iFile.iFile.url = 'https://example.com';
            assert.strictEqual(validate(data), false, 'should NOT have more than 1 properties');
        });
    });
});

['iRule', 'GSLB_iRule'].forEach((ruleClass) => {
    describe(ruleClass, () => {
        let data;

        beforeEach(() => {
            data = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declarationId',
                theTenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        iRule: {
                            class: `${ruleClass}`,
                            label: 'label',
                            remark: 'description',
                            expand: false,
                            iRule: 'The iRule'
                        }
                    }
                }
            };
        });

        describe('valid', () => {
            it('should validate when all properties specified', () => assert.ok(validate(data), getErrorString(validate)));

            it('should validate when using properties from F5string for iRule', () => {
                data.theTenant.application.iRule.iRule = {
                    url: {
                        url: 'https://example.myiRule.com',
                        ignoreChanges: true
                    }
                };
            });
        });

        describe('invalid', () => {
            it('should invalidate invalid property for iRule', () => {
                data.theTenant.application.iRule.iRule = {
                    invalidProperty: 'This is invalid'
                };
                assert.strictEqual(validate(data), false, 'additional properties are not allowed');
            });

            it('should invalidate when more than one F5string property is specified for iRule', () => {
                data.theTenant.application.iRule.iRule = {
                    url: 'https://example.myiRule.com',
                    bigip: '/Common/myiRule'
                };
                assert.strictEqual(validate(data), false, 'should NOT have more than 1 properties"');
            });
        });
    });
});

describe('Constants', () => {
    let data;

    beforeEach(() => {
        data = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'declarationId',
            theTenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    template: 'generic'
                }
            }
        };
    });

    describe('valid', () => {
        it('should validate Constants at ADC level', () => {
            data.constants = {
                class: 'Constants',
                constant1: 'value1',
                constant2: 'value2'
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate Constants at the Tenant level', () => {
            data.theTenant.constants = {
                class: 'Constants',
                constant1: 'value1',
                constant2: 'value2'
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate Constants at the Application level', () => {
            data.theTenant.application.constants = {
                class: 'Constants',
                constant1: 'value1',
                constant2: 'value2'
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate Constants at the Common Tenant level', () => {
            data.Common = {
                class: 'Tenant',
                constants: {
                    class: 'Constants',
                    constant1: 'value1',
                    constant2: 'value2'
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate Constants at the Common/Shared level', () => {
            data.Common = {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    constants: {
                        class: 'Constants',
                        constant1: 'value1',
                        constant2: 'value2'
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should validate Constants of various types', () => {
            data.constants = {
                class: 'Constants',
                constant1: 'stringValue',
                constant2: true,
                constant3: 12345,
                constant4: 123.456,
                constant5: ['arrayString', 0, {}],
                constant6: {
                    constObjProp: ''
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });
    });

    describe('invalid', () => {
        it('should invalidate object when JWE properties are used', () => {
            data.constants = {
                class: 'Constants',
                object: {
                    protected: 'thisIsProtected',
                    ciphertext: 'someCipherText',
                    invalidProperty: 'thisIsInvalid'
                }
            };
            assert.strictEqual(validate(data), false, 'should NOT have additional properties');
        });

        it('should invalidate bad timestamp at ADC level', () => {
            data.constants = {
                class: 'Constants',
                timestamp: 'invalidTimestamp'
            };
            assert.strictEqual(validate(data), false, 'should match format "date-time"');
        });

        it('should invalidate invalid version type at ADC level', () => {
            data.constants = {
                class: 'Constants',
                version: {}
            };
            assert.strictEqual(validate(data), false, 'should be number,string');
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

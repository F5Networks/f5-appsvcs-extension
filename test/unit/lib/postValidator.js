/**
 * Copyright 2023 F5, Inc.
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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const PostValidator = require('../../../src/lib/postValidator');
const Context = require('../../../src/lib/context/context');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('postValidator', () => {
    let defaultContext;

    beforeEach(() => {
        defaultContext = Context.build();
        defaultContext.target.tmosVersion = '0.0.0';
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('validate', function () {
        it('should reject if the context is undefined', () => assert.isRejected(
            PostValidator.validate(undefined),
            'The context is required.'
        ));

        it('should reject if the context.target is undefined', () => assert.isRejected(
            PostValidator.validate({}, undefined),
            'The context requires a constructed targetContext.'
        ));

        it('should reject if the declaration is undefined', () => assert.isRejected(
            PostValidator.validate({ target: {} }, undefined),
            'The declaration is required.'
        ));

        it('should resolve if the declaration is empty', () => assert.isFulfilled(
            PostValidator.validate(defaultContext, {})
        ));

        it('should resolve when deviceType is BIG-IQ', () => {
            defaultContext.target.tmosVersion = '13.1';
            defaultContext.target.deviceType = 'BIG-IQ';
            const decl = {
                class: 'ADC',
                schemaVersion: '3.18.0',
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'generic',
                        tlsServer: {
                            class: 'TLS_Server',
                            tls1_3Enabled: true
                        }
                    }
                }
            };
            return assert.isFulfilled(PostValidator.validate(defaultContext, decl));
        });

        describe('protocol inspection profiles', () => {
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.17.0',
                Sample_PIP_01: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        template: 'generic',
                        DNSInspectionProfile: {
                            class: 'Protocol_Inspection_Profile',
                            remark: 'Custom DNS Inspection Profile',
                            collectAVRStats: true,
                            enableComplianceChecks: true,
                            enableSignatureChecks: true,
                            autoAddNewInspections: true,
                            autoPublish: true,
                            defaultFromProfile: 'protocol_inspection_dns',
                            services: [
                                {
                                    type: 'dns',
                                    compliance: [
                                        {
                                            check: 'dns_maximum_reply_length'
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            };

            it('should succeed if tmos version is 14.0 with protocol inspection profile in decl', () => {
                defaultContext.target.tmosVersion = '14.0';

                return assert.isFulfilled(PostValidator.validate(defaultContext, declaration));
            });

            it('should error if tmos version is 13.1 with autoAddNewInspections on protocol inspection profile', () => {
                const localDecl = {
                    class: 'ADC',
                    schemaVersion: '3.17.0',
                    Sample_PIP_01: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            template: 'generic',
                            DNSInspectionProfile: {
                                class: 'Protocol_Inspection_Profile',
                                remark: 'Custom DNS Inspection Profile',
                                collectAVRStats: true,
                                enableComplianceChecks: true,
                                enableSignatureChecks: true,
                                autoAddNewInspections: true,
                                defaultFromProfile: 'protocol_inspection_dns',
                                services: [
                                    {
                                        type: 'dns',
                                        compliance: [
                                            {
                                                check: 'dns_maximum_reply_length'
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                };
                defaultContext.target.tmosVersion = '13.1';

                return assert.isRejected(
                    PostValidator.validate(defaultContext, localDecl),
                    'Auto Add New Inspections property is only available on TMOS 14.0+'
                );
            });

            it('should error if tmos version is 13.1 with autoPublish on protocol inspection profile', () => {
                const localDecl = {
                    class: 'ADC',
                    schemaVersion: '3.17.0',
                    Sample_PIP_01: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            template: 'generic',
                            DNSInspectionProfile: {
                                class: 'Protocol_Inspection_Profile',
                                remark: 'Custom DNS Inspection Profile',
                                collectAVRStats: true,
                                enableComplianceChecks: true,
                                enableSignatureChecks: true,
                                autoPublish: true,
                                defaultFromProfile: 'protocol_inspection_dns',
                                services: [
                                    {
                                        type: 'dns',
                                        compliance: [
                                            {
                                                check: 'dns_maximum_reply_length'
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                };
                defaultContext.target.tmosVersion = '13.1';

                return assert.isRejected(
                    PostValidator.validate(defaultContext, localDecl),
                    'Auto Publish property is only available on TMOS 14.0+'
                );
            });
        });

        describe('bbr', () => {
            it('should error if the tmos version is 13.1 and the congestionControl is bbr', () => {
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '3.14.0',
                    id: 'TCP_Profile',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug'
                    },
                    TEST_TCP_Profile: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'TCP_Profile',
                                congestionControl: 'bbr'
                            }
                        }
                    }
                };

                defaultContext.target.tmosVersion = '13.1';

                return assert.isRejected(
                    PostValidator.validate(defaultContext, declaration),
                    'BBR Congestion Control is only available on TMOS 14.1+'
                );
            });

            it('should succeed if tmos is 14.1 and congestionControl is bbr', () => {
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '3.14.0',
                    id: 'TCP_Profile',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug'
                    },
                    TEST_TCP_Profile: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'TCP_Profile',
                                congestionControl: 'bbr'
                            }
                        }
                    }
                };

                defaultContext.target.tmosVersion = '14.1';

                return assert.isFulfilled(PostValidator.validate(defaultContext, declaration));
            });
        });

        describe('tls 1.3', () => {
            it('should error if the tmos version is 13.1 and the tls 1.3 is enabled', () => {
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '3.14.0',
                    id: 'TLS_Server',
                    TEST_TLS_Server: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'TLS_Server',
                                tls1_3Enabled: true
                            }
                        }
                    }
                };

                defaultContext.target.tmosVersion = '13.1';

                return assert.isRejected(
                    PostValidator.validate(defaultContext, declaration),
                    'TLS 1.3 ciphers are only available on TMOS 14.0+'
                );
            });

            it('should succeed if the tmos version is 13.1 and the tls 1.3 is enabled', () => {
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '3.14.0',
                    id: 'TLS_Server',
                    TEST_TLS_Server: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'TLS_Server',
                                tls1_3Enabled: true
                            }
                        }
                    }
                };

                defaultContext.target.tmosVersion = '14.0';

                return assert.isFulfilled(PostValidator.validate(defaultContext, declaration));
            });
        });

        describe('path length', () => {
            it('should error if the path length is too long', () => {
                /* eslint-disable max-len */
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '1.0.0',
                    T: {
                        class: 'Tenant',
                        A: {
                            class: 'Application',
                            A2345678911234567892123456789312345678941234567895123456789612345678971234567898123456789912345678901234567891123456789212345678931234567894123456789512345678961234567897123456789812345678991: {
                                class: 'Service_Generic'
                            }
                        }
                    }
                };

                return assert.isRejected(
                    PostValidator.validate(defaultContext, declaration),
                    /\/T\/A\/A2345678911234567892123456789312345678941234567895123456789612345678971234567898123456789912345678901234567891123456789212345678931234567894123456789512345678961234567897123456789812345678991 is longer than/
                );
                /* eslint-enable max-len */
            });

            it('should succeed if the path length is not too long with multiple Tenants & Applications', () => {
                /* eslint-disable max-len */
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '1.0.0',
                    T: {
                        class: 'Tenant',
                        A: {
                            class: 'Application',
                            A234567891123456789212345678931234567894123456789512345678961234567897123456789812345678991234567890123456789112345678921234567893123456789412345678951234567896123456789712345678981234567899: {
                                class: 'Service_Generic'
                            },
                            anotherItem: {
                                class: 'Service_HTTP'
                            }
                        },
                        A1: {
                            class: 'Application',
                            ZhObneQwCKedxdhUToBrSZpTvWXOnnyOsDNJeBhjLMdRYTbhVeyXQwelpxyLdcOxUvHGhuAOMSGVHJCQxvKHhJYYNhAEglDOqWHHzJAmYCiAlOOmdzAbnTElhKyyrhILQiVGJueoANWqHGDcaEeTxFPhwCCVqKJVrTpMvZpEESWgtxZqCbLqcRoxLpNoS: {
                                class: 'Service_Generic'
                            },
                            anotherItem: {
                                class: 'Service_HTTP'
                            }
                        },
                        A2: {
                            class: 'Application',
                            zvSQYFjBlqyUHkOiliuvOAChhmCvSKbAwRiGvAFxeXmcNDDtZCtAGdnFsCTLskjXjqWUDOPtdekEkCJLPqSsguThYPxMPcQaPmDK: {
                                class: 'Service_Generic'
                            },
                            anotherItem: {
                                class: 'Service_HTTP'
                            }
                        }
                    },
                    T2: {
                        class: 'Tenant',
                        A: {
                            class: 'Application',
                            A23456789112345678921234567893123456789412345678951234567896123456789712345678981234567899123456789012345678911234567892123456789312345678941234567895123456789612345678971234567898123456789: {
                                class: 'Service_Generic'
                            },
                            anotherItem: {
                                class: 'Service_HTTP'
                            }
                        }
                    }
                };
                /* eslint-enable max-len */

                return assert.isFulfilled(PostValidator.validate(defaultContext, declaration));
            });
        });

        describe('Services', () => {
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.14.0',
                id: 'Bot_Defense',
                Bot_Defense: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        template: 'generic',
                        testItem: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['192.0.2.4'],
                            profileBotDefense: {
                                bigip: '/Common/bot-defense'
                            }
                        }
                    }
                }
            };

            it('should succeed when the version is 14.1', () => {
                defaultContext.target.tmosVersion = '14.1';
                return assert.isFulfilled(PostValidator.validate(defaultContext, declaration));
            });

            it('should succeed when the version is greater than 14.1', () => {
                defaultContext.target.tmosVersion = '15.1';
                return assert.isFulfilled(PostValidator.validate(defaultContext, declaration));
            });

            it('should error when the version is less than 14.1', () => {
                defaultContext.target.tmosVersion = '13.1';
                return assert.isRejected(
                    PostValidator.validate(defaultContext, declaration),
                    'profileBotDefense is only available on TMOS 14.1+'
                );
            });
        });
    });
});

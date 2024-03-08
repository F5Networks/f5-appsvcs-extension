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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;
const sinon = require('sinon');
const nock = require('nock');

const SchemaValidator = require('../../../src/lib/schemaValidator');
const As3Parser = require('../../../src/lib/adcParser');
const log = require('../../../src/lib/log');
const Tag = require('../../../src/lib/tag');
const util = require('../../../src/lib/util/util');
const DEVICE_TYPES = require('../../../src/lib/constants').DEVICE_TYPES;
const Context = require('../../../src/lib/context/context');
const Config = require('../../../src/lib/config');
const PostProcessor = require('../../../src/lib/postProcessor');

describe('adcParser', function () {
    this.timeout(5000);
    const schemaPaths = [
        `file://${__dirname}/../../../src/schema/latest/adc-schema.json`,
        `file://${__dirname}/../../../src/schema/latest/app-schema.json`
    ];
    const schemaConfigsBigIp = [{
        paths: schemaPaths
    }];
    const schemaConfigsBigIq = [{
        paths: schemaPaths,
        options: { useDefaults: false }
    }];
    const schemaValidatorBigIp = new SchemaValidator(DEVICE_TYPES.BIG_IP, schemaConfigsBigIp);
    const schemaValidatorBigIq = new SchemaValidator(DEVICE_TYPES.BIG_IQ, schemaConfigsBigIq);
    let logWarningSpy;
    let secretTagSpy;
    let context;
    let postProcessSpy;

    before(() => schemaValidatorBigIp.init()
        .then(() => schemaValidatorBigIq.init()));

    beforeEach(() => {
        context = Context.build();
        logWarningSpy = sinon.stub(log, 'warning');
        sinon.stub(util, 'getNodelist').resolves([]);
        sinon.stub(util, 'getVirtualAddressList').resolves([]);
        sinon.stub(util, 'getAccessProfileList').resolves([]);
        sinon.stub(util, 'getAddressListList').resolves([]);
        sinon.stub(util, 'getSnatTranslationList').resolves([]);
        secretTagSpy = sinon.stub(Tag.SecretTag, 'process').resolves();
        sinon.stub(Tag.LongSecretTag, 'process').resolves();
        sinon.stub(Tag.FetchTag, 'process').resolves();
        sinon.stub(Tag.BigComponentTag, 'process').resolves();
        sinon.stub(Config, 'getAllSettings').resolves({ serviceDiscoveryEnabled: true });
        postProcessSpy = sinon.spy(PostProcessor, 'process');
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    const getBigIpParser = () => {
        const parser = new As3Parser(schemaValidatorBigIp);
        context.host.parser = parser;
        return parser;
    };

    const getBigIqParser = () => {
        const parser = new As3Parser(schemaValidatorBigIq);
        context.host.parser = parser;
        return parser;
    };

    function assertInvalid(declaration, errMessage, parser) {
        return parser.digest(context, declaration)
            .then(
                () => {
                    throw new Error('Declaration was successful');
                },
                (err) => {
                    let errMsg;
                    let errMsgFound;
                    if (err) {
                        errMsg = err.errors ? err.errors[0] : (err.message || err);
                        errMsgFound = errMsg.includes(errMessage);
                    } else {
                        const loggedWarning = logWarningSpy.args
                            .find((call) => call[0].errors && call[0].errors[0].includes(errMessage));
                        errMsgFound = typeof loggedWarning !== 'undefined';
                    }
                    assert.equal(errMsgFound, true, `Expected to find error message: ${errMessage}`);
                    return Promise.resolve(true);
                }
            );
    }

    describe('validation', function () {
        it('should fail on empty JSON', () => assertInvalid(
            {},
            'lacks valid \'id\'',
            getBigIpParser()
        ));

        it('should fail on bad tenant name', () => assertInvalid(
            {
                class: 'ADC',
                id: 'id',
                scratch: 'scratch',
                'f5*com': { class: 'Tenant' }
            },
            '"f5*com" should match pattern',
            getBigIpParser()
        ));

        it('should call validatePathLength', () => {
            const parser = getBigIpParser();
            const spy = sinon.spy(parser, 'validatePathLength');
            const decl = {
                id: 'testPathLength',
                class: 'ADC',
                schemaVersion: '3.0.0',
                testTenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['192.0.2.200'],
                            virtualPort: 80
                        }
                    }
                }
            };
            return parser.digest(context, decl)
                .then(() => {
                    sinon.assert.calledOnce(spy);
                });
        });

        it('.validatePathLength should throw when path > 255 chars', () => {
            const parser = getBigIpParser();
            const decl = {
                id: 'id',
                ThisIsTheTenantForThePathThatWillDefinitelyExceedTheCharacterLimitWhichIsTwoHundredFiftyFive: {
                    class: 'Tenant',
                    NowTheApplicationWillHelpMakeThePathLongerSoThatItWillExceedTheLimitOfCharacters: {
                        class: 'Application',
                        // eslint-disable-next-line max-len
                        AndFinallyWeArriveToAnItemThatWillAlsoBeInThePathSoWeJustNeedSomeMoreCharactersToFinishGettingThere: {}
                    }
                }
            };
            assert.throws(
                () => parser.validatePathLength(decl),
                /exceeds the 255 full path character limit/
            );
        });

        it('should redact sensitive aws information', () => {
            const parser = getBigIpParser();
            const decl = {
                id: 'redactAWS',
                class: 'ADC',
                schemaVersion: '3.0.0',
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        webpool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    addressDiscovery: 'aws',
                                    updateInterval: 1,
                                    tagKey: 'foo',
                                    tagValue: 'bar',
                                    addressRealm: 'private',
                                    region: 'us-west-2-lax-1',
                                    accessKeyId: 'xxxxx',
                                    secretAccessKey: 'secret',
                                    credentialUpdate: false
                                }
                            ]
                        }
                    }
                }
            };
            const options = {
                copySecrets: true,
                baseDeclaration: decl
            };
            return parser.digest(context, decl, options)
                .then(() => {
                    assert.deepStrictEqual(decl.tenant.app.webpool.members[0].accessKeyId, '<redacted>');
                });
        });

        it('should redact sensitive azure information', () => {
            const parser = getBigIpParser();
            const decl = {
                id: 'redactAzure',
                class: 'ADC',
                schemaVersion: '3.0.0',
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        webpool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    addressDiscovery: 'azure',
                                    updateInterval: 1,
                                    tagKey: 'foo',
                                    tagValue: 'bar',
                                    apiAccessKey: 'xxxxx',
                                    resourceGroup: 'xxxxx',
                                    subscriptionId: 'xxxxx',
                                    directoryId: 'xxxxx',
                                    applicationId: 'xxxxx'
                                }
                            ]
                        }
                    }
                }
            };
            const options = {
                copySecrets: true,
                baseDeclaration: decl
            };
            return parser.digest(context, decl, options)
                .then(() => {
                    assert.deepStrictEqual(decl.tenant.app.webpool.members[0].resourceGroup, '<redacted>');
                    assert.deepStrictEqual(decl.tenant.app.webpool.members[0].subscriptionId, '<redacted>');
                    assert.deepStrictEqual(decl.tenant.app.webpool.members[0].directoryId, '<redacted>');
                    assert.deepStrictEqual(decl.tenant.app.webpool.members[0].applicationId, '<redacted>');
                });
        });

        it('should validate using the per app schema and skip PostProcessing', () => {
            const parser = getBigIpParser();
            context.request.isPerApp = true;
            context.request.body = {
                id: 'autogen_new-uuid-xxxx'
            }; // This simulates the id added to the transformed declaration

            const decl = {
                schemaVersion: '3.50',
                app: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.100'],
                        virtualPort: 80,
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool'
                    }
                }
            };
            const options = {
                isPerApp: true
            };

            return parser.digest(context, decl, options)
                .then(() => {
                    assert.strictEqual(postProcessSpy.called, false);
                    assert.deepStrictEqual(
                        decl,
                        {
                            schemaVersion: '3.50',
                            app: {
                                class: 'Application',
                                service: {
                                    class: 'Service_HTTP',
                                    virtualAddresses: ['192.0.2.100'],
                                    virtualPort: 80,
                                    pool: 'pool', // Skipped PostProcessing
                                    persistenceMethods: ['cookie'],
                                    profileHTTP: 'basic',
                                    virtualType: 'standard',
                                    layer4: 'tcp',
                                    profileTCP: 'normal',
                                    serviceDownImmediateAction: 'none',
                                    shareAddresses: false,
                                    enable: true,
                                    maxConnections: 0,
                                    snat: 'auto',
                                    addressStatus: true,
                                    mirroring: 'none',
                                    lastHop: 'default',
                                    translateClientPort: false,
                                    translateServerAddress: true,
                                    translateServerPort: true,
                                    nat64Enabled: false,
                                    httpMrfRoutingEnabled: false,
                                    rateLimit: 0,
                                    adminState: 'enable'
                                },
                                pool: {
                                    class: 'Pool',
                                    allowNATEnabled: true,
                                    allowSNATEnabled: true,
                                    loadBalancingMode: 'round-robin',
                                    minimumMembersActive: 1,
                                    reselectTries: 0,
                                    serviceDownAction: 'none',
                                    slowRampTime: 10
                                },
                                template: 'generic',
                                enable: true
                            }
                        }
                    );
                });
        });

        it('should invalidate when using the per app schema and an invalid property', () => {
            const parser = getBigIpParser();
            context.request.isPerApp = true;
            context.request.body = {
                id: 'autogen_new-uuid-xxxx'
            }; // This simulates the id added to the transformed declaration
            const decl = {
                app: {
                    class: 'Application',
                    invalidProperty: '',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.100'],
                        virtualPort: 80,
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool'
                    }
                }
            };
            const options = {
                isPerApp: true
            };
            return assert.isRejected(parser.digest(context, decl, options))
                .then(() => {
                    assert.strictEqual(postProcessSpy.called, false);
                    assert.deepStrictEqual(logWarningSpy.args[0][0], {
                        status: 422,
                        message: 'declaration is invalid',
                        errors: [
                            '/app/invalidProperty: should be object'
                        ]
                    });
                });
        });

        it('should invalidate when using a tenant declaration against the app schema', () => {
            const parser = getBigIpParser();
            context.request.isPerApp = true;
            context.request.body = {
                id: 'autogen_new-uuid-xxxx'
            }; // This simulates the id added to the transformed declaration
            const decl = {
                class: 'ADC',
                schemaVersion: '3.45.0',
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['192.0.2.100'],
                            virtualPort: 80,
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool'
                        }
                    }
                }
            };
            const options = {
                isPerApp: true
            };
            return assert.isRejected(parser.digest(context, decl, options))
                .then(() => {
                    assert.strictEqual(logWarningSpy.called, true);
                    assert.deepStrictEqual(logWarningSpy.args[0][0], {
                        errors: [
                            '/class: should be object'
                        ],
                        message: 'declaration is invalid',
                        status: 422
                    });
                    assert.strictEqual(postProcessSpy.called, false);
                });
        });

        it('should invalidate when using a per-app declaration against the adc schema', () => {
            const parser = getBigIpParser();
            context.request.isPerApp = false;
            context.request.body = {
                id: 'autogen_new-uuid-xxxx'
            }; // This simulates the id added to the transformed declaration
            const decl = {
                id: 'test', // While id is not supported, this is added to simulate bad user input
                app: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.100'],
                        virtualPort: 80,
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool'
                    }
                }
            };
            return assert.isRejected(parser.digest(context, decl))
                .then(() => {
                    assert.deepStrictEqual(logWarningSpy.args[0][0], {
                        status: 422,
                        message: 'declaration is invalid',
                        errors: ['/app/service/virtualAddresses: should be object']
                    });
                });
        });

        it('should copy secrets to base declaration if enabled', () => {
            const parser = getBigIpParser();
            const origDecl = {
                id: 'test-encrypt',
                class: 'ADC',
                schemaVersion: '3.0.0',
                target: { address: '192.0.2.1' },
                testTenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'generic',
                        webcert1: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----theCert-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----theKey-----END RSA PRIVATE KEY-----', // gitleaks:allow
                            passphrase: {
                                ciphertext: 'mumblemumble',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                            }
                        },
                        monitor1: {
                            class: 'Monitor',
                            monitorType: 'external',
                            script: {
                                url: {
                                    url: 'https://www.example.com',
                                    authentication: {
                                        method: 'bearer-token',
                                        token: 'foo'
                                    }
                                }
                            }
                        }
                    }
                }
            };
            const decl = util.simpleCopy(origDecl);
            const options = {
                copySecrets: true,
                baseDeclaration: origDecl
            };
            const encryptedSecret = {
                ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                miniJWE: true
            };
            const expectDecl = util.simpleCopy(origDecl);
            expectDecl.testTenant.app.webcert1.passphrase = Object.assign({}, encryptedSecret);
            expectDecl.testTenant.app.monitor1.script.url.authentication.token = encryptedSecret.ciphertext;

            Tag.SecretTag.process.restore();
            sinon.stub(Tag.SecretTag, 'process').callsFake((ctrls, dec, sec) => {
                Object.assign(sec[0].data, encryptedSecret);
                return Promise.resolve();
            });

            Tag.LongSecretTag.process.restore();
            sinon.stub(Tag.LongSecretTag, 'process').callsFake((ctrls, dec, sec) => {
                sec[0].parentData[sec[0].parentDataProperty] = encryptedSecret.ciphertext;
                return Promise.resolve([]);
            });

            return parser.digest(context, decl, options)
                .then(() => {
                    assert.deepStrictEqual(origDecl, expectDecl);
                })
                .catch((err) => {
                    throw err;
                });
        });
    });

    describe('platform behavior', function () {
        it('should expand decl when on BIG-IP', () => {
            const parser = getBigIpParser();
            const origDecl = {
                id: 'testBIGIP',
                class: 'ADC',
                schemaVersion: '3.0.0',
                testTenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['192.0.2.200'],
                            virtualPort: 80
                        }
                    }
                }
            };
            const decl = Object.assign({}, origDecl);
            return parser.digest(context, decl)
                .then(() => {
                    assert.notDeepEqual(decl, origDecl);
                    assert.strictEqual(decl.id, origDecl.id);
                    // test one of the known defaults
                    assert.strictEqual(decl.testTenant.app.enable, true);
                });
        });

        it('should still validate when on BIG-IQ', () => assertInvalid(
            {
                id: 'id',
                tenant: { class: 'Tenant' }
            },
            'should have required property \'class\'',
            getBigIqParser()
        ));

        it('should still handle secrets when on BIG-IQ', () => {
            const parser = getBigIqParser();
            const origDecl = {
                id: 'testBIGIQ-encrypt',
                class: 'ADC',
                schemaVersion: '3.0.0',
                target: { address: '192.0.2.1' },
                testTenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'generic',
                        webcert1: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----theCert-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----theKey-----END RSA PRIVATE KEY-----', // gitleaks:allow
                            passphrase: {
                                ciphertext: 'mumblemumble',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                            }
                        }
                    }
                }
            };
            const decl = Object.assign({}, origDecl);
            return parser.digest(context, decl)
                .then(() => {
                    const matchedSecret = secretTagSpy.args
                        .find((call) => call[2].data && call[2].data.ciphertext === 'mumblemumble');
                    assert.notStrictEqual(typeof matchedSecret, undefined);
                });
        });

        it('should NOT expand declaration when on BIG-IQ', () => {
            const parser = getBigIqParser();
            const origDecl = {
                id: 'testBIGIQ-expand',
                class: 'ADC',
                schemaVersion: '3.0.0',
                target: { address: '192.0.2.1' },
                testTenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['192.0.2.100']
                        }
                    }
                }
            };
            const decl = Object.assign({}, origDecl);
            return parser.digest(context, decl)
                .then(() => {
                    assert.deepStrictEqual(decl, origDecl);
                });
        });
    });
});

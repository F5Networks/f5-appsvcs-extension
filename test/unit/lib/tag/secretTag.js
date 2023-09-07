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

const sinon = require('sinon');
const nock = require('nock');
const AJV = require('ajv');
const assert = require('assert');
const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const SecretTag = require('../../../../src/lib/tag').SecretTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const log = require('../../../../src/lib/log');

describe('SecretTag', () => {
    let context;
    let declaration;
    let logErrorSpy;

    beforeEach(() => {
        context = Context.build();
        context.tasks = [{ urlPrefix: 'https://localhost:8100' }];
        declaration = {};
        sinon.stub(log, 'warning');
        logErrorSpy = sinon.stub(log, 'error');
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.process', () => {
        const assertProcessSecrets = (secrets, expectedSecrets, expectedErrors) => {
            if (typeof expectedErrors === 'undefined') {
                expectedErrors = [];
            }

            return SecretTag
                .process(context, declaration, secrets)
                .then(() => {
                    const errors = logErrorSpy.getCalls().map((c) => c.args[0]);
                    secrets = secrets.map((s) => s.data);
                    assert.deepStrictEqual(secrets, expectedSecrets);
                    assert.deepStrictEqual(errors, expectedErrors);
                });
        };

        it('should resolve if secrets is undefined', () => SecretTag.process(context, declaration));

        it('should resolve if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return SecretTag.process(context, declaration, []);
        });

        it('should return empty array if no secrets to process', () => assertProcessSecrets([], []));

        it('should return secrets if not JWE', () => assertProcessSecrets(
            [
                {
                    data: 'as3Secret',
                    instancePath: undefined
                },
                {
                    data: { protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0' },
                    instancePath: undefined
                },
                {
                    data: { ciphertext: 'YXMzU2VjcmV0' },
                    instancePath: undefined
                }
            ],
            [
                'as3Secret',
                { protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0' },
                { ciphertext: 'YXMzU2VjcmV0' }
            ]
        ));

        it('should return undefined if secrets are undefined', () => assertProcessSecrets(
            [
                {
                    data: undefined
                }
            ],
            [
                undefined
            ]
        ));

        it('should return error if protected cannot be parsed', () => {
            let expectedErrMsg;

            try {
                JSON.parse('notAnObject');
            } catch (err) {
                expectedErrMsg = `Error parsing 'protected' property: ${err.message}`;
            }

            try {
                SecretTag.process(context, declaration, [
                    {
                        data: {
                            protected: 'bm90QW5PYmplY3Q=',
                            ciphertext: 'YXMzU2VjcmV0'
                        },
                        instancePath: 'my/data/path'
                    }
                ]);
            } catch (err) {
                assert.ok(err instanceof AJV.ValidationError);
                assert.deepStrictEqual(err.errors, [{
                    dataPath: 'my/data/path',
                    keyword: 'f5PostProcess(secret)',
                    params: {},
                    message: expectedErrMsg
                }]);
                return;
            }
            assert.fail('should have thrown error');
        });

        it('should return secrets if ciphertext is already encrypted', () => assertProcessSecrets(
            [
                {
                    data: {
                        protected: 'eyJhbGciOiJkaXIifQ==',
                        ciphertext: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                    },
                    instancePath: 'my/data/pathOne'
                },
                {
                    data: {
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                        ciphertext: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                    },
                    instancePath: 'my/data/pathTwo'
                }
            ],
            [
                {
                    protected: 'eyJhbGciOiJkaXIifQ==',
                    ciphertext: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                },
                {
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                    ciphertext: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                }
            ]
        ));

        it('should log error and return secrets if fails to encrypt on BIG-IQ', () => {
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            nock('https://localhost:8100')
                .post('/mgmt/cm/system/simple-encrypter')
                .reply(200, {});

            return assertProcessSecrets(
                [
                    {
                        data: {
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ciphertext: 'YXMzU2VjcmV0'
                        },
                        instancePath: 'my/data/path'
                    }
                ],
                [
                    {
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ciphertext: 'YXMzU2VjcmV0'
                    }
                ],
                ['f5PostProcess(secret): encryption failed']
            );
        });

        it('should encrypt secret on BIG-IQ', () => {
            let postRequest;

            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            nock('https://localhost:8100')
                .post('/mgmt/cm/system/simple-encrypter')
                .reply(200, (uri, requestBody) => {
                    postRequest = requestBody;
                    return { encryptedText: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw==' };
                });

            return assertProcessSecrets(
                [
                    {
                        data: {
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ciphertext: 'YXMzU2VjcmV0'
                        },
                        instancePath: 'my/data/path'
                    }
                ],
                [
                    {
                        ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                        miniJWE: true,
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNWJpcSJ9'
                    }
                ]
            ).then(() => {
                assert.deepStrictEqual(postRequest, { inputText: 'as3Secret' });
            });
        });

        it('should encrypt secret on BIG-IP', () => {
            const secureVaultStub = sinon.stub(secureVault, 'encrypt').resolves('$M$dG$Nd0rDcsTyKsm7XPWlf3yuw==');

            return assertProcessSecrets(
                [
                    {
                        data: {
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            ciphertext: 'YXMzU2VjcmV0'
                        },
                        instancePath: 'my/data/path'
                    }
                ],
                [
                    {
                        ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                        miniJWE: true,
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0='
                    }
                ]
            ).then(() => {
                assert.strictEqual(secureVaultStub.args[0][0], 'as3Secret');
            });
        });

        it('should error if SecureVault fails to encrypt secret', () => {
            sinon.stub(secureVault, 'encrypt').rejects(new Error('Encryption failed! Failed to retrieve secret'));
            let rejected = false;

            return SecretTag.process(context, declaration, [
                {
                    data: {
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ciphertext: 'YXMzU2VjcmV0'
                    },
                    instancePath: 'my/data/path'
                }
            ]).catch((err) => {
                rejected = true;
                assert.ok(err instanceof AJV.ValidationError);
                assert.deepStrictEqual(err.errors, [{
                    dataPath: 'my/data/path',
                    keyword: 'f5PostProcess(secret)',
                    params: {},
                    message: 'Encryption failed! Failed to retrieve secret'
                }]);
            }).then(() => {
                assert.ok(rejected, 'should have rejected');
            });
        });
    });
});

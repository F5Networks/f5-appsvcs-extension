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

const AJV = require('ajv');
const sinon = require('sinon');
const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const assert = require('assert');
const LongSecretTag = require('../../../../src/lib/tag').LongSecretTag;
const SecretTag = require('../../../../src/lib/tag/secretTag');
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;

describe('LongSecretTag', () => {
    let context;
    let declaration;

    beforeEach(() => {
        context = Context.build();
        declaration = { parentData: { data: 'test secret' } };
    });

    afterEach(() => {
        sinon.restore();
    });

    const getSecrets = () => [{
        data: declaration.parentData.data,
        parentData: declaration.parentData,
        parentDataProperty: 'data',
        instancePath: '/parentData/data'
    }];

    describe('.process', () => {
        it('should resolve if secrets is undefined', () => LongSecretTag.process(context, declaration));

        it('should resolve if no secrets to process', () => LongSecretTag.process(context, declaration, []));

        it('should skip encrypting secrets if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return LongSecretTag.process(context, declaration, getSecrets())
                .then(() => {
                    assert.strictEqual(declaration.parentData.data, 'test secret', 'secret should not be encrypted');
                });
        });

        it('should not re-encrypt secrets if already encrypted', () => {
            declaration.parentData.data = {
                ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0='
            };
            const expectedData = {
                ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0='
            };
            return LongSecretTag.process(context, declaration, getSecrets())
                .then(() => {
                    assert.deepStrictEqual(declaration.parentData.data, expectedData);
                });
        });

        it('should throw error if protected cannot be parsed', () => {
            let expectedErrMsg;

            declaration.parentData.data = {
                protected: 'bm90QW5PYmplY3Q=',
                ciphertext: 'YXMzU2VjcmV0'
            };

            try {
                JSON.parse('notAnObject');
            } catch (err) {
                expectedErrMsg = `Error parsing 'protected' property: ${err.message}`;
            }

            try {
                LongSecretTag.process(context, declaration, getSecrets());
            } catch (err) {
                assert.ok(err instanceof AJV.ValidationError);
                assert.deepStrictEqual(err.errors, [{
                    dataPath: '/parentData/data',
                    keyword: 'f5PostProcess(longSecret)',
                    params: {},
                    message: expectedErrMsg
                }]);
                return;
            }
            assert.fail('should have thrown error');
        });

        it('should add generic data path to error if data path is missing', () => {
            let expectedErrMsg;

            declaration.parentData.data = {
                protected: 'bm90QW5PYmplY3Q=',
                ciphertext: 'YXMzU2VjcmV0'
            };
            const secrets = getSecrets();
            secrets[0].instancePath = '';

            try {
                JSON.parse('notAnObject');
            } catch (err) {
                expectedErrMsg = `Error parsing 'protected' property: ${err.message}`;
            }

            try {
                LongSecretTag.process(context, declaration, secrets);
            } catch (err) {
                assert.ok(err instanceof AJV.ValidationError);
                assert.deepStrictEqual(err.errors, [{
                    dataPath: 'unknown path',
                    keyword: 'f5PostProcess(longSecret)',
                    params: {},
                    message: expectedErrMsg
                }]);
                return;
            }
            assert.fail('should have thrown error');
        });

        describe('BIG-IQ', () => {
            let secretTagSpy;

            beforeEach(() => {
                context.target.deviceType = DEVICE_TYPES.BIG_IQ;
                secretTagSpy = sinon.stub(SecretTag, 'process').resolves();
            });

            it('should rely on SecretTag processor to encrypt data', () => {
                const expectedData = {
                    ciphertext: 'dGVzdCBzZWNyZXQ=',
                    ignoreChanges: false,
                    miniJWE: true,
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                };
                return LongSecretTag.process(context, declaration, getSecrets())
                    .then(() => {
                        assert.deepStrictEqual(secretTagSpy.args[0][2][0].data, expectedData);
                        assert.deepStrictEqual(declaration.parentData.data, expectedData);
                    });
            });

            it('should skip encrypting secret if more than 2000 characters', () => {
                declaration.parentData.data = 'a'.repeat(2001);
                return LongSecretTag.process(context, declaration, getSecrets())
                    .then(() => {
                        assert.deepStrictEqual(secretTagSpy.called, false);
                        assert.strictEqual(declaration.parentData.data, 'a'.repeat(2001), 'secret should not be encrypted');
                    });
            });

            it('should error if data is already encrypted', () => {
                const longSecrets = [{
                    data: { ciphertext: 'dGVzdCBzZWNyZXQ=' }
                }];
                const expectedErrMsg = 'BIG-IQ received the following already encrypted data,'
                    + ' instead of a string: {"ciphertext":"dGVzdCBzZWNyZXQ="}';
                let rejected = true;
                return LongSecretTag.process(context, declaration, longSecrets)
                    .then(() => {
                        rejected = false;
                    })
                    .catch((err) => {
                        assert.strictEqual(err.message, expectedErrMsg);
                    })
                    .then(() => {
                        assert.ok(rejected, 'should have rejected');
                    });
            });
        });

        describe('BIG-IP', () => {
            let secureVaultSpy;

            beforeEach(() => {
                secureVaultSpy = sinon.stub(secureVault, 'encrypt').resolves('dGVzdCBzZWNyZXQ=');
            });

            it('should rely on SecureVault to encrypt data', () => LongSecretTag
                .process(context, declaration, getSecrets())
                .then(() => {
                    assert.strictEqual(secureVaultSpy.args[0][0], 'test secret');
                    assert.deepStrictEqual(declaration.parentData.data, 'dGVzdCBzZWNyZXQ=');
                }));

            it('should decode data object before encrypting', () => {
                declaration.parentData.data = {
                    ciphertext: 'dGVzdCBzZWNyZXQ=',
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0='
                };
                return LongSecretTag.process(context, declaration, getSecrets())
                    .then(() => {
                        assert.strictEqual(secureVaultSpy.args[0][0], 'test secret');
                        assert.deepStrictEqual(declaration.parentData.data, 'dGVzdCBzZWNyZXQ=');
                    });
            });

            it('should error if SecureVault fails to encrypt secret', () => {
                const expectedErrMsg = 'Failed encrypting credential with secureVault: SecureVault'
                    + ' test failure';
                let rejected = true;
                secureVault.encrypt.restore();
                sinon.stub(secureVault, 'encrypt').rejects(new Error('SecureVault test failure'));
                return LongSecretTag.process(context, declaration, getSecrets())
                    .then(() => {
                        rejected = false;
                    })
                    .catch((err) => {
                        assert.strictEqual(err.message, expectedErrMsg);
                    })
                    .then(() => {
                        assert.ok(rejected, 'should have rejected');
                    });
            });
        });
    });
});

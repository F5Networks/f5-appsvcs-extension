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
                    assert.deepStrictEqual(
                        declaration.parentData.data,
                        {
                            ciphertext: 'ZEdWemRDQnpaV055WlhRPQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0',
                            miniJWE: true
                        }
                    );
                }));

            it('should decode data object before encrypting', () => {
                declaration.parentData.data = {
                    ciphertext: 'dGVzdCBzZWNyZXQ=',
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0='
                };
                return LongSecretTag.process(context, declaration, getSecrets())
                    .then(() => {
                        assert.strictEqual(secureVaultSpy.args[0][0], 'test secret');
                        assert.deepStrictEqual(
                            declaration.parentData.data,
                            {
                                ciphertext: 'ZEdWemRDQnpaV055WlhRPQ==',
                                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0',
                                miniJWE: true
                            }
                        );
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

    describe('.encryptPrivateKey', () => {
        beforeEach(() => {
            sinon.stub(secureVault, 'encrypt').resolves('$M$4d$qi4v7Nxb278U0JoT2KMsX/IY5jmQtw9EWeA6GaYk3BWyyybrRVmwyUmkqWLOmU4U,$M$ns$IIFthXNeSBn6GqWn+Xp3MySX5eLEVkld6Q3fR58Rc9W5XFvsrX65VQQWtotFpZXnTLKYQAGZT0kc+a3Lp//kQCVnsayLufR5MPJ+cypY9T8=,$M$PX$pMmjs9YEg24QqtwjR8lVK+HIj1jx8+1Yr0FK6obGu9FbCBST6N9wAwTP3oIDvNiefTliu9gTyOw7YCiW6UxyFHMIg/XGBssO9xhRbVskrw0=,$M$uT$oLkkY1Sb7h8kB2MpJgl5EeB4sOcUUY143RVlR5FI/TcxVV9CUsdSGcF3qxa4K1cSW3HSCfyfwHvADyx1Sd6M3F3oHftARg9b0E/ex8zwKVE=,$M$kQ$eT//cXzt9AOnW4nFR/12BfkJmj6+XuGJ1rVdAp+xspxxEaNYJVANeqLQ0D9lQ7oZ4pxJQkv0S7iEasFC2ItqIj9q4+fDMnwxlHBpylXf8fo=,$M$y4$LTOz7eUVE79h33iqpJ/zw6xwwk4L5cTI+VgKlnRMJsDehAyoPnD2gYMP4VPuqn8KKNvhLxlRqkHaH47PM324KOg5GEkEYXoiTbdFlQF4t2E=,$M$uZ$nSo4HaoEs+h1KJylSIAdRzUSKh+rSR14F8DYCWmMEI68xmuM4pL3ekzVUk/RtWaCHKNHsU82jr8JU0rMyyAmO6rZ/UQT/FsLExHSj/1n1YE=,$M$zg$mc3qtvyqM/jiFNTh3yZD1BTkypy2rDxUvXUZ6Ueyml4H3NTnXvhmn+0d3aMhhtygNPW/7YZ3Hbl5lARQ8PNRRL9VuvOeH+mAMlZfUmtazdo=,$M$4N$C5n5vah/ue7eyme7vFu2DhylO+cMF7h0DczwtzrYszQMinHobqRoXCNUh0IQw8tfBoNkflC/3ItQLCiQkr8h7FMwBuO4XByywWK1C5+eS5I=,$M$2P$IwFKgm7uTfwYiark4uN/KVBlw+ZkzyWB+uytQ+I7Z2hCp8Hjk+tlvN6p5HU9ZVf7OoiP1y4dyd7Qr21cr6xzA2JCzNs8cEAsr441i+3MgyQ=,$M$gw$A90P1bc0i/xxmfdVDRIFYCnZ3e46ApFQCvzO6lDOCwaCooos9oEB34o/7JYMKgBj1s811o0E9F2UcTkse2ZGvWXIi00Pvb5+sr4aD5y3Hno=,$M$6C$SP+MDXsuvE3q9i4pszQ/0uAb8JDc+oDLG+Pkxrbo16Gp9r0KeIu6jOPXqaPfpiSPZyc1+9f7lmQgN0YEHQ170hsUphZPuZWPb00YrRQhXOo=,$M$5P$vezfeREZQGsLjimdi19OcSp4ws7tp0Q1v3baAeYB27YF8wc1/VKTHMIEqg6ip9MxDN9y9H2GNR0oY0mwGyWf7AWl3w4GtwMNeiLNykS2SmA=,$M$IS$jGM3SWO8VkQm5EY/016/q8nBjIpDOtdm5uBlA0XUxZ++Cnmk/6358cNBs/Oh9B+KfFaThTPloFxPJ06f/TO45O+X//htHrNPWICbNWSfWsU=,$M$VT$E2S0Ct5AyKLDhwVNaqydhMVoPDHQx2eL47djokEw/u//ZzfgE+3AdZ4m5WcA7V+AswPOehJ3y+uv0vKout/rb0x/yr4AJfrSSus67+3Bdyo=,$M$X9$IZJe5bGRyL2JkpYolz+7G4ODrjdpzE38k5A+GbztPw0g/ohg21+QZLNIb0/t1cBVoYjxQ5brVKS93FlNV1/iJHMIg/XGBssO9xhRbVskrw0=,$M$44$wGVpEsGan79+ny7WGjGesJYQN6+UE5bfMn3XduZC0dhVqDLRBYJ3+zAlxFgpeFvRUSsVAdAxZqOs9+kIZx3r6xcXlCI1Wlwk5RswtHqZXmQ=,$M$p1$Md3kwzi8b3WSZImjDYEnB0fRQ7HHHNhhFPrzA4rc0N1csptDdXcTrT8+b43+jJODF3Ge+IbVqHBQODaNhR50mM77ByEvDyV9iB64yVup2KA=,$M$tY$xe+3n6c8n9p/mKOaC5ofdEydKrHMcGcGku+cxOuOlBVmzJKBgke5g6aItTVVC3/Bj4/IX5HIZ5aNb9ZEd4EKFZ5x3Cm2lHMxVC/DxUCsxxU=,$M$OC$Q8omoN+Qb53ukDcUT6jO0kkRDtZawZlKaxRdt+WqaJIQwH2SclqtDM39OYgXsu5tJPDm1riU+X0qL9YpWPHtdkRHTq/m+dQlRV5wfjqOzP8=,$M$yN$rvpZibxhp2/LRHMcs1eirjN3NEyTuGHbtvzlNq/sg7bjlpHlP4uP8BIarktWVcEX4N8k57eEN6z+/DoW3t+BAcjXeUSvH/9Ai915t6sZJwU=,$M$sZ$9OhbAnBqAPNzArNAB/8VnpffeBHuUvtdIGuZ2o9JNv2lDqGWr7nIgZukwG9EKp11t49QzZ+dc7rFqr510DhOe5P6Ro3U06mbOL310ZKe0Us=,$M$4B$L/fPJ0xCDXYiK3FelQqPq6jzZSsWdTG9yBQlMKL/HfzPHNrp4aaasF6YZUrU4VDXGvZ/u5qfc2+1MAXtx5FabfY5jzvoPWEaOInuz2JLzqI=,$M$kv$gdWDXiUS+1K9YcqdkzxzuswYLRjbCb6HeCXKQFglApJ4gXRD4/RVmajdb0pKbwm84eiPCmbkXNX0EfmN/GvIJSkU7gATKKcghilGiL3QayU=,$M$kh$uJ78d93sg+MdAGWS3kfGrrgij6riz+NYUSXiyRToZDaPD3D8W94YNI6JJnhgCMw7PWhD3lfpMeY9J0IJrPyPL/rEDwC9XtNU8v6pdZu3dwU=,$M$N2$otK6yCXwTfzAQbhDTOeFjqbaVW+EBu2wZwawSNTLDDCk5Hrgyhv2kg134Q+mX/hSpXGLD0MYl6gY3YvNzcMB4D7p7F1TuOgzCoztQSjCrno=,$M$cZ$kIjG/K/bJA2Z5fc9+B2ZawHMViUU6Q8slQJuZ1jXnRY=,$M$MF$smt49aeUkx/X2/Pe88N4t5m20XmJOpLOQbak7z8gxww=');
        });

        it('should encrypt the private key', () => {
            const privateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaxy\n-----END RSA PRIVATE KEY-----'; // gitleaks:allow
            const wrongResponse = '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaxy\n-----END RSA PRIVATE KEY-----'; // gitleaks:allow
            return LongSecretTag.encryptLongSecretKey(privateKey)
                .then((result) => {
                    assert.notEqual(result, wrongResponse);
                });
        });

        it('should throw an error without encrypting when string type is not supplied', () => {
            const errMessage = 'Failed encrypting credential with secureVault: '
                + 'data.match is not a function';
            let rejected = true;
            secureVault.encrypt.restore();
            sinon.stub(secureVault, 'encrypt').rejects(new Error('data.match is not a function'));
            return LongSecretTag.encryptLongSecretKey(declaration)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.equal(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should throw an error without encrypting when undefined data supplied', () => {
            const errMessage = 'Failed encrypting credential with secureVault: '
                + 'Cannot read property `match` of undefined';
            let rejected = true;
            secureVault.encrypt.restore();
            sinon.stub(secureVault, 'encrypt').rejects(new Error('Cannot read property `match` of undefined'));
            return LongSecretTag.encryptLongSecretKey(declaration)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });

    describe('.decryptPrivateKey', () => {
        beforeEach(() => {
            sinon.stub(secureVault, 'decrypt').resolves('-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaab\n-----END RSA PRIVATE KEY-----'); // gitleaks:allow
        });

        it('should decrypt the private key', () => {
            const encryptedKey = '$M$4d$qi4v7Nxb278U0JoT2KMsX/IY5jmQtw9EWeA6GaYk3BWyyybrRVmwyUmkqWLOmU4U,$M$ns$IIFthXNeSBn6GqWn+Xp3MySX5eLEVkld6Q3fR58Rc9W5XFvsrX65VQQWtotFpZXnTLKYQAGZT0kc+a3Lp//kQCVnsayLufR5MPJ+cypY9T8=,$M$PX$pMmjs9YEg24QqtwjR8lVK+HIj1jx8+1Yr0FK6obGu9FbCBST6N9wAwTP3oIDvNiefTliu9gTyOw7YCiW6UxyFHMIg/XGBssO9xhRbVskrw0=,$M$uT$oLkkY1Sb7h8kB2MpJgl5EeB4sOcUUY143RVlR5FI/TcxVV9CUsdSGcF3qxa4K1cSW3HSCfyfwHvADyx1Sd6M3F3oHftARg9b0E/ex8zwKVE=,$M$kQ$eT//cXzt9AOnW4nFR/12BfkJmj6+XuGJ1rVdAp+xspxxEaNYJVANeqLQ0D9lQ7oZ4pxJQkv0S7iEasFC2ItqIj9q4+fDMnwxlHBpylXf8fo=,$M$y4$LTOz7eUVE79h33iqpJ/zw6xwwk4L5cTI+VgKlnRMJsDehAyoPnD2gYMP4VPuqn8KKNvhLxlRqkHaH47PM324KOg5GEkEYXoiTbdFlQF4t2E=,$M$uZ$nSo4HaoEs+h1KJylSIAdRzUSKh+rSR14F8DYCWmMEI68xmuM4pL3ekzVUk/RtWaCHKNHsU82jr8JU0rMyyAmO6rZ/UQT/FsLExHSj/1n1YE=,$M$zg$mc3qtvyqM/jiFNTh3yZD1BTkypy2rDxUvXUZ6Ueyml4H3NTnXvhmn+0d3aMhhtygNPW/7YZ3Hbl5lARQ8PNRRL9VuvOeH+mAMlZfUmtazdo=,$M$4N$C5n5vah/ue7eyme7vFu2DhylO+cMF7h0DczwtzrYszQMinHobqRoXCNUh0IQw8tfBoNkflC/3ItQLCiQkr8h7FMwBuO4XByywWK1C5+eS5I=,$M$2P$IwFKgm7uTfwYiark4uN/KVBlw+ZkzyWB+uytQ+I7Z2hCp8Hjk+tlvN6p5HU9ZVf7OoiP1y4dyd7Qr21cr6xzA2JCzNs8cEAsr441i+3MgyQ=,$M$gw$A90P1bc0i/xxmfdVDRIFYCnZ3e46ApFQCvzO6lDOCwaCooos9oEB34o/7JYMKgBj1s811o0E9F2UcTkse2ZGvWXIi00Pvb5+sr4aD5y3Hno=,$M$6C$SP+MDXsuvE3q9i4pszQ/0uAb8JDc+oDLG+Pkxrbo16Gp9r0KeIu6jOPXqaPfpiSPZyc1+9f7lmQgN0YEHQ170hsUphZPuZWPb00YrRQhXOo=,$M$5P$vezfeREZQGsLjimdi19OcSp4ws7tp0Q1v3baAeYB27YF8wc1/VKTHMIEqg6ip9MxDN9y9H2GNR0oY0mwGyWf7AWl3w4GtwMNeiLNykS2SmA=,$M$IS$jGM3SWO8VkQm5EY/016/q8nBjIpDOtdm5uBlA0XUxZ++Cnmk/6358cNBs/Oh9B+KfFaThTPloFxPJ06f/TO45O+X//htHrNPWICbNWSfWsU=,$M$VT$E2S0Ct5AyKLDhwVNaqydhMVoPDHQx2eL47djokEw/u//ZzfgE+3AdZ4m5WcA7V+AswPOehJ3y+uv0vKout/rb0x/yr4AJfrSSus67+3Bdyo=,$M$X9$IZJe5bGRyL2JkpYolz+7G4ODrjdpzE38k5A+GbztPw0g/ohg21+QZLNIb0/t1cBVoYjxQ5brVKS93FlNV1/iJHMIg/XGBssO9xhRbVskrw0=,$M$44$wGVpEsGan79+ny7WGjGesJYQN6+UE5bfMn3XduZC0dhVqDLRBYJ3+zAlxFgpeFvRUSsVAdAxZqOs9+kIZx3r6xcXlCI1Wlwk5RswtHqZXmQ=,$M$p1$Md3kwzi8b3WSZImjDYEnB0fRQ7HHHNhhFPrzA4rc0N1csptDdXcTrT8+b43+jJODF3Ge+IbVqHBQODaNhR50mM77ByEvDyV9iB64yVup2KA=,$M$tY$xe+3n6c8n9p/mKOaC5ofdEydKrHMcGcGku+cxOuOlBVmzJKBgke5g6aItTVVC3/Bj4/IX5HIZ5aNb9ZEd4EKFZ5x3Cm2lHMxVC/DxUCsxxU=,$M$OC$Q8omoN+Qb53ukDcUT6jO0kkRDtZawZlKaxRdt+WqaJIQwH2SclqtDM39OYgXsu5tJPDm1riU+X0qL9YpWPHtdkRHTq/m+dQlRV5wfjqOzP8=,$M$yN$rvpZibxhp2/LRHMcs1eirjN3NEyTuGHbtvzlNq/sg7bjlpHlP4uP8BIarktWVcEX4N8k57eEN6z+/DoW3t+BAcjXeUSvH/9Ai915t6sZJwU=,$M$sZ$9OhbAnBqAPNzArNAB/8VnpffeBHuUvtdIGuZ2o9JNv2lDqGWr7nIgZukwG9EKp11t49QzZ+dc7rFqr510DhOe5P6Ro3U06mbOL310ZKe0Us=,$M$4B$L/fPJ0xCDXYiK3FelQqPq6jzZSsWdTG9yBQlMKL/HfzPHNrp4aaasF6YZUrU4VDXGvZ/u5qfc2+1MAXtx5FabfY5jzvoPWEaOInuz2JLzqI=,$M$kv$gdWDXiUS+1K9YcqdkzxzuswYLRjbCb6HeCXKQFglApJ4gXRD4/RVmajdb0pKbwm84eiPCmbkXNX0EfmN/GvIJSkU7gATKKcghilGiL3QayU=,$M$kh$uJ78d93sg+MdAGWS3kfGrrgij6riz+NYUSXiyRToZDaPD3D8W94YNI6JJnhgCMw7PWhD3lfpMeY9J0IJrPyPL/rEDwC9XtNU8v6pdZu3dwU=,$M$N2$otK6yCXwTfzAQbhDTOeFjqbaVW+EBu2wZwawSNTLDDCk5Hrgyhv2kg134Q+mX/hSpXGLD0MYl6gY3YvNzcMB4D7p7F1TuOgzCoztQSjCrno=,$M$cZ$kIjG/K/bJA2Z5fc9+B2ZawHMViUU6Q8slQJuZ1jXnRY=,$M$MF$smt49aeUkx/X2/Pe88N4t5m20XmJOpLOQbak7z8gxww=';
            const response = '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaab\n-----END RSA PRIVATE KEY-----'; // gitleaks:allow
            return LongSecretTag.decryptLongSecretKey(encryptedKey)
                .then((result) => {
                    assert.deepStrictEqual(result, response);
                });
        });

        it('should not decrypt the private key', () => {
            const invalidDecryptData = 'invalid decrypt data';
            const response = 'invalid decrypt data';
            sinon.restore();
            sinon.stub(secureVault, 'decrypt').resolves('invalid decrypt data');
            return LongSecretTag.decryptLongSecretKey(invalidDecryptData)
                .then((result) => {
                    assert.strictEqual(result, response);
                });
        });

        it('should not decrypt the private key throws error', () => {
            const invalidDecryptData = 'invalid decrypt data';
            const errMessage = 'Failed decrypting credential with secureVault: invalid decrypt data';
            let rejected = true;
            sinon.restore();
            sinon.stub(secureVault, 'decrypt').rejects(new Error('invalid decrypt data'));
            return LongSecretTag.decryptLongSecretKey(invalidDecryptData)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });
});

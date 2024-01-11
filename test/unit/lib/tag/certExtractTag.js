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

const nock = require('nock');
const sinon = require('sinon');
const assert = require('assert');
const CertExtractTag = require('../../../../src/lib/tag').CertExtractTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const fetchUtil = require('../../../../src/lib/util/fetchUtil');

describe('certExtractTag', () => {
    let fetchValueSpy;
    let context;
    let declaration;

    beforeEach(() => {
        fetchValueSpy = sinon.spy(fetchUtil, 'fetchValue');
        context = Context.build();
        context.host.parser = { options: {} };
        context.tasks.push({ action: 'deploy', urlPrefix: 'https://localhost:8100' });
        declaration = {
            tenant: {
                application: {
                    item: {
                        pkcs12: 'MIIEdAIBAzCCBDoGCSqGSIb3DQEHAaCCBCsEggQnMIIEIzCCBB8GCSqGSIb3DQEHBqCCBBAwggQMAgEAMIIEBQYJKoZIhvcNAQcBMBwGCiqGSIb3DQEMAQYwDgQI/nEU2xuSAVcCAggAgIID2MNKbruh9PJGC3bsdOj/hsBAutS6hFtUXl1DJ8FZd2B+80ppRam4y8NKJz14Fkvr0qUOECIAPsv857EJ9PVAoYLaK6gf9jWe3nLCe8PyHv5MtJVEqORszIkQPUrI/Zsba46GLNPp1F4dEJsHXjK9XQ7yhQDIJr2yoMth+WmwBAZTx2jyoMc4m/4jcXvUTTHTOfOqqNzsS6fq3PAcYVDqC8iovWXwt7io31ix47qBvG1Vh6dCOTvupAv3KBDCJwLeSonIehobpS1SBQtLkot7LEzgLAVwpRRh4kFJ+R+dbmgH+xAxHJSb9BnSCBgW0ircrHrHFTwTHxjAd5HzGzxImPC/uuLIiKwa+7dajy2djfMgYSYkfM88zCo54hZfx1POBKQ3CF8NjFoOJZJvdi+2cQ5WO3+5xv9n6ZzyAO4W4sOvsxKQ8uwS7lL1vwFTnflvQx0y6RYsYww0nAR00D/Toq62mhpXx1Vx4ZGetVqiPU0NsLEr79l8yqZZAP4nQ68zXIYVDbKIASEFpbcCb7nDD4jExn68kWJpRINxbZ0z3hBN0RhM+LTC2Ybw5uYWezrlvxlnd2EU/ZHQGmFjWhbKH87AoWVpsGJPfcetBG4d2GhUO8X2BYitGQZuglNTZxCaWeem+QX19kCZvIkDgzp4Oi/MBpGkaS5Vjz8EQ6VhnMs2TncBVhPR6dgF3WpYOpmGOREz/Kg+8xWHqsEgI46RcEIJQ9gmVpbegmfFh6OmKXGOl0PY7bAhkLdybq2tJ23AVXKxsMOQW+5N8A4EQPp1QHFFpURsecQaKRjrj7px049zNG9Yts2Qc8KC6CGYARrxo5aeF3LK9CxsLbajcnGo1qytzn3y/1WB+rmiNQJx9e9lr63egfTWhpTMHkM9ayZX2td/mIbUDUNDZ9lsN6il7mY7EhBsdhdbGuv8wJDDS4jEdJaL8VFE2R7F1pAxSQkdF3mPFcePE0Me/vIjSv3sR+4Q44zw7dJaFU1eDAiQupLwctWKIkKeuEgEfetvZac5FqZ7KHv+MAr2AxO3jSau8cw5KR3mipzfN13cL0GdMQAKwhC6XZzZKmPJOxyhaT7V9hr7719Kqq3qX8JxVzkThHsFy5V1NjFdLvIcjQwDb0L74iwZ/mDiHdi4eKUkBQD5WiaTBBtZS8cFCXAfOZvprHFp3IuOxa2DkqKmBbTqficOxRom7gOKvaQzWlJqd/HFV4Ru0CjBXFnFXPk6FicZ6IdRzWJcVKJ/AjIDP1RUyu/NUNYbNNssK1tBW+IfGvESgaGqNzw4a/8H5G8UwSBO3bdt8kyqt+ioRjAxMCEwCQYFKw4DAhoFAAQUIvCNK3qldiHX2dfKVx7THPqQOvIECGiVUD1T1ujUAgIIAA==',
                        passphrase: {
                            ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                            ignoreChanges: true,
                            miniJWE: true
                        }
                    }
                }
            }
        };
    });

    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    const getCerts = () => [{
        tenant: 'tenant',
        data: declaration.tenant.application.item.pkcs12,
        parentData: declaration.tenant.application.item,
        parentDataProperty: 'pkcs12',
        instancePath: '/tenant/application/item/pkcs12'
    }];

    describe('.process', () => {
        it('should resolve if certs is undefined', () => CertExtractTag.process(context, declaration));

        it('should resolve if no cert data to process', () => CertExtractTag.process(context, declaration, []));

        it('should skip extracting cert data if host device is BIG-IQ', () => {
            context.host.deviceType = DEVICE_TYPES.BIG_IQ;
            return CertExtractTag.process(context, declaration, getCerts())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.pkcs12Options,
                        undefined,
                        'data should not be extracted'
                    );
                });
        });

        it('should skip extracting cert data if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return CertExtractTag.process(context, declaration, getCerts())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.pkcs12Options,
                        undefined,
                        'data should not be extracted'
                    );
                });
        });

        it('should skip extracting cert data if data is not a string', () => {
            declaration.tenant.application.item.pkcs12 = {
                data: { base64: declaration.tenant.application.item.pkcs12 }
            };
            return CertExtractTag.process(context, declaration, getCerts())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.pkcs12Options,
                        undefined,
                        'data should not be extracted'
                    );
                });
        });

        it('should skip extracting cert data if parent data property is not "pkcs12"', () => {
            const certs = getCerts();
            certs[0].parentDataProperty = 'cert';
            certs[0].instancePath = '/tenant/application/item/cert';
            declaration.tenant.application.item.cert = declaration.tenant.application.item.pkcs12;
            delete declaration.tenant.application.item.pkcs12;
            return CertExtractTag.process(context, declaration, getCerts())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.pkcs12Options,
                        undefined,
                        'data should not be extracted'
                    );
                });
        });

        it('should skip extracting cert data if internalOnly is already populated', () => {
            declaration.tenant.application.item.pkcs12Options = {
                internalOnly: [{
                    certificates: ['-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----']
                }]
            };
            return CertExtractTag.process(context, declaration, getCerts())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                });
        });

        it('should extract cert data', () => {
            const expected = {
                keyImportFormat: 'pkcs8',
                internalOnly: [
                    {
                        certificates: [
                            '-----BEGIN CERTIFICATE-----\nMIIDoDCCAoigAwIBAgIED1feTjANBgkqhkiG9w0BAQsFADCBkTELMAkGA1UEBhMC\nVVMxCzAJBgNVBAgTAldBMRAwDgYDVQQHEwdTZWF0dGxlMQ0wCwYDVQQKEwRUZXN0\nMRwwGgYDVQQLExNQcm9kdWN0IERldmVsb3BtZW50MQ8wDQYDVQQDFAZteV9zc2wx\nJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI3\nMTYzOTQyWhcNMjgwMjI1MTYzOTQyWjCBkTELMAkGA1UEBhMCVVMxCzAJBgNVBAgT\nAldBMRAwDgYDVQQHEwdTZWF0dGxlMQ0wCwYDVQQKEwRUZXN0MRwwGgYDVQQLExNQ\ncm9kdWN0IERldmVsb3BtZW50MQ8wDQYDVQQDFAZteV9zc2wxJTAjBgkqhkiG9w0B\nCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQC0O9Qg8avVtfTpzEwjjM0e+kwFzjFdMmqMVBs6XIo37FsDjbll\nI+7VznRNJPVfRZbnTmyhtHmkpDG/ojLVg7oPWZOY9Zrn7pO96wQxBGkj3E+/3B+T\nBethgXFSLA4sbAhF3Hn+lXP+QuA4KgtcGHDq1EctwZa0/BS8eQFIiWc5c2PAai9Y\nI/nVbu4EkAhhbgTAMzgUnLeRXfyaqmsHVZOXem1ErQVC7M4qwKw2osYlM7qqCgOj\nK1hLwkd3MOIVcgAcUYEYe78dVFhOKglVATVgZhvAVqyTau7eG1sdSLY5aOgHR+Ck\nHWAacIFKKwCZZr6AGFLqxO7tCyzEimmRCBrrAgMBAAEwDQYJKoZIhvcNAQELBQAD\nggEBAHxDtjfTcwqGFuHy7wVsVTg1Mzwvzf0/MG1dstfr9q3onFMpcuZQ2DXWC0rm\ngT3KHaptM+V3iiq5mMv2pPuK4EacDPQdhWBjw5hsVaRu3V7pAo4LHC4UJ3xufXYz\nLVr8wRVMvTMOCNTR0RQ/k1XvIKG1g1H20P/8ZSPYnu05cfvKbPxf9MD5bNCTTuvV\nhAWA8hrDQ+qlAdYx2Tgv59VVkNEWTRto8TU6orREC5F+OUIq3zQcBYjRzfgi9eH6\n8yLnVUlQQX3j6Y2b+ByxBNyo5JanEFLF2s2ioGKK8u3OilPGxDQCtrcc+TJAX9pN\ndaX/vNi6ZxxPwBQx9HctryxB3cc=\n-----END CERTIFICATE-----\n'
                        ],
                        privateKey: undefined
                    }
                ]
            };
            nock('https://localhost:8100')
                .post('/mgmt/shared/service-discovery/encryption')
                .reply(200, { result: 'as3' });
            return CertExtractTag.process(context, declaration, getCerts())
                .then(() => {
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.pkcs12Options,
                        expected,
                        'data should be extracted'
                    );
                });
        });
    });
});

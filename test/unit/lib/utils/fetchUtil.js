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

const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const assert = chai.assert;

const fs = require('fs');
const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const fetchUtil = require('../../../../src/lib/util/fetchUtil');
const util = require('../../../../src/lib/util/util');
const expandUtil = require('../../../../src/lib/util/expandUtil');
const Context = require('../../../../src/lib/context/context');
const log = require('../../../../src/lib/log');

describe('fetchUtil', () => {
    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    describe('fetchValue', () => {
        describe('include', () => {
            let service;
            let declaration;

            beforeEach(() => {
                service = {
                    class: 'HTTP_Service',
                    propA: 'A',
                    include: [
                        '/@/@/constants/myTemplate'
                    ]
                };
                declaration = {
                    class: 'ADC',
                    Tenant1: {
                        Application1: {
                            constants: {
                                myTemplate: {
                                    prop1: 'foo',
                                    prop2: 'bar'
                                }
                            },
                            app1: service
                        }
                    }
                };
            });

            it('should include snippets from one section into another', () => {
                const fetch = {
                    schemaData: 'object',
                    data: { include: '/@/@/constants/myTemplate' },
                    instancePath: '/Tenant1/Application1/vipOne/include',
                    parentData: service,
                    parentDataProperty: 'include'
                };

                fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert.strictEqual(service.prop1, declaration.Tenant1.Application1.constants.myTemplate.prop1);
                        assert.strictEqual(service.prop2, declaration.Tenant1.Application1.constants.myTemplate.prop2);
                    });
            });

            it('should reject invalid includes', () => {
                const fetch = {
                    schemaData: 'object',
                    data: { include: '/@/@/constants/noSuchThing' },
                    instancePath: '/Tenant1/Application1/vipOne/include',
                    parentData: service,
                    parentDataProperty: 'include'
                };

                assert.isRejected(fetchUtil.fetchValue(context, declaration, fetch), /contains path to non-existent object noSuchThing/);
            });
        });

        describe('url', () => {
            let cert1;
            let cert2;
            let declaration;
            let context;

            beforeEach(() => {
                cert1 = {
                    class: 'Certificate',
                    propA: 'A',
                    url: 'https://test.example.com/foo/bar'
                };
                cert2 = {
                    class: 'Certificate',
                    propA: 'A',
                    url: {
                        url: 'https://test.example.com/foo/bar',
                        skipCertificateCheck: true
                    }
                };
                declaration = {
                    class: 'ADC',
                    Tenant1: {
                        Application1: {
                            cert1,
                            cert2
                        }
                    }
                };
                context = Context.build();
                context.tasks = [{ urlPrefix: 'https://localhost:8100' }];
                context.host.parser = {
                    options: {
                        baseDeclaration: {},
                        copySecrets: false,
                        previousDeclaration: {}
                    }
                };

                sinon.stub(log, 'warning');
            });

            it('should fetch data from url string', () => {
                const fetch = {
                    schemaData: 'string',
                    data: { url: cert1.url },
                    instancePath: '/Tenant1/Application1/cert1/url',
                    parentData: cert1,
                    parentDataProperty: 'data'
                };

                nock('https://test.example.com')
                    .get('/foo/bar')
                    .reply(200, 'Hello World');

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert(nock.isDone());
                        assert.deepStrictEqual(cert1.data, 'Hello World');
                    });
            });

            it('should fetch data from url object', () => {
                const fetch = {
                    schemaData: 'string',
                    data: { url: cert2.url },
                    instancePath: '/Tenant1/Application1/cert2/url',
                    parentData: cert2,
                    parentDataProperty: 'data'
                };

                nock('https://test.example.com')
                    .get('/foo/bar')
                    .reply(200, 'Hello World');

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert(nock.isDone());
                        assert.deepStrictEqual(cert2.data, 'Hello World');
                    });
            });

            it('should skip certificate validation when skipCertificateCheck is enabled in url object', () => {
                const fetch = {
                    schemaData: 'string',
                    data: { url: cert2.url },
                    instancePath: '/Tenant1/Application1/cert2/url',
                    parentData: cert2,
                    parentDataProperty: 'data'
                };

                const spy = sinon.stub(util, 'httpRequest').resolves('');

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert.strictEqual(spy.args[0][1].rejectUnauthorized, false);
                    });
            });

            it('should create authentication header when basic auth is included in url object', () => {
                cert2.url.authentication = {
                    method: 'basic',
                    username: 'user',
                    passphrase: {
                        ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                        ignoreChanges: true,
                        miniJWE: true
                    }
                };

                const fetch = {
                    schemaData: 'string',
                    data: { url: cert2.url },
                    instancePath: '/Tenant1/Application1/cert2/url',
                    parentData: cert2,
                    parentDataProperty: 'data'
                };

                sinon.stub(secureVault, 'decrypt').resolves('as3');

                nock('https://test.example.com')
                    .get('/foo/bar')
                    .basicAuth({ user: 'user', pass: 'as3' })
                    .reply(200, 'Hello World');

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert(nock.isDone());
                        assert.deepStrictEqual(cert2.data, 'Hello World');
                    });
            });

            it('should create authentication header when bearer token auth is included in url object', () => {
                cert2.url.authentication = {
                    method: 'bearer-token',
                    token: {
                        ciphertext: 'foo'
                    }
                };

                const fetch = {
                    schemaData: 'string',
                    data: { url: cert2.url },
                    instancePath: '/Tenant1/Application1/cert2/url',
                    parentData: cert2,
                    parentDataProperty: 'data'
                };

                sinon.stub(secureVault, 'decrypt').resolves('unencryptedToken');

                nock('https://test.example.com', {
                    reqheaders: {
                        authorization: 'Bearer unencryptedToken'
                    }
                })
                    .get('/foo/bar')
                    .reply(200, 'Hello World');

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert(nock.isDone());
                        assert.deepStrictEqual(cert2.data, 'Hello World');
                    });
            });

            it('should fetch data for pki-cert', () => {
                const fetch = {
                    schemaData: 'pki-cert',
                    data: { url: cert1.url },
                    instancePath: '/Tenant1/Application1/cert1/url',
                    parentData: cert1,
                    parentDataProperty: 'data'
                };

                nock('https://test.example.com')
                    .get('/foo/bar')
                    .reply(200, 'Hello World');

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert(nock.isDone());
                        assert.deepStrictEqual(cert1.data, 'Hello World');
                    });
            });

            ['iRule', 'GSLB_iRule'].forEach((className) => {
                describe(`${className} expand`, () => {
                    let fetch;

                    beforeEach(() => {
                        declaration = {
                            class: 'ADC',
                            myTenant: {
                                class: 'Tenant',
                                myApplication: {
                                    class: 'Application',
                                    template: 'http',
                                    poolA: {
                                        class: 'Pool'
                                    },
                                    myRule: {
                                        class: className,
                                        iRule: {
                                            url: {
                                                url: 'https://test.example.com/myIRule'
                                            }
                                        }
                                    }
                                }
                            }
                        };
                        fetch = {
                            schemaData: 'string',
                            data: { url: 'https://test.example.com/myIRule' },
                            instancePath: '/myTenant/myApplication/myRule/iRule',
                            parentData: declaration.myTenant.myApplication.myRule,
                            parentDataProperty: 'iRule'
                        };

                        nock('https://test.example.com')
                            .get('/myIRule')
                            .reply(200, 'foo');

                        sinon.spy(expandUtil, 'backquoteExpand');
                    });

                    it('should backquote expand fetched data when expand is true', () => {
                        declaration.myTenant.myApplication.myRule.expand = true;
                        return fetchUtil.fetchValue(context, declaration, fetch)
                            .then(() => {
                                assert(nock.isDone());
                                assert(expandUtil.backquoteExpand.calledOnce);
                            });
                    });

                    it('should not backquote expand fetched data when expand is false', () => {
                        declaration.myTenant.myApplication.myRule.expand = false;
                        return fetchUtil.fetchValue(context, declaration, fetch)
                            .then(() => {
                                assert(nock.isDone());
                                assert(expandUtil.backquoteExpand.notCalled);
                            });
                    });

                    it('should not backquote expand fetched data when schema is not string', () => {
                        declaration.myTenant.myApplication.myRule.expand = true;
                        fetch.schemaData = 'xml';
                        return fetchUtil.fetchValue(context, declaration, fetch)
                            .then(() => {
                                assert(nock.isDone());
                                assert(expandUtil.backquoteExpand.notCalled);
                            });
                    });
                });
            });

            describe('ignoreChanges', () => {
                let fetch;

                beforeEach(() => {
                    declaration = {
                        class: 'ADC',
                        myTenant: {
                            class: 'Tenant',
                            myApplication: {
                                class: 'Application',
                                myRule: {
                                    class: 'iRule',
                                    iRule: {
                                        url: {
                                            url: 'https://test.example.com/myIRule',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            }
                        }
                    };
                    fetch = {
                        schemaData: 'string',
                        data: {
                            url: {
                                url: 'https://test.example.com/myIRule',
                                ignoreChanges: true
                            }
                        },
                        instancePath: '/myTenant/myApplication/myRule/iRule',
                        parentData: declaration.myTenant.myApplication.myRule,
                        parentDataProperty: 'iRule'
                    };
                });

                it('should not fetch when ingoreChanges is true and object already exists', () => {
                    context.host.parser.options.previousDeclaration = {
                        myTenant: {
                            class: 'Tenant',
                            myApplication: {
                                class: 'Application',
                                myRule: {
                                    class: 'iRule'
                                }
                            }
                        }
                    };

                    return fetchUtil.fetchValue(context, declaration, fetch)
                        .then(() => {
                            assert.deepStrictEqual(
                                fetch.data,
                                {
                                    url: {
                                        url: 'https://test.example.com/myIRule',
                                        ignoreChanges: true
                                    }
                                }
                            );
                        });
                });

                it('should fetch when ignoreChanges is set to true and the object does not exist', () => {
                    declaration.myTenant.myApplication.myRule.iRule.url.ignoreChanges = false;
                    fetch.data.url.ignoreChanges = false;

                    nock('https://test.example.com')
                        .get('/myIRule')
                        .reply(200, 'Hello World');

                    return fetchUtil.fetchValue(context, declaration, fetch)
                        .then(() => {
                            assert(nock.isDone());
                            assert.deepStrictEqual(
                                fetch.parentData,
                                {
                                    class: 'iRule',
                                    iRule: 'Hello World'
                                }
                            );
                        });
                });
            });
        });

        describe('pkcs12', () => {
            let encryptedCert;
            let declaration;
            let context;

            beforeEach(() => {
                encryptedCert = {
                    class: 'Certificate',
                    pkcs12: {
                        base64: 'MIIEdAIBAzCCBDoGCSqGSIb3DQEHAaCCBCsEggQnMIIEIzCCBB8GCSqGSIb3DQEHBqCCBBAwggQMAgEAMIIEBQYJKoZIhvcNAQcBMBwGCiqGSIb3DQEMAQYwDgQI/nEU2xuSAVcCAggAgIID2MNKbruh9PJGC3bsdOj/hsBAutS6hFtUXl1DJ8FZd2B+80ppRam4y8NKJz14Fkvr0qUOECIAPsv857EJ9PVAoYLaK6gf9jWe3nLCe8PyHv5MtJVEqORszIkQPUrI/Zsba46GLNPp1F4dEJsHXjK9XQ7yhQDIJr2yoMth+WmwBAZTx2jyoMc4m/4jcXvUTTHTOfOqqNzsS6fq3PAcYVDqC8iovWXwt7io31ix47qBvG1Vh6dCOTvupAv3KBDCJwLeSonIehobpS1SBQtLkot7LEzgLAVwpRRh4kFJ+R+dbmgH+xAxHJSb9BnSCBgW0ircrHrHFTwTHxjAd5HzGzxImPC/uuLIiKwa+7dajy2djfMgYSYkfM88zCo54hZfx1POBKQ3CF8NjFoOJZJvdi+2cQ5WO3+5xv9n6ZzyAO4W4sOvsxKQ8uwS7lL1vwFTnflvQx0y6RYsYww0nAR00D/Toq62mhpXx1Vx4ZGetVqiPU0NsLEr79l8yqZZAP4nQ68zXIYVDbKIASEFpbcCb7nDD4jExn68kWJpRINxbZ0z3hBN0RhM+LTC2Ybw5uYWezrlvxlnd2EU/ZHQGmFjWhbKH87AoWVpsGJPfcetBG4d2GhUO8X2BYitGQZuglNTZxCaWeem+QX19kCZvIkDgzp4Oi/MBpGkaS5Vjz8EQ6VhnMs2TncBVhPR6dgF3WpYOpmGOREz/Kg+8xWHqsEgI46RcEIJQ9gmVpbegmfFh6OmKXGOl0PY7bAhkLdybq2tJ23AVXKxsMOQW+5N8A4EQPp1QHFFpURsecQaKRjrj7px049zNG9Yts2Qc8KC6CGYARrxo5aeF3LK9CxsLbajcnGo1qytzn3y/1WB+rmiNQJx9e9lr63egfTWhpTMHkM9ayZX2td/mIbUDUNDZ9lsN6il7mY7EhBsdhdbGuv8wJDDS4jEdJaL8VFE2R7F1pAxSQkdF3mPFcePE0Me/vIjSv3sR+4Q44zw7dJaFU1eDAiQupLwctWKIkKeuEgEfetvZac5FqZ7KHv+MAr2AxO3jSau8cw5KR3mipzfN13cL0GdMQAKwhC6XZzZKmPJOxyhaT7V9hr7719Kqq3qX8JxVzkThHsFy5V1NjFdLvIcjQwDb0L74iwZ/mDiHdi4eKUkBQD5WiaTBBtZS8cFCXAfOZvprHFp3IuOxa2DkqKmBbTqficOxRom7gOKvaQzWlJqd/HFV4Ru0CjBXFnFXPk6FicZ6IdRzWJcVKJ/AjIDP1RUyu/NUNYbNNssK1tBW+IfGvESgaGqNzw4a/8H5G8UwSBO3bdt8kyqt+ioRjAxMCEwCQYFKw4DAhoFAAQUIvCNK3qldiHX2dfKVx7THPqQOvIECGiVUD1T1ujUAgIIAA=='
                    },
                    passphrase: {
                        ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                        ignoreChanges: true,
                        miniJWE: true
                    }
                };
                declaration = {
                    class: 'ADC',
                    action: 'deploy',
                    Tenant1: {
                        Application1: {
                            cert: encryptedCert
                        }
                    }
                };
                context = Context.build();
                context.tasks.push(declaration);
                context.tasks[0].urlPrefix = 'https://localhost:8100';

                sinon.stub(log, 'warning');
            });

            it('should remotely decrypt pkcs12 passphrase', () => {
                const fetch = {
                    schemaData: 'pkcs12',
                    data: { base64: encryptedCert.pkcs12.base64 },
                    instancePath: '/Tenant1/Application1/cert',
                    parentData: encryptedCert,
                    parentDataProperty: 'pkcs12'
                };

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

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert.deepStrictEqual(encryptedCert.pkcs12Options, expected);
                    });
            });
        });

        describe('pki', () => {
            let declaration;
            let context;
            let theCert;

            beforeEach(() => {
                theCert = {
                    class: 'Certificate',
                    certificate: {
                        base64: Buffer.from('my cert data').toString('base64')
                    }
                };
                declaration = {
                    class: 'ADC',
                    action: 'deploy',
                    Tenant1: {
                        Application1: {
                            cert: theCert
                        }
                    }
                };
                context = Context.build();
                context.tasks.push(declaration);
                sinon.stub(log, 'warning');
            });

            it('should decode base64 encoded pki certs', () => {
                const fetch = {
                    schemaData: 'pki-cert',
                    data: { base64: theCert.certificate.base64 },
                    instancePath: '/Tenant1/Application1/cert',
                    parentData: theCert,
                    parentDataProperty: 'certificate'
                };

                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert.strictEqual(theCert.certificate, 'my cert data');
                    });
            });
        });

        describe('file', () => {
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        template: 'generic',
                        wafPolicy: {
                            class: 'WAF_Policy',
                            enforcementMode: 'transparent',
                            file: '/path/to/waf/policy.xml'
                        }
                    }
                }
            };
            const fetch = {
                schemaData: 'string',
                data: {
                    file: '/path/to/waf/policy.xml'
                },
                instancePath: '/tenant/app/wafPolicy/file',
                parentData: {
                    class: 'WAF_Policy',
                    enforcementMode: 'transparent',
                    file: '/path/to/waf/policy.xml'
                },
                parentDataProperty: 'file'
            };

            it('should reject if specified file is not found', () => {
                sinon.stub(fs, 'readFile').callsArgWith(2, new Error('ENOENT: no such file or directory, open /path/to/waf/policy.xml'));
                return assert.isRejected(
                    fetchUtil.fetchValue(context, declaration, fetch),
                    /ENOENT: no such file or directory, open \/path\/to\/waf\/policy.xml/,
                    'Should reject when the file is not found'
                );
            });

            it('should fetch data from file', () => {
                sinon.stub(fs, 'readFile').callsArgWith(
                    2,
                    null,
                    '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }'
                );
                return fetchUtil.fetchValue(context, declaration, fetch)
                    .then(() => {
                        assert.deepStrictEqual(
                            fetch.parentData,
                            {
                                class: 'WAF_Policy',
                                enforcementMode: 'transparent',
                                file: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }'
                            }
                        );
                    });
            });
        });
    });
});

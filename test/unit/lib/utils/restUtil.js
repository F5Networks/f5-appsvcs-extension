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

const assert = require('assert');
const sinon = require('sinon');
const nock = require('nock');

const restUtil = require('../../../../src/lib/util/restUtil');
const config = require('../../../../src/lib/config');
const RestOperationMock = require('../../RestOperationMock');
const util = require('../../../../src/lib/util/util');
const Config = require('../../../../src/lib/config');

describe('restUtil', () => {
    let httpRequestStub;
    let configStub;

    beforeEach(() => {
        httpRequestStub = sinon.stub(util, 'httpRequest').resolves(); // Just resolve
        configStub = sinon.stub(Config, 'getAllSettings').resolves({ serviceDiscoveryEnabled: true });
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.getMultiStatusCode', () => {
        it('should return a 200, if the STATUS_CODES result in NO_CONTENT', () => {
            const results = [{ code: 204 }];

            assert.strictEqual(restUtil.getMultiStatusCode(results), 200);
        });
    });

    describe('.completeRequestMultiStatus', () => {
        it('should properly configure the restOperation', () => {
            const restOp = new RestOperationMock();
            const results = [{
                code: 200,
                body: { foo: 'bar' }
            },
            {
                code: 500
            }];

            restUtil.completeRequestMultiStatus(restOp, results, true);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                code: 207,
                items: [
                    { foo: 'bar' },
                    {
                        code: 500,
                        message: { code: 500 }
                    }
                ]
            });
            assert.deepStrictEqual(restOp.statusCode, 207);
        });
    });

    describe('completeRequest', () => {
        it('should properly configure the restOperation with per-tenant Post', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Post';
            restOp.setPathName('/shared/appsvcs/declare');

            const result = {
                code: 200,
                message: undefined,
                body: {
                    results: [{ code: 200 }],
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.15.0',
                        id: 'Service_Address',
                        controls: {
                            class: 'Controls',
                            trace: true,
                            logLevel: 'debug'
                        },
                        tenantId: {
                            class: 'Tenant',
                            appId: {
                                class: 'Application'
                            }
                        },
                        updateMode: 'selective'
                    }
                }
            };

            restUtil.completeRequest(restOp, result);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                results: [{ code: 200 }],
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.15.0',
                    id: 'Service_Address',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug'
                    },
                    tenantId: {
                        class: 'Tenant',
                        appId: {
                            class: 'Application'
                        }
                    },
                    updateMode: 'selective'
                }
            });
            assert.deepStrictEqual(restOp.statusCode, 200);
        });

        it('should properly transform the restOperation with per-app Post', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Post';
            restOp.setPathName('/shared/appsvcs/declare/tenant1/applications?controls.trace=true');

            const perAppInfo = {
                tenant: 'tenant1',
                apps: ['app2']
            };

            const result = {
                code: 200,
                message: undefined,
                body: {
                    results: [{ code: 200 }],
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.15.0',
                        id: 'Service_Address',
                        controls: {
                            class: 'Controls',
                            trace: true,
                            logLevel: 'debug'
                        },
                        tenantId: {
                            class: 'Tenant',
                            appId: {
                                class: 'Application'
                            }
                        },
                        tenant1: {
                            class: 'Tenant',
                            app1: {
                                class: 'Application'
                            },
                            app2: {
                                class: 'Application',
                                template: 'generic'
                            }
                        },
                        updateMode: 'selective'
                    }
                }
            };

            restUtil.completeRequest(restOp, result, perAppInfo);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                results: [{ code: 200 }],
                declaration: {
                    app2: {
                        class: 'Application',
                        template: 'generic'
                    }
                }
            });
            assert.deepStrictEqual(restOp.statusCode, 200);
        });

        it('should properly configure the restOperation with per-app Delete', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Delete';
            restOp.setPathName('/shared/appsvcs/declare/tenant1/applications/app1');

            const perAppInfo = {
                tenant: 'tenant1',
                apps: ['app2']
            };

            const result = {
                code: 200,
                message: undefined,
                body: {
                    results: [
                        {
                            code: 200,
                            message: 'success',
                            lineCount: 30,
                            host: 'localhost',
                            tenant: 'AS3Request_Tenant1',
                            runTime: 2671
                        }
                    ],
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: '1686935002532',
                        updateMode: 'selective',
                        controls: {
                            archiveTimestamp: '2023-06-16T17:03:25.670Z'
                        }
                    }
                }
            };

            restUtil.completeRequest(restOp, result, perAppInfo);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                results: [
                    {
                        code: 200,
                        message: 'success',
                        lineCount: 30,
                        host: 'localhost',
                        tenant: 'AS3Request_Tenant1',
                        runTime: 2671
                    }
                ],
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '1686935002532',
                    updateMode: 'selective',
                    controls: {
                        archiveTimestamp: '2023-06-16T17:03:25.670Z'
                    }
                }
            });
            assert.deepStrictEqual(restOp.statusCode, 200);
        });

        it('should properly configure the restOperation with per-app Get', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Get';
            restOp.uri = {
                path: '/shared/appsvcs/declare/tenant1/applications'
            };

            const perAppInfo = {
                tenant: 'tenant1',
                apps: []
            };

            const result = {
                code: 200,
                message: undefined,
                body: {
                    app1: {
                        class: 'Application',
                        template: 'generic'
                    },
                    application2: {
                        class: 'Application',
                        template: 'generic'
                    }
                }
            };

            restUtil.completeRequest(restOp, result, perAppInfo);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                app1: {
                    class: 'Application',
                    template: 'generic'
                },
                application2: {
                    class: 'Application',
                    template: 'generic'
                }
            });
            assert.deepStrictEqual(restOp.statusCode, 200);
        });

        it('should properly configure the restOperation with an error message', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Post';
            restOp.uri = {
                path: '/shared/appsvcs/declare/tenant1/applications'
            };

            const perAppInfo = {
                tenant: 'tenant1',
                apps: ['app2']
            };

            const result = {
                code: 422,
                message: 'declaration is invalid',
                body: {
                    code: 422,
                    errors: ['/app1/pool1/slowRampTime: should be integer'],
                    message: 'declaration is invalid'
                }
            };

            restUtil.completeRequest(restOp, result, perAppInfo);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                code: 422,
                errors: ['/app1/pool1/slowRampTime: should be integer'],
                message: 'declaration is invalid'
            });
            assert.deepStrictEqual(restOp.statusCode, 422);
        });
    });

    describe('.checkWebhook', () => {
        beforeEach(() => {
            httpRequestStub.restore(); // So nock can work
            configStub.restore();
            sinon.stub(config, 'getAllSettings').resolves(
                {
                    webhook: 'http://www.example.com/webhook'
                }
            );

            nock('http://www.example.com')
                .post('/webhook')
                .reply(200);
        });

        it('should call the webhook for POST requests', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Post';
            const results = {};

            restUtil.checkWebhook(restOp, results);
            setImmediate(() => {
                assert.ok(nock.isDone());
            });
        });

        it('should not call the webhook for non-POST requests', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Get';
            const results = {};

            restUtil.checkWebhook(restOp, results);
            setImmediate(() => {
                assert.ok(!nock.isDone());
            });
        });
    });
});

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

const chai = require('chai');
const sinon = require('sinon');

const constants = require('../../../../src/lib/constants');
const RestOperationMock = require('../../RestOperationMock');
const HostContext = require('../../../../src/lib/context/hostContext');
const RequestContext = require('../../../../src/lib/context/requestContext');
const util = require('../../../../src/lib/util/util');
const config = require('../../../../src/lib/config');

const assert = chai.assert;

describe('RequestContext', () => {
    // Pull the premock value
    const origSchemaFile = constants.reqSchemaFile;
    beforeEach(() => {
        // set the mock value
        constants.reqSchemaFile = `${__dirname}/../../../../src/schema/latest/as3-request-schema.json`;
        sinon.stub(util, 'getMgmtPort').resolves(443);
        sinon.stub(util, 'getDeviceInfo').resolves({});
        sinon.stub(config, 'getAllSettings').resolves({});
    });

    afterEach(() => {
        // restore the original
        constants.reqSchemaFile = origSchemaFile;
        sinon.restore();
    });

    const validDecl = {
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
            defaultRouteDomain: 222,
            appId: {
                class: 'Application',
                template: 'generic',
                itemId: {
                    class: 'Service_Address',
                    virtualAddress: '121.121.121.121/24',
                    arpEnabled: true,
                    icmpEcho: 'enable',
                    routeAdvertisement: 'disable',
                    spanningEnabled: false,
                    trafficGroup: 'default'
                },
                enable: true
            },
            enable: true,
            optimisticLockKey: ''
        },
        updateMode: 'selective'
    };
    const expectedValidDecl = util.simpleCopy(validDecl);

    // TODO: maybe we shouldn't be splitting by endpoint
    describe('/declare', () => {
        describe('valid requests on BIGIP', () => {
            let path;
            let hostContext;

            beforeEach(() => {
                path = '/shared/appsvcs/declare';
                hostContext = new HostContext();

                hostContext.deviceType = constants.DEVICE_TYPES.BIG_IP;
            });

            after(() => {
                sinon.restore();
            });

            it('should build the correct GET context', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';
                restOp.setPath(path);

                restOp.setHeader('X-F5-Auth-Token', 'my auth token');
                restOp.setBasicAuthorization('my basic authorization');

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.deepStrictEqual(ctxt.request.method, restOp.method);
                        assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                        assert.isUndefined(ctxt.request.subPath, '');
                        assert.deepEqual(ctxt.request.queryParams, []);
                        assert.strictEqual(ctxt.request.token, 'my auth token');
                        assert.strictEqual(ctxt.request.basicAuth, 'my basic authorization');
                        assert.deepEqual(
                            ctxt.tasks,
                            [
                                {
                                    class: 'AS3',
                                    action: 'retrieve',
                                    dryRun: false,
                                    redeployAge: 0,
                                    redeployUpdateMode: 'original',
                                    persist: true,
                                    syncToGroup: '',
                                    historyLimit: 4,
                                    logLevel: 'warning',
                                    trace: false,
                                    retrieveAge: 0,
                                    targetHost: 'localhost',
                                    targetPort: 8100,
                                    targetUsername: '',
                                    targetPassphrase: '',
                                    targetTokens: {
                                        'X-F5-Auth-Token': 'my auth token'
                                    },
                                    targetTimeout: 150,
                                    resourceTimeout: 5,
                                    protocol: 'http',
                                    urlPrefix: 'http://admin:@localhost:8100',
                                    localBigip: true
                                }
                            ]
                        );
                        assert.deepEqual(
                            ctxt.request.body,
                            {
                                class: 'AS3',
                                action: 'retrieve'
                            }
                        );
                    });
            });

            it('should build the correct GET context with query params', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';
                restOp.setPath(`${path}?show=full&age=1&nonexistent=ABClalala`);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.deepStrictEqual(ctxt.request.method, restOp.method);
                        assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                        assert.isUndefined(ctxt.request.subPath);
                        assert.deepEqual(
                            ctxt.request.queryParams,
                            [
                                { key: 'show', value: 'full' },
                                { key: 'age', value: '1' },
                                { key: 'nonexistent', value: 'ABClalala' }
                            ]
                        );
                    });
            });

            it('should build the correct GET context with no getHeader method', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';

                restOp.getHeader = null;

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.isUndefined(ctxt.token);
                    });
            });

            it('should build the correct POST context with query params', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}/?mock=1`);
                restOp.setBody(Object.assign({}, validDecl));

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.deepStrictEqual(ctxt.request.method, restOp.method);
                        assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                        assert.isUndefined(ctxt.request.subPath);
                        assert.deepStrictEqual(ctxt.request.queryParams, [{ key: 'mock', value: '1' }]);
                        assert.deepEqual(
                            ctxt.tasks,
                            [
                                {
                                    class: 'AS3',
                                    action: 'deploy',
                                    declaration: expectedValidDecl,
                                    redeployAge: 0,
                                    redeployUpdateMode: 'original',
                                    persist: true,
                                    syncToGroup: '',
                                    historyLimit: 4,
                                    logLevel: 'warning',
                                    trace: false,
                                    retrieveAge: 0,
                                    targetHost: 'localhost',
                                    targetPort: 8100,
                                    targetUsername: '',
                                    targetPassphrase: '',
                                    targetTokens: {},
                                    targetTimeout: 150,
                                    resourceTimeout: 5,
                                    protocol: 'http',
                                    urlPrefix: 'http://admin:@localhost:8100',
                                    localBigip: true,
                                    dryRun: false
                                }
                            ]
                        );
                        // Body should not have been modified
                        assert.deepEqual(ctxt.request.body, expectedValidDecl);
                    });
            });

            it('should build the correct POST context with Controls.dryRun', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}/?mock=1`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.controls.dryRun = true;
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                    });
            });

            it('should build the correct POST context with action dry-run', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}/?mock=1`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.controls.internalUse = { action: 'dry-run' };
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                    });
            });

            it('should build the correct PATCH context', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Patch';
                restOp.setPath(`${path}?`);
                restOp.setBody([{
                    op: 'remove',
                    path: '/some/path'
                }]);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.deepStrictEqual(ctxt.request.method, restOp.method);
                        assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                        assert.isUndefined(ctxt.request.subPath);
                        assert.deepStrictEqual(ctxt.request.queryParams, []);
                        assert.deepEqual(
                            ctxt.tasks,
                            [
                                {
                                    class: 'AS3',
                                    action: 'patch',
                                    dryRun: false,
                                    patchBody: restOp.body,
                                    redeployAge: 0,
                                    redeployUpdateMode: 'original',
                                    persist: true,
                                    syncToGroup: '',
                                    historyLimit: 4,
                                    logLevel: 'warning',
                                    trace: false,
                                    retrieveAge: 0,
                                    targetHost: 'localhost',
                                    targetPort: 8100,
                                    targetUsername: '',
                                    targetPassphrase: '',
                                    targetTokens: {},
                                    targetTimeout: 150,
                                    resourceTimeout: 5,
                                    protocol: 'http',
                                    urlPrefix: 'http://admin:@localhost:8100',
                                    localBigip: true
                                }
                            ]
                        );
                        assert.deepEqual(
                            ctxt.request.body,
                            {
                                class: 'AS3',
                                action: 'patch',
                                patchBody: [{ op: 'remove', path: '/some/path' }]
                            }
                        );
                    });
            });

            it('should build the correct DELETE context', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Delete';
                restOp.setPath(`${path}/tenantToObliterate`);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.deepStrictEqual(ctxt.request.method, restOp.method);
                        assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                        assert.deepStrictEqual(ctxt.request.subPath, 'tenantToObliterate');
                        assert.deepStrictEqual(ctxt.request.queryParams, []);
                        assert.deepEqual(
                            ctxt.tasks,
                            [
                                {
                                    class: 'AS3',
                                    action: 'remove',
                                    dryRun: false,
                                    redeployAge: 0,
                                    redeployUpdateMode: 'original',
                                    persist: true,
                                    syncToGroup: '',
                                    historyLimit: 4,
                                    logLevel: 'warning',
                                    trace: false,
                                    retrieveAge: 0,
                                    targetHost: 'localhost',
                                    targetPort: 8100,
                                    targetUsername: '',
                                    targetPassphrase: '',
                                    targetTokens: {},
                                    targetTimeout: 150,
                                    resourceTimeout: 5,
                                    protocol: 'http',
                                    urlPrefix: 'http://admin:@localhost:8100',
                                    localBigip: true
                                }
                            ]
                        );
                        assert.deepEqual(
                            ctxt.request.body,
                            {
                                class: 'AS3',
                                action: 'remove'
                            }
                        );
                    });
            });

            describe('multi-declaration testing', () => {
                it('should set isMultiDecl to false if single declaration', () => {
                    const restOp = new RestOperationMock();
                    restOp.method = 'Post';
                    restOp.setPath(path);
                    restOp.setBody(Object.assign({}, validDecl));

                    return RequestContext.get(restOp, hostContext)
                        .then((ctxt) => {
                            assert.isUndefined(ctxt.request.error);
                            assert.deepStrictEqual(ctxt.request.method, restOp.method);
                            assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                            assert.deepStrictEqual(ctxt.request.subPath, undefined);
                            assert.deepStrictEqual(ctxt.request.queryParams, []);
                            assert.deepStrictEqual(ctxt.request.isMultiDecl, false);
                        });
                });

                it('should set isMultiDecl and dryRun in multiple declaration', () => {
                    const restOp = new RestOperationMock();
                    restOp.method = 'Post';
                    restOp.setPath(path);
                    restOp.setBody(
                        [
                            {
                                op: 'deploy',
                                path: '/some/path',
                                class: 'AS3',
                                action: 'deploy',
                                declaration:
                                {
                                    controls: {
                                        class: 'Controls',
                                        dryRun: true
                                    },
                                    tenantId1: {
                                        class: 'Tenant',
                                        defaultRouteDomain: 220,
                                        appId: {
                                            class: 'Application',
                                            template: 'generic',
                                            itemId: {
                                                class: 'Service_Address',
                                                virtualAddress: '121.121.121.122/24',
                                                arpEnabled: true,
                                                icmpEcho: 'enable',
                                                routeAdvertisement: 'disable',
                                                spanningEnabled: false,
                                                trafficGroup: 'default'
                                            },
                                            enable: true
                                        },
                                        enable: true,
                                        optimisticLockKey: ''
                                    },
                                    updateMode: 'selective'
                                }
                            },
                            {
                                op: 'deploy',
                                path: '/some/path',
                                class: 'AS3',
                                action: 'deploy',
                                declaration:
                                {
                                    tenantId2: {
                                        class: 'Tenant',
                                        defaultRouteDomain: 222,
                                        appId: {
                                            class: 'Application',
                                            template: 'generic',
                                            itemId: {
                                                class: 'Service_Address',
                                                virtualAddress: '121.121.121.121/24',
                                                arpEnabled: true,
                                                icmpEcho: 'enable',
                                                routeAdvertisement: 'disable',
                                                spanningEnabled: false,
                                                trafficGroup: 'default'
                                            },
                                            enable: true
                                        },
                                        enable: true,
                                        optimisticLockKey: ''
                                    },
                                    updateMode: 'selective'
                                }
                            },
                            {
                                op: 'deploy',
                                path: '/some/path',
                                class: 'AS3',
                                action: 'dry-run',
                                declaration:
                                {
                                    tenantId3: {
                                        class: 'Tenant',
                                        defaultRouteDomain: 222,
                                        appId: {
                                            class: 'Application',
                                            template: 'generic',
                                            itemId: {
                                                class: 'Service_Address',
                                                virtualAddress: '121.121.121.121/24',
                                                arpEnabled: true,
                                                icmpEcho: 'enable',
                                                routeAdvertisement: 'disable',
                                                spanningEnabled: false,
                                                trafficGroup: 'default'
                                            },
                                            enable: true
                                        },
                                        enable: true,
                                        optimisticLockKey: ''
                                    },
                                    updateMode: 'selective'
                                }
                            }
                        ]
                    );

                    return RequestContext.get(restOp, hostContext)
                        .then((ctxt) => {
                            assert.isUndefined(ctxt.request.error);
                            assert.deepStrictEqual(ctxt.request.method, restOp.method);
                            assert.deepStrictEqual(ctxt.request.pathName, 'declare');
                            assert.deepStrictEqual(ctxt.request.subPath, undefined);
                            assert.deepStrictEqual(ctxt.request.queryParams, []);
                            assert.deepStrictEqual(ctxt.request.isMultiDecl, true);
                            assert.strictEqual(ctxt.tasks.length, 3);
                            assert.strictEqual(ctxt.tasks[0].dryRun, true);
                            assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                            assert.strictEqual(ctxt.tasks[1].dryRun, false);
                            assert.strictEqual(ctxt.tasks[1].action, 'deploy');
                            assert.strictEqual(ctxt.tasks[2].dryRun, true);
                            assert.strictEqual(ctxt.tasks[2].action, 'deploy');
                        });
                });
            });
        });
    });
});
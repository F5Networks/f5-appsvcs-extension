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
const sinon = require('sinon');

const constants = require('../../../../src/lib/constants');
const RestOperationMock = require('../../RestOperationMock');
const HostContext = require('../../../../src/lib/context/hostContext');
const RequestContext = require('../../../../src/lib/context/requestContext');
const SchemaValidator = require('../../../../src/lib/schemaValidator');
const util = require('../../../../src/lib/util/util');
const tmshUtil = require('../../../../src/lib/util/tmshUtil');
const config = require('../../../../src/lib/config');

const assert = chai.assert;

describe('RequestContext', () => {
    let validDecl;
    let expectedValidDecl;
    const schemaConfigs = [{
        paths: [`file://${__dirname}/../../../../src/schema/latest/as3-request-schema.json`]
    }];
    const schemaValidator = new SchemaValidator(constants.DEVICE_TYPES.BIG_IP, schemaConfigs);

    before(() => schemaValidator.init());

    beforeEach(() => {
        sinon.stub(util, 'getMgmtPort').resolves(443);
        sinon.stub(util, 'getDeviceInfo').resolves({});
        sinon.stub(tmshUtil, 'getPrimaryAdminUser').resolves('admin');
        sinon.stub(config, 'getAllSettings').resolves({});
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('/declare', () => {
        beforeEach(() => {
            validDecl = {
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
            };
            expectedValidDecl = util.simpleCopy(validDecl);
        });

        describe('valid requests on BIGIP', () => {
            let path;
            let hostContext;

            beforeEach(() => {
                path = '/shared/appsvcs/declare';
                hostContext = new HostContext();

                hostContext.deviceType = constants.DEVICE_TYPES.BIG_IP;
                hostContext.as3VersionInfo = {};
                hostContext.schemaValidator = schemaValidator;
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

            it('should build the correct POST context with Controls.dryRun in the Tenant', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}/?mock=1`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.tenantId.controls = {
                    class: 'Controls',
                    dryRun: true
                };
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.strictEqual(ctxt.tasks[0].warnings[0].tenant, 'tenantId');
                        assert.strictEqual(ctxt.tasks[0].warnings[0].message, 'dryRun true found in Tenant controls');
                    });
            });

            it('should build the correct POST context with Controls.dryRun in one of multiple Tenants', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}/?mock=1`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.tenantId.controls = {
                    class: 'Controls',
                    dryRun: true
                };
                dryRunDecl.tenantId2 = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application'
                    }
                };
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.strictEqual(ctxt.tasks[0].warnings.length, 1);
                        assert.strictEqual(ctxt.tasks[0].warnings[0].tenant, 'tenantId');
                        assert.strictEqual(ctxt.tasks[0].warnings[0].message, 'dryRun true found in Tenant controls');
                    });
            });

            it('should build the correct POST context with Controls.dryRun in multiple Tenants with a warning for each Tenant', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}/?mock=1`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.tenantId.controls = {
                    class: 'Controls',
                    dryRun: true
                };
                dryRunDecl.tenantId2 = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application'
                    },
                    controls: {
                        class: 'Controls',
                        dryRun: true
                    }
                };
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.strictEqual(ctxt.tasks[0].warnings.length, 2);
                        assert.strictEqual(ctxt.tasks[0].warnings[0].tenant, 'tenantId');
                        assert.strictEqual(ctxt.tasks[0].warnings[0].message, 'dryRun true found in Tenant controls');
                        assert.strictEqual(ctxt.tasks[0].warnings[1].tenant, 'tenantId2');
                        assert.strictEqual(ctxt.tasks[0].warnings[1].message, 'dryRun true found in Tenant controls');
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

            it('should build the correct POST context with false Controls.dryRun and query params dryRun is true', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}?async=true&controls.dryRun=true`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.controls.dryRun = false;
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.deepStrictEqual(ctxt.request.queryParams, [{ key: 'async', value: 'true' }, { key: 'controls.dryRun', value: 'true' }]);
                    });
            });

            it('should build the correct POST context with false Controls.dryRun and query params dryRun is false', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}?async=true&controls.dryRun=false`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.controls.dryRun = false;
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, false);
                        assert.deepStrictEqual(ctxt.request.queryParams, [{ key: 'async', value: 'true' }, { key: 'controls.dryRun', value: 'false' }]);
                    });
            });

            it('should build the correct POST context with true Controls.dryRun and query params dryRun is true', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}?async=true&controls.dryRun=true`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.controls.dryRun = true;
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.deepStrictEqual(ctxt.request.queryParams, [{ key: 'async', value: 'true' }, { key: 'controls.dryRun', value: 'true' }]);
                    });
            });

            it('should build the correct POST context with true Controls.dryRun and query params dryRun is false', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';
                // note extra /
                restOp.setPath(`${path}?async=true&controls.dryRun=false`);

                const dryRunDecl = util.simpleCopy(validDecl);
                dryRunDecl.controls.dryRun = true;
                restOp.setBody(dryRunDecl);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, false);
                        assert.deepStrictEqual(ctxt.request.queryParams, [{ key: 'async', value: 'true' }, { key: 'controls.dryRun', value: 'false' }]);
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
                                        appId: {
                                            class: 'Application'
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
                                            class: 'Application'
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
                                            class: 'Application'
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

        describe('invalid requests on BIGIP', () => {
            let path;
            let hostContext;

            beforeEach(() => {
                path = '/shared/appsvcs/declare';
                hostContext = new HostContext();

                hostContext.deviceType = constants.DEVICE_TYPES.BIG_IP;
                hostContext.as3VersionInfo = {};
                hostContext.schemaValidator = schemaValidator;
            });

            it('should invalidate per-app declaration POST to /declare', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';

                restOp.setPathName(path);
                restOp.setPath(path);
                restOp.setBody({
                    app1: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.strictEqual(ctxt.errorCode, 422);
                        assert.strictEqual(ctxt.isPerApp, false);
                        assert.strictEqual(ctxt.method, 'Post');
                        assert.strictEqual(ctxt.error,
                            'Invalid request: /declaration: should have required property \'class\'');
                        assert.strictEqual(ctxt.pathName, 'declare');
                        assert.strictEqual(ctxt.subPath, undefined);
                        assert.deepStrictEqual(ctxt.queryParams, []);
                        assert.deepEqual(
                            ctxt.body,
                            {
                                app1: {
                                    class: 'Application',
                                    template: 'generic',
                                    pool1:
                                    {
                                        class: 'Pool',
                                        loadBalancingMode: 'round-robin',
                                        minimumMembersActive: 1,
                                        reselectTries: 0,
                                        serviceDownAction: 'none',
                                        slowRampTime: 11,
                                        minimumMonitors: 1
                                    }
                                }
                            }
                        );
                    });
            });
        });
    });

    describe('/declare/tenant/applications', () => {
        let path;
        let hostContext;

        beforeEach(() => {
            path = '/shared/appsvcs/declare';
            hostContext = new HostContext();

            hostContext.deviceType = constants.DEVICE_TYPES.BIG_IP;
            hostContext.as3VersionInfo = {};
            hostContext.schemaValidator = schemaValidator;

            validDecl = {
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                app1: {
                    class: 'Application'
                }
            };
            expectedValidDecl = util.simpleCopy(validDecl);
        });

        describe('valid', () => {
            it('should validate a per-app GET request', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';

                restOp.setPathName(`${path}/Tenant1/applications`);
                restOp.setPath(`${path}/Tenant1/applications`);
                restOp.setBody({});

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.strictEqual(ctxt.request.method, 'Get');
                        assert.strictEqual(ctxt.request.pathName, 'declare');
                        assert.strictEqual(ctxt.request.subPath, 'Tenant1/applications');
                        assert.deepStrictEqual(ctxt.request.queryParams, []);
                        assert.strictEqual(ctxt.request.isPerApp, true);
                        assert.deepStrictEqual(
                            ctxt.request.perAppInfo,
                            {
                                apps: [], // Note: this is by design
                                tenant: 'Tenant1'
                            }
                        );
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
                                action: 'retrieve'
                            }
                        );
                    });
            });

            it('should validate a per-app GET request with trailing /', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';

                restOp.setPathName(`${path}/Tenant1/applications/`);
                restOp.setPath(`${path}/Tenant1/applications/`);
                restOp.setBody(Object.assign({}, validDecl));

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.strictEqual(ctxt.request.method, 'Get');
                        assert.strictEqual(ctxt.request.pathName, 'declare');
                        assert.strictEqual(ctxt.request.subPath, 'Tenant1/applications');
                        assert.deepStrictEqual(ctxt.request.queryParams, []);
                        assert.strictEqual(ctxt.request.isPerApp, true);
                        assert.deepStrictEqual(
                            ctxt.request.perAppInfo,
                            {
                                apps: [],
                                tenant: 'Tenant1'
                            }
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

            it('should validate a per-app DELETE request with specified application', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Delete';
                restOp.setPath(`${path}/Tenant1/applications/App1`);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.ok(typeof ctxt.request.eventEmitter !== 'undefined');
                        delete ctxt.request.eventEmitter;
                        assert.deepStrictEqual(
                            ctxt.request,
                            {
                                basicAuth: undefined,
                                body: {
                                    class: 'AS3',
                                    action: 'remove'
                                },
                                error: undefined,
                                fullPath: '/shared/appsvcs/declare/Tenant1/applications/App1',
                                isMultiDecl: false,
                                isPerApp: true,
                                perAppInfo: {
                                    apps: ['App1'],
                                    tenant: 'Tenant1'
                                },
                                method: 'Delete',
                                pathName: 'declare',
                                postProcessing: [],
                                queryParams: [],
                                subPath: 'Tenant1/applications/App1',
                                token: undefined,
                                tracer: { _enabled: false }
                            }
                        );
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
                    });
            });

            it('should build the correct per-app POST context with dry-run in Tenant controls', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';

                restOp.setPathName(`${path}/Tenant1/applications/`);
                restOp.setPath(`${path}/Tenant1/applications/`);

                restOp.setBody({
                    id: 'per-app-declaration',
                    schemaVersion: '3.50.0',
                    controls: {
                        class: 'Controls',
                        dryRun: true,
                        logLevel: 'debug',
                        trace: true
                    },
                    Application1: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.2.1'
                            ],
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.20'
                                    ]
                                }
                            ]
                        }
                    },
                    Application2: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.2.2'
                            ],
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.30',
                                        '192.0.2.40'
                                    ]
                                }
                            ]
                        }
                    }
                });
                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.error);
                        assert.strictEqual(ctxt.tasks[0].action, 'deploy');
                        assert.strictEqual(ctxt.tasks[0].dryRun, true);
                        assert.strictEqual(ctxt.tasks[0].warnings.length, 1);
                        assert.strictEqual(ctxt.tasks[0].warnings[0].tenant, 'Tenant1');
                        assert.strictEqual(ctxt.tasks[0].warnings[0].message, 'dryRun true found in Tenant controls');
                    });
            });

            it('should validate a per-app POST request with one app', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';

                restOp.setPathName(`${path}/Tenant1/applications/`);
                restOp.setPath(`${path}/Tenant1/applications/`);
                restOp.setBody({
                    schemaVersion: '3.50',
                    app1: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.strictEqual(ctxt.request.method, 'Post');
                        assert.strictEqual(ctxt.request.pathName, 'declare');
                        assert.strictEqual(ctxt.request.subPath, 'Tenant1/applications');
                        assert.deepStrictEqual(ctxt.request.queryParams, []);
                        assert.strictEqual(ctxt.request.isPerApp, true);
                        assert.deepStrictEqual(
                            ctxt.request.perAppInfo,
                            {
                                apps: ['app1'],
                                tenant: 'Tenant1',
                                decl: {
                                    schemaVersion: '3.50',
                                    app1: {
                                        class: 'Application',
                                        template: 'generic',
                                        pool1:
                                        {
                                            class: 'Pool',
                                            loadBalancingMode: 'round-robin',
                                            minimumMembersActive: 1,
                                            reselectTries: 0,
                                            serviceDownAction: 'none',
                                            slowRampTime: 11,
                                            minimumMonitors: 1
                                        }
                                    }
                                }
                            }
                        );
                        assert.strictEqual(ctxt.request.body.id.match(/^autogen/).length > 0, true);
                        delete ctxt.request.body.id; // The id is random, no need to check the value specifically
                        assert.deepEqual(
                            ctxt.request.body,
                            {
                                class: 'ADC',
                                schemaVersion: '3.50',
                                Tenant1: {
                                    class: 'Tenant',
                                    app1: {
                                        class: 'Application',
                                        template: 'generic',
                                        pool1:
                                        {
                                            class: 'Pool',
                                            loadBalancingMode: 'round-robin',
                                            minimumMembersActive: 1,
                                            reselectTries: 0,
                                            serviceDownAction: 'none',
                                            slowRampTime: 11,
                                            minimumMonitors: 1
                                        }
                                    }
                                }
                            }
                        );
                    });
            });

            it('should validate a per-app POST request with two apps', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';

                restOp.setPathName(`${path}/Tenant1/applications/`);
                restOp.setPath(`${path}/Tenant1/applications/`);
                restOp.setBody({
                    schemaVersion: '3.50',
                    app1: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    },
                    app2: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.isUndefined(ctxt.request.error);
                        assert.strictEqual(ctxt.request.method, 'Post');
                        assert.strictEqual(ctxt.request.pathName, 'declare');
                        assert.strictEqual(ctxt.request.subPath, 'Tenant1/applications');
                        assert.deepStrictEqual(ctxt.request.queryParams, []);
                        assert.strictEqual(ctxt.request.isPerApp, true);
                        assert.deepStrictEqual(
                            ctxt.request.perAppInfo,
                            {
                                apps: ['app1', 'app2'],
                                tenant: 'Tenant1',
                                decl: {
                                    schemaVersion: '3.50',
                                    app1: {
                                        class: 'Application',
                                        template: 'generic',
                                        pool1:
                                        {
                                            class: 'Pool',
                                            loadBalancingMode: 'round-robin',
                                            minimumMembersActive: 1,
                                            reselectTries: 0,
                                            serviceDownAction: 'none',
                                            slowRampTime: 11,
                                            minimumMonitors: 1
                                        }
                                    },
                                    app2: {
                                        class: 'Application',
                                        template: 'generic',
                                        pool1:
                                        {
                                            class: 'Pool',
                                            loadBalancingMode: 'round-robin',
                                            minimumMembersActive: 1,
                                            reselectTries: 0,
                                            serviceDownAction: 'none',
                                            slowRampTime: 11,
                                            minimumMonitors: 1
                                        }
                                    }
                                }
                            }
                        );
                        assert.strictEqual(ctxt.request.body.id.match(/^autogen/).length > 0, true);
                        delete ctxt.request.body.id; // The id is random, no need to check the value specifically
                        assert.deepEqual(
                            ctxt.request.body,
                            {
                                class: 'ADC',
                                schemaVersion: '3.50',
                                Tenant1: {
                                    class: 'Tenant',
                                    app1: {
                                        class: 'Application',
                                        template: 'generic',
                                        pool1:
                                        {
                                            class: 'Pool',
                                            loadBalancingMode: 'round-robin',
                                            minimumMembersActive: 1,
                                            reselectTries: 0,
                                            serviceDownAction: 'none',
                                            slowRampTime: 11,
                                            minimumMonitors: 1
                                        }
                                    },
                                    app2: {
                                        class: 'Application',
                                        template: 'generic',
                                        pool1:
                                        {
                                            class: 'Pool',
                                            loadBalancingMode: 'round-robin',
                                            minimumMembersActive: 1,
                                            reselectTries: 0,
                                            serviceDownAction: 'none',
                                            slowRampTime: 11,
                                            minimumMonitors: 1
                                        }
                                    }
                                }
                            }
                        );
                    });
            });
        });

        describe('invalid', () => {
            it('should invalidate a per-app GET request with "/declare/tenant,tenantId2/applications/app1', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';
                restOp.setPath(`${path}/tenant,tenantId2/applications/app1`);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.ok(typeof ctxt.eventEmitter !== 'undefined');
                        delete ctxt.eventEmitter;
                        assert.deepStrictEqual(
                            ctxt,
                            {
                                method: 'Get',
                                error: 'declare/tenant,tenantId2/applications/app1 is an invalid path. Only 1 tenant and 1 application may be specified in the URL.',
                                body: null,
                                errorCode: 400,
                                fullPath: '/shared/appsvcs/declare/tenant,tenantId2/applications/app1',
                                isPerApp: true,
                                perAppInfo: {
                                    apps: ['app1'],
                                    tenant: 'tenant,tenantId2'
                                },
                                pathName: 'declare',
                                queryParams: [],
                                subPath: 'tenant,tenantId2/applications/app1'
                            }
                        );
                    });
            });

            it('should invalidate a per-app GET request with "/declare/tenant/applications/app1,app2', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Get';
                restOp.setPath(`${path}/tenant/applications/app1,app2`);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.ok(typeof ctxt.eventEmitter !== 'undefined');
                        delete ctxt.eventEmitter;
                        assert.deepStrictEqual(
                            ctxt,
                            {
                                method: 'Get',
                                error: 'declare/tenant/applications/app1,app2 is an invalid path. Only 1 tenant and 1 application may be specified in the URL.',
                                body: null,
                                errorCode: 400,
                                fullPath: '/shared/appsvcs/declare/tenant/applications/app1,app2',
                                isPerApp: true,
                                perAppInfo: {
                                    apps: ['app1,app2'],
                                    tenant: 'tenant'
                                },
                                pathName: 'declare',
                                queryParams: [],
                                subPath: 'tenant/applications/app1,app2'
                            }
                        );
                    });
            });

            it('should invalidate a per-app POST request with per-app array', () => {
                const restOp = new RestOperationMock();
                restOp.method = 'Post';

                restOp.setPathName(`${path}/Tenant1/applications/`);
                restOp.setPath(`${path}/Tenant1/applications/`);
                restOp.setBody([{
                    app1: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }]);

                return RequestContext.get(restOp, hostContext)
                    .then((ctxt) => {
                        assert.strictEqual(ctxt.errorCode, 422);
                        assert.strictEqual(ctxt.isPerApp, true);
                        assert.strictEqual(ctxt.method, 'Post');
                        assert.strictEqual(ctxt.error, 'declaration should be an object');
                        assert.strictEqual(ctxt.pathName, 'declare');
                        assert.strictEqual(ctxt.subPath, 'Tenant1/applications');
                        assert.deepStrictEqual(ctxt.queryParams, []);
                        assert.deepEqual(
                            ctxt.body,
                            [{
                                app1: {
                                    class: 'Application',
                                    template: 'generic',
                                    pool1:
                                    {
                                        class: 'Pool',
                                        loadBalancingMode: 'round-robin',
                                        minimumMembersActive: 1,
                                        reselectTries: 0,
                                        serviceDownAction: 'none',
                                        slowRampTime: 11,
                                        minimumMonitors: 1
                                    }
                                }
                            }]
                        );
                    });
            });
        });
    });
});

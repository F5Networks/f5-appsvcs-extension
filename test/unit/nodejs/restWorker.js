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

const assert = require('assert');
const sinon = require('sinon');

const atgStorage = require('@f5devcentral/atg-storage');
const AsyncHandler = require('../../../src/lib/asyncHandler');
const RestOperationMock = require('../RestOperationMock');
const RestWorker = require('../../../src/nodejs/restWorker');
const constants = require('../../../src/lib/constants');
const log = require('../../../src/lib/log');
const HostContext = require('../../../src/lib/context/hostContext');
const RequestContext = require('../../../src/lib/context/requestContext');
const SettingsHandler = require('../../../src/lib/settingsHandler');
const SchemaValidator = require('../../../src/lib/schemaValidator');
const restUtil = require('../../../src/lib/util/restUtil');
const config = require('../../../src/lib/config');
const util = require('../../../src/lib/util/util');
const tmshUtil = require('../../../src/lib/util/tmshUtil');
const STATUS_CODES = require('../../../src/lib/constants').STATUS_CODES;

describe('restWorker', () => {
    let restWorker = null;
    let spyMakeRestjavadUri;

    const schemaConfigs = [{
        paths: [`file://${__dirname}/../../../src/schema/latest/as3-request-schema.json`]
    }];
    const schemaValidator = new SchemaValidator(constants.DEVICE_TYPES.BIG_IP, schemaConfigs);

    before(() => schemaValidator.init());

    afterEach(() => {
        sinon.restore();
    });

    beforeEach(() => {
        restWorker = new RestWorker();
        restWorker.restHelper = {
            makeRestjavadUri() {}
        };
        restWorker.as3info = {
            version: '3.0.0'
        };
        restWorker.dependencies = [];

        spyMakeRestjavadUri = sinon.spy(restWorker.restHelper, 'makeRestjavadUri');
        sinon.stub(log, 'error').callsFake((msg) => ({ message: msg }));

        sinon.stub(config, 'getAllSettings').resolves({});
        sinon.stub(util, 'getDeviceInfo').resolves({});
        sinon.stub(tmshUtil, 'getPrimaryAdminUser').resolves('admin:');
    });

    function createRestOpMock(statusCode, done, restOpBody, path) {
        // we're asserting side effect of calling the restWorker's on${Method}
        // which should eventually call restOperation.complete() method
        // we're passing in mocha done callback to ensure that these asserts happen
        const restOp = new RestOperationMock(() => {
            try {
                assert.equal(restOp.isComplete, true);
                assert.equal(restOp.statusCode, statusCode);
                if (restOp.body.code) {
                    // not all responses contain a code in the body.
                    // For example, GET after successful runs and POSTS with multiple tenants
                    // don't have a restOp.body.code
                    assert.equal(restOp.body.code, statusCode);
                }
                if (restOpBody) {
                    assert.deepStrictEqual(restOp.body, restOpBody);
                }
                done();
            } catch (err) {
                done(err);
            }
        });
        if (path) {
            restOp.setPath(path);
        }
        return restOp;
    }

    describe('onStart', () => {
        it('Any host - should add device info URI and store as dependency', function (done) {
            restWorker.onStart(() => {
                assert.strictEqual(
                    spyMakeRestjavadUri.calledWith('/shared/identified-devices/config/device-info'),
                    true
                );
                done();
            });
        });
    });

    describe('onStartCompleted', () => {
        it('Any host - should call failure callback if errMsg is not empty', function (done) {
            restWorker.onStartCompleted(null, (failResponse) => {
                assert.deepStrictEqual(
                    failResponse,
                    { message: 'onStartCompleted(): framework error =test error' }
                );
                done();
            }, null, 'test error');
        });

        it('Any host - should create host context, async handler, and accessProfiles data-group', function (done) {
            const asyncHandler = new AsyncHandler();
            sinon.stub(HostContext.prototype, 'get').resolves(
                {
                    asyncHandler,
                    as3VersionInfo: {},
                    schemaValidator
                }
            );
            let dataGroupExists = false;
            sinon.stub(atgStorage.StorageDataGroup.prototype, 'ensureDataGroup').callsFake(() => {
                dataGroupExists = true;
                return Promise.resolve();
            });
            restWorker.onStartCompleted(() => {
                assert.deepStrictEqual(
                    restWorker.hostContext,
                    {
                        asyncHandler,
                        as3VersionInfo: {},
                        schemaValidator
                    }
                );
                assert.strictEqual(restWorker.asyncHandler, asyncHandler);
                assert.strictEqual(dataGroupExists, true);
                done();
            }, null, null, '');
        });

        it('Any host - should catch error and call failure callback', function (done) {
            sinon.stub(HostContext.prototype, 'get').rejects({ stack: 'test error stack' });
            restWorker.onStartCompleted(null, (failResponse) => {
                assert.deepStrictEqual(
                    failResponse,
                    { message: 'Failed to complete startup. test error stack' }
                );
                done();
            }, null, '');
        });
    });

    describe('path validation', () => {
        const invalidPaths = [
            {
                name: 'too short',
                path: '/shared/appsvcs'
            },
            {
                name: 'bad endpoint',
                path: '/shared/appsvcs/foo'
            },
            {
                name: 'info with extra parameter',
                path: '/shared/appsvcs/info/foo'
            },
            {
                name: 'settings with extra parameter',
                path: '/shared/appsvcs/settings/foo'
            },
            {
                name: 'application instead of applications',
                path: '/shared/appsvcs/declare/exampleTenant/application'
            },
            {
                name: 'application instead of applications with app in path',
                path: '/shared/appsvcs/declare/exampleTenant/application/App1'
            },
            {
                name: 'multiple tenants used in per-app path',
                path: '/shared/appsvcs/declare/exampleTenant,otherTenant/applications'
            },
            {
                name: 'multiple applications used in per-app path',
                method: 'Post',
                path: '/shared/appsvcs/declare/exampleTenant/applications/App1,App2'
            },
            {
                name: 'extra value added to the end of the path after application name',
                method: 'Post',
                path: '/shared/appsvcs/declare/exampleTenant/applications/App1/somethingElse'
            },
            {
                name: 'cannot use Put on applications endpoint as we do NOT know the application to target',
                method: 'Put',
                path: '/shared/appsvcs/declare/foo/applications'
            },
            {
                name: 'cannot use Delete on applications endpoint as we should NOT be impacting unspecified applications',
                method: 'Delete',
                path: '/shared/appsvcs/declare/foo/applications'
            },
            {
                name: 'we do NOT support Post on specific applications as best practice indicates this should be done as a Put',
                method: 'Post',
                path: '/shared/appsvcs/declare/foo/applications/bar'
            }
        ];

        const validPaths = [
            {
                name: 'declare',
                path: '/shared/appsvcs/declare'
            },
            {
                name: 'task',
                path: '/shared/appsvcs/task'
            },
            {
                name: 'info',
                path: '/shared/appsvcs/info'
            },
            {
                name: 'settings',
                path: '/shared/appsvcs/settings'
            },
            {
                name: 'trailing slash',
                path: '/shared/appsvcs/declare/'
            },
            {
                name: 'declare with tenant',
                path: '/shared/appsvcs/declare/foo'
            },
            {
                name: 'task with id',
                path: '/shared/appsvcs/task/foo'
            },
            {
                name: 'declare with Get with tenant on per-app',
                method: 'Get',
                path: '/shared/appsvcs/declare/foo/applications'
            },
            {
                name: 'declare with Post with tenant on per-app',
                method: 'Post',
                path: '/shared/appsvcs/declare/foo/applications'
            },
            {
                name: 'declare with Get on per-app with applications and specific app',
                method: 'Get',
                path: '/shared/appsvcs/declare/foo/applications/bar'
            },
            {
                name: 'declare with Put on per-app with applications and specific app',
                method: 'Put',
                path: '/shared/appsvcs/declare/foo/applications/bar'
            },
            {
                name: 'declare with Delete on per-app with applications and specific app',
                method: 'Delete',
                path: '/shared/appsvcs/declare/foo/applications/bar'
            }
        ];

        invalidPaths.forEach((path) => {
            it(`Should reject ${path.name} paths`, (done) => {
                const restOp = createRestOpMock(400, done, null, path.path);
                if (path.method) {
                    restOp.method = path.method;
                }
                assert.doesNotThrow(() => restWorker.onGet(restOp));
            });
        });

        validPaths.forEach((path) => {
            it(`Should accept ${path.name} paths`, (done) => {
                const restOp = createRestOpMock(200, done, null, path.path);
                if (path.method) {
                    restOp.method = path.method;
                }
                sinon.stub(restWorker, 'continuePost').callsFake((context, restOperation) => {
                    restOperation.statusCode = 200;
                    restOperation.body = {
                        code: 200
                    };
                    restOperation.complete();
                });
                sinon.stub(RequestContext, 'get').resolves({});

                assert.doesNotThrow(() => restWorker.onGet(restOp));
            });
        });
    });

    describe('onGet', () => {
        describe('per-tenant', () => {
            it('Container - should fail with 405 and /declare', function (done) {
                const restOp = createRestOpMock(405, done);
                restOp.method = 'Get';
                restOp.setPathName('/shared/appsvcs/declare');
                restWorker.hostContext = {
                    deviceType: constants.DEVICE_TYPES.CONTAINER,
                    as3VersionInfo: {},
                    schemaValidator
                };

                assert.doesNotThrow(() => restWorker.onGet(restOp));
            });

            it('should return the current config with the desired values if a GET is used on /settings', function (done) {
                sinon.stub(SettingsHandler, 'process').callsFake((context, restOp) => {
                    const result = restUtil.buildOpResult(
                        STATUS_CODES.OK,
                        'retrieving settings',
                        { burstHandlingEnabled: false }
                    );
                    restUtil.completeRequest(restOp, result);
                });

                const restOp = createRestOpMock(200, done, {
                    burstHandlingEnabled: false
                });
                restOp.method = 'Get';
                restOp.setPathName('/shared/appsvcs/settings');
                restWorker.hostContext = {
                    deviceType: constants.DEVICE_TYPES.BIG_IP,
                    as3VersionInfo: {},
                    schemaValidator
                };
                restWorker.asyncHandler = { cleanRecords: () => { } };

                assert.doesNotThrow(() => restWorker.onGet(restOp));
            });

            it('should pass the request to the asyncHandler in the context', function (done) {
                const restOp = createRestOpMock(200, done, 'here is the body');
                restOp.method = 'Get';
                restOp.setPathName('/shared/appsvcs/info');
                restWorker.hostContext = {
                    as3VersionInfo: 'here is the body',
                    schemaValidator
                };
                restWorker.asyncHandler = {
                    cleanRecords: (context) => {
                        assert.strictEqual(context.request.method, 'Get');
                    }
                };

                restWorker.onGet(restOp);
            });
        });

        describe('per-app', () => {
            let requestContextReturnValue = {};

            beforeEach(() => {
                requestContextReturnValue = {
                    request: {
                        method: 'Get',
                        error: undefined,
                        body: { class: 'AS3', action: 'retrieve' },
                        fullPath: '/shared/appsvcs/declare/tenant1/applications',
                        pathName: 'declare',
                        subPath: 'tenant1/applications',
                        isPerApp: true,
                        queryParams: [],
                        basicAuth: undefined,
                        token: undefined,
                        isMultiDecl: false,
                        postProcessing: []
                    },
                    tasks: [
                        {
                            class: 'AS3',
                            action: 'retrieve',
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
                            targetTimeout: 150,
                            resourceTimeout: 5,
                            dryRun: false,
                            targetUsername: '',
                            targetPassphrase: '',
                            protocol: 'http',
                            urlPrefix: 'http://admin:@localhost:8100',
                            localBigip: true,
                            targetTokens: {}
                        }
                    ]
                };
            });

            it('should return all applications for tenant1 /declare/tenant1/applications', function (done) {
                sinon.stub(restWorker.declareHandler, 'process').callsFake((context, restOp) => {
                    const result = restUtil.buildOpResult(
                        STATUS_CODES.OK,
                        'retrieving all tenant1 applications for per-app',
                        {
                            app1: {
                                class: 'Application',
                                accelerator: {
                                    class: 'HTTP_Acceleration_Profile'
                                }
                            },
                            app2: {
                                class: 'Application',
                                accelerator: {
                                    class: 'HTTP_Acceleration_Profile'
                                }
                            }
                        }
                    );
                    restUtil.completeRequest(restOp, result);
                });

                sinon.stub(RequestContext, 'get').resolves(requestContextReturnValue);

                const restOp = createRestOpMock(
                    200,
                    done,
                    {
                        app1: {
                            class: 'Application',
                            accelerator: {
                                class: 'HTTP_Acceleration_Profile'
                            }
                        },
                        app2: {
                            class: 'Application',
                            accelerator: {
                                class: 'HTTP_Acceleration_Profile'
                            }
                        }
                    }
                );
                restOp.method = 'Get';
                restOp.setPathName('/shared/appsvcs/declare/tenant1/applications');
                restWorker.hostContext = {
                    deviceType: constants.DEVICE_TYPES.BIG_IP,
                    as3VersionInfo: {},
                    schemaValidator
                };
                restWorker.asyncHandler = { cleanRecords: () => { } };

                assert.doesNotThrow(() => restWorker.onGet(restOp));
            });

            it('should return specific application if a GET is used on /declare/tenant1/applications/app1', function (done) {
                sinon.stub(restWorker.declareHandler, 'process').callsFake((context, restOp) => {
                    const result = restUtil.buildOpResult(
                        STATUS_CODES.OK,
                        'retrieving tenant1/app1 values for per-app',
                        {
                            app1: {
                                class: 'Application',
                                accel: {
                                    class: 'HTTP_Acceleration_Profile'
                                }
                            }
                        }
                    );
                    restUtil.completeRequest(restOp, result);
                });

                requestContextReturnValue.request.fullPath = '/shared/appsvcs/declare/tenant1/applications/app1';
                requestContextReturnValue.request.subPath = 'tenant1/applications/app1';
                sinon.stub(RequestContext, 'get').resolves(requestContextReturnValue);

                const restOp = createRestOpMock(
                    200,
                    done,
                    {
                        app1: {
                            class: 'Application',
                            accel: {
                                class: 'HTTP_Acceleration_Profile'
                            }
                        }
                    }
                );
                restOp.method = 'Get';
                restOp.setPathName('/shared/appsvcs/declare/tenant1/applications/app1');
                restWorker.hostContext = {
                    deviceType: constants.DEVICE_TYPES.BIG_IP,
                    as3VersionInfo: {},
                    schemaValidator
                };
                restWorker.asyncHandler = { cleanRecords: () => { } };

                assert.doesNotThrow(() => restWorker.onGet(restOp));
            });
        });
    });

    describe('onDelete', () => {
        it('BIG-IQ - should fail with 405', function (done) {
            const restOp = createRestOpMock(405, done);
            restOp.method = 'Delete';
            restOp.setPathName('/shared/appsvcs/declare');
            restWorker.hostContext = {
                deviceType: constants.DEVICE_TYPES.BIG_IQ,
                as3VersionInfo: {},
                schemaValidator
            };

            assert.doesNotThrow(() => restWorker.onDelete(restOp));
        });

        it('Container - should fail with 405', function (done) {
            const restOp = createRestOpMock(405, done);
            restOp.method = 'Delete';
            restWorker.hostContext = {
                deviceType: constants.DEVICE_TYPES.CONTAINER,
                as3VersionInfo: {},
                schemaValidator
            };

            assert.doesNotThrow(() => restWorker.onDelete(restOp));
        });
    });

    describe('onPost', () => {
        it('Any host - should fail with an early exit and 400 if the body is invalid JSON', function (done) {
            const restOp = createRestOpMock(400, done);
            restOp.method = 'Post';
            restOp.body = 'test bad JSON';

            restWorker.hostContext = {
                as3VersionInfo: {},
                schemaValidator
            };

            assert.doesNotThrow(() => restWorker.onPost(restOp));
        });

        it('Any host - should fail with an early exit and 408 if the body is empty', function (done) {
            const restOp = createRestOpMock(408, done);
            restOp.method = 'Post';

            restWorker.hostContext = {
                as3VersionInfo: {},
                schemaValidator
            };

            assert.doesNotThrow(() => restWorker.onPost(restOp));
        });

        it('should replace the config with the desired values if a POST is used on /settings', function (done) {
            sinon.stub(SettingsHandler, 'process').callsFake((context, restOp) => {
                const result = restUtil.buildOpResult(
                    STATUS_CODES.OK,
                    'retrieving settings',
                    { burstHandlingEnabled: false }
                );
                restUtil.completeRequest(restOp, result);
            });

            const restOp = createRestOpMock(200, done, {
                burstHandlingEnabled: false
            });
            restOp.method = 'Post';
            restOp.body = { burstHandlingEnabled: true };
            restOp.setPathName('/shared/appsvcs/settings');
            restWorker.hostContext = {
                deviceType: constants.DEVICE_TYPES.BIG_IP,
                as3VersionInfo: {},
                schemaValidator
            };
            restWorker.asyncHandler = { cleanRecords: () => {} };

            assert.doesNotThrow(() => restWorker.onPost(restOp));
        });

        it('should reload settings from storage', (done) => {
            const reloadSettingsSpy = sinon.spy(config, 'reloadSettings');
            const assertion = () => {
                assert.ok(reloadSettingsSpy.calledOnce);
                done();
            };
            const restOp = createRestOpMock(200, assertion, 'here is the body');
            restOp.method = 'Post';
            restOp.body = {};
            restOp.setPathName('/shared/appsvcs/declare');

            restWorker.onPost(restOp);
        });
    });

    describe('onPatch', () => {
        it('Container - should fail with 405', function (done) {
            const restOp = createRestOpMock(405, done);
            restOp.method = 'Patch';
            restWorker.hostContext = {
                deviceType: constants.DEVICE_TYPES.CONTAINER,
                as3VersionInfo: {},
                schemaValidator
            };
            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });

        it('Any host - should fail with an early exit and 400 if the body is invalid JSON', function (done) {
            const restOp = createRestOpMock(400, done);
            restOp.method = 'Patch';
            restOp.body = 'test bad JSON';

            restWorker.hostContext = {
                as3VersionInfo: {},
                schemaValidator
            };

            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });

        it('Any host - should fail with an early exit and 408 if the body is empty', function (done) {
            const restOp = createRestOpMock(408, done);
            restOp.method = 'Patch';

            restWorker.hostContext = {
                as3VersionInfo: {},
                schemaValidator
            };

            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });

        it('should error if a PATCH is used on /settings', function (done) {
            // PATCH is not a currently supported method
            const restOp = createRestOpMock(405, done, {
                code: 405,
                message: '/shared/appsvcs/settings: Only acceptable methods are Post and Get'
            });
            restOp.method = 'Patch';
            restOp.body = [{
                op: 'add',
                path: 'burstHandlingEnabled',
                value: true
            }];
            restOp.setPathName('/shared/appsvcs/settings');
            restOp.uri.href = '/shared/appsvcs/settings';
            restWorker.hostContext = {
                deviceType: constants.DEVICE_TYPES.BIG_IP,
                as3VersionInfo: {},
                schemaValidator
            };
            restWorker.asyncHandler = { cleanRecords: () => {} };

            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });
    });
});

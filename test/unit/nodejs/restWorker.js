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

const assert = require('assert');
const sinon = require('sinon');

const atgStorage = require('@f5devcentral/atg-storage');
const AsyncHandler = require('../../../src/lib/asyncHandler');
const RestOperationMock = require('../RestOperationMock');
const RestWorker = require('../../../src/nodejs/restWorker');
const constants = require('../../../src/lib/constants');
const log = require('../../../src/lib/log');
const HostContext = require('../../../src/lib/context/hostContext');
const SettingsHandler = require('../../../src/lib/settingsHandler');
const restUtil = require('../../../src/lib/util/restUtil');
const config = require('../../../src/lib/config');
const util = require('../../../src/lib/util/util');
const tmshUtil = require('../../../src/lib/util/tmshUtil');

describe('restWorker', () => {
    let restWorker = null;
    let spyMakeRestjavadUri;

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
        sinon.stub(constants, 'reqSchemaFile')
            .value(`${__dirname}/../../../src/schema/latest/as3-request-schema.json`);
        sinon.stub(log, 'error').callsFake((msg) => ({ message: msg }));

        sinon.stub(config, 'getAllSettings').resolves({});
        sinon.stub(util, 'getDeviceInfo').resolves({});
        sinon.stub(tmshUtil, 'getPrimaryAdminUser').resolves('admin:');
    });

    function createRestOpMock(statusCode, done, restOpBody) {
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
                    as3VersionInfo: {}
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
                        as3VersionInfo: {}
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

    describe('onGet', () => {
        it('Container - should fail with 405 and /declare', function (done) {
            const restOp = createRestOpMock(405, done);
            restOp.method = 'Get';
            restOp.setPathName('/shared/appsvcs/declare');
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.CONTAINER };

            assert.doesNotThrow(() => restWorker.onGet(restOp));
        });

        it('should return the current config with the desired values if a GET is used on /settings', function (done) {
            sinon.stub(SettingsHandler, 'process').callsFake((context, restOp) => {
                const result = restUtil.buildOpResult(
                    restUtil.STATUS_CODES.OK,
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
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.BIG_IP };
            restWorker.asyncHandler = { cleanRecords: () => {} };

            assert.doesNotThrow(() => restWorker.onGet(restOp));
        });

        it('should pass the request to the asyncHandler in the context', function (done) {
            const restOp = createRestOpMock(200, done, 'here is the body');
            restOp.method = 'Get';
            restOp.setPathName('/shared/appsvcs/info');
            restWorker.hostContext = { as3VersionInfo: 'here is the body' };
            restWorker.asyncHandler = {
                cleanRecords: (context) => {
                    assert.strictEqual(context.request.method, 'Get');
                }
            };

            restWorker.onGet(restOp);
        });
    });

    describe('onDelete', () => {
        it('BIG-IQ - should fail with 405', function (done) {
            const restOp = createRestOpMock(405, done);
            restOp.method = 'Delete';
            restOp.setPathName('/shared/appsvcs/declare');
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.BIG_IQ };

            assert.doesNotThrow(() => restWorker.onDelete(restOp));
        });

        it('Container - should fail with 405', function (done) {
            const restOp = createRestOpMock(405, done);
            restOp.method = 'Delete';
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.CONTAINER };

            assert.doesNotThrow(() => restWorker.onDelete(restOp));
        });
    });

    describe('onPost', () => {
        it('Any host - should fail with an early exit and 400 if the body is invalid JSON', function (done) {
            const restOp = createRestOpMock(400, done);
            restOp.method = 'Post';
            restOp.body = 'test bad JSON';

            assert.doesNotThrow(() => restWorker.onPost(restOp));
        });

        it('Any host - should fail with an early exit and 408 if the body is empty', function (done) {
            const restOp = createRestOpMock(408, done);
            restOp.method = 'Post';

            assert.doesNotThrow(() => restWorker.onPost(restOp));
        });

        it('should replace the config with the desired values if a POST is used on /settings', function (done) {
            sinon.stub(SettingsHandler, 'process').callsFake((context, restOp) => {
                const result = restUtil.buildOpResult(
                    restUtil.STATUS_CODES.OK,
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
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.BIG_IP };
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
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.CONTAINER };
            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });

        it('Any host - should fail with an early exit and 400 if the body is invalid JSON', function (done) {
            const restOp = createRestOpMock(400, done);
            restOp.method = 'Patch';
            restOp.body = 'test bad JSON';

            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });

        it('Any host - should fail with an early exit and 408 if the body is empty', function (done) {
            const restOp = createRestOpMock(408, done);
            restOp.method = 'Patch';

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
            restWorker.hostContext = { deviceType: constants.DEVICE_TYPES.BIG_IP };
            restWorker.asyncHandler = { cleanRecords: () => {} };

            assert.doesNotThrow(() => restWorker.onPatch(restOp));
        });
    });
});

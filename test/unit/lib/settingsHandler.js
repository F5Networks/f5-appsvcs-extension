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

const fs = require('fs');
const sinon = require('sinon');
const atgStorage = require('@f5devcentral/atg-storage');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const nock = require('nock');

chai.use(chaiAsPromised);
const assert = chai.assert;

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const log = require('../../../src/lib/log');
const Config = require('../../../src/lib/config');
const RestOperationMock = require('../RestOperationMock');
const SettingsHandler = require('../../../src/lib/settingsHandler');
const Context = require('../../../src/lib/context/context');

describe('settingsHandler', () => {
    let localStorageDataGroup;
    let context;
    let restOp;

    beforeEach(() => {
        sinon.stub(log, 'error').returns();
        // Remove the unnecessary delay
        sinon.stub(promiseUtil, 'delay').callsFake((delay, value) => Promise.resolve(value));

        // StorageMemory is a localized version of the normal memory
        localStorageDataGroup = new atgStorage.StorageMemory();
        localStorageDataGroup.setItem('asyncTaskStorage', 'data-group');
        localStorageDataGroup.setItem('betaOptions', {
            perAppDeploymentAllowed: false
        });
        localStorageDataGroup.setItem('burstHandlingEnabled', false);
        localStorageDataGroup.setItem('performanceTracingEnabled', false);
        localStorageDataGroup.setItem('performanceTracingEndpoint', '');
        localStorageDataGroup.setItem('serviceDiscoveryEnabled', true);
        localStorageDataGroup.setItem('webhook', '');
        Config.injectSettings(localStorageDataGroup);
        context = Context.build();

        restOp = new RestOperationMock();
    });

    after(() => {
        // Confirm the Config is cleared out for the next unit tests
        Config.injectSettings();
    });

    afterEach(() => {
        sinon.restore();
    });

    function createRestOpCompletePromise(restOperation, statusCode, restOpBody) {
        // we're asserting side effect of calling the restWorker's on${Method}
        // which should eventually call restOperation.complete() method
        return new Promise((resolve, reject) => {
            restOperation.onComplete = () => {
                try {
                    assert.equal(restOperation.isComplete, true);
                    assert.equal(restOperation.statusCode, statusCode);
                    if (restOperation.body.code) {
                        // not all responses contain a code in the body.
                        // For example, GET after successful runs and POSTS with multiple tenants
                        // don't have a restOperation.body.code
                        assert.equal(restOperation.body.code, statusCode);
                    }
                    if (restOpBody) {
                        assert.deepStrictEqual(restOperation.body, restOpBody);
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
        });
    }

    describe('process', () => {
        it('should return a bad request if the method is not accepted', () => {
            restOp.method = 'Patch';
            restOp.body = {};
            restOp.uri.href = '/shared/appsvcs/settings';
            const restOpPromise = createRestOpCompletePromise(restOp, 405, {
                code: 405,
                message: '/shared/appsvcs/settings: Only acceptable methods are Post and Get'
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp))
                .then(() => restOpPromise);
        });

        it('should return an error when the schema file does not exist', () => {
            restOp.method = 'Post';
            restOp.body = {};
            sinon.stub(fs, 'readFileSync').throws(new Error('ENOENT: no such file or directory, open \'invalid/schema/path\''));
            const restOpPromise = createRestOpCompletePromise(restOp, 500, {
                code: 500,
                message: 'ENOENT: no such file or directory, open \'invalid/schema/path\''
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, 'invalid/schema/path'))
                .then(() => restOpPromise);
        });
    });

    describe('onPost', function () {
        let schemaPath;

        beforeEach(() => {
            schemaPath = `${__dirname}/../../../src/schema/latest/settings-schema.json`;
        });

        it('should set the perAppDeploymentAllowed value if passed in', () => {
            restOp.method = 'Post';
            restOp.body = {
                betaOptions: {
                    perAppDeploymentAllowed: true
                }
            };

            const restOpPromise = createRestOpCompletePromise(restOp, 200, {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: true
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should set the burstHandlingEnabled value if passed in', () => {
            restOp.method = 'Post';
            restOp.body = { burstHandlingEnabled: true };
            const restOpPromise = createRestOpCompletePromise(restOp, 200, {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: true,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should set the asyncTaskStorage value if passed in', () => {
            restOp.method = 'Post';
            restOp.body = { asyncTaskStorage: 'memory' };
            const restOpPromise = createRestOpCompletePromise(restOp, 200, {
                asyncTaskStorage: 'memory',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should set the performanceTracingEnabled value if passed in', () => {
            const fsStats = {
                isDirectory() { return true; }
            };
            sinon.stub(fs, 'stat').yields(false, fsStats);
            restOp.method = 'Post';
            restOp.body = { performanceTracingEnabled: true };
            const restOpPromise = createRestOpCompletePromise(restOp, 200, {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: true,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should set the webhook value if passed in', () => {
            restOp.method = 'Post';
            restOp.body = { webhook: 'https://www.example.com' };
            const restOpPromise = createRestOpCompletePromise(restOp, 200, {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: 'https://www.example.com'
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should return a 500 if an error happened during the update process', () => {
            sinon.stub(Config, 'updateSettings').rejects(new Error('Updating failed'));
            restOp.method = 'Post';
            restOp.body = { burstHandlingEnabled: true };
            const restOpPromise = createRestOpCompletePromise(restOp, 500, {
                code: 500,
                message: 'Updating failed'
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should return a 422 if creating an unknown variable, foo, in the config object', () => {
            sinon.stub(Config, 'updateSettings').rejects(new Error('Updating failed'));
            restOp.method = 'Post';
            restOp.body = { foo: 'bar' };
            const restOpPromise = createRestOpCompletePromise(restOp, 422);
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should return a 422 if there are existing AS3 tasks when setting serviceDiscoveryEnabled to false', () => {
            const scope = nock('http://admin:@localhost:8100')
                .get('/mgmt/shared/service-discovery/task')
                .reply(200, { items: [{ id: 'task', metadata: { user: 'AS3' } }] });

            context.tasks.push({ urlPrefix: 'http://admin:@localhost:8100' });
            context.host.sdInstalled = true;
            restOp.method = 'Post';
            restOp.body = { serviceDiscoveryEnabled: false };
            const restOpPromise = createRestOpCompletePromise(restOp, 422);
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise)
                .then(() => scope.done());
        });

        it('should set serviceDiscovery to false if the tasks endpoint returns 404', () => {
            const scope = nock('http://admin:@localhost:8100')
                .get('/mgmt/shared/service-discovery/task')
                .reply(400, { message: 'GET http://admin:XXXXXX@localhost:8100/mgmt/shared/service-discovery/task getting Service Discovery tasks response=404 body={"code":404,"message":"","referer":"Unknown","errorStack":[]}' });

            context.tasks.push({ urlPrefix: 'http://admin:@localhost:8100' });
            context.host.sdInstalled = true;
            restOp.method = 'Post';
            restOp.body = { serviceDiscoveryEnabled: false };
            const restOpPromise = createRestOpCompletePromise(restOp, 200);
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise)
                .then(() => scope.done());
        });

        it('should set serviceDiscoveryEnabled to false if service discovery is not installed', () => {
            restOp.method = 'Post';
            restOp.body = { serviceDiscoveryEnabled: false };
            const restOpPromise = createRestOpCompletePromise(restOp, 200);
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should return a 422 if an error occurs setting performanceTracing to true', () => {
            const fsStats = {
                isDirectory() { return true; }
            };
            sinon.stub(fs, 'stat').yields(true, fsStats);
            restOp.method = 'Post';
            restOp.body = { performanceTracingEnabled: true };
            const restOpPromise = createRestOpCompletePromise(restOp, 422);
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });

        it('should return a 422 if jaeger client is not installed when setting performanceTracing to true', () => {
            const fsStats = {
                isDirectory() { return false; }
            };
            sinon.stub(fs, 'stat').yields(false, fsStats);
            restOp.method = 'Post';
            restOp.body = { performanceTracingEnabled: true };
            const restOpPromise = createRestOpCompletePromise(restOp, 422);
            return assert.isFulfilled(SettingsHandler.process(context, restOp, schemaPath))
                .then(() => restOpPromise);
        });
    });

    describe('onGet', () => {
        it('should return current values', () => {
            restOp.method = 'Get';
            const restOpPromise = createRestOpCompletePromise(restOp, 200, {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp))
                .then(() => restOpPromise);
        });

        it('should return a 500 if an error happened during retrieval', () => {
            sinon.stub(Config, 'getAllSettings').rejects(new Error('Retrieval failed'));
            restOp.method = 'Get';
            restOp.body = {};
            const restOpPromise = createRestOpCompletePromise(restOp, 500, {
                code: 500,
                message: 'Retrieval failed'
            });
            return assert.isFulfilled(SettingsHandler.process(context, restOp))
                .then(() => restOpPromise);
        });
    });
});

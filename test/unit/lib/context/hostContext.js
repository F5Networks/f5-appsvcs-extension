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

const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const StorageMemory = require('@f5devcentral/atg-storage').StorageMemory;
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;

chai.use(chaiAsPromised);
const assert = chai.assert;

const HostContext = require('../../../../src/lib/context/hostContext');
const Async = require('../../../../src/lib/asyncHandler');
const As3Parser = require('../../../../src/lib/adcParser');
const SchemaValidator = require('../../../../src/lib/schemaValidator');
const log = require('../../../../src/lib/log');
const Config = require('../../../../src/lib/config');

const cloudLibUtils = require('../../../../src/lib/util/cloudLibUtils');
const util = require('../../../../src/lib/util/util');
const tmshUtil = require('../../../../src/lib/util/tmshUtil');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;

describe('hostContext', function () {
    this.timeout(5000);
    function wrapHttpResponse(body, code) {
        const httpWrapper = {
            statusCode: code || 200
        };
        httpWrapper.body = body;
        return httpWrapper;
    }

    const originalReadFileSync = fs.readFileSync;

    const schemaConfigs = [{
        paths: [`file://${__dirname}/../../../../src/schema/latest/adc-schema.json`]
    }];
    const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP, schemaConfigs);

    let hostContext;
    let ensureInstallSpy;
    let ensureUninstallSpy;

    const injectConfigSettings = ((settings) => {
        Config.injectSettings(new StorageMemory(Object.assign({
            burstHandlingEnabled: false,
            asyncTaskStorage: 'data-group',
            serviceDiscoveryEnabled: true
        }, settings)));
    });

    before(() => schemaValidator.init());

    beforeEach(() => {
        // stubs
        sinon.stub(fs, 'readFileSync').callsFake((readPath, options) => {
            if (readPath === path.normalize(`${__dirname}/../../../../src/version`)) {
                return '3.15.0-1';
            }
            return originalReadFileSync(readPath, options);
        });

        // util stubs
        sinon.stub(util, 'executeBashCommandExec')
            .resolves()
            .withArgs('cat /var/config/rest/iapps/f5-appsvcs/declRetryAttempts')
            .resolves('1');

        // Performance improvement. Copy schemaValidator existing contents to new schemaValidator in each test
        sinon.stub(SchemaValidator.prototype, 'init').callsFake((function () {
            Object.assign(this, schemaValidator);
        }));
        sinon.stub(util, 'getDeviceInfo').resolves({});

        sinon.stub(tmshUtil, 'getPrimaryAdminUser').resolves('admin');

        sinon.stub(cloudLibUtils, 'getIsAvailable').resolves(true);
        ensureInstallSpy = sinon.stub(cloudLibUtils, 'ensureInstall').resolves();
        ensureUninstallSpy = sinon.stub(cloudLibUtils, 'ensureUninstall').resolves();

        // lib stubs
        sinon.stub(Async.prototype, 'restoreState').resolves();

        injectConfigSettings();

        hostContext = new HostContext();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('get() on a BIG-IP', () => {
        beforeEach(() => {
            sinon.stub(util, 'httpRequest')
                .resolves(wrapHttpResponse(''));
            util.getDeviceInfo.restore();
            sinon.stub(util, 'getDeviceInfo')
                .resolves({ slots: [{ product: 'BIG-IP', isActive: true }] });
            sinon.stub(log, 'warning').resolves();
        });

        it('should get correct host type info', () => hostContext.get()
            .then((context) => {
                assert.strictEqual(context.deviceType, 'BIG-IP');
                assert.strictEqual(context.buildType, 'cloud');
            }));

        it('should instantiate an AS3 Parser, with correct deviceType and version info', () => hostContext.get()
            .then((context) => {
                assert.ok(context.schemaValidator instanceof SchemaValidator);
                assert.ok(context.parser instanceof As3Parser);
                assert.strictEqual(context.schemaValidator.getDeviceType(), 'BIG-IP');
                assert.strictEqual(context.as3VersionInfo.version, '3.15.0');
                assert.strictEqual(context.as3VersionInfo.release, '1');
            }));

        it('should instantiate a data-group datastore for async tasks', () => hostContext.get()
            .then((context) => {
                const expectedPath = '/Common/appsvcs/dataStore';
                assert.strictEqual(context.asyncHandler.dataStore.path, expectedPath);
            }));

        it('should instantiate a memory datastore for async tasks', () => {
            injectConfigSettings({ asyncTaskStorage: 'memory' });
            return hostContext.get()
                .then((context) => {
                    assert.equal(
                        context.asyncHandler.dataStore.constructor.name,
                        'JsonDataStore'
                    );
                });
        });

        it('should instantiate a TeemDevice', () => hostContext.get()
            .then((context) => {
                assert.notStrictEqual(context.teemDevice, undefined);
            }));

        it('should install service discovery if service discovery is enabled', () => hostContext.get()
            .then((context) => {
                assert.ok(ensureInstallSpy.calledOnce, 'ensureInstall should have been called');
                assert.strictEqual(context.sdInstalled, true, 'sdInstalled should be true');
            }));

        it('should uninstall service discovery if service discovery is disabled', () => {
            injectConfigSettings({ serviceDiscoveryEnabled: false });
            return hostContext.get()
                .then((context) => {
                    assert.ok(ensureUninstallSpy.calledOnce, 'ensureUninstall should have been called');
                    assert.strictEqual(context.sdInstalled, false, 'sdInstalled should be false');
                });
        });

        it('should skip service discovery if it is not available', () => {
            cloudLibUtils.getIsAvailable.restore();
            sinon.stub(cloudLibUtils, 'getIsAvailable').resolves(false);
            return hostContext.get()
                .then((context) => {
                    assert.ok(!ensureInstallSpy.called, 'ensureInstall should not have been called');
                    assert.ok(!ensureUninstallSpy.called, 'ensureUninstall should not have been called');
                    assert.strictEqual(context.sdInstalled, false, 'sdInstalled should be false');
                });
        });

        it('should throw when dependency not available and retires exhausted', () => {
            util.httpRequest.restore();
            sinon.stub(util, 'httpRequest').resolves(wrapHttpResponse('', 404));
            sinon.stub(promiseUtil, 'delay').resolves();
            return assert.isRejected(hostContext.get(), /^Unable to verify additional dependencies:/);
        });
    });

    describe('getHostInfo() testing via get()', () => {
        beforeEach(() => {
            hostContext = new HostContext();
            sinon.stub(log, 'warning').resolves();
            sinon.stub(promiseUtil, 'delay').resolves(); // this removes the time delay for testing
            sinon.stub(util, 'httpRequest').resolves(wrapHttpResponse(''));
        });

        it('should return "Container" if device info is undefined', () => {
            util.getDeviceInfo.restore();
            sinon.stub(util, 'getDeviceInfo').resolves();

            return hostContext.get()
                .then((context) => {
                    assert.strictEqual(context.deviceType, DEVICE_TYPES.CONTAINER);
                });
        });

        it('should return "Container" if device info is empty', () => hostContext.get()
            .then((context) => {
                assert.strictEqual(context.deviceType, DEVICE_TYPES.CONTAINER);
            }));

        it('should return "BIG-IP" if the active slot is present and is "BIG-IP"', () => {
            util.getDeviceInfo.restore();
            sinon.stub(util, 'getDeviceInfo').resolves(
                {
                    slots: [
                        { product: 'NOT-A-BIG-IP', isActive: false },
                        { product: 'BIG-IP', isActive: true }
                    ]
                }
            );

            return hostContext.get()
                .then((context) => {
                    assert.strictEqual(context.deviceType, 'BIG-IP');
                });
        });

        it('should return "BIG-IP" if the product is "ANY" and active slot is present and is "BIG-IP"', () => {
            util.getDeviceInfo.restore();
            sinon.stub(util, 'getDeviceInfo').resolves(
                {
                    product: 'ANY',
                    slots: [
                        { product: 'NOT-A-BIG-IP', isActive: false },
                        { product: 'BIG-IP', isActive: true }
                    ]
                }
            );

            return hostContext.get()
                .then((context) => {
                    assert.strictEqual(context.deviceType, 'BIG-IP');
                });
        });

        it('should return value of body.product if body.slots is present but no active slot item', () => {
            util.getDeviceInfo.restore();
            sinon.stub(util, 'getDeviceInfo').resolves(
                {
                    product: 'ANY',
                    slots: [
                        { product: 'NOT-A-BIG-IP', isActive: false },
                        { product: 'BIG-IP', isActive: false }
                    ]
                }
            );

            return hostContext.get()
                .then((context) => {
                    assert.strictEqual(context.deviceType, 'ANY');
                });
        });

        it('should return value of body.product if no body.slots present', () => {
            util.getDeviceInfo.restore();
            sinon.stub(util, 'getDeviceInfo').resolves(
                {
                    product: 'BIG-IQ',
                    edition: 'FINAL'
                }
            );

            return hostContext.get()
                .then((context) => {
                    assert.strictEqual(context.deviceType, 'BIG-IQ');
                });
        });
    });
});

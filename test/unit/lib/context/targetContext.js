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

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const Context = require('../../../../src/lib/context/context');
const TargetContext = require('../../../../src/lib/context/targetContext');
const util = require('../../../../src/lib/util/util');

describe('targetContext', () => {
    afterEach(() => {
        sinon.restore();
    });

    let context;
    beforeEach(() => {
        context = Context.build();
        context.tasks.push({ action: 'retrieve' });
        context.control = {
            port: 8100,
            urlPrefix: 'http://admin:@localhost:8100',
            tenantsInPath: [],
            tokens: {}
        };
    });

    it('should return a default context object', () => {
        sinon.stub(util, 'iControlRequest').callsFake((controlsF, opts) => {
            if (opts.path === '/mgmt/tm/sys/provision') {
                return Promise.resolve({ items: [] });
            }
            if (opts.path === '/mgmt/shared/identified-devices/config/device-info') {
                return Promise.resolve({
                    slots: [
                        {
                            product: 'BIG-IP',
                            version: '14.1.2.1',
                            isActive: true,
                            build: '0.0.4'
                        }
                    ],
                    hostname: 'bigip1',
                    version: '13.1.1.4'
                });
            }
            return Promise.reject(new Error('Unknown path was supplied in this unit test'));
        });
        return assert.becomes(TargetContext.get(context), {
            tokens: {},
            deviceType: 'BIG-IP',
            provisionedModules: [],
            tmosVersion: '14.1.2.1.0.0.4',
            host: 'localhost',
            port: 8100
        });
    });

    it('should reject with a 404 if the action is retrieve and it errors', () => {
        sinon.stub(util, 'iControlRequest').rejects('I failed');

        return assert.isRejected(TargetContext.get(context),
            /unable to retrieve declaration/)
            .then((result) => assert.strictEqual(result.statusCode, 404));
    });

    it('should reject with a 400 if the action is patch and it errors', () => {
        sinon.stub(util, 'iControlRequest').rejects({ message: 'I failed' });

        context.tasks[0] = {
            action: 'patch'
        };
        return assert.isRejected(TargetContext.get(context),
            /patch operation failed - see logs for details. I failed/)
            .then((result) => assert.strictEqual(result.statusCode, 400));
    });

    it('should reject with a 500 if the action is anything except for retrieve or patch and it errors', () => {
        sinon.stub(util, 'iControlRequest').rejects({ message: 'this errored' });

        context.tasks[0] = {
            action: 'deploy'
        };
        return assert.isRejected(TargetContext.get(context), /this errored/)
            .then((result) => assert.strictEqual(result.statusCode, 500));
    });

    it('should reject if there is no action and the util.iControlRequest returns a response without an item array', () => {
        sinon.stub(util, 'iControlRequest').callsFake((controlsF, opts) => {
            if (opts.path === '/mgmt/tm/sys/provision') {
                return Promise.resolve({ foo: 'bar' });
            }
            if (opts.path === '/mgmt/shared/identified-devices/config/device-info') {
                return Promise.resolve('14.1.2.1');
            }
            return Promise.reject(new Error('Unknown path was supplied in this unit test'));
        });

        // Intentionally remove the default action for this test
        delete context.tasks[0].action;

        return assert.isRejected(TargetContext.get(context),
            /Could not retrieve provisioning of target device/);
    });

    it('should reject if there is no action and the response from endpoint does not contain a selfLink', () => {
        sinon.stub(util, 'iControlRequest').callsFake((controlsF, opts) => {
            if (opts.path === '/mgmt/tm/sys/provision') {
                return Promise.resolve({ items: [] });
            }
            if (opts.path === '/mgmt/shared/identified-devices/config/device-info') {
                return Promise.resolve({});
            }
            return Promise.reject(new Error('Unknown path was supplied in this unit test'));
        });

        // Intentionally remove the default action for this test
        delete context.tasks[0].action;

        return assert.isRejected(TargetContext.get(context),
            /device-info did not return a proper response with a slots array/);
    });

    it('should reject if there is no action and the response from device-info endpoint does not contain an active slot', () => {
        sinon.stub(util, 'iControlRequest').callsFake((controlsF, opts) => {
            if (opts.path === '/mgmt/tm/sys/provision') {
                return Promise.resolve({ items: [] });
            }
            if (opts.path === '/mgmt/shared/identified-devices/config/device-info') {
                return Promise.resolve({ slots: [] });
            }
            return Promise.reject(new Error('Unknown path was supplied in this unit test'));
        });

        // Intentionally remove the default action for this test
        delete context.tasks[0].action;

        return assert.isRejected(TargetContext.get(context),
            /target device has no active slots/);
    });

    it('should return a context with the deviceType as BIG-IQ', () => {
        sinon.stub(util, 'iControlRequest').callsFake((controlsF, opts) => {
            if (opts.path === '/mgmt/tm/sys/provision') {
                return Promise.resolve({
                    items: [
                        { level: 'none', name: 'foo-bar' },
                        { level: 'something', name: 'biq' }
                    ]
                });
            }
            if (opts.path === '/mgmt/shared/identified-devices/config/device-info') {
                return Promise.resolve({
                    slots: [
                        {
                            product: 'BIG-IQ',
                            version: '7.0.0',
                            isActive: true,
                            build: '0.0.1854'
                        }
                    ],
                    hostname: 'bigiq',
                    version: '7.0.0'
                });
            }
            return Promise.reject(new Error('Unknown path was supplied in this unit test'));
        });

        context.control.targetHost = 'myBigIp.com';
        context.control.targetPort = 1234;
        return assert.becomes(TargetContext.get(context), {
            tokens: {},
            deviceType: 'BIG-IQ',
            provisionedModules: ['biq'],
            tmosVersion: '7.0.0.0.0.1854',
            host: 'myBigIp.com',
            port: 1234
        });
    });
});

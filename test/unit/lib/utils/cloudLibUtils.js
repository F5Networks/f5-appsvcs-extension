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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const nock = require('nock');
const sinon = require('sinon');
const fs = require('fs');

chai.use(chaiAsPromised);
const assert = chai.assert;

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const util = require('../../../../src/lib/util/util');
const cloudLibUtils = require('../../../../src/lib/util/cloudLibUtils');
const Context = require('../../../../src/lib/context/context');
const log = require('../../../../src/lib/log');
const constants = require('../../../../src/lib/constants');
const iappUtil = require('../../../../src/lib/util/iappUtil');

const DEVICE_TYPES = constants.DEVICE_TYPES;

describe('cloudLibUtils', () => {
    let context;

    beforeEach(() => {
        // Remove the unnecessary delay
        sinon.stub(promiseUtil, 'delay').callsFake((delay, value) => Promise.resolve(value));
        context = Context.build();
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.install', () => {
        beforeEach(() => {
            sinon.stub(fs, 'readdirSync').callsFake((path) => {
                if (path === '/var/config/rest/iapps/f5-appsvcs/packages') {
                    return ['f5-service-discovery-1.5.0-3.noarch.rpm'];
                }
                throw new Error(`path (${path}) provided for fs.readdirSync() is not recognized`);
            });
            sinon.stub(iappUtil, 'copyToHost').callsFake((c, p, fn) => fn());
        });

        it('should install service discovery after uninstalling it', () => {
            nock('https://localhost:8100')
                .post('/mgmt/shared/iapp/package-management-tasks', /QUERY/)
                .reply(202, {
                    operation: 'QUERY',
                    id: 'exampleQueryTaskId',
                    status: 'CREATED'
                })
                .post('/mgmt/shared/iapp/package-management-tasks', /UNINSTALL/)
                .reply(202, {
                    operation: 'UNINSTALL',
                    id: 'exampleUninstallTaskId',
                    status: 'CREATED'
                })
                .post('/mgmt/shared/iapp/package-management-tasks', /INSTALL/)
                .reply(202, {
                    operation: 'INSTALL',
                    id: 'exampleUninstallTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleQueryTaskId')
                .reply(200, {
                    operation: 'QUERY',
                    status: 'FINISHED',
                    id: 'exampleQueryTaskId',
                    queryResponse: [
                        {
                            name: 'f5-service-discovery',
                            version: '1.5.0',
                            release: '3',
                            arch: 'noarch',
                            packageName: 'f5-service-discovery-1.5.0-3.noarch',
                            tags: ['PLUGIN']
                        },
                        {
                            name: 'f5-appsvcs',
                            version: '3.27.0',
                            release: '0',
                            arch: 'noarch',
                            packageNmae: 'f5-appsvcs-3.27.0-0.noarch',
                            tags: ['PLUGIN']
                        }
                    ]
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleUninstallTaskId')
                .reply(200, {
                    packageName: 'f5-service-discovery-1.5.0-3.noarch',
                    operation: 'UNINSTALL',
                    status: 'FINISHED',
                    id: 'exampleUninstallTaskId'
                })
                .get('/mgmt/shared/service-discovery/info')
                .reply(200, {
                    version: '1.5.0-3'
                });
            context.tasks[0] = {
                protocol: 'https',
                urlPrefix: 'https://localhost:8100'
            };

            return assert.isFulfilled(cloudLibUtils.install(context));
        });

        it('should reject gracefully even if all endpoints are returning bad info', () => {
            let retryFailed = false;
            sinon.stub(log, 'debug').callsFake((message) => {
                if (message === 'cloudLibUtils.getRPMName: Aborting after max retry attempts') {
                    retryFailed = true;
                }
            });

            nock('https://localhost:8100')
                .post('/mgmt/shared/iapp/package-management-tasks', /QUERY/)
                .reply(202, {
                    operation: 'QUERY',
                    id: 'exampleQueryTaskId',
                    status: 'CREATED'
                })
                .post('/mgmt/shared/iapp/package-management-tasks', /UNINSTALL/)
                .reply(202, {
                    operation: 'UNINSTALL',
                    id: 'exampleUninstallTaskId',
                    status: 'CREATED'
                })
                .post('/mgmt/shared/iapp/package-management-tasks', /INSTALL/)
                .reply(202, {
                    operation: 'INSTALL',
                    id: 'exampleUninstallTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleQueryTaskId')
                .times(5)
                .reply(200, {
                    status: 'RUNNING'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleUninstallTaskId')
                .times(5)
                .reply(200, {
                    status: 'RUNNING'
                })
                .get('/mgmt/shared/service-discovery/info')
                .times(61)
                .reply(404, {
                    code: 404,
                    message: '',
                    referer: '10.0.0.1',
                    errorStack: []
                });
            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.isRejected(cloudLibUtils.install(context), 'Failed waiting for discovery to start: 404')
                .then(() => {
                    assert.ok(retryFailed, true, 'Should have hit the max attempts when failing to pull the RPM name.');
                });
        });
    });

    describe('.uninstallDiscoveryRpm', () => {
        it('should return true if no discoveryRpm value is provided', () => assert.becomes(
            cloudLibUtils.uninstallDiscoveryRpm(context),
            true,
            'A "true" should be resolved if the discoveryRpm parameter is not provided'
        ));

        it('should succeed and print debug messages if checkUninstallTask maxes its retries', () => {
            let retryFailed = false;
            let uninstallWarning = false;
            sinon.stub(log, 'debug').callsFake((message) => {
                if (message === 'cloudLibUtils.checkUninstallTask: Aborting after max retry attempts') {
                    retryFailed = true;
                } else if (message === 'Warning: Uninstall may not have completely finished.') {
                    uninstallWarning = true;
                }
            });

            nock('https://localhost:8100')
                .post('/mgmt/shared/iapp/package-management-tasks', /UNINSTALL/)
                .reply(202, {
                    operation: 'UNINSTALL',
                    id: 'exampleUninstallTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleUninstallTaskId')
                .times(5)
                .reply(200, {
                    packageName: 'f5-service-discovery-1.5.0-3.noarch',
                    operation: 'UNINSTALL',
                    status: 'RUNNING',
                    id: 'exampleUninstallTaskId'
                });
            context.tasks[0] = {
                protocol: 'https',
                urlPrefix: 'https://localhost:8100'
            };

            return assert.isFulfilled(cloudLibUtils.uninstallDiscoveryRpm(context, 'f5-service-discovery-1.5.0-3.noarch'),
                'Even though uninstall cannot be confirmed, it should still resolve')
                .then(() => {
                    assert.ok(retryFailed, true, 'Should have hit the max attempts when attempting to uninstall SD');
                    assert.ok(uninstallWarning, true, 'Should have printed out a warning if the uninstall cannot be confirmed');
                });
        });
    });

    describe('.decryptFromRemote', () => {
        it('should send decrypt request to encryption endpoint', () => {
            nock('https://localhost:8100')
                .post('/mgmt/shared/service-discovery/encryption')
                .reply(200, { result: 'f5' });

            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.becomes(cloudLibUtils.decryptFromRemote(context, '$3cr3t'), 'f5');
        });

        it('should modify and throw error', () => {
            sinon.stub(util, 'iControlRequest').rejects(new Error('Test Failure'));

            return assert.isRejected(
                cloudLibUtils.decryptFromRemote(context, '$3cr3t'),
                /Failed decrypting cloud credentials: Test Failure/
            );
        });
    });

    describe('.waitForDiscoveryInit', () => {
        it('should wait for SD info endpoint', () => {
            sinon.stub(log, 'warning');

            nock('https://localhost:8100')
                .get('/mgmt/shared/service-discovery/info')
                .times(4)
                .reply(404)
                .get('/mgmt/shared/service-discovery/info')
                .reply(200, { version: '1.0.0-1' });

            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.isFulfilled(cloudLibUtils.waitForDiscoveryInit(context));
        });

        it('should error if SD info endpoint can NOT be reached after 60 retries', () => {
            sinon.stub(log, 'warning');

            nock('https://localhost:8100')
                .get('/mgmt/shared/service-discovery/info')
                .times(61)
                .reply(404, { message: 'Public URI path not registered /shared/service-discovery/info' });

            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.isRejected(
                cloudLibUtils.waitForDiscoveryInit(context),
                /Failed waiting for discovery to start: 404/
            );
        });
    });

    describe('.checkVersions', () => {
        function assertCheck(desired, found, result) {
            assert.equal(cloudLibUtils.checkVersions(desired, found), result);
        }

        it('should error when array lengths do not match', () => {
            assert.throws(
                () => cloudLibUtils.checkVersions(['0.0.0'], [])
            );
        });

        it('should pass if no versions are given', () => {
            assertCheck([], [], true);
        });

        it('should pass if all versions match', () => {
            assertCheck(
                ['2.0.0', '1.0.1-5'],
                ['2.0.0', '1.0.1-5'],
                true
            );
        });

        it('should fail if any version does not match', () => {
            assertCheck(
                ['2.0.0', '1.0.0-3'],
                ['2.0.0', '1.1.0-1'],
                false
            );
        });
    });

    describe('.getIsInstalled', () => {
        function assertSkipCheckInstall(assertContext) {
            return cloudLibUtils.getIsInstalled(assertContext)
                .catch(() => {
                    assert.fail('Promise should not reject');
                })
                .then((results) => {
                    assert.strictEqual(results, true);
                });
        }

        function assertCheckInstall(assertContext) {
            return cloudLibUtils.getIsInstalled(assertContext)
                .then(() => {
                    assert.fail('Promise should fail to check version file');
                })
                .catch((e) => {
                    assert(e.message.startsWith('ENOENT'));
                });
        }

        it('should always return true for BIG_IQ device type', () => assertSkipCheckInstall({
            host: {
                buildType: undefined,
                deviceType: DEVICE_TYPES.BIG_IQ
            }
        }));

        it('should check installation for CLOUD build', () => assertCheckInstall({
            host: {
                buildType: constants.BUILD_TYPES.CLOUD,
                deviceType: undefined
            },
            request: {},
            tasks: []
        }));

        it('should check installation for BIG_IP device type', () => assertCheckInstall({
            host: {
                buildType: undefined,
                deviceType: DEVICE_TYPES.BIG_IP
            },
            request: {},
            tasks: []
        }));

        it('should check installation for CONTAINER device type', () => assertCheckInstall({
            host: {
                buildType: undefined,
                deviceType: DEVICE_TYPES.CONTAINER
            },
            request: {},
            tasks: []
        }));

        it('should not default to localhost when context.target is empty', () => {
            sinon.restore();
            sinon.stub(fs, 'readFile').yields(null, '{"discoveryWorker":"1.0.0"}');
            sinon.stub(log, 'error').returns(null);
            sinon.stub(promiseUtil, 'delay').callsFake((t, v) => new Promise(((resolve) => {
                setTimeout(() => {
                    resolve(v);
                }, 1);
            })));

            nock('https://192.0.1.2:8443')
                .post('/mgmt/shared/iapp/package-management-tasks')
                .times(24)
                .replyWithError('Bad Request');

            context = {
                host: {
                    buildType: constants.BUILD_TYPES.CLOUD,
                    deviceType: DEVICE_TYPES.CONTAINER
                },
                target: {
                    tokens: { 'X-F5-Auth-Token': '12345' }
                },
                control: {},
                tasks: [{ urlPrefix: 'https://192.0.1.2:8443' }],
                currentIndex: 0
            };

            return cloudLibUtils.getIsInstalled(context)
                .catch((e) => {
                    assert(e.message.endsWith('(Bad Request)'));
                    assert(nock.isDone());
                });
        });
    });

    describe('.ensureInstall', () => {
        it('should resolve if the installed version of Service Discovery equals the desired version', () => {
            sinon.restore();
            sinon.stub(fs, 'readFile').yields(null, '{"discoveryWorker":"1.5.0-3"}');
            sinon.stub(log, 'error').returns(null);
            sinon.stub(promiseUtil, 'delay').callsFake((t, v) => new Promise(((resolve) => {
                setTimeout(() => {
                    resolve(v);
                }, 1);
            })));

            nock('https://localhost:8100')
                .post('/mgmt/shared/iapp/package-management-tasks', /QUERY/)
                .reply(202, {
                    operation: 'QUERY',
                    id: 'exampleQueryTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleQueryTaskId')
                .reply(200, {
                    operation: 'QUERY',
                    status: 'FINISHED',
                    id: 'exampleQueryTaskId',
                    queryResponse: [
                        {
                            name: 'f5-service-discovery',
                            version: '1.5.0',
                            release: '3',
                            arch: 'noarch',
                            packageName: 'f5-service-discovery-1.5.0-3.noarch',
                            tags: ['PLUGIN']
                        }
                    ]
                })
                .get('/mgmt/shared/service-discovery/info')
                .reply(200, {
                    version: '1.5.0-3'
                });
            context.tasks[0] = {
                protocol: 'https',
                urlPrefix: 'https://localhost:8100'
            };

            return assert.isFulfilled(cloudLibUtils.ensureInstall(context));
        });
    });

    describe('.ensureUninstall', () => {
        it('should uninstall service discovery if it is installed', () => {
            const scope = nock('https://localhost:8100')
                .post('/mgmt/shared/iapp/package-management-tasks', /QUERY/)
                .reply(202, {
                    operation: 'QUERY',
                    id: 'exampleQueryTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleQueryTaskId')
                .reply(200, {
                    operation: 'QUERY',
                    status: 'FINISHED',
                    id: 'exampleQueryTaskId',
                    queryResponse: [
                        {
                            name: 'f5-service-discovery',
                            version: '1.5.0',
                            release: '3',
                            arch: 'noarch',
                            packageName: 'f5-service-discovery-1.5.0-3.noarch',
                            tags: ['PLUGIN']
                        }
                    ]
                })
                .post('/mgmt/shared/iapp/package-management-tasks', /UNINSTALL/)
                .reply(202, {
                    operation: 'UNINSTALL',
                    id: 'exampleUninstallTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleUninstallTaskId')
                .reply(200, {
                    packageName: 'f5-service-discovery-1.5.0-3.noarch',
                    operation: 'UNINSTALL',
                    status: 'FINISHED',
                    id: 'exampleUninstallTaskId'
                });
            context.tasks[0] = {
                protocol: 'https',
                urlPrefix: 'https://localhost:8100'
            };

            return assert.isFulfilled(cloudLibUtils.ensureUninstall(context))
                .then(() => scope.done());
        });

        it('should skip uninstalling service discovery if it is not installed', () => {
            const scope = nock('https://localhost:8100')
                .post('/mgmt/shared/iapp/package-management-tasks', /QUERY/)
                .reply(202, {
                    operation: 'QUERY',
                    id: 'exampleQueryTaskId',
                    status: 'CREATED'
                })
                .get('/mgmt/shared/iapp/package-management-tasks/exampleQueryTaskId')
                .reply(200, {
                    operation: 'QUERY',
                    status: 'FINISHED',
                    id: 'exampleQueryTaskId',
                    queryResponse: []
                });
            context.tasks[0] = {
                protocol: 'https',
                urlPrefix: 'https://localhost:8100'
            };

            return assert.isFulfilled(cloudLibUtils.ensureUninstall(context))
                .then(() => scope.done());
        });
    });

    describe('.decryptFromRemote', () => {
        it('should send decrypt request to encryption endpoint', () => {
            nock('https://localhost:8100')
                .post('/mgmt/shared/service-discovery/encryption')
                .reply(200, { result: 'f5' });

            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.becomes(cloudLibUtils.decryptFromRemote(context, '$3cr3t'), 'f5');
        });

        it('should modify and throw error', () => {
            sinon.stub(util, 'iControlRequest').rejects(new Error('Test Failure'));

            return assert.isRejected(
                cloudLibUtils.decryptFromRemote(context, '$3cr3t'),
                /Failed decrypting cloud credentials: Test Failure/
            );
        });
    });

    describe('.waitForDiscoveryInit', () => {
        it('should wait for SD info endpoint', () => {
            sinon.stub(log, 'warning');

            nock('https://localhost:8100')
                .get('/mgmt/shared/service-discovery/info')
                .times(4)
                .reply(404)
                .get('/mgmt/shared/service-discovery/info')
                .reply(200, { version: '1.0.0-1' });

            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.isFulfilled(cloudLibUtils.waitForDiscoveryInit(context));
        });

        it('should error if SD info endpoint can NOT be reached after 60 retries', () => {
            sinon.stub(log, 'warning');

            nock('https://localhost:8100')
                .get('/mgmt/shared/service-discovery/info')
                .times(61)
                .reply(404, { message: 'Public URI path not registered /shared/service-discovery/info' });

            context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

            return assert.isRejected(
                cloudLibUtils.waitForDiscoveryInit(context),
                /Failed waiting for discovery to start: 404/
            );
        });
    });

    describe('.getIsAvailable', () => {
        // Warning: This test will leave IS_AVAILABLE set to true in the cloudLibUtils object
        it('should resolve false if fs.access errors', () => {
            const fsAccess = sinon.stub(fs, 'access').callsFake((path, fsVal, fn) => fn('Error: Unable to find file'));
            return assert.becomes(cloudLibUtils.getIsAvailable(), false)
                .then(() => assert.becomes(cloudLibUtils.getIsAvailable(), false)) // Confirm early exit
                .then(() => assert.ok(fsAccess.calledOnce, 'fs.access should have only been called once as the early exit would prevent a second'));
        });
    });
});

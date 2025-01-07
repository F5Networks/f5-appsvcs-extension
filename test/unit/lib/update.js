/**
 * Copyright 2025 F5, Inc.
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
const sinon = require('sinon');
const nock = require('nock');

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const Context = require('../../../src/lib/context/context');
const update = require('../../../src/lib/update');
const config = require('../../../src/lib/config');
const log = require('../../../src/lib/log');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('update', () => {
    let context;
    beforeEach(() => {
        context = Context.build();
        context.tasks.push({ protocol: 'http', urlPrefix: 'http://localhost:8100' });
        sinon.stub(config, 'getAllSettings').resolves({
            serializeFileUploads: false
        });
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.runScript()', () => {
        beforeEach(() => {
            sinon.stub(promiseUtil, 'delay').resolves();
        });

        function nockCreate() {
            nock('http://localhost:8100')
                .post('/mgmt/tm/task/cli/script')
                .reply(200, {
                    _taskId: 42
                });
        }

        function nockStart() {
            nock('http://localhost:8100')
                .put('/mgmt/tm/task/cli/script/42')
                .reply(200);
        }

        function nockInProgress(n) {
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .times(n)
                .reply(400, {
                    error: 'TimeoutException'
                });
        }

        function nockBadRequest(n) {
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .times(n)
                .reply(400, {
                    error: 'response=400'
                });
        }

        function nockCompleted(state) {
            state = state || {};
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .reply(200, () => {
                    state.completed = true;
                    return {
                        _taskState: 'COMPLETED'
                    };
                });
        }

        function nockTimeout() {
            // nock.delayConnection doesn't seem to work across all of our node versions
            // so we have to fake the timeout error by emitting it ourselves
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .reply(504, function () {
                    this.req.emit('timeout');
                });
        }

        function nockTaskNotFound() {
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .reply(404, { message: 'Task not found - ID: 42 user: admin' });
        }

        function assertComplete() {
            const state = {};
            nockCompleted(state);
            return assert.isFulfilled(update.runScript(context))
                .then(() => {
                    assert(state.completed, 'Did not wait for COMPLETED state');
                });
        }

        it('should reject if run POST fails', () => {
            nock('http://localhost:8100')
                .post('/mgmt/tm/task/cli/script')
                .reply(500, 'waldo');
            return assert.isRejected(
                update.runScript(context),
                /waldo/
            );
        });

        it('should reject if start PUT fails', () => {
            nockCreate();
            nock('http://localhost:8100')
                .put('/mgmt/tm/task/cli/script/42')
                .reply(500, 'waldo');
            return assert.isRejected(
                update.runScript(context),
                /waldo/
            );
        });

        it('should reject if status GET fails', () => {
            nockCreate();
            nockStart();
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .reply(500, 'waldo');
            return assert.isRejected(
                update.runScript(context),
                /waldo/
            );
        });

        it('should fulfill on COMPLETED state', () => {
            nockCreate();
            nockStart();
            return assertComplete();
        });

        it('should wait when in VALIDATING state', () => {
            nockCreate();
            nockStart();
            nockInProgress();
            return assertComplete();
        });

        it('should fulfill even if in progress checks do not timeout', () => {
            nockCreate();
            nockStart();
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .reply(200, {
                    _taskState: 'VALIDATING'
                });
            return assertComplete();
        });

        it('should reject if too many timeouts are encountered', () => {
            nockCreate();
            nockStart();
            nockInProgress(61);
            return assert.isRejected(
                update.runScript(context),
                /TimeoutException/
            );
        });

        it('should reject on FAILED state', () => {
            nockCreate();
            nockStart();
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/cli/script/42')
                .reply(200, {
                    _taskState: 'FAILED'
                });
            return assert.isRejected(
                update.runScript(context),
                /failed during execution/
            );
        });

        it('should reject if too many response=400 are encountered', () => {
            nockCreate();
            nockStart();
            nockBadRequest(61);
            return assert.isRejected(
                update.runScript(context),
                /response=400/
            );
        });

        it('should retry on timeout', () => {
            nockCreate();
            nockStart();
            nockTimeout();
            return assertComplete()
                .then(() => {
                    assert.ok(nock.isDone(), `nock has pending mocks:\n${nock.pendingMocks()}`);
                });
        });

        it('should update error message if task is not found', () => {
            const expectedMsg = /Record no longer exists on BIG-IP for TMSH CLI script task \(ID: 42\)/;
            nockCreate();
            nockStart();
            nockTaskNotFound();
            return assert.isRejected(update.runScript(context), expectedMsg);
        });
    });

    describe('.submit()', () => {
        function nockWhitelist() {
            nock('http://localhost:8100')
                .get('/mgmt/tm/sys/global-settings')
                .reply(200, {
                    fileWhitelistPathPrefix: '{/usr/share/aws/} {/var/config/rest/downloads/appsvcs_update.cli}'
                });
        }

        function nockCliScript() {
            nock('http://localhost:8100')
                .post('/mgmt/shared/file-transfer/uploads/appsvcs_update.cli')
                .reply(200)
                .post('/mgmt/tm/sys/config')
                .reply(200)
                .get('/mgmt/tm/ltm/data-group/internal/~Common~__appsvcs_update')
                .reply(200, {})
                .post('/mgmt/shared/file-transfer/uploads/appsvcs_update.cli')
                .reply(200);
            sinon.stub(update, 'runScript').resolves();
        }

        it('it should upload updated WAF policy', () => {
            const updates = {
                script: '',
                whitelistFiles: [],
                iControlCalls: [
                    {
                        command: 'iControl_postFromRemote',
                        properties: {
                            get: {
                                path: 'https://192.0.2.0/mgmt/cm/asm/policy-files/download/0c32f1e4-dba5-3d17-991c-2d113478c261/14.1.0',
                                rejectUnauthorized: false,
                                method: 'GET',
                                ctype: 'application/octet-stream',
                                why: 'get asm policy exampleWAF from url',
                                authentication: {
                                    method: 'basic',
                                    username: 'example',
                                    passphrase: '$M$qZ$TmgucRCRt1QxBHeF3usk1A=='
                                }
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/exampleWAF.xml',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload asm policy exampleWAF',
                                settings: {
                                    class: 'WAF_Policy',
                                    url: 'https://192.0.2.0/mgmt/cm/asm/policy-files/download/0c32f1e4-dba5-3d17-991c-2d113478c261/14.1.0',
                                    ignoreChanges: false,
                                    enforcementMode: 'blocking'
                                }
                            }
                        }
                    }
                ]
            };
            const diff = {};
            const controls = {};
            nockWhitelist();
            nockCliScript();

            sinon.stub(secureVault, 'decrypt').resolves('decrypted');

            nock('https://192.0.2.0')
                .get('/mgmt/cm/asm/policy-files/download/0c32f1e4-dba5-3d17-991c-2d113478c261/14.1.0')
                .reply(200, '<policy><blocking><enforcement_mode>transparent</enforcement_mode></blocking></policy>');

            let uploadedFile = null;
            nock('http://localhost:8100')
                .post('/mgmt/shared/file-transfer/uploads/exampleWAF.xml')
                .reply(200, (url, body) => {
                    uploadedFile = body;
                });

            return update.submit(context, updates, diff, controls)
                .then(() => assert(uploadedFile, 'WAF policy was not uploaded'))
                .then(() => {
                    const isUpdated = uploadedFile.includes('<enforcement_mode>blocking</enforcement_mode>');
                    assert.equal(isUpdated, true, 'Waf policy was not updated');
                });
        });

        it('should upload updated WAF Policy when doing iControl_post', () => {
            const updates = {
                script: '',
                whitelistFiles: [],
                iControlCalls: [
                    {
                        command: 'iControl_post',
                        properties: {
                            reference: '/tenant/app/exampleWAF',
                            path: '/mgmt/shared/file-transfer/uploads/exampleWAF.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy exampleWAF',
                            send: '<policy><blocking><enforcement_mode>transparent</enforcement_mode></blocking></policy>',
                            settings: {
                                class: 'WAF_Policy',
                                policy: '<policy><blocking><enforcement_mode>blocking</enforcement_mode></blocking></policy>',
                                ignoreChanges: false,
                                enforcementMode: 'transparent'
                            }
                        }
                    }
                ]
            };
            const diff = {};
            const controls = {};
            nockWhitelist();
            nockCliScript();

            let uploadedFile;
            nock('http://localhost:8100')
                .post('/mgmt/shared/file-transfer/uploads/exampleWAF.xml')
                .reply(200, (url, body) => {
                    uploadedFile = body;
                });

            return update.submit(context, updates, diff, controls)
                .then(() => assert(uploadedFile, 'WAF policy was not uploaded'))
                .then(() => {
                    const isUpdated = uploadedFile.includes('<enforcement_mode>transparent</enforcement_mode>');
                    assert.equal(isUpdated, true, 'Waf policy was not updated');
                });
        });

        it('it should upload APM policy', () => {
            const updates = {
                script: '',
                whitelistFiles: [],
                iControlCalls: [
                    {
                        command: 'iControl_postFromRemote',
                        properties: {
                            get: {
                                path: 'http://192.0.2.0/profile_ITS_ap_transfer.conf.tar.gz',
                                rejectUnauthorized: true,
                                method: 'GET',
                                ctype: 'application/octet-stream',
                                why: 'get Access Profile apmExample from url'
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/apmExample.tar.gz',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload Access Profile apmExample',
                                settings: {
                                    class: 'Access_Profile',
                                    url: 'https://example.com/profile_ITS_ap_transfer.conf.tar.gz',
                                    ignoreChanges: true
                                }
                            }
                        }
                    }
                ]
            };
            const diff = {};
            const controls = {};
            nockWhitelist();
            nockCliScript();

            nock('http://192.0.2.0')
                .get('/profile_ITS_ap_transfer.conf.tar.gz')
                .reply(200, '...');

            let isUploaded = false;
            nock('http://localhost:8100')
                .post('/mgmt/shared/file-transfer/uploads/apmExample.tar.gz')
                .reply(200, () => {
                    isUploaded = true;
                });

            return update.submit(context, updates, diff, controls)
                .then(() => assert.equal(isUploaded, true, 'APM policy was not uploaded'));
        });

        it('should exit early with a dryRun response if dryRun is true', () => {
            context.tasks[0].dryRun = true;

            const updates = {
                script: '',
                whitelistFiles: [],
                iControlCalls: [
                    {
                        command: 'iControl_post',
                        properties: {
                            reference: '/tenant/app/exampleWAF',
                            path: '/mgmt/shared/file-transfer/uploads/exampleWAF.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy exampleWAF',
                            send: '<policy><blocking><enforcement_mode>transparent</enforcement_mode></blocking></policy>',
                            settings: {
                                class: 'WAF_Policy',
                                policy: '<policy><blocking><enforcement_mode>blocking</enforcement_mode></blocking></policy>',
                                ignoreChanges: false,
                                enforcementMode: 'transparent'
                            }
                        }
                    }
                ]
            };

            const diff = {
                message: 'Hi I am the diff. Can we be friends?'
            };

            sinon.stub(log, 'getGlobalSettings').returns({ logLevel: 'debug' });

            return update.submit(context, updates, diff, {})
                .then((response) => {
                    assert.deepStrictEqual(
                        response,
                        {
                            dryRun: true,
                            lineCount: 0,
                            changes: {
                                message: 'Hi I am the diff. Can we be friends?'
                            }
                        }
                    );
                });
        });

        it('should serialize file uploads if the setting says to', () => {
            config.getAllSettings.restore();
            sinon.stub(config, 'getAllSettings').resolves({
                serializeFileUploads: true
            });

            sinon.stub(promiseUtil, 'series').resolves();
            sinon.stub(Promise, 'all').rejects();

            const updates = {
                script: '',
                whitelistFiles: [],
                iControlCalls: [
                    {}
                ]
            };
            const diff = {};
            nockWhitelist();
            nockCliScript();

            return assert.isFulfilled(update.submit(context, updates, diff));
        });

        it('should not serialize file uploads if the setting says not to', () => {
            config.getAllSettings.restore();
            sinon.stub(config, 'getAllSettings').resolves({
                serializeFileUploads: false
            });

            sinon.stub(promiseUtil, 'series').rejects();
            sinon.stub(Promise, 'all').resolves();

            const updates = {
                script: '',
                whitelistFiles: [],
                iControlCalls: [
                    {}
                ]
            };
            const diff = {};
            nockWhitelist();
            nockCliScript();

            return assert.isFulfilled(update.submit(context, updates, diff));
        });
    });
});

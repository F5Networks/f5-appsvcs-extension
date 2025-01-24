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

const assert = require('assert');

const sinon = require('sinon');

const UpdaterTmsh = require('../../../src/lib/updaterTmsh');
const fetch = require('../../../src/lib/fetch');
const log = require('../../../src/lib/log');
const update = require('../../../src/lib/update');
const Context = require('../../../src/lib/context/context');

describe('UpdaterTmsh', () => {
    afterEach(() => {
        sinon.restore();
    });

    function makeUpdater(traceResponse) {
        const updater = new UpdaterTmsh(Context.build({}, {}, {}, [{ traceResponse }]), 'id');
        return updater;
    }

    describe('.tagDiff()', () => {
        it('should tag when command does not include "mgmt shared"', () => {
            const updater = makeUpdater();
            const diff = [
                {
                    command: 'ltm virtual',
                    tags: []
                },
                {
                    command: 'mgmt shared service-discovery task',
                    tags: []
                }
            ];
            updater.tagDiff(diff);
            assert.deepEqual(diff[0].tags, ['tmsh']);
            assert.deepEqual(diff[1].tags, []);
        });
    });

    describe('.update()', () => {
        // Tests should not be this stub heavy, but this class is currently
        // just duct taping together some other not well unit tested code.
        // As those files are brought under unit tests, we might be able to
        // clean this up a bit.
        it('should delegate to fetch, log, update', () => {
            let tmshUpdateScriptCalled = false;
            let writeTraceFileCalled = false;
            let submitCalled = false;

            const script = 'I am a script';
            sinon.stub(fetch, 'tmshUpdateScript').callsFake(() => {
                tmshUpdateScriptCalled = true;
                return { script };
            });

            sinon.stub(log, 'writeTraceFile').callsFake((id, type, _script) => {
                writeTraceFileCalled = true;
                assert.equal(
                    script,
                    _script,
                    'script was not passed to writeTraceFile'
                );
            });

            sinon.stub(update, 'submit').callsFake(() => {
                submitCalled = true;
            });

            const updater = makeUpdater(true);
            updater.update([], [], []);

            assert(tmshUpdateScriptCalled, 'tmshUpdateScript was not called');
            assert(writeTraceFileCalled, 'writeTraceFile was not called');
            assert(submitCalled, 'submit was not called');
        });

        it('should not add script to context.log', () => {
            const updater = makeUpdater(false);
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(fetch, 'tmshUpdateScript').callsFake(() => script);
            sinon.stub(update, 'submit').resolves();

            updater.update([], [], []);

            assert.deepEqual(updater.context.log.idScript, undefined);
        });

        it('should add script to context.log', () => {
            const updater = makeUpdater(true);
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(fetch, 'tmshUpdateScript').callsFake(() => script);
            sinon.stub(update, 'submit').resolves();

            updater.update([], [], []);

            assert.strictEqual(updater.context.log.idScript, '');
        });

        it('should show Common_1Script in Common tenant', () => {
            const updater = makeUpdater(true);
            updater.tenantId = 'Common';
            updater.context.currentIndex = 0;
            updater.context.tasks[0].traceResponse = true;
            updater.context.tasks[0].firstPassNoDelete = true;
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(fetch, 'tmshUpdateScript').callsFake(() => script);
            sinon.stub(update, 'submit').resolves();

            updater.update([], [], []);

            assert.strictEqual(updater.context.log.Common_1Script, '');
        });

        it('should show Common_2Script in Common tenant', () => {
            const updater = makeUpdater(true);
            updater.tenantId = 'Common';
            updater.context.currentIndex = 0;
            updater.context.tasks[0].traceResponse = true;
            updater.context.tasks[0].firstPassNoDelete = false;
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(fetch, 'tmshUpdateScript').callsFake(() => script);
            sinon.stub(update, 'submit').resolves();

            updater.update([], [], []);

            assert.strictEqual(updater.context.log.Common_2Script, '');
        });
    });

    describe('.postProcessUpdate()', () => {
        it('should handle post process update', () => {
            const updater = makeUpdater(true);
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(update, 'submit').resolves();
            sinon.stub(fetch, 'postProcessUpdateScript').callsFake(() => script);

            updater.postProcessUpdate();

            assert.strictEqual(updater.context.log.idScript, '');
        });

        it('should show Common_1Script in Common tenant', () => {
            const updater = makeUpdater(true);
            updater.tenantId = 'Common';
            updater.context.currentIndex = 0;
            updater.context.tasks[0].traceResponse = true;
            updater.context.tasks[0].firstPassNoDelete = true;
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(update, 'submit').resolves();
            sinon.stub(fetch, 'postProcessUpdateScript').callsFake(() => script);

            updater.postProcessUpdate();

            assert.strictEqual(updater.context.log.Common_1Script, '');
        });

        it('should show Common_2Script in Common tenant', () => {
            const updater = makeUpdater(true);
            updater.tenantId = 'Common';
            updater.context.currentIndex = 0;
            updater.context.tasks[0].traceResponse = true;
            updater.context.tasks[0].firstPassNoDelete = false;
            const script = { script: '' };

            sinon.stub(log, 'writeTraceFile').resolves();
            sinon.stub(update, 'submit').resolves();
            sinon.stub(fetch, 'postProcessUpdateScript').callsFake(() => script);

            updater.postProcessUpdate();

            assert.strictEqual(updater.context.log.Common_2Script, '');
        });

        it('should return null when there is no tenantUpdate', () => {
            const updater = makeUpdater(true);
            sinon.stub(fetch, 'postProcessUpdateScript').callsFake(() => false);

            const result = updater.postProcessUpdate();
            assert.deepStrictEqual(result, null);
        });
    });
});

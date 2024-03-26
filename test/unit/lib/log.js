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

const fs = require('fs');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const log = require('../../../src/lib/log');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('log', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('writeTraceFile', () => {
        let context;
        let spy;

        beforeEach(() => {
            spy = sinon.stub(fs, 'writeFileSync');
            context = {
                tasks: [
                    {
                        firstPassNoDelete: false
                    }
                ],
                currentIndex: 0
            };
        });

        it('should not write a trace file when globalTrace is disabled', () => Promise.resolve()
            .then(() => log.writeTraceFile('tenant', 'desired', {}, context))
            .then(() => {
                assert.isNotOk(spy.called);
            }));

        it('should write trace file', () => {
            log.updateGlobalSettings({ trace: true });
            return Promise.resolve()
                .then(() => log.writeTraceFile('tenant', 'desired', {}, context))
                .then(() => {
                    assert.ok(spy.calledOnce);
                });
        });

        it('should write the Common_1 file on the first pass of the Common partition', () => {
            context.tasks[0].firstPassNoDelete = true;
            return Promise.resolve()
                .then(() => log.writeTraceFile('Common', 'desired', {}, context))
                .then(() => {
                    assert.ok(spy.calledOnceWith('/tmp/Common_1_desired.json', {}));
                });
        });

        it('should write the Common_2 file on the second pass of the Common partition', () => Promise.resolve()
            .then(() => log.writeTraceFile('Common', 'desired', {}, context))
            .then(() => {
                assert.ok(spy.calledOnceWith('/tmp/Common_2_desired.json', {}));
            }));
    });

    describe('log', () => {
        log.updateGlobalSettings({ logLevel: 'critical' });

        it('should handle null values', () => Promise.resolve()
            .then(() => log.debug(null))
            .then((result) => {
                assert.deepStrictEqual(result, { message: '(unrecognized type null)' });
            }));

        it('should handle undefined values', () => Promise.resolve()
            .then(() => log.debug(undefined))
            .then((result) => {
                assert.deepStrictEqual(result, { message: '(undefined)' });
            }));

        it('should handle empty strings', () => Promise.resolve()
            .then(() => log.debug(''))
            .then((result) => {
                assert.deepStrictEqual(result, { message: '(empty)' });
            }));

        it('should handle empty objects', () => Promise.resolve()
            .then(() => log.debug({}))
            .then((result) => {
                assert.deepStrictEqual(result, { message: '(empty object)' });
            }));
    });
});

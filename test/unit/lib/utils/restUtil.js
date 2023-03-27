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

const assert = require('assert');
const sinon = require('sinon');
const nock = require('nock');

const restUtil = require('../../../../src/lib/util/restUtil');
const config = require('../../../../src/lib/config');
const RestOperationMock = require('../../RestOperationMock');

describe('restUtil', () => {
    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.getMultiStatusCode', () => {
        it('should return a 200, if the STATUS_CODES result in NO_CONTENT', () => {
            const results = [{ code: 204 }];

            assert.strictEqual(restUtil.getMultiStatusCode(results), 200);
        });
    });

    describe('.completeRequestMultiStatus', () => {
        it('should properly configure the restOperation', () => {
            const restOp = new RestOperationMock();
            const results = [{
                code: 200,
                body: { foo: 'bar' }
            },
            {
                code: 500
            }];

            restUtil.completeRequestMultiStatus(restOp, results, true);
            restOp.complete();
            assert.deepStrictEqual(restOp.body, {
                code: 207,
                items: [
                    { foo: 'bar' },
                    {
                        code: 500,
                        message: { code: 500 }
                    }
                ]
            });
            assert.deepStrictEqual(restOp.statusCode, 207);
        });
    });

    describe('.checkWebhook', () => {
        beforeEach(() => {
            sinon.stub(config, 'getAllSettings').resolves(
                {
                    webhook: 'http://www.example.com/webhook'
                }
            );

            nock('http://www.example.com')
                .post('/webhook')
                .reply(200);
        });

        it('should call the webhook for POST requests', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Post';
            const results = {};

            restUtil.checkWebhook(restOp, results);
            setImmediate(() => {
                assert.ok(nock.isDone());
            });
        });

        it('should not call the webhook for non-POST requests', () => {
            const restOp = new RestOperationMock();
            restOp.method = 'Get';
            const results = {};

            restUtil.checkWebhook(restOp, results);
            setImmediate(() => {
                assert.ok(!nock.isDone());
            });
        });
    });
});

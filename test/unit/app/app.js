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
const proxyquire = require('proxyquire');
const RestWorker = require('../../../src/nodejs/restWorker');

describe('app', function () {
    this.timeout(10000);
    let app;
    let spyUse;
    let spyGet;
    let spyPost;
    beforeEach(() => {
        spyUse = sinon.spy();
        spyGet = sinon.spy();
        spyPost = sinon.spy();
        const expressMock = {
            use: spyUse,
            get: spyGet,
            post: spyPost
        };
        const stubExpress = sinon.stub().returns(expressMock);
        app = proxyquire('../../../src/app/app.js', {
            express: stubExpress
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should register routes if onStartCompleted succeeds', () => {
        sinon.stub(RestWorker.prototype, 'onStartCompleted').callsArg(0);
        app.start();
        assert.ok(spyGet.calledOnce);
        assert.ok(spyPost.calledOnce);
    });

    it('should not setup routes if onStartCompleted fails', () => {
        let loggedMessage;
        sinon.stub(RestWorker.prototype, 'onStartCompleted').callsArg(1);
        sinon.stub(console, 'log').callsFake((message) => {
            loggedMessage = message;
        });
        app.start();
        console.log.restore();
        assert.ok(spyGet.notCalled);
        assert.ok(spyPost.notCalled);
        assert.ok(loggedMessage.startsWith('Unable to start'));
    });
});

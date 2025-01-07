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
const net = require('net');
const sinon = require('sinon');
const nock = require('nock');
const url = require('url');
const fs = require('fs');
const childProcess = require('child_process');
const proxyquire = require('proxyquire');
const SocketMock = require('../../SocketMock');
const log = require('../../../../src/lib/log');
const Context = require('../../../../src/lib/context/context');

const execFileStub = sinon.stub(childProcess, 'execFile');
const util = proxyquire('../../../../src/lib/util/util', { child_process: { execFile: execFileStub } });

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('util', () => {
    let context;

    beforeEach(() => {
        context = Context.build();
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.getDeviceInfo', () => {
        it('should get deviceInfo', () => {
            const body = JSON.stringify({ foo: 'bar' });
            sinon.stub(util, 'httpRequest').resolves(
                {
                    statusCode: 200,
                    body
                }
            );

            return util.getDeviceInfo()
                .then((response) => {
                    assert.deepStrictEqual(response, { foo: 'bar' });
                });
        });

        it('should retry on failure', () => {
            const body = JSON.stringify({ foo: 'bar' });
            const spy = sinon.stub(util, 'httpRequest')
                .onFirstCall()
                .rejects()
                .onSecondCall()
                .resolves(
                    {
                        statusCode: 200,
                        body
                    }
                );

            return util.getDeviceInfo()
                .then((response) => {
                    assert.isTrue(spy.calledTwice);
                    assert.deepStrictEqual(response, { foo: 'bar' });
                });
        });

        it('should retry on bad status', () => {
            const body = JSON.stringify({ foo: 'bar' });
            const spy = sinon.stub(util, 'httpRequest')
                .onFirstCall()
                .resolves(
                    {
                        statusCode: 400
                    }
                )
                .onSecondCall()
                .resolves(
                    {
                        statusCode: 200,
                        body
                    }
                );

            return util.getDeviceInfo()
                .then((response) => {
                    assert.isTrue(spy.calledTwice);
                    assert.deepStrictEqual(response, { foo: 'bar' });
                });
        });
    });

    describe('.getMgmtPort', () => {
        function createSocketMock(ports, eventObj, cb) {
            sinon.stub(net, 'createConnection').callsFake((port, host, callback) => {
                const socketMock = new SocketMock(port, host);
                socketMock.on('connect', callback);
                if (ports[port]) {
                    setTimeout(() => {
                        socketMock.triggerConnect();
                    }, 5);
                    socketMock.onEnd(() => {
                        eventObj[port].onEndCalled = true;
                    });
                } else {
                    setTimeout(() => {
                        socketMock.triggerError(new Error('connect ECONNREFUSED'));
                    }, 1);
                    socketMock.onDestroy(() => {
                        eventObj[port].onDestroyCalled = true;
                        cb();
                    });
                }
                return socketMock;
            });
        }

        it('should discover port 443', (done) => {
            const eventObj = {
                443: {
                    onEndCalled: false,
                    onDestroyCalled: false
                },
                8443: {
                    onEndCalled: false,
                    onDestroyCalled: false
                }
            };

            const callback = () => {
                if (eventObj[443].onEndCalled && eventObj[8443].onDestroyCalled) {
                    done();
                }
            };

            createSocketMock({
                443: true,
                8443: false
            }, eventObj, callback);

            sinon.stub(log, 'error').callsFake(() => {
                assert.fail('Promise should not reject');
            });

            util.getMgmtPort('localhost')
                .then((port) => {
                    assert.strictEqual(port, 443);
                    assert.strictEqual(
                        eventObj[443].onEndCalled,
                        true,
                        'socket.end was not called on port 443'
                    );
                    assert.strictEqual(
                        eventObj[8443].onDestroyCalled,
                        true,
                        'socket.destroy was not called on port 8443'
                    );
                    callback();
                });
        });

        it('should discover port 8443', (done) => {
            const eventObj = {
                443: {
                    onEndCalled: false,
                    onDestroyCalled: false
                },
                8443: {
                    onEndCalled: false,
                    onDestroyCalled: false
                }
            };

            const callback = () => {
                if (eventObj[8443].onEndCalled && eventObj[443].onDestroyCalled) {
                    done();
                }
            };

            createSocketMock({
                443: false,
                8443: true
            }, eventObj, callback);

            sinon.stub(log, 'error').callsFake(() => {
                assert.fail('Promise should not reject');
            });

            util.getMgmtPort('localhost')
                .then((port) => {
                    assert.strictEqual(port, 8443);
                    assert.strictEqual(
                        eventObj[8443].onEndCalled,
                        true,
                        'socket.end was not called on port 8443'
                    );
                    assert.strictEqual(
                        eventObj[443].onDestroyCalled,
                        true,
                        'socket.destroy was not called on port 443'
                    );
                    callback();
                });
        });

        it('should log an error if both ports are rejected', () => {
            const eventObj = {
                443: {
                    onEndCalled: false,
                    onDestroyCalled: false
                },
                8443: {
                    onEndCalled: false,
                    onDestroyCalled: false
                }
            };

            createSocketMock({
                443: false,
                8443: false
            }, eventObj, () => null);

            const errors = [];
            sinon.stub(log, 'error').callsFake((e) => {
                errors.push(e);
            });

            return util.getMgmtPort('localhost')
                .then((port) => {
                    const expectedError = 'Could not determine device port';
                    assert(
                        errors.indexOf(expectedError) > -1,
                        `"${expectedError}" was not found in the logs`
                    );

                    assert.strictEqual(port, undefined);
                    assert.strictEqual(
                        eventObj[443].onEndCalled,
                        false,
                        'socket.end was called on port 443'
                    );
                    assert.strictEqual(
                        eventObj[443].onDestroyCalled,
                        true,
                        'socket.destroy was not called on port 443'
                    );
                    assert.strictEqual(
                        eventObj[8443].onEndCalled,
                        false,
                        'socket.end was called on port 443'
                    );
                    assert.strictEqual(
                        eventObj[8443].onDestroyCalled,
                        true,
                        'socket.destroy was not called on port 8443'
                    );
                });
        });
    });

    describe('.simpleCopy', () => {
        it('should return an undefined, when stringify errors', () => {
            const a = {};
            const b = { a };
            a.b = b;

            const test = util.simpleCopy(a);
            assert.strictEqual(test, undefined);
        });

        it('should return an undefined, when nothing is sent in', () => {
            assert.strictEqual(util.simpleCopy(), undefined);
        });

        it('should return a copy of the object', () => {
            const a = [];
            a.push('foo');

            const test = util.simpleCopy(a);
            a.push('bar');

            assert.strictEqual(test.length, 1);
            assert.strictEqual(a.length, 2);
        });
    });

    describe('.toCamelCase', () => {
        // TODO currently we do not confirm bad input

        it('should make a string into camelCase', () => {
            assert.strictEqual(util.toCamelCase('funky-monkey-moNey'), 'funkyMonkeyMoNey');
        });
    });

    describe('.wrapStringWithSpaces', () => {
        it('should wrap a string containing a space', () => {
            assert.strictEqual(util.wrapStringWithSpaces('wrap me'), '"wrap me"');
        });

        it('should not wrap a string that does not contain a space', () => {
            assert.strictEqual(util.wrapStringWithSpaces('dontwrapme'), 'dontwrapme');
        });
    });

    describe('.fromBase64', () => {
        // TODO currently we do not confirm bad input
        // .fromBase64 does not work in node 4.2

        it('should return an empty buffer when nothing is sent in', () => {
            const buffer = util.fromBase64('');

            assert.strictEqual(buffer.constructor.name, 'Buffer');
            assert.strictEqual(buffer.length, 0);
        });

        it('should return a string when a base64 encoded string is sent in', () => {
            const buffer = util.fromBase64('Rm9vIGJhcg==');

            assert.strictEqual(buffer.toString(), 'Foo bar');
        });
    });

    describe('.base64Encode', () => {
        // TODO currently we do not confirm bad input

        it('should return an empty string when an empty string is sent in', () => {
            const str = util.base64Encode('');
            assert.strictEqual(str, '');
        });

        it('should return a base64 encoded string when a string is sent in', () => {
            const str = util.base64Encode('Foo bar');
            assert.strictEqual(str, 'Rm9vIGJhcg==');
        });
    });

    describe('.base64Decode', () => {
        // TODO currently we do not confirm bad input

        it('should return an empty string when an empty string is sent in', () => {
            const str = util.base64Decode('');
            assert.strictEqual(str, '');
        });

        it('should return a string when a base64 encoded string is sent in', () => {
            const str = util.base64Decode('Rm9vIGJhcg==');
            assert.strictEqual(str, 'Foo bar');
        });
    });

    describe('.httpRequest', () => {
        beforeEach(() => {
            sinon.stub(log, 'error');
        });

        it('should follow redirects by default', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(301, undefined, { location: 'https://www.as3fakeserver.com' });
            nock('https://www.as3fakeserver.com')
                .get('/')
                .reply(200, { result: 'redirect success' }, { 'Content-Type': 'application-json' });

            const reqOpts = {
                why: 'test GET remote with redirect',
                method: 'GET',
                crude: true
            };
            return util.httpRequest('http://www.as3fakeserver.com', reqOpts)
                .then((response) => {
                    assert.strictEqual(response.location, undefined);
                    assert.strictEqual(response.statusCode, 200);
                    assert.strictEqual(JSON.parse(response.body).result, 'redirect success');
                });
        });

        it('should reject if no url is provided',
            () => assert.isRejected(util.httpRequest())
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message, 'httpRequest(): url string required');
                }));

        it('should reject if url cannot be parsed', () => {
            sinon.stub(url, 'parse').throws(new Error('test error'));

            return assert.isRejected(util.httpRequest('as3fakeserver', { why: 'test parsing' }))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message, 'cannot parse url as3fakeserver test parsing (test error)');
                });
        });

        it('should reject if parsed url is missing host', () => assert.isRejected(
            util.httpRequest('as3fakeserver', { why: 'test missing host' })
        ).then((e) => {
            assert.strictEqual(e.code, 400);
            assert.strictEqual(e.message, 'url as3fakeserver test missing host must include host');
        }));

        it('should reject if protocol is not http(s)', () => assert.isRejected(
            util.httpRequest('ssh://as3fakeserver', { why: 'test bad protocol' })
        ).then((e) => {
            assert.strictEqual(e.code, 400);
            assert.strictEqual(e.message, 'url ssh://as3fakeserver test bad protocol protocol must be http(s)');
        }));

        it('should support retry503 option', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(503, {})
                .get('/')
                .reply(200, { result: 'retry success' }, { 'Content-Type': 'application-json' });

            const reqOpts = {
                retry503: 0.1,
                crude: true
            };

            return util.httpRequest('http://www.as3fakeserver.com', reqOpts)
                .then((response) => {
                    assert.strictEqual(response.location, undefined);
                    assert.strictEqual(response.statusCode, 200);
                    assert.strictEqual(JSON.parse(response.body).result, 'retry success');
                });
        });

        it('should support retry-after header with retry503 option', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(() => {
                    // Verifies that the retry-after header is honored by waiting until the retry
                    // setTimeout is configured and then setting the clock ahead by 2.5 seconds.
                    // If the original retry503 option of 120 seconds was still being used,
                    // the test would time out and fail.
                    const origSetTimeout = setTimeout;
                    const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
                    origSetTimeout(() => {
                        clock.tick(2500);
                        clock.restore();
                    }, 10);
                    return [503, undefined, { 'retry-after': 2 }];
                })
                .get('/')
                .reply(200, { result: 'retry success' });

            const reqOpts = {
                retry503: 120,
                crude: true
            };

            return util.httpRequest('http://www.as3fakeserver.com', reqOpts)
                .then((response) => {
                    assert.strictEqual(response.location, undefined);
                    assert.strictEqual(response.statusCode, 200);
                    assert.strictEqual(JSON.parse(response.body).result, 'retry success');
                });
        });

        it('should reject if too many redirects', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(301, undefined, { location: 'https://www.as3fakeserver.com' });

            const reqOpts = {
                why: 'test exceeding maxRedirects',
                method: 'GET',
                crude: true,
                maxRedirects: 0
            };
            return assert.isRejected(util.httpRequest('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        'got unwanted redirect test exceeding maxRedirects from www.as3fakeserver.com');
                });
        });

        it('should reject if bad redirect', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(301, undefined, { location: {} });

            const reqOpts = {
                why: 'test bad redirect',
                method: 'GET',
                crude: true
            };
            let err = null;
            try {
                url.parse({});
            } catch (e) {
                err = e;
            }

            return assert.isRejected(util.httpRequest('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        `got invalid redirect location test bad redirect from www.as3fakeserver.com (${err.message})`);
                });
        });

        it('should reject if redirect location protocol is not http(s)', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(301, undefined, { location: 'ssh://as3fakeserver' });

            const reqOpts = {
                why: 'test bad redirect protocol',
                method: 'GET',
                crude: true
            };

            return assert.isRejected(util.httpRequest('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        'got non-http(s) redirect test bad redirect protocol from www.as3fakeserver.com');
                });
        });

        it('should reject if failure after retrying on net error', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .times(4)
                .replyWithError('test error');

            const reqOpts = {
                why: 'test retryNetError rejecting',
                method: 'GET',
                crude: true,
                retryNetErrorDelay: 0
            };

            return assert.isRejected(util.httpRequest('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.message,
                        'GET http://www.as3fakeserver.com test retryNetError rejecting failed (test error)');
                });
        });

        it('should resolve if success after retrying on net error', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .replyWithError('test error')
                .get('/')
                .reply(200, { result: 'retry success' });

            const reqOpts = {
                why: 'test retryNetError resolving',
                method: 'GET',
                crude: true,
                retryNetError: 1,
                retryNetErrorDelay: 0
            };

            return util.httpRequest('http://www.as3fakeserver.com', reqOpts)
                .then((response) => {
                    assert.strictEqual(response.statusCode, 200);
                    assert.strictEqual(JSON.parse(response.body).result, 'retry success');
                });
        });

        it('should support disabling retryNetError', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .replyWithError('test error');

            const reqOpts = {
                why: 'test retryNetError disabled',
                method: 'GET',
                crude: true,
                retryNetError: 0
            };

            return assert.isRejected(util.httpRequest('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.message,
                        'GET http://www.as3fakeserver.com test retryNetError disabled failed (test error)');
                });
        });
    });

    describe('loadJSON', () => {
        it('should reject if no source is provided',
            () => assert.isRejected(util.loadJSON())
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message, 'source required as first argument');
                }));

        it('should reject if source cannot be parsed', () => {
            sinon.stub(url, 'parse').throws(new Error('test error'));

            const reqOpts = { why: 'test source parse error' };
            return assert.isRejected(util.loadJSON('as3fakeserver', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        'cannot parse source/URL as3fakeserver test source parse error (test error)');
                });
        });

        it('should reject if bad protocol', () => {
            const reqOpts = { why: 'test bad protocol' };
            return assert.isRejected(util.loadJSON('ssh://as3fakeserver', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message, 'url test bad protocol protocol must be http(s): or file:');
                });
        });

        it('should reject if fails to load file', () => {
            sinon.stub(fs, 'readFileSync').throws(new Error('test error'));

            const reqOpts = { why: 'test load file failure' };
            return assert.isRejected(util.loadJSON('file:///badFile', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        'failed to load JSON from file /badFile test load file failure (test error)');
                });
        });

        it('should reject if cannot parse JSON from file', () => {
            sinon.stub(fs, 'readFileSync').returns('');

            const reqOpts = { why: 'test bad JSON from file' };
            let err = null;
            try {
                JSON.parse('');
            } catch (e) {
                err = e;
            }

            return assert.isRejected(util.loadJSON('file:///badFile', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        `could not parse JSON from file /badFile test bad JSON from file (${err.message})`);
                });
        });

        it('should resolve with JSON from file', () => {
            sinon.stub(fs, 'readFileSync').returns('{ "foo": "bar" }');
            return assert.becomes(util.loadJSON('file:///goodFile'), { foo: 'bar' });
        });

        it('should reject if fails to fetch JSON from server', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(500);

            const reqOpts = { why: 'test fetch server failure' };

            return assert.isRejected(util.loadJSON('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        'failed to load JSON from url http://www.as3fakeserver.com test fetch server failure '
                        + '(GET http://www.as3fakeserver.com test fetch server failure response=500 body=)');
                });
        });

        it('should reject if cannot parse JSON from server', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(200, '');

            const reqOpts = { why: 'test bad JSON from server' };

            let err = null;
            try {
                JSON.parse('');
            } catch (e) {
                err = e;
            }

            return assert.isRejected(util.loadJSON('http://www.as3fakeserver.com', reqOpts))
                .then((e) => {
                    assert.strictEqual(e.code, 400);
                    assert.strictEqual(e.message,
                        `could not parse JSON from url http://www.as3fakeserver.com test bad JSON from server (${err.message})`);
                });
        });

        it('should resolve with JSON from server', () => {
            nock('http://www.as3fakeserver.com')
                .get('/')
                .reply(200, '{ "foo": "bar" }');

            return assert.becomes(util.loadJSON('http://www.as3fakeserver.com'), { foo: 'bar' });
        });
    });

    describe('.iControlRequest', () => {
        let actualReqOpts;
        let controls;

        before(() => nock.cleanAll());

        beforeEach('disable logging', () => {
            sinon.stub(log, 'warning');
            controls = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                tokens: {
                    'X-F5-Auth-Token': 'validtoken'
                }
            };
        });

        afterEach(() => {
            sinon.restore();
            nock.cleanAll();
        });

        const options = {
            path: '/',
            method: 'GET',
            crude: true
        };

        it('should use X-F5-Auth-Token when token exists and not port 8100', () => {
            sinon.stub(util, 'httpRequest').callsFake((reqUrl, reqOpts) => {
                actualReqOpts = reqOpts;
                return Promise.resolve(actualReqOpts);
            });
            context.tasks = [
                {
                    targetTokens: { 'X-F5-Auth-Token': 'validtoken' }
                }
            ];
            context.control = {
                port: 10001,
                targetPort: 10001
            };
            return util.iControlRequest(context, options)
                .then(() => {
                    assert.deepStrictEqual(actualReqOpts.tokens, { 'X-F5-Auth-Token': 'validtoken' });
                });
        });

        it('should use X-F5-Auth-Token when token exists and is a bigiq url', () => {
            sinon.stub(util, 'httpRequest').callsFake((reqUrl, reqOpts) => {
                actualReqOpts = reqOpts;
                return Promise.resolve(actualReqOpts);
            });
            // test to confirm target is used instead of request
            context.target = {
                tokens: { 'X-F5-Auth-Token': 'validtoken' }
            };
            context.tasks = [
                {
                    targetTokens: { 'X-F5-Auth-Token': '123' },
                    urlPrefix: 'http://mgmt/cm/global'
                }
            ];
            context.control = {
                port: 8100,
                targetPort: 8100
            };
            return util.iControlRequest(context, options)
                .then(() => {
                    assert.deepStrictEqual(actualReqOpts.tokens, { 'X-F5-Auth-Token': 'validtoken' });
                });
        });

        it('should not use X-F5-Auth-Token when port is 8100', () => {
            sinon.stub(util, 'httpRequest').callsFake((reqUrl, reqOpts) => {
                actualReqOpts = reqOpts;
                return Promise.resolve(actualReqOpts);
            });
            context.target = {
                tokens: { 'X-F5-Auth-Token': 'validtoken' }
            };
            context.tasks = [
                {
                    targetTokens: { 'X-F5-Auth-Token': '123' }
                }
            ];
            context.control = {
                port: 8100,
                targetPort: 8100
            };
            return util.iControlRequest(context, options)
                .then(() => {
                    assert.deepStrictEqual(actualReqOpts.tokens, undefined);
                });
        });

        it('should only use basic auth when token does not exist', () => {
            sinon.stub(util, 'httpRequest').callsFake((reqUrl, reqOpts) => {
                actualReqOpts = reqOpts;
                return Promise.resolve(actualReqOpts);
            });
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                port: 8888,
                targetPort: 8888
            };
            delete controls.tokens['X-F5-Auth-Token'];
            return util.iControlRequest(context, options)
                .then(() => {
                    assert.deepStrictEqual(actualReqOpts.tokens, undefined);
                });
        });

        it('should reject when invalid json', () => {
            nock('https://www.as3fakeserver2.com')
                .get('/')
                .reply(200, 'something');
            context.tasks = [
                {
                    urlPrefix: 'https://www.as3fakeserver2.com'
                }
            ];
            options.crude = false;
            return assert.isRejected(util.iControlRequest(context, options), /cannot parse/, 'Should reject when invalid json');
        });

        it('should return 400 when endpoint not there', () => {
            nock('https://www.as3fakeserver2.com')
                .get('/')
                .reply(400, { message: 'Found unexpected URI tmapi_mapper/.' });
            context.tasks = [
                {
                    urlPrefix: 'https://www.as3fakeserver2.com'
                }
            ];

            assert.isRejected(util.iControlRequest(context, options), 'Found unexpected URI tmapi_mapper/.');
        });

        it('should reject if initialControls not provided', () => assert.isRejected(
            util.iControlRequest(),
            /argument context required/,
            'Should reject with missing argument'
        ));

        it('should reject if options.path not provided', () => assert.isRejected(
            util.iControlRequest({}, {}),
            /options.path required/,
            'Should reject with missing argument'
        ));
    });

    describe('.executeBashCommand', () => {
        it('should return results from bash endpoint', () => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };

            nock('http://localhost:8100')
                .post('/mgmt/tm/util/bash')
                .reply(200, { commandResult: 'foo, bar' });

            return assert.becomes(util.executeBashCommand(context, 'ls'), 'foo, bar');
        });
    });

    describe('.executeBashCommandExec', () => {
        it('should successfully split the command up, use execfile if the command is successful', () => {
            execFileStub.callsFake((cmd, argArray, callback) => {
                assert.strictEqual(cmd, 'ls');
                assert.deepStrictEqual(argArray, ['-a', '-l']);
                callback(null, 'foo, bar');
            });

            return util.executeBashCommandExec('ls -a -l')
                .then((results) => {
                    assert.strictEqual(results, 'foo, bar');
                });
        });

        it('should split the command up, use execfile but handle an Error case', () => {
            execFileStub.callsFake((cmd, argArray, callback) => {
                assert.strictEqual(cmd, 'ls');
                assert.deepStrictEqual(argArray, ['-a', '-l']);
                callback(new Error('Something went wrong'));
            });

            return assert.isRejected(util.executeBashCommandExec('ls -a -l'), /Something went wrong/);
        });
    });

    describe('.getNodelist', () => {
        it('should return list of nodes', () => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/node?options=recursive')
                .reply(200, {
                    items: [
                        {
                            name: 'node-as3fakeserver',
                            fullPath: '/Common/node-as3fakeserver',
                            partition: 'Common',
                            ephemeral: 'false',
                            metadata: 'world',
                            fqdn: {
                                tmName: 'as3fakeserver'
                            }
                        },
                        {
                            fullPath: '/Common/Shared/testNode',
                            partition: 'Common',
                            subPath: 'Shared',
                            metadata: 'testing /Common/Shared',
                            address: '192.0.2.20'
                        },
                        {
                            fullPath: '/tenant/app/foo',
                            partition: 'tenant',
                            ephemeral: 'true',
                            metadata: 'hello',
                            address: '192.0.2.8'
                        }
                    ]
                });

            return assert.becomes(
                util.getNodelist(context),
                [
                    {
                        fullPath: '/Common/Shared/testNode',
                        partition: 'Common',
                        ephemeral: false,
                        metadata: 'testing /Common/Shared',
                        domain: '',
                        key: '192.0.2.20',
                        commonNode: false
                    },
                    {
                        fullPath: '/tenant/app/foo',
                        partition: 'tenant',
                        ephemeral: true,
                        metadata: 'hello',
                        domain: '',
                        key: '192.0.2.8',
                        commonNode: false
                    },
                    {
                        name: 'node-as3fakeserver',
                        fullPath: '/Common/node-as3fakeserver',
                        partition: 'Common',
                        ephemeral: false,
                        fqdn: {
                            tmName: 'as3fakeserver'
                        },
                        metadata: 'world',
                        domain: 'as3fakeserver',
                        commonNode: true,
                        key: 'node-as3fakeserver'
                    }
                ]
            );
        });

        it('should return empty list if response missing items', () => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/node?options=recursive')
                .reply(200, {});

            return assert.becomes(util.getNodelist(context), []);
        });
    });

    describe('.getVersionOfAS3', () => {
        it('should reject if version file can NOT be found', () => {
            sinon.stub(fs, 'readFile').callsArgWith(2, new Error('Can NOT find file'));
            return assert.isRejected(
                util.getVersionOfAS3(),
                /Can NOT find file/,
                'Should reject when can NOT find file'
            );
        });

        it('should get AS3 version from version file', () => {
            sinon.stub(fs, 'readFile').callsArgWith(2, null, '3.17.0-3');
            return assert.becomes(util.getVersionOfAS3(), { version: '3.17.0', release: '3' });
        });
    });

    describe('.binarySearch', () => {
        let array;
        let targetVal;
        let search;

        beforeEach(() => {
            // eslint-disable-next-line prefer-spread
            array = Array.apply(null, { length: 100 }).map(Function.call, Number);
            search = (x) => targetVal - x;
        });

        it('should return index of target value', () => {
            targetVal = 64;
            assert.strictEqual(
                util.binarySearch(array, search), 64, ' Should have found value 64 at index 64'
            );
        });

        it('should return -1 if target value not found', () => {
            targetVal = 101;
            assert.strictEqual(
                util.binarySearch(array, search), -1, ' Should have not found value 101'
            );
        });
    });

    describe('.formatAjvErr()', () => {
        let err;

        beforeEach(() => {
            err = {
                dataPath: '/my/data/path',
                message: 'My error'
            };
        });

        it('should prepend dataPath when it exists', () => {
            err.keyword = 'f5PostProcess';
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: My error');
        });

        it('should prepend generic message when dataPath is missing', () => {
            err.keyword = 'f5PostProcess';
            delete err.dataPath;
            assert.deepStrictEqual(util.formatAjvErr(err), 'unknown data path: My error');
        });

        it('should add data to error message on "pattern" case', () => {
            err.keyword = 'pattern';
            err.data = 'foo bar';
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: data "foo bar" My error');
        });

        it('should add allowedValues to error message on "enum" case', () => {
            err.keyword = 'enum';
            err.params = { allowedValues: ['foo', 'bar'] };
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: My error ["foo","bar"]');
        });

        it('should add allowedValues to error message on "const" case', () => {
            err.keyword = 'const';
            err.params = { allowedValue: 'foo' };
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: My error "foo"');
        });

        it('should add allowedValues to error message on "not" case', () => {
            err.keyword = 'not';
            err.schemaPath = '/my/schema/path';
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: schema is NOT valid');
        });

        it('should not add allowedValues to error message on "not" case if root path', () => {
            err.keyword = 'not';
            err.schemaPath = 'root';
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: My error');
        });

        it('should handle missing keyword', () => {
            assert.deepStrictEqual(util.formatAjvErr(err), '/my/data/path: My error');
        });
    });

    describe('.arrToObj', () => {
        let obj;

        beforeEach(() => {
            obj = { propArr: ['foo', 'bar'] };
        });

        it('should skip and return object if property name does not exist', () => {
            const expected = JSON.parse(JSON.stringify(obj));
            assert.deepStrictEqual(util.arrToObj(obj, 'foo'), expected);
        });

        it('should skip and return object if property is not an array', () => {
            obj.propArr = {};
            const expected = JSON.parse(JSON.stringify(obj));
            assert.deepStrictEqual(util.arrToObj(obj, 'propArr'), expected);
        });

        it('should skip and return object if array is empty', () => {
            obj.propArr = [];
            const expected = JSON.parse(JSON.stringify(obj));
            assert.deepStrictEqual(util.arrToObj(obj, 'propArr'), expected);
        });

        it('should convert array to object', () => {
            const expected = {
                propArr: {
                    foo: {},
                    bar: {}
                }
            };
            assert.deepStrictEqual(util.arrToObj(obj, 'propArr'), expected);
        });
    });

    describe('.objToArr', () => {
        let obj;

        beforeEach(() => {
            obj = {
                propObj: {
                    propOne: 'foo',
                    propTwo: 'bar'
                }
            };
        });

        it('should skip and return object if property name does not exist', () => {
            const expected = JSON.parse(JSON.stringify(obj));
            assert.deepStrictEqual(util.objToArr(obj, 'foo'), expected);
        });

        it('should skip and return object if property is not an object', () => {
            obj.propObj = ['foo', 'bar'];
            const expected = JSON.parse(JSON.stringify(obj));
            assert.deepStrictEqual(util.objToArr(obj, 'propObj'), expected);
        });

        it('should skip and return object if object is null', () => {
            obj.propObj = null;
            const expected = JSON.parse(JSON.stringify(obj));
            assert.deepStrictEqual(util.objToArr(obj, 'propObj'), expected);
        });

        it('should convert object to array', () => {
            const expected = { propObj: ['foo', 'bar'] };
            assert.deepStrictEqual(util.objToArr(obj, 'propObj'), expected);
        });
    });

    describe('.versionLessThan', () => {
        let errMsg;

        beforeEach(() => {
            errMsg = '';
            sinon.stub(log, 'error').callsFake((e) => {
                errMsg = e;
            });
        });

        const assertLogError = () => {
            assert.strictEqual(
                errMsg,
                'Values passed to versionLessThan must be strings with numbers and periods only!'
            );
        };

        it('should return null if v1 is not a string', () => {
            assert.strictEqual(util.versionLessThan(123, '3.2.1'), null);
            assertLogError();
        });

        it('should return null if v2 is not a string', () => {
            assert.strictEqual(util.versionLessThan('1.2.3', 321), null);
            assertLogError();
        });

        it('should return null if v1 does not match version regex', () => {
            assert.strictEqual(util.versionLessThan('foo', '3.2.1'), null);
            assertLogError();
        });

        it('should return null if v2 does not match version regex', () => {
            assert.strictEqual(util.versionLessThan('1.2.3', 'foo'), null);
            assertLogError();
        });

        it('should return true if v1 is less than v2', () => {
            assert.strictEqual(util.versionLessThan('1.2.3', '3.2.1'), true);
        });

        it('should return false if v1 is greater than v2', () => {
            assert.strictEqual(util.versionLessThan('3.2.1', '1.2.3'), false);
        });

        it('should return false if v1 is equal to v2', () => {
            assert.strictEqual(util.versionLessThan('1.2.3', '1.2.3'), false);
        });
    });

    describe('.versionLessThanRecurse', () => {
        it('should return true if v2 has a longer value that is greater than zero', () => {
            assert.strictEqual(util.versionLessThanRecurse([1, 2], [1, 2, 0, 3], 2), true);
        });

        it('should return false if v1 has a longer value that is greater than zero', () => {
            assert.strictEqual(util.versionLessThanRecurse([1, 2, 0, 3], [1, 2], 2), false);
        });
    });

    describe('.getRegkey()', () => {
        it('should return regkey', () => {
            const regkey = 'G2660-92937-27573-46927-3206394';
            nock('http://localhost:8100')
                .get('/tm/sys/license')
                .reply(
                    200,
                    {
                        kind: 'tm:sys:license:licensestats',
                        selfLink: 'https://localhost/mgmt/tm/sys/license?ver=13.1.1',
                        entries: {
                            'https://localhost/mgmt/tm/sys/license/0': {
                                nestedStats: {
                                    entries: {
                                        registrationKey: {
                                            description: regkey
                                        }
                                    }
                                }
                            }
                        }
                    }
                );
            context.tasks.push({ protocol: 'http', urlPrefix: 'http://localhost:8100' });
            return assert.becomes(util.getRegkey(context), regkey);
        });
    });

    describe('getTargetTokens()', () => {
        it('should return {} if not context supplied', () => assert.deepEqual(
            util.getTargetTokens(), {}
        ));

        it('should return {} if no context.target.tokens and no index', () => {
            context.tasks = [
                {
                    targetTokens: { 'X-F5-Auth-Token': '12345' }
                }
            ];
            return assert.deepEqual(util.getTargetTokens(context), {});
        });

        it('should return target tokens if there is a context.target.tokens', () => {
            context.target = {
                tokens: { pick: 'me!' }
            };
            context.tasks = [
                {
                    targetTokens: { 'X-F5-Auth-Token': '12345' }
                }
            ];
            return assert.deepEqual(util.getTargetTokens(context), { pick: 'me!' });
        });

        it('should return targetTokens from context.tasks if there is no context.target.tokens', () => {
            context.tasks = [
                {
                    targetTokens: { 'X-F5-Auth-Token': '12345' }
                }
            ];
            return assert.deepEqual(util.getTargetTokens(context, 0), { 'X-F5-Auth-Token': '12345' });
        });
    });

    describe('updateControlsWithDecl()', () => {
        it('should add to controls from decl', () => {
            const controls = {
                prop1: 'hello'
            };
            const decl = {
                trace: true,
                logLevel: 'debug'
            };
            util.updateControlsWithDecl(controls, decl);
            assert.deepEqual(
                controls,
                {
                    prop1: 'hello',
                    trace: true,
                    logLevel: 'debug'
                }
            );
        });

        it('should update controls values if they are already present', () => {
            const controls = {
                prop1: 'hello',
                trace: true
            };
            const decl = {
                trace: false
            };
            util.updateControlsWithDecl(controls, decl);
            assert.deepEqual(
                controls,
                {
                    prop1: 'hello',
                    trace: false
                }
            );
        });

        it('should not add class key from declaration', () => {
            const controls = {
                key: 'value'
            };
            const decl = {
                class: 'Controls'
            };
            util.updateControlsWithDecl(controls, decl);
            assert.deepEqual(
                controls,
                {
                    key: 'value'
                }
            );
        });

        it('should not change if declaration is not an object', () => {
            const controls = {
                prop1: 'value'
            };
            const decl = 'stringValue';
            util.updateControlsWithDecl(controls, decl);
            assert.deepEqual(
                controls,
                {
                    prop1: 'value'
                }
            );
        });

        it('should update with queryParamControls', () => {
            const controls = {
                queryParamControls: {
                    dryRun: true,
                    logLevel: 'debug',
                    trace: true,
                    traceResponse: true,
                    userAgent: 'theUserAgent'
                }
            };
            const decl = {
                dryRun: false,
                logLevel: 'warning',
                trace: false,
                traceResponse: false,
                userAgent: false
            };
            util.updateControlsWithDecl(controls, decl);
            assert.deepStrictEqual(
                controls,
                {
                    queryParamControls: {
                        dryRun: true,
                        logLevel: 'debug',
                        trace: true,
                        traceResponse: true,
                        userAgent: 'theUserAgent'
                    },
                    dryRun: true,
                    logLevel: 'debug',
                    trace: true,
                    traceResponse: true,
                    userAgent: 'theUserAgent'
                }
            );
        });
    });

    describe('.normalizeProfileOptions', () => {
        it('should handle array profile options', () => {
            const input = ['dont-insert-empty-fragments', 'no-tlsv1.3'];
            const output = util.normalizeProfileOptions(input);
            const expected = {
                'dont-insert-empty-fragments': {},
                'no-tlsv1.3': {}
            };
            assert.deepStrictEqual(output, expected);
        });

        it('should handle string profile options', () => {
            const input = 'QUERY NOTIFY';
            const output = util.normalizeProfileOptions(input);
            const expected = {
                QUERY: {},
                NOTIFY: {}
            };
            assert.deepStrictEqual(output, expected);
        });
    });

    describe('.getVirtualAddressList', () => {
        beforeEach(() => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };
        });

        it('should error when no context is provided', () => {
            assert.isRejected(
                util.getVirtualAddressList(),
                'argument context required'
            );
        });

        it('should return empty array if no virtual-address objects exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/virtual-address?$select=fullPath,partition,address,metadata')
                .reply(
                    200,
                    {
                        items: []
                    }
                );

            return assert.becomes(
                util.getVirtualAddressList(context),
                []
            );
        });

        it('should return virtual-address objects that exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/virtual-address?$select=fullPath,partition,address,metadata')
                .reply(
                    200,
                    {
                        items: [
                            {
                                fullPath: '/Common/virtualAddress1',
                                partition: 'Common',
                                address: '192.0.2.4'
                            },
                            {
                                fullPath: '/Common/virtualAddress2',
                                partition: 'Common',
                                address: '192.0.2.1',
                                metadata: [{
                                    name: 'foo',
                                    value: 'bar'
                                }]
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getVirtualAddressList(context),
                [
                    {
                        fullPath: '/Common/virtualAddress1',
                        partition: 'Common',
                        address: '192.0.2.4',
                        metadata: []
                    },
                    {
                        fullPath: '/Common/virtualAddress2',
                        partition: 'Common',
                        address: '192.0.2.1',
                        metadata: [{
                            name: 'foo',
                            value: 'bar'
                        }]
                    }
                ]
            );
        });

        it('should return virtual-address objects that exist in a particular partition', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/virtual-address?$filter=partition+eq+Common&$select=fullPath,partition,address,metadata')
                .reply(
                    200,
                    {
                        items: [
                            {
                                fullPath: '/Common/virtualAddress1',
                                partition: 'Common',
                                address: '192.0.2.4'
                            },
                            {
                                fullPath: '/Common/virtualAddress2',
                                partition: 'Common',
                                address: '192.0.2.1',
                                metadata: [{
                                    name: 'foo',
                                    value: 'bar'
                                }]
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getVirtualAddressList(context, 'Common'),
                [
                    {
                        fullPath: '/Common/virtualAddress1',
                        partition: 'Common',
                        address: '192.0.2.4',
                        metadata: []
                    },
                    {
                        fullPath: '/Common/virtualAddress2',
                        partition: 'Common',
                        address: '192.0.2.1',
                        metadata: [{
                            name: 'foo',
                            value: 'bar'
                        }]
                    }
                ]
            );
        });
    });

    describe('.getAddressListList', () => {
        beforeEach(() => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };
        });

        it('should error when no context is provided', () => {
            assert.isRejected(
                util.getAddressListList(),
                'argument context required'
            );
        });

        it('should return empty array if no address-list objects exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/net/address-list?$select=fullPath,partition,addresses,addressLists')
                .reply(
                    200,
                    {
                        items: []
                    }
                );

            return assert.becomes(
                util.getAddressListList(context),
                []
            );
        });

        it('should return address-list objects that exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/net/address-list?$select=fullPath,partition,addresses,addressLists')
                .reply(
                    200,
                    {
                        items: [
                            {
                                fullPath: '/Common/addressList1',
                                partition: 'Common',
                                addresses: ['192.0.2.3', '192.0.2.4'],
                                addressLists: ['/Common/addressList3']
                            },
                            {
                                fullPath: '/Common/addressList2',
                                partition: 'Common',
                                addresses: ['192.0.2.1', '192.0.2.2'],
                                addressLists: ['/Common/addressList4']
                            },
                            {
                                fullPath: '/Tenant/Application/addressList',
                                partition: 'Tenant',
                                addresses: ['192.0.2.4', '192.0.2.5'],
                                addressLists: ['/Common/addressList4']
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getAddressListList(context),
                [
                    {
                        fullPath: '/Common/addressList1',
                        partition: 'Common',
                        addresses: ['192.0.2.3', '192.0.2.4'],
                        addressLists: ['/Common/addressList3']
                    },
                    {
                        fullPath: '/Common/addressList2',
                        partition: 'Common',
                        addresses: ['192.0.2.1', '192.0.2.2'],
                        addressLists: ['/Common/addressList4']
                    },
                    {
                        fullPath: '/Tenant/Application/addressList',
                        partition: 'Tenant',
                        addresses: ['192.0.2.4', '192.0.2.5'],
                        addressLists: ['/Common/addressList4']
                    }
                ]
            );
        });

        it('should return address-list objects that exist in a particular partition', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/net/address-list?$filter=partition+eq+Common&$select=fullPath,partition,addresses,addressLists')
                .reply(
                    200,
                    {
                        items: [
                            {
                                fullPath: '/Common/addressList1',
                                partition: 'Common',
                                addresses: ['192.0.2.3', '192.0.2.4'],
                                addressLists: ['/Common/addressList3']
                            },
                            {
                                fullPath: '/Common/addressList2',
                                partition: 'Common',
                                addresses: ['192.0.2.1', '192.0.2.2'],
                                addressLists: ['/Common/addressList4']
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getAddressListList(context, 'Common'),
                [
                    {
                        fullPath: '/Common/addressList1',
                        partition: 'Common',
                        addresses: ['192.0.2.3', '192.0.2.4'],
                        addressLists: ['/Common/addressList3']
                    },
                    {
                        fullPath: '/Common/addressList2',
                        partition: 'Common',
                        addresses: ['192.0.2.1', '192.0.2.2'],
                        addressLists: ['/Common/addressList4']
                    }
                ]
            );
        });
    });

    describe('.getAccessProfileList', () => {
        beforeEach(() => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };
        });

        it('should error when no context is provided', () => {
            assert.isRejected(
                util.getAccessProfileList(),
                'argument context required'
            );
        });

        it('should return an empty array when apm is not provisioned', () => {
            context.provisionedModules = ['notApm'];
            return assert.becomes(
                util.getAccessProfileList(context),
                []
            );
        });

        it('should return empty array if no access profile objects exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/apm/profile/access?$select=fullPath,partition,type')
                .reply(
                    200,
                    {
                        items: []
                    }
                );

            sinon.stub(util, 'isOneOfProvisioned').returns(true);

            return assert.becomes(
                util.getAccessProfileList(context),
                []
            );
        });

        it('should return access profile objects that exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/apm/profile/access?$select=fullPath,partition,type')
                .reply(
                    200,
                    {
                        items: [
                            {
                                partition: 'Common',
                                fullPath: '/Common/access',
                                type: 'all'
                            },
                            {
                                partition: 'Tenant',
                                fullPath: '/Tenant/Application/ltm-apm-demo',
                                type: 'ltm-apm'
                            },
                            {
                                partition: 'Common',
                                fullPath: '/Common/ssloDefault_accessProfile',
                                type: 'ssl-orchestrator'
                            }
                        ]
                    }
                );

            sinon.stub(util, 'isOneOfProvisioned').returns(true);

            return assert.becomes(
                util.getAccessProfileList(context),
                [
                    {
                        partition: 'Common',
                        fullPath: '/Common/access',
                        type: 'all'
                    },
                    {
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/ltm-apm-demo',
                        type: 'ltm-apm'
                    },
                    {
                        partition: 'Common',
                        fullPath: '/Common/ssloDefault_accessProfile',
                        type: 'ssl-orchestrator'
                    }
                ]
            );
        });
    });

    describe('.getSnatPoolList', () => {
        beforeEach(() => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };
        });

        it('should error when no context is provided', () => {
            assert.isRejected(
                util.getSnatPoolList(),
                'argument context required'
            );
        });

        it('should return empty array if no snat pool objects exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/snatpool?$select=fullPath,partition,members')
                .reply(
                    200,
                    {
                        items: []
                    }
                );

            return assert.becomes(
                util.getSnatPoolList(context),
                []
            );
        });

        it('should return snat pool objects that exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/snatpool?$select=fullPath,partition,members')
                .reply(
                    200,
                    {
                        items: [
                            {
                                partition: 'Common',
                                fullPath: '/Common/snatpool1',
                                members: [
                                    '192.0.2.10',
                                    '192.0.2.11'
                                ]
                            },
                            {
                                partition: 'Tenant',
                                fullPath: '/Tenant/Application/snatpool2',
                                members: [
                                    '192.0.2.110',
                                    '192.0.2.111'
                                ]
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getSnatPoolList(context),
                [
                    {
                        partition: 'Common',
                        fullPath: '/Common/snatpool1',
                        members: [
                            '192.0.2.10',
                            '192.0.2.11'
                        ]
                    },
                    {
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/snatpool2',
                        members: [
                            '192.0.2.110',
                            '192.0.2.111'
                        ]
                    }
                ]
            );
        });
    });

    describe('.getGlobalSnat', () => {
        beforeEach(() => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    },
                    port: 8100
                }
            };
        });

        it('should error when no context is provided', () => {
            assert.isRejected(
                util.getGlobalSnat(),
                'argument context required'
            );
        });

        it('should return empty array if no snat objects exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/snat?$select=fullPath,partition,translation')
                .reply(
                    200,
                    {
                        items: []
                    }
                );

            return assert.becomes(
                util.getGlobalSnat(context),
                []
            );
        });

        it('should return snat objects that exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/snat?$select=fullPath,partition,translation')
                .reply(
                    200,
                    {
                        items: [
                            {
                                partition: 'Common',
                                fullPath: '/Common/snat1',
                                translation: '192.0.2.11'
                            },
                            {
                                partition: 'Tenant',
                                fullPath: '/Tenant/Application/snat2',
                                translation: '192.0.2.110'
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getGlobalSnat(context),
                [
                    {
                        partition: 'Common',
                        fullPath: '/Common/snat1',
                        translation: '192.0.2.11'
                    },
                    {
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/snat2',
                        translation: '192.0.2.110'
                    }
                ]
            );
        });
    });

    describe('.getSnatTranslationList', () => {
        beforeEach(() => {
            context.tasks = [
                {
                    urlPrefix: 'http://admin@localhost:8100'
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth',
                targetContext: {
                    tokens: {
                        'X-F5-Auth-Token': 'validtoken'
                    }
                }
            };
        });

        it('should error when no context is provided', () => {
            assert.isRejected(
                util.getSnatTranslationList(),
                'argument context required'
            );
        });

        it('should return empty array if no snat translation objects exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/snat-translation?$select=fullPath,partition,address')
                .reply(
                    200,
                    {
                        items: []
                    }
                );

            return assert.becomes(
                util.getSnatTranslationList(context),
                []
            );
        });

        it('should return snat pool objects that exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/snat-translation?$select=fullPath,partition,address')
                .reply(
                    200,
                    {
                        items: [
                            {
                                partition: 'Common',
                                fullPath: '/Common/192.0.2.10',
                                address: '192.0.2.10'
                            },
                            {
                                partition: 'Tenant',
                                fullPath: '/Tenant/Application/192.0.2.11',
                                address: '192.0.2.11'
                            }
                        ]
                    }
                );

            return assert.becomes(
                util.getSnatTranslationList(context),
                [
                    {
                        partition: 'Common',
                        fullPath: '/Common/192.0.2.10',
                        address: '192.0.2.10'
                    },
                    {
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/192.0.2.11',
                        address: '192.0.2.11'
                    }
                ]
            );
        });
    });

    describe('.isOneOfProvisioned', () => {
        it('should throw an error if targetContext is not provided', () => {
            assert.throws(() => util.isOneOfProvisioned(), 'targetContext was not supplied');
        });

        it('should return true if modules is not provided', () => {
            assert.strictEqual(util.isOneOfProvisioned({}), true);
        });

        it('should return true if modules is an empty array', () => {
            assert.strictEqual(util.isOneOfProvisioned({}, []), true);
        });

        it('should return false if targetContext does not have provisionedModules', () => {
            const targetContext = {};

            assert.strictEqual(util.isOneOfProvisioned(targetContext, ['chunky', 'foo', 'funky']), false);
        });

        it('should return false if targetContext.provisionedModules is empty', () => {
            const targetContext = {
                provisionedModules: []
            };

            assert.strictEqual(util.isOneOfProvisioned(targetContext, ['chunky', 'foo', 'funky']), false);
        });

        it('should return false if none of the modules are in targetContext', () => {
            const targetContext = {
                provisionedModules: ['bar']
            };

            assert.strictEqual(util.isOneOfProvisioned(targetContext, ['chunky', 'foo', 'funky']), false);
        });

        it('should return true if any of the supplied modules are in targetContext', () => {
            const targetContext = {
                provisionedModules: ['funky']
            };

            assert.strictEqual(util.isOneOfProvisioned(targetContext, ['chunky', 'foo', 'funky']), true);
        });
    });

    describe('.getDeepValue', () => {
        it('should handle a straight forward search', () => {
            const searchObject = {
                tenant: {
                    application: {
                        service: {
                            extraData: 12345
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.getDeepValue(searchObject, 'tenant.application.service'),
                {
                    extraData: 12345
                }
            );
            assert.deepStrictEqual(
                util.getDeepValue(searchObject, 'tenant.application.service.extraData'),
                12345
            );
        });

        it('should handle path components with periods', () => {
            const searchObject = {
                'test.tenant.name-with-dots-and-dashes-': {
                    application: {
                        service: {
                            '.extraData': 12345
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.getDeepValue(searchObject, 'test.tenant.name-with-dots-and-dashes-/application/service/.extraData', '/'),
                12345
            );
        });

        it('should handle path components specified as an array', () => {
            const searchObject = {
                'test.tenant.name-with-dots-and-dashes-': {
                    application: {
                        service: {
                            '.extraData': 12345
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.getDeepValue(searchObject, ['test.tenant.name-with-dots-and-dashes-', 'application', 'service', '.extraData']),
                12345
            );
        });

        it('should skip empty path components', () => {
            const searchObject = {
                'test.tenant.name-with-dots-and-dashes-': {
                    application: {
                        service: {
                            '.extraData': 12345
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.getDeepValue(searchObject, '/test.tenant.name-with-dots-and-dashes-//application/service/.extraData/', '/'),
                12345
            );
        });
    });

    describe('.setDeepValue', () => {
        it('should create sub-objects in path', () => {
            const expected = {
                tenant: {
                    application: {
                        service: {
                            extraData: 12345
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.setDeepValue({}, 'tenant.application.service.extraData', 12345),
                expected
            );
        });

        it('should create sub-arrays in path', () => {
            const expected = {
                tenant: {
                    application: {
                        service: {
                            virtualAddresses: [
                                { extraData: 12345 }
                            ]
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.setDeepValue({}, 'tenant.application.service.virtualAddresses.0.extraData', 12345),
                expected
            );
        });

        it('should handle arrays at end of path', () => {
            const expected = {
                tenant: {
                    application: {
                        service: {
                            virtualAddresses: [12345]
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.setDeepValue({}, 'tenant.application.service.virtualAddresses.0', 12345),
                expected
            );
        });

        it('should handle sparse arrays', () => {
            const expected = {
                tenant: {
                    application: {
                        service: {
                            virtualAddresses: [
                                undefined,
                                { extraData: 12345 }
                            ]
                        }
                    }
                }
            };
            assert.deepStrictEqual(
                util.setDeepValue({}, 'tenant.application.service.virtualAddresses.1.extraData', 12345),
                expected
            );
        });

        it('should handle populated objects', () => {
            const obj = {
                tenant: {
                    application: {
                        service: {
                            virtualAddresses: [
                                { bigip: '/Common/Shared/address' },
                                { bigip: '/Common/Shared/otherAddress' }
                            ],
                            enable: true
                        },
                        otherService: {}
                    }
                }
            };
            const expected = {
                tenant: {
                    application: {
                        service: {
                            virtualAddresses: [
                                { bigip: '/Common/Shared/address' },
                                {
                                    bigip: '/Common/Shared/otherAddress',
                                    extraData: 12345
                                }
                            ],
                            enable: true
                        },
                        otherService: {}
                    }
                }
            };
            assert.deepStrictEqual(
                util.setDeepValue(obj, 'tenant.application.service.virtualAddresses.1.extraData', 12345),
                expected
            );
        });
    });

    describe('.getObjectNameWithClassName', () => {
        const testCases = [
            {
                testName: 'should return the object name for a given class name',
                input: {
                    notTheClass: {
                        class: 'foo'
                    },
                    theClass: {
                        class: 'pickMe'
                    }
                },
                expectedOutput: 'theClass'
            },
            {
                testName: 'should return undefined if class name not found',
                input: {
                    notTheClass: {
                        class: 'foo'
                    },
                    theClass: {
                        class: 'bar'
                    }
                },
                expectedOutput: undefined
            },
            {
                testName: 'should work for objects that do not have a class',
                input: {
                    notTheClass: {
                        notClass: 'foo'
                    },
                    theClass: {
                        notClass: 'pickMe'
                    }
                },
                expectedOutput: undefined
            },
            {
                testName: 'should work for objects that have non-object properties',
                input: {
                    notAnObject: 'i am not an object',
                    anArray: ['i am an array']
                },
                expectedOutput: undefined
            }
        ];

        testCases.forEach((testCase) => {
            it(testCase.testName, () => {
                assert.strictEqual(util.getObjectNameWithClassName(testCase.input, 'pickMe'), testCase.expectedOutput);
            });
        });
    });

    describe('.stringReplace', () => {
        it('should replace strings inside object', () => {
            const obj = {
                a: { str: 'foo' },
                b: ['bar', 'foo']
            };
            const expected = {
                a: { str: 'bar' },
                b: ['bar', 'bar']
            };
            util.stringReplace(obj, 'foo', 'bar');
            assert.deepStrictEqual(obj, expected);
        });
    });

    describe('.convertTtlToDayHourMinSec', () => {
        it('should convert TTL to hours, minutes, and seconds', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(3718), '1:1:58');
        });

        it('should handle TTL that is less than an hour', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(718), '11:58');
        });

        it('should handle TTL that is less than a minute', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(18), '18');
        });

        it('should handle a day scenerio', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(86400), '1:0:0:0');
        });

        it('should handle more than a day', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(86425), '1:0:0:25');
        });

        it('should handle max limit', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(604800), '7:0:0:0');
        });

        it('should handle undefined TTL', () => {
            assert.strictEqual(util.convertTtlToDayHourMinSec(), '0');
        });
    });

    describe('string escapes', () => {
        it('should unescape double slash curly instances', () => {
            assert.strictEqual(util.unescapeDoubleSlashCurly('foo: \\\\{bar\\\\} :\\\\{baz\\\\}'), 'foo: \\{bar\\} :\\{baz\\}');
        });

        it('should unescape double slash quotes', () => {
            assert.strictEqual(util.unescapeDoubleSlashQuote('\\\\"foo\\\\"'), '\\"foo\\"');
        });
    });

    describe('.extractValueFromEscapedRestString', () => {
        it('should return "none" if iControlString is undefined', () => {
            assert.strictEqual(util.extractValueFromEscapedRestString(), 'none');
        });

        it('should return extracted value from escaped iControlString', () => {
            const str = '\\\\foo\\\\bar\\\\?';
            assert.strictEqual(util.extractValueFromEscapedRestString(str), '\\foo\\bar?');
        });
    });

    describe('.isEmptyOrUndefined', () => {
        it('should return true if value is null', () => {
            assert.strictEqual(util.isEmptyOrUndefined(null), true);
        });

        it('should return true if value is undefined', () => {
            assert.strictEqual(util.isEmptyOrUndefined(), true);
        });

        it('should return true if value is empty string', () => {
            assert.strictEqual(util.isEmptyOrUndefined(''), true);
        });

        it('should return false if value is string with one or more chars', () => {
            assert.strictEqual(util.isEmptyOrUndefined('a'), false);
        });

        it('should return true if value is empty array', () => {
            assert.strictEqual(util.isEmptyOrUndefined([]), true);
        });

        it('should return false if value is array with one or more items', () => {
            assert.strictEqual(util.isEmptyOrUndefined([null]), false);
        });

        it('should return true if value is empty object', () => {
            assert.strictEqual(util.isEmptyOrUndefined({}), true);
        });

        it('should return false if value is object with one or more properties', () => {
            assert.strictEqual(util.isEmptyOrUndefined({ foo: 'bar' }), false);
        });

        it('should return true if value is falsy', () => {
            assert.strictEqual(util.isEmptyOrUndefined(0), true);
        });

        it('should return false if value is truthy', () => {
            assert.strictEqual(util.isEmptyOrUndefined(1), false);
        });
    });

    describe('.isEnabledGtmObject', () => {
        it('should return true if obj is enabled', () => {
            assert.strictEqual(util.isEnabledObject({ enabled: true }), true);
        });

        it('should return false if obj has enabled set to false', () => {
            assert.strictEqual(util.isEnabledObject({ enabled: false }), false);
        });

        it('should return false if obj is disabled', () => {
            assert.strictEqual(util.isEnabledObject({ disabled: true }), false);
        });

        it('should return true if obj has disabled set to false', () => {
            assert.strictEqual(util.isEnabledObject({ disabled: false }), true);
        });

        it('should return true if obj is enabled with a string value of true', () => {
            assert.strictEqual(util.isEnabledObject({ enabled: 'TrUe' }), true);
        });

        it('should return false if obj has enabled set to a string value other than true', () => {
            assert.strictEqual(util.isEnabledObject({ enabled: 'Foo' }), false);
        });

        it('should return true if obj has disabled set to a string value of false', () => {
            assert.strictEqual(util.isEnabledObject({ disabled: 'FaLsE' }), true);
        });

        it('should return false if obj has disabled set to a string value other than false', () => {
            assert.strictEqual(util.isEnabledObject({ disabled: 'Bar' }), false);
        });

        it('should default to returning true', () => {
            assert.strictEqual(util.isEnabledObject({ enabled: {}, disabled: null }), true);
        });
    });

    describe('.capitalizeString', () => {
        it('should capitalize string', () => {
            assert.strictEqual(util.capitalizeString('foo bar'), 'Foo bar');
        });
    });

    describe('convertRouteDomainIDToRestAPI', () => {
        it('should convert minimum value of RouteDomainID', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/192.0.2.100%0'), '/Common/192.0.2.100%250');
        });
        it('should convert RouteDomainID 1', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/192.0.2.100%1'), '/Common/192.0.2.100%251');
        });

        it('should convert mid value of RouteDomainID ', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/192.0.2.100%32534'), '/Common/192.0.2.100%2532534');
        });

        it('should convert max value of RouteDomainID', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/192.0.2.100%65534'), '/Common/192.0.2.100%2565534');
        });

        it('should not convert above max limit of RouteDomainID', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/192.0.2.100%65535'), '/Common/192.0.2.100%65535');
        });

        it('should identify and convert RouteDomainID only at last', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/192.0.2.100%65535%10'), '/Common/192.0.2.100%65535%2510');
        });

        it('should convert RouteDomainID mixed with name', () => {
            assert.strictEqual(util.convertRouteDomainIDToRestAPI('/Common/test_virtual.Address%10'), '/Common/test_virtual.Address%2510');
        });
    });
});

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

const dns = require('dns');
const sinon = require('sinon');
const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const networkUtil = require('../../../../src/lib/util/networkUtil');
const Context = require('../../../../src/lib/context/context');
const log = require('../../../../src/lib/log');

describe('networkUtil', () => {
    let context;

    beforeEach(() => {
        context = Context.build();
        context.tasks[0] = {};
        sinon.spy(log, 'info');
        sinon.spy(log, 'debug');
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('resolveDomainToIp', () => {
        beforeEach(() => {
            sinon.stub(dns, 'lookup').yields(new Error('should not have called dns lookup'));
        });

        it('should resolve when domain is undefined', () => assert.becomes(
            networkUtil.resolveDomainToIp(), ''
        ));

        it('should resolve to 127.0.0.1 if localhost is provided', () => assert.becomes(
            networkUtil.resolveDomainToIp('localhost'), '127.0.0.1'
        ));

        it('should resolve to the value provided if it includes a ":"', () => assert.becomes(
            networkUtil.resolveDomainToIp('1:1'), '1:1'
        ));

        it('should resolve if an ipv4 is provided', () => assert.becomes(
            networkUtil.resolveDomainToIp('10.1.2.3'), '10.1.2.3'
        ));

        it('should attempt to do a dns look up if the a hostname is provided', () => {
            sinon.restore();
            sinon.stub(dns, 'lookup').yields(undefined, '10.1.2.3');
            return assert.becomes(networkUtil.resolveDomainToIp('hostname.com'), '10.1.2.3');
        });

        it('should attempt to do a dns look up if the a hostname is provided', () => {
            sinon.restore();
            sinon.stub(dns, 'lookup').yields(null, '10.1.2.3');
            return assert.becomes(networkUtil.resolveDomainToIp('hostname.com'), '10.1.2.3');
        });

        it('should return empty string on error', () => assert.becomes(
            networkUtil.resolveDomainToIp('badString'), ''
        ));
    });

    describe('setAuthzToken', () => {
        const username = 'user';
        const password = 'password';
        const getTask = (token) => ({
            targetHost: 'localhost',
            targetPort: 443,
            targetTokens: token === undefined ? {} : { 'X-F5-Auth-Token': token },
            targetUsername: username,
            targetPassphrase: password,
            urlPrefix: 'https://192.0.2.10:443'
        });

        const stubClock = (token) => {
            nock('https://192.0.2.10:443', { reqheaders: { 'X-F5-Auth-Token': token } })
                .get('/mgmt/tm/sys/clock')
                .reply(200, {
                    entries: [
                        {
                            nestedStats: {
                                entries: {
                                    fullDate: {
                                        description: new Date(Date.now() + 60000).toUTCString()
                                    }
                                }
                            }
                        }
                    ]
                });
        };

        const stubLogin = (token) => {
            nock('https://192.0.2.10:443')
                .post('/mgmt/shared/authn/login', { username, password, loginProviderName: 'tmos' })
                .reply(200, {
                    token,
                    startTime: new Date().toUTCString(),
                    timeout: 60000
                });
        };

        const stubGetToken = (token) => {
            nock('https://192.0.2.10:443')
                .get(`/mgmt/shared/authz/tokens/${token}`)
                .reply(200, {
                    token,
                    startTime: new Date().toUTCString(),
                    timeout: 60
                });
        };

        it('should return false if domain cannot be resolved', () => assert.becomes(
            networkUtil.setAuthzToken(context), false
        ));

        it('should return true if protocol is http', () => {
            context.tasks[0] = { protocol: 'http' };
            return assert.becomes(networkUtil.setAuthzToken(context), true);
        });

        it('should get auth token and return true', () => {
            const token = '123abc';
            context.tasks[0] = getTask();

            stubClock(token);
            stubLogin(token);

            return Promise.resolve()
                .then(() => assert.becomes(networkUtil.setAuthzToken(context), true))
                .then(() => {
                    assert.strictEqual(nock.isDone(), true);
                    assert.deepStrictEqual(context.tasks[0].targetTokens, { 'X-F5-Auth-Token': token });
                    assert.strictEqual(log.debug.getCall(0).args[0], `got token for ${username}@localhost`);
                });
        });

        it('should get auth token object and return true', () => {
            const token = '123abc';
            context.tasks[0] = getTask();

            stubClock(token);
            stubLogin({ token });

            return Promise.resolve()
                .then(() => assert.becomes(networkUtil.setAuthzToken(context), true))
                .then(() => {
                    assert.strictEqual(nock.isDone(), true);
                    assert.deepStrictEqual(context.tasks[0].targetTokens, { 'X-F5-Auth-Token': token });
                    assert.strictEqual(log.debug.getCall(0).args[0], `got token for ${username}@localhost`);
                });
        });

        it('should extend auth token timeout and return true', () => {
            const token = '123abc';
            context.tasks[0] = getTask(token);

            stubClock(token);
            stubGetToken(token);

            nock('https://192.0.2.10:443')
                .patch(`/mgmt/shared/authz/tokens/${token}`, {
                    timeout: 1260
                })
                .reply(200, {
                    token,
                    startTime: new Date().toUTCString(),
                    timeout: 60
                });

            return Promise.resolve()
                .then(() => assert.becomes(networkUtil.setAuthzToken(context), true))
                .then(() => {
                    assert.strictEqual(nock.isDone(), true);
                    assert.deepStrictEqual(context.tasks[0].targetTokens, { 'X-F5-Auth-Token': token });
                    assert.strictEqual(log.info.getCall(0).args[0], 'extend authz token timeout');
                    assert.strictEqual(log.debug.getCall(0).args[0], `got token for ${username}@localhost`);
                });
        });

        it('should error and return false when final response token is not a string', () => {
            const token = '123abc';
            context.tasks[0] = getTask(token);

            stubClock(token);
            stubGetToken(token);

            nock('https://192.0.2.10:443')
                .patch(`/mgmt/shared/authz/tokens/${token}`, {
                    timeout: 1260
                })
                .reply(200, { foo: 'bar' });

            return Promise.resolve()
                .then(() => assert.becomes(networkUtil.setAuthzToken(context), false))
                .then(() => {
                    assert.strictEqual(nock.isDone(), true);
                    assert.strictEqual(log.info.getCall(1).args[0].message, 'unrecognized response {"foo":"bar"}');
                });
        });

        it('should not report success in log if token equals "none"', () => {
            const token = 'none';
            context.tasks[0] = getTask();

            stubClock(token);
            stubLogin(token);

            return Promise.resolve()
                .then(() => assert.becomes(networkUtil.setAuthzToken(context), true))
                .then(() => {
                    assert.strictEqual(nock.isDone(), true);
                    assert.deepStrictEqual(context.tasks[0].targetTokens, { 'X-F5-Auth-Token': token });
                    assert.ok(log.debug.notCalled);
                });
        });
    });
});

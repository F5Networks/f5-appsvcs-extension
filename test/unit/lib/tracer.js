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

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const nock = require('nock');
const sinon = require('sinon');

const tracerLib = require('../../../src/lib/tracer');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('Tracer lib', function () {
    if (process.versions.node.split('.')[0] < 6) {
        return;
    }

    this.timeout(6000);
    let tracer;
    let spanReq;

    beforeEach(() => {
        tracer = new tracerLib.Tracer('testService', {
            enabled: true,
            debug: false,
            endpoint: 'http://mock.jaeger:14268/api/traces'
        });
        nock('http://mock.jaeger:14268')
            .persist()
            .post('/api/traces', (body) => {
                // in thrift buffer format
                spanReq = body;
                return true;
            })
            .reply(202);
    });

    afterEach(() => {
        tracer.close();
        tracer = null;
        spanReq = null;
        nock.cleanAll();
        sinon.restore();
    });

    describe('Tracer', () => {
        describe('constructor', () => {
            before(() => {
                process.env.F5_PERF_TRACING_DEBUG = true;
                process.env.F5_PERF_TRACING_ENABLED = true;
                process.env.F5_PERF_TRACING_ENDPOINT = 'http://mock.jaeger:14268/api/traces';
            });

            after(() => {
                delete process.env.F5_PERF_TRACING_DEBUG;
                delete process.env.F5_PERF_TRACING_ENABLED;
                delete process.env.F5_PERF_TRACING_ENDPOINT;
            });

            it('should require serviceName', () => {
                assert.throws(() => new tracerLib.Tracer(), 'serviceName is required');
            });

            it('should set properties from opts (override env vars)', () => {
                const logger = {
                    error: () => { },
                    info: () => { },
                    debug: () => { }
                };
                const newTracer = new tracerLib.Tracer('testServiceFromOpts', {
                    logger, enabled: false, endpoint: 'http://somewhere', debug: true
                });
                assert.strictEqual(newTracer.serviceName, 'testServiceFromOpts');
                assert.deepStrictEqual(newTracer._logger, logger);
                assert.isFalse(newTracer._enabled);
                assert.isTrue(newTracer._debug);
                assert.strictEqual(newTracer._endpoint, 'http://somewhere');
                newTracer.close();
            });

            it('should set properties from env vars if no options present', () => {
                sinon.stub(console, 'log'); // We do NOT want debug prints in our unit tests
                const newTracer = new tracerLib.Tracer('testServiceFromEnvVars');
                console.log.restore();

                assert.strictEqual(newTracer.serviceName, 'testServiceFromEnvVars');
                assert.isOk(newTracer._logger);
                assert.isTrue(newTracer._enabled);
                assert.isTrue(newTracer._debug);
                assert.strictEqual(newTracer._endpoint, 'http://mock.jaeger:14268/api/traces');

                sinon.stub(console, 'log'); // We do NOT want debug prints in our unit tests
                newTracer.close();
                console.log.restore();
            });
        });

        describe('.startSpan', () => {
            it('should return no-op tracer span when disabled', () => {
                const noopTracer = new tracerLib.Tracer('testService1', { enabled: false });
                const span = noopTracer.startSpan('opName');
                assert.isTrue(span instanceof tracerLib.BaseSpan);
                assert.isFalse(span instanceof tracerLib.Span);
            });

            it('should return no-op tracer span when an error occurs', () => {
                sinon.stub(tracer._tracer, 'startSpan').throwsException();
                const span = tracer.startSpan('opName');
                assert.isTrue(span instanceof tracerLib.BaseSpan);
                assert.isFalse(span instanceof tracerLib.Span);
            });

            it('should return tracer span when enabled', () => {
                const span = tracer.startSpan('opName');
                assert.isTrue(span instanceof tracerLib.Span);
                assert.deepStrictEqual(span.serviceName, 'testService');
                assert.deepStrictEqual(span.operationName, 'opName');
            });

            it('should return a new span with default tags', () => {
                const span = tracer.startSpan('opName');
                assert.includeDeepMembers(span.tags, [
                    { key: 'span.kind', value: 'server' }
                ]);
            });
        });

        describe('.startHttpSpan', () => {
            it('should return a new span with correct service and opName', () => {
                const span = tracer.startHttpSpan('/api/tests', '/api/tests');
                assert.deepStrictEqual(span.serviceName, 'testService');
                assert.deepStrictEqual(span.operationName, '/api/tests');
            });

            it('should return a new span with default http tags', () => {
                const span = tracer.startHttpSpan('/resourcePath/{resourceId}', '/resourcePath/resource1', 'post');
                assert.includeDeepMembers(span.tags, [
                    { key: 'span.kind', value: 'server' },
                    { key: 'component', value: 'net/http' },
                    { key: 'http.method', value: 'POST' },
                    { key: 'http.url', value: '/resourcePath/resource1' }
                ]);
            });

            it('should return a new span with default and specified tags', () => {
                const span = tracer.startHttpSpan(
                    '/resources/{name}',
                    '/resources/myResource',
                    'post',
                    { tags: { a: 'b', c: 'd' } }
                );
                assert.includeDeepMembers(span.tags, [
                    { key: 'span.kind', value: 'server' },
                    { key: 'component', value: 'net/http' },
                    { key: 'http.method', value: 'POST' },
                    { key: 'http.url', value: '/resources/myResource' },
                    { key: 'a', value: 'b' },
                    { key: 'c', value: 'd' }
                ]);
            });
        });
    });

    describe('Span', () => {
        let span;
        beforeEach(() => {
            span = tracer.startHttpSpan('/test/items', '/test/item/1', 'POST');
        });

        afterEach(() => {
            span = null;
        });

        it('should log span event', () => {
            span.log({ event: 'stepA_finished' });
            const eventLog = span.logs[0];
            assert.deepStrictEqual(eventLog.fields,
                [{ key: 'event', value: 'stepA_finished' }]);
            assert.isNumber(eventLog.timestamp);
            assert.isFalse(span.finished);
            assert.isFalse(span.errored);
        });

        it('should log span event with specified timestamp', () => {
            const timestamp = Date.now();
            span.log({ event: 'stepB_finished' }, timestamp);
            assert.deepStrictEqual(span.logs, [
                { timestamp, fields: [{ key: 'event', value: 'stepB_finished' }] }
            ]);
            assert.isFalse(span.finished);
            assert.isFalse(span.errored);
        });

        it('should log span error (object) and set error tag', () => {
            const errObj = new Error('something failed');
            span.logError(errObj);
            const errLog = span.logs[0];
            assert.includeDeepMembers(errLog.fields, [
                { key: 'event', value: 'error' },
                { key: 'error.object', value: errObj },
                { key: 'message', value: 'something failed' }
            ], 'span should have error tags');
            assert(errLog.fields.find((f) => f.key === 'stack').value, 'span should have error.stack tag');
            assert.isFalse(span.finished, 'span should not be marked as finished');
        });

        it('should log span error (string) and set error tag', () => {
            span.logError('some error message');
            const errLog = span.logs[0];
            assert.includeDeepMembers(errLog.fields, [
                { key: 'event', value: 'error' },
                { key: 'error.object', value: { message: 'some error message' } },
                { key: 'message', value: 'some error message' }
            ], 'span should have error tags');
            assert.isFalse(span.finished, 'span should not be marked as finished');
        });

        it('should add tag for http code', () => {
            span.tagHttpCode(202);
            assert.includeDeepMembers(span.tags, [{
                key: 'http.status_code', value: 202
            }]);
        });

        it('should add custom tag', () => {
            span.addTag('weather', 'sunny');
            assert.includeDeepMembers(span.tags, [{
                key: 'weather', value: 'sunny'
            }]);
        });

        it('should require tag key', () => {
            span.addTag(null, 'anything goes');
            assert.isTrue(span.errored);
        });

        it('should finish span and send to reporter', () => {
            span.finish();
            // wait just a bit for tracer reporter to finish flushing
            // default interval is 1000 ms
            return new Promise((resolve) => { setTimeout(resolve, 1500); })
                .then(() => {
                    assert(spanReq, 'span request should be sent');
                    assert.isTrue(span.finished, 'span should be marked as finished');
                });
        });

        it('should not throw an exception when an error is encountered in client lib', () => {
            let stubCalls = 0;
            const throwErr = () => {
                stubCalls += 1;
                throw new Error();
            };
            sinon.stub(span._span, 'setTag').callsFake(() => throwErr());
            sinon.stub(span._span, 'addTags').callsFake(() => throwErr());
            sinon.stub(span._span, 'finish').callsFake(() => throwErr());
            sinon.stub(span._span, 'log').callsFake(() => throwErr());

            span.addTag('campfire', 'smores galore');
            span.addTags({ hoursLeft: 3 });
            span.log({ event: 'snacks_finished' });
            span.logError('ERROR! Need more cookies');
            span.finish();

            assert.isTrue(span.errored);
            assert.equal(stubCalls, 5);
        });
    });

    describe('Util', () => {
        it('should build correct deviceInfo tags', () => {
            const deviceInfo = {
                hostname: 'my.bigip.test',
                version: '14.1.2.6',
                product: 'BIG-IP',
                platform: 'Z100',
                platformMarketingName: 'BIG-IP Virtual Edition',
                edition: 'Point Release 6',
                build: '0.0.2',
                restFrameworkVersion: '14.1.2.6-0.0.2',
                isClustered: false,
                isVirtual: true,
                generation: 0,
                lastUpdateMicros: 0,
                kind: 'shared:resolver:device-groups:deviceinfostate',
                selfLink: 'https://localhost/mgmt/shared/identified-devices/config/device-info'
            };
            assert.deepStrictEqual(tracerLib.Util.buildDeviceTags(deviceInfo), {
                'device.platform': 'Z100',
                'device.platform_name': 'BIG-IP Virtual Edition',
                'device.product': 'BIG-IP',
                'device.version': '14.1.2.6',
                'device.build': '0.0.2',
                'device.edition': 'Point Release 6'
            });
        });

        describe('getClassList', () => {
            it('should return empty array with no declaration', () => assert.deepStrictEqual(
                tracerLib.Util.getClassList(tracer),
                []
            ));

            it('should return empty array with disabled tracer', () => {
                const declaration = {
                    funk: {
                        class: 'Funk'
                    }
                };

                tracer._enabled = false;

                assert.deepStrictEqual(
                    tracerLib.Util.getClassList(tracer, declaration),
                    []
                );
            });

            it('should return an empty array if classes are provided', () => {
                const declaration = {};

                assert.deepStrictEqual(
                    tracerLib.Util.getClassList(tracer, declaration),
                    []
                );
            });

            it('should return the class list with no duplicates', () => {
                const declaration = {
                    funk: {
                        class: 'Funk'
                    },
                    veryFunk: {
                        class: 'Funk'
                    },
                    classical: {
                        class: 'Classical'
                    }
                };

                assert.deepStrictEqual(
                    tracerLib.Util.getClassList(tracer, declaration),
                    ['Funk', 'Classical']
                );
            });

            it('should handle declaration arrays', () => {
                const declarations = [
                    {
                        funk: {
                            class: 'Funk'
                        },
                        jazz: {
                            class: 'Jazz'
                        }
                    },
                    {
                        veryfunk: {
                            class: 'Funk'
                        }
                    },
                    {
                        classical: {
                            class: 'Classical'
                        },
                        rock: {
                            class: 'Rock'
                        }
                    }
                ];

                assert.deepStrictEqual(
                    tracerLib.Util.getClassList(tracer, declarations),
                    ['Funk', 'Jazz', 'Classical', 'Rock']
                );
            });
        });
    });
});

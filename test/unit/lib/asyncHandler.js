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

const AsyncHandler = require('../../../src/lib/asyncHandler');
const log = require('../../../src/lib/log');
const JsonDataStore = require('../../../src/lib/JsonDataStore');

const RestOperationMock = require('../RestOperationMock');

describe('asyncHandler', () => {
    before('disable logging', () => {
        sinon.stub(log, 'error');
    });

    after('restore logging', () => {
        sinon.restore();
    });

    it('should not fail when there is no state to restore', () => {
        const dataStore = new JsonDataStore();
        const asyncHandler = new AsyncHandler(dataStore);
        return asyncHandler.restoreState();
    });

    function createResponse() {
        return {
            status: 200,
            response: {
                results: [
                    {
                        message: 'success',
                        lineCount: 20,
                        code: 200,
                        host: 'localhost',
                        tenant: 'TEST_Pool',
                        runTime: 733
                    }
                ],
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.10.0',
                    id: 'Pool',
                    TEST_Pool: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'Pool'
                            }
                        }
                    },
                    updateMode: 'selective',
                    controls: {
                        archiveTimestamp: '2019-03-25T20:26:38.760Z',
                        traceResponse: true
                    }
                },
                traces: {
                    TEST_PoolDesired: {
                        '/TEST_Pool/Application/': {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        '/TEST_Pool/Application/testItem': {
                            command: 'ltm pool',
                            properties: {
                                'load-balancing-mode': 'round-robin',
                                members: {},
                                'min-active-members': 1,
                                'reselect-tries': 0,
                                'service-down-action': 'none',
                                'slow-ramp-time': 10
                            },
                            ignore: []
                        },
                        '/TEST_Pool/': {
                            command: 'auth partition',
                            properties: { 'default-route-domain': 0 },
                            ignore: []
                        }
                    },
                    TEST_PoolCurrent: {},
                    TEST_PoolDiff: [
                        {
                            kind: 'N',
                            path: ['/TEST_Pool/Application/'],
                            rhs: {
                                command: 'sys folder',
                                properties: {},
                                ignore: []
                            },
                            tags: ['tmsh'],
                            command: 'sys folder',
                            lhsCommand: '',
                            rhsCommand: 'sys folder'
                        },
                        {
                            kind: 'N',
                            path: ['/TEST_Pool/Application/testItem'],
                            rhs: {
                                command: 'ltm pool',
                                properties: {
                                    'load-balancing-mode': 'round-robin',
                                    members: {},
                                    'min-active-members': 1,
                                    'reselect-tries': 0,
                                    'service-down-action': 'none',
                                    'slow-ramp-time': 10
                                },
                                ignore: []
                            },
                            tags: ['tmsh'],
                            command: 'ltm pool',
                            lhsCommand: '',
                            rhsCommand: 'ltm pool'
                        },
                        {
                            kind: 'N',
                            path: ['TEST_Pool'],
                            rhs: {
                                command: 'auth partition',
                                properties: { 'default-route-domain': 0 },
                                ignore: []
                            },
                            tags: ['tmsh'],
                            command: 'auth partition',
                            lhsCommand: '',
                            rhsCommand: 'auth partition'
                        }
                    ],
                    TEST_PoolScript: 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::create auth partition TEST_Pool default-route-domain 0\ntmsh::create sys folder /TEST_Pool/Application/\ntmsh::begin_transaction\ntmsh::modify auth partition TEST_Pool description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::create ltm pool /TEST_Pool/Application/testItem load-balancing-mode round-robin members none min-active-members 1 reselect-tries 0 service-down-action none slow-ramp-time 10\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::delete sys folder /TEST_Pool/Application/ } e\ncatch { tmsh::delete auth partition TEST_Pool } e\n}}\n}'
                },
                selfLink: 'https://localhost/mgmt/shared/appsvcs/task/'
            }
        };
    }

    function createRecordName(id) {
        return `${id}`;
    }
    function createRecord(id) {
        return {
            name: createRecordName(id),
            timestamp: `${Date.now()}`,
            status: 'complete',
            results: createResponse()
        };
    }

    function createPendingRecord(id) {
        return {
            name: createRecordName(id),
            timestamp: `${Date.now()}`,
            status: 'pending'
        };
    }
    function createCancelledRecord(id) {
        return {
            name: createRecordName(id),
            timestamp: `${Date.now()}`,
            status: 'cancelled'
        };
    }
    function createFailedRecord(id) {
        return {
            name: createRecordName(id),
            timestamp: `${Date.now()}`,
            status: 'complete',
            results: {
                status: 422,
                response: {
                    code: 422,
                    errors: [
                        ': propertyName "f5.com" should match pattern "^[A-Za-z][0-9A-Za-z_]{0,47}$"'
                    ],
                    declarationFullId: '',
                    message: 'declaration is invalid'
                }
            }
        };
    }

    describe('.handleRecord()', () => {
        let defaultContext;
        const asyncUuid = 'handle-record-uuid';

        beforeEach(() => {
            defaultContext = {
                request: {
                    method: 'Foo'
                },
                tasks: [
                    { action: '' }
                ]
            };
        });

        function assertRecord(asyncHandler, method, results, context) {
            return asyncHandler.handleRecord(context, method, asyncUuid, results, 'handleRecord message')
                .then((result) => {
                    assert.equal(result.body.id, asyncUuid);
                    assert.equal(result.statusCode, 202);
                    assert(result.body.selfLink, 'Response does not have selfLink');
                    return result;
                });
        }

        function getRecords(asyncHandler) {
            return new Promise((resolve) => {
                const operation = new RestOperationMock(() => {
                    resolve(operation.getBody().items);
                });
                asyncHandler.getAsyncResponse(operation);
            });
        }

        it('should create new records', () => {
            const asyncHandler = new AsyncHandler();
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then(() => getRecords(asyncHandler))
                .then((records) => {
                    const record = records[0];
                    assert(record, 'No record found');
                    assert.equal(record.results[0].message, 'in progress');
                });
        });

        it('should persist records', () => {
            const dataStore = new JsonDataStore();
            let asyncHandler = new AsyncHandler(dataStore);
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then(() => {
                    asyncHandler = new AsyncHandler(dataStore);
                    return asyncHandler.restoreState();
                })
                .then(() => getRecords(asyncHandler))
                .then((records) => {
                    const record = records[0];
                    assert(record, 'No record found');
                    assert.equal(record.results[0].message, 'in progress');
                });
        });

        it('should create update records', () => {
            const asyncHandler = new AsyncHandler();
            const response = createResponse();
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then(() => assertRecord(asyncHandler, 'PATCH', response, defaultContext))
                .then(() => getRecords(asyncHandler))
                .then((records) => {
                    const record = records[0];
                    assert(record, 'No record found');
                    assert.deepEqual(record.results, response.response.results);
                    assert.deepEqual(record.declaration, response.response.declaration);
                });
        });

        it('should create delete records', () => {
            const asyncHandler = new AsyncHandler();
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then(() => assertRecord(asyncHandler, 'DELETE', undefined, defaultContext))
                .then(() => getRecords(asyncHandler))
                .then((records) => {
                    assert.deepEqual(records, []);
                });
        });

        it('should not create records when the context method is Get', () => {
            const asyncHandler = new AsyncHandler();
            defaultContext.request.method = 'Get';
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then(() => getRecords(asyncHandler))
                .then((records) => {
                    assert.strictEqual(records.length, 0);
                });
        });

        it('should run Get when action is retrieve', () => {
            const asyncHandler = new AsyncHandler();
            defaultContext.method = 'Post';
            defaultContext.tasks[0].action = 'retrieve';
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then(() => getRecords(asyncHandler))
                .then((records) => {
                    assert.strictEqual(records.length, 1);
                });
        });

        it('should add declaration.id to results when there is a declaration', () => {
            const asyncHandler = new AsyncHandler();
            defaultContext.tasks[0] = {
                asyncUuid,
                declaration: {
                    id: 'declId'
                }
            };
            return assertRecord(asyncHandler, 'POST', null, defaultContext)
                .then((result) => {
                    assert.deepStrictEqual(
                        result.body.results,
                        [
                            {
                                message: 'handleRecord message',
                                tenant: '',
                                host: '',
                                runTime: 0,
                                code: 0,
                                declarationId: 'declId'
                            }
                        ]
                    );
                });
        });
    });

    describe('.cleanRecords()', () => {
        let asyncHandler;

        beforeEach(() => {
            asyncHandler = new AsyncHandler();
        });

        it('should not remove finished tasks', () => {
            asyncHandler.records = [createPendingRecord(0), createRecord(1)];
            asyncHandler.cleanRecords();
            assert.equal(asyncHandler.records.length, 2);
        });

        it('should remove expired tasks', () => {
            asyncHandler.records = [createPendingRecord(0), createPendingRecord(1)];
            asyncHandler.records.forEach((record) => {
                record.timestamp = '0';
            });

            asyncHandler.cleanRecords();
            assert.deepEqual(asyncHandler.records, []);
        });

        it('should limit the task list', () => {
            for (let i = 0; i < 30; i += 1) {
                asyncHandler.records.push(createRecord(i));
            }
            asyncHandler.cleanRecords();
            assert.equal(asyncHandler.records.length, 25);
        });

        it('should not count pending tasks to limit', () => {
            for (let i = 0; i < 30; i += 1) {
                asyncHandler.records.push(createRecord(i));
            }
            asyncHandler.records.push(createPendingRecord(30));
            asyncHandler.cleanRecords();
            assert.equal(asyncHandler.records.length, 26);
        });

        it('should clean records when the context method is not Get', () => {
            asyncHandler.records = [createPendingRecord(0), createPendingRecord(1)];
            asyncHandler.records.forEach((record) => {
                record.timestamp = '0';
            });

            const context = {
                request: {
                    method: 'Foo'
                }
            };
            asyncHandler.cleanRecords(context);
            assert.strictEqual(asyncHandler.records.length, 0);
        });

        it('should not clean records when the context method is Get', () => {
            asyncHandler.records = [createPendingRecord(0), createPendingRecord(1)];
            asyncHandler.records.forEach((record) => {
                record.timestamp = '0';
            });

            const context = {
                request: {
                    method: 'Get'
                },
                tasks: [
                    { action: '' }
                ]
            };
            asyncHandler.cleanRecords(context);
            assert.strictEqual(asyncHandler.records.length, 2);
        });
    });

    describe('.getAsyncResponse()', () => {
        function assertResponse(id, items, checkOperationFunc, callback) {
            const asyncHandler = new AsyncHandler();
            asyncHandler.records = items;
            let count = 0;
            const operation = new RestOperationMock(() => {
                // Ignore multiple restOperation completions
                if (count !== 0) {
                    return;
                }
                count += 1;
                try {
                    checkOperationFunc(operation);
                } catch (error) {
                    callback(error);
                    return;
                }
                callback();
            });
            if (typeof id !== 'undefined') {
                operation.uri.pathname = `${operation.uri.pathname}/${id}`;
            }
            asyncHandler.getAsyncResponse(operation);
        }

        it('should return empty records', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.deepEqual(body.items, []);
                assert.equal(operation.getStatusCode(), 200);
            };
            assertResponse(undefined, [], check, done);
        });

        it('should return multiple records', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.items.length, 2);
                assert.equal(operation.getStatusCode(), 200);
            };
            assertResponse(undefined, [createRecord(0), createRecord(1)], check, done);
        });

        it('should return specific record', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.id, '1');
                assert(body.declaration, 'Response has no declaration');
                assert(Array.isArray(body.results), 'Results is not an array');
                assert.equal(operation.getStatusCode(), 200);
            };
            assertResponse('1', [createRecord(0), createRecord(1)], check, done);
        });

        it('should return failed record', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.id, '0');
                assert(body.declaration, 'Response has no declaration');
                assert(Array.isArray(body.results), 'Results is not an array');
                const result = body.results[0];
                assert.equal(result.code, 422);
                assert(result.message, 'Result is missing a message');
                assert.equal(operation.getStatusCode(), 200);
            };
            assertResponse('0', [createFailedRecord(0)], check, done);
        });

        it('should return pending record', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.id, '0');
                assert(body.declaration, 'Response has no declaration');
                assert(Array.isArray(body.results), 'Results is not an array');
                const result = body.results[0];
                assert.equal(result.message, 'in progress');
                assert.equal(operation.getStatusCode(), 200);
            };
            assertResponse('0', [createPendingRecord(0)], check, done);
        });

        it('should return cancelled record', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.id, '0');
                assert(body.declaration, 'Response has no declaration');
                assert(Array.isArray(body.results), 'Results is not an array');
                const result = body.results[0];
                assert.equal(result.message, 'task cancelled');
                assert.equal(operation.getStatusCode(), 200);
            };
            assertResponse('0', [createCancelledRecord(0)], check, done);
        });

        it('should return 404 on missing record', (done) => {
            const check = (operation) => {
                assert.equal(operation.getStatusCode(), 404);
            };
            assertResponse('waldo', [createRecord(0), createRecord(1)], check, done);
        });

        it('should return traces', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.items.length, 2);
                assert.equal(operation.getStatusCode(), 200);
                body.items.forEach((item) => {
                    assert.deepStrictEqual(item.traces, createResponse().response.traces);
                });
            };
            assertResponse(undefined, [createRecord(0), createRecord(1)], check, done);
        });
        it('should return selfLink', (done) => {
            const check = (operation) => {
                const body = operation.getBody();
                assert.equal(body.items.length, 2);
                assert.equal(operation.getStatusCode(), 200);
                body.items.forEach((item) => {
                    assert.deepStrictEqual(item.selfLink, createResponse().response.selfLink.concat(item.id));
                });
            };
            assertResponse(undefined, [createRecord(0), createRecord(1)], check, done);
        });
    });

    describe('.asyncReturn()', () => {
        const context = {
            tasks: [{}],
            currentIndex: 0
        };

        it('should allow overwriting the status code', () => {
            function assertCode(code, expectCode) {
                const asyncHandler = new AsyncHandler();
                const resultCode = asyncHandler.asyncReturn(context, 'message', 'uuid', code).statusCode;
                assert.strictEqual(resultCode, expectCode);
            }
            assertCode(undefined, 202);
            assertCode(500, 500);
        });

        it('should return a task like object as the body', () => {
            const asyncHandler = new AsyncHandler();
            const uuid = 'uuid';
            const message = 'custom message';
            const body = asyncHandler.asyncReturn(context, message, uuid).body;
            assert.equal(body.id, uuid);
            assert(Array.isArray(body.results), 'Body does not contain a results array');
            assert.equal(body.results[0].message, message);
            assert(body.declaration, 'Body does not contain a declaration');
        });
    });

    describe('.updatePending()', () => {
        it('should update pending to cancelled', () => {
            const asyncHandler = new AsyncHandler();
            asyncHandler.records.push(createPendingRecord(0));
            asyncHandler.updatePending();
            assert.strictEqual(asyncHandler.records[0].status, 'cancelled');
        });

        it('should only update pending tasks', () => {
            const asyncHandler = new AsyncHandler();
            const pendingRecord = createPendingRecord(0);
            // records come back in descending timestamp order so ensure that timestamps are not equal
            pendingRecord.timestamp = `${pendingRecord.timestamp + 100}`;
            asyncHandler.records.push(pendingRecord);
            asyncHandler.records.push(createRecord(1));
            asyncHandler.updatePending();
            assert.strictEqual(asyncHandler.records[0].status, 'cancelled');
            assert.strictEqual(asyncHandler.records[1].status, 'complete');
        });

        it('should update pending to cancelled when the context method is not Get', () => {
            const context = {
                request: {
                    method: 'Foo'
                }
            };
            const asyncHandler = new AsyncHandler();
            asyncHandler.records.push(createPendingRecord(0));
            asyncHandler.updatePending(context);
            assert.strictEqual(asyncHandler.records[0].status, 'cancelled');
        });

        it('should not update pending to cancelled when the context method is Get', () => {
            const context = {
                request: {
                    method: 'Get'
                },
                tasks: [
                    { action: '' }
                ]
            };
            const asyncHandler = new AsyncHandler();
            asyncHandler.records.push(createPendingRecord(0));
            asyncHandler.updatePending(context);
            assert.strictEqual(asyncHandler.records[0].status, 'pending');
        });
    });
});

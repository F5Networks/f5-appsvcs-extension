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

const sinon = require('sinon');
const assert = require('assert');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const util = require('../../../src/lib/util/util');
const mutex = require('../../../src/lib/mutex');
const Context = require('../../../src/lib/context/context');

describe('mutex', () => {
    let iControlStub;
    let clock;
    let context;

    beforeEach(() => {
        iControlStub = sinon.stub(util, 'iControlRequest').resolves();
        sinon.stub(promiseUtil, 'delay').resolves();
        clock = sinon.useFakeTimers();
        context = Context.build();
    });

    afterEach(() => {
        sinon.restore();
        clock.restore();
    });

    describe('.acquireMutexLock', () => {
        function mutexFailure(message) {
            return {
                message,
                statusCode: 503,
                type: 'mutex_failure'
            };
        }

        it('should throw a mutex_failure error on failure', () => {
            iControlStub.rejects('bad request');

            return mutex.acquireMutexLock(context)
                .then(() => assert.fail('should have thrown an error'))
                .catch((err) => {
                    assert.deepEqual(err, mutexFailure('bad request'));
                });
        });

        it('should throw a mutex_failure error when lock request does not get an HTTP 200 or 409', () => {
            iControlStub.resolves({
                statusCode: 401
            });
            return mutex.acquireMutexLock(context)
                .then(() => assert.fail('should have thrown an error'))
                .catch((err) => {
                    assert.deepEqual(err, mutexFailure('Error: Failed to acquire global lock with status: 401'));
                });
        });

        it('should return success and refresher when data group lock is acquired', () => {
            iControlStub.resolves({
                statusCode: 200
            });

            // Get actual Timeout objects for this test
            clock.restore();

            return mutex.acquireMutexLock(context)
                .then((response) => {
                    // clean up the refresher
                    clearInterval(response.refresher);

                    assert.strictEqual(response.status, 'success');
                    assert.ok(response.refresher);
                });
        });

        it('should create a refresher which refreshes the appsvcs lock on intervals', () => {
            iControlStub.resolves({
                statusCode: 200
            });

            function expected(delay) {
                return {
                    crude: true,
                    ctype: 'application/json',
                    method: 'PATCH',
                    path: '/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~____appsvcs_lock',
                    send: `{"description":${delay}}`,
                    why: 'Refreshing global lock'
                };
            }

            return mutex.acquireMutexLock(context)
                .then(() => {
                    // 3 minutes; aka: 2 'ticks' of refresher
                    const twoIntervals = (2 * 90 * 1000);
                    clock.tick(twoIntervals);

                    const firstRefresh = iControlStub.args[1][1];
                    const secondRefresh = iControlStub.args[2][1];

                    assert.deepEqual(firstRefresh, expected(twoIntervals / 2));
                    assert.deepEqual(secondRefresh, expected(twoIntervals));
                });
        });

        describe('existing locks', () => {
            let callCount;
            let statusCodes = {};
            let iControlBody;

            beforeEach(() => {
                callCount = 0;
                iControlStub.callsFake(() => {
                    callCount += 1;
                    return Promise.resolve({
                        statusCode: statusCodes[callCount],
                        body: iControlBody
                    });
                });
            });

            it('should check if existing lock is expired and return error if it could not stop scripts', () => {
                statusCodes = {
                    1: 409, // Already locked
                    2: 404, // Lock is gone after retry
                    3: 503 // Failed to request scripts to stop
                };

                return mutex.acquireMutexLock(context)
                    .then(() => assert.fail('should have thrown an error'))
                    .catch((err) => {
                        assert.deepEqual(err, mutexFailure('Error: Failed to request scripts stop running with status: 503'));
                    });
            });

            it('should delete lock if it is expired', () => {
                statusCodes = {
                    1: 409, // Already locked
                    2: 200, // Lock exists
                    3: 200, // able to request scripts to stop
                    4: 200, // able to get lock
                    5: 200 // should post clean-up task
                };
                iControlBody = JSON.stringify({
                    description: 99
                });

                // Get actual Timeout objects for this test
                clock.restore();
                context.control = {};
                return mutex.acquireMutexLock(context)
                    .then((response) => {
                        const removeLockRequest = iControlStub.args[2][1];
                        // clean up the refresher
                        clearInterval(response.refresher);

                        assert.strictEqual(response.status, 'success');
                        assert.deepEqual(removeLockRequest, {
                            crude: true,
                            ctype: 'application/json',
                            method: 'DELETE',
                            path: '/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~____appsvcs_lock',
                            why: 'Deleting expired global lock'
                        });
                    });
            });

            it('should throw an error if an existing lock is not expired', () => {
                statusCodes = {
                    1: 409, // Already locked
                    2: 200 // Lock exists
                };
                iControlBody = JSON.stringify({
                    description: 99
                });

                context.target = { host: 'localhost' };

                return mutex.acquireMutexLock(context)
                    .then(() => assert.fail('should have thrown an error'))
                    .catch((err) => {
                        assert.deepEqual(err, mutexFailure('Error: Configuration operation in '
                            + 'progress on device localhost, please try again in 2 minutes'));
                    });
            });

            it('should check if existing lock is expired and return error on second failure to get lock', () => {
                statusCodes = {
                    1: 409, // Already locked
                    2: 404, // Lock is gone after retry
                    3: 200, // able to request scripts to stop
                    4: 404 // still couldn't get lock
                };

                return mutex.acquireMutexLock(context)
                    .then(() => assert.fail('should have thrown an error'))
                    .catch((err) => {
                        assert.deepEqual(err, mutexFailure('Error: Failed to acquire global lock '
                            + 'on second attempt with status: 404'));
                    });
            });

            it('should check if existing lock is expired and clean up when a lock is acquired on retry', () => {
                statusCodes = {
                    1: 409, // Already locked
                    2: 404, // Lock is gone after retry
                    3: 200, // able to request scripts to stop
                    4: 200, // able to get lock
                    5: 200 // should post clean-up task
                };

                return mutex.acquireMutexLock(context)
                    .then((response) => {
                        const cleanUpRequest = iControlStub.args.pop()[1];

                        assert.strictEqual(response.status, 'success');
                        assert.deepEqual(cleanUpRequest, {
                            ctype: 'application/json',
                            method: 'DELETE',
                            path: '/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~____appsvcs_scripts_stop',
                            why: 'Cleaning up the request for scripts to stop modifying tenants'
                        });
                    });
            });
        });
    });

    describe('.releaseMutexLock', () => {
        it('should DELETE data group lock', () => mutex.releaseMutexLock(context, 'refresher')
            .then(() => {
                const iControlOptions = iControlStub.args[0][1];
                const expectedOptions = {
                    path: '/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~____appsvcs_lock',
                    method: 'DELETE',
                    ctype: 'application/json',
                    why: 'Attempting to release global lock'
                };
                assert.deepEqual(iControlOptions, expectedOptions);
            }));

        it('should clear the mutex refresher', () => {
            let refresherCalled = false;
            const refresher = setInterval(() => {
                refresherCalled = true;
                assert.fail('refresher should have been cleared');
            }, 100);

            return mutex.releaseMutexLock(context, { refresher })
                .then(() => {
                    clock.tick(120);
                    assert.strictEqual(refresherCalled, false);
                });
        });
    });
});

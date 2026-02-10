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

const fs = require('fs');
const propertiesCommon = require('./propertiesCommon');
const requestUtil = require('../../../common/requestUtilPromise');
const { retryWithExponentialBackoff } = require('../../../common/requestUtil');

const eventLogName = 'eventLog';

/**
 * Common function to check if an error should trigger a retry for network-related issues
 * @param {Error} error - The error to check
 * @param {boolean} includeHttpErrors - Whether to include HTTP 502/503 errors (default: false)
 * @returns {boolean} - True if the error should trigger a retry
 */
function isRetryableNetworkError(error, includeHttpErrors = false) {
    if (!error || !error.message) {
        return false;
    }

    const networkErrors = [
        'socket hang up',
        'ECONNRESET',
        'ENOTFOUND',
        'timeout',
        'ECONNREFUSED'
    ];

    const httpErrors = ['502', '503'];

    const errorsToCheck = includeHttpErrors ? [...networkErrors, ...httpErrors] : networkErrors;

    return errorsToCheck.some((errorPattern) => error.message.includes(errorPattern));
}

let globalEventStream;
let suiteEventStream;
let testInfo;

exports.mochaGlobalSetup = function () {
    return Promise.resolve()
        .then(() => mkdirPromise('test/logs'))
        .then(() => {
            // Create/truncate the event log
            fs.createWriteStream(`test/logs/${eventLogName}.log`).end();
        });
};

exports.mochaHooks = {
    beforeAll() {
        // Need a long timeout here because this function runs for the duration of
        // integration testing so it can make reservations for test suites and
        // kick them off as servers become available
        this.timeout(14400 * 1000);
        const suiteName = this.test.parent.suites[0].title;

        return Promise.resolve()
            .then(() => {
                globalEventStream = fs.createWriteStream(`test/logs/${eventLogName}.log`, { flags: 'a' });
            })
            .then(() => mkdirPromise(`test/logs/${suiteName}`))
            .then(() => {
                if (process.env.PARALLEL === 'true' && process.env.DRY_RUN !== 'true') {
                    suiteEventStream = fs.createWriteStream(`test/logs/${suiteName}/${eventLogName}.log`);
                }
                propertiesCommon.setEventStream(suiteEventStream || globalEventStream);
            })
            .then(() => {
                if (process.env.PARALLEL === 'true' && process.env.DRY_RUN !== 'true') {
                    const requestOptions = {
                        protocol: 'http:',
                        host: process.env.RESERVATION_SERVER_HOST,
                        port: process.env.RESERVATION_SERVER_PORT,
                        path: '/reservations/api/reservations',
                        body: {
                            reserved_by: suiteName,
                            server_set: process.env.SERVER_SET
                        },
                        retryInterval: 10000, // 10 seconds = 6 per minute
                        retryCount: 1440, // 6 per minute * 60 minutes per hour * 4 hours
                        retryIf: (error) => (error && error.code === 503)
                    };
                    propertiesCommon.logEvent(
                        `Making reservation for ${suiteName}`,
                        globalEventStream
                    );
                    return requestUtil.post(requestOptions);
                }
                return Promise.resolve();
            })
            .then((reservation) => {
                if (reservation) {
                    propertiesCommon.logEvent(
                        `Got reservation ${reservation.body.id} on ${reservation.body.server.ip} for ${suiteName}`,
                        globalEventStream
                    );

                    process.env.RESERVATION_ID = reservation.body.id;
                    process.env.AS3_HOST = reservation.body.server.ip;
                    process.env.AS3_USERNAME = reservation.body.server.username;
                    process.env.AS3_PASSWORD = reservation.body.server.password;
                }
            })
            .then(() => getProvisionedModulesAsync())
            .then((modules) => { propertiesCommon.setProvisionedModules(modules); })
            .then(getBigIpVersionAsync)
            .then((version) => { propertiesCommon.setBigIpVersion(version); })
            .then(() => {
                if (propertiesCommon.getDefaultOptions().dryRun) {
                    return Promise.resolve();
                }
                return Promise.resolve()
                    .then(() => propertiesCommon.deleteDeclaration())
                    .catch((error) => {
                        error.message = `Unable to clear AS3 state: ${error.message}`;
                        throw error;
                    });
            });
    },

    beforeEach() {
        this.timeout(300000);
        testInfo = getTestInfo(this.currentTest);
        propertiesCommon.setTestInfo(testInfo);
        propertiesCommon.logEvent(`========== STARTING ==========\n  ${testInfo.suiteName}.${testInfo.testName}`);
        propertiesCommon.logEvent(`Running on ${process.env.AS3_HOST}`);
        return mkdirPromise(testInfo.testDir)
            .then(() => {
                if (!propertiesCommon.getDefaultOptions().dryRun) {
                    return Promise.resolve()
                        .then(() => propertiesCommon.getAuthToken())
                        .then((token) => {
                            propertiesCommon.getDefaultOptions().token = token;
                        })
                        .then(() => {
                            // Clean AS3 state before each test to prevent "no change" issues
                            propertiesCommon.logEvent('Cleaning AS3 state before test...');

                            // Use centralized retry for AS3 cleanup with network error handling
                            const cleanupFunction = () => propertiesCommon.deleteDeclaration();
                            const shouldRetryCleanup = (error) => isRetryableNetworkError(error, true);

                            return retryWithExponentialBackoff(
                                cleanupFunction,
                                3, // maxRetries
                                2000, // initialDelay (2 seconds)
                                2, // backoffMultiplier
                                shouldRetryCleanup
                            );
                        })
                        .catch((error) => {
                            error.message = `Unable to fetch auth token or clean AS3 state: ${error.message}`;
                            throw error;
                        });
                }
                return Promise.resolve();
            });
    },

    afterEach() {
        this.timeout(300000);
        propertiesCommon.logEvent(`COMPLETED ${testInfo.suiteName}.${testInfo.testName}`);
        const token = propertiesCommon.getDefaultOptions().token;
        let promise = Promise.resolve();
        if (token) {
            promise = promise.then(() => propertiesCommon.removeToken(token));
        }

        return promise;
    },

    afterAll() {
        let promise = Promise.resolve();
        if (process.env.PARALLEL && process.env.RESERVATION_ID && process.env.DRY_RUN !== 'true') {
            const requestOptions = {
                protocol: 'http:',
                host: process.env.RESERVATION_SERVER_HOST,
                port: process.env.RESERVATION_SERVER_PORT,
                path: `/reservations/api/reservations/id/${process.env.RESERVATION_ID}`
            };
            propertiesCommon.logEvent(
                `Deleting reservation ${process.env.RESERVATION_ID}`,
                globalEventStream
            );
            promise = promise.then(() => requestUtil.delete(requestOptions));
        }
        return promise
            .then(() => {
                if (process.env.PARALLEL && process.env.RESERVATION_ID && process.env.DRY_RUN !== 'true') {
                    propertiesCommon.logEvent(
                        `Deleted reservation ${process.env.RESERVATION_ID}`,
                        globalEventStream
                    );
                }
            })
            .then(() => {
                propertiesCommon.getEventStream().end();
            });
    }
};

function getProvisionedModulesAsync() {
    if (propertiesCommon.getDefaultOptions().dryRun) {
        return Promise.resolve(['afm', 'asm', 'gtm', 'pem', 'ltm', 'avr']);
    }

    // Define the function to attempt connection
    function attemptConnection() {
        console.log('Attempting to connect to BIG-IP...');
        return Promise.resolve()
            .then(() => {
                const requestOptions = {
                    path: '/mgmt/tm/sys/provision',
                    host: process.env.TARGET_HOST || process.env.AS3_HOST,
                    retryCount: 2,
                    retryInterval: 1000,
                    retryIf: (error) => isRetryableNetworkError(error)
                };
                return requestUtil.get(requestOptions);
            })
            .then((response) => {
                const body = response.body;
                if (!body.items) {
                    throw new Error(`Could not find provisioned modules:\n${JSON.stringify(body, null, 2)}`);
                }

                console.log('Successfully connected to BIG-IP and retrieved module list');
                return body.items
                    .filter((m) => m.level !== 'none')
                    .map((m) => m.name);
            });
    }

    // Define retry condition for network-related errors
    const shouldRetry = (error) => isRetryableNetworkError(error);

    // Use centralized retry with exponential backoff
    return retryWithExponentialBackoff(
        attemptConnection,
        5, // maxRetries
        3000, // initialDelay (3 seconds)
        2, // backoffMultiplier
        shouldRetry
    ).catch((error) => {
        error.message = `Unable to get BIG-IP module list: ${error.message}`;
        throw error;
    });
}

function getBigIpVersionAsync() {
    if (propertiesCommon.getDefaultOptions().dryRun) {
        return Promise.resolve('100.0.0.0');
    }
    return Promise.resolve()
        .then(() => {
            const requestOptions = {
                path: '/mgmt/tm/sys/version',
                host: process.env.TARGET_HOST || process.env.AS3_HOST
            };
            return requestUtil.get(requestOptions);
        })
        .then((result) => {
            const entry = result.body.entries[Object.keys(result.body.entries)[0]];
            return entry.nestedStats.entries.Version.description;
        })
        .catch((error) => {
            error.message = `Unable to get BIG-IP version: ${error.message}`;
            throw error;
        });
}

function mkdirPromise(path) {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, { recursive: true }, (error) => {
            if (error && error.code !== 'EEXIST') reject(error);
            else resolve();
        });
    });
}

function getTestInfo(currentTest) {
    const suiteName = currentTest.parent.title;
    const testName = currentTest.title;
    const testDir = `test/logs/${suiteName}/${testName}`;
    return {
        suiteName,
        testName,
        testDir
    };
}

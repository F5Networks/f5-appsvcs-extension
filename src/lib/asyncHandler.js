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

const log = require('./log');
const util = require('./util/util');
const JsonDataStore = require('./JsonDataStore');

const STATUS_CODES = require('./constants').STATUS_CODES;

const EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 1 week in ms
const MAX_RECORDS = 25;
const STORAGE_NAME = 'as3_async_records';

class AsyncHandler {
    constructor(dataStore) {
        this.dataStore = dataStore || new JsonDataStore();
        this.records = [];
    }

    restoreState() {
        return this.dataStore.load(STORAGE_NAME)
            .then((data) => {
                this.records = JSON.parse(data);
            })
            .catch((error) => {
                // Record does not exist yet, let's create it
                if (error.message.indexOf('was not found') > -1
                || (error.statusCode && error.statusCode === 404)) {
                    return this.saveState();
                }
                throw error;
            });
    }

    saveState() {
        return this.dataStore.save(STORAGE_NAME, JSON.stringify(this.records));
    }

    /**
     * Gets the results of an asynchronous request.
     *
     * NOTE: records that have expired will be deleted
     * when a non-get is received.  This allows us to prevent
     * a huge number of leftover records being left in the
     * data-groups.
     *
     * We always get all of the records so we can delete
     * expired records.
     *
     * The records expire after EXPIRE_TIME.
     *
     * @param {object} restOperation The rest operation
     * @returns {void}
     */
    getAsyncResponse(restOperation) {
        const requestBody = restOperation.getBody();
        const requestId = restOperation.getUri().pathname.split('/')[4];

        if (requestBody !== null && (requestBody.class !== 'AS3' || requestBody.action !== 'retrieve')) {
            const message = 'Class must be AS3 and may only use retrieve action for task endpoint!';
            log.error(message);
            restOperation.setStatusCode(400);
            restOperation.setBody({ message });
            restOperation.complete();
            return;
        }

        function getResults(record) {
            if (record.results && record.results.response) {
                const response = record.results.response;

                if (response.results) {
                    return response.results;
                }

                return [response];
            }

            return [{
                message: record.status === 'cancelled' ? 'task cancelled' : 'in progress',
                tenant: '',
                host: '',
                runTime: 0,
                code: 0,
                declarationId: record.declarationId
            }];
        }

        function getDeclaration(record) {
            if (record.results && record.results.response && record.results.response.declaration) {
                return record.results.response.declaration;
            }
            return {};
        }

        function getTraces(record) {
            return util.getDeepValue(record, 'results.response.traces');
        }

        let results = this.records;
        if (requestId) {
            results = results.filter((r) => r.name === requestId);
        }

        results = results.map((r) => ({
            id: r.name,
            results: getResults(r),
            declaration: getDeclaration(r),
            selfLink: `https://localhost/mgmt/shared/appsvcs/task/${r.name}`,
            traces: getTraces(r)
        }));

        if (requestId && results.length < 1) {
            const message = `No record found with ID of ${requestId}`;
            log.debug(message);
            restOperation.setStatusCode(404);
            restOperation.setBody({ message });
            restOperation.complete();
        } else {
            restOperation.setStatusCode(200);
            restOperation.setBody(requestId ? results[0] : { items: results });
            restOperation.complete();
        }

        Promise.resolve();
    }

    cleanRecords(context) {
        if (shouldTakeAction(context)) {
            const currentTime = Date.now();
            const pendingRecords = this.records
                .filter((r) => r.status === 'pending')
                .filter((r) => currentTime - r.timestamp < EXPIRE_TIME);
            this.records = this.records
                .filter((r) => currentTime - r.timestamp < EXPIRE_TIME)
                .filter((r) => r.status !== 'pending')
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_RECORDS)
                .concat(pendingRecords)
                .sort((a, b) => b.timestamp - a.timestamp);

            this.saveState();
        }
    }

    updatePending(context) {
        if (shouldTakeAction(context)) {
            this.records = this.records.map((record) => {
                if (record.status === 'pending') {
                    record.status = 'cancelled';
                }
                return record;
            });

            this.cleanRecords(context);
            this.saveState();
        }
    }

    handleRecord(context, method, asyncUuid, results, customMessage) {
        if (shouldTakeAction(context)) {
            if (method === 'POST') {
                if (results && results.id) {
                    this.records.unshift({
                        name: asyncUuid,
                        timestamp: Date.now(),
                        status: 'pending',
                        declarationId: results.id
                    });
                } else {
                    this.records.unshift({
                        name: asyncUuid,
                        timestamp: Date.now(),
                        status: 'pending'
                    });
                }
            } else if (method === 'PATCH') {
                const record = this.records.find((r) => r.name === asyncUuid);
                record.status = 'complete';
                record.results = results;
            } else if (method === 'DELETE') {
                this.records = this.records.filter((r) => r.name !== asyncUuid);
            }

            this.saveState();
        }
        const defaultMessage = method === 'POST' ? 'Declaration successfully submitted' : `Async task ${asyncUuid} successfully updated.`;
        return Promise.resolve(this.asyncReturn(context, customMessage || defaultMessage, asyncUuid));
    }

    buildResult(statusCode, body) {
        return {
            statusCode,
            body
        };
    }

    buildResponseBody(context, message, asyncUuid) {
        const response = {
            id: asyncUuid,
            results: [{
                message,
                tenant: '',
                host: '',
                runTime: 0,
                code: 0
            }],
            declaration: {},
            selfLink: `https://localhost/mgmt/shared/appsvcs/task/${asyncUuid}`
        };

        const currentTask = context.tasks.find((task) => task.asyncUuid === asyncUuid);
        if (currentTask && currentTask.declaration) {
            response.results[0].declarationId = currentTask.declaration.id;
        }

        return response;
    }

    asyncReturn(context, message, asyncUuid, statusCode) {
        if (!statusCode) {
            statusCode = STATUS_CODES.ACCEPTED;
        }
        const resultBody = this.buildResponseBody(context, message, asyncUuid);
        return this.buildResult(statusCode, resultBody);
    }
}

/**
 * We don't want to do anything on GETs because that causes the data group
 * to by synced in an HA pair which causes the BIG-IP state to go to 'CHANGES
 * PENDING' which we shouldn't on a GET
 */
function shouldTakeAction(context) {
    if (context
        && context.request
        && context.request.method.toLowerCase() === 'get') {
        return false;
    }
    return true;
}

module.exports = AsyncHandler;

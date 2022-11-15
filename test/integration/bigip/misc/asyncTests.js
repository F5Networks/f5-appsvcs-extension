/**
 * Copyright 2022 F5 Networks, Inc.
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

chai.use(chaiAsPromised);
const assert = chai.assert;

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const requestUtil = require('../../../common/requestUtilPromise');
const {
    sendDeclaration,
    deleteDeclaration,
    patch,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

function _checkForCompleteStatus(id) {
    return requestUtil.get({ path: `/mgmt/shared/appsvcs/task/${id}` })
        .then((response) => {
            // If any result still has a code of 0, the request is still processing
            const results = response.body.results;
            if (results.some((r) => r.code === 0)) {
                assert(results.some((r) => r.message === 'in progress'));
                return promiseUtil.delay(1000).then(() => _checkForCompleteStatus(id));
            }
            return response.body;
        });
}

describe('Test Async', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration()); // Clear out the BIG-IP after each run

    it('should test async with POST and PATCH', () => {
        // PATCH requires something on the BIG-IP so I combined POST and PATCH
        const postDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Async_Test: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['198.19.192.231'],
                        pool: 'simple_pool'
                    },
                    simple_pool: {
                        class: 'Pool',
                        monitors: ['http'],
                        members: [
                            {
                                enable: true,
                                servicePort: 443,
                                serverAddresses: ['198.19.192.60', '198.19.192.62']
                            }
                        ]
                    }
                }
            }
        };

        const patchDecl = [
            {
                op: 'add',
                path: '/Async_Test/A1/serviceMain/virtualAddresses/1',
                value: '198.19.192.232'
            }
        ];

        return Promise.resolve()
            .then(() => sendDeclaration(postDecl, '?async=true'))
            .then((response) => {
                assert.strictEqual(response.body.results[0].code, 0);
                assert.strictEqual(response.body.results[0].message, 'Declaration successfully submitted');
                return _checkForCompleteStatus(response.body.id);
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                return patch('/mgmt/shared/appsvcs/declare?async=true', patchDecl);
            })
            .then((response) => {
                assert.strictEqual(response.body.results[0].code, 0);
                assert.strictEqual(response.body.results[0].message, 'Declaration successfully submitted');
                return _checkForCompleteStatus(response.body.id);
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            });
    });

    it('should test async with invalid POST', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.6.0',
            'f5*com': { class: 'Tenant' },
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            }
        };

        return Promise.resolve()
            .then(() => sendDeclaration(declaration, '?async=true'))
            .then((response) => {
                assert.strictEqual(response.body.results[0].code, 0);
                assert.strictEqual(response.body.results[0].message, 'Declaration successfully submitted');
                return _checkForCompleteStatus(response.body.id);
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration is invalid');
            });
    });

    it('should test clearing out all the tasks after POST', () => {
        const declaration = {
            class: 'AS3',
            action: 'deploy',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'fghijkl7890',
                label: 'Sample 1',
                remark: 'HTTP with custom persistence',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                Sample_http_01: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        template: 'http',
                        serviceMain: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['10.0.6.10'],
                            pool: 'web_pool',
                            persistenceMethods: [{ use: 'jsessionid' }]
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: ['http'],
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: ['192.0.6.10', '192.0.6.11']
                                }
                            ]
                        },
                        jsessionid: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'JSESSIONID'
                        }
                    }
                }
            }
        };

        let taskCount;
        return Promise.resolve()
            .then(() => getPath('/mgmt/shared/appsvcs/task'))
            .then((response) => {
                taskCount = response.items.length;
            })
            .then(() => sendDeclaration(declaration, '?async=true'))
            .then((response) => {
                assert.strictEqual(response.body.results[0].code, 0);
                assert.strictEqual(response.body.results[0].message, 'Declaration successfully submitted');
                return _checkForCompleteStatus(response.body.id);
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                return getPath('/mgmt/shared/appsvcs/task'); // pull all current tasks
            })
            .then((response) => assert(taskCount >= response.items.length));
    });
});

/**
 * Copyright 2024 F5, Inc.
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

const nock = require('nock');
const assert = require('assert');
const bigiq = require('../../../src/lib/bigiq');
const Context = require('../../../src/lib/context/context');

describe('bigiq', () => {
    let context;
    beforeEach(() => {
        context = Context.build();
        context.control = {
            targetHost: 'my.device.com'
        };
        context.tasks.push({ urlPrefix: 'https://localhost' });
        context.target.tmosVersion = '7.0.0';
        context.target.tokens = {
            'X-F5-Auth-Token': 'Credentials written in crayon'
        };
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('deployTenant', () => {
        describe('modify payload', () => {
            let receivedDeclaration;

            beforeEach(() => {
                receivedDeclaration = null;

                const taskEndpoint = '/my/path';
                nock('https://localhost')
                    .persist()
                    .post('/mgmt/cm/global/tasks/deploy-app-service')
                    .reply((uri, requestBody, cb) => {
                        receivedDeclaration = requestBody.declaration;
                        cb(null, [200, {
                            selfLink: `https://localhost${taskEndpoint}`
                        }]);
                    });

                nock('https://localhost')
                    .persist()
                    .get(taskEndpoint)
                    .reply((uri, requestBody, cb) => {
                        cb(null, [200, {
                            status: 'FINISHED'
                        }]);
                    });
            });

            it('should send Common with other tenants', () => {
                const declaration = {
                    target: 'my.device.com',
                    Common: {
                        class: 'Tenant'
                    },
                    Tenant1: {
                        class: 'Tenant'
                    },
                    Tenant2: {
                        class: 'Tenant'
                    }
                };

                return Promise.resolve()
                    .then(() => bigiq.deployTenant(context, 'Common', declaration))
                    .then((result) => {
                        assert.equal(result.message, 'no change: Common is being processed as part of other tenants');
                    })
                    .then(() => bigiq.deployTenant(context, 'Tenant1', declaration))
                    .then(() => {
                        assert(receivedDeclaration.Common, 'Common was not sent');
                        assert(receivedDeclaration.Tenant1, 'Tenant1 was not sent');
                        assert(!receivedDeclaration.Tenant2, 'Tenant2 not sent');
                    })
                    .then(() => bigiq.deployTenant(context, 'Tenant2', declaration))
                    .then(() => {
                        assert(receivedDeclaration.Common, 'Common was not sent');
                        assert(!receivedDeclaration.Tenant1, 'Tenant1 not sent');
                        assert(receivedDeclaration.Tenant2, 'Tenant2 was not sent');
                    });
            });

            it('should send Common when no other tenants are configured', () => {
                const declaration = {
                    target: 'my.device.com',
                    Common: {
                        class: 'Tenant'
                    }
                };

                return Promise.resolve()
                    .then(() => bigiq.deployTenant(context, 'Common', declaration))
                    .then(() => {
                        assert(receivedDeclaration.Common, 'Common was not sent');
                    });
            });

            it('should send dry-run action to BIG-IQ via controls', () => {
                context.tasks[0] = {
                    action: 'deploy',
                    dryRun: true,
                    urlPrefix: 'https://localhost'
                };
                const declaration = {
                    target: 'my.device.com'
                };

                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then((results) => {
                        assert.strictEqual(receivedDeclaration.controls.internalUse.action, 'dry-run');
                        assert.deepStrictEqual(
                            results,
                            {
                                message: 'success',
                                dryRun: true,
                                resources: undefined
                            }
                        );
                    });
            });

            it('should send userAgent to BIG-IQ', () => {
                const declaration = {
                    target: 'my.device.com'
                };

                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then(() => {
                        assert.strictEqual(
                            receivedDeclaration.controls.userAgent,
                            'BIG-IQ/7.0 Configured by API'
                        );
                    });
            });

            it('should overwrite userAgent when sending to BIG-IQ', () => {
                const declaration = {
                    target: 'my.device.com',
                    controls: {
                        userAgent: 'AS3 Testing'
                    }
                };

                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then(() => {
                        assert.strictEqual(
                            receivedDeclaration.controls.userAgent,
                            'BIG-IQ/7.0 Configured by API'
                        );
                    });
            });
        });

        describe('wait for completion', () => {
            let receivedPath;
            let completionStatus;
            let secondaryStatus;
            let response;
            let waitCalls;

            beforeEach(() => {
                waitCalls = 0;
                const taskEndpoint = '/my/path';
                nock('https://localhost')
                    .post('/mgmt/cm/global/tasks/deploy-app-service')
                    .reply((uri, requestBody, cb) => {
                        cb(null, [200, {
                            selfLink: `https://localhost${taskEndpoint}`
                        }]);
                    });

                nock('https://localhost')
                    .persist()
                    .get(taskEndpoint)
                    .reply((uri, requestBody, cb) => {
                        receivedPath = uri;
                        waitCalls += 1;
                        const status = waitCalls === 1 ? completionStatus : secondaryStatus;
                        response = { status };
                        cb(null, [200, response]);
                    });
            });

            it('should wait for handle path', () => {
                const declaration = {
                    target: 'my.device.com'
                };

                completionStatus = 'FINISHED';
                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then((res) => {
                        assert.strictEqual(receivedPath, '/my/path');
                        assert.strictEqual(res.message, 'success');
                    })
                    .catch((err) => Promise.reject(err));
            });

            it('should handle failed task', () => {
                const declaration = {
                    target: 'my.device.com'
                };

                completionStatus = 'FAILED';

                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then((res) => {
                        assert.strictEqual(res.message, 'failed');
                    })
                    .catch((err) => Promise.reject(err));
            });

            it('should handle canceled task', () => {
                const declaration = {
                    target: 'my.device.com'
                };

                completionStatus = 'CANCELED';

                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then((res) => {
                        assert.strictEqual(res.message, 'failed');
                    })
                    .catch((err) => Promise.reject(err));
            });

            it('should handle started then finished task', () => {
                const declaration = {
                    target: 'my.device.com'
                };

                completionStatus = 'STARTED';
                secondaryStatus = 'FINISHED';

                return bigiq.deployTenant(context, 'tenantId', declaration)
                    .then((res) => {
                        assert.strictEqual(res.message, 'success');
                    })
                    .catch((err) => Promise.reject(err));
            });
        });
    });
});

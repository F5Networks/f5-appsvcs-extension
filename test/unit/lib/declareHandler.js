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
const nock = require('nock');
const proxyquire = require('proxyquire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const uuid = require('uuid');

chai.use(chaiAsPromised);
const assert = chai.assert;

const DeclarationHandler = require('../../../src/lib/declarationHandler');
const RestOperationMock = require('../RestOperationMock');
const Context = require('../../../src/lib/context/context');
const AsyncHandler = require('../../../src/lib/asyncHandler');
const As3Parser = require('../../../src/lib/adcParser');
const networkUtil = require('../../../src/lib/util/networkUtil');
const cloudlibsUtil = require('../../../src/lib/util/cloudLibUtils');
const restUtil = require('../../../src/lib/util/restUtil');
const util = require('../../../src/lib/util/util');
const log = require('../../../src/lib/log');
const Queue = require('../../../src/lib/queue');
const config = require('../../../src/lib/config');
const Tracer = require('../../../src/lib/tracer').Tracer;
const STATUS_CODES = require('../../../src/lib/constants').STATUS_CODES;

describe('DeclareHandler', () => {
    const mockSuccess = DeclarationHandler.buildResult(
        STATUS_CODES.OK,
        undefined,
        { results: [], declaration: {} }
    );
    const mockNewUuid = 'new-uuid-xxxx';
    const msgServDiscInstall = 'Installing service discovery components. The results of your request may be retrieved by sending a GET request to selfLink provided.';
    const msgServDiscUninstall = 'Uninstalling service discovery components. The results of your request may be retrieved by sending a GET request to selfLink provided.';
    const msgDeclSubmitted = 'Declaration successfully submitted';

    let context;
    let asyncHandler;
    let spy;
    let expectedEnqueueCount;
    let DeclareHandler;

    function assertResultAndRestComplete(con, restOp, expectedResult, expectedCode) {
        const hostCon = {};
        hostCon.asyncHandler = asyncHandler;
        hostCon.parser = new As3Parser();
        con.host = hostCon;

        const decl = new DeclareHandler();

        if (expectedCode === 503) {
            decl.queue.limit = 1;
            decl.queue.entries.push({});
        }

        return decl.process(con, restOp)
            .then(() => new Promise((resolve, reject) => {
                setImmediate(() => {
                    try {
                        if (spy.completeRequest.called) {
                            assert.isTrue(spy.completeRequest.calledOnce);
                            assert.isFalse(spy.completeRequestMultiStatus.called);
                        } else if (spy.completeRequestMultiStatus.called) {
                            assert.isTrue(spy.completeRequestMultiStatus.calledOnce);
                            assert.isFalse(spy.completeRequest.called);
                        } else {
                            assert.fail('completeRequest or completeRequestMultiStatus should have been called');
                        }

                        assert.strictEqual(spy.enqueue.callCount, expectedEnqueueCount);
                        assert.isTrue(restOp.isComplete);
                        assert.deepStrictEqual(restOp.body, expectedResult);
                        assert.strictEqual(restOp.statusCode, expectedCode);
                    } catch (error) {
                        reject(error);
                    }
                    resolve();
                });
            }));
    }

    beforeEach(() => {
        DeclareHandler = proxyquire('../../../src/lib/declareHandler', {
            './config': config
        });

        sinon.stub(networkUtil, 'setAuthzToken').resolves();
        sinon.stub(uuid, 'v4').returns(mockNewUuid);
        sinon.stub(cloudlibsUtil, 'install').resolves();
        sinon.stub(config, 'getAllSettings').resolves({
            burstHandlingEnabled: false,
            serviceDiscoveryEnabled: true
        });

        spy = {};
        spy.completeRequest = sinon.spy(restUtil, 'completeRequest');
        spy.completeRequestMultiStatus = sinon.spy(restUtil, 'completeRequestMultiStatus');
        spy.enqueue = sinon.spy(Queue.prototype, 'enqueue');

        context = Context.build(); // get a fresh default context object each run
        asyncHandler = new AsyncHandler();
        expectedEnqueueCount = 0;
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('single declaration request', () => {
        let controlsUsed;
        let reqConUsed;

        beforeEach(() => {
            sinon.stub(DeclarationHandler.prototype, 'process').callsFake((con) => {
                const result = util.simpleCopy(mockSuccess);
                result.body.declaration = Object.assign({}, con.tasks[context.currentIndex].declaration);
                controlsUsed = con.request.controls[context.currentIndex];
                reqConUsed = con.tasks[context.currentIndex];
                return Promise.resolve(result);
            });
        });

        describe('validation', () => {
            describe('query params', () => {
                let restOp;
                let message;
                let code;
                let expResult;

                beforeEach(() => {
                    code = undefined;
                    message = undefined;
                    expResult = undefined;
                    restOp = new RestOperationMock();
                    sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
                });

                it('should return error if async param has invalid value', () => {
                    context.request = {
                        method: 'Post',
                        action: 'deploy',
                        queryParams: [{ key: 'async', value: 'woohoo' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy'
                        }
                    ];

                    message = 'async must be "true" or "false"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if async param specified with invalid method', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        queryParams: [{ key: 'async', value: 'true' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve'
                        }
                    ];

                    message = 'query param "async" is not allowed for method=GET or action=retrieve.';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if show param specified with invalid value', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        queryParams: [{ key: 'show', value: 'ultra-extra-mega' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve'
                        }
                    ];

                    message = 'show must be "base", "full", or "expanded"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if age param specified with invalid method', () => {
                    context.request = {
                        method: 'Post',
                        action: 'deploy',
                        queryParams: [{ key: 'age', value: '1' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy'
                        }
                    ];

                    message = 'query param "age" is not allowed for method Post';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if age param has invalid value', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        queryParams: [{ key: 'age', value: 'young' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve'
                        }
                    ];

                    message = 'invalid age value "young" - must be a number between 0-15 or "list"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if age param is outside of max', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        queryParams: [{ key: 'age', value: '20' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve'
                        }
                    ];

                    message = 'invalid age value "20" - must be between 0-15 or "list"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if filterClass specified with invalid method', () => {
                    context.request = {
                        method: 'Delete',
                        action: 'remove',
                        queryParams: [{ key: 'filterClass', value: 'application' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove'
                        }
                    ];

                    message = 'query param "filterClass" is not allowed for method Delete';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if showHash specified with invalid method', () => {
                    context.request = {
                        method: 'Delete',
                        action: 'remove',
                        queryParams: [{ key: 'showHash', value: 'true' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove'
                        }
                    ];

                    message = 'query param "showHash" is not allowed for method Delete';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if showHash has invalid value', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        queryParams: [{ key: 'showHash', value: 'always' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve'
                        }
                    ];

                    message = 'showHash must be "true" or "false"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if unsupported query param', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        queryParams: [{ key: 'notallowed', value: 'please' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve'
                        }
                    ];

                    message = 'unrecognized URL query parameter "notallowed"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if controls.logLevel is invalid value', () => {
                    context.request = {
                        method: 'POST',
                        action: 'deploy',
                        queryParams: [{ key: 'controls.logLevel', value: 'invalid' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            declaration: {
                                class: 'ADC',
                                controls: {
                                    class: 'Controls',
                                    logLevel: 'debug'
                                }
                            }
                        }
                    ];

                    message = 'logLevel must be "emergency", "alert", "critical", "error", "warning", "notice", "info", or "debug"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if controls.trace is invalid value', () => {
                    context.request = {
                        method: 'POST',
                        action: 'deploy',
                        queryParams: [{ key: 'controls.trace', value: 'invalid' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            declaration: {
                                class: 'ADC',
                                controls: {
                                    class: 'Controls',
                                    trace: false
                                }
                            }
                        }
                    ];

                    message = 'trace must be "true" or "false"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if controls.traceResponse is invalid value', () => {
                    context.request = {
                        method: 'POST',
                        action: 'deploy',
                        queryParams: [{ key: 'controls.traceResponse', value: 'invalid' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            declaration: {
                                class: 'ADC',
                                controls: {
                                    class: 'Controls',
                                    traceResponse: false
                                }
                            }
                        }
                    ];

                    message = 'traceResponse must be "true" or "false"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if controls.dryRun is invalid value', () => {
                    context.request = {
                        method: 'POST',
                        action: 'deploy',
                        queryParams: [{ key: 'controls.dryRun', value: 'invalid' }],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            declaration: {
                                class: 'ADC',
                                controls: {
                                    class: 'Controls',
                                    dryRun: false
                                }
                            }
                        }
                    ];

                    message = 'dryRun must be "true" or "false"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should add queryParamControls to task when valid values are provided', () => {
                    context.request = {
                        method: 'POST',
                        action: 'deploy',
                        queryParams: [
                            { key: 'controls.traceResponse', value: 'True' },
                            { key: 'controls.trace', value: 'TRUE' },
                            { key: 'controls.logLevel', value: 'debug' },
                            { key: 'controls.dryRun', value: 'true' },
                            { key: 'controls.userAgent', value: 'theUserAgent' }
                        ],
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            declaration: {
                                class: 'ADC',
                                controls: {
                                    class: 'Controls',
                                    dryRun: false,
                                    logLevel: 'warning',
                                    traceResponse: false,
                                    trace: false,
                                    userAgent: ''
                                }
                            }
                        }
                    ];

                    const declaration = {
                        class: 'ADC',
                        controls: {
                            class: 'Controls',
                            dryRun: false,
                            logLevel: 'warning',
                            traceResponse: false,
                            trace: false,
                            userAgent: ''
                        },
                        id: 'autogen_new-uuid-xxxx'
                    };
                    const results = [];
                    code = STATUS_CODES.OK;
                    expResult = {
                        declaration,
                        results
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code)
                        .then(() => {
                            assert.deepStrictEqual(
                                context.tasks[0].queryParamControls,
                                {
                                    dryRun: true,
                                    logLevel: 'debug',
                                    trace: true,
                                    traceResponse: true,
                                    userAgent: 'theUserAgent'
                                }
                            );
                        });
                });
            });

            describe('subpath', () => {
                let restOp;
                let message;
                let code;
                let expResult;

                beforeEach(() => {
                    code = undefined;
                    message = undefined;
                    expResult = undefined;
                    restOp = new RestOperationMock();
                    sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
                });

                it('should not allow invalid tenant name', () => {
                    context.request = {
                        subPath: '0-invalid-tenant',
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'Invalid_Tenant',
                                Extra_Tenant: {
                                    class: 'Tenant'
                                }
                            }
                        }
                    ];

                    message = 'tenant(s) in the declaration does not match tenant(s) in the specified URI path. Tenants: Extra_Tenant';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should not allow another subpath after tenant', () => {
                    context.request = {
                        subPath: 'validTenant/application',
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'Subpath_After_Tenant',
                                Extra_Tenant: {
                                    class: 'Tenant'
                                }
                            }
                        }
                    ];

                    message = 'tenant(s) in the declaration does not match tenant(s) in the specified URI path. Tenants: Extra_Tenant';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if non-POST tenant in decl does not match tenants in URI', () => {
                    context.request = {
                        subPath: 'Tenant1,Tenant2',
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'Mismatched_Tenant',
                                Extra_Tenant: {
                                    class: 'Tenant'
                                }
                            }
                        }
                    ];

                    message = 'tenant(s) in the declaration does not match tenant(s) in the specified URI path. Tenants: Extra_Tenant';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should allow POST when tenants in decl dont exactly match tenants in URI', () => {
                    context.request = {
                        subPath: 'Common,Tenant1,Tenant2',
                        method: 'Post',
                        action: 'deploy',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'ExistingTenantPlusNew',
                                Tenant2: {
                                    class: 'Tenant',
                                    Application: {
                                        class: 'Application',
                                        template: 'generic',
                                        testItem: {
                                            class: 'Service_TCP',
                                            remark: 'description',
                                            virtualPort: 123,
                                            virtualAddresses: [
                                                '192.0.2.110'
                                            ]
                                        }
                                    }
                                },
                                Tenant3: {
                                    class: 'Tenant',
                                    Application: {
                                        class: 'Application',
                                        template: 'generic',
                                        testItem: {
                                            class: 'Service_TCP',
                                            remark: 'description',
                                            virtualPort: 123,
                                            virtualAddresses: [
                                                '192.0.2.110'
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ];

                    code = STATUS_CODES.OK;
                    expResult = {
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'ExistingTenantPlusNew',
                            Tenant2: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application',
                                    template: 'generic',
                                    testItem: {
                                        class: 'Service_TCP',
                                        remark: 'description',
                                        virtualPort: 123,
                                        virtualAddresses: [
                                            '192.0.2.110'
                                        ]
                                    }
                                }
                            }
                        },
                        results: mockSuccess.body.results
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });
            });

            describe('properties from AS3 class', () => {
                let restOp;
                let message;
                let code;
                let expResult;

                beforeEach(() => {
                    sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
                    code = undefined;
                    message = undefined;
                    expResult = undefined;
                    restOp = new RestOperationMock();
                });

                it('should return error if retrieveAge specified but not action retrieve', () => {
                    context.request = {
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            retrieveAge: '5'
                        }
                    ];

                    message = 'retrieveAge value is not allowed for action "remove". use only with "retrieve"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if redeployUpdateMode specified but not action redeploy', () => {
                    context.request = {
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            redeployUpdateMode: 'complete'
                        }
                    ];

                    message = 'redeployUpdateMode is valid only with action "redeploy"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if redeployAge specified but not action redeploy', () => {
                    context.request = {
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            redeployAge: '2'
                        }
                    ];

                    message = 'redeployAge is valid only with action "redeploy"';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if no declaration specified with action patch', () => {
                    context.request = {
                        method: 'Patch',
                        action: 'patch',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'patch'
                        }
                    ];

                    message = 'for action \'patch\', a patchBody must be included - refer to AS3 docs for details';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if patchBody specified but not action patch', () => {
                    context.request = {
                        method: 'Post',
                        action: 'deploy',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy',
                            patchBody: {}
                        }
                    ];

                    message = 'patchBody is valid only with action \'patch\'';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if no declaration when action is deploy', () => {
                    context.request = {
                        method: 'Post',
                        action: 'deploy',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'deploy'
                        }
                    ];

                    message = 'for action "deploy", a declaration is required.';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if declaration specified for action remove', () => {
                    context.request = {
                        method: 'Delete',
                        action: 'remove',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'remove',
                            declaration: {}
                        }
                    ];

                    message = 'for action "remove", a declaration is not allowed.';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if declaration specified for action redeploy', () => {
                    context.request = {
                        method: 'Post',
                        action: 'redeploy',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'redeploy',
                            declaration: {}
                        }
                    ];

                    message = 'for action "redeploy", a declaration is not allowed.';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if declaration specified for action patch', () => {
                    context.request = {
                        method: 'Patch',
                        action: 'patch',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'patch',
                            declaration: {},
                            patchBody: {}
                        }
                    ];

                    message = 'for action "patch", a declaration is not allowed.';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });

                it('should return error if declaration specified for action retrieve', () => {
                    context.request = {
                        method: 'Get',
                        action: 'retrieve',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };
                    context.tasks = [
                        {
                            action: 'retrieve',
                            declaration: {}
                        }
                    ];

                    message = 'for action "retrieve", a declaration is not allowed.';
                    code = STATUS_CODES.BAD_REQUEST;
                    expResult = {
                        code,
                        message
                    };
                    return assertResultAndRestComplete(context, restOp, expResult, code);
                });
            });

            describe('patch paths', () => {
                const expectedCode = STATUS_CODES.OK;
                const expectedResult = {
                    declaration: {},
                    results: []
                };

                let restOp;
                let patchBody;

                beforeEach(() => {
                    restOp = new RestOperationMock();

                    context.request = {
                        method: 'Post',
                        action: 'patch',
                        tracer: new Tracer('test tracer', { enabled: false })
                    };

                    context.tasks = [
                        {
                            class: 'AS3',
                            targetHost: 'localhost',
                            action: 'patch'
                        }
                    ];
                });

                it('should extract tenants from patch paths', () => {
                    patchBody = [
                        {
                            op: 'add',
                            path: '/Tenant2/A1/web_pool/members/0/serverAddresses/-',
                            value: '192.0.2.10'
                        },
                        {
                            op: 'add',
                            path: '/Tenant3/A2/web_pool/members/0/serverAddresses/-',
                            value: '192.0.2.10'
                        }
                    ];

                    context.request.body = { patchBody };
                    context.tasks[0].patchBody = patchBody;

                    return assertResultAndRestComplete(context, restOp, expectedResult, expectedCode)
                        .then(() => {
                            assert.deepStrictEqual(context.tasks[0].tenantsInPath, ['Tenant2', 'Tenant3']);
                        });
                });

                it('should not duplicate tenants', () => {
                    patchBody = [
                        {
                            op: 'add',
                            path: '/Tenant2/A1/web_pool/members/0/serverAddresses/-',
                            value: '192.0.2.10'
                        },
                        {
                            op: 'add',
                            path: '/Tenant2/A2/web_pool/members/0/serverAddresses/-',
                            value: '192.0.2.10'
                        },
                        {
                            op: 'add',
                            path: '/Tenant3/A2/web_pool/members/0/serverAddresses/-',
                            value: '192.0.2.10'
                        }
                    ];

                    context.request.body = { patchBody };
                    context.tasks[0].patchBody = patchBody;

                    return assertResultAndRestComplete(context, restOp, expectedResult, expectedCode)
                        .then(() => {
                            assert.deepStrictEqual(context.tasks[0].tenantsInPath, ['Tenant2', 'Tenant3']);
                        });
                });
            });
        });

        describe('body defaults and request options', () => {
            const code = STATUS_CODES.OK;
            let expResult;
            let restOp;

            beforeEach(() => {
                expResult = undefined;
                restOp = new RestOperationMock();
            });

            beforeEach(() => {
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
            });

            it('should assign autogen id when declaration is present id is "generate"', () => {
                context.request = {
                    subPath: 'TheTenant',
                    method: 'Post',
                    action: 'deploy',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'generate',
                            TheTenant: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application',
                                    template: 'generic',
                                    testItem: {
                                        class: 'Service_TCP',
                                        remark: 'description',
                                        virtualPort: 123,
                                        virtualAddresses: [
                                            '192.0.2.110'
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ];

                expResult = {
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'autogen_new-uuid-xxxx',
                        TheTenant: {
                            class: 'Tenant',
                            Application: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.110'
                                    ]
                                }
                            }
                        }
                    },
                    results: []
                };
                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => assert.deepStrictEqual(
                        controlsUsed,
                        {
                            targetHost: 'localhost',
                            targetPort: 8100,
                            timeSlip: 0,
                            protocol: 'http',
                            targetTokens: { 'X-F5-Auth-Token': 'test' },
                            urlPrefix: 'http:admin:@localhost:8100'
                        }
                    ))
                    .then(() => assert.strictEqual(context.tasks[0].asyncUuid, 'new-uuid-xxxx'));
            });

            it('should populate the declaration request object with correct options', () => {
                context.request = {
                    subPath: 'TheTenant',
                    method: 'Post',
                    action: 'deploy',
                    queryParams: [
                        { key: 'show', value: 'expanded' },
                        { key: 'showHash', value: 'true' },
                        { key: 'filterClass', value: 'application' }
                    ],
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'with-req-params',
                            TheTenant: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application',
                                    template: 'generic',
                                    testItem: {
                                        class: 'Service_TCP',
                                        remark: 'description',
                                        virtualPort: 123,
                                        virtualAddresses: [
                                            '192.0.2.110'
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ];

                expResult = {
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'with-req-params',
                        TheTenant: {
                            class: 'Tenant',
                            Application: {
                                class: 'Application',
                                template: 'generic',
                                testItem: {
                                    class: 'Service_TCP',
                                    remark: 'description',
                                    virtualPort: 123,
                                    virtualAddresses: [
                                        '192.0.2.110'
                                    ]
                                }
                            }
                        }
                    },
                    results: []
                };
                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => assert.deepStrictEqual(
                        controlsUsed,
                        {
                            targetHost: 'localhost',
                            targetPort: 8100,
                            timeSlip: 0,
                            protocol: 'http',
                            targetTokens: { 'X-F5-Auth-Token': 'test' },
                            urlPrefix: 'http:admin:@localhost:8100'
                        },
                        reqConUsed
                    ))
                    .then(() => assert.strictEqual(reqConUsed.showValues, 'expanded'))
                    .then(() => assert.strictEqual(reqConUsed.showHash, true))
                    .then(() => assert.strictEqual(reqConUsed.filterClass, 'application'))
                    .then(() => assert.strictEqual(context.tasks[0].asyncUuid, 'new-uuid-xxxx'));
            });
        });

        describe('async behaviors', () => {
            const code = STATUS_CODES.ACCEPTED;
            let restOp;

            beforeEach(() => {
                restOp = new RestOperationMock();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
            });

            it('should convert to async if declaration target needs cloudlibs/SD install', () => {
                context.request = {
                    // simulate case when we need to install during POST
                    subPath: 'TenantDeleteMe',
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            TenantDeleteMe: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                cloudlibsUtil.getIsInstalled.restore();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(false);

                const asyncRecordSpy = sinon.spy(asyncHandler, 'handleRecord');

                const expResult = {
                    id: mockNewUuid,
                    results: [{
                        code: 0,
                        host: '',
                        message: msgServDiscInstall,
                        runTime: 0,
                        tenant: ''
                    }],
                    declaration: {},
                    selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewUuid}`
                };

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        // assert controls set
                        assert.deepStrictEqual(controlsUsed, {
                            targetHost: context.tasks[0].targetHost,
                            targetPort: context.tasks[0].targetPort,
                            protocol: context.tasks[0].protocol,
                            targetTokens: context.tasks[0].targetTokens,
                            timeSlip: context.tasks[0].timeSlip,
                            urlPrefix: context.tasks[0].urlPrefix
                        });
                        assert.ok(context.tasks[0].installServiceDiscovery);
                        assert.ok(!context.tasks[0].uninstallServiceDiscovery);
                        // assert async record created
                        assert.deepStrictEqual(asyncRecordSpy.getCall(0).args,
                            [
                                context,
                                'POST',
                                mockNewUuid,
                                null,
                                msgServDiscInstall
                            ]);
                        // assert async record updated with result from handleRequest
                        assert.deepStrictEqual(asyncRecordSpy.getCall(1).args,
                            [
                                context,
                                'PATCH',
                                mockNewUuid,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: context.tasks[0].declaration,
                                        results: []
                                    }
                                }
                            ]);
                        assert.strictEqual(context.tasks[0].asyncUuid, 'new-uuid-xxxx');
                    });
            });

            it('should convert to async if declaration target needs cloudlibs/SD uninstall', () => {
                config.getAllSettings.restore();
                sinon.stub(config, 'getAllSettings').resolves({
                    burstHandlingEnabled: false,
                    serviceDiscoveryEnabled: false
                });

                context.request = {
                    // simulate case when we need to uninstall during POST
                    subPath: 'TenantDeleteMe',
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            TenantDeleteMe: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const asyncRecordSpy = sinon.spy(asyncHandler, 'handleRecord');

                const expResult = {
                    id: mockNewUuid,
                    results: [{
                        code: 0,
                        host: '',
                        message: msgServDiscUninstall,
                        runTime: 0,
                        tenant: ''
                    }],
                    declaration: {},
                    selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewUuid}`
                };

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        // assert controls set
                        assert.deepStrictEqual(controlsUsed, {
                            targetHost: context.tasks[0].targetHost,
                            targetPort: context.tasks[0].targetPort,
                            protocol: context.tasks[0].protocol,
                            targetTokens: context.tasks[0].targetTokens,
                            timeSlip: context.tasks[0].timeSlip,
                            urlPrefix: context.tasks[0].urlPrefix
                        });
                        assert.ok(!context.tasks[0].installServiceDiscovery);
                        assert.ok(context.tasks[0].uninstallServiceDiscovery);
                        // assert async record created
                        assert.deepStrictEqual(asyncRecordSpy.getCall(0).args,
                            [
                                context,
                                'POST',
                                mockNewUuid,
                                null,
                                msgServDiscUninstall
                            ]);
                        // assert async record updated with result from handleRequest
                        assert.deepStrictEqual(asyncRecordSpy.getCall(1).args,
                            [
                                context,
                                'PATCH',
                                mockNewUuid,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: context.tasks[0].declaration,
                                        results: []
                                    }
                                }
                            ]);
                        assert.strictEqual(context.tasks[0].asyncUuid, 'new-uuid-xxxx');
                    });
            });

            it('should handle async if async param is specified', () => {
                context.request = {
                    subPath: 'TenantDeleteMeAsync',
                    method: 'Post',
                    action: 'deploy',
                    queryParams: [{ key: 'async', value: 'true' }],
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            TenantDeleteMeAsync: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const expResult = {
                    id: mockNewUuid,
                    results: [{
                        code: 0,
                        host: '',
                        message: msgDeclSubmitted,
                        runTime: 0,
                        tenant: ''
                    }],
                    declaration: {},
                    selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewUuid}`
                };

                const asyncRecordSpy = sinon.spy(asyncHandler, 'handleRecord');
                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.deepStrictEqual(
                            asyncRecordSpy.getCall(0).args,
                            [
                                context,
                                'POST',
                                mockNewUuid,
                                null,
                                msgDeclSubmitted
                            ]
                        );
                        assert.deepStrictEqual(
                            asyncRecordSpy.getCall(1).args,
                            [
                                context,
                                'PATCH',
                                mockNewUuid,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: context.tasks[0].declaration,
                                        results: []
                                    }
                                }
                            ]
                        );
                    });
            });

            it('should call webhook if there is one', () => {
                config.getAllSettings.restore();
                sinon.stub(config, 'getAllSettings').resolves({
                    webhook: 'http://www.example.com/webhook'
                });

                nock('http://www.example.com')
                    .post('/webhook')
                    .reply(200);

                restOp.method = 'Post';

                context.request = {
                    // simulate case when we need to uninstall during POST
                    subPath: 'Tenant',
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            Tenant: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const expResult = {
                    id: mockNewUuid,
                    results: [{
                        code: 0,
                        host: '',
                        message: msgServDiscUninstall,
                        runTime: 0,
                        tenant: ''
                    }],
                    declaration: {},
                    selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewUuid}`
                };

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(nock.isDone());
                    });
            });
        });

        describe('sync behavior', () => {
            const code = STATUS_CODES.OK;
            let restOp;

            beforeEach(() => {
                restOp = new RestOperationMock();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
            });

            it('should handle sync', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            TenantDeleteMeSync: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const expResult = {
                    results: mockSuccess.body.results,
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'GoAsync',
                        TenantDeleteMeSync: {
                            class: 'Tenant'
                        }
                    }
                };

                return assertResultAndRestComplete(context, restOp, expResult, code);
            });
        });

        describe('cloudlibs behavior', () => {
            let expResult;
            let code;
            let restOp;
            let getIsInstalledCalled;

            beforeEach(() => {
                expResult = {
                    results: mockSuccess.body.results,
                    declaration: {
                        id: `autogen_${mockNewUuid}`
                    }
                };
                code = STATUS_CODES.OK;
                getIsInstalledCalled = false;
                restOp = new RestOperationMock();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').callsFake(() => {
                    getIsInstalledCalled = true;
                    return Promise.resolve(true);
                });
            });

            it('should perform cloudlibs check', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        action: 'deploy',
                        declaration: {},
                        targetTokens: 'something'
                    }
                ];

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(getIsInstalledCalled, 'cloudlibsUtil.getIsInstalled should have been called');
                    });
            });

            it('should skip cloudlibs check if targetHost is localhost', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        action: 'deploy',
                        declaration: {}
                    }
                ];

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(!getIsInstalledCalled, 'cloudlibsUtil.getIsInstalled should have been skipped');
                    });
            });

            it('should skip cloudlibs check if targetHost is 127.0.0.1', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '127.0.0.1',
                        action: 'deploy',
                        declaration: {}
                    }
                ];

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(!getIsInstalledCalled, 'cloudlibsUtil.getIsInstalled should have been skipped');
                    });
            });

            it('should skip cloudlibs check if request is not to declare endpoint', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'info',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        action: 'deploy',
                        declaration: {}
                    }
                ];

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(!getIsInstalledCalled, 'cloudlibsUtil.getIsInstalled should have been skipped');
                    });
            });

            it('should skip cloudlibs check if GET request', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        action: 'retrieve'
                    }
                ];

                expResult.declaration = {};

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(!getIsInstalledCalled, 'cloudlibsUtil.getIsInstalled should have been skipped');
                    });
            });

            it('should skip cloudlibs check if the controls.targetTokens is an empty object', () => {
                sinon.stub(log, 'warning');

                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.8',
                        action: 'deploy',
                        declaration: {}
                    }
                ];

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.ok(!getIsInstalledCalled, 'cloudlibsUtil.getIsInstalled should have been skipped');
                    });
            });
        });

        describe('burst handling', () => {
            const code = STATUS_CODES.OK;
            let restOp;

            beforeEach(() => {
                restOp = new RestOperationMock();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
            });

            it('should pass request context to queue when enabled', () => {
                config.getAllSettings.restore();
                sinon.stub(config, 'getAllSettings').resolves({
                    burstHandlingEnabled: true,
                    serviceDiscoveryEnabled: true
                });

                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            TenantDeleteMeSync: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const expResult = {
                    results: mockSuccess.body.results,
                    declaration: {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'GoAsync',
                        TenantDeleteMeSync: {
                            class: 'Tenant'
                        }
                    }
                };

                expectedEnqueueCount = 1;
                return assertResultAndRestComplete(context, restOp, expResult, code);
            });

            it('should cancel task when queue is full and error hit', () => {
                config.getAllSettings.restore();
                sinon.stub(config, 'getAllSettings').resolves({
                    burstHandlingEnabled: true,
                    serviceDiscoveryEnabled: true
                });

                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: 'localhost',
                        targetPort: 8100,
                        protocol: 'http',
                        urlPrefix: 'http:admin:@localhost:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'test' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'GoAsync',
                            TenantDeleteMeSync: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];
                asyncHandler.records.push(
                    {
                        name: 0,
                        timestamp: `${Date.now()}`,
                        status: 'in progress'
                    }
                );
                const expResult = {
                    code: 503,
                    message: 'Error: Too many configuration operations are in progress on the device. Please try again later'
                };

                expectedEnqueueCount = 1;
                sinon.stub(console, 'log').returns(); // We do not want the error actually printed
                return assertResultAndRestComplete(context, restOp, expResult, 503)
                    .then(() => {
                        console.log.restore();
                        assert.strictEqual(context.host.asyncHandler.records[0].name, mockNewUuid);
                        assert.strictEqual(context.host.asyncHandler.records[0].status, 'cancelled');
                    });
            });

            it('should it should skip the queue when enabled but the request action is retrieve', () => {
                context.request = {
                    method: 'Get',
                    action: 'retrieve',
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        action: 'retrieve'
                    }
                ];

                const expResult = {
                    results: mockSuccess.body.results,
                    declaration: {}
                };

                return assertResultAndRestComplete(context, restOp, expResult, code);
            });
        });
    });

    describe('multi-declaration request', () => {
        let controlsUsed = [];

        beforeEach(() => {
            sinon.stub(DeclarationHandler.prototype, 'process').callsFake((con) => {
                const result = util.simpleCopy(mockSuccess);
                result.body.declaration = Object.assign({}, con.tasks[con.currentIndex].declaration);
                controlsUsed.push(con.request.controls[con.currentIndex]);
                return Promise.resolve(result);
            });
        });

        describe('validation', () => {
            let restOp;
            let expResult;
            let code;

            beforeEach(() => {
                controlsUsed = [];
                expResult = undefined;
                code = undefined;
                restOp = new RestOperationMock();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
            });

            it('should return error if duplicate tenants', () => {
                const decl1 = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'Multi1',
                    TenantSame: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'Service_TCP',
                                remark: 'description',
                                virtualPort: 123,
                                virtualAddresses: [
                                    '192.0.2.110'
                                ]
                            }
                        }
                    }
                };
                const decl2 = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'Multi2',
                    TenantSame: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            template: 'generic',
                            testItem: {
                                class: 'Service_TCP',
                                remark: 'description',
                                virtualPort: 123,
                                virtualAddresses: [
                                    '192.0.2.120'
                                ]
                            }
                        }
                    }
                };

                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    isMultiDecl: true,
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        class: 'AS3',
                        targetHost: 'localhost',
                        action: 'deploy',
                        declaration: decl1
                    },
                    {
                        class: 'AS3',
                        targetHost: 'localhost',
                        action: 'deploy',
                        declaration: decl2
                    }
                ];

                const expItem = {
                    code: 422,
                    message: 'Error(s): \'Invalid/Duplicate\': another request exists with the same targetHost-declaration tenant, declaration target, and/or declaration tenant-app'
                };
                code = STATUS_CODES.UNPROCESSABLE_ENTITY;
                expResult = {
                    code,
                    items: [
                        expItem,
                        expItem
                    ]
                };
                return assertResultAndRestComplete(context, restOp, expResult, code);
            });

            it('should return multi-status if one error, one success', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    isMultiDecl: true,
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        class: 'AS3',
                        targetHost: 'localhost',
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'Multi1',
                            Tenant1: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application',
                                    template: 'generic',
                                    testItem: {
                                        class: 'Service_TCP',
                                        remark: 'description',
                                        virtualPort: 123,
                                        virtualAddresses: [
                                            '192.0.2.110'
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        class: 'AS3',
                        targetHost: 'localhost',
                        action: 'deploy'
                    }
                ];

                code = STATUS_CODES.MULTI_STATUS;
                expResult = {
                    code,
                    items: [
                        {
                            results: [],
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'Multi1',
                                Tenant1: {
                                    class: 'Tenant',
                                    Application: {
                                        class: 'Application',
                                        template: 'generic',
                                        testItem: {
                                            class: 'Service_TCP',
                                            remark: 'description',
                                            virtualPort: 123,
                                            virtualAddresses: [
                                                '192.0.2.110'
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            code: STATUS_CODES.BAD_REQUEST,
                            message: 'for action "deploy", a declaration is required.'
                        }
                    ]
                };
                return assertResultAndRestComplete(context, restOp, expResult, code);
            });
        });

        describe('sync behaviors', () => {
            let restOp;
            let expResult;
            let code;

            beforeEach(() => {
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);
                controlsUsed = [];
                expResult = undefined;
                code = undefined;
                restOp = new RestOperationMock();
            });

            it('should use correct controls for multi-target', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    isMultiDecl: true,
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        class: 'AS3',
                        action: 'retrieve',
                        targetHost: '192.0.2.1',
                        targetPort: 443,
                        protocol: 'https',
                        urlPrefix: 'https://192.0.2.1:443',
                        targetTokens: { 'X-F5-Auth-Token': 'test1' },
                        timeSlip: 0
                    },
                    {
                        class: 'AS3',
                        action: 'retrieve',
                        targetHost: '192.0.2.2',
                        targetPort: 443,
                        protocol: 'https',
                        urlPrefix: 'https://192.0.2.2:443',
                        targetTokens: { 'X-F5-Auth-Token': 'test2' },
                        timeSlip: 0
                    }
                ];

                code = mockSuccess.statusCode;
                expResult = {
                    code,
                    items: [
                        {
                            results: [],
                            declaration: {}
                        },
                        {
                            results: [],
                            declaration: {}
                        }
                    ]
                };
                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        assert.deepStrictEqual(controlsUsed[0], {
                            targetHost: '192.0.2.1',
                            targetPort: 443,
                            protocol: 'https',
                            urlPrefix: 'https://192.0.2.1:443',
                            targetTokens: { 'X-F5-Auth-Token': 'test1' },
                            timeSlip: 0
                        });

                        assert.deepStrictEqual(controlsUsed[1], {
                            targetHost: '192.0.2.2',
                            targetPort: 443,
                            protocol: 'https',
                            urlPrefix: 'https://192.0.2.2:443',
                            targetTokens: { 'X-F5-Auth-Token': 'test2' },
                            timeSlip: 0
                        });

                        assert.strictEqual(context.tasks[0].asyncUuid, 'new-uuid-xxxx');
                        assert.strictEqual(context.tasks[1].asyncUuid, 'new-uuid-xxxx');
                    });
            });

            it('should return correct decl results for all success', () => {
                context.request = {
                    method: 'Post',
                    action: 'deploy',
                    isMultiDecl: true,
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        class: 'AS3',
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'Multi2',
                            Tenant2: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application',
                                    template: 'generic',
                                    testItem: {
                                        class: 'Service_TCP',
                                        remark: 'description',
                                        virtualPort: 123,
                                        virtualAddresses: [
                                            '192.0.2.120'
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        class: 'AS3',
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'Multi1',
                            Tenant1: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application',
                                    template: 'generic',
                                    testItem: {
                                        class: 'Service_TCP',
                                        remark: 'description',
                                        virtualPort: 123,
                                        virtualAddresses: [
                                            '192.0.2.110'
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ];

                code = mockSuccess.statusCode;
                expResult = {
                    code,
                    items: [
                        {
                            results: [],
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'Multi2',
                                Tenant2: {
                                    class: 'Tenant',
                                    Application: {
                                        class: 'Application',
                                        template: 'generic',
                                        testItem: {
                                            class: 'Service_TCP',
                                            remark: 'description',
                                            virtualPort: 123,
                                            virtualAddresses: [
                                                '192.0.2.120'
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            results: [],
                            declaration: {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'Multi1',
                                Tenant1: {
                                    class: 'Tenant',
                                    Application: {
                                        class: 'Application',
                                        template: 'generic',
                                        testItem: {
                                            class: 'Service_TCP',
                                            remark: 'description',
                                            virtualPort: 123,
                                            virtualAddresses: [
                                                '192.0.2.110'
                                            ]
                                        }
                                    }
                                }
                            }

                        }
                    ]
                };
                return assertResultAndRestComplete(context, restOp, expResult, code);
            });
        });

        describe('async behaviors', () => {
            let restOp;
            let expResult;
            let code;
            const mockNewId1 = 'new-id-1';
            const mockNewId2 = 'new-id-2';

            beforeEach(() => {
                expResult = undefined;
                code = undefined;
                restOp = new RestOperationMock();
                sinon.stub(cloudlibsUtil, 'getIsInstalled').resolves(true);

                uuid.v4.restore();
                const uuidStub = sinon.stub(uuid, 'v4');
                uuidStub.onFirstCall().returns(mockNewId1)
                    .onSecondCall().returns(mockNewId2);
            });

            it('should return correct results array and handle async records when async param is specified', () => {
                context.request = {
                    subPath: '',
                    method: 'Post',
                    action: 'deploy',
                    queryParams: [{ key: 'async', value: 'true' }],
                    isMultiDecl: true,
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.18',
                        targetPort: 8100,
                        protocol: 'https',
                        urlPrefix: 'https://192.0.2.18:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'testMultiAsync1' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'MultiAsync1',
                            TenantDeleteMe: {
                                class: 'Tenant'
                            }
                        }
                    },
                    {
                        targetHost: '192.0.2.19',
                        targetPort: 8100,
                        protocol: 'https',
                        urlPrefix: 'https://192.0.2.19:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'testMultiAsync2' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'MultiAsync2',
                            TenantDeleteMe: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const asyncRecordSpy = sinon.spy(asyncHandler, 'handleRecord');
                code = STATUS_CODES.ACCEPTED;
                expResult = {
                    code,
                    items: [
                        {
                            id: mockNewId1,
                            results: [{
                                code: 0,
                                host: '',
                                message: msgDeclSubmitted,
                                runTime: 0,
                                tenant: ''
                            }],
                            declaration: {},
                            selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewId1}`
                        },
                        {
                            id: mockNewId2,
                            results: [{
                                code: 0,
                                host: '',
                                message: msgDeclSubmitted,
                                runTime: 0,
                                tenant: ''
                            }],
                            declaration: {},
                            selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewId2}`
                        }
                    ]
                };

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        const asyncCalls = asyncRecordSpy.getCalls();
                        assert.deepStrictEqual(asyncCalls[0].args, [context, 'POST', mockNewId1, null, msgDeclSubmitted]);
                        assert.deepStrictEqual(asyncCalls[1].args, [context, 'POST', mockNewId2, null, msgDeclSubmitted]);
                        assert.deepStrictEqual(
                            asyncCalls[2].args,
                            [
                                context,
                                'PATCH',
                                mockNewId1,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: {
                                            class: 'ADC',
                                            schemaVersion: '3.0.0',
                                            id: 'MultiAsync1',
                                            TenantDeleteMe: {
                                                class: 'Tenant'
                                            }
                                        },
                                        results: []
                                    }
                                }
                            ]
                        );
                        assert.deepStrictEqual(
                            asyncCalls[3].args,
                            [
                                context,
                                'PATCH',
                                mockNewId2,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: {
                                            class: 'ADC',
                                            schemaVersion: '3.0.0',
                                            id: 'MultiAsync2',
                                            TenantDeleteMe: {
                                                class: 'Tenant'
                                            }
                                        },
                                        results: []
                                    }
                                }
                            ]
                        );
                    });
            });

            it('should convert to async if at least one target needs cloudlibs/SD install', () => {
                cloudlibsUtil.getIsInstalled.restore();
                const cloudLibsStub = sinon.stub(cloudlibsUtil, 'getIsInstalled');
                cloudLibsStub.onFirstCall().resolves(true).onSecondCall().resolves(false);

                context.request = {
                    subPath: '',
                    method: 'Post',
                    action: 'deploy',
                    pathName: 'declare',
                    isMultiDecl: true,
                    tracer: new Tracer('test tracer', { enabled: false })
                };
                context.tasks = [
                    {
                        targetHost: '192.0.2.19',
                        targetPort: 8100,
                        protocol: 'https',
                        urlPrefix: 'https://192.0.2.19:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'testMultiAutoAsync1' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'MultiAutoAsync1',
                            TenantDeleteMe: {
                                class: 'Tenant'
                            }
                        }
                    },
                    {
                        targetHost: '192.0.2.20',
                        targetPort: 8100,
                        protocol: 'https',
                        urlPrefix: 'https://192.0.2.20:8100',
                        targetTokens: { 'X-F5-Auth-Token': 'testMultiAutoAsync2' },
                        timeSlip: 0,
                        action: 'deploy',
                        declaration: {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'MultiAutoAsync2',
                            TenantDeleteMe: {
                                class: 'Tenant'
                            }
                        }
                    }
                ];

                const asyncRecordSpy = sinon.spy(asyncHandler, 'handleRecord');
                code = STATUS_CODES.ACCEPTED;
                expResult = {
                    code,
                    items: [
                        {
                            id: mockNewId1,
                            results: [{
                                code: 0,
                                host: '',
                                message: msgDeclSubmitted,
                                runTime: 0,
                                tenant: ''
                            }],
                            declaration: {},
                            selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewId1}`
                        },
                        {
                            id: mockNewId2,
                            results: [{
                                code: 0,
                                host: '',
                                message: msgServDiscInstall,
                                runTime: 0,
                                tenant: ''
                            }],
                            declaration: {},
                            selfLink: `https://localhost/mgmt/shared/appsvcs/task/${mockNewId2}`
                        }
                    ]
                };

                return assertResultAndRestComplete(context, restOp, expResult, code)
                    .then(() => {
                        const asyncCalls = asyncRecordSpy.getCalls();

                        assert.deepStrictEqual(asyncCalls[0].args, [context, 'POST', mockNewId1, null, msgDeclSubmitted]);
                        assert.deepStrictEqual(asyncCalls[1].args, [context, 'POST', mockNewId2, null, msgServDiscInstall]);
                        assert.deepStrictEqual(
                            asyncCalls[2].args,
                            [
                                context,
                                'PATCH',
                                mockNewId1,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: {
                                            class: 'ADC',
                                            schemaVersion: '3.0.0',
                                            id: 'MultiAutoAsync1',
                                            TenantDeleteMe: {
                                                class: 'Tenant'
                                            }
                                        },
                                        results: []
                                    }
                                }
                            ]
                        );
                        assert.deepStrictEqual(
                            asyncCalls[3].args,
                            [
                                context,
                                'PATCH',
                                mockNewId2,
                                {
                                    status: STATUS_CODES.OK,
                                    response: {
                                        declaration: {
                                            class: 'ADC',
                                            schemaVersion: '3.0.0',
                                            id: 'MultiAutoAsync2',
                                            TenantDeleteMe: {
                                                class: 'Tenant'
                                            }
                                        },
                                        results: []
                                    }
                                }
                            ]
                        );
                        assert.strictEqual(context.tasks[0].resolvedHostIp, '192.0.2.19');
                        assert.strictEqual(context.tasks[1].resolvedHostIp, '192.0.2.20');
                    });
            });
        });
    });
});

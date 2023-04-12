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

const jiff = require('jiff');
const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const TeemDevice = require('@f5devcentral/f5-teem').Device;
const Record = require('@f5devcentral/f5-teem/lib/record');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const DeclarationHandler = require('../../../src/lib/declarationHandler');
const DeclarationProvider = require('../../../src/lib/declarationProvider');
const As3Parser = require('../../../src/lib/adcParser');
const audit = require('../../../src/lib/audit');
const mutex = require('../../../src/lib/mutex');
const cloudLibUtils = require('../../../src/lib/util/cloudLibUtils');
const util = require('../../../src/lib/util/util');
const TargetContext = require('../../../src/lib/context/targetContext');
const Context = require('../../../src/lib/context/context');
const Tracer = require('../../../src/lib/tracer').Tracer;
const log = require('../../../src/lib/log');

const DEVICE_TYPES = require('../../../src/lib/constants').DEVICE_TYPES;
const BUILD_TYPES = require('../../../src/lib/constants').BUILD_TYPES;

describe('DeclarationHandler', () => {
    let context = {};
    let handler;
    beforeEach(() => {
        const parser = new As3Parser();
        context = Context.build();
        context.host = { parser };
        context.request = {
            tracer: new Tracer('test tracer', { enabled: false })
        };

        handler = new DeclarationHandler();
        sinon.stub(log, 'warning'); // Remove warning prints from unit testing
    });

    afterEach('restore', () => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('.getObjectNamesToPatch', () => {
        function assertTenants(paths, expectedTenants) {
            const body = paths.map((path) => ({
                op: 'remove',
                path
            }));
            const tenants = handler.getObjectNamesToPatch(body);
            assert.deepEqual(tenants, expectedTenants);
        }

        it('should return an empty list if body is empty', () => {
            assertTenants([], []);
        });

        it('should handle extract object names from list of patches', () => {
            assertTenants(
                [
                    '/tenant1/application/pool',
                    'tenant2',
                    '/controls'
                ],
                ['tenant1', 'tenant2', 'controls']
            );
        });
    });

    describe('.getFilteredDeclaration', () => {
        beforeEach(() => {
            context.tasks.push({ tenantsInPath: [], urlPrefix: 'http://admin:@localhost:8100' });
            context.target = {
                deviceType: DEVICE_TYPES.BIG_IP,
                provisionedModules: [],
                tmosVersion: '14.1.2',
                tokens: {}
            };
            context.control = {
                port: 8100
            };
        });

        describe('BIG-IP', () => {
            it('should handle if the declaration was successfully returned', () => {
                context.tasks[0].showAge = 0;
                context.tasks[0].fullPath = '/shared/appsvcs/declare';
                context.tasks[0].tenantsInPath = ['firstTenant'];

                const declarationProvider = new DeclarationProvider();
                sinon.stub(context.host.parser, 'digest').resolves();
                sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'PATCH_Sample',
                    firstTenant: { class: 'Tenant', Application: { class: 'Application' } },
                    updateMode: 'selective',
                    controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
                });
                handler.declarationProvider = declarationProvider;

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.deepEqual(
                            response,
                            {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'PATCH_Sample',
                                firstTenant: { class: 'Tenant', Application: { class: 'Application' } },
                                updateMode: 'selective',
                                controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
                            }
                        );
                    });
            });

            it('should return 204 status code', () => {
                context.tasks[0].showAge = 0;
                context.tasks[0].fullPath = '/shared/appsvcs/declare';

                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                    .reply(200, {
                        items: [
                            {
                                name: '____appsvcs_declaration-1554498345530',
                                timestamp: 1554498345530,
                                date: '2019-04-05T21:16:07.217Z',
                                age: 0
                            }
                        ]
                    });
                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1554498345530')
                    .reply(200, {
                        kind: 'tm:ltm:data-group:internal:internalstate',
                        name: '____appsvcs_declaration-1554498345530',
                        partition: 'Common',
                        fullPath: '/Common/____appsvcs_declaration-1554498345530',
                        generation: 14113,
                        selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1554498345530?ver=13.1.1',
                        description: 'f5 AS3 declaration (see info in record 0)',
                        type: 'integer',
                        records: [
                            {
                                name: '0',
                                data: 'date^2019-04-05T21:05:45.530Z|id^1554498344324|tenants^|blocks^1'
                            },
                            {
                                name: '1',
                                data: 'eNoNzLEKwzAMBNB/0dwYJZag8VaatVvo0M04ghji2MRul5B/r8Z7d9wJYfO1goPH9IQb1LBK8m85asy7qjVoUD0uGnpmovFuiexAit+y+CavvIiWIaeySRP1kPd25E1fT/BHWONP5pikNp+KLgfsxw6pQ56H3iE7YsMWP3Bdf9+0KfU='
                            }
                        ]
                    });

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.deepEqual(response, { body: undefined, errorMessage: 'no declarations found', statusCode: 204 });
                    });
            });

            it('should return 404 status code', () => {
                context.tasks[0].showAge = 1;
                context.tasks[0].fullPath = 'shared/appsvcs/declare/someTenant';

                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                    .reply(200, {
                        items: []
                    });

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.deepEqual(response, { body: undefined, errorMessage: 'declaration in specified path not found', statusCode: 404 });
                    });
            });

            it('should error if non 200 response when fetching the list of declarations', () => {
                context.tasks[0].showAge = 1;
                context.tasks[0].targetHost = 'localhost';

                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                    .reply(404, 'not found');

                return assert.isRejected(
                    handler.getFilteredDeclaration(context),
                    /cannot fetch declaration 1 from localhost \(GET http:\/\/admin:XXXXXX@localhost:8100\/mgmt\/tm\/ltm\/data-group\/internal\?\$select=name&\$filter=partition\+eq\+Common get stored-declaration list response=404 body=not found\)/
                );
            });

            it('should error if non 200 response when fetching the specific declaration', () => {
                context.tasks[0].showAge = 0;
                context.tasks[0].targetHost = 'localhost';
                context.tasks[0].fullPath = '/shared/appsvcs/declare';

                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                    .reply(200, {
                        items: [
                            {
                                name: '____appsvcs_declaration-1554498345530',
                                timestamp: 1554498345530,
                                date: '2019-04-05T21:16:07.217Z',
                                age: 0
                            }
                        ]
                    });
                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1554498345530')
                    .reply(404, 'not found');

                return assert.isRejected(
                    handler.getFilteredDeclaration(context),
                    /cannot fetch declaration 0 from localhost \(GET \/mgmt\/tm\/ltm\/data-group\/internal\/~Common~____appsvcs_declaration-1554498345530 retrieve stored declaration from BIG-IP response=404 body=not found\)/
                );
            });

            it('should return the declaration if the skipMissingTenantCheck is true', () => {
                context.tasks[0].method = 'Patch';
                context.tasks[0].patchBody = [
                    {
                        op: 'add',
                        path: '/newtenant',
                        value: {
                            class: 'Tenant',
                            Application: {
                                class: 'Application'
                            }
                        }
                    }
                ];
                context.tasks[0].action = 'retrieve';
                context.tasks[0].showAge = 0;
                context.tasks[0].fullPath = '/shared/appsvcs/declare';
                context.tasks[0].tenantsInPath = ['newtenant'];

                const declarationProvider = new DeclarationProvider();
                sinon.stub(context.host.parser, 'digest').resolves();
                sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'PATCH_Sample',
                    firstTenant: { class: 'Tenant', Application: { class: 'Application' } },
                    updateMode: 'selective',
                    controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
                });
                handler.declarationProvider = declarationProvider;

                return handler.getFilteredDeclaration(context, true)
                    .then((response) => {
                        assert.deepEqual(
                            response,
                            {
                                class: 'ADC',
                                schemaVersion: '3.0.0',
                                id: 'PATCH_Sample',
                                updateMode: 'selective',
                                controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
                            }
                        );
                    });
            });
        });

        describe('BIG-IQ', () => {
            beforeEach(() => {
                context.tasks[0].showAge = 1;
                context.tasks[0].fullPath = 'shared/appsvcs/declare/bigiqTenant1';
                context.tasks[0].tenantsInPath = ['bigiqTenant1'];
                context.target.deviceType = DEVICE_TYPES.BIG_IQ;
                context.target.provisionedModules = ['biq'];
                context.target.tmosVersion = '7.0.0';
                sinon.stub(context.host.parser, 'digest').resolves();
            });

            it('should handle multiple declarations and filter tenant', () => {
                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [
                            {
                                name: 'bigiqTenant2',
                                body: {
                                    bigiqTenant2: { class: 'Tenant' },
                                    target: {
                                        address: '10.145.65.177'
                                    },
                                    class: 'ADC'
                                }
                            },
                            {
                                name: 'bigiqTenant1',
                                body: {
                                    class: 'ADC',
                                    bigiqTenant1: { class: 'Tenant' }
                                }
                            }
                        ]
                    });

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.deepStrictEqual(
                            response,
                            [
                                {
                                    class: 'ADC',
                                    bigiqTenant1: {
                                        class: 'Tenant'
                                    }
                                }
                            ]
                        );
                    });
            });

            it('should handle multiple declarations and filter multiple tenants', () => {
                context.tasks[0].fullPath = 'shared/appsvcs/declare/bigiqTenant1,bigiqTenant4';
                context.tasks[0].tenantsInPath.push('bigiqTenant4');

                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [
                            {
                                name: 'bigiqTenant2',
                                body: {
                                    bigiqTenant2: { class: 'Tenant' },
                                    target: {
                                        address: '10.145.65.177'
                                    },
                                    class: 'ADC'
                                }
                            },
                            {
                                name: 'bigiqTenant1',
                                body: {
                                    class: 'ADC',
                                    bigiqTenant1: { class: 'Tenant' }
                                }
                            },
                            {
                                name: 'bigiqTenant3',
                                body: {
                                    bigiqTenant3: { class: 'Tenant' },
                                    class: 'ADC'
                                }
                            },
                            {
                                name: 'bigiqTenant4',
                                body: {
                                    bigiqTenant4: { class: 'Tenant' },
                                    target: {
                                        address: '10.145.65.178'
                                    },
                                    class: 'ADC'
                                }
                            }
                        ]
                    });

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.deepStrictEqual(
                            response,
                            [
                                {
                                    class: 'ADC',
                                    bigiqTenant1: {
                                        class: 'Tenant'
                                    }
                                },
                                {
                                    bigiqTenant4: {
                                        class: 'Tenant'
                                    },
                                    class: 'ADC',
                                    target: {
                                        address: '10.145.65.178'
                                    }
                                }
                            ]
                        );
                    });
            });

            it('should fail if tenant is not found', () => {
                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [
                            {
                                name: 'bigiqTenant2',
                                body: {
                                    bigiqTenant2: { class: 'Tenant' },
                                    target: {
                                        address: '10.145.65.177'
                                    },
                                    class: 'ADC'
                                }
                            }
                        ]
                    });

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.strictEqual(response.statusCode, 404);
                        assert.strictEqual(response.errorMessage, 'specified Tenant(s) \'bigiqTenant1\' not found in declaration');
                    });
            });

            it('should error if some tenants are found, but not all', () => {
                context.tasks[0].fullPath = 'shared/appsvcs/declare/bigiqTenant1,bigiqTenant3';
                context.tasks[0].tenantsInPath.push('bigiqTenant3');

                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [
                            {
                                name: 'bigiqTenant1',
                                body: {
                                    bigiqTenant1: { class: 'Tenant' },
                                    target: {
                                        address: '10.145.65.176'
                                    },
                                    class: 'ADC'
                                }
                            },
                            {
                                name: 'bigiqTenant2',
                                body: {
                                    bigiqTenant2: { class: 'Tenant' },
                                    target: {
                                        address: '10.145.65.177'
                                    },
                                    class: 'ADC'
                                }
                            }
                        ]
                    });

                return handler.getFilteredDeclaration(context)
                    .then((response) => {
                        assert.strictEqual(response.statusCode, 404);
                        assert.strictEqual(response.errorMessage, 'specified Tenant(s) \'bigiqTenant3\' not found in declaration');
                    });
            });
        });
    });

    describe('.handleCreateUpdateOrDelete', () => {
        let parser;
        let configSync;

        let acquireMutexLockStub;
        let releaseMutexLockStub;

        beforeEach(() => {
            context.target = {
                deviceType: DEVICE_TYPES.BIG_IP,
                provisionedModules: [],
                tmosVersion: '14.1.2'
            };
            context.control = {
                port: 8100,
                tokens: {}
            };
            context.tasks.push({ tenantsInPath: [], urlPrefix: 'http://admin:@localhost:8100' });

            configSync = false;

            nock('http://localhost:8100')
                .get('/mgmt/tm/sys/folder/appsvcs')
                .reply(200, {});
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                .times(2)
                .reply(200, {});
            nock('http://localhost:8100')
                .post('/mgmt/tm/task/cm/config-sync')
                .reply(200, () => {
                    configSync = true;
                    return {
                        selfLink: '/dummySelfLink'
                    };
                });
            nock('http://localhost:8100')
                .persist()
                .put('/dummySelfLink')
                .reply(200, () => {});

            acquireMutexLockStub = sinon.stub(mutex, 'acquireMutexLock').resolves();
            releaseMutexLockStub = sinon.stub(mutex, 'releaseMutexLock').resolves();

            const declarationProvider = new DeclarationProvider();
            sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                metadata: {},
                declaration: {}
            });
            sinon.stub(handler, 'getFilteredDeclaration').resolves({
                Tenant: {
                    class: 'Tenant'
                }
            });

            parser = new As3Parser();
            handler.declarationProvider = declarationProvider;

            parser = new As3Parser();
            sinon.stub(parser, 'digest').resolves('1');
            context.host.parser = parser;
        });

        describe('mutex locking', () => {
            beforeEach(() => {
                context.tasks[0].declaration = [
                    {
                        class: 'ADC',
                        schemaVersion: '3.0.0',
                        id: 'declaration_id',
                        tenant1: {
                            class: 'Tenant'
                        }
                    }
                ];
                context.tasks[0].dryRun = false;
            });

            it('should follow this flow: acquire mutex lock; audit tenants; release mutex lock', () => {
                const callOrder = [];
                acquireMutexLockStub.callsFake(() => {
                    callOrder.push('mutex.acquireMutexLockStub');
                    return Promise.resolve();
                });

                releaseMutexLockStub.callsFake(() => {
                    callOrder.push('mutex.releaseMutexLockStub');
                    return Promise.resolve();
                });

                sinon.stub(audit, 'allTenants').callsFake(() => {
                    callOrder.push('audit.allTenants');
                    return Promise.resolve([{ host: undefined, message: 'no change' }]);
                });

                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        assert.deepEqual(callOrder, [
                            'mutex.acquireMutexLockStub', 'audit.allTenants', 'mutex.releaseMutexLockStub'
                        ]);
                        assert.strictEqual(acquireMutexLockStub.callCount, releaseMutexLockStub.callCount);
                    });
            });

            it('should pass refresher from acquireMutexLockStub to releaseMutexLockStub', () => {
                acquireMutexLockStub.resolves('mutexRefresher');

                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        assert.strictEqual(releaseMutexLockStub.called, true);
                        assert.strictEqual(releaseMutexLockStub.args.pop().pop(), 'mutexRefresher');
                        assert.strictEqual(acquireMutexLockStub.callCount, releaseMutexLockStub.callCount);
                    });
            });

            it('should release mutex when we hold a mutex and receive an error', () => {
                // Reject after acquireMutexLock
                sinon.stub(audit, 'allTenants').rejects();

                return handler.handleCreateUpdateOrDelete(context)
                    .then((resp) => {
                        // we resolve on error; ensure actually getting error
                        assert.strictEqual(resp.statusCode, 500);
                        assert.strictEqual(acquireMutexLockStub.called, true);
                        assert.strictEqual(releaseMutexLockStub.called, true);
                        assert.strictEqual(acquireMutexLockStub.callCount, releaseMutexLockStub.callCount);
                    });
            });

            it('should not release mutex when we do not hold a mutex and receive an error', () => {
                // Error after releaseMutexLock
                nock('http://localhost:8100')
                    .post('/mgmt/tm/task/sys/config')
                    .reply(500);

                context.tasks[0].persist = true;
                return handler.handleCreateUpdateOrDelete(context)
                    .then((resp) => {
                        // we resolve on error; ensure actually getting error
                        assert.strictEqual(resp.statusCode, 500);
                        assert.strictEqual(acquireMutexLockStub.called, true);
                        assert.strictEqual(releaseMutexLockStub.called, true);
                        assert.strictEqual(acquireMutexLockStub.callCount, releaseMutexLockStub.callCount);
                    });
            });
        });

        it('should send teem report', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];

            const assetInfo = {
                name: 'Application Services',
                version: '1.2.3'
            };
            const teemDevice = new TeemDevice(assetInfo);
            const isCalled = sinon.stub(teemDevice, 'reportRecord').resolves();
            const isNotCalled = sinon.stub(teemDevice, 'report').resolves();
            const addClassCountSpy = sinon.spy(Record.prototype, 'addClassCount');
            const addJsonObjectSpy = sinon.spy(Record.prototype, 'addJsonObject');
            const addPlatformInfoSpy = sinon.spy(Record.prototype, 'addPlatformInfo');
            const addRegKeySpy = sinon.spy(Record.prototype, 'addRegKey');
            const addProvisionedModulesSpy = sinon.spy(Record.prototype, 'addProvisionedModules');
            const calculateAssetIdSpy = sinon.spy(Record.prototype, 'calculateAssetId');
            context.host.teemDevice = teemDevice;

            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.strictEqual(isCalled.calledOnce, true, 'should call reportRecord() once');
                    assert.strictEqual(addClassCountSpy.calledTwice, true, 'should call addClassCount() twice');
                    assert.strictEqual(addJsonObjectSpy.calledOnce, true, 'should call addJsonObject() once');
                    assert.strictEqual(addPlatformInfoSpy.calledOnce, true, 'should call addPlatformInfo() once');
                    assert.strictEqual(addRegKeySpy.calledOnce, true, 'should call addRegKey() once');
                    assert.strictEqual(addProvisionedModulesSpy.calledOnce, true, 'should call addProvisionedModules() once');
                    assert.strictEqual(calculateAssetIdSpy.calledOnce, true, 'should call calculateAssetId() once');
                    // Confirm that the old API is not being used
                    assert.strictEqual(isNotCalled.called, false);
                });
        });
        it('should succeed even if teem report fails', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];

            const assetInfo = {
                name: 'Application Services',
                version: '1.2.3'
            };

            const teemDevice = new TeemDevice(assetInfo);
            const isCalled = sinon.stub(teemDevice, 'reportRecord').rejects();
            context.host.teemDevice = teemDevice;

            return assert.isFulfilled(handler.handleCreateUpdateOrDelete(context))
                .then(() => {
                    assert.strictEqual(isCalled.calledOnce, true);
                });
        });

        it('should save declaration to storage when audit returns \'no change\'', () => {
            let saved = false;
            let persistConfig = false;

            context.tasks[0].persist = true;
            context.tasks[0].syncToGroup = '/Common/dataGroup';
            context.tasks[0].declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declaration_id',
                tenant: {
                    class: 'Tenant'
                }
            };
            sinon.stub(DeclarationProvider.prototype, 'storeBigipDeclaration').callsFake(() => {
                saved = true;
                return true;
            });
            sinon.stub(audit, 'allTenants').resolves([
                {
                    code: 200,
                    message: 'no change',
                    host: 'localhost',
                    tenant: 'tenant',
                    runTime: 59
                }
            ]);
            nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(200, () => {
                    persistConfig = true;
                    return {
                        selfLink: 'https://localhost/mgmt/tm/task/sys/config/42',
                        _taskId: 42
                    };
                });

            nock('http://localhost:8100')
                .put('/mgmt/tm/task/sys/config/42')
                .reply(200);

            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(200, () => ({
                    _taskState: 'COMPLETED'
                }));

            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.ok(saved, '.storeBigipDeclaration method should be called when "no change" in declaration');
                    assert.ok(persistConfig, 'persistConfig should be called when "no change" in declaration');
                    assert.ok(configSync, 'configSync should be called when "no change" in declaration');
                });
        });

        it('should install service discovery when required', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];

            const installSpy = sinon.stub(cloudLibUtils, 'install').resolves();

            context.tasks[context.currentIndex].installServiceDiscovery = true;
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.ok(installSpy.called, 'cloudLibUtils.install should have been called');
                });
        });

        it('should uninstall service discovery when required', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];

            const uninstallSpy = sinon.stub(cloudLibUtils, 'ensureUninstall').resolves();

            context.tasks[context.currentIndex].uninstallServiceDiscovery = true;
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.ok(uninstallSpy.called, 'cloudLibUtils.ensureUninstall should have been called');
                });
        });

        it('should not add traces to response', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];
            context.log = {};

            return handler.handleCreateUpdateOrDelete(context)
                .then((result) => {
                    assert.deepEqual(result.body.traces, undefined);
                });
        });

        it('should add traces to response', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];
            context.log = {
                tenant1Desired: { desiredConfig: {} },
                tenant1Current: { currentConfig: {} },
                tenant1Diff: { diffs: {} },
                tenant1Script: 'The script'
            };

            return handler.handleCreateUpdateOrDelete(context)
                .then((result) => {
                    assert.deepEqual(
                        result.body.traces.tenant1Desired,
                        { desiredConfig: {} }
                    );
                    assert.deepEqual(
                        result.body.traces.tenant1Current,
                        { currentConfig: {} }
                    );
                    assert.deepEqual(
                        result.body.traces.tenant1Diff,
                        { diffs: {} }
                    );
                    assert.deepEqual(
                        result.body.traces.tenant1Script,
                        'The script'
                    );
                });
        });

        it('should handle a custom userAgent', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];
            context.tasks[0].userAgent = 'AS3 Testing';

            const assetInfo = {
                name: 'Application Services',
                version: '1.2.3'
            };

            const teemDevice = new TeemDevice(assetInfo);
            const isCalled = sinon.stub(teemDevice, 'reportRecord').resolves();
            context.host.teemDevice = teemDevice;

            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.deepEqual(isCalled.getCall(0).args[0].recordBody.userAgent, 'AS3 Testing');
                });
        });

        it('should call getOptimisticLockKeys when showHash is true', () => {
            context.tasks[0].declaration = {};
            context.tasks[0].showHash = true;
            const spy = sinon.spy(handler, 'getOptimisticLockKeys');
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.strictEqual(spy.callCount, 2);
                });
        });

        it('should NOT have the tenant in the decl if optimisticLockKeys fail to match previous declaration', () => {
            const declarationProvider = new DeclarationProvider();
            handler.declarationProvider.getBigipDeclaration.restore();
            // Return previous declaration
            sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                metadata: {},
                declaration: {
                    schemaVersion: '3.14.0',
                    class: 'ADC',
                    Tenant: {
                        class: 'Tenant',
                        App: {
                            class: 'Application',
                            template: 'generic',
                            vip: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['192.0.2.0']
                            }
                        }
                    }
                }
            });
            handler.declarationProvider = declarationProvider;
            context.tasks[0].declaration = {
                schemaVersion: '3.14.0',
                class: 'ADC',
                Tenant: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        template: 'generic',
                        vip: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['192.0.2.5']
                        }
                    },
                    optimisticLockKey: 'foo'
                }
            };
            context.tasks[0].showHash = true;
            // return value when hashes do NOT line up
            sinon.stub(audit, 'allTenants').callsFake(() => Promise.resolve([
                {
                    message: 'The hash you submitted does not match the hash on the current Tenant. This usually indicates there was a change to the Tenant since you pulled this hash. You will want to do a GET and see what the changes are.',
                    tenant: 'Tenant'
                }
            ]));

            let storedDecl;
            sinon.stub(DeclarationProvider.prototype, 'storeBigipDeclaration').callsFake((cntxt, decl) => {
                storedDecl = decl;
                return Promise.resolve();
            });
            return assert.isFulfilled(handler.handleCreateUpdateOrDelete(context))
                .then((response) => {
                    assert.strictEqual(typeof storedDecl.controls.archiveTimestamp, 'string');
                    delete storedDecl.controls.archiveTimestamp;
                    assert.deepStrictEqual(
                        storedDecl,
                        {
                            schemaVersion: '3.14.0',
                            class: 'ADC',
                            controls: {},
                            updateMode: 'selective',
                            Tenant: {
                                class: 'Tenant',
                                App: {
                                    class: 'Application',
                                    template: 'generic',
                                    vip: {
                                        class: 'Service_HTTP',
                                        virtualAddresses: ['192.0.2.0']
                                    }
                                },
                                optimisticLockKey: 'X2+v5GL/Efee06aRRnkbPWlOWosvpzYbBb/AwuY0CcM='
                            }
                        }
                    );
                    assert.deepStrictEqual(
                        response,
                        {
                            body: {
                                declaration: {
                                    schemaVersion: '3.14.0',
                                    class: 'ADC',
                                    controls: {},
                                    updateMode: 'selective',
                                    Tenant: {
                                        class: 'Tenant',
                                        App: {
                                            class: 'Application',
                                            template: 'generic',
                                            vip: {
                                                class: 'Service_HTTP',
                                                virtualAddresses: ['192.0.2.0']
                                            }
                                        },
                                        optimisticLockKey: 'X2+v5GL/Efee06aRRnkbPWlOWosvpzYbBb/AwuY0CcM='
                                    }
                                },
                                results: [
                                    {
                                        code: 422,
                                        message: 'The hash you submitted does not match the hash on the current Tenant. This usually indicates there was a change to the Tenant since you pulled this hash. You will want to do a GET and see what the changes are.',
                                        tenant: 'Tenant',
                                        warnings: undefined
                                    }
                                ]
                            },
                            errorMessage: undefined,
                            statusCode: 422
                        }
                    );
                });
        });

        it('should call cleanupStoredDecl when running on BIG-IP and build type is CLOUD', () => {
            context.tasks[0].declaration = {};
            context.host.buildType = BUILD_TYPES.CLOUD;
            const spy = sinon.spy(cloudLibUtils, 'cleanupStoredDecl');
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.strictEqual(spy.callCount, 1);
                });
        });

        it('should call getSavedDeclarations with default age when action is redeploy', () => {
            context.tasks[0].declaration = {};
            context.tasks[0].action = 'redeploy';
            const spy = sinon.spy(handler, 'getSavedDeclarations');
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.strictEqual(spy.getCall(0).args[1], 1);
                });
        });

        it('should call getSavedDeclarations with specified age when action is redeploy', () => {
            context.tasks[0].declaration = {};
            context.tasks[0].action = 'redeploy';
            context.tasks[0].redeployAge = 3;
            const spy = sinon.spy(handler, 'getSavedDeclarations');
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.strictEqual(spy.getCall(0).args[1], 3);
                });
        });

        it('should return failed result if filtered tenants have failing status code', () => {
            context.tasks[0].declaration = {};
            context.tasks[0].tenantsInPath = ['foo', 'bar'];

            const expected = {
                body: {
                    message: 'specified Tenant(s) \'foo,bar\' not found in declaration',
                    statusCode: 404
                },
                errorMessage: 'filterTenantsInDecl failed',
                statusCode: 404
            };

            return handler.handleCreateUpdateOrDelete(context)
                .then((result) => {
                    assert.deepStrictEqual(result, expected);
                });
        });

        it('should filter declarations based on target when device is BIG-IQ', () => {
            const getBigiqDeclarationSpy = sinon.stub(handler.declarationProvider, 'getBigiqDeclaration').resolves({
                metadata: {},
                declaration: {}
            });
            context.tasks[0].declaration = { target: { address: '10.10.10.10' } };
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.deepStrictEqual(
                        getBigiqDeclarationSpy.args[0][0].tasks[0].target,
                        { address: '10.10.10.10' },
                        'should have saved target so declarations can be filtered'
                    );
                });
        });

        it('should include common from previous declarations if needed', () => {
            context.tasks[0].declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declaration_id',
                tenant1: {
                    class: 'Tenant',
                    app: {
                        vip: {
                            class: 'Service_HTTP',
                            pool: { use: '/Common/Shared/pool' }
                        }
                    }
                }
            };

            handler.getFilteredDeclaration.restore();
            sinon.stub(handler, 'getFilteredDeclaration').resolves({
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared'
                    }
                }
            });

            let parsedDecl = null;
            let baseDecl = null;
            context.host.parser.digest.restore();
            sinon.stub(context.host.parser, 'digest').callsFake((_, decl, opts) => {
                baseDecl = opts.baseDeclaration;
                parsedDecl = decl;
                return Promise.resolve('1');
            });

            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert(parsedDecl.Common, 'Common tenant was not included in parsedDecl');
                    assert(baseDecl.Common, 'Common tenant was not included in baseDecl');
                    assert.strictEqual(parsedDecl.Common.Shared.template, 'shared');
                    assert.strictEqual(baseDecl.Common.Shared.template, 'shared');
                    assert(parsedDecl.tenant1, 'tenant1 tenant was not included');
                    assert(parsedDecl.tenant1.app, 'tenant1 is malformed');
                });
        });

        it('should not include common from previous declarations if not needed', () => {
            context.tasks[0].declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'declaration_id',
                tenant1: {
                    class: 'Tenant',
                    app: {
                        vip: { class: 'Service_HTTP' }
                    }
                }
            };

            handler.getFilteredDeclaration.restore();
            sinon.stub(handler, 'getFilteredDeclaration').resolves({
                Common: { class: 'Tenant' }
            });

            let parsedDecl = null;
            context.host.parser.digest.restore();
            sinon.stub(context.host.parser, 'digest').callsFake((_, decl) => {
                parsedDecl = decl;
                return Promise.resolve('1');
            });

            return handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert(!parsedDecl.Common, 'Common tenant was included');
                    assert(parsedDecl.tenant1, 'tenant1 tenant was not included');
                    assert(parsedDecl.tenant1.app, 'tenant1 is malformed');
                });
        });

        it('should include foo but not common from previous declaration when posting to declare/foo', () => {
            context.tasks[0].declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'fast%create%foo%bat%1',
                updateMode: 'selective',
                foo: {
                    class: 'Tenant',
                    bar: {
                        class: 'Application',
                        template: 'udp',
                        serviceMain: {
                            class: 'Service_UDP',
                            pool: { use: '/Common/Shared/pool' }
                        }
                    }
                }
            };
            context.tasks[0].tenantsInPath = ['foo'];
            context.tasks[0].userAgent = 'AS3 Testing';

            sinon.stub(audit, 'allTenants').callsFake(() => Promise.resolve([
                {
                    code: 200,
                    host: 'localhost',
                    lineCount: 24,
                    message: 'success',
                    runTime: 1627,
                    tenant: 'foo'
                }
            ]));

            sinon.stub(handler, 'getSavedDeclarations').callsFake(() => (
                {
                    declaration: {
                        class: 'ADC',
                        Common: {
                            class: 'Tenant',
                            Shared: {
                                class: 'Application',
                                template: 'Shared'
                            }
                        }
                    },
                    metadata: {
                        blocks: 1
                    }
                }
            ));

            return handler.handleCreateUpdateOrDelete(context)
                .then((result) => {
                    assert.typeOf(result.body.declaration.foo, 'object', 'foo was not in result');
                    assert.strictEqual(result.body.declaration.foo.class, 'Tenant', 'foo tenant was not included');
                    assert.typeOf(result.body.declaration.Common, 'undefined', 'Common tenant was found');
                });
        });

        it('should succeed when there are no BIG-IP declaration data groups', () => {
            context.tasks[0].declaration = [
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenant1: {
                        class: 'Tenant'
                    }
                }
            ];
            handler.declarationProvider.getBigipDeclaration.restore();
            return handler.handleCreateUpdateOrDelete(context)
                .then((result) => {
                    assert.strictEqual(result.statusCode, 200);
                    assert.strictEqual(result.errorMessage, undefined);
                });
        });

        describe('updateMode', () => {
            let bigIpDeclaration;
            let passedInDecl;

            beforeEach(() => {
                bigIpDeclaration = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declaration_id',
                    tenantToKeep: {
                        class: 'Tenant',
                        myApplication: {
                            class: 'Application'
                        }
                    }
                };

                context.tasks[0].declaration = [];
                context.tasks[0].action = 'redeploy';
                context.tasks[0].redeployUpdateMode = 'original';
                handler.declarationProvider.getBigipDeclaration.restore();
                sinon.stub(handler.declarationProvider, 'getBigipDeclaration').resolves({
                    metadata: {
                        tenants: ['tenantToKeep', 'tenantToRemove'],
                        blocks: 1
                    },
                    declaration: bigIpDeclaration
                });

                sinon.stub(audit, 'allTenants').callsFake((theContext, theTenantList, theDecl) => {
                    passedInDecl = util.simpleCopy(theDecl);
                    return Promise.resolve(([{ host: undefined, message: 'no change' }]));
                });
            });

            it('should delete tenants that are not in the declaration if updateMode is complete', () => {
                bigIpDeclaration.updateMode = 'complete';

                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        assert.deepStrictEqual(
                            passedInDecl.tenantToKeep,
                            {
                                class: 'Tenant',
                                myApplication: {
                                    class: 'Application'
                                }
                            }
                        );
                        assert.deepStrictEqual(
                            passedInDecl.tenantToRemove,
                            {
                                class: 'Tenant'
                            }
                        );
                    });
            });

            it('should not delete tenants that are not in the declaration if updateMode is not complete', () => handler.handleCreateUpdateOrDelete(context)
                .then(() => {
                    assert.deepStrictEqual(
                        passedInDecl.tenantToKeep,
                        {
                            class: 'Tenant',
                            myApplication: {
                                class: 'Application'
                            }
                        }
                    );
                    assert.strictEqual(
                        passedInDecl.tenantToRemove,
                        undefined
                    );
                }));

            it('should handle empty tenant strings with updateMode complete', () => {
                bigIpDeclaration.updateMode = 'complete';

                handler.declarationProvider.getBigipDeclaration.restore();
                sinon.stub(handler.declarationProvider, 'getBigipDeclaration').resolves({
                    metadata: {
                        tenants: ['tenantToKeep', 'tenantToRemove', ''],
                        blocks: 1
                    },
                    declaration: bigIpDeclaration
                });
                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        assert.strictEqual(
                            passedInDecl[''],
                            undefined
                        );
                    });
            });
        });

        describe('getNodeList with action remove', () => {
            let getNodelistSpy;

            beforeEach(() => {
                context.tasks[0].declaration = {};
                context.tasks[0].action = 'remove';

                handler.declarationProvider.getBigipDeclaration.restore();
                sinon.stub(handler.declarationProvider, 'getBigipDeclaration').resolves({
                    metadata: {
                        tenants: []
                    },
                    declaration: {}
                });

                getNodelistSpy = sinon.stub(util, 'getNodelist').resolves([]);
            });

            it('should fetch common nodes if node list is empty', () => {
                context.host.parser.nodelist = [];
                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        sinon.assert.calledOnce(getNodelistSpy);
                    });
            });

            it('should fetch common nodes if node list is not empty', () => {
                context.host.parser.nodelist = [{}];
                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        sinon.assert.calledOnce(getNodelistSpy);
                    });
            });

            it('should not fetch common nodes if action is not remove', () => {
                context.tasks[0].action = 'deploy';
                return handler.handleCreateUpdateOrDelete(context)
                    .then(() => {
                        sinon.assert.notCalled(getNodelistSpy);
                    });
            });
        });

        describe('dryRun tests', () => {
            it('should skip debug prints and other functionality when dryRun is true', () => {
                context.tasks[0] = {
                    declaration: {}, // declaration is irrelevant
                    tenantsInPath: [],
                    action: 'deploy',
                    dryRun: true
                };
                sinon.stub(DeclarationProvider.prototype, 'storeBigipDeclaration').rejects(
                    new Error('Should not have hit this call')
                );

                return assert.isFulfilled(handler.handleCreateUpdateOrDelete(context))
                    .then((result) => {
                        assert.strictEqual(result.statusCode, 200);
                        assert.strictEqual(result.body.dryRun, true);
                    });
            });
        });

        it('should handle fortune if its set to true in the request', () => {
            context.request.fortune = true;
            context.tasks[0] = {
                declaration: {}, // declaration is irrelevant
                tenantsInPath: [],
                action: 'deploy',
                dryRun: true
            };
            sinon.stub(Math, 'random').returns(0.1);
            return assert.isFulfilled(handler.handleCreateUpdateOrDelete(context))
                .then((result) => {
                    assert.strictEqual(result.body.fortune, 'Whee! Easter-egg hunting is fun!');
                });
        });
    });

    describe('.handlePatch', () => {
        beforeEach(() => {
            context.target = {
                deviceType: DEVICE_TYPES.BIG_IP,
                provisionedModules: [],
                tmosVersion: '14.1.2',
                tokens: {}
            };

            context.control = {
                port: 8100
            };

            context.tasks.push({
                tenantsInPath: [],
                urlPrefix: 'http://admin:@localhost:8100'
            });
        });

        it('should return an error when device is BIG-IP and target is specified', () => {
            context.tasks[0] = [
                {
                    op: 'add',
                    path: 'some/path',
                    value: 'myVal',
                    target: { address: '10.10.10.10' }
                }
            ];
            const result = handler.handlePatch(context);
            assert.deepEqual(result.errorMessage, 'invalid patch - declaration target can only be used when running on BIG-IQ');
        });

        it('should return an error when device is BIG-IQ and more than one target is specified', () => {
            context.tasks[0] = [
                {
                    op: 'add',
                    path: 'some/path',
                    value: 'myVal',
                    target: { address: '10.10.10.10' }
                },
                {
                    op: 'add',
                    path: 'some/path',
                    value: 'myVal',
                    target: { address: '10.10.10.20' }
                }
            ];
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            const result = handler.handlePatch(context);
            assert.deepEqual(result.errorMessage, 'invalid patch - cannot specify more than one declaration target per request');
        });

        it('should patch declaration when device is BIG-IQ', () => {
            const handleCreateUpdateOrDeleteSpy = sinon.stub(handler, 'handleCreateUpdateOrDelete').resolves();
            const getBigiqDeclarationSpy = sinon.stub(handler.declarationProvider, 'getBigiqDeclaration').resolves({
                class: 'ADC',
                tenant: {
                    class: 'Tenant',
                    hello: { path: 'darknessMyOldFriend' }
                }
            });
            context.tasks[0] = {
                fullPath: '/declare',
                tenantsInPath: [],
                class: 'AS3',
                patchBody: [
                    {
                        op: 'replace',
                        path: 'tenant/hello',
                        value: 'world',
                        target: { address: '10.10.10.10' }
                    }
                ]
            };
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            return handler.handlePatch(context)
                .then(() => {
                    assert.deepStrictEqual(
                        getBigiqDeclarationSpy.args[0][0].tasks[0].target,
                        { address: '10.10.10.10' },
                        'should have saved target so declarations can be filtered'
                    );
                    assert.strictEqual(
                        handleCreateUpdateOrDeleteSpy.args[0][0].tasks[0].declaration.tenant.hello,
                        'world'
                    );
                });
        });

        it('should patch empty state', () => {
            context.tasks[0] = {
                fullPath: '/declare',
                tenantsInPath: [],
                class: 'AS3',
                patchBody: [
                    {
                        op: 'add',
                        path: '/hello',
                        value: 'world'
                    }
                ]
            };

            sinon.stub(handler.declarationProvider, 'getBigipDeclaration').resolves(undefined);
            let updatedConfig = {};
            sinon.stub(handler, 'handleCreateUpdateOrDelete').callsFake((ctx) => {
                updatedConfig = ctx.tasks[0].declaration;
                return Promise.resolve();
            });

            return Promise.resolve()
                .then(() => handler.handlePatch(context))
                .then(() => {
                    assert.strictEqual(updatedConfig.hello, 'world');
                });
        });

        it('should add a new tenant if the op is add and that path the name of the tenant', () => {
            context.tasks[0] = {
                class: 'AS3',
                method: 'Patch',
                patchBody: [
                    {
                        op: 'add',
                        path: '/newtenant',
                        value: {
                            class: 'Tenant',
                            Application: {
                                class: 'Application'
                            }
                        }
                    }
                ],
                action: 'retrieve',
                showAge: 0,
                fullPath: '/shared/appsvcs/declare',
                tenantsInPath: ['newtenant']
            };

            const declarationProvider = new DeclarationProvider();
            sinon.stub(context.host.parser, 'digest').resolves();
            sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'PATCH_Sample',
                firstTenant: { class: 'Tenant', Application: { class: 'Application' } },
                updateMode: 'selective',
                controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
            });
            handler.declarationProvider = declarationProvider;

            let updatedConfig = {};
            sinon.stub(handler, 'handleCreateUpdateOrDelete').callsFake((ctx) => {
                updatedConfig = ctx.tasks[0].declaration;
                return Promise.resolve();
            });

            return Promise.resolve()
                .then(() => handler.handlePatch(context))
                .then(() => {
                    assert.deepStrictEqual(
                        updatedConfig,
                        {
                            class: 'ADC',
                            schemaVersion: '3.0.0',
                            id: 'PATCH_Sample',
                            updateMode: 'selective',
                            controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' },
                            newtenant: {
                                class: 'Tenant',
                                Application: {
                                    class: 'Application'
                                }
                            }
                        }
                    );
                });
        });

        it('should return an empty object when adding a new tenant if the path is not a tenant', () => {
            context.tasks[0] = {
                class: 'AS3',
                method: 'Patch',
                patchBody: [
                    {
                        op: 'add',
                        path: '/newtenant/App',
                        value: {
                            class: 'Application'
                        }
                    }
                ],
                action: 'retrieve',
                showAge: 0,
                fullPath: '/shared/appsvcs/declare',
                tenantsInPath: ['newtenant']
            };

            const declarationProvider = new DeclarationProvider();
            sinon.stub(context.host.parser, 'digest').resolves();
            sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'PATCH_Sample',
                firstTenant: { class: 'Tenant', Application: { class: 'Application' } },
                updateMode: 'selective',
                controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
            });
            handler.declarationProvider = declarationProvider;

            let updatedConfig = {};
            sinon.stub(handler, 'handleCreateUpdateOrDelete').callsFake((ctx) => {
                updatedConfig = ctx.tasks[0].declaration;
                return Promise.resolve();
            });
            const jiffSpy = sinon.spy(jiff, 'patch');

            return Promise.resolve()
                .then(() => handler.handlePatch(context))
                .then(() => {
                    assert.deepStrictEqual(updatedConfig, {});
                    assert.deepStrictEqual(jiffSpy.args[0][1],
                        {
                            body: undefined,
                            errorMessage: "specified Tenant(s) 'newtenant' not found in declaration",
                            statusCode: 404
                        });
                });
        });

        it('should return an empty object when adding a new tenant if the op is NOT add', () => {
            context.tasks[0] = {
                class: 'AS3',
                method: 'Patch',
                patchBody: [
                    {
                        op: 'replace',
                        path: '/newtenant',
                        value: {
                            class: 'Tenant',
                            Application: {
                                class: 'Application'
                            }
                        }
                    }
                ],
                action: 'retrieve',
                showAge: 0,
                fullPath: '/shared/appsvcs/declare',
                tenantsInPath: ['newtenant']
            };

            const declarationProvider = new DeclarationProvider();
            sinon.stub(context.host.parser, 'digest').resolves();
            sinon.stub(declarationProvider, 'getBigipDeclaration').resolves({
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'PATCH_Sample',
                firstTenant: { class: 'Tenant', Application: { class: 'Application' } },
                updateMode: 'selective',
                controls: { archiveTimestamp: '2022-11-03T18:41:51.996Z' }
            });
            handler.declarationProvider = declarationProvider;

            let updatedConfig = {};
            sinon.stub(handler, 'handleCreateUpdateOrDelete').callsFake((ctx) => {
                updatedConfig = ctx.tasks[0].declaration;
                return Promise.resolve();
            });
            const jiffSpy = sinon.spy(jiff, 'patch');

            return Promise.resolve()
                .then(() => handler.handlePatch(context))
                .then(() => {
                    assert.deepStrictEqual(updatedConfig, {});
                    assert.deepStrictEqual(jiffSpy.args[0][1],
                        {
                            body: undefined,
                            errorMessage: "specified Tenant(s) 'newtenant' not found in declaration",
                            statusCode: 404
                        });
                });
        });
    });

    describe('.handleRead', () => {
        it('should return 500 on failed read', () => {
            const message = 'some crazy error';
            sinon.stub(handler, 'getFilteredDeclaration').rejects({
                message
            });
            return assert.becomes(handler.handleRead(context), {
                statusCode: 500,
                errorMessage: `Unable to retrieve declaration: ${message}`,
                body: undefined
            });
        });
    });

    describe('.getOptimisticLockKeys', () => {
        it('should add optimistic lock keys', () => {
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.14.0',
                id: 'declaration_id',
                tenant1: {
                    class: 'Tenant'
                },
                tenant2: {
                    class: 'Tenant',
                    remark: 'Description'
                }
            };
            const expected = {
                class: 'ADC',
                schemaVersion: '3.14.0',
                id: 'declaration_id',
                tenant1: {
                    class: 'Tenant',
                    optimisticLockKey: 'lwfQDIlTViz3AafQXvJJdY9XCLbY9/n83eBPF8FAmyc='
                },
                tenant2: {
                    class: 'Tenant',
                    remark: 'Description',
                    optimisticLockKey: '0+7sVoquTFg5JmFAPzOwSBXMBN5qShcUKkXVeC1nxIE='
                }
            };
            handler.getOptimisticLockKeys(declaration);
            assert.deepEqual(declaration, expected);
        });

        it('should not overwrite provided hash value', () => {
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.14.0',
                id: 'declaration_id',
                tenant1: {
                    class: 'Tenant',
                    optimisticLockKey: 'UserProvidedOptimisticLockKey'
                }
            };
            const expected = {
                class: 'ADC',
                schemaVersion: '3.14.0',
                id: 'declaration_id',
                tenant1: {
                    class: 'Tenant',
                    optimisticLockKey: 'UserProvidedOptimisticLockKey'
                }
            };
            handler.getOptimisticLockKeys(declaration);
            assert.deepEqual(declaration, expected);
        });
    });

    describe('.process', () => {
        beforeEach(() => {
            context.control = {};
        });

        it('should fulfill with a 403 failed result object if TargetContext got a returns a 403', () => {
            sinon.stub(TargetContext, 'get').rejects({
                statusCode: 403,
                message: 'the authorization provided was insufficient'
            });
            return assert.becomes(handler.process(context), {
                statusCode: 403,
                errorMessage: 'the authorization provided was insufficient',
                body: undefined
            });
        });

        it('should reject if TargetContext did not return a statusCode', () => {
            sinon.stub(TargetContext, 'get').rejects({
                message: 'the authorization provided was insufficient'
            });
            return assert.isRejected(handler.process(context),
                /the authorization provided was insufficient/);
        });
    });

    describe('persistConfig', () => {
        beforeEach(() => {
            context = Context.build();
            context.tasks.push({ protocol: 'http', urlPrefix: 'http://localhost:8100' });
            sinon.stub(promiseUtil, 'delay').resolves();
        });

        afterEach(() => {
            sinon.restore();
            nock.cleanAll();
        });

        function nockCreate() {
            nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(200, {
                    selfLink: 'https://localhost/mgmt/tm/task/sys/config/42',
                    _taskId: 42
                });
        }

        function nockStart() {
            nock('http://localhost:8100')
                .put('/mgmt/tm/task/sys/config/42')
                .reply(200);
        }

        function nockInProgress(n) {
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .times(n)
                .reply(400, {
                    error: 'TimeoutException'
                });
        }

        function nockBadRequest(n) {
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .times(n)
                .reply(400, {
                    error: 'response=400'
                });
        }

        function nockCompleted(state) {
            state = state || {};
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(200, () => {
                    state.completed = true;
                    return {
                        _taskState: 'COMPLETED'
                    };
                });
        }

        function nockTimeout() {
            // nock.delayConnection doesn't seem to work across all of our node versions
            // so we have to fake the timeout error by emitting it ourselves
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(504, function () {
                    this.req.emit('timeout');
                });
        }

        function nockTaskNotFound() {
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(404, { message: 'Task not found - ID: 42 user: admin' });
        }

        function assertComplete() {
            const state = {};
            nockCompleted(state);
            return assert.isFulfilled(DeclarationHandler.persistConfig(context))
                .then(() => {
                    assert(state.completed, 'Did not wait for COMPLETED state');
                });
        }

        it('should reject if run POST fails', () => {
            nock('http://localhost:8100')
                .post('/mgmt/tm/task/sys/config')
                .reply(500, 'waldo');
            return assert.isRejected(
                DeclarationHandler.persistConfig(context),
                /waldo/
            );
        });

        it('should reject if start PUT fails', () => {
            nockCreate();
            nock('http://localhost:8100')
                .put('/mgmt/tm/task/sys/config/42')
                .reply(500, 'waldo');
            return assert.isRejected(
                DeclarationHandler.persistConfig(context),
                /waldo/
            );
        });

        it('should reject if status GET fails', () => {
            nockCreate();
            nockStart();
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(500, 'waldo');
            return assert.isRejected(
                DeclarationHandler.persistConfig(context),
                /waldo/
            );
        });

        it('should fulfill on COMPLETED state', () => {
            nockCreate();
            nockStart();
            return assertComplete();
        });

        it('should wait when in VALIDATING state', () => {
            nockCreate();
            nockStart();
            nockInProgress();
            return assertComplete();
        });

        it('should fulfill even if in progress checks do not timeout', () => {
            nockCreate();
            nockStart();
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(200, {
                    _taskState: 'VALIDATING'
                });
            return assertComplete();
        });

        it('should reject if too many timeouts are encountered', () => {
            nockCreate();
            nockStart();
            nockInProgress(121);
            return assert.isRejected(
                DeclarationHandler.persistConfig(context),
                /TimeoutException/
            );
        });

        it('should reject on FAILED state', () => {
            nockCreate();
            nockStart();
            nock('http://localhost:8100')
                .get('/mgmt/tm/task/sys/config/42')
                .reply(200, {
                    _taskState: 'FAILED'
                });
            return assert.isRejected(
                DeclarationHandler.persistConfig(context),
                /failed during execution/
            );
        });

        it('should reject if too many response=400 are encountered', () => {
            nockCreate();
            nockStart();
            nockBadRequest(121);
            return assert.isRejected(
                DeclarationHandler.persistConfig(context),
                /response=400/
            );
        });

        it('should retry on timeout', () => {
            nockCreate();
            nockStart();
            nockTimeout();
            return assertComplete()
                .then(() => {
                    assert.ok(nock.isDone(), `nock has pending mocks:\n${nock.pendingMocks()}`);
                });
        });

        it('should update error message if task is not found', () => {
            const expectedMsg = /failed to save BIG-IP config \(Record no longer exists on BIG-IP for saving configuration task \(ID: 42\)/;
            nockCreate();
            nockStart();
            nockTaskNotFound();
            return assert.isRejected(DeclarationHandler.persistConfig(context), expectedMsg);
        });
    });
});

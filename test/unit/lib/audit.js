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

const assert = require('assert');
const nock = require('nock');
const sinon = require('sinon');
const EventEmitter = require('events');

const checkAndDelete = require('@f5devcentral/atg-shared-utilities-dev').checkAndDeleteProperty;
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;

const audit = require('../../../src/lib/audit');
const bigiq = require('../../../src/lib/bigiq');
const fetch = require('../../../src/lib/fetch');
const DiffProcessor = require('../../../src/lib/diffProcessor');
const log = require('../../../src/lib/log');
const Context = require('../../../src/lib/context/context');
const UpdateRest = require('../../../src/lib/updaterRest');
const UpdaterTmsh = require('../../../src/lib/updaterTmsh');
const Tracer = require('../../../src/lib/tracer').Tracer;
const util = require('../../../src/lib/util/util');
const DEVICE_TYPES = require('../../../src/lib/constants').DEVICE_TYPES;
const EVENTS = require('../../../src/lib/constants').EVENTS;

describe('audit', () => {
    let context;

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    beforeEach(() => {
        context = Context.build();
        context.request = {
            eventEmitter: new EventEmitter(),
            tracer: new Tracer('test tracer', { enabled: false }),
            postProcessing: []
        };
        sinon.stub(fetch, 'getCommonAccessProfiles').resolves();
        sinon.stub(fetch, 'updateCommonAccessProfiles').resolves();
    });

    describe('.handleServiceDiscoveryTasks', () => {
        it('should get SD tasks from diff and DELETE each', () => {
            const diffs = [
                {
                    kind: 'N',
                    rhs: {
                        command: 'mgmt shared service-discovery task',
                        properties: {
                            id: 'taskId1'
                        }
                    }
                },
                {
                    kind: 'N',
                    rhs: {
                        command: 'mgmt shared service-discovery task',
                        properties: {
                            id: 'taskId2'
                        }
                    }
                }
            ];
            context.control = {
                targetPort: 8100,
                port: 8100,
                basicAuth: 'HeresSomeBasicAuth'
            };
            context.target.tokens = { 'X-F5-Auth-Token': 'validtoken' };
            context.tasks = [{ urlPrefix: 'http://admin@localhost:8100' }];

            const isDeleted = [false, false];
            nock('http://localhost:8100')
                .delete('/mgmt/shared/service-discovery/task/taskId1?ignoreMissing=true')
                .reply(200, () => {
                    isDeleted[0] = true;
                });
            nock('http://localhost:8100')
                .delete('/mgmt/shared/service-discovery/task/taskId2?ignoreMissing=true')
                .reply(200, () => {
                    isDeleted[1] = true;
                });
            return Promise.resolve()
                .then(() => audit.handleServiceDiscoveryTasks(context, diffs))
                .then(() => {
                    assert(isDeleted[0], 'DELETE request was not sent for first task');
                    assert(isDeleted[1], 'DELETE request was not sent for second task');
                });
        });
    });

    describe('.allTenants', () => {
        it('should call bigiq.deployTenant if deviceType is BIG_IQ', () => {
            const declaration = { Common: { controls: {} } };
            const commonConfig = {};
            context.control = { targetHost: '192.0.2.8' };
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            context.tasks[0] = {};

            const spy = sinon.stub(bigiq, 'deployTenant').callsFake(
                (contextArg, tenantId, declarationArg) => {
                    assert(contextArg, 'missing context argument');
                    assert(tenantId, 'missing tenantId argument');
                    assert(declarationArg, 'missing declaration argument');
                    return Promise.resolve({});
                }
            );
            sinon.stub(log, 'updateGlobalSettings').returns();

            return audit.allTenants(context, ['Common'], declaration, commonConfig)
                .then((response) => {
                    assert.equal(response[0].tenant, 'Common');
                    assert(spy.called, 'bigiq.deployTenant should have been called');
                });
        });

        it('should list appropriate tenants if deviceType is BIG_IQ', () => {
            const commonConfig = {};
            context.control = { targetHost: '192.0.2.8' };
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            context.tasks[0] = {};

            sinon.stub(bigiq, 'deployTenant').resolves({});
            sinon.stub(log, 'updateGlobalSettings').returns();

            const declaration = {
                Common: {},
                tenant: {}
            };
            return Promise.resolve()
                .then(() => audit.allTenants(context, ['tenant'], declaration, commonConfig))
                .then((response) => {
                    assert.equal(response[0].tenant, 'tenant, Common');
                })
                .then(() => audit.allTenants(context, ['Common'], declaration, commonConfig))
                .then((response) => {
                    assert.equal(response[0].tenant, 'Common');
                })
                .then(() => {
                    delete declaration.Common;
                    return audit.allTenants(context, ['tenant'], declaration, commonConfig);
                })
                .then((response) => {
                    assert.equal(response[0].tenant, 'tenant');
                });
        });

        it('should iterate through all tenants', () => {
            const declaration = {
                tenant1: { controls: {} },
                tenant2: { controls: {} }
            };
            context.control = { targetHost: '192.0.2.8' };
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            context.tasks.push({});

            const diffSpy = sinon.stub(DiffProcessor.prototype, 'process').resolves();

            sinon.stub(log, 'updateGlobalSettings').returns();
            sinon.stub(fetch, 'getDesiredConfig').resolves();
            sinon.stub(fetch, 'getTenantConfig').resolves();
            sinon.stub(fetch, 'getDiff').resolves([]);

            return audit.allTenants(context, ['tenant1', 'tenant2'], declaration)
                .then(() => {
                    assert(diffSpy.calledTwice, 'DiffProcessor.process should have been called twice');
                });
        });

        describe('postProcess', () => {
            beforeEach(() => {
                audit.setPostProcessInfo('123', {});

                sinon.stub(log, 'error').callsFake((err) => {
                    if (!err.message.match(
                        /Cannot read propert(ies of undefined \(reading 'nodeList'\)|y 'nodeList' of undefined)/
                    )) {
                        throw err; // If not one of the two expected errors, error and exit
                    }
                });
            });

            it('should handle APM profile updates', () => {
                const declaration = {
                    tenant1: { controls: {} }
                };
                context.control = { targetHost: '192.0.2.8' };
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.tasks.push({});

                const eventInfo = {
                    uuid: '123',
                    tenant: 'tenant',
                    oldName: 'my old name',
                    newName: 'my new name'
                };
                const expected = util.simpleCopy(eventInfo);

                return audit.allTenants(context, ['tenant1'], declaration)
                    .then(() => {
                        context.request.eventEmitter.emit(EVENTS.APM_PROFILE_UPDATED, eventInfo);
                        const postProcessInfo = audit.getPostProcessInfo();
                        assert.deepStrictEqual(postProcessInfo['123'].apmProfileUpdates['/tenant/my old name'], expected);
                    });
            });

            it('should handle profile reference updates', () => {
                const declaration = {
                    tenant1: { controls: {} }
                };
                context.control = { targetHost: '192.0.2.8' };
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.tasks.push({});

                const eventInfo = {
                    uuid: '123'
                };

                return audit.allTenants(context, ['tenant1'], declaration)
                    .then(() => {
                        eventInfo.profilePath = '/profile/path/1';
                        eventInfo.virtualPath = '/my/virtual/1';
                        context.request.eventEmitter.emit(EVENTS.PROFILE_REFERENCED, eventInfo);
                        eventInfo.virtualPath = '/my/virtual/2';
                        context.request.eventEmitter.emit(EVENTS.PROFILE_REFERENCED, eventInfo);

                        eventInfo.profilePath = '/profile/path/2';
                        eventInfo.virtualPath = '/my/virtual/1';
                        context.request.eventEmitter.emit(EVENTS.PROFILE_REFERENCED, eventInfo);
                        delete eventInfo.virtualPath;
                        eventInfo.iRule = {
                            name: '/my/irule/1',
                            text: 'this is my irule'
                        };
                        context.request.eventEmitter.emit(EVENTS.PROFILE_REFERENCED, eventInfo);

                        const postProcessInfo = audit.getPostProcessInfo();

                        const expected = {
                            profileReferences: {
                                '/profile/path/1': {
                                    virtuals: [
                                        '/my/virtual/1',
                                        '/my/virtual/2'
                                    ],
                                    iRules: {}
                                },
                                '/profile/path/2': {
                                    virtuals: [
                                        '/my/virtual/1'
                                    ],
                                    iRules: {
                                        '/my/irule/1': 'this is my irule'
                                    }
                                }
                            }
                        };

                        assert.deepStrictEqual(postProcessInfo['123'], expected);
                    });
            });

            it('should only register for events once', () => {
                const declaration = {
                    tenant1: { controls: {} },
                    tenant2: { controls: {} }
                };
                context.control = { targetHost: '192.0.2.8' };
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.tasks.push({});

                return audit.allTenants(context, ['tenant1', 'tenant2'], declaration)
                    .then(() => {
                        assert.strictEqual(context.request.eventEmitter.listenerCount(EVENTS.APM_PROFILE_UPDATED), 1);
                        assert.strictEqual(context.request.eventEmitter.listenerCount(EVENTS.PROFILE_REFERENCED), 1);
                    });
            });

            it('should post process APM updates', () => {
                const declaration = {
                    tenant1: { controls: {} }
                };
                context.control = { targetHost: '192.0.2.8' };
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.tasks.push({
                    uuid: '123'
                });

                const updaterTmshSpy = sinon.stub(UpdaterTmsh.prototype, 'postProcessUpdate').resolves();

                const postProcessInfo = {
                    foo: 'bar'
                };
                audit.setPostProcessInfo('123', postProcessInfo);

                return audit.allTenants(context, ['tenant1'], declaration)
                    .then(() => {
                        assert(updaterTmshSpy.calledWith({ foo: 'bar' }));
                    });
            });
        });
    });

    describe('.auditTenant', () => {
        let declaration = {};
        beforeEach(() => {
            sinon.stub(log, 'updateGlobalSettings').returns();
            sinon.stub(fetch, 'getDesiredConfig').resolves({ desired: {} });
            sinon.stub(fetch, 'getTenantConfig').resolves({ current: {} });
            sinon.stub(fetch, 'getDiff').resolves({ diff: {} });
            sinon.stub(DiffProcessor.prototype, 'process').resolves();
            sinon.stub(DiffProcessor.prototype, 'validate').resolves();
            sinon.stub(UpdateRest.prototype, 'tagDiff').resolves();
            sinon.stub(UpdaterTmsh.prototype, 'tagDiff').resolves();
            sinon.stub(UpdateRest.prototype, 'update').resolves();
            sinon.stub(UpdaterTmsh.prototype, 'update').resolves();
            sinon.stub(promiseUtil, 'series').resolves([]);
            declaration = {
                id: 'audit_tenant_id',
                tenant: {
                    controls: {
                        traceResponse: false
                    }
                }
            };
        });

        it('should not add trace files to context.log', () => {
            context.log = {};
            context.control = {};
            context.tasks.push({});
            context.target.deviceType = DEVICE_TYPES.BIG_IP;

            return audit.auditTenant(context, 'tenant', declaration, {}, {})
                .then(() => {
                    assert.deepEqual(context.log.tenantDesired, undefined);
                    assert.deepEqual(context.log.tenantCurrent, undefined);
                    assert.deepEqual(context.log.tenantDiff, undefined);
                });
        });

        it('should add trace files to context.log', () => {
            context.log = {};
            context.control = {};
            context.tasks.push({});
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            declaration.tenant.controls.traceResponse = true;

            return audit.auditTenant(context, 'tenant', declaration, {}, {})
                .then(() => {
                    assert.deepEqual(context.log.tenantDesired, { desired: {} });
                    assert.deepEqual(context.log.tenantCurrent, { current: {} });
                    assert.deepEqual(context.log.tenantDiff, { diff: {} });
                });
        });

        it('should not have traceResponse in context.control', () => {
            context.log = {};
            context.control = {};
            context.tasks.push({});
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            declaration.tenant.controls.traceResponse = true;

            return audit.auditTenant(context, 'tenant', declaration, {}, {})
                .then(() => {
                    assert.deepEqual(context.control.traceResponse, undefined);
                });
        });

        it('should digest previous declaration when unchecked mode enabled', () => {
            let prevDecl;
            context.log = {};
            context.control = {};
            context.tasks.push({ unchecked: true });
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            context.host.parser = {
                digest: sinon.stub().callsFake((ctx, decl) => {
                    prevDecl = decl;
                })
            };

            return audit.auditTenant(context, 'tenant', declaration, {}, { prevDecl: true })
                .then(() => {
                    assert.deepStrictEqual(prevDecl, { prevDecl: true });
                });
        });

        it('should call getDesiredConfig for tenantCurrent when unchecked mode enabled', () => {
            context.log = {};
            context.control = {};
            context.tasks.push({ unchecked: true });
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            context.host.parser = {
                digest: sinon.stub()
            };
            declaration.tenant.controls.traceResponse = true;

            return audit.auditTenant(context, 'tenant', declaration, {}, {})
                .then(() => {
                    assert.deepStrictEqual(context.log.tenantDesired, { desired: {} });
                    assert.deepStrictEqual(context.log.tenantCurrent, { desired: {} });
                    assert.deepStrictEqual(context.log.tenantDiff, { diff: {} });
                });
        });

        it('handle fortune if fortune is set to false', () => {
            context.log = {};
            context.control = { fortune: false };
            context.tasks.push({ unchecked: true });
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            context.host.parser = {
                digest: sinon.stub()
            };
            declaration.tenant.controls.fortune = false;

            return audit.auditTenant(context, 'tenant', declaration, {}, {})
                .then(() => {
                    assert.strictEqual(context.request.fortune, false);
                    assert.deepStrictEqual(context.control, {});
                    assert.strictEqual(typeof declaration.tenant.controls.fortune, 'undefined');
                });
        });

        it('should return an expected response and verify log is written at info level', () => {
            context.log = {};
            context.control = { fortune: false };
            context.tasks.push({ unchecked: true });
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            context.host.parser = {
                digest: sinon.stub()
            };
            declaration.tenant.controls.fortune = false;
            const infoSpy = sinon.spy(log, 'info');

            return audit.auditTenant(context, 'tenant', declaration, {}, {})
                .then((response) => {
                    assert.strictEqual(context.request.fortune, false);
                    assert.deepStrictEqual(context.control, {});
                    const result = checkAndDelete([response], 'runTime', 'number')[0];
                    assert.deepStrictEqual(
                        result,
                        {
                            code: 200,
                            message: 'success',
                            tenant: 'tenant',
                            declarationId: 'audit_tenant_id'
                        }
                    );
                    assert.strictEqual(infoSpy.callCount, 1);
                });
        });

        describe('uncheckedDiff application', () => {
            let prevDecl;
            let decl;
            let uncheckedDiff;
            let spy;

            beforeEach(() => {
                prevDecl = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '1637021611597',
                    updateMode: 'complete',
                    controls: {
                        archiveTimestamp: '2021-11-16T00:13:32.363Z'
                    }
                };

                decl = {
                    Common: {
                        controls: {
                            traceResponse: false
                        }
                    },
                    NotCommon: {
                        controls: {
                            traceResponse: false
                        }
                    }
                };

                // These tests need uncheckedDiff and empty tenantCurrentConfig to copy or not copy contents into
                uncheckedDiff = {
                    '/Common/Service_Address-192.0.2.11': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '192.0.2.11',
                            arp: 'enabled',
                            'icmp-echo': 'enabled',
                            mask: '255.255.255.255',
                            'route-advertisement': 'disabled',
                            spanning: 'disabled',
                            'traffic-group': 'default',
                            metadata: {
                                references: {
                                    value: 1
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/Shared/test.item-foo': {
                        command: 'ltm virtual',
                        properties: {
                            'address-status': 'yes',
                            'auto-lasthop': 'default',
                            'connection-limit': 0,
                            description: '"Shared"',
                            destination: '/Common/192.0.2.11:8080',
                            'ip-protocol': 'tcp',
                            'last-hop-pool': 'none',
                            mask: '255.255.255.255',
                            mirror: 'disabled',
                            persist: {
                                '/Common/source_addr': {
                                    default: 'yes'
                                }
                            },
                            policies: {},
                            profiles: {
                                '/Common/f5-tcp-progressive': {
                                    context: 'all'
                                }
                            },
                            'service-down-immediate-action': 'none',
                            source: '0.0.0.0/0',
                            'source-address-translation': {
                                type: 'automap'
                            },
                            rules: {},
                            'security-log-profiles': {},
                            'source-port': 'preserve',
                            'translate-address': 'enabled',
                            'translate-port': 'enabled',
                            nat64: 'disabled',
                            vlans: {},
                            'vlans-disabled': ' ',
                            metadata: {},
                            'clone-pools': {},
                            'throughput-capacity': 'infinite'
                        },
                        ignore: []
                    }
                };

                context.log = {};
                context.host.parser = {
                    digest: sinon.stub().callsFake((ctx, dec) => {
                        prevDecl = dec;
                    })
                };

                fetch.getDesiredConfig.restore();
                sinon.stub(fetch, 'getDesiredConfig').callsFake(
                    // the current config is from fetchCurrentConfigFromPrev calling getDesiredConfig
                    // with the previous declaration. Otherwise it is the desired config
                    (cntxt, tenantId, dcl) => {
                        if (dcl === prevDecl) {
                            return Promise.resolve({ prevDecl: {} });
                        }
                        return Promise.resolve({ desired: {} });
                    }
                );

                fetch.getDiff.restore();
                spy = sinon.stub(fetch, 'getDiff').resolves([]);
            });

            it('should apply uncheckedDiff on delete pass of Common when unchecked is true', () => {
                // unchecked: true
                // firstPassNoDelete: false
                // tenentId: Common
                // result: tenantCurrentConfig will be updated from the previous
                //   declaration to the previous declaration plus the uncheckDiff

                context.tasks.push({ unchecked: true, firstPassNoDelete: false });

                return audit.auditTenant(context, 'Common', decl, {}, prevDecl, uncheckedDiff)
                    .then(() => {
                        assert.strictEqual(spy.called, true);
                        const expectedValue = util.simpleCopy(uncheckedDiff);
                        expectedValue.prevDecl = {};
                        // args[1] is tenantCurrentConfig updated with the uncheckedDiff
                        assert.deepStrictEqual(spy.getCalls()[0].args[1], expectedValue);
                    });
            });

            it('should not apply uncheckedDiff on non Common passes when unchecked is true', () => {
                // unchecked: true
                // firstPassNoDelete: false
                // tenentId: NotCommon
                // result: tenantCurrentConfig will not be updated
                context.control = {
                    firstPassNoDelete: false // after Common add pass
                };

                context.tasks.push({ unchecked: true });

                return audit.auditTenant(context, 'NotCommon', decl, {}, prevDecl, uncheckedDiff)
                    .then(() => {
                        assert.strictEqual(spy.called, true);
                        // args[1] is tenantCurrentConfig which should not be updated
                        assert.deepStrictEqual(spy.getCalls()[0].args[1], { prevDecl: {} });
                    });
            });

            it('should not apply uncheckedDiff on delete pass of Common when unchecked is false', () => {
                // unchecked: false
                // firstPassNoDelete: false
                // tenentId: Common
                // result: tenantCurrentConfig will not be updated

                context.control = {
                    firstPassNoDelete: false // delete pass
                };

                context.tasks.push({}); // unchecked not defined

                return audit.auditTenant(context, 'Common', decl, {}, prevDecl, uncheckedDiff)
                    .then(() => {
                        // args[1] is tenantCurrentConfig which should not be updated
                        assert.strictEqual(spy.called, true);
                        assert.deepStrictEqual(spy.getCalls()[0].args[1], { current: {} });
                    });
            });

            it('should not apply uncheckedDiff when firstPassNoDelete true and unchecked is true', () => {
                // unchecked: true
                // firstPassNoDelete: true
                // tenentId: Common
                // result: tenantCurrentConfig will not be updated
                context.control = {
                    firstPassNoDelete: true
                };

                context.tasks.push({ unchecked: true });

                return audit.auditTenant(context, 'Common', decl, {}, prevDecl, uncheckedDiff)
                    .then(() => {
                        // args[1] is tenantCurrentConfig which should not be updated
                        assert.strictEqual(spy.called, true);
                        assert.deepStrictEqual(spy.getCalls()[0].args[1], { prevDecl: {} });
                    });
            });
        });

        describe('per-app mode', () => {
            it('should handle per-app declaration when unchecked mode is disabled', () => {
                context.log = {};
                context.control = {};
                context.tasks.push({ unchecked: false });
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.host.parser = {
                    digest: sinon.stub()
                };
                declaration.tenant.controls.traceResponse = true;

                return audit.auditTenant(context, 'tenant', declaration, {}, {})
                    .then(() => {
                        assert.deepStrictEqual(context.log.tenantDesired, { desired: {} });
                        assert.deepStrictEqual(context.log.tenantCurrent, { current: {} });
                        assert.deepStrictEqual(context.log.tenantDiff, { diff: {} });
                    });
            });

            it('should handle per-app declaration when unchecked mode is enabled', () => {
                context.log = {};
                context.control = {};
                context.tasks.push({ unchecked: true });
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.host.parser = {
                    digest: sinon.stub()
                };
                declaration.tenant.controls.traceResponse = true;

                return audit.auditTenant(context, 'tenant', declaration, {}, {})
                    .then(() => {
                        assert.deepStrictEqual(context.log.tenantDesired, { desired: {} });
                        assert.deepStrictEqual(context.log.tenantCurrent, { desired: {} });
                        assert.deepStrictEqual(context.log.tenantDiff, { diff: {} });
                    });
            });

            it('should digest previous declaration when unchecked mode enabled', () => {
                let prevDecl;
                context.log = {};
                context.control = {};
                context.tasks.push({ unchecked: true });
                context.target.deviceType = DEVICE_TYPES.BIG_IP;
                context.host.parser = {
                    digest: sinon.stub().callsFake((ctx, decl) => {
                        prevDecl = decl;
                    })
                };

                return audit.auditTenant(context, 'tenant', declaration, {}, { prevDecl: true })
                    .then(() => {
                        assert.deepStrictEqual(prevDecl, { prevDecl: true });
                    });
            });

            describe('filter config', () => {
                let desiredConfig;
                let currentConfig;

                beforeEach(() => {
                    context.request = {
                        tracer: new Tracer('test tracer', { enabled: false }),
                        isPerApp: true,
                        perAppInfo: {
                            tenant: 'tenant',
                            apps: ['Application1']
                        }
                    };

                    context.control = {};
                    context.tasks.push({});
                    context.target.deviceType = DEVICE_TYPES.BIG_IP;

                    declaration.tenant.controls.traceResponse = true;

                    desiredConfig = {
                        '/tenant/Application1/': {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        '/tenant/Application1/service': {
                            command: 'ltm virtual',
                            properties: {
                                enabled: true,
                                destination: '/tenant/192.0.2.1:80',
                                pool: '/tenant/Application1/pool'
                            },
                            ignore: []
                        },
                        '/tenant/Application1/pool': {
                            command: 'ltm pool',
                            properties: {
                                members: {}
                            },
                            ignore: []
                        }
                    };
                    currentConfig = {
                        '/tenant/Application1/': {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        '/tenant/Application1/service': {
                            command: 'ltm virtual',
                            properties: {
                                enabled: true,
                                destination: '/tenant/192.0.2.1:80',
                                pool: '/tenant/Application1/pool'
                            },
                            ignore: []
                        },
                        '/tenant/Application1/pool': {
                            command: 'ltm pool',
                            properties: {
                                members: {}
                            },
                            ignore: []
                        },
                        '/myTenant/Application2/': {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        '/myTenant/Application2/service': {
                            command: 'ltm virtual',
                            properties: {
                                enabled: true,
                                destination: '/myTenant/192.0.2.3:80',
                                pool: '/myTenant/Application2/pool'
                            },
                            ignore: []
                        },
                        '/tenant/Shared/sharedPool': {
                            command: 'ltm pool',
                            properties: {
                                members: {}
                            },
                            ignore: []
                        }
                    };

                    fetch.getDesiredConfig.restore();
                    fetch.getTenantConfig.restore();

                    sinon.stub(fetch, 'getDesiredConfig').resolves(desiredConfig);
                    sinon.stub(fetch, 'getTenantConfig').resolves(currentConfig);
                });

                it('should filter out apps that are not needed', () => audit.auditTenant(context, 'tenant', declaration, {}, {})
                    .then(() => {
                        const desiredString = JSON.stringify(context.log.tenantDesired);
                        const currentString = JSON.stringify(context.log.tenantCurrent);
                        assert.notStrictEqual(desiredString.indexOf('Application1'), -1);
                        assert.notStrictEqual(currentString.indexOf('Application1'), -1);
                        assert.strictEqual(desiredString.indexOf('Application2'), -1);
                        assert.strictEqual(currentString.indexOf('Application2'), -1);
                        assert.strictEqual(currentString.indexOf('Shared'), -1);
                        assert.deepStrictEqual(context.log.tenantDiff.diff, {});
                    }));

                it('should leave Shared if needed', () => {
                    declaration.Application2 = {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.2.3'
                            ],
                            pool: {
                                use: '/tenant/Shared/sharedPool'
                            }
                        }
                    };

                    return audit.auditTenant(context, 'tenant', declaration, {}, {})
                        .then(() => {
                            const currentString = JSON.stringify(context.log.tenantCurrent);
                            assert.notStrictEqual(currentString.indexOf('Shared'), -1);
                        });
                });
            });
        });
    });
});

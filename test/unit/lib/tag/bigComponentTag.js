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

const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const BigComponentTag = require('../../../../src/lib/tag').BigComponentTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const utils = require('../../../../src/lib/util/util');

describe('bigComponentTag', () => {
    let context;
    let declaration;
    let components;
    let iSpyControl;

    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    beforeEach(() => {
        iSpyControl = sinon.spy(utils, 'iControlRequest');
        context = Context.build();
        context.tasks.push({ protocol: 'http', urlPrefix: 'http://localhost:8100' });
        components = [];
        declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: '5489432',
            Tenant: {
                class: 'Tenant',
                A0: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP', // "query net route-domain"
                        virtualAddresses: ['192.0.2.107'],
                        snat: 'auto',
                        pool: 'Pool1',
                        policyWAF: { bigip: '/Common/test-policy' } // query asm policy
                    },
                    Pool1: {
                        class: 'Pool',
                        monitors: [
                            {
                                bigip: '/Common/icmp' // "probe ltm monitors"
                            }
                        ],
                        members: []
                    }
                }
            },
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    testDataCenter: {
                        class: 'GSLB_Data_Center'
                    },
                    testServer: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'testDataCenter'
                        },
                        devices: [
                            {
                                address: '192.0.2.50'
                            }
                        ],
                        virtualServer: [
                            {
                                address: '192.0.2.51',
                                port: 5050
                            }
                        ]
                    }
                }
            }
        };
    });

    function getComponent(schema) {
        let component = {};
        switch (schema) {
        case 'asm': {
            component = {
                tenant: 'Tenant',
                instancePath: '/Tenant/A0/service/policyWAF',
                parentDataProperty: 'policyWAF',
                schemaData: ['query asm policy'],
                data: {
                    bigip: '/Common/test-policy'
                },
                parentData: { // NOTE: full object value shortened for readability
                    class: 'Service_HTTP',
                    policyWAF: {
                        bigip: '/Common/test-policy'
                    }
                }
            };
            break;
        }
        case 'monitor': {
            component = {
                tenant: 'Tenant',
                instancePath: '/Tenant/A0/Pool1/monitors/0',
                parentDataProperty: 0,
                schemaData: ['probe ltm monitor icmp'],
                data: {
                    bigip: '/Common/icmp'
                },
                parentData: [
                    {
                        bigip: '/Common/test-policy'
                    }
                ]
            };
            break;
        }
        case 'route-domain': {
            component = {
                tenant: 'Tenant',
                instancePath: '/Tenant/defaultRouteDomain',
                parentDataProperty: 'defaultRouteDomain',
                schemaData: ['query net route-domain'],
                data: 0,
                parentData: { // NOTE: full object value shortened for readability
                    class: 'Tenant',
                    defaultRouteDomain: 0
                }
            };
            break;
        }
        case 'virtual-address': {
            component = {
                tenant: 'Tenant',
                instancePath: '/Tenant/A0/service/virtualAddresses/0',
                parentDataProperty: '0',
                schemaData: ['query ltm virtual-address'],
                data: {
                    bigip: '/Common/address'
                },
                parentData: [
                    {
                        bigip: '/Common/address'
                    }
                ]
            };
            break;
        }
        case 'gslb-monitor': {
            component = {
                tenant: 'Common',
                instancePath: '/Common/Shared/testServer/monitors/0',
                parentDataProperty: '0',
                schemaData: [
                    'query gtm monitor bigip',
                    'query gtm monitor bigip-link',
                    'query gtm monitor external',
                    'query gtm monitor firepass',
                    'query gtm monitor ftp',
                    'query gtm monitor gateway-icmp',
                    'query gtm monitor gtp' // Shortened for redundancy sake
                ],
                data: {
                    bigip: '/Common/bigip'
                },
                parentData: [
                    {
                        bigip: '/Common/bigip'
                    }
                ]
            };
            break;
        }
        default:
        }
        return component;
    }

    describe('.process', () => {
        it('should resolve if context is undefined',
            () => assert.isFulfilled(BigComponentTag.process()));

        it('should resolve if declaration is undefined',
            () => assert.isFulfilled(BigComponentTag.process(context)));

        it('should resolve if components is undefined',
            () => assert.isFulfilled(BigComponentTag.process(context, declaration)));

        it('should resolve if no components to process',
            () => assert.isFulfilled(BigComponentTag.process(context, declaration, [])));

        it('should skip checking components if scratch is defined', () => {
            components.push(getComponent());
            declaration.scratch = 'scratch';

            return assert.isFulfilled(BigComponentTag.process(context, declaration, components));
        });

        it('should skip checking components if deviceType is BIG-IQ', () => {
            components.push(getComponent());

            context.target = {};
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            return assert.isFulfilled(BigComponentTag.process(context, declaration, components));
        });

        it('should skip checking components if the schema param is undefined', () => {
            components.push(getComponent());
            delete components[0].schema;

            return assert.isFulfilled(BigComponentTag.process(context, declaration, components));
        });

        it('should skip checking components if the schema param is empty', () => {
            components.push(getComponent());
            components[0].schema = '';

            return assert.isFulfilled(BigComponentTag.process(context, declaration, components));
        });

        it('should skip checking components if the data param is null', () => {
            components.push(getComponent());
            components[0].data = null;

            return assert.isFulfilled(BigComponentTag.process(context, declaration, components));
        });

        it('should skip checking components if the data param does not have bigip property', () => {
            components.push(getComponent());
            components[0].data = {};

            return assert.isFulfilled(BigComponentTag.process(context, declaration, components));
        });

        it('should error if the component is ASM and not policy', () => {
            components.push(getComponent('asm'));
            components[0].schemaData = ['query asm device-sync'];

            return assert.isRejected(BigComponentTag.process(context, declaration, components),
                /asm device-sync is not currently supported/);
        });

        it('should error if the schemaData does NOT match the regex', () => {
            components.push(getComponent('asm'));
            components[0].schemaData = ['bad schemaData'];

            return assert.isRejected(BigComponentTag.process(context, declaration, components),
                /f5PostProcess(bigComponent) should match \/^\(asm policy|\(\(query|probe\) \([^\\\\x20]+\\\\x20\)*[^\\\\x20]+\)\)?$/);
        });

        it('should handle a declaration with asm and non-asm components', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/asm/policies')
                .reply(200, JSON.stringify({ items: [{ fullPath: '/Common/test-policy' }] }))
                .post('/mgmt/tm/ltm/monitor/icmp')
                .reply(409, JSON.stringify({
                    code: 409,
                    message: 'The requested monitor (/Common/icmp) already exists in partition Common',
                    errorStack: [],
                    apiError: 3
                }));

            components.push(getComponent('asm'));
            components.push(getComponent('route-domain')); // Should not hit this endpoint
            components.push(getComponent('monitor'));

            return BigComponentTag.process(context, declaration, components)
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 2, 'should have called iControlRequest thrice');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/asm/policies',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[1][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'POST',
                            path: '/mgmt/tm/ltm/monitor/icmp',
                            send: '{"name":"/Common/icmp"}'
                        }
                    );
                });
        });

        it('should reject if the asm policy is missing', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/asm/policies')
                .reply(200, JSON.stringify({ items: [] }));

            components.push(getComponent('asm'));

            return assert.isRejected(
                BigComponentTag.process(context, declaration, components),
                /Unable to find specified WAF policy \/Common\/test-policy for \/Tenant\/A0\/service\/policyWAF/
            )
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have only called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/asm/policies',
                            send: undefined
                        }
                    );
                });
        });

        it('should reject if the asm policy endpoint is missing', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/asm/policies')
                .reply(404, { code: 404 });

            components.push(getComponent('asm'));

            return assert.isRejected(
                BigComponentTag.process(context, declaration, components),
                /Unable to find specified WAF policy \/Common\/test-policy for \/Tenant\/A0\/service\/policyWAF/
            )
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have only called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/asm/policies',
                            send: undefined
                        }
                    );
                });
        });

        it('should reject if the other endpoint is missing', () => {
            const nockedRequests = nock('http://localhost:8100')
                .post('/mgmt/tm/ltm/monitor/icmp')
                .reply(404, { code: 404 });

            components.push(getComponent('monitor'));

            return assert.isRejected(
                BigComponentTag.process(context, declaration, components),
                /Unable to find \/Common\/icmp for \/Tenant\/A0\/Pool1\/monitors\/0/
            )
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have only called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'POST',
                            path: '/mgmt/tm/ltm/monitor/icmp',
                            send: '{"name":"/Common/icmp"}'
                        }
                    );
                });
        });

        it('should handle if the asm policy has a space in its name', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/asm/policies')
                .reply(200, JSON.stringify({ items: [{ fullPath: '/Common/test policy' }] }));

            components.push(getComponent('asm'));
            components[0].data.bigip = '/Common/test policy';
            components[0].parentData.policyWAF.bigip = '/Common/test policy';

            return BigComponentTag.process(context, declaration, components)
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have only called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/asm/policies',
                            send: undefined
                        }
                    );
                });
        });

        it('should handle multiple entries into schemaData', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/gtm/monitor/bigip/~Common~bigip')
                .reply(200, JSON.stringify({ name: 'bigip', fullPath: '/Common/bigip' }))
                .get('/mgmt/tm/gtm/monitor/bigip-link/~Common~bigip')
                .reply(404, JSON.stringify({ code: 404, message: 'Object not found - /Common/bigip' }))
                .get('/mgmt/tm/gtm/monitor/external/~Common~bigip')
                .reply(404, JSON.stringify({ code: 404, message: 'Object not found - /Common/bigip' }))
                .get('/mgmt/tm/gtm/monitor/firepass/~Common~bigip')
                .reply(404, JSON.stringify({ code: 404, message: 'Object not found - /Common/bigip' }))
                .get('/mgmt/tm/gtm/monitor/ftp/~Common~bigip')
                .reply(404, JSON.stringify({ code: 404, message: 'Object not found - /Common/bigip' }))
                .get('/mgmt/tm/gtm/monitor/gateway-icmp/~Common~bigip')
                .reply(404, JSON.stringify({ code: 404, message: 'Object not found - /Common/bigip' }))
                .get('/mgmt/tm/gtm/monitor/gtp/~Common~bigip')
                .reply(404, JSON.stringify({ code: 404, message: 'Object not found - /Common/bigip' }));

            components.push(getComponent('gslb-monitor'));

            return BigComponentTag.process(context, declaration, components)
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 7, 'should have been called iControlRequest seven times');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/bigip/~Common~bigip',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[1][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/bigip-link/~Common~bigip',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[2][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/external/~Common~bigip',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[3][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/firepass/~Common~bigip',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[4][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/ftp/~Common~bigip',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[5][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/gateway-icmp/~Common~bigip',
                            send: undefined
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[6][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/gtm/monitor/gtp/~Common~bigip',
                            send: undefined
                        }
                    );
                });
        });

        it('should early exit if the component has string for data', () => {
            components.push(getComponent('monitor'));
            components[0].data = '/Common/icmp';

            return BigComponentTag.process(context, declaration, components)
                .then(() => {
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 0, 'should have not have called iControlRequest');
                });
        });

        it('should reject if the response has an error code that is not 409', () => {
            const nockedRequests = nock('http://localhost:8100')
                .post('/mgmt/tm/ltm/monitor/icmp')
                .reply(500, JSON.stringify({
                    code: 500,
                    message: 'There was an internal server error',
                    errorStack: [],
                    apiError: 1337
                }));

            components.push(getComponent('monitor'));

            return Promise.resolve()
                .then(() => assert.isRejected(BigComponentTag.process(context, declaration, components),
                    /Unable to find \/Common\/icmp for \/Tenant\/A0\/Pool1\/monitors\/0/))
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have only called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'POST',
                            path: '/mgmt/tm/ltm/monitor/icmp',
                            send: '{"name":"/Common/icmp"}'
                        }
                    );
                });
        });

        it('should only query the endpoint once if multiple objects use the same endpoint', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/asm/policies')
                .reply(200, JSON.stringify({ items: [{ fullPath: '/Common/test-policy' }] }));

            components.push(getComponent('asm'));
            components.push(getComponent('asm'));
            components[1].instancePath = '/Tenant/A1/service/policyWaf';

            declaration.Tenant.A1 = { // Note: shortened for readability
                service: {
                    class: 'Service_HTTP',
                    virtualAddresses: ['192.0.2.1'],
                    policyWAF: { bigip: '/Common/test-policy' }
                }
            };

            return BigComponentTag.process(context, declaration, components)
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/asm/policies',
                            send: undefined
                        }
                    );
                });
        });

        it('should error if the probe object does NOT exist (aka should delete the object)', () => {
            const nockedRequests = nock('http://localhost:8100')
                .post('/mgmt/tm/ltm/monitor/icmp')
                .reply(200, JSON.stringify({
                    name: 'icmp2',
                    partition: 'Common',
                    fullPath: '/Common/icmp2'
                }))
                .delete('/mgmt/tm/ltm/monitor/icmp/~Common~icmp2')
                .reply(200);

            components.push(getComponent('monitor'));
            components[0].data.bigip = '/Common/icmp2';
            declaration.Tenant.A0.Pool1.monitors[0].bigip = '/Common/icmp2';

            return Promise.resolve()
                .then(() => assert.isRejected(BigComponentTag.process(context, declaration, components),
                    /Unable to find \/Common\/icmp2 for \/Tenant\/A0\/Pool1\/monitors\/0/))
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'undefined');
                    assert.strictEqual(iSpyControl.args.length, 2, 'should have only called iControlRequest twice');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'POST',
                            path: '/mgmt/tm/ltm/monitor/icmp',
                            send: '{"name":"/Common/icmp2"}'
                        }
                    );
                    assert.deepStrictEqual(
                        iSpyControl.args[1][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'DELETE',
                            path: '/mgmt/tm/ltm/monitor/icmp/~Common~icmp2'
                        }
                    );
                });
        });

        it('should fetch virtual-address and store the metadata', () => {
            const nockedRequests = nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/virtual-address/~Common~address')
                .reply(200, JSON.stringify({
                    name: 'address',
                    partition: 'Common',
                    fullPath: '/Common/address',
                    address: '192.0.2.1',
                    mask: '255.255.255.255'
                }));

            components.push(getComponent('virtual-address'));
            declaration.Tenant.A0.service.virtualAddresses[0] = {
                bigip: '/Common/address'
            };

            return BigComponentTag.process(context, declaration, components)
                .then(() => {
                    assert.strictEqual(
                        nockedRequests.isDone(),
                        true,
                        `The following nock requests were not reached: ${nockedRequests.pendingMocks()}`
                    );
                    assert.strictEqual(typeof context.tasks[0].metadata, 'object');
                    assert.deepStrictEqual(
                        context.tasks[0].metadata,
                        {
                            Tenant: {
                                A0: {
                                    service: {
                                        virtualAddresses: [
                                            {
                                                address: '192.0.2.1',
                                                mask: '255.255.255.255'
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    );
                    assert.strictEqual(iSpyControl.args.length, 1, 'should have only called iControlRequest once');
                    assert.deepStrictEqual(
                        iSpyControl.args[0][1], // Only want to check options not context
                        {
                            crude: true,
                            method: 'GET',
                            path: '/mgmt/tm/ltm/virtual-address/~Common~address',
                            send: undefined
                        }
                    );
                });
        });
    });
});

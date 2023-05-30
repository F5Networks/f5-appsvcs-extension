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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const nock = require('nock');
const sinon = require('sinon');

chai.use(chaiAsPromised);
const assert = chai.assert;

const DeclarationProvider = require('../../../src/lib/declarationProvider');
const Context = require('../../../src/lib/context/context');
const Tracer = require('../../../src/lib/tracer').Tracer;
const log = require('../../../src/lib/log');

describe('DeclarationProvider', () => {
    let context;

    beforeEach(() => {
        context = Context.build();
        context.tasks.push({ protocol: 'http', urlPrefix: 'http://localhost:8100' });
        context.request = {
            tracer: new Tracer('test tracer', { enabled: false })
        };
    });

    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    describe('.getBigiqDeclaration', () => {
        it('should return no tenants if BIG-IQ has no tenants', () => {
            const includeMetadata = {};
            const provider = new DeclarationProvider();

            nock('http://localhost:8100')
                .get('/mgmt/cm/global/tenants')
                .reply(200, { items: [] });

            return Promise.resolve()
                .then(() => provider.getBigiqDeclaration(context, includeMetadata))
                .then((result) => {
                    assert.strictEqual(result.metadata.tenants.length, 0);
                });
        });

        it('should fetch latest Common', () => {
            const includeMetadata = {};
            const provider = new DeclarationProvider();

            nock('http://localhost:8100')
                .get('/mgmt/cm/global/tenants')
                .reply(200, {
                    items: [
                        {
                            name: 'tenantOne',
                            body: {
                                target: '192.0.2.0',
                                Common: {
                                    class: 'Common'
                                },
                                tenantOne: {
                                    class: 'Tenant'
                                }
                            }
                        },
                        {
                            name: 'tenantTwo',
                            body: {
                                target: '192.0.2.0',
                                Common: {
                                    class: 'Common',
                                    prop: 'test'
                                },
                                tenantTwo: {
                                    class: 'Tenant'
                                }
                            }
                        }
                    ]
                });

            return Promise.resolve()
                .then(() => provider.getBigiqDeclaration(context, includeMetadata))
                .then((result) => {
                    assert.deepStrictEqual(result.metadata.tenants, [
                        'tenantOne',
                        'Common',
                        'tenantTwo'
                    ]);
                    assert.strictEqual(result.declaration.Common.prop, 'test');
                });
        });

        it('should return previous declaration for target', () => {
            const provider = new DeclarationProvider();

            context.tasks[0].target = { address: '10.10.10.10' };
            nock('http://localhost:8100')
                .get('/mgmt/cm/global/tenants')
                .reply(200, {
                    items: [{
                        name: 'tenantOne',
                        body: {
                            target: { address: '10.10.10.10' },
                            tenantOne: { class: 'Tenant' }
                        }
                    }]
                });

            return Promise.resolve()
                .then(() => provider.getBigiqDeclaration(context))
                .then((result) => {
                    assert.deepStrictEqual(result, {
                        target: { address: '10.10.10.10' },
                        tenantOne: { class: 'Tenant' }
                    });
                });
        });

        it('should return empty declaration if no previous declaration for target', () => {
            const provider = new DeclarationProvider();
            const logWarningSpy = sinon.stub(log, 'warning');

            context.tasks[0].target = { address: '10.10.10.10' };
            nock('http://localhost:8100')
                .get('/mgmt/cm/global/tenants')
                .reply(200, {
                    items: [{
                        name: 'tenantOne',
                        body: {
                            target: { address: '192.0.2.0' },
                            tenantOne: { class: 'Tenant' }
                        }
                    }]
                });

            return Promise.resolve()
                .then(() => provider.getBigiqDeclaration(context))
                .then((result) => {
                    assert.deepStrictEqual(result, {});
                    assert.strictEqual(
                        logWarningSpy.args[0][0],
                        'No previous declaration found for target "{"address":"10.10.10.10"}"'
                    );
                });
        });

        describe('dryRun', () => {
            it('should convert "controls.internalUse.action=dryRun" to controls.dryRun', () => {
                const provider = new DeclarationProvider();

                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [{
                            name: 'tenantOne',
                            body: {
                                controls: {
                                    class: 'Controls',
                                    internalUse: {
                                        action: 'dry-run'
                                    }
                                }
                            }
                        }]
                    });

                return Promise.resolve()
                    .then(() => provider.getBigiqDeclaration(context))
                    .then((result) => {
                        assert.deepStrictEqual(
                            result,
                            {
                                controls: {
                                    class: 'Controls',
                                    dryRun: true
                                }
                            }
                        );
                    });
            });

            it('should issue a warning if internalUse contains unexpected keys', () => {
                const provider = new DeclarationProvider();
                const logWarningSpy = sinon.stub(log, 'warning');

                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [{
                            name: 'tenantOne',
                            body: {
                                controls: {
                                    class: 'Controls',
                                    internalUse: {
                                        action: 'dry-run',
                                        hello: 'world'
                                    }
                                }
                            }
                        }]
                    });

                return Promise.resolve()
                    .then(() => provider.getBigiqDeclaration(context))
                    .then(() => {
                        assert.strictEqual(
                            logWarningSpy.args[0][0],
                            'Unexpected properties in controls.internalUse: {"action":"dry-run","hello":"world"}'
                        );
                    });
            });

            it('should issue a warning if action is not dry-run', () => {
                const provider = new DeclarationProvider();
                const logWarningSpy = sinon.stub(log, 'warning');

                nock('http://localhost:8100')
                    .get('/mgmt/cm/global/tenants')
                    .reply(200, {
                        items: [{
                            name: 'tenantOne',
                            body: {
                                controls: {
                                    class: 'Controls',
                                    internalUse: {
                                        action: 'deploy'
                                    }
                                }
                            }
                        }]
                    });

                return Promise.resolve()
                    .then(() => provider.getBigiqDeclaration(context))
                    .then(() => {
                        assert.strictEqual(
                            logWarningSpy.args[0][0],
                            'Unexpected action "deploy" in controls'
                        );
                    });
            });
        });
    });

    describe('.getBigipDeclaration', () => {
        let fakeDecl;

        beforeEach(() => {
            fakeDecl = {
                declaration: {
                    class: 'ADC',
                    id: '1639072006141',
                    schemaVersion: '3.0.0'
                },
                metadata: {
                    blocks: 0,
                    date: '2021-12-09T17:46:46.141Z',
                    id: '1639072006141',
                    tenants: []
                }
            };
        });

        it('should return undefined if BIG-IP has no declarations and includeMetadata is false', () => {
            const provider = new DeclarationProvider();

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                .reply(200, {});

            return provider.getBigipDeclaration(context, 0)
                .then((result) => {
                    assert.strictEqual(result, undefined);
                });
        });

        it('should return metadata if BIG-IP has no declarations and includeMetadata is true', () => {
            const provider = new DeclarationProvider();
            sinon.useFakeTimers(1639072006141);

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                .reply(200, {});

            return provider.getBigipDeclaration(context, 0, true)
                .then((result) => {
                    assert.deepStrictEqual(result, fakeDecl);
                });
        });

        it('should error if non 200 response and includeMetadata is false', () => {
            const provider = new DeclarationProvider();

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
                provider.getBigipDeclaration(context, 0),
                /GET \/mgmt\/tm\/ltm\/data-group\/internal\/~Common~____appsvcs_declaration-1554498345530 retrieve stored declaration from BIG-IP response=404 body=not found/
            );
        });

        it('should return metadata if non 200 response and includeMetadata is true', () => {
            const provider = new DeclarationProvider();
            sinon.useFakeTimers(1639072006141);

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

            return provider.getBigipDeclaration(context, 0, true)
                .then((result) => {
                    assert.deepStrictEqual(result, fakeDecl);
                });
        });
    });
});

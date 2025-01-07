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
const dataGroupUtil = require('../../../src/lib/util/dataGroupUtil');
const util = require('../../../src/lib/util/util');
const certUtils = require('../../../src/lib/util/certUtil');
const Config = require('../../../src/lib/config');

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

        it('should return bigip declaration when encodeDeclarationMetadata is true and includeMetadata is false', () => {
            const provider = new DeclarationProvider();

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                .reply(200, {
                    items: [
                        {
                            name: '____appsvcs_declaration-1554498345530',
                            timestamp: 1554498345530,
                            date: '2019-04-05T21:16:07.217Z',
                            age: 4
                        }
                    ]
                });

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1554498345530')
                .reply(200, {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: '____appsvcs_declaration-1714634755515',
                    partition: 'Common',
                    fullPath: '/Common/____appsvcs_declaration-1714634755515',
                    generation: 15991,
                    selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1714634755515?ver=15.1.0',
                    description: 'f5 AS3 declaration (see info in record 0)',
                    type: 'integer',
                    records:
                        [{
                            name: '0',
                            data: 'eJxLSSxJjTMyMDLRNTDVNTAKMTC3MjK1MjXVMzU0jarJTIkrMUw01DUwMDCsKUnNS8wrKY5zzs/Nzc/TSa1IzC3ISQ0BixrWJOXkJ2cXxxkCANArGlE='
                        },
                        {
                            name: '1',
                            data: 'eNp9VtmWokgQ/ZU5vlZ1ySIq9ZasoibKLsz0qYOQArIKaCp9+t8HtLqrumfRBzPvvUTGkkT4bRRkftOMXkdA4EfPoyTsly3pk18IgiB7oAlilPs2qpukLHqOfqGJF6In+DLPB+TbTwsmKvyi7Skj9msUfqZAVWVJ4LeDjedRi/Iq81vUE81D+jwK/Dd09Xscve3PRZih4fEfq9GX4cOJsqL+wYu6qUgKD0zxjv5VQEURWJPnQUtFACsciJQlWF81MFYdal/pEBAyb5xkQ9nTgiZyPLYAVGQNag3mNVewNU0W8dK2OtGE/SGAtEQe4JVNSZ0vZ2eP1i/7o6hBMLlzHMYLi7LjcKE3nimuIUgfz0SY14/WVTDBmotUmwMN5CQ9C2jtKnXAfmAQCsWA6QeNkA5uYZ89+ZpBw8IKdper0lPiS6ACLeWk2Ov2FJm5OZsii7uvQyrOgtw67+llAbnJTjDFCRSUm9qJDDyKN9Uu3zF425g/MRx54Mp3YPnwwTVBZptQh1h8xK8IoNq5O7X0HaYIZfYMdYCF6M4tBBCaniMR4eDnR85WAljKqimqEDSP+DEWbdnuQkHcQc66YwDjTThgEitoNpuEDpPuZeu6NMGRi9JTnCYyiwmO10RHKtTL3rGTPaUz2uK+pn3ZvnkGcwnyAEeRmPxeS6BZAEwUTsBg4Feg7Ouv8cfY8vI9xmcIJVNNghndEvlhOa5ukOYKsSHq5DLN9rXEdIW04jIAqerqcIdUu9QsFVk4aZPjjDtBPyp0ajrmZ3KwXKpLTVZXkzl1iYxtbFUyUol24sxI4cIYFV6qT0RYTiObQLstvgQRGO+86+7kAbTFO7Oipy6sVTPCE3bjeNWiVHcHl/eeyJW1JmhKD7WxklJ4M7awTQTNmtTx+Uyt52NVYe22NmMe1POwgY2wZOijEM+uWrilV5TNqm4LFul0OmVnaTozq04n8/JkLq+G7W9XJYWE80pNEcnp+6PrlH5+JuIDz7jyNGO2bDLXfDvN9m0uBHm5riz2sLYNw5nyziKt2zA5aAm/4WMQQQ4A+WgJ3AZyxFDfUIg0h+P0y2ysEXbJRYLbRcvNat1N5CbabalZBw7DnVsYUJQF4ET/r4V3rQ5FzgQC0Bbjf3t3h3oDDbD19Gkay3amkfN59oTX0pLEypy+UTMubEXCazw5lC7s/JSwaWDl5Mwj2qoW8a3aCB45bm4tuyeXsTDRI4smTjhC0iRFwdyqSnnCWqmm5LpAg9OhSVwjPHqIq4JKzOhinqXHlVza7kzmqAzKpSNcL2MSELxxtM3ciTRDkhclbLuNQ7Z8zd7knS2GtylLZrOtzZPpikEpTjdzd29spvHFHp/n9OpsJXKglC65VTqwogkyYd2dY6nX216xD4saRaVGklp3jA/hodqsObN1SG6ieSevm58kWanJGuW5tqKzoxgEfXTOEa43V0pz4SWdnnWpi59sZk1ZRZyF6o3BPbHThW5qWPQ6NJfUBvxV3JuqqAr/aLRDk35v5zx44x6t+fv378+j98b96P/kv46Ed0k/B/57LMRtWzV2UrdnP/usMlB9SQL0tjDNrdHr+oGR1Cho58To9eBnDRocS1DRmmujl/sN/dZmzdsDG0ZY/zyqfyUf2EAWfjvMIZQd+l1Vlv3R95/tsHweXR7+gDCsUdOg3p8/R+TL8KVGX3/S27LurUwmdJ+Nc4N4NGw/Ihj2yWGIFA1Z/LQbhlwSJX1WRuPHRB2H6OCfs/Yl6G305qq+VfXKFbr9nzjt6V4cxH5S8GBQ9m580j1G8vifU3ao328Z+1y/tfHG/8jjg/4cy+vPYD9ZeU/tb1aMHwn/FP2QzG+/puPD4Nfvzx91+GTsvS45yvf9n5K7hceJv5aIpV6IF+qFHIrUPC7QR5G+3q/tuQr7M2EZoscF6K9UcrkXqCzausya4Vi/DuIeNZMcNW2fuV5KEdTkC8F8ISiTmL1SzCvDvDDkxOtz+TczJA1n'
                        }]
                });

            sinon.stub(Config, 'getAllSettings').resolves({ encodeDeclarationMetadata: true });
            return provider.getBigipDeclaration(context, 0)
                .then((results) => {
                    assert.ok(results);
                });
        });

        it('should thow an error when encodeDeclarationMetadata is false and data stored in datagroup in encoded', () => {
            const provider = new DeclarationProvider();

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common')
                .reply(200, {
                    items: [
                        {
                            name: '____appsvcs_declaration-1554498345530',
                            timestamp: 1554498345530,
                            date: '2019-04-05T21:16:07.217Z',
                            age: 4
                        }
                    ]
                });

            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1554498345530')
                .reply(200, {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: '____appsvcs_declaration-1714634755515',
                    partition: 'Common',
                    fullPath: '/Common/____appsvcs_declaration-1714634755515',
                    generation: 15991,
                    selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1714634755515?ver=15.1.0',
                    description: 'f5 AS3 declaration (see info in record 0)',
                    type: 'integer',
                    records:
                        [{
                            name: '0',
                            data: 'eJxLSSxJjTMyMDLRNTDVNTAKMTC3MjK1MjXVMzU0jarJTIkrMUw01DUwMDCsKUnNS8wrKY5zzs/Nzc/TSa1IzC3ISQ0BixrWJOXkJ2cXxxkCANArGlE='
                        },
                        {
                            name: '1',
                            data: 'eNp9VtmWokgQ/ZU5vlZ1ySIq9ZasoibKLsz0qYOQArIKaCp9+t8HtLqrumfRBzPvvUTGkkT4bRRkftOMXkdA4EfPoyTsly3pk18IgiB7oAlilPs2qpukLHqOfqGJF6In+DLPB+TbTwsmKvyi7Skj9msUfqZAVWVJ4LeDjedRi/Iq81vUE81D+jwK/Dd09Xscve3PRZih4fEfq9GX4cOJsqL+wYu6qUgKD0zxjv5VQEURWJPnQUtFACsciJQlWF81MFYdal/pEBAyb5xkQ9nTgiZyPLYAVGQNag3mNVewNU0W8dK2OtGE/SGAtEQe4JVNSZ0vZ2eP1i/7o6hBMLlzHMYLi7LjcKE3nimuIUgfz0SY14/WVTDBmotUmwMN5CQ9C2jtKnXAfmAQCsWA6QeNkA5uYZ89+ZpBw8IKdper0lPiS6ACLeWk2Ov2FJm5OZsii7uvQyrOgtw67+llAbnJTjDFCRSUm9qJDDyKN9Uu3zF425g/MRx54Mp3YPnwwTVBZptQh1h8xK8IoNq5O7X0HaYIZfYMdYCF6M4tBBCaniMR4eDnR85WAljKqimqEDSP+DEWbdnuQkHcQc66YwDjTThgEitoNpuEDpPuZeu6NMGRi9JTnCYyiwmO10RHKtTL3rGTPaUz2uK+pn3ZvnkGcwnyAEeRmPxeS6BZAEwUTsBg4Feg7Ouv8cfY8vI9xmcIJVNNghndEvlhOa5ukOYKsSHq5DLN9rXEdIW04jIAqerqcIdUu9QsFVk4aZPjjDtBPyp0ajrmZ3KwXKpLTVZXkzl1iYxtbFUyUol24sxI4cIYFV6qT0RYTiObQLstvgQRGO+86+7kAbTFO7Oipy6sVTPCE3bjeNWiVHcHl/eeyJW1JmhKD7WxklJ4M7awTQTNmtTx+Uyt52NVYe22NmMe1POwgY2wZOijEM+uWrilV5TNqm4LFul0OmVnaTozq04n8/JkLq+G7W9XJYWE80pNEcnp+6PrlH5+JuIDz7jyNGO2bDLXfDvN9m0uBHm5riz2sLYNw5nyziKt2zA5aAm/4WMQQQ4A+WgJ3AZyxFDfUIg0h+P0y2ysEXbJRYLbRcvNat1N5CbabalZBw7DnVsYUJQF4ET/r4V3rQ5FzgQC0Bbjf3t3h3oDDbD19Gkay3amkfN59oTX0pLEypy+UTMubEXCazw5lC7s/JSwaWDl5Mwj2qoW8a3aCB45bm4tuyeXsTDRI4smTjhC0iRFwdyqSnnCWqmm5LpAg9OhSVwjPHqIq4JKzOhinqXHlVza7kzmqAzKpSNcL2MSELxxtM3ciTRDkhclbLuNQ7Z8zd7knS2GtylLZrOtzZPpikEpTjdzd29spvHFHp/n9OpsJXKglC65VTqwogkyYd2dY6nX216xD4saRaVGklp3jA/hodqsObN1SG6ieSevm58kWanJGuW5tqKzoxgEfXTOEa43V0pz4SWdnnWpi59sZk1ZRZyF6o3BPbHThW5qWPQ6NJfUBvxV3JuqqAr/aLRDk35v5zx44x6t+fv378+j98b96P/kv46Ed0k/B/57LMRtWzV2UrdnP/usMlB9SQL0tjDNrdHr+oGR1Cho58To9eBnDRocS1DRmmujl/sN/dZmzdsDG0ZY/zyqfyUf2EAWfjvMIZQd+l1Vlv3R95/tsHweXR7+gDCsUdOg3p8/R+TL8KVGX3/S27LurUwmdJ+Nc4N4NGw/Ihj2yWGIFA1Z/LQbhlwSJX1WRuPHRB2H6OCfs/Yl6G305qq+VfXKFbr9nzjt6V4cxH5S8GBQ9m580j1G8vifU3ao328Z+1y/tfHG/8jjg/4cy+vPYD9ZeU/tb1aMHwn/FP2QzG+/puPD4Nfvzx91+GTsvS45yvf9n5K7hceJv5aIpV6IF+qFHIrUPC7QR5G+3q/tuQr7M2EZoscF6K9UcrkXqCzausya4Vi/DuIeNZMcNW2fuV5KEdTkC8F8ISiTmL1SzCvDvDDkxOtz+TczJA1n'
                        }]
                });

            sinon.stub(Config, 'getAllSettings').resolves({ encodeDeclarationMetadata: false });

            const errMessage = 'declaration stored on target seems encoded.';
            let rejected = true;
            return provider.getBigipDeclaration(context, 0)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
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

        it('should error if unable to parse response', () => {
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
                .reply(200, '');

            return assert.isRejected(
                provider.getBigipDeclaration(context, 0),
                /cannot JSON.parse/
            );
        });

        it('should return metadata if BIG-IP and should throw error during json.parse after decryption', () => {
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
                .reply(200, {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: '____appsvcs_declaration-1714634755515',
                    partition: 'Common',
                    fullPath: '/Common/____appsvcs_declaration-1714634755515',
                    generation: 15991,
                    selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1714634755515?ver=15.1.0',
                    description: 'f5 AS3 declaration (see info in record 0)',
                    type: 'integer',
                    records:
                        [{
                            name: '0',
                            data: 'date^2024-05-02T07:25:55.515Z|id^t1a1-0001|tenants^Common,exampleTenant1|blocks^1'
                        },
                        {
                            name: '1',
                            data: 'eNp9VtmWokgQ/ZU5vlZ1ySIq9ZasoibKLsz0qYOQArIKaCp9+t8HtLqrumfRBzPvvUTGkkT4bRRkftOMXkdA4EfPoyTsly3pk18IgiB7oAlilPs2qpukLHqOfqGJF6In+DLPB+TbTwsmKvyi7Skj9msUfqZAVWVJ4LeDjedRi/Iq81vUE81D+jwK/Dd09Xscve3PRZih4fEfq9GX4cOJsqL+wYu6qUgKD0zxjv5VQEURWJPnQUtFACsciJQlWF81MFYdal/pEBAyb5xkQ9nTgiZyPLYAVGQNag3mNVewNU0W8dK2OtGE/SGAtEQe4JVNSZ0vZ2eP1i/7o6hBMLlzHMYLi7LjcKE3nimuIUgfz0SY14/WVTDBmotUmwMN5CQ9C2jtKnXAfmAQCsWA6QeNkA5uYZ89+ZpBw8IKdper0lPiS6ACLeWk2Ov2FJm5OZsii7uvQyrOgtw67+llAbnJTjDFCRSUm9qJDDyKN9Uu3zF425g/MRx54Mp3YPnwwTVBZptQh1h8xK8IoNq5O7X0HaYIZfYMdYCF6M4tBBCaniMR4eDnR85WAljKqimqEDSP+DEWbdnuQkHcQc66YwDjTThgEitoNpuEDpPuZeu6NMGRi9JTnCYyiwmO10RHKtTL3rGTPaUz2uK+pn3ZvnkGcwnyAEeRmPxeS6BZAEwUTsBg4Feg7Ouv8cfY8vI9xmcIJVNNghndEvlhOa5ukOYKsSHq5DLN9rXEdIW04jIAqerqcIdUu9QsFVk4aZPjjDtBPyp0ajrmZ3KwXKpLTVZXkzl1iYxtbFUyUol24sxI4cIYFV6qT0RYTiObQLstvgQRGO+86+7kAbTFO7Oipy6sVTPCE3bjeNWiVHcHl/eeyJW1JmhKD7WxklJ4M7awTQTNmtTx+Uyt52NVYe22NmMe1POwgY2wZOijEM+uWrilV5TNqm4LFul0OmVnaTozq04n8/JkLq+G7W9XJYWE80pNEcnp+6PrlH5+JuIDz7jyNGO2bDLXfDvN9m0uBHm5riz2sLYNw5nyziKt2zA5aAm/4WMQQQ4A+WgJ3AZyxFDfUIg0h+P0y2ysEXbJRYLbRcvNat1N5CbabalZBw7DnVsYUJQF4ET/r4V3rQ5FzgQC0Bbjf3t3h3oDDbD19Gkay3amkfN59oTX0pLEypy+UTMubEXCazw5lC7s/JSwaWDl5Mwj2qoW8a3aCB45bm4tuyeXsTDRI4smTjhC0iRFwdyqSnnCWqmm5LpAg9OhSVwjPHqIq4JKzOhinqXHlVza7kzmqAzKpSNcL2MSELxxtM3ciTRDkhclbLuNQ7Z8zd7knS2GtylLZrOtzZPpikEpTjdzd29spvHFHp/n9OpsJXKglC65VTqwogkyYd2dY6nX216xD4saRaVGklp3jA/hodqsObN1SG6ieSevm58kWanJGuW5tqKzoxgEfXTOEa43V0pz4SWdnnWpi59sZk1ZRZyF6o3BPbHThW5qWPQ6NJfUBvxV3JuqqAr/aLRDk35v5zx44x6t+fv378+j98b96P/kv46Ed0k/B/57LMRtWzV2UrdnP/usMlB9SQL0tjDNrdHr+oGR1Cho58To9eBnDRocS1DRmmujl/sN/dZmzdsDG0ZY/zyqfyUf2EAWfjvMIZQd+l1Vlv3R95/tsHweXR7+gDCsUdOg3p8/R+TL8KVGX3/S27LurUwmdJ+Nc4N4NGw/Ihj2yWGIFA1Z/LQbhlwSJX1WRuPHRB2H6OCfs/Yl6G305qq+VfXKFbr9nzjt6V4cxH5S8GBQ9m580j1G8vifU3ao328Z+1y/tfHG/8jjg/4cy+vPYD9ZeU/tb1aMHwn/FP2QzG+/puPD4Nfvzx91+GTsvS45yvf9n5K7hceJv5aIpV6IF+qFHIrUPC7QR5G+3q/tuQr7M2EZoscF6K9UcrkXqCzausya4Vi/DuIeNZMcNW2fuV5KEdTkC8F8ISiTmL1SzCvDvDDkxOtz+TczJA1n'
                        }]
                });

            context.request.method = 'Post';
            sinon.stub(certUtils, 'checkIfClassCertExist').resolves(undefined);
            let rejected = true;
            const errMessage = 'cannot JSON.parse() stored declaration (Unexpected token u in JSON at position 0)';

            return provider.getBigipDeclaration(context, 0)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should return metadata if BIG-IP and should return successfully after decryption', () => {
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
                .reply(200, {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: '____appsvcs_declaration-1714634755515',
                    partition: 'Common',
                    fullPath: '/Common/____appsvcs_declaration-1714634755515',
                    generation: 15991,
                    selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1714634755515?ver=15.1.0',
                    description: 'f5 AS3 declaration (see info in record 0)',
                    type: 'integer',
                    records:
                        [{
                            name: '0',
                            data: 'date^2024-05-02T07:25:55.515Z|id^t1a1-0001|tenants^Common,exampleTenant1|blocks^1'
                        },
                        {
                            name: '1',
                            data: 'eNp9VtmWokgQ/ZU5vlZ1ySIq9ZasoibKLsz0qYOQArIKaCp9+t8HtLqrumfRBzPvvUTGkkT4bRRkftOMXkdA4EfPoyTsly3pk18IgiB7oAlilPs2qpukLHqOfqGJF6In+DLPB+TbTwsmKvyi7Skj9msUfqZAVWVJ4LeDjedRi/Iq81vUE81D+jwK/Dd09Xscve3PRZih4fEfq9GX4cOJsqL+wYu6qUgKD0zxjv5VQEURWJPnQUtFACsciJQlWF81MFYdal/pEBAyb5xkQ9nTgiZyPLYAVGQNag3mNVewNU0W8dK2OtGE/SGAtEQe4JVNSZ0vZ2eP1i/7o6hBMLlzHMYLi7LjcKE3nimuIUgfz0SY14/WVTDBmotUmwMN5CQ9C2jtKnXAfmAQCsWA6QeNkA5uYZ89+ZpBw8IKdper0lPiS6ACLeWk2Ov2FJm5OZsii7uvQyrOgtw67+llAbnJTjDFCRSUm9qJDDyKN9Uu3zF425g/MRx54Mp3YPnwwTVBZptQh1h8xK8IoNq5O7X0HaYIZfYMdYCF6M4tBBCaniMR4eDnR85WAljKqimqEDSP+DEWbdnuQkHcQc66YwDjTThgEitoNpuEDpPuZeu6NMGRi9JTnCYyiwmO10RHKtTL3rGTPaUz2uK+pn3ZvnkGcwnyAEeRmPxeS6BZAEwUTsBg4Feg7Ouv8cfY8vI9xmcIJVNNghndEvlhOa5ukOYKsSHq5DLN9rXEdIW04jIAqerqcIdUu9QsFVk4aZPjjDtBPyp0ajrmZ3KwXKpLTVZXkzl1iYxtbFUyUol24sxI4cIYFV6qT0RYTiObQLstvgQRGO+86+7kAbTFO7Oipy6sVTPCE3bjeNWiVHcHl/eeyJW1JmhKD7WxklJ4M7awTQTNmtTx+Uyt52NVYe22NmMe1POwgY2wZOijEM+uWrilV5TNqm4LFul0OmVnaTozq04n8/JkLq+G7W9XJYWE80pNEcnp+6PrlH5+JuIDz7jyNGO2bDLXfDvN9m0uBHm5riz2sLYNw5nyziKt2zA5aAm/4WMQQQ4A+WgJ3AZyxFDfUIg0h+P0y2ysEXbJRYLbRcvNat1N5CbabalZBw7DnVsYUJQF4ET/r4V3rQ5FzgQC0Bbjf3t3h3oDDbD19Gkay3amkfN59oTX0pLEypy+UTMubEXCazw5lC7s/JSwaWDl5Mwj2qoW8a3aCB45bm4tuyeXsTDRI4smTjhC0iRFwdyqSnnCWqmm5LpAg9OhSVwjPHqIq4JKzOhinqXHlVza7kzmqAzKpSNcL2MSELxxtM3ciTRDkhclbLuNQ7Z8zd7knS2GtylLZrOtzZPpikEpTjdzd29spvHFHp/n9OpsJXKglC65VTqwogkyYd2dY6nX216xD4saRaVGklp3jA/hodqsObN1SG6ieSevm58kWanJGuW5tqKzoxgEfXTOEa43V0pz4SWdnnWpi59sZk1ZRZyF6o3BPbHThW5qWPQ6NJfUBvxV3JuqqAr/aLRDk35v5zx44x6t+fv378+j98b96P/kv46Ed0k/B/57LMRtWzV2UrdnP/usMlB9SQL0tjDNrdHr+oGR1Cho58To9eBnDRocS1DRmmujl/sN/dZmzdsDG0ZY/zyqfyUf2EAWfjvMIZQd+l1Vlv3R95/tsHweXR7+gDCsUdOg3p8/R+TL8KVGX3/S27LurUwmdJ+Nc4N4NGw/Ihj2yWGIFA1Z/LQbhlwSJX1WRuPHRB2H6OCfs/Yl6G305qq+VfXKFbr9nzjt6V4cxH5S8GBQ9m580j1G8vifU3ao328Z+1y/tfHG/8jjg/4cy+vPYD9ZeU/tb1aMHwn/FP2QzG+/puPD4Nfvzx91+GTsvS45yvf9n5K7hceJv5aIpV6IF+qFHIrUPC7QR5G+3q/tuQr7M2EZoscF6K9UcrkXqCzausya4Vi/DuIeNZMcNW2fuV5KEdTkC8F8ISiTmL1SzCvDvDDkxOtz+TczJA1n'
                        }]
                });

            context.request.method = 'Post';
            sinon.stub(certUtils, 'checkIfClassCertExist').resolves({});

            return provider.getBigipDeclaration(context, 0)
                .then((result) => {
                    assert.deepStrictEqual(result, {});
                });
        });

        it('should return metadata if BIG-IP and should throw error during json.parse', () => {
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
                .reply(200, {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: '____appsvcs_declaration-1714634755515',
                    partition: 'Common',
                    fullPath: '/Common/____appsvcs_declaration-1714634755515',
                    generation: 15991,
                    selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1714634755515?ver=15.1.0',
                    description: 'f5 AS3 declaration (see info in record 0)',
                    type: 'integer',
                    records:
                        [{
                            name: '0',
                            data: 'date^2024-05-02T07:25:55.515Z|id^t1a1-0001|tenants^Common,exampleTenant1|blocks^1'
                        },
                        {
                            name: '1',
                            data: 'eNp9VtmWokgQ/ZU5vlZ1ySIq9ZasoibKLsz0qYOQArIKaCp9+t8HtLqrumfRBzPvvUTGkkT4bRRkftOMXkdA4EfPoyTsly3pk18IgiB7oAlilPs2qpukLHqOfqGJF6In+DLPB+TbTwsmKvyi7Skj9msUfqZAVWVJ4LeDjedRi/Iq81vUE81D+jwK/Dd09Xscve3PRZih4fEfq9GX4cOJsqL+wYu6qUgKD0zxjv5VQEURWJPnQUtFACsciJQlWF81MFYdal/pEBAyb5xkQ9nTgiZyPLYAVGQNag3mNVewNU0W8dK2OtGE/SGAtEQe4JVNSZ0vZ2eP1i/7o6hBMLlzHMYLi7LjcKE3nimuIUgfz0SY14/WVTDBmotUmwMN5CQ9C2jtKnXAfmAQCsWA6QeNkA5uYZ89+ZpBw8IKdper0lPiS6ACLeWk2Ov2FJm5OZsii7uvQyrOgtw67+llAbnJTjDFCRSUm9qJDDyKN9Uu3zF425g/MRx54Mp3YPnwwTVBZptQh1h8xK8IoNq5O7X0HaYIZfYMdYCF6M4tBBCaniMR4eDnR85WAljKqimqEDSP+DEWbdnuQkHcQc66YwDjTThgEitoNpuEDpPuZeu6NMGRi9JTnCYyiwmO10RHKtTL3rGTPaUz2uK+pn3ZvnkGcwnyAEeRmPxeS6BZAEwUTsBg4Feg7Ouv8cfY8vI9xmcIJVNNghndEvlhOa5ukOYKsSHq5DLN9rXEdIW04jIAqerqcIdUu9QsFVk4aZPjjDtBPyp0ajrmZ3KwXKpLTVZXkzl1iYxtbFUyUol24sxI4cIYFV6qT0RYTiObQLstvgQRGO+86+7kAbTFO7Oipy6sVTPCE3bjeNWiVHcHl/eeyJW1JmhKD7WxklJ4M7awTQTNmtTx+Uyt52NVYe22NmMe1POwgY2wZOijEM+uWrilV5TNqm4LFul0OmVnaTozq04n8/JkLq+G7W9XJYWE80pNEcnp+6PrlH5+JuIDz7jyNGO2bDLXfDvN9m0uBHm5riz2sLYNw5nyziKt2zA5aAm/4WMQQQ4A+WgJ3AZyxFDfUIg0h+P0y2ysEXbJRYLbRcvNat1N5CbabalZBw7DnVsYUJQF4ET/r4V3rQ5FzgQC0Bbjf3t3h3oDDbD19Gkay3amkfN59oTX0pLEypy+UTMubEXCazw5lC7s/JSwaWDl5Mwj2qoW8a3aCB45bm4tuyeXsTDRI4smTjhC0iRFwdyqSnnCWqmm5LpAg9OhSVwjPHqIq4JKzOhinqXHlVza7kzmqAzKpSNcL2MSELxxtM3ciTRDkhclbLuNQ7Z8zd7knS2GtylLZrOtzZPpikEpTjdzd29spvHFHp/n9OpsJXKglC65VTqwogkyYd2dY6nX216xD4saRaVGklp3jA/hodqsObN1SG6ieSevm58kWanJGuW5tqKzoxgEfXTOEa43V0pz4SWdnnWpi59sZk1ZRZyF6o3BPbHThW5qWPQ6NJfUBvxV3JuqqAr/aLRDk35v5zx44x6t+fv378+j98b96P/kv46Ed0k/B/57LMRtWzV2UrdnP/usMlB9SQL0tjDNrdHr+oGR1Cho58To9eBnDRocS1DRmmujl/sN/dZmzdsDG0ZY/zyqfyUf2EAWfjvMIZQd+l1Vlv3R95/tsHweXR7+gDCsUdOg3p8/R+TL8KVGX3/S27LurUwmdJ+Nc4N4NGw/Ihj2yWGIFA1Z/LQbhlwSJX1WRuPHRB2H6OCfs/Yl6G305qq+VfXKFbr9nzjt6V4cxH5S8GBQ9m580j1G8vifU3ao328Z+1y/tfHG/8jjg/4cy+vPYD9ZeU/tb1aMHwn/FP2QzG+/puPD4Nfvzx91+GTsvS45yvf9n5K7hceJv5aIpV6IF+qFHIrUPC7QR5G+3q/tuQr7M2EZoscF6K9UcrkXqCzausya4Vi/DuIeNZMcNW2fuV5KEdTkC8F8ISiTmL1SzCvDvDDkxOtz+TczJA1n'
                        }]
                });

            context.request.method = 'Get';
            sinon.stub(dataGroupUtil, 'recordsToString').resolves(undefined);
            let rejected = true;
            const errMessage = 'cannot decompress stored declaration (cannot JSON.parse() stored declaration (Unexpected token o in JSON at position 1))';

            return provider.getBigipDeclaration(context, 0)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should return metadata if BIG-IP and should throw error says data corrupt', () => {
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
                .reply(200, {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: '____appsvcs_declaration-1714634755515',
                    partition: 'Common',
                    fullPath: '/Common/____appsvcs_declaration-1714634755515',
                    generation: 15991,
                    selfLink: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~____appsvcs_declaration-1714634755515?ver=15.1.0',
                    description: 'f5 AS3 declaration (see info in record 0)',
                    type: 'integer',
                    records:
                        [{
                            name: '0',
                            data: 'date^2024-05-02T07:25:55.515Z|id^t1a1-0001|tenants^Common,exampleTenant1|blocks^1'
                        }]
                });

            context.request.method = 'Get';
            sinon.stub(dataGroupUtil, 'recordsToString').resolves(undefined);
            let rejected = true;
            const errMessage = 'declaration stored on target seems corrupt';

            return provider.getBigipDeclaration(context, 0)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(err.message, errMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });

    describe('.storeBigipDeclaration', () => {
        it('should reject when unable to strigify declaration', () => {
            const provider = new DeclarationProvider();
            const a = {};
            const b = { a };
            a.b = b;

            assert.isRejected(
                provider.storeBigipDeclaration(context, a, 1),
                /cannot stringify declaration/
            );
        });

        it('should reject when unable to prepare declaration for storage', () => {
            const provider = new DeclarationProvider();
            const decl = {
                class: 'ADC'
            };
            sinon.stub(dataGroupUtil, 'stringToRecords').throws(new Error());

            assert.isRejected(
                provider.storeBigipDeclaration(context, decl, 1),
                /cannot prepare declaration/
            );
        });

        it('should handle storing declaration to existing data-group', () => {
            const provider = new DeclarationProvider();
            const decl = {
                tenant1: {
                    class: 'Tenant'
                },
                tenant2: {
                    class: 'Tenant'
                }
            };
            context.control.timeSlip = 1;
            sinon.stub(util, 'iControlRequest').resolves({ statusCode: 200 });

            return provider.storeBigipDeclaration(context, decl, 1)
                .then((results) => {
                    assert.ok(results);
                });
        });

        it('should handle storing declaration to new data-group', () => {
            const provider = new DeclarationProvider();
            const decl = {
                tenant: {
                    class: 'Tenant'
                }
            };
            context.control.timeSlip = 1;
            sinon.stub(util, 'iControlRequest').resolves({ statusCode: 404 });

            return provider.storeBigipDeclaration(context, decl, 1)
                .then((results) => {
                    assert.ok(results);
                });
        });

        it('should handle storing declaration to new data-group when encodedMetadata is set to true', () => {
            const provider = new DeclarationProvider();
            const decl = {
                tenant: {
                    class: 'Tenant'
                }
            };
            context.control.timeSlip = 1;
            sinon.stub(Config, 'getAllSettings').resolves({ encodeDeclarationMetadata: true });
            sinon.stub(util, 'iControlRequest').resolves({ statusCode: 200 });

            return provider.storeBigipDeclaration(context, decl, 1)
                .then((results) => {
                    assert.ok(results);
                });
        });
    });
});

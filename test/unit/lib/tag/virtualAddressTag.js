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

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const VirtualAddressTag = require('../../../../src/lib/tag').VirtualAddressTag;
const Context = require('../../../../src/lib/context/context');
const log = require('../../../../src/lib/log');

describe('VirtualAddressTag', () => {
    let context;
    let declaration;
    let metadataValue = 3;

    beforeEach(() => {
        context = Context.build();
        context.host.parser = {
            virtualAddressList: [
                {
                    fullPath: '/Common/192.0.2.11',
                    partition: 'Common',
                    address: '192.0.2.11',
                    metadata: [
                        {
                            name: 'references',
                            persist: 'true',
                            value: '2'
                        }
                    ]
                },
                {
                    fullPath: '/Common/::',
                    partition: 'Common',
                    address: 'any6',
                    metadata: [
                        {
                            name: 'references',
                            persist: 'true',
                            value: '1'
                        }
                    ]
                }
            ]
        };
        metadataValue = 3;
        declaration = {
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualPort: 80,
                        virtualAddresses: ['192.0.2.10/24']
                    }
                }
            }
        };
        sinon.stub(log, 'warning');
    });

    afterEach(() => {
        sinon.restore();
    });

    const getVirtuals = (address) => {
        address = address || ['192.0.2.10/24'];
        return [{
            tenant: 'tenant',
            data: address,
            parentData: { // Note: Shortened for brevity
                class: 'Service_HTTP',
                virtualAddresses: address,
                virtualPort: 80,
                profileHTTP: 'basic'
            },
            parentDataProperty: 'virtualAddresses',
            instancePath: '/tenant/application/service/virtualAddresses',
            schemaData: true
        }];
    };

    const addAddressOnBigip = (address, fullPathIp) => {
        fullPathIp = fullPathIp || address;
        context.host.parser.virtualAddressList.push({
            fullPath: `/Common/${fullPathIp}`,
            partition: 'Common',
            address,
            metadata: [
                {
                    name: 'references',
                    persist: 'true',
                    value: `${metadataValue}`
                }
            ]
        });
        metadataValue += 1;
    };

    describe('.process', () => {
        it('should resolve if nothing is provided', () => assert.isFulfilled(
            VirtualAddressTag.process()
        ));

        it('should resolve if declaration is undefined', () => assert.isFulfilled(
            VirtualAddressTag.process(context)
        ));

        it('should resolve if virtualAddresses is undefined', () => assert.isFulfilled(
            VirtualAddressTag.process(context, declaration)
        ));

        it('should resolve if no virtualAddresses to process', () => assert.isFulfilled(
            VirtualAddressTag.process(context, declaration, [])
        ));

        it('should resolve if the virtualAddresses is not an array', () => assert.isFulfilled(
            VirtualAddressTag.process(context, declaration, '192.0.2.43/24')
        ));

        it('should resolve early if there are no virtualAddresses in host.parser.virtualAddressList', () => {
            const virtual = getVirtuals();
            context.host.parser.virtualAddressList = [];
            return assert.isFulfilled(VirtualAddressTag.process(context, declaration, virtual))
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        ['192.0.2.10/24']
                    );
                });
        });

        it('should skip validating virtualAddresses if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            const virtual = getVirtuals();
            addAddressOnBigip('192.0.2.10'); // This is to check for early exit
            return assert.isFulfilled(VirtualAddressTag.process(context, declaration, virtual))
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        ['192.0.2.10/24']
                    );
                });
        });

        it('should update the virtualAddress in parentData', () => {
            const virtual = getVirtuals();
            addAddressOnBigip('192.0.2.10');
            return VirtualAddressTag.process(context, declaration, virtual)
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        [{
                            address: '192.0.2.10/24',
                            bigip: '/Common/192.0.2.10'
                        }]
                    );
                });
        });

        it('should not update the parentData if the virtual is NOT on the bigip', () => {
            const virtual = getVirtuals();
            return assert.isFulfilled(VirtualAddressTag.process(context, declaration, virtual))
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        ['192.0.2.10/24']
                    );
                });
        });

        it('should handle arrays of virtualAddresses', () => {
            const virtual = getVirtuals([
                '192.0.2.10/24',
                [
                    '192.0.2.11%100',
                    '192.0.2.50%100'
                ]
            ]);
            addAddressOnBigip('192.0.2.11%100');
            declaration.tenant.application.service.virtualAddresses = [
                '192.0.2.10/24', ['192.0.2.11%100', '192.0.2.50%100']
            ];
            return VirtualAddressTag.process(context, declaration, virtual)
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        [
                            '192.0.2.10/24',
                            [
                                {
                                    address: '192.0.2.11%100',
                                    bigip: '/Common/192.0.2.11%100'
                                },
                                '192.0.2.50%100'
                            ]
                        ]
                    );
                });
        });

        it('should handle virtualAddress wildcards', () => {
            const virtual = getVirtuals([
                '0.0.0.0',
                '::',
                ['0.0.0.0', '192.0.2.4']
            ]);
            addAddressOnBigip('any', '0.0.0.0');
            addAddressOnBigip('any6', '::');
            declaration.tenant.application.service.virtualAddresses = [
                '0.0.0.0', '::', ['0.0.0.0', '192.0.2.4']
            ];
            return VirtualAddressTag.process(context, declaration, virtual)
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        [
                            {
                                bigip: '/Common/0.0.0.0',
                                address: '0.0.0.0'
                            },
                            {
                                bigip: '/Common/::',
                                address: '::'
                            },
                            [
                                {
                                    bigip: '/Common/0.0.0.0',
                                    address: '0.0.0.0'
                                },
                                '192.0.2.4'
                            ]
                        ]
                    );
                });
        });

        it('should not replace /Common/Shared/ fullPath with a bigip ref', () => {
            const virtual = getVirtuals();
            addAddressOnBigip('192.0.2.10', 'Shared/192.0.2.10');
            return VirtualAddressTag.process(context, declaration, virtual)
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(virtual[0].parentData.virtualAddresses, ['192.0.2.10/24']);
                });
        });

        it('should handle virtualAddress wildcards with RD', () => {
            const virtual = getVirtuals([
                '0.0.0.0%1111',
                '::%2222',
                ['0.0.0.0%1111', '192.0.2.4%1111']
            ]);
            addAddressOnBigip('any%1111', '0.0.0.0');
            addAddressOnBigip('any6%2222', '::');
            declaration.tenant.application.service.virtualAddresses = [
                '0.0.0.0%1111', '::%2222', ['0.0.0.0%1111', '192.0.2.4%1111']
            ];
            return VirtualAddressTag.process(context, declaration, virtual)
                .then(() => {
                    assert.strictEqual(virtual.length, 1, 'Should only have had one virtual in test');
                    assert.deepStrictEqual(
                        virtual[0].parentData.virtualAddresses,
                        [
                            {
                                bigip: '/Common/0.0.0.0',
                                address: '0.0.0.0%1111'
                            },
                            {
                                bigip: '/Common/::',
                                address: '::%2222'
                            },
                            [
                                {
                                    bigip: '/Common/0.0.0.0',
                                    address: '0.0.0.0%1111'
                                },
                                '192.0.2.4%1111'
                            ]
                        ]
                    );
                });
        });
    });
});

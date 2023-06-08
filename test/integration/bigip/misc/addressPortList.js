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

chai.use(chaiAsPromised);
const assert = chai.assert;

const util = require('../../../../src/lib/util/util');

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('address and port lists', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'afm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should create traffic matching criteria for address and port lists', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.45.0',
            controls: {
                class: 'Controls',
                trace: true,
                traceResponse: true,
                logLevel: 'debug'
            },
            TEST_Port_List: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    sourceAddressList: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '192.168.100.0/24',
                            '192.168.200.50-192.168.200.60'
                        ]
                    },
                    destinationAddressList1: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '192.168.40.0/24',
                            '192.168.50.1-192.168.50.10'
                        ]
                    },
                    destinationAddressList2: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '192.168.60.0/24'
                        ]
                    },
                    destinationAddressList3: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '192.168.10.0/24',
                            '192.168.20.20-192.168.20.50'
                        ],
                        addressLists: [
                            { use: 'destinationAddressList1' },
                            { use: 'destinationAddressList2' }
                        ]
                    },
                    firewallPortList: {
                        class: 'Firewall_Port_List',
                        ports: [
                            8080,
                            '1-999'
                        ]
                    },
                    tcpService: {
                        class: 'Service_TCP',
                        sourceAddress: {
                            use: 'sourceAddressList'
                        },
                        virtualAddresses: {
                            use: 'destinationAddressList3'
                        },
                        virtualPort: {
                            use: 'firewallPortList'
                        }
                    }
                }
            }

        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/trafficMatchingCriteria'))
            .then((response) => {
                assert.strictEqual(response.items[0].fullPath, '/TEST_Port_List/Application/tcpService_VS_TMC_OBJ');
                assert.strictEqual(response.items[0].destinationAddressList, '/TEST_Port_List/Application/destinationAddressList3');
                assert.strictEqual(response.items[0].destinationPortList, '/TEST_Port_List/Application/firewallPortList');
                assert.strictEqual(response.items[0].destinationAddressInline, '0.0.0.0');
                assert.strictEqual(response.items[0].destinationPortInline, '0');
            })
            .then(() => getPath('/mgmt/tm/security/firewall/portList'))
            .then((response) => {
                const portList = response.items.find((item) => item.fullPath === '/TEST_Port_List/Application/firewallPortList');
                assert.ok(portList);
                assert.deepStrictEqual(
                    portList.ports,
                    [
                        {
                            name: '1-999'
                        },
                        {
                            name: '8080'
                        }
                    ]
                );
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual'))
            .then((response) => {
                assert.strictEqual(response.items[0].fullPath, '/TEST_Port_List/Application/tcpService');
                assert.strictEqual(response.items[0].trafficMatchingCriteria, '/TEST_Port_List/Application/tcpService_VS_TMC_OBJ');
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            });
    });
});

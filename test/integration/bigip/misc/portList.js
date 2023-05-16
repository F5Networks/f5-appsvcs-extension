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

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('port list', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        assertModuleProvisioned.call(this, 'afm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should create traffic matching criteria for port lists', () => {
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
                    firewallPortList: {
                        class: 'Firewall_Port_List',
                        ports: [
                            '1-999'
                        ]
                    },
                    tcpService: {
                        class: 'Service_TCP',
                        virtualAddresses: [
                            '192.168.100.0/24'
                        ],
                        portList: {
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
                assert.strictEqual(response.items[0].destinationPortList, '/TEST_Port_List/Application/firewallPortList');
                assert.strictEqual(response.items[0].destinationAddressInline, '192.168.100.0/24');
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

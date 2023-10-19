/**
 * Copyright 2023 F5, Inc.
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

const requestUtil = require('../../../common/requestUtilPromise');
const {
    postDeclaration,
    deleteDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');
const {
    simpleCopy
} = require('../../../../src/lib/util/util');

describe('SNAT Pools and SNAT Translations', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should share translations between snat pools', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    snatPool1: {
                        class: 'SNAT_Pool',
                        snatAddresses: [
                            '192.0.96.10', // unique to snat pool 1
                            '192.0.96.11', // specified snat translation to share with snat pool 2
                            '192.0.96.12' // auto generated snat translation to share with snat pool 2
                        ]
                    },
                    snatTranslation: {
                        class: 'SNAT_Translation',
                        address: '192.0.96.11',
                        arpEnabled: false
                    }
                }
            }
        };

        const snatPoolDecl = simpleCopy(baseDecl);
        snatPoolDecl.Tenant.Application.snatPool2 = {
            class: 'SNAT_Pool',
            snatAddresses: [
                '192.0.96.11', // specified snat translation to share with snat pool 1
                '192.0.96.12', // auto generated snat translation to share with snat pool 1
                '192.0.96.13' // unique to snat pool 2
            ]
        };

        return Promise.resolve()
        // POST #1
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // POST #2
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatPoolDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatPoolDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // check results 1
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snatpool' }))
            .then((response) => {
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/Application/snatPool1') || {};
                assert.deepStrictEqual(result.members, [
                    '/Tenant/192.0.96.10',
                    '/Tenant/192.0.96.11',
                    '/Tenant/192.0.96.12'
                ], 'snatPool1 should have 192.0.96.[10-12] as members');
                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/Application/snatPool2') || {};
                assert.deepStrictEqual(result.members, [
                    '/Tenant/192.0.96.11',
                    '/Tenant/192.0.96.12',
                    '/Tenant/192.0.96.13'
                ], 'snatPool1 should have 192.0.96.[11-13] as members');
            })
            // check results 2
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snat-translation' }))
            .then((response) => {
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.10') || {};
                assert.strictEqual(result.arp, 'enabled', '192.0.96.10 should exist and have arp enabled');

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.11') || {};
                assert.strictEqual(result.arp, 'disabled', '192.0.96.11 should exist and have arp disabled');

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.12') || {};
                assert.strictEqual(result.arp, 'enabled', '192.0.96.11 should exist and have arp enabled');

                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.12') || {};
                assert.strictEqual(result.arp, 'enabled', '192.0.96.13 should exist and have arp enabled');
            })
            // POST #0 again
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotentcy check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });

    it('should transition between autogenerated and specified snat translations', () => {
        const baseDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    snatPool: {
                        class: 'SNAT_Pool',
                        snatAddresses: [
                            '192.0.96.10', // auto generated snat translation
                            '192.0.96.11' // transition between auto generated and specified snat translation
                        ]
                    }
                }
            }
        };

        const snatTranslationDecl = simpleCopy(baseDecl);
        snatTranslationDecl.Tenant.Application.snatTranslation = {
            class: 'SNAT_Translation',
            address: '192.0.96.11',
            arpEnabled: false
        };

        return Promise.resolve()
            // POST #1
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // POST #2
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatTranslationDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotency check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    snatTranslationDecl,
                    { declarationIndex: 1 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            // check results - filter
            .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/snat-translation' }))
            .then((response) => {
                let result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.10') || {};
                assert.strictEqual(result.arp, 'enabled');
                result = (response.body.items || [])
                    .find((n) => n.fullPath === '/Tenant/192.0.96.11') || {};
                assert.strictEqual(result.arp, 'disabled');
            })
            // POST #0 again
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            // idempotentcy check
            .then(() => assert.isFulfilled(
                postDeclaration(
                    baseDecl,
                    { declarationIndex: 0 }
                )
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });
});

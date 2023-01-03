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
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Pool', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());

    it('should handle member rollback', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.42.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 80
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'tcp'
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
            })
            .then(() => {
                declaration.tenant.app.pool.members[0].servicePort = 0;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => assert.strictEqual(response.results[0].code, 422))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
            });
    });
});

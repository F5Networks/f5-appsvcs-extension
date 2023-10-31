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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
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

    it('should add pool with updated monitor', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.47.0',
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
                                    '10.0.0.1'
                                ],
                                servicePort: 443
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
                        monitorType: 'https'
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.47.0',
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
                                    '10.0.0.1'
                                ],
                                servicePort: 443
                            }
                        ],
                        monitors: [
                            {
                                use: 'testMonitor'
                            }
                        ]
                    },
                    pool1: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '10.0.0.1'
                                ],
                                servicePort: 443
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
                        monitorType: 'https',
                        targetPort: 9631
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/app/testMonitor }');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/pool/~tenant~app~pool1/'))
            .then((response) => {
                assert.strictEqual(response.monitor, 'min 1 of { /tenant/app/testMonitor }');
            });
    });

    it('should cleanup ephemeral nodes', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.48.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'fqdn',
                                servicePort: 80,
                                autoPopulate: true,
                                hostname: 'f5.com'
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => promiseUtil.delay(5000))
            .then(() => getPath('/mgmt/tm/ltm/node'))
            .then((results) => {
                const ephemeralNodes = (results.items || []).filter((node) => node.name.includes('_auto_'));
                return assert.strictEqual(
                    ephemeralNodes.length > 0,
                    true
                );
            })
            .then(() => deleteDeclaration())
            .then(() => promiseUtil.delay(5000))
            .then(() => getPath('/mgmt/tm/ltm/node'))
            .then((results) => {
                const ephemeralNodes = (results.items || []).filter((node) => node.name.includes('_auto_'));
                return assert.strictEqual(
                    ephemeralNodes.length > 0,
                    false
                );
            });
    });

    it('should post shared fqdn nodes in Common', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.48.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                addressDiscovery: 'fqdn',
                                servicePort: 80,
                                autoPopulate: true,
                                shareNodes: true,
                                hostname: 'f5.com'
                            }
                        ]
                    }
                }
            }
        };

        const expectedReferences = {
            name: 'references',
            persist: 'true',
            value: '1'
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/node'))
            .then((response) => {
                const fqdnNode = (response.items || []).filter((node) => node.name === 'f5.com');
                assert.strictEqual(fqdnNode.length, 1);
                assert.strictEqual(fqdnNode[0].fqdn.tmName, 'f5.com');
                assert.strictEqual(fqdnNode[0].metadata.length, 2);
                assert.deepStrictEqual(fqdnNode[0].metadata[1], expectedReferences);
            });
    });
});

/**
 * Copyright 2026 F5, Inc.
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
    getProvisionedModules,
    GLOBAL_TIMEOUT,
    postBigipItems,
    deleteBigipItems
} = require('../property/propertiesCommon');

describe('IP_Intelligence_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        // Ensure that ASM or AFM is provisioned before running the tests
        // as IP_Intelligence_Policy requires one of these modules.
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        const afm = ['afm'].every((m) => getProvisionedModules().includes(m));
        if (!asm && !afm) {
            this.skip();
        }

        return deleteDeclaration();
    });

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    it('should create IP_Intelligence_Policy successfully in non Common tenant partition and modify successfully based on updates', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Test_IP_Intelligence_Policy: {
                class: 'Tenant',
                SampleApp: {
                    class: 'Application',
                    SampleService: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.0.1'
                        ],
                        virtualPort: 80,
                        ipIntelligencePolicy: {
                            use: 'Example_IP_Intelligence_Policy'
                        }
                    },
                    Example_IP_Intelligence_Policy: {
                        class: 'IP_Intelligence_Policy',
                        defaultAction: 'drop',
                        defaultLogBlacklistHitOnly: 'limited',
                        blacklistCategories: [
                            {
                                blacklistCategory: {
                                    bigip: '/Common/botnets'
                                },
                                action: 'accept',
                                logBlacklistWhitelistHit: 'no',
                                matchDirectionOverride: 'match-source-and-destination'
                            },
                            {
                                blacklistCategory: {
                                    bigip: '/Common/additional'
                                },
                                logBlacklistHitOnly: 'no',
                                matchDirectionOverride: 'match-destination'
                            },
                            {
                                blacklistCategory: {
                                    bigip: '/Common/phishing'
                                },
                                action: 'drop',
                                logBlacklistWhitelistHit: 'yes'
                            }
                        ]
                    }
                }
            }
        };
        const isAfmDosProvisionsed = getProvisionedModules().includes('afm') || getProvisionedModules().includes('dos');
        const isAfmProvisionsed = getProvisionedModules().includes('afm');

        if (isAfmProvisionsed) {
            decl.Test_IP_Intelligence_Policy.SampleApp.Example_IP_Intelligence_Policy.feedLists = [
                {
                    bigip: '/Common/feed1'
                },
                {
                    bigip: '/Common/feed2'
                }
            ];
        }

        const bigipItems = [
            {
                endpoint: '/mgmt/tm/security/ip-intelligence/feed-list',
                data: { name: 'feed1' }
            },
            {
                endpoint: '/mgmt/tm/security/ip-intelligence/feed-list',
                data: { name: 'feed2' }
            }
        ];

        return Promise.resolve()
            .then(() => {
                if (isAfmProvisionsed) {
                    postBigipItems(bigipItems);
                }
            })
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/security/ip-intelligence/policy/~Test_IP_Intelligence_Policy~SampleApp~Example_IP_Intelligence_Policy'))
            .then((response) => {
                // default values should be updated
                assert.strictEqual(response.defaultAction, 'drop');
                assert.strictEqual(response.defaultLogBlacklistHitOnly, 'limited');
                if (isAfmDosProvisionsed) {
                    assert.strictEqual(response.defaultLogBlacklistWhitelistHit, 'no');
                } else {
                    assert.isUndefined(response.defaultLogBlacklistWhitelistHit);
                }
                assert.strictEqual(response.blacklistCategories.length, 3);
                const blacklistCategoryNames = response.blacklistCategories.map((cat) => cat.name);
                assert.include(blacklistCategoryNames, 'botnets');
                assert.include(blacklistCategoryNames, 'additional');
                assert.include(blacklistCategoryNames, 'phishing');
                response.blacklistCategories.forEach((cat) => {
                    if (cat.name === 'botnets') {
                        assert.strictEqual(cat.action, 'accept');
                        assert.strictEqual(cat.logBlacklistHitOnly, 'limited');
                        assert.strictEqual(cat.logBlacklistWhitelistHit, 'no');
                        assert.strictEqual(cat.matchDirectionOverride, 'match-source-and-destination');
                    } else if (cat.name === 'additional') {
                        assert.strictEqual(cat.action, 'drop');
                        assert.strictEqual(cat.logBlacklistHitOnly, 'no');
                        assert.strictEqual(cat.logBlacklistWhitelistHit, 'no');
                        assert.strictEqual(cat.matchDirectionOverride, 'match-destination');
                    } else if (cat.name === 'phishing') {
                        assert.strictEqual(cat.action, 'drop');
                        assert.strictEqual(cat.logBlacklistHitOnly, 'limited');
                        assert.strictEqual(cat.logBlacklistWhitelistHit, 'yes');
                        assert.strictEqual(cat.matchDirectionOverride, 'match-source');
                    }
                });
                if (isAfmProvisionsed) {
                    assert.strictEqual(response.feedLists.length, 2);
                    assert.include(response.feedLists, '/Common/feed1');
                    assert.include(response.feedLists, '/Common/feed2');
                } else {
                    assert.isUndefined(response.feedLists);
                }
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => {
                if (isAfmDosProvisionsed) {
                    decl.Test_IP_Intelligence_Policy.SampleApp.Example_IP_Intelligence_Policy.defaultLogBlacklistWhitelistHit = 'yes';
                }
                return postDeclaration(decl, { declarationIndex: 2 });
            })
            .then((response) => {
                if (isAfmDosProvisionsed) {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                } else {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'no change');
                }
            })
            .then(() => getPath('/mgmt/tm/security/ip-intelligence/policy/~Test_IP_Intelligence_Policy~SampleApp~Example_IP_Intelligence_Policy'))
            .then((response) => {
                if (isAfmDosProvisionsed) {
                    assert.strictEqual(response.defaultLogBlacklistWhitelistHit, 'yes');
                    response.blacklistCategories.forEach((cat) => {
                        if (cat.name === 'additional') {
                            assert.strictEqual(cat.logBlacklistWhitelistHit, 'yes');
                        }
                    });
                } else {
                    assert.isUndefined(response.defaultLogBlacklistWhitelistHit);
                    response.blacklistCategories.forEach((cat) => {
                        if (cat.name === 'additional') {
                            assert.strictEqual(cat.logBlacklistWhitelistHit, 'no');
                        }
                    });
                }
            })
            .then(() => {
                decl.Test_IP_Intelligence_Policy.SampleApp.Example_IP_Intelligence_Policy.blacklistCategories = [
                    {
                        blacklistCategory: {
                            bigip: '/Common/botnets'
                        },
                        action: 'accept',
                        logBlacklistWhitelistHit: 'no',
                        matchDirectionOverride: 'match-source-and-destination'
                    },
                    {
                        blacklistCategory: {
                            bigip: '/Common/phishing'
                        },
                        action: 'drop',
                        logBlacklistWhitelistHit: 'yes'
                    },
                    {
                        blacklistCategory: {
                            bigip: '/Common/additional'
                        },
                        logBlacklistHitOnly: 'no',
                        matchDirectionOverride: 'match-destination'
                    }
                ];
                if (isAfmProvisionsed) {
                    decl.Test_IP_Intelligence_Policy.SampleApp.Example_IP_Intelligence_Policy.feedLists = [
                        {
                            bigip: '/Common/feed2'
                        },
                        {
                            bigip: '/Common/feed1'
                        }
                    ];
                }
                return postDeclaration(decl, { declarationIndex: 3 });
            })
            .then((response) => {
                // order change should not go for policy update
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => {
                delete decl.Test_IP_Intelligence_Policy.SampleApp.Example_IP_Intelligence_Policy.blacklistCategories;
                delete decl.Test_IP_Intelligence_Policy.SampleApp.Example_IP_Intelligence_Policy.feedLists;
                return postDeclaration(decl, { declarationIndex: 4 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/security/ip-intelligence/policy/~Test_IP_Intelligence_Policy~SampleApp~Example_IP_Intelligence_Policy'))
            .then((response) => {
                assert.isUndefined(response.blacklistCategories);
                assert.isUndefined(response.feedLists);
            })
            .finally(() => {
                if (isAfmProvisionsed) {
                    // Clean up the items created in the BIG-IP
                    deleteBigipItems(bigipItems);
                }
            });
    });

    it('should create IP_Intelligence_Policy successfully in Common tenant partition and modify successfully based on updates', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SampleService: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.0.1'
                        ],
                        virtualPort: 80,
                        ipIntelligencePolicy: {
                            use: 'Example_IP_Intelligence_Policy'
                        }
                    },
                    Example_IP_Intelligence_Policy: {
                        class: 'IP_Intelligence_Policy',
                        defaultAction: 'drop',
                        defaultLogBlacklistHitOnly: 'limited',
                        blacklistCategories: [
                            {
                                blacklistCategory: {
                                    bigip: '/Common/botnets'
                                },
                                action: 'accept',
                                logBlacklistWhitelistHit: 'no',
                                matchDirectionOverride: 'match-source-and-destination'
                            },
                            {
                                blacklistCategory: {
                                    bigip: '/Common/additional'
                                },
                                logBlacklistHitOnly: 'no',
                                matchDirectionOverride: 'match-destination'
                            },
                            {
                                blacklistCategory: {
                                    bigip: '/Common/phishing'
                                },
                                action: 'drop',
                                logBlacklistWhitelistHit: 'yes'
                            }
                        ]
                    }
                }
            }
        };
        const isAfmDosProvisionsed = getProvisionedModules().includes('afm') || getProvisionedModules().includes('dos');
        const isAfmProvisionsed = getProvisionedModules().includes('afm');
        if (isAfmProvisionsed) {
            decl.Common.Shared.Example_IP_Intelligence_Policy.feedLists = [
                {
                    bigip: '/Common/feed1'
                },
                {
                    bigip: '/Common/feed2'
                }
            ];
        }

        const bigipItems = [
            {
                endpoint: '/mgmt/tm/security/ip-intelligence/feed-list',
                data: { name: 'feed1' }
            },
            {
                endpoint: '/mgmt/tm/security/ip-intelligence/feed-list',
                data: { name: 'feed2' }
            }
        ];

        return Promise.resolve()
            .then(() => {
                if (isAfmProvisionsed) {
                    postBigipItems(bigipItems);
                }
            })
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/security/ip-intelligence/policy/~Common~Shared~Example_IP_Intelligence_Policy'))
            .then((response) => {
                // default values should be updated
                assert.strictEqual(response.defaultAction, 'drop');
                assert.strictEqual(response.defaultLogBlacklistHitOnly, 'limited');
                if (isAfmDosProvisionsed) {
                    assert.strictEqual(response.defaultLogBlacklistWhitelistHit, 'no');
                } else {
                    assert.isUndefined(response.defaultLogBlacklistWhitelistHit);
                }
                assert.strictEqual(response.blacklistCategories.length, 3);
                const blacklistCategoryNames = response.blacklistCategories.map((cat) => cat.name);
                assert.include(blacklistCategoryNames, 'botnets');
                assert.include(blacklistCategoryNames, 'additional');
                assert.include(blacklistCategoryNames, 'phishing');
                response.blacklistCategories.forEach((cat) => {
                    if (cat.name === 'botnets') {
                        assert.strictEqual(cat.action, 'accept');
                        assert.strictEqual(cat.logBlacklistHitOnly, 'limited');
                        assert.strictEqual(cat.logBlacklistWhitelistHit, 'no');
                        assert.strictEqual(cat.matchDirectionOverride, 'match-source-and-destination');
                    } else if (cat.name === 'additional') {
                        assert.strictEqual(cat.action, 'drop');
                        assert.strictEqual(cat.logBlacklistHitOnly, 'no');
                        assert.strictEqual(cat.logBlacklistWhitelistHit, 'no');
                        assert.strictEqual(cat.matchDirectionOverride, 'match-destination');
                    } else if (cat.name === 'phishing') {
                        assert.strictEqual(cat.action, 'drop');
                        assert.strictEqual(cat.logBlacklistHitOnly, 'limited');
                        assert.strictEqual(cat.logBlacklistWhitelistHit, 'yes');
                        assert.strictEqual(cat.matchDirectionOverride, 'match-source');
                    }
                });
                if (isAfmProvisionsed) {
                    assert.strictEqual(response.feedLists.length, 2);
                    assert.include(response.feedLists, '/Common/feed1');
                    assert.include(response.feedLists, '/Common/feed2');
                } else {
                    assert.isUndefined(response.feedLists);
                }
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => {
                if (isAfmDosProvisionsed) {
                    decl.Common.Shared.Example_IP_Intelligence_Policy.defaultLogBlacklistWhitelistHit = 'yes';
                }
                return postDeclaration(decl, { declarationIndex: 2 });
            })
            .then((response) => {
                if (isAfmDosProvisionsed) {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                    assert.strictEqual(response.results[1].code, 200);
                    assert.strictEqual(response.results[1].message, 'success');
                } else {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'no change');
                    assert.strictEqual(response.results[1].code, 200);
                    assert.strictEqual(response.results[1].message, 'no change');
                }
            })
            .then(() => getPath('/mgmt/tm/security/ip-intelligence/policy/~Common~Shared~Example_IP_Intelligence_Policy'))
            .then((response) => {
                if (isAfmDosProvisionsed) {
                    assert.strictEqual(response.defaultLogBlacklistWhitelistHit, 'yes');
                    response.blacklistCategories.forEach((cat) => {
                        if (cat.name === 'additional') {
                            assert.strictEqual(cat.logBlacklistWhitelistHit, 'yes');
                        }
                    });
                } else {
                    assert.isUndefined(response.defaultLogBlacklistWhitelistHit);
                    response.blacklistCategories.forEach((cat) => {
                        if (cat.name === 'additional') {
                            assert.strictEqual(cat.logBlacklistWhitelistHit, 'no');
                        }
                    });
                }
            })
            .then(() => {
                decl.Common.Shared.Example_IP_Intelligence_Policy.blacklistCategories = [
                    {
                        blacklistCategory: {
                            bigip: '/Common/botnets'
                        },
                        action: 'accept',
                        logBlacklistWhitelistHit: 'no',
                        matchDirectionOverride: 'match-source-and-destination'
                    },
                    {
                        blacklistCategory: {
                            bigip: '/Common/phishing'
                        },
                        action: 'drop',
                        logBlacklistWhitelistHit: 'yes'
                    },
                    {
                        blacklistCategory: {
                            bigip: '/Common/additional'
                        },
                        logBlacklistHitOnly: 'no',
                        matchDirectionOverride: 'match-destination'
                    }
                ];
                if (isAfmProvisionsed) {
                    decl.Common.Shared.Example_IP_Intelligence_Policy.feedLists = [
                        {
                            bigip: '/Common/feed2'
                        },
                        {
                            bigip: '/Common/feed1'
                        }
                    ];
                }
                return postDeclaration(decl, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => {
                delete decl.Common.Shared.Example_IP_Intelligence_Policy.blacklistCategories;
                delete decl.Common.Shared.Example_IP_Intelligence_Policy.feedLists;
                return postDeclaration(decl, { declarationIndex: 4 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                // Second Pass for Common should successfully re-create the policy
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/security/ip-intelligence/policy/~Common~Shared~Example_IP_Intelligence_Policy'))
            .then((response) => {
                assert.isUndefined(response.blacklistCategories, 'blacklistCategories should not be defined');
                assert.isUndefined(response.feedLists, 'feedLists should not be defined');
            })
            .finally(() => {
                if (isAfmProvisionsed) {
                    // Clean up the items created in the BIG-IP
                    deleteBigipItems(bigipItems);
                }
            });
    });
});

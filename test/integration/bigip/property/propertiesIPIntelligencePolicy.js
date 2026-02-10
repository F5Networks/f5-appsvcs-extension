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

const {
    assertClass,
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('IP_Intelligence_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertIpIntelligencePolicy(properties, options) {
        return assertClass('IP_Intelligence_Policy', properties, options);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'asm');
        assertModuleProvisioned.call(this, 'afm');

        const blacklistCategoriesInput = [
            {
                blacklistCategory: {
                    bigip: '/Common/additional'
                },
                logBlacklistHitOnly: 'no',
                matchDirectionOverride: 'match-destination'
            },
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
            }
        ];
        const blacklistCategoriesExpected = [
            {
                action: 'accept',
                logBlacklistHitOnly: 'no',
                logBlacklistWhitelistHit: 'no',
                matchDirectionOverride: 'match-destination',
                name: 'additional',
                nameReference: {
                    link: `https://localhost/mgmt/tm/security/ip-intelligence/blacklist-category/~Common~additional?ver=${getBigIpVersion()}`
                },
                partition: 'Common'
            },
            {
                action: 'accept',
                logBlacklistHitOnly: 'yes',
                logBlacklistWhitelistHit: 'no',
                matchDirectionOverride: 'match-source-and-destination',
                name: 'botnets',
                nameReference: {
                    link: `https://localhost/mgmt/tm/security/ip-intelligence/blacklist-category/~Common~botnets?ver=${getBigIpVersion()}`
                },
                partition: 'Common'
            },
            {
                action: 'drop',
                logBlacklistHitOnly: 'yes',
                logBlacklistWhitelistHit: 'yes',
                matchDirectionOverride: 'match-source',
                name: 'phishing',
                nameReference: {
                    link: `https://localhost/mgmt/tm/security/ip-intelligence/blacklist-category/~Common~phishing?ver=${getBigIpVersion()}`
                },
                partition: 'Common'
            }
        ];

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/security/ip-intelligence/feed-list',
                    data: { name: 'feed1' }
                },
                {
                    endpoint: '/mgmt/tm/security/ip-intelligence/feed-list',
                    data: { name: 'feed2' }
                }
            ]
        };

        const feedListsInput = [
            {
                bigip: '/Common/feed1'
            },
            {
                bigip: '/Common/feed2'
            }
        ];
        const feedListsExpected = [
            {
                fullPath: '/Common/feed1',
                kind: 'tm:security:ip-intelligence:feed-list:feed-liststate',
                name: 'feed1',
                partition: 'Common'
            },
            {
                fullPath: '/Common/feed2',
                kind: 'tm:security:ip-intelligence:feed-list:feed-liststate',
                name: 'feed2',
                partition: 'Common'
            }
        ];

        const properties = [
            {
                name: 'defaultAction',
                inputValue: ['drop', 'accept', undefined],
                expectedValue: ['drop', 'accept', 'drop']
            },
            {
                name: 'defaultLogBlacklistHitOnly',
                inputValue: ['limited', 'yes', undefined],
                expectedValue: ['limited', 'yes', 'no']
            },
            {
                name: 'defaultLogBlacklistWhitelistHit',
                inputValue: ['yes', 'no', undefined],
                expectedValue: ['yes', 'no', 'no']
            },
            {
                name: 'blacklistCategories',
                inputValue: [undefined, blacklistCategoriesInput, []],
                expectedValue: [undefined, blacklistCategoriesExpected, undefined]
            },
            {
                name: 'feedLists',
                inputValue: [undefined, [], feedListsInput],
                expectedValue: [undefined, undefined, feedListsExpected],
                // Add extractfunction for feedLists to delete selfLink and generation property of each feedList
                extractFunction: (data) => {
                    if (!data.feedLists || !Array.isArray(data.feedLists)) {
                        return data.feedLists;
                    }
                    // Remove selfLink and generation.
                    data.feedLists.forEach((feedList) => {
                        delete feedList.selfLink;
                        delete feedList.generation;
                    });
                    return data.feedLists;
                }
            }
        ];

        return assertIpIntelligencePolicy(properties, options);
    });
});

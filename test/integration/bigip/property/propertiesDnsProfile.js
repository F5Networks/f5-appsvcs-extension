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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('DNS_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDnsProfileClass(properties, options) {
        return assertClass('DNS_Profile', properties, options);
    }

    it('All properties', () => {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/dns/cache/resolver',
                    data: { name: 'cache_resolver' }
                }
            ]
        };

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'A DNS Profile', undefined],
                expectedValue: ['none', 'A DNS Profile', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'parentProfile',
                inputValue: [undefined, { use: 'dnsProfile' }, undefined],
                expectedValue: ['dns', 'dnsProfile', 'dns'],
                referenceObjects: {
                    dnsProfile: {
                        class: 'DNS_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'rapidResponseEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'rapidResponseLastAction',
                inputValue: [undefined, 'allow', undefined],
                expectedValue: ['drop', 'allow', 'drop']
            },
            {
                name: 'hardwareQueryValidationEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'hardwareResponseCacheEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'dnssecEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'globalServerLoadBalancingEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'dnsExpressEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'dns64Mode',
                inputValue: [undefined, 'secondary', undefined],
                expectedValue: ['disabled', 'secondary', 'disabled']
            },
            {
                name: 'dns64Prefix',
                inputValue: [undefined, '1:1:1:1:1:1:1:1', undefined],
                expectedValue: ['any6', '1:1:1:1:1:1:1:1', 'any6']
            },
            {
                name: 'dns64AdditionalSectionRewrite',
                inputValue: [undefined, 'any', undefined],
                expectedValue: ['disabled', 'any', 'disabled']
            },
            {
                name: 'unhandledQueryAction',
                inputValue: [undefined, 'drop', undefined],
                expectedValue: ['allow', 'drop', 'allow']
            },
            {
                name: 'localBindServerEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'zoneTransferEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'recursionDesiredEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'securityEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'statisticsSampleRate',
                inputValue: [undefined, 13000, undefined],
                expectedValue: [0, 13000, 0]
            },
            {
                name: 'cacheEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'cache',
                inputValue: [undefined, { bigip: '/Common/cache_resolver' }, undefined],
                expectedValue: ['none', '/Common/cache_resolver', 'none'],
                extractFunction: (object) => {
                    if (!object.cache || object.cache === 'none') return 'none';
                    return object.cache.fullPath;
                }
            },
            {
                name: 'loggingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'loggingProfile',
                inputValue: [undefined, { use: 'dnsLoggingProfile' }, undefined],
                expectedValue: ['none', 'dnsLoggingProfile', 'none'],
                referenceObjects: {
                    dnsLoggingProfile: {
                        class: 'DNS_Logging_Profile',
                        logPublisher: {
                            bigip: '/Common/local-db-publisher'
                        }
                    }
                },
                extractFunction: (o) => {
                    const result = o.logProfile && o.logProfile.name ? o.logProfile.name : 'none';
                    return result;
                }
            }

            // No existing BIG-IP DNS security profiles
            /* {
                name: 'securityProfile',
                inputValue: [undefined, {}, undefined],
                expectedValue: ['none', '', 'none']
            }, */
        ];
        return assertDnsProfileClass(properties, options);
    });

    it('Cache references', () => {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/dns/cache/resolver',
                    data: { name: 'cache_resolver' }
                },
                {
                    endpoint: '/mgmt/tm/ltm/dns/cache/transparent',
                    data: { name: 'cache_transparent' }
                },
                {
                    endpoint: '/mgmt/tm/ltm/dns/cache/validating-resolver',
                    data: { name: 'cache_validating_resolver' }
                }
            ]
        };
        const properties = [
            {
                name: 'remark',
                inputValue: ['test cache references'],
                skipAssert: true
            },
            {
                name: 'cache',
                inputValue: [
                    { bigip: '/Common/cache_resolver' },
                    { bigip: '/Common/cache_transparent' },
                    { bigip: '/Common/cache_validating_resolver' }
                ],
                expectedValue: [
                    '/Common/cache_resolver',
                    '/Common/cache_transparent',
                    '/Common/cache_validating_resolver'
                ],
                extractFunction: (o) => o.cache.fullPath
            }
        ];
        return assertDnsProfileClass(properties, options);
    });
});

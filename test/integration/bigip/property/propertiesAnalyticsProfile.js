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
const util = require('../../../../src/lib/util/util');

describe('Analytics_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertAnalyticsProfileClass(properties) {
        return assertClass('Analytics_Profile', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'avr');

        // const urlFilterTypeExpected = util.versionLessThan(getBigIpVersion(), '14.0') ? 'none' : 'all';
        const expectedFilterDefaults = {
            requestCapturedParts: 'none',
            responseCapturedParts: 'none',
            dosActivity: 'any',
            capturedProtocols: 'all',
            capturedReadyForJsInjection: 'disabled',
            responseCodes: [],
            methods: [],
            urlFilterType: 'all',
            urlPathPrefixes: [],
            userAgentSubstrings: [],
            clientIps: [],
            requestContentFilterSearchPart: 'none',
            requestContentFilterSearchString: 'none',
            responseContentFilterSearchPart: 'none',
            responseContentFilterSearchString: 'none'
        };
        const expectedTestCase = {
            requestCapturedParts: 'body',
            responseCapturedParts: 'all',
            dosActivity: 'mitigated-by-dosl7',
            capturedProtocols: 'http',
            capturedReadyForJsInjection: 'enabled',
            nodeAddresses: ['198.19.192.59', '198.19.192.60'],
            virtualServers: ['serviceMain-1-'],
            responseCodes: [400, 401, 402],
            methods: ['GET', 'POST', 'PUT'],
            urlFilterType: 'white-list',
            urlPathPrefixes: ['a.org', 'b.org', 'c.org'],
            userAgentSubstrings: ['Mozilla (01', 'Mozilla (02', 'Mozilla (03'],
            clientIps: ['10.9.10.10', '10.9.10.11', '10.9.10.12'],
            requestContentFilterSearchPart: 'none',
            requestContentFilterSearchString: 'none',
            responseContentFilterSearchPart: 'none',
            responseContentFilterSearchString: 'none'
        };

        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            delete expectedFilterDefaults.urlFilterType;
            delete expectedTestCase.urlFilterType;
        }

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none']
            },
            {
                name: 'collectedStatsInternalLogging',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectedStatsExternalLogging',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'capturedTrafficInternalLogging',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'capturedTrafficExternalLogging',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'externalLoggingPublisher',
                inputValue: [undefined, { use: 'logPub' }, undefined],
                expectedValue: ['none', 'logPub', 'none'],
                referenceObjects: {
                    logPub: {
                        class: 'Log_Publisher',
                        destinations: [
                            {
                                use: 'logDest'
                            }
                        ]
                    },
                    logDest: {
                        class: 'Log_Destination',
                        type: 'remote-syslog',
                        remoteHighSpeedLog: {
                            use: 'highSpeedLog'
                        }
                    },
                    highSpeedLog: {
                        class: 'Log_Destination',
                        type: 'remote-high-speed-log',
                        pool: {
                            use: 'thePool'
                        }
                    },
                    thePool: {
                        class: 'Pool'
                    }
                },
                extractFunction: (o) => {
                    const result = o.externalLoggingPublisher && o.externalLoggingPublisher.name ? o.externalLoggingPublisher.name : 'none';
                    return result;
                }
            },
            {
                name: 'notificationBySyslog',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'notificationBySnmp',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'notificationByEmail',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'notificationEmailAddresses',
                inputValue: [[], ['example@example.com'], undefined],
                expectedValue: [[], ['example@example.com'], []],
                extractFunction: (o) => o.notificationEmailAddresses || []
            },
            {
                name: 'publishIruleStatistics',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectMaxTpsAndThroughput',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectPageLoadTime',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectClientSideStatistics',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectUserSession',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectUrl',
                inputValue: [true, true, undefined],
                expectedValue: ['enabled', 'enabled', 'disabled']
            },
            {
                name: 'urlsForStatCollection',
                inputValue: [[], ['www.example.com'], undefined],
                expectedValue: [[], ['www.example.com'], []]
            },
            {
                name: 'collectGeo',
                inputValue: [true, true, undefined],
                expectedValue: ['enabled', 'enabled', 'disabled']
            },
            {
                name: 'countriesForStatCollection',
                inputValue: [[], ['Austria'], undefined],
                expectedValue: [[], ['Austria'], []]
            },
            {
                name: 'collectIp',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectSubnet',
                inputValue: [true, true, undefined],
                expectedValue: ['enabled', 'enabled', 'disabled']
            },
            {
                name: 'subnetsForStatCollection',
                inputValue: [[], ['255.255.255.0'], undefined],
                expectedValue: [[], ['255.255.255.0'], []]
            },
            {
                name: 'collectResponseCode',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectUserAgent',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectMethod',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectOsAndBrowser',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'sessionCookieSecurity',
                inputValue: [undefined, 'always-secure', undefined],
                expectedValue: ['ssl-only', 'always-secure', 'ssl-only']
            },
            {
                name: 'sessionTimeoutMinutes',
                inputValue: [undefined, 15, undefined],
                expectedValue: [5, 15, 5]
            },
            {
                name: 'captureFilter',
                inputValue: [
                    undefined,
                    {
                        requestCapturedParts: 'body',
                        responseCapturedParts: 'all',
                        dosActivity: 'mitigated-by-dosl7',
                        capturedProtocols: 'http',
                        capturedReadyForJsInjection: 'enabled',
                        nodeAddresses: ['198.19.192.59', '198.19.192.60'],
                        virtualServers: ['serviceMain-1-'],
                        responseCodes: [400, 401, 402],
                        methods: ['GET', 'POST', 'PUT'],
                        urlFilterType: 'white-list',
                        urlPathPrefixes: ['a.org', 'b.org', 'c.org'],
                        userAgentSubstrings: ['Mozilla (01', 'Mozilla (02', 'Mozilla (03'],
                        clientIps: ['10.9.10.10', '10.9.10.11', '10.9.10.12']
                    },
                    undefined
                ],
                expectedValue: [
                    expectedFilterDefaults,
                    expectedTestCase,
                    expectedFilterDefaults
                ],
                referenceObjects: {
                    serviceMain: {
                        class: 'Service_Generic',
                        virtualAddresses: [
                            '198.19.192.19',
                            '198.19.192.20',
                            '198.19.192.21'
                        ],
                        virtualPort: 80,
                        profileAnalytics: {
                            use: 'pA_Sample'
                        },
                        pool: 'poolRoundRobin'
                    },
                    poolRoundRobin: {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        monitors: [
                            'http'
                        ],
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '198.19.192.58',
                                    '198.19.192.59',
                                    '198.19.192.60'
                                ]
                            }
                        ]
                    }
                },
                extractFunction: (o) => {
                    if (!o.trafficCapture) {
                        return undefined;
                    }
                    o = o.trafficCapture[0];
                    delete o.kind;
                    delete o.name;
                    delete o.fullPath;
                    delete o.generation;
                    delete o.selfLink;
                    delete o.appService;
                    delete o.nodeAddressesReference;
                    delete o.virtualServersReference;
                    if (o.nodeAddresses) {
                        const nodes = [];
                        o.nodeAddresses.forEach((element) => {
                            if (element.address) {
                                nodes.push(element.address);
                            }
                        });
                        o.nodeAddresses = nodes;
                    }
                    if (o.virtualServers) {
                        const names = [];
                        o.virtualServers.forEach((element) => {
                            if (element.name) {
                                names.push(element.name);
                            }
                        });
                        o.virtualServers = names;
                    }
                    return o;
                }
            }
        ];

        return assertAnalyticsProfileClass(properties);
    });
});

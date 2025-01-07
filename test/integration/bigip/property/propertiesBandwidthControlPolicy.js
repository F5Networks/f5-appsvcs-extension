/**
 * Copyright 2025 F5, Inc.
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

describe('Bandwidth_Control_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertBandwidthControlPolicyClass(properties) {
        // Bandwidth contol policy full path limit is 127
        const options = {
            maxPathLength: 127
        };
        return assertClass('Bandwidth_Control_Policy', properties, options);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'dynamicControlEnabled',
                inputValue: [undefined, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'maxBandwidth',
                inputValue: [10, 11, 10],
                expectedValue: [10000000, 11000000000, 10000000]
            },
            {
                name: 'maxBandwidthUnit',
                inputValue: [undefined, 'Gbps', undefined],
                skipAssert: true
            },
            {
                name: 'maxUserBandwidth',
                inputValue: [undefined, 10, 8],
                expectedValue: [0, 10000, 8000000]
            },
            {
                name: 'maxUserBandwidthUnit',
                inputValue: [undefined, 'Kbps', undefined],
                skipAssert: true
            },
            {
                name: 'maxUserPPS',
                inputValue: [undefined, 1, undefined],
                expectedValue: [0, 1000000000, 0]
            },
            {
                name: 'maxUserPPSUnit',
                inputValue: [undefined, 'Gpps', undefined],
                skipAssert: true
            },
            {
                name: 'loggingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'logPublisher',
                inputValue: [
                    undefined,
                    {
                        use: 'logPub'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'logPub',
                    undefined
                ],
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
                    const result = (o.logPublisher) ? o.logPublisher.name : undefined;
                    return result;
                }
            },
            {
                name: 'logPeriod',
                inputValue: [undefined, 1000, undefined],
                expectedValue: [2048, 1000, 2048]
            },
            {
                name: 'markIP',
                inputValue: [undefined, 23, undefined],
                expectedValue: ['pass-through', 23, 'pass-through']
            },
            {
                name: 'markL2',
                inputValue: [undefined, 5, undefined],
                expectedValue: ['pass-through', 5, 'pass-through']
            },
            {
                name: 'categories',
                inputValue: [
                    undefined,
                    [
                        {
                            maxBandwidth: 8,
                            maxBandwidthUnit: 'Kbps',
                            markIP: 1,
                            markL2: 1
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    [{
                        ipTos: '1',
                        linkQos: '1',
                        maxCatRate: 8000,
                        maxCatRatePercentage: 0,
                        trafficPriorityMap: '->'
                    }],
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.categories) {
                        o.categories.forEach((category) => delete category.name);
                    }
                    return o.categories;
                }
            }
        ];
        return assertBandwidthControlPolicyClass(properties);
    });
});

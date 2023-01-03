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

const {
    assertClass,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Analytics_TCP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertAnalyticsTcpProfileClass(properties) {
        return assertClass('Analytics_TCP_Profile', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'avr');

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
                name: 'collectedByClientSide',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectedByServerSide',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectRemoteHostIp',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectRemoteHostSubnet',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectNexthop',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectContinent',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectCountry',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectRegion',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'collectCity',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'collectPostCode',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];

        return assertAnalyticsTcpProfileClass(properties);
    });
});

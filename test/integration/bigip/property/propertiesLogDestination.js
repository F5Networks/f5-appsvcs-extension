/**
 * Copyright 2024 F5, Inc.
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

describe('Log_Destination', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertLogDestinationClass(properties) {
        return assertClass('Log_Destination', properties);
    }

    it('All properties management-port', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'type',
                inputValue: ['management-port'],
                expectedValue: [true],
                extractFunction: (o) => o.kind.includes('management-port')
            },
            {
                name: 'address',
                inputValue: ['1.2.3.4', '4.3.2.1', '1.2.3.4'],
                expectedValue: ['1.2.3.4', '4.3.2.1', '1.2.3.4']
            },
            {
                name: 'port',
                inputValue: [80, 443, 80],
                expectedValue: [80, 443, 80]
            },
            {
                name: 'protocol',
                inputValue: [undefined, 'udp', undefined],
                expectedValue: ['tcp', 'udp', 'tcp']
            }
        ];
        return assertLogDestinationClass(properties);
    });

    it('All properties remote-syslog', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'type',
                inputValue: ['remote-syslog'],
                expectedValue: [true],
                extractFunction: (o) => o.kind.includes('remote-syslog')
            },
            {
                name: 'format',
                inputValue: [undefined, 'rfc5424', undefined],
                expectedValue: ['rfc3164', 'rfc5424', 'rfc3164']
            },
            {
                name: 'defaultFacility',
                inputValue: [undefined, 'local1', undefined],
                expectedValue: ['local0', 'local1', 'local0']
            },
            {
                name: 'defaultSeverity',
                inputValue: [undefined, 'alert', undefined],
                expectedValue: ['info', 'alert', 'info']
            },
            {
                name: 'remoteHighSpeedLog',
                inputValue: [
                    {
                        use: 'highSpeedLog1'
                    },
                    {
                        use: 'highSpeedLog2'
                    },
                    {
                        use: 'highSpeedLog1'
                    }
                ],
                expectedValue: [
                    'highSpeedLog1',
                    'highSpeedLog2',
                    'highSpeedLog1'
                ],
                referenceObjects: {
                    highSpeedLog1: {
                        class: 'Log_Destination',
                        type: 'remote-high-speed-log',
                        pool: {
                            use: 'thePool'
                        }
                    },
                    highSpeedLog2: {
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
                extractFunction: (o) => o.remoteHighSpeedLog.name
            }
        ];
        return assertLogDestinationClass(properties);
    });

    it('All properties remote-high-speed-log', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'type',
                inputValue: ['remote-high-speed-log'],
                expectedValue: [true],
                extractFunction: (o) => o.kind.includes('remote-high-speed-log')
            },
            {
                name: 'distribution',
                inputValue: [undefined, 'balanced', undefined],
                expectedValue: ['adaptive', 'balanced', 'adaptive']
            },
            {
                name: 'protocol',
                inputValue: [undefined, 'udp', undefined],
                expectedValue: ['tcp', 'udp', 'tcp']
            },
            {
                name: 'pool',
                inputValue: [
                    {
                        use: 'pool1'
                    },
                    {
                        use: 'pool2'
                    },
                    {
                        use: 'pool1'
                    }
                ],
                expectedValue: ['pool1', 'pool2', 'pool1'],
                referenceObjects: {
                    pool1: {
                        class: 'Pool'
                    },
                    pool2: {
                        class: 'Pool'
                    }
                },
                extractFunction: (o) => o.poolName.name
            }
        ];
        return assertLogDestinationClass(properties);
    });

    it('All properties splunk', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'type',
                inputValue: ['splunk'],
                expectedValue: [true],
                extractFunction: (o) => o.kind.includes('splunk')
            },
            {
                name: 'forwardTo',
                inputValue: [
                    {
                        use: 'testRemoteHSLog'
                    },
                    {
                        bigip: '/Common/alertd'
                    },
                    {
                        use: 'testRemoteHSLog'
                    }
                ],
                referenceObjects: {
                    testPool: {
                        class: 'Pool'
                    },
                    testRemoteHSLog: {
                        class: 'Log_Destination',
                        type: 'remote-high-speed-log',
                        pool: {
                            use: 'testPool'
                        }
                    }
                },
                expectedValue: [
                    '/TEST_Log_Destination/Application/testRemoteHSLog',
                    '/Common/alertd',
                    '/TEST_Log_Destination/Application/testRemoteHSLog'
                ],
                extractFunction: (o) => o.forwardTo.fullPath
            }
        ];
        return assertLogDestinationClass(properties);
    });
});

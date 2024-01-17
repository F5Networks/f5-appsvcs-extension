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

describe('Log_Publisher', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertLogPublisherClass(properties) {
        return assertClass('Log_Publisher', properties);
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
                name: 'destinations',
                inputValue: [
                    [],
                    [
                        {
                            use: 'logDest'
                        }
                    ],
                    []
                ],
                expectedValue: [
                    [],
                    [
                        {
                            name: 'logDest',
                            partition: 'TEST_Log_Publisher',
                            subPath: 'Application'
                        }
                    ],
                    []
                ],
                referenceObjects: {
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
                    if (o.destinations) {
                        delete o.destinations[0].nameReference;
                    }
                    return o.destinations || [];
                }
            }
        ];
        return assertLogPublisherClass(properties);
    });

    it('Change remark with empty destinations', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: ['description', undefined],
                expectedValue: ['description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'destinations',
                inputValue: [
                    [],
                    []
                ],
                expectedValue: [
                    [],
                    []
                ],
                extractFunction: () => []
            }
        ];
        return assertLogPublisherClass(properties);
    });
});

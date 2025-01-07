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

describe('HTTP_Acceleration_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertHttpAccelerationProfileClass(properties) {
        return assertClass('HTTP_Acceleration_Profile', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'parentProfile',
                inputValue: [undefined, { use: 'accel' }, undefined],
                expectedValue: ['webacceleration', 'accel', 'webacceleration'],
                referenceObjects: {
                    accel: {
                        class: 'HTTP_Acceleration_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'agingRate',
                inputValue: [undefined, 5, undefined],
                expectedValue: [9, 5, 9]
            },
            {
                name: 'ignoreHeaders',
                inputValue: [undefined, 'none', undefined],
                expectedValue: ['all', 'none', 'all']
            },
            {
                name: 'insertAgeHeaderEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'maximumAge',
                inputValue: [undefined, 10000, undefined],
                expectedValue: [3600, 10000, 3600]
            },
            {
                name: 'maximumEntries',
                inputValue: [undefined, 20000, undefined],
                expectedValue: [10000, 20000, 10000]
            },
            {
                name: 'maximumObjectSize',
                inputValue: [undefined, 100000, undefined],
                expectedValue: [50000, 100000, 50000]
            },
            {
                name: 'minimumObjectSize',
                inputValue: [undefined, 2000, undefined],
                expectedValue: [500, 2000, 500]
            },
            {
                name: 'cacheSize',
                inputValue: [undefined, 200, undefined],
                expectedValue: [100, 200, 100]
            },
            {
                name: 'uriExcludeList',
                inputValue: [
                    undefined,
                    [
                        '.',
                        '/test1/prefix?key=ms\\.spa\\.'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        '.',
                        '/test1/prefix?key=ms\\.spa\\.'
                    ],
                    []
                ],
                extractFunction: (o) => o.cacheUriExclude || []
            },
            {
                name: 'uriIncludeList',
                inputValue: [
                    undefined,
                    [
                        'www.uri.com',
                        '/test2/prefix?key=ms\\.spa\\.'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        'www.uri.com',
                        '/test2/prefix?key=ms\\.spa\\.'
                    ],
                    []
                ],
                extractFunction: (o) => o.cacheUriInclude || []
            },
            {
                name: 'uriIncludeOverrideList',
                inputValue: [
                    undefined,
                    [
                        '1.1.2.2',
                        '2.2.3.3',
                        '/test3/prefix?key=ms\\.spa\\.'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        '1.1.2.2',
                        '2.2.3.3',
                        '/test3/prefix?key=ms\\.spa\\.'
                    ],
                    []
                ],
                extractFunction: (o) => o.cacheUriIncludeOverride || []
            },
            {
                name: 'uriPinnedList',
                inputValue: [
                    undefined,
                    [
                        '///',
                        '/test4/prefix?key=ms\\.spa\\.'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        '///',
                        '/test4/prefix?key=ms\\.spa\\.'
                    ],
                    []
                ],
                extractFunction: (o) => o.cacheUriPinned || []
            },
            {
                name: 'metadataMaxSize',
                inputValue: [undefined, 20, undefined],
                expectedValue: [25, 20, 25]
            }
        ];
        return assertHttpAccelerationProfileClass(properties);
    });
});

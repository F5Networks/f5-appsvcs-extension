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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('HTTP_Compress', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertHttpCompressClass(properties) {
        return assertClass('HTTP_Compress', properties);
    }

    // TODO: Remove skip when bug 834 is resolved
    it('All properties', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'allowHTTP10',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.allowHttp_10
            },
            {
                name: 'bufferSize',
                inputValue: [undefined, 27000, undefined],
                expectedValue: [4096, 27000, 4096]
            },
            {
                name: 'contentTypeExcludes',
                inputValue: [
                    [],
                    ['exclude'],
                    undefined
                ],
                expectedValue: [
                    [''],
                    ['exclude'],
                    []
                ],
                extractFunction: (o) => o.contentTypeExclude || []
            },
            {
                name: 'contentTypeIncludes',
                inputValue: [
                    [],
                    ['include'],
                    undefined
                ],
                expectedValue: [
                    [
                        ''
                    ],
                    ['include'],
                    [
                        'text/',
                        'application/(xml|x-javascript)'
                    ]
                ],
                extractFunction: (o) => o.contentTypeInclude
            },
            {
                name: 'uriExcludes',
                inputValue: [
                    [],
                    ['exclude'],
                    undefined
                ],
                expectedValue: [
                    [''],
                    ['exclude'],
                    []
                ],
                extractFunction: (o) => o.uriExclude || []
            },
            {
                name: 'uriIncludes',
                inputValue: [
                    [],
                    ['include'],
                    undefined
                ],
                expectedValue: [
                    [
                        ''
                    ],
                    ['include'],
                    [
                        'text/',
                        'application/(xml|x-javascript)'
                    ]
                ],
                extractFunction: (o) => o.contentTypeInclude
            },
            {
                name: 'cpuSaver',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'cpuSaverHigh',
                inputValue: [undefined, 73, undefined],
                expectedValue: [90, 73, 90]
            },
            {
                name: 'cpuSaverLow',
                inputValue: [undefined, 13, undefined],
                expectedValue: [75, 13, 75]
            },
            {
                name: 'minimumSize',
                inputValue: [undefined, 2300, undefined],
                expectedValue: [1024, 2300, 1024]
            },
            {
                name: 'preferMethod',
                inputValue: [undefined, 'deflate', undefined],
                expectedValue: ['gzip', 'deflate', 'gzip']
            },
            {
                name: 'gzipLevel',
                inputValue: [undefined, 3, undefined],
                expectedValue: [1, 3, 1]
            },
            {
                name: 'gzipMemory',
                inputValue: [undefined, 16, undefined],
                expectedValue: [8192, 16384, 8192]
            },
            {
                name: 'gzipWindowSize',
                inputValue: [undefined, 32, undefined],
                expectedValue: [16384, 32768, 16384]
            },
            {
                name: 'keepAcceptEncoding',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'selective',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'varyHeader',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            }
        ];
        return assertHttpCompressClass(properties);
    });
});

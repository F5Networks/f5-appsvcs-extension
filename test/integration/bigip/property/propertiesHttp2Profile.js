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

describe('HTTP2_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertHttp2ProfileClass(properties) {
        return assertClass('HTTP2_Profile', properties);
    }

    it('All properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'An HTTP/2 Profile', undefined],
                expectedValue: ['none', 'An HTTP/2 Profile', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'activationMode',
                inputValue: [undefined, 'always', undefined],
                expectedValue: [['alpn'], ['always'], ['alpn']]
            },
            {
                name: 'concurrentStreamsPerConnection',
                inputValue: [undefined, 128, undefined],
                expectedValue: [10, 128, 10]
            },
            {
                name: 'connectionIdleTimeout',
                inputValue: [undefined, 6000, undefined],
                expectedValue: [300, 6000, 300]
            },
            {
                name: 'enforceTlsRequirements',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'frameSize',
                inputValue: [undefined, 16384, undefined],
                expectedValue: [2048, 16384, 2048]
            },
            {
                name: 'headerTableSize',
                inputValue: [undefined, 65535, undefined],
                expectedValue: [4096, 65535, 4096]
            },
            {
                name: 'includeContentLength',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'insertHeader',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'insertHeaderName',
                inputValue: [undefined, 'Not X-HTTP2', undefined],
                expectedValue: ['X-HTTP2', 'Not X-HTTP2', 'X-HTTP2']
            },
            {
                name: 'receiveWindow',
                inputValue: [undefined, 128, undefined],
                expectedValue: [32, 128, 32]
            },
            {
                name: 'writeSize',
                inputValue: [undefined, 32768, undefined],
                expectedValue: [16384, 32768, 16384]
            }
        ];
        return assertHttp2ProfileClass(properties);
    });
});

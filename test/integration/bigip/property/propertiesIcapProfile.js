/**
 * Copyright 2023 F5, Inc.
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

describe('ICAP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All properties', function () {
        const properties = [
            {
                name: 'uri',
                // eslint-disable-next-line no-template-curly-in-string
                inputValue: [undefined, 'icap://${SERVER_IP}:${SERVER_PORT}/videoOptimization', undefined],
                // eslint-disable-next-line no-template-curly-in-string
                expectedValue: ['none', 'icap://${SERVER_IP}:${SERVER_PORT}/videoOptimization', 'none'],
                extractFunction: (o) => o.uri || 'none'
            },
            {
                name: 'fromHeader',
                inputValue: [undefined, 'admin@example.com', undefined],
                expectedValue: ['none', 'admin@example.com', 'none'],
                extractFunction: (o) => o.headerFrom || 'none'
            },
            {
                name: 'hostHeader',
                inputValue: [undefined, 'www.example.com', undefined],
                expectedValue: ['none', 'www.example.com', 'none'],
                extractFunction: (o) => o.host || 'none'
            },
            {
                name: 'refererHeader',
                inputValue: [undefined, 'http://www.example.com/video/resource.html', undefined],
                expectedValue: ['none', 'http://www.example.com/video/resource.html', 'none'],
                extractFunction: (o) => o.referer || 'none'
            },
            {
                name: 'userAgentHeader',
                inputValue: [undefined, 'CERN-LineMode/2.15 libwww/2.17b3', undefined],
                expectedValue: ['none', 'CERN-LineMode/2.15 libwww/2.17b3', 'none'],
                extractFunction: (o) => o.userAgent || 'none'
            },
            {
                name: 'previewLength',
                inputValue: [undefined, 10, undefined],
                expectedValue: [0, 10, 0]
            }
        ];

        return assertClass('ICAP_Profile', properties);
    });
});

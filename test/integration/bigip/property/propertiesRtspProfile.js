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
    getProvisionedModules,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('RTSP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertRtspProfile(properties) {
        return assertClass('RTSP_Profile', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'This is a description', undefined],
                expectedValue: ['none', 'This is a description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'idleTimeout',
                inputValue: [undefined, 'immediate', undefined],
                expectedValue: ['300', 'immediate', '300']
            },
            {
                name: 'maxHeaderSize',
                inputValue: [undefined, 5096, undefined],
                expectedValue: [4096, 5096, 4096]
            },
            {
                name: 'maxQueuedData',
                inputValue: [undefined, 65536, undefined],
                expectedValue: [32768, 65536, 32768]
            },
            {
                name: 'unicastRedirect',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'multicastRedirect',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'sessionReconnect',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'realHTTPPersistence',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'checkSource',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'proxy',
                inputValue: [undefined, 'internal', undefined],
                expectedValue: ['none', 'internal', 'none']
            },
            {
                name: 'proxyHeader',
                inputValue: [undefined, 'X-Proxy', undefined],
                expectedValue: ['none', 'X-Proxy', 'none']
            },
            {
                name: 'RTPPort',
                inputValue: [undefined, 49152, undefined],
                expectedValue: [0, 49152, 0]
            },
            {
                name: 'RTCPPort',
                inputValue: [undefined, 49153, undefined],
                expectedValue: [0, 49153, 0]
            }
        ];

        if (getProvisionedModules().includes('cgnat')) {
            properties.push({
                name: 'algLogProfile',
                inputValue: [undefined, { use: 'algLogProfile' }, undefined],
                expectedValue: ['none', '/TEST_RTSP_Profile/Application/algLogProfile', 'none'],
                extractFunction: (o) => ((typeof o.logProfile === 'object') ? o.logProfile.fullPath : o.logProfile),
                referenceObjects: {
                    algLogProfile: {
                        class: 'ALG_Log_Profile'
                    }
                }
            });
            properties.push({
                name: 'logPublisher',
                inputValue: [undefined, { bigip: '/Common/local-db-publisher' }, undefined],
                expectedValue: ['none', '/Common/local-db-publisher', 'none'],
                extractFunction: (o) => ((typeof o.logPublisher === 'object') ? o.logPublisher.fullPath : o.logPublisher)
            });
        }

        return assertRtspProfile(properties);
    });
});

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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Splitsession_Client_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'title', 'value'],
                expectedValue: ['none', 'title', 'value']
            },
            {
                name: 'peerPort',
                inputValue: [80, 22, 443],
                expectedValue: [80, 22, 443]
            },
            {
                name: 'peerIp',
                inputValue: ['192.0.2.0', '192.0.2.1', '192.0.2.2'],
                expectedValue: ['192.0.2.0', '192.0.2.1', '192.0.2.2']
            },
            {
                name: 'localPeer',
                inputValue: [undefined, false, false],
                expectedValue: ['false', 'false', 'false']
            },
            {
                name: 'httpHeader',
                inputValue: [undefined, 'header', 'value'],
                expectedValue: ['none', 'header', 'value']
            },
            {
                name: 'sessionLookupType',
                inputValue: [undefined, 'flow', 'http-header'],
                expectedValue: ['flow', 'flow', 'http-header']
            }
        ];
        return assertClass('Splitsession_Client_Profile', properties);
    });
});

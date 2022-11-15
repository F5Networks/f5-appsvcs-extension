/**
 * Copyright 2022 F5 Networks, Inc.
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

describe('FTP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertFtpProfile(properties) {
        return assertClass('FTP_Profile', properties);
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
                name: 'port',
                inputValue: [undefined, 300, undefined],
                expectedValue: [20, 300, 20]
            },
            {
                name: 'ftpsMode',
                inputValue: [undefined, 'require', undefined],
                expectedValue: ['disallow', 'require', 'disallow']
            },
            {
                name: 'enforceTlsSessionReuseEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                minVersion: '14.0'
            },
            {
                name: 'activeModeEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                minVersion: '14.0'
            },
            {
                name: 'securityEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'translateExtendedEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'inheritParentProfileEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];

        return assertFtpProfile(properties);
    });
});

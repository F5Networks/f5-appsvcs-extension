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
    extractProfile,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Service_SCTP', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should be connected to a SCTP_Profile by default', () => {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'profileSCTP',
                inputValue: [undefined],
                expectedValue: ['sctp'],
                extractFunction: (virtual) => extractProfile(virtual, 'sctp')
            }
        ];
        return assertClass('Service_SCTP', properties);
    });
});

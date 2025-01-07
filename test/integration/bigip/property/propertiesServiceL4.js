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
    extractProfile,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Service_L4', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('with built in TCP Analytics profile', function () {
        assertModuleProvisioned.call(this, 'avr');

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
                name: 'profileAnalyticsTcp',
                inputValue: [undefined, { bigip: '/Common/tcp-analytics' }, undefined],
                expectedValue: [undefined, 'tcp-analytics', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'tcp-analytics')
            }
        ];
        return assertClass('Service_L4', properties);
    });
});

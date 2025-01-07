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

describe('Cipher_Group', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should handle Cipher_Group class', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'order',
                inputValue: [undefined, 'speed', undefined],
                expectedValue: ['default', 'speed', 'default'],
                extractFunction: (o) => o.ordering
            },
            {
                name: 'allowCipherRules',
                inputValue: [undefined, [{ bigip: '/Common/f5-secure' }], undefined],
                expectedValue: [
                    ['/Common/f5-default'],
                    ['/Common/f5-secure'],
                    ['/Common/f5-default']
                ],
                extractFunction: (o) => (o.allow || []).map((r) => `/${r.partition}/${r.name}`)
            },
            {
                name: 'requireCipherRules',
                inputValue: [undefined, [{ bigip: '/Common/f5-secure' }], undefined],
                expectedValue: [[], ['/Common/f5-secure'], []],
                extractFunction: (o) => (o.require || []).map((r) => `/${r.partition}/${r.name}`)
            },
            {
                name: 'excludeCipherRules',
                inputValue: [undefined, [{ use: '/TEST_Cipher_Group/Application/customRule' }], undefined],
                expectedValue: [[], ['/TEST_Cipher_Group/Application/customRule'], []],
                extractFunction: (o) => (o.exclude || []).map((r) => `/${r.partition}/${r.subPath}/${r.name}`),
                referenceObjects: {
                    customRule: {
                        class: 'Cipher_Rule',
                        cipherSuites: ['ECDHE_ECDSA']
                    }
                }
            }
        ];

        return assertClass('Cipher_Group', properties);
    });
});

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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('Cipher_Rule', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should handle Ciper_Rule class', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'The description', undefined],
                expectedValue: ['none', 'The description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'cipherSuites',
                inputValue: [
                    ['DEFAULT'],
                    [
                        'ECDHE',
                        'RSA',
                        'ECDHE_ECDSA',
                        '!SSLV3',
                        '!RC4',
                        '!EXP',
                        '!DES',
                        '!3DES'
                    ],
                    ['DEFAULT']
                ],
                expectedValue: [
                    'DEFAULT',
                    'ECDHE:RSA:ECDHE_ECDSA:!SSLV3:!RC4:!EXP:!DES:!3DES',
                    'DEFAULT'
                ],
                extractFunction: (o) => o.cipher
            },
            {
                name: 'namedGroups',
                inputValue: [
                    undefined,
                    [
                        'P256',
                        'P384'
                    ],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'P256:P384',
                    undefined
                ],
                extractFunction: (o) => o.dhGroups
            },
            {
                name: 'signatureAlgorithms',
                inputValue: [
                    undefined,
                    [
                        'DSA-SHA256',
                        'DSA-SHA512',
                        'ECDSA-SHA384'
                    ],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'DSA-SHA256:DSA-SHA512:ECDSA-SHA384',
                    undefined
                ]
            }
        ];

        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            properties.pop();
            properties.pop();
        }

        return assertClass('Cipher_Rule', properties);
    });
});

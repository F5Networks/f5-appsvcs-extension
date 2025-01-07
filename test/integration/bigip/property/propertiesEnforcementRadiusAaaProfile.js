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
    assertModuleProvisioned,
    createExtractSecret,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('Enforcement_Radius_AAA_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementRadiusAaaProfileClass(properties) {
        return assertClass('Enforcement_Radius_AAA_Profile', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        const secret = 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0';
        let secretExpected = '$M$';
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            secretExpected = true;
        }

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'parentProfile',
                inputValue: [
                    undefined,
                    {
                        use: 'radaaa'
                    },
                    undefined
                ],
                expectedValue: ['radiusaaa', 'radaaa', 'radiusaaa'],
                referenceObjects: {
                    radaaa: {
                        class: 'Enforcement_Radius_AAA_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'retransmissionTimeout',
                inputValue: [undefined, 50, undefined],
                expectedValue: [5, 50, 5]
            },
            {
                name: 'sharedSecret',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    undefined
                ],
                expectedValue: [false, secretExpected, false],
                extractFunction: createExtractSecret('sharedSecret', secret)
            },
            {
                name: 'password',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    },
                    undefined
                ],
                expectedValue: ['none', true, 'none'],
                extractFunction: (o) => {
                    if (o.password && o.password !== secret) {
                        return true;
                    }
                    return 'none';
                }
            },
            {
                name: 'transactionTimeout',
                inputValue: [undefined, 100, undefined],
                expectedValue: [30, 100, 30]
            }
        ];
        return assertEnforcementRadiusAaaProfileClass(properties);
    });
});

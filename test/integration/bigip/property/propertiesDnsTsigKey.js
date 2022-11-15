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
    createExtractSecret,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('DNS_TSIG_Key', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDnsTsigKeyClass(properties) {
        return assertClass('DNS_TSIG_Key', properties);
    }

    it('All properties', function () {
        const secret = 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0';
        let secretExpected = '$M$';
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            secretExpected = true;
        }

        const properties = [
            {
                name: 'algorithm',
                inputValue: [undefined, 'hmacsha1', undefined],
                expectedValue: ['hmacmd5', 'hmacsha1', 'hmacmd5']
            },
            {
                name: 'secret',
                inputValue: [
                    {
                        ciphertext: 'ZjVmNQ==',
                        miniJWE: true,
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true,
                        allowReuse: false
                    }
                ],
                expectedValue: [secretExpected],
                extractFunction: createExtractSecret('secret', secret)
            }
        ];
        return assertDnsTsigKeyClass(properties);
    });
});

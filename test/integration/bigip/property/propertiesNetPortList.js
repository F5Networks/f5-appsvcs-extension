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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('Net_Port_List', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertNetPortListClass(properties, options) {
        return assertClass('Net_Port_List', properties, options);
    }

    it('All Properties', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ports',
                inputValue: [
                    [8888],
                    [80, 443, '8080-8088'],
                    [8888]
                ],
                expectedValue: [
                    [{ name: '8888' }],
                    [
                        { name: '80' },
                        { name: '443' },
                        { name: '8080-8088' }
                    ],
                    [{ name: '8888' }]
                ],
                extractFunction: (o) => o.ports
            },
            {
                name: 'portLists',
                inputValue: [undefined, [{ use: 'portList' }], undefined],
                expectedValue: [undefined, 'portList', undefined],
                extractFunction: (o) => ((o.portLists || [])[0] || {}).name,
                referenceObjects: {
                    portList: {
                        class: 'Net_Port_List',
                        ports: ['1-999']
                    }
                }
            }
        ];

        return assertNetPortListClass(properties);
    });
});

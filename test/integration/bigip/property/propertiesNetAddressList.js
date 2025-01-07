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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('Net_Address_List', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertNetAddressListClass(properties, options) {
        return assertClass('Net_Address_List', properties, options);
    }

    const addresses = [
        '10.3.10.10-10.9.10.10',
        '192.0.2.0/24',
        '198.51.100.0/24',
        '2001:db8::/32'
    ];

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
                name: 'addresses',
                inputValue: [['203.0.113.0/24'], addresses, ['203.0.113.0/24']],
                expectedValue: [
                    [{ name: '203.0.113.0/24' }],
                    addresses.map((a) => ({ name: a })),
                    [{ name: '203.0.113.0/24' }]
                ]
            },
            {
                name: 'addressLists',
                inputValue: [undefined, [{ use: 'addressListChild' }], undefined],
                expectedValue: [undefined, 'addressListChild', undefined],
                extractFunction: (o) => ((o.addressLists || [])[0] || {}).name,
                referenceObjects: {
                    addressListChild: {
                        class: 'Net_Address_List',
                        addresses: ['203.0.113.0/24']
                    }
                }
            }
        ];

        return assertNetAddressListClass(properties);
    });

    it('Undefined Addresses', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }
        const properties = [
            {
                name: 'addresses',
                inputValue: [undefined, addresses, undefined],
                expectedValue: [undefined, addresses.map((a) => ({ name: a })), undefined]
            },
            {
                name: 'addressLists',
                inputValue: [[{ use: 'addressListChild' }], undefined, [{ use: 'addressListChild' }]],
                expectedValue: ['addressListChild', undefined, 'addressListChild'],
                extractFunction: (o) => ((o.addressLists || [])[0] || {}).name,
                referenceObjects: {
                    addressListChild: {
                        class: 'Net_Address_List',
                        addresses: ['203.0.113.0/24']
                    }
                }
            }
        ];

        return assertNetAddressListClass(properties);
    });
});

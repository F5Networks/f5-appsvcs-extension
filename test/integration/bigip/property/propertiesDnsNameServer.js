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

describe('DNS_Nameserver', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDnsNameserverClass(properties) {
        return assertClass('DNS_Nameserver', properties);
    }

    it('All properties', () => {
        const properties = [
            {
                name: 'address',
                inputValue: [undefined, '13.13.13.13', undefined],
                expectedValue: ['127.0.0.1', '13.13.13.13', '127.0.0.1']
            },
            {
                name: 'port',
                inputValue: [undefined, 177, undefined],
                expectedValue: [53, 177, 53]
            },
            {
                name: 'routeDomain',
                inputvalue: [undefined],
                expectedValue: ['/Common/0'],
                extractFunction: (o) => o.routeDomain.fullPath
            },
            {
                name: 'tsigKey',
                inputValue: [undefined, { use: 'tsigKey' }, undefined],
                expectedValue: [undefined, 'tsigKey', undefined],
                referenceObjects: {
                    tsigKey: {
                        class: 'DNS_TSIG_Key',
                        secret: {
                            ciphertext: 'ZjVmNQ==',
                            ignoreChanges: true
                        }
                    }
                },
                extractFunction: (o) => {
                    if (!o.tsigKey) {
                        return undefined;
                    }
                    return o.tsigKey.name;
                }
            }
        ];
        return assertDnsNameserverClass(properties);
    });
});

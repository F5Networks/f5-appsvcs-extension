/**
 * Copyright 2023 F5 Networks, Inc.
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

describe('SNAT_Translation', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertSnatTranslationClass(properties, options) {
        // SNAT_Translation is created at the Tenant level
        options.mcpPath = '/TEST_SNAT_Translation/';
        return assertClass('SNAT_Translation', properties, options);
    }

    it('All properties IPv4', () => {
        const options = {
            mcpObjectName: '192.0.2.1'
        };

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'A SNAT Translation', undefined],
                expectedValue: ['none', 'A SNAT Translation', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                // snat-translations have a fixed address
                name: 'address',
                inputValue: ['192.0.2.1'],
                expectedValue: ['192.0.2.1']
            },
            {
                name: 'adminState',
                inputValue: [undefined, 'disable', undefined],
                expectedValue: [true, false, true],
                extractFunction: (o) => o.enabled === true
            },
            {
                name: 'ipIdleTimeout',
                inputValue: [undefined, 1000, undefined],
                expectedValue: ['indefinite', 1000, 'indefinite']
            },
            {
                name: 'maxConnections',
                inputValue: [undefined, 10000, undefined],
                expectedValue: [0, 10000, 0]
            },
            {
                name: 'tcpIdleTimeout',
                inputValue: [undefined, 2000, undefined],
                expectedValue: ['indefinite', 2000, 'indefinite']
            },
            {
                name: 'trafficGroup',
                inputValue: [undefined, '/Common/traffic-group-local-only', undefined],
                expectedValue: ['/Common/traffic-group-1', '/Common/traffic-group-local-only', '/Common/traffic-group-1'],
                extractFunction: (o) => o.trafficGroup.fullPath
            },
            {
                name: 'udpIdleTimeout',
                inputValue: [undefined, 3000, undefined],
                expectedValue: ['indefinite', 3000, 'indefinite']
            }
        ];
        return assertSnatTranslationClass(properties, options);
    });

    it('All properties IPv6', () => {
        const options = {
            mcpObjectName: '2001:db8::1'
        };

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'A SNAT Translation', undefined],
                expectedValue: ['none', 'A SNAT Translation', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                // snat-translations have a fixed address
                name: 'address',
                inputValue: ['2001:db8:0000:0000:0000:0000:0000:0001'],
                expectedValue: ['2001:db8::1']
            },
            {
                name: 'adminState',
                inputValue: [undefined, 'disable', undefined],
                expectedValue: [true, false, true],
                extractFunction: (o) => o.enabled === true
            },
            {
                name: 'ipIdleTimeout',
                inputValue: [undefined, 1000, undefined],
                expectedValue: ['indefinite', 1000, 'indefinite']
            },
            {
                name: 'maxConnections',
                inputValue: [undefined, 10000, undefined],
                expectedValue: [0, 10000, 0]
            },
            {
                name: 'tcpIdleTimeout',
                inputValue: [undefined, 2000, undefined],
                expectedValue: ['indefinite', 2000, 'indefinite']
            },
            {
                name: 'trafficGroup',
                inputValue: [undefined, '/Common/traffic-group-local-only', undefined],
                expectedValue: ['/Common/traffic-group-1', '/Common/traffic-group-local-only', '/Common/traffic-group-1'],
                extractFunction: (o) => o.trafficGroup.fullPath
            },
            {
                name: 'udpIdleTimeout',
                inputValue: [undefined, 3000, undefined],
                expectedValue: ['indefinite', 3000, 'indefinite']
            }
        ];
        return assertSnatTranslationClass(properties, options);
    });
});

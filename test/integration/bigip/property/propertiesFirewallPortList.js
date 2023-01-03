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
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Firewall_Port_List', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertFirewallPortClass(properties, declarationCount) {
        return assertClass('Firewall_Port_List', properties, declarationCount);
    }

    const ports = [81, '90', '8080-8090'];

    it('All Properties', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ports',
                inputValue: [[80], ports, [80]],
                expectedValue: [
                    [{ name: '80' }],
                    ports.map((p) => ({ name: p.toString() })),
                    [{ name: '80' }]
                ]
            },
            {
                name: 'portLists',
                inputValue: [undefined, [{ use: 'portListChild' }], undefined],
                expectedValue: [undefined, 'portListChild', undefined],
                extractFunction: (o) => ((o.portLists || [])[0] || {}).name,
                referenceObjects: {
                    portListChild: {
                        class: 'Firewall_Port_List',
                        ports: [8100]
                    }
                }
            }
        ];

        return assertFirewallPortClass(properties, 3);
    });

    it('Undefined Ports', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'ports',
                inputValue: [undefined, ports, undefined],
                expectedValue: [undefined, ports.map((p) => ({ name: p.toString() })), undefined]
            },
            {
                name: 'portLists',
                inputValue: [[{ use: 'portListChild' }]],
                expectedValue: ['portListChild'],
                extractFunction: (o) => ((o.portLists || [])[0] || {}).name,
                referenceObjects: {
                    portListChild: {
                        class: 'Firewall_Port_List',
                        ports: [8100]
                    }
                }
            }
        ];

        return assertFirewallPortClass(properties, 3);
    });
});

/**
 * Copyright 2024 F5, Inc.
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
    createVlan,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Firewall_Rule_List', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertFirewallRuleListClass(properties, options) {
        return assertClass('Firewall_Rule_List', properties, options);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'afm');

        const testVlan = 'internal';
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'rules',
                inputValue: [
                    undefined,
                    [
                        {
                            remark: 'description',
                            name: 'theRule',
                            action: 'accept',
                            protocol: 'tcp',
                            source: {
                                addressLists: [
                                    {
                                        use: 'addList'
                                    }
                                ],
                                portLists: [
                                    {
                                        use: 'portList'
                                    }
                                ],
                                vlans: [
                                    {
                                        bigip: `/Common/${testVlan}`
                                    }
                                ]
                            },
                            destination: {
                                addressLists: [
                                    {
                                        use: 'addList'
                                    }
                                ],
                                portLists: [
                                    {
                                        use: 'portList'
                                    }
                                ]
                            },
                            loggingEnabled: true,
                            iRule: {
                                use: 'irule'
                            },
                            iRuleSampleRate: 100
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            action: 'accept',
                            description: 'description',
                            destination: {
                                addressLists: [
                                    '/TEST_Firewall_Rule_List/Application/addList'
                                ],
                                portLists: [
                                    '/TEST_Firewall_Rule_List/Application/portList'
                                ]
                            },
                            fullPath: 'theRule',
                            ipProtocol: 'tcp',
                            irule: '/TEST_Firewall_Rule_List/Application/irule',
                            iruleSampleRate: 100,
                            log: 'yes',
                            name: 'theRule',
                            source: {
                                addressLists: [
                                    '/TEST_Firewall_Rule_List/Application/addList'
                                ],
                                identity: {},
                                portLists: [
                                    '/TEST_Firewall_Rule_List/Application/portList'
                                ],
                                vlans: [
                                    `/Common/${testVlan}`
                                ]
                            },
                            status: 'enabled'
                        }
                    ],
                    []
                ],
                referenceObjects: {
                    addList: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '1.3.5.7'
                        ]
                    },
                    portList: {
                        class: 'Firewall_Port_List',
                        ports: [
                            100
                        ]
                    },
                    irule: {
                        class: 'iRule',
                        iRule: {
                            base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICN0aW1lb3V0dmFsdWUgaXMgaG93IGxvbmcgcmVxdWVzdHMgc3RheSBpbiB0aGUgYXV0aCBhdHRlbXB0cyB0YWJsZQ0KIHNldCB0aW1lb3V0dmFsdWUgMzANCiAjbWF4YXR0ZW1wdHMgaXMgdGhlIG51bWJlciBvZiByZXF1ZXN0cyB0aGF0IGNhbiBoYXBwZW4gd2l0aGluIHRoZSB0aW1lb3V0dmFsdWUgYmVmb3JlIGJlaW5nIHNodW5uZWQNCiBzZXQgbWF4YXR0ZW1wdHMgMjANCiAjc2h1bnRpbWVvdXQgaXMgdGhlIHRpbWUgdGhhdCB0aGUgc291cmNlIElQIHdpbGwgYmUgYmxvY2tlZCBvbmNlIGl0IGdldHMgc2h1bm5lZA0KIHNldCBzaHVudGltZW91dCA2MA0KIA0KICNyZXNldCBldmVyeSByZXF1ZXN0IGlmIGluIHNodW4gdGFibGUNCiBpZiB7IFt0YWJsZSBsb29rdXAgLXN1YnRhYmxlICJzaHVuIiBbSVA6OmNsaWVudF9hZGRyXV0gPiAwIH0gew0KICB0YWJsZSBpbmNyIC1zdWJ0YWJsZSAic2h1biIgW0lQOjpjbGllbnRfYWRkcl0NCiAgc2V0IHRvdGFsZHJvcHMgW3RhYmxlIGxvb2t1cCAtc3VidGFibGUgInNodW4iIFtJUDo6Y2xpZW50X2FkZHJdXQ0KICByZWplY3QNCiAgI2xvZyBsb2NhbDAuICJTSFVOIC0gUmVzZXQgY29ubmVjdGlvbiBmcm9tIFtJUDo6Y2xpZW50X2FkZHJdIC0gVG90YWw6ICR0b3RhbGRyb3BzIg0KICByZXR1cm4NCiB9DQogDQogaWYgeyAoIFtzdHJpbmcgdG9sb3dlciBbSFRUUDo6dXJpXV0gZXF1YWxzICIvYXV0aC9sb2dpbiIgKSB9IHsNCiAgI3BsYWNlaG9sZGVyLSBzZW5kIGJhY2sgZmFrZSBhdXRoIHJlc3BvbnNlIGlmIGluIHNodW4gdGFibGUNCiANCiAgI2NyZWF0ZSBsYXJnZSByYW5kb20gbnVtYmVyIHRvIGFjdCBhcyBhbiBhcHByb3ggdW5pcXVlIGtleSAtIGtleSBjb2xsaXNpb25zIGFyZSBub3QgdG9vIGRldHJpbWVudGFsDQogIHNldCByYW5ka2V5IFtleHByIHsgaW50KDEwMDAwMDAwMCAqIHJhbmQoKSkgfSBdDQogICNsb2cgbG9jYWwwLiAiVVJJIG1hdGNoOiBjcmVhdGVkIHJhbmRvbSBrZXkgJHJhbmRrZXksIGFkZGluZyB0byBzdWJ0YWJsZSBmb3IgW0lQOjpjbGllbnRfYWRkcl0iDQogIHRhYmxlIHNldCAtc3VidGFibGUgW0lQOjpjbGllbnRfYWRkcl0gJHJhbmRrZXkgMSAkdGltZW91dHZhbHVlDQogDQogIGlmIHsgW3RhYmxlIGtleXMgLXN1YnRhYmxlIFtJUDo6Y2xpZW50X2FkZHJdIC1jb3VudF0gPiAkbWF4YXR0ZW1wdHN9IHsNCiAgICBsb2cgbG9jYWwwLiAiYXV0aCByYXRlIGV4Y2VlZGVkIGZvciBbSVA6OmNsaWVudF9hZGRyXSwgYWRkaW5nIElQIHRvIHNodW4gdGFibGUuIFdpbGwgdW5ibG9jayBpZiBubyBuZXcgY29ubnMgZm9yICRzaHVudGltZW91dCBzZWNvbmRzIg0KICAgICNhZGQgc291cmNlIElQIHRvIHRoZSBzaHVuIHRhYmxlIHdpdGggdmFsdWUgb2YgMQ0KICAgICNub3RlLCB0aGlzIHNwZWNpZmljIHJlcXVlc3Qgd2FzIG5vdCBibG9ja2VkLCBidXQgbmV3IGNvbm5lY3Rpb25zIGZyb20gc2FtZSBzcmMgSVAgd2lsbCBiZSBibG9ja2VkIG9uIG5leHQgcmVxdWVzdA0KICAgIHRhYmxlIHNldCAtc3VidGFibGUgInNodW4iIFtJUDo6Y2xpZW50X2FkZHJdIDEgJHNodW50aW1lb3V0DQogIH0NCiB9DQp9'
                        }
                    }
                },
                extractFunction: (o) => {
                    const rules = o.rules;
                    rules.forEach((rule) => {
                        if (rule.destination && rule.destination.addressLists) {
                            delete rule.destination.addressListsReference;
                        }
                        if (rule.destination && rule.destination.portLists) {
                            delete rule.destination.portListsReference;
                        }
                        delete rule.kind;
                        delete rule.generation;
                        delete rule.selfLink;
                        delete rule.ruleNumber;
                        if (rule.source && rule.source.addressLists) {
                            delete rule.source.addressListsReference;
                        }
                        if (rule.source && rule.source.portLists) {
                            delete rule.source.portListsReference;
                        }
                        if (rule.source && rule.source.vlans) {
                            delete rule.source.vlansReference;
                        }
                    });
                    return rules;
                }
            }
        ];

        return Promise.resolve()
            .then(() => {
                if (process.env.DRY_RUN !== 'true') {
                    return createVlan(testVlan);
                }
                return Promise.resolve();
            })
            .then(() => assertFirewallRuleListClass(properties));
    });
});

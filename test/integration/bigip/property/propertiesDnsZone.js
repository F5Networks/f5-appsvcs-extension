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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('DNS_Zone', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDnsZoneProfile(properties, options) {
        return assertClass('DNS_Zone', properties, options);
    }

    it('All properties', function () {
        const prefix = '/TEST_DNS_Zone/Application/';
        // DNS zone name max length is 77 characters
        const maxPathLength = 77 + prefix.length;

        const properties = [
            {
                name: 'dnsExpress',
                inputValue: [
                    undefined,
                    {
                        enabled: false,
                        nameserver: {
                            use: 'nameServer'
                        },
                        notifyAction: 'bypass',
                        allowNotifyFrom: [
                            '1.1.1.1'
                        ],
                        verifyNotifyTsig: false
                    },
                    undefined
                ],
                expectedValue: [
                    {
                        dnsExpressEnabled: 'yes',
                        dnsExpressNotifyAction: 'consume',
                        dnsExpressNotifyTsigVerify: 'yes'
                    },
                    {
                        dnsExpressEnabled: 'no',
                        dnsExpressNotifyAction: 'bypass',
                        dnsExpressNotifyTsigVerify: 'no',
                        dnsExpressServer: 'nameServer',
                        dnsExpressAllowNotify: [
                            '1.1.1.1'
                        ]
                    },
                    {
                        dnsExpressEnabled: 'yes',
                        dnsExpressNotifyAction: 'consume',
                        dnsExpressNotifyTsigVerify: 'yes'
                    }
                ],
                extractFunction: (o) => {
                    const results = {
                        dnsExpressEnabled: o.dnsExpressEnabled,
                        dnsExpressNotifyAction: o.dnsExpressNotifyAction,
                        dnsExpressNotifyTsigVerify: o.dnsExpressNotifyTsigVerify
                    };

                    if (o.dnsExpressServer) {
                        results.dnsExpressServer = o.dnsExpressServer.name;
                    }
                    if (o.dnsExpressAllowNotify) {
                        results.dnsExpressAllowNotify = o.dnsExpressAllowNotify;
                    }

                    return results;
                },
                referenceObjects: {
                    nameServer: {
                        class: 'DNS_Nameserver'
                    }
                }
            },
            {
                name: 'responsePolicyEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no'],
                extractFunction: (o) => o.responsePolicy
            },
            {
                name: 'serverTsigKey',
                inputValue: [undefined, { use: 'tsigKey' }, undefined],
                expectedValue: [undefined, 'tsigKey', undefined],
                extractFunction: (o) => {
                    const results = (o.serverTsigKey) ? o.serverTsigKey.name : undefined;
                    return results;
                },
                referenceObjects: {
                    tsigKey: {
                        class: 'DNS_TSIG_Key',
                        secret: {
                            ciphertext: 'ZjVmNQ==',
                            ignoreChanges: true
                        }
                    }
                }
            },
            {
                name: 'transferClients',
                inputValue: [undefined,
                    [
                        {
                            use: 'nameServer'
                        }
                    ],
                    undefined
                ],
                expectedValue: [[], ['nameServer'], []],
                extractFunction: (o) => {
                    const clients = [];
                    if (o.transferClients) {
                        o.transferClients.forEach((client) => {
                            clients.push(client.name);
                        });
                    }
                    return clients;
                }
            }
        ];

        return assertDnsZoneProfile(properties, { maxPathLength });
    });
});

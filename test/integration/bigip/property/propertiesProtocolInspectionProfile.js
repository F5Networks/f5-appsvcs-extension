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
    getBigIpVersion,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('Protocol_Inspection_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should handle 14.0+ properties', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            this.skip();
        }
        // Since we have proto_insp feature flag enabled in Azure,
        // so we want to test it only in Azure for now.
        if (process.env.TEST_IN_AZURE === undefined || process.env.TEST_IN_AZURE === 'false') {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'autoAddNewInspections',
                inputValue: [undefined, true, undefined],
                expectedValue: ['off', 'on', 'off'],
                extractFunction: (o) => o.autoAddNewInspections
            },
            {
                name: 'autoPublish',
                inputValue: [undefined, true, undefined],
                expectedValue: ['off', 'on', 'off'],
                extractFunction: (o) => o.autoPublishSuggestion
            }
        ];
        return assertClass('Protocol_Inspection_Profile', properties);
    });

    it('should handle Protocol_Inspection_Profile class', function () {
        // Since we have proto_insp feature flag enabled in Azure,
        // so we want to test it only in Azure for now.
        if (process.env.TEST_IN_AZURE === undefined || process.env.TEST_IN_AZURE === 'false') {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'The description', undefined],
                expectedValue: [undefined, 'The description', undefined],
                extractFunction: (o) => o.description
            },
            {
                name: 'collectAVRStats',
                inputValue: [undefined, false, undefined],
                expectedValue: ['on', 'off', 'on'],
                extractFunction: (o) => o.avrStatCollect
            },
            {
                name: 'enableComplianceChecks',
                inputValue: [undefined, false, undefined],
                expectedValue: ['on', 'off', 'on'],
                extractFunction: (o) => o.complianceEnable
            },
            {
                name: 'enableSignatureChecks',
                inputValue: [undefined, false, undefined],
                expectedValue: ['on', 'off', 'on'],
                extractFunction: (o) => o.signatureEnable
            },
            {
                name: 'services',
                inputValue: [
                    // 1: larger services block
                    [{
                        type: 'dns',
                        compliance: [
                            {
                                check: 'dns_maximum_reply_length',
                                value: '1024'
                            },
                            {
                                check: 'dns_disallowed_query_type',
                                action: 'reject',
                                log: true,
                                value: 'QUERY NOTIFY'
                            }
                        ],
                        signature: [
                            {
                                check: 'dns_blacklist_dns_reverse_lookup_response_for_known_malware_domain_spheral_ru_win_trojan_glupteba'
                            },
                            {
                                check: 'dns_dns_query_amplification_attempt',
                                action: 'reject',
                                log: true
                            }
                        ],
                        ports: [123]
                    },
                    {
                        type: 'mysql',
                        compliance: [{ check: 'mysql_malformed_packet' }]
                    }
                    ],
                    // 2: partial services block
                    [{
                        type: 'dns',
                        compliance: [
                            {
                                check: 'dns_maximum_reply_length',
                                action: 'reject',
                                value: '1024'
                            }
                        ]
                    }],
                    // 3: no services block
                    undefined],
                expectedValue: [
                    // 1: larger services block
                    [{
                        compliance: [
                            {
                                action: 'reject',
                                log: 'yes',
                                name: 'dns_disallowed_query_type',
                                partition: 'Common',
                                value: 'QUERY NOTIFY'
                            },
                            {
                                action: 'accept',
                                log: 'yes',
                                name: 'dns_maximum_reply_length',
                                partition: 'Common',
                                value: '1024'
                            }
                        ],
                        name: 'dns',
                        partition: 'Common',
                        ports: [
                            {
                                name: '123'
                            }
                        ],
                        signature: [
                            {
                                action: 'accept',
                                log: 'yes',
                                name: 'dns_blacklist_dns_reverse_lookup_response_for_known_malware_domain_spheral_ru_win_trojan_glupteba',
                                partition: 'Common'
                            },
                            {
                                action: 'reject',
                                log: 'yes',
                                name: 'dns_dns_query_amplification_attempt',
                                partition: 'Common'
                            }
                        ],
                        status: 'enabled'
                    },
                    {
                        compliance: [
                            {
                                action: 'accept',
                                log: 'yes',
                                name: 'mysql_malformed_packet',
                                partition: 'Common',
                                value: ''
                            }
                        ],
                        name: 'mysql',
                        partition: 'Common',
                        ports: [
                            {
                                name: '3306'
                            }
                        ],
                        status: 'enabled'
                    }],
                    // 2: partial services block
                    [{
                        compliance: [
                            {
                                action: 'reject',
                                log: 'yes',
                                name: 'dns_maximum_reply_length',
                                partition: 'Common',
                                value: '1024'
                            }
                        ],
                        name: 'dns',
                        partition: 'Common',
                        ports: [
                            {
                                name: '53'
                            }
                        ],
                        status: 'enabled'
                    }],
                    // 3: no services block
                    []
                ],
                extractFunction: (o) => {
                    // remove items from o.services that are non-deterministic / may change between BIG-IP versions
                    (o.services || []).forEach((service) => {
                        ['signature', 'compliance'].forEach((checkType) => {
                            (service[checkType] || []).forEach((check) => {
                                delete check.nameReference;
                                delete check.id;
                            });
                        });
                        delete service.nameReference;
                    });

                    return o.services || [];
                }
            }
        ];

        return assertClass('Protocol_Inspection_Profile', properties);
    });
});

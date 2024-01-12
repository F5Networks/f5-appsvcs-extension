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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

describe('Enforcement_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementPolicyClass(properties) {
        return assertClass('Enforcement_Policy', properties);
    }

    // TODO: Enable flowInfoFilters.sourceVlan when creation of VLANs supported
    // TODO: Remove skip when bug #867 is resolved
    it('All properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        // TODO: AUTOTOOL-1104
        if (!util.versionLessThan(getBigIpVersion(), '15.1')) {
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
                name: 'allTransactions',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'rules',
                inputValue: [
                    [],
                    [
                        {

                            name: 'theRule1',
                            precedence: 12345,
                            dscpMarkingDownlink: 12,
                            dscpMarkingUplink: 12,
                            gateStatusEnabled: true,
                            interceptionEndpoint: {
                                use: 'interceptEndpoint'
                            },
                            l2MarkingDownlink: 2,
                            l2MarkingUplink: 2,
                            qosBandwidthControllerUplink: {
                                policy: {
                                    use: 'bandwidth'
                                },
                                category: 'web'
                            },
                            qosBandwidthControllerDownlink: {
                                policy: {
                                    use: 'bandwidth'
                                },
                                category: 'web'
                            },
                            serviceChain: {
                                use: 'servChain'
                            },
                            tcpAnalyticsEnabled: true,
                            tcpOptimizationDownlink: {
                                use: 'tcpProf'
                            },
                            tcpOptimizationUplink: {
                                use: 'tcpProf'
                            },
                            classificationFilters: [
                                {
                                    name: 'filter',
                                    application: {
                                        bigip: '/Common/acrobat'
                                    },
                                    invertMatch: true
                                }
                            ],
                            flowInfoFilters: [
                                {
                                    name: 'flow',
                                    invertMatch: true,
                                    dscpMarking: 0,
                                    destinationAddress: '5.6.7.8',
                                    destinationPort: 8080,
                                    /* sourceVlan: {

                                    }, */
                                    sourceAddress: '5.6.7.9',
                                    sourcePort: 8081,
                                    protocol: 'tcp',
                                    ipAddressType: 'ipv4'
                                }
                            ],
                            forwarding: {
                                type: 'route-to-network',
                                fallbackAction: 'continue'
                            },
                            insertContent: {
                                duration: 5,
                                frequency: 'once-every',
                                position: 'prepend',
                                tagName: 'testTag',
                                valueContent: 'testContent',
                                valueType: 'tcl-snippet'
                            },
                            modifyHttpHeader: {
                                headerName: 'testHeaderName',
                                operation: 'insert',
                                valueContent: 'testContent',
                                valueType: 'tcl-snippet'
                            },
                            qoeReporting: {
                                highSpeedLogPublisher: {
                                    use: 'logPub'
                                },
                                formatScript: {
                                    use: 'format'
                                }
                            },
                            quota: {
                                reportingLevel: 'service-id'
                            },
                            ranCongestion: {
                                threshold: 2500,
                                reportDestinationHsl: {
                                    highSpeedLogPublisher: {
                                        use: 'logPub'
                                    },
                                    formatScript: {
                                        use: 'format'
                                    }
                                }
                            },
                            usageReporting: {
                                destination: 'gx',
                                applicationReportingEnabled: true,
                                monitoringKey: 'testMonitoringKey',
                                granularity: 'session',
                                interval: 0,
                                volume: {
                                    downlink: 80000000,
                                    total: 1000000000,
                                    uplink: 80000000
                                }
                            },
                            urlCategorizationFilters: [
                                {
                                    name: 'testUrlFilter',
                                    category: {
                                        bigip: '/Common/Music'
                                    },
                                    invertMatch: true
                                }
                            ]
                        },
                        {
                            name: 'theRule2',
                            precedence: 10,
                            DTOSTethering: {
                                detectDtos: true,
                                detectTethering: true,
                                reportDestinationHsl: {
                                    highSpeedLogPublisher: {
                                        use: 'logPub'
                                    },
                                    formatScript: {
                                        use: 'format'
                                    }
                                }
                            }
                        }
                    ],
                    []
                ],
                expectedValue: [
                    [],
                    [
                        {
                            classificationFilters: [
                                {
                                    application: '/Common/acrobat',
                                    name: 'filter',
                                    operation: 'nomatch'
                                }
                            ],
                            dscpMarkingDownlink: '12',
                            dscpMarkingUplink: '12',
                            flowInfoFilters: [
                                {
                                    dscpCode: '0',
                                    dstIpAddr: '5.6.7.8/32',
                                    dstPort: 8080,
                                    ipAddrType: 'IPv4',
                                    l2Endpoint: 'disabled',
                                    name: 'flow',
                                    operation: 'nomatch',
                                    proto: 'tcp',
                                    srcIpAddr: '5.6.7.9/32',
                                    srcPort: 8081
                                }
                            ],
                            forwarding: {
                                fallbackAction: 'continue',
                                icapType: 'none',
                                type: 'route-to-network'
                            },
                            gateStatus: 'enabled',
                            httpRedirect: {
                                fallbackAction: 'drop'
                            },
                            insertContent: {
                                duration: 5,
                                frequency: 'once-every',
                                position: 'prepend',
                                tagName: 'testTag',
                                valueContent: 'testContent',
                                valueType: 'tcl-snippet'
                            },
                            intercept: {
                                name: 'interceptEndpoint'
                            },
                            l2MarkingDownlink: '2',
                            l2MarkingUplink: '2',
                            modifyHttpHdr: {
                                operation: 'insert',
                                tmName: 'testHeaderName',
                                valueContent: 'testContent',
                                valueType: 'tcl-snippet'
                            },
                            name: 'theRule1',
                            precedence: 12345,
                            qoeReporting: {
                                dest: {
                                    hsl: {
                                        formatScript: '/TEST_Enforcement_Policy/Application/format',
                                        publisher: '/TEST_Enforcement_Policy/Application/logPub'
                                    }
                                }
                            },
                            qosRatePirDownlink: '/TEST_Enforcement_Policy/Application/bandwidth->web',
                            qosRatePirUplink: '/TEST_Enforcement_Policy/Application/bandwidth->web',
                            quota: {
                                reportingLevel: 'service-id'
                            },
                            ranCongestion: {
                                detect: 'enabled',
                                lowerthresholdBw: 2500,
                                report: {
                                    dest: {
                                        hsl: {
                                            formatScript: '/TEST_Enforcement_Policy/Application/format',
                                            publisher: '/TEST_Enforcement_Policy/Application/logPub'
                                        }
                                    }
                                }
                            },
                            reporting: {
                                dest: {
                                    gx: {
                                        applicationReporting: 'enabled',
                                        monitoringKey: 'testMonitoringKey'
                                    },
                                    hsl: {},
                                    radiusAccounting: {},
                                    sd: {
                                        applicationReporting: 'disabled'
                                    }
                                },
                                granularity: 'session',
                                interval: 0,
                                transaction: {
                                    http: {
                                        hostnameLen: 0,
                                        uriLen: 256,
                                        userAgentLen: 0
                                    }
                                },
                                volume: {
                                    downlink: 80000000,
                                    total: 1000000000,
                                    uplink: 80000000
                                }
                            },
                            serviceChain: {
                                name: 'servChain'
                            },
                            tcpAnalyticsEnable: 'enabled',
                            tcpOptimizationDownlink: {
                                name: 'tcpProf'
                            },
                            tcpOptimizationUplink: {
                                name: 'tcpProf'
                            },
                            urlCategorizationFilters: [
                                {
                                    name: 'testUrlFilter',
                                    operation: 'nomatch',
                                    urlCategory: '/Common/Music'
                                }
                            ]
                        },
                        {
                            name: 'theRule2',
                            precedence: 10,
                            DTOSTethering: {
                                dtosDetect: 'enabled',
                                report: {
                                    dest: {
                                        hsl: {
                                            formatScript: '/TEST_Enforcement_Policy/Application/format',
                                            publisher: '/TEST_Enforcement_Policy/Application/logPub'
                                        }
                                    }
                                },
                                tetheringDetect: 'enabled'
                            }
                        }
                    ],
                    []
                ],
                referenceObjects: {
                    interceptEndpoint: {
                        class: 'Enforcement_Interception_Endpoint',
                        pool: {
                            use: 'thePool'
                        }
                    },
                    thePool: {
                        class: 'Pool'
                    },
                    tcpProf: {
                        class: 'TCP_Profile'
                    },
                    servChain: {
                        class: 'Enforcement_Service_Chain_Endpoint'
                    },
                    bandwidth: {
                        class: 'Bandwidth_Control_Policy',
                        dynamicControlEnabled: true,
                        maxBandwidth: 10,
                        maxUserBandwidth: 10,
                        maxUserPPS: 1,
                        maxUserPPSUnit: 'Gpps',
                        loggingEnabled: true,
                        logPublisher: {
                            bigip: '/Common/local-db-publisher'
                        },
                        logPeriod: 1000,
                        markIP: 0,
                        markL2: 0,
                        categories: [
                            {
                                name: 'web',
                                maxBandwidth: 50,
                                maxBandwidthUnit: '%',
                                markIP: 1,
                                markL2: 1
                            }
                        ]
                    },
                    logPub: {
                        class: 'Log_Publisher',
                        destinations: [
                            {
                                use: 'logDest'
                            }
                        ]
                    },
                    logDest: {
                        class: 'Log_Destination',
                        type: 'remote-syslog',
                        remoteHighSpeedLog: {
                            use: 'highSpeedLog'
                        }
                    },
                    highSpeedLog: {
                        class: 'Log_Destination',
                        type: 'remote-high-speed-log',
                        pool: {
                            use: 'thePool'
                        }
                    },
                    format: {
                        class: 'Enforcement_Format_Script',
                        definition: 'set theString \\"some string\\"'
                    }
                },
                extractFunction: (o) => {
                    const result = [];
                    if (o.rules && o.rules[0]) {
                        delete o.rules[0].fullPath;
                        delete o.rules[0].generation;
                        delete o.rules[0].kind;
                        delete o.rules[0].selfLink;
                        delete o.rules[0].classificationFilters[0].applicationReference;
                        delete o.rules[0].dtosTethering;
                        delete o.rules[0].flowInfoFilters[0].fullPath;
                        delete o.rules[0].flowInfoFilters[0].generation;
                        delete o.rules[0].flowInfoFilters[0].kind;
                        delete o.rules[0].flowInfoFilters[0].selfLink;
                        delete o.rules[0].flowInfoFiltersReference;
                        if (o.rules[0].intercept) {
                            o.rules[0].intercept = { name: o.rules[0].intercept.name };
                        }
                        delete o.rules[0].interceptReference;
                        delete o.rules[0].qoeReporting.dest.hsl.formatScriptReference;
                        delete o.rules[0].qoeReporting.dest.hsl.publisherReference;
                        delete o.rules[0].ranCongestion.report.dest.hsl.formatScriptReference;
                        delete o.rules[0].ranCongestion.report.dest.hsl.publisherReference;
                        delete o.rules[0].tcpOptimizationDownlinkReference;
                        delete o.rules[0].tcpOptimizationUplinkReference;
                        o.rules[0].tcpOptimizationDownlink = { name: o.rules[0].tcpOptimizationDownlink.name };
                        o.rules[0].tcpOptimizationUplink = { name: o.rules[0].tcpOptimizationUplink.name };
                        delete o.rules[0].serviceChainReference;
                        if (o.rules[0].serviceChain) {
                            o.rules[0].serviceChain = { name: o.rules[0].serviceChain.name };
                        }
                        delete o.rules[0].urlCategorizationFilters[0].urlCategoryReference;
                        delete o.rules[0].sfcAction;
                        result.push(o.rules[0]);
                    }

                    if (o.rules && o.rules[1]) {
                        const rule2 = {};
                        rule2.name = o.rules[1].name;
                        rule2.precedence = o.rules[1].precedence;
                        rule2.DTOSTethering = o.rules[1].dtosTethering;
                        delete rule2.DTOSTethering.report.dest.hsl.formatScriptReference;
                        delete rule2.DTOSTethering.report.dest.hsl.publisherReference;
                        result.push(rule2);
                    }

                    return result;
                }
            }
        ];

        if (util.versionLessThan(getBigIpVersion(), '14.1.2.8') || !util.versionLessThan(getBigIpVersion(), '15.0')) {
            properties.push(
                {
                    name: 'enable',
                    inputValue: [undefined, false, undefined],
                    expectedValue: ['enabled', 'disabled', 'enabled']
                }
            );
        } else {
            properties.push(
                {
                    name: 'enable',
                    inputValue: [undefined],
                    expectedValue: ['enabled']
                }
            );
        }

        return assertEnforcementPolicyClass(properties);
    });

    it('Tcl Filter', function () {
        assertModuleProvisioned.call(this, 'pem');

        const properties = [
            {
                name: 'rules',
                inputValue: [
                    [
                        {
                            name: 'theRule',
                            precedence: 12345,
                            tclFilter: 'set string "Hello World";'
                        }
                    ]
                ],
                expectedValue: [
                    {
                        name: 'theRule',
                        precedence: 12345,
                        tclFilter: 'set string "Hello World";'
                    }
                ],
                extractFunction: (o) => {
                    const result = {
                        name: o.rules[0].name,
                        precedence: o.rules[0].precedence,
                        tclFilter: o.rules[0].tclFilter
                    };
                    return result;
                }
            }
        ];
        return assertEnforcementPolicyClass(properties);
    });
});

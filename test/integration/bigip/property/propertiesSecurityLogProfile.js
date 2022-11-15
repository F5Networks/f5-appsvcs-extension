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
    assertModuleProvisioned,
    getProvisionedModules,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

describe('Security_Log_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertSecurityLogProfile(properties) {
        return assertClass('Security_Log_Profile', properties);
    }

    /* TODO: Enable dosApplication.remotePublisher property test if we ever support
    creating splunk or arcsight Log Publishers */
    it('All properties', function () {
        assertModuleProvisioned.call(this, 'asm');
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            }
        ];

        if (getProvisionedModules().includes('asm')) {
            properties.push(
                {
                    name: 'dosApplication',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'dosApplication.localPublisher',
                    inputValue: [undefined, { bigip: '/Common/local-db-publisher' }, undefined],
                    expectedValue: [undefined, '/Common/local-db-publisher', undefined],
                    extractFunction: (o) => o.dosApplication[0].localPublisher
                }
                /* {
                    name: 'dosApplication.remotePublisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: o => o.dosApplication[0].remotePublisher
                }, */
            );
        }

        if (getProvisionedModules().includes('afm')) {
            properties.push(
                {
                    name: 'classification',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'classification.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    referenceObjects: {
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
                                use: 'highSpeed'
                            }
                        },
                        highSpeed: {
                            class: 'Log_Destination',
                            type: 'remote-high-speed-log',
                            pool: {
                                use: 'thePool'
                            }
                        },
                        thePool: {
                            class: 'Pool'
                        }
                    }
                },
                {
                    name: 'classification.logAllMatches',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'dosNetwork',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'dosNetwork.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => {
                        const result = (o.dosNetworkPublisher) ? o.dosNetworkPublisher.fullPath : undefined;
                        return result;
                    }
                },
                {
                    name: 'ipIntelligence',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'ipIntelligence.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined]
                },
                {
                    name: 'ipIntelligence.logTranslationFields',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'ipIntelligence.rateLimitAggregate',
                    inputValue: [undefined, 100000, undefined],
                    expectedValue: [4294967295, 100000, 4294967295]
                },
                {
                    name: 'nat',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'nat.publisher',
                    inputValue: [{ use: 'logPub' }],
                    expectedValue: ['/TEST_Security_Log_Profile/Application/logPub']
                },
                {
                    name: 'nat.logErrors',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'nat.logQuotaExceeded',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'nat.logStartInboundSession',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'nat.logEndInboundSession',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'nat.logStartOutboundSession',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.nat.startOutboundSession.action
                },
                {
                    name: 'nat.logEndOutboundSession',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.nat.endOutboundSession.action
                },
                {
                    name: 'network',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'network.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => {
                        const result = (o.network[0].publisher) ? o.network[0].publisher.fullPath : undefined;
                        return result;
                    }
                },
                {
                    name: 'network.logRuleMatchAccepts',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logAclMatchAccept
                },
                {
                    name: 'network.logRuleMatchDrops',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logAclMatchDrop
                },
                {
                    name: 'network.logRuleMatchRejects',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logAclMatchReject
                },
                {
                    name: 'network.logIpErrors',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logIpErrors
                },
                {
                    name: 'network.logTcpErrors',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logTcpErrors
                },
                {
                    name: 'network.logTcpEvents',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logTcpEvents
                },
                {
                    name: 'network.logTranslationFields',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logTranslationFields
                },
                {
                    name: 'network.alwaysLogRegion',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.network[0].filter.logGeoAlways
                },
                {
                    name: 'network.rateLimitRuleMatchAccepts',
                    inputValue: [undefined, 10000, undefined],
                    expectedValue: [4294967295, 10000, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.aclMatchAccept
                },
                {
                    name: 'network.rateLimitRuleMatchDrops',
                    inputValue: [undefined, 1000, undefined],
                    expectedValue: [4294967295, 1000, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.aclMatchDrop
                },
                {
                    name: 'network.rateLimitRuleMatchRejects',
                    inputValue: [undefined, 123, undefined],
                    expectedValue: [4294967295, 123, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.aclMatchReject
                },
                {
                    name: 'network.rateLimitIpErrors',
                    inputValue: [undefined, 1234, undefined],
                    expectedValue: [4294967295, 1234, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.ipErrors
                },
                {
                    name: 'network.rateLimitTcpErrors',
                    inputValue: [undefined, 12345, undefined],
                    expectedValue: [4294967295, 12345, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.tcpErrors
                },
                {
                    name: 'network.rateLimitTcpEvents',
                    inputValue: [undefined, 123456, undefined],
                    expectedValue: [4294967295, 123456, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.tcpEvents
                },
                {
                    name: 'network.rateLimitAggregate',
                    inputValue: [undefined, 1234567, undefined],
                    expectedValue: [4294967295, 1234567, 4294967295],
                    extractFunction: (o) => o.network[0].rateLimit.aggregateRate
                },
                {
                    name: 'network.storageFormat',
                    inputValue: [
                        {
                            fields: ['context-name']
                        },
                        {
                            fields: ['action']
                        },
                        undefined
                    ],
                    expectedValue: [['context_name'], ['action'], undefined],
                    extractFunction: (o) => o.network[0].format.fieldList
                },
                {
                    name: 'protocolDns',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'protocolDns.logDroppedRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolDns[0].filter.logDnsDrop
                },
                {
                    name: 'protocolDns.logFilteredDroppedRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolDns[0].filter.logDnsFilteredDrop
                },
                {
                    name: 'protocolDns.logMalformedRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolDns[0].filter.logDnsMalformed
                },
                {
                    name: 'protocolDns.logRejectedRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolDns[0].filter.logDnsReject
                },
                {
                    name: 'protocolDns.logMaliciousRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolDns[0].filter.logDnsMalicious
                },
                {
                    name: 'protocolDns.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => {
                        const result = (o.protocolDns[0].publisher) ? o.protocolDns[0].publisher.fullPath : undefined;
                        return result;
                    }
                },
                {
                    name: 'protocolDns.storageFormat',
                    inputValue: [
                        {
                            fields: ['context-name']
                        },
                        {
                            fields: ['action']
                        },
                        {
                            fields: ['context-name']
                        }
                    ],
                    expectedValue: [['context_name'], ['action'], ['context_name']],
                    extractFunction: (o) => o.protocolDns[0].format.fieldList
                },
                {
                    name: 'protocolDnsDos',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'protocolDnsDos.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => {
                        const result = (o.protocolDnsDosPublisher) ? o.protocolDnsDosPublisher.fullPath : undefined;
                        return result;
                    }
                },
                {
                    name: 'protocolInspection',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'protocolInspection.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined]
                },
                {
                    name: 'protocolInspection.logPacketPayloadEnabled',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'protocolSip',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'protocolSip.logDroppedRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolSip[0].filter.logSipDrop
                },
                {
                    name: 'protocolSip.logGlobalFailures',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolSip[0].filter.logSipGlobalFailures
                },
                {
                    name: 'protocolSip.logMalformedRequests',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolSip[0].filter.logSipMalformed
                },
                {
                    name: 'protocolSip.logRedirectedResponses',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolSip[0].filter.logSipRedirectionResponses
                },
                {
                    name: 'protocolSip.logRequestFailures',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolSip[0].filter.logSipRequestFailures
                },
                {
                    name: 'protocolSip.logServerErrors',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.protocolSip[0].filter.logSipServerErrors
                },
                {
                    name: 'protocolSip.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => {
                        const result = (o.protocolSip[0].publisher) ? o.protocolSip[0].publisher.fullPath : undefined;
                        return result;
                    }
                },
                {
                    name: 'protocolSip.storageFormat',
                    inputValue: [
                        {
                            fields: ['context-name']
                        },
                        {
                            fields: ['action']
                        },
                        {
                            fields: ['context-name']
                        }
                    ],
                    expectedValue: [['context_name'], ['action'], ['context_name']],
                    extractFunction: (o) => o.protocolSip[0].format.fieldList
                },
                {
                    name: 'protocolSipDos',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'protocolSipDos.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => {
                        const result = (o.protocolSipDosPublisher) ? o.protocolSipDosPublisher.fullPath : undefined;
                        return result;
                    }
                },
                {
                    name: 'protocolTransfer',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'protocolTransfer.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => o.protocolTransfer[0].publisher
                },
                {
                    name: 'sshProxy',
                    inputValue: [{}],
                    skipAssert: true
                },
                {
                    name: 'sshProxy.publisher',
                    inputValue: [undefined, { use: 'logPub' }, undefined],
                    expectedValue: [undefined, '/TEST_Security_Log_Profile/Application/logPub', undefined],
                    extractFunction: (o) => o.sshProxy[0].logPublisher
                },
                {
                    name: 'sshProxy.logClientAuthFail',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].unsuccessfulClientSideAuth
                },
                {
                    name: 'sshProxy.logClientAuthSuccess',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].successfulClientSideAuth
                },
                {
                    name: 'sshProxy.logServerAuthFail',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].unsuccessfulServerSideAuth
                },
                {
                    name: 'sshProxy.logServerAuthSuccess',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].successfulServerSideAuth
                },
                {
                    name: 'sshProxy.logDisallowedChannelAction',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].disallowedChannelAction
                },
                {
                    name: 'sshProxy.logAllowedChannelAction',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].allowedChannelAction
                },
                {
                    name: 'sshProxy.logSshTimeout',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].sshTimeout
                },
                {
                    name: 'sshProxy.logNonSshTraffic',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].nonSshTraffic
                }
            );
        }

        if (getProvisionedModules().includes('afm')) {
            properties.push(
                {
                    name: 'nat.rateLimitAggregate',
                    inputValue: [undefined, 1000, undefined],
                    expectedValue: [4294967295, 1000, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.aggregateRate
                },
                {
                    name: 'nat.rateLimitErrors',
                    inputValue: [undefined, 10000, undefined],
                    expectedValue: [4294967295, 10000, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.errors
                },
                {
                    name: 'nat.rateLimitQuotaExceeded',
                    inputValue: [undefined, 100000, undefined],
                    expectedValue: [4294967295, 100000, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.quotaExceeded
                },
                {
                    name: 'nat.rateLimitStartInboundSession',
                    inputValue: [undefined, 1200, undefined],
                    expectedValue: [4294967295, 1200, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.startInboundSession
                },
                {
                    name: 'nat.rateLimitEndInboundSession',
                    inputValue: [undefined, 12000, undefined],
                    expectedValue: [4294967295, 12000, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.endInboundSession
                },
                {
                    name: 'nat.rateLimitStartOutboundSession',
                    inputValue: [undefined, 30000, undefined],
                    expectedValue: [4294967295, 30000, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.startOutboundSession
                },
                {
                    name: 'nat.rateLimitEndOutboundSession',
                    inputValue: [undefined, 100, undefined],
                    expectedValue: [4294967295, 100, 4294967295],
                    extractFunction: (o) => o.nat.rateLimit.endOutboundSession
                }
            );

            if (getProvisionedModules().includes('asm')) {
                properties.push(
                    {
                        name: 'botDefense',
                        inputValue: [{}],
                        skipAssert: true
                    },
                    {
                        name: 'botDefense.localPublisher',
                        inputValue: [
                            { bigip: '/Common/local-db-publisher' }
                        ],
                        expectedValue: ['/Common/local-db-publisher']
                    },
                    {
                        name: 'botDefense.logChallengedRequests',
                        inputValue: [undefined, true, undefined],
                        expectedValue: ['disabled', 'enabled', 'disabled'],
                        extractFunction: (o) => o.botDefense[0].filter.logChallengedRequests
                    },
                    {
                        name: 'botDefense.logIllegalRequests',
                        inputValue: [undefined, false, undefined],
                        expectedValue: ['enabled', 'disabled', 'enabled'],
                        extractFunction: (o) => o.botDefense[0].filter.logIllegalRequests
                    },
                    {
                        name: 'botDefense.logLegalRequests',
                        inputValue: [undefined, true, undefined],
                        expectedValue: ['disabled', 'enabled', 'disabled'],
                        extractFunction: (o) => o.botDefense[0].filter.logLegalRequests
                    }
                );
            }
        }

        if (getProvisionedModules().includes('afm')) {
            properties.push(
                {
                    name: 'nat.logSubscriberId',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled']
                },
                {
                    name: 'nat.formatErrors',
                    inputValue: [
                        undefined,
                        {
                            fields: [
                                'context-name'
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [undefined, ['context_name'], undefined],
                    extractFunction: (o) => o.nat.format.errors.fieldList
                },
                {
                    name: 'nat.formatQuotaExceeded',
                    inputValue: [
                        undefined,
                        'context-name',
                        undefined
                    ],
                    expectedValue: [undefined, 'context-name', undefined],
                    extractFunction: (o) => o.nat.format.quotaExceeded.userDefined
                },
                {
                    name: 'nat.formatStartInboundSession',
                    inputValue: [
                        undefined,
                        {
                            fields: [
                                'context-name'
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [undefined, ['context_name'], undefined],
                    extractFunction: (o) => o.nat.format.startInboundSession.fieldList
                },
                {
                    name: 'nat.formatEndInboundSession',
                    inputValue: [
                        undefined,
                        {
                            fields: [
                                'context-name'
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [undefined, ['context_name'], undefined],
                    extractFunction: (o) => o.nat.format.endInboundSession.fieldList
                },
                {
                    name: 'nat.formatStartOutboundSession',
                    inputValue: [
                        undefined, {
                            fields: [
                                'context-name'
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [undefined, ['context_name'], undefined],
                    extractFunction: (o) => o.nat.format.startOutboundSession.fieldList
                },
                {
                    name: 'nat.formatEndOutboundSession',
                    inputValue: [
                        undefined,
                        {
                            fields: [
                                'context-name'
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [undefined, ['context_name'], undefined],
                    extractFunction: (o) => o.nat.format.endOutboundSession.fieldList
                },
                {
                    name: 'sshProxy.logClientAuthPartial',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].partialClientSideAuth
                },
                {
                    name: 'sshProxy.logServerAuthPartial',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.sshProxy[0].partialServerSideAuth
                }
            );

            if (getProvisionedModules().includes('asm')) {
                properties.push(
                    {
                        name: 'botDefense.logBotSignatureMatchedRequests',
                        inputValue: [undefined, true, undefined],
                        expectedValue: ['disabled', 'enabled', 'disabled'],
                        extractFunction: (o) => o.botDefense[0].filter.logBotSignatureMatchedRequests
                    },
                    {
                        name: 'botDefense.logCaptchaChallengedRequests',
                        inputValue: [undefined, true, undefined],
                        expectedValue: ['disabled', 'enabled', 'disabled'],
                        extractFunction: (o) => o.botDefense[0].filter.logCaptchaChallengedRequests
                    }
                );
            }
        }

        if (!util.versionLessThan(getBigIpVersion(), '14.1') && getProvisionedModules().includes('asm')) {
            properties.push(
                {
                    name: 'botDefense.logAlarm',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logAlarm
                },
                {
                    name: 'botDefense.logBlock',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logBlock
                },
                {
                    name: 'botDefense.logBrowser',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logBrowser
                },
                {
                    name: 'botDefense.logBrowserVerificationAction',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logBrowserVerificationAction
                },
                {
                    name: 'botDefense.logCaptcha',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logCaptcha
                },
                {
                    name: 'botDefense.logDeviceIdCollectionRequest',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logDeviceIdCollectionRequest
                },
                {
                    name: 'botDefense.logMaliciousBot',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logMaliciousBot
                },
                {
                    name: 'botDefense.logMobileApplication',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logMobileApplication
                },
                {
                    name: 'botDefense.logNone',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logNone
                },
                {
                    name: 'botDefense.logRateLimit',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logRateLimit
                },
                {
                    name: 'botDefense.logSuspiciousBrowser',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logSuspiciousBrowser
                },
                {
                    name: 'botDefense.logTcpReset',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logTcpReset
                },
                {
                    name: 'botDefense.logTrustedBot',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logTrustedBot
                },
                {
                    name: 'botDefense.logUnknown',
                    inputValue: [undefined, false, undefined],
                    expectedValue: ['enabled', 'disabled', 'enabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logUnknown
                },
                {
                    name: 'botDefense.logUntrustedBot',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logUntrustedBot
                }
            );
        }

        if (!util.versionLessThan(getBigIpVersion(), '15.0') && getProvisionedModules().includes('asm')) {
            properties.push(
                {
                    name: 'botDefense.logHoneyPotPage',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logHoneyPotPage
                },
                {
                    name: 'botDefense.logRedirectToPool',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logRedirectToPool
                },
                {
                    name: 'botDefense.logChallengeFailureRequest',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.botDefense[0].filter.logChallengeFailureRequest
                }
            );
        }

        return assertSecurityLogProfile(properties);
    });

    it('Should handle user defined strings', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            }
        ];

        /* eslint-disable no-template-curly-in-string */
        properties.push(
            {
                name: 'network',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'network.storageFormat',
                inputValue: [
                    undefined,
                    '${date_time},${bigip_hostname},${management_ip_address},${src_ip},${src_port},${dest_ip},${dest_port},${translated_src_ip},${translated_dest_ip},${translated_src_port},${translated_dest_port},${date_time},,${protocol},${action}',
                    undefined
                ],
                expectedValue: [
                    undefined,
                    '${date_time},${bigip_hostname},${management_ip_address},${src_ip},${src_port},${dest_ip},${dest_port},${translated_src_ip},${translated_dest_ip},${translated_src_port},${translated_dest_port},${date_time},,${protocol},${action}',
                    undefined
                ],
                extractFunction: (o) => o.network[0].format.userDefined
            }
        );
        /* eslint-enable no-template-curly-in-string */

        return assertSecurityLogProfile(properties);
    });

    it('Application section', function () {
        assertModuleProvisioned.call(this, 'asm');

        const expectedFilter = [
            [
                {
                    name: 'request-type',
                    values: ['illegal']
                }
            ],
            [
                {
                    name: 'http-method',
                    values: ['ACL', 'GET', 'POLL', 'POST']
                },
                {
                    name: 'login-result',
                    values: ['login-result-successful', 'login-result-failed']
                },
                {
                    name: 'protocol',
                    values: ['https', 'ws']
                },
                {
                    name: 'request-type',
                    values: ['all']
                },
                {
                    name: 'response-code',
                    values: ['100', '200', '300', '400']
                },
                {
                    name: 'search-in-headers',
                    values: ['The header string to search for']
                }
            ],
            [
                {
                    name: 'http-method',
                    values: ['PATCH', 'DELETE']
                },
                {
                    name: 'login-result',
                    values: ['login-result-unknown']
                },
                {
                    name: 'protocol',
                    values: ['http']
                },
                {
                    name: 'request-type',
                    values: ['illegal-including-staged-signatures']
                },
                {
                    name: 'response-code',
                    values: ['201', '404']
                },
                {
                    name: 'search-in-request',
                    values: ['The new value']
                }
            ],
            [
                {
                    name: 'request-type',
                    values: ['illegal']
                }
            ]
        ];

        expectedFilter.forEach((filter, index) => {
            const logicOp = {};
            logicOp.logicOperation = (index === 1) ? 'and' : 'or';
            filter.push(logicOp);
        });

        const properties = [
            {
                name: 'application',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'application.facility',
                inputValue: [undefined, undefined, 'local3', 'local2', undefined],
                expectedValue: ['local0', 'local0', 'local3', 'local2', 'local0']
            },
            {
                name: 'application.storageFilter',
                inputValue: [
                    undefined,
                    {
                        logicalOperation: 'and',
                        requestType: 'all',
                        responseCodes: ['100', '200', '300', '400'],
                        protocols: ['https', 'ws'],
                        httpMethods: ['ACL', 'GET', 'POLL', 'POST'],
                        requestContains: {
                            searchIn: 'search-in-headers',
                            value: 'The header string to search for'
                        },
                        loginResults: ['login-result-successful', 'login-result-failed']
                    },
                    {
                        requestType: 'illegal-including-staged-signatures',
                        responseCodes: ['404', '201'],
                        protocols: ['http'],
                        httpMethods: ['PATCH', 'DELETE'],
                        requestContains: {
                            searchIn: 'search-in-request',
                            value: 'The new value'
                        },
                        loginResults: ['login-result-unknown']
                    },
                    undefined
                ],
                expectedValue: expectedFilter,
                extractFunction: (o) => {
                    const filter = o.application[0].filter;
                    filter.push({
                        logicOperation: o.application[0].logicOperation
                    });
                    return filter;
                }
            },
            {
                name: 'application.storageFormat',
                inputValue: [
                    undefined,
                    undefined,
                    {
                        fields: ['attack_type', 'headers', 'is_truncated'],
                        delimiter: '.'
                    },
                    'This one is user defined',
                    undefined
                ],
                expectedValue: [
                    {
                        fieldDelimiter: ',',
                        type: 'predefined'
                    },
                    {
                        fieldDelimiter: ',',
                        type: 'predefined'
                    },
                    {
                        fieldDelimiter: '.',
                        fields: ['attack_type', 'headers', 'is_truncated'],
                        type: 'predefined'
                    },
                    {
                        fieldDelimiter: ',',
                        type: 'user-defined',
                        userString: 'This one is user defined'
                    },
                    {
                        fieldDelimiter: ',',
                        type: 'predefined'
                    }
                ],
                extractFunction: (o) => {
                    delete o.application[0].format.fieldsReference;
                    return o.application[0].format;
                }
            },
            {
                name: 'application.guaranteeLoggingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'application.guaranteeResponseLoggingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'application.localStorage',
                inputValue: [undefined, undefined, false, false, undefined],
                expectedValue: ['enabled', 'enabled', 'disabled', 'disabled', 'enabled']
            },
            {
                name: 'application.maxEntryLength',
                inputValue: [undefined, undefined, '10k', undefined],
                expectedValue: ['2k', '2k', '10k', '2k']
            },
            {
                name: 'application.maxHeaderSize',
                inputValue: [undefined, 200, undefined],
                expectedValue: ['any', '200', 'any']
            },
            {
                name: 'application.maxQuerySize',
                inputValue: [undefined, 1040, undefined],
                expectedValue: ['any', '1040', 'any']
            },
            {
                name: 'application.maxRequestSize',
                inputValue: [undefined, 900, undefined],
                expectedValue: ['any', '900', 'any']
            },
            {
                name: 'application.protocol',
                inputValue: [undefined, undefined, 'udp', 'tcp-rfc3195', undefined],
                expectedValue: ['tcp', 'tcp', 'udp', 'tcp-rfc3195', 'tcp']
            },
            {
                name: 'application.remoteStorage',
                inputValue: [undefined, undefined, 'remote', 'remote', undefined],
                expectedValue: ['none', 'none', 'remote', 'remote', 'none']
            },
            {
                name: 'application.reportAnomaliesEnabled',
                inputValue: [undefined, undefined, true, undefined],
                expectedValue: ['disabled', 'disabled', 'enabled', 'disabled']
            },
            {
                name: 'application.responseLogging',
                inputValue: [undefined, 'all', undefined],
                expectedValue: ['none', 'all', 'none']
            },
            {
                name: 'application.servers',
                inputValue: [
                    undefined,
                    undefined,
                    [
                        {
                            address: '9.8.7.6',
                            port: '9876'
                        }
                    ],
                    [
                        {
                            address: '1.2.3.4',
                            port: '4000'
                        },
                        {
                            address: '2001:db8:1234:ffff:ffff:ffff:ffff:ffff',
                            port: '100'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    undefined,
                    undefined,
                    [
                        {
                            name: '9.8.7.6:9876'
                        }
                    ],
                    [
                        {
                            name: '1.2.3.4:4000'
                        },
                        {
                            name: '2001:db8:1234:ffff:ffff:ffff:ffff:ffff.100'
                        }
                    ],
                    undefined
                ]
            }
        ];
        return assertSecurityLogProfile(properties);
    });
});

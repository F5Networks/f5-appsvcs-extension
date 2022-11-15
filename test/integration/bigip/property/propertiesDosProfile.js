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
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const constants = require('../../../../src/lib/constants');
const utilConstants = require('../../../common/utilConstants');
const util = require('../../../../src/lib/util/util');

const PREFIX = 'f5_appsvcs_';
const POSTFIX = '_botDefense';
const MAX_PATH_LENGTH = constants.MAX_PATH_LENGTH - PREFIX.length - POSTFIX.length;

describe('DOS_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDosProfile(properties, options) {
        const assertOptions = Object.assign({}, options);
        assertOptions.maxPathLength = MAX_PATH_LENGTH;
        return assertClass('DOS_Profile', properties, assertOptions);
    }

    function extractWhitelist(o, property) {
        return (o[property] ? o[property].name : undefined);
    }

    function extractObject(o) {
        if (typeof o === 'undefined') return o;

        const extracted = util.simpleCopy(o);
        delete extracted.fullPath;
        delete extracted.generation;
        delete extracted.kind;
        delete extracted.selfLink;
        return extracted;
    }

    const defaultVector = {
        state: 'mitigate',
        thresholdMode: 'manual',
        rateThreshold: 'infinite',
        rateIncrease: 500,
        rateLimit: 'infinite',
        simulateAutoThreshold: 'disabled',
        badActor: 'disabled',
        perSourceIpDetectionPps: 'infinite',
        perSourceIpLimitPps: 'infinite',
        autoBlacklisting: 'disabled',
        blacklistCategory: '/Common/denial_of_service',
        blacklistDetectionSeconds: 60,
        blacklistDuration: 14400,
        allowAdvertisement: 'disabled',
        floor: '100',
        ceiling: 'infinite',
        enforce: 'enabled',
        autoThreshold: 'disabled'
    };

    const tenantName = 'TEST_DOS_Profile';

    // TODO: Test singlePageApplication setting
    it('All properties', function () {
        assertModuleProvisioned.call(this, 'asm');
        assertModuleProvisioned.call(this, 'afm');

        // Application expected values
        const acceleration = { bigip: '/Common/full-acceleration' };
        const accelerationExpected = '/Common/full-acceleration';
        const singlePageExpected = 'disabled';
        const scrubbingEnableExpected = 'enabled';
        const mobileDetectionExpected = {
            allowAndroidRootedDevice: 'false',
            allowAnyAndroidPackage: 'true',
            allowAnyIosPackage: 'true',
            allowEmulators: 'false',
            allowJailbrokenDevices: 'false',
            clientSideChallengeMode: 'pass',
            enabled: 'disabled'
        };
        const includeListExpected = [
            {
                name: '0',
                url: 'www.google.com',
                threshold: 'auto'
            }
        ];
        const rtbhEnableExpected = 'enabled';
        const rtbhDurationSecExpected = 10;
        const scrubbingDurationSecExpected = 42;
        const signaturesExpected = 'enabled';
        const signaturesApprovedOnlyExpected = 'enabled';
        const maxExpected = 5000;
        const minExpected = 5;
        const thresholdsModeExpected = 'manual';
        const urlEnableHeavyExpected = 'enabled';
        let botSignaturesInput = {
            checkingEnabled: true,
            blockedCategories: [
                { bigip: '/Common/Search Engine' }
            ],
            reportedCategories: [
                { bigip: '/Common/Spam' }
            ]
        };
        let botSignaturesExpected = {
            check: 'enabled',
            categories: [
                {
                    action: 'block',
                    name: 'Search Engine',
                    partition: 'Common'
                },
                {
                    action: 'report',
                    name: 'Spam',
                    partition: 'Common'
                }
            ]
        };

        // Network expected values
        const dynamicSignaturesExpected = {
            detection: 'enabled',
            mitigation: 'medium',
            scrubberEnable: 'yes',
            scrubberCategory: '/Common/attacked_ips',
            scrubberAdvertisementPeriod: 60
        };
        const autoThresholdExpected = 'disabled';
        const ceilingExpected = 'infinite';
        const enforceExpected = 'enabled';
        const floorExpected = '100';
        const simulateAutoThresholdExpected = 'enabled';
        const stateExpected = 'learn-only';
        const thresholdModeExpected = 'manual';
        const perSourceIpDetectionPpsExpected = '0';
        const perSourceIpLimitPpsExpected = '0';
        let rateLimitExpected = 1000000;
        let rateThresholdExpected = 40000;

        // Dns expected values
        const dnsThreshholdModeExpected = 'fully-automatic';
        const dnsStateExpected = 'mitigate';
        let dnsAutoThresholdExpected = 'enabled';
        const dnsceilingExpected = '0';
        const dnsFloorExpected = '0';
        const dnsEnforceExpected = 'enabled';
        const infinite = 'infinite';
        let dnsRateLimitExpected = 2147483647;
        let dnsRateIncreaseExpected = 2147483647;
        let dnsRateThresholdExpected = 2147483647;
        const dnsSimulateAutoThresholdExpected = 'disabled';

        // Sip expected values, reused some form above
        let sipCeilingExpected = 'infinite';
        let sipFloorExpected = 'N/A';
        const sipStateExpected = 'disabled';

        // applicationWhitelist property
        const httpWhiteListInput = { use: 'addressListHTTP' };
        const httpWhiteListExpected = 'addressListHTTP';

        // Network expected values
        rateLimitExpected = rateLimitExpected.toString();
        rateThresholdExpected = rateThresholdExpected.toString();

        // DNS expected values
        dnsRateLimitExpected = 'infinite';
        dnsRateIncreaseExpected = 4294967295;
        dnsRateThresholdExpected = 'infinite';
        dnsAutoThresholdExpected = 'disabled';

        // SIP expected values
        sipCeilingExpected = 'infinite';
        sipFloorExpected = 'infinite';

        const badActorInput = {
            detectionEnabled: true,
            mitigationMode: 'standard',
            signatureDetectionEnabled: true,
            useApprovedSignaturesOnly: true
        };
        const badActorExpected = {
            dosDetection: 'enabled',
            mitigationMode: 'standard',
            signatures: signaturesExpected,
            signaturesApprovedOnly: signaturesApprovedOnlyExpected
        };
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            badActorInput.acceleratedSignaturesEnabled = true;
            badActorInput.tlsSignaturesEnabled = true;
            badActorExpected.acceleratedSignatures = 'enabled';
            badActorExpected.tlsSignatures = 'enabled';
            botSignaturesInput = undefined;
            botSignaturesExpected = {
                check: 'disabled'
            };
        } else if (!util.versionLessThan(getBigIpVersion(), '14.0')) {
            badActorInput.acceleratedSignaturesEnabled = true;
            badActorExpected.acceleratedSignatures = 'enabled';
        }
        if (!util.versionLessThan(getBigIpVersion(), '15.1')) {
            badActorExpected.tlsFp = 'disabled';
        }

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            }
        ];
        if (getProvisionedModules().includes('asm')) {
            const inputConfig = {
                denylistedGeolocations: [
                    'Timor-Leste',
                    'Cocos (Keeling) Islands'
                ],
                allowlistedGeolocations: [
                    'Bonaire, Saint Eustatius and Saba',
                    'Cote D\'Ivoire'
                ],
                captchaResponse: {
                    first: `Are you a robot&quest;<br><br>Testing All Ascii Characters:<br>${utilConstants.asciiChars}<br><br>%DOSL7.captcha.image% %DOSL7.captcha.change%<br><b>What code is in the image&quest;</b>%DOSL7.captcha.solution%<br>%DOSL7.captcha.submit%<br><br>Your support ID is: %DOSL7.captcha.support_id%.`,
                    failure: `Error! 01001110 01101001 01100011 01100101 00100000 01110100 01110010 01111001 00100000 01110010 01101111 01100010 01101111 01110100<br><br>Testing All Ascii Characters:<br>${utilConstants.asciiChars}<br><br>%DOSL7.captcha.image% %DOSL7.captcha.change%<br><b>What code is in the image&quest;</b>%DOSL7.captcha.solution%<br>%DOSL7.captcha.submit%<br><br>Your support ID is: %DOSL7.captcha.support_id%.`
                },
                heavyURLProtection: {
                    automaticDetectionEnabled: true,
                    detectionThreshold: 16,
                    excludeList: [
                        'example.com'
                    ],
                    protectList: [
                        {
                            url: 'www.google.com',
                            threshold: 0
                        }
                    ]
                },
                triggerIRule: true,
                profileAcceleration: acceleration,
                botDefense: {
                    mode: 'during-attacks',
                    blockSuspiscousBrowsers: true,
                    issueCaptchaChallenge: true,
                    gracePeriod: 4000,
                    crossDomainRequests: 'validate-bulk',
                    siteDomains: [
                        'www.google.com'
                    ],
                    externalDomains: [
                        'www.yahoo.com'
                    ],
                    urlAllowlist: [
                        'www.bing.com'
                    ]
                },
                botSignatures: botSignaturesInput,
                rateBasedDetection: {
                    operationMode: 'off',
                    thresholdsMode: 'manual',
                    escalationPeriod: 120,
                    deEscalationPeriod: 7200,
                    sourceIP: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        rateLimitingMode: 'rate-limit'
                    },
                    deviceID: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        rateLimitingMode: 'rate-limit'
                    },
                    geolocation: {
                        minimumShare: 10,
                        shareIncreaseRate: 500,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        rateLimitingMode: 'rate-limit'
                    },
                    url: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true
                    },
                    site: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true
                    }
                },
                stressBasedDetection: {
                    badActor: badActorInput,
                    operationMode: 'off',
                    thresholdsMode: 'manual',
                    escalationPeriod: 120,
                    deEscalationPeriod: 7200,
                    sourceIP: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        rateLimitingMode: 'rate-limit'
                    },
                    deviceID: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        rateLimitingMode: 'rate-limit'
                    },
                    geolocation: {
                        minimumShare: 10,
                        shareIncreaseRate: 500,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        rateLimitingMode: 'rate-limit'
                    },
                    url: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true,
                        heavyURLProtectionEnabled: true
                    },
                    site: {
                        minimumTps: 40,
                        tpsIncreaseRate: 500,
                        maximumTps: 200,
                        minimumAutoTps: 5,
                        maximumAutoTps: 5000,
                        clientSideDefenseEnabled: false,
                        captchaChallengeEnabled: false,
                        rateLimitingEnabled: true
                    }
                },
                recordTraffic: {
                    maximumDuration: 10,
                    maximumSize: 10,
                    recordTrafficEnabled: false,
                    repetitionInterval: 10
                }
            };

            const expectedConfig = {
                name: 'undefined',
                geolocations: [
                    {
                        whiteListed: true,
                        name: 'Bonaire, Saint Eustatius and Saba'
                    },
                    {
                        blackListed: true,
                        name: 'Cocos (Keeling) Islands'
                    },
                    {
                        name: 'Cote D\'Ivoire',
                        whiteListed: true
                    },
                    {
                        blackListed: true,
                        name: 'Timor-Leste'
                    }
                ],
                captchaResponse: {
                    failure: {
                        // eslint-disable-next-line no-useless-escape
                        body: 'Error! 01001110 01101001 01100011 01100101 00100000 01110100 01110010 01111001 00100000 01110010 01101111 01100010 01101111 01110100<br><br>Testing All Ascii Characters:<br>........\\\\b\\\\t\\\\n.\\\\f\\\\r.................. !\\\"#$%&\'()*+,-./0123456789:;<=>\\?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~.<br><br>%DOSL7.captcha.image% %DOSL7.captcha.change%<br><b>What code is in the image&quest;</b>%DOSL7.captcha.solution%<br>%DOSL7.captcha.submit%<br><br>Your support ID is: %DOSL7.captcha.support_id%.',
                        type: 'custom'
                    },
                    first: {
                        // eslint-disable-next-line no-useless-escape
                        body: 'Are you a robot&quest;<br><br>Testing All Ascii Characters:<br>........\\\\b\\\\t\\\\n.\\\\f\\\\r.................. !\\\"#$%&\'()*+,-./0123456789:;<=>\\?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~.<br><br>%DOSL7.captcha.image% %DOSL7.captcha.change%<br><b>What code is in the image&quest;</b>%DOSL7.captcha.solution%<br>%DOSL7.captcha.submit%<br><br>Your support ID is: %DOSL7.captcha.support_id%.',
                        type: 'custom'
                    }
                },
                heavyUrls: {
                    automaticDetection: 'enabled',
                    latencyThreshold: 16,
                    exclude: [
                        'example.com'
                    ],
                    protection: 'enabled',
                    includeList: includeListExpected
                },
                triggerIrule: 'enabled',
                singlePageApplication: singlePageExpected,
                fastl4AccelerationProfile: accelerationExpected,
                botDefense: {
                    browserLegitCaptcha: 'enabled',
                    browserLegitEnabled: 'enabled',
                    crossDomainRequests: 'validate-bulk',
                    externalDomains: [
                        'www.yahoo.com'
                    ],
                    gracePeriod: 4000,
                    mode: 'during-attacks',
                    siteDomains: [
                        'www.google.com'
                    ],
                    urlWhitelist: [
                        'www.bing.com'
                    ]
                },
                botSignatures: botSignaturesExpected,
                tpsBased: {
                    mode: 'off',
                    deEscalationPeriod: 7200,
                    escalationPeriod: 120,
                    thresholdsMode: thresholdsModeExpected,
                    ipMinimumTps: 40,
                    ipTpsIncreaseRate: 500,
                    ipMaximumTps: 200,
                    ipMinimumAutoTps: minExpected,
                    ipMaximumAutoTps: maxExpected,
                    ipClientSideDefense: 'disabled',
                    ipCaptchaChallenge: 'disabled',
                    ipRateLimiting: 'enabled',
                    ipRequestBlockingMode: 'rate-limit',
                    deviceMinimumTps: 40,
                    deviceTpsIncreaseRate: 500,
                    deviceMaximumTps: 200,
                    deviceMinimumAutoTps: minExpected,
                    deviceMaximumAutoTps: maxExpected,
                    deviceClientSideDefense: 'disabled',
                    deviceCaptchaChallenge: 'disabled',
                    deviceRateLimiting: 'enabled',
                    deviceRequestBlockingMode: 'rate-limit',
                    geoMinimumShare: 10,
                    geoShareIncreaseRate: 500,
                    geoMinimumAutoTps: minExpected,
                    geoMaximumAutoTps: maxExpected,
                    geoClientSideDefense: 'disabled',
                    geoCaptchaChallenge: 'disabled',
                    geoRateLimiting: 'enabled',
                    geoRequestBlockingMode: 'rate-limit',
                    urlMinimumTps: 40,
                    urlTpsIncreaseRate: 500,
                    urlMaximumTps: 200,
                    urlMinimumAutoTps: minExpected,
                    urlMaximumAutoTps: maxExpected,
                    urlClientSideDefense: 'disabled',
                    urlCaptchaChallenge: 'disabled',
                    urlRateLimiting: 'enabled',
                    urlEnableHeavy: urlEnableHeavyExpected,
                    siteMinimumTps: 40,
                    siteTpsIncreaseRate: 500,
                    siteMaximumTps: 200,
                    siteMinimumAutoTps: minExpected,
                    siteMaximumAutoTps: maxExpected,
                    siteClientSideDefense: 'disabled',
                    siteCaptchaChallenge: 'disabled',
                    siteRateLimiting: 'enabled'
                },
                stressBased: {
                    behavioral: badActorExpected,
                    mode: 'off',
                    thresholdsMode: thresholdsModeExpected,
                    escalationPeriod: 120,
                    deEscalationPeriod: 7200,
                    ipMinimumTps: 40,
                    ipTpsIncreaseRate: 500,
                    ipMaximumTps: 200,
                    ipMinimumAutoTps: minExpected,
                    ipMaximumAutoTps: maxExpected,
                    ipClientSideDefense: 'disabled',
                    ipCaptchaChallenge: 'disabled',
                    ipRateLimiting: 'enabled',
                    ipRequestBlockingMode: 'rate-limit',
                    deviceMinimumTps: 40,
                    deviceTpsIncreaseRate: 500,
                    deviceMaximumTps: 200,
                    deviceMinimumAutoTps: minExpected,
                    deviceMaximumAutoTps: maxExpected,
                    deviceClientSideDefense: 'disabled',
                    deviceCaptchaChallenge: 'disabled',
                    deviceRateLimiting: 'enabled',
                    deviceRequestBlockingMode: 'rate-limit',
                    geoMinimumShare: 10,
                    geoShareIncreaseRate: 500,
                    geoMinimumAutoTps: minExpected,
                    geoMaximumAutoTps: maxExpected,
                    geoClientSideDefense: 'disabled',
                    geoCaptchaChallenge: 'disabled',
                    geoRateLimiting: 'enabled',
                    geoRequestBlockingMode: 'rate-limit',
                    urlMinimumTps: 40,
                    urlTpsIncreaseRate: 500,
                    urlMaximumTps: 200,
                    urlMinimumAutoTps: minExpected,
                    urlMaximumAutoTps: maxExpected,
                    urlClientSideDefense: 'disabled',
                    urlCaptchaChallenge: 'disabled',
                    urlRateLimiting: 'enabled',
                    urlEnableHeavy: urlEnableHeavyExpected,
                    siteMinimumTps: 40,
                    siteTpsIncreaseRate: 500,
                    siteMaximumTps: 200,
                    siteMinimumAutoTps: minExpected,
                    siteMaximumAutoTps: maxExpected,
                    siteClientSideDefense: 'disabled',
                    siteCaptchaChallenge: 'disabled',
                    siteRateLimiting: 'enabled'
                },
                tcpDump: {
                    maximumDuration: 10,
                    maximumSize: 10,
                    recordTraffic: 'disabled',
                    repetitionInterval: '10'
                },
                mobileDetection: mobileDetectionExpected
            };

            if (getProvisionedModules().includes('afm')) {
                inputConfig.scrubbingDuration = 42;
                inputConfig.remoteTriggeredBlackHoleDuration = 10;

                expectedConfig.scrubbingEnable = scrubbingEnableExpected;
                expectedConfig.scrubbingDurationSec = scrubbingDurationSecExpected;
                expectedConfig.rtbhEnable = rtbhEnableExpected;
                expectedConfig.rtbhDurationSec = rtbhDurationSecExpected;
            }

            properties.push(
                {
                    name: 'application',
                    inputValue: [
                        undefined,
                        inputConfig,
                        undefined
                    ],
                    expectedValue: [
                        undefined,
                        expectedConfig,
                        undefined
                    ],
                    extractFunction: (o) => {
                        const extracted = extractObject((o.application || [])[0]);
                        if (!extracted) return extracted;

                        delete extracted.fastl4AccelerationProfileReference;
                        if (extracted.botSignatures.categories) {
                            extracted.botSignatures.categories.forEach((c) => delete c.nameReference);
                        }
                        extracted.fastl4AccelerationProfile = extracted.fastl4AccelerationProfile.fullPath;

                        return extracted;
                    }
                }
            );
        }

        if (getProvisionedModules().includes('afm')) {
            const scrubbingCategory = {};
            scrubbingCategory.bigip = '/Common/attacked_ips';
            properties.push(
                {
                    name: 'network',
                    inputValue: [
                        undefined,
                        {
                            dynamicSignatures: {
                                detectionMode: 'enabled',
                                mitigationMode: 'medium',
                                scrubbingEnabled: true,
                                scrubbingCategory,
                                scrubbingDuration: 60
                            },
                            vectors: [
                                {
                                    type: 'hop-cnt-low',
                                    state: 'learn-only',
                                    thresholdMode: 'manual',
                                    rateThreshold: 40000,
                                    rateIncreaseThreshold: 600,
                                    rateLimit: 1000000,
                                    simulateAutoThresholdEnabled: true,
                                    badActorSettings: {
                                        enabled: true,
                                        sourceDetectionThreshold: 0,
                                        sourceMitigationThreshold: 0
                                    },
                                    autoDenylistSettings: {
                                        enabled: true,
                                        category: { bigip: '/Common/botnets' },
                                        attackDetectionTime: 1,
                                        categoryDuration: 60,
                                        externalAdvertisementEnabled: true
                                    }
                                }
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [
                        undefined,
                        {
                            name: 'undefined',
                            dynamicSignatures: dynamicSignaturesExpected,
                            networkAttackVector: [
                                {
                                    name: 'hop-cnt-low',
                                    state: stateExpected,
                                    thresholdMode: thresholdModeExpected,
                                    rateThreshold: rateThresholdExpected,
                                    rateIncrease: 600,
                                    rateLimit: rateLimitExpected,
                                    simulateAutoThreshold: simulateAutoThresholdExpected,
                                    badActor: 'enabled',
                                    perSourceIpDetectionPps: perSourceIpDetectionPpsExpected,
                                    perSourceIpLimitPps: perSourceIpLimitPpsExpected,
                                    autoBlacklisting: 'enabled',
                                    blacklistCategory: '/Common/botnets',
                                    blacklistDetectionSeconds: 1,
                                    blacklistDuration: 60,
                                    allowAdvertisement: 'enabled',
                                    floor: floorExpected,
                                    ceiling: ceilingExpected,
                                    enforce: enforceExpected,
                                    autoThreshold: autoThresholdExpected
                                }
                            ]
                        },
                        undefined
                    ],
                    extractFunction: (o) => {
                        const result = extractObject(o.dosNetwork[0]);
                        if (result && result.dynamicSignatures) {
                            delete result.dynamicSignatures.scrubberCategoryReference;
                        }
                        if (result && result.networkAttackVector) {
                            result.networkAttackVector.forEach((v) => {
                                delete v.blacklistCategoryReference;
                            });
                        }

                        if (result && !util.versionLessThan(getBigIpVersion(), '14.1')) {
                            delete result.multiplierMitigationPercentage;
                            delete result.networkAttackVector[0].allowUpstreamScrubbing;
                            delete result.networkAttackVector[0].attackedDst;
                            delete result.networkAttackVector[0].autoScrubbing;
                            delete result.networkAttackVector[0].multiplierMitigationPercentage;
                            delete result.networkAttackVector[0].perDstIpDetectionPps;
                            delete result.networkAttackVector[0].perDstIpLimitPps;
                            delete result.networkAttackVector[0].scrubbingDetectionSeconds;
                            delete result.networkAttackVector[0].scrubbingDuration;
                            delete result.networkAttackVector[0].suspicious;
                        }

                        return result;
                    }
                },
                {
                    name: 'protocolDNS',
                    inputValue: [
                        undefined,
                        {
                            vectors: [
                                {
                                    type: 'ptr',
                                    state: 'mitigate',
                                    thresholdMode: 'fully-automatic',
                                    autoAttackFloor: 0,
                                    autoAttackCeiling: 0
                                }
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [
                        undefined,
                        {
                            name: 'undefined',
                            dnsQueryVector: [
                                Object.assign({}, defaultVector, {
                                    name: 'ptr',
                                    state: dnsStateExpected,
                                    thresholdMode: dnsThreshholdModeExpected,
                                    floor: dnsFloorExpected,
                                    ceiling: dnsceilingExpected,
                                    enforce: dnsEnforceExpected,
                                    autoThreshold: dnsAutoThresholdExpected,
                                    perSourceIpDetectionPps: infinite,
                                    perSourceIpLimitPps: infinite,
                                    rateLimit: dnsRateLimitExpected,
                                    rateThreshold: dnsRateThresholdExpected,
                                    simulateAutoThreshold: dnsSimulateAutoThresholdExpected
                                })
                            ]
                        },
                        undefined
                    ],
                    extractFunction: (o) => {
                        const extracted = extractObject(o.protocolDns[0]);
                        if (!extracted) return undefined;

                        const filterKeys = Object.keys(extracted).filter((k) => k.startsWith('protErr'));
                        filterKeys.forEach((k) => delete extracted[k]);
                        delete extracted.dynamicSignatures;
                        delete extracted.useFromDnsProfile;

                        if (extracted && extracted.dnsQueryVector) {
                            extracted.dnsQueryVector.forEach((v) => {
                                delete v.blacklistCategoryReference;
                            });
                        }

                        if (extracted && !util.versionLessThan(getBigIpVersion(), '14.1')) {
                            delete extracted.dnsQueryVector[0].allowUpstreamScrubbing;
                            delete extracted.dnsQueryVector[0].attackedDst;
                            delete extracted.dnsQueryVector[0].autoScrubbing;
                            delete extracted.dnsQueryVector[0].multiplierMitigationPercentage;
                            delete extracted.dnsQueryVector[0].perDstIpDetectionPps;
                            delete extracted.dnsQueryVector[0].perDstIpLimitPps;
                            delete extracted.dnsQueryVector[0].scrubbingDetectionSeconds;
                            delete extracted.dnsQueryVector[0].scrubbingDuration;
                            delete extracted.dnsQueryVector[0].suspicious;
                            delete extracted.multiplierMitigationPercentage;
                        }

                        return extracted;
                    }
                },
                {
                    name: 'protocolSIP',
                    inputValue: [
                        undefined,
                        {
                            vectors: [
                                {
                                    type: 'cancel',
                                    state: 'disabled',
                                    thresholdMode: 'fully-automatic',
                                    autoAttackFloor: 4294967295,
                                    autoAttackCeiling: 4294967295,
                                    rateIncreaseThreshold: 4294967295
                                }
                            ]
                        },
                        undefined
                    ],
                    expectedValue: [
                        undefined,
                        {
                            name: 'undefined',
                            sipAttackVector: [
                                Object.assign({}, defaultVector, {
                                    name: 'cancel',
                                    state: sipStateExpected,
                                    thresholdMode: dnsThreshholdModeExpected,
                                    floor: sipFloorExpected,
                                    ceiling: sipCeilingExpected,
                                    enforce: dnsEnforceExpected,
                                    autoThreshold: dnsAutoThresholdExpected,
                                    perSourceIpDetectionPps: infinite,
                                    perSourceIpLimitPps: infinite,
                                    rateLimit: dnsRateLimitExpected,
                                    rateIncrease: dnsRateIncreaseExpected,
                                    rateThreshold: dnsRateThresholdExpected,
                                    simulateAutoThreshold: dnsSimulateAutoThresholdExpected
                                })
                            ]
                        },
                        undefined
                    ],
                    extractFunction: (o) => {
                        const extracted = extractObject(o.protocolSip[0]);
                        if (!extracted) return undefined;

                        const filterKeys = Object.keys(extracted).filter((k) => k.startsWith('protErr'));
                        filterKeys.forEach((k) => delete extracted[k]);

                        if (extracted && extracted.sipAttackVector) {
                            extracted.sipAttackVector.forEach((v) => {
                                delete v.blacklistCategoryReference;
                            });
                        }

                        if (extracted && !util.versionLessThan(getBigIpVersion(), '14.1')) {
                            delete extracted.multiplierMitigationPercentage;
                            delete extracted.sipAttackVector[0].allowUpstreamScrubbing;
                            delete extracted.sipAttackVector[0].attackedDst;
                            delete extracted.sipAttackVector[0].autoScrubbing;
                            delete extracted.sipAttackVector[0].multiplierMitigationPercentage;
                            delete extracted.sipAttackVector[0].perDstIpDetectionPps;
                            delete extracted.sipAttackVector[0].perDstIpLimitPps;
                            delete extracted.sipAttackVector[0].scrubbingDetectionSeconds;
                            delete extracted.sipAttackVector[0].scrubbingDuration;
                            delete extracted.sipAttackVector[0].suspicious;
                        }

                        return extracted;
                    }
                }
            );
        }

        if (getProvisionedModules().includes('asm') && getProvisionedModules().includes('afm')) {
            properties.push(
                {
                    name: 'allowlist',
                    inputValue: [
                        undefined,
                        { use: 'addressList' },
                        undefined
                    ],
                    expectedValue: [undefined, 'addressList', undefined],
                    extractFunction: (o) => extractWhitelist(o, 'whitelist'),
                    referenceObjects: {
                        addressList: {
                            class: 'Firewall_Address_List',
                            addresses: ['10.0.0.10']
                        }
                    }
                },
                {
                    name: 'applicationAllowlist',
                    inputValue: [
                        undefined,
                        httpWhiteListInput,
                        undefined
                    ],
                    expectedValue: [undefined, httpWhiteListExpected, undefined],
                    extractFunction: (o) => extractWhitelist(o, 'httpWhitelist'),
                    referenceObjects: {
                        addressListHTTP: {
                            class: 'Firewall_Address_List',
                            addresses: ['10.0.0.11']
                        }
                    }
                }
            );
        } else if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            properties.push(
                {
                    name: 'allowlist',
                    inputValue: [
                        undefined,
                        { use: 'addressList' },
                        undefined
                    ],
                    expectedValue: [undefined, 'addressList', undefined],
                    extractFunction: (o) => extractWhitelist(o, 'whitelist'),
                    referenceObjects: {
                        addressList: {
                            class: 'Net_Address_List',
                            addresses: ['10.0.0.10']
                        }
                    }
                },
                {
                    name: 'applicationAllowlist',
                    inputValue: [
                        undefined,
                        httpWhiteListInput,
                        undefined
                    ],
                    expectedValue: [undefined, httpWhiteListExpected, undefined],
                    extractFunction: (o) => extractWhitelist(o, 'httpWhitelist'),
                    referenceObjects: {
                        addressListHTTP: {
                            class: 'Net_Address_List',
                            addresses: ['10.0.0.11']
                        }
                    }
                }
            );
        }

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/security/dos/bot-signature-category',
                    data: {
                        name: 'Spam',
                        action: 'report'
                    }
                },
                {
                    endpoint: '/mgmt/tm/security/dos/bot-signature-category',
                    data: {
                        name: 'foo bar',
                        action: 'block'
                    }
                }
            ]
        };
        return assertDosProfile(properties, options);
    });

    it('allowlist with net address-list', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'allowlist',
                inputValue: [
                    undefined,
                    { use: 'netAddressList' },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    {},
                    undefined
                ],
                referenceObjects: {
                    netAddressList: {
                        class: 'Net_Address_List',
                        addresses: ['192.0.2.0']
                    }
                }
            }
        ];

        return assertDosProfile(properties);
    });

    it('Mobile defense', function () {
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const expectedMobileDefense = {
            name: 'undefined',
            rtbhDurationSec: 10,
            rtbhEnable: 'enabled',
            scrubbingDurationSec: 42,
            scrubbingEnable: 'enabled',
            singlePageApplication: 'disabled',
            triggerIrule: 'disabled',
            mobileDetection: {
                allowAndroidRootedDevice: 'true',
                allowAnyAndroidPackage: 'false',
                allowAnyIosPackage: 'false',
                allowEmulators: 'true',
                allowJailbrokenDevices: 'true',
                clientSideChallengeMode: 'cshui',
                enabled: 'enabled',
                iosAllowedPackageNames: [
                    'theName'
                ],
                androidPublishers: [
                    {
                        name: 'default.crt',
                        partition: 'Common'
                    },
                    {
                        name: 'testCert',
                        partition: 'TEST_DOS_Profile',
                        subPath: 'Application'
                    }
                ]
            }
        };

        const properties = [
            {
                name: 'application',
                inputValue: [
                    undefined,
                    {
                        scrubbingDuration: 42,
                        remoteTriggeredBlackHoleDuration: 10,
                        mobileDefense: {
                            enabled: true,
                            allowAndroidPublishers: [
                                { bigip: '/Common/default.crt' },
                                { use: 'testCert' }
                            ],
                            allowAndroidRootedDevice: true,
                            allowIosPackageNames: [
                                'theName'
                            ],
                            allowJailbrokenDevices: true,
                            allowEmulators: true,
                            clientSideChallengeMode: 'challenge'
                        }
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    expectedMobileDefense,
                    undefined
                ],
                referenceObjects: {
                    testCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDSjCCAjKgAwIBAgIEEYGlyTANBgkqhkiG9w0BAQsFADBnMQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxCzAJBgNVBAoTAkY1MREw\nDwYDVQQLEwhEZXYvVGVzdDEZMBcGA1UEAxMQVGVzdCBPQ1NQIFNpZ25lcjAeFw0x\nOTA0MjMxNzU0MTdaFw0yNDA0MjExNzU0MTdaMGcxCzAJBgNVBAYTAlVTMQswCQYD\nVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRsZTELMAkGA1UEChMCRjUxETAPBgNVBAsT\nCERldi9UZXN0MRkwFwYDVQQDExBUZXN0IE9DU1AgU2lnbmVyMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6mUjd2Vsclqv5NDcoPyqW2RDn7bHkCj8zemZ\ntadBNDSsoCNVNu/BAptTBgD4fRHjLlHR6NOIHCzuqnklpEQze4/1SDXL1hkDBmFS\nfon2UKUvpoUWfPjt41auEfTx1DgIHoKqT+0+C5pfCRSLy1JIQBQyh7kYiIbFzYYq\nEND2GNGrHOuX0f58ae4eU/XmAZQVJXfqsyyhak0kLOxU+vIBJpweisZKxa9C7nuX\nLI2nIGIDqexK8C5RrIc0bY2OHn0pEMv1/tYgFYjOqos6/2Sl1/ZXGX/O0kyYmzai\nnkxdM3Ozj/Q9hoLbBn40pl8BhFh6oYl5g/3nhm5Mzr1lQkvPqwIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQDc3ZSvM/aez6S63kKRP79/VE9H37woZ+sDGQkjf5yoz9hm\n+3WnbpYVw93rAbf4lkASFdRvq4ZA9UG7YWUmVKB33vrSxqEttdN7szjOBrfCOmpx\nEvftuvHPOovqkiuVcDIDxoBsmeqhtprppjl+MzaibkFx9UFHLzS0ZXo85BVtwTK+\nMSj4uv9HFT+EpmlsLOZ8PiYTkIxb5FHAArXd2Q3lkHp1n//5bUE5jurBiZqx8N6F\ndVXXIA7ghE7azooDPKBtx4pcsKpyrEdao1G4wiSICyoS/EoxTm9Vd2DybMKymIbq\nzcSE8j03hrI+dqduGxmOxwYDUBSvn9SvLW9SqBGw\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDqZSN3ZWxyWq/k\n0Nyg/KpbZEOftseQKPzN6Zm1p0E0NKygI1U278ECm1MGAPh9EeMuUdHo04gcLO6q\neSWkRDN7j/VINcvWGQMGYVJ+ifZQpS+mhRZ8+O3jVq4R9PHUOAgegqpP7T4Lml8J\nFIvLUkhAFDKHuRiIhsXNhioQ0PYY0asc65fR/nxp7h5T9eYBlBUld+qzLKFqTSQs\n7FT68gEmnB6KxkrFr0Lue5csjacgYgOp7ErwLlGshzRtjY4efSkQy/X+1iAViM6q\nizr/ZKXX9lcZf87STJibNqKeTF0zc7OP9D2GgtsGfjSmXwGEWHqhiXmD/eeGbkzO\nvWVCS8+rAgMBAAECggEAAmDeWELOM+bZrA+2fWey7tR4nzFCmyLfVdON/LrivX3f\nVoylO7Z5Feavk/sEinhY/spTv/INioOmNFKgYCdVAmb2jTIGjHiagEESjjgmKLFU\nZ3MoREJeX5UslQAQSB/9bRnUUpVMsN9zIWt08641D3lk/d2R8yiy7x/yY1NLe/r3\nsc2XecCl2DmUPnYzrl61Q264xEifPNVsikyeB5N26I7HtlQX5d1eHoIJ83TGn3Wp\nBRfxkCe0sOU+iq2f6l8PjI6mbUUaY9J81zaKZpaXK4/MlgEfeM0QNCILHIX4xUQR\nmvVo5uvIQrdIe2IvK5JaFlHI2utC8ppuOt9laGVgQQKBgQD3vW+RHzfEm+gL1YdH\nW82GXPZ3PxWrtjEtNrWhMNMrKyVG475wF14WsKo6tZnPe1DqMBRZt8GjpUZnoTBK\nYyuW/WmO6JvTsm75zvE6/fTpc7ORd987zLJUmAu8cJwkI4hY05m3Aj31cIF4DORs\nrIzpZhghS8kVX9N1f9aqcea2ywKBgQDyNcxgQxbx+6vPfqU6uN+4sKTKc/Cl10Vl\njXF5lfXX5ga244tsmQq7HEPnPtpnh7NeeqCjzhJF22Ru5bUxQUtxHbOiyWqMtGAG\nP4uFJyqJIg8hU/oWUsYmS3IF6YSb5/HyyQ0zn1aJAMwnv1Vpb6eDHXcNRBhikFLq\n0xZbbGNOoQKBgFz/1hPqXisGQ9O9cq0M/1hDKZqWKfJt0IQil4hNJdh8t9+muuSl\nQQLPivfDGFxU9IkVR25ulthxwL5COjiShdiGhMvK8kREJXjNgK0ejIPelTg0ga6X\nJxKuiSlSNKs0U4jU1k1nIA81DsUcQdux4qvzUXeeVXwanuzq8pDFdVCFAoGAWIR+\nx6NdLFxsou1G11ofMPElmHOcvA8bZoy1rti2Owvu4kHwf2TC/jTLQCTBTtrSG7I3\nKQYzuWH/p2O9v118g792GgUAMqHtAfuRMr1olytiWizFlgj0L6Sc7Do2Y3/19WOy\ntm4CAxnOgqwzO9A5aPqIuslrHAJguz8fyZOoC2ECgYEA9Y+Zp+sWjlVtMi9DoewF\nblil86us3/aCT0xFeaTPEEnJqC/Zz3xF6Bxb2B3/JT+2nvlY6ewRebUYAQrkkApM\no8MrB1IiUiot0UsyxhhoGMeOa8EgkvcyGhqK4yMaIgpgZDwX6WN6XiV8bL+bltze\nV5FCB6O5SaXnYIhegxrsfHw=\n-----END PRIVATE KEY-----'
                    }
                },
                extractFunction: (o) => {
                    const extracted = extractObject((o.application || [])[0]);
                    if (!extracted) return extracted;

                    extracted.mobileDetection.androidPublishers
                        .forEach((p) => delete p.nameReference);

                    delete extracted.fastl4AccelerationProfileReference;
                    delete extracted.captchaResponse;
                    delete extracted.heavyUrls;
                    delete extracted.botDefense;
                    delete extracted.botSignatures;
                    delete extracted.stressBased;
                    delete extracted.tcpDump;
                    delete extracted.tpsBased;

                    return extracted;
                }
            }
        ];
        return assertDosProfile(properties);
    });

    it('should succeed if only asm is enabled', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        const afm = ['afm'].every((m) => getProvisionedModules().includes(m));
        if ((asm && afm) || (!asm)) {
            this.skip();
        }

        const properties = [
            {
                name: 'application',
                inputValue: [{}],
                expectedValue: [undefined],
                extractFunction: (o) => (o.application.scrubbingDuration
                    || o.application.scrubbingEnable
                    || o.application.remoteTriggeredBlackHoleDuration
                    || o.application.rtbhEnable)
            }
        ];

        return assertDosProfile(properties);
    });

    it('should ERROR if only asm is enabled and these variables are set', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        const afm = ['afm'].every((m) => getProvisionedModules().includes(m));
        if ((asm && afm) || (!asm)) {
            this.skip();
        }

        const options = {
            checkForFail: true
        };

        const properties = [
            {
                name: 'application',
                inputValue: [
                    {
                        scrubbingDuration: 42
                    },
                    {
                        remoteTriggeredBlackHoleDuration: 42
                    }
                ]
            }
        ];

        return assertClass('DOS_Profile', properties, options);
    });

    it('14.1 bot-defense profile', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');

        const modeDuringAttacks = {
            remoteTriggeredBlackHoleDuration: 10,
            scrubbingDuration: 42,
            singlePageApplicationEnabled: true,
            botDefense: {
                mode: 'during-attacks',
                blockSuspiscousBrowsers: false,
                issueCaptchaChallenge: false,
                gracePeriod: 4000,
                crossDomainRequests: 'validate-bulk',
                siteDomains: [
                    'www.google.com'
                ],
                externalDomains: [
                    'www.yahoo.com'
                ],
                urlAllowlist: [
                    'www.bing.com'
                ]
            },
            botSignatures: {
                checkingEnabled: true,
                blockedCategories: [
                    {
                        bigip: '/Common/Search Engine'
                    },
                    {
                        bigip: '/Common/DOS Tool'
                    }
                ],
                reportedCategories: [
                    {
                        bigip: '/Common/Crawler'
                    },
                    {
                        bigip: '/Common/Exploit Tool'
                    }
                ],
                disabledSignatures: [
                    {
                        bigip: '/Common/Yandex'
                    }
                ]
            },
            mobileDefense: {
                enabled: true,
                allowAndroidPublishers: [
                    {
                        bigip: '/Common/default.crt'
                    },
                    {
                        bigip: '/Common/ca-bundle.crt'
                    }
                ],
                allowAndroidRootedDevice: true,
                allowIosPackageNames: [
                    'theName'
                ],
                allowJailbrokenDevices: true,
                allowEmulators: true,
                clientSideChallengeMode: 'challenge'
            }
        };

        const modeAlways = {
            remoteTriggeredBlackHoleDuration: 10,
            singlePageApplicationEnabled: true,
            scrubbingDuration: 1000,
            botDefense: {
                mode: 'always',
                blockSuspiscousBrowsers: true,
                issueCaptchaChallenge: true,
                gracePeriod: 5000000,
                crossDomainRequests: 'validate-upon-request',
                siteDomains: [
                    'www.yahoo.com'
                ],
                externalDomains: [
                    'www.bing.com'
                ],
                urlAllowlist: [
                    'www.google.com'
                ]
            },
            botSignatures: {
                checkingEnabled: true,
                blockedCategories: [
                    {
                        bigip: '/Common/Search Engine'
                    },
                    {
                        bigip: '/Common/DOS Tool'
                    }
                ],
                reportedCategories: [
                    {
                        bigip: '/Common/Crawler'
                    },
                    {
                        bigip: '/Common/Exploit Tool'
                    }
                ],
                disabledSignatures: [
                    {
                        bigip: '/Common/Yandex'
                    }
                ]
            },
            mobileDefense: {
                enabled: true,
                allowAndroidPublishers: [
                    {
                        bigip: '/Common/default.crt'
                    },
                    {
                        bigip: '/Common/ca-bundle.crt'
                    },
                    {
                        use: 'testCert'
                    }
                ],
                allowAndroidRootedDevice: true,
                allowIosPackageNames: [
                    'theName'
                ],
                allowJailbrokenDevices: true,
                allowEmulators: true,
                clientSideChallengeMode: 'challenge'
            }
        };

        const properties = [
            {
                name: 'application',
                inputValue: [
                    {
                        remoteTriggeredBlackHoleDuration: 20,
                        scrubbingDuration: 52
                    },
                    modeDuringAttacks,
                    modeAlways
                ],
                referenceObjects: {
                    testCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIIDSjCCAjKgAwIBAgIEEYGlyTANBgkqhkiG9w0BAQsFADBnMQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCV0ExEDAOBgNVBAcTB1NlYXR0bGUxCzAJBgNVBAoTAkY1MREw\nDwYDVQQLEwhEZXYvVGVzdDEZMBcGA1UEAxMQVGVzdCBPQ1NQIFNpZ25lcjAeFw0x\nOTA0MjMxNzU0MTdaFw0yNDA0MjExNzU0MTdaMGcxCzAJBgNVBAYTAlVTMQswCQYD\nVQQIEwJXQTEQMA4GA1UEBxMHU2VhdHRsZTELMAkGA1UEChMCRjUxETAPBgNVBAsT\nCERldi9UZXN0MRkwFwYDVQQDExBUZXN0IE9DU1AgU2lnbmVyMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6mUjd2Vsclqv5NDcoPyqW2RDn7bHkCj8zemZ\ntadBNDSsoCNVNu/BAptTBgD4fRHjLlHR6NOIHCzuqnklpEQze4/1SDXL1hkDBmFS\nfon2UKUvpoUWfPjt41auEfTx1DgIHoKqT+0+C5pfCRSLy1JIQBQyh7kYiIbFzYYq\nEND2GNGrHOuX0f58ae4eU/XmAZQVJXfqsyyhak0kLOxU+vIBJpweisZKxa9C7nuX\nLI2nIGIDqexK8C5RrIc0bY2OHn0pEMv1/tYgFYjOqos6/2Sl1/ZXGX/O0kyYmzai\nnkxdM3Ozj/Q9hoLbBn40pl8BhFh6oYl5g/3nhm5Mzr1lQkvPqwIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQDc3ZSvM/aez6S63kKRP79/VE9H37woZ+sDGQkjf5yoz9hm\n+3WnbpYVw93rAbf4lkASFdRvq4ZA9UG7YWUmVKB33vrSxqEttdN7szjOBrfCOmpx\nEvftuvHPOovqkiuVcDIDxoBsmeqhtprppjl+MzaibkFx9UFHLzS0ZXo85BVtwTK+\nMSj4uv9HFT+EpmlsLOZ8PiYTkIxb5FHAArXd2Q3lkHp1n//5bUE5jurBiZqx8N6F\ndVXXIA7ghE7azooDPKBtx4pcsKpyrEdao1G4wiSICyoS/EoxTm9Vd2DybMKymIbq\nzcSE8j03hrI+dqduGxmOxwYDUBSvn9SvLW9SqBGw\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDqZSN3ZWxyWq/k\n0Nyg/KpbZEOftseQKPzN6Zm1p0E0NKygI1U278ECm1MGAPh9EeMuUdHo04gcLO6q\neSWkRDN7j/VINcvWGQMGYVJ+ifZQpS+mhRZ8+O3jVq4R9PHUOAgegqpP7T4Lml8J\nFIvLUkhAFDKHuRiIhsXNhioQ0PYY0asc65fR/nxp7h5T9eYBlBUld+qzLKFqTSQs\n7FT68gEmnB6KxkrFr0Lue5csjacgYgOp7ErwLlGshzRtjY4efSkQy/X+1iAViM6q\nizr/ZKXX9lcZf87STJibNqKeTF0zc7OP9D2GgtsGfjSmXwGEWHqhiXmD/eeGbkzO\nvWVCS8+rAgMBAAECggEAAmDeWELOM+bZrA+2fWey7tR4nzFCmyLfVdON/LrivX3f\nVoylO7Z5Feavk/sEinhY/spTv/INioOmNFKgYCdVAmb2jTIGjHiagEESjjgmKLFU\nZ3MoREJeX5UslQAQSB/9bRnUUpVMsN9zIWt08641D3lk/d2R8yiy7x/yY1NLe/r3\nsc2XecCl2DmUPnYzrl61Q264xEifPNVsikyeB5N26I7HtlQX5d1eHoIJ83TGn3Wp\nBRfxkCe0sOU+iq2f6l8PjI6mbUUaY9J81zaKZpaXK4/MlgEfeM0QNCILHIX4xUQR\nmvVo5uvIQrdIe2IvK5JaFlHI2utC8ppuOt9laGVgQQKBgQD3vW+RHzfEm+gL1YdH\nW82GXPZ3PxWrtjEtNrWhMNMrKyVG475wF14WsKo6tZnPe1DqMBRZt8GjpUZnoTBK\nYyuW/WmO6JvTsm75zvE6/fTpc7ORd987zLJUmAu8cJwkI4hY05m3Aj31cIF4DORs\nrIzpZhghS8kVX9N1f9aqcea2ywKBgQDyNcxgQxbx+6vPfqU6uN+4sKTKc/Cl10Vl\njXF5lfXX5ga244tsmQq7HEPnPtpnh7NeeqCjzhJF22Ru5bUxQUtxHbOiyWqMtGAG\nP4uFJyqJIg8hU/oWUsYmS3IF6YSb5/HyyQ0zn1aJAMwnv1Vpb6eDHXcNRBhikFLq\n0xZbbGNOoQKBgFz/1hPqXisGQ9O9cq0M/1hDKZqWKfJt0IQil4hNJdh8t9+muuSl\nQQLPivfDGFxU9IkVR25ulthxwL5COjiShdiGhMvK8kREJXjNgK0ejIPelTg0ga6X\nJxKuiSlSNKs0U4jU1k1nIA81DsUcQdux4qvzUXeeVXwanuzq8pDFdVCFAoGAWIR+\nx6NdLFxsou1G11ofMPElmHOcvA8bZoy1rti2Owvu4kHwf2TC/jTLQCTBTtrSG7I3\nKQYzuWH/p2O9v118g792GgUAMqHtAfuRMr1olytiWizFlgj0L6Sc7Do2Y3/19WOy\ntm4CAxnOgqwzO9A5aPqIuslrHAJguz8fyZOoC2ECgYEA9Y+Zp+sWjlVtMi9DoewF\nblil86us3/aCT0xFeaTPEEnJqC/Zz3xF6Bxb2B3/JT+2nvlY6ewRebUYAQrkkApM\no8MrB1IiUiot0UsyxhhoGMeOa8EgkvcyGhqK4yMaIgpgZDwX6WN6XiV8bL+bltze\nV5FCB6O5SaXnYIhegxrsfHw=\n-----END PRIVATE KEY-----'
                    }
                },
                expectedValue: [
                    {
                        crossDomainRequests: 'allow-all',
                        classOverrides: [
                            {
                                name: 'Browser',
                                verification: { action: 'none' },
                                mitigation: { action: 'none' }
                            }
                        ],
                        dosAttackStrictMitigation: 'enabled',
                        enforcementMode: 'transparent',
                        externalDomains: [],
                        gracePeriod: 300,
                        mobileDetection: {
                            allowAndroidRootedDevice: 'disabled',
                            allowAnyAndroidPackage: 'enabled',
                            allowAnyIosPackage: 'enabled',
                            allowEmulators: 'disabled',
                            allowJailbrokenDevices: 'disabled',
                            blockDebuggerEnabledDevice: 'enabled',
                            clientSideChallengeMode: 'pass'
                        },
                        name: `${PREFIX}${getItemName({ tenantName, maxPathLength: MAX_PATH_LENGTH })}${POSTFIX}`,
                        signatureCategoryOverrides: [],
                        signatureOverrides: [],
                        singlePageApplication: 'disabled',
                        siteDomains: [],
                        whitelist: []
                    },
                    {
                        crossDomainRequests: 'validate-bulk',
                        classOverrides: [
                            {
                                name: 'Browser',
                                verification: { action: 'none' },
                                mitigation: { action: 'none' }
                            }
                        ],
                        dosAttackStrictMitigation: 'enabled',
                        enforcementMode: 'blocking',
                        gracePeriod: 4000,
                        mobileDetection: {
                            allowAndroidRootedDevice: 'enabled',
                            allowAnyAndroidPackage: 'disabled',
                            allowAnyIosPackage: 'disabled',
                            allowEmulators: 'enabled',
                            allowJailbrokenDevices: 'enabled',
                            blockDebuggerEnabledDevice: 'enabled',
                            clientSideChallengeMode: 'cshui',
                            androidPublishers: [
                                {
                                    name: 'ca-bundle.crt',
                                    partition: 'Common'
                                },
                                {
                                    name: 'default.crt',
                                    partition: 'Common'
                                }
                            ],
                            iosAllowedPackages: [
                                {
                                    name: 'theName'
                                }
                            ]
                        },
                        name: `${PREFIX}${getItemName({ tenantName, maxPathLength: MAX_PATH_LENGTH })}${POSTFIX}`,
                        singlePageApplication: 'enabled',
                        signatureCategoryOverrides: [
                            {
                                name: 'Crawler',
                                action: 'alarm'
                            },
                            {
                                name: 'DOS Tool',
                                action: 'block'
                            },
                            {
                                name: 'Exploit Tool',
                                action: 'alarm'
                            },
                            {
                                name: 'Search Engine',
                                action: 'block'
                            }
                        ],
                        signatureOverrides: [
                            {
                                name: 'Yandex',
                                action: 'alarm'
                            }
                        ],
                        siteDomains: [
                            {
                                name: 'www.google.com'
                            }
                        ],
                        whitelist: [
                            {
                                name: 'url_0',
                                url: 'www.bing.com'
                            }
                        ],
                        externalDomains: [
                            {
                                name: 'www.yahoo.com'
                            }
                        ]
                    },
                    {
                        crossDomainRequests: 'validate-upon-request',
                        classOverrides: [
                            {
                                name: 'Browser',
                                verification: { action: 'browser-verify-before-access' },
                                mitigation: { action: 'none' }
                            },
                            {
                                name: 'Suspicious Browser',
                                mitigation: { action: 'captcha' },
                                verification: { action: 'none' }
                            },
                            {
                                name: 'Unknown',
                                verification: { action: 'none' },
                                mitigation: { action: 'tcp-reset' }
                            }

                        ],
                        dosAttackStrictMitigation: 'disabled',
                        enforcementMode: 'blocking',
                        gracePeriod: 5000000,
                        mobileDetection: {
                            allowAndroidRootedDevice: 'enabled',
                            allowAnyAndroidPackage: 'disabled',
                            allowAnyIosPackage: 'disabled',
                            allowEmulators: 'enabled',
                            allowJailbrokenDevices: 'enabled',
                            blockDebuggerEnabledDevice: 'enabled',
                            clientSideChallengeMode: 'cshui',
                            androidPublishers: [
                                {
                                    name: 'ca-bundle.crt',
                                    partition: 'Common'
                                },
                                {
                                    name: 'default.crt',
                                    partition: 'Common'
                                },
                                {
                                    name: 'testCert',
                                    partition: 'TEST_DOS_Profile',
                                    subPath: 'Application'
                                }
                            ],
                            iosAllowedPackages: [
                                {
                                    name: 'theName'
                                }
                            ]
                        },
                        name: `${PREFIX}${getItemName({ tenantName, maxPathLength: MAX_PATH_LENGTH })}${POSTFIX}`,
                        singlePageApplication: 'enabled',
                        signatureCategoryOverrides: [
                            {
                                name: 'Crawler',
                                action: 'alarm'
                            },
                            {
                                name: 'DOS Tool',
                                action: 'block'
                            },
                            {
                                name: 'Exploit Tool',
                                action: 'alarm'
                            },
                            {
                                name: 'Search Engine',
                                action: 'block'
                            }
                        ],
                        signatureOverrides: [
                            {
                                name: 'Yandex',
                                action: 'alarm'
                            }
                        ],
                        siteDomains: [
                            {
                                name: 'www.yahoo.com'
                            }
                        ],
                        whitelist: [
                            {
                                name: 'url_0',
                                url: 'www.google.com'
                            }
                        ],
                        externalDomains: [
                            {
                                name: 'www.bing.com'
                            }
                        ]
                    }
                ],
                extractFunction: (o) => {
                    const result = {};
                    result.name = o.name;
                    result.crossDomainRequests = o.crossDomainRequests;
                    result.dosAttackStrictMitigation = o.dosAttackStrictMitigation;
                    result.enforcementMode = o.enforcementMode;
                    result.gracePeriod = o.gracePeriod;
                    result.mobileDetection = o.mobileDetection;
                    if (result.mobileDetection.androidPublishers) {
                        result.mobileDetection.androidPublishers.forEach((p) => {
                            delete p.nameReference;
                        });
                    }
                    result.singlePageApplication = o.singlePageApplication;
                    result.signatureCategoryOverrides = [];
                    o.signatureCategoryOverrides.forEach((category) => {
                        result.signatureCategoryOverrides.push({
                            name: category.name,
                            action: category.action
                        });
                    });
                    result.externalDomains = [];
                    o.externalDomains.forEach((domain) => {
                        result.externalDomains.push({
                            name: domain.name
                        });
                    });
                    result.classOverrides = o.classOverrides.map((cl) => ({
                        name: cl.name,
                        mitigation: { action: cl.mitigation.action },
                        verification: { action: cl.verification.action }
                    }));
                    result.signatureOverrides = [];
                    o.signatureOverrides.forEach((signature) => {
                        result.signatureOverrides.push({
                            name: signature.name,
                            action: signature.action
                        });
                    });
                    result.siteDomains = [];
                    o.siteDomains.forEach((domain) => {
                        result.siteDomains.push({
                            name: domain.name
                        });
                    });
                    result.whitelist = [];
                    o.whitelist.forEach((url) => {
                        if (url.name.includes('url')) {
                            result.whitelist.push({
                                name: url.name,
                                url: url.url
                            });
                        }
                    });
                    return result;
                }
            }
        ];
        const options = {
            getMcpObject: {
                findAll: true,
                itemName: `${PREFIX}${getItemName({ tenantName, maxPathLength: MAX_PATH_LENGTH })}${POSTFIX}`
            }
        };
        return assertDosProfile(properties, options);
    });
});

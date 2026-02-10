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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const util = require('../../../../src/lib/util/util');

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Service_HTTP with DOS_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'afm');
        assertModuleProvisioned.call(this, 'asm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should check that bot defense profile is created and attached as specified ', () => {
        const declDefaults = {
            class: 'ADC',
            schemaVersion: '3.26.0',
            id: 'DOS_Profile',
            controls: {
                logLevel: 'debug',
                trace: true,
                traceResponse: true
            },
            Sample_dos_01: {
                class: 'Tenant',
                DOSApp: {
                    class: 'Application',
                    Service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.1'
                        ],
                        profileDOS: {
                            use: 'DOS_Profile'
                        }
                    },
                    DOS_Profile: {
                        class: 'DOS_Profile',
                        application: {
                            denylistedGeolocations: [
                                'Timor-Leste',
                                'Cocos (Keeling) Islands'
                            ],
                            allowlistedGeolocations: [
                                'Bonaire, Saint Eustatius and Saba',
                                "Cote D'Ivoire"
                            ],
                            captchaResponse: {
                                first: 'Are you a robot&quest;<br><br>%DOSL7.captcha.image% %DOSL7.captcha.change%<br><b>What code is in the image&quest;</b>%DOSL7.captcha.solution%<br>%DOSL7.captcha.submit%<br><br>Your supportID is: %DOSL7.captcha.support_id%.',
                                failure: 'Error!<br><br>%DOSL7.captcha.image% %DOSL7.captcha.change%<br><b>What code is in the image&quest;</b>%DOSL7.captcha.solution%<br>%DOSL7.captcha.submit%<br><br>Your support ID is: %DOSL7.captcha.support_id%.'
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
                            scrubbingDuration: 42,
                            remoteTriggeredBlackHoleDuration: 10,
                            botDefense: {
                                // createBotDefenseProfile has default value of true here
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
                            botSignatures: {
                                checkingEnabled: true,
                                blockedCategories: [
                                    {
                                        bigip: '/Common/Search Engine'
                                    }
                                ],
                                reportedCategories: [
                                    {
                                        bigip: '/Common/Crawler'
                                    }
                                ]
                            },
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
                                badActor: {
                                    detectionEnabled: false,
                                    mitigationMode: 'none',
                                    signatureDetectionEnabled: false,
                                    useApprovedSignaturesOnly: false
                                },
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
                        },
                        network: {
                            dynamicSignatures: {
                                detectionMode: 'enabled',
                                mitigationMode: 'medium',
                                scrubbingEnabled: true,
                                scrubbingCategory: {
                                    bigip: '/Common/attacked_ips'
                                },
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
                                        category: {
                                            bigip: '/Common/botnets'
                                        },
                                        attackDetectionTime: 1,
                                        categoryDuration: 60,
                                        externalAdvertisementEnabled: true
                                    }
                                }
                            ]
                        },
                        protocolDNS: {
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
                        allowlist: {
                            use: 'addressList'
                        },
                        applicationAllowlist: {
                            use: 'addressListHTTP'
                        }
                    },
                    addressList: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '10.0.0.10'
                        ]
                    },
                    addressListHTTP: {
                        class: 'Firewall_Address_List',
                        addresses: [
                            '10.0.0.11'
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            // 1st POST
            .then(() => assert.isFulfilled(
                postDeclaration(declDefaults, { declarationIndex: 0 })
            ))
            // check the DOS_Profile fullPath
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/security/dos/profile/~Sample_dos_01~DOSApp~DOS_Profile')
            ))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Sample_dos_01/DOSApp/DOS_Profile');
            })
            // check the bot defense profile
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/security/bot-defense/profile/~Sample_dos_01~DOSApp~f5_appsvcs_DOS_Profile_botDefense')
            ))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Sample_dos_01/DOSApp/f5_appsvcs_DOS_Profile_botDefense');
            })
            // check the Service_HTTP profiles
            .then(() => assert.isFulfilled(
                getPath('https://localhost/mgmt/tm/ltm/virtual/~Sample_dos_01~DOSApp~Service/profiles')
            ))
            .then((response) => {
                assert.strictEqual(response.items.length, 4);
                assert.strictEqual(response.items[0].fullPath, '/Common/f5-tcp-progressive');
                assert.strictEqual(response.items[1].fullPath, '/Common/http');
                assert.strictEqual(response.items[2].fullPath, '/Sample_dos_01/DOSApp/DOS_Profile');
                assert.strictEqual(response.items[3].fullPath, '/Sample_dos_01/DOSApp/f5_appsvcs_DOS_Profile_botDefense');
            })
            // 2nd POST
            .then(() => {
                const decl = util.simpleCopy(declDefaults);
                decl.Sample_dos_01.DOSApp.DOS_Profile.application.botDefense.createBotDefenseProfile = false;
                return assert.isFulfilled(postDeclaration(decl, { declarationIndex: 1 }));
            })
            // check the DOS_Profile fullPath
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/security/dos/profile/~Sample_dos_01~DOSApp~DOS_Profile')
            ))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Sample_dos_01/DOSApp/DOS_Profile');
            })
            // check the bot defense profile
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/security/bot-defense/profile/~Sample_dos_01~DOSApp~f5_appsvcs_DOS_Profile_botDefense')
            ))
            // check the Service_HTTP profiles
            .then(() => assert.isFulfilled(
                getPath('https://localhost/mgmt/tm/ltm/virtual/~Sample_dos_01~DOSApp~Service/profiles')
            ))
            .then((response) => {
                assert.strictEqual(response.items.length, 3);
                assert.strictEqual(response.items[0].fullPath, '/Common/f5-tcp-progressive');
                assert.strictEqual(response.items[1].fullPath, '/Common/http');
                assert.strictEqual(response.items[2].fullPath, '/Sample_dos_01/DOSApp/DOS_Profile');
            })
            // 3rd POST
            .then(() => {
                const decl = util.simpleCopy(declDefaults);
                decl.Sample_dos_01.DOSApp.DOS_Profile.application.botDefense.createBotDefenseProfile = true;
                return assert.isFulfilled(postDeclaration(decl, { declarationIndex: 2 }));
            })
            // check the DOS_Profile fullPath
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/security/dos/profile/~Sample_dos_01~DOSApp~DOS_Profile')
            ))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Sample_dos_01/DOSApp/DOS_Profile');
            })
            // check the bot defense profile
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/security/bot-defense/profile/~Sample_dos_01~DOSApp~f5_appsvcs_DOS_Profile_botDefense')
            ))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Sample_dos_01/DOSApp/f5_appsvcs_DOS_Profile_botDefense');
            })
            // check the Service_HTTP profiles
            .then(() => assert.isFulfilled(
                getPath('https://localhost/mgmt/tm/ltm/virtual/~Sample_dos_01~DOSApp~Service/profiles')
            ))
            .then((response) => {
                assert.strictEqual(response.items.length, 4);
                assert.strictEqual(response.items[0].fullPath, '/Common/f5-tcp-progressive');
                assert.strictEqual(response.items[1].fullPath, '/Common/http');
                assert.strictEqual(response.items[2].fullPath, '/Sample_dos_01/DOSApp/DOS_Profile');
                assert.strictEqual(response.items[3].fullPath, '/Sample_dos_01/DOSApp/f5_appsvcs_DOS_Profile_botDefense');
            });
    });
});

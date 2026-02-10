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
    assertModuleProvisioned,
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Bot_Defense_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertBotDefenseProfileClass(properties, options) {
        return assertClass('Bot_Defense_Profile', properties, options);
    }

    it('All properties', () => {
        assertModuleProvisioned.call(this, 'asm');

        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/security/bot-defense/signature',
                    data: {
                        name: 'mobileAppBotSignature',
                        category: '/Common/Mobile App without SDK',
                        url: {
                            matchType: 'contains'
                        },
                        userAgent: {
                            matchType: 'contains',
                            searchString: 'abc'
                        },
                        userDefined: 'true'
                    }
                }
            ]
        };
        const mobileDetectionInput = {
            enabled: true,
            allowAndroidRootedDevice: true,
            allowJailbrokenDevices: true,
            allowEmulators: true,
            clientSideChallengeMode: 'pass'
        };
        const defaultMobileDetectionExpected = {
            allowAndroidRootedDevice: 'disabled',
            allowAnyAndroidPackage: 'enabled',
            allowAnyIosPackage: 'enabled',
            allowEmulators: 'disabled',
            allowJailbrokenDevices: 'disabled',
            blockDebuggerEnabledDevice: 'enabled',
            clientSideChallengeMode: 'pass'
        };
        const mobileDetectionExpected1 = {
            allowAndroidRootedDevice: 'enabled',
            allowAnyAndroidPackage: 'enabled',
            allowAnyIosPackage: 'enabled',
            allowEmulators: 'enabled',
            allowJailbrokenDevices: 'enabled',
            blockDebuggerEnabledDevice: 'enabled',
            clientSideChallengeMode: 'pass'
        };
        const mitigationSettingsInput = [
            {
                mitigationType: 'Suspicious Browser',
                mitigationSettingsAction: 'block',
                verificationSettingsAction: 'none'
            },
            {
                mitigationType: 'Unknown',
                mitigationSettingsAction: 'tcp-reset',
                verificationSettingsAction: 'none'
            }
        ];
        const mitigationSettingsExpected = [
            {
                name: 'Suspicious Browser',
                verification: { action: 'none' },
                mitigation: { action: 'block', rateLimitTps: 30 }
            },
            {
                name: 'Unknown',
                verification: { action: 'none' },
                mitigation: { action: 'tcp-reset', rateLimitTps: 30 }
            }
        ];

        const properties = [
            {
                name: 'enforcementMode',
                inputValue: [undefined, 'blocking', undefined],
                expectedValue: ['transparent', 'blocking', 'transparent']
            },
            {
                name: 'signatureStagingUponUpdate',
                inputValue: [undefined, 'enabled', undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'enforcementReadinessPeriod',
                inputValue: [undefined, 10, undefined],
                expectedValue: [7, 10, 7]
            },
            {
                name: 'mitigationSettings',
                inputValue: [undefined, mitigationSettingsInput, undefined],
                expectedValue: [[], mitigationSettingsExpected, []],
                extractFunction: (o) => {
                    if (o.classOverrides && o.classOverrides.length > 0) {
                        return o.classOverrides.map((ob) => ({
                            name: ob.name, verification: ob.verification, mitigation: ob.mitigation
                        }));
                    }
                    return [];
                }
            },
            {
                name: 'allowBrowserAccess',
                inputValue: [undefined, 'disabled', undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'gracePeriod',
                inputValue: [undefined, 500, undefined],
                expectedValue: [300, 500, 300]
            },
            {
                name: 'deviceIDMode',
                inputValue: [undefined, 'generate-before-access', undefined],
                expectedValue: ['generate-after-access', 'generate-before-access', 'generate-after-access'],
                extractFunction: (o) => o.deviceidMode
            },
            {
                name: 'dosMitigation',
                inputValue: [undefined, 'disabled', undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                extractFunction: (o) => o.dosAttackStrictMitigation
            },
            {
                name: 'performChallengeInTransparent',
                inputValue: [undefined, 'enabled', undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'singlePageApplicationEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.singlePageApplication
            },
            {
                name: 'browserMitigationAction',
                inputValue: [undefined, 'block', undefined],
                expectedValue: ['none', 'block', 'none']
            },
            {
                name: 'crossDomainRequests',
                inputValue: [undefined, 'validate-bulk', undefined],
                expectedValue: ['allow-all', 'validate-bulk', 'allow-all']
            },
            {
                name: 'siteDomains',
                inputValue: [undefined, ['www.abc.com'], undefined],
                expectedValue: [[], ['www.abc.com'], []],
                extractFunction: (o) => o.siteDomains.map((ob) => ob.name)
            },
            {
                name: 'externalDomains',
                inputValue: [undefined, ['www.abc1.com'], undefined],
                expectedValue: [[], ['www.abc1.com'], []],
                extractFunction: (o) => o.externalDomains.map((ob) => ob.name)
            },
            {
                name: 'mobileDefense',
                inputValue: [undefined, mobileDetectionInput, undefined],
                expectedValue: [
                    defaultMobileDetectionExpected,
                    mobileDetectionExpected1,
                    defaultMobileDetectionExpected
                ],
                extractFunction: (o) => o.mobileDetection
            },
            {
                name: 'signatures',
                inputValue: [undefined, [{ bigip: '/Common/mobileAppBotSignature' }], undefined],
                expectedValue: [[], ['/Common/mobileAppBotSignature'], []],
                extractFunction: (o) => {
                    if (o.mobileDetection && o.mobileDetection.signatures && o.mobileDetection.signatures.length > 0) {
                        return [`/${o.mobileDetection.signatures[0].partition}/${o.mobileDetection.signatures[0].name}`];
                    }
                    return [];
                }
            },
            {
                name: 'stagedSignatures',
                inputValue: [undefined, [{ bigip: '/Common/mobileAppBotSignature' }], undefined],
                expectedValue: [[], ['/Common/mobileAppBotSignature'], []],
                extractFunction: (o) => {
                    if (o.stagedSignatures && o.stagedSignatures.length > 0) {
                        return [o.stagedSignatures[0].fullPath];
                    }
                    return [];
                }
            },
            {
                name: 'urlAllowlist',
                inputValue: [undefined, ['www.abc2.com'], undefined],
                expectedValue: [[], ['www.abc2.com'], []],
                extractFunction: (o) => {
                    if (o.whitelist.length > 2) {
                        return [o.whitelist[2].url];
                    }
                    return [];
                }
            }
        ];

        return assertBotDefenseProfileClass(properties, options);
    });
});

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

const assert = require('assert');
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail',
        jsonPointers: true
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const formats = require('../../../src/lib/adcParserFormats');
const keywords = require('../../../src/lib/adcParserKeywords');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const parserScope = {
    _postProcess: []
};
keywords.keywords.forEach((keyword) => ajv.addKeyword(keyword.name, keyword.definition(parserScope)));

const validate = ajv
    .compile(adcSchema);

describe('def-dos-schema.json', () => {
    describe('DOS_Profile', () => {
        describe('allowlist', () => {
            let decl;

            beforeEach(() => {
                decl = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            dosProfile: {
                                class: 'DOS_Profile'
                            }
                        }
                    }
                };
            });

            it('should succeed with Firewall Address Lists', () => {
                decl.tenant.application.dosProfile.allowlist = { use: 'firewallAddressList' };
                decl.tenant.application.firewallAddressList = {
                    class: 'Firewall_Address_List',
                    addresses: [
                        '192.0.2.0/24',
                        '233.252.0.0/24'
                    ],
                    geo: [
                        'US:Idaho'
                    ]
                };

                assert.ok(validate(decl), getErrorString(validate));
                assert.deepStrictEqual(parserScope._postProcess,
                    [
                        {
                            instancePath: '/tenant/application/dosProfile/allowlist/use',
                            parentDataProperty: 'use',
                            tag: 'pointer',
                            schemaData: {
                                properties: {
                                    class: {
                                        enum: [
                                            'Firewall_Address_List',
                                            'Net_Address_List'
                                        ]
                                    }

                                },
                                required: ['class']
                            }
                        },
                        {
                            instancePath: '/tenant/application/dosProfile/allowlist',
                            parentDataProperty: 'allowlist',
                            schemaData: [
                                'query security firewall address-list',
                                'query net address-list'
                            ],
                            tag: 'bigComponent'
                        },
                        {
                            instancePath: '/tenant/application/dosProfile',
                            parentDataProperty: 'dosProfile',
                            tag: 'modules',
                            schemaData: ['afm', 'asm']
                        },
                        {
                            instancePath: '/tenant/application/dosProfile',
                            parentDataProperty: 'dosProfile',
                            schemaData: {
                                allowlist: 'whitelist',
                                applicationAllowlist: 'applicationWhitelist'
                            },
                            tag: 'aliases'
                        },
                        {
                            instancePath: '/tenant/application/firewallAddressList',
                            parentDataProperty: 'firewallAddressList',
                            tag: 'modules',
                            schemaData: ['afm', 'asm']
                        },
                        {
                            instancePath: '/tenant/defaultRouteDomain',
                            parentDataProperty: 'defaultRouteDomain',
                            schemaData: ['query net route-domain'],
                            tag: 'bigComponent'
                        }
                    ]);
            });

            it('should succeed with Net Address Lists in applicationAllowlist & allowlist', () => {
                decl.tenant.application.dosProfile.allowlist = { use: 'netAddressList' };
                decl.tenant.application.dosProfile.applicationAllowlist = { use: 'netAddressList' };
                decl.tenant.application.netAddressList = {
                    class: 'Net_Address_List',
                    addresses: [
                        '192.0.2.0/24',
                        '233.252.0.0/24'
                    ]
                };

                assert.ok(validate(decl), getErrorString(validate));
            });
        });

        describe('.localZones', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'DNS_Cache',
                                type: 'transparent',
                                localZones: value
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow SRV record', () => testValue(
                {
                    '_sip._tcp.example.com': {
                        type: 'transparent',
                        records: [
                            '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                        ]
                    }
                },
                true
            ));
        });
    });

    describe('Bot_Defense_Profile', () => {
        it('should validate all properties of Bot_Defense_Profile', () => {
            const decl = {
                class: 'ADC',
                schemaVersion: '3.56.0',
                id: 'Bot_Defense_Profile_Sample',
                theTenant: {
                    class: 'Tenant',
                    theApplication: {
                        class: 'Application',
                        botProfile: {
                            class: 'Bot_Defense_Profile',
                            enforcementMode: 'blocking',
                            signatureStagingUponUpdate: 'enabled',
                            enforcementReadinessPeriod: 10,
                            mitigationSettings: [
                                {
                                    mitigationType: 'Unknown',
                                    mitigationSettingsAction: 'tcp-reset',
                                    verificationSettingsAction: 'none'
                                },
                                {
                                    mitigationType: 'Suspicious Browser',
                                    mitigationSettingsAction: 'block',
                                    verificationSettingsAction: 'none'
                                }
                            ],
                            allowBrowserAccess: 'enabled',
                            gracePeriod: 4000,
                            deviceIDMode: 'generate-after-access',
                            performChallengeInTransparent: 'enabled',
                            singlePageApplicationEnabled: true,
                            crossDomainRequests: 'validate-bulk',
                            siteDomains: ['www.google.com'],
                            externalDomains: ['www.yahoo.com'],
                            mobileDefense: {
                                enabled: true,
                                allowAndroidPublishers: [
                                    {
                                        bigip: '/Common/default.crt'
                                    }
                                ],
                                allowAndroidRootedDevice: true,
                                allowIosPackageNames: ['theName'],
                                allowJailbrokenDevices: true,
                                allowEmulators: true,
                                clientSideChallengeMode: 'challenge'
                            },
                            signatures: [
                                {
                                    bigip: '/Common/default'
                                }
                            ],
                            stagedSignatures: [
                                {
                                    bigip: '/Common/default1'
                                }
                            ],
                            urlAllowlist: ['www.bing.com']
                        }
                    }
                }
            };

            assert.ok(validate(decl), getErrorString(validate));
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

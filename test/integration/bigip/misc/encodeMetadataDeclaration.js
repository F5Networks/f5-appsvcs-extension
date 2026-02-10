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

const {
    postDeclaration,
    deleteBigipItems,
    getDeclaration,
    getPath,
    GLOBAL_TIMEOUT,
    deleteDeclaration
} = require('../property/propertiesCommon');

describe('encodeMetadataDeclaration setting', function () {
    this.timeout(GLOBAL_TIMEOUT);

    const settingsPath = '/mgmt/shared/appsvcs/settings';
    function postSettings(settings) {
        return postDeclaration(
            settings,
            { declarationIndex: 0 },
            '?async=false',
            settingsPath
        );
    }

    function cleanDataGroups() {
        return Promise.resolve()
            .then(() => getPath('/mgmt/tm/ltm/data-group/internal'))
            .then((response) => {
                if (response.items) {
                    // eslint-disable-next-line consistent-return
                    const as3DataGroup = response.items.filter((item) => item.description && item.description.indexOf('f5 AS3 declaration') !== -1);
                    const bigipItems = as3DataGroup.map((datagroup) => ({
                        endpoint: '/mgmt/tm/ltm/data-group/internal',
                        data: { name: `~Common~${datagroup.name}` }
                    }));
                    return Promise.resolve()
                        .then(() => deleteBigipItems(bigipItems));
                }
                return Promise.resolve();
            });
    }

    const defaults = {
        asyncTaskStorage: 'data-group',
        perAppDeploymentAllowed: true,
        burstHandlingEnabled: false,
        performanceTracingEnabled: false,
        performanceTracingEndpoint: '',
        serializeFileUploads: false,
        serviceDiscoveryEnabled: true,
        encodeDeclarationMetadata: false,
        webhook: ''
    };
    function resetDefaults() {
        return postSettings({});
    }
    beforeEach(() => resetDefaults());

    it('Verify encodeMetadataDeclaration setting', () => {
        const decl0 = {
            class: 'AS3',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                label: 'Sample 1',
                Sample_01: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.1.9'
                            ],
                            pool: 'web_pool'
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: [
                                'http'
                            ],
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.1.10',
                                        '192.0.1.11'
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        const decl1 = {
            class: 'AS3',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                id: 'urn:uuid:33045210-3ab8-4636-9b2a-c98d22ab915d',
                label: 'Sample 1',
                Sample_02: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.1.20'
                            ],
                            pool: 'web_pool'
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: [
                                'http'
                            ],
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.1.21',
                                        '192.0.1.22'
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };
        const declSettings = {
            asyncTaskStorage: 'memory',
            perAppDeploymentAllowed: false,
            burstHandlingEnabled: true,
            performanceTracingEnabled: false, // need to leave false because jaeger-client not installed
            performanceTracingEndpoint: 'http://196.168.0.1/api/traces',
            serializeFileUploads: true,
            serviceDiscoveryEnabled: false,
            encodeDeclarationMetadata: true,
            webhook: 'https://www.example.com'
        };

        function assertResponse(response, values) {
            assert.deepStrictEqual(response, values);
        }

        return Promise.resolve()
            .then(() => postDeclaration(decl0, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postSettings(declSettings))
            .then((response) => assertResponse(response, declSettings))
            .then(() => getDeclaration())
            .then((response) => {
                delete response.controls;
                delete response.id;
                assert.deepStrictEqual(
                    response,
                    {
                        class: 'ADC',
                        schemaVersion: '3.53.0',
                        label: 'Sample 1',
                        Sample_01: {
                            class: 'Tenant',
                            A1: {
                                class: 'Application',
                                service: {
                                    class: 'Service_HTTP',
                                    virtualAddresses: [
                                        '192.0.1.9'
                                    ],
                                    pool: 'web_pool'
                                },
                                web_pool: {
                                    class: 'Pool',
                                    monitors: [
                                        'http'
                                    ],
                                    members: [
                                        {
                                            servicePort: 80,
                                            serverAddresses: [
                                                '192.0.1.10',
                                                '192.0.1.11'
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        updateMode: 'selective'
                    }
                );
            })
            .then(() => postDeclaration(decl0, { declarationIndex: 0 }))
            .then(() => getDeclaration())
            .then((response) => {
                delete response.controls;
                delete response.id;
                assert.deepStrictEqual(
                    response,
                    {
                        class: 'ADC',
                        schemaVersion: '3.53.0',
                        label: 'Sample 1',
                        Sample_01: {
                            class: 'Tenant',
                            A1: {
                                class: 'Application',
                                service: {
                                    class: 'Service_HTTP',
                                    virtualAddresses: [
                                        '192.0.1.9'
                                    ],
                                    pool: 'web_pool'
                                },
                                web_pool: {
                                    class: 'Pool',
                                    monitors: [
                                        'http'
                                    ],
                                    members: [
                                        {
                                            servicePort: 80,
                                            serverAddresses: [
                                                '192.0.1.10',
                                                '192.0.1.11'
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        updateMode: 'selective'
                    }
                );
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 0 }))
            .then(() => getDeclaration())
            .then((response) => {
                delete response.controls;
                delete response.id;
                assert.deepStrictEqual(
                    response,
                    {
                        Sample_01: {
                            class: 'Tenant',
                            A1: {
                                class: 'Application',
                                service: {
                                    class: 'Service_HTTP',
                                    virtualAddresses: [
                                        '192.0.1.9'
                                    ],
                                    pool: 'web_pool'
                                },
                                web_pool: {
                                    class: 'Pool',
                                    monitors: [
                                        'http'
                                    ],
                                    members: [
                                        {
                                            servicePort: 80,
                                            serverAddresses: [
                                                '192.0.1.10',
                                                '192.0.1.11'
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        class: 'ADC',
                        schemaVersion: '3.53.0',
                        label: 'Sample 1',
                        Sample_02: {
                            class: 'Tenant',
                            A1: {
                                class: 'Application',
                                service: {
                                    class: 'Service_HTTP',
                                    virtualAddresses: [
                                        '192.0.1.20'
                                    ],
                                    pool: 'web_pool'
                                },
                                web_pool: {
                                    class: 'Pool',
                                    monitors: [
                                        'http'
                                    ],
                                    members: [
                                        {
                                            servicePort: 80,
                                            serverAddresses: [
                                                '192.0.1.21',
                                                '192.0.1.22'
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        updateMode: 'selective'
                    }
                );
            })
            .then(() => deleteDeclaration('Sample_01'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => {
                // revert metadata encoding
                declSettings.encodeDeclarationMetadata = false;
                return postSettings(declSettings);
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 0 }))
            .then((response) => {
                // post should fail because metadata of previous declaration is encoded
                assert.strictEqual(response.results[0].code, 500);
                assert.strictEqual(response.results[0].message, 'cannot fetch declaration 0 from localhost (declaration stored on target seems encoded.)');
            })
            .then(() => {
                declSettings.encodeDeclarationMetadata = true;
                return postSettings(declSettings);
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 0 }))
            .then((response) => {
                // post should pass because encoding is re-enabled
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration('Sample_02'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .finally(() => deleteDeclaration()
                .then(() => cleanDataGroups()) // delete all encoded datagroups
                .then(() => postSettings(defaults))); // restore settings
    });
});

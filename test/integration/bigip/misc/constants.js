/**
 * Copyright 2025 F5, Inc.
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
    deleteDeclaration,
    getPath,
    getProvisionedModules,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('constants', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should set or modify constants when Application is disabled ', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            CONSTANTS_T1: {
                class: 'Tenant',
                constants: {
                    class: 'Constants',
                    constKey: 'oldValue'
                },
                DemoApp: {
                    class: 'Application',
                    enable: false,
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.9'
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled( // first POST
                postDeclaration(declaration, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.strictEqual(response.CONSTANTS_T1.constants.constKey, 'oldValue');
                assert.strictEqual(response.CONSTANTS_T1.DemoApp.enable, false);
                assert.strictEqual(response.CONSTANTS_T1.DemoApp.serviceMain.virtualAddresses[0], '192.0.2.9');
            })
            .then(() => { // second POST
                declaration.CONSTANTS_T1.constants.constKey = 'newValue';
                declaration.CONSTANTS_T1.DemoApp.serviceMain.virtualAddresses[0] = '192.0.2.10';
                return assert.isFulfilled(postDeclaration(declaration, { declarationIndex: 1 }));
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.strictEqual(response.CONSTANTS_T1.constants.constKey, 'newValue');
                assert.strictEqual(response.CONSTANTS_T1.DemoApp.enable, false);
                assert.strictEqual(response.CONSTANTS_T1.DemoApp.serviceMain.virtualAddresses[0], '192.0.2.10');
            });
    });

    it('should use correct profile when constants are at the Application level', function () {
        // maybe a DOS_Profile is a poor choice for this test if it needs provision checking
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        const afm = ['afm'].every((m) => getProvisionedModules().includes(m));
        if (!asm && !afm) {
            this.skip();
        }

        const declaration = {
            class: 'ADC',
            schemaVersion: '3.34.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    constants: {
                        class: 'Constants',
                        profiles: {
                            profileDOS: {
                                use: '/tenant/app/dosProfile'
                            }
                        }
                    },
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '1.2.3.4'
                        ],
                        include: [
                            '/tenant/app/constants/profiles'
                        ]
                    },
                    dosProfile: {
                        class: 'DOS_Profile'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declaration, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/ltm/virtual/~tenant~app~service/profiles')
            ))
            .then((response) => {
                const profile = response.items.find((item) => item.name === 'dosProfile');
                assert.deepStrictEqual(profile.fullPath, '/tenant/app/dosProfile');
            });
    });

    it('should use correct profile when constants are in Common~Shared', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.34.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    constants: {
                        class: 'Constants',
                        profiles: {
                            profileHTTP: {
                                use: '/Common/Shared/newHttpProfile'
                            }
                        }
                    },
                    newHttpProfile: {
                        class: 'HTTP_Profile'
                    }
                }
            },
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '1.2.3.4'
                        ],
                        include: [
                            '/Common/Shared/constants/profiles'
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(declaration, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/tm/ltm/virtual/~tenant~app~service/profiles')
            ))
            .then((response) => {
                const profile = response.items.find((item) => item.name === 'newHttpProfile');
                assert.deepStrictEqual(profile.fullPath, '/Common/Shared/newHttpProfile');
            });
    });

    it('verify maskConstants properties of Constants class', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            CONSTANTS_T1: {
                class: 'Tenant',
                constants: {
                    class: 'Constants',
                    constKey: 'oldValue',
                    maskConstants: true
                },
                DemoApp: {
                    class: 'Application',
                    enable: false,
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.9'
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled( // first POST
                postDeclaration(declaration, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                console.log(JSON.stringify(response));
                assert.strictEqual(response.declaration.CONSTANTS_T1.constants.constKey, '**MASKED**');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.strictEqual(response.CONSTANTS_T1.constants.constKey, '**MASKED**');
                delete declaration.CONSTANTS_T1.constants.maskConstants;
            })
            .then(() => assert.isFulfilled( // second POST
                postDeclaration(declaration, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.declaration.CONSTANTS_T1.constants.constKey, 'oldValue');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                assert.strictEqual(response.CONSTANTS_T1.constants.constKey, 'oldValue');
            });
    });
});

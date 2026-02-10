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
    deleteDeclaration,
    getPath,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('GSLB_Server', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        assertModuleProvisioned.call(this, 'gtm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should create the virtualServers and assign to GSLB Pool', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip',
                        virtualServerDiscoveryMode: 'enabled',
                        virtualServers: [
                            {
                                address: '192.0.2.1',
                                port: 8000,
                                name: '/Common/vs_192.0.2.1-8000'
                            },
                            {
                                address: '192.0.2.2',
                                port: 8000,
                                name: '/Common/vs_192.0.2.2-8000'
                            },
                            {
                                address: '192.0.2.3',
                                port: 8000,
                                name: '/Common/vs_192.0.2.3-8000'
                            }
                        ]
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            GSLBServer: {
                class: 'Tenant',
                GSLBApp: {
                    class: 'Application',
                    GSLBPool: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'A',
                        members: [
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.1-8000'
                            },
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.2-8000'
                            },
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.3-8000'
                            }
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
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~SYD'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/SYD');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.3-8000');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declaration1, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[2].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'GSLBPool');
                assert.strictEqual(response.fullPath, '/GSLBServer/GSLBApp/GSLBPool');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.3-8000');
            });
    });

    it('virtualServers should not be updated unless they are included in GSLB servers', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip',
                        virtualServerDiscoveryMode: 'enabled',
                        virtualServers: [
                            {
                                address: '192.0.2.1',
                                port: 8000,
                                name: '/Common/vs_192.0.2.1-8000'
                            },
                            {
                                address: '192.0.2.2',
                                port: 8000,
                                name: '/Common/vs_192.0.2.2-8000'
                            },
                            {
                                address: '192.0.2.3',
                                port: 8000,
                                name: '/Common/vs_192.0.2.3-8000'
                            }
                        ]
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            GSLBServer: {
                class: 'Tenant',
                GSLBApp: {
                    class: 'Application',
                    GSLBPool: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'A',
                        members: [
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.1-8000'
                            },
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.2-8000'
                            },
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.3-8000'
                            }
                        ]
                    }
                }
            }
        };

        const declaration2 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip',
                        virtualServerDiscoveryMode: 'enabled-no-delete'
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
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~SYD'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/SYD');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.3-8000');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declaration1, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[2].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'GSLBPool');
                assert.strictEqual(response.fullPath, '/GSLBServer/GSLBApp/GSLBPool');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.3-8000');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declaration2, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.3-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.3-8000');
            });
    });

    it('virtualServers should be removed if the empty virtualServers in the GSLB servers', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip',
                        virtualServerDiscoveryMode: 'enabled',
                        virtualServers: [
                            {
                                address: '192.0.2.1',
                                port: 8000,
                                name: '/Common/vs_192.0.2.1-8000'
                            },
                            {
                                address: '192.0.2.2',
                                port: 8000,
                                name: '/Common/vs_192.0.2.2-8000'
                            },
                            {
                                address: '192.0.2.3',
                                port: 8000,
                                name: '/Common/vs_192.0.2.3-8000'
                            }
                        ]
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            GSLBServer: {
                class: 'Tenant',
                GSLBApp: {
                    class: 'Application',
                    GSLBPool: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'A',
                        members: [
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.1-8000'
                            },
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.2-8000'
                            },
                            {
                                ratio: 10,
                                server: {
                                    use: '/Common/Shared/GTM_136'
                                },
                                virtualServer: '/Common/vs_192.0.2.3-8000'
                            }
                        ]
                    }
                }
            }
        };

        const declaration2 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip',
                        virtualServerDiscoveryMode: 'enabled-no-delete',
                        virtualServers: []
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
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~SYD'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/SYD');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, '/Common/vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/vs_192.0.2.3-8000');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declaration1, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[2].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool'))
            .then((response) => {
                assert.strictEqual(response.name, 'GSLBPool');
                assert.strictEqual(response.fullPath, '/GSLBServer/GSLBApp/GSLBPool');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.1-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.1-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.1-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.2-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.2-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.2-8000');
            })
            .then(() => getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.3-8000'))
            .then((response) => {
                assert.strictEqual(response.name, 'vs_192.0.2.3-8000');
                assert.strictEqual(response.fullPath, '/Common/GTM_136:/Common/vs_192.0.2.3-8000');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declaration2, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.1-8000'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /Common/vs_192.0.2.1-8000","errorStack":[],"apiError":1}'
            ))
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.2-8000'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /Common/vs_192.0.2.2-8000","errorStack":[],"apiError":1}'
            ))
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/server/~Common~GTM_136/virtual-servers/~Common~vs_192.0.2.3-8000'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /Common/vs_192.0.2.3-8000","errorStack":[],"apiError":1}'
            ))
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.1-8000'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /Common/GTM_136:/Common/vs_192.0.2.1-8000","errorStack":[],"apiError":1}'
            ))
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.2-8000'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /Common/GTM_136:/Common/vs_192.0.2.2-8000","errorStack":[],"apiError":1}'
            ))
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/pool/a/~GSLBServer~GSLBApp~GSLBPool/members/~Common~GTM_136:~Common~vs_192.0.2.3-8000'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /Common/GTM_136:/Common/vs_192.0.2.3-8000","errorStack":[],"apiError":1}'
            ));
    });

    it('should create the device info on BIG-IP', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                remark: 'GTM_136_Remark',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip'
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
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~SYD'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/SYD');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/devices/GTM_136'))
            .then((response) => {
                assert.strictEqual(response.name, 'GTM_136');
                assert.strictEqual(response.fullPath, 'GTM_136');
                assert.strictEqual(response.description, 'GTM_136_Remark');
                assert.strictEqual(response.addresses[0].name, '192.0.2.0');
                assert.strictEqual(response.addresses[0].translation, 'none');
            });
    });

    it('should modify the device info on BIG-IP', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136',
                                remark: 'GTM_136_Remark',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip'
                    }
                }
            }
        };

        const declaration1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    SYD: {
                        class: 'GSLB_Data_Center'
                    },
                    GTM_136: {
                        class: 'GSLB_Server',
                        dataCenter: {
                            use: 'SYD'
                        },
                        devices: [
                            {
                                label: 'GTM_136_Rename',
                                remark: 'GTM_136_Remark_Rename',
                                address: '192.0.2.0'
                            }
                        ],
                        serverType: 'bigip'
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
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~SYD'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/SYD');
            })
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/devices/GTM_136'))
            .then((response) => {
                assert.strictEqual(response.name, 'GTM_136');
                assert.strictEqual(response.fullPath, 'GTM_136');
                assert.strictEqual(response.description, 'GTM_136_Remark');
                assert.strictEqual(response.addresses[0].name, '192.0.2.0');
                assert.strictEqual(response.addresses[0].translation, 'none');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(declaration1, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/datacenter/~Common~SYD'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/Common/SYD');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/gtm/server/~Common~GTM_136/devices/GTM_136'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - GTM_136","errorStack":[],"apiError":1}'
            ))
            .then(() => getPath('/mgmt/tm/gtm/server/~Common~GTM_136/devices/GTM_136_Rename'))
            .then((response) => {
                assert.strictEqual(response.name, 'GTM_136_Rename');
                assert.strictEqual(response.fullPath, 'GTM_136_Rename');
                assert.strictEqual(response.description, 'GTM_136_Remark_Rename');
                assert.strictEqual(response.addresses[0].name, '192.0.2.0');
                assert.strictEqual(response.addresses[0].translation, 'none');
            });
    });
});

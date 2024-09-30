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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    getBigIpVersion,
    assertModuleProvisioned,
    postBigipItems,
    deleteBigipItems,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('Importing APM Policies', function () {
    this.timeout(GLOBAL_TIMEOUT);

    before(() => {
        validateEnvVars(['TEST_RESOURCES_URL']);
    });

    let accessToken;

    beforeEach(() => {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    afterEach(() => deleteDeclaration()); // Clear out the BIG-IP after each run

    it('should import the apm policy twice without leaving additional profiles', function () {
        assertModuleProvisioned.call(this, 'apm');

        // APM Profiles are version specific so we need to pull the correct one
        let url = {
            url: `https://${process.env.TEST_RESOURCES_URL}/iam-policy/`
        };
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            url = {
                url: `https://${process.env.TEST_RESOURCES_URL}/iam-policy/profile_ITS_ap_transfer.conf.tar`,
                skipCertificateCheck: true
            };
        } else if (!util.versionLessThan(getBigIpVersion(), '14.1')
            && util.versionLessThan(getBigIpVersion(), '15.0')) {
            url.url += '141all.tar';
        } else if (!util.versionLessThan(getBigIpVersion(), '15.1')
            && util.versionLessThan(getBigIpVersion(), '16.0')) {
            url.url += '151all.tar';
        } else if (!util.versionLessThan(getBigIpVersion(), '16.0')
            && util.versionLessThan(getBigIpVersion(), '16.1')) {
            url.url += '160all.tar';
        } else {
            // BIG-IP is not a version we are testing
            this.skip();
        }

        if (process.env.TEST_IN_AZURE === 'true') {
            url.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        const declaration = {
            class: 'ADC',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug',
                traceResponse: true
            },
            schemaVersion: '3.22.0',
            Test_Access_Profile: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    accessProfileTenant: {
                        class: 'Access_Profile',
                        url,
                        ignoreChanges: false,
                        enable: true
                    }
                }
            },
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    accessProfileCommon: {
                        class: 'Access_Profile',
                        url,
                        ignoreChanges: false,
                        enable: true
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => {
                // update the declaration to pull .tar.gz to confirm its import as well
                url.url += '.gz';
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/apm/profile/access'))
            .then((results) => {
                const nameArray = results.items.map((item) => item.name);
                // Confirm import
                assert.strictEqual(nameArray.indexOf('accessProfileCommon') > -1, true);
                assert.strictEqual(nameArray.indexOf('accessProfileTenant') > -1, true);
                // Confirm no duplicate
                assert.strictEqual(nameArray.indexOf('accessProfileCommon_1') === -1, true);
                assert.strictEqual(nameArray.indexOf('accessProfileTenant_1') === -1, true);
            });
    });

    it('should import an apm policy which has an iRule with WEBSSO:select in it', function () {
        assertModuleProvisioned.call(this, 'apm');

        // APM Profiles are version specific so we need to pull the correct one
        const url = {
            url: `https://${process.env.TEST_RESOURCES_URL}/iam-policy/`,
            skipCertificateCheck: true
        };
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            url.url += '131_profile_with_irule_websso.tar.gz';
        } else {
            // BIG-IP is not a version we are testing
            this.skip();
        }

        if (process.env.TEST_IN_AZURE === 'true') {
            url.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        const declaration = {
            class: 'ADC',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug',
                traceResponse: true
            },
            schemaVersion: '3.25.0',
            TEST_Access_Profile: {
                class: 'Tenant',
                myApplication: {
                    class: 'Application',
                    template: 'generic',
                    myVirtual: {
                        class: 'Service_HTTP',
                        virtualPort: 443,
                        virtualAddresses: [
                            '192.0.2.10'
                        ],
                        enable: true,
                        iRules: [
                            '/TEST_Access_Profile/myApplication/myIrule'
                        ],
                        profileAccess: {
                            use: '/TEST_Access_Profile/myApplication/myAccessProfile'
                        }
                    },
                    myAccessProfile: {
                        class: 'Access_Profile',
                        url,
                        ignoreChanges: false,
                        enable: true
                    },
                    myIrule: {
                        class: 'iRule',
                        iRule: `when HTTP_REQUEST {
                                set path [HTTP::path]
                                set requestPath [lrange [split $path ";"] 0 0]
                                if { $requestPath ends_with "/login" } {
                                    WEBSSO::select myAccessProfile-mySSOForm
                                }
                            }`
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            });
    });

    it('should not create duplicate profiles in Common and should clean up profiles on delete', function () {
        assertModuleProvisioned.call(this, 'apm');

        // APM Profiles are version specific so we need to pull the correct one
        let url = {
            url: `https://${process.env.TEST_RESOURCES_URL}/iam-policy/`
        };
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            url = {
                url: `https://${process.env.TEST_RESOURCES_URL}/iam-policy/profile_ITS_ap_transfer.conf.tar`,
                skipCertificateCheck: true
            };
        } else if (!util.versionLessThan(getBigIpVersion(), '14.1')
            && util.versionLessThan(getBigIpVersion(), '15.0')) {
            url.url += '141all.tar';
        } else if (!util.versionLessThan(getBigIpVersion(), '15.1')
            && util.versionLessThan(getBigIpVersion(), '16.0')) {
            url.url += '151all.tar';
        } else if (!util.versionLessThan(getBigIpVersion(), '16.0')
            && util.versionLessThan(getBigIpVersion(), '16.1')) {
            url.url += '160all.tar';
        } else {
            // BIG-IP is not a version we are testing
            this.skip();
        }

        if (process.env.TEST_IN_AZURE === 'true') {
            url.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        const declaration = {
            class: 'ADC',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug',
                traceResponse: true
            },
            schemaVersion: '3.40.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    accessProfile: {
                        class: 'Access_Profile',
                        url,
                        ignoreChanges: true
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => {
                declaration.tenant = {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualPort: 443,
                            virtualAddresses: [
                                '192.0.2.10'
                            ],
                            profileAccess: {
                                bigip: '/Common/accessProfile'
                            }
                        }
                    }
                };
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => {
                delete declaration.tenant;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/apm/profile/access'))
            .then((results) => {
                const accessProfiles = results.items.map((item) => item.name);
                assert.strictEqual(accessProfiles.indexOf('accessProfile') > -1, true);
                assert.strictEqual(accessProfiles.indexOf('accessProfile_1') === -1, true);
                return deleteDeclaration();
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/apm/profile/access'))
            .then((results) => {
                const accessProfiles = results.items.map((item) => item.name);
                assert.strictEqual(accessProfiles.indexOf('accessProfile') === -1, true);
            });
    });

    it('should create ping access agent properties using base64 encoded properties', function () {
        const declaration = {
            SampleTenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    testPingAccess: {
                        class: 'Ping_Access_Agent_Properties',
                        propertiesData: {
                            base64: 'YWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uc2NoZW1lPWh0dHAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uaG9zdD0xLjEuMS4xCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnBvcnQ9OTAwOQphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi51c2VybmFtZT1GNVRlc3RBZ2VudAphZ2VudC5zc2wucHJvdG9jb2xzPVRMU3YxLjEsIFRMU3YxLjIKYWdlbnQuc3NsLmNpcGhlcnM9VExTX0VDREhFX0VDRFNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhFX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBLFRMU19FQ0RIRV9FQ0RTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX1JTQV9XSVRIX0FFU18xMjhfR0NNX1NIQTI1NixUTFNfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBMjU2LFRMU19SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfUlNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESF9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VNUFRZX1JFTkVHT1RJQVRJT05fSU5GT19TQ1NWCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnNoYXJlZC5zZWNyZXQ9c2VjcmV0LWhlcmUKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uYm9vdHN0cmFwLnRydXN0c3RvcmU9c29tZS1iYXNlNjQtY29udGVudC1oZXJlIAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5tYXhDb25uZWN0aW9ucz0xMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi50aW1lb3V0PTMwMDAwCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmNvbm5lY3RUaW1lb3V0PTMwMDAwCmFnZW50LmNhY2hlLm1pc3NJbml0aWFsVGltZW91dD01CmFnZW50LmNhY2hlLmJyb2tlci5wdWJsaXNoZXJQb3J0PTMwMzEKYWdlbnQuY2FjaGUuYnJva2VyLnN1YnNjcmliZXJQb3J0PTMwMzIKYWdlbnQuY2FjaGUubWF4VG9rZW5zPTAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uZmFpbG92ZXIuaG9zdHM9CmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmZhaWxvdmVyLmZhaWxlZFJldHJ5VGltZW91dD02MDAwMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5mYWlsb3Zlci5tYXhSZXRyaWVzPTI='
                        },
                        ignoreChanges: false
                    }
                }
            },
            class: 'ADC',
            schemaVersion: '3.53.0'
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/apm/aaa/ping-access-properties-file/~SampleTenant~Application~testPingAccess'))
            .then((result) => {
                assert.strictEqual(result.checksum, 'SHA1:1412:5c38be173daf11dfa25841ec35e07947e9445826');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => {
                declaration.SampleTenant.Application.testPingAccess.ignoreChanges = true;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            });
    });

    it('should create ping access profile', function () {
        const declaration = {
            SampleTenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    testServerSSL: {
                        class: 'TLS_Client',
                        trustCA: {
                            bigip: '/Common/default.crt'
                        }
                    },
                    testPool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                metadata: {
                                    example: {
                                        value: 'test'
                                    }
                                }
                            }
                        ]
                    },
                    testPingAccess: {
                        class: 'Ping_Access_Agent_Properties',
                        propertiesData: {
                            base64: 'YWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uc2NoZW1lPWh0dHAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uaG9zdD0xLjEuMS4xCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnBvcnQ9OTAwOQphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi51c2VybmFtZT1GNVRlc3RBZ2VudAphZ2VudC5zc2wucHJvdG9jb2xzPVRMU3YxLjEsIFRMU3YxLjIKYWdlbnQuc3NsLmNpcGhlcnM9VExTX0VDREhFX0VDRFNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhFX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBLFRMU19FQ0RIRV9FQ0RTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX1JTQV9XSVRIX0FFU18xMjhfR0NNX1NIQTI1NixUTFNfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBMjU2LFRMU19SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfUlNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESF9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VNUFRZX1JFTkVHT1RJQVRJT05fSU5GT19TQ1NWCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnNoYXJlZC5zZWNyZXQ9c2VjcmV0LWhlcmUKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uYm9vdHN0cmFwLnRydXN0c3RvcmU9c29tZS1iYXNlNjQtY29udGVudC1oZXJlIAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5tYXhDb25uZWN0aW9ucz0xMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi50aW1lb3V0PTMwMDAwCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmNvbm5lY3RUaW1lb3V0PTMwMDAwCmFnZW50LmNhY2hlLm1pc3NJbml0aWFsVGltZW91dD01CmFnZW50LmNhY2hlLmJyb2tlci5wdWJsaXNoZXJQb3J0PTMwMzEKYWdlbnQuY2FjaGUuYnJva2VyLnN1YnNjcmliZXJQb3J0PTMwMzIKYWdlbnQuY2FjaGUubWF4VG9rZW5zPTAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uZmFpbG92ZXIuaG9zdHM9CmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmZhaWxvdmVyLmZhaWxlZFJldHJ5VGltZW91dD02MDAwMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5mYWlsb3Zlci5tYXhSZXRyaWVzPTI='
                        },
                        ignoreChanges: false
                    },
                    app: {
                        class: 'Ping_Access_Profile',
                        pingAccessProperties: {
                            use: 'testPingAccess'
                        },
                        pool: {
                            use: 'testPool'
                        },
                        useHTTPS: true,
                        serversslProfile: {
                            use: 'testServerSSL'
                        }
                    }
                }
            },
            class: 'ADC',
            schemaVersion: '3.53.0'
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/apm/profile/ping-access/~SampleTenant~Application~app'))
            .then((result) => {
                assert.strictEqual(result.pingAccessProperties, '/SampleTenant/Application/testPingAccess');
                assert.strictEqual(result.pool, '/SampleTenant/Application/testPool');
                assert.strictEqual(result.serversslProfile, '/SampleTenant/Application/testServerSSL');
                assert.strictEqual(result.useHttps, 'true');
            })
            .then(() => {
                declaration.SampleTenant.Application.testPingAccess.ignoreChanges = true;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            });
    });

    it('should create ping access profile with bigip references', function () {
        const bigipItems = [
            {
                endpoint: '/mgmt/shared/file-transfer/uploads/certOne',
                data: '-----BEGIN CERTIFICATE-----\nMIIDyTCCArGgAwIBAgIBADANBgkqhkiG9w0BAQUFADB/MQswCQYDVQQGEwJGUjET\nMBEGA1UECAwKU29tZS1TdGF0ZTEOMAwGA1UEBwwFUGFyaXMxDTALBgNVBAoMBERp\nbWkxDTALBgNVBAsMBE5TQlUxEDAOBgNVBAMMB0RpbWkgQ0ExGzAZBgkqhkiG9w0B\nCQEWDGRpbWlAZGltaS5mcjAeFw0xNDAxMjgyMDI2NDRaFw0yNDAxMjYyMDI2NDRa\nMH8xCzAJBgNVBAYTAkZSMRMwEQYDVQQIDApTb21lLVN0YXRlMQ4wDAYDVQQHDAVQ\nYXJpczENMAsGA1UECgwERGltaTENMAsGA1UECwwETlNCVTEQMA4GA1UEAwwHRGlt\naSBDQTEbMBkGCSqGSIb3DQEJARYMZGltaUBkaW1pLmZyMIIBIjANBgkqhkiG9w0B\nAQEFAAOCAQ8AMIIBCgKCAQEAuxuG4QeBIGXj/AB/YRLLtpgpTpGnDntVlgsycZrL\n3qqyOdBNlwnvcB9etfY5iWzjeq7YZRr6i0dIV4sFNBR2NoK+YvdD9j1TRi7njZg0\nd6zth0xlsOhCsDlV/YCL1CTcYDlKA/QiKeIQa7GU3Rhf0t/KnAkr6mwoDbdKBQX1\nD5HgQuXJiFdh5XRebxF1ZB3gH+0kCEaEZPrjFDApkOXNxEARZdpBLpbvQljtVXtj\nHMsvrIOc7QqUSOU3GcbBMSHjT8cgg8ssf492Go3bDQkIzTROz9QgDHaqDqTC9Hoe\nvlIpTS+q/3BCY5AGWKl3CCR6dDyK6honnOR/8srezaN4PwIDAQABo1AwTjAdBgNV\nHQ4EFgQUhMwqkbBrGp87HxfvwgPnlGgVR64wHwYDVR0jBBgwFoAUhMwqkbBrGp87\nHxfvwgPnlGgVR64wDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUFAAOCAQEAVqYq\nvhm5wAEKmvrKXRjeb5kiEIp7oZAFkYp6sKODuZ1VdkjMDD4wv46iqAe1QIIsfGwd\nDmv0oqSl+iPPy24ATMSZQbPLO5K64Hw7Q8KPos0yD8gHSg2d4SOukj+FD2IjAH17\na8auMw7TTHu6976JprQQKtPADRcfodGd5UFiz/6ZgLzUE23cktJMc2Bt18B9OZII\nJ9ef2PZxZirJg1OqF2KssDlJP5ECo9K3EmovC5M5Aly++s8ayjBnNivtklYL1VOT\nZrpPgcndTHUA5KS/Duf40dXm0snCxLAKNP28pMowDLSYc6IjVrD4+qqw3f1b7yGb\nbJcFgxKDeg5YecQOSg==\n-----END CERTIFICATE-----',
                headers: {
                    'Content-Range': '0-1373/1374',
                    'Content-Type': 'text/plain'
                }
            },
            {
                endpoint: '/mgmt/tm/ltm/pool',
                data: {
                    name: 'testPool',
                    partition: 'Common'
                }
            },
            {
                endpoint: '/mgmt/tm/apm/aaa/ping-access-properties-file',
                data: {
                    name: 'testProperties',
                    partition: 'Common',
                    sourcePath: 'file:///var/config/rest/downloads/certOne'
                }
            }
        ];

        const declaration = {
            SampleTenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    app: {
                        class: 'Ping_Access_Profile',
                        pingAccessProperties: {
                            bigip: '/Common/testProperties'
                        },
                        pool: {
                            bigip: '/Common/testPool'
                        },
                        useHTTPS: true,
                        serversslProfile: {
                            bigip: '/Common/serverssl'
                        }
                    }
                }
            },
            class: 'ADC',
            schemaVersion: '3.53.0'
        };

        return Promise.resolve()
            .then(() => postBigipItems(bigipItems))
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                console.log(JSON.stringify(response));
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration()
                .then(() => deleteBigipItems(bigipItems)));
    });

    it('should create Server HTTPS Profile with ping access profile reference', function () {
        const declaration = {
            SampleTenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    remark: 'test',
                    label: 'test123',
                    'test.item-foo.123': {
                        class: 'Service_HTTPS',
                        virtualPort: 8080,
                        virtualAddresses: [
                            '192.0.2.2'
                        ],
                        profilePingAccess: {
                            use: 'testPingAccessProfile'
                        }
                    },
                    testPingAccessProfile: {
                        class: 'Ping_Access_Profile',
                        pingAccessProperties: {
                            use: 'testPingAccess'
                        },
                        pool: {
                            use: 'testPool'
                        },
                        useHTTPS: true,
                        serversslProfile: {
                            use: 'testServerSSL'
                        }
                    },
                    testServerSSL: {
                        class: 'TLS_Client',
                        trustCA: {
                            bigip: '/Common/default.crt'
                        }
                    },
                    testPool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.5'
                                ],
                                metadata: {
                                    example: {
                                        value: 'test'
                                    }
                                }
                            }
                        ]
                    },
                    testPingAccess: {
                        class: 'Ping_Access_Agent_Properties',
                        propertiesData: {
                            base64: 'YWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uc2NoZW1lPWh0dHAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uaG9zdD0xLjEuMS4xCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnBvcnQ9OTAwOQphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi51c2VybmFtZT1GNVRlc3RBZ2VudAphZ2VudC5zc2wucHJvdG9jb2xzPVRMU3YxLjEsIFRMU3YxLjIKYWdlbnQuc3NsLmNpcGhlcnM9VExTX0VDREhFX0VDRFNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhFX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBLFRMU19FQ0RIRV9FQ0RTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX1JTQV9XSVRIX0FFU18xMjhfR0NNX1NIQTI1NixUTFNfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBMjU2LFRMU19SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfUlNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESF9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VNUFRZX1JFTkVHT1RJQVRJT05fSU5GT19TQ1NWCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnNoYXJlZC5zZWNyZXQ9c2VjcmV0LWhlcmUKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uYm9vdHN0cmFwLnRydXN0c3RvcmU9c29tZS1iYXNlNjQtY29udGVudC1oZXJlIAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5tYXhDb25uZWN0aW9ucz0xMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi50aW1lb3V0PTMwMDAwCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmNvbm5lY3RUaW1lb3V0PTMwMDAwCmFnZW50LmNhY2hlLm1pc3NJbml0aWFsVGltZW91dD01CmFnZW50LmNhY2hlLmJyb2tlci5wdWJsaXNoZXJQb3J0PTMwMzEKYWdlbnQuY2FjaGUuYnJva2VyLnN1YnNjcmliZXJQb3J0PTMwMzIKYWdlbnQuY2FjaGUubWF4VG9rZW5zPTAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uZmFpbG92ZXIuaG9zdHM9CmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmZhaWxvdmVyLmZhaWxlZFJldHJ5VGltZW91dD02MDAwMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5mYWlsb3Zlci5tYXhSZXRyaWVzPTI='
                        },
                        ignoreChanges: true,
                        remark: 'test',
                        label: 'test123'
                    }
                }
            },
            class: 'ADC',
            schemaVersion: '3.53.0'
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~SampleTenant~Application~test.item-foo.123/profiles/~SampleTenant~Application~testPingAccessProfile'))
            .then((result) => {
                assert.strictEqual(result.name, 'testPingAccessProfile');
            });
    });
});

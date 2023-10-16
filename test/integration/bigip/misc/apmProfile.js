/**
 * Copyright 2023 F5, Inc.
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
});

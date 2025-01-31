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

const oauth = require('../../../common/oauth');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    getPath,
    assertClass,
    postDeclaration,
    deleteDeclaration,
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const gtmUtil = require('../../../../src/lib/util/gtmUtil');
const util = require('../../../../src/lib/util/util');
const { validateEnvVars } = require('../../../common/checkEnv');

const policyHost = `${process.env.TEST_RESOURCES_URL}`;

describe('Unchecked mode', function () {
    this.timeout(GLOBAL_TIMEOUT);

    let accessToken;

    beforeEach(function () {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    const queryParams = '?async=true&unchecked=true';

    it('should successfully post with success and then no change', function () {
        assertModuleProvisioned.call(this, 'asm');
        assertModuleProvisioned.call(this, 'apm');

        before(() => {
            validateEnvVars(['TEST_RESOURCES_URL']);
        });

        const wafUrl = {
            url: `https://${policyHost}/asm-policy/sharepoint_template_12.1.xml`
        };

        // APM Profiles are version specific so we need to pull the correct one
        let accessUrl = {
            url: `https://${policyHost}/iam-policy/`
        };
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            accessUrl = {
                url: `https://${policyHost}/iam-policy/profile_ITS_ap_transfer.conf.tar`
            };
        } else if (!util.versionLessThan(getBigIpVersion(), '14.1')
            && util.versionLessThan(getBigIpVersion(), '15.0')) {
            accessUrl.url += '141all.tar';
        } else if (!util.versionLessThan(getBigIpVersion(), '15.1')
            && util.versionLessThan(getBigIpVersion(), '16.0')) {
            accessUrl.url += '151all.tar';
        } else if (!util.versionLessThan(getBigIpVersion(), '16.0')
            && util.versionLessThan(getBigIpVersion(), '16.1')) {
            accessUrl.url += '160all.tar';
        } else {
            // BIG-IP is not a version we are testing
            this.skip();
        }

        if (process.env.TEST_IN_AZURE === 'true') {
            accessUrl.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
            wafUrl.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    template: 'generic',
                    caBundle: {
                        class: 'CA_Bundle',
                        bundle: '-----BEGIN CERTIFICATE-----\nMIIG4DCCBMigAwIBAgIINJotoYIGsrMwDQYJKoZIhvcNAQELBQAwggEMMQswCQYD\nVQQGEwJFUzEPMA0GA1UECAwGTUFEUklEMQ8wDQYDVQQHDAZNQURSSUQxOjA4BgNV\nBAsMMXNlZSBjdXJyZW50IGFkZHJlc3MgYXQgd3d3LmNhbWVyZmlybWEuY29tL2Fk\nZHJlc3MxKTAnBgNVBAsMIENIQU1CRVJTIE9GIENPTU1FUkNFIFJPT1QgLSAyMDE2\nMRIwEAYDVQQFEwlBODI3NDMyODcxGDAWBgNVBGEMD1ZBVEVTLUE4Mjc0MzI4NzEb\nMBkGA1UECgwSQUMgQ0FNRVJGSVJNQSBTLkEuMSkwJwYDVQQDDCBDSEFNQkVSUyBP\nRiBDT01NRVJDRSBST09UIC0gMjAxNjAeFw0xNjA0MTQwNzM1NDhaFw00MDA0MDgw\nNzM1NDhaMIIBDDELMAkGA1UEBhMCRVMxDzANBgNVBAgMBk1BRFJJRDEPMA0GA1UE\nBwwGTUFEUklEMTowOAYDVQQLDDFzZWUgY3VycmVudCBhZGRyZXNzIGF0IHd3dy5j\nYW1lcmZpcm1hLmNvbS9hZGRyZXNzMSkwJwYDVQQLDCBDSEFNQkVSUyBPRiBDT01N\nRVJDRSBST09UIC0gMjAxNjESMBAGA1UEBRMJQTgyNzQzMjg3MRgwFgYDVQRhDA9W\nQVRFUy1BODI3NDMyODcxGzAZBgNVBAoMEkFDIENBTUVSRklSTUEgUy5BLjEpMCcG\nA1UEAwwgQ0hBTUJFUlMgT0YgQ09NTUVSQ0UgUk9PVCAtIDIwMTYwggIiMA0GCSqG\nSIb3DQEBAQUAA4ICDwAwggIKAoICAQDqxqSh1K2Zlsmf9bxQAPQsz/J46PIsAifW\ng4wEq9MOe1cgydSvZfSH3TAI185Bo3YK24pG5Kb97QjOcD/6EGB5TGuBVIBV5Od6\nIbZ1mtxe9g6Z/PjC30GOL6vHW20cUFnA7eisgkL+ua8vDEFRnL0AbmRRsjvlNquV\nkRL7McdzrBzYZXY7zhtMTrAfIAb7ULT7m6F5jhaV45/rGEuEqzmTzTeD0Ol8CyeP\n7UII6YZGMqyaJmlwYS0YvT9Q8J72aFBOaZVwwe2TqZdOKaK63cKfbkkIK6P6I/Ep\nXrB9MVmb7YzNpm74+PfYGOjaVulI8kB0fp7NIK8UJFnudzWFv0qZSql13bMm4wbO\nfW9LZKN2NBk+FG+FVDjiiy1AtWRmH1czHHDNw7QoWhQjXPy4vbP+OxJf9rmMHciU\nClbbcn7vJwcNALS/fZk/TUWzm/cdGdBPBPrHc5SIfYsUKpng6ZmSCcbWAWu38NtD\nV2Ibx0RS4pdjus/qzmDmCuUYaC0zgHWgMAdo9tX3Eyw6sJ7oWFVujFZETUMXQQLM\nd9xfRQVZz81g07/S9uL01dyHcTMHGvVvtH89l/tfZPRODgBECenr7D5xGQQXOUhg\nuEv/XshlmSumMvJbhqid6CN0EHjvyyedMbpgi04GUOJQHQdgwkGMFbRbNxwK5QkZ\ncgSKPOMB2wIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSeLmVP\nPlf1q32WxovfszVtSuieizAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZIhvcNAQELBQAD\nggIBAAVpKoWXJlC6QjkckyzST1vRXUQm2m9pK7V7ntD0Si5Ix+x/n8pZerlE9z69\n91BrUZ90/5AaQNCTeZIPiiNei6+BC9CLrWbgKtyaKb012GxAFElCPYkvupsrOLwa\nowu3iNetxhQM7nxJrK7s8j0YT4xtFF0Oqrffd6s7j2JOiwxlxhmOzcAMoXeqtN16\npxMF5jkYx5VkfgO2i5DB5V8AI5jmc9oR0hD/HlMiJ8fTAckvxTsybvDDOMoSZ7y6\nIym7xJVJWgbd1FqQ1BNt59XCfOJYBMDsxL2iPH7GI4F1fKtwXzSElfez1UeWT3HK\neDIIILRCpEJr1SWcsifrwQ5HRAnhKw/QIzZuHLm6TqzM8AyUzkEPa90P1cjgF4ve\nOl1Svul1JR26BQfaVhk8jdHX8VE22ZLvonhRBVi9UswKXm+v2tDlDNtswSPvOTF3\nFwcAjPa6D3D5vL7h5H3hzER6pCHsRz+o1hWl7AGpyHDomGcdvVlUfqFXFTUHxXLJ\nPrcpho2f2jJ5MtzbqOUJ/+9WKv6TsY4qE+2toitrLwTezS+SktY+YLV4AZUHCKls\n4xza++WbI1YgW+nQXMZKJDu847YiFiqEkv+o/pe/o53bYV7uGSos1+sNdlY4dX5J\nAJNXyfwjWvz08d8qnbCMafQQo1WdcDwi/wfWK7aZwJfQ9Cqg\n-----END CERTIFICATE-----'
                    },
                    wafPolicy: {
                        class: 'WAF_Policy',
                        url: wafUrl,
                        ignoreChanges: false
                    },
                    accessProfile: {
                        class: 'Access_Profile',
                        url: accessUrl,
                        ignoreChanges: false
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }, queryParams))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                declaration.Tenant.Application.wafPolicy.ignoreChanges = true;
                declaration.Tenant.Application.accessProfile.ignoreChanges = true;
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }, queryParams))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                declaration.Tenant.Application.caBundle.bundle = '-----BEGIN CERTIFICATE-----\nMIIF+jCCA+KgAwIBAgIQAdFs++0ey5zfaqIxz4xU+TANBgkqhkiG9w0BAQwFADCB\niDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl\ncnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV\nBAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTUw\nMzExMDAwMDAwWhcNMjUwMzEwMjM1OTU5WjBwMQswCQYDVQQGEwJDTjERMA8GA1UE\nCBMIU2hhbmdoYWkxJTAjBgNVBAoTHFRydXN0QXNpYSBUZWNobm9sb2dpZXMsIElu\nYy4xJzAlBgNVBAMTHlRydXN0QXNpYSBSU0EgRFYgU1NMIFNlcnZlciBDQTCCASIw\nDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKVXxe36oseRAbs4z+/mLAWrYUom\nQDA0DwiDfYyqf8nrTG/wxELxtboEGBF4U5NbEye/i5t9in+mdbzdwpN657myfypS\nl2sC2YyY7ArmRxgTFyrtxhdzBLVnJEly2EAxk06QBwzcEfMJ5dWKpqcDY85K4N/C\nhO4E2BjzZRG7F3kZlo0T2oDbymNUt3J//cFwSiKl4LuSIUmvkUexbEG+75kvMZ5U\n5P3/C/becM61izwn+ftHFS7j9Rn7Hut4yqn+ePUOcBFZ6U02lcRDAPElq3SzyOvW\nmJxUTRiYHrnSK4qFHCBnNmfSlQvKUAo30Az4UiDcro+9YWtriR90DKbZrFECAwEA\nAaOCAXUwggFxMB8GA1UdIwQYMBaAFFN5v1qqK0rPVIDh2JvAnfKyA2bLMB0GA1Ud\nDgQWBBR7FhLOvGeCvXj0NqvcT2sXSgXtpTAOBgNVHQ8BAf8EBAMCAYYwEgYDVR0T\nAQH/BAgwBgEB/wIBADAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwIgYD\nVR0gBBswGTANBgsrBgEEAbIxAQICMTAIBgZngQwBAgEwUAYDVR0fBEkwRzBFoEOg\nQYY/aHR0cDovL2NybC51c2VydHJ1c3QuY29tL1VTRVJUcnVzdFJTQUNlcnRpZmlj\nYXRpb25BdXRob3JpdHkuY3JsMHYGCCsGAQUFBwEBBGowaDA/BggrBgEFBQcwAoYz\naHR0cDovL2NydC51c2VydHJ1c3QuY29tL1VTRVJUcnVzdFJTQUFkZFRydXN0Q0Eu\nY3J0MCUGCCsGAQUFBzABhhlodHRwOi8vb2NzcC51c2VydHJ1c3QuY29tMA0GCSqG\nSIb3DQEBDAUAA4ICAQAHygz5l1zWzcKT859aQgyDfUsiLyH+UKJ8jqSzOHb8A7Af\niK/K0HSZrg5tKiU90x2K/SpVuMmXlxNlxs7X1oDRvpgf8FHXZeVqm7fxuaFJ1fRi\nY73w9ClVhuvfYs2ziLyFt99nudgz9o/oroCe6gihR3LJW6jyS5LXcWE+uzv5CgLI\n6cHPjQdpgk8AcjqNBtqGiL7WgXRQMKHyb8jeBozKLi9M/VNW44WSaCs0JzXxBglL\n6fYOqOgF9lqrVVp257R3W4oqhbbHZ/2NY39hqs91YCBWhdVQvBYqM5b9N+v2+aEn\nRRYdyabdHUpMJ+5Jmbf9ydAcCix9eS8QMZbgal3vrwbJR6/MqOvuKcrBXe7j7ZxH\nWhL177r+e9SHzUcpCATDUJrL9fjCoBvWifiP9oPCVHkfpEYD9uu7sc+fBfFJP9V5\nmEQd0Vk5neWsNSq8cpfI7Ok4/R920+BD4an1Pkx9tly8P7Vza8aXSyv3OIplRYgr\n4Qf+6Cp2hVSSHL1Sv8D9TwvCqVvH7Zb1WwvuX4UHKo/Ae1cUiiEyavWGBo9o7bnV\ntyRdxTJmn6f6PeKe1u+HTCBoEuoVF22DJcbwTFiJ2U5voyb+OS6XXvIOIWOP+Imz\n3+WHDNM1GuNGDqz25zKCkl03MvK0Yw2FwT/HhSMSs1VmT5iCzaKXS7YgtGETKg==\n-----END CERTIFICATE-----';
                declaration.Tenant.Application.wafPolicy.url.url = `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`;
                declaration.Tenant.Application.wafPolicy.ignoreChanges = false;
                declaration.Tenant.Application.accessProfile.ignoreChanges = false;
                // Test fetching as .gz
                accessUrl.url += '.gz';
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 2 }, queryParams))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                declaration.Tenant.Application.wafPolicy.ignoreChanges = true;
                declaration.Tenant.Application.accessProfile.ignoreChanges = true;
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 3 }, queryParams))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            });
    });

    it('should throw an error if a Service Address address is modified with unchecked mode', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    vaddr: {
                        class: 'Service_Address',
                        virtualAddress: '10.0.1.2'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }, queryParams))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                // modify the virtual address for testing
                decl.tenant.app.vaddr.virtualAddress = '10.0.2.2';
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }, queryParams))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, 'The Service Address virtualAddress property cannot be modified. Please delete /tenant/vaddr and recreate it.');
            });
    });

    it('should handle shareAddresses', () => {
        // This is the unchecked copy of a propertiesServiceTCP test
        // It covers new items in the diff (e.g. nodes in Common)
        const options = {
            tenantName: 'Common',
            applicationName: 'Shared',
            unchecked: true
        };

        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                expectedValue: ['8080'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.10'], ['1.1.1.11'], ['1.1.1.10']],
                expectedValue: ['/Common/Shared/1.1.1.10', '/Common/1.1.1.11', '/Common/Shared/1.1.1.10'],
                extractFunction: (o) => o.destination.split(':')[0]
            },
            {
                name: 'shareAddresses',
                inputValue: [false, true, false],
                skipAssert: true
            }
        ];
        return assertClass('Service_TCP', properties, options);
    });

    it('should update existing shareNode when handling Common tenant with shareNode', () => {
        // This is the unchecked copy of a shareNodes test
        // It covers a node in Common in the desired config that is not new

        const tenantDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                shareNodes: true
                            }
                        ]
                    }
                }
            }
        };

        const commonDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 8080,
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                shareNodes: true
                            }
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 }, queryParams)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 0 }, queryParams)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => assert.isFulfilled(postDeclaration(commonDecl, { declarationIndex: 0 }, queryParams)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => assert.isFulfilled(postDeclaration(commonDecl, { declarationIndex: 0 }, queryParams)))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => deleteDeclaration())
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
                assert.strictEqual(response.results[2].code, 200);
                assert.strictEqual(response.results[2].message, 'success');
            });
    });

    it('should update a GSLB Pool', function () {
        // This is the unchecked copy of a GSLB Pool test
        assertModuleProvisioned.call(this, 'gtm');

        const sharedObjects = {
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    testServerOne: {
                        class: 'GSLB_Server',
                        dataCenter: { use: 'testDataCenter' },
                        devices: [{ address: '1.2.3.7' }],
                        virtualServers: [
                            {
                                address: '1.2.3.8',
                                port: 5050
                            },
                            {
                                address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
                                port: 5051
                            }
                        ]
                    },
                    testServerTwo: {
                        class: 'GSLB_Server',
                        dataCenter: { use: 'testDataCenter' },
                        devices: [{ address: '1.2.3.6' }],
                        virtualServers: [
                            {
                                address: '1.2.3.9',
                                port: 5052
                            },
                            {
                                address: '1234:0000:0000:0000:0000:0000:0000:0000',
                                port: 5053
                            }
                        ]
                    },
                    testDataCenter: {
                        class: 'GSLB_Data_Center'
                    },
                    testDomainOne: {
                        class: 'GSLB_Domain',
                        domainName: 'example1.edu',
                        resourceRecordType: 'A'
                    },
                    testDomainTwo: {
                        class: 'GSLB_Domain',
                        domainName: 'example2.edu',
                        resourceRecordType: 'A'
                    }
                }
            }
        };

        const options = {
            unchecked: true
        };

        function assertGTMPoolClass(properties) {
            return assertClass('GSLB_Pool', properties, options, sharedObjects);
        }

        function extractMemberServer(pool, i) {
            const member = pool.members[i];
            if (!member) return undefined;
            return member.name.split(':')[0];
        }

        function extractMemberVirtual(pool, i) {
            const member = pool.members[i];
            if (!member) return undefined;
            return member.name.split(':')[1];
        }

        function extractDependsOn(pool, i) {
            const member = pool.members[i];
            if (!member) return undefined;
            return member.dependsOn;
        }

        function extractMemberEnabled(pool, i) {
            const member = pool.members[i];
            if (!member) return undefined;
            return !member.disabled;
        }

        const commonProperties = [
            {
                name: 'enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [true, undefined, true]
            },
            {
                name: 'lbModeAlternate',
                inputValue: [undefined, 'ratio', undefined],
                expectedValue: ['round-robin', 'ratio', 'round-robin']
            },
            {
                name: 'lbModeFallback',
                inputValue: [undefined, 'ratio', undefined],
                expectedValue: ['return-to-dns', 'ratio', 'return-to-dns']
            },
            {
                name: 'manualResumeEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'verifyMemberEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'qosHitRatio',
                inputValue: [undefined, 10, undefined],
                expectedValue: [5, 10, 5]
            },
            {
                name: 'qosHops',
                inputValue: [undefined, 11, undefined],
                expectedValue: [0, 11, 0]
            },
            {
                name: 'qosKbps',
                inputValue: [undefined, 8, undefined],
                expectedValue: [3, 8, 3]
            },
            {
                name: 'qosLinkCapacity',
                inputValue: [undefined, 35, undefined],
                expectedValue: [30, 35, 30]
            },
            {
                name: 'qosPacketRate',
                inputValue: [undefined, 5, undefined],
                expectedValue: [1, 5, 1]
            },
            {
                name: 'qosRoundTripTime',
                inputValue: [undefined, 75, undefined],
                expectedValue: [50, 75, 50]
            },
            {
                name: 'qosTopology',
                inputValue: [undefined, 3, undefined],
                expectedValue: [0, 3, 0]
            },
            {
                name: 'qosVirtualServerCapacity',
                inputValue: [undefined, 2, undefined],
                expectedValue: [0, 2, 0]
            },
            {
                name: 'qosVirtualServerScore',
                inputValue: [undefined, 1, undefined],
                expectedValue: [0, 1, 0]
            },
            {
                name: 'members',
                inputValue: [undefined, [], undefined],
                skipAssert: true
            },
            {
                name: 'members.0',
                inputValue: [undefined, {}, undefined],
                skipAssert: true
            },
            {
                name: 'members.0.ratio',
                inputValue: [undefined, 10, undefined],
                expectedValue: [undefined, 10, undefined],
                extractFunction: (o) => (o.members[0] ? o.members[0].ratio : undefined)
            },
            {
                name: 'members.1',
                inputValue: [undefined, {}, undefined],
                skipAssert: true
            }
        ];

        const aProperties = commonProperties.concat([
            {
                name: 'bpsLimit',
                inputValue: [undefined, 5, undefined],
                expectedValue: [0, 5, 0]
            },
            {
                name: 'bpsLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'ppsLimit',
                inputValue: [undefined, 4, undefined],
                expectedValue: [0, 4, 0]
            },
            {
                name: 'ppsLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'connectionsLimit',
                inputValue: [undefined, 3, undefined],
                expectedValue: [0, 3, 0]
            },
            {
                name: 'connectionsLimitEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'maxAnswersReturned',
                inputValue: [undefined, 10, undefined],
                expectedValue: [1, 10, 1]
            },
            {
                name: 'monitors',
                inputValue: [
                    undefined,
                    [
                        { bigip: '/Common/http' },
                        { bigip: '/Common/https' }
                    ],
                    undefined
                ],
                expectedValue: ['default', '/Common/http and /Common/https', 'default'],
                extractFunction: (o) => o.monitor.trim()
            }
        ]);

        const properties = aProperties.concat([
            {
                name: 'resourceRecordType',
                inputValue: ['A'],
                skipAssert: true
            },
            {
                name: 'fallbackIP',
                inputValue: [undefined, '1.1.1.1', undefined],
                expectedValue: ['any', '1.1.1.1', 'any']
            },
            {
                name: 'members.0.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerOne' }, undefined],
                expectedValue: [undefined, 'testServerOne', undefined],
                extractFunction: (o) => extractMemberServer(o, 0)
            },
            {
                name: 'members.0.virtualServer',
                inputValue: [undefined, '0', undefined],
                expectedValue: [undefined, '0', undefined],
                extractFunction: (o) => extractMemberVirtual(o, 0)
            },
            {
                name: 'members.0.dependsOn',
                inputValue: [undefined, ['/Common/Shared/testServerOne:1'], undefined],
                expectedValue: [undefined, [{ name: '/Common/testServerOne:1' }], undefined],
                extractFunction: (o) => extractDependsOn(o, 0)
            },
            {
                name: 'members.0.enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [undefined, false, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 0)
            },
            {
                name: 'members.1.server',
                inputValue: [undefined, { use: '/Common/Shared/testServerTwo' }, undefined],
                skipAssert: true
            },
            {
                name: 'members.1.virtualServer',
                inputValue: [undefined, '0', undefined],
                skipAssert: true
            },
            {
                name: 'members.1.enabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, true, undefined],
                extractFunction: (o) => extractMemberEnabled(o, 1)
            }
        ]);

        return assertGTMPoolClass(properties);
    });

    it('GSLB Topology Update Order', function () {
        // This is the unchecked copy of a GSLB Topology Update Order test
        assertModuleProvisioned.call(this, 'gtm');

        const globalSettingsKind = 'tm:gtm:global-settings:load-balancing:load-balancingstate';
        const topologyKind = 'tm:gtm:topology:topologystate';

        const extractFunctions = {
            longestMatchEnabled(result) {
                const settings = result.find((r) => r.kind === globalSettingsKind);
                return settings.topologyLongestMatch === 'yes';
            },
            records(result) {
                const mapToRecord = function (item) {
                    const rec = {
                        matchOperator: item.not === 'not' ? 'not-equals' : 'equals',
                        matchType: item.type,
                        matchValue: item.value.indexOf('"') > -1
                            ? item.value.substring(item.value.indexOf('"') + 1, item.value.lastIndexOf('"'))
                            : item.value
                    };
                    if (item.type === 'region') {
                        rec.matchValue = { bigip: rec.matchValue };
                    }
                    if (item.type === 'datacenter') {
                        rec.matchValue = { use: rec.matchValue.replace('/Common/', '/Common/Shared/') };
                    }
                    if (item.type === 'pool') {
                        rec.matchValue = { use: rec.matchValue };
                    }
                    return rec;
                };
                return result.filter((r) => r.kind === topologyKind).map((item) => {
                    const record = {};
                    const itemName = item.name;
                    const ldnsIndex = itemName.indexOf('ldns: ') + 6;
                    const serverIndex = itemName.indexOf('server: ');
                    record.source = mapToRecord(gtmUtil.parseTopologyItem(
                        itemName.substring(ldnsIndex, serverIndex).trim()
                    ));
                    record.destination = mapToRecord(gtmUtil.parseTopologyItem(
                        itemName.substring(serverIndex + 8).trim()
                    ));
                    record.weight = item.score;
                    return record;
                });
            }
        };

        const options = {
            findAll: true,
            tenantName: 'Common',
            applicationName: 'Shared',
            getMcpObject: {
                itemName: '',
                itemKind: topologyKind,
                refItemKind: globalSettingsKind,
                skipNameCheck: true
            },
            getMcpValueDelay: 1000,
            mcpPath: '/Common/',
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/gtm/region',
                    data: { name: 'topologyTestRegion' }
                }
            ],
            unchecked: true
        };

        const country = {
            source: {
                matchType: 'country',
                matchOperator: 'equals',
                matchValue: 'AD'
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.10.0.0/21'
            },
            weight: 100
        };

        const continent = {
            source: {
                matchType: 'continent',
                matchOperator: 'equals',
                matchValue: 'AF'
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.30.10.0/24'
            },
            weight: 100
        };

        const isp = {
            source: {
                matchType: 'isp',
                matchOperator: 'equals',
                matchValue: 'Comcast'
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.10.20.0/24'
            },
            weight: 100
        };

        const region = {
            source: {
                matchType: 'region',
                matchOperator: 'equals',
                matchValue: {
                    bigip: '/Common/topologyTestRegion'
                }
            },
            destination: {
                matchType: 'subnet',
                matchOperator: 'equals',
                matchValue: '10.10.10.0/24'
            },
            weight: 100
        };

        const actualRecords = [
            country,
            isp,
            continent,
            region
        ];
        // For longest match algorithm, see https://support.f5.com/csp/article/K14284
        const orderedRecords = [
            region,
            isp,
            country,
            continent
        ];

        const properties = [
            {
                name: 'longestMatchEnabled',
                inputValue: [undefined, false],
                expectedValue: [true, false],
                extractFunction: extractFunctions.longestMatchEnabled
            },
            {
                name: 'records',
                inputValue: [actualRecords, actualRecords],
                expectedValue: [orderedRecords, actualRecords],
                extractFunction: extractFunctions.records
            }

        ];
        return assertClass('GSLB_Topology_Records', properties, options);
    });
    it('should attach profileHTTP2 under Service_HTTP', () => {
        const postDecl = {
            class: 'ADC',
            updateMode: 'selective',
            TEST_Service_HTTP: {
                class: 'Tenant',
                SHARED: {
                    'FREE_GLB_HTTP_80_Address_192.168.0.80': {
                        spanningEnabled: false,
                        class: 'Service_Address',
                        virtualAddress: '192.168.0.80',
                        arpEnabled: false,
                        routeAdvertisement: 'selective',
                        icmpEcho: 'enable'
                    },
                    httpCustom: {
                        maxHeaderSize: 32768,
                        maxHeaderCount: 128,
                        xForwardedFor: true,
                        enforceRFCCompliance: false,
                        class: 'HTTP_Profile',
                        unknownMethodAction: 'allow',
                        viaResponse: 'preserve',
                        responseChunking: 'sustain',
                        pipelineAction: 'allow',
                        allowBlankSpaceAfterHeaderName: false,
                        trustXFF: true,
                        rewriteRedirects: 'none',
                        requestChunking: 'sustain',
                        proxyType: 'reverse',
                        knownMethods: [
                            'CONNECT',
                            'DELETE',
                            'GET',
                            'HEAD',
                            'LOCK',
                            'OPTIONS',
                            'POST',
                            'PROPFIND',
                            'PUT',
                            'TRACE',
                            'UNLOCK'
                        ],
                        viaRequest: 'preserve',
                        truncatedRedirects: false,
                        serverHeaderValue: 'none',
                        multiplexTransformations: true
                    },
                    template: 'shared',
                    class: 'Application',
                    http2Custom: {
                        includeContentLength: false,
                        headerTableSize: 4096,
                        label: 'http2Custom',
                        connectionIdleTimeout: 300,
                        concurrentStreamsPerConnection: 10,
                        insertHeader: false,
                        activationMode: 'always',
                        frameSize: 2048,
                        writeSize: 16384,
                        enforceTlsRequirements: false,
                        class: 'HTTP2_Profile',
                        receiveWindow: 32
                    },
                    webtls: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'webcert'
                            }
                        ],
                        renegotiationEnabled: false
                    },
                    tlsClient: {
                        class: 'TLS_Client',
                        clientCertificate: 'webcert'
                    },
                    webcert: {
                        class: 'Certificate',
                        certificate: { bigip: '/Common/default.crt' },
                        privateKey: { bigip: '/Common/default.key' }
                    },
                    FREE_GLB_HTTP: {
                        class: 'Service_HTTP',
                        profileHTTP2: {
                            use: '/TEST_Service_HTTP/SHARED/http2Custom'
                        },
                        profileTCP: {
                            bigip: '/Common/f5-tcp-progressive'
                        },
                        profileHTTP: {
                            use: '/TEST_Service_HTTP/SHARED/httpCustom'
                        },
                        remark: 'FREE GLB HTTP VIP',
                        translateServerPort: true,
                        enable: true,
                        layer4: 'tcp',
                        translateServerAddress: true,

                        redirect80: false,
                        virtualPort: 80,
                        rateLimit: 0,
                        virtualAddresses: [
                            {
                                use: 'FREE_GLB_HTTP_80_Address_192.168.0.80'
                            }
                        ],
                        persistenceMethods: [],
                        translateClientPort: true
                    }
                }
            },
            id: 'autogen_cff031ba-2cf7-4f90-bc61-049cdf38e0d3',
            label: 'Combined Declaration',
            remark: 'Combined declaration of all components',
            schemaVersion: '3.50.0',
            controls: {
                trace: true,
                logLevel: 'error',
                class: 'Controls',
                dryRun: false,
                traceResponse: true
            }
        };
        function validateAs3Result(result, expectedTenantName) {
            assert.strictEqual(result.code, 200);
            assert.strictEqual(result.message, 'success');
            assert.strictEqual(result.tenant, expectedTenantName);
            assert.ok(result.declarationId.startsWith('autogen_'));
        }

        return Promise.resolve()
            // POST initial declaration
            .then(() => postDeclaration(postDecl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results.length, 1);
                validateAs3Result(response.results[0], 'TEST_Service_HTTP');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~TEST_Service_HTTP~SHARED~FREE_GLB_HTTP'))
            .then((response) => {
                assert.strictEqual(response.destination, '/TEST_Service_HTTP/FREE_GLB_HTTP_80_Address_192.168.0.80:80');
                assert.strictEqual(response.ipProtocol, 'tcp');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~TEST_Service_HTTP~SHARED~FREE_GLB_HTTP/profiles'))
            .then((response) => {
                assert.strictEqual(response.items.length, 3);
                assert.strictEqual(response.items[0].fullPath, '/Common/f5-tcp-progressive');
                assert.strictEqual(response.items[1].fullPath, '/TEST_Service_HTTP/SHARED/http2Custom');
                assert.strictEqual(response.items[2].fullPath, '/TEST_Service_HTTP/SHARED/httpCustom');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/http2/~TEST_Service_HTTP~SHARED~http2Custom'))
            .then((response) => {
                assert.strictEqual(response.name, 'http2Custom');
            });
    });

    it('should check multiplex profile with properties', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            TEST_Multiplex_HTTP: {
                class: 'Tenant',
                TEST_App: {
                    class: 'Application',
                    TEST_VS: {
                        class: 'Service_HTTP',
                        virtualPort: 80,
                        virtualAddresses: ['192.0.2.0'],
                        profileHTTP: {
                            use: 'httpProfile'
                        }
                    },
                    httpProfile: {
                        class: 'HTTP_Profile',
                        multiplexStatusReuse: '200 201 202 400 401 402',
                        multiplexTransformations: true
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
            .then(() => getPath('/mgmt/tm/ltm/profile/http/~TEST_Multiplex_HTTP~TEST_App~httpProfile'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/TEST_Multiplex_HTTP/TEST_App/httpProfile');
                assert.strictEqual(response.oneconnectStatusReuse, '200 201 202 400 401 402');
                assert.strictEqual(response.oneconnectTransformations, 'enabled');
            });
    });
});

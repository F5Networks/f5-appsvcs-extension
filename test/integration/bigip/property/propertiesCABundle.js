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

const crypto = require('crypto');
const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('CA_Bundle', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertCABundleClass(properties) {
        return assertClass('CA_Bundle', properties);
    }

    const certificates = [
        '-----BEGIN CERTIFICATE-----\nMIIG4DCCBMigAwIBAgIINJotoYIGsrMwDQYJKoZIhvcNAQELBQAwggEMMQswCQYD\nVQQGEwJFUzEPMA0GA1UECAwGTUFEUklEMQ8wDQYDVQQHDAZNQURSSUQxOjA4BgNV\nBAsMMXNlZSBjdXJyZW50IGFkZHJlc3MgYXQgd3d3LmNhbWVyZmlybWEuY29tL2Fk\nZHJlc3MxKTAnBgNVBAsMIENIQU1CRVJTIE9GIENPTU1FUkNFIFJPT1QgLSAyMDE2\nMRIwEAYDVQQFEwlBODI3NDMyODcxGDAWBgNVBGEMD1ZBVEVTLUE4Mjc0MzI4NzEb\nMBkGA1UECgwSQUMgQ0FNRVJGSVJNQSBTLkEuMSkwJwYDVQQDDCBDSEFNQkVSUyBP\nRiBDT01NRVJDRSBST09UIC0gMjAxNjAeFw0xNjA0MTQwNzM1NDhaFw00MDA0MDgw\nNzM1NDhaMIIBDDELMAkGA1UEBhMCRVMxDzANBgNVBAgMBk1BRFJJRDEPMA0GA1UE\nBwwGTUFEUklEMTowOAYDVQQLDDFzZWUgY3VycmVudCBhZGRyZXNzIGF0IHd3dy5j\nYW1lcmZpcm1hLmNvbS9hZGRyZXNzMSkwJwYDVQQLDCBDSEFNQkVSUyBPRiBDT01N\nRVJDRSBST09UIC0gMjAxNjESMBAGA1UEBRMJQTgyNzQzMjg3MRgwFgYDVQRhDA9W\nQVRFUy1BODI3NDMyODcxGzAZBgNVBAoMEkFDIENBTUVSRklSTUEgUy5BLjEpMCcG\nA1UEAwwgQ0hBTUJFUlMgT0YgQ09NTUVSQ0UgUk9PVCAtIDIwMTYwggIiMA0GCSqG\nSIb3DQEBAQUAA4ICDwAwggIKAoICAQDqxqSh1K2Zlsmf9bxQAPQsz/J46PIsAifW\ng4wEq9MOe1cgydSvZfSH3TAI185Bo3YK24pG5Kb97QjOcD/6EGB5TGuBVIBV5Od6\nIbZ1mtxe9g6Z/PjC30GOL6vHW20cUFnA7eisgkL+ua8vDEFRnL0AbmRRsjvlNquV\nkRL7McdzrBzYZXY7zhtMTrAfIAb7ULT7m6F5jhaV45/rGEuEqzmTzTeD0Ol8CyeP\n7UII6YZGMqyaJmlwYS0YvT9Q8J72aFBOaZVwwe2TqZdOKaK63cKfbkkIK6P6I/Ep\nXrB9MVmb7YzNpm74+PfYGOjaVulI8kB0fp7NIK8UJFnudzWFv0qZSql13bMm4wbO\nfW9LZKN2NBk+FG+FVDjiiy1AtWRmH1czHHDNw7QoWhQjXPy4vbP+OxJf9rmMHciU\nClbbcn7vJwcNALS/fZk/TUWzm/cdGdBPBPrHc5SIfYsUKpng6ZmSCcbWAWu38NtD\nV2Ibx0RS4pdjus/qzmDmCuUYaC0zgHWgMAdo9tX3Eyw6sJ7oWFVujFZETUMXQQLM\nd9xfRQVZz81g07/S9uL01dyHcTMHGvVvtH89l/tfZPRODgBECenr7D5xGQQXOUhg\nuEv/XshlmSumMvJbhqid6CN0EHjvyyedMbpgi04GUOJQHQdgwkGMFbRbNxwK5QkZ\ncgSKPOMB2wIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSeLmVP\nPlf1q32WxovfszVtSuieizAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZIhvcNAQELBQAD\nggIBAAVpKoWXJlC6QjkckyzST1vRXUQm2m9pK7V7ntD0Si5Ix+x/n8pZerlE9z69\n91BrUZ90/5AaQNCTeZIPiiNei6+BC9CLrWbgKtyaKb012GxAFElCPYkvupsrOLwa\nowu3iNetxhQM7nxJrK7s8j0YT4xtFF0Oqrffd6s7j2JOiwxlxhmOzcAMoXeqtN16\npxMF5jkYx5VkfgO2i5DB5V8AI5jmc9oR0hD/HlMiJ8fTAckvxTsybvDDOMoSZ7y6\nIym7xJVJWgbd1FqQ1BNt59XCfOJYBMDsxL2iPH7GI4F1fKtwXzSElfez1UeWT3HK\neDIIILRCpEJr1SWcsifrwQ5HRAnhKw/QIzZuHLm6TqzM8AyUzkEPa90P1cjgF4ve\nOl1Svul1JR26BQfaVhk8jdHX8VE22ZLvonhRBVi9UswKXm+v2tDlDNtswSPvOTF3\nFwcAjPa6D3D5vL7h5H3hzER6pCHsRz+o1hWl7AGpyHDomGcdvVlUfqFXFTUHxXLJ\nPrcpho2f2jJ5MtzbqOUJ/+9WKv6TsY4qE+2toitrLwTezS+SktY+YLV4AZUHCKls\n4xza++WbI1YgW+nQXMZKJDu847YiFiqEkv+o/pe/o53bYV7uGSos1+sNdlY4dX5J\nAJNXyfwjWvz08d8qnbCMafQQo1WdcDwi/wfWK7aZwJfQ9Cqg\n-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----\nMIIF+jCCA+KgAwIBAgIQAdFs++0ey5zfaqIxz4xU+TANBgkqhkiG9w0BAQwFADCB\niDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl\ncnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV\nBAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTUw\nMzExMDAwMDAwWhcNMjUwMzEwMjM1OTU5WjBwMQswCQYDVQQGEwJDTjERMA8GA1UE\nCBMIU2hhbmdoYWkxJTAjBgNVBAoTHFRydXN0QXNpYSBUZWNobm9sb2dpZXMsIElu\nYy4xJzAlBgNVBAMTHlRydXN0QXNpYSBSU0EgRFYgU1NMIFNlcnZlciBDQTCCASIw\nDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKVXxe36oseRAbs4z+/mLAWrYUom\nQDA0DwiDfYyqf8nrTG/wxELxtboEGBF4U5NbEye/i5t9in+mdbzdwpN657myfypS\nl2sC2YyY7ArmRxgTFyrtxhdzBLVnJEly2EAxk06QBwzcEfMJ5dWKpqcDY85K4N/C\nhO4E2BjzZRG7F3kZlo0T2oDbymNUt3J//cFwSiKl4LuSIUmvkUexbEG+75kvMZ5U\n5P3/C/becM61izwn+ftHFS7j9Rn7Hut4yqn+ePUOcBFZ6U02lcRDAPElq3SzyOvW\nmJxUTRiYHrnSK4qFHCBnNmfSlQvKUAo30Az4UiDcro+9YWtriR90DKbZrFECAwEA\nAaOCAXUwggFxMB8GA1UdIwQYMBaAFFN5v1qqK0rPVIDh2JvAnfKyA2bLMB0GA1Ud\nDgQWBBR7FhLOvGeCvXj0NqvcT2sXSgXtpTAOBgNVHQ8BAf8EBAMCAYYwEgYDVR0T\nAQH/BAgwBgEB/wIBADAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwIgYD\nVR0gBBswGTANBgsrBgEEAbIxAQICMTAIBgZngQwBAgEwUAYDVR0fBEkwRzBFoEOg\nQYY/aHR0cDovL2NybC51c2VydHJ1c3QuY29tL1VTRVJUcnVzdFJTQUNlcnRpZmlj\nYXRpb25BdXRob3JpdHkuY3JsMHYGCCsGAQUFBwEBBGowaDA/BggrBgEFBQcwAoYz\naHR0cDovL2NydC51c2VydHJ1c3QuY29tL1VTRVJUcnVzdFJTQUFkZFRydXN0Q0Eu\nY3J0MCUGCCsGAQUFBzABhhlodHRwOi8vb2NzcC51c2VydHJ1c3QuY29tMA0GCSqG\nSIb3DQEBDAUAA4ICAQAHygz5l1zWzcKT859aQgyDfUsiLyH+UKJ8jqSzOHb8A7Af\niK/K0HSZrg5tKiU90x2K/SpVuMmXlxNlxs7X1oDRvpgf8FHXZeVqm7fxuaFJ1fRi\nY73w9ClVhuvfYs2ziLyFt99nudgz9o/oroCe6gihR3LJW6jyS5LXcWE+uzv5CgLI\n6cHPjQdpgk8AcjqNBtqGiL7WgXRQMKHyb8jeBozKLi9M/VNW44WSaCs0JzXxBglL\n6fYOqOgF9lqrVVp257R3W4oqhbbHZ/2NY39hqs91YCBWhdVQvBYqM5b9N+v2+aEn\nRRYdyabdHUpMJ+5Jmbf9ydAcCix9eS8QMZbgal3vrwbJR6/MqOvuKcrBXe7j7ZxH\nWhL177r+e9SHzUcpCATDUJrL9fjCoBvWifiP9oPCVHkfpEYD9uu7sc+fBfFJP9V5\nmEQd0Vk5neWsNSq8cpfI7Ok4/R920+BD4an1Pkx9tly8P7Vza8aXSyv3OIplRYgr\n4Qf+6Cp2hVSSHL1Sv8D9TwvCqVvH7Zb1WwvuX4UHKo/Ae1cUiiEyavWGBo9o7bnV\ntyRdxTJmn6f6PeKe1u+HTCBoEuoVF22DJcbwTFiJ2U5voyb+OS6XXvIOIWOP+Imz\n3+WHDNM1GuNGDqz25zKCkl03MvK0Yw2FwT/HhSMSs1VmT5iCzaKXS7YgtGETKg==\n-----END CERTIFICATE-----',
        '-----BEGIN CERTIFICATE-----\nMIIG4DCCBMigAwIBAgIINJotoYIGsrMwDQYJKoZIhvcNAQELBQAwggEMMQswCQYD\nVQQGEwJFUzEPMA0GA1UECAwGTUFEUklEMQ8wDQYDVQQHDAZNQURSSUQxOjA4BgNV\nBAsMMXNlZSBjdXJyZW50IGFkZHJlc3MgYXQgd3d3LmNhbWVyZmlybWEuY29tL2Fk\nZHJlc3MxKTAnBgNVBAsMIENIQU1CRVJTIE9GIENPTU1FUkNFIFJPT1QgLSAyMDE2\nMRIwEAYDVQQFEwlBODI3NDMyODcxGDAWBgNVBGEMD1ZBVEVTLUE4Mjc0MzI4NzEb\nMBkGA1UECgwSQUMgQ0FNRVJGSVJNQSBTLkEuMSkwJwYDVQQDDCBDSEFNQkVSUyBP\nRiBDT01NRVJDRSBST09UIC0gMjAxNjAeFw0xNjA0MTQwNzM1NDhaFw00MDA0MDgw\nNzM1NDhaMIIBDDELMAkGA1UEBhMCRVMxDzANBgNVBAgMBk1BRFJJRDEPMA0GA1UE\nBwwGTUFEUklEMTowOAYDVQQLDDFzZWUgY3VycmVudCBhZGRyZXNzIGF0IHd3dy5j\nYW1lcmZpcm1hLmNvbS9hZGRyZXNzMSkwJwYDVQQLDCBDSEFNQkVSUyBPRiBDT01N\nRVJDRSBST09UIC0gMjAxNjESMBAGA1UEBRMJQTgyNzQzMjg3MRgwFgYDVQRhDA9W\nQVRFUy1BODI3NDMyODcxGzAZBgNVBAoMEkFDIENBTUVSRklSTUEgUy5BLjEpMCcG\nA1UEAwwgQ0hBTUJFUlMgT0YgQ09NTUVSQ0UgUk9PVCAtIDIwMTYwggIiMA0GCSqG\nSIb3DQEBAQUAA4ICDwAwggIKAoICAQDqxqSh1K2Zlsmf9bxQAPQsz/J46PIsAifW\ng4wEq9MOe1cgydSvZfSH3TAI185Bo3YK24pG5Kb97QjOcD/6EGB5TGuBVIBV5Od6\nIbZ1mtxe9g6Z/PjC30GOL6vHW20cUFnA7eisgkL+ua8vDEFRnL0AbmRRsjvlNquV\nkRL7McdzrBzYZXY7zhtMTrAfIAb7ULT7m6F5jhaV45/rGEuEqzmTzTeD0Ol8CyeP\n7UII6YZGMqyaJmlwYS0YvT9Q8J72aFBOaZVwwe2TqZdOKaK63cKfbkkIK6P6I/Ep\nXrB9MVmb7YzNpm74+PfYGOjaVulI8kB0fp7NIK8UJFnudzWFv0qZSql13bMm4wbO\nfW9LZKN2NBk+FG+FVDjiiy1AtWRmH1czHHDNw7QoWhQjXPy4vbP+OxJf9rmMHciU\nClbbcn7vJwcNALS/fZk/TUWzm/cdGdBPBPrHc5SIfYsUKpng6ZmSCcbWAWu38NtD\nV2Ibx0RS4pdjus/qzmDmCuUYaC0zgHWgMAdo9tX3Eyw6sJ7oWFVujFZETUMXQQLM\nd9xfRQVZz81g07/S9uL01dyHcTMHGvVvtH89l/tfZPRODgBECenr7D5xGQQXOUhg\nuEv/XshlmSumMvJbhqid6CN0EHjvyyedMbpgi04GUOJQHQdgwkGMFbRbNxwK5QkZ\ncgSKPOMB2wIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSeLmVP\nPlf1q32WxovfszVtSuieizAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZIhvcNAQELBQAD\nggIBAAVpKoWXJlC6QjkckyzST1vRXUQm2m9pK7V7ntD0Si5Ix+x/n8pZerlE9z69\n91BrUZ90/5AaQNCTeZIPiiNei6+BC9CLrWbgKtyaKb012GxAFElCPYkvupsrOLwa\nowu3iNetxhQM7nxJrK7s8j0YT4xtFF0Oqrffd6s7j2JOiwxlxhmOzcAMoXeqtN16\npxMF5jkYx5VkfgO2i5DB5V8AI5jmc9oR0hD/HlMiJ8fTAckvxTsybvDDOMoSZ7y6\nIym7xJVJWgbd1FqQ1BNt59XCfOJYBMDsxL2iPH7GI4F1fKtwXzSElfez1UeWT3HK\neDIIILRCpEJr1SWcsifrwQ5HRAnhKw/QIzZuHLm6TqzM8AyUzkEPa90P1cjgF4ve\nOl1Svul1JR26BQfaVhk8jdHX8VE22ZLvonhRBVi9UswKXm+v2tDlDNtswSPvOTF3\nFwcAjPa6D3D5vL7h5H3hzER6pCHsRz+o1hWl7AGpyHDomGcdvVlUfqFXFTUHxXLJ\nPrcpho2f2jJ5MtzbqOUJ/+9WKv6TsY4qE+2toitrLwTezS+SktY+YLV4AZUHCKls\n4xza++WbI1YgW+nQXMZKJDu847YiFiqEkv+o/pe/o53bYV7uGSos1+sNdlY4dX5J\nAJNXyfwjWvz08d8qnbCMafQQo1WdcDwi/wfWK7aZwJfQ9Cqg\n-----END CERTIFICATE-----'];
    const certChecksums = [];
    const certHash = [];
    certHash[0] = crypto.createHash('sha1');
    certHash[0].update(`${certificates[0]}\n${certificates[1]}`);
    certChecksums[0] = `SHA1:${certificates[0].length + 1 + certificates[1].length}:${certHash[0].digest('hex')}`;

    certHash[1] = crypto.createHash('sha1');
    certHash[1].update(`${certificates[1]}\n${certificates[2]}`);
    certChecksums[1] = `SHA1:${certificates[1].length + 1 + certificates[2].length}:${certHash[1].digest('hex')}`;

    certHash[2] = crypto.createHash('sha1');
    certHash[2].update(`${certificates[0]}\n${certificates[1]}`);
    certChecksums[2] = `SHA1:${certificates[0].length + 1 + certificates[1].length}:${certHash[2].digest('hex')}`;

    it('DefaultUpdateCABundle', () => {
        const properties = [
            {
                name: 'bundle',
                inputValue: [
                    `${certificates[0]}\n${certificates[1]}`,
                    `${certificates[1]}\n${certificates[2]}`,
                    `${certificates[0]}\n${certificates[1]}`
                ],
                expectedValue: [certChecksums[0], certChecksums[1], certChecksums[2]],
                extractFunction: (o) => o.checksum
            }
        ];

        return assertCABundleClass(properties);
    });
});

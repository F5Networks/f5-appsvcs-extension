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

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    createVlan,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const {
    simpleCopy
} = require('../../../../src/lib/util/util');

describe('redirect80', function () {
    this.timeout(GLOBAL_TIMEOUT);

    const declaration1 = {
        class: 'ADC',
        schemaVersion: '3.0.0',
        controls: {
            class: 'Controls',
            trace: true,
            logLevel: 'debug'
        },
        Common: {
            class: 'Tenant',
            Shared: {
                class: 'Application',
                template: 'shared',
                pTlsServer_CommonShared: {
                    class: 'TLS_Server',
                    certificates: [
                        {
                            certificate: 'tlsserver_common_shared_cert'
                        }
                    ]
                },
                tlsserver_common_shared_cert: {
                    class: 'Certificate',
                    certificate: '-----BEGIN CERTIFICATE-----\nMIID7TCCAtWgAwIBAgIJAJH4sMVzl1dMMA0GCSqGSIb3DQEBCwUAMIGMMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxEzARBgNVBAMMCnRscy1zZXJ2ZXIxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5jb20wHhcNMTgwMjI4MTkwNzMyWhcNMjgwMjI2MTkwNzMyWjCBjDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxCzAJBgNVBAoMAkY1MQ0wCwYDVQQLDARUZXN0MRMwEQYDVQQDDAp0bHMtc2VydmVyMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwEMNPATg7Vz3jqInIVf2jnOi/9/HYIr8xZYgU0YHHFEiquQ6nYfX4mwezZ6zo9GJom7gHiQ3FNy3fN+RatatZmBmuyvJ+z/uZ6pbKmsuJLPLT89olO9JxMtb4a83oHDz3f6rcc2j8KwTr4lUDc452jLF4ZQ55O17s2tYMg4XW2G5DqUGzp1UKiClaDvpN23ZVOlnqDVpIlnVvJ1mz12AzFPny8xD1lhILv78yMltimdaWhyCLcFom0DbloRvYmowjGLHqLTAZ40jI3YUdw39LEqTXgfDF3DnOgZCIdRpouD9cVZBoQroXpVVfWG7sfzKLqWaAEHhjbhdK5l/p3mT7wIDAQABo1AwTjAdBgNVHQ4EFgQUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwHwYDVR0jBBgwFoAUBlCKIZ0+9DQ4ylW86qsyXoW8KjkwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAuiE5MocznYDc+JHvEgSaiK9fyRBl/bitKTkiOtxWjEFpF5nH6QddV0pqQziXLb6iSbTBwlDJr9Bwzng8moOYbsD7hP2/mCKJj8o/lsRaPAk+abekWXRqYFNucct/ipBG3s+N2PH+MEpy3ioPH1OBuam6UomjE+mqoP09FrQha1hHEbabt4nN11l8fM5GW+0zRU0SwLFvnR58zUSlTMwczSPA0eUrhEU4AGPD/KN8d1fYnCcWqPF5ePcU11k7SNFl5PZQsgXv9cOc2Vq+qc/NmDBO0rQyKEAPDxbM8CK212G1M+ENTqmuePnr+mNope3AhEsqfH8IOPEoT7fIwmpqLw==\n-----END CERTIFICATE-----',
                    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,48A244386264B39E3E47B2616B98945D\n\nXnK9a8yG1G5UB6XtsuL8UIz1YGBAJyDiaP+GxK7NoAU8l4fpV0yg3DSCgIDjHbDI\nfMS9LfR6n4urER39fzAMmJDEiAzx/+j8CnoU23xHFiUQT9adupWFOEFL4k9xqeC0\nvTz2/iii49nL3TZ+yIi6ofB7evNp4LnrZmhDyJSUGedRDJArIujqaJfJ1omqwJz9\nRx3Z2p+RAUIRFcPbSy3EzOA8muvo7eo9gZAcTJFB5QtGdAXb+gb+0dOZAPVT5I3v\nHfUMCLH2cZMFB07nd5W44BMJ0pAtC03GqVC8S/rRUgFftVEtUSErJB5RZeiHXR1Z\nvj1JnaHSUaEHy+lcWzK0St6FGQNLHuwCrLgLqHKm+YXOMOjyojTjPwWoc04PkOA3\nYo34dli9o9tMEql2fksilHFo9NTOQ68nSr/oHbjGHP9L6rZS7voxa5OXkQy9GFu5\nSHF3nkRbTNuOUDCHjV0DdOpzVXHADuDJfCUtYSRqeUBVguoC5B8yiVxSf/5L89hI\nxBcLNQ3IpCQ+hGHHHznnyxs61IxZYRDUQ+ZF8QoYoFAGboKFKcstSzzrXvo1441U\nEN+KXKSLI9CpLMge5R1W+Jf1bVNgU0e1cUFoh2yuH9k0YWOWNURdvb2fF/dPU7+I\nLf4/+aqEtxs/64+Qp316xwgaZYY0uXdl/X/1WOY3NmKV/l6+B+UbbxkGHElm3AIM\nfJUNj3p1x90qydmPxM7qZKmm8FeVopmXywtzjcw8CMhcguM0TMnksX04mznoWJ3f\nSAyLUf3B7LzJjOO8GYHtt+VHCKXcR4mLLzhQfuouHB9T+TKnDvpyZ46X78yCuN1C\nTUvq5wbUM49EKTSm9e23QIy3QQKRHMlmjm04JrxJDuMgk+97hNAVafCe7JxpUJja\n244oObrjiAhSWMYeOyfwcFHafblvFfx0F5tEi9u2CKSyzBBzTbH/dLmx2Lk7zthu\nPA8zIRWkGxjgotN+ASVjoPMo7cyPTb5DEhBTbfobY01QkTv35+Z39mO46dc21JZ7\nUxjOFOH6KK3KAdj9BVkZXU9nSwSKYHbJ7b6GUAnk7dYxONGomtkoYIfAcLgIhEhr\nZ5JCKbbIMTO6PdS9jv3OiJBkV/amZDhtlQbz1W/yd4sYEZMRaBNVc7Zg7oQwtRoA\nqHbuuEitpEpC4875MS75kM9uQXkYvJS2G9/bdSN/pSsa08GzZTYi0uyRGbYe8jjN\nQWmceVtzZt/u88TQkGabTlBmnYKGnqghtFiyoEbZYox+DlK5WiL3aA+DdtHG/d/w\nAucA6buNaPA7jy5rm829JlpvhdD/QkSzSJGe0nrgrTNsF21ltEgS64gR/UupEfVz\nSgGXpQgWRJ/rbvIpJJITNHBIL/cbqpXzw6S54yESoVjNlhbdodl5vyZjG/m93jDQ\n8PA5/Tuxbhx85p/qiQ1A8GTlUruU/WD2lmIT3lfubIkmduGK2k2YvL16jg5DMA5U\n02sxmGJDDodyb+LQAUVGcvqE1nlV4FbNEib+Ffh/onH5Y1hinRiiOPlHiM7l5Vkn\ne38pJVsWJPio/hJFVsn++Wyv4O7SkPPYqc0emzlRBoA0pcvA1SRC+/q2bH4yTAfB\n-----END RSA PRIVATE KEY-----',
                    passphrase: {
                        ciphertext: 'ZjVmNQ==',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                        ignoreChanges: true
                    }
                }
            }
        },
        redirect80: {
            class: 'Tenant',
            application: {
                class: 'Application',
                template: 'generic',
                g_https_simple: {
                    class: 'Service_HTTPS',
                    virtualAddresses: [
                        '198.19.192.61'
                    ],
                    redirect80: false,
                    serverTLS: '/Common/Shared/pTlsServer_CommonShared'
                }
            }
        }
    };

    it('should be able to move from redirect80 false to true to false', () => {
        const testVlan = 'internal';
        const declaration2 = simpleCopy(declaration1);
        declaration2.redirect80.application.g_https_simple.redirect80 = true;
        declaration2.redirect80.application.g_https_simple.allowVlans = [
            { bigip: `/Common/${testVlan}` }
        ];

        return Promise.resolve()
            .then(() => createVlan(testVlan))
            // redirect80 = false
            .then(() => postDeclaration(declaration1), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual?$filter=partition+eq+redirect80'))
            .then((response) => {
                assert.isTrue(response.items.length === 1);
                assert.strictEqual(response.items[0].name, 'g_https_simple');
                assert.strictEqual(response.items[0].destination, '/redirect80/198.19.192.61:443');
            })
            // redirect80 = true
            .then(() => postDeclaration(declaration2), { declarationIndex: 1 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual?$filter=partition+eq+redirect80'))
            .then((response) => {
                assert.isTrue(response.items.length === 2);
                const server = response.items.filter((i) => i.name === 'g_https_simple')[0];
                assert.strictEqual(server.destination, '/redirect80/198.19.192.61:443');
                const redirect = response.items.filter((i) => i.name === 'g_https_simple-Redirect-')[0];
                assert.strictEqual(redirect.destination, '/redirect80/198.19.192.61:80');
                assert.strictEqual(redirect.addressStatus, 'yes');
                assert.strictEqual(redirect.ipProtocol, 'tcp');
                assert.deepStrictEqual(redirect.rules, ['/Common/_sys_https_redirect']);
                assert.strictEqual(redirect.connectionLimit, 0);
                assert.strictEqual(redirect.nat64, 'disabled');
                assert.strictEqual(redirect.serviceDownImmediateAction, 'none');
                assert.strictEqual(redirect.sourcePort, 'preserve');
                assert.strictEqual(redirect.translateAddress, 'enabled');
                assert.strictEqual(redirect.translatePort, 'enabled');
                assert.isTrue(redirect.vlansEnabled);
                assert.deepStrictEqual(redirect.vlans, [`/Common/${testVlan}`]);
                assert.strictEqual(redirect.enabled, true);

                return getPath(redirect.profilesReference.link);
            })
            .then((response) => {
                assert.isTrue(response.items.length === 2);
                assert.strictEqual(response.items.filter((i) => i.fullPath === '/Common/f5-tcp-progressive').length, 1);
                assert.strictEqual(response.items.filter((i) => i.fullPath === '/Common/http').length, 1);
            })
            // redirect80 = false
            .then(() => postDeclaration(declaration1), { declarationIndex: 2 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual?$filter=partition+eq+redirect80'))
            .then((response) => {
                assert.isTrue(response.items.length === 1);
                assert.strictEqual(response.items[0].name, 'g_https_simple');
                assert.strictEqual(response.items[0].destination, '/redirect80/198.19.192.61:443');
            })
            .then(() => deleteDeclaration());
    });
});

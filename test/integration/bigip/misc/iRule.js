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
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('iRule', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    it('should reference iFile from within iRule', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            TEST_iFile: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    testIFile: {
                        class: 'iFile',
                        iFile: {
                            base64: 'TG9vaywgYW4gaUZpbGUh'
                        }
                    },
                    iRule: {
                        class: 'iRule',
                        iRule: {
                            base64: 'd2hlbiBIVFRQX1JFUVVFU1QgewogICAgICAgICBzZXQgaWZpbGVDb250ZW50IFtpZmlsZSBnZXQgIi9URVNUX2lGaWxlL0FwcGxpY2F0aW9uL3Rlc3RJRmlsZSJdCiAgICAgICAgIEhUVFA6OnJlc3BvbmQgMjAwIGNvbnRlbnQgJGlmaWxlQ29udGVudAogICAgICAgICB1bnNldCBpZmlsZUNvbnRlbnQKICAgICAgfQ=='
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/rule/~TEST_iFile~Application~iRule'))
            .then((response) => {
                const iFileRef = response.apiAnonymous.includes('/TEST_iFile/Application/testIFile');
                assert.equal(iFileRef, true);
            });
    });

    it('should maintained the iRules when the declaration contains an https monitor', () => {
        const ruleOne = 'when CLIENT_ACCEPTED { TCP::collect }\n\n\n\t\twhen CLIENTSSL_HANDSHAKE {\n\t\t\t\t\tSSL::collect\n\t\t\t\t}\n\n\t\t when SERVER_CONNECTED {\n\t\t\tset reencryptssl_class "/test/Shared/crd_0_0_0_200_443_ssl_reencrypt_serverssl_dg"\n\t\t\tset edgessl_class "/test/Shared/crd_0_0_0_200_443_ssl_edge_serverssl_dg"\n\t\t\tif { [info exists sslpath] and [class exists $reencryptssl_class] } {\n\t\t\t\t# Find the nearest child path which matches the reencrypt_class\n\t\t\t\tfor {set i $rc} {$i \u003e= 0} {incr i -1} {\n\t\t\t\t\tif { [class exists $reencryptssl_class] } {\n\t\t\t\t\t\tset reen [class match -value $sslpath equals $reencryptssl_class]\n                        # check for wildcard domain match\n                        if { $reen equals "" } {\n\t\t\t\t\t\t    if { [class match $wc_routepath equals $reencryptssl_class] } {\n\t\t\t\t\t\t        set reen [class match -value $wc_routepath equals $reencryptssl_class]\n\t\t\t\t\t\t    }\n                        }\n\t\t\t\t\t\tif { not ($reen equals "") } {\n\t\t\t\t\t\t\t    set sslprofile $reen\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tif { [class exists $edgessl_class] } {\n\t\t\t\t\t\tset edge [class match -value $sslpath equals $edgessl_class]\n                        # check for wildcard domain match\n                        if { $edge equals "" } {\n\t\t\t\t\t\t    if { [class match $wc_routepath equals $edgessl_class] } {\n\t\t\t\t\t\t        set edge [class match -value $wc_routepath equals $edgessl_class]\n\t\t\t\t\t\t    }\n                        }\n\t\t\t\t\t\tif { not ($edge equals "") } {\n\t\t\t\t\t\t\t    set sslprofile $edge\n\t\t\t\t\t\t}\n\n\t\t\t\t\t}\n\t\t\t\t\tif { not [info exists sslprofile] } {\n\t\t\t\t\t\tset sslpath [\n\t\t\t\t\t\t\tstring range $sslpath 0 [\n\t\t\t\t\t\t\t\texpr {[string last "/" $sslpath]-1}\n\t\t\t\t\t\t\t]\n\t\t\t\t\t\t]\n                        set wc_routepaath [\n\t\t\t\t\t\t\tstring range $wc_routepath 0 [\n\t\t\t\t\t\t\t\texpr {[string last "/" $wc_routepath]-1}\n\t\t\t\t\t\t\t]\n\t\t\t\t\t\t]\n\t\t\t\t\t}\n\t\t\t\t\telse {\n\t\t\t\t\t\tbreak\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\t# Assign respective SSL profile based on ssl_reencrypt_serverssl_dg\n\t\t\t\tif { not ($sslprofile equals "false") } {\n\t\t\t\t\t\tSSL::profile $reen\n\t\t\t\t} else {\n\t\t\t\t\t\tSSL::disable serverside\n\t\t\t\t}\n\t\t\t}\n}';
        const ruleTwo = 'when CLIENT_ACCEPTED { TCP::collect }\n\n\n\t\twhen CLIENTSSL_HANDSHAKE {\n\t\t\t\t\tSSL::collect\n\t\t\t\t}\n\n\t\t when SERVER_CONNECTED {\n\t\t\tset reencryptssl_class "/test/Shared/crd_0_0_0_199_443_ssl_reencrypt_serverssl_dg"\n\t\t\tset edgessl_class "/test/Shared/crd_0_0_0_199_443_ssl_edge_serverssl_dg"\n\t\t\tif { [info exists sslpath] and [class exists $reencryptssl_class] } {\n\t\t\t\t# Find the nearest child path which matches the reencrypt_class\n\t\t\t\tfor {set i $rc} {$i \u003e= 0} {incr i -1} {\n\t\t\t\t\tif { [class exists $reencryptssl_class] } {\n\t\t\t\t\t\tset reen [class match -value $sslpath equals $reencryptssl_class]\n                        # check for wildcard domain match\n                        if { $reen equals "" } {\n\t\t\t\t\t\t    if { [class match $wc_routepath equals $reencryptssl_class] } {\n\t\t\t\t\t\t        set reen [class match -value $wc_routepath equals $reencryptssl_class]\n\t\t\t\t\t\t    }\n                        }\n\t\t\t\t\t\tif { not ($reen equals "") } {\n\t\t\t\t\t\t\t    set sslprofile $reen\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tif { [class exists $edgessl_class] } {\n\t\t\t\t\t\tset edge [class match -value $sslpath equals $edgessl_class]\n                        # check for wildcard domain match\n                        if { $edge equals "" } {\n\t\t\t\t\t\t    if { [class match $wc_routepath equals $edgessl_class] } {\n\t\t\t\t\t\t        set edge [class match -value $wc_routepath equals $edgessl_class]\n\t\t\t\t\t\t    }\n                        }\n\t\t\t\t\t\tif { not ($edge equals "") } {\n\t\t\t\t\t\t\t    set sslprofile $edge\n\t\t\t\t\t\t}\n\n\t\t\t\t\t}\n\t\t\t\t\tif { not [info exists sslprofile] } {\n\t\t\t\t\t\tset sslpath [\n\t\t\t\t\t\t\tstring range $sslpath 0 [\n\t\t\t\t\t\t\t\texpr {[string last "/" $sslpath]-1}\n\t\t\t\t\t\t\t]\n\t\t\t\t\t\t]\n                        set wc_routepaath [\n\t\t\t\t\t\t\tstring range $wc_routepath 0 [\n\t\t\t\t\t\t\t\texpr {[string last "/" $wc_routepath]-1}\n\t\t\t\t\t\t\t]\n\t\t\t\t\t\t]\n\t\t\t\t\t}\n\t\t\t\t\telse {\n\t\t\t\t\t\tbreak\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\t# Assign respective SSL profile based on ssl_reencrypt_serverssl_dg\n\t\t\t\tif { not ($sslprofile equals "false") } {\n\t\t\t\t\t\tSSL::profile $reen\n\t\t\t\t} else {\n\t\t\t\t\t\tSSL::disable serverside\n\t\t\t\t}\n\t\t\t}\n}';
        const decl = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            TEST_iRule_HttpsMonitor: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    irule: {
                        class: 'iRule',
                        iRule: ruleOne
                    },
                    httpsMonitor: {
                        class: 'Monitor',
                        adaptive: false,
                        interval: 60,
                        monitorType: 'https',
                        receive: '',
                        send: 'GET /healthz HTTP/1.0\r\n\r\n',
                        targetAddress: '',
                        timeout: 10
                    }
                }
            }
        };

        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            TEST_iRule_HttpsMonitor: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    irule: {
                        class: 'iRule',
                        iRule: ruleOne
                    },
                    irule1: {
                        class: 'iRule',
                        iRule: ruleTwo
                    },
                    httpsMonitor: {
                        class: 'Monitor',
                        adaptive: false,
                        interval: 60,
                        monitorType: 'https',
                        receive: '',
                        send: 'GET /healthz HTTP/1.0\r\n\r\n',
                        targetAddress: '',
                        timeout: 10
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/rule/~TEST_iRule_HttpsMonitor~Shared~irule'))
            .then((response) => {
                assert.strictEqual(response.name, 'irule');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/irule');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
                assert.deepEqual(response.apiAnonymous, ruleOne);
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~TEST_iRule_HttpsMonitor~Shared~httpsMonitor'))
            .then((response) => {
                assert.strictEqual(response.name, 'httpsMonitor');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/httpsMonitor');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/rule/~TEST_iRule_HttpsMonitor~Shared~irule'))
            .then((response) => {
                assert.strictEqual(response.name, 'irule');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/irule');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
                assert.strictEqual(response.apiAnonymous, ruleOne);
            })
            .then(() => getPath('/mgmt/tm/ltm/rule/~TEST_iRule_HttpsMonitor~Shared~irule1'))
            .then((response) => {
                assert.strictEqual(response.name, 'irule1');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/irule1');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
                assert.strictEqual(response.apiAnonymous, ruleTwo);
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~TEST_iRule_HttpsMonitor~Shared~httpsMonitor'))
            .then((response) => {
                assert.strictEqual(response.name, 'httpsMonitor');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/httpsMonitor');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
            })
            .then(() => postDeclaration(decl, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/rule/~TEST_iRule_HttpsMonitor~Shared~irule'))
            .then((response) => {
                assert.strictEqual(response.name, 'irule');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/irule');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
                assert.deepEqual(response.apiAnonymous, ruleOne);
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/rule/~TEST_iRule_HttpsMonitor~Shared~irule1'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"01020036:3: The requested iRule (/TEST_iRule_HttpsMonitor/Shared/irule1) was not found.","errorStack":[],"apiError":3}'
            ))
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~TEST_iRule_HttpsMonitor~Shared~httpsMonitor'))
            .then((response) => {
                assert.strictEqual(response.name, 'httpsMonitor');
                assert.strictEqual(response.fullPath, '/TEST_iRule_HttpsMonitor/Shared/httpsMonitor');
                assert.strictEqual(response.partition, 'TEST_iRule_HttpsMonitor');
            });
    });
});

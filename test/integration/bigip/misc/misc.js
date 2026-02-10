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

const oauth = require('../../../common/oauth');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    getProvisionedModules,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Class Persist', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());
    let declare;
    beforeEach(() => {
        declare = {
            class: 'AS3',
            action: 'deploy',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                id: 'fghijkl7890',
                label: 'Sample 1',
                remark: 'HTTP with custom persistence',
                Sample_http_01: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.10.10'
                            ],
                            pool: 'web_pool',
                            persistenceMethods: [{
                                use: 'jsessionid'
                            }]
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: [
                                'http'
                            ],
                            members: [{
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.6.10',
                                    '192.0.6.11'
                                ]
                            }]
                        },
                        jsessionid: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'JSESSIONID',
                            ttl: 18
                        },
                        cookieDuration1Day: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'cookieDuration1Day',
                            ttl: 86400
                        },
                        cookieDuration1Day25Seconds: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'cookieDuration1Day25Seconds',
                            ttl: 86425
                        },
                        cookieDuration7Days: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'cookieDuration7Days',
                            ttl: 604800
                        }
                    }
                }
            }
        };
    });
    it('should handle TTL value properly', () => {
        const Path = '/mgmt/shared/appsvcs/declare/';
        return Promise.resolve()
            .then(() => postDeclaration(declare, { declarationIndex: 0 }, undefined, Path))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~jsessionid'))
            .then((response) => {
                assert.strictEqual(response.expiration, '18');
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration1Day'))
            .then((response) => {
                assert.strictEqual(response.expiration, '1:0:0:0');
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration1Day25Seconds'))
            .then((response) => {
                assert.strictEqual(response.expiration, '1:0:0:25');
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration7Days'))
            .then((response) => {
                assert.strictEqual(response.expiration, '7:0:0:0');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Sample_http_01~A1~service'))
            .then((response) => {
                assert.strictEqual(response.persist[0].name, 'jsessionid');
            })
            .then(() => deleteDeclaration(undefined, { path: `${Path}?async=true`, sendDelete: true }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration1Day25Seconds'),
                /The requested Persistence Profile \(\/Sample_http_01\/A1\/cookieDuration1Day25Seconds\) was not found/,
                'Persistence cookie should have been deleted'
            ));
    });
});

describe('LTM Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should respect multiple json strings specified in action', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.53.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        strategy: 'first-match',
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                conditions: [],
                                name: 'rule1',
                                actions: [
                                    {
                                        type: 'httpHeader',
                                        replace: {
                                            name: 'Host',
                                            value: 'tcl:[regsub -nocase {.test1.com$} [HTTP::host] {.test2.com}]'
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/rule1/actions/0'))
            .then((response) => {
                assert.strictEqual(response.value, 'tcl:[regsub -nocase  { .test1.com$  } [HTTP::host]  { .test2.com  } ]');
            })
            .then(() => deleteDeclaration());
    });

    it('should work \'client-accepted\' for geoip rule condtion', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'default',
                                conditions: [
                                    {
                                        type: 'geoip',
                                        event: 'client-accepted',
                                        continent: {
                                            operand: 'matches',
                                            values: ['EU']
                                        }
                                    }
                                ],
                                actions: [
                                    {
                                        type: 'drop',
                                        event: 'client-accepted'
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/default/conditions/0'))
            .then((response) => {
                assert.strictEqual(response.clientAccepted, true);
                assert.strictEqual(response.continent, true);
                assert.strictEqual(response.geoip, true);
                assert.strictEqual(response.caseInsensitive, true);
                assert.strictEqual(response.values[0], 'EU');
            })
            .then(() => deleteDeclaration());
    });

    it('should work l7dos Policy rule action', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        const afm = ['afm'].every((m) => getProvisionedModules().includes(m));
        if (!asm && !afm) {
            this.skip();
        }
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'enabledos',
                                conditions: [],
                                actions: [
                                    {
                                        type: 'l7dos',
                                        profile: {
                                            use: 'DOS_Profile'
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    DOS_Profile: {
                        class: 'DOS_Profile',
                        application: {
                            triggerIRule: true,
                            scrubbingDuration: 42,
                            remoteTriggeredBlackHoleDuration: 10,
                            stressBasedDetection: {
                                badActor: {
                                    mitigationMode: 'standard'
                                }
                            }
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/enabledos/actions/0'))
            .then((response) => {
                assert.strictEqual(response.l7dos, true);
                assert.strictEqual(response.fromProfile, '/tenant/app/DOS_Profile');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });

    it('should handle LTM legacy policy automatically adds "requires { http }"', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'default',
                                conditions: [
                                    {
                                        type: 'tcp',
                                        event: 'client-accepted',
                                        address: {
                                            values: [
                                                '192.0.2.0'
                                            ]
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/tenant/app/policyjson');
                assert.strictEqual(response.requires.length, 1);
                assert.strictEqual(response.requires[0], 'tcp');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/default/conditions/0'))
            .then((response) => {
                assert.strictEqual(response.values.length, 1);
                assert.strictEqual(response.values[0], '192.0.2.0');
            })
            .then(() => {
                declaration.tenant.app.policyjson.rules[0].conditions.push({
                    type: 'tcp',
                    event: 'client-accepted',
                    port: {
                        values: [
                            8080
                        ]
                    }
                });
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson'))
            .then((response) => {
                assert.strictEqual(response.fullPath, '/tenant/app/policyjson');
                assert.strictEqual(response.requires.length, 1);
                assert.strictEqual(response.requires[0], 'tcp');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/default/conditions/0'))
            .then((response) => {
                assert.strictEqual(response.values.length, 1);
                assert.strictEqual(response.values[0], '192.0.2.0');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/default/conditions/1'))
            .then((response) => {
                assert.strictEqual(response.values.length, 1);
                assert.strictEqual(response.values[0], '8080');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => deleteDeclaration());
    });

    it('should handle the clientSsl enabled action value in Endpoint_Policy', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        strategy: 'first-match',
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'rule1',
                                actions: [
                                    {
                                        type: 'clientSsl',
                                        enabled: true
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/rule1/actions/0'))
            .then((response) => {
                assert.strictEqual(response.enable, true);
                assert.strictEqual(response.disable, undefined);
                assert.strictEqual(response.serverSsl, true);
            })
            .then(() => {
                declaration.tenant.app.policyjson.rules[0].actions[0].enabled = false;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/rule1/actions/0'))
            .then((response) => {
                assert.strictEqual(response.enable, undefined);
                assert.strictEqual(response.disable, true);
                assert.strictEqual(response.serverSsl, true);
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle the clientSsl enable action value in Endpoint_Policy', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        strategy: 'first-match',
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                conditions: [],
                                name: 'rule1',
                                actions: [
                                    {
                                        type: 'clientSsl',
                                        enable: true
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/rule1/actions/0'))
            .then((response) => {
                assert.strictEqual(response.enable, true);
                assert.strictEqual(response.disable, undefined);
                assert.strictEqual(response.serverSsl, true);
            })
            .then(() => {
                declaration.tenant.app.policyjson.rules[0].actions[0].enable = false;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/rule1/actions/0'))
            .then((response) => {
                assert.strictEqual(response.enable, undefined);
                assert.strictEqual(response.disable, true);
                assert.strictEqual(response.serverSsl, true);
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle traffic policy rule for the declared one to insert X-Forwarded-Proto header with "http" value in action', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.56.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    policyjson: {
                        strategy: 'first-match',
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                conditions: [],
                                name: 'rule1',
                                actions: [
                                    {
                                        event: 'request',
                                        type: 'httpHeader',
                                        insert: {
                                            name: 'X-Forwarded-Proto',
                                            value: 'http'
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/ltm/policy/~tenant~app~policyjson/rules/rule1/actions/0'))
            .then((response) => {
                assert.strictEqual(response.httpHeader, true);
                assert.strictEqual(response.tmName, 'X-Forwarded-Proto');
                assert.strictEqual(response.value, 'http');
            })
            .then(() => deleteDeclaration());
    });
});

describe('LTM Monitor', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should change the ltm monitor type from https to tcp', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.56.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https',
                        interval: 5,
                        timeout: 16
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~tenant~app~testMonitor'))
            .then((response) => {
                assert.strictEqual(response['user-defined'], undefined);
            })
            .then(() => {
                declaration.tenant.app.testMonitor.monitorType = 'tcp';
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/monitor/https/~tenant~app~testMonitor'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /tenant/app/testMonitor","errorStack":[],"apiError":1}'
            ))
            .then(() => getPath('/mgmt/tm/ltm/monitor/tcp/~tenant~app~testMonitor'))
            .then((response) => {
                assert.strictEqual(response['user-defined'], undefined);
            })
            .finally(() => deleteDeclaration());
    });

    it('should change the ltm monitor type from https to tcp-half-open', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.56.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https',
                        interval: 5,
                        timeout: 16
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~tenant~app~testMonitor'))
            .then((response) => {
                assert.strictEqual(response['user-defined'], undefined);
            })
            .then(() => {
                declaration.tenant.app.testMonitor.monitorType = 'tcp-half-open';
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/monitor/https/~tenant~app~testMonitor'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /tenant/app/testMonitor","errorStack":[],"apiError":1}'
            ))
            .then(() => getPath('/mgmt/tm/ltm/monitor/tcp-half-open/~tenant~app~testMonitor'))
            .then((response) => {
                assert.strictEqual(response['user-defined'], undefined);
            })
            .finally(() => deleteDeclaration());
    });

    it('should change the ltm monitor type from https to udp', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.56.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    testMonitor: {
                        class: 'Monitor',
                        monitorType: 'https',
                        interval: 5,
                        timeout: 16
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/monitor/https/~tenant~app~testMonitor'))
            .then((response) => {
                assert.strictEqual(response['user-defined'], undefined);
            })
            .then(() => {
                declaration.tenant.app.testMonitor.monitorType = 'udp';
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/monitor/https/~tenant~app~testMonitor'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"Object not found - /tenant/app/testMonitor","errorStack":[],"apiError":1}'
            ))
            .then(() => getPath('/mgmt/tm/ltm/monitor/udp/~tenant~app~testMonitor'))
            .then((response) => {
                assert.strictEqual(response['user-defined'], undefined);
            })
            .finally(() => deleteDeclaration());
    });
});

describe('WAF Policy', function () {
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

    it('should allow to use of policy or use referring an existing ASM Policy on the BIG-IP for policyWAF', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        if (!asm) {
            this.skip();
        }

        const wafUrl = {
            url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`,
            ignoreChanges: false
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            wafUrl.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    AppPolicy01: {
                        class: 'WAF_Policy',
                        url: wafUrl
                    }
                }
            }
        };

        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.0'],
                        policyWAF: {
                            bigip: '/Common/Shared/AppPolicy01'
                        }
                    }
                }
            }
        };

        return postDeclaration(decl, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/asm/policies?%24filter=fullPath%20eq%20/Common/Shared/AppPolicy01&%24select=fullPath,name'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].kind, 'tm:asm:policies:policystate');
                assert.strictEqual(response.items[0].name, 'AppPolicy01');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/AppPolicy01');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~Tenant~Application~_WAF_service/rules/default/actions/0'))
            .then((response) => {
                assert.strictEqual(response.policy, '/Common/Shared/AppPolicy01');
            })
            .catch((error) => {
                throw error;
            })
            .then(() => deleteDeclaration());
    });

    it('should allow policyWAF to use of policy or use referring an existing ASM Policy on the BIG-IP for WAF_Policy', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        if (!asm) {
            this.skip();
        }
        const wafUrl = {
            url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`,
            ignoreChanges: false
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            wafUrl.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    AppPolicy01: {
                        class: 'WAF_Policy',
                        url: wafUrl
                    }
                }
            }
        };

        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.0'],
                        policyWAF: {
                            use: 'wafPolicy'
                        }
                    },
                    wafPolicy: {
                        class: 'WAF_Policy',
                        policy: {
                            bigip: '/Common/Shared/AppPolicy01'
                        },
                        ignoreChanges: false
                    }
                }
            }
        };

        const decl2 = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.0'],
                        policyWAF: {
                            bigip: '/Common/Shared/AppPolicy01'
                        }
                    }
                }
            }
        };

        return postDeclaration(decl, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/asm/policies?%24filter=fullPath%20eq%20/Common/Shared/AppPolicy01&%24select=fullPath,name'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].kind, 'tm:asm:policies:policystate');
                assert.strictEqual(response.items[0].name, 'AppPolicy01');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/AppPolicy01');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~Tenant~Application~_WAF_service/rules/default/actions/0'))
            .then((response) => {
                assert.strictEqual(response.policy, '/Common/Shared/AppPolicy01');
            })
            .then(() => postDeclaration(decl2, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~Tenant~Application~_WAF_service/rules/default/actions/0'))
            .then((response) => {
                assert.strictEqual(response.policy, '/Common/Shared/AppPolicy01');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 3 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~Tenant~Application~_WAF_service/rules/default/actions/0'))
            .then((response) => {
                assert.strictEqual(response.policy, '/Common/Shared/AppPolicy01');
            })
            .then(() => deleteDeclaration());
    });

    it('should allow policyWAF to use of policy or use referring an existing ASM Policy on the BIG-IP for WAF_Policy and policyWAF', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        if (!asm) {
            this.skip();
        }
        const wafUrl = {
            url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`,
            ignoreChanges: false
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            wafUrl.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    AppPolicy01: {
                        class: 'WAF_Policy',
                        url: wafUrl
                    },
                    AppPolicy02: {
                        class: 'WAF_Policy',
                        url: wafUrl
                    }
                }
            }
        };

        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.0'],
                        policyWAF: {
                            use: 'wafPolicy'
                        }
                    },
                    service1: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.1'],
                        policyWAF: {
                            bigip: '/Common/Shared/AppPolicy02'
                        }
                    },
                    wafPolicy: {
                        class: 'WAF_Policy',
                        policy: {
                            bigip: '/Common/Shared/AppPolicy01'
                        },
                        ignoreChanges: false
                    }
                }
            }
        };

        return postDeclaration(decl, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/asm/policies?%24filter=fullPath%20eq%20/Common/Shared/AppPolicy01&%24select=fullPath,name'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].kind, 'tm:asm:policies:policystate');
                assert.strictEqual(response.items[0].name, 'AppPolicy01');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/AppPolicy01');
            })
            .then(() => getPath('/mgmt/tm/asm/policies?%24filter=fullPath%20eq%20/Common/Shared/AppPolicy02&%24select=fullPath,name'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].kind, 'tm:asm:policies:policystate');
                assert.strictEqual(response.items[0].name, 'AppPolicy02');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/AppPolicy02');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~Tenant~Application~_WAF_service/rules/default/actions/0'))
            .then((response) => {
                assert.strictEqual(response.policy, '/Common/Shared/AppPolicy01');
            })
            .then(() => getPath('/mgmt/tm/ltm/policy/~Tenant~Application~_WAF_service1/rules/default/actions/0'))
            .then((response) => {
                assert.strictEqual(response.policy, '/Common/Shared/AppPolicy02');
            })
            .then(() => deleteDeclaration());
    });

    it('should not allow to use reference of the WAF_Policy', function () {
        const asm = ['asm'].every((m) => getProvisionedModules().includes(m));
        if (!asm) {
            this.skip();
        }
        const wafUrl = {
            url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`,
            ignoreChanges: false
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            wafUrl.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    AppPolicy01: {
                        class: 'WAF_Policy',
                        url: wafUrl
                    },
                    AppPolicy02: {
                        class: 'WAF_Policy',
                        url: wafUrl
                    }
                }
            }
        };

        const decl1 = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Tenant: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.0'],
                        policyWAF: {
                            use: 'wafPolicy'
                        }
                    },
                    service1: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.1'],
                        policyWAF: {
                            bigip: '/Common/Shared/AppPolicy02'
                        }
                    },
                    wafPolicy: {
                        class: 'WAF_Policy',
                        policy: {
                            use: 'otherWafPolicy'
                        },
                        ignoreChanges: false
                    },
                    otherWafPolicy: {
                        class: 'WAF_Policy',
                        policy: {
                            use: 'wafPolicy'
                        },
                        ignoreChanges: false
                    }
                }
            }
        };

        return postDeclaration(decl, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/asm/policies?%24filter=fullPath%20eq%20/Common/Shared/AppPolicy01&%24select=fullPath,name'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].kind, 'tm:asm:policies:policystate');
                assert.strictEqual(response.items[0].name, 'AppPolicy01');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/AppPolicy01');
            })
            .then(() => getPath('/mgmt/tm/asm/policies?%24filter=fullPath%20eq%20/Common/Shared/AppPolicy02&%24select=fullPath,name'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.strictEqual(response.items[0].kind, 'tm:asm:policies:policystate');
                assert.strictEqual(response.items[0].name, 'AppPolicy02');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/AppPolicy02');
            })
            .then(() => postDeclaration(decl1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration is invalid');
                assert.strictEqual(response.results[0].errors.length, 1);
                assert.strictEqual(response.results[0].errors[0], '/Tenant/Application/wafPolicy/policy: should NOT have additional properties');
            })
            .then(() => deleteDeclaration());
    });
});

describe('DOS Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should enable the stress based detection and badActor \'Use TLS patterns as part of host identification\' is enable', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            'DOS_Profile_signatures_tls-fp': {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    newDOS: {
                        class: 'DOS_Profile',
                        application: {
                            scrubbingDuration: 42,
                            remoteTriggeredBlackHoleDuration: 10,
                            stressBasedDetection: {
                                operationMode: 'blocking',
                                badActor: {
                                    detectionEnabled: true,
                                    acceleratedSignaturesEnabled: true,
                                    tlsSignaturesEnabled: true,
                                    useTlsPatternsForHostIdentification: true
                                }
                            }
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/security/dos/profile/~DOS_Profile_signatures_tls-fp~Application~newDOS/application'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.notStrictEqual(response.items[0], undefined);
                assert.notStrictEqual(response.items[0].stressBased, undefined);
                assert.notStrictEqual(response.items[0].stressBased.behavioral, undefined);
                assert.strictEqual(response.items[0].stressBased.behavioral.dosDetection, 'enabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.acceleratedSignatures, 'enabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.mitigationMode, 'none');
                assert.strictEqual(response.items[0].stressBased.behavioral.signatures, 'disabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.signaturesApprovedOnly, 'disabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.tlsFp, 'enabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.tlsSignatures, 'enabled');
            })
            .then(() => deleteDeclaration());
    });

    it('should enable the stress based detection and badActor \'Use TLS patterns as part of host identification\' is disable', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            'DOS_Profile_signatures_tls-fp': {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    newDOS: {
                        class: 'DOS_Profile',
                        application: {
                            scrubbingDuration: 42,
                            remoteTriggeredBlackHoleDuration: 10,
                            stressBasedDetection: {
                                operationMode: 'blocking',
                                badActor: {
                                    detectionEnabled: true,
                                    acceleratedSignaturesEnabled: true,
                                    tlsSignaturesEnabled: true,
                                    useTlsPatternsForHostIdentification: false
                                }
                            }
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/security/dos/profile/~DOS_Profile_signatures_tls-fp~Application~newDOS/application'))
            .then((response) => {
                assert.strictEqual(response.items.length, 1);
                assert.notStrictEqual(response.items[0], undefined);
                assert.notStrictEqual(response.items[0].stressBased, undefined);
                assert.notStrictEqual(response.items[0].stressBased.behavioral, undefined);
                assert.strictEqual(response.items[0].stressBased.behavioral.dosDetection, 'enabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.acceleratedSignatures, 'enabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.mitigationMode, 'none');
                assert.strictEqual(response.items[0].stressBased.behavioral.signatures, 'disabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.signaturesApprovedOnly, 'disabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.tlsFp, 'disabled');
                assert.strictEqual(response.items[0].stressBased.behavioral.tlsSignatures, 'enabled');
            })
            .then(() => deleteDeclaration());
    });
});

describe('Bot Defense Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should refer the botDefense profile to Service_HTTP', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.56.0',
            Example_BotDefense_Refer: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    ServiceHTTP: {
                        class: 'Service_HTTP',
                        virtualPort: 8080,
                        virtualAddresses: ['192.0.2.0'],
                        profileBotDefense: {
                            use: 'botProfile'
                        }
                    },
                    botProfile: {
                        class: 'Bot_Defense_Profile'
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Example_BotDefense_Refer~Application~ServiceHTTP/profiles/~Example_BotDefense_Refer~Application~botProfile'))
            .then((response) => {
                assert.strictEqual(response.kind, 'tm:ltm:virtual:profiles:profilesstate');
                assert.strictEqual(response.name, 'botProfile');
                assert.strictEqual(response.fullPath, '/Example_BotDefense_Refer/Application/botProfile');
            })
            .finally(() => deleteDeclaration());
    });

    it('should create the botDefense profile along with Dos botDefense profile', function () {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.56.0',
            Example_BotDefense: {
                class: 'Tenant',
                Application: {
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
                        dosMitigation: 'enabled',
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
                        urlAllowlist: ['www.bing.com']
                    },
                    dosProfile: {
                        class: 'DOS_Profile',
                        application: {
                            scrubbingDuration: 42,
                            remoteTriggeredBlackHoleDuration: 10,
                            botDefense: {
                                mode: 'during-attacks',
                                blockSuspiscousBrowsers: true,
                                issueCaptchaChallenge: true,
                                gracePeriod: 3000,
                                crossDomainRequests: 'validate-bulk',
                                siteDomains: ['www.google.com'],
                                externalDomains: ['www.yahoo.com'],
                                urlAllowlist: ['www.bing.com']
                            },
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
                            }
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/security/dos/profile/~Example_BotDefense~Application~dosProfile'))
            .then((response) => {
                assert.strictEqual(response.kind, 'tm:security:dos:profile:profilestate');
                assert.strictEqual(response.name, 'dosProfile');
                assert.strictEqual(response.fullPath, '/Example_BotDefense/Application/dosProfile');
            })
            .then(() => getPath('/mgmt/tm/security/bot-defense/profile/~Example_BotDefense~Application~botProfile'))
            .then((response) => {
                assert.strictEqual(response.kind, 'tm:security:bot-defense:profile:profilestate');
                assert.strictEqual(response.name, 'botProfile');
                assert.strictEqual(response.fullPath, '/Example_BotDefense/Application/botProfile');
                assert.strictEqual(response.gracePeriod, 4000);
            })
            .then(() => getPath('/mgmt/tm/security/bot-defense/profile/~Example_BotDefense~Application~f5_appsvcs_dosProfile_botDefense'))
            .then((response) => {
                assert.strictEqual(response.kind, 'tm:security:bot-defense:profile:profilestate');
                assert.strictEqual(response.name, 'f5_appsvcs_dosProfile_botDefense');
                assert.strictEqual(response.fullPath, '/Example_BotDefense/Application/f5_appsvcs_dosProfile_botDefense');
                assert.strictEqual(response.gracePeriod, 3000);
            })
            .finally(() => deleteDeclaration());
    });
});

describe('PPTP Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should create PPTP Policy', function () {
        const declaration = {
            class: 'AS3',
            action: 'deploy',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                id: 'pptp-profile-declaration',
                Sample_Tenant: {
                    class: 'Tenant',
                    Sample_App: {
                        class: 'Application',
                        template: 'generic',
                        pptpProfileSample: {
                            class: 'PPTP_Profile',
                            label: 'test',
                            remark: 'test',
                            parentProfile: {
                                bigip: '/Common/pptp'
                            },
                            csvFormat: true,
                            includeDestinationIp: false,
                            publisherName: {
                                bigip: '/Common/local-db-publisher'
                            }
                        },
                        pptpService: {
                            class: 'Service_TCP',
                            virtualAddresses: [
                                '192.0.2.10'
                            ],
                            virtualPort: 1723,
                            snat: 'auto',
                            pool: 'pptpPool',
                            profilePPTP: {
                                use: 'pptpProfileSample'
                            }
                        },
                        pptpPool: {
                            class: 'Pool',
                            monitors: [
                                'tcp'
                            ],
                            members: [
                                {
                                    servicePort: 1723,
                                    serverAddresses: [
                                        '192.0.2.12',
                                        '192.0.2.13'
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };
        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/pptp/~Sample_Tenant~Sample_App~pptpProfileSample'))
            .then((response) => {
                assert.strictEqual(response.csvFormat, 'enabled');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Sample_Tenant~Sample_App~pptpService/profiles'))
            .then((response) => {
                const pptp = response.items.find((item) => item.name === 'pptpProfileSample');
                assert.strictEqual(pptp.fullPath, '/Sample_Tenant/Sample_App/pptpProfileSample');
            })
            .finally(() => deleteDeclaration());
    });
});

describe('Data Group', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should create Data Group with special charactor', function () {
        const declaration = {
            class: 'AS3',
            action: 'deploy',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.55.0',
                example_tenant: {
                    class: 'Tenant',
                    example_app: {
                        class: 'Application',
                        example_security_log_profile: {
                            class: 'Security_Log_Profile',
                            application: {
                                localStorage: false,
                                maxEntryLength: '10k',
                                remoteStorage: 'remote',
                                servers: [
                                    {
                                        address: '192.0.2.0',
                                        port: '514'
                                    }
                                ],
                                storageFilter: {
                                    requestType: 'illegal-including-staged-signatures'
                                },
                                storageFormat: 'date_time="%date_time%"'
                            }
                        },
                        example_data_group: {
                            class: 'Data_Group',
                            keyDataType: 'string',
                            records: [
                                {
                                    key: 'example\\?key',
                                    value: 'example_value'
                                },
                                {
                                    key: 'example\\*key',
                                    value: 'example_value'
                                },
                                {
                                    key: 'example_key',
                                    value: 'example\\value'
                                }
                            ]
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });
});

describe('Virtual Server', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should rename the virtual server in Common partition', function () {
        const declaration = {
            class: 'AS3',
            action: 'deploy',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.55.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        demoHttp: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            redirect80: false,
                            virtualAddresses: ['192.0.2.0']
                        }
                    }
                }
            }
        };

        const declaration1 = {
            class: 'AS3',
            action: 'deploy',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.55.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        demoHttp1: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            redirect80: false,
                            virtualAddresses: ['192.0.2.0']
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp'))
            .then((response) => {
                assert.strictEqual(response.name, 'demoHttp');
                assert.strictEqual(response.fullPath, '/Common/Shared/demoHttp');
                assert.strictEqual(response.destination, '/Common/Shared/192.0.2.0:80');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp1'))
            .then((response) => {
                assert.strictEqual(response.name, 'demoHttp1');
                assert.strictEqual(response.fullPath, '/Common/Shared/demoHttp1');
                assert.strictEqual(response.destination, '/Common/Shared/192.0.2.0:80');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"01020036:3: The requested Virtual Server (/Common/Shared/demoHttp) was not found.","errorStack":[],"apiError":3}'
            ))
            .then(() => postDeclaration(declaration, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp'))
            .then((response) => {
                assert.strictEqual(response.name, 'demoHttp');
                assert.strictEqual(response.fullPath, '/Common/Shared/demoHttp');
                assert.strictEqual(response.destination, '/Common/Shared/192.0.2.0:80');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp1'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"01020036:3: The requested Virtual Server (/Common/Shared/demoHttp1) was not found.","errorStack":[],"apiError":3}'
            ))
            .then(() => postDeclaration(declaration, { declarationIndex: 3 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });

    it('should rename the virtual server with pool in Common partition', function () {
        const declaration = {
            class: 'AS3',
            action: 'deploy',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.55.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        demoHttp: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            redirect80: false,
                            virtualAddresses: ['192.0.2.0'],
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: ['192.0.2.1'],
                                    servicePort: 80
                                }
                            ]
                        }
                    }
                }
            }
        };

        const declaration1 = {
            class: 'AS3',
            action: 'deploy',
            declaration: {
                class: 'ADC',
                schemaVersion: '3.55.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        demoHttp1: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            redirect80: false,
                            virtualAddresses: ['192.0.2.0'],
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: ['192.0.2.1'],
                                    servicePort: 80
                                }
                            ]
                        }
                    }
                }
            }
        };

        return postDeclaration(declaration, { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp'))
            .then((response) => {
                assert.strictEqual(response.name, 'demoHttp');
                assert.strictEqual(response.fullPath, '/Common/Shared/demoHttp');
                assert.strictEqual(response.destination, '/Common/Shared/192.0.2.0:80');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Common~Shared~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/192.0.2.1:80');
            })
            .then(() => postDeclaration(declaration1, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp1'))
            .then((response) => {
                assert.strictEqual(response.name, 'demoHttp1');
                assert.strictEqual(response.fullPath, '/Common/Shared/demoHttp1');
                assert.strictEqual(response.destination, '/Common/Shared/192.0.2.0:80');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Common~Shared~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/192.0.2.1:80');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"01020036:3: The requested Virtual Server (/Common/Shared/demoHttp) was not found.","errorStack":[],"apiError":3}'
            ))
            .then(() => postDeclaration(declaration, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp'))
            .then((response) => {
                assert.strictEqual(response.name, 'demoHttp');
                assert.strictEqual(response.fullPath, '/Common/Shared/demoHttp');
                assert.strictEqual(response.destination, '/Common/Shared/192.0.2.0:80');
            })
            .then(() => getPath('/mgmt/tm/ltm/pool/~Common~Shared~pool/members'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, '192.0.2.1:80');
                assert.strictEqual(response.items[0].fullPath, '/Common/Shared/192.0.2.1:80');
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/virtual/~Common~Shared~demoHttp1'),
                'Unable to GET declaration: Error: Received unexpected 404 status code: {"code":404,"message":"01020036:3: The requested Virtual Server (/Common/Shared/demoHttp1) was not found.","errorStack":[],"apiError":3}'
            ))
            .then(() => postDeclaration(declaration, { declarationIndex: 3 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });
});

/**
 * Copyright 2022 F5 Networks, Inc.
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

const assert = require('assert');
const sinon = require('sinon');

const translate = require('../../../src/lib/map_mcp').translate;
const Context = require('../../../src/lib/context/context');

describe('map_mcp', () => {
    let defaultContext;
    beforeEach(() => {
        defaultContext = Context.build();
        defaultContext.target.tmosVersion = '0.0.0';
    });

    afterEach(() => {
        sinon.restore();
    });

    function defaultObj() {
        return {
            partition: 'Common',
            subPath: 'foo/bar',
            name: 'testItem'
        };
    }
    describe('.pushMonitors', () => {
        it('should update the object with minimum monitor values', () => {
            const obj = defaultObj();
            obj.ephemeral = false;
            obj.monitor = 'min 4 of { /Common/foo/bar/monitor /Common/Application/funky }';

            const result = translate['tm:ltm:pool:poolstate'](defaultContext, obj, []);
            const monitorKeys = Object.keys(result[0].properties.monitor);

            assert.strictEqual(result[0].path, '/Common/foo/bar/testItem');
            assert.strictEqual(result[0].properties.minimumMonitors, 4);
            assert.strictEqual(monitorKeys[0], '/Common/foo/bar/monitor');
            assert.strictEqual(monitorKeys.length, 2);
        });

        it('should update the object when all monitors are required', () => {
            const obj = defaultObj();
            obj.monitor = '/Common/DEFAULT and /Common/gateway_icmp and /Common/http_head_f5 ';

            const result = translate['tm:ltm:pool:poolstate'](defaultContext, obj, []);
            const monitorKeys = Object.keys(result[0].properties.monitor);

            assert.strictEqual(result[0].path, '/Common/foo/bar/testItem');
            assert.strictEqual(result[0].properties.minimumMonitors, 'all');
            assert.strictEqual(monitorKeys[0], '/Common/DEFAULT');
            assert.strictEqual(monitorKeys[1], '/Common/gateway_icmp');
            assert.strictEqual(monitorKeys[2], '/Common/http_head_f5');
            assert.strictEqual(monitorKeys.length, 3);
        });
    });

    describe('.pushReferences', () => {
        it('should do nothing if an empty array is sent in', () => {
            const obj = defaultObj();
            const resultRefs = translate['tm:ltm:profile:rewrite:rewritestate'](defaultContext, obj, [])[0].properties;
            assert.strictEqual(Object.keys(resultRefs['uri-rules']).length, 0);
        });
        it('should update the object with subproperties', () => {
            const client = {
                scheme: 'https',
                host: 'www.google.com',
                port: 100,
                path: '/'
            };
            const server = {
                scheme: 'http',
                host: 'www.example.com',
                port: 80,
                path: '/'
            };
            const refCfg = [
                {
                    kind: 'tm:ltm:profile:rewrite:uri-rules:uri-rulesstate',
                    name: '0',
                    fullPath: '0',
                    generation: 6234,
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/rewrite/~Common~foo~bar~testItem/uri-rules/0?ver=13.1.1.3',
                    appService: 'none',
                    client,
                    server,
                    type: 'response'
                }
            ];
            const obj = defaultObj();
            const resultRefs = translate['tm:ltm:profile:rewrite:rewritestate'](defaultContext, obj, refCfg)[0].properties['uri-rules'];

            function checkSubproperties(val1, val2) {
                assert.strictEqual(val1.scheme, val2.scheme);
                assert.strictEqual(val1.host, val2.host);
                assert.strictEqual(val1.port, val2.port);
                assert.strictEqual(val1.path, val2.path);
            }

            assert.strictEqual(resultRefs['0'].type, 'response');
            assert.strictEqual(Object.keys(resultRefs).length, 1);
            checkSubproperties(resultRefs['0'].client, client);
            checkSubproperties(resultRefs['0'].server, server);
        });
    });

    describe('.processLtmPolicyObjects', () => {
        it('should return an empty object if an empty array is sent in', () => {
            const obj = defaultObj();
            const result = translate['tm:ltm:policy-strategy:policy-strategystate'](defaultContext, obj, []);
            assert.strictEqual(Object.keys(result[0].properties.operands).length, 0);
        });
        it('should return a filled out operands object', () => {
            const obj = defaultObj();
            obj.operandsReference = {
                items: [
                    {
                        kind: 'tm:ltm:policy-strategy:operands:operandsstate',
                        name: '0',
                        fullPath: '0',
                        generation: 14269,
                        selfLink: 'https://localhost/mgmt/tm/ltm/policy-strategy/~Common~foo~bar~testItem/operands/0?ver=13.1.1.3',
                        countryCode: true,
                        geoip: true,
                        request: true
                    }
                ]
            };

            const result = translate['tm:ltm:policy-strategy:policy-strategystate'](defaultContext, obj);
            assert.strictEqual(Object.keys(result[0].properties.operands).length, 1);
            assert.strictEqual(result[0].properties.operands['0'].policyString, 'geoip request country-code');
        });
    });

    describe('.translate', () => {
        ['ltm', 'gtm'].forEach((module) => {
            describe(`tm:${module}:monitor:external:externalstate`, () => {
                it('should process user-defined values', () => {
                    defaultContext.target.tmosVersion = '13.1';
                    const obj = {
                        kind: `tm:${module}:monitor:external:externalstate`,
                        name: 'item',
                        fullPath: '/path/to/item',
                        apiRawValues: {
                            'userDefined PASSWORD': 'secret',
                            'userDefined USER': 'two words'
                        }
                    };
                    const referenceConfig = [];
                    const result = translate[obj.kind](defaultContext, obj, referenceConfig);
                    assert.deepStrictEqual(result[0].properties['user-defined'], {
                        USER: '"two words"',
                        PASSWORD: '"secret"'
                    });
                });
            });
        });
        describe('Database Monitors', () => {
            const testCases = [
                'mysql',
                'postgresql'
            ];
            testCases.forEach((testCase) => {
                it(`should process ${testCase} missing values`, () => {
                    const obj = {
                        kind: `tm:ltm:monitor:${testCase}:${testCase}state`,
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none',
                        password: 'none',
                        recv: 'none',
                        send: 'none',
                        username: 'none',
                        database: 'none',
                        'recv-column': 'none',
                        'recv-row': 'none'
                    });
                });
                it(`should process ${testCase} user-defined values`, () => {
                    const obj = {
                        kind: `tm:ltm:monitor:${testCase}:${testCase}state`,
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor',
                        description: 'This is my description',
                        password: 'Same as my luggage "123"',
                        recv: 'Something received',
                        send: 'Something sent',
                        username: 'player1',
                        database: 'baseOfData',
                        count: '42',
                        recvColumn: '1',
                        recvRow: '1'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: '"This is my description"',
                        password: '"Same as my luggage \\"123\\""',
                        recv: '"Something received"',
                        send: '"Something sent"',
                        username: 'player1',
                        database: 'baseOfData',
                        count: 42,
                        'recv-column': 1,
                        'recv-row': 1
                    });
                });
            });
        });
        describe('tm:sys:file:ssl-cert:ssl-certstate', () => {
            it('should return with cert-validators', () => {
                defaultContext.target.tmosVersion = '13.1';
                const obj = {
                    kind: 'tm:sys:file:ssl-cert:ssl-certstate',
                    name: 'theCert',
                    fullPath: '/path/to/cert'
                };
                const referenceConfig = [
                    {
                        kind: 'tm:sys:file:ssl-cert:cert-validators:cert-validatorsstate',
                        name: 'ocsp',
                        partition: 'Common',
                        fullPath: '/Common/ocsp',
                        selfLink: 'https://localhost/mgmt/tm/sys/file/ssl-cert/~TEST_Certificate~Application~theCert.crt/cert-validators/~Common~theOcsp'
                    }
                ];
                const expected = [
                    {
                        path: '/path/to/cert',
                        command: 'sys file ssl-cert',
                        properties: {
                            'cert-validation-options': {},
                            'cert-validators': {
                                '/Common/ocsp': {}
                            }
                        },
                        ignore: []
                    }
                ];
                const result = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepEqual(result, expected);
            });
        });

        describe('tm:security:nat:policy:policystate', () => {
            it('should remove empty translation', () => {
                const obj = {
                    kind: 'tm:security:nat:policy:policystate',
                    partition: 'partition',
                    subPath: 'subpath',
                    name: 'name',
                    fullPath: 'partition/subpath/name'
                };
                const referenceConfig = [
                    {
                        kind: 'tm:security:nat:policy:rules:rulesstate',
                        translation: {},
                        name: 'theRule',
                        selfLink: '/mgmt/tm/security/nat/policy/~partition~subpath~name/rules/rule1'
                    }
                ];
                const expected = {
                    source: {
                        'address-lists': {},
                        'port-lists': {}
                    },
                    destination: {
                        'address-lists': {},
                        'port-lists': {}
                    }
                };
                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results[0].properties.rules.theRule, expected);
            });
        });

        describe('tm:ltm:profile:http:httpstate', () => {
            it('should convert insertHeader', () => {
                // BIGIP returns curly braces, double quotes, and question marks differently for headerInsert.
                // Maybe has to do with TCL expressions?
                const obj = {
                    kind: 'tm:ltm:profile:http:httpstate',
                    name: 'item',
                    partition: 'tenant',
                    proxyType: 'transparent',
                    headerInsert: 'X-Forwarded-IP: [expr \\{ [IP::client_addr] \\}]:[?"]'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties['header-insert'],
                    '"X-Forwarded-IP: \\[expr \\{ \\[IP::client_addr\\] \\}\\]:\\[\\?\\"\\]"');
            });
        });

        describe('tm:ltm:profile:fastl4:fastl4state', () => {
            it('should convert keepAliveInterval from disabled to 0', () => {
                const obj = {
                    kind: 'tm:ltm:profile:fastl4:fastl4state',
                    name: 'item',
                    partition: 'tenant',
                    subPath: 'application',
                    keepAliveInterval: 'disabled'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.strictEqual(results[0].properties['keep-alive-interval'], 0);
            });

            it('should convert keepAliveInterval from string to integer', () => {
                const obj = {
                    kind: 'tm:ltm:profile:fastl4:fastl4state',
                    name: 'item',
                    partition: 'tenant',
                    subPath: 'application',
                    keepAliveInterval: '100'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.strictEqual(results[0].properties['keep-alive-interval'], 100);
            });
        });

        describe('tm:ltm:profile:analytics:analyticsstate', () => {
            it('should not throw an error if a analytics profile does not have a traffic-capture field', () => {
                const obj = {
                    kind: 'tm:ltm:profile:analytics:analyticsstate',
                    partition: 'partition',
                    subPath: 'subpath',
                    name: 'name',
                    fullPath: 'partition/subpath/name',
                    trafficCaptureReference: {
                        link: '',
                        isSubcollection: true
                    }
                };
                const referenceConfig = [{
                    kind: 'tm:ltm:profile:analytics:traffic-capture:traffic-capturestate',
                    name: 'capture-for-f5-appsvcs',
                    selfLink: '/mgmt/tm/security/nat/policy/~partition~subpath~name/traffic-capture/capture-for-f5-appsvcs'
                }];

                translate[obj.kind](defaultContext, obj, referenceConfig);
            });
        });

        describe('tm:security:protocol-inspection:profile:profilestate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:security:protocol-inspection:profile:profilestate',
                    name: 'my-profile',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/my-profile',
                    autoAddNewInspections: 'off',
                    autoPublishSuggestion: 'off',
                    avrStatCollect: 'on',
                    complianceEnable: 'on',
                    defaultsFrom: '/Common/protocol_inspection',
                    signatureEnable: 'on',
                    stagingConfidence: 0,
                    stagingPeriod: 10080,
                    references: {},
                    services: [{
                        name: 'dhcp',
                        partition: 'Common',
                        status: 'enabled',
                        ports: [{
                            name: '67'
                        }, {
                            name: '68'
                        }],
                        signature: [{
                            name: 'dhcp_os_other_malicious_dhcp_server_bash_environment_variable_injection_attempt',
                            partition: 'Common',
                            action: 'drop',
                            log: 'yes'
                        }]
                    }]
                };
                const expected = {
                    command: 'security protocol-inspection profile',
                    ignore: [],
                    path: '/myApp/Application1/my-profile',
                    properties: {
                        'auto-add-new-inspections': 'off',
                        'auto-publish-suggestion': 'off',
                        'avr-stat-collect': 'on',
                        'compliance-enable': 'on',
                        'defaults-from': '/Common/protocol_inspection',
                        services: {
                            dhcp: {
                                signature: {
                                    dhcp_os_other_malicious_dhcp_server_bash_environment_variable_injection_attempt: {
                                        action: 'drop',
                                        log: 'yes'
                                    }
                                },
                                ports: {
                                    67: {},
                                    68: {}
                                }
                            }
                        },
                        'signature-enable': 'on'
                    }
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], expected);
            });

            it('should transform stringified int compliance check value', () => {
                const obj = {
                    kind: 'tm:security:protocol-inspection:profile:profilestate',
                    name: 'my-profile',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/my-profile',
                    autoAddNewInspections: 'off',
                    autoPublishSuggestion: 'off',
                    avrStatCollect: 'on',
                    complianceEnable: 'on',
                    defaultsFrom: '/Common/protocol_inspection',
                    signatureEnable: 'on',
                    stagingConfidence: 0,
                    stagingPeriod: 10080,
                    references: {},
                    services: [{
                        name: 'dns',
                        partition: 'Common',
                        status: 'enabled',
                        ports: [{
                            name: '53'
                        }],
                        compliance: [{
                            name: 'dns_maximum_reply_length',
                            partition: 'Common',
                            action: 'drop',
                            log: 'yes',
                            value: '111'
                        }]
                    }]
                };
                const expected = {
                    command: 'security protocol-inspection profile',
                    ignore: [],
                    path: '/myApp/Application1/my-profile',
                    properties: {
                        'auto-add-new-inspections': 'off',
                        'auto-publish-suggestion': 'off',
                        'avr-stat-collect': 'on',
                        'compliance-enable': 'on',
                        'defaults-from': '/Common/protocol_inspection',
                        services: {
                            dns: {
                                compliance: {
                                    dns_maximum_reply_length: {
                                        action: 'drop',
                                        log: 'yes',
                                        value: '111'
                                    }
                                },
                                ports: {
                                    53: {}
                                }
                            }
                        },
                        'signature-enable': 'on'
                    }
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], expected);
            });

            it('should transform vector-array compliance check value', () => {
                const obj = {
                    kind: 'tm:security:protocol-inspection:profile:profilestate',
                    name: 'my-profile',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/my-profile',
                    autoAddNewInspections: 'off',
                    autoPublishSuggestion: 'off',
                    avrStatCollect: 'on',
                    complianceEnable: 'on',
                    defaultsFrom: '/Common/protocol_inspection',
                    signatureEnable: 'on',
                    stagingConfidence: 0,
                    stagingPeriod: 10080,
                    references: {},
                    services: [{
                        name: 'dns',
                        partition: 'Common',
                        status: 'enabled',
                        ports: [{
                            name: '53'
                        }],
                        compliance: [{
                            name: 'dns_disallowed_query_type',
                            partition: 'Common',
                            action: 'drop',
                            log: 'yes',
                            value: 'NOTIFY STATUS'
                        }]
                    }]
                };
                const expected = {
                    command: 'security protocol-inspection profile',
                    ignore: [],
                    path: '/myApp/Application1/my-profile',
                    properties: {
                        'auto-add-new-inspections': 'off',
                        'auto-publish-suggestion': 'off',
                        'avr-stat-collect': 'on',
                        'compliance-enable': 'on',
                        'defaults-from': '/Common/protocol_inspection',
                        services: {
                            dns: {
                                compliance: {
                                    dns_disallowed_query_type: {
                                        action: 'drop',
                                        log: 'yes',
                                        value: {
                                            NOTIFY: {},
                                            STATUS: {}
                                        }
                                    }
                                },
                                ports: {
                                    53: {}
                                }
                            }
                        },
                        'signature-enable': 'on'
                    }
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], expected);
            });

            it('should transform compliance checks without value', () => {
                const obj = {
                    kind: 'tm:security:protocol-inspection:profile:profilestate',
                    name: 'my-profile',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/my-profile',
                    autoAddNewInspections: 'off',
                    autoPublishSuggestion: 'off',
                    avrStatCollect: 'on',
                    complianceEnable: 'on',
                    defaultsFrom: '/Common/protocol_inspection',
                    signatureEnable: 'on',
                    stagingConfidence: 0,
                    stagingPeriod: 10080,
                    references: {},
                    services: [{
                        name: 'ftp',
                        partition: 'Common',
                        status: 'enabled',
                        ports: [{
                            name: '20'
                        }, {
                            name: '21'
                        }],
                        compliance: [{
                            name: 'ftp_active_mode',
                            partition: 'Common',
                            action: 'drop',
                            log: 'yes',
                            value: ''
                        }]
                    }]
                };
                const expected = {
                    command: 'security protocol-inspection profile',
                    ignore: [],
                    path: '/myApp/Application1/my-profile',
                    properties: {
                        'auto-add-new-inspections': 'off',
                        'auto-publish-suggestion': 'off',
                        'avr-stat-collect': 'on',
                        'compliance-enable': 'on',
                        'defaults-from': '/Common/protocol_inspection',
                        services: {
                            ftp: {
                                compliance: {
                                    ftp_active_mode: {
                                        action: 'drop',
                                        log: 'yes'
                                    }
                                },
                                ports: {
                                    20: {},
                                    21: {}
                                }
                            }
                        },
                        'signature-enable': 'on'
                    }
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], expected);
            });

            it('should transform compliance checks when value starts with integer', () => {
                const obj = {
                    kind: 'tm:security:protocol-inspection:profile:profilestate',
                    name: 'my-profile',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/my-profile',
                    autoAddNewInspections: 'off',
                    autoPublishSuggestion: 'off',
                    avrStatCollect: 'on',
                    complianceEnable: 'on',
                    defaultsFrom: '/Common/protocol_inspection',
                    signatureEnable: 'on',
                    stagingConfidence: 0,
                    stagingPeriod: 10080,
                    references: {},
                    services: [{
                        name: 'dns',
                        partition: 'Common',
                        status: 'enabled',
                        ports: [{
                            name: '53'
                        }],
                        compliance: [{
                            name: 'dns_domains_blacklist',
                            partition: 'Common',
                            action: 'drop',
                            log: 'yes',
                            value: '123.example.com'
                        }]
                    }]
                };
                const expected = {
                    command: 'security protocol-inspection profile',
                    ignore: [],
                    path: '/myApp/Application1/my-profile',
                    properties: {
                        'auto-add-new-inspections': 'off',
                        'auto-publish-suggestion': 'off',
                        'avr-stat-collect': 'on',
                        'compliance-enable': 'on',
                        'defaults-from': '/Common/protocol_inspection',
                        services: {
                            dns: {
                                compliance: {
                                    dns_domains_blacklist: {
                                        action: 'drop',
                                        log: 'yes',
                                        value: {
                                            '123.example.com': {}
                                        }
                                    }
                                },
                                ports: {
                                    53: {}
                                }
                            }
                        },
                        'signature-enable': 'on'
                    }
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], expected);
            });
        });

        describe('tm:ltm:html-rule:comment-raise-event:comment-raise-eventstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:comment-raise-event:comment-raise-eventstate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/comment-raise-event/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule comment-raise-event',
                    properties: {
                        description: '"my_description"'
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:html-rule:comment-remove:comment-removestate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:comment-remove:comment-removestate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/comment-remove/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule comment-remove',
                    properties: {
                        description: '"my_description"'
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:html-rule:tag-append-html:tag-append-htmlstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:tag-append-html:tag-append-htmlstate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-append-html/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description',
                    action: {
                        text: 'eat'
                    },
                    match: {
                        attributeName: 'fruit',
                        attributeValue: 'tree',
                        tagName: 'pie'
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule tag-append-html',
                    properties: {
                        description: '"my_description"',
                        action: {
                            text: '"eat"'
                        },
                        match: {
                            'attribute-name': '"fruit"',
                            'attribute-value': '"tree"',
                            'tag-name': '"pie"'
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:html-rule:tag-prepend-html:tag-prepend-htmlstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:tag-prepend-html:tag-prepend-htmlstate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-prepend-html/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description',
                    action: {
                        text: 'eat'
                    },
                    match: {
                        attributeName: 'fruit',
                        attributeValue: 'tree',
                        tagName: 'pie'
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule tag-prepend-html',
                    properties: {
                        description: '"my_description"',
                        action: {
                            text: '"eat"'
                        },
                        match: {
                            'attribute-name': '"fruit"',
                            'attribute-value': '"tree"',
                            'tag-name': '"pie"'
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:html-rule:tag-raise-event:tag-raise-eventstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:tag-raise-event:tag-raise-eventstate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-raise-event/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description',
                    match: {
                        attributeName: 'fruit',
                        attributeValue: 'tree',
                        tagName: 'pie'
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule tag-raise-event',
                    properties: {
                        description: '"my_description"',
                        match: {
                            'attribute-name': '"fruit"',
                            'attribute-value': '"tree"',
                            'tag-name': '"pie"'
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:html-rule:tag-remove:tag-removestate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:tag-remove:tag-removestate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-remove/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description',
                    match: {
                        attributeName: 'fruit',
                        attributeValue: 'tree',
                        tagName: 'pie'
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule tag-remove',
                    properties: {
                        description: '"my_description"',
                        match: {
                            'attribute-name': '"fruit"',
                            'attribute-value': '"tree"',
                            'tag-name': '"pie"'
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:html-rule:tag-remove-attribute:tag-remove-attributestate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:html-rule:tag-remove-attribute:tag-remove-attributestate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 10072,
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-remove-attribute/~Tenant~Application~sample?ver=14.1.2.8',
                    description: 'my_description',
                    action: {
                        attributeName: 'eat'
                    },
                    match: {
                        attributeName: 'fruit',
                        attributeValue: 'tree',
                        tagName: 'pie'
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm html-rule tag-remove-attribute',
                    properties: {
                        description: '"my_description"',
                        action: {
                            'attribute-name': '"eat"'
                        },
                        match: {
                            'attribute-name': '"fruit"',
                            'attribute-value': '"tree"',
                            'tag-name': '"pie"'
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:profile:html:htmlstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:profile:html:htmlstate',
                    name: 'sample',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/sample',
                    generation: 16586,
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/html/~Tenant~Application~sample?ver=14.1.2.8',
                    appService: 'none',
                    contentDetection: 'enabled',
                    contentSelection: [
                        'text/html',
                        'text/xhtml'
                    ],
                    defaultsFrom: '/Common/html',
                    defaultsFromReference: {
                        link: 'https://localhost/mgmt/tm/ltm/profile/html/~Common~html?ver=14.1.2.8'
                    },
                    description: 'sample',
                    rules: [
                        '/Tenant/Application/sample1',
                        '/Tenant/Application/sample2',
                        '/Tenant/Application/sample3',
                        '/Tenant/Application/sample4'
                    ],
                    rulesReference: [
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/comment-raise-event/~Tenant~Application~sample1?ver=14.1.2.8'
                        },
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/comment-remove/~Tenant~Application~sample2?ver=14.1.2.8'
                        },
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/tag-append-html/~Tenant~Application~sample3?ver=14.1.2.8'
                        },
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/tag-prepend-html/~Tenant~Application~sample4?ver=14.1.2.8'
                        }
                    ]
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/Application/sample',
                    command: 'ltm profile html',
                    properties: {
                        description: '"sample"',
                        'content-detection': 'enabled',
                        'content-selection': {
                            'text/html': {},
                            'text/xhtml': {}
                        },
                        rules: {
                            '/Tenant/Application/sample1': {},
                            '/Tenant/Application/sample2': {},
                            '/Tenant/Application/sample3': {},
                            '/Tenant/Application/sample4': {}
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:security:firewall:rule-list:rule-liststate', () => {
            it('Should return with rules', () => {
                const obj = {
                    kind: 'tm:security:firewall:rule-list:rule-liststate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Rule_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Rule_List/Application/testItem',
                    rulesReference: {
                        link: 'https://localhost/mgmt/tm/security/firewall/rule-list/~TEST_Firewall_Rule_List~Application~testItem/rules?ver=13.1.1.3'
                    }
                };
                const referenceConfig = [
                    {
                        kind: 'tm:security:firewall:rule-list:rules:rulesstate',
                        name: 'theRule',
                        fullPath: 'theRule',
                        selfLink: 'https://localhost/mgmt/tm/security/firewall/rule-list/~TEST_Firewall_Rule_List~Application~testItem/rules/theRule?ver=13.1.1.3',
                        action: 'accept-decisively',
                        irule: '/TEST_Firewall_Rule_List/Application/irule',
                        iruleSampleRate: 100,
                        log: 'yes',
                        status: 'enabled',
                        destination: {
                            addressLists: [
                                '/TEST_Firewall_Rule_List/Application/addList'
                            ],
                            portLists: [
                                '/TEST_Firewall_Rule_List/Application/portList'
                            ]
                        },
                        source: {
                            addressLists: [
                                '/TEST_Firewall_Rule_List/Application/addList'
                            ],
                            portLists: [
                                '/TEST_Firewall_Rule_List/Application/portList'
                            ],
                            vlans: [
                                '/Common/external'
                            ]
                        }
                    }
                ];
                const expected = {
                    rules: {
                        theRule: {
                            action: 'accept-decisively',
                            source: {
                                'address-lists': {
                                    '/TEST_Firewall_Rule_List/Application/addList': {}
                                },
                                'port-lists': {
                                    '/TEST_Firewall_Rule_List/Application/portList': {}
                                },
                                vlans: {
                                    '/Common/external': {}
                                }
                            },
                            destination: {
                                'address-lists': {
                                    '/TEST_Firewall_Rule_List/Application/addList': {}
                                },
                                'port-lists': {
                                    '/TEST_Firewall_Rule_List/Application/portList': {}
                                }
                            },
                            log: 'yes',
                            irule: '/TEST_Firewall_Rule_List/Application/irule',
                            'irule-sample-rate': 100
                        }
                    }
                };
                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:ltm:pool:poolstate', () => {
            it('should convert rateLimit from string to integer', () => {
                const obj = {
                    kind: 'tm:ltm:pool:poolstate',
                    name: 'testItem',
                    partition: 'TEST_Pool',
                    subPath: 'Application',
                    membersReference: {
                        items: [
                            {
                                name: '2.2.2.2:400',
                                state: 'down',
                                session: 'user-disabled',
                                rateLimit: '100'
                            }
                        ]
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.strictEqual(100, results[0].properties.members['2.2.2.2:400']['rate-limit']);
            });
        });

        describe('tm:apm:profile:access:accessstate', () => {
            it('should return apm profile access', () => {
                const obj = {
                    kind: 'tm:apm:profile:access:accessstate',
                    name: 'accessProfile',
                    fullPath: '/partition/accessProfile'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    result,
                    [
                        {
                            path: '/partition/accessProfile',
                            command: 'apm profile access',
                            properties: {
                                enable: false
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:apm:policy:access-policy:access-policystate', () => {
            it('should return apm policy access-policy', () => {
                const obj = {
                    kind: 'tm:apm:policy:access-policy:access-policystate',
                    name: 'accessPolicy',
                    fullPath: '/partition/accessPolicy'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    result,
                    [
                        {
                            path: '/partition/accessPolicy',
                            command: 'apm policy access-policy',
                            properties: {},
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:profile:icap:icapstate', () => {
            it('should return icap profile', () => {
                const obj = {
                    kind: 'tm:ltm:profile:icap:icapstate',
                    name: 'itemId',
                    partition: 'tenantId',
                    subPath: 'appId',
                    fullPath: '/tenantId/appId/itemId',
                    generation: 2997,
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/icap/~tenantId~appId~itemId?ver=14.1.2',
                    appService: 'none',
                    defaultsFrom: '/Common/icap',
                    defaultsFromReference: {
                        link: 'https://localhost/mgmt/tm/ltm/profile/icap/~Common~icap?ver=14.1.2'
                    },
                    headerFrom: 'admin@example.com',
                    host: 'www.example.com',
                    previewLength: 10,
                    referer: 'http://www.example.com/video/resource.html',
                    // eslint-disable-next-line no-template-curly-in-string
                    uri: 'icap://${SERVER_IP}:${SERVER_PORT}/videoOptimization',
                    userAgent: 'CERN-LineMode/2.15 libwww/2.17b3'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/tenantId/appId/itemId',
                            command: 'ltm profile icap',
                            properties: {
                                uri: '"icap://\\$\\{SERVER_IP\\}:\\$\\{SERVER_PORT\\}/videoOptimization"',
                                'header-from': '"admin@example.com"',
                                host: '"www.example.com"',
                                referer: '"http://www.example.com/video/resource.html"',
                                'user-agent': '"CERN-LineMode/2.15 libwww/2.17b3"',
                                'preview-length': 10
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:profile:client-ssl:client-sslstate', () => {
            let expectedResults;
            let obj;

            beforeEach(() => {
                obj = {
                    kind: 'tm:ltm:profile:client-ssl:client-sslstate',
                    name: 'clientSslProfile',
                    subPath: 'app',
                    partition: 'tenant',
                    fullPath: '/tenant/app/clientSslProfile',
                    generation: 1232,
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/client-ssl/foo2?ver=14.1.2.2',
                    certKeyChain: []
                };

                expectedResults = [
                    {
                        path: '/tenant/app/clientSslProfile',
                        command: 'ltm profile client-ssl',
                        properties: {
                            'ca-file': 'none',
                            'cert-extension-includes': {},
                            'cert-key-chain': {},
                            'client-cert-ca': 'none',
                            'crl-file': 'none',
                            description: 'none',
                            options: {
                                'dont-insert-empty-fragments': {},
                                'no-tlsv1.3': {}
                            },
                            'proxy-ca-cert': 'none',
                            'proxy-ca-key': 'none',
                            'proxy-ca-passphrase': 'none',
                            'server-name': 'none'
                        },
                        ignore: []
                    }
                ];
            });

            it('should return a client ssl profile w/ string tmOptions', () => {
                obj.tmOptions = '{ dont-insert-empty-fragments no-tlsv1.3 }';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    expectedResults
                );
            });

            it('should return a client ssl profile w/ array tmOptions', () => {
                obj.tmOptions = ['dont-insert-empty-fragments', 'no-tlsv1.3'];
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    expectedResults
                );
            });

            it('should remove proxy-ca properties in BIG-IP 14.0+', () => {
                defaultContext.target.tmosVersion = '14.0';
                obj.tmOptions = ['dont-insert-empty-fragments', 'no-tlsv1.3'];
                const results = translate[obj.kind](defaultContext, obj);

                delete expectedResults[0].properties['proxy-ca-cert'];
                delete expectedResults[0].properties['proxy-ca-key'];
                delete expectedResults[0].properties['proxy-ca-passphrase'];

                assert.deepEqual(
                    results,
                    expectedResults
                );
            });

            it('should handle renegotiate values of indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.allowDynamicRecordSizing = 'enabled';
                obj.data_0rtt = 'enabled-with-anti-replay';
                obj.renegotiateMaxRecordDelay = 'indefinite';
                obj.renegotiatePeriod = 'indefinite';
                obj.renegotiateSize = 'indefinite';
                const results = translate[obj.kind](defaultContext, obj);

                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/tenant/app/clientSslProfile',
                            command: 'ltm profile client-ssl',
                            properties: {
                                'allow-dynamic-record-sizing': 'enabled',
                                'ca-file': 'none',
                                'cert-extension-includes': {},
                                'cert-key-chain': {},
                                'client-cert-ca': 'none',
                                'crl-file': 'none',
                                'data-0rtt': 'enabled-with-anti-replay',
                                description: 'none',
                                options: {},
                                'renegotiate-max-record-delay': 4294967295,
                                'renegotiate-period': 4294967295,
                                'renegotiate-size': 4294967295,
                                'server-name': 'none'
                            },
                            ignore: []
                        }
                    ]
                );
            });

            it('should handle renegotiate values that are not indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.allowDynamicRecordSizing = 'enabled';
                obj.data_0rtt = 'enabled-with-anti-replay';
                obj.renegotiateMaxRecordDelay = '100';
                obj.renegotiatePeriod = '100';
                obj.renegotiateSize = '100';
                const results = translate[obj.kind](defaultContext, obj);

                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/tenant/app/clientSslProfile',
                            command: 'ltm profile client-ssl',
                            properties: {
                                'allow-dynamic-record-sizing': 'enabled',
                                'ca-file': 'none',
                                'cert-extension-includes': {},
                                'cert-key-chain': {},
                                'client-cert-ca': 'none',
                                'crl-file': 'none',
                                'data-0rtt': 'enabled-with-anti-replay',
                                description: 'none',
                                options: {},
                                'renegotiate-max-record-delay': 100,
                                'renegotiate-period': 100,
                                'renegotiate-size': 100,
                                'server-name': 'none'
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:profile:server-ssl:server-sslstate', () => {
            let obj;
            let expectedResults;
            beforeEach(() => {
                obj = {
                    kind: 'tm:ltm:profile:server-ssl:server-sslstate',
                    name: 'serverSslProfile',
                    subPath: 'app',
                    partition: 'tenant',
                    fullPath: '/tenant/app/serverSslProfile',
                    generation: 1232
                };

                expectedResults = [
                    {
                        path: '/tenant/app/serverSslProfile',
                        command: 'ltm profile server-ssl',
                        properties: {
                            'authenticate-name': 'none',
                            'c3d-cert-extension-includes': {},
                            'ca-file': 'none',
                            cert: 'none',
                            chain: 'none',
                            'crl-file': 'none',
                            description: 'none',
                            key: 'none',
                            options: {
                                'dont-insert-empty-fragments': {},
                                'no-tlsv1.3': {}
                            },
                            'server-name': 'none'
                        },
                        ignore: []
                    }
                ];
            });

            it('should return a server ssl profile w/ string tmOptions', () => {
                obj.tmOptions = '{ dont-insert-empty-fragments no-tlsv1.3 }';
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    expectedResults
                );
            });

            it('should return a server ssl profile w/ array tmOptions', () => {
                obj.tmOptions = ['dont-insert-empty-fragments', 'no-tlsv1.3'];
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    expectedResults
                );
            });

            it('should handle renegotiate values of indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.data_0rtt = 'enabled';
                obj.renegotiatePeriod = 'indefinite';
                obj.renegotiateSize = 'indefinite';
                const results = translate[obj.kind](defaultContext, obj);

                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/tenant/app/serverSslProfile',
                            command: 'ltm profile server-ssl',
                            properties: {
                                'authenticate-name': 'none',
                                'c3d-cert-extension-includes': {},
                                'ca-file': 'none',
                                cert: 'none',
                                chain: 'none',
                                'crl-file': 'none',
                                'data-0rtt': 'enabled',
                                description: 'none',
                                key: 'none',
                                options: {},
                                'renegotiate-period': 4294967295,
                                'renegotiate-size': 4294967295,
                                'server-name': 'none'
                            },
                            ignore: []
                        }
                    ]
                );
            });

            it('should handle renegotiate values that are not indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.data_0rtt = 'enabled';
                obj.renegotiatePeriod = '100';
                obj.renegotiateSize = '100';
                const results = translate[obj.kind](defaultContext, obj);

                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/tenant/app/serverSslProfile',
                            command: 'ltm profile server-ssl',
                            properties: {
                                'authenticate-name': 'none',
                                'c3d-cert-extension-includes': {},
                                'ca-file': 'none',
                                cert: 'none',
                                chain: 'none',
                                'crl-file': 'none',
                                'data-0rtt': 'enabled',
                                description: 'none',
                                key: 'none',
                                options: {},
                                'renegotiate-period': 100,
                                'renegotiate-size': 100,
                                'server-name': 'none'
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:profile:request-adapt:request-adaptstate', () => {
            it('should return request adapt profile', () => {
                const obj = {
                    kind: 'tm:ltm:profile:request-adapt:request-adaptstate',
                    name: 'requestProfile',
                    partition: 'tenant',
                    subPath: 'app',
                    fullPath: '/tenant/app/requestProfile',
                    enabled: 'yes',
                    internalVirtual: '/Common/internalService',
                    previewSize: 1234,
                    serviceDownAction: 'drop',
                    timeout: 12345,
                    allowHTTP10: 'yes'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    [
                        {
                            path: '/tenant/app/requestProfile',
                            command: 'ltm profile request-adapt',
                            properties: {
                                enabled: 'yes',
                                'internal-virtual': '/Common/internalService',
                                'preview-size': 1234,
                                'service-down-action': 'drop',
                                timeout: 12345,
                                'allow-http-10': 'yes'
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:profile:response-adapt:response-adaptstate', () => {
            it('should return response adapt profile', () => {
                const obj = {
                    kind: 'tm:ltm:profile:response-adapt:response-adaptstate',
                    name: 'responseProfile',
                    partition: 'tenant',
                    subPath: 'app',
                    fullPath: '/tenant/app/responseProfile',
                    enabled: 'yes',
                    internalVirtual: '/Common/internalService',
                    previewSize: 1234,
                    serviceDownAction: 'drop',
                    timeout: 12345,
                    allowHTTP10: 'yes'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    [
                        {
                            path: '/tenant/app/responseProfile',
                            command: 'ltm profile response-adapt',
                            properties: {
                                enabled: 'yes',
                                'internal-virtual': '/Common/internalService',
                                'preview-size': 1234,
                                'service-down-action': 'drop',
                                timeout: 12345,
                                'allow-http-10': 'yes'
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:cipher:rule:rulestate', () => {
            it('should return ltm cupher rule', () => {
                const obj = {
                    kind: 'tm:ltm:cipher:rule:rulestate',
                    description: 'The item description',
                    cipher: 'ECDHE:RSA:ECDHE_ECDSA:!SSLV3',
                    'dh-groups': 'P256:P384',
                    'signature-algorithms': 'DSA-SHA256:DSA-SHA512:ECDSA-SHA384',
                    partition: 'tenantId',
                    subPath: 'appId',
                    name: 'itemId'
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    [
                        {
                            command: 'ltm cipher rule',
                            ignore: [],
                            path: '/tenantId/appId/itemId',
                            properties: {
                                description: '"The item description"',
                                cipher: 'ECDHE:RSA:ECDHE_ECDSA:!SSLV3',
                                'dh-groups': 'P256:P384',
                                'signature-algorithms': 'DSA-SHA256:DSA-SHA512:ECDSA-SHA384'
                            }
                        }
                    ]
                );
            });
        });

        describe('tm:ltm:cipher:group:groupstate', () => {
            it('should return cipher group', () => {
                const obj = {
                    kind: 'tm:ltm:cipher:group:groupstate',
                    description: 'The item description',
                    name: 'myCipherGroup',
                    partition: 'SampleTenant',
                    subPath: 'SampleApp',
                    fullPath: '/SampleTenant/SampleApp/myCipherGroup',
                    generation: 802,
                    selfLink: 'https://localhost/mgmt/tm/ltm/cipher/group/~SampleTenant~SampleApp~myCipherGroup?ver=14.1.0.6',
                    ordering: 'default',
                    allow: [
                        {
                            name: 'f5-aes',
                            partition: 'Common',
                            nameReference:
                                { link: 'https://localhost/mgmt/tm/ltm/cipher/rule/~Common~f5-aes?ver=14.1.0.6' }
                        }
                    ]
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepEqual(
                    results,
                    [
                        {
                            path: '/SampleTenant/SampleApp/myCipherGroup',
                            command: 'ltm cipher group',
                            properties: {
                                description: '"The item description"',
                                ordering: 'default',
                                allow: {
                                    '/Common/f5-aes': {}
                                },
                                exclude: {},
                                require: {}
                            },
                            ignore: []
                        }
                    ]
                );
            });
        });

        describe('tm:gtm:pool:a:astate', () => {
            it('should return GSLB_Pool A', () => {
                const obj = {
                    kind: 'tm:gtm:pool:a:astate',
                    name: 'testPool',
                    partition: 'tenant',
                    subPath: 'application',
                    fullPath: '/tenant/application/testPool',
                    generation: 2258,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool?ver=14.1.0.3',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:a:members:memberscollectionstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool/members?ver=14.1.0.3',
                        addresses: []
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results, [
                    {
                        path: '/tenant/application/testPool',
                        command: 'gtm pool a',
                        properties: {
                            enabled: true,
                            'max-answers-returned': 10,
                            members: {},
                            monitor: '/Common/http and /Common/https'
                        },
                        ignore: []
                    }
                ]);
            });

            it('should return GSLB_Pool A with member information', () => {
                const obj = {
                    kind: 'tm:gtm:pool:a:astate',
                    name: 'testPool',
                    partition: 'tenant',
                    subPath: 'application',
                    fullPath: '/tenant/application/testPool',
                    generation: 2258,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool?ver=14.1.0.3',
                    maxAnswersReturned: 10,
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool/members?ver=14.1.0.3',
                        isSubcollection: true
                    },
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:a:members:membersstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool/members?ver=14.1.0.3',
                        name: 'testServer:0',
                        partition: 'tenant',
                        fullPath: '/tenant/application/testServer:0',
                        enabled: false,
                        ratio: 2,
                        memberOrder: 2,
                        dependsOn: [
                            {
                                name: '/Common/testServer:1'
                            }
                        ]
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results, [
                    {
                        path: '/tenant/application/testPool',
                        command: 'gtm pool a',
                        properties: {
                            enabled: true,
                            'max-answers-returned': 10,
                            members: {
                                '/Common/testServer:0': {
                                    'depends-on': {
                                        '/Common/testServer:1': {}
                                    },
                                    enabled: false,
                                    'member-order': 2,
                                    ratio: 2
                                }
                            },
                            monitor: '/Common/http and /Common/https'
                        },
                        ignore: []
                    }
                ]);
            });
        });

        describe('tm:gtm:pool:aaaa:aaaastate', () => {
            it('should return GSLB_Pool AAAA', () => {
                const obj = {
                    kind: 'tm:gtm:pool:aaaa:aaaastate',
                    name: 'testPool',
                    partition: 'tenant',
                    subPath: 'application',
                    fullPath: '/tenant/application/testPool',
                    generation: 2258,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool?ver=14.1.0.3',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:aaaa:members:memberscollectionstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool/members?ver=14.1.0.3',
                        addresses: []
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepEqual(results, [
                    {
                        path: '/tenant/application/testPool',
                        command: 'gtm pool aaaa',
                        properties: {
                            enabled: true,
                            'max-answers-returned': 10,
                            members: {},
                            monitor: '/Common/http and /Common/https'
                        },
                        ignore: []
                    }
                ]);
            });

            it('should return GSLB_Pool AAAA with member information', () => {
                const obj = {
                    kind: 'tm:gtm:pool:aaaa:aaaastate',
                    name: 'testPool',
                    partition: 'tenant',
                    subPath: 'application',
                    fullPath: '/tenant/application/testPool',
                    generation: 2258,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool?ver=14.1.0.3',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https ',
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool/members?ver=14.1.0.3',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        name: 'testServer:0',
                        kind: 'tm:gtm:pool:aaaa:members:membersstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool/members?ver=14.1.0.3',
                        enabled: true,
                        partition: 'tenant',
                        fullPath: '/tenant/application/testPool',
                        'member-order': 0,
                        ratio: 1
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results, [
                    {
                        path: '/tenant/application/testPool',
                        command: 'gtm pool aaaa',
                        properties: {
                            enabled: true,
                            'max-answers-returned': 10,
                            members: {
                                '/Common/testServer:0': {
                                    'depends-on': 'none',
                                    enabled: true,
                                    'member-order': 0,
                                    ratio: 1
                                }
                            },
                            monitor: '/Common/http and /Common/https'
                        },
                        ignore: []
                    }
                ]);
            });
        });

        describe('tm:gtm:pool:cname:cnamestate', () => {
            it('should return GSLB_Pool CNAME', () => {
                const obj = {
                    kind: 'tm:gtm:pool:cname:cnamestate',
                    name: 'testPool',
                    partition: 'tenant',
                    subPath: 'application',
                    fullPath: '/tenant/application/testPool',
                    generation: 2258,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool?ver=14.1.0.3',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:cname:members:memberscollectionstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool/members?ver=14.1.0.3',
                        addresses: []
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepEqual(results, [
                    {
                        path: '/tenant/application/testPool',
                        command: 'gtm pool cname',
                        properties: {
                            enabled: true,
                            'max-answers-returned': 10,
                            members: {},
                            monitor: '/Common/http and /Common/https '
                        },
                        ignore: []
                    }
                ]);
            });

            it('should return GSLB_Pool CNAME with member information', () => {
                const obj = {
                    kind: 'tm:gtm:pool:cname:cnamestate',
                    name: 'testPool',
                    partition: 'tenant',
                    subPath: 'application',
                    fullPath: '/tenant/application/testPool',
                    generation: 2258,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool?ver=14.1.0.3',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https ',
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool/members?ver=14.1.0.3',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        name: 'testServer:0',
                        kind: 'tm:gtm:pool:cname:members:membersstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool/members?ver=14.1.0.3',
                        enabled: true,
                        partition: 'tenant',
                        fullPath: '/tenant/application/testPool',
                        'member-order': 0,
                        ratio: 1
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results, [
                    {
                        path: '/tenant/application/testPool',
                        command: 'gtm pool cname',
                        properties: {
                            enabled: true,
                            'max-answers-returned': 10,
                            members: {
                                'testServer:0': {
                                    enabled: true,
                                    'member-order': 0,
                                    ratio: 1
                                }
                            },
                            monitor: '/Common/http and /Common/https '
                        },
                        ignore: []
                    }
                ]);
            });
        });

        describe('tm:gtm:server:serverstate', () => {
            it('should return GSLB_Server', () => {
                const obj = {
                    kind: 'tm:gtm:server:serverstate',
                    name: 'testServer',
                    partition: 'Common',
                    fullPath: '/Common/testServer',
                    generation: 6284,
                    selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer?ver=14.1.0.3',
                    datacenter: '/Common/testDataCenter',
                    datacenterReference:
                        { link: 'https://localhost/mgmt/tm/gtm/datacenter/~Common~testDataCenter?ver=14.1.0.3' },
                    enabled: true,
                    monitor: '/Common/bigip ',
                    addresses: [{ name: '1.2.3.7', deviceName: '0', translation: 'none' }],
                    metadata: [
                        { name: 'as3', persist: 'true' },
                        { name: 'as3-virtuals', persist: true, value: '1.2.3.8:5050' }
                    ],
                    virtualServersReference:
                    {
                        link: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers?ver=14.1.0.3',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:server:devices:devicesstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6284,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/devices/0?ver=14.1.0.3',
                        addresses: [{ name: '1.2.3.7', translation: 'none' }]
                    },
                    {
                        kind: 'tm:gtm:server:virtual-servers:virtual-serversstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6283,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers/0?ver=14.1.0.3',
                        destination: '1.2.3.8:5050',
                        enabled: true,
                        monitor: '/Common/http '
                    }
                ];

                const expectedResults = [
                    {
                        path: '/Common/testServer',
                        command: 'gtm server',
                        properties: {
                            enabled: true,
                            datacenter: '/Common/testDataCenter',
                            description: 'none',
                            devices: {
                                0: {
                                    addresses: {
                                        '1.2.3.7': {
                                            translation: 'none'
                                        }
                                    }
                                }
                            },
                            metadata: {
                                as3: {
                                    persist: 'true'
                                },
                                'as3-virtuals': {
                                    persist: true,
                                    value: '1.2.3.8:5050'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            'virtual-servers': {
                                0: {
                                    destination: '1.2.3.8:5050',
                                    enabled: true,
                                    monitor: '/Common/http'
                                }
                            }
                        },
                        ignore: []
                    }
                ];
                defaultContext.target.tmosVersion = '13.0';
                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepEqual(results, expectedResults);
            });

            it('should filter out non-AS3 virtuals in a GSLB_Server', () => {
                const obj = {
                    kind: 'tm:gtm:server:serverstate',
                    name: 'testServer',
                    partition: 'Common',
                    fullPath: '/Common/testServer',
                    generation: 6284,
                    selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer?ver=14.1.0.3',
                    datacenter: '/Common/testDataCenter',
                    datacenterReference:
                        { link: 'https://localhost/mgmt/tm/gtm/datacenter/~Common~testDataCenter?ver=14.1.0.3' },
                    enabled: true,
                    monitor: '/Common/bigip ',
                    addresses: [],
                    metadata: [
                        { name: 'as3', persist: 'true' },
                        { name: 'as3-virtuals', persist: true, value: '1.2.3.8:5050' }
                    ],
                    virtualServersReference:
                    {
                        link: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers?ver=14.1.0.3',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:server:virtual-servers:virtual-serversstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6283,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers/0?ver=14.1.0.3',
                        destination: '1.2.3.8:5050',
                        enabled: true,
                        monitor: '/Common/http '
                    },
                    {
                        kind: 'tm:gtm:server:virtual-servers:virtual-serversstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6283,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers/0?ver=14.1.0.3',
                        destination: '1.4.5.9:80',
                        enabled: true,
                        monitor: '/Common/http '
                    }
                ];

                const expectedResults = [
                    {
                        path: '/Common/testServer',
                        command: 'gtm server',
                        properties: {
                            enabled: true,
                            datacenter: '/Common/testDataCenter',
                            description: 'none',
                            devices: {},
                            metadata: {
                                as3: {
                                    persist: 'true'
                                },
                                'as3-virtuals': {
                                    persist: true,
                                    value: '1.2.3.8:5050'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            addresses: {},
                            'virtual-servers': {
                                0: {
                                    destination: '1.2.3.8:5050',
                                    enabled: true,
                                    monitor: '/Common/http'
                                }
                            }
                        },
                        ignore: []
                    }
                ];
                defaultContext.target.tmosVersion = '13.0';
                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepEqual(results, expectedResults);
            });
        });

        describe('tm:gtm:wideip:a:astate', () => {
            it('should return an object with ordered pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:a:astate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    minimalResponse: 'enabled',
                    name: 'example.edu',
                    partition: 'ten',
                    poolLbMode: 'round-robin',
                    pools: [
                        {
                            name: 'pool1', partition: 'ten', subPath: 'app', order: 2, ratio: 1
                        },
                        {
                            name: 'pool2', partition: 'ten', subPath: 'app', order: 0, ratio: 2
                        },
                        {
                            name: 'pool3', partition: 'ten', subPath: 'app', order: 1, ratio: 3
                        }
                    ]
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'gtm wideip a',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'pool-lb-mode': 'round-robin',
                            pools: {
                                '/ten/app/pool3': { order: 1, ratio: 3 },
                                '/ten/app/pool1': { order: 2, ratio: 1 },
                                '/ten/app/pool2': { order: 0, ratio: 2 }
                            },
                            'pools-cname': {},
                            rules: {}
                        }
                    }
                );
            });

            it('should return an object without pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:a:astate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    minimalResponse: 'enabled',
                    name: 'example.edu',
                    partition: 'ten',
                    poolLbMode: 'round-robin'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'gtm wideip a',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'pool-lb-mode': 'round-robin',
                            pools: {},
                            'pools-cname': {},
                            rules: {}
                        }
                    }
                );
            });
        });

        describe('tm:ltm:ifile:ifilestate', () => {
            it('should return iFile', () => {
                const obj = {
                    kind: 'tm:ltm:ifile:ifilestate',
                    name: 'iFile',
                    partition: 'theTenant',
                    subPath: 'theApplication',
                    fullPath: '/theTenant/theApplication/iFile',
                    generation: 2287,
                    selfLink: 'https://localhost/mgmt/tm/ltm/ifile/~theTenant~theApplication~iFile?ver=13.1.4',
                    fileName: '/Common/iFile'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        path: '/theTenant/theApplication/iFile',
                        command: 'ltm ifile',
                        properties: {
                            'file-name': '/Common/iFile'
                        },
                        ignore: []
                    }
                );
            });
        });

        describe('tm:sys:file:ifile:ifilestate', () => {
            it('should return sys file ifile', () => {
                const obj = {
                    kind: 'tm:sys:file:ifile:ifilestate',
                    name: 'theIFile',
                    partition: 'theTenant',
                    fullPath: '/theTenant/theIFile',
                    generation: 1,
                    selfLink: 'https://localhost/mgmt/tm/sys/file/ifile/~theTenant~theIFile?ver=13.1.4',
                    checksum: 'SHA1:625:32d4fa2fa166d85f5eb9f21670be610b8e734d0e',
                    createTime: '2021-04-15T20:17:21Z',
                    createdBy: 'root',
                    lastUpdateTime: '2021-04-15T20:17:21Z',
                    mode: 33188,
                    revision: 1,
                    size: 625,
                    sourcePath: 'file:///config/cloud/keys/theIFile',
                    updatedBy: 'root'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        path: '/theTenant/theIFile',
                        command: 'sys file ifile',
                        properties: {
                            'source-path': 'file:///config/cloud/keys/theIFile'
                        },
                        ignore: []
                    }
                );
            });
        });

        describe('tm:ltm:profile:http-proxy-connect:http-proxy-connectstate', () => {
            it('should return ltm profile http-proxy-connect', () => {
                const obj = {
                    kind: 'tm:ltm:profile:http-proxy-connect:http-proxy-connectstate',
                    name: 'proxyConnect',
                    partition: 'tenant',
                    subPath: 'app',
                    fullPath: '/tenant/app/proxyConnect',
                    generation: 1,
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/http-proxy-connect/~tenant~app~proxyConnect',
                    appService: 'none',
                    defaultState: 'enabled',
                    defaultsFrom: 'none',
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        path: '/tenant/app/proxyConnect',
                        command: 'ltm profile http-proxy-connect',
                        properties: {
                            'default-state': 'enabled'
                        },
                        ignore: []
                    }
                );
            });
        });
    });
});

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

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const util = require('../../../src/lib/util/util');
const mapAs3 = require('../../../src/lib/map_as3');

const translate = mapAs3.translate;

describe('map_as3', () => {
    let defaultContext;
    beforeEach(() => {
        defaultContext = {
            target: {
                tmosVersion: '0.0.0'
            },
            request: {
                postProcessing: []
            },
            currentIndex: 0,
            tasks: [{}],
            host: {
                parser: {}
            }
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    function translateClass(className, item) {
        const func = translate[className];
        const numArgs = func.length;

        if (!func) {
            throw Error(`No translation for class ${className}`);
        }

        if (numArgs === 4) {
            return translate[className](defaultContext, 'tenantId', 'appId', item).configs[0];
        }
        return translate[className](defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
    }

    describe('Tenant', () => {
        it('should convert basic', () => {
            const config = translate.Tenant(defaultContext, 'tenantId', {}).configs[0];
            assert.equal(config.command, 'auth partition');
            assert.equal(config.path, '/tenantId/');
        });

        it('should ignore /Common', () => {
            const configs = translate.Tenant(defaultContext, 'Common').configs;
            assert.deepEqual(configs, []);
        });
    });

    describe('Application', () => {
        it('should convert basic', () => {
            const config = translate.Application(defaultContext, 'tenantId', 'appId', {}).configs[0];
            assert.equal(config.command, 'sys folder');
            assert.equal(config.path, '/tenantId/appId/');
        });
    });

    describe('FQDN_Node', () => {
        it('should convert addressFamily', () => {
            const config = translateClass('FQDN_Node', {
                hostname: 'example.com',
                addressFamily: 'IPv6'
            });
            assert.equal(config.properties.fqdn['address-family'], 'ipv6');
        });

        it('should convert queryInterval', () => {
            let config = translateClass('FQDN_Node', {
                hostname: 'example.com',
                queryInterval: 0
            });
            assert.equal(config.properties.fqdn.interval, 'ttl');
            config = translateClass('FQDN_Node', {
                hostname: 'example.com',
                queryInterval: 10
            });
            assert.strictEqual(config.properties.fqdn.interval, '10');
        });

        it('should convert hostname', () => {
            const config = translateClass('FQDN_Node', {
                hostname: 'example.com'
            });
            assert.equal(config.path, '/tenantId/appId/example.com');
            assert.equal(config.properties.fqdn.tmName, 'example.com');
        });

        it('should convert fqdnPrefix', () => {
            const config = translateClass('FQDN_Node', {
                hostname: 'example.com',
                fqdnPrefix: 'fqdn-'
            });
            assert.equal(config.path, '/tenantId/appId/fqdn-example.com');
            assert.equal(config.properties.fqdn.tmName, 'example.com');
            assert.equal(config.properties.metadata.fqdnPrefix.value, 'fqdn-');
        });
    });

    describe('Endpoint_Policy', () => {
        it('should handle datagroup', () => {
            defaultContext.target.tmosVersion = '13.1';
            const actions = [
                {
                    input: { type: 'forward', select: { service: { bigip: '/Common/myService' } } },
                    expected: 'forward ssl-client-hello select virtual /Common/myService'
                },
                {
                    input: { type: 'forward', select: { pool: { bigip: '/Common/myPool' }, snat: 'automap' } },
                    expected: 'forward ssl-client-hello select snat automap pool /Common/myPool'
                },
                {
                    input: { type: 'waf', policy: { bigip: '/Common/myPolicy' } },
                    expected: 'asm request enable policy /Common/myPolicy'
                },
                {
                    input: { type: 'waf' },
                    expected: 'asm request disable'
                },
                {
                    input: { type: 'drop' },
                    expected: 'shutdown client-accepted connection'
                },
                {
                    input: { type: 'drop', event: 'proxy-request' },
                    expected: 'shutdown proxy-request connection'
                },
                {
                    input: { type: 'httpRedirect', location: '10.10.10.10' },
                    expected: 'http-reply request redirect location 10.10.10.10'
                },
                {
                    input: { type: 'clientSsl', enabled: true },
                    expected: 'server-ssl request enable'
                },
                {
                    input: { type: 'clientSsl', enabled: false },
                    expected: 'server-ssl request disable'
                },
                {
                    input: { type: 'http', enabled: true },
                    expected: 'http request enable'
                },
                {
                    input: { type: 'http', enabled: false },
                    expected: 'http request disable'
                },
                {
                    input: {
                        type: 'tcl',
                        event: 'proxy-request',
                        setVariable: {
                            expression: '1',
                            name: 'http_uri_rewritten'
                        }
                    },
                    expected: 'tcl proxy-request set-variable name http_uri_rewritten expression 1'
                },
                {
                    input: {
                        type: 'log',
                        event: 'proxy-request',
                        write: {
                            message: 'The message!',
                            facility: 'local1',
                            priority: 'debug',
                            ipAddress: '1.2.3.4',
                            port: 123
                        }
                    },
                    expected: 'log proxy-request write message "The message!" facility local1 priority debug ip-address 1.2.3.4 port 123'
                }
            ];

            const conditions = [
                {
                    input: {
                        type: 'httpUri',
                        event: 'request',
                        host: {
                            operand: 'contains',
                            datagroup: { bigip: '/Common/aol' }
                        }
                    },
                    expected: 'http-uri request host contains datagroup /Common/aol case-insensitive'
                },
                {
                    input: {
                        type: 'httpUri',
                        event: 'request',
                        host: {
                            operand: 'contains',
                            datagroup: { use: '/Tenant/Application/myDatagroup' }
                        }
                    },
                    expected: 'http-uri request host contains datagroup /Tenant/Application/myDatagroup case-insensitive'
                },
                {
                    input: {
                        type: 'httpUri',
                        event: 'proxy-request',
                        path: {
                            operand: 'equals',
                            values: ['value1', 'value2']
                        }
                    },
                    expected: 'http-uri proxy-request path equals values { value1 value2 } case-insensitive'
                },
                {
                    input: {
                        type: 'sslExtension',
                        event: 'ssl-client-hello',
                        serverName: 'me.example.com',
                        index: 99
                    },
                    expected: 'ssl-extension ssl-client-hello server-name equals case-insensitive'
                }
            ];

            const item = {
                strategy: 'all-match',
                rules: [
                    {
                        name: 'replace',
                        actions: actions.map((a) => a.input),
                        conditions: conditions.map((c) => c.input)
                    }
                ]
            };
            const config = translateClass('Endpoint_Policy', item);
            assert.strictEqual(config.properties.strategy, '/Common/all-match');
            actions.forEach((action, index) => {
                assert.strictEqual(
                    config.properties.rules.replace.actions[index].policyString,
                    action.expected
                );
            });
            conditions.forEach((condition, index) => {
                assert.strictEqual(
                    config.properties.rules.replace.conditions[index].policyString,
                    condition.expected
                );
            });
        });
    });

    describe('Pool', () => {
        let item;

        beforeEach(() => {
            item = {
                class: 'Pool',
                loadBalancingMode: 'round-robin',
                minimumMembersActive: 1,
                reselectTries: 0,
                serviceDownAction: 'none',
                slowRampTime: 10,
                minimumMonitors: 1
            };
        });

        it('should convert basic', () => {
            const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
            assert.deepEqual(
                config,
                {
                    command: 'ltm pool',
                    ignore: [],
                    path: '/tenantId/appId/myPool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        minimumMonitors: 1,
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    }
                }
            );
        });

        describe('allowNATEnabled and allowSNATEnabled', () => {
            [[true, 'yes'], [false, 'no']].forEach((test) => {
                it(`should convert when ${test[0]}`, () => {
                    item.allowNATEnabled = test[0];
                    item.allowSNATEnabled = test[0];
                    const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                    assert.deepStrictEqual(config.properties['allow-nat'], test[1]);
                    assert.deepStrictEqual(config.properties['allow-snat'], test[1]);
                    assert.isUndefined(config.properties.allowNATEnabled);
                    assert.isUndefined(config.properties.allowSNATEnabled);
                });
            });
        });

        it('should convert FQDN member', () => {
            item.members = [
                {
                    servicePort: 80,
                    addressDiscovery: 'fqdn',
                    autoPopulate: true,
                    hostname: 'www.f5.com',
                    queryInterval: 0,
                    shareNodes: true,
                    fqdnPrefix: 'node-',
                    enable: true
                }
            ];
            const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
            assert.deepStrictEqual(
                config,
                {
                    command: 'ltm node',
                    ignore: [],
                    path: '/Common/node-www.f5.com',
                    properties: {
                        fqdn: {
                            autopopulate: 'enabled',
                            tmName: 'www.f5.com',
                            interval: 'ttl'
                        },
                        metadata: {
                            fqdnPrefix: {
                                value: 'node-'
                            }
                        }
                    }
                }
            );
        });

        describe('with Service Discovery', () => {
            beforeEach(() => {
                item.members = [
                    {
                        addressDiscovery: 'event',
                        servicePort: 8056,
                        enable: true,
                        connectionLimit: 0,
                        rateLimit: -1,
                        dynamicRatio: 1,
                        ratio: 1,
                        priorityGroup: 0,
                        adminState: 'enable',
                        shareNodes: false
                    }
                ];
            });

            it('should create a Service Discovery task', () => {
                const taskConfig = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                assert.deepEqual(
                    taskConfig,
                    {
                        command: 'mgmt shared service-discovery task',
                        ignore: [],
                        path: '/tenantId/~tenantId~appId~myPool',
                        properties: {
                            id: '~tenantId~appId~myPool',
                            metadata: {
                                configuredBy: 'AS3'
                            },
                            nodePrefix: '/tenantId/',
                            provider: 'event',
                            providerOptions: {},
                            resources: {
                                0: {
                                    path: '/tenantId/appId/myPool',
                                    type: 'pool',
                                    options: {
                                        connectionLimit: 0,
                                        dynamicRatio: 1,
                                        monitor: 'default',
                                        priorityGroup: 0,
                                        rateLimit: 'disabled',
                                        ratio: 1,
                                        servicePort: 8056
                                    }
                                }
                            },
                            routeDomain: 0,
                            schemaVersion: '1.0.0',
                            updateInterval: 0
                        }
                    }
                );
            });

            it('should create an Azure Service Discovery task with shareNodes', () => {
                item.members[0].shareNodes = true;
                item.members[0].addressDiscovery = 'azure';
                const taskConfig = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                assert.deepEqual(
                    taskConfig,
                    {
                        command: 'mgmt shared service-discovery task',
                        ignore: [],
                        path: '/tenantId/~tenantId~a~omefe5oz0TUX9YfsQoXKwM24ljw6vl3coaRFTBjno3D',
                        properties: {
                            id: '~tenantId~a~omefe5oz0TUX9YfsQoXKwM24ljw6vl3coaRFTBjno3D',
                            metadata: {
                                configuredBy: 'AS3'
                            },
                            nodePrefix: '/Common/',
                            provider: 'azure',
                            providerOptions: {},
                            resources: {
                                0: {
                                    path: '/tenantId/appId/myPool',
                                    type: 'pool',
                                    options: {
                                        connectionLimit: 0,
                                        dynamicRatio: 1,
                                        monitor: 'default',
                                        priorityGroup: 0,
                                        rateLimit: 'disabled',
                                        ratio: 1,
                                        servicePort: 8056
                                    }
                                }
                            },
                            routeDomain: 0,
                            schemaVersion: '1.0.0'
                        }
                    }
                );
            });

            it('should remove pool members when configured for Event-Driven Service Discovery', () => {
                const taskConfig = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[1];
                assert.deepEqual(
                    taskConfig,
                    {
                        command: 'ltm pool',
                        ignore: ['members'],
                        path: '/tenantId/appId/myPool',
                        properties: {
                            'load-balancing-mode': 'round-robin',
                            'min-active-members': 1,
                            minimumMonitors: 1,
                            'reselect-tries': 0,
                            'service-down-action': 'none',
                            'slow-ramp-time': 10
                        }
                    }
                );
            });
        });

        describe('routeDomain', () => {
            beforeEach(() => {
                item.members = [
                    {
                        addressDiscovery: 'static',
                        servicePort: 80,
                        serverAddresses: [
                            '1.2.3.4'
                        ],
                        routeDomain: 100,
                        enable: true
                    }
                ];
            });

            it('should add route domain to addresses for static members', () => {
                const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                assert.deepEqual(
                    config,
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/1.2.3.4%100',
                        properties: {
                            address: '1.2.3.4%100',
                            metadata: {}
                        }
                    }
                );
            });

            it('should use route domain in serverAddresses if specified in address and routeDomain property is also used', () => {
                item.members[0].serverAddresses[0] = '1.2.3.4%123';
                const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                assert.deepEqual(
                    config,
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/1.2.3.4%123',
                        properties: {
                            address: '1.2.3.4%123',
                            metadata: {}
                        }
                    }
                );
            });

            it('should not apply routeDomain of 0', () => {
                item.members[0].routeDomain = 0;
                const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                assert.deepEqual(
                    config,
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/1.2.3.4',
                        properties: {
                            address: '1.2.3.4',
                            metadata: {}
                        }
                    }
                );
            });

            it('should remove route domain from server address when it is 0', () => {
                item.members[0].serverAddresses[0] = '1.2.3.4%0';
                const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs[0];
                assert.deepEqual(
                    config,
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/1.2.3.4',
                        properties: {
                            address: '1.2.3.4',
                            metadata: {}
                        }
                    }
                );
            });

            it('should create nodes with name of server if servers is used', () => {
                item.members[0].servers = [
                    {
                        name: 'node1.example.com',
                        address: '192.168.0.1'
                    },
                    {
                        name: 'node2.example.com',
                        address: '192.168.0.2%0'
                    }
                ];
                const config = translate.Pool(defaultContext, 'tenantId', 'appId', 'myPool', item).configs;
                assert.deepStrictEqual(
                    config[0],
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/1.2.3.4%100',
                        properties: {
                            address: '1.2.3.4%100',
                            metadata: {}
                        }
                    }
                );
                assert.deepStrictEqual(
                    config[1],
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/node1.example.com',
                        properties: {
                            address: '192.168.0.1%100',
                            metadata: {}
                        }
                    }
                );
                assert.deepStrictEqual(
                    config[2],
                    {
                        command: 'ltm node',
                        ignore: [],
                        path: '/tenantId/node2.example.com',
                        properties: {
                            address: '192.168.0.2',
                            metadata: {}
                        }
                    }
                );
            });
        });
    });

    describe('HTML_Rule', () => {
        it('should create correct comment-raise-event config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'comment-raise-event'
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule comment-raise-event',
                        properties: {
                            description: '"A description"'
                        },
                        ignore: []
                    }
                ]
            });
        });

        it('should create correct comment-remove config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'comment-remove'
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule comment-remove',
                        properties: {
                            description: '"A description"'
                        },
                        ignore: []
                    }
                ]
            });
        });

        it('should create correct tag-append-html config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'tag-append-html',
                content: 'some content',
                match: {
                    attributeName: 'attribute name',
                    attributeValue: 'attribute value',
                    tagName: 'tag name'
                }
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule tag-append-html',
                        properties: {
                            description: '"A description"',
                            action: {
                                text: '"some content"'
                            },
                            match: {
                                'attribute-name': '"attribute name"',
                                'attribute-value': '"attribute value"',
                                'tag-name': '"tag name"'
                            }
                        },
                        ignore: []
                    }
                ]
            });
        });

        it('should create correct tag-prepend-html config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'tag-prepend-html',
                content: 'some content',
                match: {
                    attributeName: 'attribute name',
                    attributeValue: 'attribute value',
                    tagName: 'tag name'
                }
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule tag-prepend-html',
                        properties: {
                            description: '"A description"',
                            action: {
                                text: '"some content"'
                            },
                            match: {
                                'attribute-name': '"attribute name"',
                                'attribute-value': '"attribute value"',
                                'tag-name': '"tag name"'
                            }
                        },
                        ignore: []
                    }
                ]
            });
        });

        it('should create correct tag-raise-event config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'tag-raise-event',
                content: 'some content',
                match: {
                    attributeName: 'attribute name',
                    attributeValue: 'attribute value',
                    tagName: 'tag name'
                }
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule tag-raise-event',
                        properties: {
                            description: '"A description"',
                            match: {
                                'attribute-name': '"attribute name"',
                                'attribute-value': '"attribute value"',
                                'tag-name': '"tag name"'
                            }
                        },
                        ignore: []
                    }
                ]
            });
        });

        it('should create correct tag-remove config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'tag-remove',
                content: 'some content',
                match: {
                    attributeName: 'attribute name',
                    attributeValue: 'attribute value',
                    tagName: 'tag name'
                }
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule tag-remove',
                        properties: {
                            description: '"A description"',
                            match: {
                                'attribute-name': '"attribute name"',
                                'attribute-value': '"attribute value"',
                                'tag-name': '"tag name"'
                            }
                        },
                        ignore: []
                    }
                ]
            });
        });

        it('should create correct tag-remove-attribute config', () => {
            const item = {
                class: 'HTML_Rule',
                remark: 'A description',
                ruleType: 'tag-remove-attribute',
                attributeName: 'blah',
                match: {
                    attributeName: 'attribute name',
                    attributeValue: 'attribute value',
                    tagName: 'tag name'
                }
            };
            const result = translate.HTML_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm html-rule tag-remove-attribute',
                        properties: {
                            description: '"A description"',
                            action: {
                                'attribute-name': '"blah"'
                            },
                            match: {
                                'attribute-name': '"attribute name"',
                                'attribute-value': '"attribute value"',
                                'tag-name': '"tag name"'
                            }
                        },
                        ignore: []
                    }
                ]
            });
        });
    });

    describe('HTML_Profile', () => {
        const item = {
            class: 'HTML_Profile',
            remark: 'A description',
            contentDetectionEnabled: false,
            contentSelection: [
                'text/html',
                'text/xhtml'
            ],
            rules: [
                { use: '/Common/sample1' },
                { bigip: '/Common/sample2' }
            ]
        };

        it('should create correct config', () => {
            const result = translate.HTML_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm profile html',

                        properties: {
                            description: '"A description"',
                            'content-detection': 'disabled',
                            'content-selection': {
                                'text/html': {},
                                'text/xhtml': {}
                            },
                            rules: {
                                '/Common/sample1': {},
                                '/Common/sample2': {}
                            }
                        },
                        ignore: []
                    }
                ]
            });
        });
    });

    describe('HTTP_Profile', () => {
        let item;
        let context;

        beforeEach(() => {
            item = {
                class: 'HTTP_Profile',
                remark: 'A description',
                proxyType: 'transparent',
                encryptCookies: [
                    'peanutButter'
                ],
                cookiePassphrase: {
                    ciphertext: 'ZjU=',
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0=',
                    ignoreChanges: true
                },
                fallbackRedirect: 'http://example.com/fallback.html',
                fallbackStatusCodes: [
                    300,
                    500
                ],
                requestChunking: 'selective',
                responseChunking: 'preserve',
                rewriteRedirects: 'all',
                multiplexTransformations: false,
                insertHeader: {
                    name: 'X-Forwarded-IP',
                    value: '[expr { [IP::client_addr] }]'
                },
                whiteOutHeader: 'WhiteOut',
                allowedResponseHeaders: [
                    'ThisIsAllowed'
                ],
                xForwardedFor: false,
                trustXFF: true,
                otherXFF: [
                    'Alternate'
                ],
                hstsInsert: true,
                hstsPeriod: 1000000,
                hstsIncludeSubdomains: false,
                hstsPreload: true,
                viaRequest: 'preserve',
                viaResponse: 'append',
                viaHost: 'example.com',
                serverHeaderValue: 'HEADER',
                knownMethods: [
                    'CONNECT',
                    'DELETE'
                ],
                unknownMethodAction: 'reject',
                maxRequests: 123456,
                pipelineAction: 'reject',
                webSocketsEnabled: true,
                webSocketMasking: 'preserve',
                maxHeaderCount: 400,
                maxHeaderSize: 23000,
                truncatedRedirects: true,
                excessClientHeaders: 'pass-through',
                excessServerHeaders: 'pass-through',
                oversizeClientHeaders: 'pass-through',
                oversizeServerHeaders: 'pass-through',
                proxyConnectEnabled: true
            };
            context = {
                target: {
                    tmosVersion: '13.1'
                }
            };
        });

        it('should create correct config', () => {
            const expectedConfig = {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm profile http',
                        ignore: ['encrypt-cookie-secret'],
                        properties: {
                            'accept-xff': 'enabled',
                            description: '"A description"',
                            'encrypt-cookies': {
                                peanutButter: {}
                            },
                            'encrypt-cookie-secret': '"f5"',
                            enforcement: {
                                'excess-client-headers': 'pass-through',
                                'excess-server-headers': 'pass-through',
                                'known-methods': {
                                    CONNECT: {},
                                    DELETE: {}
                                },
                                'max-header-count': 400,
                                'max-header-size': 23000,
                                'max-requests': 123456,
                                'oversize-client-headers': 'pass-through',
                                'oversize-server-headers': 'pass-through',
                                pipeline: 'reject',
                                'truncated-redirects': 'enabled',
                                'unknown-method': 'reject'
                            },
                            'fallback-host': 'http://example.com/fallback.html',
                            'fallback-status-codes': {
                                300: {},
                                500: {}
                            },
                            'header-erase': '"WhiteOut"',
                            'header-insert': '"X-Forwarded-IP: \\[expr \\{ \\[IP::client_addr\\] \\}\\]"',
                            hsts: {
                                'include-subdomains': 'disabled',
                                'maximum-age': 1000000,
                                mode: 'enabled',
                                preload: 'enabled'
                            },
                            'insert-xforwarded-for': 'disabled',
                            'oneconnect-transformations': 'disabled',
                            'proxy-type': 'transparent',
                            'redirect-rewrite': 'all',
                            'request-chunking': 'selective',
                            'response-chunking': 'preserve',
                            'response-headers-permitted': {
                                ThisIsAllowed: {}
                            },
                            'server-agent-name': '"HEADER"',
                            'via-host-name': 'example.com',
                            'via-request': 'preserve',
                            'via-response': 'append',
                            'xff-alternative-names': {
                                Alternate: {}
                            }
                        }
                    },
                    {
                        path: '/tenantId/appId/f5_appsvcs_preserve',
                        command: 'ltm profile websocket',
                        properties: {
                            description: 'none',
                            masking: 'preserve'
                        },
                        ignore: []
                    },
                    {
                        path: '/tenantId/appId/f5_appsvcs_itemId_proxyConnect',
                        command: 'ltm profile http-proxy-connect',
                        properties: {
                            'default-state': 'enabled'
                        },
                        ignore: []
                    }
                ]
            };
            context.target.tmosVersion = '13.1';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.deepEqual(result, expectedConfig);
        });

        it('deprecated websocket profile should add new properties on 16.1', () => {
            context.target.tmosVersion = '16.1';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.strictEqual(result.configs[1].path, '/tenantId/appId/f5_appsvcs_preserve');
            assert.strictEqual(result.configs[1].command, 'ltm profile websocket');
            assert.deepStrictEqual(result.configs[1].properties, {
                'compress-mode': 'preserved',
                compression: 'enabled',
                description: 'none',
                masking: 'preserve',
                'no-delay': 'enabled',
                'window-bits': 10
            });
        });

        it('new websocket API should not autogenerate websocket profile', () => {
            delete item.webSocketsEnabled;
            delete item.webSocketMasking;

            item.profileWebSocket = {
                bigip: '/Common/websocket'
            };

            context.target.tmosVersion = '13.1';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeded');
            assert.strictEqual(result.configs.length, 2);
            assert.strictEqual(result.configs[0].command, 'ltm profile http');
            assert.strictEqual(result.configs[1].command, 'ltm profile http-proxy-connect');
        });

        it('explicit proxy', () => {
            item.proxyType = 'explicit';
            item.badRequestMessage = 'BAD REQUEST';
            item.badResponseMessage = 'BAD RESPONSE';
            item.connectErrorMessage = 'This is an error';
            item.defaultConnectAction = 'allow';
            item.dnsErrorMessage = 'This is a DNS error';
            item.doNotProxyHosts = ['www.proxy.host.net'];
            // item.resolver
            item.routeDomain = 1000;
            item.tunnelName = 'tunnel-name';
            item.ipv6 = true;
            delete item.insertHeader;
            delete item.excessClientHeaders;
            delete item.excessServerHeaders;
            delete item.knownMethods;
            delete item.maxHeaderCount;
            delete item.maxHeaderSize;
            delete item.maxRequests;
            delete item.oversizeClientHeaders;
            delete item.oversizeServerHeaders;
            delete item.pipelineAction;
            delete item.truncatedRedirects;
            delete item.unknownMethodAction;
            context.target.tmosVersion = '13.1';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeed');
            const expected = {
                'bad-request-message': '"BAD REQUEST"',
                'bad-response-message': '"BAD RESPONSE"',
                'connect-error-message': '"This is an error"',
                'default-connect-handling': 'allow',
                'dns-error-message': '"This is a DNS error"',
                'host-names': {
                    'www.proxy.host.net': {}
                },
                ipv6: 'yes',
                'route-domain': '/Common/1000',
                'tunnel-name': '/Common/tunnel-name'
            };
            assert.deepEqual(result.configs[0].properties['explicit-proxy'], expected);
        });

        it('should map "selective" and "preserve" to "sustain" when TMOS version is 15.0 or newer', () => {
            item.responseChunking = 'selective';
            item.requestChunking = 'preserve';
            context.target.tmosVersion = '15.0';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeed');
            assert.strictEqual(result.configs[0].properties['response-chunking'], 'sustain');
            assert.strictEqual(result.configs[0].properties['request-chunking'], 'sustain');
        });

        it('should map "allowBlankSpaceAfterHeaderName" when TMOS version is 16.1 or newer', () => {
            item.allowBlankSpaceAfterHeaderName = true;
            context.target.tmosVersion = '16.1';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeed');
            assert.strictEqual(result.configs[0].properties.enforcement['allow-ws-header-name'], 'enabled');
        });

        it('should map "item.enforceRFCCompliance" when TMOS version is 15.0 or newer', () => {
            item.enforceRFCCompliance = true;
            context.target.tmosVersion = '15.0';
            const result = translate.HTTP_Profile(context, 'tenantId', 'appId', 'itemId', item, 'notNeeed');
            assert.strictEqual(result.configs[0].properties.enforcement['rfc-compliance'], 'enabled');
        });
    });

    describe('WebSocket_Profile', () => {
        let baseConfig;

        beforeEach(() => {
            defaultContext.target.tmosVersion = '15.1.0.0';

            baseConfig = {
                configs: [
                    {
                        command: 'ltm profile websocket',
                        ignore: [],
                        path: '/tenantId/appId/itemId'
                    }
                ]
            };
        });

        it('should create correct config with default values', () => {
            const item = {
                class: 'WebSocket_Profile',
                masking: 'selective',
                compressMode: 'preserved',
                compression: true,
                maximumWindowSize: 10,
                noDelay: true
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                description: 'none',
                masking: 'selective'
            };

            const result = translate.WebSocket_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });

        it('should create correct config with default values on 16.1', () => {
            defaultContext.target.tmosVersion = '16.1.0.0';

            const item = {
                class: 'WebSocket_Profile',
                masking: 'selective',
                compressMode: 'preserved',
                compression: true,
                maximumWindowSize: 10,
                noDelay: true
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                'compress-mode': 'preserved',
                compression: 'enabled',
                description: 'none',
                masking: 'selective',
                'no-delay': 'enabled',
                'window-bits': 10
            };

            const result = translate.WebSocket_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('HTTP_Compress', () => {
        const item = {
            class: 'HTTP_Compress',
            remark: 'description',
            allowHTTP10: true,
            bufferSize: 27000,
            contentTypeExcludes: [
                'exclude'
            ],
            contentTypeIncludes: [
                'include'
            ],
            uriExcludes: [
                'exclude'
            ],
            uriIncludes: [
                'include'
            ],
            cpuSaver: false,
            cpuSaverHigh: 73,
            cpuSaverLow: 13,
            minimumSize: 2300,
            preferMethod: 'deflate',
            gzipLevel: 3,
            gzipMemory: 16,
            gzipWindowSize: 32,
            keepAcceptEncoding: true,
            selective: true,
            varyHeader: false
        };
        it('create correct config', () => {
            const expected = {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm profile http-compression',
                        properties: {
                            'allow-http-10': 'enabled',
                            'buffer-size': 27000,
                            'content-type-exclude': {
                                '"exclude"': {}
                            },
                            'content-type-include': {
                                '"include"': {}
                            },
                            'cpu-saver': 'disabled',
                            'cpu-saver-high': 73,
                            'cpu-saver-low': 13,
                            description: '"description"',
                            'min-size': 2300,
                            'method-prefer': 'deflate',
                            'gzip-level': 3,
                            'gzip-memory-level': 16,
                            'gzip-window-size': 32,
                            'keep-accept-encoding': 'enabled',
                            selective: 'enabled',
                            'vary-header': 'disabled',
                            'uri-exclude': {
                                '"exclude"': {}
                            },
                            'uri-include': {
                                '"include"': {}
                            }
                        },
                        ignore: []
                    }
                ]
            };
            const result = translate.HTTP_Compress(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(result, expected);
        });
    });

    describe('HTTP_Acceleration_Profile', () => {
        const item = {
            class: 'HTTP_Acceleration_Profile',
            parentProfile: {
                use: 'accel'
            },
            agingRate: 5,
            ignoreHeaders: 'none',
            insertAgeHeaderEnabled: false,
            maximumAge: 10000,
            maximumEntries: 20000,
            maximumObjectSize: 100000,
            minimumObjectSize: 2000,
            cacheSize: 200,
            uriExcludeList: [
                '.'
            ],
            uriIncludeList: [
                'www.uri.com'
            ],
            uriIncludeOverrideList: [
                '1.1.2.2',
                '2.2.3.3'
            ],
            uriPinnedList: [
                '///'
            ],
            metadataMaxSize: 20
        };
        it('create correct config', () => {
            const expected = {
                configs: [
                    {
                        command: 'ltm profile web-acceleration',
                        ignore: [],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            'cache-aging-rate': 5,
                            'cache-client-cache-control-mode': 'none',
                            'cache-insert-age-header': 'disabled',
                            'cache-max-age': 10000,
                            'cache-max-entries': 20000,
                            'cache-object-max-size': 100000,
                            'cache-object-min-size': 2000,
                            'cache-size': 200,
                            'cache-uri-exclude': {
                                '.': {}
                            },
                            'cache-uri-include': {
                                'www.uri.com': {}
                            },
                            'cache-uri-include-override': {
                                '1.1.2.2': {},
                                '2.2.3.3': {}
                            },
                            'cache-uri-pinned': {
                                '///': {}
                            },
                            'defaults-from': 'accel',
                            'metadata-cache-max-size': 20
                        }
                    }
                ]
            };
            const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(result, expected);
        });

        it('check parentProfile values', () => {
            [{ bigip: '/Common/webacceleration' },
                { use: 'accel' }, { use: '/tenantId/appId/acceleration' }].forEach((profile) => {
                item.parentProfile = profile;
                const expected = profile[Object.keys(profile)[0]];
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'defaults-from'), true);
                assert.deepEqual(result.properties['defaults-from'], expected);
            });
        });

        it('check ignoreHeaders values', () => {
            ['all', 'max-age', 'none'].forEach((value) => {
                item.ignoreHeaders = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-client-cache-control-mode'), true);
                assert.deepEqual(result.properties['cache-client-cache-control-mode'], expected);
            });
        });

        it('check agingRate values', () => {
            [0, 3, 10].forEach((value) => {
                item.agingRate = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-aging-rate'), true);
                assert.deepEqual(result.properties['cache-aging-rate'], expected);
            });
        });

        it('check insertAgeHeaderEnabled values', () => {
            [true, false].forEach((value) => {
                item.insertAgeHeaderEnabled = value;
                const expected = value ? 'enabled' : 'disabled';
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-insert-age-header'), true);
                assert.deepEqual(result.properties['cache-insert-age-header'], expected);
            });
        });

        it('check maximumAge values', () => {
            [0, 4789, 4294967295].forEach((value) => {
                item.maximumAge = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-max-age'), true);
                assert.deepEqual(result.properties['cache-max-age'], expected);
            });
        });

        it('check maximumEntries values', () => {
            [0, 6912345, 4294967295].forEach((value) => {
                item.maximumEntries = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-max-entries'), true);
                assert.deepEqual(result.properties['cache-max-entries'], expected);
            });
        });

        it('check maximumObjectSize values', () => {
            [0, 1234567, 4294967295].forEach((value) => {
                item.maximumObjectSize = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-object-max-size'), true);
                assert.deepEqual(result.properties['cache-object-max-size'], expected);
            });
        });

        it('check minimumObjectSize values', () => {
            [0, 1234567, 4294967295].forEach((value) => {
                item.minimumObjectSize = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-object-min-size'), true);
                assert.deepEqual(result.properties['cache-object-min-size'], expected);
            });
        });

        it('check cacheSize values', () => {
            [0, 200, 4294967295].forEach((value) => {
                item.cacheSize = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-size'), true);
                assert.deepEqual(result.properties['cache-size'], expected);
            });
        });

        it('check uriExcludeList values', () => {
            const expected = [
                {},
                { exclude1: {} },
                { exclude1: {}, exclude2: {} }
            ];
            [[], ['exclude1'], ['exclude1', 'exclude2']].forEach((value, index) => {
                item.uriExcludeList = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-uri-exclude'), true);
                assert.deepEqual(result.properties['cache-uri-exclude'], expected[index]);
            });
        });

        it('check uriIncludeList values', () => {
            const expected = [
                {},
                { include1: {} },
                { include1: {}, include2: {} }
            ];
            [[], ['include1'], ['include1', 'include2']].forEach((value, index) => {
                item.uriIncludeList = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-uri-include'), true);
                assert.deepEqual(result.properties['cache-uri-include'], expected[index]);
            });
        });

        it('check uriIncludeOverrideList values', () => {
            const expected = [
                {},
                { include1: {} },
                { include1: {}, include2: {} }
            ];
            [[], ['include1'], ['include1', 'include2']].forEach((value, index) => {
                item.uriIncludeOverrideList = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-uri-include-override'), true);
                assert.deepEqual(result.properties['cache-uri-include-override'], expected[index]);
            });
        });

        it('check uriPinnedList values', () => {
            const expected = [
                {},
                { pinned1: {} },
                { pinned1: {}, pinned2: {} }
            ];
            [[], ['pinned1'], ['pinned1', 'pinned2']].forEach((value, index) => {
                item.uriPinnedList = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'cache-uri-pinned'), true);
                assert.deepEqual(result.properties['cache-uri-pinned'], expected[index]);
            });
        });

        it('check metadataMaxSize values', () => {
            [0, 123, 4294967295].forEach((value) => {
                item.metadataMaxSize = value;
                const expected = value;
                const result = translate.HTTP_Acceleration_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0];
                assert.deepEqual(Object.hasOwnProperty.call(result.properties, 'metadata-cache-max-size'), true);
                assert.deepEqual(result.properties['metadata-cache-max-size'], expected);
            });
        });
    });

    [
        {
            name: 'iRule',
            module: 'ltm'
        },
        {
            name: 'GSLB_iRule',
            module: 'gtm'
        }
    ].forEach((ruleClass) => {
        describe(ruleClass.name, () => {
            it('should generate expected iRule from text', () => {
                const item = {
                    class: ruleClass.name,
                    iRule: 'when CLIENT_ACCEPTED {\nif {[IP::client_addr] starts_with "10."} {\n pool `*pvt_pool`\n }\n}'
                };
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: ruleClass.name,
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug'
                    },
                    tenantId: {
                        class: 'Tennant',
                        appId: {
                            class: 'Application',
                            template: 'generic',
                            itemId: {
                                class: ruleClass.name,
                                irule: 'when CLIENT_ACCEPTED {\nif {[IP::client_addr] starts_with "10."} {\n pool `*pvt_pool`\n }\n}'
                            }
                        }
                    }
                };
                const results = translate[ruleClass.name](defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                const expectedCommand = `${ruleClass.module} rule`;
                const expectedIRule = 'when CLIENT_ACCEPTED {\nif {[IP::client_addr] starts_with "10."} {\n pool `*pvt_pool`\n }\n}';
                assert.strictEqual(results.configs[0].command, expectedCommand);
                assert.strictEqual(results.configs[0].properties['api-anonymous'], expectedIRule);
            });

            it('should add to ignore when ignore changes is set to true', () => {
                const item = {
                    class: ruleClass.name,
                    iRule: {
                        url: {
                            url: 'https://test.example.com/myIRule',
                            ignoreChanges: true
                        }
                    }
                };
                const results = translate[ruleClass.name](defaultContext, 'tenantId', 'appId', 'itemId', item);
                assert.deepStrictEqual(
                    results.configs[0].ignore,
                    [
                        'api-anonymous'
                    ]
                );
            });
        });
    });

    describe('Enforcement iRule', () => {
        it('should generate expected PEM iRule from text', () => {
            const item = {
                class: 'Enforcement_iRule',
                iRule: 'when PEM_POLICY {PEM::session create 192.0.3.10 subscriber-id a123 subscriber-type e164'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'iRule',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tennant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Enforcement_iRule',
                            irule: 'when PEM_POLICY {PEM::session create 192.0.3.10 subscriber-id a123 subscriber-type e164'
                        }
                    }
                }
            };
            const results = translate.Enforcement_iRule(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expectedCommand = 'pem irule';
            const expectedIRule = 'when PEM_POLICY {PEM::session create 192.0.3.10 subscriber-id a123 subscriber-type e164';
            assert.strictEqual(results.configs[0].command, expectedCommand);
            assert.strictEqual(results.configs[0].properties['api-anonymous'], expectedIRule);
        });
    });

    describe('Service_Address virtual address', () => {
        const compareServiceAddressResults = function (result, item, expected) {
            assert.deepEqual(result.properties.address, expected.ip);
            assert.deepEqual(result.properties.arp === 'enabled', item.arpEnabled);
            assert.deepEqual(result.properties['icmp-echo'], item.icmpEcho.replace(/able$/, 'abled'));
            assert.deepEqual(result.properties.mask, expected.mask);
            assert.deepEqual(result.properties['route-advertisement'], (item.routeAdvertisement === undefined) ? 'disabled' : item.routeAdvertisement.replace(/able$/, 'abled'));
            assert.deepEqual(result.properties.spanning === 'enabled', item.spanningEnabled);
            assert.deepEqual(result.properties['traffic-group'], item.trafficGroup);
        };
        it('should return a basic Service_Address config', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '123.123.123.123',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'disable',
                spanningEnabled: false,
                trafficGroup: 'default'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '123.123.123.123',
                mask: '255.255.255.255'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });
        it('should return a config with network mask via /CIDR', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '123.123.123.123/13',
                arpEnabled: false,
                icmpEcho: 'disable',
                routeAdvertisement: 'enable',
                spanningEnabled: true,
                trafficGroup: '/Common/traffic-group-local-only'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123/13',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '123.123.123.123',
                mask: '255.248.0.0'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });
        it('should return a config with user set route domain', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '123.123.123.123%2222',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'disable',
                spanningEnabled: false,
                trafficGroup: 'default'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123%2222',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '123.123.123.123%2222',
                mask: '255.255.255.255'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });
        it('should return a config with user set route domain and /CIDR', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '123.123.123.123%2222/24',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'disable',
                spanningEnabled: false,
                trafficGroup: 'default'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123%2222/24',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '123.123.123.123%2222',
                mask: '255.255.255.0'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });
        it('should return a config using the default route domain and /CIDR', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '123.123.123.123/24',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'disable',
                spanningEnabled: false,
                trafficGroup: 'default'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    defaultRouteDomain: 222,
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123/24',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        },
                        enable: true
                    },
                    enable: true,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '123.123.123.123%222',
                mask: '255.255.255.0'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });
        it('should not change declaration', () => {
            // AUTOTOOL-1244
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.17.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug',
                    traceResponse: false
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        v6v4_wildcard_service_address: {
                            class: 'Service_Address',
                            label: 'v6v4 Virtual Server NAT64 prefix Destination Address',
                            virtualAddress: '64:ff9b::/96',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        }
                    }
                }
            };

            // item must point inside of declaration for this test
            const item = declaration.tenantId.appId.v6v4_wildcard_service_address;
            const savedDeclaration = util.simpleCopy(declaration);

            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '64:ff9b::',
                mask: 'ffff:ffff:ffff:ffff:ffff:ffff::'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
            assert.deepEqual(declaration, savedDeclaration);
        });
        it('should return a config with wildcard IPv6 characters', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '::',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'disable',
                spanningEnabled: false,
                trafficGroup: 'default'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    defaultRouteDomain: 222,
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '::',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        },
                        enable: true
                    },
                    enable: true,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: 'any6%222',
                mask: 'any6'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });
        it('should return a config with wildcard IPv6 and mapped IPv4 characters', () => {
            const item = {
                class: 'Service_Address',
                virtualAddress: '::ffff:10.0.0.1',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'disable',
                spanningEnabled: false,
                trafficGroup: 'default'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    defaultRouteDomain: 222,
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_Address',
                            virtualAddress: '::ffff.10.0.0.1',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'disable',
                            spanningEnabled: false,
                            trafficGroup: 'default'
                        },
                        enable: true
                    },
                    enable: true,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
            const results = translate.Service_Address(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            const expected = {
                ip: '::ffff:a00:1%222',
                mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
            };
            results.configs.forEach((result) => compareServiceAddressResults(result, item, expected));
        });

        describe('shareAddresses tests', () => {
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                foo: {
                    class: 'Tenant',
                    defaultRouteDomain: 0,
                    bar: {
                        class: 'Application',
                        template: 'generic',
                        Service: {
                            class: 'Service_Generic',
                            virtualAddresses: [
                                '10.10.0.11'
                            ],
                            virtualPort: 8080,
                            shareAddresses: true
                        }
                    }
                }
            };

            it('should send to /Common if shareAddresses is true', () => {
                const item = {
                    arp: true,
                    icmpEcho: 'enable',
                    spanning: false,
                    shareAddresses: true,
                    virtualAddress: '10.10.0.11'
                };

                const results = translate.Service_Address(defaultContext, 'foo', 'bar', '10.10.0.11', item, declaration);
                assert.strictEqual(results.configs[0].path, '/Common/Service_Address-10.10.0.11');
            });

            it('should send to /foo if shareAddresses false', () => {
                const item = {
                    arp: true,
                    icmpEcho: 'enable',
                    spanning: false,
                    shareAddresses: false,
                    virtualAddress: '10.10.0.11'
                };

                const results = translate.Service_Address(defaultContext, 'foo', 'bar', '10.10.0.11', item, declaration);
                assert.strictEqual(results.configs[0].path, '/foo/Service_Address-10.10.0.11');
            });
        });
    });

    describe('getDefaultRouteDomain', () => {
        let declaration;

        beforeEach(() => {
            declaration = {
                class: 'ADC',
                schemaVersion: '3.29.0',
                'dot.test': {
                    class: 'Tenant',
                    defaultRouteDomain: 2,
                    enable: true,
                    optimisticLockKey: '',
                    test_http: {
                        class: 'Application',
                        enable: true,
                        template: 'generic',
                        test_http: {
                            class: 'Service_HTTP',
                            addressStatus: true,
                            enable: true,
                            httpMrfRoutingEnabled: false,
                            lastHop: 'default',
                            layer4: 'tcp',
                            maxConnections: 0,
                            mirroring: 'none',
                            nat64Enabled: false,
                            persistenceMethods: ['cookie'],
                            profileHTTP: 'basic',
                            profileTCP: 'normal',
                            serviceDownImmediateAction: 'none',
                            shareAddresses: false,
                            snat: 'self',
                            translateClientPort: false,
                            translateServerAddress: true,
                            translateServerPort: true,
                            virtualAddresses: [
                                {
                                    use: '/dot.test/test_http_test_service_address'
                                }
                            ],
                            virtualPort: 443,
                            virtualType: 'standard'
                        },
                        test_service_address: {
                            class: 'Service_Address',
                            arpEnabled: true,
                            icmpEcho: 'enable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: false,
                            trafficGroup: 'default',
                            virtualAddress: '10.204.64.249'
                        }
                    }
                },
                updateMode: 'selective'
            };
        });

        it('should translate Service_Address in Tenant with periods in name and non-default route domain', () => {
            const item = {
                class: 'Service_Address',
                arpEnabled: true,
                icmpEcho: 'enable',
                routeAdvertisement: 'enable',
                spanningEnabled: false,
                trafficGroup: 'default',
                virtualAddress: '10.204.64.249'
            };

            const results = translate.Service_Address(defaultContext, 'dot.test', 'test_http', 'test_service_address', item, declaration);
            assert.strictEqual(results.configs[0].path, '/dot.test/Service_Address-test_service_address');
            assert.strictEqual(results.configs[0].command, 'ltm virtual-address');
            assert.strictEqual(results.configs[0].properties.address, '10.204.64.249%2');
        });

        it('should translate Service_HTTP in Tenant with periods in name and non-default route domain', () => {
            const item = {
                class: 'Service_HTTP',
                arpEnabled: true,
                enable: true,
                httpMrfRoutingEnabled: false,
                lastHop: 'default',
                layer4: 'tcp',
                maxConnections: 0,
                mirroring: 'none',
                nat64Enabled: false,
                persistenceMethods: ['cookie'],
                profileHTTP: 'basic',
                profileTCP: 'normal',
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                snat: 'self',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                virtualAddresses: [
                    {
                        use: '/dot.test/test_http/test_service_address'
                    }
                ],
                virtualPort: 443,
                virtualType: 'standard'
            };

            const results = translate.Service_HTTP(defaultContext, 'dot.test', 'test_http', 'test_http', item, declaration);
            assert.strictEqual(results.configs[0].path, '/dot.test/test_http/test_http-self');
            assert.strictEqual(results.configs[0].command, 'ltm snatpool');
            assert.strictEqual(Object.keys(results.configs[0].properties.members['/dot.test/test_http/10.204.64.249%2']).length, 0);
            assert.strictEqual(results.configs[1].path, '/dot.test/test_http/test_http');
            assert.strictEqual(results.configs[1].command, 'ltm virtual');
            assert.strictEqual(results.configs[1].properties.destination, '/dot.test/10.204.64.249%2:443');
            assert.strictEqual(results.configs[1].properties.source, '0.0.0.0%2/0');
        });
    });

    describe('Service_Core', () => {
        let item;
        let declaration;

        beforeEach(() => {
            item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    '10.192.75.27'
                ],
                virtualPort: 80,
                persistenceMethods: [
                    'cookie'
                ],
                profileHTTP: {
                    bigip: '/Common/http',
                    name: '/Common/http',
                    context: 'all'
                },
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                serviceDownImmediateAction: 'drop',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                profiles: [
                    {
                        bigip: '/Common/http',
                        name: '/Common/http',
                        context: 'all'
                    },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ],
                ipIntelligencePolicy: {
                    bigip: '/Common/ip-intelligence'
                }
            };

            declaration = {
                class: 'ADC',
                id: 'testid',
                schemaVersion: '3.10.0',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['10.192.75.27'],
                            virtualPort: 80,
                            persistenceMethods: ['cookie'],
                            profileHTTP: {
                                bigip: '/Common/http',
                                name: '/Common/http',
                                context: 'all'
                            },
                            layer4: 'tcp',
                            profileTCP: {
                                bigip: '/Common/f5-tcp-progressive',
                                name: '/Common/f5-tcp-progressive',
                                context: 'all'
                            },
                            enable: true,
                            maxConnections: 0,
                            snat: 'auto',
                            addressStatus: true,
                            mirroring: 'none',
                            lastHop: 'default',
                            serviceDownImmediateAction: 'drop',
                            translateClientPort: false,
                            translateServerAddress: true,
                            translateServerPort: true,
                            profiles: [
                                {
                                    bigip: '/Common/http',
                                    name: '/Common/http',
                                    context: 'all'
                                },
                                {
                                    bigip: '/Common/f5-tcp-progressive',
                                    name: '/Common/f5-tcp-progressive',
                                    context: 'all'
                                }
                            ],
                            ipIntelligencePolicy: {
                                bigip: '/Common/ip-intelligence'
                            }
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };
        });

        afterEach(() => {
            sinon.restore();
        });

        describe('websecurity profile', () => {
            it('should add if ASM is provisioned and bigip-pointer policyEndpoint', () => {
                item.policyEndpoint = [
                    {
                        bigip: '/Common/p1'
                    }
                ];
                declaration.tenantId.appId.itemId.policyEndpoint = [
                    {
                        bigip: '/Common/p1'
                    }
                ];
                sinon.stub(util, 'isOneOfProvisioned').callsFake(
                    (targetContext, module) => module.indexOf('asm') > -1
                );
                const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepEqual(results.configs[1].properties.profiles, {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    },
                    '/Common/websecurity': {
                        context: 'all'
                    }
                });
            });

            it('should skip adding if ASM is not provisioned', () => {
                item.policyEndpoint = [
                    {
                        bigip: '/Common/p1'
                    }
                ];
                declaration.tenantId.appId.itemId.policyEndpoint = [
                    {
                        bigip: '/Common/p1'
                    }
                ];
                sinon.stub(util, 'isOneOfProvisioned').returns(false);
                const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepEqual(results.configs[1].properties.profiles, {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    }
                });
            });

            it('should add if ASM is provisioned and waf action type', () => {
                item.policyEndpoint = [{
                    use: '/tenantId/appId/p1'
                }];
                declaration.tenantId.appId.itemId.policyEndpoint = [{
                    use: '/tenantId/appId/p1'
                }];
                declaration.tenantId.appId.p1 = {
                    class: 'Endpoint_Policy',
                    strategy: 'first-match',
                    rules: [
                        {
                            name: 'enableWAF',
                            conditions: [],
                            actions: [
                                {
                                    type: 'waf',
                                    policy: {
                                        use: '/Tenant/application/wafPolicy'
                                    },
                                    event: 'request'
                                }
                            ]
                        }
                    ]
                };
                sinon.stub(util, 'isOneOfProvisioned').callsFake(
                    (targetContext, module) => module.indexOf('asm') > -1
                );
                const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepEqual(results.configs[1].properties.profiles, {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    },
                    '/Common/websecurity': {
                        context: 'all'
                    }
                });
            });

            it('should add if ASM is provisioned and waf action type with periods in use-pointer path', () => {
                item.policyEndpoint = [{
                    use: '/test.tenant.name-with-dots-and-dashes-/appId/p1.'
                }];
                declaration.tenantId.appId.itemId.policyEndpoint = [{
                    use: '/test.tenant.name-with-dots-and-dashes-/appId/p1.'
                }];
                declaration['test.tenant.name-with-dots-and-dashes-'] = {
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        'p1.': {
                            class: 'Endpoint_Policy',
                            strategy: 'first-match',
                            rules: [
                                {
                                    name: 'enableWAF',
                                    conditions: [],
                                    actions: [
                                        {
                                            type: 'waf',
                                            policy: {
                                                use: '/Tenant/application/wafPolicy'
                                            },
                                            event: 'request'
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                };
                sinon.stub(util, 'isOneOfProvisioned').callsFake(
                    (targetContext, module) => module.indexOf('asm') > -1
                );
                const results = translate.Service_Core(defaultContext, 'test.tenant.name-with-dots-and-dashes-', 'appId', 'itemId', item, declaration);
                assert.deepEqual(results.configs[1].properties.profiles, {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    },
                    '/Common/websecurity': {
                        context: 'all'
                    }
                });
            });

            it('should skip adding if ASM is provisioned and string policyEndpoint not requiring it', () => {
                item.policyEndpoint = ['/tenantId/appId/p1'];
                declaration.tenantId.appId.itemId.policyEndpoint = ['/tenantId/appId/p1'];
                declaration.tenantId.appId.p1 = {
                    class: 'Endpoint_Policy',
                    strategy: 'first-match',
                    rules: [
                        {
                            name: 'redirect-login-rule',
                            conditions: [
                                {
                                    type: 'httpUri',
                                    pathSegment: {
                                        values: [
                                            'ui'
                                        ]
                                    },
                                    index: 1,
                                    event: 'request'
                                }
                            ],
                            actions: [
                                {
                                    type: 'drop',
                                    event: 'request'
                                }
                            ]
                        }
                    ]
                };
                sinon.stub(util, 'isOneOfProvisioned').callsFake(
                    (targetContext, module) => module.indexOf('asm') > -1
                );
                const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepEqual(results.configs[1].properties.profiles, {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    }
                });
            });

            it('should skip adding if ASM is provisioned and use-pointer policyEndpoint not requiring it', () => {
                item.policyEndpoint = [{
                    use: '/tenantId/appId/p1'
                }];
                declaration.tenantId.appId.itemId.policyEndpoint = [{
                    use: '/tenantId/appId/p1'
                }];
                declaration.tenantId.appId.p1 = {
                    class: 'Endpoint_Policy',
                    strategy: 'first-match',
                    rules: [
                        {
                            name: 'redirect-login-rule',
                            conditions: [
                                {
                                    type: 'httpUri',
                                    pathSegment: {
                                        values: [
                                            'ui'
                                        ]
                                    },
                                    index: 1,
                                    event: 'request'
                                }
                            ],
                            actions: [
                                {
                                    type: 'drop',
                                    event: 'request'
                                }
                            ]
                        }
                    ]
                };
                sinon.stub(util, 'isOneOfProvisioned').callsFake(
                    (targetContext, module) => module.indexOf('asm') > -1
                );
                const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepEqual(results.configs[1].properties.profiles, {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    }
                });
            });
        });

        it('should add a bigip-referenced idle timeout policy', () => {
            item.policyIdleTimeout = {
                bigip: '/Common/timerPolicy'
            };
            declaration.tenantId.appId.itemId.policyIdleTimeout = {
                bigip: '/Common/timerPolicy'
            };
            let results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[0].command, 'net service-policy');
            assert.deepEqual(results.configs[0].properties['timer-policy'], '/Common/timerPolicy');
            assert.deepEqual(results.configs[2].properties['service-policy'], '/tenantId/appId/f5_appsvcs_11a95f2a78a263a0bc491386c7defe3d');

            // another policyIdleTimeout with same name in another folder should hash to a different service policy name
            item.policyIdleTimeout = {
                bigip: '/Common2/timerPolicy'
            };
            declaration.tenantId.appId.itemId.policyIdleTimeout = {
                bigip: '/Common2/timerPolicy'
            };
            results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[2].properties['service-policy'], '/tenantId/appId/f5_appsvcs_7fc77ceb41432007f91bb77707db3776');
        });

        it('should add fps profile', () => {
            item.profileFPS = {
                bigip: '/Common/antifraud',
                name: '/Common/antifraud',
                context: 'all'
            };
            item.profiles.push(item.profileFPS);
            declaration.tenantId.appId.itemId.profileFPS = {
                bigip: '/Common/antifraud',
                name: '/Common/antifraud',
                context: 'all'
            };
            declaration.tenantId.appId.itemId.profiles.push(item.profileFPS);
            const expectedProfiles = {
                '/Common/http': {
                    context: 'all'
                },
                '/Common/f5-tcp-progressive': {
                    context: 'all'
                },
                '/Common/antifraud': {
                    context: 'all'
                }
            };

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles, expectedProfiles);
        });

        it('should handle HTTP MRF Routing', () => {
            item.httpMrfRoutingEnabled = true;
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.strictEqual(results.configs[1].properties.profiles['/Common/httprouter'].context, 'all');
        });

        it('should handle ipIntelligencePolicy', () => {
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties['ip-intelligence-policy'], '/Common/ip-intelligence');
        });

        it('should not add Integrated Bot Defense profile if tmosVersion is less than 17.0', () => {
            item.profileIntegratedBotDefense = {
                bigip: '/Common/bd'
            };
            const results = translate.Service_Core(defaultContext, 'tenantId', 'aooId', 'itemId', item, declaration);
            assert.deepStrictEqual(
                results.configs[1].properties.profiles,
                {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    }
                }
            );
        });

        it('should add Integrated Bot Defense profile if tmosVersion is 17.0 or greater', () => {
            item.profileIntegratedBotDefense = {
                bigip: '/Common/bd'
            };
            defaultContext.target.tmosVersion = '17.0';
            const results = translate.Service_Core(defaultContext, 'tenantId', 'aooId', 'itemId', item, declaration);
            assert.deepStrictEqual(
                results.configs[1].properties.profiles,
                {
                    '/Common/http': {
                        context: 'all'
                    },
                    '/Common/f5-tcp-progressive': {
                        context: 'all'
                    },
                    '/Common/bd': {
                        context: 'all'
                    }
                }
            );
        });

        describe('maximumBandwidth', () => {
            function assertProperty(inKey, outKey, inValue, outValue, context) {
                const fullContext = Object.assign({}, defaultContext, context);
                const newItem = {
                    enable: true,
                    virtualAddresses: ['192.0.2.0']
                };
                newItem[inKey] = inValue;
                const newDecl = {
                    tenant: {
                        defaultRouteDomain: 0
                    }
                };
                const data = translate.Service_Core(fullContext, 'tenant', 'app', 'item', newItem, newDecl);
                const virtual = data.configs.find((c) => c.command === 'ltm virtual');
                const result = virtual.properties[outKey];

                assert.strictEqual(result, outValue);
            }

            function assertValue(value, expected, context) {
                assertProperty('maximumBandwidth', 'throughput-capacity', value, expected, context);
            }

            beforeEach(() => {
                sinon.stub(util, 'isOneOfProvisioned').callsFake(
                    (targetContext, module) => module.indexOf('afm') > -1
                );
            });

            afterEach(() => {
                sinon.restore();
            });

            it('should allow "infinite"', () => {
                defaultContext.target.tmosVersion = '14.1';
                return assertValue('infinite', 'infinite', defaultContext);
            });

            it('should allow "infinite" on 13.1', () => {
                defaultContext.target.tmosVersion = '13.1.0.0';
                return assertValue('infinite', '0', defaultContext);
            });
            it('should allow 10', () => {
                defaultContext.target.tmosVersion = '14.1';
                return assertValue(10, '10', defaultContext);
            });
            it('should default to "infinite" if AFM is provisioned', () => {
                defaultContext.target.tmosVersion = '14.1';
                defaultContext.target.provisionedModules = ['afm'];
                return assertValue(undefined, 'infinite', defaultContext);
            });
            it('should default to undefined if AFM is not provisioned', () => {
                util.isOneOfProvisioned.restore();
                sinon.stub(util, 'isOneOfProvisioned').returns(false);
                assertValue(undefined, undefined);
            });
        });

        describe('shareAddresses', () => {
            beforeEach(() => {
                item.shareAddresses = true;
                declaration.tenantId.appId.itemId.shareAddresses = true;
            });
        });
    });

    describe('Service_Core virtual address conversions', () => {
        /*
         * Compares map_as3 config output to a subset of properties.
         *
         * Expects 'path' and 'properties' keys for each config item.
         * Any keys included inside the 'expected[idx].properties' object
         * will be compared to the 'result.configs[idx].properties' key.
         * Other keys in the config output will be skipped and ignored.
         */
        const assertServiceCore = (result, expected) => {
            assert.strictEqual(
                result.configs.length,
                expected.length,
                'Number of expected items does not match result.configs'
            );
            result.configs.forEach((c, idx) => {
                const configSubset = {
                    path: c.path,
                    properties: Object.keys(expected[idx].properties).reduce((obj, key) => {
                        obj[key] = c.properties[key];
                        return obj;
                    }, {})
                };
                assert.deepStrictEqual(
                    configSubset,
                    expected[idx],
                    'Expected item does not match result config item'
                );
            });
        };

        it('should return a basic Service_Core config', () => {
            const item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    '0.0.0.0',
                    '1.1.1.1',
                    '123.123.123.123%222',
                    '123.32.0.0/12',
                    '20.20.20.0%50/24',
                    '::%25',
                    '2001:0db8:85a3:0000:0000:8a2e:0370:7334/128',
                    '2001:0db8:85a3:0000:0000:0000:0000:0000/64'
                ],
                virtualPort: 123,
                persistenceMethods: ['cookie'],
                profileHTTP: { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                virtualType: 'standard',
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                nat64Enabled: false,
                profiles: [
                    { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ]
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '0.0.0.0',
                                '1.1.1.1',
                                '123.123.123.123%222',
                                '123.32.0.0/12',
                                '20.20.20.0%50/24',
                                '::%25',
                                '2001:0db8:85a3:0000:0000:8a2e:0370:7334/128',
                                '2001:0db8:85a3:0000:0000:0000:0000:0000/64'
                            ],
                            virtualPort: 123
                        }
                    }
                }
            };
            const expected = [
                {
                    path: '/tenantId/Service_Address-any',
                    properties: { address: 'any', mask: 'any' }
                },
                {
                    path: '/tenantId/appId/itemId',
                    properties: {
                        destination: '/tenantId/any:123',
                        source: '0.0.0.0/0',
                        mask: 'any'
                    }
                },
                {
                    path: '/tenantId/Service_Address-1.1.1.1',
                    properties: { address: '1.1.1.1', mask: '255.255.255.255' }
                },
                {
                    path: '/tenantId/appId/itemId-1-',
                    properties: {
                        destination: '/tenantId/1.1.1.1:123',
                        source: '0.0.0.0/0',
                        mask: '255.255.255.255'
                    }
                },
                {
                    path: '/tenantId/Service_Address-123.123.123.123%222',
                    properties: { address: '123.123.123.123%222', mask: '255.255.255.255' }
                },
                {
                    path: '/tenantId/appId/itemId-2-',
                    properties: {
                        destination: '/tenantId/123.123.123.123%222:123',
                        source: '0.0.0.0%222/0',
                        mask: '255.255.255.255'
                    }
                },
                {
                    path: '/tenantId/Service_Address-123.32.0.0',
                    properties: { address: '123.32.0.0', mask: '255.240.0.0' }
                },
                {
                    path: '/tenantId/appId/itemId-3-',
                    properties: {
                        destination: '/tenantId/123.32.0.0:123',
                        source: '0.0.0.0/0',
                        mask: '255.240.0.0'
                    }
                },
                {
                    path: '/tenantId/Service_Address-20.20.20.0%50',
                    properties: { address: '20.20.20.0%50', mask: '255.255.255.0' }
                },
                {
                    path: '/tenantId/appId/itemId-4-',
                    properties: {
                        destination: '/tenantId/20.20.20.0%50:123',
                        source: '0.0.0.0%50/0',
                        mask: '255.255.255.0'
                    }
                },
                {
                    path: '/tenantId/Service_Address-any6%25',
                    properties: { address: 'any6%25', mask: 'any6' }
                },
                {
                    path: '/tenantId/appId/itemId-5-',
                    properties: { destination: '/tenantId/any6%25.123', source: '::%25/0', mask: 'any6' }
                },
                {
                    path: '/tenantId/Service_Address-2001:db8:85a3::8a2e:370:7334',
                    properties: {
                        address: '2001:db8:85a3::8a2e:370:7334',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-6-',
                    properties: {
                        destination: '/tenantId/2001:db8:85a3::8a2e:370:7334.123',
                        source: '::/0',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
                    }
                },
                {
                    path: '/tenantId/Service_Address-2001:db8:85a3::',
                    properties: {
                        address: '2001:db8:85a3::',
                        mask: 'ffff:ffff:ffff:ffff::'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-7-',
                    properties: {
                        destination: '/tenantId/2001:db8:85a3::.123',
                        source: '::/0',
                        mask: 'ffff:ffff:ffff:ffff::'
                    }
                }
            ];
            const result = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assertServiceCore(result, expected);
        });

        it('should test when virtualAddresses are sent in as an array', () => {
            const item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    ['123.28.0.0%222/14', '123.40.0.0%222/14'],
                    ['1.1.0.0%0/20', '1.1.1.0/24'],
                    [
                        '2001:0db8:85a3:0000:0000:8a2e:0370:7300/120',
                        '2001:0db8:85a3:0000:0000:8a2e:0370:7400/120'
                    ],
                    ['::%222', '::%222'],
                    ['0.0.0.0', '0.0.0.0']
                ],
                virtualPort: 123,
                persistenceMethods: ['cookie'],
                profileHTTP: { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                virtualType: 'standard',
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                nat64Enabled: false,
                profiles: [
                    { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ]
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                [
                                    '123.28.0.0%222/14',
                                    '123.40.0.0%222/14'
                                ],
                                [
                                    '1.1.0.0%0/20',
                                    '1.1.1.0/24'
                                ],
                                [
                                    '2001:0db8:85a3:0000:0000:8a2e:0370:7300/120',
                                    '2001:0db8:85a3:0000:0000:8a2e:0370:7400/120'
                                ],
                                [
                                    '::%222',
                                    '::%222'
                                ],
                                [
                                    '0.0.0.0',
                                    '0.0.0.0'
                                ]
                            ],
                            virtualPort: 123
                        }
                    }
                }
            };
            const expected = [
                {
                    path: '/tenantId/Service_Address-123.28.0.0%222',
                    properties: { address: '123.28.0.0%222', mask: '255.252.0.0' }
                },
                {
                    path: '/tenantId/appId/itemId',
                    properties: {
                        destination: '/tenantId/123.28.0.0%222:123',
                        source: '123.40.0.0%222/14',
                        mask: '255.252.0.0'
                    }
                },
                {
                    path: '/tenantId/Service_Address-1.1.0.0',
                    properties: { address: '1.1.0.0', mask: '255.255.240.0' }
                },
                {
                    path: '/tenantId/appId/itemId-1-',
                    properties: {
                        destination: '/tenantId/1.1.0.0:123',
                        source: '1.1.1.0/24',
                        mask: '255.255.240.0'
                    }
                },
                {
                    path: '/tenantId/Service_Address-2001:db8:85a3::8a2e:370:7300',
                    properties: {
                        address: '2001:db8:85a3::8a2e:370:7300',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ff00'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-2-',
                    properties: {
                        destination: '/tenantId/2001:db8:85a3::8a2e:370:7300.123',
                        source: '2001:db8:85a3::8a2e:370:7400/120',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ff00'
                    }
                },
                {
                    path: '/tenantId/Service_Address-any6%222',
                    properties: { address: 'any6%222', mask: 'any6' }
                },
                {
                    path: '/tenantId/appId/itemId-3-',
                    properties: {
                        destination: '/tenantId/any6%222.123',
                        source: '::%222',
                        mask: 'any6'
                    }
                },
                {
                    path: '/tenantId/Service_Address-any',
                    properties: { address: 'any', mask: 'any' }
                },
                {
                    path: '/tenantId/appId/itemId-4-',
                    properties: {
                        destination: '/tenantId/any:123',
                        source: '0.0.0.0',
                        mask: 'any'
                    }
                }
            ];
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assertServiceCore(results, expected);
        });

        it('should test when virtualAddresses are sent in as a bigip ref', () => {
            defaultContext.tasks[0].metadata = {
                tenantId: {
                    appId: {
                        itemId: {
                            virtualAddresses: [
                                {
                                    address: '1.2.3.0',
                                    mask: '255.255.255.0'
                                },
                                [{
                                    address: '9.8.0.0',
                                    mask: '255.255.0.0'
                                }],
                                {
                                    address: '123.123.123.123%23',
                                    mask: '255.255.255.255'
                                }
                            ]
                        }
                    }
                }
            };

            defaultContext.host.parser = {
                virtualAddressList: [
                    {
                        fullPath: '/Common/wildcard_v4_rtd0',
                        partition: 'Common',
                        address: 'any',
                        metadata: []
                    },
                    {
                        fullPath: '/Common/wildcard_v4_rtd2',
                        partition: 'Common',
                        address: 'any%2',
                        metadata: []
                    }
                ]
            };

            const item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    { bigip: '/Common/1.2.3.0' },
                    [
                        { bigip: '/Common/9.8.0.0' },
                        '5.5.0.0/16'
                    ],
                    { bigip: '/Common/123.123.123.123%23' },
                    [
                        { bigip: '/Common/wildcard_v4_rtd0' },
                        '0.0.0.0/0'
                    ],
                    [
                        { bigip: '/Common/wildcard_v4_rtd2' },
                        '0.0.0.0%2/0'
                    ]
                ],
                virtualPort: 123,
                persistenceMethods: ['cookie'],
                profileHTTP: { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                virtualType: 'standard',
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                nat64Enabled: false,
                profiles: [
                    { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ]
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                {
                                    bigip: '/Common/1.2.3.0'
                                },
                                [
                                    {
                                        bigip: '/Common/9.8.0.0'
                                    },
                                    '5.5.0.0/16'
                                ],
                                {
                                    bigip: '/Common/123.123.123.123%23'
                                },
                                [
                                    {
                                        bigip: '/Common/wildcard_v4_rtd0'
                                    },
                                    '0.0.0.0/0'
                                ],
                                [
                                    {
                                        bigip: '/Common/wildcard_v4_rtd2'
                                    },
                                    '0.0.0.0%2/0'
                                ]
                            ],
                            virtualPort: 123
                        }
                    }
                }
            };
            const expected = [
                {
                    path: '/tenantId/appId/itemId',
                    properties: {
                        destination: '/Common/1.2.3.0:123',
                        source: '0.0.0.0/0',
                        mask: '255.255.255.0'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-1-',
                    properties: {
                        destination: '/Common/9.8.0.0:123',
                        source: '5.5.0.0/16',
                        mask: '255.255.0.0'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-2-',
                    properties: {
                        destination: '/Common/123.123.123.123%23:123',
                        source: '0.0.0.0%23/0',
                        mask: '255.255.255.255'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-3-',
                    properties: {
                        destination: '/Common/any:123',
                        source: '0.0.0.0/0',
                        mask: 'any'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-4-',
                    properties: {
                        destination: '/Common/any%2:123',
                        source: '0.0.0.0%2/0',
                        mask: '255.255.255.255'
                    }
                }
            ];
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assertServiceCore(results, expected);
        });

        it('should test when virtualAddresses are sent in as a use ref', () => {
            const item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    { use: '/Common/Shared/testAddr' },
                    { use: '/Common/Shared/testAddrIpv6' },
                    { use: '/Common/Shared/testRouteAddr' },
                    { use: '/Common/Shared/testRouteAddrIpv6' },
                    { use: '/Common/Shared/testAddr0000' },
                    { use: '/Common/Shared/testAddr0000Ipv6' },
                    { use: '/Common/Shared/testRouteAddr0000' },
                    { use: '/Common/Shared/testRouteAddr0000Ipv6' }
                ],
                virtualPort: 123,
                persistenceMethods: ['cookie'],
                profileHTTP: { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                virtualType: 'standard',
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                nat64Enabled: false,
                profiles: [
                    { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ]
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                { use: '/Common/Shared/testAddr' },
                                { use: '/Common/Shared/testAddrIpv6' },
                                { use: '/Common/Shared/testRouteAddr' },
                                { use: '/Common/Shared/testRouteAddrIpv6' },
                                { use: '/Common/Shared/testAddr0000' },
                                { use: '/Common/Shared/testAddr0000Ipv6' },
                                { use: '/Common/Shared/testRouteAddr0000' },
                                { use: '/Common/Shared/testRouteAddr0000Ipv6' }
                            ],
                            virtualPort: 123
                        }
                    }
                },
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        testAddr: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123%0',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testAddrIpv6: {
                            class: 'Service_Address',
                            virtualAddress: 'f5f5::f5f5%0',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testRouteAddr: {
                            class: 'Service_Address',
                            virtualAddress: '1.1.1.0%22/25',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testRouteAddrIpv6: {
                            class: 'Service_Address',
                            virtualAddress: 'f5f5::%22/25',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testAddr0000: {
                            class: 'Service_Address',
                            virtualAddress: '0.0.0.0',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testAddr0000Ipv6: {
                            class: 'Service_Address',
                            virtualAddress: '::',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testRouteAddr0000: {
                            class: 'Service_Address',
                            virtualAddress: '0.0.0.0%100',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testRouteAddr0000Ipv6: {
                            class: 'Service_Address',
                            virtualAddress: '::%100',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        }
                    }
                }
            };
            const expected = [
                {
                    path: '/tenantId/appId/itemId',
                    properties: {
                        destination: '/Common/Shared/testAddr:123',
                        source: '0.0.0.0/0',
                        mask: '255.255.255.255'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-1-',
                    properties: {
                        destination: '/Common/Shared/testAddrIpv6:123',
                        source: '::/0',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-2-',
                    properties: {
                        destination: '/tenantId/1.1.1.0%22:123',
                        source: '0.0.0.0%22/0',
                        mask: '255.255.255.128'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-3-',
                    properties: {
                        destination: '/tenantId/f5f5::%22.123',
                        source: '::%22/0',
                        mask: 'ffff:ff80::'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-4-',
                    properties: {
                        destination: '/Common/Shared/testAddr0000:123',
                        source: '0.0.0.0/0',
                        mask: 'any'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-5-',
                    properties: {
                        destination: '/Common/Shared/testAddr0000Ipv6:123',
                        source: '::/0',
                        mask: 'any6'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-6-',
                    properties: {
                        destination: '/tenantId/any%100:123',
                        source: '0.0.0.0%100/0',
                        mask: 'any'
                    }
                },
                {
                    path: '/tenantId/appId/itemId-7-',
                    properties: {
                        destination: '/tenantId/any6%100.123',
                        source: '::%100/0',
                        mask: 'any6'
                    }
                }
            ];
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assertServiceCore(results, expected);
        });

        it('should test when virtualAddresses have a ref (dest) and source', () => {
            const item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    [
                        { use: '/Common/Shared/testAddr' },
                        '1.2.3.4/32'
                    ]
                ],
                virtualPort: 123,
                persistenceMethods: ['cookie'],
                profileHTTP: { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                virtualType: 'standard',
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                nat64Enabled: false,
                profiles: [
                    { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ]
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                [
                                    {
                                        use: '/Common/Shared/testAddr'
                                    },
                                    '1.2.3.4/32'
                                ]
                            ],
                            virtualPort: 123
                        }
                    }
                },
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        testAddr: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123%0',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        }
                    }
                }
            };
            const expected = [{
                path: '/tenantId/appId/itemId',
                properties: {
                    destination: '/Common/Shared/testAddr:123',
                    source: '1.2.3.4/32',
                    mask: '255.255.255.255'
                }
            }];
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assertServiceCore(results, expected);
        });

        it('should test that a snatpool is created when snat is set to self', () => {
            const item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    { use: '/Common/Shared/testAddr' },
                    { use: '/Common/Shared/testRouteAddr' }
                ],
                virtualPort: 123,
                snat: 'self',
                persistenceMethods: ['cookie'],
                profileHTTP: { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                virtualType: 'standard',
                layer4: 'tcp',
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                serviceDownImmediateAction: 'none',
                shareAddresses: false,
                enable: true,
                maxConnections: 0,
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                nat64Enabled: false,
                profiles: [
                    { bigip: '/Common/http', name: '/Common/http', context: 'all' },
                    {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                ]
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.11.0',
                id: 'Service_Address',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug'
                },
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                {
                                    use: '/Common/Shared/testAddr'
                                },
                                {
                                    use: '/Common/Shared/testRouteAddr'
                                }
                            ],
                            virtualPort: 123,
                            snat: 'self'
                        }
                    }
                },
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        testAddr: {
                            class: 'Service_Address',
                            virtualAddress: '123.123.123.123',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        },
                        testRouteAddr: {
                            class: 'Service_Address',
                            virtualAddress: '1.1.1.1%22',
                            arpEnabled: false,
                            icmpEcho: 'disable',
                            routeAdvertisement: 'enable',
                            spanningEnabled: true,
                            trafficGroup: '/Common/traffic-group-local-only'
                        }
                    }
                }
            };
            const expected = [
                {
                    path: '/tenantId/appId/itemId-self',
                    properties: {
                        members: {
                            '/tenantId/appId/123.123.123.123': {}
                        }
                    }
                },
                {
                    path: '/tenantId/appId/itemId',
                    properties: {
                        destination: '/Common/Shared/testAddr:123',
                        source: '0.0.0.0/0',
                        mask: '255.255.255.255',
                        'source-address-translation': {
                            type: 'snat',
                            pool: '/tenantId/appId/itemId-self'
                        }
                    }
                },
                {
                    path: '/tenantId/appId/itemId-1--self',
                    properties: {
                        members: {
                            '/tenantId/appId/1.1.1.1%22': {}
                        }
                    }
                },
                {
                    path: '/tenantId/appId/itemId-1-',
                    properties: {
                        destination: '/tenantId/1.1.1.1%22:123',
                        source: '0.0.0.0%22/0',
                        mask: '255.255.255.255',
                        'source-address-translation': {
                            type: 'snat',
                            pool: '/tenantId/appId/itemId-1--self'
                        }
                    }
                }
            ];
            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assertServiceCore(results, expected);
        });
    });

    describe('Service_Core client/server tls', () => {
        let item;
        let declaration;

        const clientSideContext = {
            context: 'clientside'
        };
        const serverSideContext = {
            context: 'serverside'
        };
        const allContext = {
            context: 'all'
        };

        beforeEach(() => {
            item = {
                class: 'Service_TCP',
                remark: 'description',
                virtualAddresses: ['1.1.1.10'],
                enable: true
            };
            declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            remark: 'description',
                            virtualAddresses: [
                                '1.1.1.10'
                            ]
                        }
                    }
                }
            };
        });

        it('should handle clientTLS and serverTLS containing ldapStartTLS', () => {
            item.clientTLS = '/Common/Shared/clientTLS';
            item.serverTLS = '/Common/Shared/serverTLS';
            declaration.tenantId.appId.itemId.clientTLS = '/Common/Shared/clientTLS';
            declaration.tenantId.appId.itemId.serverTLS = '/Common/Shared/serverTLS';
            declaration.Common = {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    clientTLS: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'tls_client_cert'
                            }
                        ],
                        ldapStartTLS: 'allow'
                    },
                    serverTLS: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'tls_server_cert'
                            }
                        ],
                        ldapStartTLS: 'require'
                    },
                    tls_client_cert: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    tls_server_cert: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    }
                }
            };

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/f5_appsvcs_clientside_require'], clientSideContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/serverTLS'], clientSideContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/f5_appsvcs_serverside_allow'], serverSideContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/clientTLS'], serverSideContext);
        });

        it('should handle serverTLS containing smtpsStartTLS', () => {
            item.serverTLS = '/Common/Shared/serverTLS';
            declaration.tenantId.appId.itemId.serverTLS = '/Common/Shared/serverTLS';
            declaration.Common = {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    serverTLS: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'tls_server_cert'
                            }
                        ],
                        smtpsStartTLS: 'none'
                    },
                    tls_server_cert: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    }
                }
            };

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/f5_appsvcs_smtps_none'], allContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/serverTLS'], clientSideContext);
        });

        it('should handle serverTLS pointing to existing profile', () => {
            item.serverTLS = {
                bigip: '/Common/clientssl'
            };
            declaration.tenantId.appId.itemId.serverTLS = {
                bigip: '/Common/clientssl'
            };

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/clientssl'], clientSideContext);
        });

        it('should handle serverTLS pointing to multiple existing profiles', () => {
            item.serverTLS = [
                {
                    bigip: '/Common/clientssl1'
                },
                {
                    bigip: '/Common/clientssl2'
                }
            ];
            declaration.tenantId.appId.itemId.serverTLS = [
                {
                    bigip: '/Common/clientssl1'
                },
                {
                    bigip: '/Common/clientssl2'
                }
            ];

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/clientssl1'], clientSideContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/clientssl2'], clientSideContext);
        });

        it('should handle clientTLS pointing to existing profile', () => {
            item.clientTLS = {
                bigip: '/Common/serverssl'
            };
            declaration.tenantId.appId.itemId.clientTLS = {
                bigip: '/Common/serverssl'
            };

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/serverssl'], serverSideContext);
        });

        it('should handle clientTLS pointing to multiple existing profiles', () => {
            item.clientTLS = [
                {
                    bigip: '/Common/serverssl1'
                },
                {
                    bigip: '/Common/serverssl2'
                }
            ];
            declaration.tenantId.appId.itemId.clientTLS = [
                {
                    bigip: '/Common/serverssl1'
                },
                {
                    bigip: '/Common/serverssl2'
                }
            ];

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/serverssl1'], serverSideContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/serverssl2'], serverSideContext);
        });

        it('should fail if clientTLS is not a full path', () => {
            // Normally clientTLS gets expanded to an absolute path by the time it reaches map_as3.
            // The scenario here can happen when the user specifies clientTLS on a Service that does not support it
            item.clientTLS = 'serverssl';
            declaration.tenantId.appId.itemId.clientTLS = 'serverssl';

            assert.throws(() => translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration),
                'Expected \'serverssl\' to be an absolute path.  This may have happened because clientTLS was applied to a Service that does not support it.');
        });

        it('should handle serverTLS with certificate naming scheme', () => {
            item.serverTLS = '/Common/Shared/serverTLS';
            declaration.tenantId.appId.itemId.serverTLS = '/Common/Shared/serverTLS';
            declaration.Common = {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    serverTLS: {
                        class: 'TLS_Server',
                        namingScheme: 'certificate',
                        certificates: [
                            {
                                certificate: 'webcert1'
                            },
                            {
                                certificate: 'webcert2'
                            }]
                    },
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    webcert2: {
                        class: 'Certificate',
                        certificate: 'another cert value'
                    }
                }
            };

            const results = translate.Service_Core(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/webcert1'], clientSideContext);
            assert.deepEqual(results.configs[1].properties.profiles['/Common/Shared/webcert2'], clientSideContext);
        });
    });

    describe('Service_HTTP', () => {
        let item;
        let declaration;

        beforeEach(() => {
            item = {
                class: 'Service_HTTP',
                virtualAddresses: [
                    '10.192.75.27'
                ],
                virtualPort: 80,
                enable: true,
                profiles: [
                    {
                        bigip: '/Common/http',
                        name: '/Common/http',
                        context: 'all'
                    }
                ]
            };

            declaration = {
                class: 'ADC',
                id: 'testid',
                schemaVersion: '3.0.0',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['10.192.75.27'],
                            virtualPort: 80,
                            profileRequestAdapt: {
                                bigip: '/Common/requestadapt',
                                name: '/Common/requestadapt',
                                context: 'clientside'
                            }
                        },
                        accessProfile: {
                            class: 'Access_Profile',
                            ssloCreated: false
                        },
                        enable: true
                    }
                }
            };
        });

        it('should add per request access policy with use ref', () => {
            item.profileAccess = {
                use: '/tenantId/appId/accessProfile'
            };
            declaration.tenantId.appId.accessProfile = {
                ssloCreated: false
            };
            item.policyPerRequestAccess = {
                use: '/tenantId/appId/perRequestPolicy'
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.strictEqual(results.configs[1].properties['per-flow-request-access-policy'], '/tenantId/perRequestPolicy');
        });

        it('should add adapt profiles when requested', () => {
            item.profileRequestAdapt = {
                bigip: '/Common/requestadapt',
                name: '/Common/requestadapt',
                context: 'clientside'
            };
            item.profileResponseAdapt = {
                bigip: '/Common/responseadapt',
                name: '/Common/responseadapt',
                context: 'serverside'
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.strictEqual(results.configs[1].properties.profiles['/Common/requestadapt'].context, 'clientside');
            assert.strictEqual(results.configs[1].properties.profiles['/Common/responseadapt'].context, 'serverside');
        });

        it('should add VDI, connectivity, and access profiles to service', () => {
            item.profileAccess = {
                bigip: '/Common/access'
            };
            item.profileConnectivity = {
                bigip: '/Common/connectivityProfile'
            };
            item.profileVdi = {
                bigip: '/Common/vdi'
            };

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/access'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/connectivityProfile'], { context: 'clientside' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/vdi'], { context: 'all' });
        });

        it('should add rba and websso profiles with non-sslo bigip-ref', (() => {
            item.profileAccess = {
                bigip: '/Common/access'
            };

            defaultContext.host = {
                parser: {
                    accessProfileList: [
                        {
                            fullPath: '/Common/access',
                            type: 'all'
                        }
                    ]
                }
            };

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/access'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/rba'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/websso'], { context: 'all' });
        }));

        it('should not add rba profile with sslo', (() => {
            item.profileAccess = {
                bigip: '/Common/access'
            };

            defaultContext.host = {
                parser: {
                    accessProfileList: [
                        {
                            fullPath: '/Common/access',
                            type: 'ssl-orchestrator'
                        }
                    ]
                }
            };

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/access'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/rba'], undefined);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/websso'], undefined);
        }));

        it('should add rba and websso profiles with non-sslo use-ref', (() => {
            item.profileAccess = {
                use: '/tenantId/appId/accessProfile'
            };
            declaration.tenantId.appId.accessProfile = {
                ssloCreated: false
            };

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/tenantId/accessProfile'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/rba'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/websso'], { context: 'all' });
        }));

        it('should not add rba and websso profiles with sslo use-ref', (() => {
            item.profileAccess = {
                use: '/tenantId/appId/accessProfile'
            };
            declaration.tenantId.appId.accessProfile = {
                ssloCreated: true
            };

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/tenantId/accessProfile'], { context: 'all' });
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/rba'], undefined);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/websso'], undefined);
        }));

        it('should add API protection profile with bigip ref', () => {
            item.profileApiProtection = {
                bigip: '/Common/apiProtectionProfile'
            };

            defaultContext.target.tmosVersion = '14.1';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/apiProtectionProfile'], { context: 'all' });
        });

        it('should not add API protection profile when BIG-IP version is less than 14.1', () => {
            item.profileApiProtection = {
                bigip: '/Common/apiProtectionProfile'
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepStrictEqual(results.configs[1].properties.profiles['/Common/apiProtectionProfile'], undefined);
        });

        beforeEach(() => {
            item = {
                class: 'Service_HTTP',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                persistenceMethods: ['source-address'],
                enable: true,
                adminState: 'enable'
            };
            declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_HTTP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        item: {
                            class: 'Service_HTTP',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            adminState: 'enable'
                        },
                        dosProfile: {
                            class: 'DOS_Profile',
                            application: {
                                scrubbingDuration: 42,
                                remoteTriggeredBlackHoleDuration: 10,
                                mobileDefense: {
                                    enabled: true,
                                    allowAndroidPublishers: [{
                                        bigip: '/Common/default.crt'
                                    }],
                                    allowAndroidRootedDevice: true,
                                    allowIosPackageNames: [
                                        'theName'
                                    ],
                                    allowJailbrokenDevices: true,
                                    allowEmulators: true,
                                    clientSideChallengeMode: 'challenge'
                                }
                            }
                        }
                    }
                }
            };
        });

        it('should check bot-defense profile is not added to profiles in 13.1', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/Common/http': { context: 'all' },
                '/tenantId/appId/dosProfile': { context: 'all' }
            };
            item.profileDOS = { use: '/tenantId/appId/dosProfile' };
            declaration.tenantId.appId.item.profileDOS = { use: 'dosProfile' };
            defaultContext.target.tmosVersion = '13.1';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles, expectedProfiles);
        });

        it('should check profileDOS adds botDefense in 14.1 when ASM is provisioned', () => {
            sinon.stub(util, 'isOneOfProvisioned').returns(true);
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/tenantId/appId/f5_appsvcs_dosProfile_botDefense': { context: 'all' },
                '/tenantId/appId/dosProfile': { context: 'all' },
                '/Common/http': { context: 'all' }
            };
            item.profileDOS = { use: '/tenantId/appId/dosProfile' };
            declaration.tenantId.appId.item.profileDOS = { use: '/tenantId/appId/dosProfile' };
            defaultContext.target.tmosVersion = '14.1';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles, expectedProfiles);
        });

        it('should check profileDOS does not add botDefense in 14.1 when ASM is provisioned and profileBotDefense specified', () => {
            sinon.stub(util, 'isOneOfProvisioned').returns(true);
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/tenantId/appId/dosProfile': { context: 'all' },
                '/Common/bot-defense': { context: 'all' },
                '/Common/http': { context: 'all' }
            };
            item.profileDOS = { use: '/tenantId/appId/dosProfile' };
            item.profileBotDefense = { bigip: '/Common/bot-defense' };
            declaration.tenantId.appId.item.profileDOS = { use: '/tenantId/appId/dosProfile' };
            declaration.tenantId.appId.item.profileBotDefense = { use: '/tenantId/appId/bot-defense' };
            defaultContext.target.tmosVersion = '14.1';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles, expectedProfiles);
        });

        it('should not add a botDefense profile for profileDOS in 14.1 when ASM is not provisioned', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/tenantId/appId/profileDOS': { context: 'all' },
                '/Common/http': { context: 'all' }
            };
            item.profileDOS = { use: '/tenantId/appId/profileDOS' };
            declaration.tenantId.appId.item.profileDOS = { use: '/tenantId/appId/dosProfile' };
            defaultContext.target.tmosVersion = '14.1';

            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles, expectedProfiles);
        });

        it('should check that html profile was added', () => {
            item = {
                class: 'Service_HTTP',
                virtualPort: 80,
                virtualAddresses: ['1.1.1.10'],
                profileHTML: { bigip: '/Common/html' },
                profileTCP: {
                    bigip: '/Common/f5-tcp-progressive',
                    name: '/Common/f5-tcp-progressive',
                    context: 'all'
                },
                enable: true
            };
            declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_HTTP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        item: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            profileHTML: { bigip: '/Common/html' }
                        }
                    }
                }
            };
            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(results.configs[1].properties.profiles,
                {
                    '/Common/f5-tcp-progressive': { context: 'all' },
                    '/Common/html': { context: 'all' },
                    '/Common/http': { context: 'all' }
                });
        });

        it('should handle adminState', () => {
            const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.strictEqual(results.configs[1].properties.enabled, true);
        });

        describe('websocket profile', () => {
            beforeEach(() => {
                item = {
                    class: 'Service_HTTP',
                    virtualAddresses: [
                        '1.2.3.4'
                    ],
                    virtualPort: 80,
                    enable: true,
                    profileHTTP: {
                        use: '/tenantId/appId/myHTTP',
                        name: '/tenantId/appId/myHTTP',
                        context: 'all'
                    },
                    profileTCP: {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                };
                declaration = {
                    class: 'ADC',
                    id: 'testid',
                    schemaVersion: '3.0.0'
                };
            });

            it('should attach using new method', () => {
                item.profileHTTP = {
                    use: '/tenantId/appId/myHTTP'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/tenantId/appId/myHTTP'
                            }
                        },
                        myHTTP: {
                            class: 'HTTP_Profile',
                            profileWebSocket: {
                                use: '/tenantId/appId/myWebSocket'
                            }
                        },
                        enable: true
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/tenantId/appId/myHTTP': { context: 'all' },
                        '/tenantId/appId/myWebSocket': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });

            it('should attach using only new method when both methods specified', () => {
                item.profileHTTP = {
                    use: '/tenantId/appId/myHTTP'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/tenantId/appId/myHTTP'
                            }
                        },
                        myHTTP: {
                            class: 'HTTP_Profile',
                            webSocketsEnabled: true,
                            webSocketMasking: 'unmask',
                            profileWebSocket: {
                                bigip: '/tenantId/appId/myWebSocket'
                            }
                        },
                        enable: true
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/tenantId/appId/myHTTP': { context: 'all' },
                        '/tenantId/appId/myWebSocket': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });

            it('should attach when http profile is in Tenant Application using deprecated method', () => {
                item.profileHTTP = {
                    use: '/tenantId/appId/myHTTP'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/tenantId/appId/myHTTP'
                            }
                        },
                        myHTTP: {
                            class: 'HTTP_Profile',
                            webSocketsEnabled: true,
                            webSocketMasking: 'unmask'
                        },
                        enable: true
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/tenantId/appId/myHTTP': { context: 'all' },
                        '/tenantId/appId/f5_appsvcs_unmask': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });

            it('should attach when http profile is in Tenant Shared using deprecated method', () => {
                item.profileHTTP = {
                    use: '/tenantId/Shared/myHTTP'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/tenantId/Shared/myHTTP'
                            }
                        },
                        enable: true
                    },
                    Shared: {
                        class: 'Application',
                        myHTTP: {
                            class: 'HTTP_Profile',
                            webSocketsEnabled: true,
                            webSocketMasking: 'unmask'
                        },
                        enable: true
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/tenantId/Shared/myHTTP': { context: 'all' },
                        '/tenantId/Shared/f5_appsvcs_unmask': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });

            it('should attach when http profile is in Common Shared using deprecated method', () => {
                item.profileHTTP = {
                    use: '/Common/Shared/myHTTP'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/Common/Shared/myHTTP'
                            }
                        },
                        enable: true
                    }
                };
                declaration.Common = {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        myHTTP: {
                            class: 'HTTP_Profile',
                            webSocketsEnabled: true,
                            webSocketMasking: 'unmask'
                        },
                        enable: true
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/Common/Shared/myHTTP': { context: 'all' },
                        '/Common/Shared/f5_appsvcs_unmask': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });
        });

        describe('HTTP Proxy Connect Profile', () => {
            beforeEach(() => {
                item = {
                    class: 'Service_HTTP',
                    virtualAddresses: [
                        '1.2.3.4'
                    ],
                    virtualPort: 80,
                    enable: true,
                    profileTCP: {
                        bigip: '/Common/f5-tcp-progressive',
                        name: '/Common/f5-tcp-progressive',
                        context: 'all'
                    }
                };
                declaration = {
                    class: 'ADC',
                    id: 'testid',
                    schemaVersion: '3.0.0'
                };
            });

            it('should attach when http profile is in Tenant Application', () => {
                item.profileHTTP = {
                    use: '/tenantId/appId/httpProfile'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/tenantId/appId/httpProfile'
                            }
                        },
                        httpProfile: {
                            class: 'HTTP_Profile',
                            proxyConnectEnabled: true
                        }
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/tenantId/appId/httpProfile': { context: 'all' },
                        '/tenantId/appId/f5_appsvcs_httpProfile_proxyConnect': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });

            it('should attach when http profile is in Common Shared', () => {
                item.profileHTTP = {
                    use: '/Common/Shared/httpProfile'
                };
                declaration.tenantId = {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_HTTP',
                            virtualAddresses: ['1.2.3.4'],
                            virtualPort: 80,
                            profileHTTP: {
                                use: '/Common/Shared/httpProfile'
                            }
                        }
                    }
                };
                declaration.Common = {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        httpProfile: {
                            class: 'HTTP_Profile',
                            proxyConnectEnabled: true
                        }
                    }
                };
                const results = translate.Service_HTTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.deepStrictEqual(results.configs[1].properties.profiles,
                    {
                        '/Common/Shared/httpProfile': { context: 'all' },
                        '/Common/Shared/f5_appsvcs_httpProfile_proxyConnect': { context: 'all' },
                        '/Common/f5-tcp-progressive': { context: 'all' }
                    });
            });
        });
    });

    describe('Statistics_Profile', () => {
        it('should map properly', () => {
            const item = {
                remark: 'This is a remark'
            };

            for (let i = 1; i < 33; i += 1) {
                item[`field${i}`] = `field ${i}`;
            }

            const config = translateClass('Statistics_Profile', item);

            assert.deepStrictEqual(config.properties, {
                description: '"This is a remark"',
                field1: '"field 1"',
                field2: '"field 2"',
                field3: '"field 3"',
                field4: '"field 4"',
                field5: '"field 5"',
                field6: '"field 6"',
                field7: '"field 7"',
                field8: '"field 8"',
                field9: '"field 9"',
                field10: '"field 10"',
                field11: '"field 11"',
                field12: '"field 12"',
                field13: '"field 13"',
                field14: '"field 14"',
                field15: '"field 15"',
                field16: '"field 16"',
                field17: '"field 17"',
                field18: '"field 18"',
                field19: '"field 19"',
                field20: '"field 20"',
                field21: '"field 21"',
                field22: '"field 22"',
                field23: '"field 23"',
                field24: '"field 24"',
                field25: '"field 25"',
                field26: '"field 26"',
                field27: '"field 27"',
                field28: '"field 28"',
                field29: '"field 29"',
                field30: '"field 30"',
                field31: '"field 31"',
                field32: '"field 32"'
            });
        });
    });

    describe('DNS_Logging_Profile', () => {
        it('should configure properly', () => {
            const item = {
                label: 'sample label',
                remark: 'sample remark',
                includeCompleteAnswer: false,
                includeQueryId: true,
                includeSource: false,
                includeTimestamp: false,
                includeView: false,
                logPublisher: { use: 'somePublisher' },
                logQueriesEnabled: false,
                logResponsesEnabled: true
            };

            const config = translateClass('DNS_Logging_Profile', item);
            assert.strictEqual(config.properties.description, '"sample remark"');
            assert.strictEqual(config.properties['enable-query-logging'], 'no');
            assert.strictEqual(config.properties['enable-response-logging'], 'yes');
            assert.strictEqual(config.properties['include-complete-answer'], 'no');
            assert.strictEqual(config.properties['include-query-id'], 'yes');
            assert.strictEqual(config.properties['include-source'], 'no');
            assert.strictEqual(config.properties['include-timestamp'], 'no');
            assert.strictEqual(config.properties['include-view'], 'no');
            assert.strictEqual(config.properties['log-publisher'], 'somePublisher');
        });
    });

    describe('Traffic_Log_Profile', () => {
        it('should escape properly', () => {
            defaultContext.target.tmosVersion = '14.1';

            /* eslint-disable no-template-curly-in-string */
            const item = {
                requestSettings: {
                    proxyResponse: 'myProxyResponse',
                    requestPool: 'myRequestPool',
                    requestErrorPool: 'myRequestErrorPool',
                    requestTemplate: 'my request ${template} {with} {curly} ${braces}',
                    requestErrorTemplate: 'my request error ${template} {with} {curly} ${braces}'
                },
                responseSettings: {
                    responsePool: 'myResponsePool',
                    responseErrorPool: 'myResponseErrorPool',
                    responseTemplate: 'my response ${template} {with} {curly} ${braces}',
                    responseErrorTemplate: 'my response error ${template} {with} {curly} ${braces}'
                }
            };
            const config = translateClass('Traffic_Log_Profile', item);
            assert.strictEqual(config.properties['proxy-response'], '"myProxyResponse"');
            assert.strictEqual(config.properties['request-log-pool'], 'myRequestPool');
            assert.strictEqual(config.properties['request-log-error-pool'], 'myRequestErrorPool');
            assert.strictEqual(config.properties['request-log-template'], '"my request \\$\\{template\\} \\{with\\} \\{curly\\} \\$\\{braces\\}"');
            assert.strictEqual(config.properties['request-log-error-template'], '"my request error \\$\\{template\\} \\{with\\} \\{curly\\} \\$\\{braces\\}"');

            assert.strictEqual(config.properties['response-log-pool'], 'myResponsePool');
            assert.strictEqual(config.properties['response-log-error-pool'], 'myResponseErrorPool');
            assert.strictEqual(config.properties['response-log-template'], '"my response \\$\\{template\\} \\{with\\} \\{curly\\} \\$\\{braces\\}"');
            assert.strictEqual(config.properties['response-log-error-template'], '"my response error \\$\\{template\\} \\{with\\} \\{curly\\} \\$\\{braces\\}"');
            /* eslint-enable no-template-curly-in-string */
        });
    });

    describe('TCP_Profile', () => {
        let item;

        beforeEach(() => {
            item = {
                class: 'TCP_Profile',
                mptcp: 'disable',
                nagle: 'auto'
            };
        });

        it('should set sync-cookie-whitelist disabled if synCookieAllowlist is false', () => {
            item.synCookieAllowlist = false;
            assert.deepStrictEqual(
                translate.TCP_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    command: 'ltm profile tcp',
                    properties: {
                        description: 'none',
                        mptcp: 'disabled',
                        nagle: 'auto',
                        'syn-cookie-whitelist': 'disabled',
                        'tcp-options': 'none'
                    }
                }
            );
        });

        it('should set sync-cookie-whitelist enabled if synCookieAllowlist is true', () => {
            item.synCookieAllowlist = true;
            assert.deepStrictEqual(
                translate.TCP_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    command: 'ltm profile tcp',
                    properties: {
                        description: 'none',
                        mptcp: 'disabled',
                        nagle: 'auto',
                        'syn-cookie-whitelist': 'enabled',
                        'tcp-options': 'none'
                    }
                }
            );
        });
    });

    describe('Idle_Timeout_Policy', () => {
        it('should create minimal policy', () => {
            const item = {};
            assert.deepStrictEqual(
                translate.Idle_Timeout_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'net timer-policy',
                    properties: {
                        rules: {}
                    },
                    ignore: []
                }
            );
        });
        it('should create an empty rule from just a name', () => {
            const item = {
                rules: [
                    {
                        name: 'rule1'
                    }
                ]
            };
            assert.deepStrictEqual(
                translate.Idle_Timeout_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'net timer-policy',
                    properties: {
                        rules: {
                            rule1: {
                                'destination-ports': {},
                                timers: {}
                            }
                        }
                    },
                    ignore: []
                }
            );
        });
        it('should create rule using all properties', () => {
            const item = {
                remark: 'rules',
                rules: [
                    {
                        name: 'rule1',
                        remark: 'rule 1',
                        protocol: 'tcp',
                        idleTimeout: 10,
                        destinationPorts: [80, 443, '900-930']
                    },
                    {
                        name: 'rule2',
                        remark: 'rule 2',
                        protocol: 'udp',
                        idleTimeout: 'indefinite',
                        destinationPorts: ['all-other']
                    }
                ]
            };
            assert.deepStrictEqual(
                translate.Idle_Timeout_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'net timer-policy',
                    properties: {
                        description: '"rules"',
                        rules: {
                            rule1: {
                                description: '"rule 1"',
                                'ip-protocol': 'tcp',
                                'destination-ports': {
                                    80: {},
                                    443: {},
                                    '900-930': {}
                                },
                                timers: {
                                    'flow-idle-timeout': {
                                        value: '10'
                                    }
                                }
                            },
                            rule2: {
                                description: '"rule 2"',
                                'ip-protocol': 'udp',
                                'destination-ports': {
                                    0: {}
                                },
                                timers: {
                                    'flow-idle-timeout': {
                                        value: 'indefinite'
                                    }
                                }
                            }
                        }
                    },
                    ignore: []
                }
            );
        });
    });

    describe('NAT_Policy', () => {
        it('should add defaults, translation source, and log-profile', () => {
            const item = {
                rules: [
                    {
                        name: 'theRule',
                        securityLogProfile: {
                            bigip: '/tenantId/appId/securityLogProfile'
                        },
                        sourceTranslation: {
                            use: '/tenantId/appId/sourceTrans'
                        }
                    }
                ]
            };

            assert.deepStrictEqual(
                translate.NAT_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'security nat policy',
                    properties: {
                        rules: {
                            theRule: {
                                source: {
                                    'address-lists': {},
                                    'port-lists': {}
                                },
                                destination: {
                                    'address-lists': {},
                                    'port-lists': {}
                                },
                                translation: {
                                    source: '/tenantId/appId/sourceTrans'
                                },
                                'log-profile': '/tenantId/appId/securityLogProfile'
                            }
                        }
                    },
                    ignore: []
                }
            );
        });
    });

    describe('NAT_Source_Translation', () => {
        it('should handle exclude addresses and handle exclude address lists', () => {
            const item = {
                excludeAddresses: ['3.4.5.6', { use: 'natSourceAddressList' }]
            };

            defaultContext.target.tmosVersion = '14.1';

            assert.deepStrictEqual(
                translate.NAT_Source_Translation(defaultContext, 'tenantId', 'appId', 'itemId', item).configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'security nat source-translation',
                    properties: {
                        addresses: {},
                        'egress-interfaces': {},
                        'egress-interfaces-disabled': ' ',
                        ports: {},
                        'exclude-address-lists': {
                            natSourceAddressList: {}
                        },
                        'exclude-addresses': {
                            '3.4.5.6': {}
                        }
                    },
                    ignore: []
                }
            );
        });
    });

    describe('Net_Address_List', () => {
        it('should succeed with Net Address Lists', () => {
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const item = {
                class: 'Net_Address_List',
                addresses: ['192.0.2.0/24'],
                addressLists: [
                    {
                        use: 'addList'
                    }
                ]
            };
            const results = translate.Net_Address_List(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'net address-list',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'address-lists': {
                            addList: {}
                        },
                        addresses: {
                            '192.0.2.0/24': {}
                        }
                    }
                }
            );
        });
    });

    describe('Service_TCP', () => {
        it('should check profileFTP Service_TCP properties', () => {
            const item = {
                class: 'Service_TCP',
                remark: 'description',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                profileFTP: { bigip: '/Common/ftp' },
                profilePPTP: { bigip: '/Common/pptp' },
                persistenceMethods: ['source-address'],
                layer4: 'tcp',
                profileTCP: 'normal',
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true,
                adminState: 'enable'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            remark: 'description',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            persistenceMethods: [
                                'source-address'
                            ],
                            profileFTP: {
                                bigip: '/Common/ftp'
                            },
                            profilePPTP: {
                                bigip: '/Common/pptp'
                            },
                            adminState: 'enable'
                        }
                    }
                }
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_TCP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(
                results,
                {
                    configs: [
                        {
                            path: '/tenantId/Service_Address-1.1.1.10',
                            command: 'ltm virtual-address',
                            properties: {
                                address: '1.1.1.10',
                                arp: 'enabled',
                                'icmp-echo': 'enabled',
                                mask: '255.255.255.255',
                                'route-advertisement': 'disabled',
                                spanning: 'disabled',
                                'traffic-group': 'default'
                            },
                            ignore: []
                        },
                        {
                            path: '/tenantId/appId/itemId',
                            command: 'ltm virtual',
                            properties: {
                                'address-status': 'yes',
                                'auto-lasthop': 'default',
                                'connection-limit': 0,
                                description: '"description"',
                                destination: '/tenantId/1.1.1.10:123',
                                enabled: true,
                                'ip-protocol': 'tcp',
                                'last-hop-pool': 'none',
                                mask: '255.255.255.255',
                                mirror: 'disabled',
                                persist: { '/Common/source_addr': { default: 'yes' } },
                                policies: {},
                                profiles: {
                                    '/Common/f5-tcp-progressive': { context: 'all' },
                                    '/Common/ftp': { context: 'all' },
                                    '/Common/pptp': { context: 'all' }
                                },
                                source: '0.0.0.0/0',
                                'source-address-translation': { type: 'automap' },
                                rules: {},
                                'security-log-profiles': {},
                                'source-port': 'preserve',
                                'translate-address': 'enabled',
                                'translate-port': 'enabled',
                                vlans: {},
                                'vlans-disabled': ' ',
                                metadata: {},
                                'clone-pools': {}
                            },
                            ignore: []
                        }
                    ]
                }
            );
        });

        it('should check profileSIP Service_TCP properties', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/Common/sip': { context: 'all' }
            };

            const item = {
                class: 'Service_TCP',
                remark: 'description',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                profileSIP: { bigip: '/Common/sip' },
                persistenceMethods: ['source-address'],
                layer4: 'tcp',
                profileTCP: 'normal',
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            remark: 'description',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            persistenceMethods: [
                                'source-address'
                            ],
                            profileSIP: {
                                bigip: '/Common/sip'
                            }
                        }
                    }
                }
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_TCP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[1].properties.profiles);
        });

        it('should check mqttEnabled Service_TCP property', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/Common/mqtt': { context: 'all' }
            };

            const item = {
                class: 'Service_TCP',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                persistenceMethods: ['source-address'],
                layer4: 'tcp',
                mqttEnabled: true,
                profileTCP: 'normal',
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            persistenceMethods: [
                                'source-address'
                            ]
                        }
                    }
                }
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_TCP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[1].properties.profiles);
        });

        it('should check profileiRulesLX Service_TCP properties', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/Common/ilx': { context: 'all' }
            };

            const item = {
                class: 'Service_TCP',
                remark: 'description',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                profileILX: { bigip: '/Common/ilx' },
                persistenceMethods: ['source-address'],
                layer4: 'tcp',
                profileTCP: 'normal',
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            remark: 'description',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            persistenceMethods: [
                                'source-address'
                            ],
                            profileILX: {
                                bigip: '/Common/ilx'
                            },
                            profileDOS: {
                                bigip: '/Common/dos'
                            }
                        }
                    }
                }
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_TCP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[1].properties.profiles);
        });

        it('should check profileICAP Service_TCP properties if internal', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' },
                '/Common/icap': { context: 'all' }
            };

            const item = {
                class: 'Service_TCP',
                remark: 'description',
                virtualType: 'internal',
                profileICAP: { bigip: '/Common/icap' },
                layer4: 'tcp',
                profileTCP: 'normal',
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            remark: 'description',
                            virtualType: 'internal',
                            profileICAP: {
                                bigip: '/Common/icap'
                            }
                        }
                    }
                }
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_TCP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[0].properties.profiles);
        });

        it('should not check profileICAP Service_TCP properties if not internal', () => {
            const expectedProfiles = {
                '/Common/f5-tcp-progressive': { context: 'all' }
            };

            const item = {
                class: 'Service_TCP',
                remark: 'description',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                profileICAP: { bigip: '/Common/icap' },
                layer4: 'tcp',
                profileTCP: 'normal',
                enable: true,
                maxConnections: 0,
                snat: 'auto',
                addressStatus: true,
                mirroring: 'none',
                lastHop: 'default',
                translateClientPort: false,
                translateServerAddress: true,
                translateServerPort: true
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_TCP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_TCP',
                            remark: 'description',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            profileICAP: {
                                bigip: '/Common/icap'
                            }
                        }
                    }
                }
            };

            defaultContext.target.tmosVersion = '13.0';

            const results = translate.Service_TCP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[1].properties.profiles);
        });
    });

    describe('Service_UDP', () => {
        describe('internal and stateless', () => {
            let item;
            let declaration;

            beforeEach(() => {
                item = {
                    class: 'Service_UDP',
                    virtualPort: 123,
                    virtualAddresses: ['192.0.2.10'],
                    enable: true
                };

                declaration = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'Service_UDP',
                    tenantId: {
                        class: 'Tenant',
                        appId: {
                            class: 'Application',
                            template: 'generic',
                            itemId: {
                                class: 'Service_UDP',
                                virtualPort: 123,
                                virtualAddresses: [
                                    '192.0.2.10'
                                ]
                            }
                        }
                    }
                };
            });

            it('should set internal and default destination and vlan properties when internal', () => {
                item.virtualType = 'internal';
                declaration.tenantId.appId.itemId.virtualType = 'internal';

                const results = translate.Service_UDP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.strictEqual(results.configs[0].path, '/tenantId/appId/itemId');
                assert.deepStrictEqual(results.configs[0].properties.internal, {});
                assert.strictEqual(results.configs[0].properties.destination, '0.0.0.0:any');
                assert.deepStrictEqual(results.configs[0].properties.vlans, {});
                assert.strictEqual(results.configs[0].properties['vlans-enabled'], ' ');
            });

            it('should set stateless and default vlan properties when stateless', () => {
                item.virtualType = 'stateless';
                declaration.tenantId.appId.itemId.virtualType = 'stateless';

                const results = translate.Service_UDP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
                assert.strictEqual(results.configs[1].path, '/tenantId/appId/itemId');
                assert.deepStrictEqual(results.configs[1].properties.stateless, {});
                assert.deepStrictEqual(results.configs[1].properties.vlans, {});
                assert.strictEqual(results.configs[1].properties['vlans-disabled'], ' ');
            });
        });

        it('should check profileSIP', () => {
            const expectedProfiles = {
                '/Common/udp': { context: 'all' },
                '/Common/sip': { context: 'all' }
            };

            const item = {
                class: 'Service_UDP',
                virtualPort: 123,
                virtualAddresses: ['192.0.2.10'],
                profileSIP: { bigip: '/Common/sip' },
                profileUDP: 'normal',
                enable: true
            };

            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_UDP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_UDP',
                            virtualPort: 123,
                            virtualAddresses: [
                                '192.0.2.10'
                            ],
                            profileSIP: {
                                bigip: '/Common/sip'
                            },
                            profileUDP: 'normal'
                        }
                    }
                }
            };

            const results = translate.Service_UDP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[1].properties.profiles);
        });
    });

    describe('Radius_Profile', () => {
        let item;

        beforeEach(() => {
            item = {
                class: 'Radius_Profile',
                parentProfile: {
                    use: 'radProf'
                },
                protocolProfile: {
                    bigip: '/Common/_sys_radius_proto_all'
                },
                subscriberDiscoveryEnabled: false
            };
        });

        it('should NOT remove the defaults if afm is provisioned', () => {
            const context = {
                target: {
                    tmosVersion: '14.0',
                    provisionedModules: ['afm']
                }
            };
            const results = translate.Radius_Profile(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'ltm profile radius',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'defaults-from': 'radProf',
                        description: 'none',
                        'pem-protocol-profile-radius': '/Common/_sys_radius_proto_all',
                        'persist-avp': 'none',
                        'subscriber-discovery': 'disabled'
                    }
                }
            );
        });

        it('should NOT remove the defaults if pem is provisioned', () => {
            const context = {
                target: {
                    tmosVersion: '14.0',
                    provisionedModules: ['pem']
                }
            };
            const results = translate.Radius_Profile(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'ltm profile radius',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'defaults-from': 'radProf',
                        description: 'none',
                        'pem-protocol-profile-radius': '/Common/_sys_radius_proto_all',
                        'persist-avp': 'none',
                        'subscriber-discovery': 'disabled'
                    }
                }
            );
        });

        it('should remove the defaults if neither afm or pem is provisioned', () => {
            const context = {
                target: {
                    tmosVersion: '14.0',
                    provisionedModules: ['ltm']
                }
            };
            const results = translate.Radius_Profile(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'ltm profile radius',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'defaults-from': 'radProf',
                        description: 'none',
                        'persist-avp': 'none'
                    }
                }
            );
        });
    });

    describe('Firewall_Address_List', () => {
        beforeEach(() => {
            sinon.stub(util, 'isOneOfProvisioned').callsFake(
                (targetContext, module) => module.indexOf('afm') > -1
            );
        });

        it('should succeed with Firewall Address Lists', () => {
            const context = {
                target: {
                    tmosVersion: '14.0',
                    provisionedModules: ['afm']
                }
            };
            const item = {
                class: 'Firewall_Address_List',
                addresses: ['192.0.2.0/24'],
                addressLists: [
                    {
                        use: 'addList'
                    }
                ]
            };
            const results = translate.Firewall_Address_List(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'security firewall address-list',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'address-lists': {
                            addList: {}
                        },
                        addresses: {
                            '192.0.2.0/24': {}
                        },
                        fqdns: {},
                        geo: {}
                    }
                }
            );
        });
    });

    describe('Firewall_Rule_List', () => {
        it('Should create correct config', () => {
            const item = {
                rules: [
                    {
                        name: 'theRule',
                        action: 'accept-decisively',
                        protocol: 'tcp',
                        source: {
                            addressLists: [
                                {
                                    use: 'addList'
                                }
                            ],
                            portLists: [
                                {
                                    use: 'portList'
                                }
                            ],
                            vlans: [
                                {
                                    bigip: '/Common/external'
                                }
                            ]
                        },
                        destination: {
                            addressLists: [
                                {
                                    use: 'addList'
                                }
                            ],
                            portLists: [
                                {
                                    use: 'portList'
                                }
                            ]
                        },
                        loggingEnabled: true,
                        iRule: {
                            use: 'irule'
                        },
                        iRuleSampleRate: 100
                    }
                ]
            };
            const expected = {
                path: '/tenantId/appId/itemId',
                command: 'security firewall rule-list',
                properties: {
                    rules: {
                        theRule: {
                            action: 'accept-decisively',
                            'ip-protocol': 'tcp',
                            source: {
                                'address-lists': {
                                    addList: {}
                                },
                                'port-lists': {
                                    portList: {}
                                },
                                vlans: {
                                    '/Common/external': {}
                                }
                            },
                            destination: {
                                'address-lists': {
                                    addList: {}
                                },
                                'port-lists': {
                                    portList: {}
                                }
                            },
                            log: 'yes',
                            irule: 'irule',
                            'irule-sample-rate': 100
                        }
                    }
                },
                ignore: []
            };
            const results = translate.Firewall_Rule_List(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expected);
        });
    });

    describe('Service_SCTP', () => {
        it('should check profileSCTP Service_SCTP properties', () => {
            const expectedProfiles = {
                '/Common/sctp': { context: 'all' }
            };

            const item = {
                class: 'Service_SCTP',
                remark: 'description',
                virtualPort: 123,
                virtualAddresses: ['1.1.1.10'],
                profileSCTP: { bigip: '/Common/sctp' },
                persistenceMethods: ['source-address'],
                layer4: 'sctp',
                enable: true
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'Service_SCTP',
                tenantId: {
                    class: 'Tenant',
                    appId: {
                        class: 'Application',
                        template: 'generic',
                        itemId: {
                            class: 'Service_SCTP',
                            remark: 'description',
                            virtualPort: 123,
                            virtualAddresses: [
                                '1.1.1.10'
                            ],
                            profileSCTP: {
                                bigip: '/Common/sctp'
                            }
                        }
                    }
                }
            };

            const results = translate.Service_SCTP(defaultContext, 'tenantId', 'appId', 'itemId', item, declaration);
            assert.deepEqual(expectedProfiles, results.configs[1].properties.profiles);
        });
    });

    describe('Access_Profile', () => {
        it('should create correct config with .tar', () => {
            const item = {
                url: 'https://example.url.helloThere.tar'
            };
            const expected = {
                path: '/tenantId/itemId',
                command: 'apm profile access',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url.helloThere.tar',
                            method: 'GET',
                            rejectUnauthorized: true,
                            ctype: 'application/octet-stream',
                            why: 'get Access Profile itemId from url'
                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload Access Profile itemId',
                            overrides: {
                                url: 'https://example.url.helloThere.tar'
                            }
                        }
                    },
                    enable: false
                },
                ignore: []
            };
            const results = translate.Access_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expected);
        });

        it('should create correct config with .tar (url is object)', () => {
            const item = {
                url: {
                    url: 'https://example.url.helloThere.tar',
                    skipCertificateCheck: true
                }
            };
            const expected = {
                path: '/tenantId/itemId',
                command: 'apm profile access',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url.helloThere.tar',
                            method: 'GET',
                            rejectUnauthorized: false,
                            ctype: 'application/octet-stream',
                            why: 'get Access Profile itemId from url'
                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload Access Profile itemId',
                            overrides: {
                                url: 'https://example.url.helloThere.tar'
                            }
                        }
                    },
                    enable: false
                },
                ignore: []
            };
            const results = translate.Access_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expected);
        });

        it('should create correct config with .tar (url is object with basic auth)', () => {
            const item = {
                url: {
                    url: 'https://example.url.helloThere.tar',
                    skipCertificateCheck: true,
                    authentication: {
                        method: 'basic',
                        username: 'user',
                        passphrase: {
                            ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                            miniJWE: true
                        }
                    }
                }
            };
            const expected = {
                path: '/tenantId/itemId',
                command: 'apm profile access',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url.helloThere.tar',
                            method: 'GET',
                            rejectUnauthorized: false,
                            ctype: 'application/octet-stream',
                            why: 'get Access Profile itemId from url',
                            authentication: {
                                method: 'basic',
                                username: 'user',
                                passphrase: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                            }

                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload Access Profile itemId',
                            overrides: {
                                url: 'https://example.url.helloThere.tar'
                            }
                        }
                    },
                    enable: false
                },
                ignore: []
            };
            const results = translate.Access_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expected);
        });

        it('should create correct config enable:true', () => {
            const item = {
                url: 'https://example.url.helloThere.tar',
                enable: true
            };
            const expected = {
                path: '/tenantId/itemId',
                command: 'apm profile access',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url.helloThere.tar',
                            method: 'GET',
                            rejectUnauthorized: true,
                            ctype: 'application/octet-stream',
                            why: 'get Access Profile itemId from url'
                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload Access Profile itemId',
                            overrides: {
                                url: 'https://example.url.helloThere.tar'
                            }
                        }
                    },
                    enable: true
                },
                ignore: []
            };
            const results = translate.Access_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expected);
        });
    });

    describe('Per_Request_Access_Policy', () => {
        it('should create correct config with .tar', () => {
            const item = {
                url: 'https://example.url.helloThere.tar'
            };
            const results = translate.Per_Request_Access_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0],
                {
                    path: '/tenantId/itemId',
                    command: 'apm policy access-policy',
                    properties: {
                        iControl_postFromRemote: {
                            get: {
                                path: 'https://example.url.helloThere.tar',
                                method: 'GET',
                                rejectUnauthorized: true,
                                ctype: 'application/octet-stream',
                                why: 'get Access Policy itemId from url'
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload Access Policy itemId',
                                overrides: {
                                    url: 'https://example.url.helloThere.tar'
                                }
                            }
                        }
                    },
                    ignore: []
                });
        });

        it('should create correct config with .tar (url is object)', () => {
            const item = {
                url: {
                    url: 'https://example.url.helloThere.tar',
                    skipCertificateCheck: true
                }
            };
            const results = translate.Per_Request_Access_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0],
                {
                    path: '/tenantId/itemId',
                    command: 'apm policy access-policy',
                    properties: {
                        iControl_postFromRemote: {
                            get: {
                                path: 'https://example.url.helloThere.tar',
                                method: 'GET',
                                rejectUnauthorized: false,
                                ctype: 'application/octet-stream',
                                why: 'get Access Policy itemId from url'
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload Access Policy itemId',
                                overrides: {
                                    url: 'https://example.url.helloThere.tar'
                                }
                            }
                        }
                    },
                    ignore: []
                });
        });

        it('should create correct config with .tar (url is object with basic auth)', () => {
            const item = {
                url: {
                    url: 'https://example.url.helloThere.tar',
                    skipCertificateCheck: true,
                    authentication: {
                        method: 'basic',
                        username: 'user',
                        passphrase: {
                            ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                            miniJWE: true
                        }
                    }
                }
            };
            const results = translate.Per_Request_Access_Policy(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0],
                {
                    path: '/tenantId/itemId',
                    command: 'apm policy access-policy',
                    properties: {
                        iControl_postFromRemote: {
                            get: {
                                path: 'https://example.url.helloThere.tar',
                                method: 'GET',
                                rejectUnauthorized: false,
                                ctype: 'application/octet-stream',
                                why: 'get Access Policy itemId from url',
                                authentication: {
                                    method: 'basic',
                                    username: 'user',
                                    passphrase: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                                }
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/itemId.tar',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload Access Policy itemId',
                                overrides: {
                                    url: 'https://example.url.helloThere.tar'
                                }
                            }
                        }
                    },
                    ignore: []
                });
        });
    });

    describe('WAF_Policy', () => {
        const context = {
            target: {
                tmosVersion: '13.1.0.8.0.0.3'
            },
            control: {
                host: 'localhost'
            }
        };

        it('should create correct config', () => {
            const item = {
                url: 'https://example.url/helloThere.xml'
            };
            const expected = {
                path: '/tenantId/appId/itemId',
                command: 'asm policy',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url/helloThere.xml',
                            method: 'GET',
                            rejectUnauthorized: true,
                            ctype: 'application/octet-stream',
                            why: 'get asm policy itemId from url'
                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy itemId',
                            overrides: {
                                url: 'https://example.url/helloThere.xml'
                            }
                        }
                    }
                },
                ignore: []
            };
            const results = translate.WAF_Policy(context, 'tenantId', 'appId', 'itemId', item, {});
            assert.deepStrictEqual(results.configs[0], expected);
        });

        it('should create correct config (url is object)', () => {
            const item = {
                url: {
                    url: 'https://example.url/helloThere.xml',
                    skipCertificateCheck: true
                }
            };
            const expected = {
                path: '/tenantId/appId/itemId',
                command: 'asm policy',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url/helloThere.xml',
                            method: 'GET',
                            rejectUnauthorized: false,
                            ctype: 'application/octet-stream',
                            why: 'get asm policy itemId from url'
                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy itemId',
                            overrides: {
                                url: 'https://example.url/helloThere.xml'
                            }
                        }
                    }
                },
                ignore: []
            };
            const results = translate.WAF_Policy(context, 'tenantId', 'appId', 'itemId', item, {});
            assert.deepStrictEqual(results.configs[0], expected);
        });

        it('should create correct config (url is object with basic auth)', () => {
            const item = {
                url: {
                    url: 'https://example.url/helloThere.xml',
                    skipCertificateCheck: true,
                    authentication: {
                        method: 'basic',
                        username: 'user',
                        passphrase: {
                            ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                            miniJWE: true
                        }
                    }
                }
            };
            const expected = {
                path: '/tenantId/appId/itemId',
                command: 'asm policy',
                properties: {
                    iControl_postFromRemote: {
                        get: {
                            path: 'https://example.url/helloThere.xml',
                            method: 'GET',
                            rejectUnauthorized: false,
                            ctype: 'application/octet-stream',
                            why: 'get asm policy itemId from url',
                            authentication: {
                                method: 'basic',
                                username: 'user',
                                passphrase: '$M$dG$Nd0rDcsTyKsm7XPWlf3yuw=='
                            }
                        },
                        post: {
                            path: '/mgmt/shared/file-transfer/uploads/itemId.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy itemId',
                            overrides: {
                                url: 'https://example.url/helloThere.xml'
                            }
                        }
                    }
                },
                ignore: []
            };
            const results = translate.WAF_Policy(context, 'tenantId', 'appId', 'itemId', item, {});
            assert.deepStrictEqual(results.configs[0], expected);
        });

        it('should create correct config (policy property)', () => {
            const item = {
                policy: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }'
            };
            const results = translate.WAF_Policy(context, 'tenantId', 'appId', 'itemId', item, {});
            assert.deepStrictEqual(
                results.configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'asm policy',
                    properties: {
                        iControl_post: {
                            reference: '/tenantId/appId/itemId',
                            path: '/mgmt/shared/file-transfer/uploads/itemId.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy itemId',
                            send: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }',
                            overrides: {
                                policy: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }'
                            }
                        }
                    },
                    ignore: []
                }
            );
        });

        it('should create correct config (file property)', () => {
            const item = {
                file: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }'
            };
            const results = translate.WAF_Policy(context, 'tenantId', 'appId', 'itemId', item, {});
            assert.deepStrictEqual(
                results.configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'asm policy',
                    properties: {
                        iControl_post: {
                            reference: '/tenantId/appId/itemId',
                            path: '/mgmt/shared/file-transfer/uploads/itemId.xml',
                            method: 'POST',
                            ctype: 'application/octet-stream',
                            why: 'upload asm policy itemId',
                            send: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }',
                            overrides: {
                                file: '{\n  "policy": {\n    "name": "Complete_OWASP_Top_Ten",\n    "description": "The WAF Policy"\n    }\n  }'
                            }
                        }
                    },
                    ignore: []
                }
            );
        });
    });

    describe('ICAP_Profile', () => {
        it('should return a default ICAP_Profile config', () => {
            const item = {
                class: 'ICAP_Profile',
                previewLength: 0
            };

            const results = translate.ICAP_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                results.configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'ltm profile icap',
                    properties: {
                        uri: 'none',
                        'header-from': 'none',
                        host: 'none',
                        referer: 'none',
                        'user-agent': 'none',
                        'preview-length': 0
                    },
                    ignore: []
                }
            );
        });

        it('should return an ICAP_Profile config', () => {
            const item = {
                class: 'ICAP_Profile',
                // eslint-disable-next-line no-template-curly-in-string
                uri: 'icap://${SERVER_IP}:${SERVER_PORT}/videoOptimization',
                fromHeader: 'admin@example.com',
                hostHeader: 'www.example.com',
                refererHeader: 'http://www.example.com/video/resource.html',
                userAgentHeader: 'CERN-LineMode/2.15 libwww/2.17b3',
                previewLength: 10
            };

            const results = translate.ICAP_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                results.configs[0],
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
            );
        });
    });

    describe('Adapt_Profile', () => {
        const item = {
            class: 'Adapt_Profile',
            messageType: 'request',
            enableHttpAdaptation: false,
            internalService: {
                bigip: '/Common/internalService'
            },
            previewSize: 1234,
            serviceDownAction: 'drop',
            timeout: 12345,
            allowHTTP10: true
        };

        it('should create request Adapt_Profile', () => {
            const results = translate.Adapt_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'ltm profile request-adapt',
                    properties: {
                        enabled: 'no',
                        'internal-virtual': '/Common/internalService',
                        'preview-size': 1234,
                        'service-down-action': 'drop',
                        timeout: 12345,
                        'allow-http-10': 'yes'
                    },
                    ignore: []
                }
            );
        });

        it('should create response Adapt_Profile', () => {
            item.messageType = 'response';
            const results = translate.Adapt_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    path: '/tenantId/appId/itemId',
                    command: 'ltm profile response-adapt',
                    properties: {
                        enabled: 'no',
                        'internal-virtual': '/Common/internalService',
                        'preview-size': 1234,
                        'service-down-action': 'drop',
                        timeout: 12345,
                        'allow-http-10': 'yes'
                    },
                    ignore: []
                }
            );
        });

        it('should create request and response Adapt_Profile', () => {
            item.messageType = 'request-and-response';
            const results = translate.Adapt_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs.map((config) => config.path),
                [
                    '/tenantId/appId/itemId_request',
                    '/tenantId/appId/itemId_response'
                ]
            );
        });
    });

    describe('CA_Bundle', () => {
        it('should only add pathUpdates when bundle value is bigip ref to existing obj', () => {
            const item = {
                class: 'CA_Bundle',
                bundle: { bigip: '/path/to/existingCert' }
            };

            const results = translate.CA_Bundle(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(results.configs, []);
            assert.deepStrictEqual(
                results.pathUpdates,
                [
                    {
                        oldString: '/tenantId/appId/itemId',
                        newString: '/path/to/existingCert'
                    }
                ]
            );
        });

        it('should return icontrol post config when bundle value is string', () => {
            const item = {
                class: 'CA_Bundle',
                bundle: 'somecertValue here'
            };

            defaultContext.target.tmosVersion = '13.1';
            const results = translate.CA_Bundle(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'sys file ssl-cert',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'cert-validation-options': {},
                        'cert-validators': {},
                        checksum: 'SHA1:18:bb5d52e42955b7ec25a1ad1b6a9871d72411dc6d',
                        iControl_post: {
                            ctype: 'application/octet-stream',
                            method: 'POST',
                            path: '/mgmt/shared/file-transfer/uploads/_tenantId_appId_itemId',
                            reference: '/tenantId/appId/itemId',
                            send: 'somecertValue here',
                            why: 'upload bundle file'
                        },
                        'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_itemId'
                    }
                }
            );
            assert.strictEqual(results.updatePath, false);
            assert.deepEqual(results.pathUpdates, []);
        });

        it('should replace CRLF line endings with LF line endings', () => {
            const item = {
                class: 'CA_Bundle',
                bundle: 'value\r\nwith\r\nCRLF'
            };

            defaultContext.target.tmosVersion = '13.1';
            const results = translate.CA_Bundle(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(
                results.configs[0],
                {
                    command: 'sys file ssl-cert',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        'cert-validation-options': {},
                        'cert-validators': {},
                        checksum: 'SHA1:15:028d49229d7bc930c0e02b429c44685135c11fe0',
                        iControl_post: {
                            ctype: 'application/octet-stream',
                            method: 'POST',
                            path: '/mgmt/shared/file-transfer/uploads/_tenantId_appId_itemId',
                            reference: '/tenantId/appId/itemId',
                            send: 'value\nwith\nCRLF',
                            why: 'upload bundle file'
                        },
                        'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_itemId'
                    }
                }
            );
            assert.strictEqual(results.updatePath, false);
            assert.deepEqual(results.pathUpdates, []);
        });
    });

    describe('Security_Log_Profile', () => {
        it('should escape user defined strings', () => {
            /* eslint-disable no-template-curly-in-string */
            const item = {
                class: 'Security_Log_Profile',
                network: {
                    storageFormat: 'foo ${date_time},${bigip_hostname} bar'
                }
            };
            sinon.stub(util, 'isOneOfProvisioned').returns(true);
            const results = translate.Security_Log_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            const networkFormat = results.configs[0].properties.network.undefined.format;
            assert.strictEqual(
                networkFormat['user-defined'], 'foo \\$\\\\{date_time\\\\},\\$\\\\{bigip_hostname\\\\} bar'
            );
            assert.strictEqual(networkFormat['field-list-delimiter'], undefined);
            /* eslint-enable no-template-curly-in-string */
        });
    });

    describe('Protocol_Inspection_Profile', () => {
        const fullDecl = {
            class: 'Protocol_Inspection_Profile',
            remark: 'The description',
            collectAVRStats: true,
            enableComplianceChecks: true,
            enableSignatureChecks: true,
            defaultFromProfile: 'parentProfile',
            autoAddNewInspections: true,
            autoPublish: true,
            services: [
                {
                    type: 'dns',
                    compliance: [
                        {
                            check: 'dns_maximum_reply_length',
                            action: 'accept',
                            log: false,
                            value: '1234'
                        },
                        {
                            check: 'dns_disallowed_query_type',
                            action: 'accept',
                            log: true,
                            value: 'STATUS NOTIFY'
                        }
                    ],
                    signature: [
                        {
                            check: 'dns_dns_query_amplification_attempt',
                            action: 'reject',
                            log: true
                        }
                    ],
                    ports: [100, 101, 102]
                },
                {
                    type: 'mysql',
                    compliance: [
                        {
                            check: 'mysql_malformed_packet',
                            action: 'accept',
                            log: true
                        }
                    ]
                },
                {
                    type: 'dhcp',
                    signature: [
                        {
                            check: 'dhcp_os_other_malicious_dhcp_server_bash_environment_variable_injection_attempt',
                            action: 'accept',
                            log: true
                        }
                    ]
                }
            ]
        };

        it('should remove empty service block', () => {
            const item = {
                class: 'Protocol_Inspection_Profile',
                remark: 'The description'
            };
            const expectedResult = {
                command: 'security protocol-inspection profile',
                ignore: [],
                path: '/tenantId/appId/itemId',
                properties: {
                    description: '"The description"'
                }
            };
            const results = translate.Protocol_Inspection_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expectedResult);
        });

        it('should remove empty signature check block', () => {
            const item = {
                class: 'Protocol_Inspection_Profile',
                remark: 'The description',
                services: [{
                    type: 'dns',
                    compliance: [{ check: 'dns_maximum_reply_length' }],
                    signature: {}
                }]
            };
            const expectedResult = {
                command: 'security protocol-inspection profile',
                ignore: [],
                path: '/tenantId/appId/itemId',
                properties: {
                    description: '"The description"',
                    services: {
                        dns: {
                            compliance: {
                                dns_maximum_reply_length: {}
                            }
                        }
                    }
                }
            };
            const results = translate.Protocol_Inspection_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expectedResult);
        });

        it('should remove empty compliance check block', () => {
            const item = {
                class: 'Protocol_Inspection_Profile',
                remark: 'The description',
                services: [{
                    type: 'dns',
                    compliance: {},
                    signature: [{ check: 'some_signature' }]
                }]
            };
            const expectedResult = {
                command: 'security protocol-inspection profile',
                ignore: [],
                path: '/tenantId/appId/itemId',
                properties: {
                    description: '"The description"',
                    services: {
                        dns: {
                            signature: {
                                some_signature: {}
                            }
                        }
                    }
                }
            };
            const results = translate.Protocol_Inspection_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expectedResult);
        });

        it('should perform translations on Services array', () => {
            const expectedResult = {
                command: 'security protocol-inspection profile',
                ignore: [],
                path: '/tenantId/appId/itemId',
                properties: {
                    'auto-add-new-inspections': 'on',
                    'auto-publish-suggestion': 'on',
                    'avr-stat-collect': 'on',
                    'compliance-enable': 'on',
                    'defaults-from': 'parentProfile',
                    description: '"The description"',
                    services: {
                        dns: {
                            compliance: {
                                dns_disallowed_query_type: {
                                    action: 'accept',
                                    log: 'yes',
                                    value: {
                                        NOTIFY: {},
                                        STATUS: {}
                                    }
                                },
                                dns_maximum_reply_length: {
                                    action: 'accept',
                                    log: 'no',
                                    value: '1234'
                                }
                            },
                            signature: {
                                dns_dns_query_amplification_attempt: {
                                    action: 'reject',
                                    log: 'yes'
                                }
                            },
                            ports: {
                                100: {},
                                101: {},
                                102: {}
                            }
                        },
                        mysql: {
                            compliance: {
                                mysql_malformed_packet: {
                                    action: 'accept',
                                    log: 'yes'
                                }
                            }
                        },
                        dhcp: {
                            signature: {
                                dhcp_os_other_malicious_dhcp_server_bash_environment_variable_injection_attempt: {
                                    action: 'accept',
                                    log: 'yes'
                                }
                            }
                        }
                    },
                    'signature-enable': 'on'
                }
            };
            defaultContext.target.tmosVersion = '14.0';
            const results = translate.Protocol_Inspection_Profile(defaultContext, 'tenantId', 'appId', 'itemId', fullDecl);
            assert.deepStrictEqual(results.configs[0], expectedResult);
        });

        it('should parse url w/ numbers', () => {
            const item = {
                class: 'Protocol_Inspection_Profile',
                remark: 'The description',
                services: [{
                    type: 'dns',
                    compliance: [{
                        check: 'dns_domains_blacklist',
                        action: 'accept',
                        log: true,
                        value: '123.example.com'
                    }]
                }]
            };

            const expectedResult = {
                command: 'security protocol-inspection profile',
                ignore: [],
                path: '/tenantId/appId/itemId',
                properties: {
                    description: '"The description"',
                    services: {
                        dns: {
                            compliance: {
                                dns_domains_blacklist: {
                                    action: 'accept',
                                    log: 'yes',
                                    value: {
                                        '123.example.com': {}
                                    }
                                }
                            }
                        }
                    }
                }
            };
            defaultContext.target.tmosVersion = '14.0';
            const results = translate.Protocol_Inspection_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(results.configs[0], expectedResult);
        });
    });

    describe('Automatically generated objects', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'TLS_Server',
            tenantId: {
                class: 'Tenant',
                appId: {
                    class: 'Application',
                    template: 'https',
                    serviceMain: {
                        class: 'Service_HTTPS',
                        virtualAddresses: [
                            '198.19.192.91',
                            '198.19.192.92'
                        ],
                        serverTLS: 'tlsServer'
                    },
                    tlsServer: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                matchToSNI: 'www.somehost.com',
                                certificate: 'webcert1'
                            },
                            {
                                certificate: 'webcert2'
                            }]
                    },
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    webcert2: {
                        class: 'Certificate',
                        certificate: 'another cert value'
                    },
                    webcert3: {
                        class: 'Certificate',
                        certificate: 'last cert value'
                    },
                    webcert4: {
                        class: 'Certificate',
                        certificate: 'last cert value',
                        passphrase: {
                            ciphertext: 'JE0kZEckTmQwckRjc1R5S3NtN1hQV2xmM3l1dz09',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                            miniJWE: true,
                            ignoreChanges: true
                        }
                    }
                }
            },
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    webcert5: {
                        class: 'Certificate',
                        certificate: 'shared cert value'
                    },
                    webcert6: {
                        class: 'Certificate',
                        certificate: 'last shared cert value',
                        passphrase: {
                            ciphertext: 'IA==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0',
                            miniJWE: true,
                            ignoreChanges: true
                        }
                    }
                }
            }
        };

        describe('Service_HTTPS', () => {
            it('should create addtl service when there are multiple virtual addresses and redirect80 is enabled', () => {
                const item = {
                    class: 'Service_HTTPS',
                    virtualAddresses: [
                        '198.19.192.91',
                        '198.19.192.92'
                    ],
                    enable: true,
                    redirect80: true,
                    profileTCP: 'normal',
                    profileHTTP: 'basic',
                    profileHTTP2: 'basic',
                    serverTLS: '/tenantId/appId/tlsServer',
                    virtualPort: 443,
                    virtualType: 'standard',
                    allowVlans: [
                        '/Common/Shared/allowed1',
                        '/Common/Shared/allowed2'
                    ],
                    adminState: 'enable'
                };

                defaultContext.target.tmosVersion = '13.1.0.8.0.0.3';
                defaultContext.targetHost = 'localhost';

                const results = translate.Service_HTTPS(defaultContext, 'tenantId', 'appId', 'serviceMain', item, declaration);
                const serviceMain = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain');
                assert.strictEqual(serviceMain.command, 'ltm virtual');
                assert.strictEqual(serviceMain.properties.destination, '/tenantId/198.19.192.91:443');
                assert.strictEqual(serviceMain.properties['vlans-enabled'], ' ');
                assert.deepStrictEqual(serviceMain.properties.vlans,
                    {
                        '/Common/Shared/allowed1': {},
                        '/Common/Shared/allowed2': {}
                    });
                assert.strictEqual(serviceMain.properties.enabled, true);

                const serviceMainAddtl = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain-1-');
                assert.strictEqual(serviceMainAddtl.command, 'ltm virtual');
                assert.strictEqual(serviceMainAddtl.properties.destination, '/tenantId/198.19.192.92:443');
                assert.strictEqual(serviceMainAddtl.properties['vlans-enabled'], ' ');
                assert.deepStrictEqual(serviceMainAddtl.properties.vlans,
                    {
                        '/Common/Shared/allowed1': {},
                        '/Common/Shared/allowed2': {}
                    });
                assert.strictEqual(serviceMainAddtl.properties.enabled, true);

                const redirectMain = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain-Redirect-');
                assert.strictEqual(redirectMain.command, 'ltm virtual');
                assert.strictEqual(redirectMain.properties.destination, '/tenantId/198.19.192.91:80');
                assert.strictEqual(redirectMain.properties['vlans-enabled'], ' ');
                assert.deepStrictEqual(redirectMain.properties.vlans,
                    {
                        '/Common/Shared/allowed1': {},
                        '/Common/Shared/allowed2': {}
                    });
                assert.strictEqual(redirectMain.properties.enabled, true);

                const redirectMainAddtl = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain-Redirect--1-');
                assert.strictEqual(redirectMainAddtl.command, 'ltm virtual');
                assert.strictEqual(redirectMainAddtl.properties.destination, '/tenantId/198.19.192.92:80');
                assert.strictEqual(redirectMainAddtl.properties['vlans-enabled'], ' ');
                assert.deepStrictEqual(redirectMainAddtl.properties.vlans,
                    {
                        '/Common/Shared/allowed1': {},
                        '/Common/Shared/allowed2': {}
                    });
                assert.strictEqual(redirectMainAddtl.properties.enabled, true);
            });

            it('should create addtl service when there are server and destination cidr addresses and redirect80 is enabled', () => {
                const item = {
                    class: 'Service_HTTPS',
                    virtualAddresses: [
                        [
                            '7.7.7.7/32',
                            '10.0.0.0/24'
                        ]
                    ],
                    enable: true,
                    redirect80: true,
                    profileTCP: 'normal',
                    profileHTTP: 'basic',
                    profileHTTP2: 'basic',
                    serverTLS: '/tenantId/appId/tlsServer',
                    virtualPort: 443,
                    virtualType: 'standard',
                    rejectVlans: [
                        '/Common/Shared/rejected1',
                        '/Common/Shared/rejected2'
                    ]
                };

                defaultContext.target.tmosVersion = '13.1.0.8.0.0.3';
                defaultContext.targetHost = 'localhost';

                const results = translate.Service_HTTPS(defaultContext, 'tenantId', 'appId', 'serviceMain', item, declaration);
                const serviceMain = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain');
                assert.strictEqual(serviceMain.command, 'ltm virtual');
                assert.strictEqual(serviceMain.properties.destination, '/tenantId/7.7.7.7:443');
                assert.strictEqual(serviceMain.properties.mask, '255.255.255.255');
                assert.strictEqual(serviceMain.properties.source, '10.0.0.0/24');
                assert.strictEqual(serviceMain.properties['vlans-disabled'], ' ');
                assert.deepStrictEqual(serviceMain.properties.vlans,
                    {
                        '/Common/Shared/rejected1': {},
                        '/Common/Shared/rejected2': {}
                    });

                const redirectMain = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain-Redirect-');
                assert.strictEqual(redirectMain.command, 'ltm virtual');
                assert.strictEqual(redirectMain.properties.destination, '/tenantId/7.7.7.7:80');
                assert.strictEqual(redirectMain.properties.mask, '255.255.255.255');
                assert.strictEqual(redirectMain.properties.source, '10.0.0.0/24');
                assert.strictEqual(redirectMain.properties['vlans-disabled'], ' ');
                assert.deepStrictEqual(redirectMain.properties.vlans,
                    {
                        '/Common/Shared/rejected1': {},
                        '/Common/Shared/rejected2': {}
                    });
            });

            it('should create redirect using common when shareAddresses and redirect80 are enabled', () => {
                const item = {
                    class: 'Service_HTTPS',
                    virtualAddresses: [
                        '198.19.192.91'
                    ],
                    enable: true,
                    redirect80: true,
                    shareAddresses: true,
                    profileTCP: 'normal',
                    profileHTTP: 'basic',
                    profileHTTP2: 'basic',
                    serverTLS: '/tenantId/appId/tlsServer',
                    virtualPort: 443,
                    virtualType: 'standard'
                };

                defaultContext.target.tmosVersion = '13.1.0.8.0.0.3';
                defaultContext.targetHost = 'localhost';

                const results = translate.Service_HTTPS(defaultContext, 'tenantId', 'appId', 'serviceMain', item, declaration);
                const serviceMain = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain');
                assert.strictEqual(serviceMain.command, 'ltm virtual');
                assert.strictEqual(serviceMain.properties.destination, '/Common/198.19.192.91:443');
                assert.strictEqual(serviceMain.properties['vlans-disabled'], ' ');
                assert.deepStrictEqual(serviceMain.properties.vlans, {});

                const redirectMain = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain-Redirect-');
                assert.strictEqual(redirectMain.command, 'ltm virtual');
                assert.strictEqual(redirectMain.properties.destination, '/Common/198.19.192.91:80');
                assert.strictEqual(redirectMain.properties['vlans-disabled'], ' ');
                assert.deepStrictEqual(redirectMain.properties.vlans, {});
            });

            it('should handle ingress HTTP2 and TCP profiles', () => {
                const item = {
                    class: 'Service_HTTPS',
                    virtualAddresses: [
                        '198.19.192.91',
                        '198.19.192.92'
                    ],
                    enable: true,
                    redirect80: true,
                    profileTCP: {
                        ingress: {
                            use: 'tcpProfile'
                        }
                    },
                    profileHTTP: 'basic',
                    profileHTTP2: {
                        ingress: {
                            use: 'http2Profile'
                        }
                    },
                    serverTLS: '/tenantId/appId/tlsServer',
                    virtualPort: 443,
                    virtualType: 'standard'
                };

                defaultContext.target.tmosVersion = '14.1';
                defaultContext.targetHost = 'localhost';

                const results = translate.Service_HTTPS(defaultContext, 'tenantId', 'appId', 'serviceMain', item, declaration);
                const profiles = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain').properties.profiles;
                assert.deepStrictEqual(
                    profiles.http2Profile,
                    {
                        context: 'clientside'
                    }
                );
                assert.deepStrictEqual(
                    profiles.tcpProfile,
                    {
                        context: 'clientside'
                    }
                );
            });

            it('should handle egress HTTP2 and TCP profiles', () => {
                const item = {
                    class: 'Service_HTTPS',
                    virtualAddresses: [
                        '198.19.192.91',
                        '198.19.192.92'
                    ],
                    enable: true,
                    redirect80: true,
                    profileTCP: {
                        egress: {
                            use: 'tcpProfile'
                        }
                    },
                    profileHTTP: 'basic',
                    httpMrfRoutingEnabled: true,
                    profileHTTP2: {
                        egress: {
                            use: 'http2Profile'
                        }
                    },
                    serverTLS: '/tenantId/appId/tlsServer',
                    virtualPort: 443,
                    virtualType: 'standard'
                };

                defaultContext.target.tmosVersion = '14.1';
                defaultContext.targetHost = 'localhost';

                const results = translate.Service_HTTPS(defaultContext, 'tenantId', 'appId', 'serviceMain', item, declaration);
                const profiles = results.configs.find((r) => r.path === '/tenantId/appId/serviceMain').properties.profiles;
                assert.deepStrictEqual(
                    profiles.http2Profile,
                    {
                        context: 'serverside'
                    }
                );
                assert.deepStrictEqual(
                    profiles.tcpProfile,
                    {
                        context: 'serverside'
                    }
                );
            });
        });

        describe('TLS Server', () => {
            it('should create addtl profile when there are multiple certificates', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: 'one-time',
                    certificates: [
                        {
                            matchToSNI: 'www.somehost.com',
                            enabled: false,
                            certificate: '/tenantId/appId/webcert1'
                        },
                        {
                            enabled: true,
                            certificate: '/tenantId/appId/webcert2'
                        },
                        {
                            enabled: true,
                            certificate: '/tenantId/appId/webcert3'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    webcert2: {
                        class: 'Certificate',
                        certificate: 'another cert value'
                    },
                    webcert3: {
                        class: 'Certificate',
                        certificate: 'last cert value'
                    }
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile1 = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                assert.strictEqual(profile1.command, 'ltm profile client-ssl');
                assert.deepEqual(
                    profile1.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert1.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert1.key',
                            usage: 'SERVER'
                        }
                    }
                );
                assert.deepEqual(profile1.properties['server-name'], 'www.somehost.com');
                assert.deepEqual(profile1.properties['sni-default'], 'true');
                assert.deepEqual(profile1.properties.mode, 'disabled');

                const profile2 = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer-1-');
                assert.strictEqual(profile2.command, 'ltm profile client-ssl');
                assert.deepEqual(
                    profile2.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert2.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert2.key',
                            usage: 'SERVER'
                        }
                    }
                );
                assert.deepEqual(profile2.properties['server-name'], 'none');
                assert.deepEqual(profile2.properties['sni-default'], 'false');
                assert.deepEqual(profile2.properties.mode, 'enabled');

                const profile3 = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer-2-');
                assert.strictEqual(profile3.command, 'ltm profile client-ssl');
                assert.deepEqual(
                    profile3.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert3.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert3.key',
                            usage: 'SERVER'
                        }
                    }
                );
                assert.deepEqual(profile3.properties['server-name'], 'none');
                assert.deepEqual(profile3.properties['sni-default'], 'false');
                assert.deepEqual(profile3.properties.mode, 'enabled');
            });

            it('should create standard options on < version 14', () => {
                const context = {
                    target: {
                        tmosVersion: '13.1'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert1'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    insertEmptyFragmentsEnabled: false,
                    singleUseDhEnabled: false,
                    tls1_3Enabled: false,
                    tls1_2Enabled: true,
                    tls1_1Enabled: true,
                    tls1_0Enabled: true,
                    sslEnabled: true,
                    ssl3Enabled: true,
                    dtlsEnabled: true,
                    dtls1_2Enabled: true
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                assert.deepEqual(
                    profile.properties.options,
                    {
                        'dont-insert-empty-fragments': {}
                    }
                );
            });

            it('should create standard options on > version 14', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert1'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    insertEmptyFragmentsEnabled: false,
                    singleUseDhEnabled: false,
                    tls1_3Enabled: false,
                    tls1_2Enabled: true,
                    tls1_1Enabled: true,
                    tls1_0Enabled: true,
                    sslEnabled: true,
                    ssl3Enabled: true,
                    dtlsEnabled: true,
                    dtls1_2Enabled: true
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                return assert.deepEqual(
                    profile.properties.options,
                    {
                        'dont-insert-empty-fragments': {},
                        'no-tlsv1.3': {}
                    }
                );
            });

            it('should create standard options but add and remove tls options if instructed', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert1'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    insertEmptyFragmentsEnabled: true,
                    singleUseDhEnabled: true,
                    tls1_3Enabled: true,
                    tls1_2Enabled: false,
                    tls1_1Enabled: false,
                    tls1_0Enabled: false,
                    sslEnabled: false,
                    ssl3Enabled: false,
                    dtlsEnabled: false,
                    dtls1_2Enabled: false
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                return assert.deepEqual(
                    profile.properties.options,
                    {
                        'single-dh-use': {},
                        'no-tlsv1.2': {},
                        'no-tlsv1.1': {},
                        'no-tlsv1': {},
                        'no-ssl': {},
                        'no-sslv3': {},
                        'no-dtls': {},
                        'no-dtlsv1.2': {}
                    }
                );
            });

            it('should handle passphrase object in certificate', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert4'
                        }
                    ]
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                assert.deepStrictEqual(
                    profile.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert4.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert4.key',
                            passphrase: '"\\$M\\$dG\\$Nd0rDcsTyKsm7XPWlf3yuw=="',
                            usage: 'SERVER'
                        }
                    }
                );
                assert.deepStrictEqual(
                    profile.ignore,
                    [
                        'cert-key-chain.set0.passphrase'
                    ]
                );
            });

            it('should create proxy certificate if provided', () => {
                const context = {
                    target: {
                        tmosVersion: '13.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert1',
                            proxyCertificate: '/tenantId/appId/webcert4'
                        }
                    ]
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                assert.deepStrictEqual(
                    profile.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert1.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert1.key'
                        }
                    }
                );
                assert.strictEqual(profile.properties['proxy-ca-cert'], '/tenantId/appId/webcert4.crt');
                assert.strictEqual(profile.properties['proxy-ca-key'], '/tenantId/appId/webcert4.key');
                assert.strictEqual(
                    profile.properties['proxy-ca-passphrase'],
                    '"\\$M\\$dG\\$Nd0rDcsTyKsm7XPWlf3yuw=="'
                );
                assert.deepStrictEqual(
                    profile.ignore,
                    [
                        'proxy-ca-passphrase'
                    ]
                );
                assert.strictEqual(profile.properties['hostname-whitelist'], 'none');
            });

            it('should create proxy certificate if provided (14.0+)', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert1',
                            proxyCertificate: '/tenantId/appId/webcert4'
                        }
                    ]
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                assert.deepStrictEqual(
                    profile.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert1.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert1.key',
                            usage: 'SERVER'
                        },
                        set1: {
                            cert: '/tenantId/appId/webcert4.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert4.key',
                            passphrase: '"\\$M\\$dG\\$Nd0rDcsTyKsm7XPWlf3yuw=="',
                            usage: 'CA'
                        }
                    }
                );
                assert.deepStrictEqual(
                    profile.ignore,
                    [
                        'cert-key-chain.set1.passphrase'
                    ]
                );
                assert.strictEqual(profile.properties['hostname-whitelist'], 'none');
            });

            it('should handle certificate and proxy certificate in Common tenant', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: '/Common/Shared/webcert5',
                            proxyCertificate: '/Common/Shared/webcert6'
                        }
                    ]
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
                assert.deepStrictEqual(
                    profile.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/Common/Shared/webcert5.crt',
                            chain: 'none',
                            key: '/Common/Shared/webcert5.key',
                            usage: 'SERVER'
                        },
                        set1: {
                            cert: '/Common/Shared/webcert6.crt',
                            chain: 'none',
                            key: '/Common/Shared/webcert6.key',
                            passphrase: '" "',
                            usage: 'CA'
                        }
                    }
                );
                assert.deepStrictEqual(
                    profile.ignore,
                    [
                        'cert-key-chain.set1.passphrase'
                    ]
                );
            });

            it('should handle certificate naming scheme', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Server',
                    authenticationFrequency: '',
                    namingScheme: 'certificate',
                    certificates: [
                        {
                            certificate: '/tenantId/appId/webcert1'
                        },
                        {
                            certificate: '/Common/Shared/webcert5'
                        }
                    ]
                };
                const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

                let profile = results.configs.find((r) => r.path === '/tenantId/appId/webcert1');
                assert.deepStrictEqual(
                    profile.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/tenantId/appId/webcert1.crt',
                            chain: 'none',
                            key: '/tenantId/appId/webcert1.key',
                            usage: 'SERVER'
                        }
                    }
                );
                profile = results.configs.find((r) => r.path === '/tenantId/appId/webcert5');
                assert.deepStrictEqual(
                    profile.properties['cert-key-chain'],
                    {
                        set0: {
                            cert: '/Common/Shared/webcert5.crt',
                            chain: 'none',
                            key: '/Common/Shared/webcert5.key',
                            usage: 'SERVER'
                        }
                    }
                );
            });
        });

        describe('TLS Client', () => {
            it('should create standard options on < version 14', () => {
                const context = {
                    target: {
                        tmosVersion: '13.1'
                    }
                };
                const item = {
                    class: 'TLS_Client',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: 'webcert1'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    insertEmptyFragmentsEnabled: false,
                    singleUseDhEnabled: false,
                    tls1_3Enabled: false,
                    tls1_2Enabled: true,
                    tls1_1Enabled: true,
                    tls1_0Enabled: true,
                    sslEnabled: true,
                    ssl3Enabled: true,
                    dtlsEnabled: true,
                    dtls1_2Enabled: true
                };
                const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsClient');
                assert.deepEqual(
                    profile.properties.options,
                    {
                        'dont-insert-empty-fragments': {}
                    }
                );
            });

            it('should create standard options on > version 14', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Client',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: 'webcert1'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    insertEmptyFragmentsEnabled: false,
                    singleUseDhEnabled: false,
                    tls1_3Enabled: false,
                    tls1_2Enabled: true,
                    tls1_1Enabled: true,
                    tls1_0Enabled: true,
                    sslEnabled: true,
                    ssl3Enabled: true,
                    dtlsEnabled: true,
                    dtls1_2Enabled: true
                };
                const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsClient');
                assert.deepEqual(
                    profile.properties.options,
                    {
                        'dont-insert-empty-fragments': {},
                        'no-tlsv1.3': {}
                    }
                );
            });

            it('should create standard options but add and remove tls options if instructed', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Client',
                    authenticationFrequency: '',
                    certificates: [
                        {
                            certificate: 'webcert1'
                        }
                    ],
                    webcert1: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    insertEmptyFragmentsEnabled: true,
                    singleUseDhEnabled: true,
                    tls1_3Enabled: true,
                    tls1_2Enabled: false,
                    tls1_1Enabled: false,
                    tls1_0Enabled: false,
                    sslEnabled: false,
                    ssl3Enabled: false,
                    dtlsEnabled: false,
                    dtls1_2Enabled: false
                };
                const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, declaration);

                const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsClient');
                assert.deepEqual(
                    profile.properties.options,
                    {
                        'single-dh-use': {},
                        'no-tlsv1.2': {},
                        'no-tlsv1.1': {},
                        'no-tlsv1': {},
                        'no-ssl': {},
                        'no-sslv3': {},
                        'no-dtls': {},
                        'no-dtlsv1.2': {}
                    }
                );
            });

            it('should correctly handle chainCA bigip reference', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Client',
                    authenticationFrequency: '',
                    clientCertificate: 'webcert'
                };
                const certDecl = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TLS_Client',
                    tenantId: {
                        class: 'Tenant',
                        appId: {
                            class: 'Application',
                            bigipTlsClient: {
                                class: 'TLS_Client',
                                authenticationFrequency: '',
                                clientCertificate: 'webcert'
                            },
                            webcert: {
                                class: 'Certificate',
                                certificate: { bigip: '/Common/default.crt' },
                                privateKey: { bigip: '/Common/default.key' },
                                chainCA: { bigip: '/Common/f5-ca-bundle.crt' }
                            }
                        }
                    }
                };
                const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, certDecl);
                const profile = results.configs[0].properties;
                assert.strictEqual(profile.cert, 'webcert.crt');
                assert.strictEqual(profile.key, 'webcert.key');
                assert.strictEqual(profile.chain, 'webcert-bundle.crt');
            });

            it('should correctly handle chainCA use reference', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Client',
                    authenticationFrequency: '',
                    clientCertificate: 'webcert'
                };
                const certDecl = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TLS_Client',
                    Common: {
                        class: 'Tenant',
                        Shared: {
                            class: 'Application',
                            template: 'shared',
                            ca_example_bundle: {
                                class: 'CA_Bundle',
                                bundle: 'CERTIFICATE bundle'
                            }
                        }
                    },
                    tenantId: {
                        class: 'Tenant',
                        appId: {
                            class: 'Application',
                            useTlsClient: {
                                class: 'TLS_Client',
                                authenticationFrequency: '',
                                clientCertificate: 'webcert'
                            },
                            webcert: {
                                class: 'Certificate',
                                certificate: { bigip: '/Common/default.crt' },
                                privateKey: { bigip: '/Common/default.key' },
                                chainCA: { use: '/Common/Shared/ca_example_bundle' }
                            }
                        }
                    }
                };
                const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, certDecl);
                const profile = results.configs[0].properties;
                assert.strictEqual(profile.cert, 'webcert.crt');
                assert.strictEqual(profile.key, 'webcert.key');
                assert.strictEqual(profile.chain, 'webcert-bundle.crt');
            });

            it('should correctly handle chainCA strings', () => {
                const context = {
                    target: {
                        tmosVersion: '14.0'
                    }
                };
                const item = {
                    class: 'TLS_Client',
                    authenticationFrequency: '',
                    clientCertificate: 'webcert'
                };
                const certDecl = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'TLS_Client',
                    tenantId: {
                        class: 'Tenant',
                        appId: {
                            class: 'Application',
                            useTlsClient: {
                                class: 'TLS_Client',
                                authenticationFrequency: '',
                                clientCertificate: 'webcert'
                            },
                            webcert: {
                                class: 'Certificate',
                                certificate: { bigip: '/Common/default.crt' },
                                privateKey: { bigip: '/Common/default.key' },
                                chainCA: 'CERTIFICATE bundle'
                            }
                        }
                    }
                };
                const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, certDecl);
                const profile = results.configs[0].properties;
                assert.strictEqual(profile.cert, 'webcert.crt');
                assert.strictEqual(profile.key, 'webcert.key');
                assert.strictEqual(profile.chain, 'webcert-bundle.crt');
            });
        });
    });

    describe('Cipher_Rule', () => {
        it('should return correct Cipher_Rule config', () => {
            // Currently normalize.actionableMcp() does not utilize context and instead uses globals
            defaultContext.target.tmosVersion = '14.0';
            const item = {
                remark: 'The item description',
                cipherSuites: ['ECDHE', 'RSA', 'ECDHE_ECDSA', '!SSLV3'],
                namedGroups: ['P256', 'P384'],
                signatureAlgorithms: ['DSA-SHA256', 'DSA-SHA512', 'ECDSA-SHA384']
            };
            const results = translate.Cipher_Rule(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                results.configs[0],
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
            );
        });
    });

    describe('Certificate', () => {
        it('should handle use chainCA', () => {
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const tenantId = 'ten2';
            const appId = 'exampleApp';
            const itemId = 'useCert';
            const item = {
                class: 'Certificate',
                certificate: '----exampleCertificate----',
                chainCA: { use: '/Common/Shared/ca_example_bundle' },
                privateKey: '----examplePrivateKey----',
                passphrase: {
                    allowReuse: false,
                    ciphertext: 'l0oKiEIaMaCiPhEr',
                    ignoreChanges: false,
                    miniJWE: true,
                    protected: 'nAh'
                }
            };

            const result = translate.Certificate(context, tenantId, appId, itemId, item);
            return assert.deepStrictEqual(
                result,
                {
                    configs: [
                        {
                            command: 'sys file ssl-cert',
                            ignore: [],
                            path: '/ten2/exampleApp/useCert.crt',
                            properties: {
                                'cert-validation-options': {},
                                'cert-validators': {},
                                checksum: 'SHA1:26:2b6397ca703598ad90e9853527d1b3328e061fd8',
                                iControl_post: {
                                    ctype: 'application/octet-stream',
                                    method: 'POST',
                                    path: '/mgmt/shared/file-transfer/uploads/_ten2_exampleApp_useCert.crt',
                                    reference: '/ten2/exampleApp/useCert.crt',
                                    send: '----exampleCertificate----',
                                    why: 'upload certificate file'
                                },
                                'source-path': 'file:/var/config/rest/downloads/_ten2_exampleApp_useCert.crt'
                            }
                        },
                        {
                            command: 'sys file ssl-key',
                            ignore: [],
                            path: '/ten2/exampleApp/useCert.key',
                            properties: {
                                checksum: 'SHA1:25:34800fb4c53b8f329d400353cfa0f8dce366003a',
                                iControl_post: {
                                    ctype: 'application/octet-stream',
                                    method: 'POST',
                                    path: '/mgmt/shared/file-transfer/uploads/_ten2_exampleApp_useCert.key',
                                    reference: '/ten2/exampleApp/useCert.key',
                                    send: '----examplePrivateKey----',
                                    why: 'upload privateKey file'
                                },
                                passphrase: '"�J\\\\n�B.1��>.+"',
                                'source-path': 'file:/var/config/rest/downloads/_ten2_exampleApp_useCert.key'
                            }
                        }
                    ],
                    updatePath: true,
                    pathUpdates: [
                        {
                            oldString: '/ten2/exampleApp/useCert-bundle.crt',
                            newString: '/Common/Shared/ca_example_bundle'
                        }
                    ]
                }
            );
        });

        it('should handle bigip chainCA', () => {
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const tenantId = 'ten2';
            const appId = 'exampleApp';
            const itemId = 'useCert';
            const item = {
                class: 'Certificate',
                certificate: '----exampleCertificate----',
                chainCA: { bigip: '/Common/ca_bundle' },
                privateKey: '----examplePrivateKey----',
                passphrase: {
                    allowReuse: false,
                    ciphertext: 'l0oKiEIaMaCiPhEr',
                    ignoreChanges: false,
                    miniJWE: true,
                    protected: 'nAh'
                }
            };

            const result = translate.Certificate(context, tenantId, appId, itemId, item);
            return assert.deepStrictEqual(
                result.pathUpdates,
                [
                    {
                        oldString: '/ten2/exampleApp/useCert-bundle.crt',
                        newString: '/Common/ca_bundle'
                    }
                ]
            );
        });

        it('should handle string chainCA', () => {
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const tenantId = 'ten2';
            const appId = 'exampleApp';
            const itemId = 'useCert';
            const item = {
                class: 'Certificate',
                certificate: '----exampleCertificate----',
                chainCA: '----exampleChainCA----',
                privateKey: '----examplePrivateKey----',
                passphrase: {
                    allowReuse: false,
                    ciphertext: 'l0oKiEIaMaCiPhEr',
                    ignoreChanges: false,
                    miniJWE: true,
                    protected: 'nAh'
                }
            };

            const result = translate.Certificate(context, tenantId, appId, itemId, item);
            return assert.deepStrictEqual(
                result.configs[1],
                {
                    path: '/ten2/exampleApp/useCert-bundle.crt',
                    command: 'sys file ssl-cert',
                    properties: {
                        'cert-validation-options': {},
                        'cert-validators': {},
                        checksum: 'SHA1:22:9077d46c62461a8d7301d3b13797e796456288d5',
                        iControl_post: {
                            ctype: 'application/octet-stream',
                            method: 'POST',
                            path: '/mgmt/shared/file-transfer/uploads/_ten2_exampleApp_useCert-bundle.crt',
                            reference: '/ten2/exampleApp/useCert-bundle.crt',
                            send: '----exampleChainCA----',
                            why: 'upload chainCA file'
                        },
                        'source-path': 'file:/var/config/rest/downloads/_ten2_exampleApp_useCert-bundle.crt'
                    },
                    ignore: []
                }
            );
        });
    });

    describe('Cipher_Group', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'TLS_Server',
            tenantId: {
                class: 'Tenant',
                appId: {
                    class: 'Application',
                    template: 'generic',
                    tlsServer: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'webcert'
                            }
                        ]
                    },
                    webcert: {
                        class: 'Certificate',
                        certificate: 'some cert value'
                    },
                    myCipherGroup: {
                        class: 'Cipher_Group'
                    }
                }
            }
        };

        it('TLS_Client - should handle referencing a cipher group', () => {
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const item = {
                class: 'TLS_Client',
                authenticationFrequency: 'one-time',
                certificates: [
                    {
                        certificate: 'webcert1'
                    }
                ],
                webcert1: {
                    class: 'Certificate',
                    certificate: 'some cert value'
                },
                cipherGroup: { bigip: '/Common/myCipherGroup' }
            };
            const results = translate.TLS_Client(context, 'tenantId', 'appId', 'tlsClient', item, declaration);

            const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsClient');
            assert.deepEqual(profile.properties['cipher-group'], '/Common/myCipherGroup');
            assert.deepEqual(profile.properties.ciphers, 'none');
        });

        it('TLS_Server - should handle referencing a cipher group', () => {
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const item = {
                class: 'TLS_Server',
                authenticationFrequency: 'one-time',
                certificates: [
                    {
                        certificate: '/tenantId/appId/webcert'
                    }
                ],
                webcert: {
                    class: 'Certificate',
                    certificate: 'some cert value'
                },
                cipherGroup: { bigip: '/Common/myCipherGroup' }
            };
            const results = translate.TLS_Server(context, 'tenantId', 'appId', 'tlsServer', item, declaration);

            const profile = results.configs.find((r) => r.path === '/tenantId/appId/tlsServer');
            assert.deepEqual(profile.properties['cipher-group'], '/Common/myCipherGroup');
            assert.deepEqual(profile.properties.ciphers, 'none');
        });

        it('Cipher_Group - should handle a default object', () => {
            const item = {
                class: 'Cipher_Group'
            };
            const results = translate.Cipher_Group(defaultContext, 'tenantId', 'appId', 'myCipherGroup', item, declaration);
            const profile = results.configs.find((r) => r.path === '/tenantId/appId/myCipherGroup');
            const expectedResults = {
                allow: {}, exclude: {}, require: {}, description: 'none'
            };
            assert.deepEqual(profile.properties, expectedResults);
        });

        it('Cipher_Group - should handle a saturated object', () => {
            const item = {
                class: 'Cipher_Group',
                description: 'only the best ciphers',
                allowCipherRules: [{ bigip: '/Common/f5-aes' }],
                excludeCipherRules: [{ bigip: '/Common/f5-default' }],
                requireCipherRules: ['/Common/f5-ecc', { bigip: '/Common/f5-secure' }],
                order: 'strength'
            };
            const results = translate.Cipher_Group(defaultContext, 'tenantId', 'appId', 'myCipherGroup', item, declaration);
            const profile = results.configs.find((r) => r.path === '/tenantId/appId/myCipherGroup');
            const expectedResults = {
                allow: {
                    '/Common/f5-aes': {}
                },
                description: 'none',
                exclude: {
                    '/Common/f5-default': {}
                },
                ordering: 'strength',
                require: {
                    '/Common/f5-ecc': {},
                    '/Common/f5-secure': {}
                }
            };
            assert.deepEqual(profile.properties, expectedResults);
        });
    });

    describe('DOS_Profile', () => {
        describe('aliases', () => {
            it('should alias DOS_Profile.allowlist', () => {
                sinon.stub(util, 'isOneOfProvisioned').returns(true);
                const item = {
                    class: 'DOS_Profile',
                    allowlist: { use: 'testAllowlist' }
                };
                const expected = {
                    command: 'security dos profile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        application: {},
                        'dos-network': {},
                        'protocol-dns': {},
                        'protocol-sip': {},
                        whitelist: 'testAllowlist'
                    }
                };
                const context = { target: { tmosVersion: '14.0' } };
                const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0], expected);
            });

            it('should alias DOS_Profile.applicationAllowlist', () => {
                sinon.stub(util, 'isOneOfProvisioned').returns(true);
                const item = {
                    class: 'DOS_Profile',
                    applicationAllowlist: { use: 'testApplicationAllowList' }
                };
                const expected = {
                    command: 'security dos profile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        application: {},
                        'dos-network': {},
                        'protocol-dns': {},
                        'protocol-sip': {},
                        'http-whitelist': 'testApplicationAllowList'
                    }
                };
                const context = { target: { tmosVersion: '14.0' } };
                const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0], expected);
            });

            it('should alias DOS_Profile_Application_Bot_Defense.urlAllowlist', () => {
                sinon.stub(util, 'isOneOfProvisioned').returns(true);
                const item = {
                    class: 'DOS_Profile',
                    application: {
                        captchaResponse: {},
                        botDefense: {
                            mode: 'during-attacks',
                            urlAllowlist: [
                                'www.bing.com'
                            ]
                        }
                    }
                };
                const expected = {
                    command: 'security dos profile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        application: {
                            undefined: {
                                'captcha-response': {
                                    failure: {
                                        type: 'default'
                                    },
                                    first: {
                                        type: 'default'
                                    }
                                },
                                geolocations: {},
                                'rtbh-duration-sec': 300,
                                'rtbh-enable': 'disabled',
                                'scrubbing-duration-sec': 600,
                                'scrubbing-enable': 'disabled',
                                'bot-defense': {
                                    'external-domains': {},
                                    mode: 'during-attacks',
                                    'site-domains': {},
                                    'url-whitelist': {
                                        'www.bing.com': {}
                                    }
                                }
                            }
                        },
                        'dos-network': {},
                        'protocol-dns': {},
                        'protocol-sip': {}
                    }
                };
                const context = { target: { tmosVersion: '14.0' } };
                const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0], expected);
            });

            it('should alias DOS_Profile_Application.allowlistedGeolocations', () => {
                sinon.stub(util, 'isOneOfProvisioned').returns(true);
                const item = {
                    class: 'DOS_Profile',
                    application: {
                        captchaResponse: {},
                        allowlistedGeolocations: [
                            'Bonaire, Saint Eustatius and Saba',
                            'Cote D\'Ivoire'
                        ]
                    }
                };
                const expected = {
                    command: 'security dos profile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        application: {
                            undefined: {
                                'captcha-response': {
                                    failure: {
                                        type: 'default'
                                    },
                                    first: {
                                        type: 'default'
                                    }
                                },
                                geolocations: {
                                    '"Bonaire, Saint Eustatius and Saba"': {
                                        'white-listed': ' '
                                    },
                                    '"Cote D\'Ivoire"': {
                                        'white-listed': ' '
                                    }
                                },
                                'rtbh-duration-sec': 300,
                                'rtbh-enable': 'disabled',
                                'scrubbing-duration-sec': 600,
                                'scrubbing-enable': 'disabled'
                            }
                        },
                        'dos-network': {},
                        'protocol-dns': {},
                        'protocol-sip': {}
                    }
                };
                const context = { target: { tmosVersion: '14.0' } };
                const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0], expected);
            });

            it('should alias DOS_Profile_Application.denylistedGeolocations', () => {
                sinon.stub(util, 'isOneOfProvisioned').returns(true);
                const item = {
                    class: 'DOS_Profile',
                    application: {
                        captchaResponse: {},
                        denylistedGeolocations: [
                            'Timor-Leste',
                            'Cocos (Keeling) Islands'
                        ]
                    }
                };
                const expected = {
                    command: 'security dos profile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        application: {
                            undefined: {
                                'captcha-response': {
                                    failure: {
                                        type: 'default'
                                    },
                                    first: {
                                        type: 'default'
                                    }
                                },
                                geolocations: {
                                    '"Cocos (Keeling) Islands"': {
                                        'black-listed': ' '
                                    },
                                    '"Timor-Leste"': {
                                        'black-listed': ' '
                                    }
                                },
                                'rtbh-duration-sec': 300,
                                'rtbh-enable': 'disabled',
                                'scrubbing-duration-sec': 600,
                                'scrubbing-enable': 'disabled'
                            }
                        },
                        'dos-network': {},
                        'protocol-dns': {},
                        'protocol-sip': {}
                    }
                };
                const context = { target: { tmosVersion: '14.0' } };
                const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0], expected);
            });

            it('should alias DOS_Profile_Network_Vectors.autoDenylistSettings', () => {
                sinon.stub(util, 'isOneOfProvisioned').returns(true);
                const item = {
                    class: 'DOS_Profile',
                    network: {
                        vectors: [
                            {
                                type: 'hop-cnt-low',
                                autoDenylistSettings: {
                                    enabled: true,
                                    category: { bigip: '/Common/denial_of_service' },
                                    attackDetectionTime: 60,
                                    categoryDuration: 14400,
                                    externalAdvertisementEnabled: false
                                }
                            }
                        ]
                    }
                };
                const expected = {
                    command: 'security dos profile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        application: { },
                        'dos-network': {
                            undefined: {
                                'dynamic-signatures': { },
                                'network-attack-vector': {
                                    'hop-cnt-low': {
                                        'allow-advertisement': 'disabled',
                                        'auto-blacklisting': 'enabled',
                                        'auto-threshold': 'disabled',
                                        'blacklist-category': '/Common/denial_of_service',
                                        'blacklist-detection-seconds': '60',
                                        'blacklist-duration': '14400'
                                    }
                                }
                            }
                        },
                        'protocol-dns': {},
                        'protocol-sip': {}
                    }
                };
                const context = { target: { tmosVersion: '14.0' } };
                const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0], expected);
            });
        });

        it('should disable scrubbing and remoteTriggeredBlackHole when duration is 0 or missing ', () => {
            sinon.stub(util, 'isOneOfProvisioned').returns(true);
            let item = {
                class: 'DOS_Profile',
                application: {
                    scrubbingDuration: 0,
                    remoteTriggeredBlackHoleDuration: 0,
                    captchaResponse: {}
                }
            };

            const context = { target: { tmosVersion: '13.1' } };
            const expected = {
                path: '/tenantId/appId/itemId',
                command: 'security dos profile',
                properties: {
                    application: {
                        undefined: {
                            'captcha-response': {
                                failure: {
                                    type: 'default'
                                },
                                first: {
                                    type: 'default'
                                }
                            },
                            geolocations: {},
                            'rtbh-duration-sec': 300,
                            'rtbh-enable': 'disabled',
                            'scrubbing-duration-sec': 600,
                            'scrubbing-enable': 'disabled'
                        }
                    },
                    'dos-network': {},
                    'protocol-dns': {},
                    'protocol-sip': {}
                },
                ignore: []
            };

            let results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(results.configs[0], expected);

            item = {
                class: 'DOS_Profile',
                application: {
                    captchaResponse: {}
                }
            };
            results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(results.configs[0], expected);
        });

        it('should change malformed vectors to dns-malformed and sip-malformed', () => {
            sinon.stub(util, 'isOneOfProvisioned').returns(true);
            const item = {
                class: 'DOS_Profile',
                protocolSIP: {
                    vectors: [
                        {
                            type: 'malformed'
                        }
                    ]
                },
                protocolDNS: {
                    vectors: [
                        {
                            type: 'malformed'
                        }
                    ]
                }
            };
            const context = {
                target: {
                    tmosVersion: '14.0'
                }
            };
            const expected = {
                path: '/tenantId/appId/itemId',
                command: 'security dos profile',
                properties: {
                    application: {},
                    'dos-network': {},
                    'protocol-dns': {
                        undefined: {
                            'dns-query-vector': {
                                'dns-malformed': {
                                    'auto-threshold': 'disabled'
                                }
                            }
                        }
                    },
                    'protocol-sip': {
                        undefined: {
                            'sip-attack-vector': {
                                'sip-malformed': {
                                    'auto-threshold': 'disabled'
                                }
                            }
                        }
                    }
                },
                ignore: []
            };

            const results = translate.DOS_Profile(context, 'tenantId', 'appId', 'itemId', item);
            assert.deepEqual(results.configs[0], expected);
        });
    });

    describe('Monitor', () => {
        describe('Database Monitors', () => {
            const testCases = [
                'mysql',
                'postgresql'
            ];
            testCases.forEach((testCase) => {
                it(`should handle default ${testCase} monitor`, () => {
                    const item = {
                        class: 'Monitor',
                        monitorType: testCase
                    };

                    const results = translate.Monitor(defaultContext, 'tenantId', 'appId', 'itemId', item);
                    assert.deepEqual(results.configs[0],
                        {
                            path: '/tenantId/appId/itemId',
                            command: `ltm monitor ${testCase}`,
                            properties: {
                                database: 'none',
                                description: 'none',
                                destination: '*:*',
                                password: 'none',
                                recv: 'none',
                                'recv-column': 'none',
                                'recv-row': 'none',
                                send: 'none',
                                username: 'none'
                            },
                            ignore: []
                        });
                });

                it(`should handle populated ${testCase} monitor`, () => {
                    const item = {
                        class: 'Monitor',
                        monitorType: testCase,
                        count: 10,
                        database: 'sales',
                        interval: 10,
                        password: 'sql-password',
                        recv: 'received something',
                        'recv-column': 2,
                        'recv-row': 3,
                        remark: 'My little db pony',
                        send: 'SELECT * FROM db_name',
                        targetAddress: '10.11.12.13',
                        targetPort: '3456',
                        timeUntilUp: 30,
                        timeout: 81,
                        'up-interval': 5,
                        username: 'sql-user'
                    };

                    const results = translate.Monitor(defaultContext, 'tenantId', 'appId', 'itemId', item);
                    assert.deepEqual(results.configs[0],
                        {
                            path: '/tenantId/appId/itemId',
                            command: `ltm monitor ${testCase}`,
                            properties: {
                                description: '"My little db pony"',
                                destination: '10.11.12.13:3456',
                                interval: 10,
                                password: '"sql-password"',
                                recv: '"received something"',
                                send: '"SELECT * FROM db_name"',
                                timeout: 81,
                                'time-until-up': 30,
                                username: 'sql-user',
                                'up-interval': 5,
                                count: 10,
                                database: 'sales',
                                'recv-column': 2,
                                'recv-row': 3
                            },
                            ignore: []
                        });
                });
            });
        });

        describe('Monitor HTTP2', () => {
            it('should handle default http2 monitor', () => {
                const item = {
                    class: 'Monitor',
                    monitorType: 'http2'
                };

                const results = translate.Monitor(defaultContext, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0],
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm monitor http2',
                        properties: {
                            description: 'none',
                            destination: '*:*',
                            'ssl-profile': 'none',
                            username: 'none'
                        },
                        ignore: []
                    });
            });

            it('should handle populated http2 monitor', () => {
                const item = {
                    class: 'Monitor',
                    clientTLS: {
                        bigip: '/Common/serverssl'
                    },
                    monitorType: 'http2',
                    interval: 10,
                    receiveDown: 'down',
                    receive: 'HTTP/2.',
                    send: 'GET /\\r\\n\\r\\n',
                    timeUntilUp: 15,
                    timeout: 123
                };

                const results = translate.Monitor(defaultContext, 'tenantId', 'appId', 'itemId', item);
                assert.deepEqual(results.configs[0],
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'ltm monitor http2',
                        properties: {
                            description: 'none',
                            destination: '*:*',
                            interval: 10,
                            recv: '"HTTP/2."',
                            'recv-disable': '"down"',
                            send: '"GET /\\\\r\\\\n\\\\r\\\\n"',
                            'ssl-profile': '/Common/serverssl',
                            timeout: 123,
                            'time-until-up': 15,
                            username: 'none'
                        },
                        ignore: []
                    });
            });
        });

        describe('external monitors', () => {
            const testClass = {
                ltm: 'Monitor',
                gtm: 'GSLB_Monitor'
            };
            ['ltm', 'gtm'].forEach((module) => {
                it(`should handle ${module} external monitor with pathname`, () => {
                    const item = {
                        class: testClass[module],
                        monitorType: 'external',
                        pathname: '/path/to/the.file',
                        environmentVariables: {
                            key: 'value',
                            USER: 'two words'
                        },
                        destination: module === 'gtm' ? '*:*' : undefined
                    };
                    const expected = {
                        command: `${module} monitor external`,
                        ignore: [],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            args: 'none',
                            description: 'none',
                            destination: '*:*',
                            run: '/path/to/the.file',
                            'user-defined': {
                                key: '"value"',
                                USER: '"two words"'
                            }
                        }
                    };
                    const results = translate[testClass[module]](defaultContext, 'tenantId', 'appId', 'itemId', item);
                    assert.deepStrictEqual(results.configs[0], expected);
                });

                it(`should handle ${module} external monitor with a script`, () => {
                    const item = {
                        class: testClass[module],
                        monitorType: 'external',
                        script: 'This is the script',
                        destination: module === 'gtm' ? '*:*' : undefined
                    };
                    const expected = [
                        {
                            path: '/tenantId/appId/itemId-script',
                            command: 'sys file external-monitor',
                            properties: {
                                'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_itemId',
                                iControl_post: {
                                    reference: '/tenantId/appId/itemId-external-monitor',
                                    path: '/mgmt/shared/file-transfer/uploads/_tenantId_appId_itemId',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    send: 'This is the script',
                                    why: 'upload script file'
                                }
                            },
                            ignore: []
                        },
                        {
                            path: '/tenantId/appId/itemId',
                            command: `${module} monitor external`,
                            properties: {
                                description: 'none',
                                destination: '*:*',
                                args: 'none',
                                run: '/tenantId/appId/itemId-script'
                            },
                            ignore: []
                        }
                    ];
                    const results = translate[testClass[module]](defaultContext, 'tenantId', 'appId', 'itemId', item);
                    assert.deepStrictEqual(results.configs, expected);
                });
            });
        });
    });

    describe('GSLB_Domain', () => {
        it('should return a proper wideip AAAA config with pools', () => {
            const item = {
                class: 'GSLB_Domain',
                domainName: 'example.edu',
                enabled: true,
                poolLbMode: 'round-robin',
                pools: [
                    { use: '/ten/app/pool1', ratio: 1 },
                    { use: '/ten/app/pool2', ratio: 2 },
                    { use: '/ten/app/pool3', ratio: 3 }
                ],
                resourceRecordType: 'AAAA'
            };

            const results = translate.GSLB_Domain(defaultContext, 'ten', 'app', 'example.edu', item);
            return assert.deepStrictEqual(
                results,
                {
                    configs: [
                        {
                            command: 'gtm wideip aaaa',
                            ignore: [],
                            path: '/ten/app/example.edu',
                            properties: {
                                aliases: {},
                                enabled: true,
                                'last-resort-pool': 'none',
                                'pool-lb-mode': 'round-robin',
                                pools: {
                                    '/ten/app/pool2': { order: 1, ratio: 2 },
                                    '/ten/app/pool3': { order: 2, ratio: 3 },
                                    '/ten/app/pool1': { order: 0, ratio: 1 }
                                },
                                'pools-cname': {},
                                rules: {}
                            }
                        }
                    ]
                }
            );
        });

        it('should return a proper wideip AAAA config without pools', () => {
            const item = {
                class: 'GSLB_Domain',
                domainName: 'example.edu',
                enabled: true,
                poolLbMode: 'round-robin',
                resourceRecordType: 'AAAA'
            };

            const results = translate.GSLB_Domain(defaultContext, 'ten', 'app', 'example.edu', item);
            return assert.deepStrictEqual(
                results,
                {
                    configs: [
                        {
                            command: 'gtm wideip aaaa',
                            ignore: [],
                            path: '/ten/app/example.edu',
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
                    ]
                }
            );
        });

        it('should return a proper wideip AAAA config with iRules', () => {
            const item = {
                class: 'GSLB_Domain',
                domainName: 'example.edu',
                enabled: true,
                poolLbMode: 'round-robin',
                iRules: [
                    '/ten/app/rule1',
                    { use: '/ten/app/rule2' },
                    { bigip: '/Common/rule3' }
                ],
                resourceRecordType: 'AAAA'
            };

            const results = translate.GSLB_Domain(defaultContext, 'ten', 'app', 'example.edu', item);
            return assert.deepStrictEqual(
                results,
                {
                    configs: [
                        {
                            command: 'gtm wideip aaaa',
                            ignore: [],
                            path: '/ten/app/example.edu',
                            properties: {
                                aliases: {},
                                enabled: true,
                                'last-resort-pool': 'none',
                                'pool-lb-mode': 'round-robin',
                                pools: {},
                                'pools-cname': {},
                                rules: {
                                    '/ten/app/rule1': {},
                                    '/ten/app/rule2': {},
                                    '/Common/rule3': {}
                                }
                            }
                        }
                    ]
                }
            );
        });
    });

    describe('GSLB_Server', () => {
        it('should return a config with minimum item values for 13+ versions', () => {
            const item = {
                class: 'GSLB_Server',
                devices: [{ address: '1.2.3.3' }],
                virtualServers: [
                    {
                        address: '1.2.3.4',
                        port: 1000,
                        enabled: true,
                        addressTranslationPort: 0
                    },
                    {
                        address: '1.2.3.5',
                        port: 1111,
                        enabled: true,
                        addressTranslationPort: 0
                    }
                ],
                monitors: [{ bigip: '/Common/bigip' }]
            };
            const results = translate.GSLB_Server(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm server',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            description: 'none',
                            metadata: {
                                as3: {
                                    persist: 'true'
                                },
                                'as3-virtuals': {
                                    persist: 'true',
                                    value: '1.2.3.4:1000_1.2.3.5:1111'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            devices: {
                                0: {
                                    addresses: {
                                        '1.2.3.3': { translation: 'none' }
                                    }
                                }
                            },
                            'virtual-servers': {
                                0: {
                                    destination: '1.2.3.4:1000',
                                    enabled: true,
                                    monitor: [],
                                    'translation-address': 'none',
                                    'translation-port': 0
                                },
                                1: {
                                    destination: '1.2.3.5:1111',
                                    enabled: true,
                                    monitor: [],
                                    'translation-address': 'none',
                                    'translation-port': 0
                                }
                            }
                        }
                    }
                ]
            });
        });

        it('minimum set for two devices for 13+ versions', () => {
            const item = {
                class: 'GSLB_Server',
                devices: [{ address: '1.2.3.2' }, { address: '1.2.3.3' }],
                virtualServers: [
                    {
                        address: '1.2.3.4',
                        port: 1000,
                        enabled: true,
                        addressTranslationPort: 0
                    },
                    {
                        address: '1.2.3.5',
                        port: 1111,
                        enabled: true,
                        addressTranslationPort: 0
                    }
                ],
                monitors: [{ bigip: '/Common/bigip' }]
            };
            const results = translate.GSLB_Server(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm server',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            description: 'none',
                            metadata: {
                                as3: {
                                    persist: 'true'
                                },
                                'as3-virtuals': {
                                    persist: 'true',
                                    value: '1.2.3.4:1000_1.2.3.5:1111'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            devices: {
                                0: {
                                    addresses: {
                                        '1.2.3.2': { translation: 'none' }
                                    }
                                },
                                1: {
                                    addresses: {
                                        '1.2.3.3': { translation: 'none' }
                                    }
                                }
                            },
                            'virtual-servers': {
                                0: {
                                    destination: '1.2.3.4:1000',
                                    enabled: true,
                                    monitor: [],
                                    'translation-address': 'none',
                                    'translation-port': 0
                                },
                                1: {
                                    destination: '1.2.3.5:1111',
                                    enabled: true,
                                    monitor: [],
                                    'translation-address': 'none',
                                    'translation-port': 0
                                }
                            }
                        }
                    }
                ]
            });
        });

        it('should return a config with the specified names or indexes for 13+ versions', () => {
            const item = {
                class: 'GSLB_Server',
                devices: [{ address: '1.2.3.3' }],
                virtualServers: [
                    {
                        address: '1.2.3.4',
                        port: 1000,
                        enabled: true,
                        addressTranslationPort: 0,
                        name: 'foobar'
                    },
                    {
                        address: '1.2.3.5',
                        port: 1111,
                        enabled: true,
                        addressTranslationPort: 0
                    }
                ],
                monitors: [{ bigip: '/Common/bigip' }]
            };

            const results = translate.GSLB_Server(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm server',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            devices: {
                                0: {
                                    addresses: {
                                        '1.2.3.3': { translation: 'none' }
                                    }
                                }
                            },
                            description: 'none',
                            metadata: {
                                as3: {
                                    persist: 'true'
                                },
                                'as3-virtuals': {
                                    persist: 'true',
                                    value: '1.2.3.4:1000_1.2.3.5:1111'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            'virtual-servers': {
                                foobar: {
                                    destination: '1.2.3.4:1000',
                                    enabled: true,
                                    monitor: [],
                                    'translation-address': 'none',
                                    'translation-port': 0
                                },
                                1: {
                                    destination: '1.2.3.5:1111',
                                    enabled: true,
                                    monitor: [],
                                    'translation-address': 'none',
                                    'translation-port': 0
                                }
                            }
                        }
                    }
                ]
            });
        });
    });

    describe('GSLB_Topology_Records', () => {
        let item;

        beforeEach(() => {
            item = {
                class: 'GSLB_Topology_Records',
                longestMatchEnabled: false,
                records: [
                    {
                        destination: {
                            matchType: 'datacenter',
                            matchOperator: 'equals',
                            matchValue: { use: 'voip' }
                        },
                        source: {
                            matchType: 'subnet',
                            matchOperator: 'equals',
                            matchValue: '10.0.0.1/32'
                        },
                        weight: 5
                    }
                ]
            };
        });
        it('should return a translated config with order not set in 14.0-', () => {
            defaultContext.target.tmosVersion = '14.0.0';

            const results = translate.GSLB_Topology_Records(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(
                results.configs,
                [
                    {
                        command: 'gtm global-settings load-balancing',
                        ignore: [],
                        path: '/Common/global-settings',
                        properties: { 'topology-longest-match': 'no' }
                    },
                    {
                        command: 'gtm topology',
                        ignore: [],
                        path: '/tenantId/topology/records',
                        properties: {
                            records: {
                                0: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'subnet 10.0.0.1/32',
                                    score: 5,
                                    'server:': 'datacenter voip'
                                }
                            }
                        }
                    }
                ]
            );
        });

        it('should return a translated config with order set in 14.1+', () => {
            defaultContext.target.tmosVersion = '14.1.0';

            const results = translate.GSLB_Topology_Records(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(
                results.configs,
                [
                    {
                        command: 'gtm global-settings load-balancing',
                        ignore: [],
                        path: '/Common/global-settings',
                        properties: { 'topology-longest-match': 'no' }
                    },
                    {
                        command: 'gtm topology',
                        ignore: [],
                        path: '/tenantId/topology/records',
                        properties: {
                            records: {
                                0: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'subnet 10.0.0.1/32',
                                    order: 1,
                                    score: 5,
                                    'server:': 'datacenter voip'
                                }
                            }
                        }
                    }
                ]
            );
        });
    });

    describe('GSLB_Topology_Region', () => {
        it('should return a translated config', () => {
            const item = {
                class: 'GSLB_Topology_Region',
                members: [
                    {
                        matchType: 'continent',
                        matchOperator: 'equals',
                        matchValue: '--'
                    }
                ]
            };

            const results = translate.GSLB_Topology_Region(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm region',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            description: '"This object is managed by appsvcs, do not modify this description"',
                            'region-members': {
                                'continent --': {
                                    continent: '--',
                                    not: 'none'
                                }
                            }
                        }
                    }
                ]
            });
        });

        it('should return a translated config when referencing another GSLB_Topology_Region', () => {
            const item = {
                class: 'GSLB_Topology_Region',
                members: [
                    {
                        matchType: 'region',
                        matchOperator: 'not-equals',
                        matchValue: { use: '/Common/Shared/regionGSLBUnknown' }
                    }
                ]
            };

            const results = translate.GSLB_Topology_Region(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm region',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            description: '"This object is managed by appsvcs, do not modify this description"',
                            'region-members': {
                                'not region /Common/regionGSLBUnknown': {
                                    not: 'not',
                                    region: '/Common/regionGSLBUnknown'
                                }
                            }
                        }
                    }
                ]
            });
        });

        it('should return a translated config when referencing a GSLB_Data_Center', () => {
            const item = {
                class: 'GSLB_Topology_Region',
                members: [
                    {
                        matchType: 'datacenter',
                        matchOperator: 'not-equals',
                        matchValue: { use: '/Common/Shared/dataCenterGSLB' }
                    }
                ]
            };

            const results = translate.GSLB_Topology_Region(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm region',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            description: '"This object is managed by appsvcs, do not modify this description"',
                            'region-members': {
                                'not datacenter /Common/dataCenterGSLB': {
                                    not: 'not',
                                    datacenter: '/Common/dataCenterGSLB'
                                }
                            }
                        }
                    }
                ]
            });
        });

        it('should return a translated config when referencing a GSLB_Pool', () => {
            const item = {
                class: 'GSLB_Topology_Region',
                members: [
                    {
                        matchType: 'pool',
                        matchOperator: 'equals',
                        matchValue: { use: '/Common/Shared/poolGSLB' }
                    }
                ]
            };

            const results = translate.GSLB_Topology_Region(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        command: 'gtm region',
                        ignore: [],
                        path: '/tenantId/itemId',
                        properties: {
                            description: '"This object is managed by appsvcs, do not modify this description"',
                            'region-members': {
                                'pool /Common/Shared/poolGSLB': {
                                    not: 'none',
                                    pool: '/Common/Shared/poolGSLB'
                                }
                            }
                        }
                    }
                ]
            });
        });
    });

    describe('GSLB_Pool A', () => {
        it('should return a correct config using minimum amounts of information', () => {
            const item = {
                class: 'GSLB_Pool',
                resourceRecordType: 'A'
            };

            const results = translate.GSLB_Pool(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'gtm pool a',
                        ignore: [],
                        properties: {
                            members: {},
                            monitor: 'default',
                            'fallback-ip': 'any',
                            'limit-max-bps': 0,
                            'limit-max-bps-status': 'disabled',
                            'limit-max-pps': 0,
                            'limit-max-pps-status': 'disabled',
                            'limit-max-connections': 0,
                            'limit-max-connections-status': 'disabled',
                            'qos-hit-ratio': 5,
                            'qos-hops': 0,
                            'qos-kilobytes-second': 3,
                            'qos-lcs': 30,
                            'qos-packet-rate': 1,
                            'qos-rtt': 50,
                            'qos-topology': 0,
                            'qos-vs-capacity': 0,
                            'qos-vs-score': 0
                        }
                    }
                ]
            });
        });

        it('should return a correct config when members are specified', () => {
            const item = {
                class: 'GSLB_Pool',
                resourceRecordType: 'A',
                members: [
                    {
                        ratio: 10,
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: 'none'
                    },
                    {
                        ratio: 15,
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: 'funky',
                        dependsOn: [
                            '/Common/Shared/testServer:1',
                            '/Common/Shared/testServer:2'
                        ]
                    }
                ]
            };

            const results = translate.GSLB_Pool(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'gtm pool a',
                        ignore: [],
                        properties: {
                            members: {
                                '/Common/testServer:0': {
                                    'depends-on': 'none',
                                    'member-order': 0,
                                    ratio: 10
                                },
                                '/Common/testServer:funky': {
                                    'depends-on': {
                                        '/Common/testServer:1': {},
                                        '/Common/testServer:2': {}
                                    },
                                    'member-order': 1,
                                    ratio: 15
                                }
                            },
                            monitor: 'default',
                            'fallback-ip': 'any',
                            'limit-max-bps': 0,
                            'limit-max-bps-status': 'disabled',
                            'limit-max-pps': 0,
                            'limit-max-pps-status': 'disabled',
                            'limit-max-connections': 0,
                            'limit-max-connections-status': 'disabled',
                            'qos-hit-ratio': 5,
                            'qos-hops': 0,
                            'qos-kilobytes-second': 3,
                            'qos-lcs': 30,
                            'qos-packet-rate': 1,
                            'qos-rtt': 50,
                            'qos-topology': 0,
                            'qos-vs-capacity': 0,
                            'qos-vs-score': 0
                        }
                    }
                ]
            });
        });
    });

    describe('GSLB_Pool AAAA', () => {
        it('should return a correct config using minimum amounts of information', () => {
            const item = {
                class: 'GSLB_Pool',
                resourceRecordType: 'AAAA'
            };

            const results = translate.GSLB_Pool(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'gtm pool aaaa',
                        ignore: [],
                        properties: {
                            members: {},
                            monitor: 'default',
                            'fallback-ip': 'any',
                            'limit-max-bps': 0,
                            'limit-max-bps-status': 'disabled',
                            'limit-max-pps': 0,
                            'limit-max-pps-status': 'disabled',
                            'limit-max-connections': 0,
                            'limit-max-connections-status': 'disabled',
                            'qos-hit-ratio': 5,
                            'qos-hops': 0,
                            'qos-kilobytes-second': 3,
                            'qos-lcs': 30,
                            'qos-packet-rate': 1,
                            'qos-rtt': 50,
                            'qos-topology': 0,
                            'qos-vs-capacity': 0,
                            'qos-vs-score': 0
                        }
                    }
                ]
            });
        });

        it('should return a correct config when members are specified', () => {
            const item = {
                class: 'GSLB_Pool',
                resourceRecordType: 'AAAA',
                members: [
                    {
                        ratio: 10,
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: '0',
                        dependsOn: [
                            '/Common/Shared/testServer:0'
                        ]
                    },
                    {
                        ratio: 15,
                        server: {
                            use: '/Common/Shared/testServer'
                        },
                        virtualServer: 'funky'
                    }
                ]
            };

            const results = translate.GSLB_Pool(defaultContext, 'tenantId', 'appId', 'itemId', item);
            return assert.deepStrictEqual(results, {
                configs: [
                    {
                        path: '/tenantId/appId/itemId',
                        command: 'gtm pool aaaa',
                        ignore: [],
                        properties: {
                            members: {
                                '/Common/testServer:0': {
                                    'depends-on': {
                                        '/Common/testServer:0': {}
                                    },
                                    'member-order': 0,
                                    ratio: 10
                                },
                                '/Common/testServer:funky': {
                                    'depends-on': 'none',
                                    'member-order': 1,
                                    ratio: 15
                                }
                            },
                            monitor: 'default',
                            'fallback-ip': 'any',
                            'limit-max-bps': 0,
                            'limit-max-bps-status': 'disabled',
                            'limit-max-pps': 0,
                            'limit-max-pps-status': 'disabled',
                            'limit-max-connections': 0,
                            'limit-max-connections-status': 'disabled',
                            'qos-hit-ratio': 5,
                            'qos-hops': 0,
                            'qos-kilobytes-second': 3,
                            'qos-lcs': 30,
                            'qos-packet-rate': 1,
                            'qos-rtt': 50,
                            'qos-topology': 0,
                            'qos-vs-capacity': 0,
                            'qos-vs-score': 0
                        }
                    }
                ]
            });
        });
    });

    describe('Address_Discovery', () => {
        it('should create Address_Discovery config', () => {
            const item = {
                class: 'Address_Discovery',
                addressDiscovery: 'aws',
                updateInterval: 60,
                tagKey: 'foo',
                tagValue: 'bar',
                addressRealm: 'private',
                region: 'us-west-1',
                accessKeyId: 'keyId',
                secretAccessKey: 'secret',
                credentialUpdate: false,
                undetectableAction: 'remove',
                resources: [
                    {
                        item: {
                            class: 'Pool',
                            monitors: ['http', 'https'],
                            members: [
                                {
                                    servicePort: 80,
                                    addressDiscovery: {
                                        use: '/Tenant/ApplicationOne/discoveryObject'
                                    },
                                    enable: true,
                                    connectionLimit: 0,
                                    rateLimit: -1,
                                    dynamicRatio: 1,
                                    ratio: 1,
                                    priorityGroup: 0,
                                    adminState: 'enable',
                                    shareNodes: false
                                }
                            ],
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 10,
                            minimumMonitors: 1
                        },
                        path: '/Tenant/ApplicationOne/pool1',
                        member: {
                            servicePort: 80,
                            addressDiscovery: {
                                use: '/Tenant/ApplicationOne/discoveryObject'
                            },
                            enable: true,
                            connectionLimit: 0,
                            rateLimit: -1,
                            dynamicRatio: 1,
                            ratio: 1,
                            priorityGroup: 0,
                            adminState: 'enable',
                            shareNodes: false
                        }
                    },
                    {
                        item: {
                            class: 'Pool',
                            monitors: ['http'],
                            members: [
                                {
                                    servicePort: 8080,
                                    addressDiscovery: {
                                        use: '/Tenant/ApplicationOne/discoveryObject'
                                    },
                                    enable: true,
                                    connectionLimit: 10,
                                    rateLimit: 123,
                                    dynamicRatio: 20,
                                    ratio: 12,
                                    priorityGroup: 1,
                                    adminState: 'enable',
                                    shareNodes: false,
                                    monitors: ['https']
                                }
                            ],
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 10,
                            minimumMonitors: 1
                        },
                        path: '/Tenant/ApplicationOne/pool2',
                        member: {
                            servicePort: 8080,
                            addressDiscovery: {
                                use: '/Tenant/ApplicationOne/discoveryObject'
                            },
                            enable: true,
                            connectionLimit: 10,
                            rateLimit: 123,
                            dynamicRatio: 20,
                            ratio: 12,
                            priorityGroup: 1,
                            adminState: 'enable',
                            shareNodes: false,
                            monitors: ['https']
                        }
                    }
                ]
            };
            const results = translate.Address_Discovery(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                results,
                {
                    configs: [
                        {
                            path: '/tenantId/~tenantId~flt22BuK0m8Kx9QPD68woD~I8gIcGp2BE4Srdyzb24HPk3D',
                            command: 'mgmt shared service-discovery task',
                            properties: {
                                schemaVersion: '1.0.0',
                                id: '~tenantId~flt22BuK0m8Kx9QPD68woD~I8gIcGp2BE4Srdyzb24HPk3D',
                                updateInterval: 60,
                                resources: {
                                    0: {
                                        type: 'pool',
                                        path: '/Tenant/ApplicationOne/pool1',
                                        options: {
                                            servicePort: 80,
                                            connectionLimit: 0,
                                            rateLimit: 'disabled',
                                            dynamicRatio: 1,
                                            ratio: 1,
                                            priorityGroup: 0,
                                            monitor: 'default'
                                        }
                                    },
                                    1: {
                                        type: 'pool',
                                        path: '/Tenant/ApplicationOne/pool2',
                                        options: {
                                            servicePort: 8080,
                                            connectionLimit: 10,
                                            rateLimit: 123,
                                            dynamicRatio: 20,
                                            ratio: 12,
                                            priorityGroup: 1,
                                            monitor: 'min 1 of \\{ /Common/https \\}'
                                        }
                                    }
                                },
                                provider: 'aws',
                                providerOptions: {
                                    tagKey: 'foo',
                                    tagValue: 'bar',
                                    addressRealm: 'private',
                                    region: 'us-west-1',
                                    accessKeyId: 'keyId',
                                    secretAccessKey: 'secret'
                                },
                                nodePrefix: '/tenantId/',
                                metadata: {
                                    configuredBy: 'AS3'
                                },
                                routeDomain: 0
                            },
                            ignore: ['providerOptions.secretAccessKey']
                        }
                    ]
                }
            );
        });

        it('should handle no resources', () => {
            const item = {
                class: 'Address_Discovery',
                addressDiscovery: 'event'
            };
            const results = translate.Address_Discovery(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                results,
                {
                    configs: [
                        {
                            command: 'mgmt shared service-discovery task',
                            ignore: [],
                            path: '/tenantId/~tenantId~appId~itemId',
                            properties: {
                                id: '~tenantId~appId~itemId',
                                metadata: {
                                    configuredBy: 'AS3'
                                },
                                nodePrefix: '/tenantId/',
                                provider: 'event',
                                providerOptions: {},
                                resources: {},
                                routeDomain: 0,
                                schemaVersion: '1.0.0',
                                updateInterval: 0
                            }
                        }
                    ]
                }
            );
        });
    });

    describe('HTTP2_Profile', () => {
        let baseConfig;

        beforeEach(() => {
            defaultContext.target.tmosVersion = '13.1.0.0';

            baseConfig = {
                configs: [
                    {
                        command: 'ltm profile http2',
                        ignore: [],
                        path: '/tenantId/appId/itemId'
                    }
                ]
            };
        });

        it('should create correct config with default values', () => {
            const item = {
                class: 'HTTP2_Profile',
                activationMode: 'alpn',
                concurrentStreamsPerConnection: 10,
                connectionIdleTimeout: 300,
                enforceTlsRequirements: true,
                frameSize: 2048,
                headerTableSize: 4096,
                includeContentLength: false,
                insertHeader: false,
                insertHeaderName: 'X-HTTP2',
                receiveWindow: 32,
                writeSize: 16384
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                'activation-modes': {
                    alpn: {}
                },
                'concurrent-streams-per-connection': 10,
                'connection-idle-timeout': 300,
                description: 'none',
                'enforce-tls-requirements': 'enabled',
                'frame-size': 2048,
                'header-table-size': 4096,
                'include-content-length': 'disabled',
                'insert-header': 'disabled',
                'insert-header-name': '"X-HTTP2"',
                'receive-window': 32,
                'write-size': 16384
            };

            const result = translate.HTTP2_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });

        it('should create correct config with all properties', () => {
            const item = {
                class: 'HTTP2_Profile',
                label: 'test label',
                remark: 'test remark',
                activationMode: 'always',
                concurrentStreamsPerConnection: 250,
                connectionIdleTimeout: 350,
                enforceTlsRequirements: false,
                frameSize: 1024,
                headerTableSize: 0,
                includeContentLength: true,
                insertHeader: true,
                insertHeaderName: 'X-TEST-HEADER',
                receiveWindow: 16,
                writeSize: 2048
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                'activation-modes': {
                    always: {}
                },
                'concurrent-streams-per-connection': 250,
                'connection-idle-timeout': 350,
                description: '"test remark"',
                'enforce-tls-requirements': 'disabled',
                'frame-size': 1024,
                'header-table-size': 0,
                'include-content-length': 'enabled',
                'insert-header': 'enabled',
                'insert-header-name': '"X-TEST-HEADER"',
                'receive-window': 16,
                'write-size': 2048
            };

            const result = translate.HTTP2_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('Multiplex_Profile', () => {
        let baseConfig;

        beforeEach(() => {
            defaultContext.target.tmosVersion = '13.1.0.0';

            baseConfig = {
                configs: [
                    {
                        command: 'ltm profile one-connect',
                        ignore: [],
                        path: '/tenantId/appId/itemId'
                    }
                ]
            };
        });

        it('should create correct config with default values', () => {
            const item = {
                class: 'Multiplex_Profile',
                maxConnections: 10000,
                maxConnectionAge: 86400,
                maxConnectionReuse: 1000,
                idleTimeoutOverride: 0,
                connectionLimitEnforcement: 'none',
                sharePools: false
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                description: 'none',
                'idle-timeout-override': 0,
                'limit-type': 'none',
                'max-age': 86400,
                'max-reuse': 1000,
                'max-size': 10000,
                'share-pools': 'disabled',
                'source-mask': 'any'
            };

            const result = translate.Multiplex_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });

        it('should create correct config with all properties', () => {
            const item = {
                class: 'Multiplex_Profile',
                label: 'test label',
                remark: 'test remark',
                sourceMask: '192.0.2.10',
                maxConnections: 100,
                maxConnectionAge: 200,
                maxConnectionReuse: 300,
                idleTimeoutOverride: 400,
                connectionLimitEnforcement: 'strict',
                sharePools: true
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                description: '"test remark"',
                'idle-timeout-override': 400,
                'limit-type': 'strict',
                'max-age': 200,
                'max-reuse': 300,
                'max-size': 100,
                'share-pools': 'enabled',
                'source-mask': '192.0.2.10'
            };

            const result = translate.Multiplex_Profile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('DNS_Cache', () => {
        let baseConfig;

        beforeEach(() => {
            defaultContext.target.tmosVersion = '14.0.0.0';

            baseConfig = {
                configs: [
                    {
                        command: 'ltm dns cache transparent',
                        ignore: [],
                        path: '/tenantId/appId/itemId'
                    }
                ]
            };
        });

        it('should create correct config with default values', () => {
            const item = {
                class: 'DNS_Cache',
                type: 'transparent',
                answerDefaultZones: false,
                messageCacheSize: 1048576,
                recordCacheSize: 10485760,
                recordRotationMethod: 'none'
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                'answer-default-zones': 'no',
                'local-zones': 'none',
                'msg-cache-size': 1048576,
                'rrset-cache-size': 10485760,
                'rrset-rotate': 'none'
            };

            const result = translate.DNS_Cache(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });

        it('should create correct config with all properties', () => {
            const item = {
                class: 'DNS_Cache',
                label: 'test label',
                remark: 'test remark',
                type: 'transparent',
                answerDefaultZones: true,
                localZones: {
                    '_sip._tcp.example.com': {
                        type: 'static',
                        records: [
                            '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                        ]
                    },
                    'tworecords.com': {
                        type: 'transparent',
                        records: [
                            'wiki.tworecords.com 300 IN A 10.10.10.125',
                            'wiki.tworecords.com 300 IN A 10.10.10.126'
                        ]
                    }
                },
                messageCacheSize: 100,
                recordCacheSize: 200,
                recordRotationMethod: 'query-id'
            };

            const expected = baseConfig;
            expected.configs[0].properties = {
                'answer-default-zones': 'yes',
                description: '"test remark"',
                'local-zones': {
                    '_sip._tcp.example.com': {
                        name: '_sip._tcp.example.com',
                        records: {
                            '"_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com"': {}
                        },
                        type: 'static'
                    },
                    'tworecords.com': {
                        name: 'tworecords.com',
                        records: {
                            '"wiki.tworecords.com 300 IN A 10.10.10.125"': {},
                            '"wiki.tworecords.com 300 IN A 10.10.10.126"': {}
                        },
                        type: 'transparent'
                    }
                },
                'msg-cache-size': 100,
                'rrset-cache-size': 200,
                'rrset-rotate': 'query-id'
            };

            const result = translate.DNS_Cache(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('Service_Forwarding', () => {
        it('should create a Service_Address with ARP and ICMP Echo disabled', () => {
            const item = {
                class: 'Service_Forwarding',
                enable: true,
                forwardingType: 'ip',
                virtualAddresses: [
                    '0.0.0.0'
                ],
                virtualPort: 30123
            };

            const expected = {
                address: 'any',
                arp: 'disabled',
                'icmp-echo': 'disabled',
                mask: 'any',
                'route-advertisement': 'disabled',
                spanning: 'disabled',
                'traffic-group': 'default'
            };

            const result = translate.Service_Forwarding(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(result.configs[0].properties, expected);
        });
    });

    describe('iFile', () => {
        let item;

        beforeEach(() => {
            item = {
                class: 'iFile',
                remark: 'The iFile',
                iFile: {}
            };
        });

        it('should create correct config for iFile with big-ip reference', () => {
            item.iFile.bigip = '/Common/iFile';
            const result = translate.iFile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                result.configs[0],
                {
                    command: 'ltm ifile',
                    ignore: [],
                    path: '/tenantId/appId/itemId',
                    properties: {
                        description: '"The iFile"',
                        'file-name': '/Common/iFile'
                    }
                }
            );
        });

        it('should create correct config with url', () => {
            item.iFile = 'Look, an iFile!';
            const result = translate.iFile(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                result.configs,
                [
                    {
                        command: 'sys file ifile',
                        ignore: [],
                        path: '/tenantId/appId/itemId-ifile',
                        properties: {
                            iControl_post: {
                                ctype: 'application/octet-stream',
                                method: 'POST',
                                path: '/mgmt/shared/file-transfer/uploads/_tenantId_appId_itemId',
                                reference: '/tenantId/appId/itemId-ifile',
                                send: 'Look, an iFile!',
                                why: 'upload ifile'
                            },
                            'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_itemId'
                        }
                    },
                    {
                        command: 'ltm ifile',
                        ignore: [],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            description: '"The iFile"',
                            'file-name': '/tenantId/appId/itemId-ifile'
                        }
                    }
                ]
            );
        });
    });

    describe('Data_Group', () => {
        let item;

        beforeEach(() => {
            item = {
                class: 'Data_Group',
                storageType: 'internal',
                keyDataType: 'integer'
            };
        });

        it('should create correct config for internal Data_Group', () => {
            item.records = [
                {
                    key: 1,
                    value: 'value 1'
                },
                {
                    key: 2,
                    value: 'value 2'
                }
            ];
            const result = translate.Data_Group(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                result.configs,
                [
                    {
                        command: 'ltm data-group internal',
                        ignore: [],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            description: 'none',
                            records: {
                                '"1"': {
                                    data: '"value 1"'
                                },
                                '"2"': {
                                    data: '"value 2"'
                                }
                            },
                            type: 'integer'
                        }
                    }
                ]
            );
        });

        it('should create correct config for external Data_Group', () => {
            item.storageType = 'external';
            item.externalFilePath = {
                url: 'https://the.data.group',
                skipCertificateCheck: true
            };
            const result = translate.Data_Group(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                result.configs,
                [
                    {
                        command: 'ltm data-group external',
                        ignore: [],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            description: 'none',
                            'source-path': '"https://the.data.group"',
                            type: 'integer'
                        }
                    },
                    {
                        command: 'sys file data-group',
                        ignore: [],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            'data-group-name': '/tenantId/appId/itemId',
                            'source-path': 'https://the.data.group',
                            type: 'integer'
                        }
                    }
                ]
            );
        });

        it('should handle ignoreChanges in external Data_Group', () => {
            item.path = '/Common/Shared/testDatagroup';
            item.storageType = 'external';
            item.externalFilePath = {
                url: 'https://the.data.group',
                skipCertificateCheck: true
            };
            item.ignoreChanges = true;

            const result = translate.Data_Group(defaultContext, 'tenantId', 'appId', 'itemId', item);
            assert.deepStrictEqual(
                result.configs,
                [
                    {
                        command: 'ltm data-group external',
                        ignore: ['source-path.url', 'source-path.skipCertificateCheck'],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            description: 'none',
                            'source-path': '"https://the.data.group"',
                            type: 'integer'
                        }
                    },
                    {
                        command: 'sys file data-group',
                        ignore: ['data-group-name', 'source-path.url',
                            'source-path.skipCertificateCheck'],
                        path: '/tenantId/appId/itemId',
                        properties: {
                            'data-group-name': '/tenantId/appId/itemId',
                            'source-path': 'https://the.data.group',
                            type: 'integer'
                        }
                    }
                ]
            );
        });

        it('should handle retrieving Data_Groups with tokens from external URLs', () => {
            item.storageType = 'external';
            item.externalFilePath = {
                url: 'https://the.data.group',
                skipCertificateCheck: true,
                authentication: {
                    method: 'bearer-token',
                    token: 'randomTokenValue'
                }
            };

            const result = translate.Data_Group(defaultContext, 'tenantId', 'appId', 'dataGroupId', item);
            assert.deepStrictEqual(
                result.configs,
                [
                    {
                        command: 'ltm data-group external',
                        ignore: [],
                        path: '/tenantId/appId/dataGroupId',
                        properties: {
                            description: 'none',
                            'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_dataGroupId',
                            type: 'integer'
                        }
                    },
                    {
                        command: 'sys file data-group',
                        ignore: [],
                        path: '/tenantId/appId/dataGroupId',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    authentication: {
                                        method: 'bearer-token',
                                        token: 'randomTokenValue'
                                    },
                                    ctype: 'application/octet-stream',
                                    method: 'GET',
                                    path: 'https://the.data.group',
                                    rejectUnauthorized: false,
                                    why: 'get Data Group dataGroupId from url'
                                },
                                post: {
                                    ctype: 'application/octet-stream',
                                    method: 'POST',
                                    overrides: {
                                        class: 'Data_Group',
                                        externalFilePath: {
                                            authentication: {
                                                method: 'bearer-token',
                                                token: 'randomTokenValue'
                                            },
                                            skipCertificateCheck: true,
                                            url: 'https://the.data.group'
                                        },
                                        ignore: {},
                                        keyDataType: 'integer',
                                        remark: ''
                                    },
                                    path: '/mgmt/shared/file-transfer/uploads/_tenantId_appId_dataGroupId',
                                    why: 'upload Data Group dataGroupId'
                                }
                            },
                            'data-group-name': '/tenantId/appId/dataGroupId',
                            'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_dataGroupId',
                            type: 'integer'
                        }
                    }
                ]
            );
        });

        it('should handle retrieving Data_Groups with tokens from external URLs and ignoreChanges true', () => {
            item.storageType = 'external';
            item.externalFilePath = {
                url: 'https://the.data.group',
                skipCertificateCheck: true,
                authentication: {
                    method: 'bearer-token',
                    token: 'randomTokenValue'
                }
            };
            item.ignoreChanges = true;

            const result = translate.Data_Group(defaultContext, 'tenantId', 'appId', 'dataGroupId', item);
            assert.deepStrictEqual(
                result.configs,
                [
                    {
                        command: 'ltm data-group external',
                        ignore: [
                            'source-path.url',
                            'source-path.skipCertificateCheck',
                            'source-path.authentication.method',
                            'source-path.authentication.token'
                        ],
                        path: '/tenantId/appId/dataGroupId',
                        properties: {
                            description: 'none',
                            'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_dataGroupId',
                            type: 'integer'
                        }
                    },
                    {
                        command: 'sys file data-group',
                        ignore: [
                            'data-group-name',
                            'source-path.url',
                            'source-path.skipCertificateCheck',
                            'source-path.authentication.method',
                            'source-path.authentication.token'
                        ],
                        path: '/tenantId/appId/dataGroupId',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    authentication: {
                                        method: 'bearer-token',
                                        token: 'randomTokenValue'
                                    },
                                    ctype: 'application/octet-stream',
                                    method: 'GET',
                                    path: 'https://the.data.group',
                                    rejectUnauthorized: false,
                                    why: 'get Data Group dataGroupId from url'
                                },
                                post: {
                                    ctype: 'application/octet-stream',
                                    method: 'POST',
                                    overrides: {
                                        class: 'Data_Group',
                                        externalFilePath: {
                                            authentication: {
                                                method: 'bearer-token',
                                                token: 'randomTokenValue'
                                            },
                                            skipCertificateCheck: true,
                                            url: 'https://the.data.group'
                                        },
                                        ignore: {
                                            dataGroupName: '/tenantId/appId/dataGroupId',
                                            externalFilePath: {
                                                authentication: {
                                                    method: 'bearer-token',
                                                    token: 'randomTokenValue'
                                                },
                                                skipCertificateCheck: true,
                                                url: 'https://the.data.group'
                                            }
                                        },
                                        ignoreChanges: true,
                                        keyDataType: 'integer',
                                        remark: ''
                                    },
                                    path: '/mgmt/shared/file-transfer/uploads/_tenantId_appId_dataGroupId',
                                    why: 'upload Data Group dataGroupId'
                                }
                            },
                            'data-group-name': '/tenantId/appId/dataGroupId',
                            'source-path': 'file:/var/config/rest/downloads/_tenantId_appId_dataGroupId',
                            type: 'integer'
                        }
                    }
                ]
            );
        });
    });
});
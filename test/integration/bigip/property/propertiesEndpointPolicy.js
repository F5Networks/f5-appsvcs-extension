/**
 * Copyright 2023 F5 Networks, Inc.
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

const {
    assertClass,
    extractPolicy,
    extractProfile,
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const {
    convertAs3ObjectToString,
    convertObjectToString
} = require('../../../../src/lib/ltmPolicyParser');
const util = require('../../../../src/lib/util/util');
const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

const genValues = (templates, type, eventFilter) => templates.reduce((values, template) => {
    let events = template.events;
    // Adding this ugly hack here since we don't have BIG-IP information when creating the templates
    if (template.type === 'persist') {
        events = events.concat(['client-accepted']);
    }

    events.forEach((event) => {
        if (event !== eventFilter) { return; }
        template[type].forEach((value) => {
            values.push(Object.assign({ type: template.type, event }, value));
        });
    });
    return values;
}, []);

const extractEvents = (obj, eventsArr) => {
    const conditions = ((obj.rules[0] || {}).conditions || []);
    let str = '';
    conditions.forEach((condition) => {
        eventsArr.forEach((event) => {
            if (condition[event]) {
                str += `${event} ${condition.values[0]}; `;
            }
        });
    });
    return str.trim();
};

const PERSIST_EVENTS = ['proxy-request', 'request'];

const actionTemplates = [
    {
        type: 'forward',
        events: ['ssl-client-hello', 'request'],
        actions: [
            { select: { service: { bigip: '/Common/testVs' } } },
            { select: { pool: { bigip: '/Common/testPool' }, snat: 'automap' } }
        ]
    },
    {
        type: 'http',
        events: ['request'],
        actions: [
            { enabled: false }
        ]
    },
    {
        type: 'httpHeader',
        events: ['request', 'response'],
        actions: [
            { replace: { name: 'x-forwarded-for', value: 'tcl:[IP::client_addr]' } },
            { insert: { name: 'Strict-Transport-Security', value: 'max-age=16070400' } },
            { remove: { name: 'X-Content-Type-Options' } }
        ]
    },
    {
        type: 'httpUri',
        events: ['request'],
        actions: [
            { replace: { value: 'http://127.0.0.1' } },
            { replace: { path: 'tcl:[string map {"/root/" "/" } [HTTP::uri]]' } },
            { replace: { queryString: 'debug' } }
        ]
    },
    {
        type: 'httpUri',
        events: ['request'],
        actions: [
            { replace: { path: 'tcl:[string map{"/root/" "/"}[HTTP::uri]]' } }
        ]
    },
    {
        type: 'httpCookie',
        events: ['request'],
        actions: [
            { insert: { name: 'Source-IP', value: 'tcl:[IP::remote_addr]' } },
            { remove: { name: 'X-Tracker' } }
        ]
    },
    {
        type: 'httpRedirect',
        events: ['request', 'response'],
        actions: [
            { location: 'http://newurl/with/;semi' }
        ]
    },
    {
        type: 'clientSsl',
        events: ['request'],
        actions: [
            { enabled: false }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { sourceAddress: { netmask: '255.255.255.255', timeout: 60 } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { destinationAddress: { netmask: '255.255.255.255', timeout: 60 } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { cookieInsert: { name: 'foo_bar', expiry: '1d01:01:01' } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { cookieRewrite: { name: 'bar_foo', expiry: '2d02:02:02' } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { cookiePassive: { name: 'theFooBaring' } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            {
                cookieHash: {
                    name: 'leFooBar',
                    offset: 5,
                    length: 50,
                    timeout: 60
                }
            }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { universal: { key: 'insertFooBar', timeout: 65 } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { hash: { key: 'hashFooBar', timeout: 55 } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { carp: { key: 'carpFooBar', timeout: 50 } }
        ]
    },
    {
        type: 'persist',
        events: PERSIST_EVENTS,
        actions: [
            { disable: { } }
        ]
    },
    {
        type: 'tcl',
        events: ['proxy-request', 'request', 'response'],
        actions: [
            {
                setVariable: {
                    expression: '1',
                    name: 'http_uri_rewritten'
                }
            }
        ]
    },
    {
        type: 'shutdown',
        events: ['proxy-request'],
        actions: [{}]
    },
    {
        type: 'log',
        events: ['client-accepted', 'proxy-request', 'request', 'response', 'ssl-client-hello'],
        actions: [
            {
                write: {
                    message: 'The message',
                    facility: 'local1',
                    priority: 'debug',
                    ipAddress: '1.2.3.4',
                    port: 123
                }
            }
        ]
    }
];

const conditionTemplates = [
    {
        type: 'httpHeader',
        events: ['request', 'response'],
        conditions: [
            {
                name: 'Content-type',
                all: { operand: 'starts-with', values: ['application/json'] }
            }
        ]
    },
    {
        type: 'httpUri',
        events: ['request', 'proxy-request'],
        conditions: [
            { all: { operand: 'contains', values: ['127.0.0.1'] } },
            { scheme: { operand: 'equals', values: ['https'] } },
            { host: { operand: 'equals', values: ['127.0.0.1'] } },
            { port: { operand: 'equals', values: [8080] } },
            { path: { operand: 'contains', values: ['127.0.0.1'] } },
            { path: { operand: 'contains', datagroup: { bigip: '/Common/images' } } },
            { extension: { operand: 'does-not-end-with', values: ['jpg'] } },
            { queryString: { operand: 'does-not-contain', values: ['debug'] } },
            { queryParameter: { operand: 'equals', values: ['1234'] }, name: 'code' },
            { unnamedQueryParameter: { operand: 'does-not-equal', values: ['1234'] }, index: 1 },
            { pathSegment: { operand: 'equals', values: ['root'] }, index: 1 }
        ].map((c) => {
            c.normalized = true;
            return c;
        })
    },
    {
        type: 'httpMethod',
        events: ['request'],
        conditions: [
            { all: { operand: 'equals', values: ['GET', 'POST', 'PATCH'] } }
        ].map((c) => {
            c.normalized = true;
            return c;
        })
    },
    {
        type: 'httpCookie',
        events: ['request'],
        conditions: [
            {
                name: 'Content-type',
                all: { operand: 'equals', values: ['admin'] }
            }
        ]
    },
    {
        type: 'sslExtension',
        events: ['ssl-client-hello', 'ssl-server-hello'],
        conditions: [
            { serverName: { operand: 'equals', values: ['test1.com'] } },
            { npn: { operand: 'equals', values: ['test1.com'] } },
            { alpn: { operand: 'equals', values: ['test1.com'] } }
        ]
    },
    {
        type: 'tcp',
        events: ['request', 'response'],
        conditions: [
            { address: { operand: 'matches', values: ['1.2.1.2'] } },
            { address: { operand: 'does-not-match', values: ['1.2.3.4'] } },
            { port: { operand: 'equals', values: [8080] } }
        ]
    },
    {
        type: 'geoip',
        events: ['request', 'response'],
        conditions: [
            { continent: { operand: 'matches', values: ['AF'] } },
            { countryCode: { operand: 'matches', values: ['AT'] } },
            { countryName: { operand: 'matches', values: ['Germany'] } },
            { isp: { operand: 'matches', values: ['AT&T'] } },
            { org: { operand: 'matches', values: ['myORG'] } },
            { regionCode: { operand: 'matches', values: ['OR'] } },
            { regionName: { operand: 'matches', values: ['Ohio'] } }
        ]
    }
];

// TODO: Add rest of supported policy actions
// TODO: Add rest of supported policy conditions
// TODO: Add policy strategy
// TODO: Test with defaults
describe('Endpoint_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function mapToTmsh(policyItem) {
        const mapped = Object.assign({}, policyItem);
        if (mapped.type === 'clientSsl') {
            mapped.type = 'serverSsl';
            mapped.disable = true;
        } else if (mapped.type === 'sslExtension') {
            mapped.index = mapped.index || 0;
        } else if (mapped.type === 'http') {
            if (mapped.enabled) {
                mapped.enable = true;
            } else {
                mapped.disable = true;
            }
        }
        return mapped;
    }

    function testEvent(event, actionOverrides, conditionOverrides) {
        const options = { bigipItems: [] };
        const actions = genValues(actionOverrides || actionTemplates, 'actions', event);
        const actionsExpected = actions.map((action) => {
            const actionCopy = util.simpleCopy(action);
            if (actionCopy.type === 'httpRedirect') {
                actionCopy.redirect = {
                    location: actionCopy.location
                };
                delete actionCopy.location;
                actionCopy.type = 'httpReply';
            }
            if (actionCopy.type === 'forward') {
                if (actionCopy.select) {
                    if (actionCopy.select.service) {
                        options.bigipItems.push({
                            endpoint: '/mgmt/tm/ltm/virtual',
                            data: {
                                name: 'testVs',
                                partition: 'Common'
                            }
                        });
                        actionCopy.select.virtual = actionCopy.select.service.bigip;
                        delete actionCopy.select.service;
                    } else if (actionCopy.select.pool) {
                        options.bigipItems.push({
                            endpoint: '/mgmt/tm/ltm/pool',
                            data: {
                                name: 'testPool',
                                partition: 'Common'
                            }
                        });
                        actionCopy.select.pool = actionCopy.select.pool.bigip;
                    }
                }
            }
            return convertAs3ObjectToString(mapToTmsh(actionCopy), 'action');
        });
        actions.forEach((action) => {
            if (action.type === 'shutdown') {
                action.type = 'drop';
            }
        });
        const conditions = genValues(conditionOverrides || conditionTemplates, 'conditions', event);
        const conditionsExpected = conditions.map((condition) => {
            const conditionCopy = util.simpleCopy(condition);
            Object.keys(conditionCopy).forEach((key) => {
                if (conditionCopy[key].datagroup) {
                    conditionCopy[key].datagroup = conditionCopy[key].datagroup.bigip
                        || conditionCopy[key].datagroup.use;
                }
            });
            return convertAs3ObjectToString(mapToTmsh(conditionCopy), 'condition');
        });

        const properties = [
            {
                name: 'rules',
                inputValue: [[
                    {
                        name: 'rule',
                        conditions,
                        actions
                    }
                ]],
                expectedValue: [actionsExpected.concat(conditionsExpected).join(',')],
                extractFunction: (o) => {
                    o.rules[0].actions.forEach((action) => {
                        // BIG-IP<v14.0 mcp will return code === 0 but tmsh will not accept code (AT-1504)
                        if (action.httpReply && action.redirect && action.code === 0) {
                            delete action.code;
                        } else if (action.pool) {
                            action.pool = action.pool.fullPath;
                        }
                    });
                    o.rules[0].conditions.forEach((condition) => {
                        if (condition.datagroup) {
                            condition.datagroup = condition.datagroup.fullPath;
                        }
                    });
                    return o.rules[0].actions.map((a) => convertObjectToString(a))
                        .concat(o.rules[0].conditions.map((c) => convertObjectToString(c)))
                        .join(',');
                }
            }
        ];
        return assertClass('Endpoint_Policy', properties, options);
    }

    it('All Request Rules', () => testEvent('request'));
    it('All Response Rules', () => testEvent('response'));
    it('All Client-Accepted Rules', () => testEvent('client-accepted'));
    it('All SSL Client Hello Rules', () => testEvent('ssl-client-hello'));
    it('ALL Proxy Request Rules', () => testEvent('proxy-request'));

    it('All SSL Server Hello Rules', function () {
        return testEvent('ssl-server-hello');
    });

    it('should handle redirect action code on v14+', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            this.skip();
        }
        return testEvent('request', [{
            type: 'httpRedirect',
            events: ['request'],
            actions: [
                { location: 'http://localhost', code: 399 }
            ]
        }]);
    });

    it('should handle tcp condition datagroup on v13+', function () {
        return testEvent('request', [], [{
            type: 'tcp',
            events: ['request'],
            conditions: [
                { address: { operand: 'matches', datagroup: { bigip: '/Common/private_net' } } },
                { address: { operand: 'does-not-match', datagroup: { bigip: '/Common/aol' } } }
            ]
        }]);
    });

    it('should handle "exists" and "does-not-exist" operands on v15+', function () {
        if (util.versionLessThan(getBigIpVersion(), '15.0')) {
            this.skip();
        }
        const rules = {
            name: 'default',
            conditions: [
                {
                    type: 'httpCookie',
                    all: { operand: 'exists' },
                    name: 'test'
                },
                {
                    type: 'httpCookie',
                    all: { operand: 'does-not-exist' },
                    name: 'test2'
                }
            ]
        };
        const properties = [
            {
                name: 'rules',
                inputValue: [undefined, [rules], undefined],
                expectedValue: [[], ['test exists', 'test2 not exists'], []],
                extractFunction: (o) => (o.rules.length
                    ? o.rules[0].conditions.map((c) => `${c.tmName}${c.not ? ' not' : ''}${c.exists ? ' exists' : ''}`)
                    : o.rules)
            }
        ];
        return assertClass('Endpoint_Policy', properties);
    });

    describe('Policy_Condition_TCP events', () => {
        it('should handle tcp condition events (requires tcp) v13.0', () => {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'request',
                            address: { values: ['10.10.10.10'] }
                        },
                        {
                            type: 'tcp',
                            event: 'response',
                            address: { values: ['10.10.10.11'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'request 10.10.10.10; response 10.10.10.11;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['request', 'response'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires tcp) v13.1+', function () {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'request',
                            address: { values: ['10.10.10.10'] }
                        },
                        {
                            type: 'tcp',
                            event: 'response',
                            address: { values: ['10.10.10.11'] }
                        },
                        {
                            type: 'tcp',
                            event: 'client-accepted',
                            address: { values: ['10.10.10.12'] }
                        },
                        {
                            type: 'tcp',
                            event: 'server-connected',
                            address: { values: ['10.10.10.13'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'request 10.10.10.10; response 10.10.10.11; clientAccepted 10.10.10.12; serverConnected 10.10.10.13;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['request', 'response', 'clientAccepted', 'serverConnected'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires http-connect)', function () {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'proxy-response',
                            address: { values: ['10.10.10.10'] }
                        },
                        {
                            type: 'tcp',
                            event: 'proxy-connect',
                            address: { values: ['10.10.10.11'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'proxyResponse 10.10.10.10; proxyConnect 10.10.10.11;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['proxyResponse', 'proxyConnect'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires http-explicit)', function () {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'proxy-request',
                            address: { values: ['10.10.10.10'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'proxyRequest 10.10.10.10;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['proxyRequest'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires classification)', () => {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'classification-detected',
                            address: { values: ['10.10.10.10'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'classificationDetected 10.10.10.10;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['classificationDetected'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires ssl-client)', function () {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'ssl-client-hello',
                            address: { values: ['10.10.10.10'] }
                        },
                        {
                            type: 'tcp',
                            event: 'ssl-client-serverhello-send',
                            address: { values: ['10.10.10.11'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'sslClientHello 10.10.10.10; sslClientServerhelloSend 10.10.10.11;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['sslClientHello', 'sslClientServerhelloSend'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires ssl-server)', function () {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'ssl-server-handshake',
                            address: { values: ['10.10.10.10'] }
                        },
                        {
                            type: 'tcp',
                            event: 'ssl-server-hello',
                            address: { values: ['10.10.10.11'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'sslServerHandshake 10.10.10.10; sslServerHello 10.10.10.11;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['sslServerHandshake', 'sslServerHello'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });

        it('should handle tcp condition events (requires websocket)', () => {
            const rules = [
                {
                    name: 'default',
                    conditions: [
                        {
                            type: 'tcp',
                            event: 'ws-request',
                            address: { values: ['10.10.10.10'] }
                        },
                        {
                            type: 'tcp',
                            event: 'ws-response',
                            address: { values: ['10.10.10.11'] }
                        }
                    ]
                }
            ];
            const properties = [
                {
                    name: 'rules',
                    inputValue: [undefined, rules, undefined],
                    expectedValue: [
                        '',
                        'wsRequest 10.10.10.10; wsResponse 10.10.10.11;',
                        ''
                    ],
                    extractFunction: (o) => extractEvents(o, ['wsRequest', 'wsResponse'])
                }
            ];
            return assertClass('Endpoint_Policy', properties);
        });
    });

    it('Reorder rules', () => {
        const properties = [
            {
                name: 'rules',
                inputValue: [
                    [{ name: 'ruleAlpha' }, { name: 'ruleBeta' }],
                    [{ name: 'ruleBeta' }, { name: 'ruleAlpha' }]
                ],
                expectedValue: ['ruleAlpha,ruleBeta', 'ruleBeta,ruleAlpha'],
                extractFunction: (o) => o.rules
                    .map((r) => r).sort((a, b) => a.ordinal - b.ordinal)
                    .map((r) => r.name)
                    .join(',')
            }
        ];

        return assertClass('Endpoint_Policy', properties);
    });

    it('All Properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'LTM Policy', undefined],
                expectedValue: [undefined, 'LTM Policy', undefined]
            },
            {
                name: 'strategy',
                inputValue: [undefined, 'first-match', undefined],
                expectedValue: ['best-match', 'first-match', 'best-match'],
                extractFunction: (o) => o.strategy.name
            },
            {
                name: 'rules',
                inputValue: [[], [{ name: 'rule', remark: 'example.com/foo' }], undefined],
                expectedValue: [[], ['rule example.com/foo'], []],
                extractFunction: (o) => o.rules.map((r) => `${r.name} ${r.description}`)
            }
        ];
        return assertClass('Endpoint_Policy', properties);
    });

    it('BotDefense Action', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.0')) {
            this.skip();
        }
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'policyEndpoint',
                inputValue: ['endpointPolicy'],
                expectedValue: ['endpointPolicy'],
                extractFunction: extractPolicy,
                referenceObjects: {
                    endpointPolicy: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'enableBotDefense',
                                conditions: [],
                                actions: [{
                                    type: 'botDefense',
                                    profile: { bigip: '/Common/bot-defense' }
                                }]
                            },
                            {
                                name: 'disableBotDefense',
                                conditions: [],
                                actions: [{ type: 'botDefense' }]
                            }
                        ]
                    }
                }
            },
            {
                name: 'virtualAddresses',
                inputValue: [['10.1.40.50']],
                skipAssert: true
            },
            {
                name: 'profileBotDefense',
                inputValue: [{ bigip: '/Common/bot-defense' }],
                expectedValue: ['bot-defense'],
                extractFunction: (virtual) => extractProfile(virtual, 'bot-defense')
            }
        ];

        return assertClass('Service_HTTP', properties);
    });

    it('WAF Action', function () {
        assertModuleProvisioned.call(this, 'asm');

        validateEnvVars(['TEST_RESOURCES_URL']);

        // Flagged to be analyzed with Jaeger, but a 480000 timeout seems to help
        const policyHost = `${process.env.TEST_RESOURCES_URL}`;
        const properties = [
            {
                name: 'policyEndpoint',
                inputValue: ['endpointPolicy'],
                expectedValue: ['endpointPolicy'],
                extractFunction: extractPolicy,
                referenceObjects: {
                    endpointPolicy: {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                name: 'enableWAF',
                                conditions: [],
                                actions: [{
                                    type: 'waf',
                                    policy: { use: 'wafPolicy' }
                                }]
                            },
                            {
                                name: 'disable',
                                conditions: [],
                                actions: [{ type: 'waf' }]
                            }
                        ]
                    },
                    wafPolicy: {
                        class: 'WAF_Policy',
                        url: {
                            url: `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`
                        },
                        ignoreChanges: true
                    }
                }
            },
            {
                name: 'virtualAddresses',
                inputValue: [['10.1.40.50']],
                skipAssert: true
            }
        ];

        return Promise.resolve()
            .then(() => {
                if (process.env.TEST_IN_AZURE === 'true') {
                    return oauth.getTokenForTest()
                        .then((token) => {
                            properties[0].referenceObjects.wafPolicy.url.authentication = {
                                method: 'bearer-token',
                                token
                            };
                        });
                }

                return Promise.resolve();
            })
            .then(() => assertClass('Service_HTTP', properties));
    });
});

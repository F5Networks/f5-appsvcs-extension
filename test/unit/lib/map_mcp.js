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
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/rewrite/~Common~foo~bar~testItem/uri-rules/0?ver=13.1.1',
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
                        selfLink: 'https://localhost/mgmt/tm/ltm/policy-strategy/~Common~foo~bar~testItem/operands/0?ver=13.1.1',
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
                        username: 'user',
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
                        username: 'user',
                        database: 'baseOfData',
                        count: 42,
                        'recv-column': 1,
                        'recv-row': 1
                    });
                });
            });
            it('should process radius missing values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:radius:radiusstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none'
                });
            });
            it('should process radius user-defined values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:radius:radiusstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process tcp-half-open missing values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:tcp-half-open:tcp-half-openstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none'
                });
            });
            it('should process tcp-half-open user-defined values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:tcp-half-open:tcp-half-openstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process tcp missing values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:tcp:tcpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none',
                    recv: 'none',
                    send: 'none',
                    'recv-disable': 'none'
                });
            });
            it('should process tcp user-defined values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:tcp:tcpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    'recv-disable': 'none',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process udp missing values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:udp:udpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none',
                    recv: 'none',
                    send: 'none',
                    'recv-disable': 'none'
                });
            });
            it('should process udp user-defined values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:udp:udpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    'recv-disable': 'none',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process smtp missing values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:smtp:smtpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none'
                });
            });
            it('should process smtp user-defined values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:smtp:smtpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process sip missing values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:sip:sipstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none',
                    cert: 'none',
                    filter: 'none',
                    'filter-neg': 'none',
                    headers: 'none',
                    key: 'none',
                    request: 'none'
                });
            });
            it('should process sip user-defined values', () => {
                const obj = {
                    kind: 'tm:ltm:monitor:sip:sipstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    cert: 'none',
                    description: '"This is my description"',
                    filter: 'none',
                    'filter-neg': 'none',
                    headers: 'none',
                    key: 'none',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    request: 'none',
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
        });
        describe('GSLB Database Monitors', () => {
            const testCases = [
                'mysql'
            ];
            testCases.forEach((testCase) => {
                it(`should process ${testCase} missing values`, () => {
                    const obj = {
                        kind: `tm:gtm:monitor:${testCase}:${testCase}state`,
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
                        kind: `tm:gtm:monitor:${testCase}:${testCase}state`,
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor',
                        description: 'This is my description',
                        password: 'Same as my luggage "123"',
                        recv: 'Something received',
                        send: 'Something sent',
                        username: 'user',
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
                        username: 'user',
                        database: 'baseOfData',
                        count: 42,
                        'recv-column': 1,
                        'recv-row': 1
                    });
                });
            });
            it('should process tcp-half-open missing values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:tcp-half-open:tcp-half-openstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none'
                });
            });
            it('should process tcp-half-open user-defined values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:tcp-half-open:tcp-half-openstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process smtp missing values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:smtp:smtpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none'
                });
            });
            it('should process smtp user-defined values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:smtp:smtpstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process sip missing values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:sip:sipstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: 'none',
                    cert: 'none',
                    filter: 'none',
                    'filter-neg': 'none',
                    headers: 'none',
                    key: 'none',
                    request: 'none'
                });
            });
            it('should process sip user-defined values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:sip:sipstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    recv: 'Something received',
                    send: 'Something sent',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    recvColumn: 1,
                    recvRow: 1
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    cert: 'none',
                    description: '"This is my description"',
                    filter: 'none',
                    'filter-neg': 'none',
                    headers: 'none',
                    key: 'none',
                    password: '"Same as my luggage \\"123\\""',
                    recv: '"Something received"',
                    send: '"Something sent"',
                    username: 'user',
                    database: 'baseOfData',
                    count: 42,
                    request: 'none',
                    'recv-column': 1,
                    'recv-row': 1
                });
            });
            it('should process ldap user-defined values', () => {
                const obj = {
                    kind: 'tm:gtm:monitor:ldap:ldapstate',
                    name: 'myMonitor',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application/myMonitor',
                    description: 'This is my description',
                    password: 'Same as my luggage "123"',
                    username: 'user',
                    base: 'baseOfData'
                };
                const result = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    description: '"This is my description"',
                    password: '"Same as my luggage \\"123\\""',
                    /* eslint-disable no-useless-escape */
                    base: '\"baseOfData\"',
                    /* eslint-enable no-useless-escape */
                    'filter-ldap': 'none',
                    security: 'none',
                    username: 'user'
                });
            });
        });
        describe('tm:auth:partition:partitionstate', () => {
            it('should return a defaultRouteDomain', () => {
                defaultContext.request.isPerApp = false;

                const obj = {
                    kind: 'tm:auth:partition:partitionstate',
                    name: 'tenant1',
                    fullPath: 'tenant1',
                    generation: 867,
                    selfLink: 'https://localhost/mgmt/tm/auth/partition/tenant1',
                    defaultRouteDomain: 10,
                    description: 'Updated by AS3 at Tue, 30 May 2023 19:48:41 GMT'
                };

                const result = translate['tm:auth:partition:partitionstate'](defaultContext, obj);
                assert.deepStrictEqual(result[0].properties, {
                    'default-route-domain': 10
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

        describe('tm:security:log:profile:profilestate', () => {
            it('shoud properly escape and quote user-defined network string', () => {
                defaultContext.target.provisionedModules = ['afm'];
                const obj = {
                    kind: 'tm:security:log:profile:profilestate',
                    partition: 'myTenant',
                    subPath: 'myApplication',
                    name: 'network_log_profile',
                    selfLink: 'https://localhost/mgmt/tm/security/log/profile/~myTenant~myApplication~network_log_profile?ver=13.1.5',
                    fullPath: '/myTenant/myApplication/network_log_profile',
                    networkReference:
                    {
                        link: 'https://localhost/mgmt/tm/security/log/profile/~myTenant~myApplication~network_log_profile/network?ver=13.1.5',
                        isSubcollection: true
                    }
                };
                const referenceConfig = [{
                    kind: 'tm:security:log:profile:network:networkstate',
                    name: 'undefined',
                    fullPath: 'undefined',
                    selfLink: 'https://localhost/mgmt/tm/security/log/profile/~myTenant~myApplication~network_log_profile/network/undefined?ver=13.1.5',
                    format: {
                        fieldListDelimiter: ',',
                        type: 'user-defined',
                        userDefined: 'foo ${date_time} ${bigip_hostname},${acl_policy_name}' // eslint-disable-line no-template-curly-in-string
                    }
                }];
                const expected = {
                    command: 'security log profile',
                    ignore: [],
                    path: '/myTenant/myApplication/network_log_profile',
                    properties: {
                        classification: {
                            'log-all-classification-matches': 'disabled'
                        },
                        'ip-intelligence': {
                            'aggregate-rate': 4294967295,
                            'log-publisher': 'none',
                            'log-translation-fields': 'disabled'
                        },
                        nat: {
                            'end-inbound-session': 'disabled',
                            'end-outbound-session': {
                                action: 'disabled'
                            },
                            errors: 'disabled',
                            format: {
                                'end-inbound-session': {
                                    'field-list-delimiter': ',',
                                    type: 'none'
                                },
                                'end-outbound-session': {
                                    'field-list-delimiter': ',',
                                    type: 'none'
                                },
                                errors: {
                                    'field-list-delimiter': ',',
                                    type: 'none'
                                },
                                'quota-exceeded': {
                                    'field-list-delimiter': ',',
                                    type: 'none'
                                },
                                'start-inbound-session': {
                                    'field-list-delimiter': ',',
                                    type: 'none'
                                },
                                'start-outbound-session': {
                                    'field-list-delimiter': ',',
                                    type: 'none'
                                }
                            },
                            'log-subscriber-id': 'disabled',
                            'lsn-legacy-mode': 'disabled',
                            'quota-exceeded': 'disabled',
                            'rate-limit': {
                                'aggregate-rate': 4294967295,
                                'end-inbound-session': 4294967295,
                                'end-outbound-session': 4294967295,
                                errors: 4294967295,
                                'quota-exceeded': 4294967295,
                                'start-inbound-session': 4294967295,
                                'start-outbound-session': 4294967295
                            },
                            'start-inbound-session': 'disabled',
                            'start-outbound-session': {
                                action: 'disabled'
                            }
                        },
                        network: {
                            undefined: {
                                format: {
                                    type: 'user-defined',
                                    'user-defined': '"foo \\$\\{date_time\\} \\$\\{bigip_hostname\\},\\$\\{acl_policy_name\\}"' // eslint-disable-line no-template-curly-in-string
                                }
                            }
                        },
                        'protocol-dns': {},
                        'protocol-inspection': {
                            'log-packet': 'disabled'
                        },
                        'protocol-sip': {},
                        'protocol-transfer': {},
                        'ssh-proxy': {}
                    }
                };
                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results[0], expected);
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

        describe('tm:ltm:alg-log-profile:alg-log-profilestate', () => {
            it('should convert', () => {
                const obj = {
                    kind: 'tm:ltm:alg-log-profile:alg-log-profilestate',
                    name: 'item',
                    partition: 'Tenant',
                    fullPath: '/Tenant/item',
                    csvFormat: 'enabled',
                    endControlChannel: {
                        action: 'enabled'
                    },
                    endDataChannel: {
                        action: 'enabled'
                    },
                    inboundTransaction: {
                        action: 'enabled'
                    },
                    startControlChannel: {
                        action: 'enabled',
                        elements: [
                            'destination'
                        ]
                    },
                    startDataChannel: {
                        action: 'disabled'
                    }
                };
                defaultContext.target.tmosVersion = '14.0';
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/Tenant/item',
                    command: 'ltm alg-log-profile',
                    properties: {
                        'csv-format': 'enabled',
                        'start-control-channel': {
                            action: 'enabled',
                            elements: {
                                destination: {}
                            }
                        },
                        'end-control-channel': {
                            action: 'enabled',
                            elements: {}
                        },
                        'inbound-transaction': {
                            action: 'enabled'
                        },
                        'start-data-channel': {
                            action: 'disabled',
                            elements: {}
                        },
                        'end-data-channel': {
                            action: 'enabled',
                            elements: {}
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:dns:cache:transparent:transparentstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:dns:cache:transparent:transparentstate',
                    name: 'dns.cache.test',
                    partition: 'testPartition',
                    fullPath: '/testPartition/testPartition/dns.cache.test',
                    localZones: [
                        {
                            tmName: 'norecords.com',
                            type: 'type-transparent'
                        },
                        {
                            tmName: '_sip._tcp.example.com',
                            records: [
                                '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                            ],
                            type: 'transparent'
                        },
                        {
                            tmName: 'tworecords.com',
                            records: [
                                'wiki.tworecords.com 300 IN A 10.10.10.125',
                                'wiki.tworecords.com 300 IN A 10.10.10.126'
                            ],
                            type: 'transparent'
                        }
                    ]
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/testPartition/testPartition/dns.cache.test',
                    command: 'ltm dns cache transparent',
                    properties: {
                        'local-zones': {
                            '_sip._tcp.example.com': {
                                name: '_sip._tcp.example.com',
                                records: {
                                    '"_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com"': {}
                                },
                                type: 'transparent'
                            },
                            'norecords.com': {
                                name: 'norecords.com',
                                records: {},
                                type: 'type-transparent'
                            },
                            'tworecords.com': {
                                name: 'tworecords.com',
                                records: {
                                    '"wiki.tworecords.com 300 IN A 10.10.10.125"': {},
                                    '"wiki.tworecords.com 300 IN A 10.10.10.126"': {}
                                },
                                type: 'transparent'
                            }
                        }
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:dns:cache:resolver:resolverstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:dns:cache:resolver:resolverstate',
                    name: 'dns.cache.test',
                    partition: 'testPartition',
                    fullPath: '/testPartition/testPartition/dns.cache.test',
                    localZones: [
                        {
                            tmName: 'norecords.com',
                            type: 'type-transparent'
                        },
                        {
                            tmName: '_sip._tcp.example.com',
                            records: [
                                '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                            ],
                            type: 'transparent'
                        },
                        {
                            tmName: 'tworecords.com',
                            records: [
                                'wiki.tworecords.com 300 IN A 10.10.10.125',
                                'wiki.tworecords.com 300 IN A 10.10.10.126'
                            ],
                            type: 'transparent'
                        }
                    ],
                    forwardZones: [
                        {
                            name: 'singleRecord',
                            nameservers: [
                                {
                                    name: '10.0.0.1:53'
                                }
                            ]
                        },
                        {
                            name: 'twoRecords',
                            nameservers: [
                                {
                                    name: '10.0.0.2:53'
                                },
                                {
                                    name: '10.0.0.3:53'
                                }
                            ]
                        }
                    ]
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/testPartition/testPartition/dns.cache.test',
                    command: 'ltm dns cache resolver',
                    properties: {
                        'local-zones': {
                            '_sip._tcp.example.com': {
                                name: '_sip._tcp.example.com',
                                records: {
                                    '"_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com"': {}
                                },
                                type: 'transparent'
                            },
                            'norecords.com': {
                                name: 'norecords.com',
                                records: {},
                                type: 'type-transparent'
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
                        'forward-zones': {
                            singleRecord: {
                                name: 'singleRecord',
                                nameservers: {
                                    '10.0.0.1:53': {}
                                }
                            },
                            twoRecords: {
                                name: 'twoRecords',
                                nameservers: {
                                    '10.0.0.2:53': {},
                                    '10.0.0.3:53': {}
                                }
                            }
                        },
                        'root-hints': {}
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:dns:cache:validating-resolver:validating-resolverstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:dns:cache:validating-resolver:validating-resolverstate',
                    name: 'dns.cache.test',
                    partition: 'testPartition',
                    fullPath: '/testPartition/testPartition/dns.cache.test',
                    localZones: [
                        {
                            tmName: 'norecords.com',
                            type: 'type-transparent'
                        },
                        {
                            tmName: '_sip._tcp.example.com',
                            records: [
                                '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                            ],
                            type: 'transparent'
                        },
                        {
                            tmName: 'tworecords.com',
                            records: [
                                'wiki.tworecords.com 300 IN A 10.10.10.125',
                                'wiki.tworecords.com 300 IN A 10.10.10.126'
                            ],
                            type: 'transparent'
                        }
                    ],
                    forwardZones: [
                        {
                            name: 'singleRecord',
                            nameservers: [
                                {
                                    name: '10.0.0.1:53'
                                }
                            ]
                        },
                        {
                            name: 'twoRecords',
                            nameservers: [
                                {
                                    name: '10.0.0.2:53'
                                },
                                {
                                    name: '10.0.0.3:53'
                                }
                            ]
                        }
                    ]
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/testPartition/testPartition/dns.cache.test',
                    command: 'ltm dns cache validating-resolver',
                    properties: {
                        'local-zones': {
                            '_sip._tcp.example.com': {
                                name: '_sip._tcp.example.com',
                                records: {
                                    '"_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com"': {}
                                },
                                type: 'transparent'
                            },
                            'norecords.com': {
                                name: 'norecords.com',
                                records: {},
                                type: 'type-transparent'
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
                        'forward-zones': {
                            singleRecord: {
                                name: 'singleRecord',
                                nameservers: {
                                    '10.0.0.1:53': {}
                                }
                            },
                            twoRecords: {
                                name: 'twoRecords',
                                nameservers: {
                                    '10.0.0.2:53': {},
                                    '10.0.0.3:53': {}
                                }
                            }
                        },
                        'root-hints': {},
                        'trust-anchors': {}
                    },
                    ignore: []
                });
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

        describe('tm:ltm:profile:rtsp:rtspstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:profile:rtsp:rtspstate',
                    name: 'myRtsp',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/myRtsp',
                    checkSource: 'enabled',
                    description: 'My Description',
                    idleTimeout: 'indefinite',
                    logProfile: '/Common/alg_log_profile',
                    logPublisher: '/Common/local-db-publisher',
                    logPublisherReference: {
                        link: 'https://localhost/mgmt/tm/sys/log-config/publisher/~Common~local-db-publisher?ver=17.0.0'
                    },
                    maxHeaderSize: 4096,
                    maxQueuedData: 32768,
                    multicastRedirect: 'disabled',
                    proxy: 'internal',
                    proxyHeader: 'proxy-header',
                    realHttpPersistence: 'enabled',
                    rtcpPort: 0,
                    rtpPort: 0,
                    sessionReconnect: 'disabled',
                    unicastRedirect: 'disabled'
                };

                defaultContext.target.provisionedModules = ['cgnat'];
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/myApp/Application1/myRtsp',
                    command: 'ltm profile rtsp',
                    properties: {
                        'check-source': 'enabled',
                        description: '"My Description"',
                        'idle-timeout': 'indefinite',
                        'log-profile': '/Common/alg_log_profile',
                        'log-publisher': '/Common/local-db-publisher',
                        'max-header-size': 4096,
                        'max-queued-data': 32768,
                        'multicast-redirect': 'disabled',
                        proxy: '"internal"',
                        'proxy-header': '"proxy-header"',
                        'real-http-persistence': 'enabled',
                        'rtcp-port': 0,
                        'rtp-port': 0,
                        'session-reconnect': 'disabled',
                        'unicast-redirect': 'disabled'
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:profile:socks:socksstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:profile:socks:socksstate',
                    name: 'socksExample',
                    partition: 'myApp',
                    subPath: 'Application',
                    fullPath: '/myApp/Application/socksExample',
                    defaultConnectHandling: 'allow',
                    description: 'My Description',
                    dnsResolver: '/Common/f5-aws-dns',
                    dnsResolverReference: {
                        link: 'https://localhost/mgmt/tm/net/dns-resolver/~Common~f5-aws-dns?ver=17.0.0'
                    },
                    ipv6First: 'yes',
                    protocolVersions: [
                        'socks4',
                        'socks4a',
                        'socks5'
                    ],
                    routeDomain: '/Common/2222',
                    routeDomainReference: {
                        link: 'https://localhost/mgmt/tm/net/route-domain/~Common~2222?ver=17.0.0'
                    },
                    tunnelName: '/Common/socks-tunnel',
                    tunnelNameReference: {
                        link: 'https://localhost/mgmt/tm/net/tunnels/tunnel/~Common~socks-tunnel?ver=17.0.0'
                    }
                };

                const results = translate[obj.kind](defaultContext, obj);

                assert.deepStrictEqual(results[0], {
                    path: '/myApp/Application/socksExample',
                    command: 'ltm profile socks',
                    properties: {
                        description: '"My Description"',
                        'protocol-versions': {
                            socks4: {},
                            socks4a: {},
                            socks5: {}
                        },
                        'dns-resolver': '/Common/f5-aws-dns',
                        ipv6: 'yes',
                        'route-domain': '/Common/2222',
                        'tunnel-name': '/Common/socks-tunnel',
                        'default-connect-handling': 'allow'
                    },
                    ignore: []
                });
            });
        });

        describe('tm:ltm:profile:tftp:tftpstate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:ltm:profile:tftp:tftpstate',
                    name: 'myTftp',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/myTftp',
                    description: 'My Description',
                    idleTimeout: 'indefinite',
                    logProfile: '/Common/alg_log_profile',
                    logPublisher: '/Common/local-db-publisher'
                };

                defaultContext.target.provisionedModules = ['cgnat'];
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/myApp/Application1/myTftp',
                    command: 'ltm profile tftp',
                    properties: {
                        description: '"My Description"',
                        'idle-timeout': 'indefinite',
                        'log-profile': '/Common/alg_log_profile',
                        'log-publisher': '/Common/local-db-publisher'
                    },
                    ignore: []
                });
            });
        });

        describe('tm:net:port-list:port-liststate', () => {
            it('should perform basic transformation', () => {
                const obj = {
                    kind: 'tm:net:port-list:port-liststate',
                    name: 'myPortList',
                    partition: 'myApp',
                    subPath: 'Application1',
                    fullPath: '/myApp/Application1/myPortList',
                    ports: [
                        { name: '80' },
                        { name: '443' }
                    ],
                    portLists: [
                        {
                            name: 'anotherList',
                            partition: 'myApp',
                            subPath: 'Application1'
                        }
                    ]
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0], {
                    path: '/myApp/Application1/myPortList',
                    command: 'net port-list',
                    properties: {
                        'port-lists': {
                            '/myApp/Application1/anotherList': {}
                        },
                        ports: {
                            443: {},
                            80: {}
                        }
                    },
                    ignore: []
                });
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/comment-raise-event/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/comment-remove/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-append-html/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-prepend-html/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-raise-event/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-remove/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/html-rule/tag-remove-attribute/~Tenant~Application~sample?ver=14.1.2',
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/html/~Tenant~Application~sample?ver=14.1.2',
                    appService: 'none',
                    contentDetection: 'enabled',
                    contentSelection: [
                        'text/html',
                        'text/xhtml'
                    ],
                    defaultsFrom: '/Common/html',
                    defaultsFromReference: {
                        link: 'https://localhost/mgmt/tm/ltm/profile/html/~Common~html?ver=14.1.2'
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
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/comment-raise-event/~Tenant~Application~sample1?ver=14.1.2'
                        },
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/comment-remove/~Tenant~Application~sample2?ver=14.1.2'
                        },
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/tag-append-html/~Tenant~Application~sample3?ver=14.1.2'
                        },
                        {
                            link: 'https://localhost/mgmt/tm/ltm/html-rule/tag-prepend-html/~Tenant~Application~sample4?ver=14.1.2'
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
                        link: 'https://localhost/mgmt/tm/security/firewall/rule-list/~TEST_Firewall_Rule_List~Application~testItem/rules?ver=13.1.1'
                    }
                };
                const referenceConfig = [
                    {
                        kind: 'tm:security:firewall:rule-list:rules:rulesstate',
                        name: 'theRule',
                        fullPath: 'theRule',
                        selfLink: 'https://localhost/mgmt/tm/security/firewall/rule-list/~TEST_Firewall_Rule_List~Application~testItem/rules/theRule?ver=13.1.1',
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
                            ],
                            addresses: [
                                {
                                    name: '192.0.2.244-192.0.2.245'
                                },
                                {
                                    name: '192.0.2.0/25'
                                }
                            ],
                            ports: [
                                {
                                    name: '2192-3213'
                                }
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
                            ],
                            addresses: [
                                {
                                    name: '192.0.2.244-192.0.2.245'
                                },
                                {
                                    name: '192.0.2.0/25'
                                }
                            ],
                            ports: [
                                {
                                    name: '2192-3213'
                                }
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
                                },
                                addresses: {
                                    '192.0.2.244-192.0.2.245': {},
                                    '192.0.2.0/25': {}
                                },
                                ports: {
                                    '2192-3213': {}
                                }
                            },
                            destination: {
                                'address-lists': {
                                    '/TEST_Firewall_Rule_List/Application/addList': {}
                                },
                                'port-lists': {
                                    '/TEST_Firewall_Rule_List/Application/portList': {}
                                },
                                addresses: {
                                    '192.0.2.244-192.0.2.245': {},
                                    '192.0.2.0/25': {}
                                },
                                ports: {
                                    '2192-3213': {}
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

        describe('tm:security:firewall:address-list:address-liststate', () => {
            it('Should return with address-liststate', () => {
                const obj = {
                    kind: 'tm:security:firewall:address-list:address-liststate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Address_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Address_List/Application/testItem',
                    addresses: [{ name: '192.0.2.7', deviceName: '0', translation: 'none' }],
                    fqdns: [{ name: 'test.server.com' }],
                    geo: [{ name: 0 }],
                    addressLists: [
                        {
                            partition: 'TEST_Firewall_Address_List',
                            subPath: 'Application',
                            name: 'testItem1'
                        }
                    ]
                };
                const expected = {
                    'address-lists': {
                        '/TEST_Firewall_Address_List/Application/testItem1': {}
                    },
                    addresses: {
                        '192.0.2.7': {}
                    },
                    fqdns: {
                        'test.server.com': {}
                    },
                    geo: {
                        0: {}
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:security:firewall:port-list:port-liststate', () => {
            it('Should return with port-liststate', () => {
                const obj = {
                    kind: 'tm:security:firewall:port-list:port-liststate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Port_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Port_List/Application/testItem',
                    ports: [{ name: '8055' }],
                    portLists: [
                        {
                            name: 'anotherList',
                            partition: 'myApp',
                            subPath: 'Application1'
                        }
                    ]
                };
                const expected = {
                    'port-lists': {
                        '/myApp/Application1/anotherList': {}
                    },
                    ports: {
                        8055: {}
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:security:firewall:policy:policystate', () => {
            it('Should return with policy-liststate', () => {
                const obj = {
                    kind: 'tm:security:firewall:policy:policystate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Policy_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Policy_List/Application/testItem'
                };
                const expected = {
                    rules: {}
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:security:nat:source-translation:source-translationstate', () => {
            it('Should return with source-translationstate not equal to dynamic-pat type', () => {
                const obj = {
                    kind: 'tm:security:nat:source-translation:source-translationstate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Policy_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Policy_List/Application/testItem',
                    type: 'dynamic-pat',
                    patMode: '',
                    inboundMode: '',
                    mapping: '',
                    clientConnectionLimit: '',
                    hairpinMode: '',
                    portBlockAllocation: ''

                };
                const expected = {
                    addresses: {},
                    'client-connection-limit': 'none',
                    'egress-interfaces': {},
                    'hairpin-mode': 'none',
                    'inbound-mode': 'none',
                    mapping: {},
                    'pat-mode': 'none',
                    ports: {},
                    type: 'dynamic-pat'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with source-translationstate not equal to pba patMode', () => {
                const obj = {
                    kind: 'tm:security:nat:source-translation:source-translationstate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Policy_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Policy_List/Application/testItem',
                    type: 'dynamic-pat2',
                    patMode: 'pba2',
                    inboundMode: '',
                    mapping: '',
                    clientConnectionLimit: '',
                    hairpinMode: '',
                    portBlockAllocation: ''

                };
                const expected = {
                    addresses: {},
                    'egress-interfaces': {},
                    ports: {},
                    type: 'dynamic-pat2'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with source-translationstate not equal to pba patMode with egressInterfacesDisabled true', () => {
                const obj = {
                    kind: 'tm:security:nat:source-translation:source-translationstate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Policy_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Policy_List/Application/testItem',
                    type: 'dynamic-pat2',
                    patMode: 'pba2',
                    inboundMode: '',
                    mapping: '',
                    clientConnectionLimit: '',
                    hairpinMode: '',
                    portBlockAllocation: '',
                    egressInterfacesDisabled: true

                };
                const expected = {
                    addresses: {},
                    'egress-interfaces': {},
                    ports: {},
                    type: 'dynamic-pat2',
                    'egress-interfaces-disabled': ' '
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with source-translationstate not equal to pba patMode with egressInterfacesEnabled true', () => {
                const obj = {
                    kind: 'tm:security:nat:source-translation:source-translationstate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Policy_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Policy_List/Application/testItem',
                    type: 'dynamic-pat2',
                    patMode: 'pba2',
                    inboundMode: '',
                    mapping: '',
                    clientConnectionLimit: '',
                    hairpinMode: '',
                    portBlockAllocation: '',
                    egressInterfacesEnabled: true

                };
                const expected = {
                    addresses: {},
                    'egress-interfaces': {},
                    ports: {},
                    type: 'dynamic-pat2',
                    'egress-interfaces-enabled': ' '
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:pem:policy:policystate', () => {
            it('Should return with pem policy-liststate', () => {
                const obj = {
                    kind: 'tm:pem:policy:policystate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Policy_State',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Policy_State/Application/testItem',
                    rules: [{
                        'flow-info-filters': {
                            flowFilter: {
                                operation: 'match',
                                'dscp-code': 'disabled',
                                'dst-ip-addr': '0.0.0.0/0',
                                'dst-port': 0,
                                'from-vlan': '/Common/vlan',
                                'l2-endpoint': 'vlan',
                                'src-ip-addr': '0.0.0.0/32',
                                'src-port': 0,
                                proto: 'any',
                                'ip-addr-type': 'any'
                            }
                        },
                        'tcl-filter': 'filter'
                    }]
                };
                const expected = {
                    rules: {
                        undefined: {
                            'classification-filters': {},
                            'flow-info-filters': {},
                            forwarding: {
                                'fallback-action': 'drop',
                                'icap-type': 'none',
                                type: 'none'
                            },
                            'http-redirect': {
                                'fallback-action': 'drop'
                            },
                            'insert-content': {
                                duration: 0,
                                frequency: 'always',
                                position: 'prepend',
                                'value-type': 'string'
                            },
                            'modify-http-hdr': {
                                operation: 'none',
                                'value-type': 'string'
                            },
                            'qoe-reporting': {
                                dest: {
                                    hsl: {
                                        publisher: 'none'
                                    }
                                }
                            },
                            quota: {
                                'reporting-level': 'rating-group'
                            },
                            'ran-congestion': {
                                detect: 'disabled',
                                'lowerthreshold-bw': 1000,
                                report: {
                                    dest: {
                                        hsl: {
                                            publisher: 'none'
                                        }
                                    }
                                }
                            },
                            reporting: {
                                dest: {
                                    gx: {
                                        'application-reporting': 'disabled'
                                    },
                                    hsl: {
                                        'flow-reporting-fields': {},
                                        publisher: 'none',
                                        'session-reporting-fields': {},
                                        'transaction-reporting-fields': {}
                                    },
                                    'radius-accounting': {
                                        'radius-aaa-virtual': 'none'
                                    },
                                    sd: {
                                        'application-reporting': 'disabled'
                                    }
                                },
                                granularity: 'session',
                                interval: 0,
                                transaction: {
                                    http: {
                                        'hostname-len': 0,
                                        'uri-len': 256,
                                        'user-agent-len': 0
                                    }
                                },
                                volume: {
                                    downlink: 0,
                                    total: 0,
                                    uplink: 0
                                }
                            },
                            'tcl-filter': 'filter',
                            'url-categorization-filters': {}
                        }
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:pem:forwarding-endpoint:forwarding-endpointstate', () => {
            it('forwarding-endpointstate', () => {
                const obj = {
                    kind: 'tm:pem:forwarding-endpoint:forwarding-endpointstate',
                    name: 'testItem',
                    partition: 'TEST_PEM_Endpoint',
                    subPath: 'Application',
                    fullPath: '/TEST_PEM_Endpoint/Application/testItem',
                    persistence: {
                        hashSettings: {
                            length: 1024,
                            offset: 0,
                            tclScript: 'A tcl script',
                            tclValue: 'tclValue'
                        }
                    }
                };
                const expected = {
                    persistence: {
                        'hash-settings': {
                            length: 1024,
                            offset: 0,
                            'tcl-value': 'A tcl script'
                        }
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:ltm:node:nodestate', () => {
            it('Should return with nodestate fqdn not undefined', () => {
                const obj = {
                    kind: 'tm:ltm:node:nodestate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Address_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Address_List/Application/testItem',
                    fqdn: [{ name: 'test.server.com', tmName: undefined }],
                    metadata: [{ name: 'fqdnPrefix' }]
                };
                const expected = {
                    metadata: { fqdnPrefix: { value: 'none' } }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with nodestate fqdn undefined', () => {
                const obj = {
                    kind: 'tm:ltm:node:nodestate',
                    name: 'testItem',
                    partition: 'TEST_Firewall_Address_List',
                    subPath: 'Application',
                    fullPath: '/TEST_Firewall_Address_List/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    metadata: {}
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:ltm:persistence', () => {
            it('Should return with cookiestate with method insert', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:cookie:cookiestate',
                    name: 'testItem',
                    partition: 'TEST_Cookie',
                    subPath: 'Application',
                    fullPath: '/TEST_Cookie/Application/testItem',
                    method: 'insert',
                    hashLength: 2,
                    hashOffset: 1
                };
                const expected = {
                    'cookie-name': 'none',
                    description: 'none',
                    method: 'insert'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with cookiestate with method insert', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:cookie:cookiestate',
                    name: 'testItem',
                    partition: 'TEST_Cookie',
                    subPath: 'Application',
                    fullPath: '/TEST_Cookie/Application/testItem',
                    method: 'hash',
                    httponly: true,
                    secure: true,
                    alwaysSend: '',
                    cookieEncryption: '',
                    cookieEncryptionPassphrase: ''
                };
                const expected = {
                    'cookie-name': 'none',
                    description: 'none',
                    method: 'hash'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence dest-addr', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:dest-addr:dest-addrstate',
                    name: 'testItem',
                    partition: 'TEST_Dest_addr',
                    subPath: 'Application',
                    fullPath: '/TEST_Dest_addr/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence source-addr', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:source-addr:source-addrstate',
                    name: 'testItem',
                    partition: 'TEST_Source_addr',
                    subPath: 'Application',
                    fullPath: '/TEST_Source_addr/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence hash', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:hash:hashstate',
                    name: 'testItem',
                    partition: 'TEST_hash',
                    subPath: 'Application',
                    fullPath: '/TEST_hash/Application/testItem',
                    hashStartPattern: 'test',
                    hashEndPattern: 'test'
                };
                const expected = {
                    description: 'none',
                    /* eslint-disable no-useless-escape */
                    'hash-end-pattern': '\"test\"',
                    'hash-start-pattern': '\"test\"',
                    rule: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence msrdp', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:msrdp:msrdpstate',
                    name: 'testItem',
                    partition: 'TEST_msrdp',
                    subPath: 'Application',
                    fullPath: '/TEST_msrdp/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence sip', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:sip:sipstate',
                    name: 'testItem',
                    partition: 'TEST_sip',
                    subPath: 'Application',
                    fullPath: '/TEST_sip/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence ssl', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:ssl:sslstate',
                    name: 'testItem',
                    partition: 'TEST_ssl',
                    subPath: 'Application',
                    fullPath: '/TEST_ssl/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with persistence universal', () => {
                const obj = {
                    kind: 'tm:ltm:persistence:universal:universalstate',
                    name: 'testItem',
                    partition: 'TEST_universal',
                    subPath: 'Application',
                    fullPath: '/TEST_universal/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                    description: 'none'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
            it('Should return with profile client-ldap', () => {
                const obj = {
                    kind: 'tm:ltm:profile:client-ldap:client-ldapstate',
                    name: 'testItem',
                    partition: 'TEST_client_ldap',
                    subPath: 'Application',
                    fullPath: '/TEST_client_ldap/Application/testItem',
                    fqdn: undefined
                };
                const expected = {
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:gtm:datacenter:datacenterstate', () => {
            it('datacenterstate', () => {
                const obj = {
                    kind: 'tm:gtm:datacenter:datacenterstate',
                    name: 'testItem',
                    partition: 'TEST_PEM_Endpoint',
                    subPath: 'Application',
                    fullPath: '/TEST_PEM_Endpoint/Application/testItem',
                    disabled: false
                };
                const expected = {
                    enabled: true,
                    metadata: {}
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:gtm:prober-pool:prober-poolstate', () => {
            it('prober-poolstate', () => {
                const obj = {
                    kind: 'tm:gtm:prober-pool:prober-poolstate',
                    name: 'testItem',
                    partition: 'TEST_Prober_Pool',
                    subPath: 'Application',
                    fullPath: '/TEST_Prober_Pool/Application/testItem',
                    disabled: false,
                    members: [{ disabled: false }]
                };
                const expected = {
                    enabled: true,
                    'load-balancing-mode': 'global-availability',
                    members: {
                        undefined: {
                            enabled: true
                        }
                    }
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results[0].properties, expected);
            });
        });

        describe('tm:ltm:pool:poolstate', () => {
            let poolObj;
            beforeEach(() => {
                poolObj = {
                    kind: 'tm:ltm:pool:poolstate',
                    name: 'testItem',
                    partition: 'TEST_Pool',
                    subPath: 'Application',
                    membersReference: {
                        items: [
                            {
                                name: '192.0.2.20:8080',
                                state: 'down',
                                session: 'monitor-disabled',
                                rateLimit: '100'
                            }
                        ]
                    }
                };
            });

            it('should convert rateLimit from string to integer', () => {
                const results = translate[poolObj.kind](defaultContext, poolObj);
                assert.strictEqual(results[0].properties.members['192.0.2.20:8080']['rate-limit'], 100);
            });

            it('should update session and state', () => {
                const results = translate[poolObj.kind](defaultContext, poolObj);
                assert.strictEqual(results[0].properties.members['192.0.2.20:8080'].session, 'user-disabled');
                assert.strictEqual(results[0].properties.members['192.0.2.20:8080'].state, 'user-up');
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/client-ssl/foo2?ver=14.1.2',
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
                obj.handshakeTimeout = 'indefinite';
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
                                'handshake-timeout': 4294967295,
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

            it('should handle renegotiate and handshakeTimeout values that are not indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.allowDynamicRecordSizing = 'enabled';
                obj.data_0rtt = 'enabled-with-anti-replay';
                obj.renegotiateMaxRecordDelay = '100';
                obj.renegotiatePeriod = '100';
                obj.renegotiateSize = '100';
                obj.handshakeTimeout = '100';
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
                                'handshake-timeout': 100,
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

            it('should handle renegotiate and handshakeTimeout values of indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.data_0rtt = 'enabled';
                obj.renegotiatePeriod = 'indefinite';
                obj.renegotiateSize = 'indefinite';
                obj.handshakeTimeout = 'indefinite';
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
                                'handshake-timeout': 4294967295,
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

            it('should handle renegotiate and handshakeTimeout values that are not indefinite', () => {
                defaultContext.target.tmosVersion = '15.1';
                obj.data_0rtt = 'enabled';
                obj.renegotiatePeriod = '100';
                obj.renegotiateSize = '100';
                obj.handshakeTimeout = '100';
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
                                'handshake-timeout': 100,
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
            it('should return ltm cipher rule', () => {
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

        describe('tm:ltm:policy:policystate', () => {
            it("should return ltm 'http-host' policy", () => {
                const obj = {
                    kind: 'tm:ltm:policy:policystate',
                    name: 'myPolicy',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/myPolicy',
                    selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy?ver=16.1.2',
                    description: 'My Test Policy',
                    requires: [
                        'http',
                        'http-explicit',
                        'http-connect'
                    ],
                    status: 'published',
                    strategy: '/Common/first-match',
                    strategyReference: {
                        link: 'https://localhost/mgmt/tm/ltm/policy-strategy/~Common~first-match?ver=16.1.2'
                    },
                    references: {},
                    rulesReference: {
                        link: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules?ver=16.1.2',
                        isSubcollection: true,
                        items: [
                            {
                                kind: 'tm:ltm:policy:rules:rulesstate',
                                name: 'rule1',
                                fullPath: 'rule1',
                                selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule1?ver=16.1.2',
                                ordinal: 0,
                                conditionsReference: {
                                    link: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule1/conditions?ver=16.1.2',
                                    isSubcollection: true,
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                                            name: '0',
                                            fullPath: '0',
                                            selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule1/conditions/0?ver=16.1.2',
                                            all: true,
                                            caseInsensitive: true,
                                            contains: true,
                                            datagroup: '/Common/hostnames',
                                            datagroupReference: {
                                                link: 'https://localhost/mgmt/tm/ltm/data-group/internal/~Common~hostnames?ver=16.1.2'
                                            },
                                            external: true,
                                            httpHost: true,
                                            index: 0,
                                            present: true,
                                            proxyRequest: true,
                                            remote: true
                                        }
                                    ]
                                }
                            },
                            {
                                kind: 'tm:ltm:policy:rules:rulesstate',
                                name: 'rule2',
                                fullPath: 'rule2',
                                selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule2?ver=16.1.2',
                                ordinal: 0,
                                conditionsReference: {
                                    link: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule2/conditions?ver=16.1.2',
                                    isSubcollection: true,
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                                            name: '0',
                                            fullPath: '0',
                                            selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule2/conditions/0?ver=16.1.2',
                                            caseSensitive: true,
                                            endsWith: true,
                                            external: true,
                                            host: true,
                                            httpHost: true,
                                            index: 0,
                                            present: true,
                                            remote: true,
                                            request: true,
                                            values: [
                                                'test.com',
                                                'example.com'
                                            ]
                                        }
                                    ]
                                }
                            },
                            {
                                kind: 'tm:ltm:policy:rules:rulesstate',
                                name: 'rule3',
                                fullPath: 'rule3',
                                selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule3?ver=16.1.2',
                                ordinal: 0,
                                conditionsReference: {
                                    link: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule3/conditions?ver=16.1.2',
                                    isSubcollection: true,
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                                            name: '0',
                                            fullPath: '0',
                                            selfLink: 'https://localhost/mgmt/tm/ltm/policy/~Tenant~Application~myPolicy/rules/rule3/conditions/0?ver=16.1.2',
                                            caseInsensitive: true,
                                            equals: true,
                                            external: true,
                                            httpHost: true,
                                            index: 0,
                                            port: true,
                                            present: true,
                                            proxyConnect: true,
                                            remote: true,
                                            values: [
                                                '8080',
                                                '8443'
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/Tenant/Application/myPolicy',
                            command: 'ltm policy',
                            properties: {
                                description: '"My Test Policy"',
                                rules: {
                                    rule1: {
                                        ordinal: 0,
                                        conditions: {
                                            0: {
                                                policyString: 'http-host proxy-request all contains datagroup /Common/hostnames case-insensitive'
                                            }
                                        },
                                        actions: {}
                                    },
                                    rule2: {
                                        ordinal: 0,
                                        conditions: {
                                            0: {
                                                policyString: 'http-host request host ends-with values { test.com example.com } case-sensitive'
                                            }
                                        },
                                        actions: {}
                                    },
                                    rule3: {
                                        ordinal: 0,
                                        conditions: {
                                            0: {
                                                policyString: 'http-host proxy-connect port equals values { 8080 8443 } case-insensitive'
                                            }
                                        },
                                        actions: {}
                                    }
                                },
                                strategy: '/Common/first-match'
                            },
                            ignore: []
                        }
                    ]
                );
            });

            it('should handle values that have spaces', () => {
                const obj = {
                    kind: 'tm:ltm:policy:policystate',
                    name: 'test_EP',
                    partition: 'AS3_Tenant',
                    subPath: 'AS3_Application',
                    fullPath: '/AS3_Tenant/AS3_Application/test_EP',
                    requires: [
                        'http'
                    ],
                    status: 'legacy',
                    strategy: '/Common/best-match',
                    references: {},
                    rulesReference: {
                        isSubcollection: true,
                        items: [
                            {
                                kind: 'tm:ltm:policy:rules:rulesstate',
                                name: 'log',
                                fullPath: 'log',
                                ordinal: 0,
                                conditionsReference: {
                                    isSubcollection: true,
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                                            name: '1',
                                            fullPath: '1',
                                            caseInsensitive: true,
                                            contains: true,
                                            external: true,
                                            httpStatus: true,
                                            index: 0,
                                            present: true,
                                            remote: true,
                                            response: true,
                                            text: true,
                                            values: [
                                                'Unauthorized',
                                                'Payment Required'
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(results,
                    [
                        {
                            path: '/AS3_Tenant/AS3_Application/test_EP',
                            command: 'ltm policy',
                            properties: {
                                rules: {
                                    log: {
                                        ordinal: 0,
                                        conditions: {
                                            0: {
                                                policyString: 'http-status response text contains values { Unauthorized "Payment Required" } case-insensitive'
                                            }
                                        },
                                        actions: {}
                                    }
                                },
                                strategy: '/Common/best-match'
                            },
                            ignore: []
                        }
                    ]);
            });

            it("should return ltm 'http-uri' policy", () => {
                const obj = {
                    kind: 'tm:ltm:policy:policystate',
                    name: 'test_EP',
                    partition: 'AS3_Tenant',
                    subPath: 'AS3_Application',
                    fullPath: '/AS3_Tenant/AS3_Application/test_EP',
                    requires: [
                        'http'
                    ],
                    status: 'legacy',
                    strategy: '/Common/best-match',
                    references: {},
                    rulesReference: {
                        items: [
                            {
                                kind: 'tm:ltm:policy:rules:rulesstate',
                                name: 'replace',
                                fullPath: 'replace',
                                ordinal: 0,
                                actionsReference: {
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:actions:actionsstate',
                                            name: '0',
                                            fullPath: '0',
                                            code: 0,
                                            expirySecs: 0,
                                            httpUri: true,
                                            length: 0,
                                            offset: 0,
                                            port: 0,
                                            replace: true,
                                            request: true,
                                            status: 0,
                                            timeout: 0,
                                            value: 'http://127.0.0.1',
                                            vlanId: 0
                                        }
                                    ]
                                },
                                conditionsReference: {
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                                            name: '0',
                                            fullPath: '0',
                                            caseInsensitive: true,
                                            contains: true,
                                            datagroup: '/AS3_Tenant/AS3_Application/uriDataGroup',
                                            external: true,
                                            host: true,
                                            httpUri: true,
                                            index: 0,
                                            present: true,
                                            remote: true,
                                            request: true
                                        },
                                        {
                                            kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                                            name: '1',
                                            fullPath: '1',
                                            caseInsensitive: true,
                                            datagroup: '/AS3_Tenant/AS3_Application/portDataGroup',
                                            equals: true,
                                            external: true,
                                            httpUri: true,
                                            index: 0,
                                            port: true,
                                            present: true,
                                            remote: true,
                                            request: true
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results,
                    [
                        {
                            path: '/AS3_Tenant/AS3_Application/test_EP',
                            command: 'ltm policy',
                            properties: {
                                rules: {
                                    replace: {
                                        ordinal: 0,
                                        conditions: {
                                            0: {
                                                policyString: 'http-uri request host contains datagroup /AS3_Tenant/AS3_Application/uriDataGroup case-insensitive'
                                            },
                                            1: {
                                                policyString: 'http-uri request port equals datagroup /AS3_Tenant/AS3_Application/portDataGroup'
                                            }
                                        },
                                        actions: {
                                            0: {
                                                policyString: 'http-uri request replace value http://127.0.0.1'
                                            }
                                        }
                                    }
                                },
                                strategy: '/Common/best-match'
                            },
                            ignore: []
                        }
                    ]
                );
            });

            it("should return ltm 'bot-defense' policy", () => {
                const obj = {
                    kind: 'tm:ltm:policy:policystate',
                    name: 'myPolicy',
                    partition: 'TEST_Service_HTTP',
                    fullPath: '/TEST_Service_HTTP/myPolicy',
                    selfLink: 'https://localhost/mgmt/tm/ltm/policy/~TEST_Service_HTTP~myPolicy?ver=16.1.2',
                    controls: [
                        'bot-defense'
                    ],
                    status: 'published',
                    strategy: '/Common/first-match',
                    strategyReference: {
                        link: 'https://localhost/mgmt/tm/ltm/policy-strategy/~Common~first-match?ver=16.1.2'
                    },
                    references: {},
                    rulesReference: {
                        link: 'https://localhost/mgmt/tm/ltm/policy/~TEST_Service_HTTP~myPolicy/rules?ver=16.1.2',
                        isSubcollection: true,
                        items: [
                            {
                                kind: 'tm:ltm:policy:rules:rulesstat',
                                name: 'myPolicy',
                                fullPath: 'myPolicy',
                                selfLink: 'https://localhost/mgmt/tm/ltm/policy/~TEST_Service_HTTP~myPolicy/rules/myPolicy?ver=16.1.2',
                                ordinal: 0,
                                actionsReference: {
                                    link: 'https://localhost/mgmt/tm/ltm/policy/~TEST_Service_HTTP~myPolicy/rules/myPolicy/actions?ver=16.1.2',
                                    isSubcollection: true,
                                    items: [
                                        {
                                            kind: 'tm:ltm:policy:rules:actions:actionsstate',
                                            name: '0',
                                            fullPath: '0',
                                            selfLink: 'https://localhost/mgmt/tm/ltm/policy/~TEST_Service_HTTP~Application~myPolicy/rules/myPolicy/actions/0?ver=16.1.2',
                                            botDefense: true,
                                            code: 0,
                                            disable: true,
                                            expirySecs: 0,
                                            length: 0,
                                            offset: 0,
                                            port: 0,
                                            request: true,
                                            status: 0,
                                            timeout: 0,
                                            vlanId: 0
                                        },
                                        {
                                            kind: 'tm:ltm:policy:rules:actions:actionsstate',
                                            name: '1',
                                            fullPath: '1',
                                            selfLink: 'https://localhost/mgmt/tm/ltm/policy/~TEST_Service_HTTP~Application~myPolicy/rules/myPolicy/actions/1?ver=16.1.2',
                                            botDefense: true,
                                            clientAccepted: true,
                                            code: 0,
                                            enable: true,
                                            expirySecs: 0,
                                            fromProfile: '/Common/bot-defense',
                                            fromProfileReference: {
                                                link: 'https://localhost/mgmt/tm/security/dos/profile/~Common~bot-defense?ver=16.1.2'
                                            },
                                            length: 0,
                                            offset: 0,
                                            port: 0,
                                            status: 0,
                                            timeout: 0,
                                            vlanId: 0
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                };

                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results, [
                        {
                            path: '/TEST_Service_HTTP/myPolicy',
                            command: 'ltm policy',
                            properties: {
                                rules: {
                                    myPolicy: {
                                        ordinal: 0,
                                        conditions: {},
                                        actions: {
                                            0: {
                                                policyString: 'bot-defense request disable'
                                            },
                                            1: {
                                                policyString: 'bot-defense request enable from-profile /Common/bot-defense'
                                            }
                                        }
                                    }
                                },
                                strategy: '/Common/first-match'
                            },
                            ignore: []
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
                    selfLink: 'https://localhost/mgmt/tm/ltm/cipher/group/~SampleTenant~SampleApp~myCipherGroup?ver=14.1.0',
                    ordering: 'default',
                    allow: [
                        {
                            name: 'f5-aes',
                            partition: 'Common',
                            nameReference:
                                { link: 'https://localhost/mgmt/tm/ltm/cipher/rule/~Common~f5-aes?ver=14.1.0' }
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool?ver=14.1.0',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:a:members:memberscollectionstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool/members?ver=14.1.0',
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool?ver=14.1.0',
                    maxAnswersReturned: 10,
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool/members?ver=14.1.0',
                        isSubcollection: true
                    },
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:a:members:membersstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/a/~tenant~application~testPool/members?ver=14.1.0',
                        name: 'testServer:0',
                        partition: 'tenant',
                        fullPath: '/Common/testServer:0',
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool?ver=14.1.0',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:aaaa:members:memberscollectionstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool/members?ver=14.1.0',
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool?ver=14.1.0',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https ',
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool/members?ver=14.1.0',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        name: 'testServer:0',
                        kind: 'tm:gtm:pool:aaaa:members:membersstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/aaaa/~tenant~application~testPool/members?ver=14.1.0',
                        enabled: true,
                        partition: 'tenant',
                        fullPath: '/Common/testServer:0',
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

        describe('tm:gtm:pool:naptr:naptrstate', () => {
            it('should return GSLB_Pool NAPTR with members', () => {
                const obj = {
                    kind: 'tm:gtm:pool:naptr:naptrstate',
                    name: 'naptrPool',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/naptrPool',
                    generation: 3461,
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/naptr/~Tenant~Application~naptrPool?ver=16.1.2',
                    alternateMode: 'static-persistence',
                    description: 'testDescription',
                    dynamicRatio: 'disabled',
                    enabled: true,
                    fallbackMode: 'return-to-dns',
                    loadBalancingMode: 'round-robin',
                    manualResume: 'disabled',
                    maxAnswersReturned: 1,
                    minMembersUpMode: 'off',
                    minMembersUpValue: 0,
                    qosHitRatio: 5,
                    qosHops: 0,
                    qosKilobytesSecond: 3,
                    qosLcs: 30,
                    qosPacketRate: 1,
                    qosRtt: 50,
                    qosTopology: 0,
                    qosVsCapacity: 0,
                    qosVsScore: 0,
                    ttl: 30,
                    verifyMemberAvailability: 'enabled',
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/naptr/~Tenant~Application~naptrPool/members?ver=16.1.2',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:naptr:members:membersstate',
                        name: 'example.edu',
                        fullPath: 'example.edu',
                        generation: 3461,
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/naptr/~Tenant~Application~naptrPool/members/example.edu?ver=16.1.2',
                        description: 'memberDescription',
                        enabled: true,
                        flags: 'a',
                        memberOrder: 0,
                        order: 10,
                        preference: 10,
                        ratio: 1,
                        service: 'sip+d2u'
                    }
                ];

                const results = translate[obj.kind](defaultContext, obj, referenceConfig);
                assert.deepStrictEqual(results,
                    [
                        {
                            path: '/Tenant/Application/naptrPool',
                            command: 'gtm pool naptr',
                            properties: {
                                description: '"testDescription"',
                                'dynamic-ratio': 'disabled',
                                enabled: true,
                                'load-balancing-mode': 'round-robin',
                                'alternate-mode': 'static-persistence',
                                'fallback-mode': 'return-to-dns',
                                'manual-resume': 'disabled',
                                ttl: 30,
                                'verify-member-availability': 'enabled',
                                'max-answers-returned': 1,
                                members: {
                                    '/Common/example.edu': {
                                        description: '"memberDescription"',
                                        enabled: true,
                                        flags: 'a',
                                        'member-order': 0,
                                        preference: 10,
                                        ratio: 1,
                                        service: 'sip+d2u'
                                    }
                                },
                                'qos-hit-ratio': 5,
                                'qos-hops': 0,
                                'qos-kilobytes-second': 3,
                                'qos-lcs': 30,
                                'qos-packet-rate': 1,
                                'qos-rtt': 50,
                                'qos-topology': 0,
                                'qos-vs-capacity': 0,
                                'qos-vs-score': 0
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool?ver=14.1.0',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https '
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:pool:cname:members:memberscollectionstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool/members?ver=14.1.0',
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool?ver=14.1.0',
                    maxAnswersReturned: 10,
                    monitor: '/Common/http and /Common/https ',
                    membersReference: {
                        link: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool/members?ver=14.1.0',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        name: 'testServer:0',
                        kind: 'tm:gtm:pool:cname:members:membersstate',
                        selfLink: 'https://localhost/mgmt/tm/gtm/pool/cname/~tenant~application~testPool/members?ver=14.1.0',
                        enabled: true,
                        partition: 'tenant',
                        fullPath: '/Common/testServer:0',
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
                                '/Common/testServer:0': {
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer?ver=14.1.0',
                    datacenter: '/Common/testDataCenter',
                    datacenterReference:
                        { link: 'https://localhost/mgmt/tm/gtm/datacenter/~Common~testDataCenter?ver=14.1.0' },
                    enabled: true,
                    monitor: '/Common/bigip ',
                    addresses: [{ name: '192.0.2.7', deviceName: '0', translation: 'none' }],
                    metadata: [
                        { name: 'as3', persist: 'true' },
                        { name: 'as3-virtuals', persist: true, value: '192.0.2.8:5050' }
                    ],
                    virtualServersReference:
                    {
                        link: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers?ver=14.1.0',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:server:devices:devicesstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6284,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/devices/0?ver=14.1.0',
                        addresses: [{ name: '192.0.2.7', translation: 'none' }]
                    },
                    {
                        kind: 'tm:gtm:server:virtual-servers:virtual-serversstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6283,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers/0?ver=14.1.0',
                        destination: '192.0.2.8:5050',
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
                                        '192.0.2.7': {
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
                                    value: '192.0.2.8:5050'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            'prober-pool': 'none',
                            'virtual-servers': {
                                0: {
                                    destination: '192.0.2.8:5050',
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
                    selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer?ver=14.1.0',
                    datacenter: '/Common/testDataCenter',
                    datacenterReference:
                        { link: 'https://localhost/mgmt/tm/gtm/datacenter/~Common~testDataCenter?ver=14.1.0' },
                    enabled: true,
                    monitor: '/Common/bigip ',
                    addresses: [],
                    metadata: [
                        { name: 'as3', persist: 'true' },
                        { name: 'as3-virtuals', persist: true, value: '192.0.2.8:5050' }
                    ],
                    virtualServersReference:
                    {
                        link: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers?ver=14.1.0',
                        isSubcollection: true
                    }
                };

                const referenceConfig = [
                    {
                        kind: 'tm:gtm:server:virtual-servers:virtual-serversstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6283,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers/0?ver=14.1.0',
                        destination: '192.0.2.8:5050',
                        enabled: true,
                        monitor: '/Common/http '
                    },
                    {
                        kind: 'tm:gtm:server:virtual-servers:virtual-serversstate',
                        name: '0',
                        fullPath: '0',
                        generation: 6283,
                        selfLink: 'https://localhost/mgmt/tm/gtm/server/~Common~testServer/virtual-servers/0?ver=14.1.0',
                        destination: '192.0.2.9:80',
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
                                    value: '192.0.2.8:5050'
                                }
                            },
                            monitor: '/Common/bigip',
                            product: 'bigip',
                            'prober-pool': 'none',
                            addresses: {},
                            'virtual-servers': {
                                0: {
                                    destination: '192.0.2.8:5050',
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
                    loadBalancingDecisionLogVerbosity: [
                        'pool-member-selection',
                        'pool-member-traversal',
                        'pool-selection',
                        'pool-traversal'
                    ],
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
                            'load-balancing-decision-log-verbosity': {
                                'pool-member-selection': {},
                                'pool-member-traversal': {},
                                'pool-selection': {},
                                'pool-traversal': {}
                            },
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
                    loadBalancingDecisionLogVerbosity: [],
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
                            'load-balancing-decision-log-verbosity': {},
                            'pool-lb-mode': 'round-robin',
                            pools: {},
                            'pools-cname': {},
                            rules: {}
                        }
                    }
                );
            });
        });

        describe('tm:gtm:wideip:aaaa:aaaastate', () => {
            it('should return an object with ordered pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:aaaa:aaaastate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [
                        'pool-member-selection',
                        'pool-member-traversal',
                        'pool-selection',
                        'pool-traversal'
                    ],
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
                        command: 'gtm wideip aaaa',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {
                                'pool-member-selection': {},
                                'pool-member-traversal': {},
                                'pool-selection': {},
                                'pool-traversal': {}
                            },
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
                    kind: 'tm:gtm:wideip:aaaa:aaaastate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [],
                    minimalResponse: 'enabled',
                    name: 'example.edu',
                    partition: 'ten',
                    poolLbMode: 'round-robin'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'gtm wideip aaaa',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {},
                            'pool-lb-mode': 'round-robin',
                            pools: {},
                            'pools-cname': {},
                            rules: {}
                        }
                    }
                );
            });
        });

        describe('tm:gtm:wideip:cname:cnamestate', () => {
            it('should return an object with ordered pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:cname:cnamestate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [
                        'pool-member-selection',
                        'pool-member-traversal',
                        'pool-selection',
                        'pool-traversal'
                    ],
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
                        command: 'gtm wideip cname',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {
                                'pool-member-selection': {},
                                'pool-member-traversal': {},
                                'pool-selection': {},
                                'pool-traversal': {}
                            },
                            'pool-lb-mode': 'round-robin',
                            pools: {
                                '/ten/app/pool3': { order: 1, ratio: 3 },
                                '/ten/app/pool1': { order: 2, ratio: 1 },
                                '/ten/app/pool2': { order: 0, ratio: 2 }
                            },
                            rules: {}
                        }
                    }
                );
            });

            it('should return an object without pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:cname:cnamestate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [],
                    minimalResponse: 'enabled',
                    name: 'example.edu',
                    partition: 'ten',
                    poolLbMode: 'round-robin'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'gtm wideip cname',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {},
                            'pool-lb-mode': 'round-robin',
                            pools: {},
                            rules: {}
                        }
                    }
                );
            });
        });

        describe('tm:gtm:wideip:mx:mxstate', () => {
            it('should return an object with ordered pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:mx:mxstate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [
                        'pool-member-selection',
                        'pool-member-traversal',
                        'pool-selection',
                        'pool-traversal'
                    ],
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
                        command: 'gtm wideip mx',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {
                                'pool-member-selection': {},
                                'pool-member-traversal': {},
                                'pool-selection': {},
                                'pool-traversal': {}
                            },
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
                    kind: 'tm:gtm:wideip:mx:mxstate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [],
                    minimalResponse: 'enabled',
                    name: 'example.edu',
                    partition: 'ten',
                    poolLbMode: 'round-robin'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'gtm wideip mx',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {},
                            'pool-lb-mode': 'round-robin',
                            pools: {},
                            'pools-cname': {},
                            rules: {}
                        }
                    }
                );
            });
        });

        describe('tm:gtm:wideip:naptr:naptrstate', () => {
            it('should return an object with ordered pools', () => {
                const obj = {
                    kind: 'tm:gtm:wideip:naptr:naptrstate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [
                        'pool-member-selection',
                        'pool-member-traversal',
                        'pool-selection',
                        'pool-traversal'
                    ],
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
                        command: 'gtm wideip naptr',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {
                                'pool-member-selection': {},
                                'pool-member-traversal': {},
                                'pool-selection': {},
                                'pool-traversal': {}
                            },
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
                    kind: 'tm:gtm:wideip:naptr:naptrstate',
                    enabled: true,
                    fullPath: '/ten/app/example.edu',
                    lastResortPool: '',
                    loadBalancingDecisionLogVerbosity: [],
                    minimalResponse: 'enabled',
                    name: 'example.edu',
                    partition: 'ten',
                    poolLbMode: 'round-robin'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'gtm wideip naptr',
                        ignore: [],
                        path: '/ten/example.edu',
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'load-balancing-decision-log-verbosity': {},
                            'pool-lb-mode': 'round-robin',
                            pools: {},
                            'pools-cname': {},
                            rules: {}
                        }
                    }
                );
            });
        });

        describe('tm:gtm:monitor', () => {
            describe('tm:gtm:monitor:http:httpstate', () => {
                it('should return GSLB_Monitor HTTP', () => {
                    defaultContext.target.tmosVersion = '15.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:http:httpstate',
                        name: 'gslb_monitor_http',
                        partition: 'Tenant',
                        subPath: 'Application',
                        fullPath: '/Tenant/Application/gslb_monitor_http',
                        generation: 0,
                        selfLink: 'https://localhost/mgmt/tm/gtm/monitor/http/~Tenant~Application~gslb_monitor_http?ver=15.1.8',
                        defaultsFrom: '/Common/http',
                        description: 'my remark',
                        destination: '192.0.2.20:80',
                        ignoreDownResponse: 'enabled',
                        interval: 31,
                        probeTimeout: 6,
                        recv: 'My Receive String',
                        recvStatusCode: '200 302',
                        reverse: 'enabled',
                        send: 'GET /www/siterequest/index.html\\r\\n',
                        timeout: 121,
                        transparent: 'enabled'
                    };

                    const results = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(results, [
                        {
                            path: '/Tenant/Application/gslb_monitor_http',
                            command: 'gtm monitor http',
                            properties: {
                                description: '"my remark"',
                                destination: '192.0.2.20:80',
                                'ignore-down-response': 'enabled',
                                interval: 31,
                                'probe-timeout': 6,
                                recv: '"My Receive String"',
                                'recv-status-code': '"200 302"',
                                reverse: 'enabled',
                                send: '"GET /www/siterequest/index.html\\\\r\\\\n"',
                                timeout: 121,
                                transparent: 'enabled'
                            },
                            ignore: []
                        }
                    ]);
                });
            });

            describe('tm:gtm:monitor:https:httpsstate', () => {
                it('should process with default values', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:https:httpsstate',
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none',
                        recv: 'none',
                        send: 'none',
                        cert: 'none',
                        key: 'none',
                        'recv-status-code': 'none',
                        'sni-server-name': 'none'
                    });
                });

                it('should process with all values', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:https:httpsstate',
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor',
                        remark: 'Test HTTPS props',
                        clientCertificate: 'webcert',
                        key: 'webcert.key',
                        ciphers: 'DEFAULT:TLS1.2:!SSLv3',
                        target: '*:*',
                        interval: 30,
                        timeout: 120,
                        probeTimeout: 5,
                        receive: 'foo',
                        receiveStatusCodes: '200',
                        reverseEnabled: true,
                        send: 'GET /',
                        sniServerName: 'test.example.com',
                        transparent: true
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        cert: 'webcert',
                        key: 'webcert.key',
                        cipherlist: 'DEFAULT:TLS1.2:!SSLv3',
                        /* eslint-disable no-useless-escape */
                        description: '\"Test HTTPS props\"',
                        recv: '\"foo\"',
                        send: '\"GET /\"',
                        /* eslint-enable no-useless-escape */
                        destination: '*:*',
                        interval: 30,
                        'probe-timeout': 5,
                        'recv-status-code': '"200"',
                        reverse: 'enabled',
                        'sni-server-name': 'test.example.com',
                        timeout: 120,
                        transparent: 'enabled'
                    });
                });

                it('should ignore sniServerName property for < 16.1', () => {
                    defaultContext.target.tmosVersion = '15.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:https:httpsstate',
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none',
                        recv: 'none',
                        'recv-status-code': 'none',
                        send: 'none',
                        cert: 'none',
                        key: 'none'
                    });
                });

                it('should ignore recvStatusCodes property for < 15.1', () => {
                    defaultContext.target.tmosVersion = '14.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:https:httpsstate',
                        name: 'myMonitor',
                        partition: 'Tenant',
                        fullPath: '/Tenant/Application/myMonitor'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none',
                        recv: 'none',
                        send: 'none',
                        cert: 'none',
                        key: 'none'
                    });
                });
            });
            describe('tm:gtm:rule', () => {
                it('should process with rulestate response will be empty', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:rule:rulestate',
                        name: 'myGtmRules',
                        partition: 'Tenant',
                        subPath: 'myRules'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                    });
                });
            });

            describe('tm:gtm:monitor', () => {
                it('should process with monitor gateway icmp', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:gateway-icmp:gateway-icmpstate',
                        name: 'myGtmMonitorGateway',
                        partition: 'Tenant',
                        subPath: 'myGateway',
                        description: 'none'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none'
                    });
                });

                it('should process with monitor tcp half open', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:tcp-half-open:tcp-half-openstate',
                        name: 'myGtmMonitorTcpHalfOpen',
                        partition: 'Tenant',
                        subPath: 'TcpHalfOpen',
                        description: 'none'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none'
                    });
                });

                it('should process with monitor tcp state', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:tcp:tcpstate'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none',
                        recv: 'none',
                        send: 'none'
                    });
                });

                it('should process with monitor udp state', () => {
                    defaultContext.target.tmosVersion = '16.1';
                    const obj = {
                        kind: 'tm:gtm:monitor:udp:udpstate'
                    };
                    const result = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(result[0].properties, {
                        description: 'none',
                        recv: 'none',
                        send: 'none'
                    });
                });
            });
        });

        describe('tm:gtm:region', () => {
            describe('tm:gtm:region:regionstate', () => {
                it('should return Default Region', () => {
                    defaultContext.target.tmosVersion = '15.1';
                    const obj = {
                        kind: 'tm:gtm:region:regionstate',
                        name: 'gtm_region',
                        partition: 'Tenant',
                        subPath: 'Application',
                        fullPath: '/Tenant/Application/gtm_region',
                        generation: 0,
                        description: 'my remark',
                        regionMembers: [{
                            name: 'region'
                        }]
                    };

                    const results = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(results, [
                        {
                            path: '/Tenant/Application/gtm_region',
                            command: 'gtm region',
                            properties: {
                                description: '"my remark"',
                                'region-members': {
                                    ' region': {
                                        not: 'none'
                                    }
                                }
                            },
                            ignore: []
                        }
                    ]);
                });
            });
        });

        describe('tm:gtm:topology', () => {
            describe('tm:gtm:topology:topologystate', () => {
                it('should return  Topology', () => {
                    defaultContext.target.tmosVersion = '15.1';
                    const obj = {
                        kind: 'tm:gtm:topology:topologystate',
                        name: 'gtm_topology',
                        partition: 'Tenant'
                    };

                    const results = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(results, [
                        {
                            path: '/Common/topology/records',
                            command: 'gtm topology',
                            properties: {
                                records: {
                                    NaN: {
                                        'ldns:': ' gtm_t',
                                        'server:': ' ology'
                                    }
                                }
                            },
                            ignore: []
                        }
                    ]);
                });
            });
        });

        describe('tm:gtm:global-settings', () => {
            describe('tm:gtm:global-settings:load-balancing:load-balancingstate', () => {
                it('should return global-settings', () => {
                    defaultContext.target.tmosVersion = '15.1';
                    const obj = {
                        kind: 'tm:gtm:global-settings:load-balancing:load-balancingstate',
                        name: 'gtm_global_settings',
                        partition: 'Tenant'
                    };

                    const results = translate[obj.kind](defaultContext, obj);
                    assert.deepStrictEqual(results, [
                        {
                            path: '/Common/global-settings',
                            command: 'gtm global-settings load-balancing',
                            properties: {
                                'topology-longest-match': 'yes'
                            },
                            ignore: []
                        }
                    ]);
                });
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

        describe('tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate', () => {
            beforeEach(() => {
                defaultContext.target.tmosVersion = '14.1';
            });

            it('should map CIDR to mask', () => {
                const obj = {
                    kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                    fullPath: '/Tenant/Application/myTrafficMatchingCriteria',
                    command: 'ltm traffic-matching-criteria',
                    destinationAddressInline: '192.0.2.1/18'
                };
                const results = translate[obj.kind](defaultContext, obj);
                const properties = results[0].properties;
                // gitleaks is fooled by the mask
                assert.strictEqual(properties['destination-address-inline'], '192.0.2.1/255.255.192.0'); // gitleaks:allow
            });

            it('should map destination-address-inline 0.0.0.0 to any', () => {
                const obj = {
                    kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                    fullPath: '/Tenant/Application/myTrafficMatchingCriteria',
                    destinationAddressInline: '0.0.0.0'
                };
                const results = translate[obj.kind](defaultContext, obj);
                const properties = results[0].properties;
                assert.strictEqual(properties['destination-address-inline'], 'any/any');
            });

            it('should map source-address-inline CIDR to mask', () => {
                const obj = {
                    kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                    fullPath: '/Tenant/Application/myTrafficMatchingCriteria',
                    sourceAddressInline: '192.0.2.1/18'
                };
                const results = translate[obj.kind](defaultContext, obj);
                const properties = results[0].properties;
                // gitleaks is fooled by the mask
                assert.strictEqual(properties['source-address-inline'], '192.0.2.1/255.255.192.0'); // gitleaks:allow
            });
        });

        describe('tm:ltm:virtual:virtualstate', () => {
            it('should delete source and destination if traffic-matching-criteria is used', () => {
                const obj = {
                    kind: 'tm:ltm:virtual:virtualstate',
                    trafficMatchingCriteria: '/Tenant/Application/Service_VS_TMC_OBJ',
                    source: 'mySource',
                    destination: 'myDestination'
                };
                const results = translate[obj.kind](defaultContext, obj);
                const properties = results[0].properties;
                assert.strictEqual(properties.destination, undefined);
                assert.strictEqual(properties.source, undefined);
            });

            it('should handle 0.0.0.0 in destination', () => {
                const obj = {
                    kind: 'tm:ltm:virtual:virtualstate',
                    name: 'vs',
                    partition: 'Tenant0.0.0.0',
                    subPath: 'app0',
                    fullPath: '/Tenant0.0.0.0/app0/vs',
                    destination: '/Tenant0.0.0.0/0.0.0.0:443'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert(results[0].properties.destination, '/Tenant0.0.0.0/any:443');
            });

            it('should handle wildcard-like in destination', () => {
                const obj = {
                    kind: 'tm:ltm:virtual:virtualstate',
                    name: 'vs',
                    partition: 'Tenant',
                    subPath: 'app0',
                    fullPath: '/Tenant/app0/vs',
                    destination: '/Tenant/100.0.0.0:443'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert(results[0].properties.destination, '/Tenant/100.0.0.0:443');
            });
        });

        describe('tm:ltm:data-group:internal:internalstate', () => {
            it('should handle internal data-group config', () => {
                const obj = {
                    kind: 'tm:ltm:data-group:internal:internalstate',
                    name: 'dataGroup',
                    partition: 'tenant',
                    subPath: 'app',
                    fullPath: '/tenant/app/dataGroup',
                    type: 'string',
                    records: [
                        {
                            name: 'test.data.group',
                            data: 'The data;'
                        },
                        {
                            name: 'quotes',
                            data: 'has \\"quotes\\"'
                        }
                    ]
                };
                const results = translate[obj.kind](defaultContext, obj);
                const properties = results[0].properties;
                assert.deepStrictEqual(
                    properties,
                    {
                        description: 'none',
                        type: 'string',
                        records: {
                            '"test.data.group"': {
                                data: '"The data\\;"'
                            },
                            '"quotes"': {
                                data: '"has \\"quotes\\""'
                            }
                        }
                    }
                );
            });
        });

        describe('tm:ltm:snat-translation:snat-translationstate', () => {
            it('should return ltm profile snat-translation with mostly default values', () => {
                const obj = {
                    kind: 'tm:ltm:snat-translation:snat-translationstate',
                    name: '10.10.21.21',
                    partition: 'Common',
                    fullPath: '/Common/10.10.21.21',
                    generation: 44780,
                    selfLink: 'https://localhost/mgmt/tm/ltm/snat-translation/~Common~10.10.21.21?ver=17.0.0',
                    address: '10.10.21.21',
                    arp: 'enabled',
                    connectionLimit: 4294967295,
                    enabled: true,
                    inheritedTrafficGroup: 'true',
                    ipIdleTimeout: 'indefinite',
                    tcpIdleTimeout: 'indefinite',
                    trafficGroup: '/Common/traffic-group-1',
                    trafficGroupReference: {
                        link: 'https://localhost/mgmt/tm/cm/traffic-group/~Common~traffic-group-1?ver=17.0.0'
                    },
                    udpIdleTimeout: 'indefinite',
                    unit: 1
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        path: '/Common/10.10.21.21',
                        command: 'ltm snat-translation',
                        properties: {
                            address: '10.10.21.21',
                            arp: 'enabled',
                            'connection-limit': 4294967295,
                            enabled: {},
                            'ip-idle-timeout': 'indefinite',
                            'tcp-idle-timeout': 'indefinite',
                            'traffic-group': 'default',
                            'udp-idle-timeout': 'indefinite'
                        },
                        ignore: []
                    }
                );
            });

            it('should return ipv6 ltm profile with more customized values', () => {
                const obj = {
                    kind: 'tm:ltm:snat-translation:snat-translationstate',
                    name: '2001:db8::1',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/2001:db8::1',
                    generation: 48870,
                    selfLink: 'https://localhost/mgmt/tm/ltm/snat-translation/~Tenant~Application~2001:db8::1?ver=17.0.0',
                    address: '2001:db8::1',
                    arp: 'enabled',
                    connectionLimit: 0,
                    disabled: true,
                    inheritedTrafficGroup: 'false',
                    ipIdleTimeout: '3000',
                    tcpIdleTimeout: '1000',
                    trafficGroup: '/Common/traffic-group-1',
                    trafficGroupReference: {
                        link: 'https://localhost/mgmt/tm/cm/traffic-group/~Common~traffic-group-1?ver=17.0.0'
                    },
                    udpIdleTimeout: '2000',
                    unit: 1
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        path: '/Tenant/Application/2001:db8::1',
                        command: 'ltm snat-translation',
                        properties: {
                            address: '2001:db8::1',
                            arp: 'enabled',
                            'connection-limit': 0,
                            disabled: {},
                            'ip-idle-timeout': '3000',
                            'tcp-idle-timeout': '1000',
                            'traffic-group': '/Common/traffic-group-1',
                            'udp-idle-timeout': '2000'
                        },
                        ignore: []
                    }
                );
            });
        });

        describe('tm:net:route-domain:route-domainstate', () => {
            it('should create tm:net:route-domain:route-domainstate config', () => {
                const obj = {
                    kind: 'tm:net:route-domain:route-domainstate',
                    fullPath: '/Common/100',
                    fwEnforcedPolicy: '/Common/Shared/firewallPolicy'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'net route-domain',
                        ignore: [],
                        path: '/Common/100',
                        properties: {
                            'fw-enforced-policy': '/Common/Shared/firewallPolicy'
                        }
                    }
                );
            });
        });

        describe('tm:apm:aaa:ping-access-properties-file:ping-access-properties-filestate', () => {
            it('should create tm:apm:aaa:ping-access-properties-file:ping-access-properties-filestate config', () => {
                const obj = {
                    kind: 'tm:apm:aaa:ping-access-properties-file:ping-access-properties-filestate',
                    name: 'testPingAccess',
                    partition: 'SampleTenant',
                    subPath: 'Application',
                    fullPath: '/SampleTenant/Application/testPingAccess'
                };
                const results = translate[obj.kind](defaultContext, obj);
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'apm aaa ping-access-properties-file',
                        ignore: [],
                        path: '/SampleTenant/Application/testPingAccess',
                        properties: {}
                    }
                );
            });
        });

        describe('tm:apm:profile:ping-access:ping-accessstate', () => {
            it('should create tm:apm:profile:ping-access:ping-accessstate config', () => {
                const obj = {
                    kind: 'tm:apm:profile:ping-access:ping-accessstate',
                    name: 'testPingAccess',
                    partition: 'SampleTenant',
                    subPath: 'Application',
                    fullPath: '/SampleTenant/Application/app',
                    pingAccessProperties: '/SampleTenant/Application/testPingAccess',
                    pingAccessPropertiesReference: {
                        link: 'https://localhost/mgmt/tm/apm/aaa/ping-access-properties-file/~SampleTenant~Application~testPingAccess?ver=15.1.0'
                    },
                    pool: '/SampleTenant/Application/testPool',
                    poolReference: {
                        link: 'https://localhost/mgmt/tm/ltm/pool/~SampleTenant~Application~testPool?ver=15.1.0'
                    },
                    serversslProfile: '/SampleTenant/Application/testServerSSL',
                    serversslProfileReference: {
                        link: 'https://localhost/mgmt/tm/ltm/profile/server-ssl/~SampleTenant~Application~testServerSSL?ver=15.1.0'
                    },
                    useHttps: 'true'
                };
                const results = translate[obj.kind](defaultContext, obj);
                console.log(JSON.stringify(results[0]));
                assert.deepStrictEqual(
                    results[0],
                    {
                        command: 'apm profile ping-access',
                        ignore: [],
                        path: '/SampleTenant/Application/app',
                        properties: {
                            'ping-access-properties': '/SampleTenant/Application/testPingAccess',
                            pool: '/SampleTenant/Application/testPool',
                            'serverssl-profile': '/SampleTenant/Application/testServerSSL',
                            'use-https': 'true'
                        }
                    }
                );
            });
        });
    });
});

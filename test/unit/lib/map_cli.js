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

const assert = require('assert');

const EventEmitter = require('events');
const sinon = require('sinon');
const mapCli = require('../../../src/lib/map_cli');
const Context = require('../../../src/lib/context/context');

describe('map_cli', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('.tmshCreate()', () => {
        let context;

        beforeEach(() => {
            context = Context.build();
        });

        describe('gtm wideip', () => {
            it('gtm wideip creation', () => {
                const diff = {
                    kind: 'D',
                    path: [
                        '/Common/Shared/wip.example.com a'
                    ],
                    rhsCommand: 'gtm wideip a'
                };
                const output = mapCli.tmshCreate(context, diff, {});
                assert.strictEqual(
                    output.commands[0],
                    'tmsh::create gtm wideip a \\"/Common/Shared/wip.example.com\\" pools none aliases none enabled '
                );
            });

            it('gtm wideip creation with last-resort-pool', () => {
                const diff = {
                    kind: 'D',
                    path: [
                        '/Common/Shared/wip.example.com a'
                    ],
                    rhsCommand: 'gtm wideip a'
                };
                const targetConfig = {
                    'last-resort-pool': 'sample.com'
                };
                const output = mapCli.tmshCreate(context, diff, targetConfig);
                assert.strictEqual(
                    output.commands[0],
                    'tmsh::create gtm wideip a \\"/Common/Shared/wip.example.com\\" last-resort-pool sample.com pools none aliases none enabled '
                );
            });

            it('should create a gtm wideip a with pools', () => {
                const diff = {
                    command: 'gtm wideip a',
                    kind: 'N',
                    lhsCommand: '',
                    path: ['/ten/app/example.edu a'],
                    rhs: {
                        command: 'gtm wideip a',
                        ignore: [],
                        properties: {
                            aliases: {},
                            enabled: true,
                            'last-resort-pool': 'none',
                            'pool-lb-mode': 'round-robin',
                            pools: {
                                '/ten/app/pool2': { order: 1 },
                                '/ten/app/pool3': { order: 2 },
                                '/ten/app/pool1': { order: 0 }
                            },
                            'pools-cname': {}
                        }
                    },
                    rhsCommand: 'gtm wideip a'
                };
                const targetConfig = {
                    aliases: {},
                    enabled: true,
                    'last-resort-pool': 'none',
                    'pool-lb-mode': 'round-robin',
                    pools: {
                        '/ten/app/pool2': { order: 1 },
                        '/ten/app/pool3': { order: 2 },
                        '/ten/app/pool1': { order: 0 }
                    },
                    'pools-cname': {}
                };
                const results = mapCli.tmshCreate(context, diff, targetConfig);

                return assert.strictEqual(
                    results.commands[0],
                    'tmsh::create gtm wideip a \\"/ten/app/example.edu\\" aliases none enabled  pool-lb-mode round-robin pools replace-all-with \\{ /ten/app/pool2 \\{ order 1 \\} /ten/app/pool3 \\{ order 2 \\} /ten/app/pool1 \\{ order 0 \\} \\} pools-cname none'
                );
            });
        });

        it('gtm topology creation', () => {
            const targetConfig = {
                records: {
                    0: {
                        description: '"This object is managed by appsvcs, do not modify this description"',
                        ldns: 'region /Common/private-net',
                        server: 'pool /INT-DNS/DNS/pool-test-443',
                        score: 100,
                        order: 1
                    },
                    1: {
                        description: '"This object is managed by appsvcs, do not modify this description"',
                        ldns: 'not region /Common/private-net',
                        server: 'pool /INT-DNS/DNS/pool-drop',
                        score: 100,
                        order: 2
                    }
                }
            };

            const diff = {
                kind: 'N',
                path: [
                    '/INT-DNS/topology/records'
                ],
                rhsCommand: 'gtm topology'
            };

            context.tasks.push({});

            const output = mapCli.tmshCreate(context, diff, targetConfig);
            assert.strictEqual(context.tasks[0].gtmTopologyProcessed, true);
            assert.strictEqual(
                output.commands[0],
                'tmsh::create gtm topology  description \\"This object is managed by appsvcs, do not modify this description\\" ldns region /Common/private-net server pool /INT-DNS/DNS/pool-test-443 score 100 order 1'
            );
            assert.strictEqual(
                output.commands[1],
                'tmsh::create gtm topology  description \\"This object is managed by appsvcs, do not modify this description\\" ldns not region /Common/private-net server pool /INT-DNS/DNS/pool-drop score 100 order 2'
            );
        });

        it('gtm pool member', () => {
            const targetConfig = {
                enabled: true,
                members: {
                    'example.com': {
                        enabled: true,
                        'member-order': 0,
                        ratio: 10,
                        'static-target': 'yes'
                    }
                }
            };
            const diff = {
                kind: 'N',
                path: [
                    '/Common/Shared/gslbPoolA'
                ],
                rhsCommand: 'gtm pool a'
            };
            const output = mapCli.tmshCreate(context, diff, targetConfig);

            assert.strictEqual(
                output.commands[0],
                'tmsh::create gtm pool a /Common/Shared/gslbPoolA enabled  members replace-all-with \\{ example.com \\{ enabled  member-order 0 ratio 10 static-target yes \\} \\}'
            );
        });

        describe('ltm http profile', () => {
            it('should handle header-insert with unescaped curly braces', () => {
                const targetConfig = {
                    'header-insert': 'myInsert: {curly braces {} here }'
                };

                const diff = {
                    kind: 'N',
                    path: [
                        '/Common/Shared/profileHTTP'
                    ],
                    rhsCommand: 'ltm profile http'
                };
                const output = mapCli.tmshCreate(context, diff, targetConfig);

                assert.strictEqual(
                    output.commands[0],
                    'tmsh::create ltm profile http /Common/Shared/profileHTTP header-insert myInsert: {curly braces {} here }'
                );
            });

            it('should handle header-insert with escaped curly braces', () => {
                const targetConfig = {
                    'header-insert': 'myInsert: \\{curly braces \\{\\} here \\}'
                };

                const diff = {
                    kind: 'N',
                    path: [
                        '/Common/Shared/profileHTTP'
                    ],
                    rhsCommand: 'ltm profile http'
                };
                const output = mapCli.tmshCreate(context, diff, targetConfig);

                assert.strictEqual(
                    output.commands[0],
                    'tmsh::create ltm profile http /Common/Shared/profileHTTP header-insert myInsert: \\{curly braces \\{\\} here \\}'
                );
            });
        });

        describe('external monitors', () => {
            ['ltm', 'gtm'].forEach((module) => {
                it(`${module} monitor external creation`, () => {
                    const targetConfig = {
                        run: '/path/to/file',
                        'user-defined': {}
                    };

                    const currentConfig = {};

                    const diff = {
                        path: ['/The/Path'],
                        rhsCommand: `${module} monitor external`
                    };

                    const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                    assert.strictEqual(
                        result.commands[0],
                        `tmsh::create ${module} monitor external /The/Path run /path/to/file`
                    );
                });

                it(`${module} monitor external with environment variables creation`, () => {
                    const targetConfig = {
                        'user-defined': {
                            USER: 'nobody',
                            PASSWORD: 'secret'
                        }
                    };
                    const currentConfig = {
                        '/The/Path': {
                            properties: {
                                'user-defined': {
                                    DELETE: 'me'
                                }
                            }
                        }
                    };

                    const diff = {
                        path: ['/The/Path'],
                        rhsCommand: `${module} monitor external`
                    };
                    const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                    assert.strictEqual(
                        result.commands[0],
                        `tmsh::create ${module} monitor external /The/Path user-defined USER nobody user-defined PASSWORD secret user-defined DELETE none`
                    );
                });
            });
        });

        it('ltm pool member deletion', () => {
            const diff = {
                kind: 'D',
                path: [
                    '/Generic_Ten/Generic_App/generic_Pool',
                    'properties',
                    'members',
                    '/Generic_Ten/10.128.0.9:80',
                    'session'
                ],
                rhsCommand: 'ltm pool'
            };
            const targetConfig = {
                members: {
                    '/Generic_Ten/10.128.0.9:80': {}
                }
            };
            const currentConfig = {
                '/Generic_Ten/Generic_App/generic_Pool': {
                    properties: {
                        members: {
                            '/Generic_Ten/10.128.0.9:80': {}
                        }
                    }
                }
            };
            const output = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
            assert.strictEqual(
                output.commands[0],
                'tmsh::modify ltm pool /Generic_Ten/Generic_App/generic_Pool members delete \\{ "/Generic_Ten/10.128.0.9:80" \\}'
            );
        });

        it('ltm pool member rollback', () => {
            const diff = {
                kind: 'D',
                path: [
                    'tenant/app/pool',
                    'properties',
                    'members',
                    '/tenant/192.0.2.0:80'
                ],
                rhsCommand: 'ltm pool'
            };
            const targetConfig = {
                members: {
                    '/tenant/192.0.2.0:0': {}
                }
            };
            const currentConfig = {
                'tenant/app/pool': {
                    properties: {
                        members: {
                            '/tenant/192.0.2.0:80': {
                                monitor: {
                                    default: {}
                                },
                                metadata: {
                                    source: {
                                        value: 'declaration'
                                    }
                                },
                                ratio: 1,
                                'rate-limit': 'disabled'
                            }
                        }
                    }
                }
            };
            const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
            assert.deepStrictEqual(
                result.rollback,
                [
                    'tmsh::modify ltm pool tenant/app/pool members add \\{ /tenant/192.0.2.0:80 \\{ metadata replace-all-with \\{ source \\{ value declaration \\} \\} ratio 1 rate-limit disabled \\} \\}'
                ]
            );
        });

        it('ltm policy modify rules', () => {
            const diff = {
                kind: 'E',
                path: [
                    '/tenant/application/policy',
                    'properties',
                    'rules',
                    'default',
                    'actions',
                    '0',
                    'policyString'
                ],
                rhsCommand: 'ltm policy'
            };

            const config = {
                rules: {
                    default: {
                        ordinal: 0,
                        conditions: {},
                        actions: {
                            0: {
                                '': 'http-reply request redirect location https://example.com/wam'
                            }
                        }
                    }
                },
                strategy: '/Common/best-match',
                legacy: '',
                requires: {
                    http: {}
                }
            };
            const result = mapCli.tmshCreate(context, diff, config);
            assert.strictEqual(
                result.commands[0],
                'tmsh::create ltm policy /tenant/application/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions none actions replace-all-with \\{ 0 \\{  http-reply request redirect location https://example.com/wam \\} \\} \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ http \\} controls replace-all-with \\{ forwarding \\}'
            );
        });

        it('ltm policy string handling - url with semicolon', () => {
            const config = {
                rules: {
                    default: {
                        ordinal: 0,
                        conditions: {},
                        actions: {
                            0: { policyString: 'http-reply request redirect location https://example.com/\\;one' },
                            1: { policyString: 'http-reply response redirect location "tcl:https://www.example.com/\\;[HTTP::header value Host]"' },
                            2: { policyString: 'http-reply proxy-request redirect code 399 location https://example.com/\\;three' }
                        }
                    }
                },
                strategy: '/Common/best-match'
            };
            const diff = {
                command: 'ltm policy',
                kind: 'N',
                path: ['/tenant/app/policy'],
                lhsCommand: '',
                rhsCommand: 'ltm policy',
                rhs: {
                    command: 'ltm policy',
                    properties: {
                        rules: {
                            default: {
                                ordinal: 0,
                                conditions: {},
                                actions: {
                                    0: { policyString: 'http-reply request redirect location https://example.com/\\;one' },
                                    1: { policyString: 'http-reply response redirect location "tcl:https://www.example.com/;[HTTP::header value Host]"' },
                                    2: { policyString: 'http-reply proxy-request redirect code 399 location https://example.com/\\;three' }
                                }
                            }
                        },
                        strategy: '/Common/best-match'
                    }
                },
                tags: ['tmsh']
            };
            const result = mapCli.tmshCreate(context, diff, config);
            assert.strictEqual(
                result.commands[0],
                [
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{',
                    'ordinal 0 conditions none actions replace-all-with \\{',
                    '0 \\{  http-reply request redirect location \\"https://example.com/\\;one\\" \\}',
                    '1 \\{  http-reply response redirect location \\"tcl:https://www.example.com/\\;[HTTP::header value Host]\\" \\}',
                    '2 \\{  http-reply proxy-request redirect code 399 location \\"https://example.com/\\;three\\" \\}',
                    '\\} \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ http-explicit http \\}',
                    'controls replace-all-with \\{ forwarding \\}'
                ].join(' ')
            );
        });

        describe('ltm policy "requires" aspects based on condition event', () => {
            it('should handle "requires" tcp', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp client-accepted address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp client-accepted address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp \\} controls none'
                );
            });

            it('should handle "requires" http-connect', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp proxy-connect address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp proxy-connect address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp http-connect \\} controls none'
                );
            });

            it('should handle "requires" http-explicit', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp proxy-request address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp proxy-request address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp http-explicit \\} controls none'
                );
            });

            it('should handle "requires" http', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp request address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp request address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp http \\} controls none'
                );
            });

            it('should handle "requires" classification', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp classification-detected address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp classification-detected address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp classification \\} controls none'
                );
            });

            it('should handle "requires" client-ssl', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp ssl-client-serverhello-send address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp ssl-client-serverhello-send address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp client-ssl \\} controls none'
                );
            });

            it('should handle "requires" server-ssl', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp ssl-server-handshake address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp ssl-server-handshake address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp server-ssl \\} controls none'
                );
            });

            it('should handle "requires" ssl-persistence', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp ssl-cert address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp ssl-cert address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp ssl-persistence \\} controls none'
                );
            });

            it('should handle "requires" websocket', () => {
                const config = {
                    rules: {
                        default: {
                            ordinal: 0,
                            conditions: {
                                0: { policyString: 'tcp ws-request address matches values { 10.10.10.10 }' }
                            },
                            actions: {}
                        }
                    },
                    strategy: '/Common/best-match'
                };
                const diff = {
                    command: 'ltm policy',
                    kind: 'N',
                    path: ['/tenant/app/policy'],
                    lhsCommand: '',
                    rhsCommand: 'ltm policy',
                    rhs: {
                        command: 'ltm policy',
                        properties: config
                    },
                    tags: ['tmsh']
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.strictEqual(
                    result.commands[0],
                    'tmsh::create ltm policy /tenant/app/policy rules replace-all-with \\{ default \\{ ordinal 0 conditions replace-all-with \\{ 0 \\{  tcp ws-request address matches values \\{ 10.10.10.10 \\} \\} \\} actions none \\} \\} strategy /Common/best-match legacy  requires replace-all-with \\{ tcp websocket \\} controls none'
                );
            });
        });

        ['ltm', 'gtm'].forEach((module) => {
            describe(`${module} rules`, () => {
                it(`should create ${module} rules (iRules)`, () => {
                    const config = {
                        'api-anonymous': 'this is my rule'
                    };
                    const diff = {
                        path: ['/tenant/app/myRule'],
                        rhsCommand: `${module} rule`
                    };
                    const result = mapCli.tmshCreate(context, diff, config);
                    assert.strictEqual(
                        result.commands[0],
                        `tmsh::create ${module} rule /tenant/app/myRule {\nthis is my rule\n}`
                    );
                });
            });
        });

        it('sys file ssl-cert modify issuer-cert to none', () => {
            const diff = {
                kind: 'D',
                path: [
                    '/Common/issuer',
                    'properties',
                    'issuer-cert'
                ],
                rhsCommand: 'sys file ssl-cert'
            };
            const config = {};
            const result = mapCli.tmshCreate(context, diff, config);
            assert.strictEqual(
                result.commands[1],
                'tmsh::modify sys file ssl-cert /Common/issuer issuer-cert none'
            );
        });

        it('sys file ssl-cert modify validation to none', () => {
            const diff = {
                kind: 'D',
                path: [
                    '/Common/issuer',
                    'properties',
                    'cert-validators'
                ],
                rhsCommand: 'sys file ssl-cert'
            };
            const config = {};
            const result = mapCli.tmshCreate(context, diff, config);
            assert.strictEqual(
                result.commands[1],
                'tmsh::modify sys file ssl-cert /Common/issuer cert-validation-options none cert-validators none'
            );
        });

        it('should return create and modify command', () => {
            const config = {
                'cert-validation-options': ['ocsp'],
                'cert-validators': ['/Common/ocsp'],
                'issuer-cert': '/Common/issuer'
            };
            const diff = {
                path: [
                    '/Tenant/App/cert'
                ],
                rhsCommand: 'sys file ssl-cert'
            };
            const result = mapCli.tmshCreate(context, diff, config);
            assert.deepStrictEqual(
                result.commands,
                [
                    'tmsh::create sys file ssl-cert /Tenant/App/cert',
                    'tmsh::modify sys file ssl-cert /Tenant/App/cert cert-validation-options \\{ ocsp \\} cert-validators add \\{ 0 \\} issuer-cert /Common/issuer'
                ]
            );
        });

        it('should generate create command', () => {
            const config = {};
            const diff = {
                path: ['/The/Path'],
                rhsCommand: 'sys file ssl-cert'
            };
            const result = mapCli.tmshCreate(context, diff, config);
            assert.deepStrictEqual(result.commands, ['tmsh::create sys file ssl-cert /The/Path']);
        });

        describe('apm profile/policy access', () => {
            beforeEach(() => {
                context.tasks.push({ uuid: '123' });
                context.request.eventEmitter = new EventEmitter();
                context.target.tmosVersion = '14.0.0';
            });

            it('should generate bash commands for creating apm access profile', () => {
                const config = {};
                const diff = {
                    path: ['/partition/accessProfile'],
                    rhs: {
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://accessProfile.tar'
                                }
                            }
                        }
                    },
                    rhsCommand: 'apm profile access'
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.deepStrictEqual(
                    result.commands,
                    [
                        'set ::env(USER) $::env(REMOTEUSER)',
                        'exec ng_import /var/config/rest/downloads/accessProfile.tar accessProfile -p partition',
                        'exec ng_import /var/config/rest/downloads/accessProfile.tar accessProfile_123_appsvcs -p partition'
                    ]
                );
            });

            it('should generate bash commands for creating apm access profile with enable:true', () => {
                const config = {
                    enable: true
                };
                const diff = {
                    path: ['/partition/accessProfile'],
                    rhs: {
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://accessProfile.tar'
                                }
                            }
                        }
                    },
                    rhsCommand: 'apm profile access'
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.deepStrictEqual(
                    result.commands,
                    [
                        'set ::env(USER) $::env(REMOTEUSER)',
                        'exec ng_import /var/config/rest/downloads/accessProfile.tar accessProfile -p partition',
                        'exec ng_import /var/config/rest/downloads/accessProfile.tar accessProfile_123_appsvcs -p partition'
                    ]
                );
            });

            it('should generate bash commands for creating apm policy access-policy', () => {
                const config = {};
                const diff = {
                    path: ['/partition/accessPolicy'],
                    rhs: {
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://accessPolicy.tar'
                                }
                            }
                        }
                    },
                    rhsCommand: 'apm policy access-policy'
                };
                const result = mapCli.tmshCreate(context, diff, config);
                assert.deepStrictEqual(
                    result.commands,
                    [
                        'set ::env(USER) $::env(REMOTEUSER)',
                        'exec ng_import -t access_policy /var/config/rest/downloads/accessPolicy.tar accessPolicy -p partition',
                        'exec ng_import -t access_policy /var/config/rest/downloads/accessPolicy.tar accessPolicy_123_appsvcs -p partition'
                    ]
                );
            });

            it('should generate bash commands for only creating the uuid apm policy', () => {
                // In the instance that the profile already exists, only create the secondary policy
                context.tasks[0] = {
                    firstPassNoDelete: true,
                    uuid: '123',
                    metadata: {
                        Common: {
                            _apmProfilesAlreadyInTenant: [
                                'accessPolicy'
                            ]
                        }
                    }
                };
                const config = {};
                const diff = {
                    path: ['/Common/accessPolicy'],
                    rhs: {
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://accessPolicy.tar'
                                }
                            }
                        }
                    },
                    rhsCommand: 'apm policy access-policy'
                };
                const results = mapCli.tmshCreate(context, diff, config);
                assert.deepStrictEqual(
                    results.commands,
                    [
                        'set ::env(USER) $::env(REMOTEUSER)',
                        'exec ng_import -t access_policy /var/config/rest/downloads/accessPolicy.tar accessPolicy_123_appsvcs -p Common'
                    ]
                );
            });

            it('should not generate bash commands if the partition is Common and firstPassNoDelete is false', () => {
                // This test confirms that APM Profiles are only imported on the first pass through
                // /Common when firstPassNoDelete is true
                context.tasks[0] = {
                    uuid: '123',
                    metadata: {
                        Common: {
                            _apmProfilesAlreadyInTenant: [
                                'accessPolicy'
                            ]
                        }
                    }
                };
                context.control = { firstPassNoDelete: false };
                const config = {};
                const diff = {
                    path: ['/Common/accessPolicy'],
                    rhs: {
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://accessPolicy.tar'
                                }
                            }
                        }
                    },
                    rhsCommand: 'apm policy access-policy'
                };
                const results = mapCli.tmshCreate(context, diff, config);
                assert.deepStrictEqual(results.commands, []);
            });
        });

        it('should apply changes to ASM policies', () => {
            const config = {};
            const diff = {
                path: ['/partition/app/policy'],
                rhs: {
                    properties: {
                        enforcementMode: 'transparent'
                    }
                },
                rhsCommand: 'asm policy'
            };

            context.target.tmosVersion = '13.1.0';

            const result = mapCli.tmshCreate(context, diff, config, {});
            assert.deepStrictEqual(
                result.commands,
                [
                    'tmsh::load asm policy /partition/app/policy file /var/config/rest/downloads/policy.xml overwrite',
                    'tmsh::modify asm policy /partition/app/policy active',
                    'tmsh::publish asm policy /partition/app/policy'

                ]
            );
        });

        it('should properly format create command for protocol inspection profiles', () => {
            const diff = {
                kind: 'E',
                path: [
                    '/Sample_PIP_01/A1/DNSInspectionProfile',
                    'properties',
                    'services',
                    'dns',
                    'compliance',
                    'dns_disallowed_query_type',
                    'action'
                ],
                lhs: 'accept',
                rhs: 'reject',
                tags: ['tmsh'],
                command: 'security protocol-inspection profile',
                lhsCommand: 'security protocol-inspection profile',
                rhsCommand: 'security protocol-inspection profile'
            };
            const config = {
                services: {
                    dns: {
                        compliance: {
                            dns_maximum_reply_length: {
                                action: 'reject',
                                log: 'yes'
                            }
                        },
                        signature: {
                            dns_dns_query_amplification_attempt: {
                                action: 'accept',
                                log: 'no'
                            }
                        }
                    }
                }
            };

            context.target.tmosVersion = '14.1.0.3.0.0.6';

            const result = mapCli.tmshCreate(context, diff, config, {});
            assert.deepStrictEqual(
                result.commands,
                [
                    'tmsh::create security protocol-inspection profile /Sample_PIP_01/A1/DNSInspectionProfile services replace-all-with \\{ dns \\{ compliance replace-all-with \\{ dns_maximum_reply_length \\{ action reject log yes \\} \\} signature replace-all-with \\{ dns_dns_query_amplification_attempt \\{ action accept log no \\} \\} \\} \\}'
                ]
            );
        });

        it('should return a modify for the auth partition if the diff.kind is E', () => {
            const diff = {
                kind: 'E',
                path: [
                    'tenant',
                    'properties',
                    'default-route-domain'
                ],
                lhs: 0,
                rhs: 10,
                tags: [
                    'tmsh'
                ],
                command: 'auth partition',
                lhsCommand: 'auth partition',
                rhsCommand: 'auth partition'
            };
            const config = {};

            context.target.tmosVersion = '13.1.0';

            const result = mapCli.tmshCreate(context, diff, config, {});
            assert.deepStrictEqual(result.commands, ['tmsh::modify auth partition tenant']);
        });

        it('should return a modify for the ltm node if the diff.kind is E', () => {
            const diff = {
                kind: 'E',
                path: [
                    '/Common/192.0.2.0'
                ],
                tags: [
                    'tmsh'
                ],
                command: 'ltm node',
                lhsCommand: 'ltm node',
                rhsCommand: 'ltm node'
            };

            const config = {
                address: '192.0.2.0',
                metadata: {
                    references: {
                        value: 2
                    }
                }
            };

            context.target.tmosVersion = '13.0.0';

            const result = mapCli.tmshCreate(context, diff, config, {});
            const command = 'tmsh::modify ltm node /Common/192.0.2.0 metadata replace-all-with \\{ references \\{ value 2 \\} \\}';

            // Test address node
            assert.deepStrictEqual(result.commands, [command]);

            // Test FQDN node
            delete config.address;
            config.fqdn = {};
            assert.deepStrictEqual(result.commands, [command]);
        });

        it('should return a command object for handling ltm pool monitors', () => {
            const diff = {
                kind: 'N',
                path: [
                    '/tenant/application/pool',
                    'properties',
                    'monitor',
                    '/Common/http'
                ],
                rhs: {},
                tags: [
                    'tmsh'
                ],
                command: 'ltm pool',
                lhsCommand: 'ltm pool',
                rhsCommand: 'ltm pool'
            };
            const targetConfig = {
                'load-balancing-mode': 'round-robin',
                members: {},
                'min-active-members': 1,
                minimumMonitors: 1,
                monitor: {
                    '/Common/http': {},
                    '/tenant/application/customMonitor': {}
                },
                'reselect-tries': 0,
                'service-down-action': 'none',
                'slow-ramp-time': 10
            };
            const currentConfig = {
                '/tenant/application/pool': {
                    command: 'ltm pool',
                    properties: {
                        minimumMonitors: 2,
                        monitor: {
                            '/tenant/application/customMonitor': {},
                            '/Common/gateway_icmp': {}
                        }
                    },
                    ignore: []
                }
            };

            const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
            assert.deepStrictEqual(result.preTrans, ['tmsh::modify ltm pool /tenant/application/pool monitor none']);
            assert.deepStrictEqual(result.commands, ['tmsh::create ltm pool /tenant/application/pool load-balancing-mode round-robin members none min-active-members 1 monitor min 1 of \\{ /Common/http /tenant/application/customMonitor \\} reselect-tries 0 service-down-action none slow-ramp-time 10']);
            assert.deepStrictEqual(result.rollback, ['tmsh::modify ltm pool /tenant/application/pool monitor min 2 of \\{ /tenant/application/customMonitor /Common/gateway_icmp \\}']);
        });

        describe('ltm virtual-address', () => {
            it('should create a virtual-address when the kind is "N"', () => {
                const diff = {
                    kind: 'N',
                    path: ['/tenant/Service_Address-vaddr'],
                    lhsCommand: '',
                    rhs: {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '10.0.1.30'
                        },
                        ignore: []
                    },
                    rhsCommand: 'ltm virtual-address',
                    tags: ['tmsh']
                };
                const targetConfig = {};
                const currentConfig = {};

                const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                assert.deepStrictEqual(result.commands, ['tmsh::create ltm virtual-address /tenant/vaddr']);
                assert.deepStrictEqual(result.preTrans, []);
                assert.deepStrictEqual(result.postTrans, []);
                assert.deepStrictEqual(result.rollback, []);
            });
        });

        describe('sys file data-group', () => {
            it('should return a create command when the diff kind is "N"', () => {
                const diff = {
                    kind: 'N',
                    path: ['/Common/Shared/externalDataGroup'],
                    rhs: {
                        command: 'sys file data-group',
                        properties: {
                            type: 'string',
                            'data-group-name': '/Common/Shared/externalDataGroup',
                            'source-path': 'https://someExternalDataGroup1.txt',
                            seperator: ':='
                        },
                        ignore: []
                    },
                    command: 'sys file data-group',
                    rhsCommand: 'sys file data-group',
                    lhsCommand: '',
                    tags: ['tmsh']
                };
                const targetConfig = {
                    type: 'string',
                    'data-group-name': '/Common/Shared/externalDataGroup',
                    'source-path': 'https://someExternalDataGroup1.txt',
                    seperator: ':='
                };
                const currentConfig = {};
                const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                assert.deepStrictEqual(result.commands, ['tmsh::create sys file data-group /Common/Shared/externalDataGroup type string data-group-name /Common/Shared/externalDataGroup source-path https://someExternalDataGroup1.txt seperator :=']);
                assert.deepStrictEqual(result.preTrans, []);
                assert.deepStrictEqual(result.postTrans, []);
                assert.deepStrictEqual(result.rollback, []);
            });

            it('should return a modify postTrans command when diff kind is "E"', () => {
                const diff = {
                    kind: 'E',
                    path: ['/Common/Shared/externalDataGroup', 'properties', 'source-path'],
                    rhs: 'https://someExternalDataGroup2.txt',
                    lhs: 'https://someExternalDataGroup1.txt',
                    command: 'sys file data-group',
                    rhsCommand: 'sys file data-group',
                    lhsCommand: 'sys file data-group',
                    tags: ['tmsh']
                };
                const targetConfig = {};
                const currentConfig = {};
                const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                assert.deepStrictEqual(result.commands, []);
                assert.deepStrictEqual(result.preTrans, []);
                assert.deepStrictEqual(result.postTrans, ['tmsh::modify sys file data-group /Common/Shared/externalDataGroup source-path https://someExternalDataGroup2.txt']);
                assert.deepStrictEqual(result.rollback, []);
            });
        });

        describe('ltm virtual', () => {
            it('should handle enabled property', () => {
                const diff = {
                    kind: 'N',
                    path: ['/tenant/app/service'],
                    rhs: {
                        command: 'ltm virtual',
                        properties: {
                            enabled: false,
                            destination: '/tenant/1.2.3.4:80'
                        }
                    },
                    command: 'ltm virtual',
                    lhsCommand: '',
                    rhsCommand: 'ltm virtual'
                };
                const targetConfig = {
                    enabled: false,
                    destination: '/tenant/1.2.3.4:80'
                };
                const currentConfig = {};
                const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                assert.deepStrictEqual(result.commands, ['tmsh::create ltm virtual /tenant/app/service destination /tenant/1.2.3.4:80 disabled ']);
            });
        });

        describe('ltm dns cache', () => {
            ['resolver', 'validating-resolver'].forEach((type) => {
                it(`should handle forward-zones property for ${type}`, () => {
                    const diff = {
                        kind: 'N',
                        path: ['/tenant/app/service'],
                        rhs: {
                            command: `ltm dns cache ${type}`,
                            properties: {
                                'forward-zones': {
                                    singleRecord: {
                                        nameservers: {
                                            '10.0.0.1:53': {}
                                        }
                                    }
                                }
                            }
                        },
                        command: `ltm dns cache ${type}`,
                        lhsCommand: '',
                        rhsCommand: `ltm dns cache ${type}`
                    };
                    const targetConfig = {
                        'allowed-query-time': 201,
                        'local-zones': 'none',
                        'max-concurrent-queries': 2048,
                        'max-concurrent-tcp': 24,
                        'max-concurrent-udp': 8193,
                        'msg-cache-size': 0,
                        'nameserver-cache-count': 16537,
                        'prefetch-key': 'yes',
                        'forward-zones': {
                            singleRecord: {
                                nameservers: {
                                    '10.0.0.1:53': {}
                                }
                            }
                        },
                        'route-domain': '/Common/0',
                        'rrset-cache-size': 1,
                        'rrset-rotate': 'query-id',
                        'unwanted-query-reply-threshold': 1
                    };
                    const currentConfig = {};
                    const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                    assert.deepStrictEqual(result.commands, [`tmsh::create ltm dns cache ${type} /tenant/app/service allowed-query-time 201 local-zones none max-concurrent-queries 2048 max-concurrent-tcp 24 max-concurrent-udp 8193 msg-cache-size 0 nameserver-cache-count 16537 prefetch-key yes forward-zones replace-all-with \\{ singleRecord \\{ nameservers replace-all-with \\{ 10.0.0.1:53 \\} \\} \\} route-domain /Common/0 rrset-cache-size 1 rrset-rotate query-id unwanted-query-reply-threshold 1`]);
                });

                it(`should handle local-zones property for ${type}`, () => {
                    const diff = {
                        kind: 'N',
                        path: ['/tenant/app/service'],
                        rhs: {
                            command: `ltm dns cache ${type}`,
                            properties: {
                                'local-zones': '\\{ \\{ name foo.example.com type type-transparent records none \\}  \\}'
                            }
                        },
                        command: `ltm dns cache ${type}`,
                        lhsCommand: '',
                        rhsCommand: `ltm dns cache ${type}`
                    };
                    const targetConfig = {
                        'local-zones': {
                            'foo.example.com': {
                                name: 'foo.example.com',
                                type: 'type-transparent',
                                records: {}
                            }
                        }
                    };
                    const currentConfig = {};
                    const result = mapCli.tmshCreate(context, diff, targetConfig, currentConfig);
                    assert.deepStrictEqual(result.commands, [`tmsh::create ltm dns cache ${type} /tenant/app/service local-zones \\{ \\{ name foo.example.com type type-transparent records none \\}  \\}`]);
                });
            });
        });
    });

    describe('getRuleCommands', () => {
        it('should create rule delete and modify commands', () => {
            const com = 'tmsh::delete security firewall rule-list /tenantId/appId/itemId';
            const rules = {
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
            };
            const results = mapCli.getRuleCommands(com, rules, 'securityFirewall');
            assert.deepStrictEqual(
                results,
                {
                    preTrans: ['tmsh::modify security firewall rule-list /tenantId/appId/itemId rules modify \\{ theRule \\{ irule none source \\{ address-lists none port-lists none vlans none \\} destination \\{ address-lists none port-lists none \\} \\} \\}'],
                    commands: ['tmsh::delete security firewall rule-list /tenantId/appId/itemId'],
                    rollback: ['catch { tmsh::modify security firewall rule-list /tenantId/appId/itemId rules modify \\{ theRule \\{ irule irule irule-sample-rate 100 source \\{ address-lists replace-all-with \\{addList \\} port-lists replace-all-with \\{portList \\} vlans replace-all-with \\{/Common/external \\} \\} destination \\{ address-lists replace-all-with \\{addList \\} port-lists replace-all-with \\{portList \\} \\} \\} \\} } e']
                }
            );
        });

        it('should create rule delete and rollback commands', () => {
            const com = 'tmsh::delete pem policy /tenantId/appId/itemId';
            const rules = {
                theRule: {
                    'tcp-optimization-downlink': 'the_downlink',
                    'tcp-optimization-uplink': 'the_uplink'
                }
            };
            const results = mapCli.getRuleCommands(com, rules, 'pemPolicy');
            assert.deepStrictEqual(
                results,
                {
                    preTrans: ['tmsh::modify pem policy /tenantId/appId/itemId rules modify \\{ theRule \\{ tcp-optimization-downlink none tcp-optimization-uplink none \\} \\}'],
                    commands: ['tmsh::delete pem policy /tenantId/appId/itemId'],
                    rollback: ['catch { tmsh::modify pem policy /tenantId/appId/itemId rules modify \\{ theRule \\{ tcp-optimization-downlink the_downlink tcp-optimization-uplink the_uplink \\} \\} } e']
                }
            );
        });
    });

    describe('.tmshDelete()', () => {
        let context;

        beforeEach(() => {
            context = Context.build(null, null, null, [{ firstPassNoDelete: false }]);
        });

        it('should skip ltm node delete if diff.kind === "E"', () => {
            const diff = {
                kind: 'E',
                path: ['/Common/192.0.2.0'],
                lhsCommand: 'ltm node'
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(result.commands, []);
        });

        it('should delete ltm node', () => {
            const diff = {
                kind: 'D',
                path: ['/Tenant/App/192.0.2.0'],
                lhsCommand: 'ltm node'
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(result.commands, [
                'tmsh::delete ltm node /Tenant/App/192.0.2.0'
            ]);
        });

        it('should try to delete ltm node in /Common', () => {
            const diff = {
                kind: 'D',
                path: ['/Common/Shared/192.0.2.0'],
                lhsCommand: 'ltm node'
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(result.commands, []);
            assert.deepStrictEqual(result.postTrans, [
                'catch { tmsh::delete ltm node /Common/Shared/192.0.2.0 } e'
            ]);
        });

        describe('cleanup virtual addresses', () => {
            it('should try to delete ltm virtual-address when deleting ltm virtual in /Common', () => {
                const diff = {
                    kind: 'E',
                    path: ['/Tenant/Application/myVirtual'],
                    lhsCommand: 'ltm virtual',
                    lhs: '/Common/any:80'
                };
                context.host = {
                    parser: {
                        virtualAddressList: [
                            {
                                fullPath: '/Common/any',
                                metadata: [
                                    { name: 'references' }
                                ]
                            }
                        ]
                    }
                };
                const result = mapCli.tmshDelete(context, diff);
                assert.deepStrictEqual(result.commands, [
                    'tmsh::delete ltm virtual /Tenant/Application/myVirtual',
                    'catch { tmsh::delete ltm virtual-address /Common/any } e'
                ]);
            });

            it('should not try to delete ltm virtual-address that are not in /Common', () => {
                const diff = {
                    kind: 'E',
                    path: ['/Tenant/Application/myVirtual'],
                    lhsCommand: 'ltm virtual',
                    lhs: '/Common/any:80'
                };
                context.host = {
                    parser: {
                        virtualAddressList: [
                            { fullPath: '/Common/192.168.0.1' }
                        ]
                    }
                };
                const result = mapCli.tmshDelete(context, diff);
                assert.deepStrictEqual(result.commands, [
                    'tmsh::delete ltm virtual /Tenant/Application/myVirtual'
                ]);
            });
        });

        it('should generate bash commands for deleting apm profile access', () => {
            const diff = {
                path: ['/partition/accessProfile'],
                lhsCommand: 'apm profile access'
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(
                result.commands,
                [
                    'set ::env(USER) $::env(REMOTEUSER)',
                    'exec ng_profile -p partition -deleteall accessProfile'
                ]
            );
        });

        it('should generate bash commands for deleting apm policy access-policy', () => {
            const diff = {
                path: ['/partition/accessPolicy'],
                lhsCommand: 'apm policy access-policy'
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(
                result.commands,
                [
                    'set ::env(USER) $::env(REMOTEUSER)',
                    'exec ng_profile -t access_policy -p partition -deleteall accessPolicy'
                ]
            );
        });

        it('should generate bash commands for deleting gtm wideip', () => {
            const diff = {
                path: ['/Common/Shared/wip.example.com a'],
                lhsCommand: 'gtm wideip a'
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(
                result.commands,
                ['tmsh::delete gtm wideip a \\"/Common/Shared/wip.example.com\\"']
            );
        });

        it('should delete gtm region in preTransaction when it refs another gtm region', () => {
            const diff = {
                kind: 'D',
                path: ['/Common/regionGSLB'],
                lhsCommand: 'gtm region',
                lhs: {
                    properties: {
                        'region-members': {
                            'not region /Common/regionGSLBUnknown': {
                                not: 'not',
                                region: '/Common/regionGSLBUnknown'
                            }
                        }
                    }
                },
                ignore: []
            };

            const currentConfig = {
                '/Common/regionGSLB': {
                    properties: {
                        'region-members': {
                            prop1: {},
                            prop2: {}
                        }
                    }
                }
            };

            const result = mapCli.tmshDelete(context, diff, currentConfig);
            assert.deepStrictEqual(
                result.preTrans,
                ['tmsh::delete gtm region /Common/regionGSLB']
            );
            assert.deepStrictEqual(
                result.rollback,
                ['tmsh::create gtm region /Common/regionGSLB region-members replace-all-with \\{ prop1  prop2  \\}']
            );
        });

        it('should delete gtm region', () => {
            const diff = {
                kind: 'D',
                path: ['/Common/regionGSLBUnknown'],
                lhsCommand: 'gtm region',
                lhs: {
                    properties: {
                        'region-members': {
                            'continent --': {
                                not: 'none',
                                continent: '--'
                            }
                        }
                    }
                },
                ignore: []
            };

            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(
                result.commands,
                ['tmsh::delete gtm region /Common/regionGSLBUnknown']
            );
        });

        it('should return a commandObj for sys log-config publisher', () => {
            const diff = {
                kind: 'D',
                path: ['/Common/mySyslog'],
                lhsCommand: 'sys log-config publisher',
                lhs: {},
                ignore: []
            };
            const result = mapCli.tmshDelete(context, diff);
            assert.deepStrictEqual(
                result.commands,
                [
                    'tmsh::modify sys log-config publisher /Common/mySyslog destinations none'
                ]
            );
            assert.deepStrictEqual(
                result.postTrans,
                [
                    'tmsh::delete sys log-config publisher /Common/mySyslog'
                ]
            );
        });

        describe('sys file data-group', () => {
            it('should return delete commands when the diff is "D"', () => {
                const diff = {
                    kind: 'D',
                    path: ['/Common/Shared/externalDataGroup'],
                    lhsCommand: 'sys file data-group',
                    lhs: {},
                    ignore: []
                };
                const result = mapCli.tmshDelete(context, diff);
                assert.deepStrictEqual(
                    result.commands,
                    'tmsh::delete sys file data-group /Common/Shared/externalDataGroup\ntmsh::delete ltm data-group external /Common/Shared/externalDataGroup'
                );
            });

            it('should return delete commands when the diff is "N"', () => {
                const diff = {
                    kind: 'N',
                    path: ['/Common/Shared/externalDataGroup'],
                    lhsCommand: 'sys file data-group',
                    lhs: {},
                    ignore: []
                };
                const result = mapCli.tmshDelete(context, diff);
                assert.deepStrictEqual(
                    result.commands,
                    'tmsh::delete sys file data-group /Common/Shared/externalDataGroup\ntmsh::delete ltm data-group external /Common/Shared/externalDataGroup'
                );
            });

            it('should not return delete commands when the diff is "E"', () => {
                const diff = {
                    kind: 'E',
                    path: ['/Common/Shared/externalDataGroup'],
                    lhsCommand: 'sys file data-group',
                    lhs: {},
                    ignore: []
                };
                const result = mapCli.tmshDelete(context, diff);
                assert.deepStrictEqual(
                    result.commands,
                    []
                );
            });
        });
    });

    describe('.getPostProcessAPMUpdates()', () => {
        const context = {
            target: { tmosVersion: '14.0.0' }
        };

        it('should get APM profile updates', () => {
            const updateInfo = {
                apmProfileUpdates: {
                    '/my/profile/1': {
                        tenant: 'tenant1',
                        oldName: '/Common/old_profile_name_1',
                        newName: '/Common/new_profile_name_1',
                        type: 'profile'
                    },
                    '/my/profile/2': {
                        tenant: 'tenant1',
                        oldName: 'old_profile_name_2',
                        newName: 'new_profile_name_2',
                        type: 'profile'
                    }
                },
                profileReferences: {
                    '/my/profile/1': {
                        virtuals: [
                            '/my/virtual/1'
                        ],
                        iRules: {
                            '/my/irule/1': 'this refers to the /Common/old_profile_name_1 profile in two places /Common/old_profile_name_1'
                        }
                    }
                }
            };

            const apmUpdates = mapCli.getPostProcessAPMUpdates(context, updateInfo);
            const expectedUpdates = {
                preTrans: [
                    'set ::env(USER) $::env(REMOTEUSER)',
                    'exec ng_profile -p tenant1  -deleteall old_profile_name_2',
                    'exec ng_profile -p tenant1  -copy new_profile_name_2 old_profile_name_2',
                    'tmsh::modify ltm virtual /my/virtual/1 profiles delete \\{ /my/profile/1 \\} profiles add \\{ /Common/new_profile_name_1 \\}',
                    'tmsh::modify ltm rule /my/irule/1 { this refers to the /Common/new_profile_name_1 profile in two places /Common/new_profile_name_1 }',
                    'exec ng_profile -p tenant1  -deleteall /Common/old_profile_name_1',
                    'exec ng_profile -p tenant1  -copy /Common/new_profile_name_1 /Common/old_profile_name_1',
                    'tmsh::modify ltm rule /my/irule/1 { this refers to the /Common/old_profile_name_1 profile in two places /Common/old_profile_name_1 }',
                    'exec ng_profile -p tenant1  -deleteall new_profile_name_2',
                    'tmsh::modify ltm virtual /my/virtual/1 profiles delete \\{ /Common/new_profile_name_1 \\} profiles add \\{ /my/profile/1 \\}',
                    'exec ng_profile -p tenant1  -deleteall /Common/new_profile_name_1'
                ]
            };
            assert.strictEqual(apmUpdates.preTrans.length, expectedUpdates.preTrans.length);
            expectedUpdates.preTrans.forEach((command) => {
                assert.notStrictEqual(apmUpdates.preTrans.indexOf(command), -1);
            });
            assert.ok(apmUpdates.preTrans.indexOf('tmsh::modify ltm virtual /my/virtual/1 profiles delete \\{ /my/profile/1 \\} profiles add \\{ /Common/new_profile_name_1 \\}') < apmUpdates.preTrans.indexOf('exec ng_profile -p tenant1  -deleteall /Common/old_profile_name_1'));
            assert.ok(apmUpdates.preTrans.indexOf('tmsh::modify ltm virtual /my/virtual/1 profiles delete \\{ /Common/new_profile_name_1 \\} profiles add \\{ /my/profile/1 \\}') > apmUpdates.preTrans.indexOf('exec ng_profile -p tenant1  -copy new_profile_name_1 /Common/old_profile_name_1'));
        });

        it('should get APM policy updates', () => {
            const updateInfo = {
                apmProfileUpdates: {
                    '/my/profile/1': {
                        tenant: 'tenant1',
                        oldName: 'old_profile_name_1',
                        newName: 'new_profile_name_1',
                        type: 'policy'
                    }
                },
                profileReferences: {
                    '/my/profile/1': {
                        virtuals: [
                            '/my/virtual/1'
                        ],
                        iRules: {}
                    }
                }
            };

            const apmUpdates = mapCli.getPostProcessAPMUpdates(context, updateInfo);
            const expectedUpdates = {
                preTrans: [
                    'set ::env(USER) $::env(REMOTEUSER)',
                    'tmsh::modify ltm virtual /my/virtual/1 per-flow-request-access-policy /tenant1/new_profile_name_1',
                    'exec ng_profile -p tenant1 -t access_policy -deleteall old_profile_name_1',
                    'exec ng_profile -p tenant1 -t access_policy -copy new_profile_name_1 old_profile_name_1',
                    'tmsh::modify ltm virtual /my/virtual/1 per-flow-request-access-policy /my/profile/1',
                    'exec ng_profile -p tenant1 -t access_policy -deleteall new_profile_name_1'
                ]
            };
            assert.deepStrictEqual(apmUpdates, expectedUpdates);
        });

        it('should apply APM profile and policy updates in the proper order', () => {
            const updateInfo = {
                apmProfileUpdates: {
                    '/my/profile/1': {
                        tenant: 'tenant1',
                        oldName: 'old_profile_name_1',
                        newName: 'new_profile_name_1',
                        type: 'profile'
                    },
                    '/my/profile/2': {
                        tenant: 'tenant1',
                        oldName: 'old_profile_name_1',
                        newName: 'new_profile_name_1',
                        type: 'policy'
                    }
                },
                profileReferences: {
                    '/my/profile/1': {
                        virtuals: [
                            '/my/virtual/1'
                        ],
                        iRules: {}
                    },
                    '/my/profile/2': {
                        virtuals: [
                            '/my/virtual/1'
                        ],
                        iRules: {}
                    }
                }
            };

            const apmUpdates = mapCli.getPostProcessAPMUpdates(context, updateInfo);
            const expectedUpdates = {
                preTrans: [
                    'set ::env(USER) $::env(REMOTEUSER)',
                    'tmsh::modify ltm virtual /my/virtual/1 per-flow-request-access-policy /tenant1/new_profile_name_1',
                    'exec ng_profile -p tenant1 -t access_policy -deleteall old_profile_name_1',
                    'exec ng_profile -p tenant1 -t access_policy -copy new_profile_name_1 old_profile_name_1',
                    'tmsh::modify ltm virtual /my/virtual/1 profiles delete \\{ /my/profile/1 \\} profiles add \\{ /tenant1/new_profile_name_1 \\}',
                    'exec ng_profile -p tenant1  -deleteall old_profile_name_1',
                    'exec ng_profile -p tenant1  -copy new_profile_name_1 old_profile_name_1',
                    'tmsh::modify ltm virtual /my/virtual/1 profiles delete \\{ /tenant1/new_profile_name_1 \\} profiles add \\{ /my/profile/1 \\}',
                    'exec ng_profile -p tenant1  -deleteall new_profile_name_1',
                    'tmsh::modify ltm virtual /my/virtual/1 per-flow-request-access-policy /my/profile/2',
                    'exec ng_profile -p tenant1 -t access_policy -deleteall new_profile_name_1'
                ]
            };

            assert.deepStrictEqual(apmUpdates, expectedUpdates);
        });
    });
});

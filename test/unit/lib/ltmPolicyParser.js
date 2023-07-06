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

const PolicyParser = require('../../../src/lib/ltmPolicyParser');
const simpleCopy = require('../../../src/lib/util/util').simpleCopy;

describe('LTM Policy Parsing', () => {
    describe('ParserSourceGenerator', () => {
        let parserSource = null;
        it('should parse the source file', () => {
            parserSource = PolicyParser.getSource();
            assert(parserSource);
        });

        it('should generate action parser', () => {
            assert(parserSource.action);
        });

        it('should generate condition parser', () => {
            assert(parserSource.condition);
        });

        it('should generate top level branches', () => {
            const actionBranches = Object.keys(parserSource.action.branches);
            const conditionBranches = Object.keys(parserSource.condition.branches);
            assert.equal(actionBranches.length, 30, '30 action branches exist');
            assert.equal(conditionBranches.length, 19, '19 condition branches exist');
            assert(parserSource.action.branches['http-cookie'], 'http-cookie is in top level branches');
        });

        it('should respect required fields', () => {
            const condition = parserSource.condition.branches['http-cookie'];
            const allToken = condition.tokens.find((t) => t.options[0] === 'all');
            assert.equal(allToken.required, true, 'http-cookie condition requires all token');

            const action = parserSource.action.branches.persist;
            const disableToken = action.branches.disable.tokens.find((t) => t.options[0] === 'disable');
            assert.equal(disableToken.required, true, 'persist action requires disable token');
        });

        it('should handle optional fields', () => {
            const condition = parserSource.condition.branches['http-uri'];
            const normToken = condition.branches.path.tokens.find((t) => t.options[0] === 'normalized');
            assert.equal(normToken.required, false, 'normalized is optional');
        });

        it('should not mark default fields as required', () => {
            const action = parserSource.action.branches['ltm-policy'];
            const clientHelloToken = action.tokens.find((t) => t.options[0] === 'ssl-client-hello');
            assert.equal(clientHelloToken.default, 'ssl-client-hello');
            assert.equal(clientHelloToken.required, false);
        });

        it('should handle NUMBER fields', () => {
            const condition = parserSource.condition.branches['ssl-cert'];
            const indexToken = condition.tokens.find((t) => t.options[0] === 'index');
            assert.equal(indexToken.dataType, 'NUMBER');
        });

        it('should specify default branches', () => {
            const action = parserSource.action.branches['http-header'];
            assert(action.branches.replace, 'replace is a branch of http-header');
            assert.equal(action.defaultBranch, 'replace', 'replace is the default branch of http-header');
        });
    });

    describe('String Normalization', () => {
        function assertFilled(input, expectedOutput, spec) {
            const output = PolicyParser.normalizeString(input, spec);
            assert.equal(output, expectedOutput);
        }

        const fullCondition = 'http-method request all equals values { POST } case-insensitive';
        function assertConditionFilled(input, expectedOutput) {
            assertFilled(input, expectedOutput || fullCondition, 'condition');
        }
        const fullAction = 'wam request enable';
        function assertActionFilled(input, expectedOutput) {
            assertFilled(input, expectedOutput || fullAction, 'action');
        }

        it('should do nothing if all values are specified', () => {
            let output = '';
            assert.doesNotThrow(() => {
                output = PolicyParser.normalizeString(fullCondition, 'condition');
            });
            assert.equal(fullCondition, output);
        });

        it('should error on invalid input', () => {
            assert.throws(() => PolicyParser.normalizeString('unknown-command foo bar', 'condition'));
        });

        it('should error on missing required field', () => {
            assert.throws(() => PolicyParser.normalizeString('http-method values { POST }', 'condition'));
        });

        it('should fill missing defaults', () => {
            assertConditionFilled('http-method all values { POST }');
        });

        it('should respect non-default values', () => {
            assertConditionFilled(
                'http-method all contains values { POST } case-sensitive',
                'http-method request all contains values { POST } case-sensitive'
            );
        });

        it('should handle optional branches', () => {
            assertConditionFilled(
                'http-status code values { 200 }',
                'http-status response code equals values { 200 }'
            );
        });

        it('should handle default branches', () => {
            assertActionFilled('wam');
            assertActionFilled(
                'persist  timeout 0',
                'persist client-accepted source-address timeout 0'
            );
        });

        it('should handle white space variations', () => {
            assertConditionFilled('http-method  all values    {POST}');
        });

        it('should handle IP array fields', () => {
            assertConditionFilled(
                'tcp  address matches values { foo } internal   ',
                'tcp ssl-client-hello address matches values { foo } internal'
            );
        });

        it('should treat a quoted string as one value', () => {
            assertConditionFilled(
                'http-header all values { "two words" } name "name with spaces"',
                'http-header request all equals values { "two words" } case-insensitive name "name with spaces"'
            );
        });

        it('should handle multiple array values', () => {
            assertConditionFilled(
                'http-method all values {POST GET }',
                'http-method request all equals values { POST GET } case-insensitive'
            );
        });

        it('should handle out of order keywords', () => {
            assertConditionFilled('request http-method case-insensitive all values { POST }');
            assertConditionFilled(
                'case-insensitive  cpu-usage  equals  external  index 0 last-1min  present  remote  request  values {8}',
                'cpu-usage request last-1min equals values { 8 }'
            );
        });

        it('should filter out bad keywords', () => {
            assertActionFilled(
                'kind tm:ltm:policy:rules:actions:actionsstate name 0 full-path 0'
                + 'generation 5853 self-link https://localhost/mgmt/tm/ltm/policy/~TEST_Service_'
                + 'TCP~TEST_Service_Tcp_policyEndpoint~basicEndpointPolicy/rules/testRule/actions'
                + '/0?ver=13.0.0 code 0 disable  expiry-secs 0 length 0 ltm-policy  offset 0'
                + 'port 0 response  status 0 timeout 0 vlan-id 0',

                'ltm-policy response disable'
            );
        });

        it('should respect tcl strings', () => {
            assertActionFilled(
                'http-reply location "tcl:https://[getfield [HTTP::host] \\":\\" 1][HTTP::uri]"',
                'http-reply request redirect location "tcl:https://[getfield [HTTP::host] \\":\\" 1][HTTP::uri]"'
            );
            assertActionFilled(
                'http-reply location \\"tcl:https://[getfield [HTTP::host] \\\\":\\\\" 1][HTTP::uri]\\"',
                'http-reply request redirect location \\"tcl:https://[getfield [HTTP::host] \\\\":\\\\" 1][HTTP::uri]\\"'
            );
        });
    });

    describe('Object Normalization', () => {
        const baseAction = {
            type: 'forward',
            event: 'ssl-client-hello',
            select: {
                pool: 'mySpecialPool'
            }
        };

        function assertAction(obj, expect) {
            assert.equal(PolicyParser.convertAs3ObjectToString(obj, 'action'), expect);
        }

        function assertCondition(obj, expect) {
            assert.equal(PolicyParser.convertAs3ObjectToString(obj, 'condition'), expect);
        }

        const baseCondition = {
            type: 'httpUri',
            event: 'request',
            path: {
                operand: 'contains',
                values: ['google.com'],
                caseSensitive: true
            },
            normalized: true
        };

        it('should handle string input', () => {
            assertAction('server-ssl', 'server-ssl request enable');
        });

        it('should convert AS3 action objects', () => {
            assertAction(
                baseAction,
                'forward ssl-client-hello select pool mySpecialPool'
            );
        });

        it('should convert AS3 condition objects', () => {
            assertCondition(
                baseCondition,
                'http-uri request path contains values { google.com } case-sensitive normalized'
            );
        });

        it('should handle caseSensitive === false', () => {
            const input = simpleCopy(baseCondition);
            input.path.caseSensitive = false;
            assertCondition(
                input,
                'http-uri request path contains values { google.com } case-insensitive normalized'
            );
        });

        it('should skip false boolean properties', () => {
            const input = simpleCopy(baseCondition);
            input.normalized = false;
            assertCondition(
                input,
                'http-uri request path contains values { google.com } case-sensitive'
            );
        });

        it('should escape quotes', () => {
            const action = {
                type: 'http-reply',
                // eslint-disable-next-line no-useless-escape
                location: 'tcl:https://[getfield [HTTP::host] ":" 1][HTTP::uri]'
            };
            assertAction(
                action,
                // eslint-disable-next-line no-useless-escape
                'http-reply request redirect location "tcl:https://\\[getfield \\[HTTP::host\\] \\":\\" 1\\]\\[HTTP::uri\\]"'
            );
        });

        it('should handle redirect status code', () => {
            const action = {
                type: 'http-reply',
                code: 300,
                location: 'http://localhost'
            };
            assertAction(action, 'http-reply request redirect code 300 location http://localhost');
        });

        it('should handle default "matches" operand', () => {
            const condition = {
                type: 'tcp',
                event: 'request',
                address: {
                    values: ['192.0.2.4']
                }
            };
            assertCondition(condition, 'tcp request address matches values { 192.0.2.4 }');
        });

        it('should handle "matches" operand', () => {
            const condition = {
                type: 'tcp',
                event: 'request',
                address: {
                    values: ['192.0.2.4'],
                    operand: 'matches'
                }
            };
            assertCondition(condition, 'tcp request address matches values { 192.0.2.4 }');
        });

        it('should quote tcl strings', () => {
            const action = {
                type: 'httpHeader',
                insert: {
                    name: 'Forwarded',
                    value: 'tcl:for=[IP::remote_addr];host=[HTTP::host];proto=https'
                },
                event: 'request'
            };
            assertAction(action, 'http-header request insert name Forwarded value "tcl:for=\\[IP::remote_addr\\]\\;host=\\[HTTP::host\\]\\;proto=https"');
        });

        it('should handle "matches" operand with datagroup ref', () => {
            const condition = {
                type: 'tcp',
                event: 'request',
                address: {
                    datagroup: '/Common/private_net'
                }
            };
            assertCondition(condition, 'tcp request address matches datagroup /Common/private_net');
        });

        it('should handle "exists" operand', () => {
            const condition = {
                type: 'httpCookie',
                event: 'request',
                all: {
                    operand: 'exists'
                },
                name: 'test'
            };
            assertCondition(condition, 'http-cookie request all exists case-insensitive name test');
        });

        describe('negative-string operands', () => {
            it('should handle "does-not-contain" operand', () => {
                const input = simpleCopy(baseCondition);
                input.path.operand = 'does-not-contain';
                assertCondition(
                    input,
                    'http-uri request path not contains values { google.com } case-sensitive normalized'
                );
            });

            it('should handle "does-not-end-with" operand', () => {
                const input = simpleCopy(baseCondition);
                input.path.operand = 'does-not-end-with';
                assertCondition(
                    input,
                    'http-uri request path not ends-with values { google.com } case-sensitive normalized'
                );
            });

            it('should handle "does-not-equal" operand', () => {
                const input = simpleCopy(baseCondition);
                input.path.operand = 'does-not-equal';
                assertCondition(
                    input,
                    'http-uri request path not equals values { google.com } case-sensitive normalized'
                );
            });

            it('should handle "does-not-start-with" operand', () => {
                const input = simpleCopy(baseCondition);
                input.path.operand = 'does-not-start-with';
                assertCondition(
                    input,
                    'http-uri request path not starts-with values { google.com } case-sensitive normalized'
                );
            });

            it('should handle "does-not-match" operand', () => {
                const condition = {
                    type: 'tcp',
                    event: 'request',
                    address: {
                        values: ['192.0.2.4'],
                        operand: 'does-not-match'
                    }
                };
                assertCondition(condition, 'tcp request address not matches values { 192.0.2.4 }');
            });

            it('should handle "does-not-exist" operand', () => {
                const condition = {
                    type: 'httpUri',
                    event: 'request',
                    path: { operand: 'does-not-exist' }
                };
                assertCondition(condition, 'http-uri request path not exists case-insensitive');
            });
        });

        describe('convertObjectToString', () => {
            it('should convert object to string', () => {
                const result = PolicyParser.convertObjectToString(
                    {
                        kind: 'tm:ltm:policy:rules:actions:actionsstate',
                        location: 'http://localhost',
                        httpReply: true
                    }
                );
                assert.strictEqual(result, 'http-reply request redirect location http://localhost');
            });

            it('should convert object to string and quote tcl strings', () => {
                const result = PolicyParser.convertObjectToString(
                    {
                        kind: 'tm:ltm:policy:rules:actions:actionsstate',
                        tmName: 'Forwarded',
                        value: 'tcl:for=[IP::remote_addr]',
                        httpHeader: true
                    }
                );
                assert.strictEqual(result, 'http-header request replace name Forwarded value "tcl:for=\\[IP::remote_addr\\]"');
            });

            it('should convert object to string and correctly handle arrays', () => {
                const result = PolicyParser.convertObjectToString(
                    {
                        kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                        httpUri: true,
                        request: true,
                        contains: true,
                        path: true,
                        caseSensitive: true,
                        values: ['example.com']
                    }
                );
                assert.strictEqual(result, 'http-uri request path contains values { example.com } case-sensitive');
            });

            it('should convert object to string and correctly handle datagroups', () => {
                const result = PolicyParser.convertObjectToString(
                    {
                        kind: 'tm:ltm:policy:rules:conditions:conditionsstate',
                        httpUri: true,
                        request: true,
                        contains: true,
                        path: true,
                        caseSensitive: true,
                        datagroup: '/Common/myDatagroup'
                    }
                );
                assert.strictEqual(result, 'http-uri request path contains datagroup /Common/myDatagroup case-sensitive');
            });
        });
    });
});

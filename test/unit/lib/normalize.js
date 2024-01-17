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
const properties = require('../../../src/lib/properties.json');
const normalize = require('../../../src/lib/normalize');
const util = require('../../../src/lib/util/util');
const Context = require('../../../src/lib/context/context');

describe('normalize', () => {
    let defaultContext;
    beforeEach(() => {
        defaultContext = Context.build();
        defaultContext.target.tmosVersion = '0.0.0';
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('actionableMcp', () => {
        const mcpCommand = 'auth partition'; // must be an existing property
        let original;

        beforeEach(() => {
            original = {
                myProperty: 'foo',
                anotherProperty: 'bar \\r\\n\\r\\n'
            };
            sinon.stub(properties, mcpCommand).get(() => [
                { id: 'myProperty', requiredModules: { anyOf: ['someModule'] } },
                { id: 'anotherProperty', quotedString: true }
            ]);
        });

        it('should remove properties if requiredModule is not provisioned', () => {
            sinon.stub(util, 'isOneOfProvisioned').returns(false);
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.myProperty, undefined);
        });

        it('should not remove properties if requiredModule is provisioned', () => {
            sinon.stub(util, 'isOneOfProvisioned').returns(true);
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.myProperty, 'foo');
        });

        it('should handle escaping quotedString properties', () => {
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"bar \\\\r\\\\n\\\\r\\\\n"');
        });

        it('should handle escaped quotation mark', () => {
            original.anotherProperty = 'Test\\":1';
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"Test\\\\":1"');
        });

        it('should handle an unescaped quotation mark', () => {
            original.anotherProperty = 'Test":1';
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"Test\\":1"');
        });

        it('should handle square brackets', () => {
            original.anotherProperty = '[start me up]';
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"\\[start me up\\]"');
        });

        it('should handle quoted square brackets', () => {
            original.anotherProperty = '"[start me up]"';
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"[start me up]"');
        });

        it('should handle curly brackets', () => {
            original.anotherProperty = '{start me up}';
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"\\{start me up\\}"');
        });

        it('should handle quoted curly brackets', () => {
            original.anotherProperty = '"{start me up}"';
            normalize.actionableMcp(defaultContext, original, mcpCommand);
            assert.strictEqual(original.anotherProperty, '"{start me up}"');
        });
    });

    describe('quoteString', () => {
        it('should quote values', () => {
            const original = '\r\n\t\f\b\\?\x00\x15\x1f\x7f;$[]{}';
            const expected = '"\\\\r\\\\n\\\\t\\\\f\\\\b\\\\\\?....\\;\\$\\[\\]\\{\\}"';
            assert.strictEqual(normalize.quoteString(original), expected);
        });
    });
});

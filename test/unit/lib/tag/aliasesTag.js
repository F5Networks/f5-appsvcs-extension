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

const assert = require('assert');

const AliasesTag = require('../../../../src/lib/tag').AliasesTag;

describe('aliasesTag', () => {
    let context;
    let declaration;

    const getAliasData = () => [{
        tenant: 'tenant',
        data: declaration.tenant.application.item,
        parentData: declaration.tenant.application,
        parentDataProperty: 'item',
        instancePath: '/tenant/application/item',
        schemaData: {
            aliasOne: 'originalOne',
            aliasTwo: 'originalTwo'
        }
    }];

    beforeEach(() => {
        context = {};
        declaration = {
            class: 'ADC',
            tenant: {
                application: {
                    item: {
                        originalOne: { subData: 'test' },
                        originalTwo: true
                    }
                }
            }
        };
    });

    it('should resolve if aliases is undefined', () => AliasesTag.process(context, declaration));

    it('should resolve if no aliases data to process', () => AliasesTag.process(context, declaration, []));

    it('should replace original properties with alias name', () => {
        const expected = {
            aliasOne: { subData: 'test' },
            aliasTwo: true
        };
        return AliasesTag.process(context, declaration, getAliasData())
            .then(() => {
                assert.deepStrictEqual(declaration.tenant.application.item, expected);
            });
    });

    it('should prioritize alias properties and remove originals', () => {
        declaration.tenant.application.item.aliasOne = { newSubData: 'newValue' };
        declaration.tenant.application.item.aliasTwo = false;
        const expected = {
            aliasOne: { newSubData: 'newValue' },
            aliasTwo: false
        };
        return AliasesTag.process(context, declaration, getAliasData())
            .then(() => {
                assert.deepStrictEqual(declaration.tenant.application.item, expected);
            });
    });

    it('should do nothing if only alias properties are provided', () => {
        declaration.tenant.application.item = {
            aliasOne: { newSubData: 'newValue' },
            aliasTwo: false
        };
        const expected = {
            aliasOne: { newSubData: 'newValue' },
            aliasTwo: false
        };
        return AliasesTag.process(context, declaration, getAliasData())
            .then(() => {
                assert.deepStrictEqual(declaration.tenant.application.item, expected);
            });
    });

    it('should do nothing if neither alias or original properties are provided', () => {
        declaration.tenant.application.item = {
            foo: 'bar'
        };
        const expected = {
            foo: 'bar'
        };
        return AliasesTag.process(context, declaration, getAliasData())
            .then(() => {
                assert.deepStrictEqual(declaration.tenant.application.item, expected);
            });
    });
});

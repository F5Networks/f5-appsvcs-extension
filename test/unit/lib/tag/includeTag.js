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

const sinon = require('sinon');
const assert = require('assert');
const IncludeTag = require('../../../../src/lib/tag').IncludeTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const fetchUtil = require('../../../../src/lib/util/fetchUtil');

describe('includeTag', () => {
    let fetchValueSpy;
    let context;
    let declaration;

    beforeEach(() => {
        fetchValueSpy = sinon.spy(fetchUtil, 'fetchValue');
        context = Context.build();
        context.host.parser = { options: {} };
        context.tasks.push({ action: 'deploy', urlPrefix: 'https://localhost:8100' });
        declaration = {
            tenant: {
                application: {
                    item: {
                        include: [
                            '/@/@/constants/template1',
                            '/@/@/constants/template2'
                        ]
                    },
                    constants: {
                        template1: {
                            prop1: 'foo',
                            prop2: 'bar'
                        },
                        template2: {
                            hello: 'world'
                        }
                    }
                }
            }
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    const getIncludeList = () => [{
        tenant: 'tenant',
        data: declaration.tenant.application.item.include,
        parentData: declaration.tenant.application.item,
        parentDataProperty: 'include',
        instancePath: '/tenant/application/item/include',
        schemaData: 'object'
    }];

    describe('.process', () => {
        it('should resolve if includeList is undefined', () => IncludeTag.process(context, declaration));

        it('should resolve if no include data to process', () => IncludeTag.process(context, declaration, []));

        it('should skip including data if host device is BIG-IQ', () => {
            context.host.deviceType = DEVICE_TYPES.BIG_IQ;
            return IncludeTag.process(context, declaration, getIncludeList())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        Object.keys(declaration.tenant.application.item),
                        ['include'],
                        'data should not be included'
                    );
                });
        });

        it('should skip including data if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return IncludeTag.process(context, declaration, getIncludeList())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        Object.keys(declaration.tenant.application.item),
                        ['include'],
                        'data should not be included'
                    );
                });
        });

        it('should include data provided from array', () => IncludeTag.process(context, declaration, getIncludeList())
            .then(() => {
                assert.deepStrictEqual(
                    Object.keys(declaration.tenant.application.item),
                    ['include', 'prop1', 'prop2', 'hello'],
                    'data should be included'
                );
                assert.strictEqual(declaration.tenant.application.item.prop1, 'foo');
                assert.strictEqual(declaration.tenant.application.item.prop2, 'bar');
                assert.strictEqual(declaration.tenant.application.item.hello, 'world');
            }));

        it('should include data provided from string', () => {
            declaration.tenant.application.item.include = declaration.tenant.application.item.include[0];
            const includeList = getIncludeList();
            return IncludeTag.process(context, declaration, includeList)
                .then(() => {
                    assert.deepStrictEqual(
                        Object.keys(declaration.tenant.application.item),
                        ['include', 'prop1', 'prop2'],
                        'data should be included'
                    );
                    assert.strictEqual(declaration.tenant.application.item.prop1, 'foo');
                    assert.strictEqual(declaration.tenant.application.item.prop2, 'bar');
                });
        });
    });
});

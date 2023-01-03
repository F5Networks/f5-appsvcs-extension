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

const AJV = require('ajv');
const sinon = require('sinon');
const assert = require('assert');
const ExpandTag = require('../../../../src/lib/tag').ExpandTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const expandUtil = require('../../../../src/lib/util/expandUtil');

describe('expandTag', () => {
    let expandSpy;
    let context;
    let declaration;

    beforeEach(() => {
        expandSpy = sinon.spy(expandUtil, 'backquoteExpand');
        context = Context.build();
        declaration = {
            class: 'ADC',
            tenant: {
                application: {
                    item1: {
                        property: 'property'
                    },
                    item2: {
                        class: 'classToExpand',
                        expand: true,
                        property: '`*item1`'
                    }
                }
            }
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    const getExpandList = () => [{
        tenant: 'tenant',
        data: declaration.tenant.application.item2.property,
        parentData: declaration.tenant.application.item2,
        parentDataProperty: 'property',
        instancePath: '/tenant/application/item2/property'
    }];

    describe('.process', () => {
        it('should resolve if expandList is undefined', () => ExpandTag.process(context, declaration));

        it('should resolve if no expand data to process', () => ExpandTag.process(context, declaration, []));

        it('should skip expanding data if target device is BIG-IQ', () => {
            context.target.deviceType = DEVICE_TYPES.BIG_IQ;
            return ExpandTag.process(context, declaration, getExpandList())
                .then(() => {
                    assert.strictEqual(expandSpy.called, false, 'backquoteExpand should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.property,
                        '`*item1`',
                        'data should not be expanded'
                    );
                });
        });

        it('should skip expanding data if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return ExpandTag.process(context, declaration, getExpandList())
                .then(() => {
                    assert.strictEqual(expandSpy.called, false, 'backquoteExpand should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.property,
                        '`*item1`',
                        'data should not be expanded'
                    );
                });
        });

        it('should skip expanding data if data is not a string', () => {
            declaration.tenant.application.item2.property = 1;
            return ExpandTag.process(context, declaration, getExpandList())
                .then(() => {
                    assert.strictEqual(expandSpy.called, false, 'backquoteExpand should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.property,
                        1,
                        'data should not be expanded'
                    );
                });
        });

        it('should skip expanding data if pointing to falsy value', () => {
            declaration.tenant.application.shouldExpand = false;
            const expandList = getExpandList();
            expandList[0].schemaData = {
                when: '/tenant/application/shouldExpand'
            };

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    assert.strictEqual(expandSpy.called, false, 'backquoteExpand should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.property,
                        '`*item1`',
                        'data should not be expanded'
                    );
                });
        });

        it('should expand data', () => ExpandTag.process(context, declaration, getExpandList())
            .then(() => {
                assert.strictEqual(expandSpy.called, true, 'backquoteExpand should be called');
                assert.deepStrictEqual(
                    declaration.tenant.application.item2.property,
                    '/tenant/application/item1',
                    'data should be expanded'
                );
            }));

        it('should expand data if pointing to truthy value', () => {
            declaration.tenant.application.shouldExpand = true;
            const expandList = getExpandList();
            expandList[0].schemaData = {
                when: '/tenant/application/shouldExpand'
            };

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    assert.strictEqual(expandSpy.called, true, 'backquoteExpand should be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.property,
                        '/tenant/application/item1',
                        'data should be expanded'
                    );
                });
        });

        it('should expand data to schema location', () => {
            declaration.tenant.application.shouldExpand = true;
            const expandList = getExpandList();
            expandList[0].schemaData = {
                when: '/tenant/application/shouldExpand',
                to: 'anotherProperty'
            };

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    assert.strictEqual(expandSpy.called, true, 'backquoteExpand should be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.property,
                        '`*item1`',
                        'data should not be expanded'
                    );
                    assert.deepStrictEqual(
                        declaration.tenant.application.item2.anotherProperty,
                        '/tenant/application/item1',
                        'data should be expanded'
                    );
                });
        });

        it('should reject if schema data contains bad path', () => {
            const expandList = getExpandList();
            let rejected = true;
            expandList[0].schemaData = {
                when: '/Does/Not/Exist'
            };

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/item2/property',
                        keyword: 'f5PostProcess(expand)',
                        params: {},
                        message: '/Does/Not/Exist contains path to non-existent object Does'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if expanding errors', () => {
            let rejected = true;
            declaration.tenant.application.item2.property = '`*missingBackquote';

            return ExpandTag.process(context, declaration, getExpandList())
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/item2/property',
                        keyword: 'f5PostProcess(expand)',
                        params: {},
                        message: '/tenant/application/item2/property `*` at 0 missing second backquote'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if schema data is incorrect type', () => {
            const expandList = getExpandList();
            let rejected = true;
            expandList[0].schemaData = true;

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(
                        err.message,
                        'f5PostProcess(expand) schema must be undefined or an object'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if schema data contains additional properties', () => {
            const expandList = getExpandList();
            let rejected = true;
            expandList[0].schemaData = {
                when: '/foo',
                to: '/bar',
                extraProperty: 'oops'
            };

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(
                        err.message,
                        'f5PostProcess(expand) schema property "extraProperty" not allowed'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if schema data contains property with non-string value', () => {
            const expandList = getExpandList();
            let rejected = true;
            expandList[0].schemaData = {
                when: '/foo',
                to: 1
            };

            return ExpandTag.process(context, declaration, expandList)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.strictEqual(
                        err.message,
                        'f5PostProcess(expand) schema property "to" must have string value'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });
});

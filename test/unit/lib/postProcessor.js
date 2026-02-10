/**
 * Copyright 2026 F5, Inc.
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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const PostProcessor = require('../../../src/lib/postProcessor');
const Context = require('../../../src/lib/context/context');
const AdcParser = require('../../../src/lib/adcParser');
const Tag = require('../../../src/lib/tag');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('postProcessor', () => {
    let defaultContext;
    let postProcess;

    beforeEach(() => {
        defaultContext = Context.build();
        defaultContext.target.tmosVersion = '0.0.0';
        defaultContext.host.parser = new AdcParser();
        postProcess = [];
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('.process', () => {
        let declaration;
        let expectedData;

        beforeEach(() => {
            declaration = {
                foo: { bar: 'hello world' }
            };
            expectedData = [{
                tenant: 'foo',
                data: 'hello world',
                instancePath: '/foo/bar',
                parentData: { bar: 'hello world' },
                parentDataProperty: 'bar',
                schemaData: undefined
            }];
        });

        it('should reject if context is undefined', () => assert.isRejected(
            PostProcessor.process(undefined),
            'Context is required.'
        ));

        it('should reject if declaration is undefined', () => assert.isRejected(
            PostProcessor.process(defaultContext, undefined),
            'Declaration is required.'
        ));

        it('should resolve if postProcess object is undefined',
            () => PostProcessor.process(defaultContext, {}));

        Object.keys(Tag).forEach((tagKey) => {
            const processor = Tag[tagKey];
            it(`should gather data and process ${processor.TAG}`, () => {
                const spy = sinon.stub(processor, 'process').resolves();
                postProcess.push({
                    tag: processor.TAG,
                    instancePath: '/foo/bar',
                    parentDataProperty: 'bar'
                });
                return PostProcessor.process(defaultContext, declaration, null, postProcess)
                    .then(() => {
                        assert.deepStrictEqual(
                            spy.args[0][2],
                            expectedData,
                            `gathered data should have been passed to ${processor.TAG} processor`
                        );
                    });
            });
        });

        it('should return warnings if bad tag is supplied', () => {
            const badPostProcess = [{
                tag: 'unknownTag',
                instancePath: 'bad/path',
                parentDataProperty: 'badData'
            }];

            return assert.becomes(
                PostProcessor.process(defaultContext, declaration, null, badPostProcess),
                { warnings: ['Schema tag unknownTag is an unknown tag and was not processed'] }
            );
        });

        it('should let errors bubble up if a .process errors', () => {
            sinon.stub(Tag.CheckResourceTag, 'process').rejects(new Error('This should bubble up'));

            return assert.isRejected(
                PostProcessor.process(
                    defaultContext,
                    declaration,
                    null,
                    [{ tag: 'checkResource', instancePath: '/foo/bar/', parentDataProperty: 'bar' }]
                ),
                /This should bubble up/
            );
        });

        it('should handle options.includeList', () => {
            const crStub = sinon.stub(Tag.CheckResourceTag, 'process').resolves();
            const pStub = sinon.stub(Tag.PointerTag, 'process').resolves();
            sinon.stub(Tag.VirtualAddressTag, 'process').rejects(new Error('This should NOT have been called'));

            const tempPostProcess = [
                { tag: 'checkResource', instancePath: '/foo/bar/', parentDataProperty: 'bar' },
                { tag: 'pointer', instancePath: '/foo/bar/', parentDataProperty: 'bar' },
                { tag: 'virtualAddress', instancePath: '/foo/bar/', parentDataProperty: 'bar' }
            ];
            const options = {
                includeList: ['checkResource', 'pointer']
            };

            return assert.isFulfilled(
                PostProcessor.process(defaultContext, declaration, null, tempPostProcess, options)
            )
                .then(() => {
                    assert.strictEqual(crStub.callCount, 1, 'Should have called CheckResourceTag.process');
                    assert.strictEqual(pStub.callCount, 1, 'Should have called PointerTag.process');
                });
        });

        it('should handle options.excludeList', () => {
            const crStub = sinon.stub(Tag.CheckResourceTag, 'process').resolves();
            const pStub = sinon.stub(Tag.PointerTag, 'process').resolves();
            sinon.stub(Tag.VirtualAddressTag, 'process').rejects(new Error('This should NOT have been called'));

            const tempPostProcess = [
                { tag: 'checkResource', instancePath: '/foo/bar/', parentDataProperty: 'bar' },
                { tag: 'pointer', instancePath: '/foo/bar/', parentDataProperty: 'bar' },
                { tag: 'virtualAddress', instancePath: '/foo/bar/', parentDataProperty: 'bar' }
            ];
            const options = {
                excludeList: ['virtualAddress']
            };

            return assert.isFulfilled(
                PostProcessor.process(defaultContext, declaration, null, tempPostProcess, options)
            )
                .then(() => {
                    assert.strictEqual(crStub.callCount, 1, 'Should have called CheckResourceTag.process');
                    assert.strictEqual(pStub.callCount, 1, 'Should have called PointerTag.process');
                });
        });

        it('should handle both options.includeList and options.excludeList', () => {
            const crStub = sinon.stub(Tag.CheckResourceTag, 'process').resolves();
            const pStub = sinon.stub(Tag.PointerTag, 'process').resolves();
            sinon.stub(Tag.VirtualAddressTag, 'process').rejects(new Error('This should NOT have been called'));

            const tempPostProcess = [
                { tag: 'checkResource', instancePath: '/foo/bar/', parentDataProperty: 'bar' },
                { tag: 'pointer', instancePath: '/foo/bar/', parentDataProperty: 'bar' },
                { tag: 'virtualAddress', instancePath: '/foo/bar/', parentDataProperty: 'bar' }
            ];
            const options = {
                includeList: ['checkResource', 'pointer'],
                excludeList: ['virtualAddress']
            };

            return assert.isFulfilled(
                PostProcessor.process(defaultContext, declaration, null, tempPostProcess, options)
            )
                .then(() => {
                    assert.strictEqual(crStub.callCount, 1, 'Should have called CheckResourceTag.process');
                    assert.strictEqual(pStub.callCount, 1, 'Should have called PointerTag.process');
                });
        });
    });
});

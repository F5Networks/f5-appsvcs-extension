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

const nock = require('nock');
const sinon = require('sinon');
const assert = require('assert');
const FetchTag = require('../../../../src/lib/tag').FetchTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const fetchUtil = require('../../../../src/lib/util/fetchUtil');

describe('fetchTag', () => {
    let fetchValueSpy;
    let context;
    let declaration;

    beforeEach(() => {
        fetchValueSpy = sinon.spy(fetchUtil, 'fetchValue');
        context = Context.build();
        context.host.parser = { options: {} };
        declaration = {
            tenant: {
                application: {
                    item: {
                        property: {
                            url: 'https://example.com/data.xml'
                        }
                    }
                }
            }
        };
    });

    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    const getFetchList = () => [{
        tenant: 'tenant',
        data: declaration.tenant.application.item.property,
        parentData: declaration.tenant.application.item,
        parentDataProperty: 'property',
        instancePath: '/tenant/application/item/property',
        schemaData: 'string'
    }];

    describe('.process', () => {
        it('should resolve if fetchList is undefined', () => FetchTag.process(context, declaration));

        it('should resolve if no fetch data to process', () => FetchTag.process(context, declaration, []));

        it('should skip fetching data if host device is BIG-IQ', () => {
            context.host.deviceType = DEVICE_TYPES.BIG_IQ;
            return FetchTag.process(context, declaration, getFetchList())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.property,
                        { url: 'https://example.com/data.xml' },
                        'data should not be replaced by fetched response'
                    );
                });
        });

        it('should skip fetching data if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return FetchTag.process(context, declaration, getFetchList())
                .then(() => {
                    assert.strictEqual(fetchValueSpy.called, false, 'fetchValue should not be called');
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.property,
                        { url: 'https://example.com/data.xml' },
                        'data should not be replaced by fetched response'
                    );
                });
        });

        it('should fetch and update data', () => {
            nock('https://example.com')
                .get('/data.xml')
                .reply(200, 'Test Data!');
            return FetchTag.process(context, declaration, getFetchList())
                .then(() => {
                    assert.deepStrictEqual(
                        declaration.tenant.application.item.property,
                        'Test Data!',
                        'data should be replaced by fetched response'
                    );
                });
        });
    });
});

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

const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const CheckResourceTag = require('../../../../src/lib/tag').CheckResourceTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;
const authHeaderUtil = require('../../../../src/lib/util/authHeaderUtil');

describe('checkResourceTag', () => {
    let context;
    let declaration;

    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    beforeEach(() => {
        context = Context.build();
        declaration = {
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    template: 'generic',
                    dataGroup: {
                        class: 'Data_Group',
                        storageType: 'external',
                        keyDataType: 'string',
                        externalFilePath: {
                            url: 'https://test.example.com/foo/var/tenant/app/item'
                        }
                    }
                }
            }
        };
    });

    describe('.process', () => {
        let checks;
        beforeEach(() => {
            checks = [
                {
                    data: 'https://test.example.com/foo/bar',
                    dataPath: '/tenant/app/item',
                    parentData: {},
                    pptyName: 'externalFilePath',
                    rootData: {}
                }
            ];
        });

        it('should resolve if resources is undefined',
            () => assert.isFulfilled(CheckResourceTag.process(context, declaration)));

        it('should resolve if no resources to process',
            () => assert.isFulfilled(CheckResourceTag.process(context, declaration, [])));

        it('should resolve early if run on a BIG_IQ', () => {
            context.host.deviceType = DEVICE_TYPES.BIG_IQ;
            const spy = sinon.spy(authHeaderUtil, 'getAuthHeader');
            return assert.isFulfilled(CheckResourceTag.process(context, declaration, checks))
                .then(() => assert(spy.notCalled, 'should have early exited before reaching authHeader code')); // Check to make sure the code exited early
        });

        it('should throw an error when resource is not reachable', () => {
            nock('https://test.example.com')
                .intercept('/foo/bar', 'HEAD')
                .reply(404, undefined);

            assert.isRejected(
                CheckResourceTag.process(context, declaration, checks),
                'Could not reach https://test.example.com/foo/bar for /tenant/app/item'
            );
        });

        it('should handle a resource that is reachable and data is a string', () => {
            nock('https://test.example.com')
                .intercept('/foo/bar', 'HEAD')
                .reply(200, undefined);

            return CheckResourceTag.process(context, declaration, checks)
                .then(() => {
                    assert(nock.isDone());
                });
        });

        it('should handle a resource that is reachable and data is an object', () => {
            checks[0].data = {
                url: 'https://test.example.com/foo/bar'
            };

            nock('https://test.example.com')
                .intercept('/foo/bar', 'HEAD')
                .reply(200, undefined);

            return CheckResourceTag.process(context, declaration, checks)
                .then(() => {
                    assert(nock.isDone());
                });
        });

        it('should resolve when file: is in the url', () => {
            checks[0].data = 'file:/the/file';

            return assert.isFulfilled(CheckResourceTag.process(context, declaration, checks));
        });
    });
});

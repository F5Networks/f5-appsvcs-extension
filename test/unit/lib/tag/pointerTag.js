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

const AJV = require('ajv');
const assert = require('assert');
const sinon = require('sinon');
const PointerTag = require('../../../../src/lib/tag').PointerTag;
const Context = require('../../../../src/lib/context/context');
const log = require('../../../../src/lib/log');

describe('pointerTag', () => {
    let context;
    let declaration;
    let logWarningSpy;

    beforeEach(() => {
        context = Context.build();
        declaration = {
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualPort: 80,
                        virtualAddresses: ['192.0.2.10'],
                        profileHTTP: {
                            use: 'httpProfile'
                        }
                    },
                    httpProfile: {
                        class: 'HTTP_Profile',
                        webSocketsEnabled: true,
                        webSocketMasking: 'preserve'
                    }
                }
            }
        };
        logWarningSpy = sinon.stub(log, 'warning');
    });

    afterEach(() => {
        sinon.restore();
    });

    const getPointers = () => [{
        tenant: 'tenant',
        data: declaration.tenant.application.service.profileHTTP.use,
        parentData: declaration.tenant.application.service.profileHTTP,
        parentDataProperty: 'use',
        instancePath: '/tenant/application/service/profileHTTP/use',
        schemaData: {
            properties: {
                class: {
                    const: 'HTTP_Profile'
                }
            },
            required: [
                'class'
            ]
        }
    }];

    describe('.process', () => {
        it('should resolve if pointers is undefined', () => PointerTag.process(context, declaration));

        it('should resolve if no pointers to process', () => PointerTag.process(context, declaration, []));

        it('should resolve if pointer data is not a string', () => {
            const pointers = getPointers();
            pointers[0].data = { data: pointers[0].data };
            return PointerTag.process(context, declaration, pointers);
        });

        it('should skip validating pointers if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return PointerTag.process(context, declaration, getPointers())
                .then(() => {
                    assert.strictEqual(declaration.tenant.application.service.profileHTTP.use, 'httpProfile', 'pointer should not be expanded to full path');
                });
        });

        it('should resolve if pointer data is empty', () => {
            declaration.tenant.application.service.profileHTTP.use = '';
            return PointerTag.process(context, declaration, getPointers());
        });

        it('should reject if pointer schema data is invalid', () => {
            const pointers = getPointers();
            const expectedLogWarnings = [
                'invalid schema for f5PostProcess(pointer): {"properties":[],"required":["class"]}'
            ];
            const expectedErrorMessage = 'schema is invalid: data.properties should be object';
            let rejected = true;

            pointers[0].schemaData.properties = [];

            return PointerTag.process(context, declaration, pointers)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    const logWarnings = logWarningSpy.getCalls().map((c) => c.args[0]);
                    assert.deepStrictEqual(logWarnings, expectedLogWarnings);
                    assert.strictEqual(err.message, expectedErrorMessage);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should resolve and expand pointer', () => PointerTag.process(context, declaration, getPointers())
            .then(() => {
                assert.strictEqual(
                    declaration.tenant.application.service.profileHTTP.use,
                    '/tenant/application/httpProfile',
                    'pointer should be expanded to full path'
                );
            }));

        it('should reject if pointer path is bad', () => {
            const expectedErrorMessage = 'contains path to non-existent object testBadPath';
            let rejected = true;

            declaration.tenant.application.service.profileHTTP.use = 'testBadPath';

            return PointerTag.process(context, declaration, getPointers())
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/service/profileHTTP/use',
                        keyword: 'f5PostProcess(pointer)',
                        params: {},
                        message: expectedErrorMessage
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if pointer points to wrong class object', () => {
            const pointers = getPointers();
            const expectedErrorMessage = 'AS3 pointer httpProfile does not point to required object type';
            let rejected = true;

            pointers[0].schemaData.properties.class.const = 'Pool';

            return PointerTag.process(context, declaration, pointers)
                .then(() => {
                    rejected = false;
                })
                .catch((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/service/profileHTTP/use',
                        keyword: 'f5PostProcess(pointer)',
                        params: {},
                        message: expectedErrorMessage
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });
});

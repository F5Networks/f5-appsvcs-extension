/**
 * Copyright 2022 F5 Networks, Inc.
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
const MinVersionTag = require('../../../../src/lib/tag').MinVersionTag;

describe('MinVersionTag', () => {
    let context;
    let declaration;
    let originalDeclaration;
    let minVersions;

    beforeEach(() => {
        context = {
            target: {
                tmosVersion: '17.9'
            }
        };
        declaration = {
            Tenant: {
                Application: {
                    Profile: {
                        property1: 'hello',
                        property2: 'goodbye'
                    }
                }
            }
        };
        originalDeclaration = {
            Tenant: {
                Application: {
                    Profile: {
                        property1: 'hello',
                        property2: 'goodbye'
                    }
                }
            }
        };
        minVersions = [
            {
                schemaData: '18.0',
                tenant: 'Tenant',
                instancePath: '/Tenant/Application/Profile/property1',
                parentData: {
                    class: 'MyClass'
                },
                parentDataProperty: 'MyProperty'
            },
            {
                schemaData: '17.9',
                tenant: 'Tenant',
                instancePath: '/Tenant/Application/Profile/property2',
                parentData: {
                    class: 'MyOtherClass'
                },
                parentDataProperty: 'MyOtherProperty'
            }
        ];
    });

    describe('.process', () => {
        it('should resolve if minVersions is undefined', () => MinVersionTag.process(context, declaration));

        it('should resolve if no minVersions to process', () => MinVersionTag.process(context, declaration, [], originalDeclaration));

        it('should set properties to undefined if the device version is lower than required', () => MinVersionTag.process(context, declaration, minVersions, originalDeclaration)
            .then(() => {
                assert.deepStrictEqual(declaration.Tenant.Application.Profile.property1, undefined);
            }));

        it('should leave properties untouched if the device version is not lower than required', () => MinVersionTag.process(context, declaration, minVersions, originalDeclaration)
            .then(() => {
                assert.deepStrictEqual(declaration.Tenant.Application.Profile.property2, 'goodbye');
            }));

        it('should generate a warning if the bad property is in the original declaration', () => MinVersionTag.process(context, declaration, minVersions, originalDeclaration)
            .then((results) => {
                assert.strictEqual(results.warnings.length, 1);
                assert.deepStrictEqual(results.warnings[0].tenant, 'Tenant');
                assert.deepStrictEqual(results.warnings[0].dataPath, '/Tenant/Application/Profile/property1');
            }));

        it('should not generate a warning if the bad property is not in the original declaration', () => {
            delete originalDeclaration.Tenant.Application.Profile.property1;
            return MinVersionTag.process(context, declaration, minVersions, originalDeclaration)
                .then((results) => {
                    assert.strictEqual(results.warnings.length, 0);
                });
        });
    });
});

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
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const ModuleTag = require('../../../../src/lib/tag').ModuleTag;
const Context = require('../../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../../src/lib/constants').DEVICE_TYPES;

describe('moduleTag', () => {
    let context;
    let declaration;

    beforeEach(() => {
        context = Context.build();
        context.target = {
            host: 'localhost',
            port: 8100,
            tokens: {},
            provisionedModules: ['afm', 'ltm', 'pem'],
            tmosVersion: '16.1.2',
            deviceType: 'BIG-IP'
        };
        declaration = {
            class: 'AS3',
            persist: false,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.27.0',
                id: 'Firewall_Address_List',
                controls: {
                    class: 'Controls',
                    trace: true,
                    logLevel: 'debug',
                    traceResponse: true
                },
                Tenant: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        fwAddressList: {
                            class: 'Firewall_Address_List',
                            addresses: [
                                {
                                    addressDiscovery: 'aws',
                                    updateInterval: 60,
                                    tagKey: 'foo',
                                    tagValue: 'bar',
                                    addressRealm: 'private',
                                    region: 'us-west-1',
                                    accessKeyId: '<id>',
                                    secretAccessKey: '<key>',
                                    credentialUpdate: false
                                },
                                '192.0.2.1',
                                '192.0.2.3'
                            ]
                        }
                    }
                }
            }
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    const getModules = () => [{
        tenant: 'tenant',
        data: declaration.declaration.Tenant.Application.fwAddressList,
        parentData: declaration.declaration.Tenant.Application,
        parentDataProperty: 'fwAddressList',
        instancePath: '/Tenant/Application/fwAddressList',
        schemaData: ['afm', 'asm']
    }];

    describe('.process', () => {
        it('should resolve if modules is undefined', () => assert.isFulfilled(
            ModuleTag.process(context, declaration)
        ));

        it('should resolve if no modules to process', () => assert.isFulfilled(
            ModuleTag.process(context, declaration, [])
        ));

        it('should skip validating modules if declaration.scratch is defined', () => {
            declaration.scratch = 'test scratch';
            return assert.isFulfilled(ModuleTag.process(context, declaration, getModules()));
        });

        it('should resolve if modules.schemaData is a string', () => {
            const modules = getModules();
            modules[0].schemaData = 'afm';
            return assert.isFulfilled(ModuleTag.process(context, declaration, modules));
        });

        it('should skip validating if run on a BIG_IQ', () => {
            const modules = getModules();
            context.host.deviceType = DEVICE_TYPES.BIG_IQ;
            return assert.isFulfilled(ModuleTag.process(context, declaration, modules));
        });

        it('should resolve if the target module is provisioned', () => {
            const modules = getModules();
            return assert.isFulfilled(ModuleTag.process(context, declaration, modules));
        });

        it('should resolve if module.schemaData is an empty array', () => {
            const modules = getModules();
            modules[0].schemaData = [];

            return assert.isFulfilled(ModuleTag.process(context, declaration, modules));
        });

        it('should error if modules.schemaData is an invalid string', () => {
            const modules = getModules();
            modules[0].schemaData = 'should handle a string';
            return assert.isRejected(ModuleTag.process(context, declaration, modules),
                /validation failed/)
                .then((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [
                        {
                            dataPath: '/Tenant/Application/fwAddressList',
                            keyword: 'f5PostProcess(modules)',
                            message: 'One of these F5 modules needs to be provisioned: should handle a string',
                            params: {
                                keyword: 'f5PostProcess(modules)'
                            }
                        }
                    ]);
                });
        });

        it('should throw an AJV Validation Error module.schemaData, if does NOT match the context.target', () => {
            const modules = getModules();
            context.target.provisionedModules = ['otherModule'];
            return assert.isRejected(ModuleTag.process(context, declaration, modules),
                /validation failed/)
                .then((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [
                        {
                            dataPath: '/Tenant/Application/fwAddressList',
                            keyword: 'f5PostProcess(modules)',
                            message: 'One of these F5 modules needs to be provisioned: afm, asm',
                            params: {
                                keyword: 'f5PostProcess(modules)'
                            }
                        }
                    ]);
                });
        });

        it('should throw an AJV Validation Error if module.schemaData is an object', () => {
            const modules = getModules();
            modules[0].schemaData = { foo: 'bar' };
            return assert.isRejected(ModuleTag.process(context, declaration, modules),
                /validation failed/)
                .then((err) => {
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [
                        {
                            dataPath: '/Tenant/Application/fwAddressList',
                            keyword: 'f5PostProcess(modules)',
                            message: 'Received unprocessable object as module data instead of a String or Array<String>',
                            params: {
                                keyword: 'f5PostProcess(modules)'
                            }
                        }
                    ]);
                });
        });
    });
});

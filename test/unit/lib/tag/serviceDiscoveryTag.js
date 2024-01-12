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
const AJV = require('ajv');
const assert = require('assert');

const ServiceDiscoveryTag = require('../../../../src/lib/tag').ServiceDiscoveryTag;
const Context = require('../../../../src/lib/context/context');
const Config = require('../../../../src/lib/config');

describe('serviceDiscoveryTag', () => {
    let context;
    let declaration;
    let settings;

    const getSdData = () => ({
        tenant: 'tenant',
        data: declaration.tenant.application.item1.sdProperty,
        parentData: declaration.tenant.application.item1,
        parentDataProperty: 'sdProperty',
        instancePath: '/tenant/application/item1/sdProperty'
    });

    const getSdExceptionsData = () => ({
        tenant: 'tenant',
        data: declaration.tenant.application.item2.sdPropertyExceptions,
        parentData: declaration.tenant.application.item2,
        parentDataProperty: 'sdPropertyExceptions',
        instancePath: '/tenant/application/item2/sdPropertyExceptions',
        schemaData: {
            exceptions: [
                'static',
                'fqdn'
            ]
        }
    });

    beforeEach(() => {
        sinon.stub(Config, 'getAllSettings').callsFake(() => Promise.resolve(settings));
        context = Context.build();
        declaration = {
            class: 'ADC',
            tenant: {
                application: {
                    item1: {
                        sdProperty: 'aws'
                    },
                    item2: {
                        sdPropertyExceptions: 'aws'
                    }
                }
            }
        };
        settings = {};
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('.process', () => {
        it('should resolve if serviceDiscoveryList is undefined', () => ServiceDiscoveryTag.process(context, declaration));

        it('should resolve if no service discovery data to process', () => ServiceDiscoveryTag.process(context, declaration, []));

        it('should reject if schema data is incorrect type', () => {
            let rejected = false;
            const sdData = getSdData();
            sdData.schemaData = true;

            return ServiceDiscoveryTag.process(context, declaration, [sdData])
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(
                        err.message,
                        'f5PostProcess(serviceDiscovery) schema must be undefined or an object'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if schema data contains additional properties', () => {
            let rejected = false;
            const sdExceptionsData = getSdExceptionsData();
            sdExceptionsData.schemaData.extraProperty = 'oops';

            return ServiceDiscoveryTag.process(context, declaration, [sdExceptionsData])
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(
                        err.message,
                        'f5PostProcess(serviceDiscovery) schema property "extraProperty" not allowed'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if schema data contains property with non-array value', () => {
            let rejected = false;
            const sdExceptionsData = getSdExceptionsData();
            sdExceptionsData.schemaData.exceptions = 'oops';

            return ServiceDiscoveryTag.process(context, declaration, [sdExceptionsData])
                .catch((err) => {
                    rejected = true;
                    assert.strictEqual(
                        err.message,
                        'f5PostProcess(serviceDiscovery) schema property "exceptions" must have array value'
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject if service discovery is disabled', () => {
            let rejected = false;
            settings.serviceDiscoveryEnabled = false;

            return ServiceDiscoveryTag.process(context, declaration, [getSdData()])
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/item1/sdProperty',
                        keyword: 'f5PostProcess(serviceDiscovery)',
                        params: {},
                        message: 'requires Service Discovery to be enabled'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should resolve if data matches exception, even if service discovery is disabled', () => {
            declaration.tenant.application.item2.sdPropertyExceptions = 'fqdn';
            settings.serviceDiscoveryEnabled = false;

            return ServiceDiscoveryTag.process(context, declaration, [getSdExceptionsData()]);
        });

        it('should reject if service discovery is not installed and host is local machine', () => {
            let rejected = false;
            context.host.sdInstalled = false;
            context.tasks = [{ resolvedHostIp: '127.0.0.1' }];
            context.currentIndex = 0;

            return ServiceDiscoveryTag.process(context, declaration, [getSdData()])
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/item1/sdProperty',
                        keyword: 'f5PostProcess(serviceDiscovery)',
                        params: {},
                        message: 'requires Service Discovery to be installed. Service Discovery will be installed the next time AS3 starts up'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });
});

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

const TestCollection = require('./testCollection');
const resourceGenerator = require('./resourceGenerator');
const newmanUtils = require('./newman');

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe('Random', function () {
    this.timeout(30000);
    this.slow(20000);

    const iterations = 20;

    it('Service_Address', (done) => {
        const collection = new TestCollection('Random Servive_Address');
        for (let i = 0; i < iterations; i += 1) {
            const declaration = resourceGenerator.createDeclaration('TEST_Service_Address', '');
            declaration.tenant.application.TestAddress = resourceGenerator.createResource('Service_Address');
            declaration.tenant.application.serviceMain.virtualAddresses = [{ use: 'TestAddress' }];
            collection.addDeclarePostItem('random Service_Address', declaration);
        }
        newmanUtils.runNewman(collection, newmanUtils.DEFAULT_OPTIONS, done);
    });

    it('Tenant', (done) => {
        const collection = new TestCollection('Random Tenant');
        for (let i = 0; i < iterations; i += 1) {
            const tenantCount = getRandomInt(1, 10);

            const declaration = resourceGenerator.createDeclaration('TEST_Tenant', '');
            delete declaration.tenant;
            for (let j = 0; j < tenantCount; j += 1) {
                const name = resourceGenerator.createName();
                declaration[name] = resourceGenerator.createResource('Tenant');
            }
            collection.addDeclarePostItem('random Tenants', declaration);
        }
        newmanUtils.runNewman(collection, newmanUtils.DEFAULT_OPTIONS, done);
    });

    it('Endpoint_Policy', (done) => {
        const collection = new TestCollection('Random Endpoint_Policy');
        for (let i = 0; i < iterations; i += 1) {
            const declaration = resourceGenerator.createDeclaration('TEST_Endpoint_Policy', '');
            declaration.tenant.application.TestPolicy = resourceGenerator.createResource('Endpoint_Policy');
            collection.addDeclarePostItem('random Endpoint_Policy', declaration);
        }
        newmanUtils.runNewman(collection, newmanUtils.DEFAULT_OPTIONS, done);
    });
});

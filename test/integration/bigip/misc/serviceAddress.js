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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('serviceAddress', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    it('should throw an error if a Service Address address is modified', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    vaddr: {
                        class: 'Service_Address',
                        virtualAddress: '10.0.1.2'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                // modify the virtual address for testing
                decl.tenant.app.vaddr.virtualAddress = '10.0.2.2';
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, 'The Service Address virtualAddress property cannot be modified. Please delete /tenant/vaddr and recreate it.');
            });
    });
});

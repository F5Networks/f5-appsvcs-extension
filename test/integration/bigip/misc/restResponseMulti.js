/**
 * Copyright 2023 F5, Inc.
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

const resourceGenerator = require('../../../common/resourceGenerator');
const {
    getDeclaration,
    postDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

chai.use(chaiAsPromised);
const assert = chai.assert;

function runCase(name, code, testCase) {
    it(`${testCase.method} ${testCase.name}`, () => {
        const body = testCase.declarations;
        const promise = Promise.resolve()
            .then(() => {
                if (testCase.method !== 'GET') {
                    return Promise.resolve();
                }
                return getDeclaration(testCase.subpath);
            })
            .then(() => {
                if (testCase.method !== 'POST') {
                    return Promise.resolve();
                }
                return postDeclaration(
                    body,
                    { declarationIndex: 0 },
                    testCase.subpath || ''
                );
            });

        // Check errors
        if (code >= 400) {
            const regex = new RegExp([].concat(
                [code],
                testCase.statusCodes,
                testCase.items
            ).map((s) => `(?=.*${s})`).join(''));
            return assert.isRejected(promise, regex);
        }

        // Check individual responses
        return promise.then((response) => {
            assert(response.code, code);
        });
    });
}

describe('REST Response Multi (__smoke)', function () {
    this.timeout(GLOBAL_TIMEOUT);

    describe('400 BadRequest', function () {
        const declaration = resourceGenerator.createDeclaration('TEST_MultiBadRequest', '');
        declaration.tenant.application.TestAddress = resourceGenerator.createResource('Service_Address');
        declaration.tenant.application.serviceMain.virtualAddresses = [{ use: 'TestAddress' }];

        const declaration1 = resourceGenerator.createDeclaration('TEST_MultiBadRequest1', '');
        declaration1.tenant1 = Object.assign(declaration.tenant);
        delete declaration1.tenant;
        declaration1.tenant1.application.TestAddress = resourceGenerator.createResource('Service_Address');
        declaration1.tenant1.application.serviceMain.virtualAddresses = [{ use: 'TestAddress' }];

        const statusCodes = [400, 400];

        const testCases = [
            {
                name: 'With wrapper, deploy with retrieveAge-redeployAge',
                items: [
                    'retrieveAge value is not allowed for action',
                    'redeployAge is valid only with action \\\\"redeploy\\\\"'
                ],
                method: 'POST',
                declarations: [
                    {
                        class: 'AS3',
                        action: 'deploy',
                        retrieveAge: 2,
                        declaration
                    },
                    {
                        class: 'AS3',
                        action: 'deploy',
                        redeployAge: 2,
                        declaration: declaration1
                    }
                ],
                statusCodes

            }
        ];

        testCases.forEach((test) => runCase('TEST_BadRequestMulti', 400, test));
    });

    describe('207 MultiStatus', function () {
        const declaration = resourceGenerator.createDeclaration('TEST_MultiStatus', '');
        declaration.tenant.application.TestAddress = resourceGenerator.createResource('Service_Address');
        declaration.tenant.application.serviceMain.virtualAddresses = [{ use: 'TestAddress' }];

        const declaration1 = resourceGenerator.createDeclaration('TEST_MultiStatus1', 'empty');
        declaration1.tenant2 = Object.assign(declaration1.tenant);
        delete declaration1.tenant;
        declaration1.tenant2.class = 'Tenant!!!';

        const testCases = [
            {
                name: 'Bad Request and Unprocessable Entity',
                items: [
                    'patchBody is valid only with action',
                    'Invalid data property: Tenant!!!'
                ],
                method: 'POST',
                declarations: [
                    {
                        class: 'AS3',
                        action: 'deploy',
                        patchBody: [{
                            op: 'remove',
                            path: '/some/path'
                        }]
                    },
                    declaration1
                ],
                statusCodes: [400, 422]
            },
            {
                name: 'Valid and Invalid Target',
                items: [
                    'no declarations found',
                    'unable to retrieve declaration'
                ],
                method: 'POST',
                declarations: [
                    {
                        class: 'AS3',
                        action: 'retrieve'
                    },
                    {
                        class: 'AS3',
                        action: 'retrieve',
                        // testServer1
                        targetHost: '255.255.255.255',
                        targetUsername: 'user',
                        targetPassphrase: 'password'
                    }
                ],
                statusCodes: [204, 404]
            },
            {
                name: 'Duplicate declarations (same tenant and targetHost)',
                items: [
                    'no declarations found',
                    'another request exists with the same targetHost-declaration tenant, declaration target, and/or declaration tenant-app',
                    'another request exists with the same targetHost-declaration tenant, declaration target, and/or declaration tenant-app'
                ],
                method: 'POST',
                declarations: [
                    {
                        class: 'AS3',
                        action: 'retrieve'
                    },
                    declaration,
                    declaration
                ],
                statusCodes: [204, 422, 422]
            }

        ];

        testCases.forEach((test) => runCase('TEST_MultiStatus', 207, test));
    });
});

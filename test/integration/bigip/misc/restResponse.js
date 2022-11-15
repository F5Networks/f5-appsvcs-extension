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

const resourceGenerator = require('../../../common/resourceGenerator');
const {
    getDeclaration,
    postDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

chai.use(chaiAsPromised);
const assert = chai.assert;

function runCase(name, code, testCase) {
    const declaration = resourceGenerator.createDeclaration(name, '');
    declaration.tenant.application.TestAddress = resourceGenerator.createResource('Service_Address');
    declaration.tenant.application.serviceMain.virtualAddresses = [{ use: 'TestAddress' }];

    it(`${testCase.method} ${testCase.name}`, () => {
        let body = declaration;
        if (testCase.as3Class) {
            body = testCase.as3Class;
            if (testCase.includeDecl) {
                body.declaration = declaration;
            }
        }

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
            })
            .then((r) => JSON.stringify(r, null, 2));

        const regex = new RegExp([
            code,
            testCase.message
        ].map((s) => `(?=.*${s})`).join(''));
        return assert.isRejected(promise, regex);
    });
}

describe('REST Response Single (__smoke)', function () {
    this.timeout(GLOBAL_TIMEOUT);

    describe('400 Bad Request', function () {
        const testCases = [
            {
                name: 'Invalid ?show',
                subpath: '?show=everything',
                message: 'show must be ',
                method: 'GET'
            },
            {
                name: 'With ?age',
                subpath: '?age=1',
                message: 'query param \\\\"age\\\\" is not allowed',
                method: 'POST'
            },
            {
                name: 'Invalid age value',
                subpath: '?age=111',
                message: 'invalid age value ',
                method: 'GET'
            },
            {
                name: 'Invalid query param',
                subpath: '?mumble=mumbling',
                message: 'unrecognized URL query parameter',
                method: 'GET'
            },
            {
                name: 'Action "deploy" with retrieveAge',
                message: 'retrieveAge value is not allowed for action',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'deploy',
                    retrieveAge: 2
                }
            },
            {
                name: 'Action "deploy" with redeployAge',
                message: 'redeployAge is valid only with action \\\\"redeploy\\\\"',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'deploy',
                    redeployAge: 2
                }
            },
            {
                name: 'Action "deploy" with redeployUpdateMode',
                message: 'redeployUpdateMode is valid only with action \\\\"redeploy\\\\"',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'deploy',
                    redeployUpdateMode: 'complete'
                },
                includeDecl: true
            },
            {
                name: 'Action "deploy" with patchBody',
                message: 'patchBody is valid only with action',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'deploy',
                    patchBody: [{
                        op: 'remove',
                        path: '/some/path'
                    }]
                }
            },
            {
                name: 'Action "patch" without patchBody',
                message: 'a patchBody must be included',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'patch'
                }
            },
            {
                name: 'Action "retrieve" with a declaration value',
                message: 'for action \\\\"retrieve\\\\", a declaration is not allowed',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'retrieve'
                },
                includeDecl: true
            },
            {
                name: 'Action "deploy" without a declaration value',
                message: 'a declaration is required',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'deploy'
                }
            }
        ];

        testCases.forEach((test) => runCase('TEST_BadRequest', 400, test));
    });

    describe('422 Unprocessable Entity', function () {
        const testCases = [
            {
                name: 'AS3 request with out-of-range value',
                message: 'should be <= 15',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'redeploy',
                    redeployAge: 22
                }
            },
            {
                name: 'Action "patch" with non-array body',
                message: 'should be array',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'patch',
                    patchBody: {
                        op: 'do_something',
                        path: 'some/path'
                    }
                }
            },
            {
                name: 'Action "patch" with invalid op value',
                message: 'InvalidPatchOperationError: invalid op',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'patch',
                    patchBody: [{
                        op: 'do_something',
                        path: 'some/path'
                    }]
                }
            },
            {
                name: 'Action "patch" with op "test"',
                message: 'not supported',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'patch',
                    patchBody: [{
                        op: 'test',
                        path: 'some/path',
                        value: 'something'
                    }]
                }
            },
            {
                name: 'Action "patch" with non-selective updateMode',
                message: 'updateMode value can only be',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'patch',
                    patchBody: [{
                        op: 'replace',
                        path: '/updateMode',
                        value: 'complete'
                    }]
                }
            },
            {
                name: 'Action "patch" with empty array patchBody',
                message: 'should NOT have fewer than 1 items',
                method: 'POST',
                as3Class: {
                    class: 'AS3',
                    action: 'patch',
                    patchBody: []
                }
            }
        ];

        testCases.forEach((test) => runCase('TEST_UnprocEntity', 422, test));
    });
});

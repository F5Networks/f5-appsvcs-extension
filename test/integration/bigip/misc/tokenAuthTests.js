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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    sendDeclaration,
    deleteDeclaration,
    deleteUser,
    getPath,
    patch,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');
const requestUtil = require('../../../common/requestUtilPromise');

describe('Test Auth Tokens', function () {
    beforeEach(function () {
        if (process.env.TEST_IN_AZURE === 'true') {
            this.skip();
        }
    });

    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration()); // Clear out the BIG-IP after each run

    it('should test user and token creation in POST and PATCH', function () {
        const randomUser = Math.random().toString(36).replace(/[^a-z0-9]+/g, '');
        const newUser = {
            name: randomUser,
            password: 'initialGenericPassword',
            role: 'admin',
            'partition-access': [{
                name: 'all-partitions',
                role: 'admin'
            }],
            shell: 'none'
        };

        const updatePassword = {
            username: randomUser,
            password: 'chunkyGenericPassword'
        };

        const newToken = {
            username: randomUser,
            password: 'chunkyGenericPassword',
            loginProviderName: 'tmos'
        };

        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'TEST_Auth_Token',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug'
            },
            TEST_Auth_Tokens: {
                class: 'Tenant',
                minimalApp: {
                    class: 'Application',
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '198.19.193.11'
                        ],
                        virtualPort: 2611
                    }
                }
            }
        };

        const patchDecl = [
            {
                op: 'add',
                path: '/TEST_Auth_Tokens/minimalApp/serviceMain/virtualAddresses/-',
                value: '198.19.193.12'
            }
        ];

        const header = {};

        return Promise.resolve()
            .then(() => postDeclaration(newUser, { declarationIndex: 0 }, '', '/mgmt/tm/auth/user'))
            .then((response) => {
                assert.strictEqual(response.name, randomUser);
            })
            .then(() => {
                // 17.0+ requires a password change on first login
                const reqOpts = {
                    path: `/mgmt/tm/auth/user/${randomUser}`,
                    body: updatePassword
                };
                return requestUtil.put(reqOpts);
            })
            .then(() => postDeclaration(newToken, { declarationIndex: 2 }, '', '/mgmt/shared/authn/login'))
            .then((response) => {
                assert.strictEqual(response.username, randomUser);
                header['X-F5-Auth-Token'] = response.token.token;
            })
            .then(() => sendDeclaration(decl, '', undefined, header))
            .then((response) => assert.strictEqual(response.body.results[0].code, 200))
            .then(() => getPath('/mgmt/shared/appsvcs/declare', true, header))
            .then((response) => assert.strictEqual(response.statusCode, 200))
            .then(() => patch('/mgmt/shared/appsvcs/declare', patchDecl, header))
            .then((response) => assert.strictEqual(response.body.results[0].code, 200))
            .then(() => deleteUser(randomUser))
            .then((response) => assert.strictEqual(response, 200));
    });

    it('should test an invalid token', () => assert.isRejected(
        getPath('/mgmt/shared/appsvcs/declare', undefined, { 'X-F5-Auth-Token': 'RaNdOmBaDtOkEn12' }),
        /Received unexpected 401 status code/
    ));
});

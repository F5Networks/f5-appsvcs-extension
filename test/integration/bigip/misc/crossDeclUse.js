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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Cross-Declaration use-pointer', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function checkResponse(response) {
        response.results.forEach((result) => {
            assert.strictEqual(result.code, 200);
        });
    }

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should handle websocket profiles across declarations', () => Promise.resolve()
        .then(() => assert.isFulfilled(
            postDeclaration({
                class: 'ADC',
                schemaVersion: '3.0.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        httpProfile: {
                            class: 'HTTP_Profile',
                            webSocketsEnabled: true,
                            webSocketMasking: 'preserve'
                        }
                    }
                }
            },
            { declarationIndex: 0 })
        ))
        .then((response) => checkResponse(response))
        .then(() => assert.isFulfilled(
            postDeclaration({
                class: 'ADC',
                schemaVersion: '3.0.0',
                Tenant: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualPort: 80,
                            virtualAddresses: [
                                '192.0.2.0'
                            ],
                            profileHTTP: {
                                use: '/Common/Shared/httpProfile'
                            }
                        }
                    }
                }
            },
            { declarationIndex: 1 })
        ))
        .then((response) => checkResponse(response))
        .then(() => deleteDeclaration())
        .then((response) => checkResponse(response)));

    it('should handle pools across declarations', () => {
        const commonDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 8080,
                                serverAddresses: [
                                    '192.0.2.1'
                                ]
                            }
                        ]
                    }
                }
            }
        };
        const tenantDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    vs: {
                        class: 'Service_HTTP',
                        virtualPort: 80,
                        virtualAddresses: [
                            '192.0.2.20'
                        ],
                        pool: {
                            use: '/Common/Shared/pool'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(postDeclaration(commonDecl, { declarationIndex: 0 })))
            .then((response) => checkResponse(response))
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 1 })))
            .then((response) => checkResponse(response))
            // post tenantDecl again to verify that Common did not get overwritten
            .then(() => assert.isFulfilled(postDeclaration(tenantDecl, { declarationIndex: 2 })))
            .then((response) => checkResponse(response))
            .then(() => deleteDeclaration())
            .then((response) => checkResponse(response));
    });
});

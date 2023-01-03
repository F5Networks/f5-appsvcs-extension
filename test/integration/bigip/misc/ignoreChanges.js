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

const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('ignoreChanges', function () {
    this.timeout(GLOBAL_TIMEOUT);

    let accessToken;

    before(() => {
        validateEnvVars(['TEST_RESOURCES_URL']);
    });

    beforeEach(() => {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    afterEach(() => deleteDeclaration());

    it('should return no change when ignoreChanges is set to true', function () {
        assertModuleProvisioned.call(this, 'asm');

        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            controls: {
                class: 'Controls',
                trace: true,
                logLevel: 'debug',
                traceResponse: true
            },
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    item: {
                        class: 'WAF_Policy',
                        url: {
                            url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`,
                            ignoreChanges: false
                        }
                    }
                }
            }
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            decl.tenant.application.item.url.authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => assert.strictEqual(response.results[0].message, 'success'))
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => assert.strictEqual(response.results[0].message, 'success'))
            .then(() => {
                decl.tenant.application.item.url.ignoreChanges = true;
                return postDeclaration(decl, { declarationIndex: 2 });
            })
            .then((response) => assert.strictEqual(response.results[0].message, 'no change'));
    });

    describe('Data Group - externalFilePath', function () {
        let decl;

        beforeEach(function () {
            decl = {
                class: 'AS3',
                action: 'deploy',
                persist: true,
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.30.0',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true
                    },
                    id: '123abc',
                    Common: {
                        class: 'Tenant',
                        Shared: {
                            class: 'Application',
                            template: 'shared',
                            testDatagroup: {
                                class: 'Data_Group',
                                storageType: 'external',
                                keyDataType: 'string',
                                externalFilePath: `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`,
                                separator: ':=',
                                label: 'test-datagroup'
                            }
                        }
                    }
                }
            };
        });

        describe('basic auth', () => {
            beforeEach(function () {
                if (process.env.TEST_IN_AZURE === 'true') {
                    this.skip();
                }
            });

            it('should return "no change" when ignoreChanges is true and a new externalFilePath is submitted', function () {
                decl.declaration.Common.Shared.testDatagroup.ignoreChanges = true;
                return Promise.resolve()
                    .then(() => postDeclaration(decl, { declarationIndex: 0 }))
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'success');
                        assert.strictEqual(response.results[1].message, 'no change');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');

                        decl.declaration.Common.Shared.testDatagroup.externalFilePath = `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup2.txt`;
                        return postDeclaration(decl, { declarationIndex: 1 });
                    })
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'no change');
                        assert.strictEqual(response.results[1].message, 'no change');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');

                        decl.declaration.Common.Shared.testDatagroup.externalFilePath = 'https://test@raw.githubusercontent.com/F5Networks/f5-appsvcs-extension/master/schema/latest/as3-schema.json';
                        return postDeclaration(decl, { declarationIndex: 2 });
                    })
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'no change');
                        assert.strictEqual(response.results[1].message, 'no change');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');
                    });
            });

            it('should return "success" when ignoreChanges is false and a new externalFilePath is submitted', function () {
                decl.declaration.Common.Shared.testDatagroup.ignoreChanges = false;
                return Promise.resolve()
                    .then(() => postDeclaration(decl, { declarationIndex: 0 }))
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'success');
                        assert.strictEqual(response.results[1].message, 'success');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');

                        decl.declaration.Common.Shared.testDatagroup.externalFilePath = `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup2.txt`;
                        return postDeclaration(decl, { declarationIndex: 1 });
                    })
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'success');
                        assert.strictEqual(response.results[1].message, 'success');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');
                    });
            });
        });

        describe('tokens', () => {
            beforeEach(function () {
                if (process.env.TEST_IN_AZURE !== 'true') {
                    this.skip();
                }
            });

            it('should return "no change" when ignoreChanges is true, tokens used, and a new externalFilePath', () => {
                decl.declaration.Common.Shared.testDatagroup.ignoreChanges = true;
                decl.declaration.Common.Shared.testDatagroup.externalFilePath = {
                    url: `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`,
                    authentication: {
                        method: 'bearer-token',
                        token: accessToken
                    }
                };

                return Promise.resolve()
                    .then(() => postDeclaration(decl, { declarationIndex: 0 }))
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'success');
                        assert.strictEqual(response.results[1].message, 'no change');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');

                        decl.declaration.Common.Shared.testDatagroup.externalFilePath = {
                            url: `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup2.txt`,
                            authentication: {
                                method: 'bearer-token',
                                token: accessToken
                            }
                        };
                        return postDeclaration(decl, { declarationIndex: 1 });
                    })
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'no change');
                        assert.strictEqual(response.results[1].message, 'no change');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');

                        decl.declaration.Common.Shared.testDatagroup.externalFilePath = 'https://test@raw.githubusercontent.com/F5Networks/f5-appsvcs-extension/master/schema/latest/as3-schema.json';
                        return postDeclaration(decl, { declarationIndex: 2 });
                    })
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'no change');
                        assert.strictEqual(response.results[1].message, 'no change');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');
                    });
            });

            it('should return "success" when ignoreChanges is false, tokens used, and a new externalFilePath', () => {
                decl.declaration.Common.Shared.testDatagroup.ignoreChanges = false;
                decl.declaration.Common.Shared.testDatagroup.externalFilePath = {
                    url: `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`,
                    authentication: {
                        method: 'bearer-token',
                        token: accessToken
                    }
                };

                return Promise.resolve()
                    .then(() => postDeclaration(decl, { declarationIndex: 0 }))
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'success');
                        assert.strictEqual(response.results[1].message, 'success');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');

                        return postDeclaration(decl, { declarationIndex: 1 });
                    })
                    .then((response) => {
                        assert.strictEqual(response.results[0].code, 200);
                        assert.strictEqual(response.results[1].code, 200);
                        assert.strictEqual(response.results[0].message, 'success');
                        assert.strictEqual(response.results[1].message, 'success');
                        assert.strictEqual(response.results[0].tenant, 'Common');
                        assert.strictEqual(response.results[1].tenant, 'Common');
                    });
            });
        });
    });
});

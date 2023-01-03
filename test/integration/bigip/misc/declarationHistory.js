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

const assert = require('assert');
const {
    postDeclaration,
    deleteDeclaration,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const getNewDeclaration = (tenantName, addresses) => ({
    class: 'ADC',
    schemaVersion: '3.0.0',
    controls: {
        class: 'Controls',
        logLevel: 'debug',
        trace: true,
        traceResponse: true
    },
    [tenantName]: {
        class: 'Tenant',
        Application: {
            class: 'Application',
            template: 'http',
            serviceMain: {
                class: 'Service_HTTP',
                virtualAddresses: addresses,
                virtualPort: 8080
            }
        }
    }
});

// Returns a list of tenant names that were found in provided declaration
const getTenantNames = (declaration) => {
    if (typeof declaration !== 'object') {
        return [];
    }
    if (declaration.class === 'AS3') {
        declaration = declaration.declaration;
    }
    return Object.keys(declaration).filter(
        (key) => typeof declaration[key] === 'object' && declaration[key].class === 'Tenant'
    );
};

// A Generator function for fetching a scoped index and incrementing it afterwards...since we
// shouldn't use unary operator ++ due to eslint rule no-plusplus
function* generateIndex() {
    let index = 0;
    while (true) {
        yield index;
        index += 1;
    }
}

// Validates that results entries match expected objects.
// Expected objects default to { code:200, tenant:'tenant', message:'success'}.
const assertResults = (results, expectedResults) => {
    assert.strictEqual(results.length, expectedResults.length);
    expectedResults.forEach((expectedResult, index) => {
        const expected = Object.assign({
            code: 200,
            tenant: 'tenant',
            message: 'success'
        }, expectedResult);
        assert.strictEqual(results[index].code, expected.code);
        assert.strictEqual(results[index].tenant, expected.tenant);
        assert.strictEqual(results[index].message, expected.message);
    });
};

// Validates that tenants in response's declaration match expected tenant objects.
const assertDeclaration = (declaration, tenantDeclObj) => {
    const expectedTenantNames = Object.keys(tenantDeclObj).sort();
    assert.deepStrictEqual(getTenantNames(declaration).sort(), expectedTenantNames);
    expectedTenantNames.forEach((tenantName) => {
        assert.deepStrictEqual(declaration[tenantName], tenantDeclObj[tenantName]);
    });
};

describe('Declaration History', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());

    it('should correctly update history when redeploying and retrieving declarations based on age', () => {
        const tenantOneDecl = getNewDeclaration('tenantOne', ['192.0.2.10']);
        const tenantTwoDecl = getNewDeclaration('tenantTwo', ['192.0.2.11']);
        tenantTwoDecl.updateMode = 'complete';

        const index = generateIndex();

        return Promise.resolve()
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'deploy',
                declaration: tenantOneDecl
            }, { declarationIndex: index.next().value }))
            .then((response) => {
                // Verify that tenantOne declaration deployed successfully
                assertResults(response.results, [{ tenant: 'tenantOne' }]);
                assertDeclaration(response.declaration, { tenantOne: tenantOneDecl.tenantOne });
            })
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'retrieve'
            }, { declarationIndex: index.next().value }, ''))
            .then((response) => {
                // Verify that declaration history includes tenantOne
                assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
            })
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'retrieve',
                retrieveAge: 0
            }, { declarationIndex: index.next().value }, ''))
            .then((response) => {
                // Verify that declaration history (age 0) includes tenantOne
                assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
            })
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'deploy',
                declaration: tenantTwoDecl
            }, { declarationIndex: index.next().value }))
            .then((response) => {
                // Verify that tenantTwo declaration deployed successfully
                // and that updateMode "complete" removed tenantOne
                assertResults(response.results, [{ tenant: 'tenantTwo' }, { tenant: 'tenantOne' }]);
                assertDeclaration(response.declaration, { tenantTwo: tenantTwoDecl.tenantTwo });
            })
            .then(() => {
                const promises = [0, 1].map((age) => Promise.resolve()
                    .then(() => postDeclaration({
                        class: 'AS3',
                        action: 'retrieve',
                        retrieveAge: age
                    }, { declarationIndex: index.next().value }, ''))
                    .then((response) => {
                        switch (age) {
                        case 0:
                            // Verify that declaration history (age 0) includes tenantTwo
                            // and that updateMode "complete" removed tenantOne
                            assertDeclaration(response, { tenantTwo: tenantTwoDecl.tenantTwo });
                            break;
                        case 1:
                            // Verify that declaration history (age 1) includes tenantOne
                            assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
                            break;
                        default:
                            throw new Error(`Age ${age} is not covered by test`);
                        }
                    }));
                return Promise.all(promises);
            })
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'redeploy',
                redeployAge: 1
            }, { declarationIndex: index.next().value }))
            .then((response) => {
                // Verify that tenantOne declaration re-deployed successfully
                assertResults(response.results, [{ tenant: 'tenantOne' }]);
                assertDeclaration(response.declaration, { tenantOne: tenantOneDecl.tenantOne });
            })
            .then(() => {
                const promises = [0, 1, 2].map((age) => Promise.resolve()
                    .then(() => postDeclaration({
                        class: 'AS3',
                        action: 'retrieve',
                        retrieveAge: age
                    }, { declarationIndex: index.next().value }, ''))
                    .then((response) => {
                        switch (age) {
                        case 0:
                            // Verify that declaration history (age 0) includes both tenantOne
                            // and tenantTwo due to the re-deploy of tenantOne in the last step
                            assertDeclaration(response, {
                                tenantTwo: tenantTwoDecl.tenantTwo,
                                tenantOne: tenantOneDecl.tenantOne
                            });
                            break;
                        case 1:
                            // Verify that declaration history (age 1) includes tenantTwo
                            assertDeclaration(response, { tenantTwo: tenantTwoDecl.tenantTwo });
                            break;
                        case 2:
                            // Verify that declaration history (age 2) includes tenantOne
                            assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
                            break;
                        default:
                            throw new Error(`Age ${age} is not covered by test`);
                        }
                    }));
                return Promise.all(promises);
            })
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'redeploy',
                redeployAge: 2,
                redeployUpdateMode: 'complete'
            }, { declarationIndex: index.next().value }))
            .then((response) => {
                // Verify that tenantOne declaration re-deployed successfully
                assertResults(
                    response.results,
                    [{ tenant: 'tenantOne', message: 'no change' }, { tenant: 'tenantTwo' }]
                );
                assertDeclaration(response.declaration, { tenantOne: tenantOneDecl.tenantOne });
            })
            .then(() => {
                const promises = [0, 1, 2, 3].map((age) => Promise.resolve()
                    .then(() => postDeclaration({
                        class: 'AS3',
                        action: 'retrieve',
                        retrieveAge: age
                    }, { declarationIndex: index.next().value }, ''))
                    .then((response) => {
                        switch (age) {
                        case 0:
                            // Verify that declaration history (age 0) includes only tenantOne due
                            // to the re-deploy of tenantOne with redeployUpdateMode set to
                            // complete
                            assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
                            break;
                        case 1:
                            // Verify that declaration history (age 1) includes both tenantOne
                            // and tenantTwo
                            assertDeclaration(response, {
                                tenantTwo: tenantTwoDecl.tenantTwo,
                                tenantOne: tenantOneDecl.tenantOne
                            });
                            break;
                        case 2:
                            // Verify that declaration history (age 2) includes tenantTwo
                            assertDeclaration(response, { tenantTwo: tenantTwoDecl.tenantTwo });
                            break;
                        case 3:
                            // Verify that declaration history (age 3) includes tenantOne
                            assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
                            break;
                        default:
                            throw new Error(`Age ${age} is not covered by test`);
                        }
                    }));
                return Promise.all(promises);
            })
            .then(() => postDeclaration({
                class: 'AS3',
                action: 'redeploy',
                redeployAge: 2,
                redeployUpdateMode: 'selective',
                historyLimit: 5
            }, { declarationIndex: index.next().value }))
            .then((response) => {
                // Verify that tenantTwo declaration re-deployed successfully
                assertResults(response.results, [{ tenant: 'tenantTwo' }]);
                assertDeclaration(response.declaration, { tenantTwo: tenantTwoDecl.tenantTwo });
            })
            .then(() => {
                const promises = [0, 1, 2, 3, 4].map((age) => Promise.resolve()
                    .then(() => postDeclaration({
                        class: 'AS3',
                        action: 'retrieve',
                        retrieveAge: age
                    }, { declarationIndex: index.next().value }, ''))
                    .then((response) => {
                        switch (age) {
                        case 0:
                            // Verify that declaration history (age 0) includes both tenantOne
                            // and tenantTwo due to the re-deploy of tenantTwo with
                            // redeployUpdateMode set to selective
                            assertDeclaration(response, {
                                tenantTwo: tenantTwoDecl.tenantTwo,
                                tenantOne: tenantOneDecl.tenantOne
                            });
                            break;
                        case 1:
                            // Verify that declaration history (age 1) includes tenantOne
                            assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
                            break;
                        case 2:
                            // Verify that declaration history (age 2) includes both tenantOne
                            // and tenantTwo
                            assertDeclaration(response, {
                                tenantTwo: tenantTwoDecl.tenantTwo,
                                tenantOne: tenantOneDecl.tenantOne
                            });
                            break;
                        case 3:
                            // Verify that declaration history (age 3) includes tenantTwo
                            assertDeclaration(response, { tenantTwo: tenantTwoDecl.tenantTwo });
                            break;
                        case 4:
                            // Verify that declaration history (age 4) includes tenantOne
                            assertDeclaration(response, { tenantOne: tenantOneDecl.tenantOne });
                            break;
                        default:
                            throw new Error(`Age ${age} is not covered by test`);
                        }
                    }));
                return Promise.all(promises);
            });
    });
});

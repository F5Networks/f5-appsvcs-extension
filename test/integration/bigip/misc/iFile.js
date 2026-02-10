/**
 * Copyright 2026 F5, Inc.
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
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('iFile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    it('should create iFile successfully in non Common tenant partition and modify successfully based on ignoreChanges flag', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            TEST_iFile: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    testIFile: {
                        class: 'iFile',
                        iFile: {
                            base64: 'TG9vaywgYW4gaUZpbGUh'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/sys/file/ifile/~TEST_iFile~Application~testIFile-ifile'))
            .then((response) => {
                assert.strictEqual(response.sourcePath, 'file:/var/config/rest/downloads/_TEST_iFile_Application_testIFile');
                assert.strictEqual(response.revision, 1);
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => {
                decl.TEST_iFile.Application.testIFile.iFile.base64 = 'TG9vaywgYW4gaUZpbGUgdXBkYXRlIQ==';
                decl.TEST_iFile.Application.testIFile.ignoreChanges = false;
                return postDeclaration(decl, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/sys/file/ifile/~TEST_iFile~Application~testIFile-ifile'))
            .then((response) => {
                assert.strictEqual(response.sourcePath, 'file:/var/config/rest/downloads/_TEST_iFile_Application_testIFile');
                assert.strictEqual(response.revision, 2);
            })
            .then(() => {
                decl.TEST_iFile.Application.testIFile.ignoreChanges = true;
                return postDeclaration(decl, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/sys/file/ifile/~TEST_iFile~Application~testIFile-ifile'))
            .then((response) => {
                assert.strictEqual(response.sourcePath, 'file:/var/config/rest/downloads/_TEST_iFile_Application_testIFile');
                assert.strictEqual(response.revision, 2);
            });
    });

    it('should create iFile successfully in Common tenant partition and modify successfully based on ignoreChanges flag', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    testIFile: {
                        class: 'iFile',
                        iFile: {
                            base64: 'TG9vaywgYW4gaUZpbGUh'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/sys/file/ifile/~Common~Shared~testIFile-ifile'))
            .then((response) => {
                assert.strictEqual(response.sourcePath, 'file:/var/config/rest/downloads/_Common_Shared_testIFile');
                assert.strictEqual(response.revision, 1);
            })
            .then(() => postDeclaration(decl, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => {
                decl.Common.Shared.testIFile.iFile.base64 = 'TG9vaywgYW4gaUZpbGUgdXBkYXRlIQ==';
                decl.Common.Shared.testIFile.ignoreChanges = false;
                return postDeclaration(decl, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                // Second Pass for Common should successfully update the file
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/sys/file/ifile/~Common~Shared~testIFile-ifile'))
            .then((response) => {
                assert.strictEqual(response.sourcePath, 'file:/var/config/rest/downloads/_Common_Shared_testIFile');
                assert.strictEqual(response.revision, 2);
            })
            .then(() => {
                decl.Common.Shared.testIFile.ignoreChanges = true;
                return postDeclaration(decl, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/sys/file/ifile/~Common~Shared~testIFile-ifile'))
            .then((response) => {
                assert.strictEqual(response.sourcePath, 'file:/var/config/rest/downloads/_Common_Shared_testIFile');
                assert.strictEqual(response.revision, 2);
            });
    });
});

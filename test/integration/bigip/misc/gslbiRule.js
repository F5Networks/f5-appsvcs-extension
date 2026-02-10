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
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('GSLB_iRule', function () {
    this.timeout(GLOBAL_TIMEOUT);
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    afterEach(() => Promise.resolve()
        .then(() => deleteDeclaration()));

    it('should reference iFile from within GSLB_iRule', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            TEST_iFile: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    testIFile: {
                        class: 'iFile',
                        iFile: {
                            base64: 'TG9vaywgYW4gaUZpbGUh'
                        }
                    },
                    iRule: {
                        class: 'GSLB_iRule',
                        iRule: {
                            base64: 'd2hlbiBETlNfUkVRVUVTVCB7CiAgICBzZXQgaWZpbGVDb250ZW50IFtpZmlsZSBnZXQgIi9URVNUX2lGaWxlL0FwcGxpY2F0aW9uL3Rlc3RJRmlsZSJdCiAgICBsb2cgbG9jYWwwLiAkaWZpbGVDb250ZW50CiAgICB1bnNldCBpZmlsZUNvbnRlbnQKfQ=='
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(decl, { declarationIndex: 0 }))
            .then((response) => assert.strictEqual(response.results[0].code, 200))
            .then(() => getPath('/mgmt/tm/gtm/rule/~TEST_iFile~Application~iRule'))
            .then((response) => {
                const iFileRef = response.apiAnonymous.includes('TEST_iFile/Application/testIFile');
                assert.equal(iFileRef, true);
            });
    });
});

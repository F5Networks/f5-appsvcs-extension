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

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('GSLB_Domain', function () {
    this.timeout(GLOBAL_TIMEOUT);

    beforeEach('provision check and clean up', function () {
        assertModuleProvisioned.call(this, 'gtm');
        return deleteDeclaration();
    });

    after('clean up', function () {
        return deleteDeclaration();
    });

    it('should create multiple domains sharing the same domain name', () => {
        const decl = {
            class: 'ADC',
            schemaVersion: '3.11.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    WIP_AAAA_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'AAAA',
                        domainName: 'wip.example.com'
                    },
                    WIP_A_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'A',
                        domainName: 'wip.example.com'
                    },
                    WIP_MX_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'MX',
                        domainName: 'wip.example.com'
                    },
                    WIP_CNAME_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'CNAME',
                        domainName: 'wip.example.com'
                    },
                    WIP_NAPTR_domain: {
                        class: 'GSLB_Domain',
                        resourceRecordType: 'NAPTR',
                        domainName: 'wip.example.com'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 0 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[1].code, 200);
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/a'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/aaaa'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/mx'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/cname'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => getPath('/mgmt/tm/gtm/wideip/naptr'))
            .then((response) => {
                assert.strictEqual(response.items[0].name, 'wip.example.com');
            })
            .then(() => assert.isFulfilled(
                postDeclaration(decl, { declarationIndex: 1 })
            ))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
                assert.strictEqual(response.results[1].code, 200);
                assert.strictEqual(response.results[1].message, 'no change');
            });
    });
});

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

const uuid = require('uuid');
const {
    assertClass,
    assertModuleProvisioned,
    getBigIpVersion,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');
const constants = require('../../../../src/lib/constants');
const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

const policyHost = `${process.env.TEST_RESOURCES_URL}`;

describe('Per Request Access Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    before(() => {
        validateEnvVars(['TEST_RESOURCES_URL']);
    });

    const tests = [
        {
            version: '13.1',
            cap: '14.0',
            policyName: 'perRequestPolicy131'
        },
        {
            version: '14.1',
            cap: '15.0',
            policyName: 'perRequestPolicy141'
        },
        {
            version: '15.1',
            cap: '16.0',
            policyName: 'perRequestPolicy151'
        },
        {
            version: '16.0',
            cap: '16.1',
            policyName: 'perRequestPolicy160'
        }
    ];

    const tenantName = 'TEST_Per_Request_Access_Policy';

    // We append a uuid and string to access profiles so we can find them later.
    // Subtract this length from the max item length
    const postfixLength = `_${uuid.v4()}_appsvcs`.length;
    const maxPathLength = constants.MAX_PATH_LENGTH - postfixLength;
    const options = {
        maxPathLength,
        mcpPath: `/${tenantName}/`
    };

    let accessToken;

    beforeEach(() => {
        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    it('Load from url object 13.1', function () {
        if (util.versionLessThan(getBigIpVersion(), '13.1') || !util.versionLessThan(getBigIpVersion(), '14.0')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'apm');

        const properties = [
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        const urlProperty = {
            name: 'url',
            inputValue: [{
                url: `https://${policyHost}/per-request-policy/perRequestPolicy131.tar`,
                skipCertificateCheck: true
            }],
            expectedValue: [`/${tenantName}/${getItemName({ tenantName, maxPathLength })}`],
            extractFunction: (o) => o.fullPath
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            urlProperty.inputValue[0].authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        properties.push(urlProperty);

        return assertClass('Per_Request_Access_Policy', properties, options);
    });

    tests.forEach((test) => {
        it(`Load .tar from url ${test.version}`, function () {
            if (util.versionLessThan(getBigIpVersion(), test.version)
            || !util.versionLessThan(getBigIpVersion(), test.cap)) {
                this.skip();
            }

            assertModuleProvisioned.call(this, 'apm');

            const properties = [
                {
                    name: 'ignoreChanges',
                    inputValue: [true],
                    skipAssert: true
                }
            ];

            const urlProperty = {
                name: 'url',
                inputValue: [{
                    url: `https://${policyHost}/per-request-policy/${test.policyName}.tar`
                }],
                expectedValue: [`/${tenantName}/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            };

            if (process.env.TEST_IN_AZURE === 'true') {
                urlProperty.inputValue[0].authentication = {
                    method: 'bearer-token',
                    token: accessToken
                };
            }

            properties.push(urlProperty);

            return assertClass('Per_Request_Access_Policy', properties, options);
        });

        it(`Load .tar.gz from url ${test.version}`, function () {
            if (util.versionLessThan(getBigIpVersion(), test.version)
            || !util.versionLessThan(getBigIpVersion(), test.cap)) {
                this.skip();
            }

            assertModuleProvisioned.call(this, 'apm');

            const properties = [
                {
                    name: 'ignoreChanges',
                    inputValue: [true],
                    skipAssert: true
                }
            ];

            const urlProperty = {
                name: 'url',
                inputValue: [{
                    url: `https://${policyHost}/per-request-policy/${test.policyName}.tar.gz`
                }],
                expectedValue: [`/${tenantName}/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            };

            if (process.env.TEST_IN_AZURE === 'true') {
                urlProperty.inputValue[0].authentication = {
                    method: 'bearer-token',
                    token: accessToken
                };
            }

            properties.push(urlProperty);

            return assertClass('Per_Request_Access_Policy', properties, options);
        });
    });
});

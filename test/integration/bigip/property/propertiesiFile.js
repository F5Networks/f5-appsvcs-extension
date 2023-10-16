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

const oauth = require('../../../common/oauth');
const {
    assertClass,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const { validateEnvVars } = require('../../../common/checkEnv');

const testResourcesURL = process.env.TEST_RESOURCES_URL;

describe('iFile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should create iFile with base64', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: ['An iFile'],
                expectedValue: ['An iFile'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'iFile',
                inputValue: [
                    {
                        base64: 'TG9vaywgYW4gaUZpbGUh'
                    }
                ],
                expectedValue: [`${getItemName({ tenantName: 'TEST_iFile' })}-ifile`],
                extractFunction: (o) => o.fileName.name
            }
        ];

        return assertClass('iFile', properties);
    });

    it('should create iFile with url', () => {
        validateEnvVars(['TEST_RESOURCES_URL']);

        const properties = [
            {
                name: 'iFile',
                inputValue: [
                    {
                        // BIG-IP allows any input data for the ifile so just used an existing file to create
                        url: {
                            url: `https://${testResourcesURL}/irule/rule_with_expansion`
                        }
                    }
                ],
                expectedValue: [`${getItemName({ tenantName: 'TEST_iFile' })}-ifile`],
                extractFunction: (o) => o.fileName.name
            }
        ];

        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    properties[0].inputValue[0].url.authentication = {
                        method: 'bearer-token',
                        token
                    };
                });
        }

        return assertClass('iFile', properties);
    });
});

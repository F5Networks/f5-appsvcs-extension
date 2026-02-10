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

const oauth = require('../../../common/oauth');
const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const { validateEnvVars } = require('../../../common/checkEnv');

describe('Data Group', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function createProperties(keyType, records) {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            },
            {
                name: 'keyDataType',
                inputValue: [keyType],
                skipAssert: true
            },
            {
                name: 'records',
                inputValue: [[]],
                skipAssert: true
            }
        ];

        function getDefault(value, defaultValue) {
            if (typeof value === 'undefined' || value === null) {
                return defaultValue;
            }
            return value;
        }

        records.forEach((record, i) => {
            properties.push({
                name: `records.${i}`,
                inputValue: [{}],
                skipAssert: true
            });
            properties.push({
                name: `records.${i}.key`,
                inputValue: [record.key],
                expectedValue: [getDefault(record.expectedKey, record.key)],
                extractFunction: (o) => o.records[i].name
            });
            properties.push({
                name: `records.${i}.value`,
                inputValue: [record.value],
                expectedValue: [getDefault(record.expectedValue, record.value)],
                extractFunction: (o) => o.records[i].data
            });
        });

        return properties;
    }

    it('String', () => {
        const properties = createProperties('string', [
            {
                key: 'l=da|c=dk|s=bsd',
                value: 'da-dk/work'
            },
            {
                key: 'Rufous',
                value: 'Selasphorus rufus;'
            }
        ]);
        return assertClass('Data_Group', properties);
    });

    it('Integer', () => {
        const properties = createProperties('integer', [
            {
                key: 1,
                value: 'take'
            },
            {
                key: 100,
                value: 'the -____- '
            },
            {
                key: 98765,
                value: '" c@nnoli "',
                expectedValue: ' c@nnoli '
            }
        ]);
        return assertClass('Data_Group', properties);
    });

    it('IP', () => {
        const properties = createProperties('ip', [
            {
                key: '2a02:a90:cccc::',
                expectedKey: '2a02:a90:cccc::/128',
                expectedValue: ''
            },
            {
                key: '10.1.0.0/24',
                value: ''
            },
            {
                key: '10.10.0.0/16',
                value: 'meringue'
            },
            {
                key: '10.10.1.1',
                expectedKey: '10.10.1.1/32',
                expectedValue: ''
            }
        ]);
        return assertClass('Data_Group', properties);
    });

    it('should handle removing a String Data_Group with port', () => {
        const properties = [
            {
                name: 'keyDataType',
                inputValue: ['string'],
                skipAssert: true
            },
            {
                name: 'records',
                inputValue: [
                    [{
                        key: 'example1.com:80'
                    }],
                    [{
                        key: 'example1.com:80'
                    }, {
                        key: 'example2.com:443'
                    }],
                    [{
                        key: 'example1.com:80'
                    }]
                ],
                expectedValue: [
                    ['example1.com:80'],
                    ['example1.com:80', 'example2.com:443'],
                    ['example1.com:80']
                ],
                extractFunction: (o) => o.records.map((r) => r.name)
            }
        ];

        return assertClass('Data_Group', properties);
    });

    describe('external file path', () => {
        before(() => {
            validateEnvVars(['TEST_RESOURCES_URL']);
        });

        it('should handle using externalFilePath to fetch from a URL string', function () {
            // Azure resources require auth
            if (process.env.TEST_IN_AZURE === 'true') {
                this.skip();
            }

            const properties = [
                {
                    name: 'storageType',
                    inputValue: ['external'],
                    skipAssert: true
                },
                {
                    name: 'keyDataType',
                    inputValue: ['string'],
                    skipAssert: true
                },
                {
                    name: 'externalFilePath',
                    inputValue: [`https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`],
                    expectedValue: [`https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`],
                    extractFunction: (o) => o.externalFileName.sourcePath
                },
                {
                    name: 'ignoreChanges',
                    inputValue: [true],
                    skipAssert: true
                }
            ];

            return assertClass('Data_Group', properties);
        });

        it('should handle using externalFilePath to fetch from a URL object', () => {
            let accessToken;
            if (process.env.TEST_IN_AZURE === 'true') {
                return oauth.getTokenForTest()
                    .then((token) => {
                        accessToken = token;
                    });
            }

            const properties = [
                {
                    name: 'storageType',
                    inputValue: ['external'],
                    skipAssert: true
                },
                {
                    name: 'keyDataType',
                    inputValue: ['string'],
                    skipAssert: true
                },
                {
                    name: 'ignoreChanges',
                    inputValue: [true],
                    skipAssert: true
                }
            ];

            const urlProperty = {
                name: 'externalFilePath',
                inputValue: [
                    {
                        url: `https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`,
                        skipCertificateCheck: true
                    }
                ],
                expectedValue: [`https://${process.env.TEST_RESOURCES_URL}/data-group/dataGroup.txt`],
                extractFunction: (o) => o.externalFileName.sourcePath
            };

            if (process.env.TEST_IN_AZURE === 'true') {
                urlProperty.inputValue[0].authentication = {
                    method: 'bearer-token',
                    token: accessToken
                };
            }

            properties.push(urlProperty);

            return assertClass('Data_Group', properties);
        });
    });
});

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

const {
    assertModuleProvisioned,
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const iRules = {
    encoded: {
        base64: 'IyBsZWFkaW5nIGNvbW1lbnQKd2hlbiBQRU1fUE9MSUNZIHsKICAgIFBFTTo6c2Vzc2lvbiBjcmVhdGUgMTkyLjAuMy4xMCBzdWJzY3JpYmVyLWlkIGExMjMgc3Vic2NyaWJlci10eXBlIGUxNjQKfQ=='
    },
    unencoded1: 'when PEM_POLICY {PEM::session create 192.0.2.10 subscriber-id a123 subscriber-type e164}',
    unencoded2: 'when PEM_POLICY {PEM::session create 192.0.3.10 subscriber-id a456 subscriber-type e164}'
};

const getPlainStringFromB64 = function (b64) {
    const str = Buffer.from(b64, 'base64').toString('ascii');
    return str.trim();
};

describe('PEM iRule', function () {
    this.timeout(GLOBAL_TIMEOUT);

    const configs = [
        {
            name: 'should create irule with correct text value',
            properties: [
                {
                    name: 'iRule',
                    inputValue: [iRules.unencoded1, iRules.unencoded2, iRules.unencoded1],
                    expectedValue: [iRules.unencoded1, iRules.unencoded2, iRules.unencoded1]
                }
            ]
        },
        {
            name: 'should create irule with correct text value from base64',
            properties: [
                {
                    name: 'iRule',
                    inputValue: [iRules.encoded],
                    expectedValue: [getPlainStringFromB64(iRules.encoded.base64)]
                }
            ]
        }
    ];

    configs.forEach((config) => it(config.name, function () {
        assertModuleProvisioned.call(this, 'pem');

        return assertClass('Enforcement_iRule', config.properties);
    }));
});

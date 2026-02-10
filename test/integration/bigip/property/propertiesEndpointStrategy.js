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

const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Endpoint_Strategy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEndpointStrategyClass(properties) {
        return assertClass('Endpoint_Strategy', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'matchMethod',
                inputValue: ['all-match', 'best-match', 'all-match'],
                expectedValue: ['all-match', 'best-match', 'all-match']
            },
            {
                name: 'operands',
                inputValue: [[], ['geoip request countryCode'], undefined],
                expectedValue: [false, true, false],
                extractFunction: (strategy) => {
                    const operand = strategy.operands[0];
                    if (!operand) return false;
                    if (!operand.geoip) return false;
                    if (!operand.request) return false;
                    if (!operand.countryCode) return false;
                    return true;
                }
            }
        ];
        return assertEndpointStrategyClass(properties);
    });
});

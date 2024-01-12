/**
 * Copyright 2024 F5, Inc.
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

describe('Enforcement_Service_Chain_Endpoint', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementServiceChainEndpointClass(properties) {
        return assertClass('Enforcement_Service_Chain_Endpoint', properties);
    }

    // TODO: Add serviceEndpoints objects if we ever support creating vlans
    // TODO: Remove skip when serviceEndpoints test implemented
    it.skip('All properties', function () {
        const properties = [
            {
                name: 'serviceEndpoints',
                inputValue: [
                    undefined,
                    undefined,
                    undefined
                ],
                expectedValue: [
                    undefined,
                    undefined,
                    undefined
                ],
                extractFunction: () => undefined
            }
        ];
        return assertEnforcementServiceChainEndpointClass(properties);
    });
});

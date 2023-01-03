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

const {
    assertClass,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Enforcement_Interception_Endpoint', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementInterceptionEndpointClass(properties) {
        return assertClass('Enforcement_Interception_Endpoint', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        const properties = [
            {
                name: 'persistence',
                inputValue: [undefined, 'source-ip', undefined],
                expectedValue: ['disabled', 'source-ip', 'disabled']
            },
            {
                name: 'pool',
                inputValue: [
                    {
                        use: 'thePool1'
                    },
                    {
                        use: 'thePool2'
                    },
                    {
                        use: 'thePool1'
                    }
                ],
                expectedValue: ['thePool1', 'thePool2', 'thePool1'],
                referenceObjects: {
                    thePool1: {
                        class: 'Pool'
                    },
                    thePool2: {
                        class: 'Pool'
                    }
                },
                extractFunction: (o) => o.pool.name
            }
        ];
        return assertEnforcementInterceptionEndpointClass(properties);
    });
});

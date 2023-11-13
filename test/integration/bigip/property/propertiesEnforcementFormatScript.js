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
    assertClass,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Enforcement_Format_Script', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementFormatScriptClass(properties) {
        return assertClass('Enforcement_Format_Script', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'definition',
                inputValue: [undefined, 'set theString \\"some string\\"', undefined],
                expectedValue: ['none', 'set theString \\"some string\\"', 'none'],
                extractFunction: (o) => o.definition || 'none'
            }
        ];
        return assertEnforcementFormatScriptClass(properties);
    });
});

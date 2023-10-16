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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Idle_Timeout_Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertIdleTimeoutPolicyClass(properties) {
        return assertClass('Idle_Timeout_Policy', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'rules',
                inputValue: [[]],
                skipAssert: true
            },
            {
                name: 'rules.0',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'rules.0.name',
                inputValue: ['myName'],
                expectedValue: ['myName']
            },
            {
                name: 'rules.0.remark',
                inputValue: [undefined, 'rule0 description', undefined],
                expectedValue: ['none', 'rule0 description', 'none'],
                extractFunction: (o) => o.rules[0].description || 'none'
            },
            {
                name: 'rules.0.protocol',
                inputValue: [undefined, 'tcp', 'udp', undefined],
                expectedValue: ['all-other', 'tcp', 'udp', 'all-other']
            },
            {
                name: 'rules.0.destinationPorts',
                inputValue: [undefined, [443, '50000-50020'], ['all-other'], undefined],
                expectedValue: [undefined, [{ name: '443' }, { name: '50000-50020' }], [{ name: '0' }], undefined],
                extractFunction: (o) => o.rules[0].destinationPorts
            },
            {
                name: 'rules.0.idleTimeout',
                inputValue: [undefined, 100, 'indefinite', undefined],
                expectedValue: ['unspecified', 100, 'indefinite', 'unspecified'],
                extractFunction: (o) => o.rules[0].timers[0].value
            }
        ];
        return assertIdleTimeoutPolicyClass(properties);
    });
});

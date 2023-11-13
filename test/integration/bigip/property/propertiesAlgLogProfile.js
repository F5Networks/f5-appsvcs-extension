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

describe('ALG_Log_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it.skip('All properties response', function () {
        assertModuleProvisioned.call(this, 'cgnat');

        function extractResults(o, property) {
            const exp = {};
            exp.action = o[property].action;
            if (property !== 'inboundTransaction') {
                if (typeof o[property].elements === 'undefined') {
                    exp.includeDestination = false;
                } else if (Array.isArray(o[property].elements)) {
                    exp.includeDestination = o[property].elements.indexOf('destination') !== -1;
                }
            }
            return JSON.stringify(exp);
        }

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            },
            {
                name: 'csvFormat',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'startControlChannel',
                inputValue: [undefined, { action: 'enabled', includeDestination: true }, undefined],
                expectedValue: [
                    JSON.stringify({ action: 'disabled', includeDestination: false }),
                    JSON.stringify({ action: 'enabled', includeDestination: true }),
                    JSON.stringify({ action: 'disabled', includeDestination: false })
                ],
                extractFunction: (o) => extractResults(o, 'startControlChannel')
            },
            {
                name: 'endControlChannel',
                inputValue: [undefined, { action: 'disabled', includeDestination: true }, undefined],
                expectedValue: [
                    JSON.stringify({ action: 'enabled', includeDestination: false }),
                    JSON.stringify({ action: 'disabled', includeDestination: true }),
                    JSON.stringify({ action: 'enabled', includeDestination: false })
                ],
                extractFunction: (o) => extractResults(o, 'endControlChannel')
            },
            {
                name: 'startDataChannel',
                inputValue: [undefined, { action: 'enabled', includeDestination: true }, undefined],
                expectedValue: [
                    JSON.stringify({ action: 'disabled', includeDestination: false }),
                    JSON.stringify({ action: 'enabled', includeDestination: true }),
                    JSON.stringify({ action: 'disabled', includeDestination: false })
                ],
                extractFunction: (o) => extractResults(o, 'startDataChannel')
            },
            {
                name: 'endDataChannel',
                inputValue: [undefined, { action: 'disabled', includeDestination: true }, undefined],
                expectedValue: [
                    JSON.stringify({ action: 'enabled', includeDestination: false }),
                    JSON.stringify({ action: 'disabled', includeDestination: true }),
                    JSON.stringify({ action: 'enabled', includeDestination: false })
                ],
                extractFunction: (o) => extractResults(o, 'endDataChannel')
            },
            {
                name: 'inboundTransaction',
                inputValue: [undefined, { action: 'enabled' }, undefined],
                expectedValue: [
                    JSON.stringify({ action: 'disabled' }),
                    JSON.stringify({ action: 'enabled' }),
                    JSON.stringify({ action: 'disabled' })
                ],
                extractFunction: (o) => extractResults(o, 'inboundTransaction')
            }
        ];

        return assertClass('ALG_Log_Profile', properties);
    });
});

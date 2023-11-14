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

describe('Classification_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertClassificationProfileClass(properties) {
        return assertClass('Classification_Profile', properties);
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
                name: 'parentProfile',
                inputValue: [undefined, { bigip: '/Common/classification_apm_swg' }, undefined],
                expectedValue: ['classification', 'classification_apm_swg', 'classification'],
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'appDetectionEnabled',
                inputValue: [undefined, false, true],
                expectedValue: ['on', 'off', 'on']
            },
            {
                name: 'urlCategorizationEnabled',
                inputValue: [undefined, true, false],
                expectedValue: ['off', 'on', 'off']
            },
            {
                name: 'iRuleEventEnabled',
                inputValue: [undefined, true, false],
                expectedValue: ['off', 'on', 'off']
            },
            {
                name: 'logPublisher',
                inputValue: [undefined, { bigip: '/Common/default-ipsec-log-publisher' }, undefined],
                expectedValue: ['none', '/Common/default-ipsec-log-publisher', 'none'],
                extractFunction: (o) => o.logPublisher.fullPath || o.logPublisher
            },
            {
                name: 'logUnclassifiedDomain',
                inputValue: [undefined, true, false],
                expectedValue: ['off', 'on', 'off']
            },
            {
                name: 'preset',
                inputValue: [undefined, { bigip: '/Common/ce_apm_swg' }, undefined],
                expectedValue: ['/Common/ce', '/Common/ce_apm_swg', '/Common/ce'],
                extractFunction: (o) => o.preset.fullPath
            },
            {
                name: 'statisticsCollectionEnabled',
                inputValue: [undefined, true, false],
                expectedValue: ['off', 'on', 'off']
            },
            {
                name: 'statisticsPublisher',
                inputValue: [undefined, { bigip: '/Common/default-ipsec-log-publisher' }, undefined],
                expectedValue: ['none', '/Common/default-ipsec-log-publisher', 'none'],
                extractFunction: (o) => o.avrPublisher.fullPath || o.avrPublisher
            }
        ];
        return assertClassificationProfileClass(properties);
    });
});

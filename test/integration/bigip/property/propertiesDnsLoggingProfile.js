/**
 * Copyright 2022 F5 Networks, Inc.
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

describe('DNS_Logging_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertDnsLoggingProfileClass(properties) {
        return assertClass('DNS_Logging_Profile', properties);
    }

    it('All properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'sample remark', undefined],
                expectedValue: ['none', 'sample remark', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'includeCompleteAnswer',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'includeQueryId',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            },
            {
                name: 'includeSource',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'includeTimestamp',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'includeView',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'logPublisher',
                inputValue: [
                    { bigip: '/Common/local-db-publisher' },
                    { bigip: '/Common/sys-db-access-publisher' },
                    { bigip: '/Common/local-db-publisher' }
                ],
                expectedValue: [
                    '/Common/local-db-publisher',
                    '/Common/sys-db-access-publisher',
                    '/Common/local-db-publisher'
                ],
                extractFunction: (object) => {
                    if (!object.logPublisher || object.logPublisher === 'none') return 'none';
                    return object.logPublisher.fullPath;
                }
            },
            {
                name: 'logQueriesEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'logResponsesEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no']
            }
        ];
        return assertDnsLoggingProfileClass(properties);
    });
});

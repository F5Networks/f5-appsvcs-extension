/**
 * Copyright 2025 F5, Inc.
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

describe('IP_Other_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertIpOtherProfileClass(properties) {
        return assertClass('IP_Other_Profile', properties);
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
                name: 'parentProfile',
                inputValue: [
                    undefined,
                    {
                        use: 'ipothProf'
                    },
                    undefined
                ],
                expectedValue: ['ipother', 'ipothProf', 'ipother'],
                referenceObjects: {
                    ipothProf: {
                        class: 'IP_Other_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'idleTimeout',
                inputValue: [undefined, 'indefinite', undefined],
                expectedValue: [60, 'indefinite', 60]
            }
        ];
        return assertIpOtherProfileClass(properties);
    });
});

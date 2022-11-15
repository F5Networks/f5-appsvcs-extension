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

describe('Statistics_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertStatisticsProfile(properties) {
        return assertClass('Statistics_Profile', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'This is a description', undefined],
                expectedValue: ['none', 'This is a description', 'none'],
                extractFunction: (o) => o.description || 'none'
            }
        ];
        for (let i = 1; i < 33; i += 1) {
            properties.push({
                name: `field${i}`,
                inputValue: [undefined, `field ${i}`, undefined],
                expectedValue: ['none', `field ${i}`, 'none']
            });
        }
        return assertStatisticsProfile(properties);
    });
});

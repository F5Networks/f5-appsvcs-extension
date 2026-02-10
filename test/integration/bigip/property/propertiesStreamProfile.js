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

describe('Stream_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertStreamProfile(properties) {
        return assertClass('Stream_Profile', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'Description', undefined],
                expectedValue: ['none', 'Description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'chunkingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'chunkSize',
                inputValue: [undefined, 12000, undefined],
                expectedValue: [4096, 12000, 4096]
            },
            {
                name: 'source',
                inputValue: [undefined, 'The source', undefined],
                expectedValue: ['none', 'The source', 'none'],
                extractFunction: (o) => o.source || 'none'
            },
            {
                name: 'target',
                inputValue: [undefined, 'The target', undefined],
                expectedValue: ['none', 'The target', 'none'],
                extractFunction: (o) => o.tmTarget || 'none'
            }
        ];
        return assertStreamProfile(properties);
    });
});

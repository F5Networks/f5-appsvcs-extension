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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Adapt_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All properties response', function () {
        const properties = [
            {
                name: 'messageType',
                inputValue: ['response'],
                skipAssert: true
            },
            {
                name: 'enableHttpAdaptation',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'internalService',
                inputValue: [
                    undefined,
                    {
                        use: 'theService'
                    },
                    undefined
                ],
                expectedValue: ['none', 'theService', 'none'],
                referenceObjects: {
                    theService: {
                        class: 'Service_TCP',
                        virtualType: 'internal'
                    }
                },
                extractFunction: (o) => {
                    const result = o.internalVirtual && o.internalVirtual.name ? o.internalVirtual.name : 'none';
                    return result;
                }
            },
            {
                name: 'previewSize',
                inputValue: [undefined, 12345, undefined],
                expectedValue: [1024, 12345, 1024]
            },
            {
                name: 'serviceDownAction',
                inputValue: [undefined, 'reset', undefined],
                expectedValue: ['ignore', 'reset', 'ignore']
            },
            {
                name: 'timeout',
                inputValue: [undefined, 123456, undefined],
                expectedValue: [0, 123456, 0]
            },
            {
                name: 'allowHTTP10',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no'],
                extractFunction: (o) => o.allowHttp_10
            }
        ];

        return assertClass('Adapt_Profile', properties);
    });

    it('All properties request', function () {
        const properties = [
            {
                name: 'messageType',
                inputValue: ['request'],
                skipAssert: true
            },
            {
                name: 'enableHttpAdaptation',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            },
            {
                name: 'internalService',
                inputValue: [
                    undefined,
                    {
                        use: 'theService'
                    },
                    undefined
                ],
                expectedValue: ['none', 'theService', 'none'],
                referenceObjects: {
                    theService: {
                        class: 'Service_TCP',
                        virtualType: 'internal'
                    }
                },
                extractFunction: (o) => {
                    const result = o.internalVirtual && o.internalVirtual.name ? o.internalVirtual.name : 'none';
                    return result;
                }
            },
            {
                name: 'previewSize',
                inputValue: [undefined, 12345, undefined],
                expectedValue: [1024, 12345, 1024]
            },
            {
                name: 'serviceDownAction',
                inputValue: [undefined, 'reset', undefined],
                expectedValue: ['ignore', 'reset', 'ignore']
            },
            {
                name: 'timeout',
                inputValue: [undefined, 123456, undefined],
                expectedValue: [0, 123456, 0]
            },
            {
                name: 'allowHTTP10',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no'],
                extractFunction: (o) => o.allowHttp_10
            }
        ];

        return assertClass('Adapt_Profile', properties);
    });
});

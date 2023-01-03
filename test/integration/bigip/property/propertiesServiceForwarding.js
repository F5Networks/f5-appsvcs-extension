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
    extractProfile,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Service_Forwarding', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('with Service_Forwarding specific properties', function () {
        const properties = [
            {
                name: 'virtualPort',
                inputValue: [8080],
                skipAssert: true
            },
            {
                name: 'virtualAddresses',
                inputValue: [['192.0.2.100']],
                skipAssert: true
            },
            {
                name: 'forwardingType',
                inputValue: ['ip', 'l2', 'ip'],
                expectedValue: [true],
                extractFunction: (o) => (o.ipForward === undefined && o.l2Forward === true)
                    || (o.ipForward === true && o.l2Forward === undefined)
            },
            {
                name: 'layer4',
                inputValue: [undefined, 'tcp', undefined],
                expectedValue: ['any', 'tcp', 'any']
            },
            {
                name: 'profileL4',
                inputValue: [undefined, { bigip: '/Common/apm-forwarding-fastL4' }, undefined],
                expectedValue: [undefined, 'apm-forwarding-fastL4', undefined],
                extractFunction: (virtual) => extractProfile(virtual, 'apm-forwarding-fastL4')
            },
            {
                name: 'translateServerAddress',
                inputValue: [undefined, false, undefined],
                expectedValue: ['disabled']
            },
            {
                name: 'translateServerPort',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];
        return assertClass('Service_Forwarding', properties);
    });
});

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
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

describe('Enforcement_Diameter_Endpoint_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertEnforcementDiameterEndpointProfileClass(properties) {
        return assertClass('Enforcement_Diameter_Endpoint_Profile', properties);
    }

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'pem');

        let protocolProfileDefault = '_sys_gx_proto_default';
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            protocolProfileDefault = '_sys_diam_proto_default';
        }

        const properties = [
            {
                name: 'parentProfile',
                inputValue: [
                    undefined,
                    {
                        use: 'diamProf'
                    },
                    undefined
                ],
                expectedValue: ['diameter-endpoint', 'diamProf', 'diameter-endpoint'],
                referenceObjects: {
                    diamProf: {
                        class: 'Enforcement_Diameter_Endpoint_Profile',
                        supportedApps: [
                            'Gy'
                        ]
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'destinationHost',
                inputValue: [undefined, 'pcrfdest.net.com', undefined],
                expectedValue: ['none', 'pcrfdest.net.com', 'none'],
                extractFunction: (o) => o.destinationHost || 'none'
            },
            {
                name: 'destinationRealm',
                inputValue: [undefined, 'net.com', undefined],
                expectedValue: ['none', 'net.com', 'none'],
                extractFunction: (o) => o.destinationRealm || 'none'
            },
            {
                name: 'fatalGraceTime',
                inputValue: [undefined, 120, undefined],
                expectedValue: [500, 120, 500],
                extractFunction: (o) => o.fatalGraceTime.time
            },
            {
                name: 'messageMaxRetransmits',
                inputValue: [undefined, 5, undefined],
                expectedValue: [2, 5, 2]
            },
            {
                name: 'messageRetransmitDelay',
                inputValue: [undefined, 1200, undefined],
                expectedValue: [1500, 1200, 1500]
            },
            {
                name: 'originHost',
                inputValue: [undefined, 'pcrf.xnet.com', undefined],
                expectedValue: ['none', 'pcrf.xnet.com', 'none'],
                extractFunction: (o) => o.originHost || 'none'
            },
            {
                name: 'originRealm',
                inputValue: [undefined, 'xnet.com', undefined],
                expectedValue: ['none', 'xnet.com', 'none'],
                extractFunction: (o) => o.originRealm || 'none'
            },
            {
                name: 'protocolProfileGx',
                inputValue: [
                    undefined,
                    {
                        bigip: `/Common/${protocolProfileDefault}`
                    },
                    undefined
                ],
                expectedValue: [undefined, protocolProfileDefault, undefined],
                extractFunction: (o) => {
                    const result = (o.pemProtocolProfileGx) ? o.pemProtocolProfileGx.name : undefined;
                    return result;
                }
            },
            {
                name: 'productName',
                inputValue: [undefined, 'Big-IP', undefined],
                expectedValue: ['BIG-IP', 'Big-IP', 'BIG-IP']
            },
            {
                name: 'supportedApps',
                inputValue: [
                    ['Gx'],
                    ['Sd'],
                    ['Gx']
                ],
                expectedValue: [
                    ['Gx'],
                    ['Sd'],
                    ['Gx']
                ]
            }
        ];
        return assertEnforcementDiameterEndpointProfileClass(properties);
    });
});

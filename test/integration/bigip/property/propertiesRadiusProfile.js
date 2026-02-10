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
    assertModuleProvisioned,
    getProvisionedModules,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('Radius_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertRadiusProfileClass(properties) {
        return assertClass('Radius_Profile', properties);
    }

    const extractFunctions = {
        protocolProfile(result) {
            // returned from iControl varies per version
            let val;
            if (result.pemProtocolProfileRadius === 'none') {
                val = undefined;
            } else {
                val = result.pemProtocolProfileRadius.name;
            }
            return val;
        },
        persistAttribute(result) {
            // returned from iControl varies per version
            let val = result.persistAvp;
            if (result.persistAvp === 'none') {
                val = undefined;
            }
            return val;
        }
    };

    it('All properties', function () {
        assertModuleProvisioned.call(this, 'afm');
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
                inputValue: [
                    undefined,
                    {
                        use: 'radProf'
                    },
                    undefined
                ],
                expectedValue: ['radiusLB', 'radProf', 'radiusLB'],
                referenceObjects: {
                    radProf: {
                        class: 'Radius_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'persistAttribute',
                inputValue: [undefined, 5, undefined],
                expectedValue: [undefined, 5, undefined],
                extractFunction: extractFunctions.persistAttribute
            }
        ];

        if (getProvisionedModules().includes('pem') || getProvisionedModules().includes('afm')) {
            properties.push({
                name: 'protocolProfile',
                inputValue: [
                    undefined,
                    {
                        bigip: '/Common/_sys_radius_proto_all'
                    },
                    undefined
                ],
                expectedValue: [
                    '_sys_radius_proto_imsi',
                    '_sys_radius_proto_all',
                    '_sys_radius_proto_imsi'
                ],
                extractFunction: extractFunctions.protocolProfile
            });
            properties.push({
                name: 'subscriberDiscoveryEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            });
        }

        return assertRadiusProfileClass(properties);
    });
});

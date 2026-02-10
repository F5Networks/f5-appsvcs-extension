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

describe('Connector_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All properties', () => {
        const tenantName = 'Tenant';
        const applicationName = 'Application';

        const options = {
            tenantName,
            applicationName
        };

        const properties = [
            {
                name: 'entryVirtualServer',
                inputValue: [{ use: 'theService' }],
                expectedValue: [`/${tenantName}/${applicationName}/theService`],
                extractFunction: (o) => o.entryVirtualServer.fullPath,
                referenceObjects: {
                    theService: {
                        class: 'Service_TCP',
                        virtualType: 'internal',
                        profileService: {
                            use: 'serviceProfile'
                        },
                        profileSplitsessionClient: {
                            use: 'splitsessionClientProfile'
                        }
                    },
                    serviceProfile: {
                        class: 'Service_Profile'
                    },
                    splitsessionClientProfile: {
                        class: 'Splitsession_Client_Profile',
                        peerPort: 80,
                        peerIp: '192.0.2.1'
                    }
                }
            },
            {
                name: 'connectionTimeout',
                inputValue: [undefined, 600, 1800],
                expectedValue: [0, 600, 1800]
            },
            {
                name: 'serviceDownAction',
                inputValue: [undefined, 'drop', 'reset'],
                expectedValue: ['ignore', 'drop', 'reset']
            },
            {
                name: 'connectOnData',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                minVersion: '16.0'
            }
        ];
        return assertClass('Connector_Profile', properties, options);
    });
});

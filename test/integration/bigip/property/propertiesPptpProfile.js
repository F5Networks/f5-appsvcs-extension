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

const extractFunctions = {
    profilePPTPPublisherName(result) {
        const pptpProfile = result.publisherName;
        return pptpProfile ? pptpProfile.fullPath : 'none';
    }
};

describe('PPTP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All properties', () => {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/profile/pptp',
                    data: {
                        name: 'pptpProf',
                        partition: 'Common'
                    }
                }
            ]
        };
        const properties = [
            {
                name: 'remark',
                inputValue: ['Application', 'description', 'Application'],
                expectedValue: ['Application', 'description', 'Application'],
                extractFunction: (o) => o.description || 'Application'
            },
            {
                name: 'csvFormat',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'includeDestinationIp',
                inputValue: [undefined, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'parentProfile',
                inputValue: [undefined, {
                    bigip: '/Common/pptpProf'
                }, undefined],
                expectedValue: ['pptp', 'pptpProf', 'pptp'],
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'publisherName',
                inputValue: [undefined, {
                    bigip: '/Common/local-db-publisher'
                }, undefined],
                expectedValue: [undefined, '/Common/local-db-publisher', undefined],
                extractFunction: extractFunctions.profilePPTPPublisherName
            }
        ];
        return assertClass('PPTP_Profile', properties, options);
    });
});

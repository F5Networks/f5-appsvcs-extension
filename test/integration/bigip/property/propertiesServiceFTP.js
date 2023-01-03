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

const extractFunctions = {
    profileFTP(result) {
        const ftpProfile = result.profiles.find((r) => r.name.includes('ftp'));
        return ftpProfile.fullPath;
    }
};

describe('Service_TCP', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('with profileFTP', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['Application', 'description', 'Application'],
                extractFunction: (o) => o.description || 'Application'
            },
            {
                name: 'virtualPort',
                inputValue: [8080],
                expectedValue: ['8080'],
                extractFunction: (o) => o.destination.split(':')[1]
            },
            {
                name: 'virtualAddresses',
                inputValue: [['1.1.1.10']],
                expectedValue: ['1.1.1.10'],
                extractFunction: (o) => o.destination.split(':')[0].split('/')[2]
            },
            {
                name: 'profileFTP',
                inputValue: [
                    { bigip: '/Common/ftp' },
                    { use: 'ftp_test' },
                    { bigip: '/Common/ftp' }
                ],
                expectedValue: [
                    '/Common/ftp',
                    '/TEST_Service_TCP/Application/ftp_test',
                    '/Common/ftp'
                ],
                extractFunction: extractFunctions.profileFTP,
                referenceObjects: {
                    ftp_test: {
                        port: 20,
                        class: 'FTP_Profile'
                    }
                }
            }
        ];
        return assertClass('Service_TCP', properties);
    });
});

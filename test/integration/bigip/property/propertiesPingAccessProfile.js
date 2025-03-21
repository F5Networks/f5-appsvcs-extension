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

describe('Ping_Access_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertPingAccessProfile(properties) {
        return assertClass('Ping_Access_Profile', properties);
    }

    it('All properties', function () {
        const properties = [
            {
                name: 'pingAccessProperties',
                inputValue: [
                    {
                        use: 'theService0'
                    }],
                expectedValue: ['/TEST_Ping_Access_Profile/Application/theService0'],
                extractFunction: (o) => ((typeof o.pingAccessProperties === 'object') ? o.pingAccessProperties.fullPath : o.pingAccessProperties),
                referenceObjects: {
                    theService0: {
                        class: 'Ping_Access_Agent_Properties',
                        propertiesData: {
                            base64: 'YWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uc2NoZW1lPWh0dHAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uaG9zdD0xLjEuMS4xCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnBvcnQ9OTAwOQphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi51c2VybmFtZT1GNVRlc3RBZ2VudAphZ2VudC5zc2wucHJvdG9jb2xzPVRMU3YxLjEsIFRMU3YxLjIKYWdlbnQuc3NsLmNpcGhlcnM9VExTX0VDREhFX0VDRFNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhFX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBLFRMU19FQ0RIRV9FQ0RTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESEVfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0RIRV9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX1JTQV9XSVRIX0FFU18xMjhfR0NNX1NIQTI1NixUTFNfUlNBX1dJVEhfQUVTXzEyOF9DQkNfU0hBMjU2LFRMU19SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfUlNBX1dJVEhfQUVTXzEyOF9HQ01fU0hBMjU2LFRMU19FQ0RIX1JTQV9XSVRIX0FFU18xMjhfQ0JDX1NIQTI1NixUTFNfRUNESF9SU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0dDTV9TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEyNTYsVExTX0VDREhfRUNEU0FfV0lUSF9BRVNfMTI4X0NCQ19TSEEsVExTX0VNUFRZX1JFTkVHT1RJQVRJT05fSU5GT19TQ1NWCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLnNoYXJlZC5zZWNyZXQ9c2VjcmV0LWhlcmUKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uYm9vdHN0cmFwLnRydXN0c3RvcmU9c29tZS1iYXNlNjQtY29udGVudC1oZXJlIAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5tYXhDb25uZWN0aW9ucz0xMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi50aW1lb3V0PTMwMDAwCmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmNvbm5lY3RUaW1lb3V0PTMwMDAwCmFnZW50LmNhY2hlLm1pc3NJbml0aWFsVGltZW91dD01CmFnZW50LmNhY2hlLmJyb2tlci5wdWJsaXNoZXJQb3J0PTMwMzEKYWdlbnQuY2FjaGUuYnJva2VyLnN1YnNjcmliZXJQb3J0PTMwMzIKYWdlbnQuY2FjaGUubWF4VG9rZW5zPTAKYWdlbnQuZW5naW5lLmNvbmZpZ3VyYXRpb24uZmFpbG92ZXIuaG9zdHM9CmFnZW50LmVuZ2luZS5jb25maWd1cmF0aW9uLmZhaWxvdmVyLmZhaWxlZFJldHJ5VGltZW91dD02MDAwMAphZ2VudC5lbmdpbmUuY29uZmlndXJhdGlvbi5mYWlsb3Zlci5tYXhSZXRyaWVzPTI='
                        },
                        ignoreChanges: true
                    }
                }
            },
            {
                name: 'pool',
                inputValue: [
                    {
                        use: 'theService1'
                    }],
                expectedValue: ['/TEST_Ping_Access_Profile/Application/theService1'],
                extractFunction: (o) => ((typeof o.pool === 'object') ? o.pool.fullPath : o.pool),
                referenceObjects: {
                    theService1: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.4'
                                ],
                                metadata: {
                                    example: {
                                        value: 'test'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            {
                name: 'useHTTPS',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'serversslProfile',
                inputValue: [
                    {
                        use: 'theService2'
                    }],
                expectedValue: ['undefined', '/TEST_Ping_Access_Profile/Application/theService2', 'undefined'],
                extractFunction: (o) => ((typeof o.serversslProfile === 'object') ? o.serversslProfile.fullPath : o.serversslProfile),
                referenceObjects: {
                    theService2: {
                        class: 'TLS_Client',
                        trustCA: {
                            bigip: '/Common/default.crt'
                        }
                    }
                }
            }
        ];

        return assertPingAccessProfile(properties);
    });
});

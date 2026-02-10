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

describe('FIX_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertFixProfileClass(properties, options) {
        return assertClass('FIX_Profile', properties, options);
    }

    it('All properties', function () {
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
                        use: 'fixProf'
                    },
                    undefined
                ],
                expectedValue: ['fix', 'fixProf', 'fix'],
                referenceObjects: {
                    fixProf: {
                        class: 'FIX_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'errorAction',
                inputValue: [undefined, 'drop-connection', undefined],
                expectedValue: ['dont-forward', 'drop-connection', 'dont-forward']
            },
            {
                name: 'fullLogonParsingEnabled',
                inputValue: [undefined, false, undefined],
                expectedValue: ['true', 'false', 'true']
            },
            {
                name: 'messageLogPublisher',
                inputValue: [
                    undefined,
                    {
                        use: 'logPub'
                    },
                    undefined
                ],
                expectedValue: [undefined, 'logPub', undefined],
                referenceObjects: {
                    logPub: {
                        class: 'Log_Publisher',
                        destinations: [
                            {
                                use: 'logDestSys'
                            }
                        ]
                    },
                    logDestSys: {
                        class: 'Log_Destination',
                        type: 'remote-syslog',
                        remoteHighSpeedLog: {
                            use: 'logDestHighSpeed'
                        }
                    },
                    logDestHighSpeed: {
                        class: 'Log_Destination',
                        type: 'remote-high-speed-log',
                        pool: {
                            use: 'thePool'
                        }
                    },
                    thePool: {
                        class: 'Pool'
                    }
                },
                extractFunction: (o) => (o.messageLogPublisher ? o.messageLogPublisher.name : undefined)
            },
            {
                name: 'reportLogPublisher',
                inputValue: [
                    undefined,
                    {
                        use: 'logPub'
                    },
                    undefined
                ],
                expectedValue: [undefined, 'logPub', undefined],
                extractFunction: (o) => (o.reportLogPublisher ? o.reportLogPublisher.name : undefined)
            },
            {
                name: 'quickParsingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'responseParsingEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['false', 'true', 'false']
            },
            {
                name: 'statisticsSampleInterval',
                inputValue: [undefined, 1000, undefined],
                expectedValue: [20, 1000, 20]
            },
            {
                name: 'senderTagMappingList',
                inputValue: [
                    undefined,
                    [
                        {
                            senderId: 'theId',
                            tagDataGroup: {
                                use: 'theDG'
                            }
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            senderId: 'theId',
                            tagMapClass: '/TEST_FIX_Profile/Application/theDG'
                        }
                    ],
                    []
                ],
                referenceObjects: {
                    theDG: {
                        class: 'Data_Group',
                        keyDataType: 'integer',
                        records: [
                            {
                                key: 10,
                                value: 'value'
                            }
                        ]
                    }
                },
                extractFunction: (o) => o.senderTagClass || []
            }
        ];
        return assertFixProfileClass(properties);
    });

    it('should handle various types of Data_Group references', () => {
        const properties = [
            {
                name: 'errorAction',
                inputValue: ['drop-connection'],
                expectedValue: ['drop-connection']
            },
            {
                name: 'fullLogonParsingEnabled',
                inputValue: [false],
                expectedValue: ['false']
            },
            {
                name: 'messageLogPublisher',
                inputValue: [
                    {
                        bigip: '/Common/local-db-publisher'
                    }
                ],
                expectedValue: ['local-db-publisher'],
                extractFunction: (o) => (o.messageLogPublisher ? o.messageLogPublisher.name : undefined)
            },
            {
                name: 'reportLogPublisher',
                inputValue: [
                    {
                        bigip: '/Common/local-db-publisher'
                    }
                ],
                expectedValue: ['local-db-publisher'],
                extractFunction: (o) => (o.reportLogPublisher ? o.reportLogPublisher.name : undefined)
            },
            {
                name: 'quickParsingEnabled',
                inputValue: [true],
                expectedValue: ['true']
            },
            {
                name: 'responseParsingEnabled',
                inputValue: [true],
                expectedValue: ['true']
            },
            {
                name: 'statisticsSampleInterval',
                inputValue: [45],
                expectedValue: [45]
            },
            {
                name: 'senderTagMappingList',
                inputValue: [
                    [
                        {
                            senderId: 'ExistingInternalDG',
                            tagDataGroup: {
                                bigip: '/Common/testInternalDG'
                            }
                        },
                        {
                            senderId: 'ExistingExternalDG',
                            tagDataGroup: {
                                bigip: '/Common/testExternalDG',
                                isExternal: true
                            }
                        },
                        {
                            senderId: 'RefInternalDG',
                            tagDataGroup: {
                                use: 'dataGroupRefInternal'
                            }
                        },
                        {
                            senderId: 'RefExternalDG',
                            tagDataGroup: {
                                use: 'dataGroupRefExternal'
                            }
                        },
                        {
                            senderId: 'RefExternalDGFile',
                            tagDataGroup: {
                                use: 'dataGroupRefExistingFileNoDG'
                            }
                        }
                    ]
                ],
                expectedValue: [
                    [
                        {
                            senderId: 'ExistingInternalDG',
                            tagMapClass: '/Common/testInternalDG'
                        },
                        {
                            senderId: 'ExistingExternalDG',
                            tagMapClass: '/Common/testExternalDG'
                        },
                        {
                            senderId: 'RefInternalDG',
                            tagMapClass: '/TEST_FIX_Profile/Application/dataGroupRefInternal'
                        },
                        {
                            senderId: 'RefExternalDG',
                            tagMapClass: '/TEST_FIX_Profile/Application/dataGroupRefExternal'
                        },
                        {
                            senderId: 'RefExternalDGFile',
                            tagMapClass: '/TEST_FIX_Profile/Application/dataGroupRefExistingFileNoDG'
                        }
                    ]
                ],
                referenceObjects: {
                    dataGroupRefInternal: {
                        class: 'Data_Group',
                        label: 'Tag values mapping',
                        storageType: 'internal',
                        name: 'Internal Int',
                        keyDataType: 'integer',
                        records: [
                            {
                                key: 121212,
                                value: 'Summer'
                            },
                            {
                                key: 3434,
                                value: 'Internal Field: "see guide"'
                            }
                        ]
                    },
                    dataGroupRefExternal: {
                        class: 'Data_Group',
                        label: 'From file path',
                        storageType: 'external',
                        keyDataType: 'string',
                        externalFilePath: 'file:/var/config/rest/downloads/datagroup_string.csv',
                        ignoreChanges: true,
                        separator: ':'
                    },
                    dataGroupRefExistingFileNoDG: {
                        class: 'Data_Group',
                        label: 'From existing data-group file',
                        storageType: 'external',
                        keyDataType: 'string',
                        dataGroupFile: {
                            bigip: '/Common/dataGroupFile'
                        }
                    }
                },
                extractFunction: (o) => o.senderTagClass || []
            }
        ];
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/shared/file-transfer/uploads/datagroup_string.csv',
                    data: 'first : gold,\nsecond : silver,\nthird : bronze,\nfourth : "honorable mention"',
                    headers: {
                        'Content-Range': '0-74/75',
                        'Content-Type': 'text/plain'
                    }
                },
                {
                    endpoint: '/mgmt/tm/sys/file/data-group',
                    data: {
                        name: 'dataGroupFile',
                        partition: 'Common',
                        fullPath: '/Common/dataGroupFile',
                        separator: ':',
                        sourcePath: 'file:/var/config/rest/downloads/datagroup_string.csv',
                        type: 'string'
                    }
                },
                {
                    endpoint: '/mgmt/tm/ltm/data-group/internal',
                    data: {
                        name: 'testInternalDG',
                        partition: 'Common',
                        fullPath: '/Common/testInternalDG',
                        type: 'string',
                        records: [
                            {
                                name: 'test1',
                                data: 'question?'
                            },
                            {
                                name: 'test2',
                                data: 'no answer'
                            }
                        ]
                    }
                },
                {
                    endpoint: '/mgmt/tm/ltm/data-group/external',
                    data: {
                        name: 'testExternalDG',
                        partition: 'Common',
                        fullPath: '/Common/testExternalDG',
                        externalFileName: '/Common/dataGroupFile'
                    }
                }
            ]
        };

        return assertFixProfileClass(properties, options);
    });
});

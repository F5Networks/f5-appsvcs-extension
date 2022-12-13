/**
 * Copyright 2022 F5 Networks, Inc.
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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const nock = require('nock');
const sinon = require('sinon');
const childProcess = require('child_process');
const EventEmitter = require('events');

const tmshUtil = require('../../../../src/lib/util/tmshUtil');

describe('tmshUtil', () => {
    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    function getCpMock(data, error) {
        const cp = new EventEmitter();
        cp.stdout = new EventEmitter();
        cp.stderr = new EventEmitter();

        function sendData() {
            if (data) {
                cp.stdout.emit('data', data);
            }
        }

        function sendError() {
            if (error) {
                cp.stderr.emit('data', error);
            }
        }

        function close() {
            const code = error ? 1 : 0;
            cp.emit('close', code);
        }

        setTimeout(sendData, 100);
        setTimeout(sendError, 100);
        setTimeout(close, 200);
        return cp;
    }

    describe('.getPrimaryAdminUser()', () => {
        it('should get the primary admin user from the db var', () => {
            sinon.stub(childProcess, 'spawn').callsFake(() => getCpMock('{ value "myAdminUser" }'));
            const expectedArgs = [
                '/bin/tmsh',
                [
                    '-a',
                    'list',
                    'sys',
                    'db',
                    'systemauth.primaryadminuser'
                ],
                {
                    shell: '/bin/bash'
                }
            ];
            return tmshUtil.getPrimaryAdminUser()
                .then((adminUser) => {
                    const args = childProcess.spawn.getCall(0).args;
                    assert.deepStrictEqual(args, expectedArgs);
                    assert.strictEqual(adminUser, 'myAdminUser');
                });
        });

        it('should handle unexpected values', () => {
            sinon.stub(childProcess, 'spawn').callsFake(() => getCpMock('{ thisIsWrong "myAdminUser" }'));
            return assert.isRejected(tmshUtil.getPrimaryAdminUser(), 'Unable to get primary admin user');
        });
    });

    describe('.executeTmshCommand()', () => {
        it('should parse and reply with data', () => {
            sinon.stub(childProcess, 'spawn').callsFake(() => getCpMock('{ property1 value1 property2 value2 }'));
            return tmshUtil.executeTmshCommand('myCommand')
                .then((response) => {
                    assert.deepStrictEqual(
                        response,
                        {
                            property1: 'value1',
                            property2: 'value2'
                        }
                    );
                });
        });

        it('should respond with errors that occur', () => {
            sinon.stub(childProcess, 'spawn').callsFake(() => getCpMock(null, 'my error'));
            return assert.isRejected(tmshUtil.executeTmshCommand('myCommand'), 'my error');
        });
    });

    describe('.generateAddFolderCommand()', () => {
        it('should generate a valid command', () => {
            const input = '/Common/folderName';
            const expectedOutput = {
                path: input,
                tmshPath: '/mgmt/tm/sys/folder/',
                command: 'create',
                data: {
                    name: input.split('/').pop(),
                    fullPath: input
                }
            };
            const output = tmshUtil.generateAddFolderCommand(input);
            assert.deepStrictEqual(output, expectedOutput);
        });
    });

    describe('.generateAddDataGroupCommand()', () => {
        it('should generate a valid command', () => {
            const input = 'testGroup';
            const expectedOutput = {
                path: input,
                tmshPath: '/mgmt/tm/ltm/data-group/internal/',
                command: 'create',
                data: {
                    name: input,
                    type: 'string'
                }
            };
            const output = tmshUtil.generateAddDataGroupCommand(input);
            assert.deepStrictEqual(output, expectedOutput);
        });
    });

    describe('.generateUpdateDataGroupCommand()', () => {
        const groupName = 'groupName';
        function assertOutput(input, expectedOutput) {
            const output = tmshUtil.generateUpdateDataGroupCommand(groupName, input);
            assert.deepStrictEqual(output, expectedOutput);
        }
        it('should handle empty list', () => {
            assertOutput([], {
                path: groupName,
                tmshPath: '/mgmt/tm/ltm/data-group/internal/',
                command: 'modify',
                data: {
                    records: []
                }
            });
        });

        it('should handle multiple records', () => {
            const records = [
                {
                    name: 'spam',
                    data: 'eggs'
                },
                {
                    name: 'hello',
                    data: 'there'
                }
            ];

            const expectedOuput = {
                path: groupName,
                tmshPath: '/mgmt/tm/ltm/data-group/internal/',
                command: 'modify',
                data: {
                    records: [
                        {
                            name: records[0].name,
                            data: records[0].data
                        },
                        {
                            name: records[1].name,
                            data: records[1].data
                        }
                    ]
                }
            };
            assertOutput(records, expectedOuput);
        });
    });

    describe('.generateReadDataGroupCommand()', () => {
        it('should generate a valid command', () => {
            const input = 'testGroup';
            const expectedOutput = {
                path: input,
                tmshPath: '/mgmt/tm/ltm/data-group/internal/',
                command: 'list'
            };
            const output = tmshUtil.generateReadDataGroupCommand(input);
            assert.deepStrictEqual(output, expectedOutput);
        });
    });

    describe('.executeCommand()', () => {
        it('should not have buffer error messages', () => {
            const message = 'There is a duplicate or something';
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~dataStore')
                .reply(400, message);

            return Promise.resolve()
                .then(() => tmshUtil.executeCommand({
                    command: 'list',
                    tmshPath: '/mgmt/tm/ltm/data-group/internal/',
                    path: '/Common/appsvcs/dataStore'
                }))
                .catch((error) => {
                    assert.equal(typeof error.message, 'string');
                });
        });
    });

    describe('.addFolder()', () => {
        it('should add a folder', () => {
            nock('http://localhost:8100')
                .post('/mgmt/tm/sys/folder/')
                .reply(200, (uri, requestBody) => requestBody);

            return Promise.resolve()
                .then(() => tmshUtil.addFolder(null, '/Partition/myFolder'))
                .then((result) => assert.deepStrictEqual(result, {
                    name: 'myFolder',
                    fullPath: '/Partition/myFolder'
                }));
        });
    });

    describe('.addDataGroup()', () => {
        it('should add data group', () => {
            nock('http://localhost:8100')
                .post('/mgmt/tm/ltm/data-group/internal/')
                .reply(200, (uri, requestBody) => requestBody);

            return Promise.resolve()
                .then(() => tmshUtil.addDataGroup(null, 'myDataGroup'))
                .then((result) => assert.deepStrictEqual(result, {
                    name: 'myDataGroup',
                    type: 'string'
                }));
        });
    });

    describe('.updateDataGroup()', () => {
        it('should update data group', () => {
            nock('http://localhost:8100')
                .patch('/mgmt/tm/ltm/data-group/internal/myDataGroup')
                .reply(200, (uri, requestBody) => requestBody);

            return Promise.resolve()
                .then(() => tmshUtil.updateDataGroup(null, 'myDataGroup', [
                    {
                        name: 'myName',
                        data: 'myRecordData'
                    }
                ]))
                .then((result) => assert.deepStrictEqual(result, {
                    records: [
                        {
                            name: 'myName',
                            data: 'myRecordData'
                        }
                    ]
                }));
        });
    });

    describe('.readDataGroup()', () => {
        it('should read data group', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal/myDataGroup')
                .reply(200, { data: 'data' });

            return Promise.resolve()
                .then(() => tmshUtil.readDataGroup(null, 'myDataGroup'))
                .then(((result) => assert.deepStrictEqual(result, {
                    data: 'data'
                })));
        });
    });

    describe('.itemExists()', () => {
        it('should throw error if error and status code is not 404', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/sys/folder/~Tenant~Application')
                .reply(500, 'fake error test message');
            let isCaught = false;
            return Promise.resolve()
                .then(() => tmshUtil.folderExists(null, '/Tenant/Application'))
                .catch((err) => {
                    isCaught = true;
                    assert.deepStrictEqual(err.message, 'fake error test message');
                })
                .then(() => assert(isCaught, 'An error should of been caught'));
        });
    });

    describe('.folderExists()', () => {
        it('should return true when folder exists', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/sys/folder/~Tenant~Application')
                .reply(200, {});

            return Promise.resolve()
                .then(() => tmshUtil.folderExists(null, '/Tenant/Application'))
                .then((result) => assert.deepStrictEqual(result, true));
        });

        it('should return false when folder does not exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/sys/folder/~Tenant~Application')
                .reply(404);

            return Promise.resolve()
                .then(() => tmshUtil.folderExists(null, '/Tenant/Application'))
                .then((result) => assert.deepStrictEqual(result, false));
        });
    });

    describe('.dataGroupExists()', () => {
        it('should return true when data group exists', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~dataStore')
                .reply(200, {});

            return Promise.resolve()
                .then(() => tmshUtil.dataGroupExists(null, '/Common/appsvcs/dataStore'))
                .then((result) => assert.deepStrictEqual(result, true));
        });

        it('should return false when data group does not exist', () => {
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/data-group/internal/~Common~appsvcs~dataStore')
                .reply(404);

            return Promise.resolve()
                .then(() => tmshUtil.dataGroupExists(null, '/Common/appsvcs/dataStore'))
                .then((result) => assert.deepStrictEqual(result, false));
        });
    });
});

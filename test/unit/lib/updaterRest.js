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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const sinon = require('sinon');
const nock = require('nock');

const UpdaterRest = require('../../../src/lib/updaterRest');
const util = require('../../../src/lib/util/util');
const Context = require('../../../src/lib/context/context');

describe('UpdaterRest', () => {
    afterEach(() => {
        sinon.restore();
    });

    function makeUpdater() {
        const context = Context.build();
        context.tasks.push({ protocol: 'http', urlPrefix: 'http://localhost:8100' });
        const updater = new UpdaterRest(context, 'id');
        return updater;
    }

    describe('.tagDiff()', () => {
        it('should tag service discovery add', () => {
            const updater = makeUpdater();
            const diff = [
                {
                    command: 'mgmt shared service-discovery task',
                    tags: ['test'],
                    kind: 'N',
                    rhs: {
                        command: 'mgmt shared service-discovery task'
                    }

                }
            ];
            updater.tagDiff(diff);
            assert.deepEqual(diff[0].tags, ['test', updater.tag]);
        });

        it('should tag service discovery delete', () => {
            const updater = makeUpdater();
            const diff = [
                {
                    command: 'mgmt shared service-discovery task',
                    tags: [],
                    kind: 'D',
                    lhs: {
                        command: 'mgmt shared service-discovery task'
                    }

                }
            ];
            updater.tagDiff(diff);
            assert.deepEqual(diff[0].tags, [updater.tag]);
        });
    });

    describe('.update()', () => {
        it('should POST new entries', () => {
            const properties = {
                schemaVersion: '1.0.0',
                id: 'task',
                updateInterval: 0,
                resources: {
                    0: {
                        type: 'pool',
                        path: '/Common/pool',
                        options: {
                            servicePort: 80
                        }
                    }
                },
                provider: 'static',
                providerOptions: {
                    nodes: {
                        0: {
                            id: '192.0.2.0'
                        }
                    }
                }
            };
            const updater = makeUpdater();
            const diff = [{
                command: 'mgmt shared service-discovery task',
                kind: 'N',
                lhs: {
                    command: 'mgmt shared service-discovery task',
                    properties
                }

            }];

            let body = 'request not received';
            nock('http://localhost:8100')
                .post('/mgmt/shared/service-discovery/task')
                .reply(200, (_, _body) => {
                    body = _body;
                });
            return updater.update([], [], diff)
                .then(() => assert.deepStrictEqual(body, {
                    schemaVersion: '1.0.0',
                    id: 'task',
                    updateInterval: 0,
                    resources: [{
                        type: 'pool',
                        path: '/Common/pool',
                        options: {
                            servicePort: 80
                        }
                    }],
                    provider: 'static',
                    providerOptions: {
                        nodes: [{
                            id: '192.0.2.0'
                        }]
                    }
                }));
        });

        it('should DELETE missing entries', () => {
            const updater = makeUpdater();
            const diff = [{
                kind: 'D',
                command: 'mgmt shared service-discovery task',
                lhs: {
                    command: 'mgmt shared service-discovery task',
                    properties: { id: 'task' }
                }

            }];

            let isDeleted = false;
            nock('http://localhost:8100')
                .delete('/mgmt/shared/service-discovery/task/task')
                .reply(200, () => {
                    isDeleted = true;
                });
            return updater.update([], [], diff)
                .then(() => assert(isDeleted, 'DELETE request was not sent'));
        });

        it('should PATCH for edits', () => {
            const updater = makeUpdater();
            const properties = {
                schemaVersion: '1.0.0',
                id: 'task',
                updateInterval: 0,
                resources: {
                    0: {
                        type: 'pool',
                        path: '/Common/pool',
                        options: {
                            servicePort: 80
                        }
                    }
                },
                provider: 'static',
                providerOptions: {
                    nodes: {
                        0: {
                            id: '192.0.2.0'
                        }
                    }
                }
            };

            const diff = [{
                kind: 'E',
                command: 'mgmt shared service-discovery task',
                path: ['task', 'properties', 'resources', '0', 'options', 'servicePort'],
                lhs: 80,
                rhs: 8080
            }];

            const current = {
                task: {
                    command: 'mgmt shared service-discovery task',
                    properties
                }
            };

            const desired = {
                task: {
                    command: 'mgmt shared service-discovery task',
                    properties: util.simpleCopy(properties)
                }
            };
            desired.task.properties.resources[0].options.servicePort = 8080;

            let body = 'request not received';
            nock('http://localhost:8100')
                .patch('/mgmt/shared/service-discovery/task/task')
                .reply(200, (_, _body) => {
                    body = _body;
                });
            return updater.update(desired, current, diff)
                .then(() => assert.deepStrictEqual(body, {
                    schemaVersion: '1.0.0',
                    id: 'task',
                    updateInterval: 0,
                    resources: [{
                        type: 'pool',
                        path: '/Common/pool',
                        options: {
                            servicePort: 8080
                        }
                    }],
                    provider: 'static',
                    providerOptions: {
                        nodes: [{
                            id: '192.0.2.0'
                        }]
                    }
                }));
        });

        it('should resolve when doing a dryRun', () => {
            const updater = makeUpdater();
            updater.context.tasks[updater.context.currentIndex].dryRun = true;
            return assert.isFulfilled(updater.update());
        });
    });
});

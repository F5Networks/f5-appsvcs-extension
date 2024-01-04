/**
 * Copyright 2024 F5, Inc.
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

const assert = require('assert');

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const util = require('../../../../src/lib/util/util');
const requestUtil = require('../../../common/requestUtilPromise');
const { validateEnvVars } = require('../../../common/checkEnv');

const {
    createDeclarations,
    getDeclaration,
    postDeclaration,
    deleteDeclaration,
    getItemName,
    assertModuleProvisioned,
    postBigipItems,
    deleteBigipItems,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

const SD = {
    get AZURE() {
        return {
            addressDiscovery: 'azure',
            updateInterval: 60,
            tagKey: 'foo',
            tagValue: 'bar',
            addressRealm: 'private',
            resourceGroup: 'as3_dev',
            subscriptionId: process.env.ARM_SUBSCRIPTION_ID,
            directoryId: process.env.ARM_TENANT_ID,
            applicationId: process.env.ARM_CLIENT_ID,
            apiAccessKey: process.env.ARM_CLIENT_SECRET,
            credentialUpdate: false
        };
    },
    get GCE() {
        return {
            addressDiscovery: 'gce',
            updateInterval: 60,
            tagKey: 'foo',
            tagValue: 'bar',
            addressRealm: 'private',
            region: 'us-west1',
            encodedCredentials: process.env.DISCOVERY_GCE_SECRET,
            credentialUpdate: false
        };
    },
    get AWS() {
        return {
            addressDiscovery: 'aws',
            updateInterval: 60,
            tagKey: 'foo',
            tagValue: 'bar',
            addressRealm: 'private',
            region: 'us-west-1',
            accessKeyId: process.env.DISCOVERY_AWS_ID,
            secretAccessKey: process.env.DISCOVERY_AWS_SECRET,
            credentialUpdate: false
        };
    },
    get EVENT() {
        return { addressDiscovery: 'event' };
    },
    get CONSUL() {
        return {
            addressDiscovery: 'consul',
            updateInterval: 10,
            uri: process.env.CONSUL_URI_NODES,
            jmesPathQuery: '[?Node==`as3-node`].{id:ID||Node,ip:{private:Address,public:Address}}',
            credentialUpdate: false,
            rejectUnauthorized: false
        };
    }
};

const tenantName = 'TEST_ServiceDiscovery';

function confirmRedacted(resultDecl, contextDescription) {
    const checks = {
        aws: ['accessKeyId'],
        azure: ['resourceGroup', 'subscriptionId', 'directoryId', 'applicationId']
    };
    let members = resultDecl.TEST_ServiceDiscovery.Application[getItemName({ tenantName })].members;
    if (!members) {
        members = resultDecl.TEST_ServiceDiscovery.Application[getItemName({ tenantName })].addresses;
    }

    members.forEach((member) => {
        if (typeof member !== 'object' || !member.addressDiscovery) {
            return;
        }
        if (checks[member.addressDiscovery]) {
            checks[member.addressDiscovery].forEach((property) => {
                const message = `${member.addressDiscovery.toUpperCase()} ${property} is not `
                    + `revoked in ${contextDescription}`;
                assert.strictEqual(member[property], '<redacted>', message);
            });
        }
    });
}

function confirmEncryptedSecrets(resultDecl, contextDescription) {
    const checks = {
        aws: ['secretAccessKey', process.env.DISCOVERY_AWS_SECRET],
        azure: ['apiAccessKey', process.env.ARM_CLIENT_SECRET],
        gce: ['encodedCredentials', process.env.DISCOVERY_GCE_SECRET]
    };
    let members = resultDecl.TEST_ServiceDiscovery.Application[getItemName({ tenantName })].members;
    if (!members) {
        members = resultDecl.TEST_ServiceDiscovery.Application[getItemName({ tenantName })].addresses;
    }

    members.forEach((member) => {
        if (typeof member !== 'object' || !member.addressDiscovery) {
            return;
        }
        if (checks[member.addressDiscovery]) {
            const [property, secret] = checks[member.addressDiscovery];
            const message = `${member.addressDiscovery.toUpperCase()} ${property} is not `
                + `encrypted/removed in ${contextDescription}`;
            assert.notStrictEqual(member[property], secret, message);
        }
    });
}

function getTask(taskId) {
    const reqOpts = {
        path: `/mgmt/shared/service-discovery/task/${taskId || ''}`,
        retryCount: 20,
        retryInterval: 5000,
        retryIf: (error, response) => response.body && response.body.items
            && response.body.items.some((item) => item.lastDiscoveryResult.status !== 'Success')
    };
    return requestUtil.get(reqOpts)
        .then((response) => response.body.items)
        .catch((error) => {
            error.message = `Unable to GET task: ${error}`;
            throw error;
        });
}

function confirmTask(resultTask, checkProps) {
    let tasks = [];
    let taskFound = false;

    if (Array.isArray(resultTask)) {
        tasks = resultTask;
    } else {
        tasks = [resultTask];
    }

    function taskMatches(task) {
        return Object.keys(checkProps).every((key) => task[key] === checkProps[key]);
    }
    taskFound = tasks.some(taskMatches);
    assert.strictEqual(
        taskFound,
        true,
        `Could not find task with the key value pairs:\n${JSON.stringify(checkProps, null, 2)}`
    );
    const tasksSucceeded = tasks.every((task) => task.lastDiscoveryResult.status === 'Success');
    assert.strictEqual(
        tasksSucceeded,
        true,
        `One or more SD tasks did not succeed:\n${JSON.stringify(tasks, null, 2)}`
    );
}

function assertConnect(provider, cloudDecl, createDeclFunc) {
    return Promise.resolve()
        .then(() => postDeclaration(createDeclFunc(cloudDecl), { declarationIndex: 0 }))
        .then((result) => {
            const partition = 'TEST_ServiceDiscovery';
            const partitionResult = result.results.find((r) => r.tenant === partition);
            if (!partitionResult) {
                const resultString = JSON.stringify(result, null, 2);
                throw new Error(`Unable to find ${partition} in results: ${resultString}`);
            }
            assert.strictEqual(
                partitionResult.message,
                'success',
                `declaration did not apply successfully: result: ${JSON.stringify(partitionResult)}`
            );
            confirmEncryptedSecrets(result.declaration, 'POST response');
            confirmRedacted(result.declaration, 'POST response');
        })
        .then(() => getTask())
        .then(((result) => confirmTask(result, {
            provider,
            nodePrefix: '/TEST_ServiceDiscovery/'
        })))
        .then(() => getDeclaration())
        .then((result) => {
            confirmEncryptedSecrets(result, 'GET response');
            confirmRedacted(result, 'GET response');
        });
}

function deleteTasks() {
    return deleteDeclaration()
        .then(() => {
            const reqOpts = {
                path: '/mgmt/shared/service-discovery/task',
                host: process.env.TARGET_HOST || process.env.AS3_HOST
            };

            return requestUtil.delete(reqOpts);
        });
}

describe('Service Discovery', function () {
    this.timeout(GLOBAL_TIMEOUT);

    describe('Pool', function () {
        before(() => {
            validateEnvVars(
                [
                    'ARM_SUBSCRIPTION_ID',
                    'ARM_TENANT_ID',
                    'ARM_CLIENT_ID',
                    'ARM_CLIENT_SECRET',
                    'DISCOVERY_AWS_ID',
                    'DISCOVERY_AWS_SECRET',
                    'DISCOVERY_GCE_SECRET',
                    'CONSUL_URI',
                    'CONSUL_URI_NODES'
                ]
            );
        });

        const POOL_STATIC = {
            enable: true,
            serverAddresses: [
                '192.0.2.1',
                '192.0.2.3'
            ]
        };

        const POOL_FQDN = {
            enable: true,
            addressDiscovery: 'fqdn',
            hostname: 'www.google.com'
        };

        function createPoolDeclaration(members, monitors) {
            const properties = [
                {
                    name: 'members',
                    inputValue: [members.map((m, i) => Object.assign(m, { servicePort: 8080 + i }))],
                    skipAssert: true
                }
            ];
            if (monitors) {
                properties.push(
                    {
                        name: 'monitors',
                        inputValue: [monitors],
                        skipAssert: true
                    }
                );
            }
            const options = {
                tenantName: 'TEST_ServiceDiscovery',
                applicationName: 'Application'
            };
            return createDeclarations('Pool', properties, options)[0];
        }

        function assertConnectPool(provider, cloudDecl) {
            return assertConnect(provider, [cloudDecl], createPoolDeclaration);
        }

        function registerConsulNode(options) {
            return requestUtil.put(
                Object.assign(options, { path: '/v1/catalog/register' })
            );
        }

        function deregisterConsulNode(options) {
            return requestUtil.put(
                Object.assign(options, { path: '/v1/catalog/deregister' })
            );
        }

        before('set up', function () {
            return deleteTasks();
        });

        afterEach(() => deleteTasks());

        it('should connect to aws', () => assertConnectPool('aws', SD.AWS));
        it('should connect to azure', () => assertConnectPool('azure', SD.AZURE));
        it('should connect to gce', () => assertConnectPool('gce', SD.GCE));

        it('should setup event driven', () => assertConnectPool('event', SD.EVENT));

        it('should support static members', () => postDeclaration(
            createPoolDeclaration([SD.AWS, POOL_STATIC]),
            { declarationIndex: 0 }
        ));

        it('should support fqdn members', () => postDeclaration(
            createPoolDeclaration([SD.AWS, POOL_FQDN]),
            { declarationIndex: 0 }
        ));

        it('should support consul members', function () {
            before(() => {
                validateEnvVars(['TEST_RESOURCES_URL']);
            });

            // Skipping consul testing in Azure for now because
            // consul instance deployed in VIO and not available from outside.
            if (process.env.TEST_IN_AZURE === 'true') {
                this.skip();
            }

            const options = {
                protocol: 'http:',
                host: process.env.CONSUL_URI,
                port: 8500,
                body: {
                    Node: 'as3-node',
                    Address: '192.0.2.4'
                }
            };

            return Promise.resolve()
                // We create an FQDN node because the existence of one has broken SD in the past
                .then(() => postBigipItems(
                    [
                        {
                            endpoint: '/mgmt/tm/ltm/node',
                            data: {
                                name: 'testFQDNNode',
                                partition: 'Common',
                                fqdn: {
                                    autopopulate: 'enabled',
                                    tmName: 'www.f5.com'
                                }
                            }
                        }
                    ]
                ))
                .then(() => postDeclaration(createPoolDeclaration([SD.CONSUL]), { declarationIndex: 0 }))
                .then(() => {
                    const getTaskOptions = {
                        path: '/mgmt/shared/service-discovery/task'
                    };
                    return requestUtil.get(getTaskOptions);
                })
                // To filter nodes from consul we can use jmesPathQuery,
                // so we're filtering by node's name.
                .then((result) => {
                    assert.deepStrictEqual(
                        result.body.items[0].providerOptions,
                        {
                            type: 'consul',
                            addressRealm: 'private',
                            jmesPathQuery: '[?Node==`as3-node`].{id:ID||Node,ip:{private:Address,public:Address}}',
                            uri: process.env.CONSUL_URI_NODES,
                            rejectUnauthorized: false
                        }
                    );
                })
                .then(() => deregisterConsulNode(options))
                .then(() => registerConsulNode(options))
                // We need some time for SD to get nodes and populate pool.
                .then(() => promiseUtil.delay(20000))
                .then(() => {
                    const getNodesOptions = {
                        path: '/mgmt/tm/ltm/node'
                    };
                    return requestUtil.get(getNodesOptions);
                })
                .then((results) => {
                    const nodeList = [];
                    results.body.items.forEach((result) => {
                        nodeList.push(result.name);
                    });
                    const message = `Node's list ${nodeList} doesn't have consul node.`;
                    assert.ok(nodeList.includes('consul-as3-node-private'), message);
                })
                .finally(() => deregisterConsulNode(options)
                    .then(() => deleteBigipItems(
                        [
                            {
                                endpoint: '/mgmt/tm/ltm/node',
                                data: {
                                    name: '~Common~testFQDNNode'
                                }
                            }
                        ]
                    )));
        });

        it('should support changing to a wildcard monitor', function () {
            before(() => {
                validateEnvVars(['TEST_RESOURCES_URL']);
            });

            // Skipping consul testing in Azure for now because
            // consul instance deployed in VIO and not available from outside.
            if (process.env.TEST_IN_AZURE === 'true') {
                this.skip();
            }

            const options = {
                protocol: 'http:',
                host: process.env.CONSUL_URI,
                port: 8500,
                body: {
                    Node: 'as3-node',
                    Address: '192.0.2.4'
                }
            };

            const monitors = {
                use: 'consul_monitor'
            };

            const consulMonitor = {
                class: 'Monitor',
                monitorType: 'http',
                send: 'GET /healthcheck HTTP/1.1\r\nHost: f5check\r\nConnection:Close\r\n\r\n',
                receive: 'status.*ok',
                receiveDown: 'status.*disabled',
                targetPort: 80,
                adaptive: false
            };

            return Promise.resolve()
                .then(() => createPoolDeclaration([SD.CONSUL], [monitors]))
                .then((declaration) => {
                    declaration.declaration[tenantName].Application.consul_monitor = consulMonitor;
                    return declaration;
                })
                .then((declaration) => postDeclaration(declaration, { declarationIndex: 0 }))
                .then((result) => {
                    assert.strictEqual(result.results[0].code, 200);
                })
                .then(() => createPoolDeclaration([SD.CONSUL], [monitors]))
                .then((declaration) => {
                    consulMonitor.targetPort = 0;
                    declaration.declaration[tenantName].Application.consul_monitor = consulMonitor;
                    return declaration;
                })
                .then((declaration) => postDeclaration(declaration, { declarationIndex: 1 }))
                .then((result) => {
                    assert.strictEqual(result.results[0].code, 200);
                })
                .then(() => deregisterConsulNode(options))
                .then(() => registerConsulNode(options))
                // We need some time for SD to get nodes and populate pool.
                .then(() => promiseUtil.delay(20000))
                .then(() => {
                    const getNodesOptions = {
                        path: '/mgmt/tm/ltm/node'
                    };
                    return requestUtil.get(getNodesOptions);
                })
                .then((results) => {
                    const nodeList = [];
                    results.body.items.forEach((result) => {
                        nodeList.push(result.name);
                    });
                    const message = `Node's list ${nodeList} doesn't have consul node.`;
                    assert.ok(nodeList.includes('consul-as3-node-private'), message);
                })
                .finally(() => deregisterConsulNode(options));
        });

        it('should support modifying the adminState of a member', () => {
            const declaration = createPoolDeclaration([SD.EVENT]);
            const app = declaration.declaration.TEST_ServiceDiscovery.Application;
            const poolName = Object.keys(app).find((key) => app[key].class === 'Pool');

            // Default event pool members to 'disable' adminState
            app[poolName].members[0].adminState = 'disable';

            const nodeDeclaration = [
                {
                    id: 'newNode1',
                    ip: '192.0.2.3',
                    port: 8070
                },
                {
                    id: 'newNode2',
                    ip: '192.0.2.4',
                    port: 8080,
                    // Test overriding 'disable' adminState with 'offline'
                    state: 'user-down',
                    session: 'user-disabled'
                },
                {
                    id: 'newNode3',
                    ip: '192.0.2.5',
                    port: 8090,
                    // Test overriding 'disable' adminState with 'enable'
                    state: 'user-up',
                    session: 'user-enabled'
                }
            ];

            const sdEventEndpoint = '/mgmt/shared/service-discovery/task/~TEST_ServiceDiscovery'
            + `~Application~${poolName}/nodes`;

            const poolEndpoint = '/mgmt/tm/ltm/pool/~TEST_ServiceDiscovery'
                + `~Application~${poolName}/members?$select=fullPath,address,state,session`;

            return postDeclaration(declaration, { declarationIndex: 0 })
                // Discover nodes in SD
                .then(() => requestUtil.post({
                    path: sdEventEndpoint,
                    body: util.simpleCopy(nodeDeclaration)
                }))
                // Verify nodes in SD task response
                .then((result) => {
                    assert.deepStrictEqual(
                        result.body.providerOptions.nodeList,
                        util.simpleCopy(nodeDeclaration),
                        'Discovered nodes should be added to SD task node list'
                    );
                })
                .then(() => promiseUtil.delay(5000))
                // Get pool members
                .then(() => requestUtil.get({ path: poolEndpoint }))
                // Verify pool members
                .then((results) => {
                    assert.deepStrictEqual(
                        results.body.items,
                        [
                            {
                                address: '192.0.2.3',
                                fullPath: '/TEST_ServiceDiscovery/newNode1:8070',
                                session: 'user-disabled',
                                state: 'unchecked'
                            },
                            {
                                address: '192.0.2.4',
                                fullPath: '/TEST_ServiceDiscovery/newNode2:8080',
                                session: 'user-disabled',
                                state: 'user-down'
                            },
                            {
                                address: '192.0.2.5',
                                fullPath: '/TEST_ServiceDiscovery/newNode3:8090',
                                session: 'user-enabled',
                                state: 'unchecked'
                            }
                        ],
                        `Discovered nodes should be added as pool members on pool ${poolName}`
                    );
                });
        });
    });

    describe('Firewall Address List', function () {
        function createAddrListDeclaration(addrs) {
            const properties = [
                {
                    name: 'addresses',
                    inputValue: [addrs.reduce((list, a) => {
                        if (Array.isArray(a)) {
                            a.forEach((val) => list.push(val));
                        } else {
                            list.push(a);
                        }
                        return list;
                    }, [])],
                    skipAssert: true
                }
            ];
            const options = {
                tenantName: 'TEST_ServiceDiscovery',
                applicationName: 'Application'
            };
            return createDeclarations('Firewall_Address_List', properties, options)[0];
        }

        function assertConnectAddrList(provider, cloudDecl) {
            const ADDR_LIST_STATIC = ['192.0.2.1', '192.0.2.3'];
            return assertConnect(provider, [cloudDecl, ADDR_LIST_STATIC], createAddrListDeclaration);
        }

        before('clean up existing tasks', function () {
            assertModuleProvisioned.call(this, 'afm');
            return deleteTasks();
        });

        afterEach(() => deleteTasks());

        it('should connect to aws', () => assertConnectAddrList('aws', SD.AWS));
        it('should connect to azure', () => assertConnectAddrList('azure', SD.AZURE));
        it('should connect to gce', () => assertConnectAddrList('gce', SD.GCE));
        it('should setup event driven', () => assertConnectAddrList('event', SD.EVENT));
    });

    describe('Address_Discovery', function () {
        afterEach(() => deleteTasks());

        it('should create task with multiple resources', () => {
            const testItem = SD.AWS;
            testItem.class = 'Address_Discovery';
            const declaration = {
                class: 'AS3',
                persist: false,
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.22.0',
                    id: 'Address_Discovery',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true
                    },
                    TEST_Address_Discovery: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            testItem,
                            pool1: {
                                class: 'Pool',
                                monitors: [
                                    'http'
                                ],
                                members: [
                                    {
                                        servicePort: 80,
                                        addressDiscovery: {
                                            use: 'testItem'
                                        }
                                    }
                                ]
                            },
                            pool2: {
                                class: 'Pool',
                                monitors: [
                                    'http'
                                ],
                                members: [
                                    {
                                        servicePort: 8080,
                                        addressDiscovery: {
                                            use: 'testItem'
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            };

            return postDeclaration(declaration, { declarationIndex: 0 })
                .then(() => {
                    const options = {
                        path: '/mgmt/shared/service-discovery/task'
                    };
                    return requestUtil.get(options);
                })
                .then((result) => {
                    assert.deepStrictEqual(
                        result.body.items[0].resources,
                        [
                            {
                                type: 'pool',
                                path: '/TEST_Address_Discovery/Application/pool1',
                                options: {
                                    servicePort: 80,
                                    connectionLimit: 0,
                                    rateLimit: 'disabled',
                                    dynamicRatio: 1,
                                    ratio: 1,
                                    priorityGroup: 0,
                                    monitor: 'default',
                                    session: 'user-enabled',
                                    state: 'user-up'
                                },
                                requiresNodes: true
                            },
                            {
                                type: 'pool',
                                path: '/TEST_Address_Discovery/Application/pool2',
                                options: {
                                    servicePort: 8080,
                                    connectionLimit: 0,
                                    rateLimit: 'disabled',
                                    dynamicRatio: 1,
                                    ratio: 1,
                                    priorityGroup: 0,
                                    monitor: 'default',
                                    session: 'user-enabled',
                                    state: 'user-up'
                                },
                                requiresNodes: true
                            }
                        ]
                    );
                });
        });

        it('should create and delete shared node when discovered and removed', () => {
            const addrDiscovery = SD.EVENT;
            addrDiscovery.class = 'Address_Discovery';
            addrDiscovery.shareNodes = true;
            const declaration = {
                class: 'AS3',
                persist: false,
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.22.0',
                    id: 'Address_Discovery',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true
                    },
                    TEST_Address_Discovery_Event: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            addrDiscovery,
                            pool1: {
                                class: 'Pool',
                                monitors: [
                                    'http'
                                ],
                                members: [
                                    {
                                        servicePort: 80,
                                        addressDiscovery: {
                                            use: 'addrDiscovery'
                                        }
                                    }
                                ]
                            },
                            pool2: {
                                class: 'Pool',
                                monitors: [
                                    'http'
                                ],
                                members: [
                                    {
                                        servicePort: 8080,
                                        addressDiscovery: {
                                            use: 'addrDiscovery'
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            };

            const nodeDeclaration = [
                {
                    id: 'newNode1',
                    ip: '192.0.2.3',
                    port: 8070
                },
                {
                    id: 'newNode2',
                    ip: '192.0.2.4',
                    port: 8090
                }
            ];

            const sdEventEndpoint = '/mgmt/shared/service-discovery/task/~TEST_Address_Discovery_Event'
            + '~Application~addrDiscovery/nodes';

            const getPoolMemberResults = () => {
                const getPoolPath = (poolName) => '/mgmt/tm/ltm/pool/~TEST_Address_Discovery_Event'
                + `~Application~${poolName}/members?$select=fullPath,address`;
                return Promise.all(['pool1', 'pool2'].map((pool) => requestUtil.get({ path: getPoolPath(pool) })));
            };

            return postDeclaration(declaration, { declarationIndex: 0 })
            // Discover nodes in SD
                .then(() => requestUtil.post({
                    path: sdEventEndpoint,
                    body: util.simpleCopy(nodeDeclaration)
                }))
            // Verify nodes in SD task response
                .then((result) => {
                    assert.deepStrictEqual(
                        result.body.providerOptions.nodeList,
                        util.simpleCopy(nodeDeclaration),
                        'Discovered nodes should be added to SD task node list'
                    );
                })
            // Get pool members
                .then(() => promiseUtil.delay(5000).then(() => getPoolMemberResults()))
            // Verify pool members
                .then((results) => {
                    const expectedNodes = nodeDeclaration
                        .map((nodeDecl) => ({
                            fullPath: `/Common/${nodeDecl.id}:${nodeDecl.port}`,
                            address: nodeDecl.ip
                        }));

                    results.forEach((result, i) => {
                        assert.deepStrictEqual(
                            result.body.items,
                            expectedNodes,
                            `Discovered nodes should be added as pool members on pool ${nodeDeclaration[i].id}`
                        );
                    });
                })
            // Remove discovered nodes from SD
                .then(() => requestUtil.post({
                    path: sdEventEndpoint,
                    body: []
                }))
            // Verify lack of nodes in SD task response
                .then((result) => {
                    assert.deepStrictEqual(
                        result.body.providerOptions.nodeList,
                        [],
                        'Discovered nodes should be removed from SD task node list'
                    );
                })
            // Get pool members
                .then(() => promiseUtil.delay(5000).then(() => getPoolMemberResults()))
            // Verify lack of pool members
                .then((results) => {
                    results.forEach((result, i) => {
                        assert.deepStrictEqual(
                            result.body.items || [],
                            [],
                            `Discovered nodes should be removed from pool members on pool ${nodeDeclaration[i].id}`
                        );
                    });
                })
            // Get nodes
                .then(() => requestUtil.get({ path: '/mgmt/tm/ltm/node' }))
            // Verify lack of nodes
                .then((result) => {
                    const foundNodes = (result.body.items || [])
                        .filter((node) => nodeDeclaration.some((nodeDecl) => `/Common/${nodeDecl.id}` === node.fullPath));
                    assert.deepStrictEqual(foundNodes, [], 'Discovered nodes should be removed from /Common');
                });
        });

        it('should create task with no resources', () => {
            const testItem = SD.EVENT;
            testItem.class = 'Address_Discovery';
            const declaration = {
                class: 'AS3',
                persist: false,
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.22.0',
                    id: 'Address_Discovery',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true
                    },
                    TEST_Address_Discovery: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            testItem
                        }
                    }
                }
            };

            return postDeclaration(declaration, { declarationIndex: 0 })
                .then(() => {
                    const options = {
                        path: '/mgmt/shared/service-discovery/task',
                        retryCount: 5,
                        retryInterval: 1000,
                        retryIf: (error, response) => response.body.items[0].lastDiscoveryResult.status === 'Pending'
                    };
                    return requestUtil.get(options);
                })
                .then((result) => {
                    const task = result.body.items[0];
                    delete task.lastRun;
                    delete task.lastDiscoveryResult.timestamp;
                    assert.deepStrictEqual(
                        task,
                        {
                            id: '~TEST_Address_Discovery~Application~testItem',
                            updateInterval: 0,
                            provider: 'event',
                            providerOptions: {
                                type: 'event',
                                nodeList: []
                            },
                            resources: [],
                            kind: 'shared:service-discovery:taskstate',
                            nodePrefix: '/TEST_Address_Discovery/',
                            metadata: {
                                configuredBy: 'AS3'
                            },
                            lastDiscoveryResult: {
                                status: 'Success',
                                message: 'Task was successful'
                            },
                            routeDomain: 0
                        }
                    );
                });
        });

        it('should create two SD tasks from two Address_Discovery objects', () => {
            const testItem1 = SD.EVENT;
            testItem1.class = 'Address_Discovery';
            const testItem2 = SD.EVENT;
            testItem2.class = 'Address_Discovery';
            const declaration = {
                class: 'AS3',
                persist: false,
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.22.0',
                    id: 'Address_Discovery',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true
                    },
                    TEST_Address_Discovery: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            testItem1,
                            testItem2
                        }
                    }
                }
            };

            return postDeclaration(declaration, { declarationIndex: 0 })
                .then(() => {
                    const options = {
                        path: '/mgmt/shared/service-discovery/task'
                    };
                    return requestUtil.get(options);
                })
                .then((result) => {
                    const tasks = result.body.items;
                    assert.deepStrictEqual(tasks[0].id, '~TEST_Address_Discovery~Application~testItem1');
                    assert.deepStrictEqual(tasks[1].id, '~TEST_Address_Discovery~Application~testItem2');
                });
        });

        it('should handle static and fqdn addressDiscovery with Address_Discovery', () => {
            const declaration = {
                class: 'AS3',
                declaration: {
                    class: 'ADC',
                    schemaVersion: '3.44.0',
                    id: 'Address_Discovery',
                    controls: {
                        class: 'Controls',
                        trace: true,
                        logLevel: 'debug',
                        traceResponse: true
                    },
                    TEST_Address_Discovery: {
                        class: 'Tenant',
                        Application: {
                            class: 'Application',
                            staticAddressDiscovery: {
                                class: 'Address_Discovery',
                                addressDiscovery: 'static',
                                serverAddresses: [
                                    '10.10.20.20'
                                ]
                            },
                            staticWithBigipAddressDiscovery: {
                                class: 'Address_Discovery',
                                addressDiscovery: 'static',
                                bigip: '/Common/testNode'
                            },
                            fqdnAddressDiscovery: {
                                class: 'Address_Discovery',
                                addressDiscovery: 'fqdn',
                                hostname: 'www.f5.com'
                            },
                            pool: {
                                class: 'Pool',
                                members: [
                                    {
                                        servicePort: 80,
                                        addressDiscovery: {
                                            use: 'staticAddressDiscovery'
                                        }
                                    },
                                    {
                                        servicePort: 8080,
                                        addressDiscovery: {
                                            use: 'staticWithBigipAddressDiscovery'
                                        }
                                    },
                                    {
                                        servicePort: 100,
                                        addressDiscovery: {
                                            use: 'fqdnAddressDiscovery'
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            };
            const bigipItems = [
                {
                    endpoint: '/mgmt/tm/ltm/node',
                    data: {
                        name: 'testNode',
                        partition: 'Common',
                        address: '1.2.3.4'
                    }
                }
            ];

            return postBigipItems(bigipItems)
                .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
                .then(() => {
                    const options = {
                        path: '/mgmt/shared/service-discovery/task',
                        retryCount: 10,
                        retryInterval: 1000,
                        retryIf: (error, response) => response.body.items
                            .some((item) => item.lastDiscoveryResult.status === 'Pending')
                    };
                    return requestUtil.get(options);
                })
                .then((result) => {
                    const tasks = result.body.items;
                    assert.deepStrictEqual(
                        tasks[0].providerOptions,
                        {
                            type: 'static',
                            nodes: [
                                {
                                    id: '/TEST_Address_Discovery/10.10.20.20'
                                }
                            ]
                        }
                    );
                    assert.deepStrictEqual(
                        tasks[1].providerOptions,
                        {
                            type: 'static',
                            nodes: [
                                {
                                    id: '/Common/testNode'
                                }
                            ]
                        }
                    );
                    assert.deepStrictEqual(
                        tasks[2].providerOptions,
                        {
                            type: 'static',
                            nodes: [
                                {
                                    id: '/TEST_Address_Discovery/www.f5.com'
                                }
                            ]
                        }
                    );
                    const options = {
                        path: '/mgmt/tm/ltm/pool/~TEST_Address_Discovery~Application~pool/members'
                    };
                    return requestUtil.get(options);
                })
                // Remove comments and run this test several times once AUTOTOOL-3677 is completed
                /* .then((result) => {
                    const members = result.body.items.map((member) => member.name);
                    assert.deepStrictEqual(
                        members,
                        [
                            '_auto_108.138.94.42:100',
                            'testNode:8080',
                            '10.10.20.20:80',
                            'www.f5.com:100'
                        ]
                    );
                }) */
                .finally(() => deleteDeclaration().then(() => deleteBigipItems(bigipItems)));
        });
    });

    describe('routeDomain', () => {
        it('should update routeDomain for task and nodes', () => {
            const bigipItems = [
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '100' }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '101' }
                }
            ];
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    addressDiscovery: 'event',
                                    servicePort: 80,
                                    routeDomain: 100
                                }
                            ]
                        }
                    }
                }
            };

            return postBigipItems(bigipItems)
                .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                })
                .then(() => {
                    const options = {
                        body: [
                            {
                                id: '192.0.2.1',
                                ip: '192.0.2.1'
                            }
                        ],
                        path: '/mgmt/shared/service-discovery/task/~tenant~app~pool/nodes',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil.post(options);
                })
                .then((response) => assert.strictEqual(response.body.code, 200))
                .then(() => promiseUtil.delay(10000))
                .then(() => getPath('/mgmt/shared/service-discovery/task/~tenant~app~pool'))
                .then((response) => {
                    assert.strictEqual(response.result.routeDomain, 100);
                    assert.deepStrictEqual(
                        response.result.providerOptions,
                        {
                            type: 'event',
                            nodeList: [
                                {
                                    id: '/tenant/192.0.2.1%100',
                                    ip: '192.0.2.1%100'
                                }
                            ]
                        }
                    );
                })
                .then(() => {
                    declaration.tenant.app.pool.members[0].routeDomain = 101;
                    return postDeclaration(declaration, { declarationIndex: 1 });
                })
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                })
                .then(() => promiseUtil.delay(10000))
                .then(() => getPath('/mgmt/shared/service-discovery/task/~tenant~app~pool'))
                .then((response) => {
                    assert.strictEqual(response.result.routeDomain, 101);
                    assert.deepStrictEqual(
                        response.result.providerOptions,
                        {
                            type: 'event',
                            nodeList: [
                                {
                                    id: '/tenant/192.0.2.1%101',
                                    ip: '192.0.2.1%101'
                                }
                            ]
                        }
                    );
                })
                .then(() => {
                    declaration.tenant.app.pool.members[0].routeDomain = 0;
                    return postDeclaration(declaration, { declarationIndex: 2 });
                })
                .then((response) => {
                    assert.strictEqual(response.results[0].code, 200);
                    assert.strictEqual(response.results[0].message, 'success');
                })
                .then(() => promiseUtil.delay(10000))
                .then(() => getPath('/mgmt/shared/service-discovery/task/~tenant~app~pool'))
                .then((response) => {
                    assert.strictEqual(response.result.routeDomain, 0);
                    assert.deepStrictEqual(
                        response.result.providerOptions,
                        {
                            type: 'event',
                            nodeList: [
                                {
                                    id: '/tenant/192.0.2.1',
                                    ip: '192.0.2.1'
                                }
                            ]
                        }
                    );
                })
                .finally(() => deleteDeclaration().then(() => deleteBigipItems(bigipItems)));
        });
    });
});

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

const assert = require('assert');

const serviceDiscovery = require('../../../src/lib/serviceDiscovery');

function createResourceDef() {
    return {
        path: '/tenant/app/item',
        item: {
            class: 'pool'
        }
    };
}

describe('serviceDiscovery', () => {
    describe('.createTask', () => {
        it('should generate the right nodePrefix', () => {
            const def = {};
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.nodePrefix, '/Test_Tenant/');
            assert.deepStrictEqual(task,
                {
                    id: '~tenant~j7DX2Ktq9~Jg1SlT1amXRQmotVMEdNdtluOD1lM~Tgs3D',
                    altId: [
                        '~tenant~jW7~YtK9kxiASiR2Ycl6Tbg4aD9uGmPRcVyN6QOIiM43D',
                        '~tenant~jW7~YtK9kxiASiR2Ycl6Tbg4aD9uGmPRcVyN6QOIiM43D'
                    ],
                    ignore: {},
                    metadata: {
                        configuredBy: 'AS3'
                    },
                    nodePrefix: '/Test_Tenant/',
                    provider: undefined,
                    providerOptions: {},
                    resources: [
                        {
                            options: {
                                connectionLimit: undefined,
                                dynamicRatio: undefined,
                                monitor: 'default',
                                priorityGroup: undefined,
                                rateLimit: undefined,
                                ratio: undefined,
                                servicePort: undefined,
                                session: undefined,
                                state: undefined
                            },
                            path: '/tenant/app/item',
                            type: 'pool'
                        }
                    ],
                    routeDomain: 0,
                    updateInterval: undefined
                });
        });

        it('should not prefix fqdn', () => {
            const def = {
                addressDiscovery: 'fqdn',
                bigip: 'testNode'
            };
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.nodePrefix, undefined);
        });

        it('should not prefix static', () => {
            const def = {
                addressDiscovery: 'fqdn',
                bigip: 'testNode'
            };
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.nodePrefix, undefined);
        });

        it('should handle undefined app id', () => {
            const def = {};
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.nodePrefix, '/Test_Tenant/');
        });

        it('should add azure specific properties', () => {
            const def = {
                addressDiscovery: 'azure',
                resourceId: 'my resource id',
                resourceType: 'my resource type',
                useManagedIdentity: true
            };
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.providerOptions.resourceId, 'my resource id');
            assert.strictEqual(task.providerOptions.resourceType, 'my resource type');
            assert.strictEqual(task.providerOptions.useManagedIdentity, true);
        });

        it('should handle Consul properties', () => {
            const def = {
                addressDiscovery: 'consul',
                addressRealm: 'addressRealm',
                uri: 'https://example.com/api',
                encodedToken: 'secret',
                trustCA: 'something',
                rejectUnauthorized: true,
                jmesPathQuery: '[*].{id:Node.Node,ip: {private:Node.Node}}',
                state: 'user-up',
                session: 'user-enabled'
            };
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.deepStrictEqual(task,
                {
                    id: '~tenant~WhJjLBRlmxeu3ARazJ5Q2Pq0l3w3w6SQVvdWe6hPKqM3D',
                    altId: [
                        '~tenant~EulxT8KHd2B6FVCDzAHpdZhGsEYBFEnCWDJAMqHms9Ic3D',
                        '~tenant~xbvw1lVgA4kI3Y2QsD02RsKnx7eer4~t~d4QAixdbUU3D'
                    ],
                    ignore: {
                        providerOptions: {
                            encodedToken: 'secret'
                        }
                    },
                    metadata: {
                        configuredBy: 'AS3'
                    },
                    nodePrefix: '/Test_Tenant/',
                    provider: 'consul',
                    providerOptions: {
                        addressRealm: 'addressRealm',
                        encodedToken: 'secret',
                        jmesPathQuery: '[*].{id:Node.Node,ip: {private:Node.Node}}',
                        rejectUnauthorized: true,
                        trustCA: 'something',
                        uri: 'https://example.com/api'
                    },
                    resources: [
                        {
                            options: {
                                connectionLimit: undefined,
                                dynamicRatio: undefined,
                                monitor: 'default',
                                priorityGroup: undefined,
                                rateLimit: undefined,
                                ratio: undefined,
                                servicePort: undefined,
                                session: 'user-enabled',
                                state: 'user-up'
                            },
                            path: '/tenant/app/item',
                            type: 'pool'
                        }
                    ],
                    routeDomain: 0,
                    updateInterval: undefined
                });
        });

        it('should give correct id for Address_Discovery case for event addressDiscovery', () => {
            const sdItem = {
                class: 'Address_Discovery',
                addressDiscovery: 'event',
                resources: [],
                path: '/tenant/app/item'
            };
            const task = serviceDiscovery.createTask(sdItem, 'tenant', []);
            assert.strictEqual(task.id, '~tenant~app~item');
        });

        it('should give correct id for Address_Discovery case for non-event addressDiscovery', () => {
            const sdItem = {
                class: 'Address_Discovery',
                addressDiscovery: 'azure',
                resourceId: 'my resource id',
                resourceType: 'my resource type',
                resources: [],
                path: '/tenant/app/item'
            };
            const task = serviceDiscovery.createTask(sdItem, 'tenant', []);
            assert.strictEqual(task.id, '~tenant~6Ky1JwY9UUAjKyh8iK02BAP8z78bfvTA7bV98OTa~v2BE3D');
        });

        it('should setup a gce provider task', () => {
            const def = {
                servicePort: 80,
                projectId: 'id-of-first-project',
                addressDiscovery: 'gce',
                updateInterval: 10,
                tagKey: 'foo',
                tagValue: 'bar',
                addressRealm: 'private',
                region: 'us-west1',
                encodedCredentials: 'base 64 encoded credentials',
                credentialUpdate: false,
                state: 'user-down',
                session: 'user-disabled'
            };

            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.deepStrictEqual(task,
                {
                    id: '~tenant~VpMhaXh4x8im2BBHPwarEfId0OyUearnGwmiiLGhykZk3D',
                    altId: [
                        '~tenant~46nl1TYNTeCj4iRvHi7pCSq3gepCq~CU4N7bLy3yAG43D',
                        '~tenant~Iw4jSkQw05TmqvbPJAums1N9Xu0YgHXevF5RaoO8W0Q3D'
                    ],
                    ignore: {
                        providerOptions: {
                            encodedCredentials: 'base 64 encoded credentials'
                        }
                    },
                    metadata: {
                        configuredBy: 'AS3'
                    },
                    nodePrefix: '/Test_Tenant/',
                    provider: 'gce',
                    providerOptions: {
                        addressRealm: 'private',
                        encodedCredentials: 'base 64 encoded credentials',
                        projectId: 'id-of-first-project',
                        region: 'us-west1',
                        tagKey: 'foo',
                        tagValue: 'bar'
                    },
                    resources: [
                        {
                            options: {
                                connectionLimit: undefined,
                                dynamicRatio: undefined,
                                monitor: 'default',
                                priorityGroup: undefined,
                                rateLimit: undefined,
                                ratio: undefined,
                                servicePort: 80,
                                state: 'user-down',
                                session: 'user-disabled'
                            },
                            path: '/tenant/app/item',
                            type: 'pool'
                        }
                    ],
                    routeDomain: 0,
                    updateInterval: 10
                });
        });

        it('should add routeDomain to task', () => {
            const def = {
                routeDomain: 99
            };
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.routeDomain, 99);
        });
    });

    describe('.generateTaskId', () => {
        it('should replace / with ~ and have no %\'s', () => {
            const task = {
                resources: [
                    {
                        type: 'pool',
                        path: '/test/Application/pool_www_demo_f5demo_aws_2',
                        options: {
                            servicePort: 80,
                            connectionLimit: 0,
                            rateLimit: 'disabled',
                            dynamicRatio: 1,
                            ratio: 1,
                            priorityGroup: 0,
                            monitor: 'default'
                        }
                    }
                ],
                nodePrefix: '/Common/',
                provider: 'aws',
                providerOptions: {
                    tagKey: 'demo-key',
                    tagValue: 'as3-webapp-tag-value',
                    addressRealm: 'public',
                    region: 'us-east-1c',
                    accessKeyId: 'correctAccessKey',
                    secretAccessKey: '$M$Cg$5fbTc4ydJOwuL9s76gZQpQ=='
                }
            };
            const tenantId = 'Common';
            const result = serviceDiscovery.generateTaskId(task, tenantId);
            assert.strictEqual(result, '~test~ZTLEoTH1iro2HJvs2BbLTv3WSK5ASckuxnnJ0nYsT1KM3D');
        });

        it('should encode uri without hashing when event provider', () => {
            const task = {
                resources: [
                    {
                        path: '/test/Application/pool_www_demo_f5demo_aws_2'
                    }
                ],
                provider: 'event'
            };
            const tenantId = 'Common';
            const result = serviceDiscovery.generateTaskId(task, tenantId);
            assert.strictEqual(result, '~test~Application~pool_www_demo_f5demo_aws_2');
        });

        it('should return the same task ID even though non-deterministic properties change', () => {
            // NOTE: This is not a valid declaration, I wanted to test "All Properties" in this function
            const task = {
                resources: [
                    {
                        type: 'pool',
                        path: '/test/Application/pool_www_demo_f5demo_aws_2',
                        options: {
                            servicePort: 80,
                            connectionLimit: 0,
                            rateLimit: 'disabled',
                            dynamicRatio: 1,
                            ratio: 1,
                            priorityGroup: 0,
                            monitor: 'default',
                            shareNodes: false,
                            routeDomain: 2,
                            remark: 'randomRemark',
                            minimumMonitors: 2,
                            metadata: 'randomMetadata'
                        }
                    }
                ],
                nodePrefix: '/test/',
                provider: 'aws',
                providerOptions: {
                    tagKey: 'demo-key',
                    tagValue: 'as3-webapp-tag-value',
                    addressRealm: 'public',
                    region: 'us-east-1c',
                    accessKeyId: 'correctAccessKey',
                    secretAccessKey: '$M$Cg$5fbTc4ydJOwuL9s76gZQpQ==',
                    uri: 'example.com/thingy',
                    jmesPathQuery: '[?Node==`consul-client`]',
                    projectId: 'medicalAppNetwork',
                    resourceGroup: 'cloud-shell-storage-eastus',
                    subscriptionId: 'abcdef01',
                    directoryId: 'funky',
                    applicationId: 'monkey',
                    resourceType: 'tag',
                    resourceId: 'amazingNodes',
                    environment: 'awsEnvironWest',
                    serverAddresses: ['192.0.2.35'],
                    servers: ['192.0.2.12'],
                    bigip: '/tenant/application/nodes/nodeId',
                    hostname: 'mymail.somecollege.edu',
                    fqdnPrefix: 'homeNodes',
                    addressFamily: 'IPv6',
                    autoPopulate: true,
                    updateInterval: 200,
                    enable: false,
                    adminState: 'disable',
                    queryInterval: 31,
                    downInterval: 124,
                    roleARN: 'randomRoleARN',
                    externalId: 'randomExternalId',
                    useManagedIdentity: true,
                    apiAccessKey: 'randomApiAccessKey',
                    credentialUpdate: false,
                    undetectableAction: 'remove',
                    encodedCredentials: 'randomEncodedCredentials',
                    encodedToken: 'randomEncodedToken',
                    trustCA: 'something',
                    rejectUnauthorized: true
                }
            };
            let result = serviceDiscovery.generateTaskId(task, 'Common');
            assert.strictEqual(result, '~test~tNiMCU9y~p440QyQ3~OiRZZRAnDfrvhe3z9oMSYZe2BU3D');

            // update properties that should not affect hash
            task.resources[0].options.connectionLimit = 10;
            task.resources[0].options.rateLimit = 390;
            task.resources[0].options.dynamicRatio = 28;
            task.resources[0].options.ratio = 8;
            task.resources[0].options.priorityGroup = 182;
            task.resources[0].options.monitor = 'otherMonitor';
            task.resources[0].options.remark = 'otherRemark';
            task.resources[0].options.minimumMonitors = 5;
            task.resources[0].options.metadata = 'otherMetadata';

            task.providerOptions.accessKeyId = 'otherAccessKey';
            task.providerOptions.secretAccessKey = 'otherSecret';
            task.providerOptions.updateInterval = 10000;
            task.providerOptions.enable = true;
            task.providerOptions.adminState = 'offline';
            task.providerOptions.queryInterval = 12;
            task.providerOptions.downInterval = 21234;
            task.providerOptions.roleARN = 'otherRoleARN';
            task.providerOptions.externalId = 'otherExternalId';
            task.providerOptions.useManagedIdentity = false;
            task.providerOptions.apiAccessKey = 'otherApiAccessKey';
            task.providerOptions.credentialUpdate = true;
            task.providerOptions.undetectableAction = 'disable';
            task.providerOptions.encodedCredentials = 'otherEncodedCreds';
            task.providerOptions.encodedToken = 'otherEncodedToken';
            task.providerOptions.trustCA = 'heyItIsSomethingElse';
            task.providerOptions.rejectUnauthorized = false;

            result = serviceDiscovery.generateTaskId(task, 'Common');
            assert.strictEqual(result, '~test~tNiMCU9y~p440QyQ3~OiRZZRAnDfrvhe3z9oMSYZe2BU3D');
        });
    });

    describe('createTaskResource', () => {
        it('should use resource.member when sdItem.class is Address_Discovery', () => {
            const sdItem = {
                class: 'Address_Discovery'
            };
            const resource = {
                item: {
                    class: 'Pool'
                },
                path: 'path/to/pool',
                member: {
                    servicePort: 80,
                    connectionLimit: 100,
                    rateLimit: 123,
                    dynamicRatio: 10,
                    ratio: 20,
                    priorityGroup: 1,
                    state: 'user-up',
                    session: 'user-enabled'
                }
            };

            const result = serviceDiscovery.createTaskResource(resource, sdItem);
            assert.deepStrictEqual(
                result,
                {
                    type: 'pool',
                    path: 'path/to/pool',
                    options: {
                        servicePort: 80,
                        connectionLimit: 100,
                        rateLimit: 123,
                        dynamicRatio: 10,
                        ratio: 20,
                        priorityGroup: 1,
                        state: 'user-up',
                        session: 'user-enabled',
                        monitor: 'default'
                    }
                }
            );
        });

        it('should use sdItem when class is not Address_Discovery', () => {
            const sdItem = {
                class: 'Pool',
                servicePort: 80,
                connectionLimit: 100,
                rateLimit: 123,
                dynamicRatio: 10,
                ratio: 20,
                priorityGroup: 1,
                state: 'user-up',
                session: 'user-enabled'
            };
            const resource = {
                item: {
                    class: 'Pool'
                },
                path: 'path/to/pool'
            };

            const result = serviceDiscovery.createTaskResource(resource, sdItem);
            assert.deepStrictEqual(
                result,
                {
                    type: 'pool',
                    path: 'path/to/pool',
                    options: {
                        servicePort: 80,
                        connectionLimit: 100,
                        rateLimit: 123,
                        dynamicRatio: 10,
                        ratio: 20,
                        priorityGroup: 1,
                        state: 'user-up',
                        session: 'user-enabled',
                        monitor: 'default'
                    }
                }
            );
        });

        it('should return an addressList when Firewall_Address_List is supplied', () => {
            const sdItem = {
                class: 'Firewall_Address_List',
                addresses: ['192.0.2.0/24']
            };
            const resource = {
                item: {
                    class: 'Firewall_Address_List'
                },
                path: 'example/path/here'
            };

            const result = serviceDiscovery.createTaskResource(resource, sdItem);
            assert.deepStrictEqual(
                result,
                {
                    options: {},
                    path: 'example/path/here',
                    type: 'addressList'
                }
            );
        });
    });

    describe('createTaskProvider', () => {
        it('should handle static nodes', () => {
            const sdItem = {
                enable: true,
                servicePort: 80,
                serverAddresses: ['192.0.2.4', '192.0.2.1'],
                servers: [
                    {
                        name: 'node1',
                        address: '192.0.2.8'
                    },
                    {
                        name: 'node2',
                        address: '192.0.2.12'
                    }
                ],
                routeDomain: 99,
                addressDiscovery: 'static',
                name: '/tenant/192.0.2.4%99:80'
            };
            const result = serviceDiscovery.createTaskProvider(sdItem);
            assert.deepStrictEqual(
                result,
                {
                    provider: 'static',
                    providerOptions: {
                        nodes: [
                            { id: '/tenant/192.0.2.4%99' },
                            { id: '/tenant/192.0.2.1%99' },
                            { id: '/tenant/node1' },
                            { id: '/tenant/node2' }
                        ]
                    },
                    ignore: {}
                }
            );
        });
    });
});

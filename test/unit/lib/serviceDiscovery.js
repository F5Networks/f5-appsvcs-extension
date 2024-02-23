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
                jmesPathQuery: '[*].{id:Node.Node,ip: {private:Node.Node}}'
            };
            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.providerOptions.addressRealm, def.addressRealm);
            assert.strictEqual(task.providerOptions.uri, def.uri);
            assert.strictEqual(task.providerOptions.encodedToken, def.encodedToken);
            assert.strictEqual(task.providerOptions.trustCA, def.trustCA);
            assert.strictEqual(task.providerOptions.rejectUnauthorized, def.rejectUnauthorized);
            assert.strictEqual(task.providerOptions.jmesPathQuery, def.jmesPathQuery);
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
            assert.strictEqual(task.id, '~tenant~kTTUt6yCc2BiuSWkaqdOIZZ8uCEFdyuw2ri6uG3CxbHc3D');
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
                credentialUpdate: false
            };

            const task = serviceDiscovery.createTask(def, 'Test_Tenant', [createResourceDef()]);
            assert.strictEqual(task.provider, 'gce');
            assert.strictEqual(task.nodePrefix, '/Test_Tenant/');
            assert.strictEqual(task.providerOptions.projectId, 'id-of-first-project');
            assert.strictEqual(task.providerOptions.tagKey, 'foo');
            assert.strictEqual(task.providerOptions.tagValue, 'bar');
            assert.strictEqual(task.providerOptions.encodedCredentials, 'base 64 encoded credentials');
            assert.strictEqual(task.ignore.providerOptions.encodedCredentials, 'base 64 encoded credentials');
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
            assert.strictEqual(result, '~test~mMIvv0aXGmrDh7GGUfsuQpdhn1XWlt8cr5irplpsxxU3D');
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
                nodePrefix: '/Common/',
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
            assert.strictEqual(result, '~test~ysTI96BUFaKiLusoITfgPFwPT3WMUYbg3jfZPYODP383D');

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
            assert.strictEqual(result, '~test~ysTI96BUFaKiLusoITfgPFwPT3WMUYbg3jfZPYODP383D');
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

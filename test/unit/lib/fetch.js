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

const EventEmitter = require('events');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const nock = require('nock');

const atgStorage = require('@f5devcentral/atg-storage');
const fetch = require('../../../src/lib/fetch');
const util = require('../../../src/lib/util/util');
const log = require('../../../src/lib/log');
const Context = require('../../../src/lib/context/context');
const constants = require('../../../src/lib/constants');
const mapCli = require('../../../src/lib/map_cli');
const fullPathList = require('../../../src/lib/paths.json');

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('fetch', () => {
    let context;

    afterEach('restore logging', () => {
        sinon.restore();
        nock.cleanAll();
    });

    beforeEach(() => {
        sinon.stub(log, 'warning').resolves();
        context = Context.build();
        context.tasks.push({ tenantsInPath: [], urlPrefix: 'http://localhost:8100' });
        context.target = {
            deviceType: constants.DEVICE_TYPES.BIG_IP,
            provisionedModules: [],
            tmosVersion: '0.0.0',
            tokens: {}
        };
        context.control = {
            port: 8100
        };
    });

    describe('.getBigipConfig', () => {
        describe('Promise chain', () => {
            let testPath;
            beforeEach(() => {
                context.target = {
                    tmosVersion: '14.1.0'
                };
                testPath = [
                    'https://localhost/mgmt/tm/ltm/pool/~test~test~testapp_pool/members'
                ];
            });

            afterEach(() => {
                sinon.restore();
            });

            it('should return empty config if error is 404', () => {
                sinon.stub(util, 'iControlRequest').rejects(
                    new Error(`body=${JSON.stringify({
                        error: {
                            code: 404,
                            message: '',
                            innererror: {
                                referer: 'restnoded',
                                originalRequestBody: '',
                                errorStack: []
                            }
                        }
                    })}`)
                );

                assert.isFulfilled(fetch.getBigipConfig(context, testPath, 'Common')
                    .then((config) => {
                        assert.deepStrictEqual(config, []);
                    }));
            });

            it('should rethrow error if error is not 404', () => {
                sinon.stub(util, 'iControlRequest').rejects(
                    new Error(`body=${JSON.stringify({
                        error: {
                            code: 500,
                            message: '',
                            innererror: {
                                referer: 'restnoded',
                                originalRequestBody: '',
                                errorStack: []
                            }
                        }
                    })}`)
                );

                let caught = false;
                fetch.getBigipConfig(context, testPath, 'Common')
                    .catch(() => {
                        caught = true;
                    })
                    .then((config) => {
                        assert.isUndefined(config);
                        assert.isTrue(caught);
                    });
            });

            it('should return the proper configs for APM Access Profiles', () => {
                testPath = [
                    '/mgmt/tm/ltm/pool/~thePartition~other-pool/members'
                ];
                sinon.stub(util, 'executeBashCommand').resolves('aaa_saml_server    /thePartition/accessProfile-sp_transfer\ncertificate_file_object      /thePartition/accessProfile-portal-sts.leidos.com.crt\npool               /thePartition/accessProfile-AD_Pool-pool\npool               /thePartition/accessProfile-AD_Pool-emptyPool');
                nock('http://localhost:8100')
                    .get('/mgmt/tm/ltm/pool/~thePartition~other-pool/members?$filter=partition%20eq%20thePartition')
                    .reply(200, {
                        kind: 'tm:ltm:pool:members:memberscollectionstate',
                        items: [
                            {
                                kind: 'tm:ltm:pool:members:membersstate',
                                name: '10.4.5.6:21',
                                partition: 'thePartition',
                                fullPath: '/thePartition/10.4.5.6:21',
                                address: '10.4.5.6',
                                ephemeral: 'false'
                            }
                        ]
                    })
                    .get('/mgmt/tm/ltm/pool/~thePartition~accessProfile-AD_Pool-pool/members')
                    .reply(200, {
                        kind: 'tm:ltm:pool:members:memberscollectionstate',
                        items: [
                            {
                                kind: 'tm:ltm:pool:members:membersstate',
                                name: '10.0.0.1:0',
                                partition: 'thePartition',
                                fullPath: '/thePartition/10.0.0.1:0',
                                address: '10.0.0.1',
                                ephemeral: 'false'
                            },
                            {
                                kind: 'tm:ltm:pool:members:membersstate',
                                name: '10.1.2.3',
                                partition: 'thePartition',
                                fullPath: '/thePartition/10.1.2.3',
                                address: '10.1.2.3',
                                ephemeral: 'false'
                            }
                        ]
                    })
                    .get('/mgmt/tm/ltm/pool/~thePartition~accessProfile-AD_Pool-emptyPool/members')
                    .reply(200, {
                        kind: 'tm:ltm:pool:members:memberscollectionstate',
                        items: []
                    });

                return assert.becomes(
                    fetch.getBigipConfig(context, testPath, 'thePartition'),
                    [{
                        kind: 'tm:ltm:pool:members:membersstate',
                        name: '10.4.5.6:21',
                        partition: 'thePartition',
                        fullPath: '/thePartition/10.4.5.6:21',
                        address: '10.4.5.6',
                        ephemeral: 'false'
                    }]
                );
            });
        });

        describe('paths', () => {
            let pathsSent;
            beforeEach(() => {
                pathsSent = [];
                sinon.stub(util, 'iControlRequest').callsFake((_context, icrOptions) => {
                    pathsSent.push(icrOptions.path);
                    return Promise.resolve([]);
                });
            });

            afterEach(() => {
                util.iControlRequest.restore();
            });

            it('should process path of type string', () => {
                context.target = {
                    tmosVersion: '14.1.0',
                    provisionedModules: ['asm']
                };

                const testPath = [
                    'https://localhost/mgmt/tm/ltm/pool/~test~test~testapp_pool/members'
                ];

                return fetch.getBigipConfig(context, testPath, 'test')
                    .then((config) => {
                        assert.deepStrictEqual(config, []);
                        assert.strictEqual(pathsSent.length, 1);
                        assert.strictEqual(pathsSent[0], 'https://localhost/mgmt/tm/ltm/pool/~test~test~testapp_pool/members?$filter=partition%20eq%20test');
                    });
            });

            it('should filter modules', () => {
                context.target = {
                    tmosVersion: '14.1.0',
                    provisionedModules: ['asm']
                };

                const testPaths = [
                    {
                        endpoint: '/mgmt/tm/needs/asm',
                        modules: ['asm']
                    },
                    {
                        endpoint: '/mgmt/tm/needs/afm',
                        modules: ['afm']
                    }
                ];

                return fetch.getBigipConfig(context, testPaths, 'Common')
                    .then((config) => {
                        assert.deepStrictEqual(config, []);
                        assert.strictEqual(pathsSent.length, 1);
                        assert.strictEqual(pathsSent[0], '/mgmt/tm/needs/asm?$filter=partition%20eq%20Common');
                    });
            });

            it('should map minimumVersion', () => {
                context.target = {
                    tmosVersion: '14.1'
                };

                const testPaths = [
                    {
                        endpoint: '/mgmt/tm/needs140',
                        minimumVersion: '14.0'
                    },
                    {
                        endpoint: '/mgmt/tm/needs141',
                        minimumVersion: '14.1'
                    }
                ];

                return fetch.getBigipConfig(context, testPaths, 'Common')
                    .then((config) => {
                        assert.deepStrictEqual(config, []);
                        assert.strictEqual(pathsSent.length, 1);
                        assert.strictEqual(pathsSent[0], '/mgmt/tm/needs140?$filter=partition%20eq%20Common');
                    });
            });

            it('should add select query parameter', () => {
                context.target = {
                    tmosVersion: '14.1.0',
                    provisionedModules: ['asm']
                };

                const testPath = [
                    {
                        endpoint: '/mgmt/tm/asm/policies',
                        select: 'fullPath,name',
                        modules: ['asm']
                    }
                ];

                return fetch.getBigipConfig(context, testPath, 'Common')
                    .then((config) => {
                        assert.deepStrictEqual(config, []);
                        assert.strictEqual(pathsSent.length, 1);
                        assert.strictEqual(pathsSent[0], '/mgmt/tm/asm/policies?$filter=partition%20eq%20Common&$select=fullPath,name');
                    });
            });

            it('should add expandSubcollections query parameter', () => {
                context.target = {
                    tmosVersion: '14.1.0',
                    provisionedModules: ['asm']
                };

                const testPath = [
                    {
                        endpoint: '/mgmt/tm/ltm/pool',
                        expand: true
                    }
                ];

                return fetch.getBigipConfig(context, testPath, 'Common')
                    .then((config) => {
                        assert.deepStrictEqual(config, []);
                        assert.strictEqual(pathsSent.length, 1);
                        assert.strictEqual(pathsSent[0], '/mgmt/tm/ltm/pool?$filter=partition%20eq%20Common&expandSubcollections=true');
                    });
            });

            it('should return net address- and port-list before firewall address- and port-list', () => {
                // Since firewall address- and port-list and net address- and port-list share the same path, we benefit
                // from utilizing the firewall address- and port-list (if it is available). As such, if we order
                // paths.json with net address- and port-list first and firewall second, the net address- and port-list
                // will be overwritten, if a firewall address- and/or port-list is available.
                util.iControlRequest.restore();
                sinon.stub(util, 'iControlRequest').callsFake((_context, icrOptions) => {
                    pathsSent.push(icrOptions.path);
                    switch (icrOptions.path) {
                    case '/mgmt/tm/net/address-list?$filter=partition%20eq%20testTen':
                        return Promise.resolve({
                            kind: 'tm:net:address-list:address-listcollectionstate',
                            items: [
                                {
                                    kind: 'tm:net:address-list:address-liststate',
                                    name: 'addressListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/addressListExample',
                                    addresses: ['192.0.2.0/24']
                                }
                            ]
                        });
                    case '/mgmt/tm/net/port-list?$filter=partition%20eq%20testTen':
                        return Promise.resolve({
                            kind: 'tm:net:port-list:port-listcollectionstate',
                            items: [
                                {
                                    kind: 'tm:net:port-list:port-liststate',
                                    name: 'portListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/portListExample',
                                    ports: [80, 8080]
                                }
                            ]
                        });
                    case '/mgmt/tm/security/firewall/address-list?$filter=partition%20eq%20testTen':
                        return Promise.resolve({
                            kind: 'tm:security:firewall:address-list:address-listcollectionstate',
                            items: [
                                {
                                    kind: 'tm:security:firewall:address-list:address-liststate',
                                    name: 'addressListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/addressListExample',
                                    addresses: ['192.0.2.0/24']
                                }
                            ]
                        });
                    case '/mgmt/tm/security/firewall/port-list?$filter=partition%20eq%20testTen':
                        return Promise.resolve({
                            kind: 'tm:security:firewall:port-list:port-listcollectionstate',
                            items: [
                                {
                                    kind: 'tm:security:firewall:port-list:port-liststate',
                                    name: 'portListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/portListExample',
                                    ports: [80, 8080]
                                }
                            ]
                        });
                    default:
                        return Promise.resolve([]);
                    }
                });

                context.target = {
                    tmosVersion: '14.1.0',
                    provisionedModules: ['asm', 'afm']
                };

                return fetch.getBigipConfig(context, fullPathList.root, 'testTen')
                    .then((config) => {
                        assert.deepStrictEqual(
                            config,
                            [
                                {
                                    kind: 'tm:net:address-list:address-liststate',
                                    name: 'addressListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/addressListExample',
                                    addresses: ['192.0.2.0/24']
                                },
                                {
                                    kind: 'tm:net:port-list:port-liststate',
                                    name: 'portListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/portListExample',
                                    ports: [80, 8080]
                                },
                                {
                                    kind: 'tm:security:firewall:address-list:address-liststate',
                                    name: 'addressListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/addressListExample',
                                    addresses: ['192.0.2.0/24']
                                },
                                {
                                    kind: 'tm:security:firewall:port-list:port-liststate',
                                    name: 'portListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/portListExample',
                                    ports: [80, 8080]
                                }
                            ]
                        );
                    });
            });

            it('should return firewall address- and port-list if on BIG-IP version 13.1', () => {
                // net address- and port-lists are not on 13.1, so we need to confirm that it is not queried
                util.iControlRequest.restore();
                sinon.stub(util, 'iControlRequest').callsFake((_context, icrOptions) => {
                    pathsSent.push(icrOptions.path);
                    switch (icrOptions.path) {
                    case '/mgmt/tm/net/address-list?$filter=partition%20eq%20testTen':
                        throw new Error('Should not have queried net address-list endpoint');
                    case '/mgmt/tm/net/port-list?$filter=partition%20eq%20testTen':
                        throw new Error('Should not have queried net port-list endpoint');
                    case '/mgmt/tm/security/firewall/address-list?$filter=partition%20eq%20testTen':
                        return Promise.resolve({
                            kind: 'tm:security:firewall:address-list:address-listcollectionstate',
                            items: [
                                {
                                    kind: 'tm:security:firewall:address-list:address-liststate',
                                    name: 'addressListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/addressListExample',
                                    addresses: ['192.0.2.0/24']
                                }
                            ]
                        });
                    case '/mgmt/tm/security/firewall/port-list?$filter=partition%20eq%20testTen':
                        return Promise.resolve({
                            kind: 'tm:security:firewall:port-list:port-listcollectionstate',
                            items: [
                                {
                                    kind: 'tm:security:firewall:port-list:port-liststate',
                                    name: 'portListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/portListExample',
                                    addresses: [80, 8080]
                                }
                            ]
                        });
                    default:
                        return Promise.resolve([]);
                    }
                });

                context.target = {
                    tmosVersion: '13.1.0',
                    provisionedModules: ['asm', 'afm']
                };

                return fetch.getBigipConfig(context, fullPathList.root, 'testTen')
                    .then((config) => {
                        assert.deepStrictEqual(
                            config,
                            [
                                {
                                    kind: 'tm:security:firewall:address-list:address-liststate',
                                    name: 'addressListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/addressListExample',
                                    addresses: ['192.0.2.0/24']
                                },
                                {
                                    kind: 'tm:security:firewall:port-list:port-liststate',
                                    name: 'portListExample',
                                    partition: 'testTen',
                                    fullPath: '/testTen/testApp/portListExample',
                                    addresses: [80, 8080]
                                }
                            ]
                        );
                    });
            });
        });
    });

    describe('pathReferenceLinks', () => {
        let referredList;
        let tenantId;
        let partitionConfig;
        let pathsSent;

        beforeEach(() => {
            pathsSent = [];
            sinon.stub(util, 'iControlRequest').callsFake((_context, icrOptions) => {
                pathsSent.push(icrOptions.path);
                return Promise.resolve([]);
            });

            referredList = [
                {
                    endpoint: 'networkReference',
                    modules: ['afm']
                },
                {
                    endpoint: 'protocolDnsReference',
                    modules: ['afm']
                },
                {
                    endpoint: 'protocolSipReference',
                    modules: ['afm']
                },
                {
                    endpoint: 'testAsmReference',
                    module: ['asm']
                },
                {
                    endpoint: 'testReference'
                },
                {
                    endpoint: 'applicationReference'
                }
            ];

            tenantId = 'Tenant';

            partitionConfig = [
                {
                    kind: 'tm:auth:partition:partitionstate',
                    name: 'Tenant',
                    fullPath: 'Tenant',
                    generation: 102260,
                    selfLink: 'https://localhost/mgmt/tm/auth/partition/Tenant?ver=16.1.2',
                    defaultRouteDomain: 0,
                    description: 'Updated by AS3 at Wed, 24 Aug 2022 16:07:11 GMT'
                },
                {
                    kind: 'tm:sys:folder:folderstate',
                    name: 'Application',
                    partition: 'Tenant',
                    fullPath: '/Tenant/Application',
                    generation: 102259,
                    selfLink: 'https://localhost/mgmt/tm/sys/folder/~Tenant~Application?ver=16.1.2',
                    deviceGroup: 'none',
                    hidden: 'false',
                    inheritedDevicegroup: true,
                    inheritedTrafficGroup: true,
                    noRefCheck: false,
                    trafficGroup: '/Common/traffic-group-1',
                    trafficGroupReference: {
                        link: 'https://localhost/mgmt/tm/cm/traffic-group/~Common~traffic-group-1?ver=16.1.2'
                    }
                },
                {
                    kind: 'tm:security:log:profile:profilestate',
                    name: 'asm_logging_profile_for_splunk',
                    partition: 'Tenant',
                    subPath: 'Application',
                    fullPath: '/Tenant/Application/asm_logging_profile_for_splunk',
                    generation: 102260,
                    selfLink: 'https://localhost/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk?ver=16.1.2',
                    builtIn: 'disabled',
                    hidden: 'false',
                    ipIntelligence: {
                        aggregateRate: 4294967295,
                        logGeo: 'disabled',
                        logShun: 'disabled',
                        logTranslationFields: 'disabled'
                    },
                    applicationReference: {
                        link: 'https://localhost/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/application?ver=16.1.2',
                        isSubcollection: true
                    },
                    networkReference: {
                        link: 'https://localhost/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/network?ver=16.1.2',
                        isSubcollection: true
                    },
                    protocolDnsReference: {
                        link: 'https://localhost/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/protocol-dns?ver=16.1.2',
                        isSubcollection: true
                    },
                    protocolSipReference: {
                        link: 'https://localhost/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/protocol-sip?ver=16.1.2',
                        isSubcollection: true
                    }
                }
            ];
        });

        afterEach(() => {
            util.iControlRequest.restore();
        });

        it('no modules provisioned', () => {
            context.target = {
                tmosVersion: '14.1.0',
                provisionedModules: []
            };

            return fetch.pathReferenceLinks(context, referredList, tenantId, partitionConfig)
                .then((config) => {
                    assert.deepStrictEqual(config, []);
                    assert.strictEqual(pathsSent.length, 1);
                    assert.strictEqual(pathsSent[0], '/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/application?$filter=partition%20eq%20Tenant');
                });
        });

        it('modules provisioned', () => {
            context.target = {
                tmosVersion: '14.1.0',
                provisionedModules: ['afm']
            };

            return fetch.pathReferenceLinks(context, referredList, tenantId, partitionConfig)
                .then((config) => {
                    assert.deepStrictEqual(config, []);
                    assert.strictEqual(pathsSent.length, 4);
                    assert.strictEqual(pathsSent[0], '/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/network?$filter=partition%20eq%20Tenant');
                    assert.strictEqual(pathsSent[1], '/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/protocol-dns?$filter=partition%20eq%20Tenant');
                    assert.strictEqual(pathsSent[2], '/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/protocol-sip?$filter=partition%20eq%20Tenant');
                    assert.strictEqual(pathsSent[3], '/mgmt/tm/security/log/profile/~Tenant~Application~asm_logging_profile_for_splunk/application?$filter=partition%20eq%20Tenant');
                });
        });
    });

    describe('.isAs3Item', () => {
        it('should indicate this is an As3 Item', () => {
            const testCases = [
                {
                    // The description means this is an AS3 topology
                    item: {
                        description: 'This object is managed by appsvcs, do not modify this description',
                        kind: 'tm:gtm:topology:topologystate',
                        name: 'ldns: state AF/Badakhshan server: country AF',
                        fullPath: 'ldns: state AF/Badakhshan server: country AF',
                        generation: 1812,
                        selfLink: 'https://localhost/mgmt/tm/gtm/topology/ldns:%20state%20AF~Badakhshan%20server:%20country%20AF?ver=13.1.1',
                        order: 1,
                        score: 1
                    },
                    partition: 'any_partition'
                }
            ];

            testCases.forEach((testCase) => {
                assert.deepStrictEqual(fetch.isAs3Item(context, testCase.item, testCase.partition), true);
            });
        });

        it('should indicate this is not an As3 Item', () => {
            const testCases = [
                {
                    // No description means this is not AS3 topology
                    item: {
                        kind: 'tm:gtm:topology:topologystate',
                        name: 'ldns: state AF/Badakhshan server: country AF',
                        fullPath: 'ldns: state AF/Badakhshan server: country AF',
                        generation: 1812,
                        selfLink: 'https://localhost/mgmt/tm/gtm/topology/ldns:%20state%20AF~Badakhshan%20server:%20country%20AF?ver=13.1.1',
                        order: 1,
                        score: 1
                    },
                    partition: 'any_partition'
                }
            ];

            testCases.forEach((testCase) => {
                assert.deepStrictEqual(fetch.isAs3Item(context, testCase.item, testCase.partition), false);
            });
        });

        it('should return false when in filter', () => {
            const item = {
                fullPath: '/thePartition/accessProfile-cert.crt'
            };
            const filter = ['/thePartition/accessProfile-cert.crt'];
            const result = fetch.isAs3Item(context, item, 'thePartition', filter);
            assert.equal(result, false);
        });

        it('should return false when metadata contains something with a name in ignoreMetadata', () => {
            const item = {
                kind: '',
                metadata: [
                    {
                        name: 'appsvcs-discovery'
                    }
                ]
            };
            const result = fetch.isAs3Item(context, item, 'thePartition');
            assert.equal(result, false);
        });

        it('should return true when metadata has name of as3', () => {
            const item = {
                kind: '',
                metadata: [
                    {
                        name: 'as3'
                    }
                ]
            };
            const result = fetch.isAs3Item(context, item, 'thePartition');
            assert.equal(result, true);
        });

        it('should return true when service discovery task with metadata', () => {
            const item = {
                kind: 'shared:service-discovery:taskstate',
                id: '~thePartition~theApp~theItem',
                metadata: {
                    configuredBy: 'AS3'
                }
            };
            const result = fetch.isAs3Item(context, item, 'thePartition');
            assert.equal(result, true);
        });

        it('should return true when item.kind is a gtm pool member', () => {
            ['a', 'aaaa', 'cname', 'mx'].forEach((type) => {
                const item = {
                    kind: `tm:gtm:pool:${type}:members:membersstate`
                };
                const result = fetch.isAs3Item(context, item, 'Common');
                assert.strictEqual(result, true, `${item.kind} should return true`);
            });
        });

        it('should return true when item.kind is a snat-translation', () => {
            const item = {
                kind: 'tm:ltm:snat-translation:snat-translationstate'
            };
            const result = fetch.isAs3Item(context, item, 'thePartition');
            assert.strictEqual(result, true, `${item.kind} should return true`);
        });
    });

    describe('.getDiff', () => {
        beforeEach(() => {
            sinon.stub(util, 'iControlRequest').resolves({
                statusCode: 200,
                body: JSON.stringify({
                    'no-items': true
                })
            });
        });

        afterEach(() => {
            util.iControlRequest.restore();
        });

        it('should return diff from apm profile access ignoreChanges = false', () => {
            const currentConfig = {
                '/Access_Profile/accessProfile': {
                    command: 'apm profile access',
                    properties: {},
                    ignore: []
                }
            };
            const desiredConfig = {
                '/Access_Profile/accessProfile': {
                    command: 'apm profile access',
                    properties: {
                        ignoreChanges: false,
                        iControl_postFromRemote: {
                            get: {
                                path: 'https://example.com/example.tar',
                                rejectUnauthorized: true,
                                method: 'GET',
                                ctype: 'application/octet-stream',
                                why: 'get Access Profile accessProfile from url'
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/accessProfile.tar',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload Access Profile accessProfile',
                                settings: {
                                    class: 'Access_Profile',
                                    url: 'https://example.com/example.tar',
                                    ignoreChanges: false
                                }
                            }
                        }
                    },
                    ignore: []
                }
            };
            const commonConfig = {
                nodeList: []
            };

            return assert.isFulfilled(fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {}), 'Promise should not reject')
                .then((results) => {
                    assert.strictEqual(results.length, 1);
                    assert.deepStrictEqual(results[0], {
                        kind: 'N',
                        path: [
                            '/Access_Profile/accessProfile'
                        ],
                        rhs: {
                            command: 'apm profile access',
                            properties: {
                                ignoreChanges: false,
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/example.tar',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Profile accessProfile from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/accessProfile.tar',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Profile accessProfile',
                                        settings: {
                                            class: 'Access_Profile',
                                            url: 'https://example.com/example.tar',
                                            ignoreChanges: false
                                        }
                                    }
                                },
                                edit: true
                            },
                            ignore: []
                        }
                    });
                });
        });

        it('should return diff from apm policy access-policy ignoreChanges = false', () => {
            const currentConfig = {
                '/Per_Request_Access_Policy/accessPolicy': {
                    command: 'apm policy access-policy',
                    properties: {},
                    ignore: []
                }
            };
            const desiredConfig = {
                '/Per_Request_Access_Policy/accessPolicy': {
                    command: 'apm policy access-policy',
                    properties: {
                        ignoreChanges: false,
                        iControl_postFromRemote: {
                            get: {
                                path: 'https://example.com/example.tar',
                                rejectUnauthorized: true,
                                method: 'GET',
                                ctype: 'application/octet-stream',
                                why: 'get Access Policy accessPolicy from url'
                            },
                            post: {
                                path: '/mgmt/shared/file-transfer/uploads/accessPolicy.tar',
                                method: 'POST',
                                ctype: 'application/octet-stream',
                                why: 'upload Access Policy accessPolicy',
                                settings: {
                                    class: 'Per_Request_Access_Policy',
                                    url: 'https://example.com/example.tar',
                                    ignoreChanges: false
                                }
                            }
                        }
                    },
                    ignore: []
                }
            };
            const commonConfig = {
                nodeList: []
            };

            return assert.isFulfilled(fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {}), 'Promise should not reject')
                .then((results) => {
                    assert.strictEqual(results.length, 1);
                    assert.deepStrictEqual(results[0], {
                        kind: 'N',
                        path: [
                            '/Per_Request_Access_Policy/accessPolicy'
                        ],
                        rhs: {
                            command: 'apm policy access-policy',
                            properties: {
                                ignoreChanges: false,
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/example.tar',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Policy accessPolicy from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/accessPolicy.tar',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Policy accessPolicy',
                                        settings: {
                                            class: 'Per_Request_Access_Policy',
                                            url: 'https://example.com/example.tar',
                                            ignoreChanges: false
                                        }
                                    }
                                },
                                edit: true
                            },
                            ignore: []
                        }
                    });
                });
        });

        it('should return diff deleting a snat pool in Common Shared but not the matching snat translation', () => {
        // When a snat pool is deleted BIGIP will check and delete any snat translations that are no longer needed
            const currentConfig = {
                '/Common/Shared/CreateSnatPool3': {
                    command: 'ltm snatpool',
                    properties: {
                        members: {
                            '/Common/192.0.2.12': {},
                            '/Common/192.0.2.13': {}
                        }
                    },
                    ignore: []
                },
                '/Common/192.0.2.12': {
                    command: 'ltm snat-translation',
                    properties: {
                        address: '192.0.2.12',
                        arp: 'enabled',
                        'connection-limit': 0,
                        enabled: {},
                        'ip-idle-timeout': 'indefinite',
                        'tcp-idle-timeout': 'indefinite',
                        'traffic-group': 'default',
                        'udp-idle-timeout': 'indefinite'
                    },
                    ignore: []
                },
                '/Common/192.0.2.13': {
                    command: 'ltm snat-translation',
                    properties: {
                        address: '192.0.2.13',
                        arp: 'enabled',
                        'connection-limit': 0,
                        enabled: {},
                        'ip-idle-timeout': 'indefinite',
                        'tcp-idle-timeout': 'indefinite',
                        'traffic-group': 'default',
                        'udp-idle-timeout': 'indefinite'
                    },
                    ignore: []
                },
                '/Common/Shared/': {
                    command: 'sys folder',
                    properties: {},
                    ignore: []
                }
            };

            const desiredConfig = {};

            const commonConfig = {
                nodeList: []
            };

            return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, 'Common')
                .catch(() => {
                    assert.fail('Promise should not reject');
                })
                .then((results) => {
                    assert.deepStrictEqual(results, [
                        {
                            kind: 'D',
                            path: [
                                '/Common/Shared/CreateSnatPool3'
                            ],
                            lhs: {
                                command: 'ltm snatpool',
                                properties: {
                                    members: {
                                        '/Common/192.0.2.12': {},
                                        '/Common/192.0.2.13': {}
                                    }
                                },
                                ignore: []
                            }
                        },
                        {
                            kind: 'D',
                            path: [
                                '/Common/Shared/'
                            ],
                            lhs: {
                                command: 'sys folder',
                                properties: {},
                                ignore: []
                            }
                        }
                    ]);
                });
        });

        it('should return diff but remove default-from from protocol inspection profiles', () => {
            const currentConfig = {
                '/myApp/Application1/gjd-inspect-profile': {
                    command: 'security protocol-inspection profile',
                    properties: {
                        'avr-stat-collect': 'on',
                        'defaults-from': '/Common/protocol_inspection'
                    },
                    ignore: []
                }
            };
            const desiredConfig = {
                '/myApp/Application1/gjd-inspect-profile': {
                    command: 'security protocol-inspection profile',
                    properties: {
                        'avr-stat-collect': 'off'
                    },
                    ignore: []
                }
            };
            const commonConfig = {
                nodeList: []
            };
            return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                .catch(() => {
                    assert.fail('Promise should not reject');
                })
                .then((results) => {
                    assert.strictEqual(results.length, 1);
                    assert.deepStrictEqual(results[0], {
                        kind: 'E',
                        lhs: 'on',
                        path: ['/myApp/Application1/gjd-inspect-profile', 'properties', 'avr-stat-collect'],
                        rhs: 'off'
                    });
                });
        });

        // TODO: remove this unit test, when virtual-address per-app meta-data handling is complete
        it('should remove virtual-address deletes when hanlding a per-app POST', () => {
            context.request = {
                method: 'Post',
                isPerApp: true,
                perAppInfo: {
                    tenant: 'tenant1',
                    decl: {}, // Abbreviated for testing
                    apps: ['app1']
                }
            };
            const currentConfig = {
                '/tenant1/':
                {
                    command: 'auth partition',
                    properties: { 'default-route-domain': 0 },
                    ignore: []
                },
                '/tenant1/app1/testItem':
                {
                    command: 'ltm virtual',
                    properties:
                    {
                        enabled: true,
                        'address-status': 'yes',
                        'auto-lasthop': 'default',
                        'connection-limit': 0,
                        'rate-limit': 'disabled',
                        description: '"description"',
                        destination: '/tenant1/192.0.2.200:123',
                        'ip-protocol': 'tcp',
                        'last-hop-pool': 'none',
                        mask: '255.255.255.255',
                        mirror: 'disabled',
                        persist: {
                            '/Common/source_addr': {
                                default: 'yes'
                            }
                        },
                        policies: {},
                        profiles: {},
                        'service-down-immediate-action': 'none',
                        source: '0.0.0.0/0',
                        'source-address-translation': {
                            type: 'automap'
                        },
                        rules: {},
                        'security-log-profiles': {},
                        'source-port': 'preserve',
                        'translate-address': 'enabled',
                        'translate-port': 'enabled',
                        nat64: 'disabled',
                        vlans: {},
                        'vlans-disabled': ' ',
                        metadata: {},
                        'clone-pools': {},
                        'throughput-capacity': 'infinite'
                    },
                    ignore: []
                },
                '/tenant1/Service_Address-192.0.2.200':
                {
                    command: 'ltm virtual-address',
                    properties:
                    {
                        address: '192.0.2.200',
                        arp: 'enabled',
                        'icmp-echo': 'enabled',
                        mask: '255.255.255.255',
                        'route-advertisement': 'disabled',
                        spanning: 'disabled',
                        'traffic-group': 'default'
                    },
                    ignore: []
                },
                '/tenant1/Service_Address-192.0.2.1':
                {
                    command: 'ltm virtual-address',
                    properties:
                    {
                        address: '192.0.2.1',
                        arp: 'enabled',
                        'icmp-echo': 'enabled',
                        mask: '255.255.255.255',
                        'route-advertisement': 'disabled',
                        spanning: 'disabled',
                        'traffic-group': 'default'
                    },
                    ignore: []
                },
                '/tenant1/app1/': {
                    command: 'sys folder', properties: {}, ignore: []
                }
            };
            const desiredConfig = {
                '/tenant1/app1/': { command: 'sys folder', properties: {}, ignore: [] },
                '/tenant1/Service_Address-192.0.2.100':
                {
                    command: 'ltm virtual-address',
                    properties:
                    {
                        address: '192.0.2.100',
                        arp: 'enabled',
                        'icmp-echo': 'enabled',
                        mask: '255.255.255.255',
                        'route-advertisement': 'disabled',
                        spanning: 'disabled',
                        'traffic-group': 'default'
                    },
                    ignore: []
                },
                '/tenant1/app1/testItem':
                {
                    command: 'ltm virtual',
                    properties:
                    {
                        enabled: true,
                        'address-status': 'yes',
                        'auto-lasthop': 'default',
                        'connection-limit': 0,
                        'rate-limit': 'disabled',
                        description: '"description"',
                        destination: '/tenant1/192.0.2.100:123',
                        'ip-protocol': 'tcp',
                        'last-hop-pool': 'none',
                        mask: '255.255.255.255',
                        mirror: 'disabled',
                        persist: {
                            '/Common/source_addr': {
                                default: 'yes'
                            }
                        },
                        policies: {},
                        profiles: {},
                        'service-down-immediate-action': 'none',
                        source: '0.0.0.0/0',
                        'source-address-translation': {
                            type: 'automap'
                        },
                        rules: {},
                        'security-log-profiles': {},
                        'source-port': 'preserve',
                        'translate-address': 'enabled',
                        'translate-port': 'enabled',
                        nat64: 'disabled',
                        vlans: {},
                        'vlans-disabled': ' ',
                        metadata: {},
                        'clone-pools': {},
                        'throughput-capacity': 'infinite'
                    },
                    ignore: []
                },
                '/tenant1/':
                {
                    command: 'auth partition',
                    properties: { 'default-route-domain': 0 },
                    ignore: []
                }
            };
            const commonConfig = {
                nodeList: [
                    {
                        fullPath: '/tenant1/192.0.2.10',
                        partition: 'tenant1',
                        ephemeral: false,
                        metadata: undefined,
                        commonNode: false,
                        domain: '',
                        key: '192.0.2.10'
                    },
                    {
                        fullPath: '/tenant1/192.0.2.20',
                        partition: 'tenant1',
                        ephemeral: false,
                        metadata: undefined,
                        commonNode: false,
                        domain: '',
                        key: '192.0.2.20'
                    }],
                virtualAddressList: []
            };
            return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                .catch(() => {
                    assert.fail('Promise should not reject');
                })
                .then((results) => {
                    // Should be empty if attempting to Delete
                    assert.strictEqual(results.length, 2);
                    assert.deepStrictEqual(results,
                        [
                            {
                                kind: 'E',
                                path: ['/tenant1/app1/testItem', 'properties', 'destination'],
                                lhs: '/tenant1/192.0.2.200:123',
                                rhs: '/tenant1/192.0.2.100:123'
                            },
                            {
                                kind: 'N',
                                path: ['/tenant1/Service_Address-192.0.2.100'],
                                rhs: {
                                    command: 'ltm virtual-address',
                                    properties: {
                                        address: '192.0.2.100',
                                        arp: 'enabled',
                                        'icmp-echo': 'enabled',
                                        mask: '255.255.255.255',
                                        'route-advertisement': 'disabled',
                                        spanning: 'disabled',
                                        'traffic-group': 'default'
                                    },
                                    ignore: []
                                }
                            }
                        ]);
                });
        });

        describe('iRule order', () => {
            it('should return a diff when iRule order changes', () => {
                const currentConfig = {
                    '/myApp/Application1/myService': {
                        command: 'ltm virtual',
                        properties: {
                            rules: {
                                rule1: {},
                                rule2: {}
                            }
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    '/myApp/Application1/myService': {
                        command: 'ltm virtual',
                        properties: {
                            rules: {
                                rule2: {},
                                rule1: {}
                            }
                        },
                        ignore: []
                    }
                };
                const commonConfig = {
                    nodeList: []
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .catch(() => {
                        assert.fail('Promise should not reject');
                    })
                    .then((results) => {
                        assert.strictEqual(results.length, 2);
                        assert.deepStrictEqual(
                            results[0],
                            {
                                kind: 'E',
                                lhs: 'rule2',
                                path: [
                                    '/myApp/Application1/myService',
                                    'properties',
                                    'rules',
                                    '_order_',
                                    1
                                ],
                                rhs: 'rule1'
                            }
                        );
                        assert.deepStrictEqual(
                            results[1],
                            {
                                kind: 'E',
                                lhs: 'rule1',
                                path: [
                                    '/myApp/Application1/myService',
                                    'properties',
                                    'rules',
                                    '_order_',
                                    0
                                ],
                                rhs: 'rule2'
                            }
                        );
                    });
            });

            it('should not return a diff when iRule order does not change', () => {
                const currentConfig = {
                    '/myApp/Application1/myService': {
                        command: 'ltm virtual',
                        properties: {
                            rules: {
                                rule1: {},
                                rule2: {}
                            }
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    '/myApp/Application1/myService': {
                        command: 'ltm virtual',
                        properties: {
                            rules: {
                                rule1: {},
                                rule2: {}
                            }
                        },
                        ignore: []
                    }
                };
                const commonConfig = {
                    nodeList: []
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .catch(() => {
                        assert.fail('Promise should not reject');
                    })
                    .then((results) => {
                        assert.strictEqual(results.length, 0);
                    });
            });
        });

        describe('GSLB_iRule order', () => {
            it('should return a diff when iRule order changes', () => {
                const currentConfig = {
                    '/myApp/Application1/myGslbDomain': {
                        command: 'gtm wideip a',
                        properties: {
                            rules: {
                                rule1: {},
                                rule2: {}
                            }
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    '/myApp/Application1/myGslbDomain': {
                        command: 'gtm wideip a',
                        properties: {
                            rules: {
                                rule2: {},
                                rule1: {}
                            }
                        },
                        ignore: []
                    }
                };
                const commonConfig = {
                    nodeList: []
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .catch(() => {
                        assert.fail('Promise should not reject');
                    })
                    .then((results) => {
                        assert.strictEqual(results.length, 2);
                        assert.deepStrictEqual(
                            results[0],
                            {
                                kind: 'E',
                                lhs: 'rule2',
                                path: [
                                    '/myApp/Application1/myGslbDomain',
                                    'properties',
                                    'rules',
                                    '_order_',
                                    1
                                ],
                                rhs: 'rule1'
                            }
                        );
                        assert.deepStrictEqual(
                            results[1],
                            {
                                kind: 'E',
                                lhs: 'rule1',
                                path: [
                                    '/myApp/Application1/myGslbDomain',
                                    'properties',
                                    'rules',
                                    '_order_',
                                    0
                                ],
                                rhs: 'rule2'
                            }
                        );
                    });
            });

            it('should not return a diff when GSLB_iRule order does not change', () => {
                const currentConfig = {
                    '/myApp/Application1/myGslbDomain': {
                        command: 'gtm wideip a',
                        properties: {
                            rules: {
                                rule1: {},
                                rule2: {}
                            }
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    '/myApp/Application1/myGslbDomain': {
                        command: 'gtm wideip a',
                        properties: {
                            rules: {
                                rule1: {},
                                rule2: {}
                            }
                        },
                        ignore: []
                    }
                };
                const commonConfig = {
                    nodeList: []
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .catch(() => {
                        assert.fail('Promise should not reject');
                    })
                    .then((results) => {
                        assert.strictEqual(results.length, 0);
                    });
            });
        });

        describe('uncheckedDiff building', () => {
            let currentConfig;
            let desiredConfig;
            let commonConfig;
            let tenantId;
            let uncheckedDiff;

            beforeEach(() => {
                currentConfig = {
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/Shared/test.item-foo': {
                        command: 'ltm virtual',
                        properties: {
                            'address-status': 'yes',
                            'auto-lasthop': 'default',
                            'connection-limit': 0,
                            'rate-limit': 'disabled',
                            description: '\\"Shared\\"',
                            destination: '/Common/192.0.2.11:8080',
                            'ip-protocol': 'tcp',
                            'last-hop-pool': 'none',
                            mask: '255.255.255.255',
                            mirror: 'disabled',
                            persist: {
                                '/Common/source_addr': {
                                    default: 'yes'
                                }
                            },
                            policies: {},
                            profiles: {
                                '/Common/f5-tcp-progressive': {
                                    context: 'all'
                                }
                            },
                            'service-down-immediate-action': 'none',
                            source: '0.0.0.0/0',
                            'source-address-translation': {
                                type: 'automap'
                            },
                            rules: {},
                            'security-log-profiles': {},
                            'source-port': 'preserve',
                            'translate-address': 'enabled',
                            'translate-port': 'enabled',
                            nat64: 'disabled',
                            vlans: {},
                            'vlans-disabled': ' ',
                            metadata: {},
                            'clone-pools': {},
                            'throughput-capacity': 'infinite'
                        },
                        ignore: []
                    }
                };

                desiredConfig = {
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/Shared/Service_Address-192.0.2.10': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '192.0.2.10',
                            arp: 'enabled',
                            'icmp-echo': 'enabled',
                            mask: '255.255.255.255',
                            'route-advertisement': 'disabled',
                            spanning: 'disabled',
                            'traffic-group': 'default'
                        },
                        ignore: []
                    },
                    '/Common/Shared/test.item-foo': {
                        command: 'ltm virtual',
                        properties: {
                            'address-status': 'yes',
                            'auto-lasthop': 'default',
                            'connection-limit': 0,
                            'rate-limit': 'disabled',
                            description: '\\"Shared\\"',
                            destination: '/Common/Shared/192.0.2.10:8080',
                            'ip-protocol': 'tcp',
                            'last-hop-pool': 'none',
                            mask: '255.255.255.255',
                            mirror: 'disabled',
                            persist: {
                                '/Common/source_addr': {
                                    default: 'yes'
                                }
                            },
                            policies: {},
                            profiles: {
                                '/Common/f5-tcp-progressive': {
                                    context: 'all'
                                }
                            },
                            'service-down-immediate-action': 'none',
                            source: '0.0.0.0/0',
                            'source-address-translation': {
                                type: 'automap'
                            },
                            rules: {},
                            'security-log-profiles': {},
                            'source-port': 'preserve',
                            'translate-address': 'enabled',
                            'translate-port': 'enabled',
                            nat64: 'disabled',
                            vlans: {},
                            'vlans-disabled': ' ',
                            metadata: {},
                            'clone-pools': {},
                            'throughput-capacity': 'infinite'
                        },
                        ignore: []
                    },
                    '/Common/192.0.2.1': {
                        command: 'ltm node',
                        properties: {
                            address: '192.0.2.1',
                            metadata: {
                                references: {
                                    value: 1
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Common/Shared/pool': {
                        command: 'ltm pool',
                        properties: {
                            'load-balancing-mode': 'round-robin',
                            members: {
                                '/Common/192.0.2.1:8080': {
                                    'connection-limit': 0,
                                    'dynamic-ratio': 1,
                                    fqdn: {
                                        autopopulate: 'disabled'
                                    },
                                    minimumMonitors: 1,
                                    monitor: {
                                        default: {}
                                    },
                                    'priority-group': 0,
                                    'rate-limit': 'disabled',
                                    ratio: 1,
                                    state: 'user-up',
                                    session: 'user-enabled',
                                    metadata: {
                                        source: {
                                            value: 'declaration'
                                        }
                                    }
                                }
                            },
                            'min-active-members': 1,
                            'reselect-tries': 0,
                            'service-down-action': 'none',
                            'slow-ramp-time': 10,
                            'allow-nat': 'yes',
                            'allow-snat': 'yes'
                        },
                        ignore: []
                    }
                };

                commonConfig = {
                    nodeList: [
                        {
                            fullPath: '/Common/192.0.2.1',
                            partition: 'Common',
                            ephemeral: false,
                            metadata: [
                                {
                                    name: 'references',
                                    persist: 'true',
                                    value: '1'
                                }
                            ],
                            commonNode: true,
                            domain: '',
                            key: '192.0.2.1'
                        }
                    ],
                    virtualAddressList: [
                        {
                            fullPath: '/Common/192.0.2.11',
                            partition: 'Common',
                            address: '192.0.2.11',
                            metadata: [
                                {
                                    name: 'references',
                                    persist: 'true',
                                    value: '1'
                                }
                            ]
                        },
                        {
                            fullPath: '/Common/::',
                            partition: 'Common',
                            address: 'any6',
                            metadata: [
                                {
                                    name: 'references',
                                    persist: true,
                                    value: '1'
                                }
                            ]
                        }
                    ]
                };

                tenantId = 'Common';
                uncheckedDiff = {};
            });

            it('should build uncheckedDiff when unchecked mode enabled', () => {
                context.currentIndex = 0;
                context.tasks = [{ unchecked: true, firstPassNoDelete: true }];

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff)
                    .then(() => {
                        assert.deepStrictEqual(uncheckedDiff,
                            {
                                '/Common/192.0.2.1': {
                                    command: 'ltm node',
                                    properties: {
                                        address: '192.0.2.1',
                                        metadata: {
                                            references: {
                                                value: 2
                                            }
                                        }
                                    },
                                    ignore: []
                                },
                                '/Common/Shared/Service_Address-192.0.2.10': {
                                    command: 'ltm virtual-address',
                                    properties: {
                                        address: '192.0.2.10',
                                        arp: 'enabled',
                                        'icmp-echo': 'enabled',
                                        mask: '255.255.255.255',
                                        'route-advertisement': 'disabled',
                                        spanning: 'disabled',
                                        'traffic-group': 'default'
                                    },
                                    ignore: []
                                },
                                '/Common/Shared/pool': {
                                    command: 'ltm pool',
                                    properties: {
                                        'load-balancing-mode': 'round-robin',
                                        members: {
                                            '/Common/192.0.2.1:8080': {
                                                'connection-limit': 0,
                                                'dynamic-ratio': 1,
                                                fqdn: {
                                                    autopopulate: 'disabled'
                                                },
                                                minimumMonitors: 1,
                                                monitor: {
                                                    default: {}
                                                },
                                                'priority-group': 0,
                                                'rate-limit': 'disabled',
                                                ratio: 1,
                                                state: 'user-up',
                                                session: 'user-enabled',
                                                metadata: {
                                                    source: {
                                                        value: 'declaration'
                                                    }
                                                }
                                            }
                                        },
                                        'min-active-members': 1,
                                        'reselect-tries': 0,
                                        'service-down-action': 'none',
                                        'slow-ramp-time': 10,
                                        'allow-nat': 'yes',
                                        'allow-snat': 'yes'
                                    },
                                    ignore: []
                                }
                            });
                    });
            });

            it('should not build uncheckedDiff when unchecked mode not enabled', () => {
                context.control = {
                    firstPassNoDelete: true
                };
                context.currentIndex = 0;
                context.tasks = [{}];

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff)
                    .then(() => {
                        assert.deepStrictEqual(uncheckedDiff, {});
                    });
            });

            it('should not build uncheckedDiff when tenantId is not Common', () => {
                context.control = {
                    firstPassNoDelete: true
                };
                context.currentIndex = 0;
                context.tasks = [{ unchecked: true }];
                tenantId = 'NotCommon';

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff)
                    .then(() => {
                        assert.deepStrictEqual(uncheckedDiff, {});
                    });
            });

            it('should not build uncheckedDiff when firstPassNoDelete false', () => {
                context.control = {
                    firstPassNoDelete: false
                };
                context.currentIndex = 0;
                context.tasks = [{ unchecked: true }];

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff)
                    .then(() => {
                        assert.deepStrictEqual(uncheckedDiff, {});
                    });
            });

            it('should correctly build uncheckedDiff for edited GSLB Datacenter', () => {
                context.currentIndex = 0;
                context.tasks = [{ unchecked: true, firstPassNoDelete: true }];

                currentConfig = {
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/test.item-foo': {
                        command: 'gtm datacenter',
                        properties: {
                            metadata: {
                                as3: {
                                    persist: 'true'
                                }
                            },
                            enabled: true,
                            'prober-preference': 'inside-datacenter',
                            'prober-fallback': 'any-available'
                        },
                        ignore: []
                    }
                };

                desiredConfig = {
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/test.item-foo': {
                        command: 'gtm datacenter',
                        properties: {
                            metadata: {
                                as3: {
                                    persist: 'true'
                                }
                            },
                            description: '\\"description\\"',
                            enabled: false,
                            location: '\\"hello there\\"',
                            contact: '\\"General Kenobi\\"',
                            'prober-preference': 'pool',
                            'prober-fallback': 'none',
                            'prober-pool': '/Common/proberPool'
                        },
                        ignore: []
                    }
                };

                commonConfig = {
                    nodeList: [
                        {
                            fullPath: '/Common/_auto_192.0.2.109',
                            partition: 'Common',
                            ephemeral: true,
                            commonNode: true,
                            kind: 'tm:ltm:node:nodestate',
                            name: '_auto_192.0.2.109',
                            generation: 104345,
                            selfLink: 'https://localhost/mgmt/tm/ltm/node/~Common~_auto_192.0.2.109?ver=14.1.4',
                            address: '192.0.2.109',
                            connectionLimit: 0,
                            dynamicRatio: 1,
                            fqdn: {
                                addressFamily: 'ipv4',
                                autopopulate: 'enabled',
                                downInterval: 5,
                                interval: 'ttl',
                                tmName: 'www.f5.com'
                            },
                            logging: 'disabled',
                            monitor: 'default',
                            rateLimit: 'disabled',
                            ratio: 1,
                            session: 'user-enabled',
                            state: 'unchecked',
                            domain: 'www.f5.com',
                            key: '192.0.2.109'
                        }
                    ],
                    virtualAddressList: []
                };
                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff)
                    .then(() => {
                        assert.deepStrictEqual(uncheckedDiff,
                            {
                                '/Common/test.item-foo': {
                                    command: 'gtm datacenter',
                                    properties: {
                                        metadata: {
                                            as3: {
                                                persist: 'true'
                                            }
                                        },
                                        description: '\\"description\\"',
                                        enabled: false,
                                        location: '\\"hello there\\"',
                                        contact: '\\"General Kenobi\\"',
                                        'prober-preference': 'pool',
                                        'prober-fallback': 'none',
                                        'prober-pool': '/Common/proberPool'
                                    },
                                    ignore: []
                                }
                            });
                    });
            });

            it('should repost records if longestMatchEnabled set to true', () => {
                context.currentIndex = 0;
                context.tasks = [{ unchecked: true }];
                commonConfig = {};

                currentConfig = {
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/global-settings': {
                        command: 'gtm global-settings load-balancing',
                        properties: {
                            'topology-longest-match': 'yes'
                        },
                        ignore: []
                    },
                    '/Common/topology/records': {
                        command: 'gtm topology',
                        properties: {
                            records: {
                                0: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'country AD',
                                    'server:': 'subnet 10.10.0.0/21',
                                    score: 100,
                                    order: 1
                                },
                                1: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'isp Comcast',
                                    'server:': 'subnet 10.10.20.0/24',
                                    score: 100,
                                    order: 2
                                },
                                2: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'continent AF',
                                    'server:': 'subnet 10.30.10.0/24',
                                    score: 100,
                                    order: 3
                                },
                                3: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'region /Common/topologyTestRegion',
                                    'server:': 'subnet 10.10.10.0/24',
                                    score: 100,
                                    order: 4
                                }
                            }
                        },
                        ignore: []
                    }
                };
                desiredConfig = {
                    '/Common/Shared/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Common/global-settings': {
                        command: 'gtm global-settings load-balancing',
                        properties: {
                            'topology-longest-match': 'no'
                        },
                        ignore: []
                    },
                    '/Common/topology/records': {
                        command: 'gtm topology',
                        properties: {
                            records: {
                                0: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'country AD',
                                    'server:': 'subnet 10.10.0.0/21',
                                    score: 100,
                                    order: 1
                                },
                                1: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'isp Comcast',
                                    'server:': 'subnet 10.10.20.0/24',
                                    score: 100,
                                    order: 2
                                },
                                2: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'continent AF',
                                    'server:': 'subnet 10.30.10.0/24',
                                    score: 100,
                                    order: 3
                                },
                                3: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'region /Common/topologyTestRegion',
                                    'server:': 'subnet 10.10.10.0/24',
                                    score: 100,
                                    order: 4
                                }
                            }
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff)
                    .then((diff) => {
                        assert.deepStrictEqual(diff,
                            [
                                {
                                    kind: 'E',
                                    path: [
                                        '/Common/global-settings',
                                        'properties',
                                        'topology-longest-match'
                                    ],
                                    lhs: 'yes',
                                    rhs: 'no'
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        '/Common/topology/records'
                                    ],
                                    rhs: {
                                        command: 'gtm topology',
                                        properties: {
                                            records: {
                                                0: {
                                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                                    'ldns:': 'country AD',
                                                    'server:': 'subnet 10.10.0.0/21',
                                                    score: 100,
                                                    order: 1
                                                },
                                                1: {
                                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                                    'ldns:': 'isp Comcast',
                                                    'server:': 'subnet 10.10.20.0/24',
                                                    score: 100,
                                                    order: 2
                                                },
                                                2: {
                                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                                    'ldns:': 'continent AF',
                                                    'server:': 'subnet 10.30.10.0/24',
                                                    score: 100,
                                                    order: 3
                                                },
                                                3: {
                                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                                    'ldns:': 'region /Common/topologyTestRegion',
                                                    'server:': 'subnet 10.10.10.0/24',
                                                    score: 100,
                                                    order: 4
                                                }
                                            }
                                        },
                                        ignore: []
                                    }
                                }
                            ]);
                    });
            });
        });

        describe('.maintainAddressList', () => {
            it('should confirm no changes to net address-list', () => {
                const currentConfig = {
                    'testTenant/testApp/testNAL': {
                        command: 'net address-list',
                        properties: {
                            addresses: {
                                '192.0.2.0/24': {}
                            },
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    'testTenant/testApp/testNAL': {
                        command: 'net address-list',
                        properties: {
                            addresses: {
                                '192.0.2.0/24': {}
                            },
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff, []);
                    });
            });

            it('should confirm only change to firewall address-list address and geo', () => {
                const currentConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.0.2.20/30': {}
                            },
                            'address-lists': {},
                            fqdns: {},
                            geo: { 'TR:Istanbul': {} }
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.0.2.0/24': {}
                            },
                            fqdns: {},
                            geo: {},
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(
                            diff,
                            [
                                {
                                    kind: 'D',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'addresses',
                                        '192.0.2.20/30'
                                    ],
                                    lhs: {}
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'addresses',
                                        '192.0.2.0/24'
                                    ],
                                    rhs: {}
                                },
                                {
                                    kind: 'D',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'geo',
                                        'TR:Istanbul'
                                    ],
                                    lhs: {}
                                }
                            ]
                        );
                    });
            });

            it('should be able to convert between firewall and net address-list with only diffing address', () => {
                const currentConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.0.2.20/30': {}
                            },
                            fqdns: {},
                            geo: { 'TR:Istanbul': {} },
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'net address-list',
                        properties: {
                            addresses: {
                                '192.0.2.0/24': {}
                            },
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(
                            diff,
                            [
                                {
                                    kind: 'D',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'addresses',
                                        '192.0.2.20/30'
                                    ],
                                    lhs: {}
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'addresses',
                                        '192.0.2.0/24'
                                    ],
                                    rhs: {}
                                }
                            ]
                        );
                    });
            });

            it('should be able to convert between net and firewall address-list with only diffing address and geo', () => {
                const currentConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'net address-list',
                        properties: {
                            addresses: {
                                '192.0.2.20/30': {}
                            },
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.0.2.0/24': {}
                            },
                            fqdns: {},
                            geo: { 'TR:Istanbul': {} },
                            'address-lists': {}
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(
                            diff,
                            [
                                {
                                    kind: 'D',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'addresses',
                                        '192.0.2.20/30'
                                    ],
                                    lhs: {}
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'addresses',
                                        '192.0.2.0/24'
                                    ],
                                    rhs: {}
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'geo',
                                        'TR:Istanbul'
                                    ],
                                    rhs: {}
                                }
                            ]
                        );
                    });
            });

            it('should be able to convert from firewall port-list to net port-list', () => {
                const currentConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'security firewall port-list',
                        properties: {
                            ports: {
                                8080: {}
                            },
                            'port-lists': {}
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'net port-list',
                        properties: {
                            ports: {
                                80: {}
                            },
                            'port-lists': {}
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(
                            diff,
                            [
                                {
                                    kind: 'D',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'ports',
                                        '8080'
                                    ],
                                    lhs: {}
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'ports',
                                        '80'
                                    ],
                                    rhs: {}
                                }
                            ]
                        );
                    });
            });

            it('should be able to convert from net port-list to firewall port-list', () => {
                const currentConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'net port-list',
                        properties: {
                            ports: {
                                8080: {}
                            },
                            'port-lists': {}
                        },
                        ignore: []
                    }
                };
                const desiredConfig = {
                    'testTenant/testApp/testAL': {
                        command: 'security firewall port-list',
                        properties: {
                            ports: {
                                80: {}
                            },
                            'port-lists': {}
                        },
                        ignore: []
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(
                            diff,
                            [
                                {
                                    kind: 'D',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'ports',
                                        '8080'
                                    ],
                                    lhs: {}
                                },
                                {
                                    kind: 'N',
                                    path: [
                                        'testTenant/testApp/testAL',
                                        'properties',
                                        'ports',
                                        '80'
                                    ],
                                    rhs: {}
                                }
                            ]
                        );
                    });
            });
        });

        describe('.maintainCommonNodes', () => {
            const getNodeList = (refVal, includeSdMetadata) => {
                const nodeList = [
                    {
                        fullPath: '/Common/10.10.0.10',
                        partition: 'Common'
                    },
                    {
                        fullPath: '/Common/192.0.2.10',
                        partition: 'Common',
                        address: '192.0.2.10',
                        ephemeral: false,
                        metadata: [
                            { name: 'references', persist: true, value: refVal },
                            { name: 'foo', value: 'bar' }
                        ],
                        domain: '',
                        key: '192.0.2.10',
                        commonNode: true
                    }
                ];

                if (includeSdMetadata) {
                    nodeList[1].metadata.push(
                        { name: 'appsvcs-discovery', value: true }
                    );
                }
                return nodeList;
            };

            it('should update metadata for new Common node', () => {
                const currentConfig = {};
                const desiredConfig = {
                    '/Common/192.0.2.10': {
                        command: 'ltm node',
                        ignore: [],
                        properties: {
                            address: '192.0.2.10',
                            metadata: { references: { value: 0 } }
                        }
                    }
                };
                const commonConfig = { nodeList: getNodeList(0) };

                const expectedDiffs = [{
                    kind: 'N',
                    path: ['/Common/192.0.2.10'],
                    rhs: util.simpleCopy(desiredConfig['/Common/192.0.2.10'])
                }];
                expectedDiffs[0].rhs.properties.metadata.references.value = 1;

                const expectedNodeList = util.simpleCopy(commonConfig.nodeList);
                expectedNodeList[1].metadata[0].value = 1;

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.nodeList, expectedNodeList);
                    });
            });

            it('should replace diff and update metadata for Common node with multiple refs', () => {
                const currentConfig = {};
                const desiredConfig = {
                    '/Common/192.0.2.10': {
                        command: 'ltm node',
                        ignore: [],
                        properties: {
                            address: '192.0.2.10',
                            metadata: { references: { value: 1 } }
                        }
                    }
                };
                const commonConfig = { nodeList: getNodeList(1) };

                const expectedDiffs = [{
                    kind: 'E',
                    path: ['/Common/192.0.2.10'],
                    rhs: util.simpleCopy(desiredConfig['/Common/192.0.2.10']),
                    lhsCommand: 'ltm node'
                }];
                expectedDiffs[0].rhs.properties.metadata.references.value = 2;

                const expectedNodeList = util.simpleCopy(commonConfig.nodeList);
                expectedNodeList[1].metadata[0].value = 2;

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.nodeList, expectedNodeList);
                    });
            });

            it('should delete node when deleting last pool that refs node', () => {
                const currentConfig = {
                    '/TestTenant/TestApplication/TestPool': {
                        command: 'ltm pool',
                        ignore: [],
                        properties: { members: { 'Common/192.0.2.10:8080': {} } }
                    }
                };
                const desiredConfig = {};
                const commonConfig = { nodeList: getNodeList(1) };

                const expectedDiffs = [
                    {
                        kind: 'D',
                        path: ['/TestTenant/TestApplication/TestPool'],
                        lhs: util.simpleCopy(currentConfig['/TestTenant/TestApplication/TestPool'])
                    },
                    {
                        kind: 'D',
                        path: ['/Common/192.0.2.10'],
                        lhs: {
                            command: 'ltm node',
                            properties: {
                                address: '192.0.2.10',
                                metadata: [
                                    { name: 'references', persist: true, value: 0 },
                                    { name: 'foo', value: 'bar' }
                                ]
                            }
                        },
                        lhsCommand: 'ltm node',
                        ignore: []
                    }
                ];

                const expectedNodeList = util.simpleCopy(commonConfig.nodeList);
                expectedNodeList[1].metadata[0].value = 0;

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.nodeList, expectedNodeList);
                    });
            });

            it('should modify node metadata when deleting pool that refs node', () => {
                const currentConfig = {
                    '/TestTenant/TestApplication/TestPool': {
                        command: 'ltm pool',
                        ignore: [],
                        properties: { members: { 'Common/192.0.2.10:8080': {} } }
                    },
                    '/Common/192.0.2.10': {
                        command: 'ltm node',
                        ignore: [],
                        properties: {
                            address: '192.0.2.10'
                        }
                    }
                };
                const desiredConfig = {};
                const commonConfig = { nodeList: getNodeList(2) };

                const expectedDiffs = [
                    {
                        kind: 'D',
                        path: ['/TestTenant/TestApplication/TestPool'],
                        lhs: util.simpleCopy(currentConfig['/TestTenant/TestApplication/TestPool'])
                    },
                    {
                        kind: 'E',
                        path: ['/Common/192.0.2.10'],
                        rhs: {
                            command: 'ltm node',
                            properties: {
                                address: '192.0.2.10',
                                metadata: {
                                    references: { value: 1 },
                                    foo: { value: 'bar' }
                                }
                            }
                        },
                        lhsCommand: 'ltm node',
                        ignore: []
                    }
                ];

                const expectedNodeList = util.simpleCopy(commonConfig.nodeList);
                expectedNodeList[1].metadata[0].value = 1;

                const expectedDesiredConfig = {
                    '/Common/192.0.2.10': {
                        command: 'ltm node',
                        ignore: [],
                        properties: util.simpleCopy(expectedDiffs[1].rhs.properties)
                    }
                };

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.nodeList, expectedNodeList);
                        assert.deepStrictEqual(desiredConfig, expectedDesiredConfig);
                    });
            });

            it('should skip nodes if refCount is -1 even if SD metadata is present', () => {
                const currentConfig = {
                    '/TestTenant/TestApplication/TestPool': {
                        command: 'ltm pool',
                        ignore: [],
                        properties: { members: { 'Common/192.0.2.10:8080': {} } }
                    }
                };
                const desiredConfig = {};
                const commonConfig = { nodeList: getNodeList(0, true) };

                const expectedDiffs = [
                    {
                        kind: 'D',
                        path: ['/TestTenant/TestApplication/TestPool'],
                        lhs: util.simpleCopy(currentConfig['/TestTenant/TestApplication/TestPool'])
                    }
                ];

                const expectedNodeList = util.simpleCopy(commonConfig.nodeList);
                expectedNodeList[1].metadata[0].value = -1;

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.nodeList, expectedNodeList);
                        assert.deepStrictEqual(desiredConfig, {});
                    });
            });

            it('should skip decrementing ref metadata on first pass of Common tenant', () => {
                context.currentIndex = 0;
                context.tasks = [{ firstPassNoDelete: true }];
                const currentConfig = {
                    '/TestTenant/TestApplication/TestPool': {
                        command: 'ltm pool',
                        ignore: [],
                        properties: { members: { 'Common/192.0.2.10:8080': {} } }
                    }
                };
                const desiredConfig = {};
                const commonConfig = { nodeList: getNodeList(2) };

                const expectedDiffs = [
                    {
                        kind: 'D',
                        path: ['/TestTenant/TestApplication/TestPool'],
                        lhs: util.simpleCopy(currentConfig['/TestTenant/TestApplication/TestPool'])
                    }
                ];

                const expectedNodeList = util.simpleCopy(commonConfig.nodeList);
                expectedNodeList[1].metadata[0].value = 2;

                const expectedDesiredConfig = {};

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.nodeList, expectedNodeList);
                        assert.deepStrictEqual(desiredConfig, expectedDesiredConfig);
                    });
            });

            it('should handle Data_Group_Records_String with ports', () => {
                const currentConfig = {
                    '/TestTenant/TestApplication/TestDataGroup': {
                        command: 'ltm data-group internal',
                        ignore: [],
                        properties: {
                            type: 'string',
                            members: {
                                '"example1.com:80"': {},
                                '"example2.com:443"': {}
                            }
                        }
                    }
                };
                const desiredConfig = {
                    '/TestTenant/TestApplication/TestDataGroup': {
                        command: 'ltm data-group internal',
                        ignore: [],
                        properties: {
                            type: 'string',
                            members: {
                                '"example1.com:80"': {}
                            }
                        }
                    }
                };

                const expectedDiffs = [
                    {
                        kind: 'D',
                        path: [
                            '/TestTenant/TestApplication/TestDataGroup',
                            'properties',
                            'members',
                            '"example2.com:443"'],
                        lhs: {}
                    }
                ];

                return fetch.getDiff(context, currentConfig, desiredConfig, { nodeList: [] }, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                    });
            });
        });

        describe('.maintainCommonVirtualAddresses', () => {
            const getVirtualAddressList = (refVal) => [
                {
                    fullPath: '/Common/10.10.0.10',
                    address: '10.10.0.10',
                    partition: 'Common'
                },
                {
                    fullPath: '/Common/192.0.2.10',
                    address: '192.0.2.10',
                    partition: 'Common',
                    metadata: [
                        { name: 'references', persist: true, value: refVal },
                        { name: 'foo', value: 'bar' }
                    ],
                    commonAddress: true
                }
            ];

            it('should update metadata for new Common virtual address', () => {
                const currentConfig = {};
                const desiredConfig = {
                    '/Common/Service_Address-192.0.2.10': {
                        command: 'ltm virtual-address',
                        ignore: [],
                        properties: {
                            address: '192.0.2.10',
                            metadata: { references: { value: 0 } }
                        }
                    }
                };
                const commonConfig = { virtualAddressList: getVirtualAddressList(0) };

                const expectedDiffs = [{
                    kind: 'N',
                    path: ['/Common/Service_Address-192.0.2.10'],
                    rhs: util.simpleCopy(desiredConfig['/Common/Service_Address-192.0.2.10'])
                }];
                expectedDiffs[0].rhs.properties.metadata.references.value = 1;

                const expectedVirtualAddressList = util.simpleCopy(commonConfig.virtualAddressList);
                expectedVirtualAddressList[1].metadata[0].value = 1;

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.virtualAddressList, expectedVirtualAddressList);
                    });
            });

            it('should replace diff and update metadata for Common virtual address with multiple refs', () => {
                const currentConfig = {};
                const desiredConfig = {
                    '/Common/Service_Address-192.0.2.10': {
                        command: 'ltm virtual-address',
                        ignore: [],
                        properties: {
                            address: '192.0.2.10',
                            metadata: { references: { value: 1 } }
                        }
                    }
                };
                const commonConfig = { virtualAddressList: getVirtualAddressList(1) };

                const expectedDiffs = [{
                    kind: 'E',
                    path: ['/Common/Service_Address-192.0.2.10'],
                    rhs: util.simpleCopy(desiredConfig['/Common/Service_Address-192.0.2.10']),
                    lhsCommand: 'ltm virtual-address'
                }];
                expectedDiffs[0].rhs.properties.metadata.references.value = 2;

                const expectedVirtualAddressList = util.simpleCopy(commonConfig.virtualAddressList);
                expectedVirtualAddressList[1].metadata[0].value = 2;

                return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                    .then((diff) => {
                        assert.deepStrictEqual(diff.map((d) => Object.assign({}, d)), expectedDiffs);
                        assert.deepStrictEqual(commonConfig.virtualAddressList, expectedVirtualAddressList);
                    });
            });
        });

        it('should remove iControl_post when in currentConfig', () => {
            const currentConfig = {
                '/tenant/app/item': {
                    command: 'sys file ssl-cert',
                    checksum: 'checksum1',
                    'source-path': '/the/source/path',
                    properties: {
                        iControl_post: {
                            path: '/the/path',
                            method: 'POST',
                            ctype: 'contentType',
                            send: 'certificate1'
                        }
                    },
                    ignore: []
                }
            };
            const desiredConfig = {
                '/tenant/app/item': {
                    command: 'sys file ssl-cert',
                    checksum: 'checksum2',
                    'source-path': '/the/source/path',
                    properties: {
                        iControl_post: {
                            path: '/the/path',
                            method: 'POST',
                            ctype: 'contentType',
                            send: 'certificate2'
                        }
                    },
                    ignore: []
                }
            };
            context.tasks[0].unchecked = true;

            return fetch.getDiff(context, currentConfig, desiredConfig, {}, {})
                .then((diffs) => {
                    assert.equal(currentConfig['/tenant/app/item'].properties.iControl_post, undefined);
                    assert.deepStrictEqual(
                        diffs,
                        [
                            {
                                kind: 'E',
                                lhs: 'checksum1',
                                path: [
                                    '/tenant/app/item',
                                    'checksum'
                                ],
                                rhs: 'checksum2'
                            },
                            {
                                kind: 'N',
                                path: [
                                    '/tenant/app/item',
                                    'properties',
                                    'iControl_post'
                                ],
                                rhs: {
                                    ctype: 'contentType',
                                    method: 'POST',
                                    path: '/the/path',
                                    send: 'certificate2'
                                }
                            }
                        ]
                    );
                });
        });
    });

    describe('.tmshUpdateScript', () => {
        beforeEach(() => {
            context.currentIndex = 0;
            context.tasks = [
                {
                    uuid: '123'
                }
            ];
            context.request = {
                eventEmitter: new EventEmitter()
            };
            context.target = { tmosVersion: '14.0.0' };
            context.host = {
                parser: {
                    nodelist: []
                }
            };
        });

        it('should return a full script even if empty objects are supplied', () => {
            // This can also be used as a template for testing tmshUpdateScript()
            const desiredConfig = {};
            const currentConfig = {};
            const configDiff = [];

            const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
            const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}';

            assert.deepStrictEqual(result.script, expected);
        });

        describe('apm profile access', () => {
            it('should create catch blocks in script', () => {
                const desiredConfig = {
                    '/Access_Profile/app/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Access_Profile/accessProfile': {
                        command: 'apm profile access',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://example.com/iam_policy.tar',
                                    rejectUnauthorized: true,
                                    method: 'GET',
                                    ctype: 'application/octet-stream',
                                    why: 'get Access Profile accessProfile from url'
                                },
                                post: {
                                    path: '/mgmt/shared/file-transfer/uploads/accessProfile.tar',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    why: 'upload Access Profile accessProfile',
                                    settings: {
                                        class: 'Access_Profile',
                                        url: 'https://example.com/iam_policy.tar',
                                        ignoreChanges: true
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Access_Profile/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };

                const currentConfig = {};

                const configDiff = [
                    {
                        kind: 'N',
                        path: [
                            '/Access_Profile/app/'
                        ],
                        rhs: {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'sys folder'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Access_Profile/accessProfile'
                        ],
                        rhs: {
                            command: 'apm profile access',
                            properties: {
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/iam_policy.tar',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Profile accessProfile from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/accessProfile.tar',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Profile accessProfile',
                                        settings: {
                                            class: 'Access_Profile',
                                            url: 'https://example.com/iam_policy.tar',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'apm profile access'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Access_Profile/'
                        ],
                        rhs: {
                            command: 'auth partition',
                            properties: {
                                'default-route-domain': 0
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'auth partition'
                    }
                ];

                const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::create auth partition Access_Profile default-route-domain 0\ntmsh::create sys folder /Access_Profile/app/\ntmsh::begin_transaction\ntmsh::modify auth partition Access_Profile description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\nset ::env(USER) $::env(REMOTEUSER)\nexec ng_import /var/config/rest/downloads/accessProfile.tar accessProfile -p Access_Profile\nexec ng_import /var/config/rest/downloads/accessProfile.tar accessProfile_123_appsvcs -p Access_Profile\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ncatch { exec ng_profile -p Access_Profile -deleteall accessProfile } e\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::delete sys folder /Access_Profile/app/ } e\ncatch { tmsh::delete auth partition Access_Profile } e\n}}\n}';
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.deepStrictEqual(result.script, expected);
            });
        });

        describe('apm profile access and apm access-policy', () => {
            it('should create catch blocks in script', () => {
                const desiredConfig = {
                    '/Mixed_APM_Objects/app/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Mixed_APM_Objects/accessProfileTar': {
                        command: 'apm profile access',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://example.com/access_profile.tar',
                                    rejectUnauthorized: true,
                                    method: 'GET',
                                    ctype: 'application/octet-stream',
                                    why: 'get Access Profile accessProfileTar from url'
                                },
                                post: {
                                    path: '/mgmt/shared/file-transfer/uploads/accessProfileTar.tar',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    why: 'upload Access Profile accessProfileTar',
                                    settings: {
                                        class: 'Access_Profile',
                                        url: 'https://example.com/access_profile.tar',
                                        ignoreChanges: true
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Mixed_APM_Objects/accessProfileTarGz': {
                        command: 'apm profile access',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://example.com/access_profile.tar.gz',
                                    rejectUnauthorized: true,
                                    method: 'GET',
                                    ctype: 'application/octet-stream',
                                    why: 'get Access Profile accessProfileTarGz from url'
                                },
                                post: {
                                    path: '/mgmt/shared/file-transfer/uploads/accessProfileTarGz.tar.gz',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    why: 'upload Access Profile accessProfileTarGz',
                                    settings: {
                                        class: 'Access_Profile',
                                        url: 'https://example.com/access_profile.tar.gz',
                                        ignoreChanges: true
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Mixed_APM_Objects/perRequestPolicyTar': {
                        command: 'apm policy access-policy',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://example.com/perRequestPolicy.tar',
                                    rejectUnauthorized: true,
                                    method: 'GET',
                                    ctype: 'application/octet-stream',
                                    why: 'get Access Policy perRequestPolicyTar from url'
                                },
                                post: {
                                    path: '/mgmt/shared/file-transfer/uploads/perRequestPolicyTar.tar',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    why: 'upload Access Policy perRequestPolicyTar',
                                    settings: {
                                        class: 'Per_Request_Access_Policy',
                                        url: 'https://example.com/perRequestPolicy.tar',
                                        ignoreChanges: true
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Mixed_APM_Objects/perRequestPolicyTarGz': {
                        command: 'apm policy access-policy',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://example.com/perRequestPolicy.tar.gz',
                                    rejectUnauthorized: true,
                                    method: 'GET',
                                    ctype: 'application/octet-stream',
                                    why: 'get Access Policy perRequestPolicyTarGz from url'
                                },
                                post: {
                                    path: '/mgmt/shared/file-transfer/uploads/perRequestPolicyTarGz.tar.gz',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    why: 'upload Access Policy perRequestPolicyTarGz',
                                    settings: {
                                        class: 'Per_Request_Access_Policy',
                                        url: 'https://example.com/perRequestPolicy.tar.gz',
                                        ignoreChanges: true
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Mixed_APM_Objects/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };

                const currentConfig = {};

                const configDiff = [
                    {
                        kind: 'N',
                        path: [
                            '/Mixed_APM_Objects/app/'
                        ],
                        rhs: {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'sys folder'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Mixed_APM_Objects/accessProfileTar'
                        ],
                        rhs: {
                            command: 'apm profile access',
                            properties: {
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/access_policy.tar',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Profile accessProfileTar from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/accessProfileTar.tar',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Profile accessProfileTar',
                                        settings: {
                                            class: 'Access_Profile',
                                            url: 'https://example.com/access_policy.tar',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'apm profile access'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Mixed_APM_Objects/accessProfileTarGz'
                        ],
                        rhs: {
                            command: 'apm profile access',
                            properties: {
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/access_profile.gz',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Profile accessProfileTarGz from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/accessProfileTarGz.tar.gz',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Profile accessProfileTarGz',
                                        settings: {
                                            class: 'Access_Profile',
                                            url: 'https://example.com/access_profile.gz',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'apm profile access'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Mixed_APM_Objects/perRequestPolicyTar'
                        ],
                        rhs: {
                            command: 'apm policy access-policy',
                            properties: {
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/perRequestPolicy.tar',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Policy perRequestPolicyTar from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/perRequestPolicyTar.tar',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Policy perRequestPolicyTar',
                                        settings: {
                                            class: 'Per_Request_Access_Policy',
                                            url: 'https://example.com/perRequestPolicy.tar',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'apm policy access-policy'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Mixed_APM_Objects/perRequestPolicyTarGz'
                        ],
                        rhs: {
                            command: 'apm policy access-policy',
                            properties: {
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/perRequestPolicy.tar.gz',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Policy perRequestPolicyTarGz from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/perRequestPolicyTarGz.tar.gz',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Policy perRequestPolicyTarGz',
                                        settings: {
                                            class: 'Per_Request_Access_Policy',
                                            url: 'https://example.com/perRequestPolicy.tar.gz',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'apm policy access-policy'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Mixed_APM_Objects/'
                        ],
                        rhs: {
                            command: 'auth partition',
                            properties: {
                                'default-route-domain': 0
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'auth partition'
                    }
                ];

                const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::create auth partition Mixed_APM_Objects default-route-domain 0\ntmsh::create sys folder /Mixed_APM_Objects/app/\ntmsh::begin_transaction\ntmsh::modify auth partition Mixed_APM_Objects description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\nset ::env(USER) $::env(REMOTEUSER)\nexec ng_import /var/config/rest/downloads/accessProfileTar.tar accessProfileTar -p Mixed_APM_Objects\nexec ng_import /var/config/rest/downloads/accessProfileTar.tar accessProfileTar_123_appsvcs -p Mixed_APM_Objects\nset ::env(USER) $::env(REMOTEUSER)\nexec ng_import /var/config/rest/downloads/accessProfileTarGz.tar accessProfileTarGz -p Mixed_APM_Objects\nexec ng_import /var/config/rest/downloads/accessProfileTarGz.tar accessProfileTarGz_123_appsvcs -p Mixed_APM_Objects\nset ::env(USER) $::env(REMOTEUSER)\nexec ng_import -t access_policy /var/config/rest/downloads/perRequestPolicyTar.tar perRequestPolicyTar -p Mixed_APM_Objects\nexec ng_import -t access_policy /var/config/rest/downloads/perRequestPolicyTar.tar perRequestPolicyTar_123_appsvcs -p Mixed_APM_Objects\nset ::env(USER) $::env(REMOTEUSER)\nexec ng_import -t access_policy /var/config/rest/downloads/perRequestPolicyTarGz.tar.gz perRequestPolicyTarGz -p Mixed_APM_Objects\nexec ng_import -t access_policy /var/config/rest/downloads/perRequestPolicyTarGz.tar.gz perRequestPolicyTarGz_123_appsvcs -p Mixed_APM_Objects\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ncatch { exec ng_profile -t access_policy -p Mixed_APM_Objects -deleteall perRequestPolicyTarGz } e\ncatch { exec ng_profile -t access_policy -p Mixed_APM_Objects -deleteall perRequestPolicyTar } e\ncatch { exec ng_profile -p Mixed_APM_Objects -deleteall accessProfileTarGz } e\ncatch { exec ng_profile -p Mixed_APM_Objects -deleteall accessProfileTar } e\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::delete sys folder /Mixed_APM_Objects/app/ } e\ncatch { tmsh::delete auth partition Mixed_APM_Objects } e\n}}\n}';
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.deepStrictEqual(result.script, expected);
            });
        });

        describe('apm policy access-policy', () => {
            it('should create catch blocks in script', () => {
                const desiredConfig = {
                    '/Per_Request_Access_Policy/app/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Per_Request_Access_Policy/perRequestPolicyTarGz': {
                        command: 'apm policy access-policy',
                        properties: {
                            iControl_postFromRemote: {
                                get: {
                                    path: 'https://example.com/per_request_policy.tar.gz',
                                    rejectUnauthorized: true,
                                    method: 'GET',
                                    ctype: 'application/octet-stream',
                                    why: 'get Access Policy perRequestPolicyTarGz from url'
                                },
                                post: {
                                    path: '/mgmt/shared/file-transfer/uploads/perRequestPolicyTarGz.tar.gz',
                                    method: 'POST',
                                    ctype: 'application/octet-stream',
                                    why: 'upload Access Policy perRequestPolicyTarGz',
                                    settings: {
                                        class: 'Per_Request_Access_Policy',
                                        url: 'https://example.com/per_request_policy.tar.gz',
                                        ignoreChanges: true
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Per_Request_Access_Policy/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };

                const currentConfig = {};

                const configDiff = [
                    {
                        kind: 'N',
                        path: [
                            '/Per_Request_Access_Policy/app/'
                        ],
                        rhs: {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'sys folder'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Per_Request_Access_Policy/perRequestPolicyTarGz'
                        ],
                        rhs: {
                            command: 'apm policy access-policy',
                            properties: {
                                iControl_postFromRemote: {
                                    get: {
                                        path: 'https://example.com/per_request_policy.tar.gz',
                                        rejectUnauthorized: true,
                                        method: 'GET',
                                        ctype: 'application/octet-stream',
                                        why: 'get Access Policy perRequestPolicyTarGz from url'
                                    },
                                    post: {
                                        path: '/mgmt/shared/file-transfer/uploads/perRequestPolicyTarGz.tar.gz',
                                        method: 'POST',
                                        ctype: 'application/octet-stream',
                                        why: 'upload Access Policy perRequestPolicyTarGz',
                                        settings: {
                                            class: 'Per_Request_Access_Policy',
                                            url: 'https://example.com/per_request_policy.tar.gz',
                                            ignoreChanges: true
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'apm policy access-policy'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Per_Request_Access_Policy/'
                        ],
                        rhs: {
                            command: 'auth partition',
                            properties: {
                                'default-route-domain': 0
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'auth partition'
                    }
                ];

                const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::create auth partition Per_Request_Access_Policy default-route-domain 0\ntmsh::create sys folder /Per_Request_Access_Policy/app/\ntmsh::begin_transaction\ntmsh::modify auth partition Per_Request_Access_Policy description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\nset ::env(USER) $::env(REMOTEUSER)\nexec ng_import -t access_policy /var/config/rest/downloads/perRequestPolicyTarGz.tar.gz perRequestPolicyTarGz -p Per_Request_Access_Policy\nexec ng_import -t access_policy /var/config/rest/downloads/perRequestPolicyTarGz.tar.gz perRequestPolicyTarGz_123_appsvcs -p Per_Request_Access_Policy\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ncatch { exec ng_profile -t access_policy -p Per_Request_Access_Policy -deleteall perRequestPolicyTarGz } e\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::delete sys folder /Per_Request_Access_Policy/app/ } e\ncatch { tmsh::delete auth partition Per_Request_Access_Policy } e\n}}\n}';
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.deepStrictEqual(result.script, expected);
            });
        });

        describe('GSLB_Topology_Region', () => {
            it('should delete referenced gtm region first', () => {
                const currentConfig = {
                    '/Common/regionGSLB': {
                        command: 'gtm region',
                        ignore: [],
                        properties: {
                            'region-members': {
                                'not region /Common/regionGSLBUnknown': {
                                    not: 'not',
                                    region: '/Common/regionGSLBUnknown'
                                }
                            }
                        }
                    },
                    '/Common/regionGSLBUnknown': {
                        command: 'gtm region',
                        ignore: [],
                        properties: {
                            'region-members': {
                                'continent --': {
                                    not: 'none',
                                    continent: '--'
                                }
                            }
                        }
                    }
                };
                const desiredConfig = {};

                const configDiff = [
                    {
                        kind: 'D',
                        path: ['/Common/regionGSLB'],
                        command: 'gtm region',
                        lhs: {
                            properties: {
                                'region-members': {
                                    'not region /Common/regionGSLBUnknown': {
                                        not: 'not',
                                        region: '/Common/regionGSLBUnknown'
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    {
                        kind: 'D',
                        path: ['/Common/regionGSLBUnknown'],
                        command: 'gtm region',
                        lhs: {
                            properties: {
                                'region-members': {
                                    'continent --': {
                                        not: 'none',
                                        continent: '--'
                                    }
                                }
                            }
                        },
                        ignore: []
                    }
                ];

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                const index = (str) => result.script.indexOf(str);
                const regionGSLB = 'tmsh::delete gtm region /Common/regionGSLB';
                const regionGSLBUnknown = 'tmsh::delete gtm region /Common/regionGSLBUnknown';
                const beginTrx = 'tmsh::begin_transaction';

                // assert regionGSLB is before begin_transaction
                assert(index(regionGSLB) < index(beginTrx) < index(regionGSLBUnknown));
                assert(result.script.includes('tmsh::delete gtm region /Common/regionGSLB'));
                assert(result.script.includes('tmsh::delete gtm region /Common/regionGSLBUnknown'));
            });
        });

        describe('protocol inspection profiles', () => {
            it('should move protocol reference to postTrans on BIGIP < 14.1 when referencing new profile', () => {
                context.target = {
                    tmosVersion: '14.0'
                };
                const desiredConfig = {
                    '/Sample_PIP_01/A1/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Sample_PIP_01/Service_Address-192.0.2.91': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '192.0.2.91',
                            arp: 'enabled',
                            'icmp-echo': 'enabled',
                            mask: '255.255.255.255',
                            'route-advertisement': 'disabled',
                            spanning: 'disabled',
                            'traffic-group': 'default'
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/serviceMain': {
                        command: 'ltm virtual',
                        properties: {
                            'address-status': 'yes',
                            'auto-lasthop': 'default',
                            'connection-limit': 0,
                            description: '\\A1\\',
                            destination: '/Sample_PIP_01/192.0.2.91:53',
                            'ip-protocol': 'udp',
                            'last-hop-pool': 'none',
                            mask: '255.255.255.255',
                            mirror: 'disabled',
                            persist: {
                                '/Common/source_addr': {
                                    default: 'yes'
                                }
                            },
                            policies: {},
                            profiles: {
                                '/Common/udp': {
                                    context: 'all'
                                },
                                '/Sample_PIP_01/A1/DNSInspectionProfile': {
                                    context: 'all'
                                }
                            },
                            source: '0.0.0.0/0',
                            'source-address-translation': {
                                type: 'automap'
                            },
                            rules: {},
                            'security-log-profiles': {},
                            'source-port': 'preserve',
                            'translate-address': 'enabled',
                            'translate-port': 'enabled',
                            nat64: 'disabled',
                            vlans: {},
                            'vlans-disabled': ' ',
                            metadata: {},
                            'clone-pools': {}
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/DNSInspectionProfile': {
                        command: 'security protocol-inspection profile',
                        properties: {
                            description: '\\Custom DNS Inspection Profile\\',
                            'avr-stat-collect': 'on',
                            'compliance-enable': 'on',
                            'signature-enable': 'on',
                            services: {
                                dns: {
                                    compliance: {
                                        dns_maximum_reply_length: {
                                            action: 'accept',
                                            log: 'yes'
                                        }
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };
                const currentConfig = {};
                const configDiff = [
                    {
                        kind: 'N',
                        path: [
                            '/Sample_PIP_01/A1/'
                        ],
                        rhs: {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'sys folder'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Sample_PIP_01/Service_Address-192.0.2.91'
                        ],
                        rhs: {
                            command: 'ltm virtual-address',
                            properties: {
                                address: '192.0.2.91',
                                arp: 'enabled',
                                'icmp-echo': 'enabled',
                                mask: '255.255.255.255',
                                'route-advertisement': 'disabled',
                                spanning: 'disabled',
                                'traffic-group': 'default'
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'ltm virtual-address'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Sample_PIP_01/A1/serviceMain'
                        ],
                        rhs: {
                            command: 'ltm virtual',
                            properties: {
                                'address-status': 'yes',
                                'auto-lasthop': 'default',
                                'connection-limit': 0,
                                description: '\'A1\'',
                                destination: '/Sample_PIP_01/192.0.2.91:53',
                                'ip-protocol': 'udp',
                                'last-hop-pool': 'none',
                                mask: '255.255.255.255',
                                mirror: 'disabled',
                                persist: {
                                    '/Common/source_addr': {
                                        default: 'yes'
                                    }
                                },
                                policies: {},
                                profiles: {
                                    '/Common/udp': {
                                        context: 'all'
                                    },
                                    '/Sample_PIP_01/A1/DNSInspectionProfile': {
                                        context: 'all'
                                    }
                                },
                                source: '0.0.0.0/0',
                                'source-address-translation': {
                                    type: 'automap'
                                },
                                rules: {},
                                'security-log-profiles': {},
                                'source-port': 'preserve',
                                'translate-address': 'enabled',
                                'translate-port': 'enabled',
                                nat64: 'disabled',
                                vlans: {},
                                'vlans-disabled': ' ',
                                metadata: {},
                                'clone-pools': {}
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'ltm virtual'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Sample_PIP_01/A1/DNSInspectionProfile'
                        ],
                        rhs: {
                            command: 'security protocol-inspection profile',
                            properties: {
                                description: '\'Custom DNS Inspection Profile\'',
                                'avr-stat-collect': 'on',
                                'compliance-enable': 'on',
                                'signature-enable': 'on',
                                services: {
                                    dns: {
                                        compliance: {
                                            dns_maximum_reply_length: {
                                                action: 'accept',
                                                log: 'yes'
                                            }
                                        }
                                    }
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security protocol-inspection profile'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Sample_PIP_01/'
                        ],
                        rhs: {
                            command: 'auth partition',
                            properties: {
                                'default-route-domain': 0
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'auth partition'
                    }
                ];

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::create auth partition Sample_PIP_01 default-route-domain 0\ntmsh::create sys folder /Sample_PIP_01/A1/\ntmsh::begin_transaction\ntmsh::modify auth partition Sample_PIP_01 description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::create ltm virtual-address /Sample_PIP_01/192.0.2.91 address 192.0.2.91 arp enabled icmp-echo enabled mask 255.255.255.255 route-advertisement disabled spanning disabled traffic-group default\ntmsh::create ltm virtual /Sample_PIP_01/A1/serviceMain address-status yes auto-lasthop default connection-limit 0 description \\A1\\ destination /Sample_PIP_01/192.0.2.91:53 ip-protocol udp last-hop-pool none mask 255.255.255.255 mirror disabled persist replace-all-with \\{ /Common/source_addr \\{ default yes \\} \\} policies none profiles replace-all-with \\{ /Common/udp \\{ context all \\} \\} source 0.0.0.0/0 source-address-translation \\{ type automap \\} rules none security-log-profiles none source-port preserve translate-address enabled translate-port enabled nat64 disabled vlans none vlans-disabled   metadata none clone-pools none enabled \ntmsh::create security protocol-inspection profile /Sample_PIP_01/A1/DNSInspectionProfile description \\Custom DNS Inspection Profile\\ avr-stat-collect on compliance-enable on signature-enable on services replace-all-with \\{ dns \\{ compliance replace-all-with \\{ dns_maximum_reply_length \\{ action accept log yes \\} \\} \\} \\}\ntmsh::commit_transaction\ntmsh::modify ltm virtual /Sample_PIP_01/A1/serviceMain profiles replace-all-with \\{ /Common/udp \\{ context all \\} /Sample_PIP_01/A1/DNSInspectionProfile \\{ context all \\} \\} enabled \n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::delete sys folder /Sample_PIP_01/A1/ } e\ncatch { tmsh::delete auth partition Sample_PIP_01 } e\n}}\n}';

                assert.deepStrictEqual(result.script, expected);
            });

            it('should move protocol pointer to a modify on BIGIP < 14.1 when referencing existing profile', () => {
                context.target = {
                    tmosVersion: '14.0'
                };
                const desiredConfig = {
                    '/Sample_PIP_01/A1/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Sample_PIP_01/Service_Address-192.0.2.91': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '192.0.2.91',
                            arp: 'enabled',
                            'icmp-echo': 'enabled',
                            mask: '255.255.255.255',
                            'route-advertisement': 'disabled',
                            spanning: 'disabled',
                            'traffic-group': 'default'
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/serviceMain': {
                        command: 'ltm virtual',
                        properties: {
                            'address-status': 'yes',
                            'auto-lasthop': 'default',
                            'connection-limit': 0,
                            description: '\\A1\\',
                            destination: '/Sample_PIP_01/192.0.2.91:53',
                            'ip-protocol': 'udp',
                            'last-hop-pool': 'none',
                            mask: '255.255.255.255',
                            mirror: 'disabled',
                            persist: {
                                '/Common/source_addr': {
                                    default: 'yes'
                                }
                            },
                            policies: {},
                            profiles: {
                                '/Common/udp': {
                                    context: 'all'
                                },
                                '/Sample_PIP_01/A1/DNSInspectionProfile': {
                                    context: 'all'
                                }
                            },
                            source: '0.0.0.0/0',
                            'source-address-translation': {
                                type: 'automap'
                            },
                            rules: {},
                            'security-log-profiles': {},
                            'source-port': 'preserve',
                            'translate-address': 'enabled',
                            'translate-port': 'enabled',
                            nat64: 'disabled',
                            vlans: {},
                            'vlans-disabled': ' ',
                            metadata: {},
                            'clone-pools': {}
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/DNSInspectionProfile': {
                        command: 'security protocol-inspection profile',
                        properties: {
                            'avr-stat-collect': 'on',
                            'compliance-enable': 'on',
                            'signature-enable': 'on',
                            services: {
                                dns: {
                                    compliance: {
                                        dns_maximum_reply_length: {
                                            action: 'accept',
                                            log: 'yes'
                                        }
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };
                const currentConfig = {
                    '/Sample_PIP_01/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/serviceMain': {
                        command: 'ltm virtual',
                        properties: {
                            'address-status': 'yes',
                            'auto-lasthop': 'default',
                            'connection-limit': 0,
                            description: '\\A1\\',
                            destination: '/Sample_PIP_01/192.0.2.91:53',
                            'ip-protocol': 'udp',
                            'last-hop-pool': 'none',
                            mask: '255.255.255.255',
                            mirror: 'disabled',
                            persist: {
                                '/Common/source_addr': {
                                    default: 'yes'
                                }
                            },
                            policies: {},
                            profiles: {
                                '/Common/udp': {
                                    context: 'all'
                                }
                            },
                            source: '0.0.0.0/0',
                            'source-address-translation': {
                                type: 'automap'
                            },
                            rules: {},
                            'security-log-profiles': {},
                            'source-port': 'preserve',
                            'translate-address': 'enabled',
                            'translate-port': 'enabled',
                            nat64: 'disabled',
                            vlans: {},
                            'vlans-disabled': ' ',
                            metadata: {},
                            'clone-pools': {}
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/Service_Address-192.0.2.91': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '192.0.2.91',
                            arp: 'enabled',
                            'icmp-echo': 'enabled',
                            mask: '255.255.255.255',
                            'route-advertisement': 'disabled',
                            spanning: 'disabled',
                            'traffic-group': 'default'
                        },
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Sample_PIP_01/A1/DNSInspectionProfile': {
                        command: 'security protocol-inspection profile',
                        properties: {
                            description: '\\Custom DNS Inspection Profile\\',
                            'avr-stat-collect': 'on',
                            'compliance-enable': 'on',
                            'signature-enable': 'on',
                            services: {
                                dns: {
                                    compliance: {
                                        dns_maximum_reply_length: {
                                            action: 'accept',
                                            log: 'yes'
                                        }
                                    }
                                }
                            }
                        },
                        ignore: []
                    }
                };
                const configDiff = [
                    {
                        kind: 'N',
                        path: [
                            '/Sample_PIP_01/A1/serviceMain',
                            'properties',
                            'profiles',
                            '/Sample_PIP_01/A1/DNSInspectionProfile'
                        ],
                        rhs: {
                            context: 'all'
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'ltm virtual'
                    }
                ];
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify ltm virtual /Sample_PIP_01/A1/serviceMain profiles replace-all-with \\{ /Common/udp \\{ context all \\} /Sample_PIP_01/A1/DNSInspectionProfile \\{ context all \\} \\} enabled \ntmsh::modify auth partition Sample_PIP_01 description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}';
                assert.deepStrictEqual(result.script, expected);
            });

            it('should return script to modify protocol inspection profile services', () => {
                context.target = {
                    tmosVersion: '14.1.0'
                };
                const desiredConfig = {
                    '/TEST_Protocol_Inspection_Profile/Application/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/TEST_Protocol_Inspection_Profile/Application/test.item-foo': {
                        command: 'security protocol-inspection profile',
                        properties: {
                            services: {
                                dns: {
                                    compliance: {
                                        dns_maximum_reply_length: {
                                            action: 'reject',
                                            log: 'yes'
                                        }
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/TEST_Protocol_Inspection_Profile/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };
                const currentConfig = {
                    '/TEST_Protocol_Inspection_Profile/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    },
                    '/TEST_Protocol_Inspection_Profile/Application/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/TEST_Protocol_Inspection_Profile/Application/test.item-foo': {
                        command: 'security protocol-inspection profile',
                        properties: {
                            services: {
                                dns: {
                                    compliance: {
                                        dns_disallowed_query_type: {
                                            action: 'reject',
                                            log: 'yes'
                                        },
                                        dns_maximum_reply_length: {
                                            action: 'accept',
                                            log: 'yes'
                                        }
                                    },
                                    signature: {
                                        dns_dns_query_amplification_attempt: {
                                            action: 'reject',
                                            log: 'yes'
                                        }
                                    }
                                },
                                mysql: {
                                    compliance: {
                                        mysql_malformed_packet: {
                                            action: 'accept',
                                            log: 'yes'
                                        }
                                    }
                                }
                            }
                        },
                        ignore: []
                    },
                    '/Common/global-settings': {
                        command: 'gtm global-settings load-balancing',
                        properties: {
                            'topology-longest-match': 'yes'
                        },
                        ignore: []
                    }
                };
                const configDiff = [
                    {
                        kind: 'D',
                        path: [
                            '/TEST_Protocol_Inspection_Profile/Application/test.item-foo',
                            'properties',
                            'services',
                            'dns',
                            'compliance',
                            'dns_disallowed_query_type'
                        ],
                        lhs: {
                            action: 'reject',
                            log: 'yes'
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security protocol-inspection profile'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/TEST_Protocol_Inspection_Profile/Application/test.item-foo',
                            'properties',
                            'services',
                            'dns',
                            'signature'
                        ],
                        lhs: {
                            dns_dns_query_amplification_attempt: {
                                action: 'reject',
                                log: 'yes'
                            }
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security protocol-inspection profile'
                    }
                ];

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                const expected = 'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::delete security protocol-inspection profile /TEST_Protocol_Inspection_Profile/Application/test.item-foo\ntmsh::create security protocol-inspection profile /TEST_Protocol_Inspection_Profile/Application/test.item-foo services replace-all-with \\{ dns \\{ compliance replace-all-with \\{ dns_maximum_reply_length \\{ action reject log yes \\} \\} \\} \\}\ntmsh::modify auth partition TEST_Protocol_Inspection_Profile description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\ntmsh::modify security protocol-inspection profile /TEST_Protocol_Inspection_Profile/Application/test.item-foo services delete \\{ all \\}\ntmsh::modify security protocol-inspection profile /TEST_Protocol_Inspection_Profile/Application/test.item-foo services replace-all-with \\{ dns \\{ compliance replace-all-with \\{ dns_maximum_reply_length \\{ action reject log yes \\} \\} \\} \\}\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}';

                assert.deepStrictEqual(result.script, expected);
            });
        });

        it('should skip createFirstDeleteLast when modifying auth partition', () => {
            const desiredConfig = {
                '/tenant/application/': { command: 'sys folder', properties: {}, ignore: [] },
                '/tenant/application/pool': {
                    command: 'ltm pool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    },
                    ignore: []
                },
                '/tenant/': {
                    command: 'auth partition',
                    properties: { 'default-route-domain': 10 },
                    ignore: []
                }
            };
            const currentConfig = {
                '/tenant/': {
                    command: 'auth partition',
                    properties: { 'default-route-domain': 0 },
                    ignore: []
                },
                '/tenant/application/pool': {
                    command: 'ltm pool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    },
                    ignore: []
                },
                '/tenant/application/': { command: 'sys folder', properties: {}, ignore: [] }
            };
            const configDiff = [{
                kind: 'E',
                path: ['/tenant/', 'properties', 'default-route-domain'],
                lhs: 0,
                rhs: 10,
                tags: ['tmsh'],
                command: 'auth partition'
            }];
            context.target.tmosVersion = '13.1.1';

            const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
            assert.strictEqual(
                result.script,
                'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify auth partition tenant default-route-domain 10\ntmsh::modify auth partition tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
            );
        });

        // This tests AS3's work around for a pool monitor bug in transactions.
        // See GitHub issue 110 as an example
        it('should return a script where multiple pools are modifying their members in one declaration', () => {
            // pool is deleting its tcp monitor
            // otherPool is adding a http monitor
            const desiredConfig = {
                '/tenant/application/pool': {
                    command: 'ltm pool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        minimumMonitors: 1,
                        monitor: {
                            '/Common/http': {},
                            '/tenant/application/customMonitor': {}
                        },
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    },
                    ignore: []
                },
                '/tenant/application/otherPool': {
                    command: 'ltm pool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        minimumMonitors: 1,
                        monitor: {
                            '/Common/http': {},
                            '/tenant/application/customMonitor': {}
                        },
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    },
                    ignore: []
                }
            };
            const currentConfig = {
                '/tenant/application/pool': {
                    command: 'ltm pool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        minimumMonitors: 1,
                        monitor: {
                            '/Common/tcp': {},
                            '/tenant/application/customMonitor': {}
                        },
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    },
                    ignore: []
                },
                '/tenant/application/otherPool': {
                    command: 'ltm pool',
                    properties: {
                        'load-balancing-mode': 'round-robin',
                        members: {},
                        'min-active-members': 1,
                        minimumMonitors: 1,
                        monitor: {
                            '/tenant/application/customMonitor': {}
                        },
                        'reselect-tries': 0,
                        'service-down-action': 'none',
                        'slow-ramp-time': 10
                    },
                    ignore: []
                }
            };
            const configDiff = [
                {
                    kind: 'N',
                    path: [
                        '/tenant/application/otherPool',
                        'properties',
                        'monitor',
                        '/Common/http'
                    ],
                    rhs: {},
                    tags: [
                        'tmsh'
                    ],
                    command: 'ltm pool'
                },
                {
                    kind: 'N',
                    path: [
                        '/tenant/application/pool',
                        'properties',
                        'monitor',
                        '/Common/http'
                    ],
                    rhs: {},
                    tags: [
                        'tmsh'
                    ],
                    command: 'ltm pool'
                },
                {
                    kind: 'D',
                    path: [
                        '/tenant/application/pool',
                        'properties',
                        'monitor',
                        '/Common/tcp'
                    ],
                    lhs: {},
                    tags: [
                        'tmsh'
                    ],
                    command: 'ltm pool'
                }
            ];
            const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
            assert.strictEqual(
                result.script,
                'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::modify ltm pool /tenant/application/otherPool monitor none\ntmsh::modify ltm pool /tenant/application/pool monitor none\ntmsh::begin_transaction\ntmsh::delete ltm pool /tenant/application/otherPool\ntmsh::create ltm pool /tenant/application/otherPool load-balancing-mode round-robin members none min-active-members 1 monitor min 1 of \\{ /Common/http /tenant/application/customMonitor \\} reselect-tries 0 service-down-action none slow-ramp-time 10\ntmsh::modify auth partition tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::delete ltm pool /tenant/application/pool\ntmsh::create ltm pool /tenant/application/pool load-balancing-mode round-robin members none min-active-members 1 monitor min 1 of \\{ /Common/http /tenant/application/customMonitor \\} reselect-tries 0 service-down-action none slow-ramp-time 10\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ntmsh::modify ltm pool /tenant/application/otherPool monitor min 1 of \\{ /tenant/application/customMonitor \\}\ntmsh::modify ltm pool /tenant/application/pool monitor min 1 of \\{ /Common/tcp /tenant/application/customMonitor \\}\n}}\n}'
            );
        });

        describe('security firewall', () => {
            it('should properly setup preTrans, trans, and rollback during a delete', () => {
                const desiredConfig = {};
                const currentConfig = {
                    '/TEST_Firewall_Rule_List/Application/testFirewallRule': {
                        command: 'security firewall rule-list',
                        properties: {
                            rules: {
                                theRule: {
                                    action: 'accept',
                                    destination: {
                                        'address-lists': {
                                            '/TEST_Firewall_Rule_List/Application/addList': {}
                                        },
                                        'port-lists': {
                                            '/TEST_Firewall_Rule_List/Application/portList': {}
                                        }
                                    },
                                    source: {
                                        'address-lists': {
                                            '/TEST_Firewall_Rule_List/Application/addList': {}
                                        },
                                        'port-lists': {
                                            '/TEST_Firewall_Rule_List/Application/portList': {}
                                        }
                                    }
                                }
                            }
                        },
                        ignore: []
                    }
                };
                const configDiff = [
                    {
                        kind: 'D',
                        path: [
                            '/TEST_Firewall_Rule_List/Application/testFirewallRule'
                        ],
                        lhs: {
                            command: 'security firewall rule-list',
                            properties: {
                                rules: {
                                    theRule: {
                                        action: 'accept',
                                        destination: {
                                            'address-lists': {
                                                '/TEST_Firewall_Rule_List/Application/addList': {}
                                            },
                                            'port-lists': {
                                                '/TEST_Firewall_Rule_List/Application/portList': {}
                                            }
                                        },
                                        source: {
                                            'address-lists': {
                                                '/TEST_Firewall_Rule_List/Application/addList': {}
                                            },
                                            'port-lists': {
                                                '/TEST_Firewall_Rule_List/Application/portList': {}
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security firewall rule-list'
                    }
                ];
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::modify security firewall rule-list /TEST_Firewall_Rule_List/Application/testFirewallRule rules modify \\{ theRule \\{ source \\{ address-lists none port-lists none \\} destination \\{ address-lists none port-lists none \\} \\} \\}\ntmsh::begin_transaction\ntmsh::delete security firewall rule-list /TEST_Firewall_Rule_List/Application/testFirewallRule\ntmsh::modify auth partition TEST_Firewall_Rule_List description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::modify security firewall rule-list /TEST_Firewall_Rule_List/Application/testFirewallRule rules modify \\{ theRule \\{ source \\{ address-lists replace-all-with \\{/TEST_Firewall_Rule_List/Application/addList \\} port-lists replace-all-with \\{/TEST_Firewall_Rule_List/Application/portList \\} \\} destination \\{ address-lists replace-all-with \\{/TEST_Firewall_Rule_List/Application/addList \\} port-lists replace-all-with \\{/TEST_Firewall_Rule_List/Application/portList \\} \\} \\} \\} } e\n}}\n}'
                );
            });

            it('should delete virtuals with transaction-matching-criteria outside of transaction', () => {
                const desiredConfig = {};
                const currentConfig = {
                    '/portList/': {
                        command: 'auth partition',
                        properties: {}
                    },
                    '/portList/Application/tcpService_VS_TMC_OBJ': {
                        command: 'ltm traffic-matching-criteria',
                        properties: {}
                    },
                    '/portList/Application/tcpService': {
                        command: 'ltm virtual',
                        properties: {
                            'traffic-matching-criteria': '/portList/Application/tcpService_VS_TMC_OBJ'
                        }
                    },
                    '/portList/Service_Address-192.0.2.1': {
                        command: 'ltm virtual-address',
                        properties: {}
                    },
                    '/portList/Application/': {
                        command: 'sys folder',
                        properties: {}
                    },
                    '/portList/Application/firewallPortList1': {
                        command: 'security firewall port-list',
                        properties: {}
                    }
                };
                const configDiff = [
                    {
                        kind: 'D',
                        path: [
                            '/portList/'
                        ],
                        lhs: {
                            command: 'auth partition',
                            properties: {}
                        },
                        command: 'auth partition'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/portList/Application/tcpService_VS_TMC_OBJ'
                        ],
                        lhs: {
                            command: 'ltm traffic-matching-criteria',
                            properties: {}
                        },
                        command: 'ltm traffic-matching-criteria'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/portList/Application/tcpService'
                        ],
                        lhs: {
                            command: 'ltm virtual',
                            properties: {}
                        },
                        command: 'ltm virtual'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/portList/Service_Address-192.0.2.1'
                        ],
                        lhs: {
                            command: 'ltm virtual-address',
                            properties: {}
                        },
                        command: 'ltm virtual-address'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/portList/Application/'
                        ],
                        lhs: {
                            command: 'sys folder',
                            properties: {}
                        },
                        command: 'sys folder'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/portList/Application/firewallPortList1'
                        ],
                        lhs: {
                            command: 'security firewall port-list',
                            properties: {}
                        },
                        command: 'security firewall port-list'
                    }
                ];

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::delete ltm virtual /portList/Application/tcpService\ntmsh::begin_transaction\ntmsh::modify auth partition portList description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::delete ltm traffic-matching-criteria /portList/Application/tcpService_VS_TMC_OBJ\n\n\ntmsh::delete security firewall port-list /portList/Application/firewallPortList1\ntmsh::commit_transaction\ntmsh::delete ltm virtual-address /portList/192.0.2.1\ntmsh::delete sys folder /portList/Application/\ntmsh::delete sys folder /portList/\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });

            it('should find referenced address lists inside the transaction and move them out if necessary', () => {
                const desiredConfig = {
                    '/Tenant/Application/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    },
                    '/Tenant/Application/sourceAddressList': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.168.100.0/24': {},
                                '192.168.200.50-192.168.200.60': {}
                            },
                            fqdns: {},
                            geo: {},
                            'address-lists': {}
                        },
                        ignore: []
                    },
                    '/Tenant/Application/destinationAddressList1': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.168.40.0/24': {},
                                '192.168.50.1-192.168.50.10': {}
                            },
                            fqdns: {},
                            geo: {},
                            'address-lists': {}
                        },
                        ignore: []
                    },
                    '/Tenant/Application/destinationAddressList2': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.168.60.0/24': {}
                            },
                            fqdns: {},
                            geo: {},
                            'address-lists': {}
                        },
                        ignore: []
                    },
                    '/Tenant/Application/destinationAddressList3': {
                        command: 'security firewall address-list',
                        properties: {
                            addresses: {
                                '192.168.10.0/24': {},
                                '192.168.20.20-192.168.20.50': {}
                            },
                            fqdns: {},
                            geo: {},
                            'address-lists': {
                                '/Tenant/Application/destinationAddressList1': {},
                                '/Tenant/Application/destinationAddressList2': {}
                            }
                        },
                        ignore: []
                    },
                    '/Tenant/Application/tcpService_VS_TMC_OBJ': {
                        command: 'ltm traffic-matching-criteria',
                        properties: {
                            protocol: 'tcp',
                            'destination-address-inline': 'any/any',
                            'destination-address-list': '/Tenant/Application/destinationAddressList3',
                            'source-address-inline': '0.0.0.0/any',
                            'source-address-list': '/Tenant/Application/sourceAddressList',
                            'route-domain': 'any'
                        },
                        ignore: []
                    },
                    '/Tenant/Application/tcpService': {
                        command: 'ltm virtual',
                        properties: {
                            enabled: true,
                            description: 'Application',
                            profiles: {
                                '/Common/f5-tcp-progressive': {
                                    context: 'all'
                                }
                            },
                            'traffic-matching-criteria': '/Tenant/Application/tcpService_VS_TMC_OBJ'
                        },
                        ignore: []
                    },
                    '/Tenant/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    }
                };

                const currentConfig = {};

                const configDiff = [
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/'
                        ],
                        rhs: {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'sys folder'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/sourceAddressList'
                        ],
                        rhs: {
                            command: 'security firewall address-list',
                            properties: {
                                addresses: {
                                    '192.168.100.0/24': {},
                                    '192.168.200.50-192.168.200.60': {}
                                },
                                fqdns: {},
                                geo: {},
                                'address-lists': {}
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security firewall address-list'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/destinationAddressList1'
                        ],
                        rhs: {
                            command: 'security firewall address-list',
                            properties: {
                                addresses: {
                                    '192.168.40.0/24': {},
                                    '192.168.50.1-192.168.50.10': {}
                                },
                                fqdns: {},
                                geo: {},
                                'address-lists': {}
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security firewall address-list'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/destinationAddressList2'
                        ],
                        rhs: {
                            command: 'security firewall address-list',
                            properties: {
                                addresses: {
                                    '192.168.60.0/24': {}
                                },
                                fqdns: {},
                                geo: {},
                                'address-lists': {}
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security firewall address-list'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/destinationAddressList3'
                        ],
                        rhs: {
                            command: 'security firewall address-list',
                            properties: {
                                addresses: {
                                    '192.168.10.0/24': {},
                                    '192.168.20.20-192.168.20.50': {}
                                },
                                fqdns: {},
                                geo: {},
                                'address-lists': {
                                    '/Tenant/Application/destinationAddressList1': {},
                                    '/Tenant/Application/destinationAddressList2': {}
                                }
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'security firewall address-list'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/tcpService_VS_TMC_OBJ'
                        ],
                        rhs: {
                            command: 'ltm traffic-matching-criteria',
                            properties: {
                                protocol: 'tcp',
                                'destination-address-inline': 'any/any',
                                'destination-address-list': '/Tenant/Application/destinationAddressList3',
                                'source-address-inline': '0.0.0.0/any',
                                'source-address-list': '/Tenant/Application/sourceAddressList',
                                'route-domain': 'any'
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'ltm traffic-matching-criteria'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/Application/tcpService'
                        ],
                        rhs: {
                            command: 'ltm virtual',
                            properties: {
                                enabled: true,
                                description: 'Application',
                                profiles: {
                                    '/Common/f5-tcp-progressive': {
                                        context: 'all'
                                    }
                                },
                                'traffic-matching-criteria': '/Tenant/Application/tcpService_VS_TMC_OBJ'
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'ltm virtual'
                    },
                    {
                        kind: 'N',
                        path: [
                            '/Tenant/'
                        ],
                        rhs: {
                            command: 'auth partition',
                            properties: {
                                'default-route-domain': 0
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'auth partition'
                    }
                ];

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::create auth partition Tenant default-route-domain 0\ntmsh::create sys folder /Tenant/Application/\ntmsh::create security firewall address-list /Tenant/Application/destinationAddressList1 addresses replace-all-with \\{ 192.168.40.0/24 192.168.50.1-192.168.50.10 \\} fqdns none geo none address-lists none\ntmsh::create security firewall address-list /Tenant/Application/destinationAddressList2 addresses replace-all-with \\{ 192.168.60.0/24 \\} fqdns none geo none address-lists none\ntmsh::create security firewall address-list /Tenant/Application/destinationAddressList3 addresses replace-all-with \\{ 192.168.10.0/24 192.168.20.20-192.168.20.50 \\} fqdns none geo none address-lists replace-all-with \\{ /Tenant/Application/destinationAddressList1 /Tenant/Application/destinationAddressList2 \\}\ntmsh::create security firewall address-list /Tenant/Application/sourceAddressList addresses replace-all-with \\{ 192.168.100.0/24 192.168.200.50-192.168.200.60 \\} fqdns none geo none address-lists none\ntmsh::create ltm traffic-matching-criteria /Tenant/Application/tcpService_VS_TMC_OBJ protocol tcp destination-address-inline any/any destination-address-list /Tenant/Application/destinationAddressList3 source-address-inline 0.0.0.0/any source-address-list /Tenant/Application/sourceAddressList route-domain any\ntmsh::begin_transaction\ntmsh::modify auth partition Tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::create ltm virtual /Tenant/Application/tcpService enabled  description Application profiles replace-all-with \\{ /Common/f5-tcp-progressive \\{ context all \\} \\} traffic-matching-criteria /Tenant/Application/tcpService_VS_TMC_OBJ\ntmsh::commit_transaction\ncatch { tmsh::delete ltm traffic-matching-criteria /Tenant/Application/tcpService_VS_TMC_OBJ protocol } e\ncatch { tmsh::delete security firewall address-list /Tenant/Application/sourceAddressList } e\ncatch { tmsh::delete security firewall address-list /Tenant/Application/destinationAddressList3 } e\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::delete security firewall address-list /Tenant/Application/destinationAddressList2 } e\ncatch { tmsh::delete security firewall address-list /Tenant/Application/destinationAddressList1 } e\ncatch { tmsh::delete sys folder /Tenant/Application/ } e\ncatch { tmsh::delete auth partition Tenant } e\n}}\n}'
                );
            });

            describe('no traffic-matching-criteria', () => {
                let desiredConfig;
                let currentConfig;
                let configDiff;

                beforeEach(() => {
                    desiredConfig = {};
                    currentConfig = {
                        '/portList/': {
                            command: 'auth partition',
                            properties: {}
                        },
                        '/portList/Application/': {
                            command: 'sys folder',
                            properties: {}
                        }
                    };
                    configDiff = [
                        {
                            kind: 'D',
                            path: [
                                '/portList/'
                            ],
                            lhs: {
                                command: 'auth partition',
                                properties: {}
                            },
                            command: 'auth partition'
                        },
                        {
                            kind: 'D',
                            path: [
                                '/portList/Application/'
                            ],
                            lhs: {
                                command: 'sys folder',
                                properties: {}
                            },
                            command: 'sys folder'
                        }
                    ];
                });

                it('should delete virtuals without traffic-matching-criteria inside of transaction', () => {
                    currentConfig['/portList/Application/tcpService'] = {
                        command: 'ltm virtual',
                        properties: {
                            destination: '/portList/192.0.2.1:80'
                        }
                    };
                    currentConfig['/portList/Service_Address-192.0.2.1'] = {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '192.0.2.1'
                        }
                    };
                    configDiff.push(
                        {
                            kind: 'D',
                            path: [
                                '/portList/Application/tcpService'
                            ],
                            lhs: {
                                command: 'ltm virtual',
                                properties: {
                                    destination: '/portList/192.0.2.1:80'
                                }
                            },
                            command: 'ltm virtual'
                        }
                    );
                    configDiff.push(
                        {
                            kind: 'D',
                            path: [
                                '/portList/Service_Address-192.0.2.1'
                            ],
                            lhs: {
                                command: 'ltm virtual-address',
                                properties: {}
                            },
                            command: 'ltm virtual-address'
                        }
                    );

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify auth partition portList description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::delete ltm virtual /portList/Application/tcpService\n\ntmsh::delete ltm virtual-address /portList/192.0.2.1\ntmsh::commit_transaction\ntmsh::delete sys folder /portList/Application/\n\ntmsh::delete sys folder /portList/\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });

                it('should delete virtuals without traffic-matching-criteria inside of transaction with any', () => {
                    currentConfig['/portList/Application/tcpService'] = {
                        command: 'ltm virtual',
                        properties: {
                            destination: '/portList/any:80'
                        }
                    };
                    currentConfig['/portList/Service_Address-any'] = {
                        command: 'ltm virtual-address',
                        properties: {
                            address: 'any'
                        }
                    };
                    configDiff.push(
                        {
                            kind: 'D',
                            path: [
                                '/portList/Application/tcpService'
                            ],
                            lhs: {
                                command: 'ltm virtual',
                                properties: {
                                    destination: '/portList/any:80'
                                }
                            },
                            command: 'ltm virtual'
                        }
                    );
                    configDiff.push(
                        {
                            kind: 'D',
                            path: [
                                '/portList/Service_Address-any'
                            ],
                            lhs: {
                                command: 'ltm virtual-address',
                                properties: {}
                            },
                            command: 'ltm virtual-address'
                        }
                    );

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify auth partition portList description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::delete ltm virtual /portList/Application/tcpService\n\ntmsh::delete ltm virtual-address /portList/any\ntmsh::commit_transaction\ntmsh::delete sys folder /portList/Application/\n\ntmsh::delete sys folder /portList/\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });

                it('should delete virtuals without traffic-matching-criteria inside of transaction with any6', () => {
                    currentConfig['/portList/Application/tcpService'] = {
                        command: 'ltm virtual',
                        properties: {
                            destination: '/portList/any6.80'
                        }
                    };
                    currentConfig['/portList/Service_Address-any6'] = {
                        command: 'ltm virtual-address',
                        properties: {
                            address: 'any6'
                        }
                    };
                    configDiff.push(
                        {
                            kind: 'D',
                            path: [
                                '/portList/Application/tcpService'
                            ],
                            lhs: {
                                command: 'ltm virtual',
                                properties: {
                                    destination: '/portList/any6.80'
                                }
                            },
                            command: 'ltm virtual'
                        }
                    );
                    configDiff.push(
                        {
                            kind: 'D',
                            path: [
                                '/portList/Service_Address-any6'
                            ],
                            lhs: {
                                command: 'ltm virtual-address',
                                properties: {}
                            },
                            command: 'ltm virtual-address'
                        }
                    );

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify auth partition portList description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::delete ltm virtual /portList/Application/tcpService\n\ntmsh::delete ltm virtual-address /portList/any6\ntmsh::commit_transaction\ntmsh::delete sys folder /portList/Application/\n\ntmsh::delete sys folder /portList/\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });
            });
        });

        describe('pem policy', () => {
            it('should properly setup preTrans, trans, and rollback during a delete', () => {
                const desiredConfig = {};
                const currentConfig = {
                    '/TEST_Pem_Policy/App/testPemPolicy': {
                        command: 'pem policy',
                        properties: {
                            rules: {
                                theRule: {
                                    'tcp-optimization-downlink': '/TEST_Pem_Policy/App/testTcpProfile',
                                    'tcp-optimization-uplink': '/TEST_Pem_Policy/App/testTcpProfile',
                                    'dscp-marking-downlink': 'pass-through',
                                    'dscp-marking-uplink': 'pass-through',
                                    precedence: 1
                                }
                            }
                        },
                        ignore: []
                    }
                };
                const configDiff = [
                    {
                        kind: 'D',
                        path: [
                            '/TEST_Pem_Policy/App/testPemPolicy'
                        ],
                        lhs: {
                            command: 'pem policy',
                            properties: {
                                rules: {
                                    theRule: {
                                        'tcp-optimization-downlink': '/TEST_Pem_Policy/App/testTcpProfile',
                                        'tcp-optimization-uplink': '/TEST_Pem_Policy/App/testTcpProfile',
                                        'dscp-marking-downlink': 'pass-through',
                                        'dscp-marking-uplink': 'pass-through',
                                        precedence: 1
                                    }
                                }
                            }
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'pem policy'
                    }
                ];
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::modify pem policy /TEST_Pem_Policy/App/testPemPolicy rules modify \\{ theRule \\{ tcp-optimization-downlink none tcp-optimization-uplink none \\} \\}\ntmsh::begin_transaction\ntmsh::delete pem policy /TEST_Pem_Policy/App/testPemPolicy\ntmsh::modify auth partition TEST_Pem_Policy description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\ncatch { tmsh::modify pem policy /TEST_Pem_Policy/App/testPemPolicy rules modify \\{ theRule \\{ tcp-optimization-downlink /TEST_Pem_Policy/App/testTcpProfile tcp-optimization-uplink /TEST_Pem_Policy/App/testTcpProfile \\} \\} } e\n}}\n}'
                );
            });
        });

        describe('sys log-config publisher', () => {
            it('should properly modify the log publisher to empty destinations', () => {
                const desiredConfig = {
                    '/TEST_Sys_Log_Config/App/logPublisher': {
                        command: 'sys log-config publisher',
                        properties: {
                            description: 'none',
                            destinations: {}
                        }
                    }
                };
                const currentConfig = {
                    '/TEST_Sys_Log_Config/App/logPublisher': {
                        command: 'sys log-config publisher',
                        properties: {
                            description: 'Something Else',
                            destinations: {
                                '/TEST_Sys_Log_Config/App/logDestinationSyslog': {}
                            }
                        }
                    }
                };
                const configDiff = [
                    {
                        kind: 'E',
                        path: [
                            '/TEST_Sys_Log_Config/App/logPublisher',
                            'properties',
                            'description'
                        ],
                        lhs: 'Something Else',
                        rhs: 'none',
                        tags: ['tmsh'],
                        command: 'sys log-config publisher'
                    },
                    {
                        kind: 'D',
                        path: [
                            '/TEST_Sys_Log_Config/App/logPublisher',
                            'properties',
                            'destinations',
                            '/TEST_Sys_Log_Config/App/logDest'
                        ],
                        lhs: {},
                        tags: ['tmsh'],
                        command: 'sys log-config publisher'
                    }
                ];
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify sys log-config publisher /TEST_Sys_Log_Config/App/logPublisher destinations none\ntmsh::delete sys log-config publisher /TEST_Sys_Log_Config/App/logPublisher\ntmsh::create sys log-config publisher /TEST_Sys_Log_Config/App/logPublisher description none destinations none\ntmsh::modify auth partition TEST_Sys_Log_Config description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });
            it('should properly delete the log publisher', () => {
                const desiredConfig = {};
                const currentConfig = {
                    '/TEST_Sys_Log_Config/App/logPublisher': {
                        command: 'sys log-config publisher',
                        properties: {
                            destinations: {
                                '/TEST_Sys_Log_Config/App/logDestinationSyslog': {}
                            }
                        }
                    }
                };
                const configDiff = [
                    {
                        kind: 'D',
                        command: 'sys log-config publisher',
                        path: ['/TEST_Sys_Log_Config/App/logPublisher'],
                        lhs: {
                            command: 'sys log-config publisher',
                            properties: {
                                description: 'none',
                                destinations: {
                                    '/TEST_Sys_Log_Config/App/logDestinationSyslog': {}
                                }
                            }
                        },
                        tags: ['tmsh']
                    }
                ];
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify sys log-config publisher /TEST_Sys_Log_Config/App/logPublisher destinations none\ntmsh::modify auth partition TEST_Sys_Log_Config description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::commit_transaction\ntmsh::delete sys log-config publisher /TEST_Sys_Log_Config/App/logPublisher\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });
        });

        describe('ltm virtual-address', () => {
            it('should throw an error if the virtualAddress is attempting to be modified', () => {
                const desiredConfig = {
                    '/tenant/Service_Address-vaddr': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '10.0.1.20',
                            arp: 'enabled'
                        }
                    }
                };
                const currentConfig = {
                    '/tenant/Service_Address-vaddr': {
                        command: 'ltm virtual-address',
                        properties: {
                            address: '10.0.1.10',
                            arp: 'enabled'
                        }
                    }
                };
                const configDiff = [
                    {
                        kind: 'E',
                        command: 'ltm virtual-address',
                        path: [
                            '/tenant/Service_Address-vaddr',
                            'properties',
                            'address'
                        ],
                        lhs: '10.0.1.10',
                        rhs: '10.0.1.20',
                        tags: ['tmsh']
                    }
                ];

                assert.throws(
                    () => fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff),
                    'The Service Address virtualAddress property cannot be modified. Please delete /tenant/vaddr and recreate it.'
                );
            });
        });

        describe('ltm node', () => {
            it('should allow edits to Common nodes on first pass of /Common tenant', () => {
                const desiredConfig = {
                    '/Common/10.1.1.1': {
                        command: 'ltm node',
                        properties: {
                            address: '10.1.1.1',
                            metadata: {
                                references: {
                                    value: 2
                                }
                            }
                        },
                        ignore: []
                    }
                };
                const currentConfig = {};
                const configDiff = [
                    {
                        kind: 'E',
                        path: [
                            '/Common/10.1.1.1'
                        ],
                        rhs: {
                            command: 'ltm node',
                            properties: {
                                address: '10.1.1.1',
                                metadata: {
                                    references: {
                                        value: 2
                                    }
                                }
                            },
                            ignore: []
                        },
                        lhsCommand: 'ltm node',
                        tags: [
                            'tmsh'
                        ],
                        command: 'ltm node'
                    }
                ];
                context.currentIndex = 0;
                context.tasks = [{ firstPassNoDelete: true }];

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\nif {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n}\nif { [catch {\ntmsh::begin_transaction\ntmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\ntmsh::modify ltm node /Common/10.1.1.1 metadata replace-all-with \\{ references \\{ value 2 \\} \\}\ntmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\nregsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });
        });

        describe('gtm', () => {
            let desiredConfig;
            let currentConfig;
            let configDiff;

            beforeEach(() => {
                desiredConfig = {
                    '/Common/global-settings': {
                        command: 'gtm global-settings load-balancing',
                        ignore: [],
                        properties: { 'topology-longest-match': 'no' }
                    },
                    '/Common/topology/records': {
                        command: 'gtm topology',
                        ignore: [],
                        properties: {
                            records: [
                                {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'subnet 10.103.216.18/32',
                                    score: 5,
                                    'server:': 'datacenter /Common/voip'
                                }
                            ]
                        }
                    },
                    '/Common/voip': {
                        command: 'gtm datacenter',
                        ignore: [],
                        properties: {
                            enabled: '',
                            metadata: { as3: { persist: 'true' } },
                            'proper-fallback': 'any-available',
                            'prober-preference': 'inside-datacenter'
                        }
                    }
                };
                currentConfig = {
                    '/Common/global-settings': {
                        command: 'gtm global-settings load-balancing',
                        properties: { 'topology-longest-match': 'yes' }
                    }
                };
                configDiff = [
                    {
                        command: 'gtm global-settings load-balancing',
                        kind: 'E',
                        lhs: 'yes',
                        lhsCommand: 'gtm global-settings load-balancing',
                        path: ['/Common/global-settings', 'properties', 'topology-longest-match'],
                        rhs: 'no',
                        rhsCommand: 'gtm global-settings load-balancing',
                        tags: ['tmsh']
                    },
                    {
                        command: 'gtm datacenter',
                        kind: 'N',
                        lhsCommand: '',
                        path: ['/Common/voip'],
                        rhsCommand: 'gtm datacenter',
                        rhs: {
                            command: 'gtm datacenter',
                            ignore: [],
                            properties: {
                                enabled: '',
                                metadata: { as3: { persist: 'true' } },
                                'prober-fallback': 'any-available',
                                'prober-preference': 'inside-datacenter'
                            }
                        },
                        tags: ['tmsh']
                    },
                    {
                        command: 'gtm topology',
                        kind: 'N',
                        lhsCommand: '',
                        path: ['/Common/topology/records'],
                        rhs: {
                            command: 'gtm topology',
                            ignore: [],
                            properties: {
                                records: {
                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                    'ldns:': 'subnet 10.103.216.18/32',
                                    score: 5,
                                    'server:': 'datacenter /Common/voip'
                                }
                            }
                        },
                        tags: ['tmsh']
                    }
                ];
                context.currentIndex = 0;
                context.tasks = [{ firstPassNoDelete: true }];
            });

            describe('gtmTopologyProcessed', () => {
                let commonConfig;

                beforeEach(() => {
                    desiredConfig = {};
                    currentConfig = {
                        '/Common/topology/records': {
                            command: 'gtm topology',
                            ignore: [],
                            properties: {
                                records: [
                                    {
                                        description: '"This object is managed by appsvcs, do not modify this description"',
                                        'ldns:': 'subnet 10.103.216.18/32',
                                        score: 5,
                                        'server:': 'datacenter /Common/voip'
                                    }
                                ]
                            }
                        }
                    };
                    configDiff = [
                        {
                            kind: 'D',
                            command: 'gtm topology',
                            path: ['/Common/topology/records'],
                            lhs: {
                                command: 'gtm topology',
                                ignore: [],
                                properties: {
                                    records: {
                                        description: '"This object is managed by appsvcs, do not modify this description"',
                                        'ldns:': 'subnet 10.103.216.18/32',
                                        score: 5,
                                        'server:': 'datacenter /Common/voip'
                                    }
                                }
                            },
                            tags: ['tmsh']
                        }
                    ];
                    context.currentIndex = 0;
                    commonConfig = { nodeList: [] };
                });

                it('should not delete topology record from current config when gtmTopologyProcessed is true and no value in desired config', () => {
                    context.tasks = [{ gtmTopologyProcessed: true }];
                    sinon.stub(util, 'iControlRequest').resolves({ statusCode: 404 });
                    return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                        .then((actualDiffs) => {
                            assert.deepStrictEqual(actualDiffs, []);
                        });
                });

                it('should delete topology record from current config when gtmTopologyProcessed is not present and no value in desired config', () => {
                    context.tasks = [{ }];
                    sinon.stub(util, 'iControlRequest').resolves({ statusCode: 404 });
                    return fetch.getDiff(context, currentConfig, desiredConfig, commonConfig, {})
                        .then((actualDiffs) => {
                            assert.strictEqual(actualDiffs.length, 1);
                            assert.deepStrictEqual(actualDiffs[0],
                                {
                                    kind: 'D',
                                    path: ['/Common/topology/records'],
                                    lhs: {
                                        command: 'gtm topology',
                                        ignore: [],
                                        properties: {
                                            records: [
                                                {
                                                    description: '"This object is managed by appsvcs, do not modify this description"',
                                                    'ldns:': 'subnet 10.103.216.18/32',
                                                    score: 5,
                                                    'server:': 'datacenter /Common/voip'
                                                }
                                            ]
                                        }
                                    }
                                });
                        });
                });
            });

            it('should successfully create a single datacenter and corresponding topology on 14.0 and older', () => {
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\n'
                    + 'if {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n'
                    + '} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n'
                    + '}\nif { [catch {\ntmsh::begin_transaction\n'
                    + 'tmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                    + 'tmsh::create gtm datacenter /Common/voip enabled  metadata replace-all-with \\{ as3 \\{ persist true \\} \\} proper-fallback any-available prober-preference inside-datacenter\n'
                    + 'tmsh::commit_transaction\ntmsh::begin_transaction\n'
                    + 'tmsh::delete gtm topology all\n'
                    + 'tmsh::create gtm topology  ldns: subnet 10.103.216.18/32 score 5 server: datacenter /Common/voip description \\"This object is managed by appsvcs, do not modify this description\\" \n'
                    + 'tmsh::commit_transaction\ntmsh::begin_transaction\n'
                    + 'tmsh::delete gtm topology all\ntmsh::commit_transaction\n'
                    + 'tmsh::begin_transaction\ntmsh::create gtm topology  ldns: subnet 10.103.216.18/32 score 5 server: datacenter /Common/voip description \\"This object is managed by appsvcs, do not modify this description\\" \n'
                    + 'tmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\n'
                    + 'regsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });

            it('should successfully create a single datacenter and corresponding topology on 14.1+', () => {
                context.target.tmosVersion = '14.1.0';
                desiredConfig['/Common/topology/records'].properties.records[0].order = 1;
                configDiff[2].rhs.properties.records.order = 1;

                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\n'
                    + 'if {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n'
                    + '} err]} {\ntmsh::create ltm data-group internal __appsvcs_update type string records none\n'
                    + '}\nif { [catch {\ntmsh::begin_transaction\n'
                    + 'tmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                    + 'tmsh::create gtm datacenter /Common/voip enabled  metadata replace-all-with \\{ as3 \\{ persist true \\} \\} proper-fallback any-available prober-preference inside-datacenter\n'
                    + 'tmsh::commit_transaction\ntmsh::begin_transaction\n'
                    + 'tmsh::delete gtm topology all\n'
                    + 'tmsh::create gtm topology  ldns: subnet 10.103.216.18/32 score 5 server: datacenter /Common/voip order 1 description \\"This object is managed by appsvcs, do not modify this description\\" \n'
                    + 'tmsh::commit_transaction\n} err] } {\ncatch { tmsh::cancel_transaction } e\n'
                    + 'regsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });

            describe('gtm pool', () => {
                beforeEach(() => {
                    desiredConfig = {
                        '/Common/gtmPool': {
                            command: 'gtm pool a',
                            ignore: [],
                            properties: {
                                members: [
                                    {
                                        server: '/Common/myGslbServer',
                                        virtualServer: '/Common/myHttpsService'
                                    }
                                ]
                            }
                        }
                    };
                    configDiff = [
                        {
                            kind: 'N',
                            path: [
                                '/Common/gtmPool'
                            ],
                            rhs: {
                                command: 'gtm pool a',
                                properties: {
                                    membes: [
                                        {
                                            server: '/Common/myGslbServer',
                                            virtualServer: '/Common/myHttpsService'
                                        }
                                    ]
                                },
                                ignore: []
                            },
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm pool a',
                            lhsCommand: '',
                            rhsCommand: 'gtm pool a'
                        }
                    ];
                });

                it('should add a wait between transactions if needed', () => {
                    context.target.tmosVersion = '14.1.0';
                    context.currentIndex = 0;
                    context.tasks = [{ metadata: { gslbPool: { needsWait: true } } }];

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\n'
                        + 'proc script::run {} {\n'
                        + 'if {[catch {\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records none\n'
                        + '} err]} {\n'
                        + 'tmsh::create ltm data-group internal __appsvcs_update type string records none\n}\n'
                        + 'if { [catch {\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                        + 'tmsh::commit_transaction\n'
                        + 'after 20000\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::create gtm pool a /Common/gtmPool members replace-all-with \\{ 0 \\{ server /Common/myGslbServer virtualServer /Common/myHttpsService enabled  \\} \\} enabled \n'
                        + 'tmsh::commit_transaction\n'
                        + '} err] } {\n'
                        + 'catch { tmsh::cancel_transaction } e\n'
                        + 'regsub -all {"} $err {\\"} err\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });

                it('should not add a wait between transactions if not needed', () => {
                    context.target.tmosVersion = '14.1.0';
                    context.currentIndex = 0;

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\n'
                        + 'proc script::run {} {\n'
                        + 'if {[catch {\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records none\n'
                        + '} err]} {\n'
                        + 'tmsh::create ltm data-group internal __appsvcs_update type string records none\n}\n'
                        + 'if { [catch {\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                        + 'tmsh::commit_transaction\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::create gtm pool a /Common/gtmPool members replace-all-with \\{ 0 \\{ server /Common/myGslbServer virtualServer /Common/myHttpsService enabled  \\} \\} enabled \n'
                        + 'tmsh::commit_transaction\n'
                        + '} err] } {\n'
                        + 'catch { tmsh::cancel_transaction } e\n'
                        + 'regsub -all {"} $err {\\"} err\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });
            });

            describe('gtm wideip', () => {
                beforeEach(() => {
                    desiredConfig = {
                        '/Common/wideip': {
                            command: 'gtm wideip a',
                            ignore: [],
                            properties: {
                                aliases: 'none',
                                enabled: '',
                                'pool-lb-mode': 'round-robin',
                                pools: {
                                    '/Common/wideip': {
                                        order: 0,
                                        ratio: 1
                                    }
                                },
                                'pools-cname': {},
                                rules: {}
                            }
                        }
                    };
                    configDiff = [
                        {
                            kind: 'N',
                            path: [
                                '/Common/wideip'
                            ],
                            rhs: {
                                command: 'gtm wideip a',
                                properties: {
                                    aliases: 'none',
                                    enabled: '',
                                    'pool-lb-mode': 'round-robin',
                                    pools: {
                                        '/Common/wideip': {
                                            order: 0,
                                            ratio: 1
                                        }
                                    },
                                    'pools-cname': {},
                                    rules: {}
                                },
                                ignore: []
                            },
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm wideip a',
                            lhsCommand: '',
                            rhsCommand: 'gtm wideip a'
                        }
                    ];
                });

                it('should add command to create gtm wideip in a separate transaction', () => {
                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\n'
                        + 'proc script::run {} {\n'
                        + 'if {[catch {\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records none\n'
                        + '} err]} {\n'
                        + 'tmsh::create ltm data-group internal __appsvcs_update type string records none\n}\n'
                        + 'if { [catch {\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                        + 'tmsh::commit_transaction\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::create gtm wideip a \\"/Common/wideip\\" aliases none enabled  pool-lb-mode round-robin pools replace-all-with \\{ /Common/wideip \\{ order 0 ratio 1 \\} \\} pools-cname none rules none\n'
                        + 'tmsh::commit_transaction\n'
                        + '} err] } {\n'
                        + 'catch { tmsh::cancel_transaction } e\n'
                        + 'regsub -all {"} $err {\\"} err\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });

                it('should handle gtm wideip and adding aliases in a separate transaction', () => {
                    desiredConfig['/Common/wideip'].properties.aliases = {
                        alias: {}
                    };
                    configDiff = [
                        {
                            kind: 'N',
                            path: [
                                '/Common/wideip',
                                'properties',
                                'aliases',
                                'alias'
                            ],
                            rhs: {},
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm wideip a',
                            lhsCommand: 'gtm wideip a',
                            rhsCommand: 'gtm wideip a'
                        }
                    ];
                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.strictEqual(
                        result.script,
                        'cli script __appsvcs_update {\n'
                        + 'proc script::run {} {\n'
                        + 'if {[catch {\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records none\n'
                        + '} err]} {\n'
                        + 'tmsh::create ltm data-group internal __appsvcs_update type string records none\n}\n'
                        + 'if { [catch {\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::modify auth partition Common description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                        + 'tmsh::commit_transaction\n'
                        + 'tmsh::begin_transaction\n'
                        + 'tmsh::delete gtm wideip a \\"/Common/wideip\\"\n'
                        + 'tmsh::create gtm wideip a \\"/Common/wideip\\" aliases replace-all-with \\{ \\"alias\\" \\} enabled  pool-lb-mode round-robin pools replace-all-with \\{ /Common/wideip \\{ order 0 ratio 1 \\} \\} pools-cname none rules none\n'
                        + 'tmsh::commit_transaction\n'
                        + '} err] } {\n'
                        + 'catch { tmsh::cancel_transaction } e\n'
                        + 'regsub -all {"} $err {\\"} err\n'
                        + 'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                    );
                });
            });

            describe('gtm server', () => {
                beforeEach(() => {
                    context.currentIndex = 0;
                    context.tasks = [{ firstPassNoDelete: false }];
                });

                it('should use modify for gtm server updates', () => {
                    desiredConfig = {
                        '/Common/server1': {
                            command: 'gtm server',
                            properties: {
                                'prober-preference': 'inherit',
                                'prober-fallback': 'inherit',
                                'prober-pool': 'none',
                                datacenter: '/Common/dc1',
                                devices: {
                                    0: {
                                        addresses: {
                                            '10.20.164.164': {
                                                translation: 'none'
                                            }
                                        }
                                    }
                                },
                                'virtual-servers': {},
                                'virtual-server-discovery': 'enabled-no-delete'
                            }
                        }
                    };

                    configDiff = [
                        {
                            kind: 'E',
                            path: [
                                '/Common/server1',
                                'properties',
                                'prober-preference'
                            ],
                            lhs: 'pool',
                            rhs: 'inherit',
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm server',
                            lhsCommand: 'gtm server',
                            rhsCommand: 'gtm server'
                        },
                        {
                            kind: 'E',
                            path: [
                                '/Common/server1',
                                'properties',
                                'prober-pool'
                            ],
                            lhs: '/Common/prober1',
                            rhs: 'none',
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm server'
                        }
                    ];

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.notStrictEqual(
                        result.script.indexOf(
                            'tmsh::modify gtm server /Common/server1 prober-preference inherit prober-fallback inherit prober-pool none'
                        ),
                        -1
                    );
                });

                it('should use create for gtm server create', () => {
                    desiredConfig = {
                        '/Common/server1': {
                            command: 'gtm server',
                            properties: {
                                metadata: {
                                    as3: {
                                        persist: 'true'
                                    }
                                },
                                description: 'none',
                                enabled: '',
                                product: 'bigip',
                                'prober-preference': 'inherit',
                                'prober-fallback': 'inherit',
                                'prober-pool': 'none',
                                datacenter: '/Common/dc1',
                                devices: {
                                    0: {
                                        addresses: {
                                            '10.20.164.164': {
                                                translation: 'none'
                                            }
                                        }
                                    }
                                },
                                'virtual-servers': {},
                                'virtual-server-discovery': 'enabled-no-delete'
                            },
                            ignore: []
                        }
                    };

                    configDiff = [
                        {
                            kind: 'N',
                            path: [
                                '/Common/server1'
                            ],
                            rhs: {
                                command: 'gtm server',
                                properties: {
                                    description: 'none',
                                    enabled: '',
                                    product: 'bigip',
                                    'prober-preference': 'inherit',
                                    'prober-fallback': 'inherit',
                                    'prober-pool': 'none',
                                    datacenter: '/Common/dc1',
                                    devices: {
                                        0: {
                                            addresses: {
                                                '10.20.164.164': {
                                                    translation: 'none'
                                                }
                                            }
                                        }
                                    },
                                    'virtual-servers': {},
                                    'virtual-server-discovery': 'enabled-no-delete'
                                },
                                ignore: []
                            },
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm server',
                            lhsCommand: '',
                            rhsCommand: 'gtm server'
                        }
                    ];

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.notStrictEqual(result.script.indexOf('tmsh::create gtm server /Common/server1'), -1);
                    assert.strictEqual(result.script.indexOf('tmsh::delete gtm server'), -1);
                });

                it('should use delete for creating one server and deleting another', () => {
                    desiredConfig = {
                        '/Common/server2': {
                            command: 'gtm server',
                            properties: {
                                metadata: {
                                    as3: {
                                        persist: 'true'
                                    }
                                },
                                description: 'none',
                                enabled: true,
                                product: 'bigip',
                                'prober-preference': 'pool',
                                'prober-fallback': 'inherit',
                                'prober-pool': '/Common/prober2',
                                monitor: '/Common/bigip',
                                datacenter: '/Common/dc1',
                                devices: {
                                    0: {
                                        addresses: {
                                            '10.20.164.165': {
                                                translation: 'none'
                                            }
                                        }
                                    }
                                },
                                'virtual-servers': {},
                                'virtual-server-discovery': 'enabled-no-delete'
                            },
                            ignore: []
                        }
                    };

                    configDiff = [
                        {
                            kind: 'D',
                            path: [
                                '/Common/server1'
                            ],
                            lhs: {
                                command: 'gtm server',
                                properties: {
                                    description: 'none',
                                    enabled: true,
                                    product: 'bigip',
                                    'prober-preference': 'inherit',
                                    'prober-fallback': 'inherit',
                                    'prober-pool': 'none',
                                    datacenter: '/Common/dc1',
                                    devices: {
                                        0: {
                                            addresses: {
                                                '10.20.164.164': {
                                                    translation: 'none'
                                                }
                                            }
                                        }
                                    },
                                    'virtual-servers': {},
                                    'virtual-server-discovery': 'enabled-no-delete'
                                },
                                ignore: []
                            },
                            tags: [
                                'tmsh'
                            ],
                            command: 'gtm server',
                            lhsCommand: 'gtm server',
                            rhsCommand: ''
                        }
                    ];

                    const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                    assert.notStrictEqual(result.script.indexOf('tmsh::delete gtm server /Common/server1'), -1);
                });
            });
        });

        describe('cleaning up nodes', () => {
            let desiredConfig;
            let currentConfig;
            let configDiff;

            beforeEach(() => {
                desiredConfig = {};
                currentConfig = {
                    '/tenant/': {
                        command: 'auth partition',
                        properties: {
                            'default-route-domain': 0
                        },
                        ignore: []
                    },
                    '/tenant/app/': {
                        command: 'sys folder',
                        properties: {},
                        ignore: []
                    }
                };
                configDiff = [
                    {
                        kind: 'D',
                        path: [
                            '/tenant/'
                        ],
                        lhs: {
                            command: 'auth partition',
                            properties: {
                                'default-route-domain': 0
                            },
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'auth partition',
                        lhsCommand: 'auth partition',
                        rhsCommand: ''
                    },
                    {
                        kind: 'D',
                        path: [
                            '/tenant/app/'
                        ],
                        lhs: {
                            command: 'sys folder',
                            properties: {},
                            ignore: []
                        },
                        tags: [
                            'tmsh'
                        ],
                        command: 'sys folder',
                        lhsCommand: 'sys folder',
                        rhsCommand: ''
                    }
                ];
            });

            it('should add commands to remove nodes from a partition when there are nodes', () => {
                context.host.parser.nodelist = [
                    {
                        fullPath: '/tenant/node',
                        key: '192.0.2.4'
                    }
                ];
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\n'
                    + 'if {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\n'
                    + 'tmsh::create ltm data-group internal __appsvcs_update type string records none\n}\n'
                    + 'if { [catch {\ntmsh::begin_transaction\n'
                    + 'tmsh::modify auth partition tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                    + 'tmsh::commit_transaction\n'
                    + 'tmsh::cd /tenant\n'
                    + 'foreach {node} [tmsh::get_config /ltm node] {\n'
                    + '  tmsh::delete ltm node [tmsh::get_name $node]\n}\n'
                    + 'tmsh::cd /Common\n'
                    + 'tmsh::delete sys folder /tenant/app/\n'
                    + 'tmsh::delete sys folder /tenant/\n'
                    + '} err] } {\ncatch { tmsh::cancel_transaction } e\n'
                    + 'regsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });

            it('should not add commands to remove nodes from a partition when there are not nodes', () => {
                const result = fetch.tmshUpdateScript(context, desiredConfig, currentConfig, configDiff);
                assert.strictEqual(
                    result.script,
                    'cli script __appsvcs_update {\nproc script::run {} {\n'
                    + 'if {[catch {\ntmsh::modify ltm data-group internal __appsvcs_update records none\n} err]} {\n'
                    + 'tmsh::create ltm data-group internal __appsvcs_update type string records none\n}\n'
                    + 'if { [catch {\ntmsh::begin_transaction\n'
                    + 'tmsh::modify auth partition tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"\n'
                    + 'tmsh::commit_transaction\n'
                    + 'tmsh::delete sys folder /tenant/app/\n'
                    + 'tmsh::delete sys folder /tenant/\n'
                    + '} err] } {\ncatch { tmsh::cancel_transaction } e\n'
                    + 'regsub -all {"} $err {\\"} err\ntmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}\n}}\n}'
                );
            });
        });
    });

    describe('.gatherAccessProfileItems', () => {
        it('should resolve when no access profiles', () => {
            const partition = 'thePartition';
            const config = [];
            context.tasks = [{}];

            return fetch.gatherAccessProfileItems(context, partition, config)
                .then((result) => {
                    assert.deepStrictEqual(result, []);
                    assert.deepStrictEqual(context.tasks, [{}]);
                });
        });

        it('should gather up access profile items', () => {
            sinon.stub(util, 'executeBashCommand').resolves('aaa_saml_server    /thePartition/accessProfile-sp_transfer\ncertificate_file_object      /thePartition/accessProfile-portal-sts.leidos.com.crt\npool               /thePartition/accessProfile-AD_Pool-emptyPool');
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/pool/~thePartition~accessProfile-AD_Pool-emptyPool/members')
                .reply(200, {
                    kind: 'tm:ltm:pool:members:memberscollectionstate',
                    items: []
                });
            const config = [
                {
                    kind: 'apm:profile:access',
                    items: [
                        {
                            name: 'accessProfile'
                        }
                    ]
                }
            ];
            return fetch.gatherAccessProfileItems(context, 'thePartition', config)
                .then((result) => {
                    assert.deepStrictEqual(
                        result,
                        [
                            '/thePartition/accessProfile-sp_transfer',
                            '/thePartition/accessProfile-portal-sts.leidos.com.crt',
                            '/thePartition/accessProfile-AD_Pool-emptyPool'
                        ]
                    );
                    assert.deepStrictEqual(context.tasks, [
                        {
                            metadata: {
                                thePartition: {
                                    _apmProfilesAlreadyInTenant: [
                                        'accessProfile'
                                    ]
                                }
                            },
                            tenantsInPath: [],
                            urlPrefix: 'http://localhost:8100'
                        }
                    ]);
                });
        });

        it('should also return accessProfile pool members', () => {
            sinon.stub(util, 'executeBashCommand').resolves('aaa_saml_server    /thePartition/accessProfile-sp_transfer\ncertificate_file_object      /thePartition/accessProfile-portal-sts.leidos.com.crt\npool               /thePartition/accessProfile-AD_Pool-pool\npool               /thePartition/accessProfile-AD_Pool-emptyPool');
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/pool/~thePartition~accessProfile-AD_Pool-pool/members')
                .reply(200, {
                    kind: 'tm:ltm:pool:members:memberscollectionstate',
                    items: [
                        {
                            kind: 'tm:ltm:pool:members:membersstate',
                            name: '10.0.0.1:0',
                            partition: 'thePartition',
                            fullPath: '/thePartition/10.0.0.1:0',
                            address: '10.0.0.1',
                            ephemeral: 'false'
                        },
                        {
                            kind: 'tm:ltm:pool:members:membersstate',
                            name: '10.1.2.3',
                            partition: 'thePartition',
                            fullPath: '/thePartition/10.1.2.3',
                            address: '10.1.2.3',
                            ephemeral: 'false'
                        }
                    ]
                })
                .get('/mgmt/tm/ltm/pool/~thePartition~accessProfile-AD_Pool-emptyPool/members')
                .reply(200, {
                    kind: 'tm:ltm:pool:members:memberscollectionstate',
                    items: []
                });

            const config = [
                {
                    kind: 'apm:profile:access',
                    items: [
                        {
                            name: 'accessProfile'
                        }
                    ]
                }
            ];

            return fetch.gatherAccessProfileItems(context, 'thePartition', config)
                .then((result) => {
                    assert.deepStrictEqual(
                        result,
                        [
                            '/thePartition/accessProfile-sp_transfer',
                            '/thePartition/accessProfile-portal-sts.leidos.com.crt',
                            '/thePartition/accessProfile-AD_Pool-pool',
                            '/thePartition/accessProfile-AD_Pool-emptyPool',
                            '/thePartition/10.0.0.1',
                            '/thePartition/10.1.2.3'
                        ]
                    );
                    assert.deepStrictEqual(context.tasks, [
                        {
                            metadata: {
                                thePartition: {
                                    _apmProfilesAlreadyInTenant: [
                                        'accessProfile'
                                    ]
                                }
                            },
                            tenantsInPath: [],
                            urlPrefix: 'http://localhost:8100'
                        }
                    ]);
                });
        });

        it('should also gracefully error if the pool is for some reason not on the BIG-IP', () => {
            sinon.stub(util, 'executeBashCommand').resolves('aaa_saml_server    /thePartition/accessProfile-sp_transfer\ncertificate_file_object      /thePartition/accessProfile-portal-sts.leidos.com.crt\npool               /thePartition/accessProfile-AD_Pool-pool');
            nock('http://localhost:8100')
                .get('/mgmt/tm/ltm/pool/~thePartition~accessProfile-AD_Pool-pool/members')
                .reply(404, {
                    code: 404,
                    message: 'The requested Pool (/thePartition/accessProfile-AD_Pool-pool) was not found.',
                    errorStack: [],
                    apiError: 3
                });

            const config = [
                {
                    kind: 'apm:profile:access',
                    items: [
                        {
                            name: 'accessProfile'
                        }
                    ]
                }
            ];

            return assert.becomes(
                fetch.gatherAccessProfileItems(context, 'thePartition', config),
                [
                    '/thePartition/accessProfile-sp_transfer',
                    '/thePartition/accessProfile-portal-sts.leidos.com.crt',
                    '/thePartition/accessProfile-AD_Pool-pool'
                ]
            );
        });

        it('should handle /Common access profile items and the executeBashCommand returns undefined', () => {
            sinon.stub(util, 'executeBashCommand').resolves(undefined);
            const config = [
                {
                    kind: 'apm:profile:access',
                    items: [
                        {
                            name: 'accessProfile',
                            partition: 'Common'
                        },
                        {
                            name: 'accessProfile_1',
                            partition: 'Common'
                        }
                    ]
                }
            ];
            return fetch.gatherAccessProfileItems(context, 'Common', config)
                .then((result) => {
                    assert.deepStrictEqual(context.tasks, [
                        {
                            metadata: {
                                Common: {
                                    _apmProfilesAlreadyInTenant: [
                                        'accessProfile',
                                        'accessProfile_1'
                                    ]
                                }
                            },
                            tenantsInPath: [],
                            urlPrefix: 'http://localhost:8100'
                        }
                    ]);
                    assert.deepStrictEqual(result, []);
                });
        });

        it('should handle /Common access profile items if there is metadata already there', () => {
            sinon.stub(util, 'executeBashCommand').resolves(undefined);
            context.tasks[0] = {
                metadata: {
                    Common: {
                        _apmProfilesAlreadyInTenant: [
                            'oldProfile'
                        ]
                    }
                }
            };
            const config = [
                {
                    kind: 'apm:profile:access',
                    items: [
                        {
                            name: 'accessProfile',
                            partition: 'Common'
                        }
                    ]
                }
            ];
            return fetch.gatherAccessProfileItems(context, 'Common', config)
                .then((result) => {
                    assert.deepStrictEqual(context.tasks, [
                        {
                            metadata: {
                                Common: {
                                    _apmProfilesAlreadyInTenant: [
                                        'accessProfile'
                                    ]
                                }
                            }
                        }
                    ]);
                    assert.deepStrictEqual(result, []);
                });
        });

        it('should handle if the executeBashCommand returns an error', () => {
            // Note: This is probably not desirable behaviour, but this is current behaviour
            sinon.stub(util, 'executeBashCommand').resolves('Incorrect arguments: <name> is not defined\n\nProfile/Policy Management Tool\n');
            const config = [
                {
                    kind: 'apm:profile:access',
                    items: [
                        {
                            name: 'accessProfile',
                            partition: 'Common'
                        }
                    ]
                }
            ];
            return fetch.gatherAccessProfileItems(context, 'Common', config)
                .then((result) => {
                    assert.deepStrictEqual(result, ['Profile/Policy']);
                });
        });
    });

    describe('.filterAs3Items', () => {
        const filterTestCases = [
            {
                name: 'filter ephemeral LTM pool members',
                config: [
                    {
                        kind: 'tm:ltm:pool:poolstate',
                        name: 'testapp_pool',
                        partition: 'test',
                        membersReference: {
                            link: 'https://localhost/mgmt/tm/ltm/pool/~test~test~testapp_pool/members?ver=14.1.0',
                            isSubcollection: true,
                            items: [
                                {
                                    kind: 'tm:ltm:pool:members:membersstate',
                                    name: '_auto_192.0.2.0:80',
                                    ephemeral: 'true'
                                },
                                {
                                    kind: 'tm:ltm:pool:members:membersstate',
                                    name: 'www.f5.com:80',
                                    ephemeral: 'false'
                                }
                            ]
                        }
                    }
                ],
                expected: [
                    {
                        kind: 'tm:ltm:pool:poolstate',
                        name: 'testapp_pool',
                        partition: 'test',
                        membersReference: {
                            link: 'https://localhost/mgmt/tm/ltm/pool/~test~test~testapp_pool/members?ver=14.1.0',
                            isSubcollection: true,
                            items: [
                                {
                                    kind: 'tm:ltm:pool:members:membersstate',
                                    name: 'www.f5.com:80',
                                    ephemeral: 'false'
                                }
                            ]
                        }
                    }
                ]
            },
            {
                name: 'preserve non-filtered config',
                config: [
                    {
                        kind: 'tm:auth:partition:partitionstate',
                        name: 'test',
                        fullPath: 'test',
                        selfLink: 'https://localhost/mgmt/tm/auth/partition/test?ver=13.1.1'
                    },
                    {
                        kind: 'tm:sys:folder:folderstate',
                        name: 'test_w11',
                        partition: 'test',
                        fullPath: '/test/test_w11',
                        generation: 26456,
                        selfLink: 'https://localhost/mgmt/tm/sys/folder/~test~test_w11?ver=13.1.1',
                        deviceGroup: 'none',
                        hidden: 'false',
                        inheritedDevicegroup: 'true',
                        inheritedTrafficGroup: 'true',
                        noRefCheck: 'false',
                        trafficGroup: '/Common/traffic-group-1',
                        trafficGroupReference: {
                            link: 'https://localhost/mgmt/tm/cm/traffic-group/~Common~traffic-group-1?ver=13.1.1'
                        }
                    }
                ],
                expected: [
                    {
                        kind: 'tm:auth:partition:partitionstate',
                        name: 'test',
                        fullPath: 'test',
                        selfLink: 'https://localhost/mgmt/tm/auth/partition/test?ver=13.1.1'
                    },
                    {
                        kind: 'tm:sys:folder:folderstate',
                        name: 'test_w11',
                        partition: 'test',
                        fullPath: '/test/test_w11',
                        generation: 26456,
                        selfLink: 'https://localhost/mgmt/tm/sys/folder/~test~test_w11?ver=13.1.1',
                        deviceGroup: 'none',
                        hidden: 'false',
                        inheritedDevicegroup: 'true',
                        inheritedTrafficGroup: 'true',
                        noRefCheck: 'false',
                        trafficGroup: '/Common/traffic-group-1',
                        trafficGroupReference: {
                            link: 'https://localhost/mgmt/tm/cm/traffic-group/~Common~traffic-group-1?ver=13.1.1'
                        }
                    }
                ]
            },
            {
                name: 'remove hidden access-policy created by apm profile of same name',
                config: [
                    {
                        kind: 'tm:apm:profile:access:accessstate',
                        name: 'accessProfile',
                        partition: 'Tenant',
                        accessPolicy: '/Tenant/accessProfile'
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessPolicy',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessProfile'
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessPolicy',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessPolicy'
                    }
                ],
                expected: [
                    {
                        kind: 'tm:apm:profile:access:accessstate',
                        name: 'accessProfile',
                        partition: 'Tenant',
                        accessPolicy: '/Tenant/accessProfile'
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessPolicy',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessPolicy'
                    }
                ]
            },
            {
                name: 'remove hidden access-policy referred to by the macros property of another access-policy',
                config: [
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessPolicy',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessPolicy'
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessProfile',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessProfile',
                        macros: [
                            '/Tenant/accessProfile-sub_1',
                            '/Tenant/accessProfile-sub_2'
                        ]
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessProfile-sub_1',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessProfile-sub_1'
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessProfile-sub_2',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessProfile-sub_2'
                    }
                ],
                expected: [
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessPolicy',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessPolicy'
                    },
                    {
                        kind: 'tm:apm:policy:access-policy:access-policystate',
                        name: 'accessProfile',
                        partition: 'Tenant',
                        fullPath: '/Tenant/accessProfile',
                        macros: [
                            '/Tenant/accessProfile-sub_1',
                            '/Tenant/accessProfile-sub_2'
                        ]
                    }
                ]
            },
            {
                name: 'remove destination address lists addresses in non-Common tenant',
                config: [
                    {
                        fullPath: '/Tenant/myAddressList',
                        addresses: [
                            { name: '192.0.2.10/32' }
                        ]
                    },
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Tenant/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.10'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.20'
                    }
                ],
                expected: [
                    {
                        fullPath: '/Tenant/myAddressList',
                        addresses: [
                            { name: '192.0.2.10/32' }
                        ]
                    },
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Tenant/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.20'
                    }
                ]
            },
            {
                name: 'remove destination address lists addresses in Common tenant',
                config: [
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Common/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.10'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.20'
                    }
                ],
                commonConfig: {
                    addressListList: [
                        {
                            fullPath: '/Common/myAddressList',
                            addresses: [
                                { name: '192.0.2.10/32' }
                            ]
                        }
                    ]
                },
                expected: [
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Common/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.20'
                    }
                ]
            },
            {
                name: 'remove destination address lists addresses that match range',
                config: [
                    {
                        fullPath: '/Tenant/myAddressList',
                        addresses: [
                            { name: '192.0.2.10-192.0.2.20' }
                        ]
                    },
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Tenant/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.10'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.15'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.30'
                    }
                ],
                expected: [
                    {
                        fullPath: '/Tenant/myAddressList',
                        addresses: [
                            { name: '192.0.2.10-192.0.2.20' }
                        ]
                    },
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Tenant/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.30'
                    }
                ]
            },
            {
                name: 'remove destination address list addresses in referenced lists',
                config: [
                    {
                        fullPath: '/Tenant/Application/myAddressList',
                        addresses: [
                            { name: '192.0.2.10/32' }
                        ],
                        addressLists: [
                            {
                                name: 'myOtherAddressList',
                                partition: 'Tenant',
                                subPath: 'Application'
                            }
                        ]
                    },
                    {
                        fullPath: '/Tenant/Application/myOtherAddressList',
                        addresses: [
                            { name: '192.0.2.200/32' }
                        ]
                    },
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Tenant/Application/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.10'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.20'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.200'
                    }
                ],
                expected: [
                    {
                        fullPath: '/Tenant/Application/myAddressList',
                        addresses: [
                            { name: '192.0.2.10/32' }
                        ],
                        addressLists: [
                            {
                                name: 'myOtherAddressList',
                                partition: 'Tenant',
                                subPath: 'Application'
                            }
                        ]
                    },
                    {
                        fullPath: '/Tenant/Application/myOtherAddressList',
                        addresses: [
                            { name: '192.0.2.200/32' }
                        ]
                    },
                    {
                        kind: 'tm:ltm:traffic-matching-criteria:traffic-matching-criteriastate',
                        destinationAddressList: '/Tenant/Application/myAddressList'
                    },
                    {
                        kind: 'tm:ltm:virtual-address:virtual-addressstate',
                        address: '192.0.2.20'
                    }
                ]
            }
        ];

        filterTestCases.forEach((testCase) => {
            it(`should ${testCase.name}`, () => {
                const actualConfig = fetch.filterAs3Items(context, testCase.config, testCase.commonConfig);
                assert.deepStrictEqual(actualConfig, testCase.expected);
            });
        });
    });

    describe('.getDesiredConfig', () => {
        let commonConfig;

        beforeEach(() => {
            commonConfig = {
                nodeList: [],
                virtualAddressList: []
            };
            context.request = {
                postProcessing: []
            };
        });

        it('should return a configuration object with tenant, app and pool', () => {
            const tenantId = 'My_tenant';
            context.target.tmosVersion = '14.1.0';
            context.control = {
                host: 'localhost'
            };
            const appId = 'My_app';
            const poolId = 'My_pool';
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.9.0',
                id: 'Pool',
                [tenantId]: {
                    class: 'Tenant',
                    [appId]: {
                        class: 'Application',
                        template: 'generic',
                        [poolId]: {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 10,
                            minimumMonitors: 1
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };

            return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                .then((desiredConfig) => {
                    assert.strictEqual(desiredConfig[`/${tenantId}/`].command, 'auth partition');
                    assert.strictEqual(desiredConfig[`/${tenantId}/${appId}/`].command, 'sys folder');
                    assert.strictEqual(desiredConfig[`/${tenantId}/${appId}/${poolId}`].command, 'ltm pool');
                    assert.strictEqual(desiredConfig[`/${tenantId}/${appId}/${poolId}`].properties['load-balancing-mode'], 'round-robin');
                });
        });

        it('should process snat translations with snat pools', () => {
            context.target.tmosVersion = '14.1.0';
            context.control = {
                host: 'localhost'
            };
            const declaration = {
                class: 'ADC',
                schemaVersion: '3.9.0',
                id: 'Pool',
                Tenant: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        template: 'generic',
                        snatPool: {
                            class: 'SNAT_Pool',
                            snatAddresses: [
                                '2001:db8:0000:0000:0000:0000:0000:0001',
                                '2001:db8:0000:0000:0000:0000:0000:0002'
                            ]
                        },
                        snatTranslation: {
                            class: 'SNAT_Translation',
                            address: '2001:db8:0000:0000:0000:0000:0000:0002',
                            connectionLimit: 10000
                        },
                        enable: true
                    },
                    enable: true,
                    defaultRouteDomain: 0,
                    optimisticLockKey: ''
                },
                updateMode: 'selective'
            };

            return fetch.getDesiredConfig(context, 'Tenant', declaration, commonConfig)
                .then((desiredConfig) => {
                    assert.strictEqual(desiredConfig['/Tenant/Application/snatPool'].command, 'ltm snatpool');
                    assert.deepStrictEqual(desiredConfig['/Tenant/Application/snatPool'].properties.members, {
                        '/Tenant/2001:db8::1': {},
                        '/Tenant/2001:db8::2': {}
                    });

                    // auto generated snat-translation
                    let snatTranslation = desiredConfig['/Tenant/2001:db8::1'];
                    assert.strictEqual(snatTranslation.command, 'ltm snat-translation');
                    assert.strictEqual(snatTranslation.properties.address, '2001:db8::1');
                    assert.strictEqual(snatTranslation.properties['connection-limit'], 0);

                    // specified snat-translation
                    snatTranslation = desiredConfig['/Tenant/2001:db8::2'];
                    assert.strictEqual(snatTranslation.command, 'ltm snat-translation');
                    assert.strictEqual(snatTranslation.properties.address, '2001:db8::2');
                    assert.strictEqual(snatTranslation.properties['connection-limit'], 10000);

                    // snat-related items should no longer remain in context.request.postProcessing array
                    assert.isEmpty(context.request.postProcessing);
                });
        });

        describe('.updateDesiredForCommonNodes', () => {
            const getPoolDecl = (tenant, memberAddresses) => ({
                class: 'ADC',
                schemaVersion: '3.9.0',
                id: 'Pool',
                [tenant]: {
                    class: 'Tenant',
                    My_app: {
                        class: 'Application',
                        template: 'generic',
                        My_pool: {
                            class: 'Pool',
                            members: memberAddresses.map((addr) => ({
                                addressDiscovery: 'static',
                                serverAddresses: [addr],
                                servicePort: 8080,
                                shareNodes: true,
                                enable: true,
                                routeDomain: 100
                            }))
                        },
                        enable: true
                    },
                    enable: true
                }
            });

            it('should delete node config if pre-existing node exists in Common with no matching metadata', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.nodeList = [
                    {
                        fullPath: '/Common/192.0.2.10',
                        commonNode: true
                    },
                    {
                        fullPath: '/Common/192.0.2.11',
                        commonNode: true,
                        metadata: [{
                            name: 'foo',
                            value: 'bar'
                        }]
                    }
                ];
                const tenantId = 'My_tenant';
                const declaration = getPoolDecl(tenantId, ['192.0.2.10', '192.0.2.11']);
                const desiredConfig = fetch.getDesiredConfig(context, tenantId, declaration, commonConfig);
                assert.strictEqual(desiredConfig['/Common/192.0.2.10'], undefined);
                assert.strictEqual(desiredConfig['/Common/192.0.2.11'], undefined);
            });

            it('should add ref metadata to node config if node exists in Common', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.nodeList = [{
                    fullPath: '/Common/192.0.2.10%100',
                    commonNode: true,
                    metadata: [{
                        name: 'references',
                        value: '1'
                    }]
                }];
                const tenantId = 'My_tenant';
                const declaration = getPoolDecl(tenantId, ['192.0.2.10']);
                return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/Common/192.0.2.10%100'].properties.metadata,
                            { references: { value: 1 } }
                        );
                    });
            });

            it('should add new Common node to nodelist', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.nodeList = [{
                    fullPath: '/Common/10.10.0.10',
                    partition: 'Common'
                }];
                const tenantId = 'My_tenant';
                const declaration = getPoolDecl(tenantId, ['192.0.2.10']);
                return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/Common/192.0.2.10%100'].properties.metadata,
                            { references: { value: 0 } }
                        );
                        assert.deepStrictEqual(
                            commonConfig.nodeList,
                            [
                                {
                                    fullPath: '/Common/10.10.0.10',
                                    partition: 'Common'
                                },
                                {
                                    fullPath: '/Common/192.0.2.10%100',
                                    partition: 'Common',
                                    ephemeral: false,
                                    metadata: [{
                                        name: 'references',
                                        persist: true,
                                        value: 0
                                    }],
                                    domain: '',
                                    key: '192.0.2.10%100',
                                    commonNode: true
                                }
                            ]
                        );
                    });
            });

            it('should handle fqdn nodes', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.nodeList = [];
                const declaration = {
                    class: 'ADC',
                    schemaVersion: '3.9.0',
                    id: 'Pool',
                    My_tenant: {
                        class: 'Tenant',
                        My_app: {
                            class: 'Application',
                            template: 'generic',
                            My_pool: {
                                class: 'Pool',
                                members: [{
                                    servicePort: 80,
                                    addressDiscovery: 'fqdn',
                                    autoPopulate: true,
                                    hostname: 'www.f5.com',
                                    queryInterval: 0,
                                    shareNodes: true,
                                    fqdnPrefix: 'node-',
                                    adminState: 'enable',
                                    enable: true
                                }]
                            },
                            enable: true
                        },
                        enable: true
                    }
                };
                return fetch.getDesiredConfig(context, 'My_tenant', declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/Common/node-www.f5.com'].properties.fqdn,
                            {
                                autopopulate: 'enabled',
                                tmName: 'www.f5.com',
                                interval: 'ttl'
                            }
                        );
                        assert.deepStrictEqual(
                            desiredConfig['/Common/node-www.f5.com'].properties.metadata,
                            {
                                references: {
                                    value: 0
                                },
                                fqdnPrefix: {
                                    value: 'node-'
                                }
                            }
                        );
                        assert.strictEqual(commonConfig.nodeList.length, 1);
                        assert.deepStrictEqual(
                            commonConfig.nodeList[0],
                            {
                                fullPath: '/Common/node-www.f5.com',
                                partition: 'Common',
                                ephemeral: false,
                                metadata: [
                                    {
                                        name: 'references',
                                        persist: true,
                                        value: 0
                                    }
                                ],
                                domain: '',
                                key: 'node-www.f5.com',
                                commonNode: true
                            }
                        );
                    });
            });
        });

        describe('.updateDesiredForCommonVirtualAddresses', () => {
            const getServiceDecl = (tenant, virtualAddresses) => ({
                class: 'ADC',
                schemaVersion: '3.9.0',
                id: 'Pool',
                [tenant]: {
                    class: 'Tenant',
                    My_app: {
                        class: 'Application',
                        template: 'generic',
                        My_Service: {
                            class: 'Service_Generic',
                            virtualAddresses,
                            virtualPort: 8080,
                            shareAddresses: true,
                            enable: true
                        },
                        enable: true
                    },
                    enable: true
                }
            });

            it('should delete virtual address config if pre-existing virtual address exists in Common with no matching metadata', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.virtualAddressList = [
                    {
                        fullPath: '/Common/192.0.2.10',
                        address: '192.0.2.10',
                        partition: 'Common',
                        commonAddress: true
                    },
                    {
                        fullPath: '/Common/192.0.2.11',
                        address: '192.0.2.11',
                        partition: 'Common',
                        commonAddress: true,
                        metadata: [{
                            name: 'foo',
                            value: 'bar'
                        }]
                    }
                ];
                const tenantId = 'My_tenant';
                const declaration = getServiceDecl(tenantId, ['192.0.2.10', '192.0.2.11']);
                const desiredConfig = fetch.getDesiredConfig(context, tenantId, declaration, commonConfig);
                assert.strictEqual(desiredConfig['/Common/Service_Address-192.0.2.10'], undefined);
                assert.strictEqual(desiredConfig['/Common/Service_Address-192.0.2.11'], undefined);
            });

            it('should add ref metadata to virtual address config if virtual address exists in Common', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.virtualAddressList = [{
                    fullPath: '/Common/192.0.2.10',
                    address: '192.0.2.10',
                    partition: 'Common',
                    commonAddress: true,
                    metadata: [{
                        name: 'references',
                        value: '1'
                    }]
                }];
                const tenantId = 'My_tenant';
                const declaration = getServiceDecl(tenantId, ['192.0.2.10']);
                return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/Common/Service_Address-192.0.2.10'].properties.metadata,
                            { references: { value: 1 } }
                        );
                    });
            });

            it('should add new Common virtual address to virtualAddressList', () => {
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                commonConfig.virtualAddressList = [{
                    fullPath: '/Common/10.10.0.10',
                    address: '10.10.0.10',
                    partition: 'Common'
                }];
                const tenantId = 'My_tenant';
                const declaration = getServiceDecl(tenantId, ['192.0.2.10']);
                return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/Common/Service_Address-192.0.2.10'].properties.metadata,
                            { references: { value: 0 } }
                        );
                        assert.deepStrictEqual(
                            commonConfig.virtualAddressList,
                            [
                                {
                                    fullPath: '/Common/10.10.0.10',
                                    address: '10.10.0.10',
                                    partition: 'Common'
                                },
                                {
                                    fullPath: '/Common/192.0.2.10',
                                    address: '192.0.2.10',
                                    partition: 'Common',
                                    metadata: [{
                                        name: 'references',
                                        persist: true,
                                        value: 0
                                    }],
                                    commonAddress: true
                                }
                            ]
                        );
                    });
            });
        });

        describe('.desiredConfigPostProcessing', () => {
            let declaration;
            let updates;

            beforeEach(() => {
                declaration = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'id',
                    Common: {
                        class: 'Tenant',
                        enable: true,
                        Shared: {
                            class: 'Application',
                            template: 'shared',
                            enable: true,
                            cert: {
                                class: 'Certificate',
                                certificate: {
                                    bigip: '/Common/default.crt'
                                },
                                privateKey: {
                                    bigip: '/Common/default.key'
                                }
                            }
                        }
                    },
                    tenant: {
                        class: 'Tenant',
                        enable: true,
                        app: {
                            class: 'Application',
                            enable: true,
                            tlsServer: {
                                class: 'TLS_Server',
                                certificates: [
                                    {
                                        certificate: '/Common/Shared/cert'
                                    }
                                ],
                                authenticationFrequency: 'one-time'
                            },
                            domain1: {
                                class: 'GSLB_Domain',
                                resourceRecordType: 'A',
                                domainName: 'domain',
                                aliases: ['alias1.com']
                            },
                            domain2: {
                                class: 'GSLB_Domain',
                                resourceRecordType: 'AAAA',
                                domainName: 'domain',
                                aliases: ['alias2.com']
                            }
                        }
                    }
                };
                updates = [
                    {
                        newString: '/Common/default.crt',
                        oldString: '/Common/Shared/cert.crt'
                    },
                    {
                        oldString: '/Common/Shared/cert.key',
                        newString: '/Common/default.key'
                    }
                ];
            });

            it('should add updates to context.request.postProcessing', () => fetch
                .getDesiredConfig(context, 'Common', declaration, commonConfig)
                .then((desiredConfig) => {
                    assert.deepStrictEqual(
                        context.request.postProcessing,
                        updates
                    );
                    assert.deepStrictEqual(
                        desiredConfig,
                        {
                            '/Common/Shared/': {
                                command: 'sys folder',
                                properties: {},
                                ignore: []
                            }
                        }
                    );
                }));

            it('should update certificate paths', () => {
                context.request.postProcessing = updates;
                return fetch.getDesiredConfig(context, 'tenant', declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/tenant/app/tlsServer'].properties['cert-key-chain'],
                            {
                                set0: {
                                    cert: '/Common/default.crt',
                                    key: '/Common/default.key',
                                    chain: 'none'
                                }
                            }
                        );
                    });
            });

            it('should add a key based on cert name if none is specified', () => {
                delete declaration.Common.Shared.cert.privateKey;
                updates = [
                    {
                        newString: '/Common/newCert.crt',
                        oldString: '/Common/Shared/cert.crt'
                    }
                ];
                context.request.postProcessing = updates;
                return fetch.getDesiredConfig(context, 'tenant', declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            desiredConfig['/tenant/app/tlsServer'].properties['cert-key-chain'],
                            {
                                set0: {
                                    cert: '/Common/newCert.crt',
                                    key: '/Common/newCert.key',
                                    chain: 'none'
                                }
                            }
                        );
                    });
            });

            it('should update aliases of GSLB_Domain objects that share domainName', () => {
                updates = [
                    {
                        aliases: {
                            'alias1.com': {},
                            'alias2.com': {}
                        },
                        domainName: '/tenant/app/domain'
                    },
                    {
                        aliases: {
                            'alias1.com': {},
                            'alias2.com': {}
                        },
                        domainName: '/tenant/app/domain'
                    }
                ];
                return fetch.getDesiredConfig(context, 'tenant', declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.deepStrictEqual(
                            context.request.postProcessing,
                            updates
                        );
                        assert.deepStrictEqual(
                            desiredConfig['/tenant/app/domain a'].properties.aliases,
                            {
                                'alias1.com': {},
                                'alias2.com': {}
                            }
                        );
                        assert.deepStrictEqual(
                            desiredConfig['/tenant/app/domain aaaa'].properties.aliases,
                            {
                                'alias1.com': {},
                                'alias2.com': {}
                            }
                        );
                    });
            });
        });

        describe('per-app', () => {
            beforeEach(() => {
                commonConfig = {
                    nodeList: [],
                    virtualAddressList: []
                };
                context.request = {
                    postProcessing: [],
                    isPerApp: true,
                    perAppInfo: {
                        tenant: 'tenant',
                        apps: []
                    }
                };
            });

            it('should pull just the application in tenant when application is specified', () => {
                const tenantId = 'My_tenant';
                const appId = 'My_app';
                const poolId = 'My_pool';
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                context.request.isPerApp = true;
                context.request.perAppInfo = {
                    tenant: tenantId,
                    apps: [appId]
                };
                const declaration = {
                    [tenantId]: {
                        class: 'Tenant',
                        enable: true,
                        [appId]: {
                            class: 'Application',
                            template: 'generic',
                            [poolId]: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 10,
                                minimumMonitors: 1
                            },
                            enable: true
                        },
                        appOther: {
                            class: 'Application',
                            template: 'generic',
                            poolOther: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 10,
                                minimumMonitors: 1
                            },
                            enable: true
                        }
                    }
                };

                return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.strictEqual(Object.keys(desiredConfig[`/${tenantId}/`]).length, 3, 'should only have 3 entries in the desired config');
                        assert.strictEqual(desiredConfig['/My_tenant/'].command, 'auth partition');
                        assert.strictEqual(desiredConfig['/My_tenant/My_app/'].command, 'sys folder');
                        assert.strictEqual(desiredConfig['/My_tenant/My_app/My_pool'].command, 'ltm pool');
                        assert.strictEqual(desiredConfig['/My_tenant/My_app/My_pool'].properties['load-balancing-mode'], 'round-robin');
                        assert.strictEqual(typeof desiredConfig['/My_tenant/appOther/'], 'undefined'); // Should NOT include unspecified app
                    });
            });

            it('should pull the application in tenant when application is NOT specified', () => {
                const tenantId = 'My_tenant';
                const appId = 'My_app';
                const poolId = 'My_pool';
                context.target.tmosVersion = '14.1.0';
                context.control = {
                    host: 'localhost'
                };
                context.request.isPerApp = true;
                context.request.perAppInfo = {
                    tenant: tenantId,
                    apps: []
                };
                const declaration = {
                    [tenantId]: {
                        class: 'Tenant',
                        enable: true,
                        [appId]: {
                            class: 'Application',
                            template: 'generic',
                            [poolId]: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 10,
                                minimumMonitors: 1
                            },
                            enable: true
                        },
                        appOther: {
                            class: 'Application',
                            template: 'generic',
                            poolOther: {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 10,
                                minimumMonitors: 1
                            },
                            enable: true
                        }
                    }
                };

                return fetch.getDesiredConfig(context, tenantId, declaration, commonConfig)
                    .then((desiredConfig) => {
                        assert.strictEqual(Object.keys(desiredConfig[`/${tenantId}/`]).length, 3, 'should only have 3 entries in the desired config');
                        assert.strictEqual(desiredConfig[`/${tenantId}/`].command, 'auth partition');
                        assert.strictEqual(desiredConfig[`/${tenantId}/${appId}/`].command, 'sys folder');
                        assert.strictEqual(desiredConfig[`/${tenantId}/${appId}/${poolId}`].command, 'ltm pool');
                        assert.strictEqual(desiredConfig[`/${tenantId}/${appId}/${poolId}`].properties['load-balancing-mode'], 'round-robin');
                        assert.strictEqual(desiredConfig[`/${tenantId}/appOther/`].command, 'sys folder');
                        assert.strictEqual(desiredConfig[`/${tenantId}/appOther/poolOther`].command, 'ltm pool');
                        assert.strictEqual(desiredConfig[`/${tenantId}/appOther/poolOther`].properties['load-balancing-mode'], 'round-robin');
                    });
            });
        });
    });

    describe('.getTenantConfig', () => {
        let tenantId;
        let commonConfig;
        let isOneOfProvisionedStub;

        beforeEach(() => {
            context.target.tmosVersion = '17.1'; // Needed for getBigipConfig filter
            tenantId = 'tenant1';
            commonConfig = {
                nodeList: [],
                virtualAddressList: []
            };

            sinon.stub(fullPathList, 'root').value([ // Abbreviated for testing purposes, lines up with nock
                { endpoint: '/mgmt/tm/auth/partition' },
                { endpoint: '/mgmt/tm/sys/folder' },
                { endpoint: '/mgmt/tm/ltm/pool' }
            ]);

            nock('http://localhost:8100')
                .get('/mgmt/tm/auth/partition/')
                .reply(200, {
                    kind: 'tm:auth:partition:partitioncollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/auth/partition?$filter=partition+eq+tenant1',
                    items: [
                        {
                            kind: 'tm:auth:partition:partitionstate',
                            name: 'Common',
                            fullPath: 'Common',
                            selfLink: 'https://localhost/mgmt/tm/auth/partition/Common',
                            defaultRouteDomain: 0
                        },
                        {
                            kind: 'tm:auth:partition:partitionstate',
                            name: 'tenant1',
                            fullPath: 'tenant1',
                            selfLink: 'https://localhost/mgmt/tm/auth/partition/tenant1',
                            defaultRouteDomain: 0
                        }
                    ]
                })
                .get('/mgmt/tm/auth/partition?$filter=partition%20eq%20tenant1')
                .reply(200, {
                    kind: 'tm:auth:partition:partitioncollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/auth/partition?$filter=partition+eq+tenant1',
                    items: [
                        {
                            kind: 'tm:auth:partition:partitionstate',
                            name: 'tenant1',
                            fullPath: 'tenant1',
                            selfLink: 'https://localhost/mgmt/tm/auth/partition/tenant1',
                            defaultRouteDomain: 0
                        }
                    ]
                })
                .get('/mgmt/tm/sys/folder?$filter=partition%20eq%20tenant1')
                .reply(200, {
                    kind: 'tm:sys:folder:foldercollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/sys/folder?$filter=partition+eq+tenant1',
                    items: [
                        {
                            kind: 'tm:sys:folder:folderstate',
                            name: 'app1',
                            partition: 'tenant1',
                            fullPath: '/tenant1/app1',
                            noRefCheck: 'false',
                            trafficGroup: '/Common/traffic-group-1'
                        },
                        {
                            kind: 'tm:sys:folder:folderstate',
                            name: 'app2',
                            partition: 'tenant1',
                            fullPath: '/tenant1/app2',
                            noRefCheck: 'false',
                            trafficGroup: '/Common/traffic-group-1'
                        }
                    ]
                })
                .get('/mgmt/tm/ltm/pool?$filter=partition%20eq%20tenant1')
                .reply(200, {
                    kind: 'tm:ltm:pool:poolcollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/ltm/pool?$filter=partition+eq+tenant1&expandSubcollections=true',
                    items:
                        [{
                            kind: 'tm:ltm:pool:poolstate',
                            name: 'pool1',
                            partition: 'tenant1',
                            subPath: 'app1',
                            fullPath: '/tenant1/app1/pool1',
                            ipTosToServer: 'pass-through',
                            linkQosToClient: 'pass-through',
                            linkQosToServer: 'pass-through',
                            membersReference: {}
                        },
                        {
                            kind: 'tm:ltm:pool:poolstate',
                            name: 'pool1',
                            partition: 'tenant1',
                            subPath: 'app2',
                            fullPath: '/tenant1/app2/pool1',
                            ipTosToServer: 'pass-through',
                            linkQosToClient: 'pass-through',
                            linkQosToServer: 'pass-through',
                            membersReference: {}
                        }]
                });
            isOneOfProvisionedStub = sinon.stub(util, 'isOneOfProvisioned').resolves(true);
        });

        describe('per-tenant', () => {
            it('should return early if iControlRequest lacks the tenantId', () => {
                tenantId = 'tenantOther';
                return Promise.resolve()
                    .then(() => fetch.getTenantConfig(context, tenantId, commonConfig))
                    .then((results) => {
                        assert.deepStrictEqual(results, {});
                        assert.strictEqual(isOneOfProvisionedStub.called, false, 'isOneOfProvisioned should NOT have been called');
                    });
            });

            it('should return actionable items if tenant exists', () => {
                tenantId = 'tenant1';
                return Promise.resolve()
                    .then(() => fetch.getTenantConfig(context, tenantId, commonConfig))
                    .then((results) => {
                        assert.deepStrictEqual(
                            results,
                            {
                                '/tenant1/': {
                                    command: 'auth partition',
                                    properties: { 'default-route-domain': 0 },
                                    ignore: []
                                },
                                '/tenant1/app1/': { command: 'sys folder', properties: {}, ignore: [] },
                                '/tenant1/app2/': { command: 'sys folder', properties: {}, ignore: [] },
                                '/tenant1/app1/pool1': {
                                    command: 'ltm pool', properties: { members: {}, metadata: {} }, ignore: []
                                },
                                '/tenant1/app2/pool1': {
                                    command: 'ltm pool', properties: { members: {}, metadata: {} }, ignore: []
                                }
                            }
                        );
                        assert.strictEqual(isOneOfProvisionedStub.called, true, 'isOneOfProvisioned should have been called at least once');
                    });
            });
        });

        describe('per-app', () => {
            it('should return early if iControlRequest lacks the tenantId', () => {
                tenantId = 'tenantOther';
                context.request.isPerApp = true;
                context.request.perAppInfo = {
                    tenant: tenantId,
                    apps: []
                };
                return Promise.resolve()
                    .then(() => fetch.getTenantConfig(context, tenantId, commonConfig))
                    .then((results) => {
                        assert.deepStrictEqual(results, {});
                        assert.strictEqual(isOneOfProvisionedStub.called, false, 'isOneOfProvisioned should NOT have been called');
                    });
            });

            it('should filter out any applications not in the declaration', () => {
                tenantId = 'tenant1';

                context.request.isPerApp = true;
                context.request.perAppInfo = {
                    tenant: tenantId,
                    apps: ['app1']
                };
                return Promise.resolve()
                    .then(() => fetch.getTenantConfig(context, tenantId, commonConfig))
                    .then((results) => {
                        assert.deepStrictEqual(
                            results,
                            {
                                '/tenant1/': {
                                    command: 'auth partition',
                                    properties: { 'default-route-domain': 0 },
                                    ignore: []
                                },
                                '/tenant1/app1/': { command: 'sys folder', properties: {}, ignore: [] },
                                '/tenant1/app1/pool1': {
                                    command: 'ltm pool', properties: { members: {}, metadata: {} }, ignore: []
                                }
                            }
                        );
                        assert.strictEqual(isOneOfProvisionedStub.called, true, 'isOneOfProvisioned should have been called at least once');
                    });
            });

            it('should return actionable items if tenant exists and application is undefined', () => {
                tenantId = 'tenant1';

                context.request.isPerApp = true;
                context.request.perAppInfo = {
                    tenant: tenantId,
                    apps: []
                };
                return Promise.resolve()
                    .then(() => fetch.getTenantConfig(context, tenantId, commonConfig))
                    .then((results) => {
                        assert.deepStrictEqual(
                            results,
                            {
                                '/tenant1/': {
                                    command: 'auth partition',
                                    properties: { 'default-route-domain': 0 },
                                    ignore: []
                                },
                                '/tenant1/app1/': { command: 'sys folder', properties: {}, ignore: [] },
                                '/tenant1/app2/': { command: 'sys folder', properties: {}, ignore: [] },
                                '/tenant1/app1/pool1': {
                                    command: 'ltm pool', properties: { members: {}, metadata: {} }, ignore: []
                                },
                                '/tenant1/app2/pool1': {
                                    command: 'ltm pool', properties: { members: {}, metadata: {} }, ignore: []
                                }
                            }
                        );
                        assert.strictEqual(isOneOfProvisionedStub.called, true, 'isOneOfProvisioned should have been called at least once');
                    });
            });
        });
    });

    describe('updateWildcardMonitorDiffs', () => {
        const commonConf = { nodeList: [] };
        let currConf;

        beforeEach(() => {
            sinon.stub(util, 'iControlRequest').resolves({ statusCode: 404 });
            currConf = {
                '/tenant/': {
                    command: 'auth partition',
                    properties: {
                        'default-route-domain': 0
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon1': {
                    command: 'ltm monitor https',
                    properties: {
                        destination: '*:*',
                        interval: 10
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon2': {
                    command: 'ltm monitor https',
                    properties: {
                        destination: '*:*',
                        interval: 20
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon3': {
                    command: 'ltm monitor radius',
                    properties: {
                        destination: '*:*',
                        interval: 30
                    },
                    ignore: []
                },
                '/tenant/app/tenant_pool': {
                    command: 'ltm pool',
                    properties: {
                        members: {
                            '/Common/10.70.61.10:9021': {
                                minimumMonitors: 1,
                                monitor: { '/tenant/app/tenant_mon2': {} }
                            },
                            '/Common/10.70.61.11:9021': {
                                minimumMonitors: 1,
                                monitor: { default: {} }
                            },
                            '/Common/10.70.61.9:9021': {
                                minimumMonitors: 1,
                                monitor: {
                                    '/Common/gateway_icmp': {}
                                }
                            }
                        },
                        minimumMonitors: 1,
                        monitor: {
                            '/tenant/app/tenant_mon1': {},
                            '/Common/gateway_icmp': {}
                        }
                    },
                    ignore: []
                }
            };
            context.host = {
                parser: {
                    nodelist: []
                }
            };
        });

        afterEach(() => {
            util.iControlRequest.restore();
        });

        it('should add pool diff/commands if monitor is ref by pool or poolMember and with dest wildcard change', () => {
            const desiredConf = {
                '/tenant/': {
                    command: 'auth partition',
                    properties: {
                        'default-route-domain': 0
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon1': {
                    command: 'ltm monitor https',
                    properties: {
                        destination: '*:911',
                        interval: 10
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon2': {
                    command: 'ltm monitor https',
                    properties: {
                        destination: '*:119',
                        interval: 20
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon3': {
                    command: 'ltm monitor radius',
                    properties: {
                        destination: '*:*',
                        interval: 30
                    },
                    ignore: []
                },
                '/tenant/app/tenant_pool': {
                    command: 'ltm pool',
                    properties: {
                        members: {
                            '/Common/10.70.61.10:9021': {
                                minimumMonitors: 1,
                                monitor: { '/tenant/app/tenant_mon2': {} }
                            },
                            '/Common/10.70.61.11:9021': {
                                minimumMonitors: 1,
                                monitor: { default: {} }
                            },
                            '/Common/10.70.61.9:9021': {
                                minimumMonitors: 1,
                                monitor: {
                                    '/Common/gateway_icmp': {}
                                }
                            }
                        },
                        minimumMonitors: 1,
                        monitor: {
                            '/tenant/app/tenant_mon1': {},
                            '/Common/gateway_icmp': {}
                        }
                    },
                    ignore: []
                }
            };
            const expectedDiffs = [
                {
                    kind: 'E',
                    path: ['/tenant/app/tenant_mon1', 'properties', 'destination'],
                    lhs: '*:*',
                    rhs: '*:911'
                },
                {
                    kind: 'E',
                    path: ['/tenant/app/tenant_mon2', 'properties', 'destination'],
                    lhs: '*:*',
                    rhs: '*:119'
                },
                {
                    kind: 'D',
                    path: ['/tenant/app/tenant_pool', 'properties', 'members', '/Common/10.70.61.10:9021', 'monitor', '/tenant/app/tenant_mon2'],
                    lhs: {}
                },
                {
                    kind: 'N',
                    path: ['/tenant/app/tenant_pool', 'properties', 'members', '/Common/10.70.61.10:9021', 'monitor', 'default'],
                    rhs: {}
                },
                {
                    kind: 'N',
                    path: ['/tenant/app/tenant_pool', 'properties', 'monitor', '/tenant/app/tenant_mon1'],
                    rhs: {}
                }
            ];

            return fetch.getDiff(context, currConf, desiredConf, commonConf, {})
                .then((actualDiffs) => {
                    assert.deepStrictEqual(actualDiffs, expectedDiffs);

                    // Note: the /tenant/app/tenant_mon1 is removed from the currConf during getDiff
                    const actualCmds = fetch.tmshUpdateScript(
                        context, desiredConf, currConf, actualDiffs
                    ).script.split('\n');
                    assert.deepStrictEqual(
                        actualCmds,
                        [
                            'cli script __appsvcs_update {',
                            'proc script::run {} {',
                            'if {[catch {',
                            'tmsh::modify ltm data-group internal __appsvcs_update records none',
                            '} err]} {',
                            'tmsh::create ltm data-group internal __appsvcs_update type string records none',
                            '}',
                            'if { [catch {',
                            'tmsh::modify ltm pool /tenant/app/tenant_pool members delete \\{ "/Common/10.70.61.10:9021" \\}',
                            'tmsh::modify ltm pool /tenant/app/tenant_pool monitor none',
                            'tmsh::begin_transaction',
                            'tmsh::modify ltm pool /tenant/app/tenant_pool monitor none members none',
                            'tmsh::delete ltm monitor https /tenant/app/tenant_mon1',
                            'tmsh::commit_transaction',
                            'tmsh::begin_transaction',
                            'tmsh::create ltm monitor https /tenant/app/tenant_mon1 destination *:911 interval 10',
                            'tmsh::modify auth partition tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"',
                            'tmsh::delete ltm monitor https /tenant/app/tenant_mon2',
                            'tmsh::create ltm monitor https /tenant/app/tenant_mon2 destination *:119 interval 20',
                            'tmsh::delete ltm pool /tenant/app/tenant_pool',
                            'tmsh::create ltm pool /tenant/app/tenant_pool members replace-all-with \\{ /Common/10.70.61.10:9021 /Common/10.70.61.11:9021 /Common/10.70.61.9:9021 \\{ monitor min 1 of \\{ /Common/gateway_icmp \\} \\} \\} monitor min 1 of \\{ /tenant/app/tenant_mon1 /Common/gateway_icmp \\}',
                            'tmsh::commit_transaction',
                            '} err] } {',
                            'catch { tmsh::cancel_transaction } e',
                            'regsub -all {"} $err {\\"} err',
                            'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}',
                            'tmsh::modify ltm pool /tenant/app/tenant_pool members add \\{ /Common/10.70.61.10:9021 \\{ monitor min 1 of \\{ /tenant/app/tenant_mon2 \\} \\} \\}',
                            'tmsh::modify ltm pool /tenant/app/tenant_pool monitor min 1 of \\{ /Common/gateway_icmp \\}',
                            '}}',
                            '}'
                        ]
                    );
                });
        });

        it('should NOT add pool diff with monitor ref but NOT a wildcard change OR monitor not referenced', () => {
            const desiredConf = {
                '/tenant/': {
                    command: 'auth partition',
                    properties: {
                        'default-route-domain': 0
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon1': {
                    command: 'ltm monitor https',
                    properties: {
                        destination: '*:*',
                        interval: 100
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon2': {
                    command: 'ltm monitor https',
                    properties: {
                        destination: '*:*',
                        interval: 200
                    },
                    ignore: []
                },
                '/tenant/app/tenant_mon3': {
                    command: 'ltm monitor radius',
                    properties: {
                        destination: '*:110',
                        interval: 30
                    },
                    ignore: []
                },
                '/tenant/app/tenant_pool': {
                    command: 'ltm pool',
                    properties: {
                        members: {
                            '/Common/10.70.61.10:9021': {
                                minimumMonitors: 1,
                                monitor: { '/tenant/app/tenant_mon2': {} }
                            },
                            '/Common/10.70.61.11:9021': {
                                minimumMonitors: 1,
                                monitor: { default: {} }
                            },
                            '/Common/10.70.61.9:9021': {
                                minimumMonitors: 1,
                                monitor: {
                                    '/Common/gateway_icmp': {}
                                }
                            }
                        },
                        minimumMonitors: 1,
                        monitor: {
                            '/tenant/app/tenant_mon1': {},
                            '/Common/gateway_icmp': {}
                        }
                    },
                    ignore: []
                }
            };

            const expectedDiffs = [
                {
                    kind: 'E',
                    path: ['/tenant/app/tenant_mon1', 'properties', 'interval'],
                    lhs: 10,
                    rhs: 100
                },
                {
                    kind: 'E',
                    path: ['/tenant/app/tenant_mon2', 'properties', 'interval'],
                    lhs: 20,
                    rhs: 200
                },
                {
                    kind: 'E',
                    path: ['/tenant/app/tenant_mon3', 'properties', 'destination'],
                    lhs: '*:*',
                    rhs: '*:110'
                }
            ];

            return fetch.getDiff(context, currConf, desiredConf, commonConf, {})
                .then((actualDiffs) => {
                    assert.deepStrictEqual(actualDiffs, expectedDiffs);

                    const actualScript = fetch.tmshUpdateScript(context, desiredConf, currConf, actualDiffs).script;
                    const actualCmds = actualScript.split('\n');
                    const expCmds = [
                        'cli script __appsvcs_update {',
                        'proc script::run {} {',
                        'if {[catch {',
                        'tmsh::modify ltm data-group internal __appsvcs_update records none',
                        '} err]} {',
                        'tmsh::create ltm data-group internal __appsvcs_update type string records none',
                        '}',
                        'if { [catch {',
                        'tmsh::begin_transaction',
                        'tmsh::delete ltm monitor https /tenant/app/tenant_mon1',
                        'tmsh::create ltm monitor https /tenant/app/tenant_mon1 destination *:* interval 100',
                        'tmsh::modify auth partition tenant description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"',
                        'tmsh::delete ltm monitor https /tenant/app/tenant_mon2',
                        'tmsh::create ltm monitor https /tenant/app/tenant_mon2 destination *:* interval 200',
                        'tmsh::delete ltm monitor radius /tenant/app/tenant_mon3',
                        'tmsh::create ltm monitor radius /tenant/app/tenant_mon3 destination *:110 interval 30',
                        'tmsh::commit_transaction',
                        '} err] } {',
                        'catch { tmsh::cancel_transaction } e',
                        'regsub -all {"} $err {\\"} err',
                        'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}',
                        '}}',
                        '}'
                    ];
                    assert.deepStrictEqual(actualCmds, expCmds);
                });
        });
    });

    describe('.checkDesiredForReferencedProfiles', () => {
        it('should emit profile referenced events', () => {
            context.currentIndex = 0;
            context.tasks = [
                {
                    uuid: '123'
                }
            ];
            context.request = {
                eventEmitter: new EventEmitter()
            };

            const receivedEvents = [];
            context.request.eventEmitter.on(constants.EVENTS.PROFILE_REFERENCED, (event) => {
                receivedEvents.push(util.simpleCopy(event));
            });

            const desiredConfig = {
                item1: {
                    command: 'ltm virtual',
                    properties: {
                        profiles: {
                            '/my/profile/1': {},
                            '/my/profile/2': {}
                        },
                        'per-flow-request-access-policy': '/my/profile/3'
                    }
                }
            };
            fetch.checkDesiredForReferencedProfiles(context, desiredConfig);
            assert.strictEqual(receivedEvents.length, 3);
            assert.strictEqual(receivedEvents[0].profilePath, '/my/profile/1');
            assert.strictEqual(receivedEvents[0].virtualPath, 'item1');
            assert.strictEqual(receivedEvents[1].profilePath, '/my/profile/2');
            assert.strictEqual(receivedEvents[1].virtualPath, 'item1');
            assert.strictEqual(receivedEvents[2].profilePath, '/my/profile/3');
            assert.strictEqual(receivedEvents[2].virtualPath, 'item1');
        });
    });

    describe('.updateAddressesWithRouteDomain', () => {
        let configs;

        beforeEach(() => {
            configs = {
                '/forwarding_vs/': {
                    command: 'auth partition',
                    properties: {
                        'default-route-domain': 100
                    }
                }
            };
        });

        describe('default route domain', () => {
            it('should handle IPv4', () => {
                configs['/Tenant/Application/L4'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/Tenant/192.0.2.0:8080',
                        source: '0.0.0.0/0'
                    }
                };
                configs['/Tenant/Service_Address-192.0.2.0'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '192.0.2.0',
                        mask: '255.255.255.255'
                    }
                };

                fetch.updateAddressesWithRouteDomain(configs, 'Tenant');
                assert.deepStrictEqual(configs['/Tenant/Application/L4'].properties.destination, '/Tenant/192.0.2.0:8080');
            });

            it('should handle IPv6', () => {
                configs['/Tenant/Application/L4'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/Tenant/2001:db8::28.8080',
                        source: '::/0'
                    }
                };
                configs['/Tenant/Service_Address-2001:db8::28'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '2001:db8::28',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
                    }
                };

                fetch.updateAddressesWithRouteDomain(configs, 'Tenant');
                assert.deepStrictEqual(
                    configs['/Tenant/Application/L4'].properties.destination, '/Tenant/2001:db8::28.8080'
                );
            });
        });

        describe('custom route domain', () => {
            it('should handle IPv4', () => {
                configs['/Tenant/Application/L4'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/Tenant/192.0.2.0%100:8080',
                        source: '0.0.0.0/0'
                    }
                };
                configs['/Tenant/Service_Address-192.0.2.0%100'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '192.0.2.0',
                        mask: '255.255.255.255'
                    }
                };

                fetch.updateAddressesWithRouteDomain(configs, 'Tenant');
                assert.deepStrictEqual(
                    configs['/Tenant/Application/L4'].properties.destination, '/Tenant/192.0.2.0%100:8080'
                );
            });

            it('should handle IPv6', () => {
                configs['/Tenant/Application/L4'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/Tenant/2001:db8::28%100.8080',
                        source: '::/0'
                    }
                };
                configs['/Tenant/Service_Address-2001:db8::28%100'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '2001:db8::28',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
                    }
                };

                fetch.updateAddressesWithRouteDomain(configs, 'Tenant');
                assert.deepStrictEqual(
                    configs['/Tenant/Application/L4'].properties.destination, '/Tenant/2001:db8::28%100.8080'
                );
            });
        });

        describe('forwarding server with referenced virtual address', () => {
            it('should handle IPv4 with any mask', () => {
                configs['/forwarding_vs/forwarding_vs/forward_any_to_any'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/forwarding_vs/virtual_forwarding_address:0',
                        source: '0.0.0.0/0'
                    }
                };
                configs['/forwarding_vs/Service_Address-virtual_forwarding_address'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '0.0.0.0',
                        mask: 'any'
                    }
                };
                fetch.updateAddressesWithRouteDomain(configs, 'forwarding_vs');
                assert.deepStrictEqual(
                    configs['/forwarding_vs/forwarding_vs/forward_any_to_any'].properties.destination, '/forwarding_vs/0.0.0.0%100:0'
                );
            });

            it('should handle IPv4 with slash 32 mask', () => {
                configs['/forwarding_vs/forwarding_vs/forward_any_to_any'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/forwarding_vs/virtual_forwarding_address:0',
                        source: '0.0.0.0/0'
                    }
                };
                configs['/forwarding_vs/Service_Address-virtual_forwarding_address'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '0.0.0.0',
                        mask: '255.255.255.255'
                    }
                };
                fetch.updateAddressesWithRouteDomain(configs, 'forwarding_vs');
                assert.deepStrictEqual(
                    configs['/forwarding_vs/forwarding_vs/forward_any_to_any'].properties.destination, '/forwarding_vs/0.0.0.0%100:0'
                );
            });

            it('should handle IPv6 with any6 mask', () => {
                configs['/forwarding_vs/forwarding_vs/forward_any_to_any'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/forwarding_vs/virtual_forwarding_address:0',
                        source: '::/0'
                    }
                };
                configs['/forwarding_vs/Service_Address-virtual_forwarding_address'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '::',
                        mask: 'any6'
                    }
                };
                fetch.updateAddressesWithRouteDomain(configs, 'forwarding_vs');
                assert.deepStrictEqual(
                    configs['/forwarding_vs/forwarding_vs/forward_any_to_any'].properties.destination, '/forwarding_vs/::%100.0'
                );
            });

            it('should handle IPv6 with slash 128 mask', () => {
                configs['/forwarding_vs/forwarding_vs/forward_any_to_any'] = {
                    command: 'ltm virtual',
                    properties: {
                        destination: '/forwarding_vs/virtual_forwarding_address:0',
                        source: '::/0'
                    }
                };
                configs['/forwarding_vs/Service_Address-virtual_forwarding_address'] = {
                    command: 'ltm virtual-address',
                    properties: {
                        address: '::',
                        mask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
                    }
                };
                fetch.updateAddressesWithRouteDomain(configs, 'forwarding_vs');
                assert.deepStrictEqual(
                    configs['/forwarding_vs/forwarding_vs/forward_any_to_any'].properties.destination, '/forwarding_vs/::%100.0'
                );
            });
        });
    });

    describe('.postProcessUpdateScript', () => {
        it('should generate post process updates based on event info', () => {
            sinon.stub(mapCli, 'getPostProcessAPMUpdates').callsFake(() => ({
                preTrans: [
                    'pre trans 1',
                    'pre trans 2'
                ],
                trans: [
                    'trans 1',
                    'trans 2'
                ],
                rollback: [
                    'rollback 1',
                    'rollback 2'
                ]
            }));

            const actualScript = fetch.postProcessUpdateScript().script;
            const actualCmds = actualScript.split('\n');
            const expCmds = [
                'cli script __appsvcs_update {',
                'proc script::run {} {',
                'if {[catch {',
                'tmsh::modify ltm data-group internal __appsvcs_update records none',
                '} err]} {',
                'tmsh::create ltm data-group internal __appsvcs_update type string records none',
                '}',
                'if { [catch {',
                'pre trans 1',
                'pre trans 2',
                'tmsh::begin_transaction',
                'trans 1',
                'trans 2',
                'tmsh::commit_transaction',
                '} err] } {',
                'catch { tmsh::cancel_transaction } e',
                'regsub -all {"} $err {\\"} err',
                'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}',
                'rollback 1',
                'rollback 2',
                '}}',
                '}'
            ];
            assert.deepStrictEqual(actualCmds, expCmds);
        });
    });

    describe('getCommonAccessProfiles', () => {
        it('should get Common access profiles', () => {
            sinon.stub(atgStorage.StorageDataGroup.prototype, 'keys').resolves(['accessProfile1', 'accessProfile2']);
            return fetch.getCommonAccessProfiles(context)
                .then(() => {
                    assert.deepStrictEqual(
                        context.tasks[context.currentIndex].commonAccessProfiles,
                        ['accessProfile1', 'accessProfile2']
                    );
                });
        });
    });

    describe('updateCommonAccessProfiles', () => {
        it('should add and remove profiles from data-group', () => {
            const desiredConfig = {
                '/Common/newAccessProfile1': {
                    command: 'apm profile access'
                },
                '/Common/newAccessProfile2': {
                    command: 'apm profile access'
                }
            };
            const currentProfiles = {
                oldAccessProfile1: {
                    data: ''
                },
                oldAccessProfile2: {
                    data: ''
                }
            };
            context.tasks[context.currentIndex].commonAccessProfiles = [
                'oldAccessProfile1',
                'oldAccessProfile2'
            ];
            sinon.stub(atgStorage.StorageDataGroup.prototype, 'hasItem').callsFake(
                (key) => Promise.resolve(typeof currentProfiles[key] !== 'undefined')
            );
            sinon.stub(atgStorage.StorageDataGroup.prototype, 'setItem').callsFake((key, value) => {
                currentProfiles[key] = {
                    data: value
                };
                return Promise.resolve();
            });
            sinon.stub(atgStorage.StorageDataGroup.prototype, 'deleteItem').callsFake((key) => {
                delete currentProfiles[key];
                return Promise.resolve();
            });
            sinon.stub(atgStorage.StorageDataGroup.prototype, 'persist').resolves();
            return fetch.updateCommonAccessProfiles(context, desiredConfig)
                .then(() => {
                    assert.deepStrictEqual(
                        currentProfiles,
                        {
                            newAccessProfile1: {
                                data: ''
                            },
                            newAccessProfile2: {
                                data: ''
                            }
                        }
                    );
                });
        });
    });
});

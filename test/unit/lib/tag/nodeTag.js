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

const AJV = require('ajv');
const assert = require('assert');
const NodeTag = require('../../../../src/lib/tag').NodeTag;
const Context = require('../../../../src/lib/context/context');
const AdcParser = require('../../../../src/lib/adcParser');

describe('nodeTag', () => {
    let context;
    let declaration;

    beforeEach(() => {
        context = Context.build();
        context.host.parser = new AdcParser();
        declaration = {
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application',
                    template: 'generic',
                    addressDiscoveryObject: {
                        class: 'Address_Discovery'
                    },
                    pool1: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                addressDiscovery: {
                                    use: '/tenant/application/addressDiscoveryObject'
                                }
                            }
                        ]
                    }
                },
                defaultRouteDomain: 20
            }
        };
    });

    const getNodes = () => [{
        data: declaration.tenant.application.pool1.members,
        parentData: declaration.tenant.application.pool1,
        parentDataProperty: 'members',
        instancePath: '/tenant/application/pool1/members'
    }];

    describe('.process', () => {
        it('should resolve if nodes is undefined', () => NodeTag.process(context, declaration));

        it('should resolve if no nodes to process', () => NodeTag.process(context, declaration, []));

        it('should resolve if node data is not an array', () => {
            const nodes = getNodes();
            nodes[0].data = 'unsupported node data';
            NodeTag.process(context, declaration, nodes);
        });

        it('should add resources to Address_Discovery object when using addressDiscovery.use',
            () => NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.deepStrictEqual(
                        declaration.tenant.application.addressDiscoveryObject,
                        {
                            class: 'Address_Discovery',
                            resources: [
                                {
                                    item: {
                                        class: 'Pool',
                                        members: [
                                            {
                                                servicePort: 80,
                                                addressDiscovery: {
                                                    use: '/tenant/application/addressDiscoveryObject'
                                                }
                                            }
                                        ]
                                    },
                                    path: '/tenant/application/pool1',
                                    member: {
                                        servicePort: 80,
                                        addressDiscovery: {
                                            use: '/tenant/application/addressDiscoveryObject'
                                        }
                                    }
                                }
                            ]
                        }
                    );
                }));

        it('should handle processing without defaults', () => {
            delete declaration.tenant.application.pool1.members[0].addressDiscovery;
            return NodeTag.process(context, declaration, getNodes());
        });

        it('should reject when addressDiscovery.use path is invalid', () => {
            const expectedErrMsg = /Cannot read propert(y 'undefined' of undefined|ies of undefined \(reading 'undefined'\))/;
            let rejected = false;

            declaration.tenant.application.pool1.members[0].addressDiscovery.use = '/tenant/addressDiscoveryObject';
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(
                        expectedErrMsg.test(err.message),
                        `${err.message} did not match ${expectedErrMsg}`
                    );
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should add defaultRouteDomain to serverAddress members when routeDomain is not specified', () => {
            declaration.tenant.application.pool1.members[0].addressDiscovery = 'static';
            declaration.tenant.application.pool1.members[0].serverAddresses = ['192.0.2.4'];
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members,
                        [
                            {
                                servicePort: 80,
                                addressDiscovery: 'static',
                                serverAddresses: ['192.0.2.4'],
                                routeDomain: 20
                            }
                        ]
                    );
                });
        });

        it('should add defaultRouteDomain to servers members when routeDomain is not specified', () => {
            declaration.tenant.application.pool1.members[0].addressDiscovery = 'static';
            declaration.tenant.application.pool1.members[0].servers = [{
                name: 'myNode',
                address: '192.0.2.4'
            }];
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members,
                        [
                            {
                                servicePort: 80,
                                addressDiscovery: 'static',
                                servers: [{
                                    name: 'myNode',
                                    address: '192.0.2.4'
                                }],
                                routeDomain: 20
                            }
                        ]
                    );
                });
        });

        it('should not add defaultRouteDomain as routeDomain when routeDomain is specified', () => {
            declaration.tenant.application.pool1.members[0].addressDiscovery = 'static';
            declaration.tenant.application.pool1.members[0].serverAddresses = ['192.0.2.4'];
            declaration.tenant.application.pool1.members[0].routeDomain = 100;
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members,
                        [
                            {
                                servicePort: 80,
                                addressDiscovery: 'static',
                                serverAddresses: ['192.0.2.4'],
                                routeDomain: 100
                            }
                        ]
                    );
                });
        });

        it('should reject when a serverAddress conflicts with an existing AS3 node in /Common', () => {
            let rejected = false;
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                serverAddresses: [
                    '192.0.2.4'
                ]
            };
            context.host.parser.nodelist.push({
                key: '192.0.2.4',
                partition: 'Common',
                metadata: []
            });
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/pool1/members',
                        keyword: 'f5PostProcess(node)',
                        params: {
                            keyword: 'f5PostProcess(node)'
                        },
                        message: 'The node /tenant/192.0.2.4 conflicts with /Common/192.0.2.4'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject when a servers address conflicts with an existing AS3 node in /Common', () => {
            let rejected = false;
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                servers: [
                    {
                        name: 'myNode',
                        address: '192.0.2.4'
                    }
                ]
            };
            context.host.parser.nodelist.push({
                key: '192.0.2.4',
                partition: 'Common',
                metadata: []
            });
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/pool1/members',
                        keyword: 'f5PostProcess(node)',
                        params: {
                            keyword: 'f5PostProcess(node)'
                        },
                        message: 'The node /tenant/192.0.2.4 conflicts with /Common/192.0.2.4'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject when a servers address conflicts with an existing AS3 node in a non-Common partition', () => {
            let rejected = false;
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                servers: [
                    {
                        name: 'myNode',
                        address: '192.0.2.4'
                    }
                ]
            };
            context.host.parser.nodelist.push({
                key: '192.0.2.4',
                partition: 'otherTenant',
                fullPath: '/otherTenant/192.0.2.4',
                metadata: []
            });
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/pool1/members',
                        keyword: 'f5PostProcess(node)',
                        params: {
                            keyword: 'f5PostProcess(node)'
                        },
                        message: 'pool member /tenant/application/pool1/members/0 static address 192.0.2.4 conflicts with bigip node /otherTenant/192.0.2.4'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should mark nodes from serverAddresses and servers with commonNode if they exist in /Common with shareNodes and are AS3 nodes', () => {
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: true,
                serverAddresses: [
                    '192.0.2.4'
                ],
                servers: [
                    {
                        name: 'myNode',
                        address: '192.0.2.8'
                    }
                ]
            };
            context.host.parser.nodelist.push(
                {
                    key: '192.0.2.4',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.4',
                    metadata: [
                        {
                            name: 'references'
                        }
                    ]
                },
                {
                    key: '192.0.2.8',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.8',
                    metadata: [
                        {
                            name: 'references'
                        }
                    ]
                }
            );
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.strictEqual(context.host.parser.nodelist[0].commonNode, true);
                    assert.strictEqual(context.host.parser.nodelist[1].commonNode, true);
                });
        });

        it('should replace nodes from serverAddresses and servers with commonNode if all entries match common nodes', () => {
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: true,
                serverAddresses: [
                    '192.0.2.4', '192.0.2.1'
                ],
                servers: [
                    {
                        name: 'myNode',
                        address: '192.0.2.8'
                    }
                ]
            };
            context.host.parser.nodelist.push(
                {
                    key: '192.0.2.1',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.1'
                },
                {
                    key: '192.0.2.4',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.4'
                },
                {
                    key: '192.0.2.8',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.8'
                }
            );
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.strictEqual(declaration.tenant.application.pool1.members.length, 3);
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members[0],
                        {
                            shareNodes: true,
                            routeDomain: 20,
                            bigip: '/Common/192.0.2.8',
                            remark: '(replaces AS3 192.0.2.8)'
                        }
                    );
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members[1],
                        {
                            shareNodes: true,
                            routeDomain: 20,
                            bigip: '/Common/192.0.2.4',
                            remark: '(replaces AS3 192.0.2.4)'
                        }
                    );
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members[2],
                        {
                            shareNodes: true,
                            routeDomain: 20,
                            bigip: '/Common/192.0.2.1',
                            remark: '(replaces AS3 192.0.2.1)'
                        }
                    );
                });
        });

        it('should replace nodes from serverAddresses and servers with commonNode if only some entries match common nodes', () => {
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                serverAddresses: [
                    '192.0.2.4', '192.0.2.1'
                ],
                servers: [
                    {
                        name: 'myNode1',
                        address: '192.0.2.8'
                    },
                    {
                        name: 'myNode2',
                        address: '192.0.2.5'
                    }
                ]
            };
            context.host.parser.nodelist.push(
                {
                    key: '192.0.2.4',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.4'
                },
                {
                    key: '192.0.2.8',
                    partition: 'Common',
                    fullPath: '/Common/192.0.2.8'
                }
            );
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.strictEqual(declaration.tenant.application.pool1.members.length, 3);
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members[0],
                        {
                            addressDiscovery: 'static',
                            serverAddresses: [
                                '192.0.2.1'
                            ],
                            servers: [
                                {
                                    name: 'myNode2',
                                    address: '192.0.2.5'
                                }
                            ],
                            routeDomain: 20,
                            shareNodes: false
                        }
                    );
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members[1],
                        {
                            shareNodes: false,
                            routeDomain: 20,
                            bigip: '/Common/192.0.2.4',
                            remark: '(replaces AS3 192.0.2.4)'
                        }
                    );
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members[2],
                        {
                            shareNodes: false,
                            routeDomain: 20,
                            bigip: '/Common/192.0.2.8',
                            remark: '(replaces AS3 192.0.2.8)'
                        }
                    );
                });
        });

        it('should reject when servers has duplicate names', () => {
            let rejected = false;
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                servers: [
                    {
                        name: 'myNode',
                        address: '192.0.2.4'
                    },
                    {
                        name: 'myNode',
                        address: '192.0.2.8'
                    }
                ]
            };
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/pool1/members',
                        keyword: 'f5PostProcess(node)',
                        params: {
                            keyword: 'f5PostProcess(node)'
                        },
                        message: 'servers array has duplicate name myNode'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject when serverAddresses/servers has duplicate addresses', () => {
            let rejected = false;
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                serverAddresses: ['192.0.2.4'],
                servers: [
                    {
                        name: 'myNode1',
                        address: '192.0.2.4'
                    },
                    {
                        name: 'myNode2',
                        address: '192.0.2.8'
                    },
                    {
                        name: 'myNode3',
                        address: '192.0.2.8'
                    },
                    {
                        name: 'myNode4',
                        address: '192.0.2.8%100'
                    }
                ]
            };
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.strictEqual(err.errors.length, 2);
                    assert.deepStrictEqual(err.errors, [
                        {
                            dataPath: '/tenant/application/pool1/members',
                            keyword: 'f5PostProcess(node)',
                            params: {
                                keyword: 'f5PostProcess(node)'
                            },
                            message: 'serverAddresses/servers array has duplicate address 192.0.2.4%20'
                        },
                        {
                            dataPath: '/tenant/application/pool1/members',
                            keyword: 'f5PostProcess(node)',
                            params: {
                                keyword: 'f5PostProcess(node)'
                            },
                            message: 'serverAddresses/servers array has duplicate address 192.0.2.8%20'
                        }
                    ]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should reject when serverAddresses/servers has duplicate addresses due to defaultRouteDomain', () => {
            let rejected = false;
            declaration.tenant.defaultRouteDomain = 0;
            declaration.tenant.application.pool1.members[0] = {
                addressDiscovery: 'static',
                shareNodes: false,
                serverAddresses: ['192.0.2.6'],
                servers: [
                    {
                        name: 'myNode1',
                        address: '192.0.2.6%0'
                    }
                ]
            };
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.strictEqual(err.errors.length, 1);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/pool1/members',
                        keyword: 'f5PostProcess(node)',
                        params: {
                            keyword: 'f5PostProcess(node)'
                        },
                        message: 'serverAddresses/servers array has duplicate address 192.0.2.6%0'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });

        it('should replace fqdn node if it matches node in /Common', () => {
            declaration.tenant.application.pool1.members[0] = {
                servicePort: 80,
                addressDiscovery: 'fqdn',
                hostname: 'www.google.com'
            };
            context.host.parser.nodelist.push(
                {
                    key: 'www.google.com',
                    partition: 'Common',
                    fullPath: '/Common/www.google.com'
                }
            );
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.strictEqual(context.host.parser.nodelist[0].commonNode, false);
                    assert.deepStrictEqual(
                        declaration.tenant.application.pool1.members,
                        [
                            {
                                servicePort: 80,
                                bigip: '/Common/www.google.com',
                                remark: '(replaces AS3 www.google.com)'
                            }
                        ]
                    );
                });
        });

        it('should mark fqdn node with commonNode if it exists in /Common and is an AS3 node', () => {
            declaration.tenant.application.pool1.members[0] = {
                servicePort: 80,
                addressDiscovery: 'fqdn',
                hostname: 'www.google.com'
            };
            context.host.parser.nodelist.push(
                {
                    key: 'www.google.com',
                    partition: 'Common',
                    fullPath: '/Common/www.google.com',
                    metadata: [
                        {
                            name: 'references'
                        }
                    ]
                }
            );
            return NodeTag.process(context, declaration, getNodes())
                .then(() => {
                    assert.strictEqual(context.host.parser.nodelist[0].commonNode, true);
                });
        });

        it('should reject if fqdn node conflicts with node in non-Common partition', () => {
            let rejected = false;
            declaration.tenant.application.pool1.members[0] = {
                servicePort: 80,
                addressDiscovery: 'fqdn',
                hostname: 'www.google.com'
            };
            context.host.parser.nodelist.push(
                {
                    key: 'www.google.com',
                    partition: 'otherTenant',
                    fullPath: '/otherTenant/www.google.com'
                }
            );
            return NodeTag.process(context, declaration, getNodes())
                .catch((err) => {
                    rejected = true;
                    assert.ok(err instanceof AJV.ValidationError);
                    assert.strictEqual(err.errors.length, 1);
                    assert.deepStrictEqual(err.errors, [{
                        dataPath: '/tenant/application/pool1/members',
                        keyword: 'f5PostProcess(node)',
                        params: {
                            keyword: 'f5PostProcess(node)'
                        },
                        message: 'pool member /tenant/application/pool1/members/0 fqdn hostname www.google.com conflicts with bigip fqdn node /otherTenant/www.google.com'
                    }]);
                })
                .then(() => {
                    assert.ok(rejected, 'should have rejected');
                });
        });
    });
});

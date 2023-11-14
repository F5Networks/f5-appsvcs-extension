/**
 * Copyright 2023 F5, Inc.
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

const assert = chai.assert;

const extractUtil = require('../../../../src/lib/util/extractUtil');

describe('extractUtil', () => {
    describe('getAs3Object', () => {
        it('should not allow hyphen as a last character in the path', () => {
            const path = '/some/path/existing_ends_with_hyphen-';
            const src = '/Tenant/App/serviceMain/serverTLS';
            const origin = {
                class: 'Service_HTTPS'
            };
            return assert.throws(() => extractUtil.getAs3Object(path, src, origin), 'contains an invalid path (invalid character)');
        });

        it('should allow period and non-last character hyphen in the path', () => {
            const path = '/some/path/has-_hyphen.';
            const src = '/Tenant/App/serviceMain/serverTLS';
            const origin = {
                class: 'Service_HTTPS'
            };
            return assert.doesNotThrow(() => extractUtil.getAs3Object(path, src, origin), 'contains an invalid path (invalid character)');
        });

        it('should allow single letter Tenant and Application', () => {
            const path = '/F/A/source-path';
            const src = '/F/A/serviceMain/persistenceMethods/0/user';
            const origin = {
                class: 'Service_HTTP'
            };
            return assert.doesNotThrow(() => extractUtil.getAs3Object(path, src, origin), 'contains an invalid path (invalid character)');
        });

        it('should return the origin if there is no path provided', () => {
            const path = '';
            const src = '';
            const origin = {
                class: 'Service_HTTPS'
            };
            return assert.deepStrictEqual(
                extractUtil.getAs3Object(path, src, origin),
                {
                    class: 'Service_HTTPS'
                }
            );
        });

        it('should throw an error about relative paths outside of /Tenant/Application', () => {
            const path = 'test';
            const src = '/tenant/object';
            return assert.throws(() => extractUtil.getAs3Object(path, src), 'contains relative path valid only within /Tenant/Application');
        });

        it('should throw an error about bad path property name', () => {
            const path = 'test';
            const src = 'object/';
            return assert.throws(() => extractUtil.getAs3Object(path, src), 'cannot ascertain path property name');
        });

        it('should throw when there is no Application in Common', () => {
            const path = '/Tenant1/Common';
            const src = '/Common/serverHTTP';
            const origin = {
                class: 'Service_HTTP'
            };
            const root = {
                class: 'ADC',
                schemaVersion: '3.2.0',
                id: 'ltm_policy',
                label: '',
                remark: 'Simple HTTP application with LTM policy',
                Common: {
                    class: 'Tenant',
                    serverHTTP: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '10.0.1.10'
                        ],
                        policyEndpoint: 'forward_policy'
                    }
                }
            };

            return assert.deepStrictEqual(
                extractUtil.getAs3Object(path, src, origin, root),
                {
                    class: 'Tenant',
                    serverHTTP: {
                        class: 'Service_HTTP',
                        policyEndpoint: 'forward_policy',
                        virtualAddresses: [
                            '10.0.1.10'
                        ]
                    }
                }
            );
        });

        it('should throw when there is no Application', () => {
            const path = '/some/path';
            const src = '/Tenant/serverTLS';
            const origin = {
                class: 'Service_HTTPS'
            };

            return assert.throws(() => extractUtil.getAs3Object(path, src, origin), 'contains invalid path (Tenant without application)');
        });

        describe('testing with Endpoint_Policy', () => {
            const origin = {
                class: 'Service_HTTP',
                layer4: 'tcp',
                persistenceMethods: ['cookie'],
                policyEndpoint: 'forward_policy',
                profileHTTP: 'basic',
                profileTCP: 'normal',
                virtualAddresses: ['10.0.1.10'],
                virtualPort: 80,
                virtualtype: 'standard'
            };
            const patch = true;
            const dest = {
                class: 'Service_HTTP',
                layer4: 'tcp',
                persistenceMethods: ['cookie'],
                policyEndpoint: 'forward_policy',
                profileHTTP: 'basic',
                profileTCP: 'normal',
                virtualAddresses: ['10.0.1.10'],
                virtualPort: 80,
                virtaulType: 'standard'
            };
            const destPpty = 'policyEndpoint';
            const fetch = '';
            const val = null;
            const valPpty = '';
            let path;
            let src;
            let root;

            beforeEach(() => {
                path = 'forward_policy';
                src = '/Sample_http_08/A1/service/policyEndpoint';
                root = {
                    class: 'ADC',
                    schemaVersion: '3.2.0',
                    id: 'ltm_policy',
                    label: '',
                    remark: 'Simple HTTP application with LTM policy',
                    Sample_http_08: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            service: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '10.0.1.10'
                                ],
                                policyEndpoint: 'forward_policy'
                            },
                            web_pool: {
                                class: 'Pool',
                                monitors: [
                                    'http'
                                ],
                                members: [{
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.11'
                                    ]
                                }]
                            },
                            forward_policy: {
                                class: 'Endpoint_Policy',
                                rules: [{
                                    name: 'forward_to_pool',
                                    conditions: [{
                                        type: 'httpUri',
                                        path: {
                                            operand: 'contains',
                                            values: ['example.com']
                                        }
                                    }],
                                    actions: [{
                                        type: 'forward',
                                        event: 'request',
                                        select: {
                                            pool: {
                                                use: 'web_pool'
                                            }
                                        }
                                    }]
                                }]
                            }
                        }
                    }
                };
            });

            it('should handle the full submission', () => assert.deepStrictEqual(
                extractUtil.getAs3Object(path, src, origin, root, patch, dest, destPpty, fetch, val, valPpty),
                {
                    class: 'Endpoint_Policy',
                    rules: [
                        {
                            actions: [
                                {
                                    event: 'request',
                                    select: {
                                        pool: {
                                            use: 'web_pool'
                                        }
                                    },
                                    type: 'forward'
                                }
                            ],
                            conditions: [
                                {
                                    path: {
                                        operand: 'contains',
                                        values: ['example.com']
                                    },
                                    type: 'httpUri'
                                }
                            ],
                            name: 'forward_to_pool'
                        }
                    ]
                }
            ));

            it('should handle when path ends with #', () => {
                path = 'forward_policy#';
                return assert.deepStrictEqual(
                    extractUtil.getAs3Object(path, src, origin, root, patch, dest, destPpty, fetch, val, valPpty),
                    {
                        class: 'Endpoint_Policy',
                        rules: [
                            {
                                actions: [
                                    {
                                        event: 'request',
                                        select: {
                                            pool: {
                                                use: 'web_pool'
                                            }
                                        },
                                        type: 'forward'
                                    }
                                ],
                                conditions: [
                                    {
                                        path: {
                                            operand: 'contains',
                                            values: ['example.com']
                                        },
                                        type: 'httpUri'
                                    }
                                ],
                                name: 'forward_to_pool'
                            }
                        ]
                    }
                );
            });

            it('should handle when path starts with @', () => {
                path = '@/monitors/0';
                src = '/Sample_http_08/A1/web_pool/members/monitors';
                root = {
                    class: 'ADC',
                    schemaVersion: '3.2.0',
                    id: 'ltm_policy',
                    label: '',
                    remark: 'Simple HTTP application with LTM policy',
                    Sample_http_08: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            service: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['10.0.1.10']
                            },
                            web_pool: {
                                class: 'Pool',
                                monitors: [
                                    'http',
                                    'https'
                                ],
                                members: [{
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.11'
                                    ],
                                    monitors: [{
                                        use: 'web_pool'
                                    }]
                                }]
                            }
                        }
                    }
                };

                return assert.deepStrictEqual(
                    extractUtil.getAs3Object(path, src, origin, root, patch, dest, destPpty, fetch, val, valPpty),
                    'http'
                );
            });

            it('should error when path starts with a number that does NOT correlate with', () => {
                path = '1/monitors/0';
                src = '/Sample_http_08/A1/web_pool/members/monitors';
                root = {
                    class: 'ADC',
                    schemaVersion: '3.2.0',
                    id: 'ltm_policy',
                    label: '',
                    remark: 'Simple HTTP application with LTM policy',
                    Sample_http_08: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            service: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['10.0.1.10']
                            },
                            web_pool: {
                                class: 'Pool',
                                monitors: [
                                    'http',
                                    'https'
                                ],
                                members: [{
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.11'
                                    ],
                                    monitors: [{
                                        use: 'web_pool'
                                    }]
                                }]
                            }
                        }
                    }
                };

                return assert.throws(
                    () => extractUtil.getAs3Object(path, src, origin, root),
                    'contains path to non-existent object monitors'
                );
            });

            it('should error when path starts with a number that is too high', () => {
                path = '9/monitors/0';
                src = '/Sample_http_08/A1/web_pool/members/monitors';
                root = {
                    class: 'ADC',
                    schemaVersion: '3.2.0',
                    id: 'ltm_policy',
                    label: '',
                    remark: 'Simple HTTP application with LTM policy',
                    Sample_http_08: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            service: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['10.0.1.10']
                            },
                            web_pool: {
                                class: 'Pool',
                                monitors: [
                                    'http',
                                    'https'
                                ],
                                members: [{
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.11'
                                    ],
                                    monitors: [{
                                        use: 'web_pool'
                                    }]
                                }]
                            }
                        }
                    }
                };

                return assert.throws(
                    () => extractUtil.getAs3Object(path, src, origin, root),
                    'contains relative JSON pointer with too-big prefix'
                );
            });

            it('should handle when path starts with a 2', () => {
                path = '2/monitors/0';
                src = '/Sample_http_08/A1/web_pool/members/monitors';
                root = {
                    class: 'ADC',
                    schemaVersion: '3.2.0',
                    id: 'ltm_policy',
                    label: '',
                    remark: 'Simple HTTP application with LTM policy',
                    Sample_http_08: {
                        class: 'Tenant',
                        A1: {
                            class: 'Application',
                            service: {
                                class: 'Service_HTTP',
                                virtualAddresses: ['10.0.1.10']
                            },
                            web_pool: {
                                class: 'Pool',
                                monitors: [
                                    'http',
                                    'https'
                                ],
                                members: [{
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.11'
                                    ],
                                    monitors: [{
                                        use: 'web_pool'
                                    }]
                                }]
                            }
                        }
                    }
                };

                return assert.deepStrictEqual(
                    extractUtil.getAs3Object(path, src, origin, root, patch, dest, destPpty, fetch, val, valPpty),
                    'http'
                );
            });
        });
    });
});

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

const nock = require('nock');
const sinon = require('sinon');
const assert = require('assert');
const uuid = require('uuid');

const perAppUtil = require('../../../../src/lib/util/perAppUtil');

describe('perAppUtil', () => {
    beforeEach(() => {
        sinon.stub(uuid, 'v4').returns('new-uuid-xxxx');
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('convertToPerTenant', () => {
        it('should early exit and return the declaration if perAppInfo is not provided', () => {
            const decl = {
                exApp: {
                    class: 'Application',
                    template: 'generic',
                    pool1:
                    {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        minimumMembersActive: 1,
                        reselectTries: 0,
                        serviceDownAction: 'none',
                        slowRampTime: 11,
                        minimumMonitors: 1
                    }
                }
            };

            const result = perAppUtil.convertToPerTenant(decl);
            return assert.deepStrictEqual(result,
                {
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });
        });

        it('should early exit if no declaration is provided', () => {
            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerTenant(undefined, perAppInfo);
            return assert.deepStrictEqual(result, {});
        });

        it('should convert single app per-app declaration into a per-tenant declaration', () => {
            const decl = {
                exApp: {
                    class: 'Application',
                    template: 'generic',
                    pool1:
                    {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        minimumMembersActive: 1,
                        reselectTries: 0,
                        serviceDownAction: 'none',
                        slowRampTime: 11,
                        minimumMonitors: 1
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerTenant(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    class: 'ADC',
                    id: 'autogen_new-uuid-xxxx',
                    schemaVersion: '3.0.0',
                    exampleTenant: {
                        class: 'Tenant',
                        exApp: {
                            class: 'Application',
                            template: 'generic',
                            pool1:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        }
                    }
                });
        });

        it('should convert multi-app per-app declaration into a per-tenant declaration', () => {
            const decl = {
                otherApp: {
                    class: 'Application',
                    template: 'generic',
                    poolOther:
                    {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        minimumMembersActive: 1,
                        reselectTries: 0,
                        serviceDownAction: 'none',
                        slowRampTime: 11,
                        minimumMonitors: 1
                    }
                },
                exApp: {
                    class: 'Application',
                    template: 'generic',
                    pool1:
                    {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        minimumMembersActive: 1,
                        reselectTries: 0,
                        serviceDownAction: 'none',
                        slowRampTime: 11,
                        minimumMonitors: 1
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp', 'otherApp']
            };

            const result = perAppUtil.convertToPerTenant(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    class: 'ADC',
                    id: 'autogen_new-uuid-xxxx',
                    schemaVersion: '3.0.0',
                    exampleTenant: {
                        class: 'Tenant',
                        exApp: {
                            class: 'Application',
                            template: 'generic',
                            pool1:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        },
                        otherApp: {
                            class: 'Application',
                            template: 'generic',
                            poolOther:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        }
                    }
                });
        });

        it('should copy controls object if present', () => {
            const decl = {
                controls: {
                    class: 'Controls',
                    control1: true
                },
                exApp: {
                    class: 'Application',
                    template: 'generic'
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerTenant(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    class: 'ADC',
                    id: 'autogen_new-uuid-xxxx',
                    schemaVersion: '3.0.0',
                    exampleTenant: {
                        class: 'Tenant',
                        controls: {
                            class: 'Controls',
                            control1: true
                        },
                        exApp: {
                            class: 'Application',
                            template: 'generic'
                        }
                    }
                });
        });

        it('should handle an already converted per-tenant declaration', () => {
            const decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                exampleTenant: {
                    class: 'Tenant',
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    },
                    otherApp: {
                        class: 'Application',
                        template: 'generic',
                        poolOther:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp', 'otherApp']
            };

            const result = perAppUtil.convertToPerTenant(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    exampleTenant: {
                        class: 'Tenant',
                        exApp: {
                            class: 'Application',
                            template: 'generic',
                            pool1:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        },
                        otherApp: {
                            class: 'Application',
                            template: 'generic',
                            poolOther:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        }
                    }
                });
        });

        it('should handle an already converted per-tenant declaration but missing ADC', () => {
            const decl = {
                exampleTenant: {
                    class: 'Tenant',
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    },
                    otherApp: {
                        class: 'Application',
                        template: 'generic',
                        poolOther:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp', 'otherApp']
            };

            const result = perAppUtil.convertToPerTenant(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    exampleTenant: {
                        class: 'Tenant',
                        exApp: {
                            class: 'Application',
                            template: 'generic',
                            pool1:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        },
                        otherApp: {
                            class: 'Application',
                            template: 'generic',
                            poolOther:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        }
                    }
                });
        });
    });

    describe('convertToPerApp', () => {
        it('should early exit and return the declaration if perAppInfo is not provided', () => {
            const decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'autogen_new-uuid-xxxx',
                updateMode: 'selective',
                controls: {
                    archiveTimestamp: '2023-06-15T21:29:39.827Z'
                },
                exampleTenant: {
                    class: 'Tenant',
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }
            };

            const result = perAppUtil.convertToPerApp(decl);
            return assert.deepStrictEqual(result,
                {
                    class: 'ADC',
                    id: 'autogen_new-uuid-xxxx',
                    schemaVersion: '3.0.0',
                    updateMode: 'selective',
                    controls: {
                        archiveTimestamp: '2023-06-15T21:29:39.827Z'
                    },
                    exampleTenant: {
                        class: 'Tenant',
                        exApp: {
                            class: 'Application',
                            template: 'generic',
                            pool1:
                            {
                                class: 'Pool',
                                loadBalancingMode: 'round-robin',
                                minimumMembersActive: 1,
                                reselectTries: 0,
                                serviceDownAction: 'none',
                                slowRampTime: 11,
                                minimumMonitors: 1
                            }
                        }
                    }
                });
        });

        it('should early exit if no declaration is provided', () => {
            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerApp(undefined, perAppInfo);
            return assert.deepStrictEqual(result, {});
        });

        it('should convert single-app per-tenant declaration into a per-app declaration', () => {
            const decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'autogen_new-uuid-xxxx',
                updateMode: 'selective',
                controls: {
                    archiveTimestamp: '2023-06-15T21:29:39.827Z'
                },
                exampleTenant: {
                    class: 'Tenant',
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerApp(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });
        });

        it('should convert multi-app per-tenant declaration into a multi-app per-app declaration', () => {
            const decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'autogen_new-uuid-xxxx',
                updateMode: 'selective',
                controls: {
                    archiveTimestamp: '2023-06-15T21:29:39.827Z'
                },
                exampleTenant: {
                    class: 'Tenant',
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    },
                    otherApp: {
                        class: 'Application',
                        template: 'generic',
                        poolOther:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: []
            };

            const result = perAppUtil.convertToPerApp(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    },
                    otherApp: {
                        class: 'Application',
                        template: 'generic',
                        poolOther:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });
        });

        it('should convert multi-app per-tenant declaration into a single-app per-app declaration', () => {
            const decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'autogen_new-uuid-xxxx',
                updateMode: 'selective',
                controls: {
                    archiveTimestamp: '2023-06-15T21:29:39.827Z'
                },
                exampleTenant: {
                    class: 'Tenant',
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    },
                    otherApp: {
                        class: 'Application',
                        template: 'generic',
                        poolOther:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerApp(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });
        });

        it('should handle an already converted per-app declaration', () => {
            const decl = {
                exApp: {
                    class: 'Application',
                    template: 'generic',
                    pool1:
                    {
                        class: 'Pool',
                        loadBalancingMode: 'round-robin',
                        minimumMembersActive: 1,
                        reselectTries: 0,
                        serviceDownAction: 'none',
                        slowRampTime: 11,
                        minimumMonitors: 1
                    }
                }
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp']
            };

            const result = perAppUtil.convertToPerApp(decl, perAppInfo);
            return assert.deepStrictEqual(result,
                {
                    exApp: {
                        class: 'Application',
                        template: 'generic',
                        pool1:
                        {
                            class: 'Pool',
                            loadBalancingMode: 'round-robin',
                            minimumMembersActive: 1,
                            reselectTries: 0,
                            serviceDownAction: 'none',
                            slowRampTime: 11,
                            minimumMonitors: 1
                        }
                    }
                });
        });

        it('should return an error object if it was received', () => {
            const decl = {
                code: 400,
                message: 'cannot parse JSON POST payload (Unexpected token e in JSON at position 1)'
            };

            const perAppInfo = {
                tenant: 'exampleTenant',
                apps: ['exApp', 'otherApp']
            };

            const result = perAppUtil.convertToPerApp(decl, perAppInfo);
            return assert.deepStrictEqual(result, {
                code: 400,
                message: 'cannot parse JSON POST payload (Unexpected token e in JSON at position 1)'
            });
        });
    });

    describe('isPerAppPath', () => {
        it('should return false if no path is provided', () => {
            const result = perAppUtil.isPerAppPath();
            return assert.strictEqual(result, false);
        });

        it('should return true if the path is a valid applications path with query parameters', () => {
            const result = perAppUtil.isPerAppPath('/shared/appsvcs/declare/tenant1/applications?controls.trace=true');
            return assert.strictEqual(result, true);
        });

        it('should return true if the path is a valid applications path with one application', () => {
            const result = perAppUtil.isPerAppPath('/shared/appsvcs/declare/tenant1/applications/app1');
            return assert.strictEqual(result, true);
        });

        it('should return false if the path is missing applications or it is misspelled', () => {
            const result = perAppUtil.isPerAppPath('/shared/appsvcs/declare/tenant1/application/app1');
            return assert.strictEqual(result, false);
        });

        it('should return false if the path is not an applications path', () => {
            const result = perAppUtil.isPerAppPath('/shared/appsvcs/declare/tenant1');
            return assert.strictEqual(result, false);
        });

        it('should return false if the path is improper for per-app applications path', () => {
            const result = perAppUtil.isPerAppPath('/shared/appsvcs/declare/tenant1,tenant2/applications');
            return assert.strictEqual(result, false);
        });

        it('should return false if the path has multiple applications', () => {
            const result = perAppUtil.isPerAppPath('/shared/appsvcs/declare/tenant1/applications/app1,app2');
            return assert.strictEqual(result, false);
        });
    });

    describe('mergePreviousTenant', () => {
        it('should throw error if declaration is not per-tenant ADC class', () => {
            const perTenantDecl = undefined;
            const previousDecl = { class: 'ADC' };
            assert.throws(
                () => perAppUtil.mergePreviousTenant(perTenantDecl, previousDecl),
                /Declaration must already be converted to per-tenant ADC class/
            );
        });

        it('should throw error if previous per-tenant declaration is not ADC class', () => {
            const perTenantDecl = { class: 'ADC' };
            const previousDecl = undefined;
            assert.throws(
                () => perAppUtil.mergePreviousTenant(perTenantDecl, previousDecl),
                /Saved declaration must be ADC class to merge into per-tenant declaration/
            );
        });

        it('should return declaration if no previous tenant to merge', () => {
            const perTenantDecl = {
                class: 'ADC',
                targetTenant: {
                    class: 'Tenant',
                    targetApplication: {
                        class: 'Application'
                    }
                }
            };
            const previousDecl = {
                class: 'ADC',
                otherTenant: {
                    class: 'Tenant',
                    otherApplication: {
                        class: 'Application'
                    }
                }
            };
            const results = perAppUtil.mergePreviousTenant(perTenantDecl, previousDecl, 'targetTenant');
            assert.deepStrictEqual(
                results,
                {
                    class: 'ADC',
                    targetTenant: {
                        class: 'Tenant',
                        targetApplication: {
                            class: 'Application'
                        }
                    }
                }
            );
        });

        it('should return declaration with previous tenant merged', () => {
            const perTenantDecl = {
                class: 'ADC',
                targetTenant: {
                    class: 'Tenant',
                    targetApplication: {
                        class: 'Application'
                    }
                }
            };
            const previousDecl = {
                class: 'ADC',
                targetTenant: {
                    class: 'Tenant',
                    otherApplication: {
                        class: 'Application'
                    }
                }
            };
            const results = perAppUtil.mergePreviousTenant(perTenantDecl, previousDecl, 'targetTenant');
            assert.deepStrictEqual(
                results,
                {
                    class: 'ADC',
                    targetTenant: {
                        class: 'Tenant',
                        targetApplication: {
                            class: 'Application'
                        },
                        otherApplication: {
                            class: 'Application'
                        }
                    }
                }
            );
        });

        it('should prioritize apps in declaration over same apps from previous tenant', () => {
            const perTenantDecl = {
                class: 'ADC',
                targetTenant: {
                    class: 'Tenant',
                    targetApplication: {
                        class: 'Application',
                        serviceHTTPOne: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.2.30'
                            ]
                        }
                    }
                }
            };
            const previousDecl = {
                class: 'ADC',
                targetTenant: {
                    class: 'Tenant',
                    targetApplication: {
                        class: 'Application',
                        serviceAddress: {
                            class: 'Service_Address',
                            virtualAddress: '192.0.2.10'
                        }
                    },
                    otherApplication: {
                        class: 'Application'
                    }
                }
            };
            const results = perAppUtil.mergePreviousTenant(perTenantDecl, previousDecl, 'targetTenant');
            assert.deepStrictEqual(
                results,
                {
                    class: 'ADC',
                    targetTenant: {
                        class: 'Tenant',
                        targetApplication: {
                            class: 'Application',
                            serviceHTTPOne: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    '192.0.2.30'
                                ]
                            }
                        },
                        otherApplication: {
                            class: 'Application'
                        }
                    }
                }
            );
        });
    });

    describe('verifyResourcesExist', () => {
        let declaration;

        beforeEach(() => {
            declaration = {
                class: 'ADC',
                tenantOne: {
                    class: 'Tenant',
                    appOne: {
                        class: 'Application'
                    },
                    appTwo: {
                        class: 'Application'
                    }
                }
            };
        });

        it('should return 404 error response if tenant not found', () => {
            const perAppInfo = {
                tenant: 'otherTenant',
                apps: []
            };
            const results = perAppUtil.verifyResourcesExist(declaration, perAppInfo);
            assert.deepStrictEqual(
                results,
                {
                    statusCode: 404,
                    message: 'specified tenant \'otherTenant\' not found in declaration'
                }
            );
        });

        it('should return 404 error response if application not found', () => {
            const perAppInfo = {
                tenant: 'tenantOne',
                apps: ['appOne', 'otherApp']
            };
            const results = perAppUtil.verifyResourcesExist(declaration, perAppInfo);
            assert.deepStrictEqual(
                results,
                {
                    statusCode: 404,
                    message: 'specified Application \'otherApp\' not found in \'tenantOne\''
                }
            );
        });

        it('should return 200 response with declaration if valid', () => {
            const perAppInfo = {
                tenant: 'tenantOne',
                apps: ['appOne', 'appTwo']
            };
            const results = perAppUtil.verifyResourcesExist(declaration, perAppInfo);
            assert.deepStrictEqual(
                results,
                {
                    statusCode: 200
                }
            );
        });
    });

    describe('deleteAppsFromTenant', () => {
        let perTenDecl;
        let perAppInfo;

        beforeEach(() => {
            perTenDecl = {
                class: 'ADC',
                tenantOne: {
                    class: 'Tenant',
                    appOne: {
                        class: 'Application'
                    },
                    appTwo: {
                        class: 'Application'
                    }
                }
            };

            perAppInfo = {
                tenant: 'tenantOne',
                apps: ['appOne']
                // Note: DELETEs only have 1 apps, and do NOT have a decl
            };
        });

        it('should error if no perTenantDecl is provided', () => {
            assert.throws(
                () => perAppUtil.deleteAppsFromTenant(undefined, perAppInfo),
                /Declaration must already be converted to per-tenant ADC class/,
                'A missing perTenantDecl should error with "Declaration must already be converted to per-tenant ADC class"'
            );
        });

        it('should error if the ADC class is missing from the declaration', () => {
            delete perTenDecl.class;

            assert.throws(
                () => perAppUtil.deleteAppsFromTenant(perTenDecl, perAppInfo),
                /Declaration must already be converted to per-tenant ADC class/,
                'Should error if the ADC class is missing'
            );
        });

        it('should delete nothing if no perAppInfo is provided', () => {
            perAppUtil.deleteAppsFromTenant(perTenDecl, undefined);
            assert.deepStrictEqual(
                perTenDecl,
                {
                    class: 'ADC',
                    tenantOne: {
                        class: 'Tenant',
                        appOne: {
                            class: 'Application'
                        },
                        appTwo: {
                            class: 'Application'
                        }
                    }
                }
            );
        });

        it('should delete nothing if the tenant is missing from the declaration', () => {
            perAppInfo.tenant = 'otherTenant';

            perAppUtil.deleteAppsFromTenant(perTenDecl, perAppInfo);
            assert.deepStrictEqual(
                perTenDecl,
                {
                    class: 'ADC',
                    tenantOne: {
                        class: 'Tenant',
                        appOne: {
                            class: 'Application'
                        },
                        appTwo: {
                            class: 'Application'
                        }
                    }
                }
            );
        });

        it('should delete nothing if the apps do not exist in the declaration', () => {
            perAppInfo.apps = ['otherApp'];

            perAppUtil.deleteAppsFromTenant(perTenDecl, perAppInfo);
            assert.deepStrictEqual(
                perTenDecl,
                {
                    class: 'ADC',
                    tenantOne: {
                        class: 'Tenant',
                        appOne: {
                            class: 'Application'
                        },
                        appTwo: {
                            class: 'Application'
                        }
                    }
                }
            );
        });

        it('should remove the apps value from the perTenDecl', () => {
            perAppUtil.deleteAppsFromTenant(perTenDecl, perAppInfo);
            assert.deepEqual(
                perTenDecl,
                {
                    class: 'ADC',
                    tenantOne: {
                        class: 'Tenant',
                        appTwo: {
                            class: 'Application'
                        }
                    }
                }
            );
        });
    });
});

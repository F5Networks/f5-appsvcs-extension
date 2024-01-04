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

const requestUtil = require('../../../common/requestUtilPromise');

const {
    assertClass,
    assertModuleProvisioned,
    getItemName,
    resolveMcpReferences,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');
const oauth = require('../../../common/oauth');
const { validateEnvVars } = require('../../../common/checkEnv');

const policyHost = `${process.env.TEST_RESOURCES_URL}`;

describe('WAF Policy', function () {
    this.timeout(GLOBAL_TIMEOUT);

    // WAF policy full path limit is 127
    const maxPathLength = 127;
    const tenantName = 'TEST_WAF_Policy';

    let accessToken;
    let assertOptions;

    before(() => {
        validateEnvVars(['TEST_RESOURCES_URL']);
    });

    beforeEach(() => {
        assertOptions = {
            maxPathLength,
            trace: false, // WAF policies causes data-group problems when stored
            traceResponse: false
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            return oauth.getTokenForTest()
                .then((token) => {
                    accessToken = token;
                });
        }
        return Promise.resolve();
    });

    it('Load from URL', function () {
        assertModuleProvisioned.call(this, 'asm');

        // Azure resources require auth
        if (process.env.TEST_IN_AZURE === 'true') {
            this.skip();
        }

        const properties = [
            {
                name: 'url',
                inputValue: [`https://${policyHost}/asm-policy/wordpress_template_12.0.xml`],
                expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            },
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        return assertClass('WAF_Policy', properties, assertOptions);
    });

    it('Load from URL object', function () {
        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'url',
                inputValue: [{
                    url: `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`,
                    skipCertificateCheck: true
                }],
                expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            },
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        const urlProperty = {
            name: 'url',
            inputValue: [{
                url: `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`,
                skipCertificateCheck: true
            }],
            expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
            extractFunction: (o) => o.fullPath

        };

        if (process.env.TEST_IN_AZURE === 'true') {
            urlProperty.inputValue[0].authentication = {
                method: 'bearer-token',
                token: accessToken
            };
        }

        properties.push(urlProperty);

        return assertClass('WAF_Policy', properties, assertOptions);
    });

    function testFileProperty(properties, options, fileName) {
        return Promise.resolve()
            .then(() => {
                const pathPrefix = policyHost.indexOf('/') === -1 ? '' : `/${policyHost.split('/').slice(1).join('/')}`;
                const reqOpts = {
                    host: policyHost.split('/')[0],
                    auth: '',
                    path: `${pathPrefix}/asm-policy/wordpress_template_12.0.xml`,
                    skipParse: true
                };

                if (process.env.TEST_IN_AZURE === 'true') {
                    reqOpts.auth = null;
                    reqOpts.headers = {
                        Authorization: `Bearer ${accessToken}`,
                        'x-ms-version': '2017-11-09'
                    };
                }

                return requestUtil.get(reqOpts);
            })
            .then((result) => {
                const body = result.body;
                const bodySize = body.length;
                const reqOpts = {
                    path: `/mgmt/shared/file-transfer/uploads/${fileName}`,
                    body,
                    headers: {
                        'Content-Range': `0-${bodySize - 1}/${bodySize}`
                    },
                    host: process.env.TARGET_HOST || process.env.AS3_HOST
                };
                return requestUtil.post(reqOpts);
            })
            .then(() => assertClass('WAF_Policy', properties, options));
    }

    it('Load from file', function () {
        assertModuleProvisioned.call(this, 'asm');

        // This functionality works from BIG-IQ -> BIG-IP, but we test TARGET_HOST on 2 BIG-IPs
        if (process.env.TARGET_HOST) {
            this.skip();
        }
        const fileName = 'fileTest.xml';
        const properties = [
            {
                name: 'file',
                inputValue: [`/var/config/rest/downloads/${fileName}`],
                expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            },
            {
                name: 'enforcementMode',
                inputValue: [undefined, 'transparent', undefined],
                expectedValue: ['blocking', 'transparent', 'blocking'],
                extractFunction: (o) => o.enforcementMode
            },
            {
                name: 'ignoreChanges',
                inputValue: [false],
                skipAssert: true
            }
        ];

        assertOptions.skipIdempotentCheck = true;

        if (process.env.DRY_RUN) {
            return assertClass('WAF_Policy', properties, assertOptions);
        }

        return testFileProperty(properties, assertOptions, fileName);
    });

    it('Load from file with ignoreChanges true', function () {
        assertModuleProvisioned.call(this, 'asm');

        // This functionality works from BIG-IQ -> BIG-IP, but we test TARGET_HOST on 2 BIG-IPs
        if (process.env.TARGET_HOST) {
            this.skip();
        }
        const fileName = 'fileTest.xml';
        const properties = [
            {
                name: 'file',
                inputValue: [`/var/config/rest/downloads/${fileName}`],
                expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            },
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        if (process.env.DRY_RUN) {
            return assertClass('WAF_Policy', properties, assertOptions);
        }

        return testFileProperty(properties, assertOptions, fileName);
    });

    it('Override Settings', function () {
        assertModuleProvisioned.call(this, 'asm');

        let policyPath = null;
        function getPolicyPath() {
            if (policyPath) return Promise.resolve(policyPath);
            const requestOptions = {
                path: '/mgmt/tm/asm/policies',
                host: process.env.TARGET_HOST || process.env.AS3_HOST
            };
            return requestUtil.get(requestOptions)
                .then((result) => {
                    const id = result.body.items.find((p) => p.name === getItemName({ tenantName, maxPathLength })).id;
                    policyPath = `/mgmt/tm/asm/policies/${id}`;
                    return policyPath;
                });
        }

        const properties = [
            {
                name: 'ignoreChanges',
                inputValue: [false],
                skipAssert: true
            },
            {
                name: 'enforcementMode',
                inputValue: ['blocking', 'transparent', undefined],
                expectedValue: ['blocking', 'transparent', 'blocking'],
                extractFunction: () => getPolicyPath()
                    .then((path) => {
                        const requestOptions = {
                            path,
                            host: process.env.TARGET_HOST || process.env.AS3_HOST
                        };
                        return requestUtil.get(requestOptions);
                    })
                    .then((result) => result.body.enforcementMode)
            },
            {
                name: 'serverTechnologies',
                inputValue: [
                    undefined,
                    ['Apache Struts', 'Java Servlets/JSP'],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['Apache Struts', 'Java Servlets/JSP'],
                    []
                ],
                extractFunction: () => getPolicyPath()
                    .then((path) => {
                        path += '/server-technologies';
                        const requestOptions = {
                            path,
                            host: process.env.TARGET_HOST || process.env.AS3_HOST
                        };
                        return requestUtil.get(requestOptions);
                    })
                    .then((result) => Promise.all(
                        // Need to run the resolveMcpReferences on each member of the array
                        result.body.items.map((item) => resolveMcpReferences(item))
                    ))
                    .then((items) => {
                        if (!items) {
                            return [];
                        }
                        return items.map((item) => item.serverTechnology.serverTechnologyName).sort();
                    })
            },
            {
                name: 'disabledSignatures',
                inputValue: [
                    [],
                    [200000002],
                    []
                ],
                expectedValue: [
                    [],
                    [200000002],
                    []
                ],
                extractFunction: () => getPolicyPath()
                    .then((path) => {
                        path += '/signatures';
                        const requestOptions = {
                            path,
                            host: process.env.TARGET_HOST || process.env.AS3_HOST
                        };
                        return requestUtil.get(requestOptions);
                    })
                    .then((result) => result.body.items.filter((item) => !item.enabled && !item.performStaging))
                    .then((items) => Promise.all(items.map((item) => resolveMcpReferences(item))))
                    .then((items) => items.map((item) => item.signature.signatureId))
                    // signatureId 200002305 is throwing false-positives
                    .then((sigIds) => sigIds.filter((sigId) => sigId !== 200002305))
            }
        ];

        const urlObj = {
            name: 'url',
            inputValue: [`https://${policyHost}/asm-policy/wordpress_template_12.0.xml`],
            skipAssert: true
        };

        if (process.env.TEST_IN_AZURE === 'true') {
            urlObj.inputValue = [{
                url: `https://${policyHost}/asm-policy/wordpress_template_12.0.xml`,
                authentication: {
                    method: 'bearer-token',
                    token: accessToken
                }
            }];
        }

        properties.push(urlObj);

        assertOptions.skipIdempotentCheck = true;
        return assertClass('WAF_Policy', properties, assertOptions);
    });

    it('Load Declarative WAF from URL', function () {
        assertModuleProvisioned.call(this, 'asm');

        if (util.versionLessThan(getBigIpVersion(), '16.0')) {
            this.skip();
        }

        const url = 'https://raw.githubusercontent.com/f5devcentral/f5-asm-policy-templates/v1.1/owasp_ready_template/owasp_policy_v1.0.json';
        const expected = `/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`;
        const properties = [
            {
                name: 'url',
                inputValue: [url],
                expectedValue: [expected],
                extractFunction: (o) => o.fullPath
            },
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        return assertClass('WAF_Policy', properties, assertOptions);
    });

    it('should handle WAF_Policy in base64', function () {
        if (process.env.DRY_RUN) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'asm');

        const properties = [
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        return Promise.resolve()
            .then(() => {
                const pathPrefix = policyHost.indexOf('/') === -1 ? '' : `/${policyHost.split('/').slice(1).join('/')}`;
                const reqOpts = {
                    host: policyHost.split('/')[0],
                    auth: '',
                    path: `${pathPrefix}/asm-policy/wordpress_template_12.0_base64`,
                    skipParse: true
                };

                if (process.env.TEST_IN_AZURE === 'true') {
                    reqOpts.auth = null;
                    reqOpts.headers = {
                        Authorization: `Bearer ${accessToken}`,
                        'x-ms-version': '2017-11-09'
                    };
                }

                return requestUtil.get(reqOpts);
            })
            .then((result) => {
                properties.push(
                    {
                        name: 'policy',
                        inputValue: [
                            {
                                base64: result.body
                            }
                        ],
                        expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
                        extractFunction: (o) => o.fullPath
                    }
                );

                return assertClass('WAF_Policy', properties, assertOptions);
            });
    });

    it('should expand and fetch open API spec', function () {
        assertModuleProvisioned.call(this, 'asm');

        if (util.versionLessThan(getBigIpVersion(), '16.0') || process.env.TEST_IN_AZURE === 'true') {
            this.skip();
        }

        const policy = {
            policy: {
                name: 'policy',
                description: 'Test API',
                template: {
                    name: 'POLICY_TEMPLATE_API_SECURITY'
                },
                enforcementMode: 'blocking',
                'server-technologies': [
                    {
                        serverTechnologyName: 'MySQL'
                    },
                    {
                        serverTechnologyName: 'Unix/Linux'
                    },
                    {
                        serverTechnologyName: 'MongoDB'
                    }
                ],
                'signature-settings': {
                    signatureStaging: false
                },
                'policy-builder': {
                    learnOnlyFromNonBotTraffic: false
                },
                'open-api-files': [
                    {
                        link: `https://${policyHost}/asm-policy/\`T\`_API.yaml`
                    }
                ]
            }
        };

        const properties = [
            {
                name: 'policy',
                inputValue: [
                    {
                        base64: Buffer.from(JSON.stringify(policy)).toString('base64')
                    }
                ],
                expectedValue: [`/${tenantName}/Application/${getItemName({ tenantName, maxPathLength })}`],
                extractFunction: (o) => o.fullPath
            },
            {
                name: 'expand',
                inputValue: [
                    ['/policy/open-api-files/0/link']
                ],
                skipAssert: true
            },
            {
                name: 'ignoreChanges',
                inputValue: [true],
                skipAssert: true
            }
        ];

        return assertClass('WAF_Policy', properties, assertOptions);
    });
});

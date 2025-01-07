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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const util = require('../../../../src/lib/util/util');
const asmUtil = require('../../../../src/lib/util/asmUtil');

function createXml(policy) {
    return asmUtil.convertJsonToXml({ policy });
}

describe('asmUtil', () => {
    it('should reject on missing XML string argument', () => assert.isRejected(
        asmUtil.applyAs3Settings()
    ));

    it('should reject on a bad XML string', () => assert.isRejected(
        asmUtil.applyAs3Settings('<problem?>?>')
    ));

    it('should reject on unrecognized setting', () => assert.isRejected(
        Promise.resolve()
            .then(() => createXml({}))
            .then((xmlString) => asmUtil.applyAs3Settings(xmlString, { badSetting: 'foo' }))
    ));

    it('should ignore non-override settings', () => {
        let xmlString = '';
        return Promise.resolve()
            .then(() => createXml({}))
            .then((result) => {
                xmlString = result;
            })
            .then(() => Promise.all([
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { class: '' })),
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { label: '' })),
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { remark: '' })),
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { url: '' })),
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { file: '' })),
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { ignoreChanges: '' })),
                assert.isFulfilled(asmUtil.applyAs3Settings(xmlString, { policy: '' }))
            ]));
    });

    it('should set enforcement_mode', () => {
        let expected = '';
        return Promise.resolve()
            .then(() => createXml({
                blocking: {
                    enforcement_mode: 'blocking'
                }
            }))
            .then((policy) => {
                expected = policy;
            })
            .then(() => createXml({
                blocking: {
                    enforcement_mode: 'transparent'
                }
            }))
            .then((asmPolicy) => asmUtil.applyAs3Settings(asmPolicy, {
                enforcementMode: 'blocking'
            }))
            .then((result) => {
                assert.deepStrictEqual(result, expected);
            });
    });

    it('should set server_technologies', () => {
        let expected = '';
        return Promise.resolve()
            .then(() => createXml({
                server_technologies: {
                    server_technology: [
                        { server_technology_name: 'Java Servlets/JSP' },
                        { server_technology_name: 'Apache Struts' }
                    ]
                }
            }))
            .then((policy) => {
                expected = policy;
            })
            .then(() => createXml({
                server_technologies: {
                    server_technology: [
                        { server_technology_name: 'Initech Server' }
                    ]
                }
            }))
            .then((asmPolicy) => asmUtil.applyAs3Settings(asmPolicy, {
                serverTechnologies: ['Java Servlets/JSP', 'Apache Struts']
            }))
            .then((result) => {
                assert.deepStrictEqual(result, expected);
            });
    });

    it('should disable specified attack signatures', () => {
        let expected = '';
        return Promise.resolve()
            .then(() => createXml({
                attack_signatures: {
                    signature_set: [{
                        alarm: ['true'],
                        block: ['true'],
                        warn: ['true']
                    }],
                    enable_staging: ['true'],
                    staging_period_in_days: ['7'],
                    signature: [
                        {
                            $: { signature_id: '200000001' },
                            enabled: ['false'],
                            in_staging: ['false']
                        },
                        {
                            $: { signature_id: ['200000002'] },
                            enabled: ['false'],
                            in_staging: ['false']
                        },
                        {
                            $: { signature_id: ['200000003'] },
                            enabled: ['true'],
                            in_staging: ['false']
                        }
                    ]
                }
            }))
            .then((policy) => {
                expected = policy;
            })
            .then(() => createXml({
                attack_signatures: {
                    signature_set: {
                        alarm: ['true'],
                        block: ['true'],
                        warn: ['true']
                    },
                    enable_staging: ['true'],
                    staging_period_in_days: ['7'],
                    signature: [
                        {
                            $: { signature_id: ['200000001'] },
                            enabled: ['true'],
                            in_staging: ['false']
                        },
                        {
                            $: { signature_id: ['200000002'] },
                            enabled: ['true'],
                            in_staging: ['false']
                        },
                        {
                            $: { signature_id: ['200000003'] },
                            enabled: ['true'],
                            in_staging: ['false']
                        }
                    ]
                }
            }))
            .then((asmPolicy) => asmUtil.applyAs3Settings(asmPolicy, {
                disabledSignatures: [200000001, 200000002]
            }))
            .then((result) => {
                assert.deepStrictEqual(result, expected);
            });
    });

    it('should reject when not parsable input', () => assert.isRejected(
        asmUtil.applyAs3Settings('definitelyNotXml', {}),
        'Non-whitespace before first tag'
    ));

    it('should accept JSON input and ignore overrides', () => assert.isFulfilled(
        asmUtil.applyAs3Settings('{}', {})
    ));

    describe('expand', () => {
        let declaration;
        let policy;

        beforeEach(() => {
            declaration = {
                class: 'ADC',
                Tenant: {
                    class: 'Tenant',
                    Application: {
                        class: 'Application',
                        wafPolicy: {
                            class: 'WAF_Policy',
                            policy: {
                                base64: 'eyJvcGVuLWFwaS1maWxlcyI6W3sibGluayI6Imh0dHBzOi8vMTkyLjAuMi4xMC9gQWAvb3BlbmFwaS55YW1sIn1dfQ=='
                            }
                        }
                    }
                }
            };
            policy = {
                policy: {
                    'open-api-files': [
                        {
                            link: 'https://192.0.2.10/`A`/openapi.yaml'
                        }
                    ]
                }
            };
        });

        it('should fail to expand strings if JSON pointer references a nonexistent value', () => {
            declaration.Tenant.Application.wafPolicy.expand = ['/bad/path/in/policy'];

            const settings = util.simpleCopy(declaration.Tenant.Application.wafPolicy);

            return assert.isRejected(
                asmUtil.applyAs3Settings(JSON.stringify(policy), settings, '/Tenant/Application/wafPolicy', declaration),
                'Could not expand string in /Tenant/Application/wafPolicy. JSON pointer "/bad/path/in/policy" references a nonexistent value in the policy'
            );
        });

        it('should expand the value that the JSON pointer references', () => {
            declaration.Tenant.Application.wafPolicy.expand = ['/policy/open-api-files/0/link'];

            const settings = util.simpleCopy(declaration.Tenant.Application.wafPolicy);
            const expected = util.simpleCopy(policy);
            expected.policy['open-api-files'][0].link = 'https://192.0.2.10/Application/openapi.yaml';

            return asmUtil.applyAs3Settings(JSON.stringify(policy), settings, '/Tenant/Application/wafPolicy', declaration)
                .then((results) => {
                    assert.deepStrictEqual(JSON.parse(results), expected);
                });
        });

        it('should recursively expand any sub-values of the object that the JSON pointer references', () => {
            // empty JSON pointer points to root obj
            declaration.Tenant.Application.wafPolicy.expand = [''];

            const settings = util.simpleCopy(declaration.Tenant.Application.wafPolicy);
            const expected = util.simpleCopy(policy);
            expected.policy['open-api-files'][0].link = 'https://192.0.2.10/Application/openapi.yaml';

            return asmUtil.applyAs3Settings(JSON.stringify(policy), settings, '/Tenant/Application/wafPolicy', declaration)
                .then((results) => {
                    assert.deepStrictEqual(JSON.parse(results), expected);
                });
        });

        it('should handle special characters and values when recursing', () => {
            // empty JSON pointer points to root obj
            declaration.Tenant.Application.wafPolicy.expand = [''];

            // test keys taken from RFC 6901
            const testKeys = ['', 'a/b', 'c%d', 'e^f', 'g|h', 'i\\j', 'k"l', ' ', 'm~n'];
            // iterate the test keys and create nested sub-objects with an expandable value at the end
            testKeys.reduce((obj, key) => {
                obj[key] = {};
                return obj[key];
            }, policy).data = '`O`';
            policy.nullData = null;
            policy.undefinedData = undefined;
            delete policy.policy;

            const settings = util.simpleCopy(declaration.Tenant.Application.wafPolicy);
            const expected = util.simpleCopy(policy);
            testKeys.reduce((obj, key) => obj[key], expected).data = 'wafPolicy';

            return asmUtil.applyAs3Settings(JSON.stringify(policy), settings, '/Tenant/Application/wafPolicy', declaration)
                .then((results) => {
                    assert.deepStrictEqual(JSON.parse(results), expected);
                });
        });
    });
});

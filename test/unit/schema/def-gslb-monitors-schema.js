/**
 * Copyright 2022 F5 Networks, Inc.
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
const Ajv = require('ajv');
const Context = require('../../../src/lib/context/context');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const formats = require('../../../src/lib/adcParserFormats');
const keywords = require('../../../src/lib/adcParserKeywords');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const parserScope = {
    context: Context.build(),
    components: [],
    fetches: [],
    postProcess: []
};
parserScope.context.target.provisionedModules = ['gtm'];
keywords.keywords.forEach((keyword) => ajv.addKeyword(keyword.name, keyword.definition(parserScope)));

const validate = ajv
    .compile(adcSchema);

describe('def-gslb-monitors-schema.json', () => {
    describe('GSLB_Monitor_External', () => {
        describe('invalid', () => {
            it('should invalidate when no script or pathname provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitor: {
                                class: 'GSLB_Monitor',
                                monitorType: 'external'
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'external monitors must have a pathmame or script');
                assert.ok(getErrorString(validate)
                    .includes('should have required property \'.pathname\''));
                assert.ok(getErrorString(validate)
                    .includes('should have required property \'.script\''));
            });

            it('should invalidate when script and pathname are provided', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitor: {
                                class: 'GSLB_Monitor',
                                monitorType: 'external',
                                pathname: '/the/path',
                                script: {
                                    url: 'https://theurl.com'
                                }
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'cannot use pathname and script together');
                assert.ok(getErrorString(validate)
                    .includes('should match exactly one schema in oneOf'));
            });

            it('should invalidate when environment variables are not strings', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitor: {
                                class: 'GSLB_Monitor',
                                monitorType: 'external',
                                pathname: '/the/file/path',
                                environmentVariables: {
                                    USER: 42
                                }
                            }
                        }
                    }
                };
                assert.strictEqual(validate(data), false, 'environment variables should be strings');
                assert.ok(getErrorString(validate).includes('should be string'));
            });
        });

        describe('valid', () => {
            it('should validate with minimal properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitor: {
                                class: 'Monitor',
                                monitorType: 'external',
                                pathname: '/the/path'
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with valid script and all other valid properties', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitor: {
                                class: 'GSLB_Monitor',
                                label: 'A label',
                                remark: 'This is an external monitor',
                                monitorType: 'external',
                                targetAddress: '1.2.3.4',
                                interval: 25,
                                upInterval: 100,
                                timeUntilUp: 1000,
                                timeout: 123,
                                script: {
                                    url: 'https://the.script.com'
                                },
                                expand: false,
                                arguments: 'Some arguments',
                                environmentVariables: {
                                    USER: 'nobody'
                                }
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });

            it('should validate with valid script url object', () => {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: 'declarationId',
                    theTenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            monitor: {
                                class: 'GSLB_Monitor',
                                monitorType: 'external',
                                script: {
                                    url: {
                                        url: 'https://the.script.com',
                                        authentication: {
                                            method: 'bearer-token',
                                            token: 'myToken'
                                        }
                                    }
                                },
                                expand: false
                            }
                        }
                    }
                };
                assert.ok(validate(data), getErrorString(validate));
            });
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

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
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const appSchema = require('../../../src/schema/latest/app-schema.json');
const formats = require('../../../src/lib/adcParserFormats');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

ajv.addSchema(adcSchema); // app-schema references adc-schema Applications
const validate = ajv.compile(appSchema);

const assertErrorString = (expectedString) => {
    const errorString = getErrorString(validate);
    assert.ok(errorString.includes(expectedString), `Expected string "${expectedString}" to be `
    + `included in error string:\n${errorString}`);
};

describe('per-app schema testing', () => {
    describe('valid', () => {
        it('should handle a single per-app declaration', () => {
            const data = {
                schemaVersion: '3.50',
                application1: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.1'
                        ],
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.10',
                                    '192.0.2.20'
                                ]
                            }
                        ]
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should handle a single per-app declaration with an id', () => {
            const data = {
                id: 'id',
                schemaVersion: '3.50',
                application1: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.1'
                        ],
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.10',
                                    '192.0.2.20'
                                ]
                            }
                        ]
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });

        it('should handle a multiple per-app declaration', () => {
            const data = {
                schemaVersion: '3.50',
                application1: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.1'
                        ],
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.10',
                                    '192.0.2.20'
                                ]
                            }
                        ]
                    }
                },
                application2: {
                    class: 'Application',
                    service: {
                        class: 'Service_HTTP',
                        virtualAddresses: [
                            '192.0.2.2'
                        ],
                        pool: 'pool'
                    },
                    pool: {
                        class: 'Pool',
                        members: [
                            {
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.2.20',
                                    '192.0.2.21'
                                ]
                            }
                        ]
                    }
                }
            };
            assert.ok(validate(data), getErrorString(validate));
        });
    });

    describe('invalid', () => {
        it('should be invalid per-app declarations are inside an array', () => {
            const data = [
                {
                    application1: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.2.1'
                            ],
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.10',
                                        '192.0.2.20'
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    application2: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.2.2'
                            ],
                            pool: 'pool'
                        },
                        pool: {
                            class: 'Pool',
                            members: [
                                {
                                    servicePort: 80,
                                    serverAddresses: [
                                        '192.0.2.30',
                                        '192.0.2.40'
                                    ]
                                }
                            ]
                        }
                    }
                }
            ];
            assert.strictEqual(validate(data), false, 'Arrays should be invalid');
            assertErrorString('should be object');
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

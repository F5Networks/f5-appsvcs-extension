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

const chai = require('chai');
const sinon = require('sinon');

const assert = chai.assert;
const As3Request = require('../../../src/lib/as3request');
const util = require('../../../src/lib/util/util');
const tmshUtil = require('../../../src/lib/util/tmshUtil');
const constants = require('../../../src/lib/constants');

describe('as3request', function () {
    let schemaPath;
    let as3Request;

    before(() => {
        schemaPath = `${__dirname}/../../../src/schema/latest/as3-request-schema.json`;
        // Build the request once so that we don't have to keep parsing the schema
        as3Request = new As3Request(schemaPath);
    });
    beforeEach(() => {
        sinon.stub(util, 'getMgmtPort').resolves(8443);
        sinon.stub(tmshUtil, 'getPrimaryAdminUser').resolves('admin');
    });
    afterEach(() => sinon.restore());

    describe('.constructor', () => {
        it('should error if the schemaPath is not provided', () => assert.throws(
            () => new As3Request(), /A path to the schema is required/
        ));

        it('should set the default values', () => {
            assert.deepStrictEqual(as3Request.ajvOptions, {
                allErrors: false,
                async: false,
                jsonPointers: true,
                useDefaults: true,
                verbose: true
            });
            assert.strictEqual(typeof as3Request.validator, 'function');
        });

        it('should set the passed in values', () => {
            const ajvOptions = {
                allErrors: false,
                async: true,
                jsonPointers: false,
                useDefaults: false,
                verbose: false
            };
            const tempAs3Request = new As3Request(schemaPath, ajvOptions);

            assert.match(tempAs3Request.schemaPath,
                /..\/..\/..\/src\/schema\/latest\/as3-request-schema.json/);
            assert.deepStrictEqual(tempAs3Request.ajvOptions, {
                allErrors: false,
                async: true,
                jsonPointers: false,
                useDefaults: false,
                verbose: false
            });
            assert.strictEqual(typeof tempAs3Request.validator, 'function');
        });
    });

    describe('validator', () => {
        let validator;
        before(() => {
            validator = new As3Request(schemaPath).getAjvValidatorInstance();
        });

        function validate(request, expectedResult) {
            let errMsg;
            validator(request);

            let isValid = true;
            if (validator.errors) {
                isValid = false;
                errMsg = `Errors: ${JSON.stringify(validator.errors[0])}`;
            }
            return assert.equal(isValid, expectedResult, errMsg);
        }

        function assertInvalid(request) {
            return validate(request, false);
        }

        function assertValid(request) {
            return validate(request, true);
        }

        it('should fail on empty object', () => assertInvalid({}));

        it('should fail on empty array', () => assertInvalid([]));

        it('should fail when class is specified and invalid',
            () => assertInvalid(
                {
                    class: 'mumble'
                }
            ));

        it('should fail with invalid AS3', () => assertInvalid(
            {
                class: 'AS3',
                action: 'magically transform'
            }
        ));

        it('should succeed with AS3', () => assertValid(
            {
                class: 'AS3',
                action: 'redeploy',
                targetHost: '192.0.2.1',
                targetUsername: 'user',
                targetPassphrase: 'password'
            }
        ));

        it('should succeed with AS3 array', () => assertValid(
            [
                {
                    class: 'AS3',
                    action: 'retrieve',
                    targetHost: '192.0.2.1',
                    targetUsername: 'user',
                    targetPassphrase: 'password'
                },
                {
                    class: 'AS3',
                    action: 'redeploy',
                    targetHost: '192.0.2.2',
                    targetUsername: 'user',
                    targetPassphrase: 'password'
                }
            ]
        ));

        it('should succeed with ADC', () => assertValid(
            {
                class: 'ADC',
                id: 'test1111',
                schemaVersion: '3.0.0'

            }
        ));

        it('should succeed with ADC array', () => assertValid(
            [
                {
                    class: 'ADC',
                    id: 'test1111',
                    schemaVersion: '3.10.0'

                },
                {
                    class: 'ADC',
                    id: 'test2222',
                    schemaVersion: '3.10.0'
                }
            ]
        ));

        it('should succeed with patch single', () => assertValid(
            [{
                op: 'add',
                path: '/some/test',
                value: 'to add'

            }]
        ));

        it('should succeed with patch multiple', () => assertValid([
            {
                op: 'add',
                path: '/some/test',
                value: 'to add'

            },
            {
                op: 'remove',
                path: '/some/test'
            }
        ]));

        it('should fail with invalid patch body', () => assertInvalid(
            [{
                op: 'add',
                value: 'to add'
            }]
        ));

        it('should fail with array containing both ADC item and AS3 item', () => assertInvalid(
            [
                {
                    class: 'AS3',
                    action: 'remove'
                },
                {
                    class: 'ADC',
                    id: 'test1111',
                    schemaVersion: '3.10.0'

                }
            ]
        ));

        it('should fail with array containing ADC item and patchBody item', () => assertInvalid(
            [
                {
                    class: 'ADC',
                    id: 'test1111',
                    schemaVersion: '3.10.0'

                },
                {
                    op: 'add',
                    path: '/some/test',
                    value: 'to add'
                }
            ]
        ));

        it('should fail with array containing AS3 item and patchBody item', () => assertInvalid(
            [
                {
                    op: 'add',
                    path: '/some/test',
                    value: 'to add'
                },
                {
                    class: 'AS3',
                    action: 'retrieve'
                }
            ]
        ));
    });

    describe('.getDefaultAjvOptions', () => {
        it('should return a proper default object', () => {
            assert.deepStrictEqual(
                as3Request.getDefaultAjvOptions(),
                {
                    allErrors: false,
                    async: false,
                    jsonPointers: true,
                    useDefaults: true,
                    verbose: true
                }
            );
        });
    });

    describe('.getValidatorError', () => {
        it('should return undefined if there are no errors', () => {
            assert.strictEqual(as3Request.getValidatorError(), undefined);
        });

        it('should return a formatted error message if there was an error', () => {
            as3Request.validator.errors = [];
            as3Request.validator.errors.push({
                data: 'example data',
                dataPath: 'fileName.js (/path/to/fileName.js)',
                message: 'something broke',
                params: {
                    errors: [
                        { keyword: 'thisPropertyFailed', dataPath: '' } // example pulled from ajv docs
                    ]
                }
            });

            assert.strictEqual(
                as3Request.getValidatorError(),
                'Invalid request value \'example data\' (path: fileName.js (/path/to/fileName.js))'
                + ' : something broke {"errors":[{"keyword":"thisPropertyFailed","dataPath":""}]}'
            );
        });
    });

    describe('.setTargetDefaults', () => {
        it('should error if no request object is supplied', () => {
            assert.throws(
                () => As3Request.setTargetDefaults(),
                /Cannot read propert(y 'targetUsername' of undefined|ies of undefined \(reading 'targetUsername'\))/
            );
        });

        it('should set default values', () => Promise.resolve()
            .then(() => As3Request.setTargetDefaults({}))
            .then((request) => assert.deepStrictEqual(
                request,
                {
                    localBigip: true,
                    protocol: 'http',
                    targetHost: 'localhost',
                    targetPassphrase: '',
                    targetPort: 8100,
                    targetTokens: {},
                    targetUsername: '',
                    urlPrefix: 'http://admin:@localhost:8100'
                }
            )));

        it('should parse the targetUsername from the basicAuth value', () => {
            const basicAuth = 'Basic\x20dXNlcgo=';

            return Promise.resolve()
                .then(() => As3Request.setTargetDefaults({}, basicAuth))
                .then((request) => assert.deepStrictEqual(
                    request,
                    {
                        localBigip: true,
                        protocol: 'http',
                        targetHost: 'localhost',
                        targetPassphrase: '',
                        targetPort: 8100,
                        targetTokens: {},
                        targetUsername: 'user',
                        urlPrefix: 'http://admin:@localhost:8100'
                    }
                ));
        });

        it('should return the management port', () => {
            const req = {
                targetHost: 'someWhere.else.COM'
            };

            return Promise.resolve()
                .then(() => As3Request.setTargetDefaults(req))
                .then((request) => assert.deepStrictEqual(
                    request,
                    {
                        basicAuth: 'Basic Og==',
                        localBigip: false,
                        protocol: 'https',
                        targetHost: 'somewhere.else.com',
                        targetPassphrase: '',
                        targetPort: 8443,
                        targetTokens: {},
                        targetUsername: '',
                        urlPrefix: 'https://somewhere.else.com:8443'
                    }
                ));
        });

        it('should set the X-F5-Auth-Token', () => {
            const token = 'validtoken';

            return Promise.resolve()
                .then(() => As3Request.setTargetDefaults({}, undefined, token))
                .then((request) => assert.deepStrictEqual(
                    request,
                    {
                        localBigip: true,
                        protocol: 'http',
                        targetHost: 'localhost',
                        targetPassphrase: '',
                        targetPort: 8100,
                        targetTokens: {
                            'X-F5-Auth-Token': 'validtoken'
                        },
                        targetUsername: '',
                        urlPrefix: 'http://admin:@localhost:8100'
                    }
                ));
        });

        it('should set the targetHost to localHost', () => {
            const req = {
                targetHost: '::1',
                targetPort: 444
            };

            return Promise.resolve()
                .then(() => As3Request.setTargetDefaults(req))
                .then((request) => assert.deepStrictEqual(
                    request,
                    {
                        basicAuth: 'Basic Og==',
                        localBigip: false,
                        protocol: 'https',
                        targetHost: 'localhost',
                        targetPassphrase: '',
                        targetPort: 444,
                        targetTokens: {},
                        targetUsername: '',
                        urlPrefix: 'https://::1:444'
                    }
                ));
        });
    });

    describe('.wrapWithAS3Class', () => {
        it('should error if a request is not provided', () => {
            assert.throws(
                () => as3Request.wrapWithAS3Class(),
                /Cannot read propert(y 'class' of undefined|ies of undefined \(reading 'class'\))/
            );
        });

        it('should return the request object if class is AS3', () => {
            assert.deepStrictEqual(as3Request.wrapWithAS3Class({ class: 'AS3' }), { class: 'AS3' });
        });

        it('should return the default object if class is undefined', () => {
            assert.deepStrictEqual(as3Request.wrapWithAS3Class({}),
                { action: 'deploy', class: 'AS3' });
        });

        it('should return the default object if class is ADC', () => {
            assert.deepStrictEqual(as3Request.wrapWithAS3Class({ class: 'ADC' }),
                { action: 'deploy', class: 'AS3' });
        });

        it('should return the request as formatted', () => {
            const request = {
                foo: 'bar',
                class: 'ADC',
                funky: {
                    monkey: 'chunky'
                }
            };

            assert.deepStrictEqual(as3Request.wrapWithAS3Class(request, 'declare'),
                {
                    action: 'deploy',
                    class: 'AS3',
                    declaration: {
                        foo: 'bar',
                        class: 'ADC',
                        funky: {
                            monkey: 'chunky'
                        }
                    }
                });
        });

        it('should wrap per-app requests', () => {
            const request = {
                app1: {
                    monkey: 'chunky'
                }
            };

            assert.deepStrictEqual(as3Request.wrapWithAS3Class(request, 'declare'),
                {
                    action: 'deploy',
                    class: 'AS3',
                    declaration: {
                        app1: {
                            monkey: 'chunky'
                        }
                    }
                });
        });

        it('should return an array request as a formatted array', () => {
            const request = [
                {
                    foo: 'bar',
                    class: 'ADC',
                    funky: {
                        monkey: 'chunky'
                    }
                },
                {
                    why: 1
                }
            ];

            assert.deepStrictEqual(as3Request.wrapWithAS3Class(request, 'declare'),
                [
                    {
                        action: 'deploy',
                        class: 'AS3',
                        declaration: {
                            foo: 'bar',
                            class: 'ADC',
                            funky: {
                                monkey: 'chunky'
                            }
                        }
                    },
                    {
                        action: 'deploy',
                        class: 'AS3',
                        declaration: {
                            why: 1
                        }
                    }
                ]);
        });

        it('should return an empty array if an empty array is provided', () => {
            assert.deepStrictEqual(as3Request.wrapWithAS3Class([], 'declare'), []);
        });
    });

    describe('.configureOptions', () => {
        it('should error if nothing is sent in', () => {
            assert.throws(
                () => As3Request.configureOptions(),
                /Cannot read propert(y 'basicAuth' of undefined|ies of undefined \(reading 'basicAuth'\))/
            );
        });

        it('should return a single request object with defaults', () => {
            const requestContext = {
                basicAuth: {},
                token: ''
            };
            const tasks = [{}];

            return Promise.resolve()
                .then(() => As3Request.configureOptions(requestContext, tasks))
                .then((results) => assert.deepStrictEqual(
                    results,
                    [
                        {
                            localBigip: true,
                            protocol: 'http',
                            targetHost: 'localhost',
                            targetPassphrase: '',
                            targetPort: 8100,
                            targetTokens: {},
                            targetUsername: '',
                            urlPrefix: 'http://admin:@localhost:8100'
                        }
                    ]
                ));
        });

        it('should return two request objects in an array array with defaults', () => {
            const requestContext = {
                basicAuth: {},
                token: ''
            };
            const tasks = [{}, {}];

            return Promise.resolve()
                .then(() => As3Request.configureOptions(requestContext, tasks))
                .then((results) => assert.deepStrictEqual(
                    results,
                    [
                        {
                            localBigip: true,
                            protocol: 'http',
                            targetHost: 'localhost',
                            targetPassphrase: '',
                            targetPort: 8100,
                            targetTokens: {},
                            targetUsername: '',
                            urlPrefix: 'http://admin:@localhost:8100'
                        },
                        {
                            localBigip: true,
                            protocol: 'http',
                            targetHost: 'localhost',
                            targetPassphrase: '',
                            targetPort: 8100,
                            targetTokens: {},
                            targetUsername: '',
                            urlPrefix: 'http://admin:@localhost:8100'
                        }
                    ]
                ));
        });
    });

    describe('.validateAndWrap', () => {
        it('should error if requestContext is not provided', () => {
            assert.throws(
                () => as3Request.validateAndWrap(undefined, {}),
                /Cannot read propert(y 'body' of undefined|ies of undefined \(reading 'body'\))/
            );
        });

        it('should error if hostContext is not provided', () => {
            const requestContext = {
                body: {},
                pathName: ''
            };
            assert.throws(
                () => as3Request.validateAndWrap(requestContext),
                /Cannot read propert(y 'deviceType' of undefined|ies of undefined \(reading 'deviceType'\))/
            );
        });

        it('should set the error if the validator fails', () => {
            const requestContext = {
                body: [
                    {
                        class: 'AS3',
                        action: 'remove'
                    },
                    {
                        class: 'ADC',
                        id: 'test1111',
                        schemaVersion: '3.10.0'

                    }
                ],
                pathName: ''
            };

            const results = as3Request.validateAndWrap(requestContext, {});
            assert.strictEqual(results.error, 'Invalid request value \'[object Object],[object '
                + 'Object]\' (path: ) : should be object {"type":"object"}');
        });

        it('should error if on a container and the declaration is not correct', () => {
            const requestContext = {
                body: {},
                pathName: 'declare'
            };

            const hostContext = {
                deviceType: constants.DEVICE_TYPES.CONTAINER
            };

            const results = as3Request.validateAndWrap(requestContext, hostContext);
            assert.strictEqual(results.error, 'Requests via containers must be wrapped in an AS3 class with target*** properties');
        });

        it('should return an error value if on a container and the declaration array[0] is not correct', () => {
            const requestContext = {
                body: [
                    {
                        class: 'AS3',
                        missing: 'targetUsername and targetTokens, so this should fail'
                    },
                    {
                        class: 'AS3',
                        targetUsername: 'foo',
                        targetTokens: 'bar tokens'
                    }
                ],
                pathName: 'declare'
            };

            const hostContext = {
                deviceType: constants.DEVICE_TYPES.CONTAINER
            };

            const results = as3Request.validateAndWrap(requestContext, hostContext);
            assert.strictEqual(results.error, 'Requests via containers must be wrapped in an AS3 class with target*** properties');
            assert.deepStrictEqual(results.request, [
                {
                    action: 'deploy',
                    class: 'AS3',
                    historyLimit: 4,
                    logLevel: 'warning',
                    persist: true,
                    redeployAge: 0,
                    redeployUpdateMode: 'original',
                    resourceTimeout: 5,
                    retrieveAge: 0,
                    syncToGroup: '',
                    targetHost: 'localhost',
                    targetPort: 0,
                    targetTimeout: 150,
                    trace: false,
                    missing: 'targetUsername and targetTokens, so this should fail'
                },
                {
                    action: 'deploy',
                    class: 'AS3',
                    historyLimit: 4,
                    logLevel: 'warning',
                    persist: true,
                    redeployAge: 0,
                    redeployUpdateMode: 'original',
                    resourceTimeout: 5,
                    retrieveAge: 0,
                    syncToGroup: '',
                    targetHost: 'localhost',
                    targetPort: 0,
                    targetTimeout: 150,
                    targetUsername: 'foo',
                    targetTokens: 'bar tokens',
                    trace: false
                }
            ]);
        });
    });
});

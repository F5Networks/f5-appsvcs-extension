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

const assert = require('assert');
const RestOperation = require('../../../src/app/restOperation');

describe('restOperation', () => {
    it('should return null for body when method is GET', () => {
        const req = {
            method: 'GET',
            body: {}
        };
        const restOperation = new RestOperation(req);
        assert.strictEqual(restOperation.getBody(), null);
    });

    it('should return the body when method is not GET', () => {
        const req = {
            method: 'POST',
            body: {
                hello: 'world'
            }
        };
        const restOperation = new RestOperation(req);
        assert.deepStrictEqual(restOperation.getBody(), { hello: 'world' });
    });

    it('should lower case method names', () => {
        const req = {
            method: 'GET'
        };
        const restOperation = new RestOperation(req);
        assert.strictEqual(restOperation.method, 'Get');
    });

    it('should return both path and pathname for uri property', () => {
        const req = {
            path: '/hello/world'
        };
        const restOperation = new RestOperation(req);
        assert.strictEqual(restOperation.uri.path, '/hello/world');
        assert.strictEqual(restOperation.uri.pathname, '/hello/world');
    });

    it('should return both path and pathname for getUri method', () => {
        const req = {
            path: '/hello/world'
        };
        const restOperation = new RestOperation(req);
        assert.strictEqual(restOperation.getUri().path, '/hello/world');
        assert.strictEqual(restOperation.getUri().pathname, '/hello/world');
    });

    it('should set response status', () => {
        let statusCode;
        const res = {
            status(code) {
                statusCode = code;
            }
        };
        const restOperation = new RestOperation(null, res);
        restOperation.setStatusCode(200);
        assert.strictEqual(statusCode, 200);
    });

    it('should set response body as json', () => {
        let jsonBody;
        const res = {
            json(body) {
                jsonBody = body;
            }
        };
        const restOperation = new RestOperation(null, res);
        restOperation.setBody({ hello: 'world' });
        assert.deepStrictEqual(jsonBody, { hello: 'world' });
    });
});

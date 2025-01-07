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

class RestOperationMock {
    constructor(onComplete) {
        this.statusCode = null;
        this.body = null;
        this.isComplete = false;
        this.onComplete = onComplete;
        this.uri = {
            pathname: '/shared/appsvcs/declare',
            // this is the full path
            path: '/shared/appsvcs/declare'
        };
        this.method = '';
        this.headers = {};
    }

    setBasicAuthorization(basicAuthorization) {
        this.basicAuthorization = basicAuthorization;
    }

    getBasicAuthorization() {
        return this.basicAuthorization;
    }

    setStatusCode(statusCode) {
        this.statusCode = statusCode;
    }

    getStatusCode() {
        return this.statusCode;
    }

    setBody(body) {
        this.body = body;
    }

    setHeader(name, value) {
        this.headers[name] = value;
    }

    getHeader(name) {
        return this.headers[name];
    }

    getUri() {
        return this.uri;
    }

    setPathName(pathName) {
        this.uri.pathname = pathName;
        if (this.uri.path === '/shared/appsvcs/declare') {
            this.uri.path = pathName;
        }
    }

    setPath(path) {
        this.uri.path = path;
    }

    getBody() {
        return this.body;
    }

    complete() {
        this.isComplete = true;
        if (this.onComplete) {
            this.onComplete();
        }
    }
}

module.exports = RestOperationMock;

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

class RestOperation {
    constructor(req, res) {
        this.req = req;
        this.res = res;
    }

    complete() {}

    getBasicAuthorization() {}

    getBody() {
        if (this.method === 'Get') {
            return null;
        }
        return this.req.body;
    }

    setBody(body) {
        this.res.json(body);
    }

    get method() {
        // Rest framwork uses form like 'Get'
        return this.req.method.charAt(0) + this.req.method.slice(1).toLowerCase();
    }

    setStatusCode(code) {
        this.res.status(code);
    }

    getUri() {
        return {
            path: this.req.path,
            pathname: this.req.path
        };
    }

    get uri() {
        return this.getUri();
    }
}

module.exports = RestOperation;

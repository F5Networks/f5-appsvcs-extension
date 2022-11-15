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

class CheckEnv {
    static validateEnvVars(envVars) {
        assert.ok(Array.isArray(envVars), 'Environment variables must be an array');
        const missingVars = envVars.filter((envVar) => typeof process.env[envVar] === 'undefined');
        assert.strictEqual(missingVars.length, 0, `Missing environment variables: ${missingVars}`);
    }
}

module.exports = CheckEnv;

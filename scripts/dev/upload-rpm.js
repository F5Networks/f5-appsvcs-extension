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

const iappUtil = require('../../src/lib/util/iappUtil');
const Context = require('../../src/lib/context/context');

const target = process.argv[2];
const creds = process.argv[3];
const targetRpm = process.argv[4];

if (typeof target === 'undefined') {
    throw new Error('Target machine is required for upload.');
}
if (typeof creds === 'undefined') {
    throw new Error('Credentials [username:password] for target machine are required for upload.');
}
if (typeof targetRpm === 'undefined') {
    throw new Error('Target RPM is required for upload.');
}

const targetHost = target.split(':')[0];
let targetPort = target.split(':')[1];

if (typeof targetPort === 'undefined') {
    targetPort = 443;
}

const requestContext = {
    basicAuth: `Basic ${Buffer.from(creds).toString('base64')}`
};
const context = Context.build(undefined, requestContext, undefined, [{ protocol: 'https', urlPrefix: 'http://localhost:8100' }]);
context.target = {
    host: targetHost,
    port: targetPort
};
context.control = {
    urlPrefix: `https://${target}`,
    tokens: {}
};

iappUtil.copyToHost(
    context,
    targetRpm,
    (err) => { if (err) { throw err; } }
);

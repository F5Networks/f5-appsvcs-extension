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

const https = require('https');

const postData = {
    id: process.env.CI_PROJECT_ID,
    source_branch: process.env.UPDATE_BRANCH_NAME,
    target_branch: 'develop',
    title: 'AUTOTOOL dependency updates',
    remove_source_branch: true,
    squash: true
};

const url = `https://${process.env.CI_SERVER_HOST}/api/v4/projects/${process.env.CI_PROJECT_ID}/merge_requests`;

const opts = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(postData)),
        'PRIVATE-TOKEN': process.env.AS3_ACCESS_TOKEN.split(':')[1]
    }
};

const req = https.request(url, opts, (res) => {
    let resBody = '';
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers, null, 4)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => { resBody += chunk; });
    res.on('end', () => {
        console.log(`BODY: ${JSON.stringify(JSON.parse(resBody), null, 4)}}`);
    });
});

req.on('error', (e) => { console.error(`problem with request: ${e.message}`); });
req.write(JSON.stringify(postData));
req.end();

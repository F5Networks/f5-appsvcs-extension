/**
 * Copyright 2026 F5, Inc.
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

const http = require('http');
const { exec } = require('child_process');

let maxMem = 0;
let maxCpu = 0;
let pid = 0;

exec('pidof f5-rest-node', (err, stdout) => {
    if (err) {
        console.error(err);
        return;
    }
    pid = parseInt(stdout, 10);

    console.log(`pid == ${pid}`);

    function checkMax() {
        exec(`ps aux | grep ${pid} | grep -v grep | awk -F ' ' '{print $3}'`, (err1, stdout1) => {
            if (err1) {
                console.error(err1);
                return;
            }
            maxCpu = Math.max(maxCpu, stdout1);
        });
        exec(`ps aux --sort -rss | grep ${pid} | grep -v grep | awk -F ' ' '{print $6}'`, (err2, stdout2) => {
            if (err2) {
                console.error(err2);
                return;
            }
            maxMem = Math.max(maxMem, stdout2);
        });
        setTimeout(checkMax, 1000);
    }

    checkMax();

    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify({ cpu: maxCpu, mem: maxMem, pid }));
        maxCpu = 0;
        maxMem = 0;
        res.end();
    }).listen(8080);
});

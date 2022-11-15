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

const util = require('util');
const fs = require('fs');
const { exec } = require('child_process');
const requestUtil = require('../../test/common/requestUtil');

const numPools = parseInt(process.argv[2], 10);

const minRunTimes = 18;
let numCpus = 1;

exec('ssh root@10.238.8.39 "grep processor /proc/cpuinfo | wc -l"', (err, stdout) => {
    if (err) {
        console.error(err);
    }
    numCpus = parseInt(stdout, 10);
});

console.log(numCpus);

let adc = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'basic_ADC_declaration'
};

function deletePost(ten, app, adcCopy, input, callback) {
    const deleteOpts = {
        path: '/mgmt/shared/appsvcs/declare',
        retryCount: 0
    };

    requestUtil.delete(deleteOpts, (error) => {
        if (error) {
            console.error(error);
        }
        console.log('Delete - Complete:');
        const postOpts = Object.assign({ body: adcCopy }, deleteOpts);
        requestUtil.post(postOpts, (error1) => {
            if (error1) {
                console.error(error1);
            }
            console.log('Post - Complete:');
            callback(null, input);
        });
    });
}

function getValues(input, beforeTime, callback) {
    const gatherOpts = Object.assign({ path: '/mgmt/tm/sys/cpu', retryCount: 0 });
    requestUtil.get(gatherOpts, (error, output) => {
        let avgUser = 0;
        const timeSpan = Date.now() - beforeTime;

        if (!error) {
            for (let i = 0; i < numCpus; i += 1) {
                const cpuInfoStr = `https://localhost/mgmt/tm/sys/cpu/0/cpuInfo/${i}`;
                avgUser += parseInt(output.body.entries['https://localhost/mgmt/tm/sys/cpu/0'].nestedStats.entries['https://localhost/mgmt/tm/sys/cpu/0/cpuInfo'].nestedStats.entries[cpuInfoStr].nestedStats.entries.fiveSecAvgUser.value, 10);
            }
        } else {
            console.log(`${JSON.stringify(error.message)} after ${timeSpan} ms`);
        }

        input += `"${avgUser / numCpus}", "${timeSpan}"\n`;
        console.log(input);

        const timeOut = 5000;
        setTimeout(() => { callback(null, input); console.log(`starting after ${timeOut}ms`); }, timeOut);
    });
}

adc = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'basic_ADC_declaration'
};
adc.Tenant0 = {
    class: 'Tenant'
};
adc.Tenant0.App0 = {
    class: 'Application',
    template: 'generic'
};
for (let i = 0; i < numPools; i += 1) {
    // Add a number of pools equal to the submitted argument
    adc.Tenant0.App0[`as3_tokenapp_pool${i}`] = {
        class: 'Pool',
        monitors: [
            'http'
        ],
        members: [
            {
                servicePort: 8082,
                addressDiscovery: 'aws',
                updateInterval: 10,
                tagKey: 'foo',
                tagValue: 'bar',
                addressRealm: 'private',
                region: 'us-west-1',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                credentialUpdate: false
            }
        ]
    };
}

const adcCopy = JSON.stringify(adc);
console.log(adcCopy);

Promise.resolve('"Avg CPU Usage", "Time (ms)"\n')
    .then((input) => util.promisify(deletePost)(0, 0, adcCopy, input))
    .then((input) => {
        let promise = Promise.resolve(input);
        const beforeTime = Date.now();
        for (let i = 0; i < minRunTimes; i += 1) {
            promise = promise.then((results) => util.promisify(getValues)(results, beforeTime));
        }
        return promise;
    })
    .then((input) => {
        console.log(input);
        fs.writeFileSync('time_graphs.csv', input);
        console.log(`Printed out to ${__dirname}/time_graphs.csv`);
    })
    .catch((error) => {
        console.error(error);
    });

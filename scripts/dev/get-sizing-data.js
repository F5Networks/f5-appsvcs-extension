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

const util = require('util');
const fs = require('fs');
const requestUtil = require('../../test/common/requestUtil');

const minNumTenants = 5; // Modify to increase the minimum number of tenants you want to test
const maxNumTenants = parseInt(process.argv[2], 10);
const stepNumTenants = 5; // Modify to increase the size of steps for tenant testing (Must be > 1)

const minNumApps = 100; // Modify to increase the minimum number of apps you want to test
const maxNumApps = parseInt(process.argv[3], 10);
const stepNumApps = 100; // Modify to increase the size of steps for app testing (Must be > 1)

const repeat = 1; // Modify to increase the number of times you want to run this test

let currTen = 1;
let currApp = 1;

let isTenTest = 1;

const oct0 = 10;
const oct1 = 0;
let oct2 = 0;
let oct3 = 0;

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

    let beforeTime = Date.now();
    let afterTime;
    let hasError = 0;
    requestUtil.delete(deleteOpts, (error) => {
        if (error) {
            console.error(error);
            hasError = 1;
        }
        console.log('Delete - Complete:');
        beforeTime = Date.now();
        const postOpts = Object.assign({ body: adcCopy }, deleteOpts);
        requestUtil.post(postOpts, (error1) => {
            if (error1) {
                console.error(error1);
                hasError = 1;
            }
            console.log('Post - Complete:');
            afterTime = Date.now();
            const gatherOpts = Object.assign({ protocol: 'http:', port: 8080 }, postOpts);
            requestUtil.get(gatherOpts, (error2, output) => {
                const timeSpan = afterTime - beforeTime;
                let cpu = 0;
                let mem = 0;
                let timeOut = 50000;
                if (error2) {
                    console.error(`error2\nTime Taken: ${Date.now() - afterTime}`);
                    hasError = 1;
                }
                if (hasError === 0) {
                    cpu = (output.body.cpu === null) ? 0 : output.body.cpu;
                    mem = (output.body.mem === null) ? 0 : output.body.mem;
                    timeOut = 5000;
                }
                input += `"${ten}","${app}","${timeSpan}","${cpu}","${mem}"\n`;
                console.log(`${input}\nTotal time spent: ${timeSpan}ms CPU: ${cpu} MEM: ${mem}\n----------------------`);
                setTimeout(() => { callback(null, input); console.log(`starting after ${timeOut}ms`); }, timeOut);
            });
        });
    });
}

function getNextIP() {
    oct3 += 1;
    if (oct3 === 256) {
        oct2 += 1;
        oct3 = 0;
        if (oct2 === 256) {
            oct2 = 0;
            return;
        }
    }
    const ip = `${oct0}.${oct1}.${oct2}.${oct3}`;
    return ip; // eslint-disable-line consistent-return
}

let promise = Promise.resolve('"Tenants","Apps","Time (ms)","CPU Usage","MEM Usage (KB)"\n');

for (let a = 0; a < repeat; a += 1) { // Repeat this operation an indicated number of times
    for (let b = 0; b < 2; b += 1) { // Do two iterations, one for Tenant and one for App
        // isTenTest indicates if the test is testing the Tenants or the Apps
        const currMinTen = (isTenTest ? minNumTenants : 1);
        const currMaxTen = (isTenTest ? maxNumTenants : 1);
        const currMinApp = (isTenTest ? 1 : minNumApps);
        const currMaxApp = (isTenTest ? 1 : maxNumApps);
        for (currTen = currMinTen; currTen <= currMaxTen; currTen += stepNumTenants) {
            // Iterate through the different numbers of tenants
            adc = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: 'basic_ADC_declaration'
            };
            for (let i = 0; i < currTen; i += 1) {
                // Add a number of tenants up to the current number of tenants
                adc[`Tenant${i}`] = {
                    class: 'Tenant'
                };
                for (currApp = currMinApp; currApp <= currMaxApp; currApp += stepNumApps) {
                    // Iterate through the different numbers of apps
                    // console.log('Tenant'+i);
                    for (let k = 0; k < currApp; k += 1) {
                        // Add a number of apps up to the current number of apps
                        const ip = getNextIP();
                        // console.log('App'+k+' - '+ip);
                        adc[`Tenant${i}`][`App${k}`] = {
                            class: 'Application',
                            template: 'http',
                            serviceMain: {
                                class: 'Service_HTTP',
                                virtualAddresses: [
                                    ip
                                ]
                            },
                            web_pool: {
                                class: 'Pool'
                            }
                        };
                    } // END - for(let k = 0; k < currApp; k++)
                    if (isTenTest === 0) {
                        const adcCopy = JSON.stringify(adc);
                        const ten = 1;
                        const app = currApp;
                        promise = promise
                            .then((input) => util.promisify(deletePost)(ten, app, adcCopy, input))
                            .catch((error) => {
                                console.error(error);
                            });
                        // console.log('-------------------');
                    }
                } // END - for
            } // END - for(let i = 0; i < currTen; i++)
            if (isTenTest === 1) {
                const adcCopy = JSON.stringify(adc);
                const ten = currTen;
                const app = 1;
                promise = promise
                    .then((input) => util.promisify(deletePost)(ten, app, adcCopy, input))
                    .catch((error) => {
                        console.error(error);
                    });
                // console.log('-------------------');
            }
        } // END - for(currTen = curr_min_ten; currTen <= curr_max_ten; currTen += stepNumTenants)
        promise.then((input) => {
            // console.log(input);
            fs.writeFileSync('time_graphs.csv', input);
            // console.log('Printed out to ' + __dirname + '/time_graphs.csv');
        }).catch((error) => {
            console.error(error);
        });
        isTenTest = 0;
    } // END - for(let b = 0; b < 2; b++)
} // END - for(let a = 0; a < repeat; a++)

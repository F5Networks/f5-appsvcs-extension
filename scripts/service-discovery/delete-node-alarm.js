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

/* eslint-disable */
const AWS = require('aws-sdk');
const config = require('./sd-node.json');

// Set region and ascess key
const awsAccessKey = process.env.AWS_SD_KEY_ID;
const awsSecrectAccessKey = process.env.AWS_SD_S_KEY;
const awsRegion = config.awsRegion;

AWS.config.update({
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecrectAccessKey,
    region: awsRegion
});

// Create CloudWatch service object
const cw = new AWS.CloudWatch({ apiVersion: '2010-08-01' });

cw.deleteAlarms({ AlarmNames: ['AS3-Service-Discovery-Test-Server'] }, (err, data) => {
    if (err) {
        console.log('Error', err);
    } else {
        console.log('Success', data);
    }
});

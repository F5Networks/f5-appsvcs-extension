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

/* eslint-disable */
const aws = require('aws-sdk');
const fs = require('fs');
const config = require('./sd-node.json');

const awsAccessKey = process.env.AWS_SD_KEY_ID;
const awsSecrectAccessKey = process.env.AWS_SD_S_KEY;
const awsRegion = config.awsRegion;

aws.config.update({
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecrectAccessKey,
    region: awsRegion
});

const ec2 = new aws.EC2();

fs.readFile('./scripts/service-discovery/sdnode-response.json', 'utf8', (err, data) => {
    if (err) {
        throw err;
    }
    const nodeData = JSON.parse(data);
    const instanceId = nodeData.Reservations[0].Instances[0].InstanceId;
    // Terminate the node base on the iNstance ID
    console.log(instanceId);
    terminateInstance(instanceId);
});

function terminateInstance(instanceId) {
    const params = {
        InstanceIds: [
            instanceId
        ]
    };
    ec2.terminateInstances(params, (err, data) => {
        if (err) {
            console.error(err.toString());
        } else {
            Object.keys(data.TerminatingInstances).forEach((key) => {
                const instance = data.TerminatingInstances[key];
                console.log(`${instance} : Terminated`);
            });
        }
    });
}

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
const fs = require('fs');
const config = require('./sd-node.json');

// Set region
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

function createCloudwatchServiceObject(nodeInstanceId) {
    const params = {
        AlarmName: 'AS3-Service-Discovery-Test-Server',
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        EvaluationPeriods: 1,
        MetricName: 'CPUUtilization',
        Namespace: 'AWS/EC2',
        Period: 7200,
        Statistic: 'Average',
        Threshold: 0,
        ActionsEnabled: false,
        AlarmDescription: 'Alarm when server not use that means CPU exceeds 0% in ',
        Dimensions: [
            {
                Name: 'InstanceId',
                Value: nodeInstanceId
            }
        ],
        Unit: 'Seconds',
        AlarmActions: [
            'arn:aws:swf:us-west-2:089591600128:action/actions/AWS_EC2.InstanceId.Terminate/1.0'
        ]
    };

    cw.putMetricAlarm(params, (err, data) => {
        if (err) {
            console.log('Error', err);
        } else {
            console.log('Success', data);
        }
    });
}

fs.readFile('./scripts/service-discovery/sdnode-response.json', 'utf8', (err, data) => {
    if (err) {
        throw err;
    }
    const nodeData = JSON.parse(data);
    const instanceId = nodeData.Reservations[0].Instances[0].InstanceId;
    // Terminate the node base on the iNstance ID
    console.log(instanceId);
    createCloudwatchServiceObject(instanceId);
});

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

function createInstance(imageId, count, keyPair, instanceType) {
    ec2.runInstances({
        ImageId: imageId,
        MinCount: count,
        MaxCount: count,
        KeyName: keyPair,
        InstanceType: instanceType
    }, (err, data) => {
        if (err) {
            console.error(`${err.toString()}`);
        } else {
            const instanceId = data.Instances[0].InstanceId;
            // Add tags to the instance
            const tagParams = {
                Resources: [instanceId],
                Tags: [
                    {
                        Key: config.awsNodeTagName,
                        Value: config.awsNodeTagValue
                    }
                ]
            };
            const tagPromise = ec2.createTags(tagParams).promise();

            tagPromise.then((dataTag) => {
                console.log(`${dataTag}`);
            }).catch((errMessage) => {
                console.error(`${errMessage}`, `${errMessage.stack}`);
            });
            ec2.describeInstances({ InstanceIds: [instanceId] }, (errNode, dataNode) => {
                if (errNode) console.log(`${errNode}`, `${errNode.stack}`); // an error occurred
                else {
                    console.log(`${dataNode}`);// successful response
                    fs.writeFile('./scripts/service-discovery/sdnode-response.json', JSON.stringify(dataNode), 'utf8', (errWriteOut, dataWriteOut) => {
                        if (errWriteOut) {
                            throw errWriteOut;
                        }
                        if (typeof dataWriteOut !== 'undefined')
                            console.log(`${dataWriteOut}`);
                    });
                }
            });
        }
    });
}

// Create an instance
createInstance(config.awsImage, config.awsNumInstances, config.awsKeyPair, config.awsInstanceType);

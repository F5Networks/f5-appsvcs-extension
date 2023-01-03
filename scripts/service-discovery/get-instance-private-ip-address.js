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
const fs = require('fs');

fs.readFile('./scripts/service-discovery/sdnode-response.json', 'utf8', (err, data) => {
    if (err) {
        throw err;
    }
    const nodeData = JSON.parse(data);
    const privateIpAddress = nodeData.Reservations[0].Instances[0].PrivateIpAddress;
    // Terminate the node base on the iNstance ID
    console.log(privateIpAddress);
});

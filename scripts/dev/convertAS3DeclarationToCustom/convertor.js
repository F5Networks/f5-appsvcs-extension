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

const fs = require('fs');

const keysToReplace = {
    allowVlans: '/Common/internal',
    pool: '/Common/SamplePool',
    persistenceMethods: '/Common/cookie',
    profileMultiplex: '/Common/oneconnect',
    profileOneConnect: '/Common/tcp',
    profileStream: '/Common/tcp',
    profileFastL4: '/Common/fastL4',
    clientTLS: '/Common/clientssl',
    serverTLS: '/Common/serverssl',
    profileHTTP: '/Common/http',
    profileHTTP2: '/Common/http2',
    profileWebAcceleration: '/Common/web-acceleration',
    profileWebSecurity: '/Common/web-security',
    profileWebSockets: '/Common/websockets',
    profileAnalytics: '/Common/analytics',
    profileDNS: '/Common/dns',
    profileFastHTTP: '/Common/fasthttp',
    profileFastHTTP2: '/Common/fasthttp2',
    profileFastTCP: '/Common/fasttcp',
    profileFastUDP: '/Common/fastudp',
    profileFastWeb: '/Common/fastweb',
    profileFastWebAcceleration: '/Common/fastweb-acceleration',
    profileFastWebSecurity: '/Common/fastweb-security',
    profileFastWebSockets: '/Common/fastwebsockets',
    profileFastXML: '/Common/fastxml',
    profileFastXMLAcceleration: '/Common/fastxml-acceleration',
    profileFastXMLSecurity: '/Common/fastxml-security',
    profileFastXMLSockets: '/Common/fastxmlsockets',
    profileFastXMLWeb: '/Common/fastxmlweb',
    profileFastXMLWebAcceleration: '/Common/fastxmlweb-acceleration',
    profileFastXMLWebSecurity: '/Common/fastxmlweb-security',
    profileFastXMLWebSockets: '/Common/fastxmlwebsockets',
    iRule: '/Common/SampleiRule'
};

// Function to recursively search for 'allowVlans' and update 'bigip' key within it
function updateBigipKeyInObject(data) {
    if (Array.isArray(data)) {
        data.forEach((item) => updateBigipKeyInObject(item));
    } else if (data !== null && typeof data === 'object') {
        Object.keys(data).forEach((key) => {
            // For list Objects Type
            if (key in keysToReplace && Array.isArray(data[key])) {
                data[key].forEach((item) => {
                    if (item !== null && typeof item === 'object' && 'bigip' in item) {
                        item.bigip = keysToReplace[key];
                    }
                });
                // For Object Type
            } else if (key in keysToReplace && typeof data[key] === 'object' && 'bigip' in data[key]) {
                data[key].bigip = keysToReplace[key];
            } else {
                updateBigipKeyInObject(data[key]);
            }
        });
    }
}

// Load the JSON data from a file
const filePath = process.argv[2];

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    let jsonData;
    try {
        console.log('Parsing JSON data from file:', filePath);
        jsonData = JSON.parse(data);
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        return;
    }

    // Update the 'bigip' key value
    updateBigipKeyInObject(jsonData);

    // Write the updated data back to the file
    fs.writeFile(`${filePath}.out`, JSON.stringify(jsonData, null, 4), 'utf8', (writeErr) => {
        if (writeErr) {
            console.error('Error writing file:', writeErr);
        } else {
            console.log("The 'bigip' key value has been updated.");
            console.log(`Updated data has been written to ${filePath}.out`);
        }
    });
});

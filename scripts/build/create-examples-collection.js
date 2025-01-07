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

'use strict';

const fs = require('fs');

const ignoreTitle = 'full';
const path1 = 'examples/userguide/';
const path2 = 'examples/declarations/';
const outputFile = 'examples/as3.examples.collection.json';

function loadFile(path, file) {
    try {
        return JSON.parse(fs.readFileSync(`${path}/${file}`));
    } catch (error) {
        console.error(`Problem loading ${file} from ${path}`);
        throw error;
    }
}

const readdir = (path) => fs.readdirSync(path)
    .filter((x) => x.endsWith('.json'))
    .map((file) => ({
        json: loadFile(path, file),
        name: file.split('.')[0]
    }));

// Ignore response examples (title includes 'full')
const allFiles = readdir(path1)
    .concat(readdir(path2))
    .filter((x) => !x.name.includes(ignoreTitle));

const buildCollection = () => {
    const collection = {
        auth: {
            basic: [{
                key: 'password',
                type: 'string',
                value: '{{password}}'
            }, {
                key: 'username',
                type: 'string',
                value: '{{username}}'
            }],
            type: 'basic'
        },
        info: {
            _postman_id: '1',
            name: 'AS3ExampleDeclarations',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: []
    };

    console.log(`Processing ${allFiles.length} files`);
    allFiles.forEach((file) => {
        collection.item.push({
            name: file.name,
            request: {
                body: {
                    mode: 'raw',
                    raw: JSON.stringify(file.json, null, 4) // human-readable format
                },
                description: (file.json.declaration ? file.json.declaration.remark : '') || file.name,
                header: [{
                    key: 'Content-Type',
                    name: 'Content-Type',
                    type: 'text',
                    value: 'application/json'
                }],
                // array: 'PATCH', obj: 'POST'
                method: Array.isArray(file.json) ? 'PATCH' : 'POST',
                url: {
                    host: ['{{host}}'],
                    path: ['mgmt', 'shared', 'appsvcs', 'declare'],
                    protocol: 'https',
                    raw: 'https://{{host}}/mgmt/shared/appsvcs/declare'
                }
            },
            response: []
        });
    });

    fs.writeFileSync(outputFile, JSON.stringify(collection, null, 4));
};

buildCollection();

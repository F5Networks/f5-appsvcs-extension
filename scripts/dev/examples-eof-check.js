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

const fs = require('fs');

fs.readdirSync('../../examples/declarations').forEach((file) => {
    if (file.endsWith('.json')) {
        const fileContents = fs.readFileSync(`../../examples/declarations/${file}`).toString();
        let newLines = 0;
        let spaces = 0;
        let position = fileContents.length - 1;

        while ((fileContents[position] === '\n' || fileContents[position] === ' ') && position !== -1) {
            if (fileContents[position] === '\n') {
                newLines += 1;
            }
            if (fileContents[position] === '\n') {
                spaces += 1;
            }
            position -= 1;
        }

        if (newLines !== 1) {
            console.log(`${file}: EOF new lins = ${newLines}`);
        }
        if (spaces !== 1) {
            console.log(`${file}: EOF spaces = ${spaces}`);
        }
    }
});

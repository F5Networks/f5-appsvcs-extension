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
const path = require('path');

const newmanUtils = require('../../../common/newman');

// Only run the tests in this list and in alwaysRunList
const runList = [
];

// Always run the tests in this list even if not in runList
// Only used if runList is not empty
const alwaysRunList = [
    '_prepare.environment.collection'
];

// Skip these tests
// Only used if runList is empty
const skipList = [
    'resumeSavedDeclaration.collection',
    'mutex.locking.collection'
];

describe('Collections', function () {
    this.timeout('1000s');
    this.slow(180000);

    const testDir = __dirname;
    const testFiles = fs.readdirSync(testDir)
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => `${__dirname}/${fileName}`);

    testFiles.forEach((fileName) => {
        const testName = path.basename(fileName, '.json');
        const collection = JSON.parse(fs.readFileSync(fileName));
        it(testName, function (done) {
            if (runList.length > 0) {
                if (!alwaysRunList.includes(testName) && !runList.includes(testName)) {
                    this.skip();
                }
            } else if (skipList.includes(testName)) {
                this.skip();
            }
            setTimeout(() => {
                const options = {
                    insecure: newmanUtils.DEFAULT_OPTIONS.insecure,
                    delayRequest: newmanUtils.DEFAULT_OPTIONS.delayRequest,
                    timeout: newmanUtils.DEFAULT_OPTIONS.timeout
                };
                newmanUtils.runNewman(collection, options, done);
            }, 2000);
        });
    });
});

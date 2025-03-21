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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;

const {
    TEST_CONFIGS,
    initializeLogDir,
    generateDeclaration,
    clearState,
    postAndTime,
    reportResults
} = require('./performanceCommon');

function testCostOfExistingState(config) {
    const results = [];
    const tests = config.range.map((count) => () => {
        const stateDecl = generateDeclaration(config.name, count);
        const testDecl = generateDeclaration('app-fastl4', 1);
        return Promise.resolve()
            .then(() => clearState())
            .then(() => postAndTime(stateDecl))
            .then(() => postAndTime(testDecl))
            .then((time) => {
                console.log(count, time);
                results.push([count, time]);
            });
    });

    return promiseUtil.series(tests)
        .catch((error) => console.error(error))
        .then(() => reportResults(config, results));
}

describe('Cost of Existing State', function () {
    before('Create log directory', () => initializeLogDir());
    this.timeout(0);

    TEST_CONFIGS.forEach((config) => it(config.name, function () {
        config.suite = 'cost-of-state';
        if (config.skip) this.skip();
        return testCostOfExistingState(config);
    }));
});

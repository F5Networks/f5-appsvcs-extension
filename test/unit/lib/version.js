/**
 * Copyright 2024 F5, Inc.
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

const assert = require('assert');
const packageInfo = require('../../../package.json');
const schema = require('../../../src/schema/latest/adc-schema.json');

function removePatchVersion(versionString) {
    return versionString.replace(/\.[0-9]+$/, '');
}

describe('versions', () => {
    it('should match in package.json and the schema', () => {
        const schemaVersion = removePatchVersion(schema.properties.schemaVersion.anyOf[1].const);
        const packageVersion = removePatchVersion(packageInfo.version.split('-')[0]);
        assert.equal(schemaVersion, packageVersion);
    });
});

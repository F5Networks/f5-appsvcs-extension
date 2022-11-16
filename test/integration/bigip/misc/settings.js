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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('settings (__smoke)', function () {
    this.timeout(GLOBAL_TIMEOUT);

    const settingsPath = '/mgmt/shared/appsvcs/settings';
    function getSettings() {
        return getPath(settingsPath);
    }
    function postSettings(settings) {
        return postDeclaration(
            settings,
            { declarationIndex: 0 },
            '?async=false',
            settingsPath
        );
    }

    const defaults = {
        asyncTaskStorage: 'data-group',
        burstHandlingEnabled: false,
        performanceTracingEnabled: false,
        performanceTracingEndpoint: '',
        serviceDiscoveryEnabled: true
    };
    function resetDefaults() {
        return postSettings({});
    }
    beforeEach(() => resetDefaults());

    it('should be able to go from defaults to non-defaults and back', () => {
        const declaration = {
            asyncTaskStorage: 'memory',
            burstHandlingEnabled: true,
            performanceTracingEnabled: false, // need to leave false because jaeger-client not installed
            performanceTracingEndpoint: 'http://196.168.0.1/api/traces',
            serviceDiscoveryEnabled: false
        };

        function assertResponse(response, values) {
            assert.deepStrictEqual(response, values);
        }

        return Promise.resolve()
            .then(() => getSettings())
            .then((response) => assertResponse(response, defaults))
            .then(() => postSettings(declaration))
            .then((response) => assertResponse(response, declaration))
            .then(() => getSettings())
            .then((response) => assertResponse(response, declaration))
            .then(() => resetDefaults())
            .then((response) => assertResponse(response, defaults))
            .then(() => getSettings())
            .then((response) => assertResponse(response, defaults));
    });

    it('should return an error if a setting outside of the schema is supplied', () => {
        const declaration = { burstHandlingEnabled: false, funky: 'monkey' };

        return Promise.resolve()
            .then(() => postSettings(declaration))
            .then(() => {
                assert.fail('This should have failed');
            })
            .catch((err) => {
                assert.isAbove(
                    err.message.indexOf('"code":422'),
                    -1,
                    'Error code 422 not found, and it should have been'
                );
                assert.isAbove(
                    err.message.indexOf('should NOT have additional properties'),
                    -1,
                    'Error message should have included, "should NOT have additional properties"'
                );
            });
    });
});
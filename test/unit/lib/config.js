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

'use strict';

const sinon = require('sinon');
const atgStorage = require('@f5devcentral/atg-storage');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const Config = require('../../../src/lib/config');

describe('config', () => {
    let localStorageDataGroup;
    beforeEach(() => {
        // Must clear out previous storage or previous testing will persist
        Config.injectSettings();

        // StorageMemory is a localized version of the normal memory
        localStorageDataGroup = new atgStorage.StorageMemory();
    });

    after(() => {
        // Confirm the Config is cleared out for the next unit tests
        Config.injectSettings();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return only default values in storage', () => {
        // funky will not be returned, since not in defaults. Previously run schema, will prevent
        // users from supplying information not in the defaults.
        localStorageDataGroup.setItem('funky', 'monkey');
        localStorageDataGroup.setItem('asyncTaskStorage', 'data-group');
        localStorageDataGroup.setItem('betaOptions', {
            perAppDeploymentAllowed: false
        });
        localStorageDataGroup.setItem('burstHandlingEnabled', false);
        localStorageDataGroup.setItem('performanceTracingEnabled', false);
        localStorageDataGroup.setItem('performanceTracingEndpoint', '');
        localStorageDataGroup.setItem('serviceDiscoveryEnabled', true);
        localStorageDataGroup.setItem('webhook', '');

        return Promise.resolve()
            .then(() => Config.injectSettings(localStorageDataGroup))
            .then(() => assert.becomes(Config.getAllSettings(), {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            }));
    });

    it('should return the updated values', () => {
        localStorageDataGroup.setItem('asyncTaskStorage', 'data-group');
        localStorageDataGroup.setItem('betaOptions', {
            perAppDeploymentAllowed: false
        });
        localStorageDataGroup.setItem('burstHandlingEnabled', false);
        localStorageDataGroup.setItem('performanceTracingEnabled', false);
        localStorageDataGroup.setItem('performanceTracingEndpoint', '');
        localStorageDataGroup.setItem('serviceDiscoveryEnabled', true);
        localStorageDataGroup.setItem('webhook', '');
        const newSettings = {
            asyncTaskStorage: 'memory',
            betaOptions: {
                perAppDeploymentAllowed: false
            },
            burstHandlingEnabled: true,
            performanceTracingEnabled: true,
            performanceTracingEndpoint: 'http://192.168.0.1:14268/api/traces',
            serviceDiscoveryEnabled: false,
            webhook: 'https://www.example.com'
        };

        return Promise.resolve()
            .then(() => Config.injectSettings(localStorageDataGroup))
            .then(() => Config.updateSettings(newSettings))
            .then(() => assert.becomes(Config.getAllSettings(), newSettings));
    });

    it('should load from defaults', () => {
        const storageData = {};
        sinon.stub(atgStorage.StorageDataGroup.prototype, 'hasItem').callsFake(
            (key) => Promise.resolve(typeof storageData[key] !== 'undefined')
        );
        sinon.stub(atgStorage.StorageDataGroup.prototype, 'setItem').callsFake((key, value) => {
            storageData[key] = value;
            return Promise.resolve();
        });
        sinon.stub(atgStorage.StorageDataGroup.prototype, 'persist').returns();
        sinon.stub(atgStorage.StorageDataGroup.prototype, 'getItem').callsFake((key) => Promise.resolve()
            .then(() => storageData[key]));

        return Promise.resolve()
            .then(() => assert.becomes(Config.getAllSettings(), {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            }))
            .then(() => assert.deepStrictEqual(storageData, {
                asyncTaskStorage: 'data-group',
                betaOptions: {
                    perAppDeploymentAllowed: false
                },
                burstHandlingEnabled: false,
                performanceTracingEnabled: false,
                performanceTracingEndpoint: '',
                serviceDiscoveryEnabled: true,
                webhook: ''
            }));
    });

    describe('.clearCache', () => {
        it('should clear storage cache when reloading settings', () => {
            const clearCacheSpy = sinon.spy(atgStorage.StorageMemory.prototype, 'clearCache');
            Config.injectSettings(localStorageDataGroup);
            return Config.reloadSettings()
                .then(() => {
                    assert.ok(clearCacheSpy.calledOnce);
                });
        });

        it('should not throw if there is no storage', () => {
            assert.doesNotThrow(() => Config.reloadSettings());
        });
    });
});

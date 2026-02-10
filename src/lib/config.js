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

const atgStorage = require('@f5devcentral/atg-storage');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;

// Defaults will be placed into the settings object when it's loaded.
// atgStorage is not set on startup, but when it's used the first time.
const defaults = {
    asyncTaskStorage: 'data-group',
    perAppDeploymentAllowed: true,
    burstHandlingEnabled: false,
    performanceTracingEnabled: false,
    performanceTracingEndpoint: '',
    serializeFileUploads: false,
    serviceDiscoveryEnabled: true,
    encodeDeclarationMetadata: false,
    webhook: ''
};

let storage = null;

function loadSettings() {
    // Do NOT load if the storage is already loaded
    if (storage) { return true; }

    storage = new atgStorage.StorageDataGroup('/Common/appsvcs/settings');

    const promises = Object.keys(defaults).map((key) => {
        const value = defaults[key];
        return () => storage.hasItem(key)
            .then((hasItem) => {
                if (hasItem) {
                    return Promise.resolve();
                }
                return storage.setItem(key, value);
            });
    });
    // setItem is not atomic, promises need to be serial
    return promiseUtil.series(promises).then(() => storage.persist());
}

function getSetting(key) {
    return Promise.resolve()
        .then(() => storage.getItem(key));
}

class Settings {
    /**
     * Returns an object with all values that correspond to the defaults object
     *
     * @returns {object} - The keys match with defaults, but the values are based on the settings
     */
    static getAllSettings() {
        return Promise.resolve()
            .then(() => loadSettings())
            .then(() => {
                const promises = Object.keys(defaults).map((key) => getSetting(key));

                return Promise.all(promises)
                    .then((results) => {
                        const current = JSON.parse(JSON.stringify(defaults));

                        Object.keys(current).forEach((key, index) => {
                            current[key] = results[index];
                        });

                        return current;
                    });
            });
    }

    /**
     * Takes in a JSON object and saves the key:value pairs out to a datagroup.
     *
     * @param {object} newSettings - REQUIRED: The settings you want to modify and their values
     */
    static updateSettings(newSettings) {
        return Promise.resolve()
            .then(() => loadSettings())
            .then(() => {
                const updates = Object.keys(newSettings).map((key) => {
                    const value = newSettings[key];
                    return () => storage.setItem(key, value);
                });

                // setItem is not atomic, updates need to be serial
                return promiseUtil.series(updates).then(() => storage.persist());
            });
    }

    static reloadSettings() {
        if (storage) {
            return storage.clearCache();
        }
        return Promise.resolve();
    }

    /**
     * This method is exclusively for unit testing, so that we can supply our own storage values
     *
     * @param {object} newStorage - A prebuilt StorageDataGroup with defaults. This prevents the
     *   need for a BIG-IP to be present during testing.
     */
    static injectSettings(newStorage) {
        storage = newStorage;
    }
}

module.exports = Settings;

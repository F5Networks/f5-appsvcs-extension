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

const DEVICE_TYPES = {
    BIG_IP: 'BIG-IP',
    BIG_IQ: 'BIG-IQ',
    CONTAINER: 'Container'
};

const BUILD_TYPES = {
    CLOUD: 'cloud'
};

const EVENTS = {
    APM_PROFILE_UPDATED: 'APM_PROFILE_UPDATED',
    PROFILE_REFERENCED: 'PROFILE_REFERENCED'
};

module.exports = {
    DEVICE_TYPES,
    BUILD_TYPES,
    EVENTS,
    MAX_PATH_LENGTH: 195,
    reqSchemaFile: '/var/config/rest/iapps/f5-appsvcs/schema/latest/as3-request-schema.json',
    settingsSchemaFile: '/var/config/rest/iapps/f5-appsvcs/schema/latest/settings-schema.json',
    adcSchemaId: 'urn:uuid:f83d84a1-b27b-441a-ae32-314b3de3315a',
    tmosVersion: '0.0.0',
    cloudLibsBaseDir: '/config/cloud/as3',
    cloudLibsLogFolder: '/var/log/cloudlibs',
    cloudLibsSignalFolder: '/tmp/f5-cloud-libs-signals',
    mutexTimeoutMinutes: 2, // must be greater than .5
    as3ManagedDescription: 'This object is managed by appsvcs, do not modify this description',
    as3CommonFolder: 'appsvcs',
    // Topology records don't have separate partition, a containing parent object or key name
    // Unlike other modules/components
    gtmTopologyMockPath: 'topology/records',
    gtmSettingsMockPath: '/Common/global-settings',
    defaultHost: 'localhost',
    defaultPort: 8100,
    externalMonitorFile: 'mExternalMonitor',
    encryptedDeclLocation: '/var/config/rest/iapps/f5-appsvcs/encryptedDeclaration',
    encryptedDeclCounter: '/var/config/rest/iapps/f5-appsvcs/declRetryAttempts'
};

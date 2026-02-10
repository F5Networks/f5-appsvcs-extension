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

const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    MULTI_STATUS: 207,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE_ERROR: 503,
    GATEWAY_TIMEOUT: 504
};

const SCHEMA_ID = {
    AS3: 'urn:uuid:85626792-9ee7-46bb-8fc8-4ba708cfdc1d',
    ADC: 'urn:uuid:f83d84a1-b27b-441a-ae32-314b3de3315a',
    APP: 'urn:uuid:f23d7326-d355-4168-8772-c1ca4978acea'
};

module.exports = {
    DEVICE_TYPES,
    BUILD_TYPES,
    EVENTS,
    STATUS_CODES,
    SCHEMA_ID,
    MAX_PATH_LENGTH: 195,
    settingsSchemaFile: '/var/config/rest/iapps/f5-appsvcs/schema/latest/settings-schema.json',
    tmosVersion: '0.0.0',
    cloudLibsBaseDir: '/config/cloud/as3',
    cloudLibsLogFolder: '/var/log/cloudlibs',
    cloudLibsSignalFolder: '/tmp/f5-cloud-libs-signals',
    mutexTimeoutMinutes: 2, // must be greater than .5
    as3ManagedDescription: 'This object is managed by appsvcs, do not modify this description',
    as3CommonFolder: 'appsvcs',
    // Topology records don't have separate partition, a containing parent object or key name
    // Unlike other modules/components
    gtmTopologyMockPath: '/Common/topology/records',
    gtmSettingsMockPath: '/Common/global-settings',
    defaultHost: 'localhost',
    defaultPort: 8100,
    externalMonitorFile: 'mExternalMonitor',
    encryptedDeclLocation: '/var/config/rest/iapps/f5-appsvcs/encryptedDeclaration',
    encryptedDeclCounter: '/var/config/rest/iapps/f5-appsvcs/declRetryAttempts',
    redirectSuffix: '-Redirect-',
    cipherSupport_17_5_1: ['X25519MLKEM768', 'X25519KYBER768']
};

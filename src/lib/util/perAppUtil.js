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

const uuid = require('uuid');

/**
 * Takes a per-app declaration from requestContext and returns a per-tenant conversion
 * Eng Note: This was specifically written to run BEFORE as3request.validateAndWrap()
 *
 * @param {object} perAppDeclaration - Per-app declaration to be converted
 * @param {object} perAppInfo - Per-app info for use in the conversion
 * @returns {object}
 */
const convertToPerTenant = (perAppDeclaration, perAppInfo) => {
    if (!perAppInfo || !perAppDeclaration) {
        // perAppInfo and perAppDeclaration are required
        return perAppDeclaration || {};
    }

    if (perAppDeclaration.class === 'ADC' || typeof perAppDeclaration[perAppInfo.tenant] !== 'undefined') {
        // perAppDeclaration is likely already converted to perTenant
        return perAppDeclaration;
    }

    const perTenantDecl = {
        class: 'ADC',
        schemaVersion: '3.0.0',
        id: `autogen_${uuid.v4()}`
    };

    perTenantDecl[perAppInfo.tenant] = {
        class: 'Tenant'
    };

    perAppInfo.apps.forEach((app) => {
        perTenantDecl[perAppInfo.tenant][app] = perAppDeclaration[app];
    });

    return perTenantDecl;
};

/**
 * Takes a per-tenant declaration from requestContext and returns a per-app conversion
 * Eng Note: This was specifically written to run BEFORE restOperation.complete()
 *
 * @param {object} perTenDeclaration - Per-tenant declaration to be converted
 * @param {object} perAppInfo - Per-app info for use in the conversion
 * @returns {object}
 */
const convertToPerApp = (perTenDeclaration, perAppInfo) => {
    if (!perAppInfo || !perTenDeclaration) {
        // perAppInfo and perTenDeclaration are required
        return perTenDeclaration || {};
    }

    // Due to the timing of these function calls, it is possible the declaration is
    // actually an error message. In which case, just return it.
    if (perTenDeclaration.message || perTenDeclaration.code) {
        return perTenDeclaration;
    }

    if (typeof perTenDeclaration[perAppInfo.tenant] === 'undefined') {
        // if the tenant is already missing from the declaration it is likely already per-app return
        return perTenDeclaration;
    }

    const perAppDecl = {};
    perAppInfo.apps.forEach((app) => {
        perAppDecl[app] = perTenDeclaration[perAppInfo.tenant][app];
    });

    return perAppDecl;
};

const isPerAppPath = (path) => {
    if (!path) { return false; } // No path provided

    const splitPath = path.split('/');
    if (splitPath.length < 6 || splitPath.length > 7) { return false; } // Path too short/long for per-app
    if (splitPath[5].indexOf('applications') === -1) { return false; } // Path missing key value
    if (splitPath[4].indexOf(',') > -1) { return false; } // Tenants cannot be list
    if (splitPath.length === 7 && splitPath[6].indexOf(',') > -1) { return false; } // Apps cannot be list

    return true;
};

module.exports = {
    convertToPerApp,
    convertToPerTenant,
    isPerAppPath
};

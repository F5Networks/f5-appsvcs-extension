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
const util = require('./util');
const STATUS_CODES = require('../constants').STATUS_CODES;

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

    // Copy in controls if they are there
    const controlsName = util.getObjectNameWithClassName(perAppDeclaration, 'Controls') || 'controls';
    if (perAppDeclaration[controlsName]) {
        perTenantDecl[perAppInfo.tenant][controlsName] = util.simpleCopy(perAppDeclaration[controlsName]);
    }

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
    if (perAppInfo.apps.length === 0) {
        // If the apps array is empty, we want all apps in tenant
        Object.keys(perTenDeclaration[perAppInfo.tenant]).forEach((app) => {
            if (perTenDeclaration[perAppInfo.tenant][app].class === 'Application') {
                perAppDecl[app] = perTenDeclaration[perAppInfo.tenant][app];
            }
        });
    } else {
        perAppInfo.apps.forEach((app) => {
            perAppDecl[app] = perTenDeclaration[perAppInfo.tenant][app];
        });
    }

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

/**
 * Takes a per-tenant declaration and merges any additional tenant data from the previously saved declaration.
 * Objects in the per-tenant declaration will take precedence and overwrite matching objects in the
 * previously saved declaration. Only applications that are in the perTenantDeclaration will be merged, as
 * well as 'Shared' if it is needed.
 *
 * @param {object} perTenantDeclaration - Per-tenant declaration to have data merged into
 * @param {object} prevDeclaration - Previously saved declaration to have data merged from
 * @param {object} tenantName - Tenant name for use in the merging process
 * @returns {object} Updated per-tenant declaration that includes merged tenant data
 */
const mergePreviousTenant = (perTenantDeclaration, prevDeclaration, tenantName) => {
    if ((perTenantDeclaration || {}).class !== 'ADC') {
        throw new Error('Declaration must already be converted to per-tenant ADC class');
    }

    if ((prevDeclaration || {}).class !== 'ADC') {
        throw new Error('Saved declaration must be ADC class to merge into per-tenant declaration');
    }

    const sourceTenant = (prevDeclaration[tenantName] || {});
    const targetTenant = perTenantDeclaration[tenantName];

    perTenantDeclaration[tenantName] = Object.assign({}, sourceTenant, targetTenant);

    return perTenantDeclaration;
};

/**
 * Takes a per-tenant declaration and checks for specified per-app resources.
 *
 * @param {object} perTenantDeclaration - Per-tenant declaration to search for resources in
 * @param {object} perAppInfo - Per-app info that includes requested resources
 * @returns {object} StatusCode and optional message response
 */
const verifyResourcesExist = (perTenantDeclaration, perAppInfo) => {
    if (typeof perTenantDeclaration[perAppInfo.tenant] === 'undefined') {
        return {
            statusCode: STATUS_CODES.NOT_FOUND,
            message: (`specified tenant '${perAppInfo.tenant}' not found in declaration`)
        };
    }

    // Only 1 error message can be returned at a time, so return the first
    const missingApp = perAppInfo.apps.find((app) => typeof perTenantDeclaration[perAppInfo.tenant][app] === 'undefined');
    if (missingApp) {
        return {
            statusCode: STATUS_CODES.NOT_FOUND,
            message: (`specified Application '${missingApp}' not found in '${perAppInfo.tenant}'`)
        };
    }

    return {
        statusCode: STATUS_CODES.OK
    }; // success
};

const deleteAppsFromTenant = (perTenantDeclaration, perAppInfo) => {
    if ((perTenantDeclaration || {}).class !== 'ADC') {
        throw new Error('Declaration must already be converted to per-tenant ADC class');
    }

    // Note: by design, only 1 application should be deleted at a time
    // a DELETE to the applications endpoint should fail
    if (perAppInfo && perAppInfo.apps && perAppInfo.apps.length === 1 && perTenantDeclaration[perAppInfo.tenant]) {
        delete perTenantDeclaration[perAppInfo.tenant][perAppInfo.apps[0]];
    }
};

module.exports = {
    convertToPerApp,
    convertToPerTenant,
    isPerAppPath,
    mergePreviousTenant,
    verifyResourcesExist,
    deleteAppsFromTenant
};

/**
 * Copyright 2023 F5, Inc.
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

const util = require('./util/util');
const declarationUtil = require('./util/declarationUtil');
const constants = require('./constants');

class postValidator {
    static validate(context, declaration) {
        if (!context) {
            return Promise.reject(new Error('The context is required.'));
        }

        if (!context.target) {
            return Promise.reject(new Error('The context requires a constructed targetContext.'));
        }

        if (declaration === undefined) {
            return Promise.reject(new Error('The declaration is required.'));
        }

        const promise = Promise.resolve()
            .then(() => validatePathLengths(declaration));

        if (context.target.deviceType !== 'BIG-IQ') {
            return promise.then(() => tcpProfile(context, declaration))
                .then(() => sslProfile(context, declaration))
                .then(() => protocolInspectionProfile(context, declaration))
                .then(() => service(context, declaration));
        }

        return promise;
    }
}

function protocolInspectionProfile(context, declaration) {
    const profiles = findItems(declaration, 'Protocol_Inspection_Profile');
    let err;

    const isVersionTooLow = function (profile, version, property) {
        return util.versionLessThan(context.target.tmosVersion, version)
            && (profile[property] || property === undefined);
    };

    // Check Profiles with 'auto-add-new-inspections' property
    if (profiles.some((profile) => isVersionTooLow(profile, '14.0', 'autoAddNewInspections'))) {
        err = new Error('Auto Add New Inspections property is only available on TMOS 14.0+');
    }

    // Check Profiles with 'auto-publish-suggestion' property
    if (profiles.some((profile) => isVersionTooLow(profile, '14.0', 'autoPublish'))) {
        err = new Error('Auto Publish property is only available on TMOS 14.0+');
    }

    if (err) {
        err.statusCode = 422;
        return Promise.reject(err);
    }
    return Promise.resolve();
}

function tcpProfile(context, declaration) {
    const isVersionTooLow = function (profile) {
        return profile.congestionControl === 'bbr'
            && util.versionLessThan(context.target.tmosVersion, '14.1');
    };

    if (findItems(declaration, 'TCP_Profile').some(isVersionTooLow)) {
        const err = new Error('BBR Congestion Control is only available on TMOS 14.1+');
        err.statusCode = 422;
        return Promise.reject(err);
    }

    return Promise.resolve();
}

function sslProfile(context, declaration) {
    const isVersionTooLow = function (profile) {
        return profile.tls1_3Enabled && util.versionLessThan(context.target.tmosVersion, '14.0');
    };
    const sslProfileClasses = ['TLS_Server', 'TLS_Client'];
    let err;
    sslProfileClasses.forEach((profileClass) => {
        if (findItems(declaration, profileClass).some(isVersionTooLow)) {
            err = new Error('TLS 1.3 ciphers are only available on TMOS 14.0+');
            err.statusCode = 422;
        }
    });

    if (err) {
        return Promise.reject(err);
    }
    return Promise.resolve();
}

function service(context, declaration) {
    const isVersionTooLow = function (item) {
        return item.profileBotDefense && util.versionLessThan(context.target.tmosVersion, '14.1');
    };

    const serviceClasses = ['Service_HTTP', 'Service_HTTPS'];
    let err;
    serviceClasses.forEach((serviceClass) => {
        if (findItems(declaration, serviceClass).some(isVersionTooLow)) {
            err = new Error('profileBotDefense is only available on TMOS 14.1+');
            err.statusCode = 422;
        }
    });

    if (err) {
        return Promise.reject(err);
    }
    return Promise.resolve();
}

function findItems(declaration, itemName) {
    const items = [];
    const decKeys = Object.keys(declaration);
    decKeys.forEach((decKey) => {
        const tenant = declaration[decKey];
        if (declarationUtil.isTenant(tenant)) {
            Object.keys(tenant).forEach((tenKey) => {
                const application = tenant[tenKey];
                if (declarationUtil.isApplication(application)) {
                    Object.keys(application).forEach((appKey) => {
                        const item = application[appKey];
                        if (typeof item === 'object' && item.class === itemName) {
                            items.push(item);
                        }
                    });
                }
            });
        }
    });
    return items;
}

function validatePathLengths(declaration) {
    let err;
    const decKeys = Object.keys(declaration);
    decKeys.forEach((decKey) => {
        const tenant = declaration[decKey];
        if (declarationUtil.isTenant(tenant)) {
            const tenantName = decKey;
            Object.keys(tenant).forEach((tenKey) => {
                const application = tenant[tenKey];
                if (declarationUtil.isApplication(application)) {
                    const applicationName = tenKey;
                    Object.keys(application).forEach((appKey) => {
                        const possibleClass = application[appKey];
                        if (typeof possibleClass === 'object' && possibleClass.class) {
                            const itemName = appKey;
                            const fullPath = `/${tenantName}/${applicationName}/${itemName}`;
                            if (fullPath.length > constants.MAX_PATH_LENGTH) {
                                err = new Error(`Path ${fullPath} is longer than ${constants.MAX_PATH_LENGTH} characters`);
                                err.statusCode = 422;
                            }
                        }
                    });
                }
            });
        }
    });

    if (err) {
        return Promise.reject(err);
    }
    return Promise.resolve();
}

module.exports = postValidator;

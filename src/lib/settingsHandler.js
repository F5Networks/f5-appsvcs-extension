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

/* jshint ignore: start */

'use strict';

const Ajv = require('ajv');
const fs = require('fs');

const log = require('./log');
const restUtil = require('./util/restUtil');
const Config = require('./config');
const constants = require('./constants');
const util = require('./util/util');

class SettingsHandler {
    static process(context, restOperation, schemaPath) {
        return Promise.resolve()
            .then(() => {
                let result;
                switch (restOperation.method) {
                case 'Post':
                    onPost(context, restOperation, schemaPath);
                    break;
                case 'Get':
                    onGet(restOperation);
                    break;
                default:
                    result = restUtil.buildOpResult(
                        constants.STATUS_CODES.METHOD_NOT_ALLOWED,
                        `${restOperation.getUri().href}: Only acceptable methods are Post and Get`
                    );
                    restUtil.completeRequest(restOperation, result);
                    break;
                }
                return Promise.resolve();
            })
            .catch((err) => {
                log.error(`Unable to complete AS3 settings request:\n${err}`);
                const status = err.status || constants.STATUS_CODES.INTERNAL_SERVER_ERROR;
                const result = restUtil.buildOpResult(
                    status,
                    'Settings request failed',
                    {
                        code: status,
                        message: err.message
                    }
                );
                restUtil.completeRequest(restOperation, result);
            });
    }
}

/**
 * onPost will always result in a code in response.body.
 *
 * @param {object} restOp - This is the REST Operation sent to the system.
 * @param {string} schemaPath - This is the path to the schema, used in testing
 */
function onPost(context, restOp, schemaPath) {
    const ajvErrors = validateAgainstSchema(restOp, schemaPath);
    if (ajvErrors) {
        const result = restUtil.buildOpResult(
            constants.STATUS_CODES.UNPROCESSABLE_ENTITY,
            'Failed to overwrite settings',
            {
                code: constants.STATUS_CODES.UNPROCESSABLE_ENTITY,
                message: 'declaration is invalid',
                errors: ajvErrors
            }
        );
        restUtil.completeRequest(restOp, result);
        return Promise.resolve();
    }

    return Promise.resolve()
        .then(() => validateSettings(restOp.body, context))
        .then(() => Config.updateSettings(restOp.body))
        .then(() => Config.getAllSettings())
        .then((updatedSettings) => {
            updatedSettings.code = constants.STATUS_CODES.OK;
            const result = restUtil.buildOpResult(
                constants.STATUS_CODES.OK,
                'overwriting settings',
                updatedSettings
            );
            restUtil.completeRequest(restOp, result);
        })
        .catch((err) => {
            log.error(`Unable to update AS3 settings due to:\n${err}`);
            const status = err.status || constants.STATUS_CODES.INTERNAL_SERVER_ERROR;
            const result = restUtil.buildOpResult(
                status,
                'Failed to overwrite settings',
                {
                    code: status,
                    message: err.message
                }
            );
            restUtil.completeRequest(restOp, result);
        });
}

function validateAgainstSchema(restOp, schemaPath) {
    const ajv = new Ajv({
        allErrors: false, async: false, useDefaults: true, verbose: true
    });
    const path = schemaPath || constants.settingsSchemaFile;
    const validate = ajv.compile(JSON.parse(fs.readFileSync(path, 'utf8')));
    validate(restOp.body);

    return validate.errors;
}

function validateSettings(settings, context) {
    return Promise.resolve()
        .then(() => {
            if (settings.serviceDiscoveryEnabled === false) {
                return canDisableServiceDiscovery(context);
            }
            return Promise.resolve();
        })
        .then(() => {
            if (settings.performanceTracingEnabled === true) {
                return canPerformanceTracingBeEnabled();
            }
            return Promise.resolve();
        });
}

function onGet(restOp) {
    return Promise.resolve()
        .then(() => Config.getAllSettings())
        .then((settings) => {
            const result = restUtil.buildOpResult(
                constants.STATUS_CODES.OK,
                'retrieving settings',
                settings
            );
            restUtil.completeRequest(restOp, result);
        })
        .catch((err) => {
            log.error(`Unable to retrieve AS3 settings due to error:\n${err}`);
            const result = restUtil.buildOpResult(
                constants.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Failed to retrieve settings',
                {
                    code: constants.STATUS_CODES.INTERNAL_SERVER_ERROR,
                    message: err.message
                }
            );
            restUtil.completeRequest(restOp, result);
        });
}

/**
 * Verifies that service discovery can be disabled
 *
 * @param {object} context - full AS3 context object
 * @returns {Promise} Returns promise that resolves if service discovery can be disabled
 */
function canDisableServiceDiscovery(context) {
    // Resolve if service discovery is not installed
    if (!context.host.sdInstalled) {
        return Promise.resolve();
    }

    const options = {
        why: 'getting Service Discovery tasks',
        path: '/mgmt/shared/service-discovery/task'
    };
    return util.iControlRequest(context, options)
        .then((result) => {
            if (result.items.length > 0) {
                const error = new Error('Service Discovery cannot be disabled while there are existing tasks');
                error.status = constants.STATUS_CODES.UNPROCESSABLE_ENTITY;
                return Promise.reject(error);
            }
            return Promise.resolve();
        })
        .catch((err) => {
            // Ignore 404 on the task endpoint. Setting can be disabled anyway.
            if (err.code && err.code === 400) {
                if (err.message.indexOf('response=404') !== -1) {
                    return Promise.resolve();
                }
            }
            return Promise.reject(err);
        });
}

/**
 * Verifies that performance tracing can be enabled
 *
 * @returns {Promise} Returns promise that resolves if performance tracing can be enabled
 */
function canPerformanceTracingBeEnabled() {
    return new Promise((resolve, reject) => {
        fs.stat('/var/config/rest/iapps/f5-appsvcs/node_modules/jaeger-client/', (err, stats) => {
            if (err || !stats.isDirectory()) {
                const error = new Error('Performance tracing cannot be enabled unless the jaeger client is installed');
                error.status = constants.STATUS_CODES.UNPROCESSABLE_ENTITY;
                reject(error);
            }
            resolve();
        });
    });
}

module.exports = SettingsHandler;

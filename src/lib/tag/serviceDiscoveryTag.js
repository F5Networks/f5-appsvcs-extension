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

const AJV = require('ajv');

const Config = require('../config');
const util = require('../util/util');

const TAG = 'serviceDiscovery';

/**
 * Process Service Discovery data that was tagged by the f5PostProcess keyword during AJV validation.
 * Verifies that Service Discovery is enabled when related data is provided in a declaration.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [serviceDiscoveryList] - The list of service discovery data that will be processed
 * @param {*} serviceDiscoveryArray[].data - The service discovery data from the declaration
 * @param {*} serviceDiscoveryArray[].schemaData - The service discovery schema data from the declaration
 * @param {string} serviceDiscoveryArray[].instancePath - The json pointer that was used to fetch the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, serviceDiscoveryList) {
    if (util.isEmptyOrUndefined(serviceDiscoveryList)) {
        return Promise.resolve();
    }

    return Promise.resolve()
        .then(() => Config.getAllSettings())
        .then((settings) => Promise.all(serviceDiscoveryList.map((sd) => verifyService(context, settings, sd))))
        .then(() => Promise.resolve()); // Must resolve undefined
}

function validateService(schema) {
    // validate service discovery schema
    switch (typeof schema) {
    case 'undefined':
        break;
    case 'object': {
        const allowedKeys = ['exceptions'];
        Object.keys(schema).forEach((key) => {
            if (allowedKeys.indexOf(key) === -1) {
                throw new Error(`f5PostProcess(serviceDiscovery) schema property "${key}" not allowed`);
            }
            const val = schema[key];
            if (typeof val !== 'object' || !Array.isArray(val)) {
                throw new Error(`f5PostProcess(serviceDiscovery) schema property "${key}" must have array value`);
            }
        });
        break;
    }
    default:
        throw new Error('f5PostProcess(serviceDiscovery) schema must be undefined or an object');
    }
}

function verifyService(context, settings, sd) {
    const data = sd.data;
    const schema = sd.schemaData;
    const dataPath = sd.instancePath;
    const myerror = {
        dataPath,
        keyword: 'f5PostProcess(serviceDiscovery)',
        params: {},
        message: ''
    };

    validateService(schema);

    if (schema && schema.exceptions && schema.exceptions.find((exception) => exception === data)) {
        return Promise.resolve();
    }

    if (settings && settings.serviceDiscoveryEnabled === false) {
        myerror.message = 'requires Service Discovery to be enabled';
        return Promise.reject(new AJV.ValidationError([myerror]));
    }

    /*
        * Error if SD is not installed and target host is the local machine. This
        * protects against the case when a user enables SD in the settings, but has
        * not restarted restnoded to install it yet. AS3 will automatically install
        * SD on remote machines.
        */
    if (context.host.sdInstalled === false && context.tasks[context.currentIndex].resolvedHostIp === '127.0.0.1') {
        myerror.message = 'requires Service Discovery to be installed. Service Discovery will be installed the next time AS3 starts up';
        return Promise.reject(new AJV.ValidationError([myerror]));
    }

    return Promise.resolve();
}

module.exports = {
    process,
    TAG
};

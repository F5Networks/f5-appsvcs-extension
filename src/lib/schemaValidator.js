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
const log = require('./log');
const parserFormats = require('./adcParserFormats');
const parserKeywords = require('./adcParserKeywords');
const DEVICE_TYPES = require('./constants').DEVICE_TYPES;
const util = require('./util/util');

class SchemaValidator {
    /**
     * Constructs a new SchemaValidator instance
     * @param {DEVICE_TYPES} deviceType - Type of device that the AS3 instance is running on
     * @param {Object[]} [schemaConfigs] - Overrides default array of schema config objects
     * @param {string[]} [schemaConfigs[].paths] - File paths to the target schemas
     * @param {Object} [schemaConfigs[].options] - Custom AJV options. Overrides default schemaValidator and AJV options
     * @returns {SchemaValidator}
     */
    constructor(deviceType, schemaConfigs) {
        this._deviceType = deviceType;
        this._schemaConfigs = schemaConfigs || SchemaValidator.getDefaultSchemaConfigs(deviceType);
        this._schemas = {};
        this._validators = {};
        this._postProcess = [];
    }

    /**
     * Inits the validation functions
     * @returns {Promise} Resolves once initialization is complete
     */
    init() {
        return Promise.resolve()
            .then(() => _loadSchemas.call(this))
            .then(() => _compileSchemas.call(this));
    }

    /**
     * Provides the device type that determines the default schema compilation options
     * @returns {DEVICE_TYPES} Device type string
     */
    getDeviceType() {
        return this._deviceType;
    }

    /**
     * Provides the loaded schemas that are used for validating
     * @returns {Objects[]} List of loaded schemas
     */
    getSchemas() {
        return Object.keys(this._schemas).map((key) => this._schemas[key]);
    }

    /**
     * Provides the loaded schema IDs that are used for validating
     * @returns {string[]} List of loaded schema IDs
     */
    getSchemaIds() {
        return Object.keys(this._schemas).map((key) => this._schemas[key].$id);
    }

    /**
     * Validates the provided declaration
     * @param {SCHEMA_ID|string} id - ID of target schema to use for validation
     * @param {Object|Object[]} - Declaration to validate
     * @returns {Object} Object containing validation results, errors, and postProcessing info
     */
    validate(id, declaration) {
        if (!this._validators[id]) {
            throw new Error(`Schema validator ${id} not found`);
        }

        this._postProcess = [];

        const valid = this._validators[id](declaration);
        const errors = valid ? undefined : this._validators[id].errors;

        return {
            valid,
            errors,
            postProcess: util.simpleCopy(this._postProcess)
        };
    }

    /**
     * Provides AJV options that schemaValidator defaults to
     * @returns {Object}
     */
    static getDefaultOptions() {
        return {
            allErrors: false,
            verbose: true,
            jsonPointers: true,
            async: false,
            useDefaults: true
        };
    }

    /**
     * Provides schema configs that schemaValidator defaults to
     * @returns {Object[]}
     */
    static getDefaultSchemaConfigs(deviceType) {
        return [
            {
                paths: ['file:///var/config/rest/iapps/f5-appsvcs/schema/latest/as3-request-schema.json']
            },
            {
                paths: [
                    'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/adc-schema.json',
                    'file:///var/config/rest/iapps/f5-appsvcs/schema/latest/app-schema.json'
                ],
                options: {
                    useDefaults: deviceType !== DEVICE_TYPES.BIG_IQ
                }
            }
        ];
    }
}

/**
 * Loads the necessary schemas from the file system
 * @returns {Promise} Resolves once all schemas are loaded
 */
function _loadSchemas() {
    this._schemas = {};

    const allPaths = this._schemaConfigs.reduce((array, config) => {
        if (!Array.isArray(config.paths) || config.paths.length === 0) {
            throw new Error('schema file paths not defined');
        }
        return array.concat(config.paths);
    }, []);
    const uniquePaths = new Set(allPaths);

    const loadPromises = [];
    uniquePaths.forEach((path) => {
        const promise = util.loadJSON(path, { why: 'load AS3 schema' })
            .then((schema) => {
                if (!Object.prototype.hasOwnProperty.call(schema, '$id')) {
                    throw new Error('AS3 schema must contain an $id property');
                }
                this._schemas[path] = schema;
            })
            .catch((e) => {
                e.message = `loading schema "${path}" failed, error: ${e.message}`;
                log.error(e);
                throw e;
            });
        loadPromises.push(promise);
    });

    return Promise.all(loadPromises);
}

/**
 * Compiles the schemas and saves the validation functions
 */
function _compileSchemas() {
    return Promise.resolve()
        .then(() => {
            this._schemaConfigs.forEach((config) => {
                const ajv = new AJV(Object.assign({}, SchemaValidator.getDefaultOptions(), config.options));

                parserFormats.forEach((format) => ajv.addFormat(format.name, format.check));
                parserKeywords.keywords.forEach((keyword) => ajv.addKeyword(keyword.name, keyword.definition(this)));

                // Add all schemas before compiling with "getSchema" to handle cross-schema refs
                const schemaIds = config.paths.map((path) => {
                    const schema = this._schemas[path];
                    try {
                        ajv.addSchema(schema);
                    } catch (e) {
                        e.message = `compiling schema ${schema.$id} failed, error: ${e.message}`;
                        throw e;
                    }
                    return schema.$id;
                });

                schemaIds.forEach((id) => {
                    try {
                        this._validators[id] = ajv.getSchema(id);
                    } catch (e) {
                        e.message = `compiling schema ${id} failed, error: ${e.message}`;
                        throw e;
                    }
                });
            });
        })
        .catch((e) => {
            if (!e.message.startsWith('compiling schema')) {
                e.message = `compiling schemas failed, error: ${e.message}`;
            }
            log.error(e);
            throw e;
        });
}

module.exports = SchemaValidator;

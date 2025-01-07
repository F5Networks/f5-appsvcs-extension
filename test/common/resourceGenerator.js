/**
 * Copyright 2025 F5, Inc.
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

const fs = require('fs');
const jsf = require('json-schema-faker');
const postRandomize = require('./resourcePostRandomize');
const simpleCopy = require('../../src/lib/util/util').simpleCopy;

jsf.option({
    optionalsProbability: 0.5
});

jsf.format('f5ip', () => jsf.generate({
    type: 'string',
    anyOf: [
        { format: 'ipv4' },
        { format: 'ipv6' }
    ]
}));

function addStringFormat(name, pattern) {
    jsf.format(name, () => jsf.generate({
        type: 'string',
        pattern
    }));
}

addStringFormat('f5bigip', '^\\x2f[^\\x00-\\x20\\x22#\'*<>?\\x5b-\\x5d\\x7b-\\x7d\\x7f]+$');
addStringFormat('f5label', '^[^\\x00-\\x1f\\x22#&*<>?\\x5b-\\x5d`\\x7f]{0,48}$');
addStringFormat('f5name', '^([A-Za-z][0-9A-Za-z_]{0,47})?$');
addStringFormat('f5remark', '^[^\\x00-\\x1f\\x22\\x5c\\x7f]{0,63}$');

jsf.define('const', (value) => value);

let FULL_SCHEMA = null;
function getSchema() {
    if (!FULL_SCHEMA) {
        FULL_SCHEMA = JSON.parse(fs.readFileSync(`${__dirname}/../../src/schema/latest/adc-schema.json`));
    }
    return FULL_SCHEMA;
}

function gatherReferences(schema) {
    const values = [];
    Object.keys(schema.properties).forEach((key) => {
        values.push(schema.properties[key]);
    });
    const references = values
        .filter((prop) => '$ref' in prop)
        .map((prop) => prop.$ref.split('/').pop())
        .reduce(
            (obj, ref) => {
                obj[ref] = getSchema().definitions[ref];
                return obj;
            },
            {}
        );
    return references;
}

function filterNestedSchemas(schema) {
    if (schema.additionalProperties && schema.additionalProperties.$ref.includes('Application')) {
        delete schema.additionalProperties;
    }

    delete schema.properties.Shared;
    delete schema.properties.constants;
    delete schema.properties.controls;

    return schema;
}

function extractSchema(definitionName) {
    const fullSchema = getSchema();
    let subSchema = fullSchema.definitions[definitionName];
    if (!subSchema) {
        throw new Error(`Unable to find a schema for ${definitionName}`);
    }

    subSchema = simpleCopy(fullSchema.definitions[definitionName]);
    subSchema = filterNestedSchemas(subSchema);
    subSchema.definitions = gatherReferences(subSchema);
    subSchema.required.push('class');
    return subSchema;
}

function createResource(name) {
    const schema = extractSchema(name);
    let resource = jsf.generate(schema);
    resource = postRandomize(name, resource);
    return resource;
}

function createDeclaration(id, remark) {
    return {
        class: 'ADC',
        schemaVersion: '3.0.0',
        id,
        remark,
        controls: {
            class: 'Controls',
            trace: true,
            logLevel: 'debug'
        },
        tenant: {
            class: 'Tenant',
            application: {
                class: 'Application',
                template: 'generic',
                serviceMain: {
                    class: 'Service_Core'
                }
            }
        }
    };
}

function createName() {
    return jsf.generate({
        type: 'string',
        pattern: '^[A-Za-z][0-9A-Za-z_]{0,47}$'
    });
}

module.exports = {
    extractSchema,
    createResource,
    createDeclaration,
    createName
};

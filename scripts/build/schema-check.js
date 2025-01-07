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

const errors = [];
const warnings = [];

function checkDefinitions(schema) {
    Object.keys(schema.definitions).forEach((definitionKey) => {
        const definition = schema.definitions[definitionKey];
        checkSchema(definition, definitionKey);
    });
}

function checkProperties(schema, prefix) {
    Object.keys(schema.properties || {})
        .filter((key) => key !== 'class')
        .forEach((propertyKey) => {
            const propSchema = schema.properties[propertyKey];
            checkSchema(propSchema, `${prefix}.${propertyKey}`, true);
        });
}

function checkXOf(schema, prefix) {
    ['oneOf', 'anyOf', 'allOf'].forEach((keyword) => {
        (schema[keyword] || []).forEach((nestedSchema, i) => {
            nestedSchema.description = nestedSchema.description || schema.description;
            checkSchema(nestedSchema, `${prefix}.${keyword}[${i}]`);
        });
    });
}

function checkItems(schema, prefix) {
    if (schema.items) {
        checkSchema(schema.items, prefix);
    }
}

function collapseAllOf(schema) {
    (schema.allOf || []).forEach((subSchema) => Object.assign(schema, subSchema));
    delete schema.allOf;
}

function isClass(schema) {
    return schema.properties && schema.properties.class;
}
function checkSchema(schema, prefix, isProperty) {
    const pref = prefix || '';
    if (schema.$comment && schema.$comment.includes('TODO')) {
        warnings.push(`${pref} ${schema.$comment}`);
    }
    if (schema.$TODO) {
        warnings.push(`${pref} TODO: ${schema.$TODO}`);
    }

    const hasAllOf = typeof schema.allOf !== 'undefined';
    collapseAllOf(schema);

    if (schema.$ref) {
        if (!hasAllOf) {
            const keywords = Object.keys(schema)
                .filter((key) => ['$ref', 'description', 'title', '$comment'].indexOf(key) < 0);
            if (keywords.length) {
                warnings.push(`${pref} mixes keywords with $ref: ${JSON.stringify(keywords)}`);
            }
        }
        return;
    }

    if (schema.type === 'array' && schema.items
        && (schema.items.type === 'object' || schema.items.$ref)
        && schema.uniqueItems
    ) {
        errors.push(`${pref} is an array of objects with uniqueItems set to true, this causes AJV to lock up`);
    }

    if ((isClass(schema) || isProperty) && !schema.description) {
        errors.push(`${pref} is missing a description`);
    }

    if (schema.type === 'array' && !schema.items) {
        errors.push(`${pref} is an array, but has no items keyword`);
    }

    if (schema.items && schema.type !== 'array') {
        errors.push(`${pref} has the items keyword, but is not an array`);
    }

    if (schema.properties && schema.type !== 'object') {
        errors.push(`${pref} has the properties keyword, but is not an object`);
    }

    if (
        schema.properties && schema.properties.class && schema.properties.class.const
        && schema.title !== 'Shared Application'
        // Check if title does not contain class name with either underscore or space
        && !schema.title.match(new RegExp(`${schema.properties.class.const.replace(/_/g, '[_ ]')}`, 'i'))
    ) {
        errors.push(`${pref} does not have a title matching its class property`);
    }

    checkProperties(schema, pref);
    checkXOf(schema, pref);
    checkItems(schema, pref);
}

function runChecks(fileName, callback) {
    console.log(`Checking ${fileName}`);
    checkDefinitions(JSON.parse(fs.readFileSync(fileName)));
    if (errors.length) {
        console.log(`Found ${errors.length} errors:`);
        errors.forEach((error) => console.log(error));
    }
    if (warnings.length) {
        console.log(`Found ${warnings.length} warnings:`);
        warnings.forEach((error) => console.log(error));
    }

    const error = (errors.length) ? new Error('Schema checking failed') : null;
    callback(error);
}

module.exports = {
    runChecks
};

if (require.main === module) {
    const fileName = process.argv[2] || `${__dirname}/../../src/schema/latest/adc-schema.json`;
    runChecks(fileName, (error) => {
        if (error) {
            process.exit(1);
        }
    });
}

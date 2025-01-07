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
const f5AppSvcsSchema = require('@automation-toolchain/f5-appsvcs-schema');

const core = require('../../src/schema/latest/core-schema.json');
const pointerData = require('../../src/schema/latest/pointers.json');

const runChecks = require('./schema-check').runChecks;

const SCHEMA_DIR = `${__dirname}/../../src/schema/latest`;

function buildUseProperty(data) {
    const classes = (Array.isArray(data.class)) ? data.class : [data.class];
    return {
        description: `AS3 pointer to ${data.name} declaration`,
        type: 'string',
        minLength: 1,
        f5PostProcess: {
            tag: 'pointer',
            data: {
                properties: {
                    class: {
                        enum: classes
                    }
                },
                required: ['class']
            }
        }
    };
}

function buildBigipProperty(data) {
    return {
        description: `Pathname of existing BIG-IP ${data.bigipName || data.name}`,
        type: 'string',
        format: 'f5bigip'
    };
}

function readSchema(name) {
    return new Promise((resolve, reject) => {
        fs.readFile(`${SCHEMA_DIR}/${name}`, (error, data) => {
            if (error) reject(error);
            else resolve(data);
        });
    });
}

function writeSchema(name, schema) {
    return new Promise((resolve, reject) => {
        fs.writeFile(`${SCHEMA_DIR}/${name}`, JSON.stringify(schema, null, 2), (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function buildCommonDefinition(data) {
    const properties = {};

    if (data.class) {
        properties.use = buildUseProperty(data);
    }

    if (data.tmshPath) {
        properties.bigip = buildBigipProperty(data);
    }

    const definition = {
        description: `Reference to a ${data.name}`,
        type: 'object',
        properties,
        additionalProperties: false,
        minProperties: 1,
        maxProperties: 1
    };

    if (data.tmshPath) {
        let paths = data.tmshPath;
        if (!Array.isArray(paths)) {
            paths = [paths];
        }
        definition.allOf = definition.allOf || [];
        definition.allOf.push({
            f5PostProcess: {
                tag: 'bigComponent',
                data: paths.map((p) => `query ${p}`)
            }
        });
    }

    return definition;
}

function buildBareDefinition(data) {
    if (data.bareStyle === 'bigip') {
        return buildBigipProperty(data);
    }
    return buildUseProperty(data);
}

function buildDefinition(data) {
    if (data.bareStyle) {
        return {
            oneOf: [
                buildBareDefinition(data),
                buildCommonDefinition(data)
            ]
        };
    }

    return buildCommonDefinition(data);
}

function buildPointers() {
    const definitions = {};
    Object.keys(pointerData).forEach((pointerKey) => {
        const data = pointerData[pointerKey];
        if (data.skip) {
            return;
        }

        const definition = buildDefinition(data);
        definitions[`Pointer_${pointerKey}`] = definition;
    });

    return writeSchema('def-pointers-schema.json', { definitions });
}

function combineDefinitions() {
    const definitions = fs.readdirSync(`${SCHEMA_DIR}/`)
        .filter((name) => name.includes('def-') && !(name.includes('draft')) && name.endsWith('.json'))
        .map((fileName) => `${SCHEMA_DIR}/${fileName}`);

    definitions.forEach((definition) => {
        const contents = JSON.parse(fs.readFileSync(definition, 'utf8'));
        Object.assign(core.definitions, contents.definitions);
    });

    return writeSchema('adc-schema.json', core);
}

function getApplicationClassNames(schema) {
    const skipList = [
        'Tenant',
        'Application',
        'Controls',
        'Constants'
    ];
    const schemaClasses = new Set(Object.keys(schema.definitions)
        .map((key) => schema.definitions[key])
        .filter((def) => def.properties && def.properties.class)
        .map((def) => def.properties.class.const)
        .filter((name) => skipList.indexOf(name) === -1));

    return Array.from(schemaClasses);
}

/**
 * identifies special class cases and returns their expected values
 * @param {string} cls - class name like "iRule"
 */
function checkClass(cls) {
    switch (cls) {
    case 'iRule':
        return 'IRule'; // Shared Schema requires definitions start with capitals
    default:
        return cls;
    }
}

function buildApplicationAdditionalProps() {
    return readSchema('adc-schema.json')
        .then((data) => {
            const schema = JSON.parse(data);
            const classes = getApplicationClassNames(schema);
            schema.definitions.Application.additionalProperties = {
                properties: {
                    class: {
                        type: 'string',
                        enum: classes
                    }
                },
                allOf: classes.map((c) => ({
                    if: { properties: { class: { const: c } } },
                    then: { $ref: `#/definitions/${checkClass(c)}` }
                }))
            };
            return writeSchema('adc-schema.json', schema);
        });
}

function buildToolSchema() {
    let requestSchema = {};
    let adcSchema = {};

    return Promise.resolve()
        .then(() => readSchema('as3-request-schema.json'))
        .then((data) => {
            requestSchema = JSON.parse(data);
        })
        .then(() => readSchema('adc-schema.json'))
        .then((data) => {
            adcSchema = JSON.parse(data);
        })
        .then(() => {
            requestSchema.definitions.ADC = adcSchema;
            Object.assign(requestSchema.definitions, adcSchema.definitions);

            delete adcSchema.definitions;
            delete adcSchema.$schema;
            delete adcSchema.$id;

            return writeSchema('as3-schema.json', requestSchema);
        });
}

function checkAdcSchema() {
    return new Promise((resolve, reject) => {
        runChecks(`${SCHEMA_DIR}/adc-schema.json`, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function buildSharedSchema() {
    const sharedSchema = f5AppSvcsSchema.getSchemaByRuntime('core');
    const supportedClasses = [
        'Analytics_Profile',
        'Analytics_TCP_Profile',
        'Basic_Auth',
        'Basic_Monitor',
        'Bearer_Token',
        'CA_Bundle',
        'Capture_Filter',
        'Certificate',
        'Certificate_Validator_OCSP',
        'Constants',
        'Controls',
        'DNS_Logging_Profile',
        'Enum_Country_Analytics',
        'F5_String',
        'HTTP_Compress',
        'HTTP_Acceleration_Profile',
        'HTTP_Profile',
        'HTTP_Profile_Explicit',
        'HTTP_Profile_Reverse',
        'HTTP_Profile_Transparent',
        'HTTP2_Profile',
        'IRule',
        'IRule_Core',
        'JWE',
        'Log_Destination',
        'Log_Destination_Management_Port',
        'Log_Destination_Remote_Syslog',
        'Log_Destination_Remote_High_Speed_Log',
        'Log_Destination_Splunk',
        'Log_Publisher',
        'L4_Profile',
        'Monitor',
        'Monitor_DNS',
        'Monitor_External',
        'Monitor_FTP',
        'Monitor_HTTP',
        'Monitor_HTTP2',
        'Monitor_HTTPS',
        'Monitor_ICMP',
        'Monitor_Inband',
        'Monitor_LDAP',
        'Monitor_MySQL',
        'Monitor_PostgreSQL',
        'Monitor_RADIUS',
        'Monitor_SIP',
        'Monitor_SMTP',
        'Monitor_TCP',
        'Monitor_TCP_Half_Open',
        'Monitor_UDP',
        'Pointer_BIGIP',
        'Pointer_BIGIP_Or_Use',
        'Pointer_CA_Bundle',
        'Pointer_Certificate_Validator_OCSP',
        'Pointer_Copy_From',
        'Pointer_DNS_Resolver',
        'Pointer_F5_String_Or_BIGIP',
        'Pointer_HTTP_Acceleration_Profile',
        'Pointer_HTTP_Profile',
        'Pointer_L4_Profile',
        'Pointer_Log_Destination',
        'Pointer_Log_Publisher',
        'Pointer_Monitor',
        'Pointer_Pool',
        'Pointer_SNAT_Pool',
        'Pointer_SNAT_Translation',
        'Pointer_SSL_Certificate',
        'Pointer_String',
        'Pointer_System_All_Or_F5_String',
        'Pointer_System_All_Condition',
        'Pointer_System_All',
        'Pointer_Use',
        'Pointer_WebSocket_Profile',
        'Property_Base64',
        'Property_Loose_Close',
        'Property_Loose_Initialization',
        'Property_Passphrase',
        'Property_Reset_On_Timeout',
        'Property_TCP_Close_Timeout',
        'Property_TCP_Handshake_Timeout',
        'Property_PVA_Acceleration',
        'Property_Text',
        'Property_Use',
        'Resource_Base64',
        'Resource_Text',
        'Resource_URL',
        'Secret',
        'Secret_Resource_URL',
        'SNAT_Pool',
        'SNAT_Translation',
        'UDP_Profile',
        'WebSocket_Profile'
    ];

    sharedSchema.definitions = Object.keys(sharedSchema.definitions)
        .filter((key) => supportedClasses.includes(key))
        .reduce((obj, key) => {
            obj[key] = sharedSchema.definitions[key];
            return obj;
        }, {});

    return new Promise((resolve, reject) => {
        fs.writeFile(`${SCHEMA_DIR}/def-shared-schema-core.json`, JSON.stringify(sharedSchema, null, 2), (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function build() {
    return Promise.resolve()
        .then(buildSharedSchema)
        .then(buildPointers)
        .then(combineDefinitions)
        .then(buildApplicationAdditionalProps)
        .then(checkAdcSchema)
        .then(buildToolSchema);
}

module.exports = {
    build
};

if (require.main === module) {
    build().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

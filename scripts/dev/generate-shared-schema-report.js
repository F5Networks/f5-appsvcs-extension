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
const execSync = require('child_process').execSync;
const classes = require('../../src/lib/classes').toMcp;

const output = {
    conversionSuggestion: {},
    definitionStats: {},
    classic: {},
    core: {}
};

/**
 * HOW TO USE:
 * To utilize this script run the following command from the root of the f5-appsvcs-extension repo:
 *    nodejs scripts/dev/generate-shared-schema-report.js
 *
 * ADDITIONAL ENVIRONMENTAL NOTES:
 * This script assumes the f5-appsvcs-schema repo is on your machine, up to date, and is at the same
 *   directory level as the f5-appsvcs-extension repo. If this is not the case, the script will fail.
 * NVM must be at least v14.
 */

/**
 * This function calls shell commands to build the schemas in as3-classic and
 * shared schema. Then it runs them through jq to alphabetize them.
 *
 * @returns {void}
 */
function buildSchemas() {
    console.log('Building schemas... *please wait this may take a couple minutes*');

    try {
        execSync('cd ../f5-appsvcs-schema && npm run compile-schema');
    } catch (e) {
        console.log('Failed to compile ../f5-appsvcs-schema, please confirm repo is in place. Exiting...');
        throw e;
    }
    console.log('built shared schema: SUCCESSFULLY');

    try {
        execSync('jq -S . ../f5-appsvcs-schema/artifacts/schema-core.json > ./shared-schema-core-sorted.json');
    } catch (e) {
        console.log('Failed to run jq on ../f5-appsvcs-schema/artifacts/schema-all.json, please confirm file is in place and jq is installed. Exiting...');
        throw e;
    }
    console.log('ran jq on schema-core and exported it to ./shared-schema-core-sorted.json: SUCCESSFULLY');

    try {
        execSync('node scripts/build/schema-build.js && jq -S . src/schema/latest/adc-schema.json > ./adc-schema-sorted.json');
    } catch (e) {
        console.log('Failed to build adc-schema in f5-appsvcs-extension, please confirm repo is in place. Exiting...');
        throw e;
    }
    console.log('built and ran jq on adc-schema and exported it to ./adc-schema-sorted.json: SUCCESSFULLY');
}

/**
 * This is a recursive function which calls into an object and pulls any references and properties it finds.
 *
 * @param {Object} obj - The Object to be checked
 * @param {Object} defInfo - Info gathered on the object so far
 * @param {Set <String>} defInfo.refs - references discovered in the object
 * @param {Set <String>} defInfo.props - properties discovered in the object
 * @param {Object} defInfo.propValues - the json property values for later comparison
 *
 * @returns {Object} - returns the updated version of defInfo
 */
function parseObject(obj) {
    let refs = new Set();
    let propValues = {};
    Object.keys(obj).forEach((key) => {
        if (key === 'properties') {
            propValues = Object.assign(propValues, obj.properties);
        } else if (key === '$ref') {
            refs.add(obj[key]);
        }
        // Even if properties or ref, we should recurse deeper if it is an object
        if (typeof obj[key] === 'object') {
            const results = parseObject(obj[key]);
            refs = new Set([...refs, ...results.refs]);
            propValues = Object.assign(propValues, results.propValues);
        }
    });
    return {
        refs,
        propValues
    };
}

/**
 * This function parses each definition to pull out and return data on each definition
 *
 * @param {Object} jsonData - the definitions of the schema file to be parsed
 * @returns {Array} <Object> - Each entry in the array is a different definition and some stats
 */
function defsBreakDown(jsonData) {
    const definitions = Object.keys(jsonData).map((def) => {
        const defSchema = jsonData[def];
        // Grab general information
        let additionalProperties = true;
        if (typeof defSchema.additionalProperties === 'object') {
            // The property is more complex than a boolean
            additionalProperties = 'check schema';
        } else if (!defSchema.additionalProperties) {
            additionalProperties = false;
        }
        const tmshPath = classes[def] || 'NO_PATH';

        // Parse object for refs
        const defInfo = parseObject(jsonData[def]);

        // Compile results
        const stats = {
            name: def,
            additionalProperties,
            isAClass: (defSchema.properties && typeof defSchema.properties.class === 'object') || false,
            tmshPath,
            refs: [...defInfo.refs],
            props: Object.keys(defInfo.propValues),
            propValues: defInfo.propValues
        };
        return stats;
    });
    return definitions;
}

/**
 * This functions pulls the schema file and then parses and returns a filtered response
 *
 * @param {String} filePath - the path to the file to read the schema
 * @returns {Object} - definitions object from the schema
 */
function gatherDefinitions(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')).definitions;
    } catch (e) {
        console.log('unable to parse JSON due to error:');
        console.log(e);
        throw e;
    }
}

/**
 * This function diffs the classic definition aginst the Shared Schema core equivolant
 *
 * @param {Object} classicDef - definition breakdown
 */
function compareClassicToCore(classicDef) {
    const diffDef = {
        name: classicDef.name,
        additionalProperties: classicDef.additionalProperties,
        isAClass: classicDef.isAClass,
        tmshPath: classicDef.tmshPath,
        propsUniqueClassic: [],
        propsUniqueCore: [],
        propsIdentical: [],
        propsDifferent: [],
        refsUniqueClassic: [],
        refsConverted: []
    };

    // pull the coreDefinition for easier comparing
    const coreDef = output.core.find((def) => def.name === classicDef.name);

    if (typeof coreDef === 'undefined') {
        // if no coreDefinition, then all properties are unique
        diffDef.propsUniqueClassic = classicDef.props;
    } else {
        // Identify what properties are converted and to what extent
        classicDef.props.forEach((classicProp) => {
            if (!coreDef.props.find((coreProp) => coreProp === classicProp)) {
                diffDef.propsUniqueClassic.push(classicProp);
            } else if (JSON.stringify(classicDef.propValues[classicProp])
                === JSON.stringify(coreDef.propValues[classicProp])) {
                // now we need to check if they are identical or not
                diffDef.propsIdentical.push(classicProp);
            } else {
                diffDef.propsDifferent.push(classicProp);
            }
        });

        // Identify what properties are unique to Shared Schema Core
        coreDef.props.forEach((coreProp) => {
            if (!classicDef.props.find((classicProp) => classicProp === coreProp)) {
                diffDef.propsUniqueCore.push(coreProp);
            }
        });
    }

    // identify which references are converted to Shared Schema Core
    classicDef.refs.forEach((classicRef) => {
        if (!output.core.find((core) => core.name === classicRef.split('#/definitions/')[1])) {
            diffDef.refsUniqueClassic.push(classicRef);
        } else {
            diffDef.refsConverted.push(classicRef);
        }
    });

    return diffDef;
}

/**
 * This determines the broad class differences between classic and Shared Schema
 *
 * @returns {Object} results - An object holding the computed stats for the state of conversion
 */
function handleStats() {
    const fullConversion = [];
    const partConversion = [];
    const noConversion = [];

    // Iterate over class definitions to determine conversions
    output.classic.forEach((classicDef) => {
        const diff = compareClassicToCore(classicDef);
        if (diff.propsIdentical.length === 0 && diff.propsDifferent.length === 0) {
            // if there is nothing in common between classic and core no conversion is done
            noConversion.push(diff);
        } else if (diff.propsUniqueClassic.length === 0
            && diff.refsUniqueClassic.length === 0
            && diff.propsDifferent.length === 0) {
            // if there is nothing unique in classic then a full conversion is already done
            fullConversion.push(diff);
        } else {
            partConversion.push(diff);
        }
    });

    return {
        fullConversionLength: fullConversion.length,
        partConversionLength: partConversion.length,
        noConversionLength: noConversion.length,
        fullConversion,
        partConversion,
        noConversion
    };
}

/**
 * This parses the partConversion array for objects that only need properties converted
 *
 * @returns {Object} info - An object with suggestions on the core conversion objects
 */
function conversionSuggestions(info) {
    let suggestions = info.partConversion.filter((partCon) => partCon.refsUniqueClassic.length === 0);

    if (suggestions.length === 0) {
        suggestions = info.noConversion.filter((noCon) => noCon.refsUniqueClassic.length === 0);
    }

    return suggestions;
}

/**
 * Takes in an array of objects and removes the propValues property from them. This is done
 * to reduce the file bloat.
 *
 * @param {Array <Object>} defArray - Array to have propValues removed from
 */
function purgePropValues(defArray) {
    defArray.forEach((def) => {
        delete def.propValues;
    });
}

/**
 * This writes the report to ./sharedSchemaReport.json as a JSON file.
 */
function writeReport() {
    console.log('in writeReport');
    fs.writeFileSync('./sharedSchemaReport.json', JSON.stringify(output, null, 2));
    console.log('report written to ./sharedSchemaReport.json SUCCESSFULLY');
}

/**
 * This is the "main body" of the script that runs everything
 */
return Promise.resolve()
    .then(() => buildSchemas())
    .then(() => gatherDefinitions('./adc-schema-sorted.json'))
    .then((definitions) => {
        output.classic = defsBreakDown(definitions);
    })
    .then(() => gatherDefinitions('./shared-schema-core-sorted.json'))
    .then((definitions) => {
        output.core = defsBreakDown(definitions);
    })
    .then(() => handleStats())
    .then((results) => {
        output.definitionStats = results;
    })
    .then(() => purgePropValues(output.classic))
    .then(() => purgePropValues(output.core))
    .then(() => conversionSuggestions(output.definitionStats))
    .then((results) => {
        output.conversionSuggestion = results;
    })
    .then(() => {
        writeReport();
    });

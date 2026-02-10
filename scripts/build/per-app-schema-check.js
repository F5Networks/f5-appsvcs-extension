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

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');
const declarationUtil = require('../../src/lib/util/declarationUtil');

let DEBUG = false;

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);

const formats = require('../../src/lib/adcParserFormats');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

function getErrorString(errors) {
    return JSON.stringify(errors, null, 4);
}

function runChecks(fileName, callback) {
    console.log(`Checking per-app schema: ${fileName}`);
    const errors = [];

    try {
        // Read and parse the schema file
        const schemaContent = fs.readFileSync(fileName, 'utf8');
        const adcSchema = JSON.parse(schemaContent);

        // Compile the validator using the loaded schema
        const validate = ajv.compile(adcSchema);

        console.log('\nSearching for per-app examples');

        // Read all JSON files from examples/declarations/per-app directory
        const examplesDir = path.join(__dirname, '../../examples/declarations/per-app');

        if (!fs.existsSync(examplesDir)) {
            throw new Error(`Examples directory not found: ${examplesDir}`);
        }

        const files = fs.readdirSync(examplesDir)
            .filter((file) => file.endsWith('.json') && file !== 'example-per-app-settings.json');

        if (files.length === 0) {
            console.log('Warning: No JSON files found in examples/declarations/per-app directory');
        }

        console.log(`Found ${files.length} example per-app declaration(s) to validate`);
        console.log('Validating per-app declarations with per-app schema');

        files.forEach((file) => {
            const filePath = path.join(examplesDir, file);
            if (DEBUG) {
                console.log(`Verifying ${file}...`);
            }

            try {
                const exampleContent = fs.readFileSync(filePath, 'utf8');
                const exampleDeclaration = JSON.parse(exampleContent);

                const isValid = validate(exampleDeclaration);
                if (!isValid) {
                    errors.push(`${file} validation failed: ${getErrorString(validate.errors)}`);
                    if (DEBUG) {
                        console.log(`  ${file} failed validation`);
                    }
                } else if (DEBUG) {
                    console.log(`  ${file} passed validation`);
                }
            } catch (err) {
                errors.push(`${file} could not be processed: ${err.message}`);
                console.log(`  ${file} could not be processed: ${err.message}`);
            }
        });

        // Read all JSON files from examples/declarations directory (excluding subdirectories)
        const declarationsDir = path.join(__dirname, '../../examples/declarations');
        if (fs.existsSync(declarationsDir)) {
            console.log('\nFinding examples from examples/declarations directory');

            const declarationFiles = fs.readdirSync(declarationsDir)
                .filter((file) => {
                    const filePath = path.join(declarationsDir, file);
                    return file.endsWith('.json') && fs.statSync(filePath).isFile();
                });

            console.log(`Found ${declarationFiles.length} declaration file(s) to convert to per-app and validate`);
            console.log('Validating declarations with per-app schema');

            declarationFiles.forEach((file) => {
                const filePath = path.join(declarationsDir, file);
                if (DEBUG) {
                    console.log(`\nValidating ${file}...`);
                }

                try {
                    const declarationContent = fs.readFileSync(filePath, 'utf8');
                    let declaration = JSON.parse(declarationContent);
                    if (declaration.declaration) {
                        declaration = declaration.declaration;
                    }

                    let tenantCount = 0;
                    let applicationCount = 0;
                    const as3TestDecls = [];

                    Object.keys(declaration).forEach((item) => {
                        if (declaration[item].class === 'Tenant') {
                            tenantCount += 1;
                            const tenant = declaration[item];
                            Object.keys(tenant).forEach((tenantItem) => {
                                if (declarationUtil.isApplication(tenant[tenantItem])) {
                                    applicationCount += 1;
                                    const tempDecl = {
                                        schemaVersion: declaration.schemaVersion || '3.0.0',
                                        [tenantItem]: tenant[tenantItem]
                                    };
                                    as3TestDecls.push(tempDecl);
                                }
                            });
                        }
                    });

                    if (DEBUG) {
                        console.log('tenantCount: ', tenantCount);
                        console.log('applicationCount: ', applicationCount);

                        if (tenantCount === 0 && applicationCount === 0) {
                            if (declaration.declaration) {
                                console.log('declaration key found');
                            } else {
                                console.log('declaration key not found');
                            }
                        }

                        if (as3TestDecls.length === 0) {
                            console.log(`  ${file} skipped - no per-app declaration found`);
                        }
                    }

                    as3TestDecls.forEach((as3TestDecl, index) => {
                        const isValid = validate(as3TestDecl);
                        if (!isValid) {
                            errors.push(`${file}[${index}] validation failed: ${getErrorString(validate.errors)}`);
                            if (DEBUG) {
                                console.log(`  ${file}[${index}] failed validation`);
                                console.log(`${file}[${index}] validation failed: ${getErrorString(validate.errors)}`);
                            }
                        } else if (DEBUG) {
                            console.log(`  ${file}[${index}] passed validation`);
                        }
                    });
                } catch (err) {
                    errors.push(`${file} could not be processed: ${err.message}`);
                    console.log(`  ${file} could not be processed: ${err.message}`);
                }
            });
        }

        // Display results
        if (errors.length === 0) {
            console.log('\nFinished validating declarations. All valid.');
        } else {
            console.log(`\nFinished validating declarations. ${errors.length} failed.`);
            errors.forEach((error) => console.log(`  - ${error}`));
        }

        const error = (errors.length) ? new Error('Per-app schema checking failed') : null;
        callback(error);
    } catch (err) {
        console.error('Error reading or parsing per-app-schema.json:', err.message);
        callback(err);
    }
}

module.exports = {
    runChecks
};

if (require.main === module) {
    // Accept --debug or -d as a command line argument
    const args = process.argv.slice(2);
    let fileName = `${__dirname}/../../src/schema/latest/per-app-schema.json`;
    args.forEach((arg) => {
        if (arg === '--debug' || arg === '-d') {
            DEBUG = true;
        } else if (!arg.startsWith('-')) {
            fileName = arg;
        }
    });
    runChecks(fileName, (error) => {
        if (error) {
            process.exit(1);
        }
    });
}

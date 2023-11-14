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

const jsf = require('json-schema-faker');

const ParserGenerator = require('../../src/lib/ltmPolicyParserGenerator');
const specfile = require('../../src/lib/ltmPolicySpec.json');

let GENERATOR_SOURCE = null;

function convertDataTypeToRegex(dataType) {
    const regex = {
        ARRAY_STRING: '\\{ ([a-zA-Z0-9]{1,10} )+ \\}',
        ARRAY_NUMBER: '\\{ \\d{4} \\}',
        NUMBER: '\\d',
        BOOL: ' ',
        STRING: '[a-zA-Z0-9]{1,40}',
        TCLSTRING: '[a-zA-Z0-9]{1,40}'
    }[dataType];

    if (!regex) {
        throw new Error(`Unable to create regex for dataType "${dataType}"`);
    }
    return regex;
}

function convertTokenToRegex(token) {
    let optionRegex = token.options
        .map((option) => `(${option})`)
        .join('|');
    if (token.dataType !== 'NONE') {
        optionRegex += ` (${convertDataTypeToRegex(token.dataType)})`;
    }
    if (token.options.length > 1 || token.dataType !== 'NONE') {
        optionRegex = `(${optionRegex})`;
    }
    if (!token.required) {
        optionRegex += '{0,1}';
    }

    return optionRegex;
}

function convertBranchToRegex(branch) {
    const regex = branch.tokens
        .map((token) => convertTokenToRegex(token))
        .join(' ');
    let branchRegex = Object.keys(branch.branches)
        .map((branchKey) => `(${convertBranchToRegex(branch.branches[branchKey])})`)
        .join('|');
    branchRegex = `(${branchRegex})`;
    return `${regex} ${branchRegex}`;
}

function createGeneratorSource(parserSource) {
    const generatorSource = {};
    const generatorKeys = Object.keys(parserSource);
    generatorKeys.forEach((specKey) => {
        generatorSource[specKey] = {};
        const branchKeys = Object.keys(parserSource[specKey].branches);
        branchKeys.forEach((branchKey) => {
            const branch = parserSource[specKey].branches[branchKey];
            try {
                generatorSource[specKey][branchKey] = `^${convertBranchToRegex(branch)}$`;
            } catch (e) {
                throw new Error(`Unable to convert branch "${branchKey}" to regex: ${e.message}`);
            }
        });
    });
    return generatorSource;
}

function getSource() {
    if (!GENERATOR_SOURCE) {
        const parserSource = ParserGenerator.generate(specfile);
        GENERATOR_SOURCE = createGeneratorSource(parserSource);
    }
    return GENERATOR_SOURCE;
}

function generate(spec, item) {
    const generators = getSource()[spec];
    const keys = Object.keys(generators);
    const itemCopy = item || keys[Math.floor(Math.random() * keys.length)];
    return jsf.generate({
        type: 'string',
        pattern: getSource()[spec][itemCopy]
    });
}

module.exports = {
    generate
};

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

const ParserGenerator = require('./ltmPolicyParserGenerator');
const specfile = require('./ltmPolicySpec.json');
const util = require('./util/util');

let PARSER_SOURCE = null;

function getSource() {
    if (!PARSER_SOURCE) {
        PARSER_SOURCE = ParserGenerator.generate(specfile);
    }
    return PARSER_SOURCE;
}

function findMatchingToken(inputTokens, searchStrings) {
    let match = null;
    searchStrings.forEach((searchString) => {
        if (inputTokens.find((inputToken) => inputToken === searchString)) {
            match = searchString;
        }
    });
    return match;
}

function getBranch(source, inputTokens) {
    const branchKey = (
        findMatchingToken(inputTokens, Object.keys(source.branches))
        || source.defaultBranch
    );
    if (!branchKey) {
        throw new Error('Unable to find a valid branch');
    }
    return source.branches[branchKey];
}

function processRequiredToken(requiredToken, inputTokens) {
    const outputToken = findMatchingToken(inputTokens, requiredToken.options);
    if (!outputToken) {
        const tokenString = requiredToken.options.join(', ');
        throw new Error(`Unable to find required token "${tokenString}"`);
    }
    return outputToken;
}

function processOptionalToken(optionalToken, inputTokens) {
    const outputToken = findMatchingToken(inputTokens, optionalToken.options);
    return outputToken || optionalToken.default;
}

function containsEndingQuote(token, startingQuote) {
    const escapedQuote = startingQuote.replace(/\\/g, '\\\\');
    const re = new RegExp(`(^${escapedQuote})|([^\\\\]${escapedQuote})`);
    return !token.match(re);
}

function isStartingQuoteToken(token) {
    return (token.match(/"/g) || []).length === 1;
}

function processValueToken(dataTypeToken, keyToken, inputTokens) {
    const keyIndex = inputTokens.findIndex((inputToken) => inputToken === keyToken);
    const valueTokens = [inputTokens[keyIndex + 1]];
    if (dataTypeToken.dataType.startsWith('ARRAY')) {
        for (let i = keyIndex + 2; inputTokens[i] !== '}'; i += 1) {
            valueTokens.push(inputTokens[i]);
        }
        valueTokens.push('}');
    } else if (
        dataTypeToken.dataType.endsWith('STRING') && isStartingQuoteToken(valueTokens[0])
    ) {
        const startingQuote = valueTokens[0].slice(0, valueTokens[0].indexOf('"') + 1);
        let i = keyIndex + 2;
        for (; containsEndingQuote(inputTokens[i], startingQuote); i += 1) {
            valueTokens.push(inputTokens[i]);
        }
        valueTokens.push(inputTokens[i]);
    }
    return valueTokens.join(' ');
}

function processBranchTokens(branch, inputTokens) {
    const outputTokens = [];
    branch.tokens.forEach((branchToken) => {
        let processedToken = null;
        if (branchToken.required) {
            processedToken = processRequiredToken(branchToken, inputTokens);
        } else {
            processedToken = processOptionalToken(branchToken, inputTokens);
        }

        if (processedToken) {
            outputTokens.push(processedToken);

            if (branchToken.dataType !== 'NONE' && branchToken.dataType !== 'BOOL') {
                const keyToken = outputTokens[outputTokens.length - 1];
                outputTokens.push(processValueToken(branchToken, keyToken, inputTokens));
            }
        }
    });
    return outputTokens.join(' ');
}

function tokenizeInput(inputString) {
    return inputString
        .replace('{', ' { ')
        .replace('}', ' } ')
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t !== '');
}

function normalizeStringInternal(inputString, spec) {
    const source = getSource()[spec];
    const inputTokens = tokenizeInput(inputString);

    const outputStrings = [];
    let currentBranch = getBranch(source, inputTokens);
    while (currentBranch) {
        outputStrings.push(processBranchTokens(currentBranch, inputTokens));
        if (Object.keys(currentBranch.branches).length > 0) {
            currentBranch = getBranch(currentBranch, inputTokens);
        } else {
            currentBranch = null;
        }
    }
    return outputStrings.join(' ');
}

function normalizeString(inputString, spec) {
    try {
        if (!spec) {
            throw new Error('No specification was given');
        }
        return normalizeStringInternal(inputString, spec);
    } catch (e) {
        throw new Error(`Unable to normalize "${inputString}": ${e.message}`);
    }
}

function fromCamelCase(string) {
    return string
        .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
        .replace(/_/g, '-');
}

function getSpecFromObject(object) {
    if (object.kind.indexOf('actionsstate') !== -1) {
        return 'action';
    }

    if (object.kind.indexOf('conditionsstate') !== -1) {
        return 'condition';
    }

    if (object.kind.indexOf('operandsstate') !== -1) {
        return 'operand';
    }

    throw new Error(`Unable to determine policy specification from ${object.kind}`);
}

function convertAs3ObjectToString(object) {
    if (typeof object === 'string') {
        return object;
    }

    const tokens = [];
    const namedProps = ['event', 'operand'];
    Object.keys(object).forEach((propertyKey) => {
        const propertyValue = object[propertyKey];

        if (propertyKey === 'type') {
            tokens.push(fromCamelCase(propertyValue));
        } else if (namedProps.indexOf(propertyKey) !== -1) {
            if (propertyKey === 'operand' && propertyValue.includes('not')) {
                const negativeToPostive = {
                    'does-not-contain': 'contains',
                    'does-not-end-with': 'ends-with',
                    'does-not-equal': 'equals',
                    'does-not-start-with': 'starts-with',
                    'does-not-match': 'matches',
                    'does-not-exist': 'exists'
                };
                tokens.push('not');
                tokens.push(negativeToPostive[propertyValue]);
            } else {
                tokens.push(propertyValue);
            }
        } else if (typeof propertyValue === 'string') {
            let value = util.escapeTcl(propertyValue).replace(/"/g, '\\"');
            if (propertyValue.includes(' ') || propertyValue.startsWith('tcl:')) {
                value = `"${value}"`;
            }
            tokens.push(fromCamelCase(propertyKey), value);
        } else if (typeof propertyValue === 'boolean') {
            if (propertyValue) {
                tokens.push(fromCamelCase(propertyKey));
            }
        } else if (typeof propertyValue === 'number') {
            tokens.push(fromCamelCase(propertyKey), propertyValue);
        } else if (Array.isArray(propertyValue)) {
            const pValue = propertyValue.map((e) => util.wrapStringWithSpaces(e));
            tokens.push(`values { ${pValue.join(' ')} }`);
        } else if (typeof propertyValue === 'object') {
            tokens.push(fromCamelCase(propertyKey));
            tokens.push(convertAs3ObjectToString(propertyValue));
        } else {
            throw new Error(`Unable to convert property "${propertyKey}" to LTM policy string`);
        }
    });

    return tokens.join(' ');
}

function convertObjectToString(object) {
    let policyString = '';
    Object.keys(object).forEach((key) => {
        if (key === 'name') {
            return;
        }
        let value = object[key];
        let property = fromCamelCase(key);
        if (property === 'tm-name') {
            property = 'name';
        }
        if (typeof value === 'boolean') {
            value = '';
        } else if (Array.isArray(value)) {
            value = value.map((e) => util.wrapStringWithSpaces(e));
            value = `{${value.join(' ')}}`;
        } else if (typeof value === 'string') {
            value = util.escapeTcl(value);
            if (value.includes(' ') || value.startsWith('tcl:')) {
                value = `"${value}"`;
            }
        }
        policyString += `${property} ${value} `;
    });
    return normalizeString(policyString, getSpecFromObject(object));
}

module.exports = {
    getSource,
    normalizeString,
    convertObjectToString,
    convertAs3ObjectToString: (obj, spec) => normalizeString(convertAs3ObjectToString(obj), spec)
};

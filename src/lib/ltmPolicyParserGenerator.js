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

const DATA_TYPES = [
    'NONE',
    'NUMBER',
    'ARRAY_STRING',
    'ARRAY_NUMBER',
    'STRING',
    'TCLSTRING',
    'BOOL'
];

function getIndent(string) {
    return string.match(/^\s*/)[0].length;
}

function gatherBranches(branchLines) {
    if (branchLines.length <= 1) {
        return [];
    }

    const branchIndent = getIndent(branchLines[1]);
    const rawBranches = [];
    let currentBranch = null;

    function commitBranch() {
        if (currentBranch) {
            rawBranches.push(currentBranch);
            currentBranch = null;
        }
    }

    for (let i = 1; i < branchLines.length; i += 1) {
        const currentLine = branchLines[i];
        const currentIndent = getIndent(currentLine);
        if (currentIndent < branchIndent) {
            commitBranch();
            break;
        }
        if (currentIndent === branchIndent) {
            commitBranch();
            currentBranch = [currentLine];
        } else {
            currentBranch.push(currentLine);
        }
    }
    commitBranch();

    return rawBranches
        .map((b) => processBranch(b))
        .reduce((accumulator, current) => Object.assign(accumulator, current), {});
}

function processToken(tokenString, source, branchName) {
    let defaultOption = null;
    let dataType = 'NONE';
    const options = tokenString.split('|')
        .map((option) => {
            const optionParts = option.trim().split(' ');
            let name = optionParts[0];
            if (name.endsWith('*')) {
                name = name.replace('*', '');
                defaultOption = name;
            }
            if (optionParts[1] && dataType === 'NONE') {
                dataType = optionParts[1];
            }
            return name;
        });

    if (DATA_TYPES.indexOf(dataType) === -1) {
        throw new Error(`Token parsed unexpected data type "${dataType}"`);
    }

    const token = {
        options,
        required: source.indexOf(`[${options[0]}`) === -1 || options[0] === branchName,
        dataType
    };
    if (defaultOption) {
        token.default = defaultOption;
        token.required = false;
    }
    return token;
}

function getDefaultBranchName(root) {
    let defaultBranch = null;
    Object.keys(root.branches)
        .map((key) => root.branches[key])
        .forEach((branch) => {
            if (branch.tokens[0] && branch.tokens[0].default) {
                defaultBranch = branch.tokens[0].default;
            }
        });
    return defaultBranch;
}

function processBranch(branchLines) {
    const splitRegex = new RegExp(
        `${'\\[|\\]'
        + '|(?:\\s+(?!\\||'}${DATA_TYPES.map((type) => `(?:${type})`).join('|')}))`
    );
    const tokens = branchLines[0]
        .replace(/\s*\|\s*/g, '~')
        .split(splitRegex)
        .map((t) => t.replace(/~/g, '|').trim())
        .filter((t) => t !== '');

    const branchName = (tokens[0] || 'top').split(' ')[0].replace('*', '');
    const processedBranch = {};

    try {
        const branch = {
            branches: gatherBranches(branchLines),
            tokens: tokens.map((t) => processToken(t, branchLines[0], branchName))
        };
        const defaultBranch = getDefaultBranchName(branch);
        if (defaultBranch) {
            branch.defaultBranch = defaultBranch;
        }
        processedBranch[branchName] = branch;
    } catch (e) {
        throw new Error(`Unable to process branch ${branchName}: ${e.message}`);
    }

    return processedBranch;
}

function generate(specObj) {
    const parserSource = {};
    const parserKeys = Object.keys(specObj);
    parserKeys.forEach((parserKey) => {
        parserSource[parserKey] = processBranch(specObj[parserKey]).top;
    });
    return parserSource;
}

module.exports = {
    generate
};

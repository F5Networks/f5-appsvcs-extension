/**
 * Copyright 2023 F5 Networks, Inc.
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

const properties = require('./properties.json');
const util = require('./util/util');

const quoteString = function quoteString(str) {
    return `"${str
        .replace(/\x0d/g, '\\r')
        .replace(/\x0a/g, '\\n')
        .replace(/\x09/g, '\\t')
        .replace(/\x0c/g, '\\f')
        .replace(/\x08/g, '\\b')
        .replace(/\x5c/g, '\\\\')
        .replace(/\x3f/g, '\\?')
        .replace(/(\\)?"/g, (a, b) => (b ? a : '\\"'))
        .replace(/[\x00-\x1f\x7f]/g, '.')
        .replace(/([;$[\]{}])/g, '\\$1')}"`;
};

// This function aligns AS3 schema keys and values with BIG-IP.
// The goal is for the data-driven model to handle 90% of the cases.
// Custom code is then applied in map_as3.js and map_mcp.js for the remainder.
const assignProperty = function assignProperty(context, obj, mcpCommand, p) {
    let rval = {};
    // Assume AS3 camelCase is directly convertible to tmsh dashes.
    // For example, AS3 pool member "connectionLimit" is BIG-IP "connection-limit".
    const camelCaseId = util.toCamelCase(p.id);
    if (obj[camelCaseId] !== undefined) {
        obj[p.id] = obj[camelCaseId];
    }
    // Use an alternate key when defined in properties.json.
    // For example, AS3 "mirroring" is BIG-IP "mirror".
    if (obj[p.altId] !== undefined) {
        obj[p.id] = obj[p.altId];
    }
    if (typeof obj[p.id] === 'undefined') {
        if (typeof p.default !== 'undefined' && p.default !== null) {
            obj[p.id] = p.default;
        } else if (p.default === null) {
            return undefined;
        } else if (p.extend === 'objArray' || p.extend === 'array') {
            obj[p.id] = [];
        } else {
            return undefined;
        }
    }
    if (p.minVersion && util.versionLessThan(context.target.tmosVersion, p.minVersion)) {
        delete obj[p.id];
        return undefined;
    }

    if (p.requiredModules) {
        if (!p.requiredModules.anyOf) {
            throw new Error('requiredModules must have an "anyOf" property');
        }

        if (!util.isOneOfProvisioned(context.target, p.requiredModules.anyOf)) {
            delete obj[p.id];
            return undefined;
        }
    }

    function getProperties(propString) {
        const subProp = properties[propString];
        if (!subProp) {
            throw new Error(`Could not find a properties.json entry for "${propString}"`);
        }
        return subProp;
    }

    function getName(item) {
        const subCmd = `${mcpCommand} ${p.id}`;
        if (item.name) return item.name;
        const nameProp = getProperties(subCmd).find((prop) => prop.id === 'name');
        if (nameProp && nameProp.altId && item[nameProp.altId]) return item[nameProp.altId];

        return item.use || item.bigip;
    }

    switch (p.extend) {
    case undefined:
        // When "extend" is not defined in properties.json,
        // check for boolean AS3 translations to BIG-IP strings.
        // For example, AS3 mirroring "true" is BIG-IP mirror "enabled".
        if (p.truth !== undefined && obj[p.id] === true) {
            obj[p.id] = p.truth;
        }
        if (p.falsehood !== undefined && obj[p.id] === false) {
            obj[p.id] = p.falsehood;
        }
        // BIG-IP uses the string "none" for null values
        if (obj[p.id] === '') {
            return 'none';
        }

        // BIG-IP sometimes wants to see integers as strings
        if (p.intToString && obj[p.id] !== undefined) {
            obj[p.id] = String(obj[p.id]);
        }

        // Quotes and escaped newlines are required for
        // some BIG-IP values such as monitor send strings.
        // Leave default values unquoted to handle BIG-IP "description none", which has no quotes.
        if (p.quotedString && (obj[p.id] !== undefined)
            && (obj[p.id] !== 'none') && (obj[p.id][0] !== undefined && obj[p.id][0] !== '"')) {
            obj[p.id] = quoteString(obj[p.id]);
        }

        rval = obj[p.id].bigip || obj[p.id].use || obj[p.id];
        if (p.forceToCommon) {
            rval = rval.replace('/Shared', '');
        }
        break;
    case 'object': {
        // When "extend" is defined as "object",
        // recurse on each extension key defined in properties.json.
        const subCmd = p.id.startsWith('iControl_') ? p.id : `${mcpCommand} ${p.id}`;
        const subProps = getProperties(subCmd);
        subProps.forEach((subP) => {
            if (subP.id !== 'name') {
                const value = assignProperty(context, obj[p.id], subCmd, subP);
                if (typeof value !== 'undefined') {
                    rval[subP.id] = value;
                }
            }
        });
        break;
    }
    case 'namedObject': {
        // When "extend" is defined as "namedObject",
        // get each name, then recurse on each extension key defined in properties.json
        // creating an array of objects
        const subCmd = `${mcpCommand} ${p.id}`;
        const subProps = getProperties(subCmd);
        const names = Object.keys(obj[p.id]);
        if (obj[p.id] === 'none') {
            return 'none';
        }
        if (typeof obj[p.id] === 'object') {
            const originalObject = util.simpleCopy(obj[p.id]);
            obj[p.id] = [];
            names.forEach((name, index) => {
                obj[p.id].push(originalObject[name]);
                subProps.forEach((subP) => {
                    let value;
                    if (subP.id === 'name') {
                        value = name;
                    } else {
                        value = assignProperty(context, obj[p.id][index], subCmd, subP);
                    }
                    if (typeof value !== 'undefined') {
                        if (!rval[name]) {
                            rval[name] = {};
                        }
                        rval[name][subP.id] = value;
                    }
                });
            });
        }
        break;
    }
    case 'array': {
        // When "extend" is defined as "array",
        // recurse on extensions unless array element is a string
        const subCmd = `${mcpCommand} ${p.id}`;
        if (!Array.isArray(obj[p.id])) {
            if (typeof obj[p.id] === 'object') {
                obj[p.id] = Object.keys(obj[p.id]);
            } else {
                obj[p.id] = [obj[p.id]];
            }
        }

        obj[p.id].forEach((item) => {
            if (p.quotedString && (obj[p.id] !== undefined)
                && (item !== 'none') && (item[0] !== undefined && item[0] !== '"')) {
                item = quoteString(item);
            }

            let name = '';
            if (item === null) {
                name = '';
            } else if (item.bigip || item.use || typeof item !== 'object') {
                name = item.bigip || item.use || item;
                rval[name] = {};
            } else {
                getProperties(subCmd).forEach((subP) => {
                    if (subP.id !== 'name') {
                        const value = assignProperty(context, item, subCmd, subP);
                        if (typeof value !== 'undefined') {
                            rval[subP.id] = value;
                        }
                    }
                });
            }
        });
        break;
    }
    case 'objArray': {
        // When "extend" is defined as "objArray"
        // recurse on extensions unless array element is a string
        const subCmd = `${mcpCommand} ${p.id}`;

        // If this is not actually array, assume it is good to go
        if (!Array.isArray(obj[p.id])) {
            rval = obj[p.id];
            break;
        }
        obj[p.id].forEach((item) => {
            if (typeof item === 'string') {
                // When an array item is a string, pass it through.
                // Use an alternate key when defined in properties.json.
                // For example, AS3 "remark" is BIG-IP "description".
                rval[item] = {};
                getProperties(subCmd).forEach((subP) => {
                    if (subP.altId === item) {
                        rval[subP.id] = {};
                        delete rval[item];
                    }
                });
            } else {
                // When an array item is an object, use the "name" key as the item key.
                const subProps = getProperties(subCmd);

                item.name = getName(item);
                const nameProp = subProps.find((subP) => subP.id === 'name');
                if (nameProp) {
                    item.name = assignProperty(context, item, subCmd, nameProp);
                }
                rval[item.name] = {};

                subProps.forEach((subP) => {
                    if (subP.id !== 'name') {
                        const value = assignProperty(context, item, subCmd, subP);
                        if (typeof value !== 'undefined') {
                            rval[item.name][subP.id] = value;
                        }
                    }
                });
            }
        });
        break;
    }
    default:
        break;
    }
    return rval;
};

/*
 * Exported function.
 * Filter a configuration down to purely the list of supported BIG-IP command properties.
 * This data-driven code filters properties from instructions in "properties.json".
 */
const actionableMcp = function actionableMcp(context, obj, mcpCommand, path) {
    let prop = {};
    const supportedObj = {};
    const ignoreKeys = [];

    obj.ignore = typeof obj.ignore !== 'undefined' ? obj.ignore : {};

    if (properties[mcpCommand] !== undefined) {
        properties[mcpCommand].forEach((p) => {
            let propertiesIndex = mcpCommand;
            if (p.id.startsWith('iControl_')) {
                propertiesIndex = p.id;
            }
            prop = assignProperty(context, obj, propertiesIndex, p);
            if (prop !== undefined) {
                supportedObj[p.id] = prop;
            }

            const ignoreProperty = util.simpleCopy(p);
            ignoreProperty.default = undefined;
            prop = assignProperty(context, obj.ignore, propertiesIndex, ignoreProperty);
            if (prop !== undefined) {
                if (typeof prop === 'object') {
                    const objKeys = util.getDeepKeys(prop, 'other');
                    objKeys.forEach((k) => {
                        ignoreKeys.push(`${p.id}.${k}`);
                    });
                } else {
                    ignoreKeys.push(p.id);
                }
            }
        });
    }
    return {
        path,
        command: mcpCommand,
        properties: supportedObj,
        ignore: ignoreKeys
    };
};

module.exports = {
    actionableMcp,
    quoteString
};

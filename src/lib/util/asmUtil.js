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

const xml2js = require('xml2js');
const jsonpointer = require('jsonpointer');
const expandUtil = require('./expandUtil');
const util = require('./util');

function convertJsonToXml(jsonObject) {
    const builder = new xml2js.Builder({
        xmldec: {
            version: '1.0',
            encoding: 'utf-8'
        },
        renderOpts: {
            pretty: true,
            indent: '    '
        }
    });
    let result = '';
    try {
        result = builder.buildObject(jsonObject);
    } catch (error) {
        return Promise.reject(error);
    }
    return Promise.resolve(result);
}

function convertXmlToJson(xmlString) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlString, (error, result) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(result);
        });
    });
}

const maps = {
    // Do not change the order of the key/values in the JSON object
    disabledSignatures: (policy, value) => {
        policy.attack_signatures.forEach((xmlObject) => {
            if (xmlObject.signature) {
                value.forEach((sigId) => {
                    xmlObject.signature.forEach((sig) => {
                        if (sig.$.signature_id === sigId.toString()) {
                            sig.enabled[0] = 'false';
                            sig.in_staging[0] = 'false';
                        }
                    });
                });
            }
        });
    },

    enforcementMode: (policy, value) => {
        const entry = policy.blocking.find((e) => e.enforcement_mode);
        entry.enforcement_mode = [value];
    },

    serverTechnologies: (policy, value) => {
        policy.server_technologies = {
            server_technology: value.map((t) => ({ server_technology_name: t }))
        };
    }
};

function mapSettings(jsonObject, settings) {
    const ignoredKeys = [
        'class',
        'label',
        'remark',
        'url',
        'file',
        'ignoreChanges',
        'policy',
        'expand'
    ];
    Object.keys(settings)
        .filter((key) => ignoredKeys.indexOf(key) < 0)
        .forEach((key) => {
            const value = settings[key];
            const map = maps[key];
            if (!map) {
                throw new Error(`Could not find a mapping for the ${key} setting`);
            }
            map(jsonObject.policy, value);
        });
    return jsonObject;
}

function expandStrings(jsonPointers, jsonObject, instancePath, declaration) {
    (jsonPointers || []).forEach((pointer) => {
        const value = jsonpointer.get(jsonObject, pointer);
        if (typeof value === 'undefined') {
            throw new Error(`Could not expand string in ${instancePath}. JSON pointer "${pointer}" references a nonexistent value in the policy`);
        }
        const policyPointer = `${instancePath}/policy`;
        // copy decl to avoid modifying original
        const declCopy = util.simpleCopy(declaration);
        // Add the full WAF policy JSON object to the WAF_Policy instance in the declaration. We do this so that
        // expandUtil can traverse the WAF Policy data as if it was originally part of the declaration, allowing any
        // string expansion to autofill declaration related data such as application name, class name, etc
        jsonpointer.set(declCopy, policyPointer, jsonObject);
        expandString(declCopy, `${policyPointer}${pointer}`, value);
    });
    return jsonObject;
}

function expandString(declaration, pointer, value) {
    const valueType = typeof value;
    if (valueType === 'string') {
        const lastSlashIdx = pointer.lastIndexOf('/');
        const parentDataProperty = pointer.substring(lastSlashIdx + 1);
        const parentData = jsonpointer.get(declaration, pointer.substring(0, lastSlashIdx));
        expandUtil.backquoteExpand(value, pointer, parentData, declaration, parentData, parentDataProperty);
    } else if (valueType === 'object' && value !== null) {
        Object.keys(value).forEach((key) => {
            const refKey = key.replace('~', '~0').replace('/', '~1');
            expandString(declaration, `${pointer}/${refKey}`, value[key]);
        });
    }
}

function isJson(string) {
    try {
        JSON.parse(string);
    } catch (error) {
        return false;
    }
    return true;
}

function applyAs3Settings(xmlString, settings, instancePath, declaration) {
    if (!xmlString) {
        return Promise.reject(new Error('Missing required xmlString argument'));
    }

    if (isJson(xmlString)) {
        return Promise.resolve()
            .then(() => {
                const jsonObject = JSON.parse(xmlString);
                const newJsonObject = expandStrings(settings.expand, jsonObject, instancePath, declaration);
                return JSON.stringify(newJsonObject);
            });
    }

    return Promise.resolve()
        .then(() => convertXmlToJson(xmlString))
        .then((jsonObject) => mapSettings(jsonObject, settings))
        .then((jsonObject) => convertJsonToXml(jsonObject));
}

module.exports = {
    applyAs3Settings,
    convertJsonToXml,
    convertXmlToJson
};

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

const equal = require('fast-deep-equal');

const adcSchema = require('../schema/latest/adc-schema.json'); // eslint-disable-line

/**
 * Helper method to find arrays
 * @private
 * @param {decl} declaration to check for duplicate config objs
 * @param {prop} property name to look for in the declaration
 * @returns duplicate values if any
 */
let propArrs = [];
let result = { isFind: false };

const find = (decl, prop) => {
    if (Array.isArray(decl)) {
        for (let i = 0, len = decl.length; i < len; i += 1) {
            const nested = find(decl[i], prop);
            if (nested.isFind) return nested;
        }
    } else {
        if (typeof decl !== 'object') return { isFind: false };
        Object.keys(decl).forEach((key) => {
            if (key === prop) {
                propArrs.push(decl[key]);
                result.value = propArrs;
                result.isFind = true;
            }
            find(decl[key], prop);
        });
    }
    return result;
};

/**
 * Helper method to find duplicate values in an array
 * @private
 * @param {arr} array to look for duplicate values
 * @returns duplicate values if any
 */

const hasDuplicateVals = (arr) => {
    let i = arr.length;
    let j;
    let val;

    while (i !== 0) {
        i -= 1;
        val = arr[i];
        j = i;
        while (j !== 0) {
            j -= 1;
            if (typeof arr[j] === 'object' && typeof val === 'object') {
                if (equal(arr[j], val) === true) {
                    return true;
                }
            } else if (arr[j] === val) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Method to find if there are duplicate values in a given array
 * @public
 * @param {decl} declaration to check for duplicate config objs
 * @returns duplicate values if any
 */

const hasDuplicate = (decl) => {
    propArrs = [];
    result = { isFind: false };
    // Checking for Duplicate values only for those config properties where
    // it is not possible to do so thru ajv validator
    // 'iRules' | 'persistenceMethods' | 'monitors' | 'tcpOptions' | 'certificates' | 'members'
    // Return true as soon as it finds the first duplicate values
    // log.error('find ================= ');
    const dupResult = { isDuplicate: false };

    const props = ['iRules', 'persistenceMethods', 'monitors', 'tcpOptions', 'certificates', 'members', 'doNotProxyHosts', 'rules'];

    let len = props.length;
    while (len > 0) {
        const arrList = find(decl, props[len - 1]);
        if (arrList.value && arrList.value.length > 0) {
            const arr = arrList.value;
            for (let k = 0; k < arr.length; k += 1) {
                if (hasDuplicateVals(arr[k])) {
                    dupResult.isDuplicate = true;
                    dupResult.propName = props[len - 1];
                    return dupResult;
                }
            }
        }
        len -= 1;
    }
    return dupResult;
};

/**
 * Helper method to find if there are extra not used keys
 * @private
 * @param {val} Value to check
 * @returns true or false
 */
const extraKeys = (val) => {
    const checks = ['multipleOf', 'exclusiveMinimum', 'exclusiveMaximum', 'minimum', 'minLength', 'maxLength', 'pattern', 'maxProperties', 'minProperties',
        'additionalItems', 'patternProperties', 'additionalProperties', 'propertyNames', 'dependencies', 'required', 'minItems', 'maxItems', 'uniqueItems',
        'items', 'minimumProperties', 'maximumProperties', 'enum', 'default', 'not', 'oneOf', 'anyOf', 'allOf', 'if', 'else', 'then', '$comment', 'readOnly'];
    return checks.indexOf(val) !== -1;
};

/**
 * Helper method to skip testing internal properties of an arbitrary object
 * @private
 * @param {val} Value to check
 * @returns true or false
 */
const skipObject = (val) => {
    // Only add to this check if the (val) object can have arbitrary data within it
    const checks = ['metadata', 'localZones', 'forwardZones', 'environmentVariables'];
    return checks.indexOf(val) !== -1;
};

/**
 * Add user sent declaration keys/properties to an array
 * @private
 * @param {decl} declaration sent
 * @param {arr} arry to hold declaration keys
 * @returns array created
 */
const setDeclProps = (decl, arr) => {
    if (decl === null || typeof decl !== 'object') return arr;
    Object.keys(decl).forEach((key) => {
        if (skipObject(key)) {
            arr.push(key);
            return;
        }

        if (arr.indexOf(key) === -1) {
            arr.push(key);
        }
        if ((key === 'class' && arr.indexOf(decl.class) === -1)
            || (key === 'template' && arr.indexOf(decl.template) === -1)
            || (key === 'logLevel' && arr.indexOf(decl.logLevel) === -1)) {
            arr.push(decl[key]);
        }

        // Remove unnecessary keys added
        if ((decl[key] !== null && decl[key].class) || key === 'class' || !Number.isNaN(Number(key))
            || key === 'constants' || key === '$value') {
            const index = arr.indexOf(key);
            arr.splice(index, 1);
        }

        // 'ADC' or 'AS3' are not keywords in the schema
        if (decl[key] === 'ADC' || decl[key] === 'AS3') {
            const index = arr.indexOf(decl[key]);
            arr.splice(index, 1);
        }

        // 'constants' contains props not in the schema | not adding 'verifiers' props
        if (key !== 'constants' && key !== 'verifiers') {
            setDeclProps(decl[key], arr);
        }
    });
    return arr;
};

/**
 * Test a key against array of pattern property regular expressions
 * @private
 * @param {allPatternPropKeys} array of pattern property regular expression strings
 * @param {key} key to be tested
 * @returns true if match found, false by default
 */
const matchPatternProp = (allPatternPropKeys, key) => {
    for (let i = 0; i < allPatternPropKeys.length; i += 1) {
        if (RegExp(allPatternPropKeys[i]).test(key)) {
            return true;
        }
    }
    return false;
};

/**
 * Add adc schema keys to an array
 * @private
 * @param {props} adc schema obj
 * @param {propSet} set to hold schema keys
 * @param {patternPropSet} set to hold patternProperties schema keys
 * @param {isPatternPropKey} Boolean identifying the key as being a pattern property
 * @returns array where first item is updated propSet and second item is updated patternPropSet
 */
const setAllProps = (props, propSet, patternPropSet, isPatternPropKey) => {
    if (typeof props !== 'object') return [propSet, patternPropSet];
    Object.keys(props).forEach((key) => {
        if (skipObject(key)) {
            propSet.add(key);
            return;
        }

        if (!extraKeys(key) && !isPatternPropKey) {
            propSet.add(key);
        }

        // Add pattern property
        if (isPatternPropKey) {
            patternPropSet.add(key);
        }

        // Add all enums
        if (key === 'enum' && Array.isArray(props[key])) {
            for (let k = 0; k < props[key].length; k += 1) {
                propSet.add(props[key][k]);
            }
        }

        // Add all const
        if (key === 'const') {
            propSet.add(props[key]);
        }

        // Remove unnecessary keys added
        if (props[key].class || key === 'class' || !Number.isNaN(Number(key))) {
            propSet.delete(key);
        }
        setAllProps(props[key], propSet, patternPropSet, key === 'patternProperties');
    });
    return [propSet, patternPropSet];
};

/**
 * Method to check if user sent declaration has valid keys/properties
 * @public
 * @param {oject} context - the context
 * @param {object} declaration - the declaration
 * @returns immediately with obj that shows if it is valid or not and if so which key failed
 */
const isValid = (context, decl) => {
    const declKeys = setDeclProps(decl, []);
    const results = setAllProps(adcSchema, new Set(), new Set(), false);
    const allKeys = Array.from(results[0]);
    const allPatternPropKeys = Array.from(results[1]);

    if (context.request.method !== 'Get'
        && context.request.method !== 'Delete'
        && context.request.isPerApp
        && context.request.perAppInfo.apps.length === 0) {
        return {
            isValid: false,
            data: 'Per-app declaration must contain at least one application'
        };
    }

    for (let i = 0; i < declKeys.length; i += 1) {
        if (allKeys.indexOf(declKeys[i]) === -1 && !matchPatternProp(allPatternPropKeys, declKeys[i])) {
            return {
                isValid: false,
                data: declKeys[i]
            };
        }
    }
    return { isValid: true };
};

const validateDeclarationArray = (context) => {
    const results = [];
    const targetHostInventory = {};
    const targetInventory = [];

    const declarations = context.tasks;

    declarations.forEach((declItem, index) => {
        const targetHost = declItem.targetHost;
        const decl = declItem.declaration;
        if (!targetHostInventory[targetHost]) {
            targetHostInventory[targetHost] = [];
        }
        const validatorResult = isValid(context, decl);
        const declResult = {
            validatorResult,
            hasDuplicate: false
        };
        if (decl) {
            Object.keys(decl).forEach((declKey) => {
                const tenant = decl[declKey].class === 'Tenant' ? decl[declKey] : undefined;
                if (tenant) {
                    const appKeys = Object.keys(tenant).reduce((apps, propName) => {
                        if (tenant[propName].class === 'Application') {
                            apps.push(propName);
                        }
                        return apps;
                    }, []);

                    const existingTenantTargetHost = targetHostInventory[targetHost].find((i) => i.tenant === declKey);
                    if (existingTenantTargetHost) {
                        let isDuplicate = false;
                        if (!decl.target) {
                            isDuplicate = true;
                        } else {
                            isDuplicate = appKeys.some((a) => existingTenantTargetHost.apps.includes(a));
                        }
                        if (isDuplicate) {
                            // set hasDuplicate for this current decl
                            declResult.hasDuplicate = true;
                            // set hasDuplicate for the previously found decl
                            results[existingTenantTargetHost.declIndex].hasDuplicate = true;
                        }
                    } else {
                        targetHostInventory[targetHost].push({ declIndex: index, tenant: declKey, apps: appKeys });
                    }
                }
            });
            if (decl.target) {
                const target = decl.target.hostname || decl.target.address;
                const existingTarget = targetInventory.find((i) => i.target === target);

                if (existingTarget) {
                    declResult.hasDuplicate = true;
                    results[existingTarget.declIndex].hasDuplicate = true;
                } else {
                    targetInventory.push({ declIndex: index, target });
                }
            }
        }
        results.push(declResult);
    });

    return results;
};

module.exports = {
    hasDuplicate,
    isValid,
    matchPatternProp,
    setAllProps,
    setDeclProps,
    validateDeclarationArray
};

/**
 * Copyright 2022 F5 Networks, Inc.
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
const schema = require('../../src/schema/latest/adc-schema.json');
const as3ReqSchema = require('../../src/schema/latest/as3-request-schema.json');

function getTypes(property) {
    let types = [];
    if (property.type !== undefined) {
        if (typeof property.type === 'string') {
            types.push(property.type);
        } else {
            types = property.type;
        }
        if (types[0] === 'array' && property.items) {
            const arrayTypes = getTypes(property.items);
            types[0] += `<${arrayTypes}>`;
        }
    }
    if (property.allOf && property.type === undefined) {
        property.allOf.forEach((p) => {
            const key = Object.keys(p)[0];
            if (key !== 'required') {
                types.push(getTypes(p));
            }
        });
    }
    if (property.oneOf && property.type === undefined) {
        property.oneOf.forEach((p) => types.push(getTypes(p)));
    }
    if (property.anyOf && property.type === undefined) {
        property.anyOf.forEach((p) => types.push(getTypes(p)));
    }
    if (property.if && property.if.type !== undefined) {
        types.push(property.if.type);
    }
    if (property.then && property.then.type !== undefined) {
        types.push(property.then.type);
    }
    if (property.then && property.then.$ref && !property.then.$ref.includes('F5string')) {
        const refName = property.then.$ref.split('/').pop();
        types.push(refName);
    }
    if (property.else && property.else.type !== undefined) {
        types.push(property.else.type);
    }
    if (property.else && property.else.$ref && !property.else.$ref.includes('F5string')) {
        const refName = property.else.$ref.split('/').pop();
        types.push(refName);
    }
    if (property.$ref) {
        const refName = property.$ref.split('/').pop();
        types.push(refName);
    }
    if (property.additionalProperties && property.additionalProperties.$ref) {
        const refName = property.additionalProperties.$ref.split('/').pop();
        types.push(refName);
    }
    if (types.length === 0) {
        types.push('reference');
    }

    return types.join(' | ');
}

function getDefault(property) {
    let pDefault = '-';
    if (property.default !== undefined) {
        if (Array.isArray(property.default)) {
            pDefault = property.default.join(', ');
        } else if (typeof property.default === 'object') {
            pDefault = JSON.stringify(property.default);
        } else if (typeof property.default === 'string') {
            pDefault = `"${property.default}"`;
        } else {
            pDefault = property.default;
        }
    }
    return pDefault;
}

function getDescription(property) {
    return property.description || '-';
}

function getValues(property, type) {
    type = type || property.type;
    const defaultValue = '-';

    if (Array.isArray(type)) {
        return type
            .map((subType) => getValues(property, subType))
            .filter((v) => v !== defaultValue)
            .join(', ');
    }
    if (property.if && property.then) {
        const thenSchema = Object.assign({}, property.if, property.then);
        let value = getValues(thenSchema);
        if (property.else) {
            value = `${value}, ${getValues(property.else)}`;
        }
        return value;
    }
    if (type === 'string') {
        if (property.const) return `"${property.const}"`;
        if (property.enum) return property.enum.map((s) => `"${s}"`).join(', ');
        if (property.pattern) return `regex: ${property.pattern}`;
        if (property.format) return `format: ${property.format}`;
    }
    if (type === 'array') {
        if (property.items) return getValues(property.items);
    }
    if (type === 'boolean') {
        return 'true, false';
    }
    if (type === 'integer') {
        const min = (!property.minimum && property.minimum !== 0) ? '-infinity' : property.minimum;
        const max = (!property.maximum && property.maximum !== 0) ? 'infinity' : property.maximum;
        return `[${min}, ${max}]`;
    }
    return defaultValue;
}

function addTable(props, rstBody, defName) {
    if (Object.keys(props).length > 0) {
        const rstArray = [];
        rstBody += '**Properties:**\n\n';
        rstBody += '.. list-table::\n';
        rstBody += '      :widths: 20 15 15 50\n';
        rstBody += '      :header-rows: 1\n\n';
        rstBody += '      * - Name (Type)\n';
        rstBody += '        - Default\n';
        rstBody += '        - Values\n';
        rstBody += '        - Description\n';
        Object.keys(props)
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .forEach((propName) => {
                const p = props[propName];
                let types = getTypes(p);
                if (types.includes('array<') && types.includes('object') && defName) {
                    types = types.replace('object', `${defName}_${propName}`);
                    objectTable(p, rstArray, defName, propName, 'array');
                }
                if (types.includes('object') && !types.includes('array') && defName) {
                    types = types.replace('object', `${defName}_${propName}`);
                    objectTable(p, rstArray, defName, propName, 'object');
                }
                rstBody += `      * - **${propName}** (*${types}*)\n`;
                rstBody += `        - ${getDefault(p)}\n`;
                rstBody += `        - ${getValues(p)}\n`;
                rstBody += `        - ${getDescription(p)}\n`;
            });
        if (rstArray.length > 0) {
            rstArray.forEach((table) => {
                rstBody += table;
            });
        }
    }
    return rstBody;
}

function objectTable(props, rstArray, defName, propName, type) {
    const itemProps = {};
    let table = `\n${defName}_${propName}\n${'-'.repeat(defName.length + propName.length + 1)}\n\n`;
    if (type === 'array') {
        getProperties(props.items, itemProps, defName);
        if (Object.keys(itemProps).length > 0) {
            table += `${defName} ${propName} possible properties when object type\n\n`;
            table = addTable(itemProps, table);
            rstArray.push(table);
        }
    } else if (type === 'object') {
        getProperties(props, itemProps, defName);
        if (Object.keys(itemProps).length > 0) {
            table += `${defName} ${propName} possible properties\n\n`;
            table = addTable(itemProps, table);
            rstArray.push(table);
        }
    }
}

console.log('Building schema-reference.rst for Reference section');

const defs = schema.definitions;
defs.ADC = schema;

const as3Defs = as3ReqSchema.definitions;
// adc def in as3-request-schema was a placeholder only
delete as3Defs.ADC;
Object.assign(defs, as3Defs);

let rstBody = '.. _schema-reference:\n\n';
rstBody += 'Appendix A: Schema Reference\n';
rstBody += '============================\n';
rstBody += 'This page is a reference for the objects you can use in your Declarations for AS3. For more information on BIG-IP objects and terminology, see the BIG-IP documentation at https://support.f5.com/csp/home.\n\n';

// fill in monitors from the ref
defs.Pool_Member.properties.monitors.items = defs.Basic_Monitor.then.enum;
defs.Pool.properties.monitors.items = defs.Basic_Monitor.then.enum;

function labelRemarkReference(key) {
    return {
        description: defs[key].description,
        type: 'string',
        pattern: defs[key].pattern
    };
}

function getProperties(definition, props, defName) {
    function collectProperty(k, definitionProps) {
        if (k === 'remark' || k === 'label') {
            props[k] = (k === 'remark') ? labelRemarkReference('Remark')
                : labelRemarkReference('Label');
        } else if (!Object.prototype.hasOwnProperty.call(props, k) && k !== '') {
            props[k] = {};
            Object.assign(props[k], definitionProps[k]);
        }
    }

    if (definition.properties) {
        Object.keys(definition.properties).forEach((k) => {
            collectProperty(k, definition.properties);
        });
    }
    if (definition.patternProperties) {
        Object.keys(definition.patternProperties).forEach((k) => {
            collectProperty(k, definition.patternProperties);
        });
    }
    Object.keys(definition).forEach((key) => {
        if (key === 'if' || key === 'then' || key === 'else') {
            conditionalDescription(definition, props, defName);
            getProperties(definition[key], props, defName);
        } else if (key === 'allOf' || key === 'oneOf' || key === 'anyOf') {
            definition[key].forEach((item, index) => {
                let subProp = definition[key][index];
                if (Object.keys(item)[0] === '$ref' && defs[defName].definitions) {
                    subProp = defs[defName].definitions[item.$ref.split('/').pop()];
                }

                getProperties(subProp, props, defName);
            });
        } else if (key === '$ref') {
            getProperties(defs[definition[key].split('/').pop()], props, defName);
        }
    });
}

function conditionalDescription(definition, props, defName) {
    if ((definition.if && definition.if.properties)
        || (definition.else && definition.else.properties)) {
        const conditionalProps = definition.then;
        if (conditionalProps.properties) {
            const conditionalKey = Object.keys(definition.if.properties)[0];
            let conditionalValue = definition.if.properties[conditionalKey].const;
            if (!conditionalValue) {
                conditionalValue = `one of [${definition.if.properties[conditionalKey].enum.join(', ')}]`;
            }
            Object.keys(conditionalProps.properties).forEach((prop) => {
                if (conditionalProps.properties[prop].type && conditionalProps.properties[prop].description
                    && !conditionalProps.properties[prop].description.search('--- *Note:')) {
                    conditionalProps.properties[prop].description += ` --- *Note: This property is available only when* **${conditionalKey}** *is '${conditionalValue}'* ---`;
                    props[prop] = conditionalProps.properties[prop];
                }
            });

            if (definition.else) {
                const elseProps = {};
                getProperties(definition.else, elseProps, defName);
                Object.keys(elseProps).forEach((prop) => {
                    if (elseProps[prop].type) {
                        if (!elseProps[prop].description || elseProps[prop].description.length === 0 || elseProps[prop].description.indexOf('Note: property available') === -1) {
                            elseProps[prop].description += ` --- *Note: This property is available only when* **${conditionalKey}** *is NOT '${conditionalValue}'* ---`;
                        }
                        props[prop] = elseProps[prop];
                    }
                });
            }
        }
    }
}

Object.keys(defs).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .forEach((defName) => {
        if (defName === 'ADC') {
            // console.log(JSON.stringify(defs.AS3));
        }

        if (defName.includes('Template_')
            // hide trivial features (Label, Remark..)
            || defName.includes('Constants')
            || defName.includes('Label')
            || defName.includes('Remark')
            // hide classes used only as internal references
            || defName.includes('Basic_Persist')
            || defName.includes('Basic_Monitor')
            || defName.includes('Config_Ref')
            || defName.includes('F5string')
            || defName.includes('_May_Adapt')
            || defName.includes('_Core')) {
            return;
        }

        const props = {};
        getProperties(defs[defName], props, defName);
        rstBody += '\n';
        rstBody += `${defName}\n`;
        rstBody += `${'-'.repeat(defName.length)}\n\n`;
        rstBody += `${defs[defName].description || '*No description provided*'}\n\n`;
        if (Object.keys(props).length > 0) {
            rstBody = addTable(props, rstBody, defName);
        } else if (Object.keys(props).length === 0) {
            if (defs[defName].if && defs[defName].then) {
                if (defs[defName].then.f5PostProcess && defs[defName].then.f5PostProcess.tag === 'pointer') {
                    rstBody += `Pointer string to ${getValues(defs[defName]
                        .then.f5PostProcess.data.properties.class, 'string')} type\n\n`;
                }
                if (defs[defName].else.properties) {
                    rstBody += 'Can also be object:\n\n';
                    rstBody = addTable(defs[defName].else.properties, rstBody, defName);
                }
            } else if (defs[defName].enum) {
                rstBody += 'Type string with possible values:\n';
                rstBody += `${defs[defName].enum.map((s) => `"${s}"`).join(', ')}\n`;
            } else if (defs[defName].type === 'array' && defs[defName].items.$ref) {
                // pickup arrays from as3-request-schema
                const defRefs = defs[defName].items.$ref.split('/');
                rstBody += `For item definition, see type (*${defRefs[defRefs.length - 1]}*)\n\n`;
            } else {
                rstBody += 'No properties\n\n';
            }
        }
    });

fs.writeFileSync('docs/refguide/schema-reference.rst', rstBody);

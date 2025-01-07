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
const util = require('util');
const rimraf = require('rimraf').rimraf;
const schemaDoc = require('f5-schema-doc');
const schemaBuild = require('./schema-build').build;

const rimrafPromise = (filepath, options) => {
    if (options === undefined || options === null) options = {};
    return rimraf(filepath, options);
};

const ROOT = `${__dirname}/../..`;

function walkSchema(schema, preFunc) {
    preFunc(schema);
    if (typeof schema === 'object') {
        Object.values(schema || {}).forEach((v) => walkSchema(v, preFunc));
    }
}

function loadSchema(path) {
    return Promise.resolve()
        .then(() => util.promisify(fs.readFile)(path))
        .then((data) => JSON.parse(data));
}

function translateTopLevel(schema) {
    schema.definitions.ADC = JSON.parse(JSON.stringify(schema));
    delete schema.definitions.ADC.definitions;
}

function processDefinitions(schema, blackboard) {
    Object.entries(schema.definitions).forEach(([key, value]) => {
        blackboard.set(key, {
            isClass: !!(value.properties && value.properties.class),
            referencedBy: new Set(),
            usedByClass: new Set()
        });
    });

    Object.entries(schema.definitions).forEach(([key, value]) => {
        function findReferences(current) {
            if (current.$ref) {
                const def = current.$ref.split('/').pop();
                blackboard.get(def).referencedBy.add(key);
            }
        }
        walkSchema(value, findReferences);
    });

    function walkRefs(name, className) {
        blackboard.forEach((value, key) => {
            if (value.referencedBy.has(name)) {
                value.usedByClass.add(className);
                walkRefs(key, className);
            }
        });
    }
    blackboard.forEach((value, key) => {
        const skipList = [
            'ADC',
            'Tenant',
            'Application',
            'Application_Shared'
        ];
        if (!value.isClass || skipList.includes(key)) return;
        walkRefs(key, key);
    });

    [
        'Template_https',
        'Template_http',
        'Template_tcp',
        'Template_udp',
        'Template_sctp',
        'Template_l4',
        'Template_generic'
    ].forEach((template) => {
        blackboard.get(template).usedByClass.add('Application');
    });

    blackboard.forEach((value, key) => {
        value.referencedBy = [...value.referencedBy];
        value.usedByClass = [...value.usedByClass];
        value.isPointer = key.startsWith('Pointer');
        value.isEnum = key.startsWith('Enum');
        value.isCommon = (
            !value.isClass
            && value.usedByClass.length > 1
            && !value.isPointer
            && !value.isEnum
        );
    });
}

function fixFileRefs(schema, blackboard) {
    function fixRef(subSchema) {
        if (subSchema.$ref) {
            const reference = subSchema.$ref.split('/').pop();
            const metadata = blackboard.get(reference);
            if (metadata.isClass) {
                subSchema.$ref = `${reference}.schema.json`;
            } else if (metadata.isPointer) {
                subSchema.$ref = `Pointers.schema.json#/definitions/${reference}`;
            } else if (metadata.isEnum) {
                subSchema.$ref = `Enums.schema.json#/definitions/${reference}`;
            } else if (metadata.isCommon) {
                subSchema.$ref = `Common.schema.json#/definitions/${reference}`;
            }
        }
    }
    walkSchema(schema, fixRef);
}

function writeFiles(schema, blackboard, outDir) {
    function gatherDefinitions(name, data) {
        [...blackboard.entries()]
            .filter(([, value]) => !value.isPointer && !value.isEnum && !value.isCommon)
            .forEach(([refKey, refValue]) => {
                if (refValue.usedByClass.includes(name)) {
                    data.definitions = data.definitions || {};
                    data.definitions[refKey] = schema.definitions[refKey];
                }
            });
    }

    const promises = [];

    function createDefinitionsFile(name, filter) {
        const data = {};
        [...blackboard.entries()]
            .filter(filter)
            .map(([key]) => [key, schema.definitions[key]])
            .forEach(([key, value]) => {
                data[key] = value;
            });
        fixFileRefs(data, blackboard);
        const output = {
            title: name,
            definitions: data
        };
        return util.promisify(fs.writeFile)(`${outDir}/${name}.schema.json`, JSON.stringify(output));
    }

    promises.push(createDefinitionsFile('Common', ([, value]) => value.isCommon));
    promises.push(createDefinitionsFile('Pointers', ([, value]) => value.isPointer));
    promises.push(createDefinitionsFile('Enums', ([, value]) => value.isEnum));

    promises.push(...[...blackboard.entries()]
        .filter(([, value]) => value.isClass)
        .map(([key]) => {
            const path = `${outDir}/${key}.schema.json`;
            const data = schema.definitions[key];
            gatherDefinitions(key, data);
            fixFileRefs(data, blackboard);
            return util.promisify(fs.writeFile)(path, JSON.stringify(data, null, 2));
        }));

    return Promise.all(promises);
}

function schemaReformat(inSchema, outDir) {
    let schema = null;
    const blackboard = new Map();
    return Promise.resolve()
        .then(() => loadSchema(inSchema))
        .then((data) => {
            schema = data;
        })
        .then(() => translateTopLevel(schema))
        .then(() => processDefinitions(schema, blackboard))
        .then(() => writeFiles(schema, blackboard, outDir));
}

function mkdirSafe(path) {
    return util.promisify(fs.mkdir)(path)
        .catch((error) => {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        });
}

if (require.main === module) {
    console.log(ROOT);
    Promise.resolve()
        .then(() => rimrafPromise(`${ROOT}/docs/_build/schema`))
        .then(() => rimrafPromise(`${ROOT}/docs/refguide/schemaref`))
        .then(() => schemaBuild())
        .then(() => mkdirSafe(`${ROOT}/docs/_build`))
        .then(() => mkdirSafe(`${ROOT}/docs/_build/schema`))
        .then(() => schemaReformat(
            `${ROOT}/src/schema/latest/adc-schema.json`,
            `${ROOT}/docs/_build/schema`
        ))
        .then(() => mkdirSafe(`${ROOT}/docs/refguide/schemaref`))
        .then(() => util.promisify(fs.readdir)(`${ROOT}/docs/_build/schema`))
        .then((files) => files.forEach((f) => schemaDoc(
            `${ROOT}/docs/_build/schema/${f}`,
            `${ROOT}/docs/refguide/schemaref/${f}.rst`
        )))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

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

const assert = require('assert');
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail',
        jsonPointers: true
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const formats = require('../../../src/lib/adcParserFormats');
const keywords = require('../../../src/lib/adcParserKeywords');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const parserScope = {
    postProcess: []
};
keywords.keywords.forEach((keyword) => ajv.addKeyword(keyword.name, keyword.definition(parserScope)));

const validate = ajv
    .compile(adcSchema);

describe('def-gslb-topology-schema.json', () => {
    let decl;

    beforeEach(() => {
        decl = {
            class: 'ADC',
            schemaVersion: '3.30.0',
            tenant: {
                class: 'Tenant',
                application: {
                    class: 'Application'
                }
            }
        };
    });

    describe('GSLB_Topology_Records', () => {
        it('should validate with record that points to GSLB_Pool', () => {
            decl.tenant.application.gslbPool = {
                class: 'GSLB_Pool',
                resourceRecordType: 'A'
            };
            decl.tenant.application.gslbTopologyRecords = {
                class: 'GSLB_Topology_Records',
                records: [
                    {
                        source: {
                            matchType: 'subnet',
                            matchValue: '192.0.2.1/32'
                        },
                        destination: {
                            matchType: 'pool',
                            matchValue: {
                                use: 'gslbPool'
                            }
                        }
                    }
                ]
            };
            assert.ok(validate(decl), getErrorString(validate));
        });
    });
});

function getErrorString() {
    return JSON.stringify(validate.errors, null, 4);
}

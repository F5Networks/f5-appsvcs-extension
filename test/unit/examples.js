/**
 * Copyright 2024 F5, Inc.
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

const sinon = require('sinon');
const fs = require('fs');
const assert = require('assert');

const StorageMemory = require('@f5devcentral/atg-storage').StorageMemory;
const Config = require('../../src/lib/config');
const Context = require('../../src/lib/context/context');
const SchemaValidator = require('../../src/lib/schemaValidator');
const As3Parser = require('../../src/lib/adcParser');
const Tag = require('../../src/lib/tag');
const util = require('../../src/lib/util/util');
const certUtil = require('../../src/lib/util/certUtil');
const declarationUtil = require('../../src/lib/util/declarationUtil');
const extractUtil = require('../../src/lib/util/extractUtil');
const DEVICE_TYPES = require('../../src/lib/constants').DEVICE_TYPES;

// For examples that are not /declare payloads
const ignoreList = [
    'example-disable-service-discovery.json',
    'example-enable-burst-handling.json'
];

describe('Examples', function () {
    this.timeout(5000);
    const schemaConfigs = [{
        paths: [`file://${__dirname}/../../src/schema/latest/adc-schema.json`]
    }];
    const schemaValidator = new SchemaValidator(DEVICE_TYPES.BIG_IP, schemaConfigs);
    const as3Parser = new As3Parser(schemaValidator);

    const targetContext = {
        deviceType: DEVICE_TYPES.BIG_IP
    };
    const context = Context.build(null, null, targetContext);
    context.host.parser = as3Parser;

    before(() => Promise.resolve()
        .then(() => schemaValidator.init())
        .then(() => Config.injectSettings(new StorageMemory())));

    beforeEach(() => {
        sinon.stub(util, 'getNodelist').resolves([]);
        sinon.stub(util, 'getVirtualAddressList').resolves([]);
        sinon.stub(util, 'getAccessProfileList').resolves([]);
        sinon.stub(util, 'getAddressListList').resolves([]);
        sinon.stub(util, 'getSnatTranslationList').resolves([]);
        sinon.stub(util, 'isOneOfProvisioned').returns(true);
        sinon.stub(util, 'httpRequest').resolves('');
        sinon.stub(util, 'versionLessThan').returns(false);

        sinon.stub(certUtil, 'validateCertificates').returns([]);

        sinon.stub(Tag.SecretTag, 'process').resolves();
        sinon.stub(Tag.LongSecretTag, 'process').resolves();
        sinon.stub(Tag.CheckResourceTag, 'process').resolves();
        sinon.stub(Tag.BigComponentTag, 'process').resolves();

        sinon.stub(extractUtil, 'extractPkcs12').resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    const examples = fs.readdirSync('examples/declarations')
        .filter(
            (exampleName) => exampleName.endsWith('.json')
            && ignoreList.indexOf(exampleName) === -1
        );

    examples.forEach((exampleName) => {
        it(exampleName, function () {
            let example = JSON.parse(
                fs.readFileSync(`examples/declarations/${exampleName}`)
            );

            if (!Array.isArray(example)) {
                if (declarationUtil.isAS3(example)) {
                    example = example.declaration;
                }

                if (declarationUtil.isADC(example)) {
                    example.id = example.id || 'test';
                }

                return as3Parser.digest(context, example)
                    .then((result) => {
                        assert.deepStrictEqual(result.warnings, []);
                    })
                    .catch((err) => {
                        if (err.errors) {
                            return Promise.reject(new Error(JSON.stringify(err.errors)));
                        }
                        return Promise.reject(err);
                    });
            }
            return Promise.resolve();
        });
    });
});

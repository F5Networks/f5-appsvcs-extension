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

const fs = require('fs');
const rimraf = require('rimraf');
const Mocha = require('mocha');
const schema = require('../../src/schema/latest/adc-schema.json');
const propertiesCommon = require('../../test/integration/bigip/property/propertiesCommon');
const globalSetup = require('../../test/integration/bigip/property/mochaHooks').mochaGlobalSetup;
const rootHooks = require('../../test/integration/bigip/property/mochaHooks').mochaHooks;

const rimrafPromise = (filepath, options) => {
    if (options === undefined || options === null) options = {};
    return new Promise((resolve, reject) => {
        rimraf(filepath, options, (err) => (err ? reject(err) : resolve()));
    });
};

function generateTestDeclarations() {
    const dir = './test/integration/bigip/property';
    const mocha = new Mocha({ reporter: 'dot' });

    process.env.DRY_RUN = true;
    propertiesCommon.getDefaultOptions().dryRun = true;
    mocha.globalSetup(globalSetup);
    mocha.rootHooks(rootHooks);
    fs.readdirSync(dir).forEach((file) => mocha.addFile(`${dir}/${file}`));

    return new Promise((resolve, reject) => {
        mocha.run((err) => {
            if (err) reject(new Error('Dry run of property tests failed'));
            else resolve();
        });
    });
}

function combineDeclarations() {
    let current;
    const declaration = {
        class: 'ADC',
        updateMode: 'selective',
        schemaVersion: schema.properties.schemaVersion.enum[0],
        id: 'declarationId',
        /* target: {
            hostName: 'theHost',
            address: '192.0.2.10'
        }, */
        label: 'theDeclaration',
        remark: 'All properties declaration',
        constants: {
            class: 'Constants',
            timestamp: '2018-12-10T19:23:45Z',
            newConstant: 100
        },
        Common: {
            class: 'Tenant',
            label: 'commonTenant',
            remark: 'Declaration Common tenant',
            enable: true,
            Shared: {
                class: 'Application',
                template: 'shared',
                enable: true
            },
            constants: {
                class: 'Constants',
                someConstant: 'A new constant'
            },
            controls: {
                class: 'Controls',
                logLevel: 'error',
                trace: true,
                fortune: false
            }
        },
        controls: {
            class: 'Controls',
            logLevel: 'error',
            trace: true,
            archiveId: '',
            archiveTimestamp: '2018-12-10T19:23:45Z'
        }
    };

    const dir = './test/logs';
    const suiteNames = fs.readdirSync(`${dir}`)
        .filter((name) => !name.includes('.log'));
    let testDirs = [];
    suiteNames.forEach((suiteName) => {
        fs.readdirSync(`${dir}/${suiteName}`).forEach((testName) => {
            testDirs.push(`${dir}/${suiteName}/${testName}`);
        });
    });

    testDirs = testDirs
        .filter((name) => !name.includes('SNAT_Pool/Update from IPv4 to mix'))
        .filter((name) => !name.includes('GSLB_Data_Center/All Properties'))
        .filter((name) => !name.includes('GSLB Prober Pool/All Properties'))
        .filter((name) => !name.includes('Service_Generic/Share address with pool'))
        .filter((name) => !name.includes('iRule/default - created under correct path'))
        .filter((name) => !name.includes('iRule/default - created with correct text value from base64'))
        .filter((name) => !name.includes('Certificate - PKCS12/Cert - OpenSSL CLI generated with passphrase'))
        .filter((name) => !name.includes('L4_Profile/Defaults'))
        .filter((name) => !name.includes('Pool/Mix Common and AS3 nodes'))
        .filter((name) => !name.includes('Security_Log_Profile/Basic'))
        .filter((name) => !name.includes('TCP_Profile/Defaults'))
        .filter((name) => !name.includes('TCP_Profile/intNegativeOne'))
        .filter((name) => !name.includes('TCP_Profile/intZero'))
        .filter((name) => !name.includes('Firewall_Port_List/Undefined Ports'))
        .filter((name) => !name.includes('Firewall_Address_List/Undefined Addresses'))
        .filter((name) => !name.includes('UDP_Profile/Defaults'))
        .filter((name) => !name.includes('DOS_Profile/should ERROR if only asm is enabled and these variables are set'));

    let tenantNum = 0;
    let tenantName;
    let sharedTestItem = 0;

    // Add tenants from property tests
    testDirs.forEach((testDir) => {
        const files = fs.readdirSync(testDir)
            .filter((name) => name.includes('.1.json') || name.includes('.0.json'));

        if (files[0]) {
            if (files[1]) {
                current = JSON.parse(fs.readFileSync(`${testDir}/${files[1]}`));
            } else {
                current = JSON.parse(fs.readFileSync(`${testDir}/${files[0]}`));
            }
            tenantName = Object.keys(current.declaration || []).find((key) => key.includes('TEST_'));
            if (!tenantName && current.Common && current.Common.Shared) {
                current.Common.Shared[`testItem_${sharedTestItem}`] = current.Common.Shared.testItem;
                delete current.Common.Shared.testItem;
                declaration.Common.Shared[`testItem_${sharedTestItem}`] = current.Common.Shared[`testItem_${sharedTestItem}`];
                sharedTestItem += 1;
            } else if (tenantName) {
                if (current.Common && current.Common.Shared) {
                    Object.keys(current.Common.Shared).forEach((key) => {
                        if (key.includes('test')) {
                            declaration.Common.Shared[key] = current.Common.Shared[key];
                        }
                    });
                }
                current[`${tenantName}_${tenantNum}`] = current.declaration[tenantName];
                delete current[tenantName];
                declaration[`${tenantName}_${tenantNum}`] = current[`${tenantName}_${tenantNum}`];
                tenantNum += 1;
            }
        }
    });

    fs.writeFileSync('examples/example-all.json', JSON.stringify(declaration, null, 4)
        .replace(new RegExp(`${process.env.TEST_RESOURCES_URL}`, 'g'), 'www.example.com/resources'));
}

rimrafPromise('./test/logs')
    .then(generateTestDeclarations)
    .then(combineDeclarations)
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });

/**
 * Copyright 2026 F5, Inc.
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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const requestUtil = require('../common/requestUtilPromise');
const { validateEnvVars } = require('../common/checkEnv');

const LOG_ROOT = 'test/logs';

const DEFAULT_START = 0;
const DEFAULT_STOP = 1000;
const DEFAULT_STEPS = 1;

const TEST_CONFIGS = [
    {
        name: 'app-fastl4',
        range: range()
    },
    {
        name: 'app-http',
        range: range()
    },
    {
        // TODO: Declarations with multiple WAF applications do not work reliably
        name: 'app-waf',
        range: range(2)
    },
    {
        name: 'tenant',
        range: range()
    },
    {
        name: 'pool-member',
        range: range()
    },
    {
        name: 'data-group',
        range: range()
    }
];

function range(stop, start, steps) {
    stop = stop || DEFAULT_STOP;
    start = start || DEFAULT_START;
    steps = steps || DEFAULT_STEPS;

    if (steps === 1) {
        return [stop];
    }

    const step = (stop - start) / (steps - 1);
    return Array(Math.ceil(steps)).fill(start).map((x, y) => Math.round(x + y * step));
}

function generateTenantDeclaration(size) {
    const declaration = {
        class: 'ADC',
        schemaVersion: '3.0.0',
        id: `pool-${size}`
    };

    for (let i = 0; i < size; i += 1) {
        declaration[`Tenant${i}`] = {
            class: 'Tenant',
            Application: {
                class: 'Application',
                template: 'generic'
            }
        };
    }
    return declaration;
}

function generatePoolMemberDeclaration(size) {
    const declaration = generateTenantDeclaration(1);
    const application = declaration.Tenant0.Application;

    const poolCount = size > 1 ? size : 1;
    application.Pool = {
        class: 'Pool',
        members: range(0, poolCount).map((i) => ({
            servicePort: 1000 + i,
            serverAddresses: ['192.0.2.0']
        }))
    };
    return declaration;
}

function generateAppDeclaration(size, vipOverrides, additionalItems) {
    const declaration = generateTenantDeclaration(1);
    const tenant = declaration.Tenant0;
    delete tenant.Application;

    tenant.Shared = {
        class: 'Application',
        template: 'shared',
        address: {
            class: 'Service_Address',
            virtualAddress: '192.0.2.0'
        }
    };

    for (let i = 0; i < size; i += 1) {
        const application = {
            class: 'Application',
            template: 'generic',
            vip: Object.assign({
                virtualPort: 10000 + i,
                virtualAddresses: [{ use: '/@/Shared/address' }]
            }, vipOverrides)
        };
        Object.assign(application, additionalItems);
        tenant[`Application${i}`] = application;
    }
    return declaration;
}

function generateAppFastL4Declaration(size) {
    return generateAppDeclaration(size, { class: 'Service_L4' });
}

function generateAppHTTPDeclaration(size) {
    return generateAppDeclaration(size, { class: 'Service_HTTP' });
}

function generateAppWAFDeclaration(size) {
    validateEnvVars(['TEST_RESOURCES_URL']);

    const policyHost = `${process.env.TEST_RESOURCES_URL}`;
    return generateAppDeclaration(
        size,
        {
            class: 'Service_HTTP',
            policyWAF: { use: 'wafPolicy' }
        },
        {
            wafPolicy: {
                class: 'WAF_Policy',
                url: `http://${policyHost}/asm-policy/wordpress_template_12.0.xml`
            }
        }
    );
}

function generateDataGroupDeclaration(size) {
    const declaration = generateTenantDeclaration(1);
    const application = declaration.Tenant0.Application;

    for (let i = 0; i < size; i += 1) {
        application[`DataGroup${i}`] = {
            class: 'Data_Group',
            keyDataType: 'string',
            records: [{
                key: 'key',
                value: 'value'
            }]
        };
    }

    return declaration;
}

function generateDeclaration(type, size) {
    switch (type) {
    case 'app-fastl4': return generateAppFastL4Declaration(size);
    case 'app-http': return generateAppHTTPDeclaration(size);
    case 'app-waf': return generateAppWAFDeclaration(size);
    case 'tenant': return generateTenantDeclaration(size);
    case 'pool-member': return generatePoolMemberDeclaration(size);
    case 'data-group': return generateDataGroupDeclaration(size);
    default: throw new Error(`Unknown configuration type: ${type}`);
    }
}

function waitForComplete(id) {
    const reqOpts = { path: `/mgmt/shared/appsvcs/task/${id}` };
    return Promise.resolve()
        .then(() => requestUtil.get(reqOpts))
        .then((response) => {
            const result = response.body.results[0];
            if (result.message === 'in progress') {
                return promiseUtil.delay(200).then(() => waitForComplete(id));
            }

            if (result.code !== 200) {
                throw new Error(`Unexpected async result: ${JSON.stringify(result, null, 2)}`);
            }

            return Promise.resolve();
        });
}

function processAsyncResponse(response) {
    if (response.statusCode !== 202) {
        throw new Error(
            `Received ${response.statusCode} status code on post: ${JSON.stringify(response.body, null, 2)}`
        );
    }
    const id = response.body.id;
    if (!id) {
        throw new Error('No id found in POST response');
    }
    return waitForComplete(response.body.id);
}

function postAndTime(declaration) {
    const time = Date.now();
    return Promise.resolve()
        .then(() => requestUtil.post({
            path: '/mgmt/shared/appsvcs/declare?async=true',
            retryCount: 0,
            body: declaration
        }))
        .then((response) => processAsyncResponse(response))
        .then(() => (Date.now() - time) / 1000)
        .catch((error) => {
            console.error(error);
            return 0;
        });
}

function clearState() {
    return Promise.resolve()
        .then(() => requestUtil.delete({ path: '/mgmt/shared/appsvcs/declare?async=true' }))
        .then((response) => processAsyncResponse(response));
}

function reportResults(config, results) {
    const outName = `${LOG_ROOT}/performance/${config.suite}-${config.name}`;
    const csv = ['count,time(ms)']
        .concat(results.map((r) => r.join(',')))
        .join('\n');
    fs.writeFileSync(`${outName}.csv`, csv);

    const name = `${config.suite}-${config.name}`;
    const plot = [
        'set term png',
        `set output "${name}.png"`,
        `set title "${name}"`,
        'set yrange [0:120]',
        `set xrange [${config.range[0]}:${config.range[config.range.length - 1]}]`,
        'set ylabel "Request Time in Seconds"',
        'set xlabel "Object Count"',
        'plot "-" with lines notitle'
    ]
        .concat(results.map((r) => r.join(' ')))
        .concat(['end'])
        .join('\n');
    fs.writeFileSync(`${outName}.plot`, plot);
}

function mkdirPromise(path) {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, (error) => {
            if (error && error.code !== 'EEXIST') reject(error);
            else resolve();
        });
    });
}

function initializeLogDir() {
    return mkdirPromise(`${LOG_ROOT}`).then(() => mkdirPromise(`${LOG_ROOT}/performance`));
}

module.exports = {
    TEST_CONFIGS,
    initializeLogDir,
    generateDeclaration,
    clearState,
    postAndTime,
    reportResults
};

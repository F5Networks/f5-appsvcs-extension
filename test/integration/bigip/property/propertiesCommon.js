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

const assert = require('assert');
const fs = require('fs');

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const arrayUtil = require('@f5devcentral/atg-shared-utilities').arrayUtils;
const classMap = require('../../../../src/lib/classes');
const pathMap = require('../../../../src/lib/paths.json');
const propertyMap = require('../../../../src/lib/properties.json');
const util = require('../../../../src/lib/util/util');
const schema = require('../../../../src/schema/latest/adc-schema.json');
const constants = require('../../../../src/lib/constants');
const requestUtil = require('../../../common/requestUtilPromise');
const { validateEnvVars } = require('../../../common/checkEnv');

function onLoad() {
    // In case of parallel run we'll have separate processes spawned to run tests(worker.js)
    // So skip this check.
    if (process.argv.indexOf('--require') === -1 && process.argv.indexOf('--skip-require') === -1 && !process.env.PARALLEL) {
        console.log('Missing `--require` command line argument. You should run with `--require test/integration/bigip/property/mochaHooks.js` or `--skip-require`.');
        process.exit(1);
    }
}

onLoad();

const consoleOptions = {
    declarations: false, // display the declarations that are created
    expectedActual: false, // display expected and actual values
    postRequest: false, // display the declaration we are about to POST
    postResult: false // display the result from the POST
};

let BIGIP_VERSION = '0.0.0';
let PROVISIONED_MODULES = [];
const GLOBAL_TIMEOUT = '15m';

const RETRY_OPTIONS = {
    retryCount: 5,
    retryInterval: 1000,
    retryIf: (error, response) => response && response.statusCode === 503
};

const DEFAULT_OPTIONS = {
    findAll: false,
    bigipItems: [],
    tenantName: null,
    applicationName: 'Application',
    dryRun: process.env.DRY_RUN,
    checkServices: false,
    skipIdempotentCheck: false,
    maxPathLength: constants.MAX_PATH_LENGTH,
    getMcpValueDelay: 0,
    mcpRetryDelay: 1000,
    maxMcpRetries: 0, // -1 will poll mcp indefinitely, until success or timeout,
    unchecked: false,
    trace: true,
    traceResponse: true
};

let eventStream;
let testInfo;

function setProvisionedModules(provisionedModules) {
    PROVISIONED_MODULES = provisionedModules.slice();
}

function setBigIpVersion(version) {
    BIGIP_VERSION = version;
}

function getDefaultOptions() {
    return DEFAULT_OPTIONS;
}

function setTestInfo(info) {
    testInfo = info;
}

function setEventStream(logStream) {
    eventStream = logStream;
}

function getEventStream() {
    return eventStream;
}

function extractPolicy(virtual, name) {
    if (!name) {
        return undefined;
    }
    const policy = virtual.policies.find((p) => p.name === name);
    if (!policy) {
        return `No policy found with a name of ${name}`;
    }
    return policy.name;
}

function extractProfile(virtual, name) {
    if (!name) {
        return undefined;
    }
    const profile = virtual.profiles.find((p) => p.name === name);
    if (!profile) {
        return undefined;
    }
    return profile.name;
}

function createExtractSecret(key, secret) {
    return (mcpObject) => {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            return mcpObject[key] ? mcpObject[key].substring(0, 3) : false;
        }
        return mcpObject[key] !== undefined && mcpObject[key] !== secret;
    };
}

function toCamelCase(string) {
    return string.replace(/-[a-z]/g, (x) => x[1].toUpperCase());
}

function toDashSeparated(string) {
    return string
        .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
        .replace(/_/g, '-');
}

function getIndexOrLast(array, index) {
    if (index >= array.length) {
        return array[array.length - 1];
    }
    return array[index];
}

function getInputValue(property, index) {
    if (typeof property.inputValue === 'undefined') {
        return undefined;
    }
    const value = getIndexOrLast(property.inputValue, index);

    if (typeof value === 'object') {
        return util.simpleCopy(value);
    }

    return value;
}

function getExpectedValue(property, index) {
    if (!property.expectedValue) {
        throw new Error(`The property ${property.name} has no expectedValue field`);
    }
    return getIndexOrLast(property.expectedValue, index);
}

function setDeepValue(source, path, value) {
    const pathComponents = path.split('.');

    if (!source) {
        return;
    }

    if (pathComponents.length === 1) {
        source[pathComponents[0]] = value;
        return;
    }

    const nextSource = source[pathComponents[0]];
    const nextPath = pathComponents.slice(1).join('.');
    setDeepValue(nextSource, nextPath, value);
}

function createDeclarations(as3Class, properties, options) {
    logEvent('createDeclarations');
    const declarations = [];

    const count = properties
        .map((p) => ((p.inputValue) ? p.inputValue.length : p.expectedValue.length))
        .reduce((result, current) => Math.max(result, current), 0);

    for (let i = 0; i < count; i += 1) {
        const declaration = {
            class: 'ADC',
            schemaVersion: schema.properties.schemaVersion.anyOf[1].const,
            id: `${as3Class}`
        };

        declaration.controls = {
            class: 'Controls',
            trace: options.trace,
            logLevel: 'debug',
            traceResponse: options.traceResponse
        };

        const itemDeclaration = { class: as3Class };
        properties.forEach((property) => {
            const inputValue = getInputValue(property, i);
            if (typeof inputValue !== 'undefined') {
                setDeepValue(itemDeclaration, property.name, inputValue);
            }
        });

        declaration[options.tenantName] = { class: 'Tenant' };
        if (!util.isEmptyOrUndefined(options.tenantRouteDomain)) {
            // to allow testing multiple route domains, it needs to be treated as an array
            declaration[options.tenantName].defaultRouteDomain = getIndexOrLast(
                arrayUtil.ensureArray(options.tenantRouteDomain), i
            );
        }

        const itemName = getItemName(options);
        declaration[options.tenantName][options.applicationName] = {
            class: 'Application',
            [itemName]: itemDeclaration
        };

        if (options.applicationName === 'Shared') {
            declaration[options.tenantName].Shared.template = 'shared';
        }

        const application = declaration[options.tenantName][options.applicationName];
        if (options.constants) {
            application.constants = options.constants.Application;
        }

        properties.forEach((property) => {
            if (property.referenceObjects) {
                Object.keys(property.referenceObjects).forEach((key) => {
                    application[key] = property.referenceObjects[key];
                });
            }
        });

        if (options.sharedObjects) {
            Object.keys(options.sharedObjects).forEach((key) => {
                if (key === 'Common') {
                    if (declaration.Common) {
                        declaration.Common.Shared = Object.assign(
                            {},
                            declaration.Common.Shared,
                            options.sharedObjects[key].Shared
                        );
                    } else {
                        declaration.Common = options.sharedObjects[key];
                    }
                } else {
                    declaration[options.tenantName][key] = options.sharedObjects[key];
                }
            });
        }

        declarations.push({
            class: 'AS3',
            persist: false,
            targetHost: options.targetHost,
            targetPort: options.targetPort,
            targetUsername: options.targetUsername,
            targetPassphrase: options.targetPassphrase,
            declaration
        });
    }

    if (consoleOptions.declarations) {
        console.log(`${JSON.stringify(declarations, null, 2)}`);
    }
    return declarations;
}

/**
 * Creates a VLAN.  BIGIP does not allow VLANs to be created if it is single NIC and DHCP is enabled.
 * This function will check to see if the VLAN was already created and temporarily disable DHCP if it is single NIC
 * before creating the VLAN.
 * @param {*} vlanName Name of the VLAN to be created.
 */
function createVlan(vlanName) {
    // Recently every latest BIGIP image in VIO from 13.1 to 16.1 is pre-packaged with an 'internal' VLAN.
    // There may still be a use for this function if developers are using older images or in the future if
    // tests create VLANs other than 'internal'.
    const globalPath = '/mgmt/tm/sys/global-settings';
    const vlanPath = '/mgmt/tm/net/vlan';

    let shouldCreate;
    let dhcpEnabled;

    const bigipItems = [
        {
            endpoint: vlanPath,
            data: {
                name: vlanName
            }
        }];

    return Promise.resolve()
        .then(() => getPath(vlanPath))
        .then((response) => { // if vlan missing then check if single nic enabled otherwise pass thru
            if (response && response.items && Array.isArray(response.items)) {
                shouldCreate = response.items.find((item) => item.name === vlanName) === undefined;
            }
            return shouldCreate ? getPath('/mgmt/tm/sys/db/provision.1nic') : Promise.resolve();
        })
        // if single nic enabled then discover if dhcp enabled otherwise pass thru
        .then((response) => ((response && response.value === 'enable') ? getPath(globalPath) : Promise.resolve()))
        .then((response) => { // if dhcp enabled then disable dhcp otherwise pass thru
            if (response) dhcpEnabled = response.mgmtDhcp === 'enabled';
            return (dhcpEnabled ? patch(globalPath, { mgmtDhcp: 'disabled' }) : Promise.resolve());
        })
        .then(() => (shouldCreate ? postBigipItems(bigipItems, false) : Promise.resolve()))
        .catch((error) => {
            error.message = `Unable to create VLAN ${vlanName}: ${error}`;
            throw error;
        })
        .then(() => { // restore dhcp if previously set
            if (dhcpEnabled) { patch(globalPath, { mgmtDhcp: 'enabled' }); }
        });
}

function _waitForCompleteStatus(id, host) {
    logEvent(`waiting: ${id}`);
    const requestOptions = {
        path: `/mgmt/shared/appsvcs/task/${id}`
    };
    if (host) {
        requestOptions.host = host;
    }

    return requestUtil.get(requestOptions)
        .then((response) => {
            // If any result still has a code of 0, the request is still processing
            const results = response.body.results;
            const resultCodes = results.map((r) => r.code);
            logEvent(`result codes: ${resultCodes}`);
            if (resultCodes.indexOf(0) !== -1) {
                return promiseUtil.delay(1000).then(() => _waitForCompleteStatus(id, host));
            }
            return response.body;
        })
        .catch((err) => {
            // Check for AsyncContext timeout errors and retry
            if (err.message && err.message.includes('AsyncContext timeout')) {
                logEvent(`AsyncContext timeout detected, retrying in 5 seconds: ${err.message}`);
                return promiseUtil.delay(5000).then(() => _waitForCompleteStatus(id, host));
            }
            // Check for HTTP 500 errors that might be related to timeout
            if (err.statusCode === 500) {
                logEvent(`HTTP 500 error detected, retrying in 5 seconds: ${err.message}`);
                return promiseUtil.delay(5000).then(() => _waitForCompleteStatus(id, host));
            }
            logError(`Error while waiting for complete status: ${err.message}`);
            throw err;
        });
}

/**
 * Processes a declaration and response as a single declaration. Generally speaking this is the
 *   function you will want to develop tests with. Unless you know the specific reason you need
 *   another function to post declarations.
 *
 * @param {object} declaration - JSON declaration to be submitted
 * @param {object} [logInfo] - Info on needed to log declarations and results. If present, logs are written.
 * @param {number} [logInfo.declarationIndex] - The declaration index we are processing
 * @param {string} [queryParams] - The query parameters to be added to the request path
 * @param {string} [path] - The path to post to
 */
function postDeclaration(declaration, logInfo, queryParams, path) {
    const queryString = (typeof queryParams === 'undefined') ? '?async=true&controls.logLevel=debug' : queryParams;

    let promise = Promise.resolve();

    if (logInfo) {
        promise = promise.then(() => {
            const fileName = `${testInfo.testDir}/${testInfo.testName}.${logInfo.declarationIndex}.json`;
            const declBody = JSON.stringify(declaration, null, 4);
            fs.writeFileSync(fileName, declBody);
        });
    }

    logEvent(`posting declaration ${logInfo ? logInfo.declarationIndex : ''}`);

    return promise
        .then(() => sendDeclaration(declaration, queryString, path))
        .then((response) => {
            if (queryString.includes('async=true')) {
                return _waitForCompleteStatus(response.body.id);
            }
            return Promise.resolve(response.body);
        })
        .then((result) => {
            logEvent('got response');
            if (logInfo) {
                const fileName = `${testInfo.testDir}/${testInfo.testName}.${logInfo.declarationIndex}.response.json`;
                const responseBody = JSON.stringify(result, null, 4);
                fs.writeFileSync(fileName, responseBody);
            }
            return result;
        })
        .catch((error) => {
            error.message = `Unable to POST declaration: ${error}`;
            throw error;
        });
}

/**
 * Processes a declaration and response as a multi declaration, and returns an object with
 * the code and an items array. This items array holds the different declarations
 *
 * @param {object} declaration - JSON declaration to be submitted
 * @param {string} queryParams - The query parameters to be added to the request path
 */
function postMultiDeclaration(declaration, queryParams, path) {
    const queryString = (typeof queryParams === 'undefined') ? '?async=true' : queryParams;
    return sendDeclaration(declaration, queryString, path)
        .then((response) => {
            if (queryString.includes('async=true')) {
                const promises = [];
                response.body.items.forEach((item) => {
                    promises.push(_waitForCompleteStatus(item.id));
                });
                return Promise.all(promises); // GETs should be doable synchronously
            }
            return Promise.resolve(response.body);
        })
        .catch((error) => {
            error.message = `Unable to POST declaration: ${error}`;
            throw error;
        });
}

/**
 * Submits the declaration and the query params to the target BIG-IP and returns the response
 *
 * @param {object} declaration - JSON declaration to be submitted
 * @param {string} queryParams - The query parameters to be added to the request path
 * @param {string} path - The endpoint the declaration is sent to
 * @param {object} headerObject - An object containing customer headers
 */
function sendDeclaration(declaration, queryString, path, headerObject) {
    logEvent('sending declaration');
    path = path || '/mgmt/shared/appsvcs/declare';
    const reqOpts = {
        path: `${path}${queryString}`,
        body: declaration,
        headers: headerObject
    };

    return requestUtil.post(reqOpts);
}

function postDeclarationToFail(declaration) {
    logEvent('posting declaration to fail');
    const reqOpts = {
        path: '/mgmt/shared/appsvcs/declare',
        body: declaration
    };
    return requestUtil.post(reqOpts)
        .then((response) => {
            if (response.statusCode !== 200) {
                throw new Error(
                    `Received expected failing response ${response.statusCode} status code while posting declaration`
                );
            }
            return response.body;
        })
        .catch((error) => {
            error.message = `Unable to POST declaration: ${error}`;
            return error;
        });
}

/**
 * Sends a patch request
 *
 * @param {string} path - path to PATCH
 * @param {object} body - JSON body to be submitted
 * @param {object} [options] - options for function
 * @param {object} [options.headers] - additional headers to add to request
 * @param {object} [options.logInfo] - info needed to log request and results. If present, logs are written
 * @param {number} [options.logInfo.patchIndex] - patch index we are processing
 */
function patch(path, body, options) {
    const headers = (options || {}).headers;
    const logInfo = (options || {}).logInfo;
    let promise = Promise.resolve();

    if (logInfo) {
        promise = promise.then(() => {
            const fileName = `${testInfo.testDir}/${testInfo.testName}.${logInfo.patchIndex}.patch.json`;
            const patchBody = JSON.stringify(body, null, 4);
            fs.writeFileSync(fileName, patchBody);
        });
    }

    logEvent(`patch request ${logInfo ? logInfo.patchIndex : ''}`);

    const requestOptions = {
        path,
        body,
        headers
    };
    return promise
        .then(() => requestUtil.patch(requestOptions))
        .then((response) => {
            logEvent(`patch response ${logInfo ? logInfo.patchIndex : ''}`);
            if (logInfo) {
                const fileName = `${testInfo.testDir}/${testInfo.testName}.${logInfo.patchIndex}.patch.response.json`;
                const responseBody = JSON.stringify(response.body, null, 4);
                fs.writeFileSync(fileName, responseBody);
            }
            return response;
        });
}

function getDeclaration(declaration) {
    logEvent('get Declaration');
    const path = `/mgmt/shared/appsvcs/declare/${declaration || ''}`;

    return getPath(path);
}

function getPath(path, fullResponse, headerObject) {
    logEvent('get Path');
    if (!path) {
        throw new Error('path was not provided for getPath()');
    }

    const reqOpts = {
        path,
        headers: headerObject
    };

    return requestUtil.get(reqOpts)
        .then((response) => (fullResponse ? response : response.body))
        .catch((error) => {
            error.message = `Unable to GET declaration: ${error}`;
            throw error;
        });
}

function getPathFullResponse(path) {
    return getPath(path, true);
}

function createTransaction() {
    logEvent('creating transaction');
    const reqOpts = {
        path: '/mgmt/tm/transaction',
        body: {},
        headers: process.env.TARGET_HOST ? {} : {
            'X-F5-Auth-Token': DEFAULT_OPTIONS.token
        },
        host: process.env.TARGET_HOST || process.env.AS3_HOST
    };

    return requestUtil.post(reqOpts)
        // Transaction response does not always mean that it's ready.
        // Wait a couple seconds to avoid race condition.
        .then((response) => promiseUtil.delay(2000).then(() => response.body.transId))
        .catch((error) => {
            error.message = `Unable to POST transaction: ${error}`;
            throw error;
        });
}

function commitTransaction(transId) {
    logEvent(`committing transaction: ${transId}`);
    const reqOpts = {
        path: `/mgmt/tm/transaction/${transId}`,
        body: { state: 'VALIDATING' },
        headers: process.env.TARGET_HOST ? {} : {
            'X-F5-Auth-Token': DEFAULT_OPTIONS.token
        },
        host: process.env.TARGET_HOST || process.env.AS3_HOST
    };

    return requestUtil.patch(reqOpts)
        .catch((error) => {
            error.message = `Unable to PATCH transaction: ${error}`;
            throw error;
        })
        .then((response) => {
            if (response.body.state === 'COMPLETED') {
                return Promise.resolve();
            }
            return waitForCompleteTransaction(transId);
        });
}

function waitForCompleteTransaction(transId) {
    logEvent(`waiting for transaction completion: ${transId}`);
    const reqOpts = {
        path: `/mgmt/tm/transaction/${transId}`,
        headers: process.env.TARGET_HOST ? {} : {
            'X-F5-Auth-Token': DEFAULT_OPTIONS.token
        },
        host: process.env.TARGET_HOST || process.env.AS3_HOST
    };

    return requestUtil.get(reqOpts)
        .then((response) => {
            if (response.body.state === 'VALIDATING') {
                return promiseUtil.delay(1000).then(() => waitForCompleteTransaction(transId));
            }
            if (response.body.state === 'COMPLETED') {
                return Promise.resolve();
            }

            return Promise.reject(new Error(`Unexpected state (${response.body.state})`));
        })
        .catch((error) => {
            if (error.message.indexOf('TimeoutException') > -1) {
                return promiseUtil.delay(1000).then(() => waitForCompleteTransaction(transId));
            }
            error.message = `Unable to complete transaction: ${error}`;
            throw error;
        });
}

function postBigipItems(items, useTransaction) {
    logEvent('posting BIG-IP items');
    let transId;

    if (items.length === 0) {
        return Promise.resolve();
    }

    return (useTransaction ? createTransaction().then((id) => { transId = id; }) : Promise.resolve())
        .then(() => promiseUtil.series(
            items.map((item) => () => {
                const itemHeaders = Object.assign(
                    {},
                    item.headers
                );

                if (!process.env.TARGET_HOST) {
                    itemHeaders['X-F5-Auth-Token'] = DEFAULT_OPTIONS.token;
                }

                if (typeof transId !== 'undefined') {
                    itemHeaders['X-F5-REST-Coordination-Id'] = transId;
                }

                const reqOpts = {
                    path: item.endpoint,
                    body: item.data,
                    headers: itemHeaders,
                    retryCount: 5,
                    retryInterval: 1000,
                    retryIf: (error) => error,
                    host: process.env.TARGET_HOST || process.env.AS3_HOST
                };

                return requestUtil.post(reqOpts)
                    .catch((error) => {
                        if (error.message.includes('"code": 409')) {
                            return;
                        }
                        error.message = `Unable to POST BigIP Items: ${error}`;
                        throw error;
                    });
            })
        ))
        .then(() => (typeof transId !== 'undefined' ? commitTransaction(transId) : Promise.resolve()));
}

/**
 * Runs DELETE requests against AS3. If a tenant is supplied it will target that tenant.
 *
 * @param {string} tenant - the name of the tenant you want deleted (DO NOT INCLUDE THE FORWARD SLASH)
 * @param {object} [options] - options for function
 * @param {boolean} [options.logResponse] - whether or not to log the response from the delete operation
 * @param {boolean} [options.sendDelete] - whether or not to send request as a DELETE or POST
 * @param {boolean} [options.path] - custom path to send DELETE request to
 */
function deleteDeclaration(tenant, options) {
    logEvent('delete Declaration');
    let requestPromise;
    let path = '/mgmt/shared/appsvcs/declare?async=true';
    if (tenant) {
        path = `/mgmt/shared/appsvcs/declare/${tenant}?async=true`;
    } else if (options && options.path) {
        path = options.path;
    }
    const reqOpts = {
        path,
        host: process.env.TARGET_HOST || process.env.AS3_HOST,
        retryCount: 3,
        retryIf: (error, response) => response && response.statusCode === 503
    };

    if (tenant || (options && options.sendDelete)) {
        requestPromise = requestUtil.delete(reqOpts);
    } else {
        reqOpts.body = {
            class: 'AS3',
            persist: false,
            action: 'remove'
        };
        requestPromise = requestUtil.post(reqOpts);
    }

    return requestPromise
        .then((response) => _waitForCompleteStatus(response.body.id, process.env.TARGET_HOST || process.env.AS3_HOST))
        .then((response) => {
            if (options && options.logResponse) {
                const fileName = `${testInfo.testDir}/${testInfo.testName}.delete.response.json`;
                const responseBody = JSON.stringify(response, null, 4);
                fs.writeFileSync(fileName, responseBody);
            }
            return response;
        })
        .catch((error) => {
            error.message = `Unable to DELETE declaration: ${error}`;
            console.log(error.message);
            throw error;
        });
}

function deleteBigipItems(items) {
    logEvent('delete BIG-IP items');
    return promiseUtil.series(items
        .filter((item) => !item.skipDelete)
        .map((item) => () => {
            if (item.endpoint.indexOf('file-transfer/uploads') > -1) {
                return Promise.resolve();
            }
            const reqOpts = {
                path: `${item.endpoint}/${encodeURIComponent(item.data.name)}`,
                headers: process.env.TARGET_HOST ? {} : {
                    'X-F5-Auth-Token': DEFAULT_OPTIONS.token
                },
                host: process.env.TARGET_HOST || process.env.AS3_HOST
            };

            return requestUtil.delete(reqOpts)
                .then((response) => response.body)
                .catch((error) => {
                    // Console intentionally left so delete will hit all items
                    error.message = `Unable to DELETE BigIP Items: ${error}`;
                    console.error(error);
                });
        }));
}

function deleteUser(username) {
    logEvent('deleting user');
    const reqOpts = {
        path: `/mgmt/tm/auth/user/${username}`
    };

    return requestUtil.delete(reqOpts)
        .then((response) => response.statusCode)
        .catch((error) => {
            error.message = `Unable to DELETE user: ${error}`;
            throw error;
        });
}

function resolveMcpReferences(mcpObject) {
    function resolveFromList(requestOptions) {
        const splitPath = requestOptions.path.split('/');
        const tmshPath = splitPath.pop().replace(/~/g, '/');
        requestOptions.path = splitPath.join('/');
        return requestUtil.get(Object.assign(requestOptions, RETRY_OPTIONS))
            .then((result) => resolveMcpReferences(result.body.items.find((i) => i.fullPath === tmshPath)));
    }

    function resolveFromItem(requestOptions, prop) {
        return requestUtil.get(Object.assign(requestOptions, RETRY_OPTIONS))
            .then((result) => {
                let value = result.body;
                if (mcpObject[prop].isSubcollection) {
                    value = result.body.items || [];
                }

                if (Array.isArray(value)) {
                    return Promise.all(value.map((v) => resolveMcpReferences(v)));
                }

                return resolveMcpReferences(value);
            });
    }

    const resolvedObject = util.simpleCopy(mcpObject);
    const referenceProperties = Object.keys(mcpObject).filter((n) => n.endsWith('Reference'));
    const promises = referenceProperties.map((prop) => {
        // Treat everything as an array until it matters again
        const isArray = Array.isArray(mcpObject[prop]);
        const mcpProps = (isArray) ? mcpObject[prop] : [mcpObject[prop]];

        const requests = mcpProps
            .map((p) => p.link.split('?')[0])
            .map((path) => {
                const requestOptions = {
                    path,
                    headers: process.env.TARGET_HOST ? {} : {
                        'X-F5-Auth-Token': DEFAULT_OPTIONS.token
                    },
                    host: process.env.TARGET_HOST || process.env.AS3_HOST
                };

                return Promise.resolve()
                    .then(() => {
                        if (path.includes('ltm/dns/tsig-key')) {
                            return resolveFromList(requestOptions);
                        }
                        return resolveFromItem(requestOptions, prop);
                    })
                    .catch((error) => {
                        error.message = `Unable to resolve reference for ${path}: ${error.message}`;
                        throw error;
                    });
            });

        return Promise.all(requests)
            .then((results) => {
                const value = (isArray) ? results : results[0];
                resolvedObject[prop.replace('Reference', '')] = value;
            });
    });

    return Promise.all(promises).then(() => resolvedObject);
}

function getMcpObject(as3Class, index, options) {
    let pathPrefix = `/${options.tenantName}/${options.applicationName}/`;
    if (options.mcpPath) {
        pathPrefix = options.mcpPath;
    }

    const itemName = options.mcpObjectName || getItemName(options);
    if (options.getMcpObject) {
        options.getMcpObject.itemName = options.getMcpObject.itemName || itemName;
        pathPrefix += options.getMcpObject.itemName;
    } else {
        pathPrefix += itemName;
    }

    let mcpClasses = classMap.toMcp[as3Class];
    if (!mcpClasses) {
        throw new Error(`Class ${as3Class} not found in classes.js`);
    }
    if (!Array.isArray(mcpClasses)) {
        mcpClasses = [mcpClasses];
    }

    mcpClasses = mcpClasses.filter((p) => {
        const found = pathMap.root.find((e) => e.endpoint === getMcpClassPath(p));
        return (!found || (
            ((!found.minimumVersion || !util.versionLessThan(BIGIP_VERSION, found.minimumVersion))
            && (!found.modules || (found.modules || []).every((m) => getProvisionedModules().includes(m))))));
    });

    function getMcpClassPath(path) {
        return `/mgmt/tm/${path.split(' ').join('/')}`;
    }

    const getClasses = Promise.all(
        mcpClasses.map((mcpClass) => {
            const requestOptions = {
                path: getMcpClassPath(mcpClass),
                headers: process.env.TARGET_HOST ? {} : {
                    'X-F5-Auth-Token': DEFAULT_OPTIONS.token
                },
                host: process.env.TARGET_HOST || process.env.AS3_HOST
            };
            const retryOptions = util.simpleCopy(RETRY_OPTIONS);
            retryOptions.retryIf = (error, response) => {
                if ((response && response.statusCode === 503)
                    || (error && error.message.includes('"code":401'))) {
                    return true;
                }
                return false;
            };
            return requestUtil
                .get(Object.assign(requestOptions, retryOptions))
                .then((response) => {
                    fs.writeFileSync(`${testInfo.testDir}/${testInfo.testName}.${index}.getMcpValue.json`, JSON.stringify(response.body, null, 4));
                    if (options.getMcpObject && (options.getMcpObject.itemKind || options.getMcpObject.refItemKind)) {
                        let results = [];
                        if (response.body.items) {
                            results = response.body.items.filter((i) => i.kind === options.getMcpObject.itemKind
                                && (i.name === options.getMcpObject.itemName || options.getMcpObject.skipNameCheck));
                        } else if (options.getMcpObject.refItemKind
                            && response.body.kind === options.getMcpObject.refItemKind) {
                            results = results.concat(response.body);
                        }

                        return results;
                    }

                    if (!response.body.items) {
                        return [];
                    }

                    return response.body.items.filter((i) => i.fullPath.startsWith(pathPrefix));
                })
                .catch((err) => {
                    console.log(`Error while getting mcpClass: ${err}`);
                    return undefined;
                });
        })
    );

    return getClasses
        .then((results) => {
            const mcpObjects = results
                .reduce((result, current) => result.concat(current), [])
                .filter((i) => i);

            if (mcpObjects.length === 0) {
                const found = JSON.stringify(results, null, 2);
                throw new Error(`Unable to find ${pathPrefix} on BIG-IP. Found: ${found}`);
            }

            return (options.findAll) ? mcpObjects : mcpObjects[0];
        });
}

function getPropertyFromKind(kind) {
    const pathComponents = kind.split(':').slice(1);
    let subMap = null;

    while (!subMap) {
        const path = pathComponents.join(' ');
        if (path === '') {
            throw new Error(`Unable to find an entry in properties.json for ${kind}`);
        }
        subMap = propertyMap[path];
        pathComponents.pop();
    }

    return subMap;
}

function isObjectAsArray(value) {
    if (!Array.isArray(value)) {
        return false;
    }
    if (value.length !== 1) {
        return false;
    }
    if (value[0].name !== 'undefined') {
        return false;
    }
    return true;
}

function extractMcpValue(mcpObject, mcpProperties, property) {
    const declPath = property.name.split('.');
    let mcpValue = mcpObject;
    let kind = mcpObject.kind.replace(/:[^:]*$/, '');
    let entry = null;
    while (declPath.length > 0) {
        const name = declPath.shift();
        if (!Number.isNaN(parseInt(name, 10))) {
            entry = {};
            mcpValue = mcpValue[parseInt(name, 10)];
        } else {
            const propDashFormat = toDashSeparated(name);
            const propMap = getPropertyFromKind(kind);
            entry = propMap.find((p) => p.id === propDashFormat || p.altId === name);
            if (!entry) {
                throw new Error(`No entry with id of ${propDashFormat} or altId of ${name}`);
            }
            kind = `${kind}:${entry.id}`;
            const propName = toCamelCase(entry.id);
            mcpValue = mcpValue[propName];
        }
        if (isObjectAsArray(mcpValue)) {
            mcpValue = mcpValue[0];
        }

        if (typeof mcpValue === 'undefined') {
            break;
        }
    }

    const minVersion = entry.minVersion || property.minVersion || '0.0.0.0';
    mcpProperties[property.name] = mcpValue;

    if (util.versionLessThan(BIGIP_VERSION, minVersion)) {
        assert.strictEqual(
            mcpProperties[property.name],
            undefined,
            `Found value for ${property.name}, but it is marked as unsupported on ${BIGIP_VERSION}`
        );
        mcpProperties._skip = mcpProperties._skip || [];
        mcpProperties._skip.push(property.name);
    }
}

function getMcpValue(as3Class, properties, index, options) {
    logEvent('getting MCP Value');
    return getMcpObject(as3Class, index, options)
        .then(resolveMcpReferences)
        .then((result) => {
            const mcpProperties = {};

            const extractPromises = properties
                .filter((p) => !p.skipAssert)
                .map((property) => {
                    if (property.extractFunction) {
                        const expected = getExpectedValue(property, index);
                        return Promise.resolve(property.extractFunction(result, expected))
                            .then((extracted) => { mcpProperties[property.name] = extracted; });
                    }
                    return Promise.resolve(extractMcpValue(result, mcpProperties, property));
                });

            return Promise.all(extractPromises)
                .then(() => mcpProperties);
        })
        .catch((error) => {
            error.message = `Unable to get MCP values for ${as3Class}: ${error.message}`;
            throw error;
        });
}

function checkMcpValue(result, properties, index) {
    logEvent('checking MCP Value');
    properties
        .filter((p) => !p.skipAssert && (!result._skip || !result._skip.includes(p.name)))
        .forEach((property) => {
            const value = getExpectedValue(property, index);
            // This print can be very helpful for debugging the expect vs receive vals
            if (consoleOptions.expectedActual) {
                console.log(`\t${property.name} => [ expected: ${value} ] [ actual: ${result[property.name]} ]`);
            }
            if (typeof value === 'number') {
                assert.equal(result[property.name],
                    value,
                    `${property.name}  value of ${result[property.name]} does not match expected value ${value}`);
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                Object.entries(value).forEach(([key, deepValue]) => {
                    assert.deepStrictEqual(
                        result[property.name][key],
                        deepValue,
                        `${property.name}.${key}  value of ${result[property.name]} does not match expected value ${value}`
                    );
                });
            } else {
                assert.deepStrictEqual(
                    (typeof result[property.name] === 'undefined') ? 'undefined' : result[property.name],
                    (typeof value === 'undefined') ? 'undefined' : value,
                    `${property.name}  value of ${result[property.name]} does not match expected value ${value}`
                );
            }
        });
    return Promise.resolve();
}

function configurePromiseForFail(declaration, partition) {
    return Promise.resolve()
        .then(() => postDeclarationToFail(declaration))
        .then((result) => {
            const message = (result.results !== undefined)
                ? result.results.find((r) => r.tenant === partition).message
                : result.message;
            assert.notStrictEqual(message, 'success', 'declaration failed as expected');
        });
}

function configurePromiseForSuccess(declaration, partition, as3Class, properties, index, fullOptions) {
    return Promise.resolve()
        .then(() => {
            if (consoleOptions.postRequest) {
                console.log(`\nPosting declaration:\n ${JSON.stringify(declaration, null, 2)}`);
            }
        })
        .then(() => {
            const logInfo = {
                declarationIndex: index
            };

            const queryParams = (fullOptions.unchecked) ? '?async=true&controls.logLevel=debug&unchecked=true' : undefined;

            if (index === 0) {
                // AS3 could be busy from failure in previous test
                // Retry on 503 for 2 and a half minutes on first post.
                // Also retry on AsyncContext timeout errors
                const options = {
                    delay: 10000,
                    retries: (2.5 * 60 * 1000) / 10000
                };

                return promiseUtil.retryPromise((decl, info) => postDeclaration(decl, info, queryParams)
                    .then((result) => {
                        if (result.results.some((r) => r.code === 503)) {
                            throw new Error('AS3 is busy');
                        }
                        // Check for AsyncContext timeout in response
                        if (result.results.some((r) => r.response && r.response.includes('AsyncContext timeout'))) {
                            logEvent('AsyncContext timeout detected in response, retrying...');
                            throw new Error('AsyncContext timeout detected');
                        }
                        return result;
                    }), options, [declaration, logInfo, queryParams]);
            }

            return postDeclaration(declaration, logInfo, queryParams);
        })
        .then((result) => {
            if (consoleOptions.postResult) {
                console.log(`\nGot result:\n ${JSON.stringify(result, null, 2)}`);
            }

            const partitionResults = result.results.filter((r) => r.tenant === partition);
            if (partitionResults.length === 0) {
                const resultString = JSON.stringify(result, null, 2);
                throw new Error(`Unable to find ${partition} in results: ${resultString}`);
            }
            if (partitionResults.length === 1) {
                assert.strictEqual(
                    partitionResults[0].message,
                    'success',
                    `declaration did not apply successfully: result: ${JSON.stringify(partitionResults[0])}`
                );
            } else {
                // If we have multiple results for a partition, we might get a no-change.
                // Assert that we got at least one success.
                const successResults = partitionResults.filter((r) => r.message === 'success');
                assert.notStrictEqual(successResults.length, 0);

                // Also assert that we got no failures
                let failureMessages;
                const failResults = partitionResults.filter((r) => r.message === 'declaration failed');
                if (failResults.length > 0) {
                    failureMessages = failResults.map((r) => r.response);
                }
                assert.strictEqual(failResults.length, 0, failureMessages);
            }
        })
        .then(() => {
            if (fullOptions.checkServices) {
                logEvent('checking services');
                return checkServices();
            }
            return Promise.resolve();
        })
        .then(() => getPreFetchFunctions(properties, index))
        .then(() => promiseUtil.delay(fullOptions.getMcpValueDelay))
        .then(() => {
            logEvent('getting and checking mcp value');
            const assertMcp = () => getMcpValue(as3Class, properties, index, fullOptions)
                .then((result) => checkMcpValue(result, properties, index));
            const options = {
                delay: fullOptions.mcpRetryDelay,
                retries: fullOptions.maxMcpRetries
            };
            return promiseUtil.retryPromise(assertMcp, options, []);
        })
        .then(() => logEvent('done getting and checking mcp value'))
        .then(() => {
            if (fullOptions.skipIdempotentCheck) {
                return Promise.resolve();
            }

            logEvent('checking idempotentcy');
            return Promise.resolve()
                .then(() => postDeclaration(declaration))
                .then((result) => {
                    const partitionResult = result.results.find((r) => r.tenant === partition);
                    if (!partitionResult) {
                        const resultString = JSON.stringify(result, null, 2);
                        throw new Error(`Unable to find ${partition} in results: ${resultString}`);
                    }

                    assert.strictEqual(
                        partitionResult.message,
                        'no change',
                        'declaration is not idempotent'
                    );
                });
        })
        .then(() => logEvent('done with idempotent check'))
        .then(() => {
            if (!fullOptions.skipIdempotentCheck && fullOptions.checkServices) {
                logEvent('checking services');
                return checkServices();
            }
            return Promise.resolve();
        });
}

function assertClass(as3Class, properties, options, sharedObjects, constantsOptions) {
    if (process.env.TARGET_HOST) {
        validateEnvVars(
            [
                'AS3_USERNAME',
                'AS3_PASSWORD'
            ]
        );
    }

    const fullOptions = Object.assign({}, DEFAULT_OPTIONS, options);
    fullOptions.sharedObjects = sharedObjects;
    fullOptions.constants = constantsOptions;
    fullOptions.tenantName = fullOptions.tenantName || `TEST_${as3Class}`;
    fullOptions.checkForFail = fullOptions.checkForFail || false;
    fullOptions.useTransaction = fullOptions.useTransaction || false;
    if (process.env.TARGET_HOST) {
        const hostPort = process.env.TARGET_HOST.split(':');
        fullOptions.targetHost = hostPort[0];
        fullOptions.targetPort = hostPort[1] ? parseInt(hostPort[1], 10) : 443;
        fullOptions.targetUsername = process.env.AS3_USERNAME;
        fullOptions.targetPassphrase = process.env.AS3_PASSWORD;
    }
    const testDeclarations = createDeclarations(as3Class, properties, fullOptions);
    const partition = fullOptions.tenantName;
    let promise = Promise.resolve();

    if (!fullOptions.dryRun) {
        promise = promise.then(() => postBigipItems(fullOptions.bigipItems, fullOptions.useTransaction));
    }

    testDeclarations.forEach((declaration, index) => {
        if (fullOptions.dryRun) {
            promise = promise.then(() => new Promise((resolve, reject) => {
                const fileName = `${testInfo.testDir}/${testInfo.testName}.${index}.json`;
                const declBody = JSON.stringify(declaration, null, 4);
                fs.writeFile(fileName, declBody, {}, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            }));
            return;
        }

        if (fullOptions.checkForFail) {
            promise = promise
                .then(() => configurePromiseForFail(declaration, partition));
        } else {
            promise = promise
                .then(() => configurePromiseForSuccess(
                    declaration,
                    partition,
                    as3Class,
                    properties,
                    index,
                    fullOptions
                ));
        }
    });

    function cleanUp(error) {
        logEvent('cleaning up');
        if (testDeclarations.length === 0) {
            if (error) {
                if (!error.stack) {
                    error = new Error(error);
                }
                return Promise.reject(error);
            }
            return Promise.resolve();
        }

        if (fullOptions.dryRun) {
            return Promise.resolve();
        }

        return deleteDeclaration(null, { logResponse: true })
            .then((result) => {
                if (error) {
                    throw error;
                }

                if (!fullOptions.checkForFail) {
                    const tenant = result.results.find((r) => r.tenant === partition);
                    const message = (tenant) ? tenant.message : `Unable to find tenant ${partition}`
                        + `\n${JSON.stringify(result.results, null, 2)}`;
                    assert.strictEqual(message, 'success', 'declaration did not delete successfully');
                }
            })
            .catch((newError) => {
                if (error) throw error;
                throw newError;
            })
            .finally(() => {
                if (fullOptions.checkServices) {
                    logEvent('checking services');
                    return checkServices();
                }
                return Promise.resolve();
            });
    }

    function cleanUpBigipItems(error) {
        logEvent('cleaning up BIG-IP items');
        if (DEFAULT_OPTIONS.dryRun) {
            return Promise.resolve();
        }
        return deleteBigipItems(fullOptions.bigipItems.reverse())
            .then(() => { if (error) throw error; })
            .catch((newError) => {
                if (error) throw error;
                throw newError;
            });
    }

    return promise
        .then(cleanUp, cleanUp)
        .then(cleanUpBigipItems, cleanUpBigipItems)
        .catch((err) => {
            logError(`Error asserting class ${testInfo.testDir}/${testInfo.testName}: ${err.message}`);
            throw err;
        });
}

function assertModuleProvisioned(module) {
    const testName = testInfo ? testInfo.testName : 'this test';
    if (DEFAULT_OPTIONS.dryRun) {
        return;
    }
    if (!getProvisionedModules().includes(module)) {
        if (process.env.SKIP_TEST_IF_UNPROVISIONED === 'true') {
            this.skip(`${testName} skipped: ${module} must be provisioned`);
        }
        assert.fail(`${module} must be provisioned for ${testName}`);
    }
}

function assertMultipleItems(as3Class, properties, count, sharedObjects, constantsOptions) {
    if (process.env.TARGET_HOST) {
        validateEnvVars(
            [
                'AS3_USERNAME',
                'AS3_PASSWORD'
            ]
        );
    }

    const fullOptions = Object.assign({}, DEFAULT_OPTIONS);
    fullOptions.sharedObjects = sharedObjects;
    fullOptions.constants = constantsOptions;
    fullOptions.tenantName = fullOptions.tenantName || `TEST_${as3Class}`;
    if (process.env.TARGET_HOST) {
        const hostPort = process.env.TARGET_HOST.split(':');
        fullOptions.targetHost = hostPort[0];
        fullOptions.targetPort = hostPort[1] ? parseInt(hostPort[1], 10) : 443;
        fullOptions.targetUsername = process.env.AS3_USERNAME;
        fullOptions.targetPassphrase = process.env.AS3_PASSWORD;
    }
    const testDeclarations = createDeclarations(as3Class, properties, fullOptions);
    const mcpClass = classMap.toMcp[as3Class];
    const partition = fullOptions.tenantName;

    if (fullOptions.dryRun) {
        return Promise.resolve();
    }

    return postDeclaration(testDeclarations[0])
        .then((result) => {
            const message = result.results.find((r) => r.tenant === partition).message;
            assert.strictEqual(message, 'success', 'declaration did not apply successfully');

            const reqOpts = {
                path: `/mgmt/tm/${mcpClass.split(' ').join('/')}/`,
                headers: process.env.TARGET_HOST ? {} : {
                    'X-F5-Auth-Token': DEFAULT_OPTIONS.token
                },
                host: process.env.TARGET_HOST || process.env.AS3_HOST
            };
            return requestUtil.get(reqOpts);
        })
        .then((result) => {
            const instances = result.body.items.filter((i) => i.partition === partition);
            assert.strictEqual(
                instances.length,
                count,
                `declaration produced an unexpected number of ${mcpClass} instances`
            );
            return deleteDeclaration(null, { logResponse: true });
        })
        .then((result) => {
            const message = result.results.find((r) => r.tenant === partition).message;
            assert.strictEqual(message, 'success', 'declaration did not delete successfully');
        });
}

function runTestCases(className, testCases, extractFunctions, overrideValues,
    skipAsserts, mcpClass, referenceObjects, sharedObjects, options) {
    testCases.forEach((testCase, index) => {
        logEvent(`running testCase ${index}`);
        const testName = Object.keys(testCase)[0];
        const test = (testCases[index])[testName];
        const testProps = Object.keys(test);
        it(testName, () => {
            const properties = [];
            testProps.forEach((propKey) => {
                const propValue = (test)[propKey];
                const prop = {
                    name: propKey,
                    inputValue: [propValue],
                    extractFunction: extractFunctions ? extractFunctions[propKey] : undefined,
                    referenceObjects: referenceObjects ? referenceObjects[testName] : undefined
                };
                if (skipAsserts.find((ignoreProp) => ignoreProp === propKey)) {
                    prop.expectedValue = [propValue];
                    prop.skipAssert = true;
                } else {
                    const expValueFromOverride = overrideValues.find(
                        (o) => Object.keys(o)[0] === propKey && o[propKey].as3Value === propValue
                    );
                    if (expValueFromOverride) {
                        prop.expectedValue = [expValueFromOverride[propKey].mcpValue];
                    } else {
                        const propFromJson = propertyMap[mcpClass]
                            .find((p) => p.id === toDashSeparated(propKey)
                                || p.altId === propKey);
                        if (propValue === true && propFromJson.truth) {
                            prop.expectedValue = [propFromJson.truth];
                        } else if (propValue === false && propFromJson.falsehood) {
                            prop.expectedValue = [propFromJson.falsehood];
                        } else {
                            prop.expectedValue = [propValue];
                        }
                    }
                }
                properties.push(prop);
            });
            return assertClass(className, properties, options, sharedObjects);
        });
    });
}

/**
 * Checks to see if all services are running by repeatedly checking until the BIGIP is Active
 */
function checkServices() {
    const checkActivePromise = () => {
        const reqOpts = {
            path: '/mgmt/tm/cm/failover-status'
        };

        return requestUtil.get(reqOpts)
            .then((response) => {
                const status = response.body.entries['https://localhost/mgmt/tm/cm/failover-status/0'].nestedStats.entries.status.description;
                logEvent(`BIGIP is ${status}`);
                if (status === 'ACTIVE') {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('BIGIP did not become ACTIVE in time'));
            });
    };

    return promiseUtil.retryPromise(checkActivePromise, { delay: 4000, retries: 60 });
}

function getAuthToken() {
    if (process.env.TEST_IN_AZURE === 'true') {
        return Promise.resolve();
    }

    logEvent('getting Auth Token');
    const requestOptions = {
        path: '/mgmt/shared/authn/login',
        body: {
            username: process.env.AS3_USERNAME,
            password: process.env.AS3_PASSWORD,
            loginProviderName: 'tmos'
        }
    };

    const options = {
        delay: 1000,
        retries: 3
    };

    let token;
    const getAndExtendToken = () => requestUtil.post(requestOptions)
        .then((r) => r.body.token.token)
        .then((t) => {
            token = t;
            return extendAuthTokenTimeout(t);
        })
        .catch((err) => {
            if (token) {
                removeToken(token);
                token = undefined;
            }
            throw err;
        });

    return promiseUtil.retryPromise(getAndExtendToken, options);
}

function extendAuthTokenTimeout(token) {
    logEvent('extending Auth Token');
    const requestOptions = {
        path: `/mgmt/shared/authz/tokens/${token}`,
        body: {
            timeout: 30000
        },
        headers: {
            'X-F5-Auth-Token': token
        }
    };
    return requestUtil.patch(requestOptions).then(() => token);
}

function removeToken(token) {
    logEvent('removing Auth Token');
    const requestOptions = {
        path: `/mgmt/shared/authz/tokens/${token}`,
        headers: {
            'X-F5-Auth-Token': token
        }
    };
    return requestUtil.delete(requestOptions);
}

function getProvisionedModules() {
    return PROVISIONED_MODULES;
}

function getBigIpVersion() {
    return BIGIP_VERSION;
}

function getItemName(options) {
    const prefixLength = `/${options.tenantName}/Application/`.length;

    let itemName = 'test.item-foo.';
    let counter = prefixLength + itemName.length;

    const maxPathLength = options.maxPathLength || DEFAULT_OPTIONS.maxPathLength;
    while (counter < maxPathLength) {
        itemName += counter % 10;
        counter += 1;
    }

    return itemName;
}

function getPreFetchFunctions(properties, index) {
    const preFetchPromises = properties
        .filter((prop) => prop.preFetchFunction)
        .map((prop) => Promise.resolve(prop.preFetchFunction(index)));

    return Promise.all(preFetchPromises);
}

function logEvent(eventString, logStream) {
    const stream = logStream || getEventStream();
    stream.write(`${new Date()}: ${eventString}\n`);
}

function logError(errorString) {
    logEvent(`---- ERROR ---- ${errorString}`);
}

module.exports = {
    assertClass,
    assertModuleProvisioned,
    assertMultipleItems,
    createDeclarations,
    createVlan,
    getDeclaration,
    getPath,
    getPathFullResponse,
    postDeclaration,
    postMultiDeclaration,
    sendDeclaration,
    deleteDeclaration,
    postBigipItems,
    deleteBigipItems,
    deleteUser,
    runTestCases,
    extractPolicy,
    extractProfile,
    getProvisionedModules,
    getBigIpVersion,
    getMcpObject,
    resolveMcpReferences,
    createExtractSecret,
    getItemName,
    patch,
    logEvent,
    getAuthToken,
    removeToken,
    setProvisionedModules,
    setBigIpVersion,
    setEventStream,
    getEventStream,
    getDefaultOptions,
    setTestInfo,
    GLOBAL_TIMEOUT
};

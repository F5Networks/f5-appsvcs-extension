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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;

const util = require('../util/util');
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

const TAG = 'bigComponent';

/**
 * This tag 'bigComponent' tests whether
 * a named BIG-IP configuration component such as
 * "/Common/fubar" of the required type such as
 * "ltm pool" actually exists.  "Type" in this
 * case refers to TMOS module.  In TMSH and TMGUI
 * the module is always specified separately from
 * the component name, so different components
 * may have identical names.  That means we have
 * to pair up the module from the schema with the
 * component name from the declaration before we
 * can check whether the desired component really
 * exists on the target BIG-IP.  Worse, in some
 * cases (like monitors) we are supposed to know
 * the sub-module before we can list a component,
 * despite the component name being unique across
 * sub-modules.  However, the customer does not
 * specify sub-component and it would be very slow
 * to probe all the sub-modules looking for some
 * component.  We use a sneaky tactic to avoid
 * that drudgery: we attempt to create a component
 * rather than trying to list an existing one, and
 * then look for the "already exists" error
 *
 * If special property "scratch" exists in the root
 * of the document this function becomes a no-op
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [components] - The array of resources that will be processed "checked"
 * @param {*} components[].data - The node data from the declaration
 * @param {string} components[].instancePath - The json pointer that was used to fetch the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, components) {
    if (util.isEmptyOrUndefined(components) || typeof declaration.scratch !== 'undefined'
        || util.getDeepValue(context, 'host.deviceType') === DEVICE_TYPES.BIG_IQ
        || util.getDeepValue(context, 'target.deviceType') === DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve(); // Skip components if there is nothing to check or running/targetting BIG_IQ
    }

    const filteredComponents = [];
    return Promise.resolve()
        .then(() => components.forEach(
            (component) => filterBigComponentTag(context, component, declaration, filteredComponents)
        ))
        .then(() => handleBigComponents(context, filteredComponents))
        .then(() => Promise.resolve()); // Must resolve undefined
}

function filterBigComponentTag(context, component, declaration, filteredComponents) {
    const data = component.data;
    const schemaData = component.schemaData;
    const instancePath = component.instancePath;

    // here 'schemaData' is like "query ltm pool" or
    // "probe ltm monitor icmp" or "asm policy"
    // and 'data' is component name like
    // "/Common/fubar" or "http-tunnel" or even the
    // route-domain number 0.  Most component names
    // should be absolute and that is enforced in
    // the schemaData using format=f5bigip, but some
    // components like tunnels lack pathnames

    if (util.isEmptyOrUndefined(schemaData) || (typeof data !== 'object')
        || ((typeof data === 'object') && ((data === null)
        || !Object.prototype.hasOwnProperty.call(data, 'bigip')))) {
        return; // well this is easy
    }

    const schemaRegex = /^(asm policy|((query|probe) ([^\x20]+\x20)*[^\x20]+))?$/;
    schemaData.forEach((sd) => {
        if (!sd.match(schemaRegex)) {
            throw new Error(`f5PostProcess(bigComponent) should match ${schemaRegex}`);
        }

        // component name
        const testName = ((typeof data === 'object') ? data.bigip.replace(/["]+/g, '') : data).toString();
        const elems = sd.split('\x20');
        const tactic = elems.shift();
        const method = (tactic === 'probe') ? 'POST' : 'GET';
        const isAsm = (elems[0] === 'asm');
        let testUrl = '/mgmt/tm/';

        // Reminder to change logic if ASM support is expanded
        if (isAsm && elems[1] !== 'policy') {
            throw new Error(`asm ${elems[1]} is not currently supported`);
        }

        if (isAsm) {
            testUrl = testUrl.concat('asm/policies');
        } else {
            testUrl = testUrl.concat(elems.join('/'));
        }

        let payload;

        if (method === 'GET') {
            if (!isAsm) {
                testUrl = `${testUrl}/${testName.replace(/\x2f/g, '~')}`;
            }
        } else {
            payload = JSON.stringify({ name: testName });
        }

        if (typeof data.bigip === 'string' && data.bigip.includes(' ')
            && !data.bigip.includes('"')) {
            data.bigip = `"${data.bigip}"`;
        }

        const comp = filteredComponents.find((fc) => fc.testOptions.path === testUrl);
        if (!comp) {
            filteredComponents.push({
                data,
                dataPaths: [instancePath],
                isAsm,
                testName,
                testOptions: {
                    path: testUrl,
                    why: `${method} bigip tag components`,
                    method,
                    send: payload,
                    crude: true
                }
            });
        } else {
            comp.dataPaths.push(instancePath);
        }
    });
}

function getAsmPolicies(context, testOptions) {
    return util.iControlRequest(context, testOptions)
        .then((rslt) => {
            // we expect a JSON payload in rslt.body
            let info;
            try {
                info = JSON.parse(rslt.body);
            } catch (e) {
                e.message = `cannot parse JSON reply to GET /asm/policies (${e.message})`;
                throw e;
            }
            if ((typeof info.items === 'object')
                && Array.isArray(info.items)) {
                return info.items;
            }
            return [];
        });
}

function saveMetadata(context, comp, data) {
    // if component is virtual-address, save netmask metadata
    if (comp.testOptions.path.startsWith('/mgmt/tm/ltm/virtual-address')) {
        comp.dataPaths.forEach((path) => {
            util.setDeepValue(
                context.tasks[context.currentIndex],
                `metadata${path.replace(/\//g, '.')}`,
                {
                    address: data.address,
                    mask: data.mask
                }
            );
        });
    }
}

function checkComponent(context, comp) {
    const testOptions = comp.testOptions;
    const data = comp.data;
    const testName = comp.testName;
    const method = testOptions.method;
    let testUrl = testOptions.path;

    return util.iControlRequest(context, testOptions)
        .then((rslt) => {
            // we expect a JSON payload in rslt.body
            let info;
            try {
                info = JSON.parse(rslt.body);
            } catch (e) {
                e.message = `cannot parse JSON reply to ${method} `
                    + `${util.redactURL(testUrl)} (${e.message})`;
                throw e;
            }

            if ((method === 'POST') && Object.prototype.hasOwnProperty.call(info, 'code')) {
                if (info.code !== 409) {
                    throw new Error(`got unrecognized code ${info.code} from ${method} `
                        + `${util.redactURL(testUrl)}`);
                }

                // right! attempt to create failed,
                // which means component exists,
                // which makes us happy
                return true;
            }

            if (method === 'POST') {
                // oops! attempt to create succeeded,
                // which means component did not exist
                // previously, which means customer
                // error, which makes us sad...
                // and we must delete our component
                testUrl = `${testUrl}/${testName.replace(/\x2f/g, '~')}`;
                const deleteOptions = util.simpleCopy(testOptions);
                deleteOptions.path = testUrl;
                deleteOptions.method = 'DELETE';
                deleteOptions.why = deleteOptions.why.replace('POST', 'DELETE');
                delete deleteOptions.send;

                return util.iControlRequest(context, deleteOptions)
                    .catch((e) => {
                        e.message = (`requested component ${data.bigip} does not exist; `
                            + 'also failed to remove '
                            + `test component ${util.redactURL(testUrl)} (${e.message})`);
                        throw e;
                    })
                    .then(() => {
                        throw new Error(`requested component ${data.bigip} does not exist`);
                    });
            }

            if (Object.prototype.hasOwnProperty.call(info, 'code')) {
                // requested component not found
                if (info.code === 404) {
                    throw new Error(`requested component ${data.bigip} does not exist`);
                } else {
                    throw new Error(`got unrecognized code ${info.code} from ${method}`
                        + `${util.redactURL(testUrl)}`);
                }
            }

            // otherwise, component was found,
            // which is exactly what customer wants

            // Check and store component as metadata for later
            if (method === 'GET') {
                saveMetadata(context, comp, info);
            }

            return true;
        });
}

function handleBigComponents(context, components) {
    let asmPolicies = components.filter((c) => c.isAsm);
    let promise;
    if (!util.isEmptyOrUndefined(asmPolicies)) {
        promise = getAsmPolicies(context, asmPolicies[0].testOptions);
    } else {
        promise = Promise.resolve();
    }

    return promise.then((res) => {
        asmPolicies = res;
        const perPath = components.reduce((acc, cur) => {
            const prop = {};
            prop[cur.dataPaths[0]] = acc[cur.dataPaths[0]] || [];
            prop[cur.dataPaths[0]].push(cur);
            return Object.assign(acc, prop);
        }, {});

        const promises = Object.keys(perPath).map((path) => {
            const comps = perPath[path];
            return promiseUtil.raceSuccess(comps.map((c) => {
                if (c.isAsm) {
                    const foundPol = asmPolicies.filter((p) => p.fullPath === c.testName);
                    if (util.isEmptyOrUndefined(foundPol)) {
                        return Promise.reject(new Error(`Unable to find specified WAF policy ${c.testName} for ${path}`));
                    }
                    return Promise.resolve(true);
                }
                return checkComponent(context, c).catch(() => {
                    throw new Error(`Unable to find ${comps[0].testName} for ${path}`);
                });
            }))
                .catch((errors) => {
                    const error = errors[0];
                    error.status = 422;
                    throw error;
                });
        });

        return Promise.all(promises);
    });
}

module.exports = {
    process,
    TAG
};

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

const AJV = require('ajv');
const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;
const util = require('../util/util');

const TAG = 'node';

/**
 * Process node data that was tagged by the f5PostProcess keyword during AJV validation.
 *
 * Replaces an fqdn or static-addr pool member with a reference to an existing ltm node to
 * avert conflicts. This is a concession to the user who tries to deploy a declaration onto
 * a BIG-IP which still has traces of previous configuration lingering on it.
 *
 * However, only existing nodes in /Common are really linkable. TMOS doesn't like nodes in
 * sister partitions. For non-eligible nodes we generate a suitable error message. The
 * existing node list is fetched in advance.
 *
 * IF YOU MODIFY THE SCHEMA FOR Pool_Member YOU MAY HAVE TO MODIFY THIS FUNCTION AS WELL
 *
 * Apply this tag to an array of Pool_Member objects. This function will delve into each
 * Pool_Member to check its fqdn hostname or each of its static serverAddresses/servers against
 * adcParser's nodelist. If a match is found, we modify the Pool_Members element to convert
 * fqdn or a single serverAddr to bigip=node, or for multiple serverAddrs, add a Pool_Members
 * element and remove the conflicting serverAddr.
 *
 * If special property "scratch" exists in the root of the document this function becomes a no-op.
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [nodes] - The array of nodes that will be processed
 * @param {*} nodes[].data - The node data from the declaration
 * @param {*} nodes[].parentData - The node's parent data from the declaration
 * @param {string} nodes[].instancePath - The json pointer that was used to fetch the data
 * @param {string} nodes[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, nodes) {
    const nodelist = context.host.parser.nodelist;
    const createError = (message, dataPath) => ({
        keyword: 'f5PostProcess(node)',
        params: { keyword: 'f5PostProcess(node)' },
        message: message || '',
        dataPath
    });

    if (!nodes) {
        return Promise.resolve();
    }

    const promises = nodes.map((n) => Promise.resolve()
        .then(() => {
            const errors = [];

            if (!Array.isArray(n.data)) {
                return;
            }

            n.data.forEach((node) => {
                if (node.addressDiscovery && node.addressDiscovery.use) {
                    const path = node.addressDiscovery.use.split('/');
                    // The path is expected to look like: /tenant/app/item
                    const addressDiscoveryRef = declaration[path[1]][path[2]][path[3]];
                    addressDiscoveryRef.resources = addressDiscoveryRef.resources || [];
                    // dataPath contains /members on the end and this is to remove that
                    const resourcePath = n.instancePath.substring(0, n.instancePath.length - 8);
                    addressDiscoveryRef.resources.push({
                        item: n.parentData,
                        path: resourcePath,
                        member: node
                    });
                }

                const addresses = getAddresses(node);
                const processedAddresses = [];
                addresses.forEach((address) => {
                    const currentTenant = n.instancePath.split('/')[1];
                    const defaultRD = declaration[currentTenant].defaultRouteDomain;
                    if (!address.includes('%') && !node.routeDomain && typeof defaultRD === 'number') {
                        node.routeDomain = defaultRD;
                    }

                    const fullAddress = address.includes('%') ? address : `${address}%${node.routeDomain}`;
                    if (processedAddresses.indexOf(fullAddress) === -1) {
                        processedAddresses.push(fullAddress);
                    } else {
                        const error = createError(
                            `serverAddresses/servers array has duplicate address ${fullAddress}`,
                            n.instancePath
                        );
                        errors.push(error);
                    }
                });

                checkDuplicateServerNames(node, createError('', n.instancePath), errors);
            });

            if (errors.length !== 0) {
                throw new AJV.ValidationError(errors);
            }

            if (typeof declaration.scratch !== 'undefined' || nodelist.length === 0) {
                // don't want to fool with ltm-nodes right now
                // (probably just expanding defaults in old decl)
                return;
            }

            const tenant = n.instancePath.split('/')[1];
            let node;

            const len = n.data.length; // need not scan extra elems we append
            let i;
            let j;
            let elem;
            let addr;
            let elemRef;
            let trunc;
            let index;
            let extra;

            for (i = 0; i < len; i += 1) {
                elem = n.data[i];
                elemRef = `pool member ${n.instancePath}/${i}`;

                if (Object.prototype.hasOwnProperty.call(elem, 'bigip')) {
                    continue; // eslint-disable-line no-continue
                }

                if (elem.addressDiscovery === 'fqdn') {
                    // Get the index of the node in the existing node list
                    index = util.binarySearch(
                        nodelist,
                        // eslint-disable-next-line no-loop-func, no-nested-ternary
                        (x) => ((elem.hostname < x.key) ? -1 : ((elem.hostname > x.key) ? 1 : 0))
                    );

                    if (index >= 0) {
                        node = nodelist[index];
                        if (node.partition === tenant) {
                            // audit process will handle this
                            continue; // eslint-disable-line no-continue
                        }
                        // if the node is directly in /Common, tag it and leave it for audit
                        if (node.partition === 'Common' && node.fullPath.match(/\//g).length === 2
                            && node.metadata && node.metadata.find((k) => k.name === 'references')) {
                            node.commonNode = true;
                            continue; // eslint-disable-line no-continue
                        } else {
                            node.commonNode = false;
                        }
                        if (node.partition !== 'Common') {
                            const error = createError(
                                `${elemRef} fqdn hostname ${elem.hostname} conflicts with bigip`
                                + ` fqdn node ${node.fullPath}`,
                                n.instancePath
                            );
                            errors.push(error);
                            throw new AJV.ValidationError(errors);
                        }
                        trunc = (elem.hostname.length < 46)
                            ? elem.hostname : elem.hostname.replace(/^(.{44}).*$/, '$1~');

                        elem.bigip = node.fullPath;
                        elem.remark = `(replaces AS3 ${trunc})`;
                        ['addressDiscovery', 'hostname', 'addressFamily', 'autoPopulate',
                            'queryInterval', 'downInterval'].forEach((p) => { // eslint-disable-line no-loop-func
                            delete elem[p];
                        });
                    }
                    continue; // eslint-disable-line no-continue
                }

                if (elem.addressDiscovery !== 'static') {
                    continue; // eslint-disable-line no-continue
                }

                // otherwise
                const addresses = getAddresses(elem);
                for (j = 0; j < addresses.length; j += 1) {
                    addr = addresses[j];
                    addr = ipUtil.minimizeIP(addr).replace(/%0$/, '');

                    // Get the index of the node in the existing node list
                    index = util.binarySearch(
                        nodelist,
                        // eslint-disable-next-line no-loop-func, no-nested-ternary
                        (x) => ((addr < x.key) ? -1 : ((addr > x.key) ? 1 : 0))
                    );

                    if (index >= 0) {
                        node = nodelist[index];
                        if (node.partition === tenant) {
                            // audit process will handle this
                            continue; // eslint-disable-line no-continue
                        }
                        // If the node exists in /Common, the address conflicts with that node, and
                        // the value of shareNodes is false. Check for metadata since we treat AS3
                        // Common nodes a little different tha BIG-IP Common nodes
                        if (node.partition === 'Common' && node.key === addr && node.metadata && !elem.shareNodes) {
                            const error = createError(
                                `The node /${tenant}/${addr} conflicts with /Common/${node.key}`,
                                n.instancePath
                            );
                            errors.push(error);
                            throw new AJV.ValidationError(errors);
                        }
                        // if the node is directly in /Common, tag it and leave it for audit
                        if (node.partition === 'Common' && node.fullPath.match(/\//g).length === 2
                            && node.metadata && node.metadata.find((k) => k.name === 'references')) {
                            node.commonNode = true;
                            continue; // eslint-disable-line no-continue
                        } else {
                            node.commonNode = false;
                        }
                        if (node.ephemeral) {
                            const error = createError(
                                `${elemRef} static address ${addr} conflicts with an ephemeral`
                                + ` address to which ${node.domain} resolves for bigip FQDN`
                                + ` node ${node.fullPath}`,
                                n.instancePath
                            );
                            errors.push(error);
                            throw new AJV.ValidationError(errors);
                        }
                        if (node.partition !== 'Common') {
                            const error = createError(
                                `${elemRef} static address ${addr} conflicts with bigip`
                                + ` node ${node.fullPath}`,
                                n.instancePath
                            );
                            errors.push(error);
                            throw new AJV.ValidationError(errors);
                        }

                        if (addresses.length === 1) {
                            elem.bigip = node.fullPath;
                            elem.remark = `(replaces AS3 ${addr})`;
                            ['addressDiscovery', 'serverAddresses', 'servers'].forEach((p) => { // eslint-disable-line no-loop-func
                                delete elem[p];
                            });
                        } else {
                            extra = util.simpleCopy(elem);

                            extra.bigip = node.fullPath;
                            extra.remark = `(replaces AS3 ${addr})`;
                            ['addressDiscovery', 'serverAddresses', 'servers'].forEach((p) => { // eslint-disable-line no-loop-func
                                delete extra[p];
                            });

                            n.data.push(extra);

                            addresses.splice(j, 1);
                            removeAddressFromNode(elem, addr);
                            j -= 1;
                        }
                    }
                }
            }
        }));

    return Promise.all(promises)
        .then(() => Promise.resolve());
}

function getAddresses(node) {
    let addresses = (node.serverAddresses || []).map((address) => address);
    addresses = addresses.concat((node.servers || []).map((server) => server.address));
    return addresses;
}

function checkDuplicateServerNames(node, error, errors) {
    (node.servers || []).reduce((currentNames, currentNode) => {
        if (currentNames.indexOf(currentNode.name) === -1) {
            currentNames.push(currentNode.name);
        } else {
            const errorCopy = Object.assign({}, error);
            errorCopy.message = `servers array has duplicate name ${currentNode.name}`;
            errors.push(errorCopy);
        }
        return currentNames;
    }, []);
}

function removeAddressFromNode(node, address) {
    let addressIndex = (node.serverAddresses || [])
        .findIndex((serverAddr) => address === serverAddr);
    if (addressIndex >= 0) {
        node.serverAddresses.splice(addressIndex, 1);
    }
    addressIndex = (node.servers || [])
        .findIndex((server) => address === server.address);
    if (addressIndex >= 0) {
        node.servers.splice(addressIndex, 1);
    }
}

module.exports = {
    process,
    TAG
};

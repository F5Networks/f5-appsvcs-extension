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

const atgStorage = require('@f5devcentral/atg-storage');
const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const deepDiff = require('deep-diff');
const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;
const mapAs3 = require('./map_as3');
const mapMcp = require('./map_mcp');
const mapCli = require('./map_cli');
const paths = require('./paths.json');
const util = require('./util/util');
const log = require('./log');
const constants = require('./constants');

const BEGIN_TRANS = 'tmsh::begin_transaction';
const COMMIT_TRANS = 'tmsh::commit_transaction';
/**
 * Align objects to enable object "diff" comparison.
 *
 * @private
 * @param {object} obj - object to be aligned
 * @param {array} arr - properties to align
 * @returns {object}
 */
const mergeByPath = function (obj, arr) {
    if (arr !== undefined && arr.length > 0) {
        arr.forEach((item) => {
            if (obj[item.path] && item.path.indexOf(constants.gtmTopologyMockPath) > -1) {
                // merge gtm topology records under one obj
                // if there are other objects have some similar behavior, refactor to make this general
                const newRecords = item.properties.records || [];
                Object.keys(newRecords).forEach((recKey) => {
                    obj[item.path].properties.records[recKey] = newRecords[recKey];
                });
            } else {
                // multiple wideips can have the same path but different type
                // concatenate the type to the path to prevent overwriting
                if (item.command.indexOf('gtm wideip') > -1) {
                    const commandSplit = item.command.split(' ');
                    if (commandSplit.length === 3) {
                        item.path = `${item.path} ${commandSplit[2]}`;
                    }
                }
                obj[item.path] = {
                    command: item.command,
                    properties: item.properties,
                    ignore: item.ignore
                };
            }
        });
    }
    return obj;
};

/**
 * Find all the first-level properties having the
 * specified class in the supplied declaration or
 * portion of a declaration (such as a Tenant)
 *
 * @public
 * @param {object} as3 - declaration or part of declaration
 * @param {string} [className] - find properties of this class
 * @returns {array} - list of property names
 */
const validClassList = function (as3, className) {
    const classList = [];

    if (typeof as3 !== 'object') { return classList; }

    Object.keys(as3).forEach((id) => {
        if ((typeof as3[id] === 'object')
                && (as3[id] !== null)
                    && (as3[id].class !== undefined)) {
            if (className === undefined || as3[id].class === className) {
                classList.push(id);
            }
        }
    });
    return classList;
};

/**
 * List all of the Tenants in declaration.  If declaration
 * includes Tenant 'Common', list it first (important to
 * avoid broken references from other Tenants to Common)
 *
 * @public
 * @param {object} declaration - a declaration
 * @returns {array} - list of (Tenant-class) property names
 */
const tenantList = function (declaration) {
    const list = [];
    let common = false;
    let firstPassNoDelete = false;
    validClassList(declaration, 'Tenant').forEach((tenantId) => {
        if (tenantId === 'Common') {
            common = true;
        } else {
            list.push(tenantId);
        }
    });
    // config in /Common must be created first and deleted last
    // so it must appear twice in the tenant list
    if (common) {
        firstPassNoDelete = true;
        list.unshift('Common');
        list.push('Common');
    }
    return {
        list,
        firstPassNoDelete
    };
};

/**
 * Currently just handles replacing certificate references, but
 * this can be expanded later if there is additional post processing
 * needed.
 *
 * @param {object} config
 * @param {array} postProcessing Array of changes to make
 */
const desiredConfigPostProcessing = function (config, postProcessing) {
    // In some cases (Monitor clientCertificates, for example) we have a cert but not a key. However
    // TMOS needs there to be a key property. If the user did not specify a key, we'll have to fake it. Check
    // here to see if any postProcessing updates have an oldString that end in '.key'
    const keyRegex = /\.key$/;
    const hasKey = postProcessing.find((change) => change.oldString && change.oldString.match(keyRegex));

    const snatPoolAddresses = new Set();
    const snatTranslationAddresses = [];

    postProcessing.forEach((change) => {
        if (change.oldString && change.newString) {
            util.stringReplace(config, change.oldString, change.newString);
        }

        if (!hasKey) {
            if (change.oldString && change.oldString.includes('.crt') && change.newString.includes('.crt')) {
                util.stringReplace(
                    config,
                    change.oldString.replace('crt', 'key'),
                    change.newString.replace('crt', 'key')
                );
            }
        }

        if (change.domainName && change.aliases) {
            const domainKeys = Object.keys(config).filter((key) => key.split(' ')[0] === change.domainName);
            domainKeys.forEach((domain) => {
                config[domain].properties.aliases = Object.assign(
                    config[domain].properties.aliases, change.aliases
                );
            });
        }

        if (change.snatPoolAddress || change.snatTranslationAddress) {
            if (change.snatTranslationAddress) {
                snatTranslationAddresses.push(change);
            }
            if (change.snatPoolAddress) {
                snatPoolAddresses.add(change);
            }
        }
    });

    // remove overlap to find snat pool addresses that BIGIP will create snat translations for if we do not
    snatTranslationAddresses.forEach((tChange) => {
        snatPoolAddresses.forEach((pChange) => {
            if (tChange.name === pChange.name && tChange.snatTranslationAddress === pChange.snatPoolAddress) {
                snatPoolAddresses.delete(pChange);
            }
        });
    });

    createDefaultSnatTranslations(config, snatPoolAddresses);
    return postProcessing.filter((o) => (!o.snatTranslationAddress && !o.snatPoolAddress));
};

function createDefaultSnatTranslations(config, snatPoolAddresses) {
    snatPoolAddresses.forEach((change) => {
        config[change.name] = {
            command: 'ltm snat-translation',
            properties: {
                address: change.snatPoolAddress,
                arp: 'enabled',
                'connection-limit': 0,
                enabled: {},
                'ip-idle-timeout': 'indefinite',
                'tcp-idle-timeout': 'indefinite',
                'traffic-group': 'default',
                'udp-idle-timeout': 'indefinite'
            },
            ignore: []
        };
    });
}

function updateDesiredForCommonNodes(desiredConfig, nodelist) {
    const handledNodes = [];

    // update based on nodelist
    nodelist.forEach((node) => {
        if (typeof desiredConfig[node.fullPath] !== 'undefined' && node.commonNode) {
            // find the metadata ref count
            const refs = (node.metadata || []).find((data) => data.name === 'references');

            // if our metadata is not found, it was pre-existing
            // we can use it, but must not modify it
            if (!refs) {
                delete desiredConfig[node.fullPath];
                return;
            }

            // we will have to increment the ref in the diff when we are certain this is a new reference
            if (!desiredConfig[node.fullPath].properties.metadata) {
                desiredConfig[node.fullPath].properties.metadata = {};
            }
            node.metadata.forEach((m) => {
                const value = typeof m.value === 'undefined' ? 'none' : m.value;
                if (m.name === 'references') {
                    desiredConfig[node.fullPath].properties.metadata[m.name] = { value: parseInt(value, 10) };
                } else {
                    desiredConfig[node.fullPath].properties.metadata[m.name] = { value };
                }
            });

            handledNodes.push(node.fullPath);
        }
    });

    // check for new nodes to add in Common. We leave the ref count at 0 here so
    // we can update it with the other nodes in the diff
    Object.keys(desiredConfig).forEach((configKey) => {
        if (isConfigForCommonNode(desiredConfig[configKey].command, configKey, desiredConfig[configKey].properties)
            && handledNodes.indexOf(configKey) === -1) {
            if (!desiredConfig[configKey].properties.metadata) {
                desiredConfig[configKey].properties.metadata = {};
            }
            desiredConfig[configKey].properties.metadata.references = { value: 0 };

            // add the node to the nodelist for future tenants either
            const fqdnPrefix = util.getDeepValue(desiredConfig[configKey].properties, 'metadata.fqdnPrefix.value');
            const fqdnName = util.getDeepValue(desiredConfig[configKey].properties, 'fqdn.tmName');
            nodelist.push({
                fullPath: configKey,
                partition: 'Common',
                ephemeral: false,
                metadata: [{
                    name: 'references',
                    persist: true,
                    value: 0
                }],
                domain: '',
                key: desiredConfig[configKey].properties.address || `${fqdnPrefix}${fqdnName}`,
                commonNode: true
            });
        }
    });
}

function getCommonVirtualAddressName(virtualAddress) {
    const fullPath = virtualAddress.fullPath;
    const slashPos = fullPath.lastIndexOf('/') + 1;
    return `${fullPath.slice(0, slashPos)}Service_Address-${fullPath.slice(slashPos)}`;
}

function updateDesiredForCommonVirtualAddresses(desiredConfig, virtualAddressList) {
    const handledAddresses = [];

    // update based on virtualAddressList
    virtualAddressList.forEach((addr) => {
        const configKey = getCommonVirtualAddressName(addr);
        if (typeof desiredConfig[configKey] !== 'undefined' && addr.commonAddress) {
            // find the metadata ref count
            const refs = (addr.metadata || []).find((data) => data.name === 'references');

            // if our metadata is not found, it was pre-existing
            // we can use it, but must not modify it
            if (!refs) {
                delete desiredConfig[configKey];
                return;
            }

            // we will have to increment the ref in the diff when we are certain this is a new reference
            desiredConfig[configKey].properties.metadata = {};
            addr.metadata.forEach((m) => {
                const value = typeof m.value === 'undefined' ? 'none' : m.value;
                if (m.name === 'references') {
                    desiredConfig[configKey].properties.metadata[m.name] = { value: parseInt(value, 10) };
                } else {
                    desiredConfig[configKey].properties.metadata[m.name] = { value };
                }
            });

            handledAddresses.push(configKey);
        }
    });

    // check for new virtual addresses to add in Common. We leave the ref count at 0 here so
    // we can update it with the other virtual addresses in the diff
    Object.keys(desiredConfig).forEach((configKey) => {
        if (desiredConfig[configKey].command === 'ltm virtual-address'
            && configKey.startsWith('/Common/Service_Address-')
            && handledAddresses.indexOf(configKey) === -1) {
            desiredConfig[configKey].properties.metadata = { references: { value: 0 } };

            // add the virtual address to the virtualAddressList for future tenants
            virtualAddressList.push({
                fullPath: configKey.replace('Service_Address-', ''),
                partition: 'Common',
                address: desiredConfig[configKey].properties.address,
                metadata: [{
                    name: 'references',
                    persist: true,
                    value: 0
                }],
                commonAddress: true
            });
        }
    });
}

function updateNodes(nodeList, nodePath, diffs, desired) {
    const sdMetadata = ['service-discovery', 'appsvcs-discovery'];
    nodeList.forEach((node) => {
        if (node.fullPath === nodePath && node.metadata) {
            let refCount = -1;
            node.metadata.forEach((data) => {
                if (data.name === 'references') {
                    data.value -= 1;
                    refCount = data.value;
                }
            });

            // refCount defaults to -1 so use this check to skip the code below
            // even if there is SD metadata
            if (refCount === -1) {
                return;
            }

            // modify the node, its in use elsewhere
            if (refCount > 0 || node.metadata.find((m) => sdMetadata.indexOf(m.name) > -1)) {
                const properties = {
                    metadata: {}
                };

                // Copy all metadata
                node.metadata.forEach((m) => {
                    const value = typeof m.value === 'undefined' ? 'none' : m.value;
                    properties.metadata[m.name] = { value };
                });

                if (refCount === 0) {
                    // node is still being used by SD, only remove AS3 ref counter
                    delete properties.metadata.references;
                } else {
                    properties.metadata.references.value = refCount;
                }

                if (node.fqdn) {
                    properties.fqdn = {
                        name: node.fqdn.name
                    };
                } else {
                    properties.address = node.address;
                }

                const nodeDiff = {
                    kind: 'E',
                    path: [node.fullPath],
                    rhs: {
                        command: 'ltm node',
                        properties
                    },
                    lhsCommand: 'ltm node',
                    ignore: []
                };

                const diffIndex = diffs.findIndex((d) => d.path[0] === nodeDiff.path[0]);
                diffs[diffIndex] = nodeDiff;

                // need to add to desired for the generate step
                desired[nodePath] = {
                    command: 'ltm node',
                    properties,
                    ignore: []
                };
            // last thing using this node, delete it
            } else if (refCount === 0) {
                const nodeDiff = {
                    kind: 'D',
                    path: [node.fullPath],
                    lhs: {
                        command: 'ltm node',
                        properties: {
                            address: node.key,
                            metadata: node.metadata
                        }
                    },
                    lhsCommand: 'ltm node',
                    ignore: []
                };
                diffs.push(nodeDiff);
            }
        }
    });
}

// update metadata for Common nodes.  Allow delete if ref count is going to 0
function maintainCommonNodes(context, diffs, desired, nodeList, tenantId, uncheckedDiff) {
    function processNode(path) {
        const address = ipUtil.splitAddress(path.split('/').pop())[0];
        const commonNode = nodeList.find((n) => n.key === address);
        if (commonNode && typeof desired[commonNode.fullPath] === 'undefined') {
            updateNodes(nodeList, commonNode.fullPath, diffs, desired);
        }
    }

    function addNodesFromDesiredConfigToUncheckedDiff() {
        if (context.tasks[context.currentIndex].unchecked && tenantId === 'Common' && context.tasks[context.currentIndex].firstPassNoDelete) {
            Object.keys(desired).forEach((key) => {
                if (desired[key].command === 'ltm node' && key.startsWith('/Common/')) {
                    uncheckedDiff[key] = util.simpleCopy(desired[key]);
                }
            });
        }
    }

    for (let i = 0; i < diffs.length; i += 1) {
        // handle incrementing the ref count
        if (diffs[i].kind === 'N'
            && isConfigForCommonNode(diffs[i].rhs.command, diffs[i].path[0], diffs[i].rhs.properties)) {
            diffs[i].rhs.properties.metadata.references.value += 1;

            // if more than one tenant is referencing it, we need to change
            // the new to an edit.
            if (diffs[i].rhs.properties.metadata.references.value > 1) {
                // have to completely replace the diff because the fields are read only
                const replacementDiff = {
                    kind: 'E',
                    path: diffs[i].path,
                    rhs: diffs[i].rhs,
                    lhsCommand: 'ltm node'
                };

                diffs[i] = replacementDiff;
            }
            // update the node list in case another tenant we are processing also uses this node
            for (let j = 0; j < nodeList.length; j += 1) {
                if (nodeList[j].fullPath === diffs[i].path[0]) {
                    nodeList[j].metadata.forEach((data) => {
                        if (data.name === 'references') {
                            data.value = parseInt(data.value, 10) + 1;
                        } else if (typeof data.value === 'undefined') {
                            data.value = 'none';
                        }
                    });
                    break;
                }
            }
        // Handle decrementing ref counts. Wait until second pass of Common when decrementing
        } else if (diffs[i].kind === 'D' && context.tasks[context.currentIndex].firstPassNoDelete !== true) {
            // handle deleting entire pools
            if (diffs[i].lhs && diffs[i].lhs.command === 'ltm pool' && diffs[i].lhs.properties
                && diffs[i].lhs.properties.members) {
                Object.keys(diffs[i].lhs.properties.members).forEach((member) => {
                    processNode(member);
                });
            // handle deleting a single pool member or data group
            } else if (diffs[i].path && diffs[i].path.length === 4) {
                processNode(diffs[i].path[3].replace(/"/g, ''));
            }
        }
    }

    addNodesFromDesiredConfigToUncheckedDiff();
}

/**
 * Determines if config refers to a node in the Common partition
 *
 * Checks to see if the name of the node is the same as the address or
 * the same as the fqdn name
 *
 * @param {String} command - The command in the config
 * @param {String} name - The name of the node
 * @param {Object} properties - The config properties
 */
function isConfigForCommonNode(command, name, properties) {
    if (command !== 'ltm node') {
        return false;
    }
    const fqdnPrefix = util.getDeepValue(properties, 'metadata.fqdnPrefix.value');
    const fqdnName = util.getDeepValue(properties, 'fqdn.tmName');
    return name === `/Common/${properties.address}`
        || name === `/Common/${fqdnPrefix}${fqdnName}`;
}

// update metadata for Common virtual addresses.  Allow delete if ref count is going to 0
function maintainCommonVirtualAddresses(diffs, desired, virtualAddressList) {
    for (let i = 0; i < diffs.length; i += 1) {
        // handle incrementing the ref count
        if (diffs[i].kind === 'N' && diffs[i].rhs.command === 'ltm virtual-address'
            && diffs[i].path[0].startsWith('/Common/Service_Address-')) {
            diffs[i].rhs.properties.metadata.references.value += 1;

            // if more than one tenant is referencing it, we need to change
            // the new to an edit.
            if (diffs[i].rhs.properties.metadata.references.value > 1) {
                // have to completely replace the diff because the fields are read only
                const replacementDiff = {
                    kind: 'E',
                    path: diffs[i].path,
                    rhs: diffs[i].rhs,
                    lhsCommand: 'ltm virtual-address'
                };

                diffs[i] = replacementDiff;
            }
            // update the virtualAddressList in case another tenant we are processing also uses
            // this virtual address
            const virtualAddress = virtualAddressList.find(
                (vAddr) => getCommonVirtualAddressName(vAddr) === diffs[i].path[0]
            );
            if (virtualAddress) {
                virtualAddress.metadata.forEach((data) => {
                    if (data.name === 'references') {
                        data.value = parseInt(data.value, 10) + 1;
                    } else if (typeof data.value === 'undefined') {
                        data.value = 'none';
                    }
                });
            }
        }
        // TODO: Decrement ref count
    }
}

/**
 * Checks desired configuration for any profiles that are referenced by a virtual
 * and notifies anyone who might be interested in that.
 *
 * @param {object} context        - the context
 * @param {object} desiredConfig  - the desired config
 */
const checkDesiredForReferencedProfiles = function (context, desiredConfig) {
    if (!desiredConfig) {
        return;
    }
    Object.keys(desiredConfig).forEach((configItem) => {
        const eventInfo = {
            uuid: context.tasks[context.currentIndex].uuid
        };
        switch (desiredConfig[configItem].command) {
        case 'ltm virtual':
            // Here we look for all profiles because we can't tell what type they are in this context
            if (desiredConfig[configItem].properties.profiles) {
                Object.keys(desiredConfig[configItem].properties.profiles).forEach((profilePath) => {
                    eventInfo.profilePath = profilePath;
                    eventInfo.virtualPath = configItem;
                    context.request.eventEmitter.emit(constants.EVENTS.PROFILE_REFERENCED, eventInfo);
                });
            }
            if (desiredConfig[configItem].properties['per-flow-request-access-policy']) {
                eventInfo.profilePath = desiredConfig[configItem].properties['per-flow-request-access-policy'];
                eventInfo.virtualPath = configItem;
                context.request.eventEmitter.emit(constants.EVENTS.PROFILE_REFERENCED, eventInfo);
            }
            break;
        case 'ltm rule': {
            // Here we can just look for Access profiles/policies
            const ruleText = desiredConfig[configItem].properties['api-anonymous'];
            const profileRegex = /(?:ACCESS::policy)[^]+(?:-profile)\s+([/A-Za-z1-9_-]+)\b/gm;
            const matches = profileRegex.exec(ruleText);
            if (matches) {
                eventInfo.profilePath = matches[1];
                eventInfo.iRule = {
                    name: configItem,
                    text: ruleText
                };
                context.request.eventEmitter.emit(constants.EVENTS.PROFILE_REFERENCED, eventInfo);
            }
            break;
        }
        default:
        }
    });
};

/**
 * Parse part of an AS3 declaration into actionable MCP
 * config items.  This function calls "map_as3.js" to
 * perform the translations.
 *
 * @public
 * @param {object} context Provides needed context information
 * @param {string} tenantId - specifies Tenant of interest
 * @param {object} declaration
 * @param {object} commonConfig
 * @returns {object}
 */
const getDesiredConfig = function (context, tenantId, declaration, commonConfig) {
    let desiredConfig = {};
    let appList = [];
    let item;
    let mcpObjArr;
    const tenantDecl = declaration[tenantId];

    if ((tenantDecl && tenantDecl.enable) || tenantId === 'Common') {
        appList = validClassList(tenantDecl, 'Application');
    }

    appList.forEach((appId) => {
        if (tenantDecl[appId].enable) {
            mcpObjArr = mapAs3.translate.Application(context, tenantId, appId).configs;
            desiredConfig = mergeByPath(desiredConfig, mcpObjArr);
            validClassList(tenantDecl[appId]).forEach((itemId) => {
                item = tenantDecl[appId][itemId];
                if (mapAs3.translate[item.class] !== undefined) {
                    const mcpUpdates = mapAs3
                        .translate[item.class](context, tenantId, appId, itemId, item, declaration);
                    if (mcpUpdates.updatePath === true) {
                        context.request.postProcessing = context.request.postProcessing.concat(mcpUpdates.pathUpdates);
                    }
                    desiredConfig = mergeByPath(desiredConfig, mcpUpdates.configs);
                }
            });
        }
    });
    if (Object.keys(desiredConfig).length > 0) {
        mcpObjArr = mapAs3.translate.Tenant(context, tenantId, tenantDecl).configs;
        desiredConfig = mergeByPath(desiredConfig, mcpObjArr);
    }
    if (context.request.postProcessing.length > 0) {
        context.request.postProcessing = desiredConfigPostProcessing(desiredConfig, context.request.postProcessing);
    }
    updateDesiredForCommonNodes(desiredConfig, commonConfig.nodeList);
    updateDesiredForCommonVirtualAddresses(desiredConfig, commonConfig.virtualAddressList);
    return desiredConfig;
};

function isShared(item) {
    if (!item.fullPath) {
        return false;
    }

    if (item.fullPath && item.fullPath.startsWith('/')) {
        return item.fullPath.substring(8, 14) === 'Shared';
    }

    // Some fullPaths are not so full, fall back to checking selfLink
    return item.selfLink && item.selfLink.includes('/~Common~Shared~');
}

function isAs3Kind(config) {
    if (config.kind === 'tm:gtm:global-settings:load-balancing:load-balancingstate') {
        return true;
    }
    return false;
}

function pullPoolMembers(context, pools) {
    const poolMembers = pools.map((pool) => {
        const url = `/mgmt/tm/ltm/pool/${pool.split('/').join('~')}/members`;
        const options = {
            why: 'getting BIG-IP APM pool members',
            path: url,
            method: 'GET',
            ctype: 'application/json'
        };

        return util.iControlRequest(context, options)
            // The split removes the service port from the fullPath for comparison
            // pool members cannot share the same IP, even if they have different service ports
            .then((result) => result.items.map((item) => item.fullPath.split(':')[0]))
            .catch((error) => {
                if (error.message.indexOf('"code":404') > -1) {
                    log.warning(`Unable to fetch pool state from ${url}`);
                    // Empty arrays are ignored for the filter, so returning one here is the simplest
                    // solution
                    return [];
                }
                throw error;
            });
    });

    return Promise.all(poolMembers);
}

function gatherAccessProfileItems(context, partition, config) {
    const accessProfiles = config.filter((item) => item && item.kind && item.kind.includes('apm:profile:access'))[0];
    if (!accessProfiles || !accessProfiles.items) {
        return Promise.resolve([]);
    }
    const profileNames = accessProfiles.items.map((profile) => profile.name);
    // Store APM profiles already in tenant, for reference in map_cli during ng_import
    util.setDeepValue(
        context.tasks[context.currentIndex],
        `metadata.${partition}._apmProfilesAlreadyInTenant`,
        profileNames
    );
    // eslint-disable-next-line no-useless-escape
    const command = `export USER=\$REMOTEUSER; ng_profile -p ${partition} -list ${profileNames.join(' ')}`;
    return util.executeBashCommand(context, command)
        .then((result) => {
            // These items are the ones created by the APM profile upon import, undefined is returned
            // if there are none
            const pools = [];
            let items = [];

            if (result) {
                const resultArray = result.replace(/\s{2,}/g, ' ').replace(/\n/g, ' ').split(' ');
                items = resultArray.filter((element) => element.includes('/'));
                resultArray.forEach((cell, idx) => {
                    if (cell === 'pool') {
                        pools.push(resultArray[idx + 1]);
                    }
                });
            }

            if (pools.length === 0) {
                return items;
            }

            // Pool Members created by APM Access Profile pools should be ignored like pools
            return pullPoolMembers(context, pools)
                .then((poolMembersArray) => {
                    poolMembersArray.forEach((poolMembers) => {
                        poolMembers.forEach((poolMember) => {
                            items.push(poolMember);
                        });
                    });

                    return items;
                });
        });
}

function getCommonAccessProfiles(context) {
    const storage = new atgStorage.StorageDataGroup('/Common/appsvcs/accessProfiles');
    return storage.keys()
        .then((records) => {
            context.tasks[context.currentIndex].commonAccessProfiles = records;
        });
}

function updateCommonAccessProfiles(context, desiredConfig) {
    const storage = new atgStorage.StorageDataGroup('/Common/appsvcs/accessProfiles');
    const desiredAccessProfiles = Object.keys(desiredConfig)
        .filter((item) => desiredConfig[item].command === 'apm profile access')
        .map((profile) => profile.split('/').pop());
    const promises = desiredAccessProfiles.map((key) => () => storage.hasItem(key)
        .then((hasItem) => {
            if (hasItem) {
                return Promise.resolve();
            }
            return storage.setItem(key, '');
        }));
    context.tasks[context.currentIndex].commonAccessProfiles.forEach((accessProfile) => {
        if (!desiredAccessProfiles.find((profile) => profile === accessProfile)) {
            promises.push(() => storage.deleteItem(accessProfile));
        }
    });

    return promiseUtil.series(promises).then(() => storage.persist());
}

function filterAs3Items(configs) {
    configs.forEach((config) => {
        // Filter ephemeral pool members
        if (config.kind === 'tm:ltm:pool:poolstate' && config.membersReference.items) {
            config.membersReference.items = config.membersReference.items.filter((member) => member.ephemeral !== 'true');
        }
    });

    // filter hidden per-request access policies managed by access profiles
    const accessProfiles = configs.filter((item) => item.kind === 'tm:apm:profile:access:accessstate');

    // every access profile has a hidden per-request access policy
    let hiddenAccessPolicies = accessProfiles.map((profile) => profile.accessPolicy);

    // any per-request access policy listed in the macros of another per-request access policy is also hidden
    // the structure is always shallow (a macro does not point to another macro)
    const accessPolicies = configs.filter((item) => item.kind === 'tm:apm:policy:access-policy:access-policystate');
    hiddenAccessPolicies = hiddenAccessPolicies.concat(accessPolicies.reduce((policies, accessPolicy) => {
        if (accessPolicy.macros) return policies.concat(accessPolicy.macros);
        return policies;
    }, []));

    configs = configs.filter((item) => !(item.kind === 'tm:apm:policy:access-policy:access-policystate' && hiddenAccessPolicies.indexOf(item.fullPath) !== -1));

    return configs;
}

function extractAs3Items(context, configs, partition, filter) {
    return configs
        .filter((c) => c && (c.items || isAs3Kind(c)))
        .map((config) => {
            if (!config.items) {
                return [config];
            }
            return config.items.filter((item) => isAs3Item(context, item, partition, filter));
        })
        .reduce((acc, cur) => acc.concat(cur), []);
}

function isAs3Item(context, item, partition, filter) {
    const ignoreMetadata = ['service-discovery', 'appsvcs-discovery'];
    if (item.kind !== 'shared:service-discovery:taskstate' && item.metadata
        && item.metadata.find((m) => ignoreMetadata.indexOf(m.name) > -1)) {
        return false;
    }
    if (filter && filter.indexOf(item.fullPath) > -1) {
        return false;
    }
    if (item.name === partition) {
        return true;
    }
    if (item.description === constants.as3ManagedDescription) {
        return true;
    }
    if (item.kind !== 'shared:service-discovery:taskstate' && item.metadata
        && item.metadata.find((m) => m.name === 'as3')) {
        return true;
    }
    if (item.kind === 'tm:gtm:server:devices:devicesstate') {
        return true;
    }
    if (item.kind === 'tm:gtm:server:virtual-servers:virtual-serversstate') {
        return true;
    }
    if (item.kind === 'tm:gtm:prober-pool:members:membersstate') {
        return true;
    }
    if (/^tm:gtm:pool:(?:a|aaaa|cname|mx):members:membersstate$/.test(item.kind)) {
        return true;
    }
    if (item.kind === 'tm:apm:profile:access:accessstate' && context.tasks[context.currentIndex].commonAccessProfiles
        && context.tasks[context.currentIndex].commonAccessProfiles.find((profile) => profile === item.name)) {
        return true;
    }
    if (item.kind === 'tm:gtm:topology:topologystate' && item.description !== constants.as3ManagedDescription) {
        return false;
    }
    if (item.kind === 'shared:service-discovery:taskstate'
        && decodeURIComponent(item.id).split(/\/|~/g)[1] === partition) {
        return true;
    }

    if ((partition !== 'Common' || isShared(item)) && item.kind !== 'tm:auth:partition:partitionstate'
        && !item.kind.startsWith('shared:service-discovery')) {
        return true;
    }
    return false;
}

/**
 * given a list of BIG-IP config paths and a Tenant name
 * to indicate BIG-IP partition, return a promise to fetch
 * a list of configuration components from target BIG-IP
 *
 * @public
 * @param {object} context
 * @param {array} pathList - list of BIG-IP config pathnames
 * @param {string} tenantId - Tenant name indicates BIG-IP partition
 * @returns {Promise}
 */
const getBigipConfig = function (context, pathList, tenantId) {
    const partition = tenantId;

    const supportedPaths = pathList
        .map((path) => ((typeof path === 'string') ? ({ endpoint: path }) : path))
        .filter((path) => util.isOneOfProvisioned(context.target, path.modules))
        .filter((path) => util.versionLessThan(
            path.minimumVersion || '0.0.0',
            util.getDeepValue(context, 'target.tmosVersion')
        ));

    const promises = supportedPaths.map((path) => {
        const icrOptions = {
            why: 'getting BIG-IP config',
            path: `${path.endpoint}?$filter=partition%20eq%20${partition}`
        };
        if (path.select) {
            icrOptions.path += `&$select=${path.select}`;
        }
        if (path.expand) {
            icrOptions.path += '&expandSubcollections=true';
        }
        return util.iControlRequest(context, icrOptions)
            .catch((error) => {
                if (error.message.indexOf('"code":404') > -1) {
                    log.warning(`Unable to fetch state from ${path.endpoint}`);
                    return undefined;
                }
                throw error;
            });
    });

    return Promise.all(promises)
        .then((config) => gatherAccessProfileItems(context, partition, config)
            .then((result) => ({ config, filter: result })))
        .then((configs) => extractAs3Items(context, configs.config, partition, configs.filter))
        .then((configs) => filterAs3Items(configs))
        .catch((err) => {
            log.error(err);
            throw err;
        });
}; // getBigipConfig()

// find iCall scripts that are not being deleted
const getKeptScripts = function (currentConfig, deletedScripts) {
    const currentScripts = [];
    Object.keys(currentConfig).forEach((configKey) => {
        if (currentConfig[configKey].command === 'sys config merge file') {
            currentScripts.push(currentConfig[configKey].properties.scriptName);
        }
    });

    return currentScripts.filter((i) => deletedScripts.indexOf(i) < 0);
};

// find iCall scripts that are being deleted
const getDeletedScripts = function (finalDiffs) {
    const deletedScripts = [];
    Object.keys(finalDiffs).forEach((configKey) => {
        if (finalDiffs[configKey].kind === 'D' && finalDiffs[configKey].lhs
            && finalDiffs[configKey].lhs.command === 'sys config merge file') {
            deletedScripts.push(finalDiffs[configKey].lhs.properties.scriptName);
        }
    });
    return deletedScripts;
};

// preserve resources that were added by service discovery iCall scripts that are not
// being deleted
const preserveDiscoveredNodes = function (context, finalDiffs, currentConfig) {
    const deletedScripts = getDeletedScripts(finalDiffs);
    const scripts = getKeptScripts(currentConfig, deletedScripts);
    const options = {};
    options.path = '/mgmt/tm/ltm/data-group/internal?$filter=partition%20eq%20Common';
    options.method = 'GET';
    options.ctype = 'application/json';
    options.why = 'Getting internal data-groups for state maintenance';
    options.crude = true;

    return util.iControlRequest(context, options)
        .then((response) => {
            if (response.statusCode !== 200) {
                if (response.statusCode === 404) {
                    log.debug('No data-groups found, assuming no nodes to preserve');
                } else {
                    log.error(`Request to retrieve data-groups failed with status: ${response.statusCode}, message: ${response.message}`);
                }
            } else {
                let body = null;
                try {
                    body = JSON.parse(response.body);
                } catch (e) {
                    log.error(`Error occurred while parsing data-group response: ${e.message}`);
                    throw (e);
                }
                if (typeof body.items === 'undefined') {
                    log.debug('No data-groups found, assuming no nodes to preserve');
                } else {
                    let preserveIps = [];
                    for (let i = 0; i < body.items.length; i += 1) {
                        if (body.items[i].subPath === constants.as3CommonFolder
                            && scripts.find((script) => body.items[i].name.indexOf(script) >= 0)) {
                            preserveIps = preserveIps.concat(body.items[i].description.trim().split(' '));
                        }
                    }

                    for (let i = 0; i < preserveIps.length; i += 1) {
                        for (let j = 0; j < finalDiffs.length; j += 1) {
                            // handles firewall address lists
                            if (finalDiffs[j].path.indexOf(preserveIps[i]) >= 0) {
                                finalDiffs.splice(j, 1);
                            }
                            // handles nodes
                            if (finalDiffs[j].lhs && finalDiffs[j].lhs.command === 'ltm node'
                                && preserveIps[i].split(':')[0] === finalDiffs[j].path[0].split('/').pop()) {
                                finalDiffs.splice(j, 1);
                            }
                            // handles pool members. Trying to be as specific as possible in this
                            // logic since there is no "command" associated with pool members.
                            if (finalDiffs[j].path.indexOf('members') === 2 && finalDiffs[j].path.length === 4
                                && finalDiffs[j].path[finalDiffs[j].path.length - 1].split('/').pop() === preserveIps[i]) {
                                finalDiffs.splice(j, 1);
                            }
                        }
                    }
                }
            }
        });
};

function tenantAddCommonNodes(context, actionableConfig, nodeList) {
    function findSDTaskKey(resourcePath) {
        return Object.keys(actionableConfig).find((key) => {
            const config = actionableConfig[key];
            if (config.command !== 'mgmt shared service-discovery task') {
                return false;
            }
            const resources = config.properties.resources;
            return Object.keys(resources).find((rKey) => resources[rKey].path === resourcePath);
        });
    }

    Object.keys(actionableConfig).forEach((configKey) => {
        if (actionableConfig[configKey].command === 'ltm pool'
            && actionableConfig[configKey].properties
            && actionableConfig[configKey].properties.members) {
            Object.keys(actionableConfig[configKey].properties.members).forEach((memberKey) => {
                const splitMember = memberKey.split('/');
                if (splitMember.length === 3 && splitMember[1] === 'Common') {
                    nodeList.forEach((node) => {
                        // strip port
                        const nodePath = memberKey.match(/:/g).length > 2 ? memberKey.split('.')[0] : memberKey.split(':')[0];
                        if (node.fullPath === nodePath) {
                            // if no metadata, it was a preexisting node
                            if (typeof node.metadata === 'undefined') {
                                return;
                            }

                            let references = -1;
                            node.metadata.forEach((data) => {
                                if (data.name === 'references') {
                                    references = parseInt(data.value, 10);
                                    data.value = references;
                                } else if (typeof data.value === 'undefined') {
                                    data.value = 'none';
                                }
                            });

                            if (references !== -1) {
                                // if overlapping SD task, ignore and leave for SD to handle
                                const ignoreMetadata = ['service-discovery', 'appsvcs-discovery'];
                                if (node.metadata.find((m) => ignoreMetadata.indexOf(m.name) > -1)
                                    && findSDTaskKey(configKey)) {
                                    return;
                                }

                                if (node.fqdn) {
                                    const item = util.simpleCopy(node);
                                    item.hostname = node.domain;
                                    const config = mapMcp.translate[item.kind](context, item)[0];
                                    delete config.path;
                                    actionableConfig[nodePath] = config;
                                } else {
                                    actionableConfig[nodePath] = {
                                        command: 'ltm node',
                                        properties: {
                                            address: nodePath.split('/')[2],
                                            metadata: node.metadata.reduce((obj, m) => {
                                                obj[m.name] = { value: m.value };
                                                return obj;
                                            }, {})
                                        },
                                        ignore: []
                                    };
                                }
                            }
                        }
                    });
                }
            });
        }
    });
}

const updateAddressesWithRouteDomain = function (configs, tenantId) {
    // iControl quirk: with a partition $filter query param
    // the defaultRouteDomain value is not included in the addrs
    const destWithRds = {};
    const tenant = configs[`/${tenantId}/`];
    let defaultRd = tenant ? tenant.properties['default-route-domain'] : '0';
    if (defaultRd.toString() === '0') {
        defaultRd = '';
    }

    // populate virtual-address explicit route domain values to get the correct diffs
    const configKeys = Object.keys(configs);
    const updatedConfigs = configKeys.map((k) => {
        const cfg = configs[k];
        if (cfg.command === 'ltm virtual-address') {
            let destAddr = cfg.properties.address;
            if (!util.isEmptyOrUndefined(defaultRd) && !destAddr.includes('%')) {
                destAddr = `${destAddr}%${defaultRd}`;
                cfg.properties.address = destAddr;
            }
            if (destAddr.includes('%')) {
                // not sure why we're tagging the path with this..
                // but it's only on the config path, not on the cli script
                destWithRds[k.replace('Service_Address-', '')] = destAddr;
            }
        }
        return cfg;
    });

    // update any virtuals with destination containing RD to use the exact address value instead of name ref
    updatedConfigs.forEach((cfg) => {
        if (cfg.command === 'ltm virtual') {
            let cidr = '';
            const sourceAddr = cfg.properties.source;
            if (!util.isEmptyOrUndefined(defaultRd) && !sourceAddr.includes('%')) {
                const addrParts = sourceAddr.split('/');
                const ip = addrParts[0];
                if (!util.isEmptyOrUndefined(addrParts[1])) {
                    cidr = `/${addrParts[1]}`;
                }
                cfg.properties.source = `${ip}%${defaultRd}${cidr}`;
            }
            if (typeof cfg.properties.destination !== 'undefined') {
                const destAddr = cfg.properties.destination.slice(cfg.properties.destination.lastIndexOf('/') + 1);
                // if this fails the IPv6 test it does not guarantee this is IPv4
                // it could be literal like addressName:port which mimics IPv4
                const destParts = ipUtil.isIPv6(destAddr) ? cfg.properties.destination.split('.') : cfg.properties.destination.split(':');
                const destName = destParts[0];
                const destPort = destParts[1];
                const destRdMatch = destWithRds[destName];
                if (!util.isEmptyOrUndefined(destRdMatch)) {
                    const delimiter = (destRdMatch.includes(':') || destRdMatch.includes('any6')) ? '.' : ':';
                    if (!destRdMatch.startsWith('/')) {
                        cfg.properties.destination = `/${tenantId}/${destRdMatch}${delimiter}${destPort}`;
                    } else cfg.properties.destination = `${destRdMatch}${delimiter}${destPort}`;
                }
            }
        }
    });
};

const pathReferenceLinks = function (context, referredList, tenantId, partitionConfig) {
    const referenceLinks = [];

    partitionConfig.forEach((item) => {
        if (item !== undefined) {
            referredList.forEach((reference) => {
                if ((item[reference.endpoint] !== undefined)
                && (item[reference.endpoint].link !== undefined)
                && (item[reference.endpoint].items === undefined)
                && (util.isOneOfProvisioned(context.target, reference.modules))) {
                    referenceLinks.push(item[reference.endpoint].link.replace('https://localhost', '').replace(/\?.*/, ''));
                }
            });
        }
    });
    return getBigipConfig(context, referenceLinks, tenantId);
};

/**
 * Pull the current BIG-IP configuration for a given
 * partition (AS3 tenant).  This uses iControl-REST
 * in two stages. The first stage captures the parent
 * objects.  The second stage captures sub-properties
 * that are referenced by the first stage. This function
 * calls "map_mcp.js" to translate the REST objects.
 *
 * @public
 * @param {object} context
 * @param {string} tenantId
 * @param {object} commonConfig Configuration from Common
 * @returns {Promise} - resolves to TMSH script to update device config
 */
const getTenantConfig = function (context, tenantId, commonConfig) {
    const subReferenceLinks = [];
    let partitionConfig;
    let referenceConfig;
    let actionableConfig = {};
    let mcpObjArr;

    const icrOptions = {
        path: '/mgmt/tm/auth/partition/',
        retry503: 4,
        why: 'check if Tenant has a partition yet'
    };

    return util.iControlRequest(context, icrOptions)
        .then((cfg) => {
            let i;
            let hasPartition = false;
            if (cfg.kind === 'tm:auth:partition:partitioncollectionstate') {
                for (i = 0; i < cfg.items.length; i += 1) {
                    if (cfg.items[i].name === tenantId) {
                        hasPartition = true;
                        break;
                    }
                }
            }
            if (!hasPartition) {
                log.debug(`tenant ${tenantId} lacks a partition`);
                return actionableConfig;
            }
            return getBigipConfig(context, paths.root, tenantId)
                .then((config) => {
                    partitionConfig = config || [];
                    return pathReferenceLinks(context, paths.referred, tenantId, partitionConfig);
                })
                .then((config) => {
                    referenceConfig = config || [];
                    referenceConfig.forEach((item) => {
                        if (item !== undefined) {
                            paths.subReferred.forEach((reference) => {
                                if ((item[reference] !== undefined)
                                    && (item[reference].link !== undefined)
                                    && (item[reference].items === undefined)) {
                                    subReferenceLinks.push(item[reference].link.replace('https://localhost', '').replace(/\?.*/, ''));
                                }
                            });
                        }
                    });
                    return getBigipConfig(context, subReferenceLinks, tenantId);
                })
                .then((config) => {
                    referenceConfig = referenceConfig.concat(config);
                    partitionConfig.forEach((item) => {
                        if (item !== undefined) {
                            if (item.kind && mapMcp.translate[item.kind]) {
                                mcpObjArr = mapMcp
                                    .translate[item.kind](context, item, referenceConfig, partitionConfig);
                                if (mcpObjArr !== undefined && mcpObjArr.length > 0) {
                                    actionableConfig = mergeByPath(actionableConfig, mcpObjArr);
                                }
                            }
                        }
                    });
                    updateAddressesWithRouteDomain(actionableConfig, tenantId);
                    tenantAddCommonNodes(context, actionableConfig, commonConfig.nodeList);
                    return actionableConfig;
                });
        })
        .catch((err) => {
            err.message = `failure querying config for tenant ${
                tenantId} (${err.message})`;
            log.error(err);
            throw err;
        });
}; // tenantConfig()

const serviceDiscoveryDiff = function (currentConfig, desiredConfig) {
    const trimmedDesired = util.simpleCopy(desiredConfig);
    delete trimmedDesired.properties.iControl_post;

    return JSON.stringify(currentConfig) !== JSON.stringify(trimmedDesired);
};

const gtmNeedsModifyAliasCommand = function (configDiff, diff) {
    let isRenameOrMove = false;

    // check if this is a rename based on aliases (unique db constraint)
    if (diff.path.length === 1) {
        const diffAliases = Object.keys(diff.rhs.properties.aliases);
        diffAliases.forEach((alias, index) => {
            diffAliases[index] = alias.replace(/\\/g, '').replace(/"/g, '');
        });

        const confDiffOrig = configDiff.filter((confDiff) => confDiff.kind === 'D'
            && confDiff.path.length === 1
            && confDiff.lhs !== undefined
            && confDiff.lhs !== {}
            && confDiff.lhs.properties
            && confDiff.lhs.properties.aliases
            && Object.keys(confDiff.lhs.properties.aliases).length > 0
            && Object.keys(confDiff.lhs.properties.aliases)
                .filter((alias) => diffAliases.indexOf(alias) > -1)
                .length > 0);
        if (confDiffOrig.length === 1) {
            isRenameOrMove = true;
        }
    // check if the diff is an alias moved/copied from an existing value
    } else if (diff.kind === 'N' && diff.path[2] === 'aliases') {
        let existingAlias = configDiff.filter((confDiff) => confDiff.kind === 'D'
            && confDiff.path.length === 4
            && confDiff.path[3] === diff.path[3]);

        // alias came from a domain that is either deleted or renamed
        if (existingAlias.length === 0) {
            existingAlias = configDiff.filter((confDiff) => confDiff.kind === 'D'
                && confDiff.lhs !== undefined
                && confDiff.lhs !== {}
                && confDiff.lhs.properties
                && confDiff.lhs.properties.aliases
                && Object.keys(confDiff.lhs.properties.aliases).length > 0
                && Object.keys(confDiff.lhs.properties.aliases)
                    .filter((alias) => alias === diff.path[3])
                    .length > 0);
        }
        if (existingAlias.length > 0) {
            isRenameOrMove = true;
        }
    }
    return isRenameOrMove;
};

const parseTopologyCommands = function (context, desiredConfig, trans, diffUpdates) {
    // you can't really edit topology records, so make sure to delete any first
    const existingDelete = trans.find((command) => command.indexOf('delete gtm topology all') > -1);
    if (!existingDelete) {
        trans.push('tmsh::delete gtm topology all');
    }

    const commands = diffUpdates.commands.split('\n');
    commands.forEach((command) => {
        // order matters - description cannot be first prop
        // since there is no separate key/identifier
        if (command.indexOf('create gtm topology  description') > -1) {
            const descr = command.substring(command.indexOf('description '), command.indexOf('ldns: '));
            const coreCmd = command.replace(descr, '');
            trans.push(`${coreCmd} ${descr}`);
        } else if (!trans.find(command)) {
            trans.push(command);
        }
    });
    // If longestMatch is disabled (and if the transaction with all the records succeeds)
    // Then proceed to trying individual creates wrapped in transactions
    // Normally we don't need to do this
    // But for some reason, having the records in the same transaction does not honor the order!
    const longestMatchEnabled = desiredConfig[constants.gtmSettingsMockPath].properties['topology-longest-match'];
    if (longestMatchEnabled === 'no' && util.versionLessThan(util.getDeepValue(context, 'target.tmosVersion'), '14.1')) {
        // close out previous set of command's trans, and start new one
        if (trans[trans.length - 1].indexOf('commit_transaction') === -1) {
            trans.push(COMMIT_TRANS);
        }
        let lastNonCreateIndex = trans.length - 1;
        let nonCreateAdded = false;
        let createAdded = false;
        trans.filter((cmd) => cmd.indexOf('_transaction') === -1).forEach((command) => {
            if (command.indexOf('tmsh::create gtm topology') === -1) {
                if (!nonCreateAdded) {
                    trans.push(BEGIN_TRANS);
                    trans.push(command);
                    lastNonCreateIndex += 2;
                    nonCreateAdded = true;
                } else {
                    trans.splice(lastNonCreateIndex + 1, 0, command);
                    lastNonCreateIndex += 1;
                }
            } else {
                if (!createAdded) {
                    trans.push(COMMIT_TRANS);
                    createAdded = true;
                }
                trans.push(BEGIN_TRANS);
                trans.push(command);
                trans.push(COMMIT_TRANS);
            }
        });
        // remove extra commit trans
        trans.pop();
    }
};

const getTopologyDiff = function (currentConfig, desiredConfig, currentValue, desiredValue, prefilter) {
    let ignoreOrder = false;
    const desiredLongestMatch = desiredConfig[constants.gtmSettingsMockPath];

    const getRecordValue = function (key, records) {
        return `${records[key]['ldns:']} ${records[key]['server:']} ${records[key]['score:']}`;
    };

    if (currentConfig[constants.gtmSettingsMockPath].properties['topology-longest-match'] !== desiredConfig[constants.gtmSettingsMockPath].properties['topology-longest-match']) {
        currentValue.properties.records = [];
    }

    if (desiredLongestMatch && desiredLongestMatch.properties['topology-longest-match'] === 'yes') {
        ignoreOrder = true;
    }

    if (ignoreOrder) {
        let currentRecords = currentValue.properties.records;
        let desiredRecords = desiredValue.properties.records;
        currentRecords = Object.keys(currentRecords).map((key) => getRecordValue(key, currentRecords)).sort();
        desiredRecords = Object.keys(desiredRecords).map((key) => getRecordValue(key, desiredRecords)).sort();
        return deepDiff(currentRecords, desiredRecords, prefilter);
    }

    return deepDiff(currentValue, desiredValue, prefilter);
};

const updateWildcardMonitorDiffs = function (monKey, currentConf, desiredConf, currentVal, desiredVal) {
    // for monitor wildcard updates, monitors need to be detached separately from pool
    // find existing references, make current monitor set to 'none'
    // so that diff will be generated and prop reset with actual monitor value
    const sameDest = currentVal.properties.destination === desiredVal.properties.destination;
    if (!sameDest && (currentVal.properties.destination === '*:*' || desiredVal.properties.destination === '*:*')) {
        Object.keys(desiredConf).forEach((key) => {
            if (key !== monKey) {
                const desiredConfItem = desiredConf[key];
                const currentConfItem = currentConf[key];
                if (desiredConfItem.command.startsWith('ltm pool') && desiredConfItem.properties.monitor) {
                    const poolMonitors = Object.keys(desiredConfItem.properties.monitor);
                    if (poolMonitors.length === 1 && poolMonitors[0] === monKey) {
                        currentConfItem.properties.monitor = 'none';
                    } else {
                        delete currentConfItem.properties.monitor[monKey];
                    }
                    const poolMembersKeys = Object.keys(desiredConfItem.properties.members);
                    poolMembersKeys.forEach((pmKey) => {
                        const poolMember = desiredConfItem.properties.members[pmKey];
                        if (poolMember.monitor) {
                            const pmMonitors = Object.keys(poolMember.monitor);
                            if (pmMonitors.length === 1 && pmMonitors[0] === monKey) {
                                poolMember.monitor = { default: {} };
                            } else {
                                delete poolMember.monitor[monKey];
                            }
                        }
                    });
                }
            }
        });
    }
};

/**
 * Add special rename case (R) to diff
 *
 * @private
 * @param {object} diff
 * @returns {object} new diff
 */
const addRenameCase = function (diff) {
    const newDiff = [];
    const deleteObjs = [];
    const createObjs = [];

    const getCreateObj = function (delObj, properties) {
        for (let i = 0; i < createObjs.length; i += 1) {
            const matchProps = properties.reduce((accumTruth, prop) => accumTruth
                && createObjs[i].rhs.properties[prop] === delObj.lhs.properties[prop], true);
            if ((delObj.lhs.command === createObjs[i].rhs.command) && matchProps) {
                return createObjs.splice(i, 1)[0];
            }
        }
        return null;
    };

    diff.forEach((d) => {
        if ((d.kind !== 'D' && d.kind !== 'N') || d.path.length > 1
            || d.path[0].startsWith('/Common/Shared') === false) {
            return newDiff.push(d);
        }
        if (d.kind === 'D') {
            return deleteObjs.push(d);
        }
        return createObjs.push(d);
    });

    deleteObjs.forEach((deleteObj) => {
        let createObj = null;
        switch (deleteObj.lhs.command) {
        case 'ltm virtual-address':
            createObj = getCreateObj(deleteObj, ['address']);
            break;
        default:
        }
        if (createObj === null) {
            newDiff.push(deleteObj);
            return;
        }
        newDiff.push({
            kind: 'R',
            path: deleteObj.path,
            rhs: createObj.path[0]
        });
    });

    return newDiff.concat(createObjs);
};

const getDiff = function (context, currentConfig, desiredConfig, commonConfig, tenantId, uncheckedDiff) {
    const prefilter = function (objPath, objKey) {
        if ((objPath.length === 1 && objKey === 'ignore')
            || (objPath.length === 2 && objPath[1] === 'ignore')) {
            return true;
        }
        if (objPath[1] === 'properties') {
            const item = desiredConfig[objPath[0]];
            let keyPath = '';
            for (let i = 2; i < objPath.length; i += 1) {
                keyPath += (`${objPath[i]}.`);
            }
            if (item !== undefined && item.ignore.indexOf(keyPath + objKey) > -1) {
                return true;
            }
        }
        return false;
    };

    function addNewItemsToUncheckedDiff(finalDiffs) {
        if (context.tasks[context.currentIndex].unchecked && tenantId === 'Common' && context.tasks[context.currentIndex].firstPassNoDelete) {
            // New items in the diff
            finalDiffs.forEach((key) => {
                if (key.kind === 'N' && typeof uncheckedDiff[key.path[0] === 'undefined']) {
                    uncheckedDiff[key.path[0]] = util.simpleCopy(desiredConfig[key.path[0]]);
                }
            });
        }
    }

    const orderedItems = [];

    // handle cases where we need to delete an entry in current config so modifications
    // can occur as required.
    Object.keys(currentConfig).forEach((configKey) => {
        const currentValue = currentConfig[configKey];
        const desiredValue = desiredConfig[configKey];
        // if ignoreChanges is set to false for asm policies, delete the entry from the
        // current config so deepDiff can pick up a change. Set edit true for tmshUpdateScript
        if (desiredValue && currentValue) {
            if ((currentValue.command === 'asm policy' || currentValue.command === 'apm profile access' || currentValue.command === 'apm policy access-policy')
                && desiredValue.properties.ignoreChanges === false) {
                delete currentConfig[configKey];
                desiredValue.properties.edit = true;
            }
            // delete service discovery entries so the icall script can be updated as required
            if (currentValue.command === 'sys config merge file'
                && serviceDiscoveryDiff(currentValue, desiredValue)) {
                delete currentConfig[configKey];
                desiredValue.properties.edit = true;
            }

            // delete protocol inspection profile 'defaults-from' if our currentConfig incorrectly
            // shows that the profile was created from a parent profile
            if (currentValue.command === 'security protocol-inspection profile'
                && currentValue.properties['defaults-from'] === '/Common/protocol_inspection'
                && !desiredValue.properties['defaults-from']) {
                delete currentValue.properties['defaults-from'];
            }

            // topology records need to be recreated when making changes - esp order is readonly
            // to simplify, remove and recreate all records
            if (currentValue.command === 'gtm topology') {
                // if there's a diff, let's force them to be new
                // otherwise, let the next deepdiff call detect the no change
                if (getTopologyDiff(currentConfig, desiredConfig, currentValue, desiredValue, prefilter)) {
                    delete currentConfig[configKey];
                } else {
                    desiredConfig[configKey] = currentConfig[configKey];
                }
            }

            if (currentValue.command === 'ltm virtual' || currentValue.command.startsWith('gtm wideip ')) {
                // Add an array which captures the order of the irules so we generate a diff
                // when the order changes. Otherwise, order is only in the keys of the object
                // which will not create a diff.
                if (currentValue.properties.rules) {
                    currentValue.properties.rules._order_ = Object.keys(currentValue.properties.rules);
                    orderedItems.push(currentValue.properties.rules);
                }
                if (desiredValue.properties.rules) {
                    desiredValue.properties.rules._order_ = Object.keys(desiredValue.properties.rules);
                    orderedItems.push(desiredValue.properties.rules);
                }
            }

            if (currentValue.properties.iControl_post) {
                delete currentValue.properties.iControl_post;
            }

            if (desiredValue.command.startsWith('ltm monitor')) {
                updateWildcardMonitorDiffs(configKey, currentConfig, desiredConfig, currentValue, desiredValue);
            }

            // Due to the unique duplicating nature of net address-lists and firewall address-lists,
            // we must modify the current to match the desired. Otherwise, we cannot be idempotent.
            if (desiredValue.command === 'net address-list' || desiredValue.command === 'security firewall address-list') {
                if (desiredValue.command === 'security firewall address-list') {
                    currentValue.command = 'security firewall address-list';
                    // Add firewall address-list specific properties into the object
                    currentValue.properties.fqdns = currentValue.properties.fqdns || {};
                    currentValue.properties.geo = currentValue.properties.geo || {};
                } else {
                    currentValue.command = 'net address-list';
                    // Remove firewall address-list specific properties
                    delete currentValue.properties.fqdns;
                    delete currentValue.properties.geo;
                }
            }
        // we should only track this if we have a desired value
        } else if (currentValue && currentValue.command === 'gtm global-settings load-balancing') {
            delete currentConfig[configKey];
        }

        if (!desiredValue && currentValue && currentValue.command === 'gtm topology' && context.tasks[context.currentIndex].gtmTopologyProcessed) {
            // gtm topology is common to all tenants and has already been processed in another tenant
            // delete it from the current config so the diff doesn't delete them
            delete currentConfig[configKey];
        }
    });

    let finalDiffs = [];
    const initialDiffs = deepDiff(currentConfig, desiredConfig, prefilter) || [];
    const pathCounts = initialDiffs.reduce((counts, diff) => {
        const path = diff.path[0];
        counts[path] = (counts[path] || 0) + 1;
        return counts;
    }, {});

    initialDiffs.forEach((diff) => {
        let keep = true;
        if (diff.path[diff.path.length - 1] === 'ignoreChanges' || diff.path[diff.path.length - 1] === 'file') {
            keep = false;
        }
        // filter out iControl calls when they are the only thing in the diff
        const isOnlyChange = pathCounts[diff.path[0]] === 1;
        if (isOnlyChange && diff.path[diff.path.length - 1].startsWith('iControl_')) {
            keep = false;
        }
        if (keep) {
            finalDiffs.push(diff);
        }
    });

    maintainCommonNodes(context, finalDiffs, desiredConfig, commonConfig.nodeList, tenantId, uncheckedDiff);
    maintainCommonVirtualAddresses(finalDiffs, desiredConfig, commonConfig.virtualAddressList);

    // Clean up any items we added an order field to. Now that the diff is generated, we no longer
    // want these extra properties.
    orderedItems.forEach((item) => {
        delete item._order_;
    });

    return preserveDiscoveredNodes(context, finalDiffs, currentConfig)
        .then(() => {
            finalDiffs = addRenameCase(finalDiffs);
        })
        .then(() => {
            addNewItemsToUncheckedDiff(finalDiffs);
            return finalDiffs;
        });
};

const getPreamble = function () {
    return [
        'cli script __appsvcs_update {',
        'proc script::run {} {',
        'if {[catch {',
        'tmsh::modify ltm data-group internal __appsvcs_update records none',
        '} err]} {',
        'tmsh::create ltm data-group internal __appsvcs_update type string records none',
        '}',
        'if { [catch {'];
};

const getRollback = function () {
    return [
        '} err] } {',
        'catch { tmsh::cancel_transaction } e',
        'regsub -all {"} $err {\\"} err',
        'tmsh::modify ltm data-group internal __appsvcs_update records add \\{ error \\{ data \\"$err\\" \\} \\}'
    ];
};

const getFinale = function () {
    return ['}}', '}'];
};

const updateWildcardMonitorCommands = function (trans) {
    // need to rearrange commands when a monitor that is referenced is being updated
    // (these diffs are triggered depending on destination change, see updateWildcardMonitorDiffs)

    // move the delete and detach commands in their own transaction
    // this allows devices in HA to properly sync
    // (delete and create in same transaction is not allowed for HA)

    const delPool = 'tmsh::delete ltm pool';
    const createPool = 'tmsh::create ltm pool';
    const delMon = 'tmsh::delete ltm monitor';
    const createMon = 'tmsh::create ltm monitor';

    const poolEntries = trans.filter((t) => t.indexOf(delPool) > -1 && t.indexOf(createPool) > -1);
    const monitorEntries = trans.filter((t) => t.indexOf(delMon) > -1 && t.indexOf(createMon) > -1);

    let updatedTrans = [];

    const getDetachFromPoolCmds = function (poolCmds) {
        return poolCmds.map((p) => {
            const pName = p.substring(delPool.length + 1, p.indexOf('\n')).trim();
            // detach from both pool and poolMember level
            return `tmsh::modify ltm pool ${pName} monitor none members none`;
        }).join('\n');
    };

    if (poolEntries.length && monitorEntries.length) {
        const newTransCmds = [];
        trans.forEach((transItem) => {
            const existingTransCmds = [];

            const commands = transItem.split('\n');
            commands.forEach((cmd, index) => {
                const isDeleteCmd = cmd.indexOf(delMon) > -1;
                const nextCmd = commands[index + 1];
                const isNextCreate = isDeleteCmd && nextCmd && nextCmd.indexOf(cmd.replace('delete', 'create')) > -1;
                const monName = cmd.substring(cmd.lastIndexOf(' ') + 1);
                const matchingPools = poolEntries.filter((p) => p.indexOf(monName) > -1);
                if (isDeleteCmd && isNextCreate && matchingPools.length) {
                    // separate delete and detach monitor into its own transaction
                    newTransCmds.push(getDetachFromPoolCmds(matchingPools));
                    newTransCmds.push(cmd);
                } else {
                    existingTransCmds.push(cmd);
                }
            });
            updatedTrans.push(existingTransCmds.join('\n'));
        });
        if (newTransCmds.length > 0) {
            newTransCmds.splice(0, 0, BEGIN_TRANS);
            newTransCmds.push(COMMIT_TRANS);
            updatedTrans = newTransCmds.concat(updatedTrans);
        }
    } else {
        updatedTrans = trans;
    }

    return updatedTrans;
};

/**
 * Translate config differences into tmsh actions
 *
 * @public
 * @param {object} context
 * @param {object} desiredConfig
 * @param {object} currentConfig
 * @param {object} configDiff
 * @returns {Promise} - resolves to TMSH script to update device config
 */
const tmshUpdateScript = function (context, desiredConfig, currentConfig, configDiff) {
    log.debug('generating tmsh commands and pre-script iControlRest calls');
    let component;
    const updates = {
        script: '',
        iControlCalls: [],
        whitelistFiles: []
    };

    const protocolInspectionProfilesToModify = [];
    const partitionList = [];
    const createFirstDeleteLast = ['auth partition'];
    const createSecondDeleteSecondToLast = ['sys folder'];

    const preamble = getPreamble();
    const preTrans = []; // TODO: add Extensions class actions
    const preTrans2 = [];
    let trans = [BEGIN_TRANS];
    const trans2 = [BEGIN_TRANS];
    const commit = [COMMIT_TRANS];
    const postTrans = [];
    const postTrans2 = [];
    const rollback = getRollback();
    const finale = getFinale();
    const gtmModifyAliasPaths = [];
    const serviceDiscoveryReg = new RegExp('sys icall handler periodic.*?_pool_[\\s\\S]*?'
    + 'sys icall script.*?_pool_[\\s\\S]*?'
    + `ltm data-group internal /Common/${constants.as3CommonFolder}.*?_pool_`, 'gm');

    configDiff.forEach((diff) => {
        const partition = diff.path[0].split('/')[1];
        // when creating nodes in common we set this during the diff
        if (typeof diff.lhsCommand === 'undefined') {
            diff.lhsCommand = (currentConfig[diff.path[0]] || {}).command || '';
        }
        diff.rhsCommand = (desiredConfig[diff.path[0]] || {}).command || '';
        component = diff.rhsCommand || diff.lhsCommand;

        const diffUpdates = mapCli.generate(context, diff, desiredConfig, currentConfig);

        // Check if there is a preTrans/rollback to add and that it has NOT been added yet
        if (diffUpdates.preTrans && preTrans.indexOf(diffUpdates.preTrans) === -1) {
            preTrans.push(diffUpdates.preTrans);
        }
        if (diffUpdates.preTrans2 && preTrans.indexOf(diffUpdates.preTrans2) === -1) {
            preTrans2.push(diffUpdates.preTrans2);
        }
        if (diffUpdates.rollback && rollback.indexOf(diffUpdates.rollback) === -1) {
            rollback.push(diffUpdates.rollback);
        }
        if (diffUpdates.postTrans && postTrans.indexOf(diffUpdates.postTrans) === -1) {
            // Unshift is used here, because deleting of sys folders must happen at the end
            postTrans.unshift(diffUpdates.postTrans);
        }
        if (diffUpdates.postTrans2 && postTrans2.indexOf(diffUpdates.postTrans2) === -1) {
            // Unshift is used here, because deleting of sys folders must happen at the end
            postTrans2.unshift(diffUpdates.postTrans2);
        }

        if (diffUpdates.iControlCalls.length > 0) {
            updates.iControlCalls = updates.iControlCalls.concat(diffUpdates.iControlCalls);
        }
        if (diffUpdates.whitelistFiles.length > 0) {
            updates.whitelistFiles = updates.whitelistFiles
                .concat(diffUpdates.whitelistFiles);
        }
        // If diff contains protocol-inspection profile to Delete, and Diff includes services block,
        // store the Profile name, for additional TMSH::MODIFY commands later
        if (diff.command === 'security protocol-inspection profile'
            && diff.path.indexOf('services') > -1
            && diff.kind === 'D'
            && protocolInspectionProfilesToModify.indexOf(diff.path[0]) === -1) {
            protocolInspectionProfilesToModify.push(diff.path[0]);
        }

        /* BIG-IP < v14.1 does not allow protocol inspection profiles to be assigned to a Service via DELETE+CREATE
        commands in a transaction. */
        if (diff.kind !== 'D'
            && diff.command === 'ltm virtual'
            && util.versionLessThan(util.getDeepValue(context, 'target.tmosVersion'), '14.1')) {
            const serviceName = diff.path[0];

            const generateModifyCommand = function () {
                // Create a 'mocked' desired config to reduce the number of properties in the modify command
                const modifyConfig = util.simpleCopy(desiredConfig);

                modifyConfig[serviceName].properties = {
                    profiles: modifyConfig[serviceName].properties.profiles
                };
                return mapCli.generate(context, diff, modifyConfig, currentConfig).commands.split('\n')
                    .filter((cmd) => cmd.indexOf('tmsh::create') > -1)
                    .join('\n')
                    .replace(/tmsh::create/, 'tmsh::modify');
            };
            // Handle Service referencing a Profile in decl
            const potentialProfile = desiredConfig[diff.path[diff.path.length - 1]];
            if (potentialProfile && potentialProfile.command === 'security protocol-inspection profile') {
                diffUpdates.commands = generateModifyCommand();
            }
            // Handle creation of a new Service, which references a Profile in decl
            if (diff.kind === 'N' && diff.path.length === 1) {
                const profilesToDelete = (Object.keys(diff.rhs.properties.profiles) || [])
                    .filter((profile) => Object.keys(desiredConfig).indexOf(profile) > -1
                        && desiredConfig[profile].command === 'security protocol-inspection profile');
                // Only modify tmsh commands if there's actually a protocol inspection profile attached to Service
                if (profilesToDelete.length > 0) {
                    // push to postTransaction with intact 'desiredConfig'
                    postTrans.push(generateModifyCommand());
                    profilesToDelete.forEach((profile) => {
                        delete desiredConfig[serviceName].properties.profiles[profile];
                    });
                    const createCommands = mapCli.generate(context, diff, desiredConfig, currentConfig);
                    diffUpdates.commands = createCommands.commands;
                }
            }
        }

        if (preamble.concat(preTrans, preTrans2, trans, trans2, postTrans, postTrans2, rollback)
            .indexOf(diffUpdates.commands) === -1) {
            if (!context.tasks[context.currentIndex].firstPassNoDelete || diff.kind === 'N') {
                // handle create & modify
                if (diff.kind !== 'D') {
                    if (diff.rhs && diff.rhs.command === 'sys config merge file') {
                        const commands = diffUpdates.commands.split('\n');
                        commands.forEach((command) => {
                            // create folder in common
                            if (command.indexOf(`sys folder /Common/${constants.as3CommonFolder}`) > -1) {
                                preTrans.push(command);
                            } else if (command.indexOf('delete ltm data-group') > -1) {
                                preTrans.push(`catch { ${command} } err`);
                            } else {
                                // merge config file
                                // create data-group
                                trans.push(command);
                            }
                        });
                    } else if (diffUpdates.commands.indexOf('asm policy') > -1) {
                        const cmd = diffUpdates.commands;
                        // asm policies are not supported in transactions
                        trans.unshift(cmd);
                    } else if (diffUpdates.commands.indexOf('sys file ssl-') > -1) {
                        const commands = diffUpdates.commands.split('\n');
                        commands.forEach((command) => {
                            if (command.indexOf('modify sys') > -1) {
                                postTrans.push(command);
                            } else if (trans.indexOf(command) < 0) {
                                trans.push(command);
                            }
                        });
                    } else if (diffUpdates.commands.indexOf('exec ng_import') > -1) {
                        trans.push(diffUpdates.commands);
                        const importCommand = diffUpdates.commands.split('\n')[1].split(' ');
                        if (importCommand.length === 6) {
                            rollback.splice(3, 0, `catch { exec ng_profile -p ${importCommand[5]} -deleteall ${importCommand[3]} } e`);
                        } else {
                            rollback.splice(3, 0, `catch { exec ng_profile -t access_policy -p ${importCommand[7]} -deleteall ${importCommand[5]} } e`);
                        }
                    } else if (diffUpdates.commands.indexOf('create gtm pool a') > -1) {
                        // This will trigger on 'create gtm pool a' as well as 'create gtm pool aaaa'
                        if (util.getDeepValue(context.tasks[context.currentIndex], 'metadata.gslbPool.needsWait')) {
                            preTrans2.push('after 20000'); // allow time for virtuals to be discovered
                        }
                        trans2.push(diffUpdates.commands);
                    } else if (diffUpdates.commands.indexOf('create gtm wideip') > -1) {
                        if (gtmModifyAliasPaths.indexOf(diff.path[0]) > -1
                            || (diffUpdates.commands.indexOf('aliases none') === -1 && gtmNeedsModifyAliasCommand(configDiff, diff))) {
                            const aliasStartIndex = diffUpdates.commands.indexOf('aliases replace-all-with');
                            const aliasEndIndex = diffUpdates.commands.indexOf('\\}');
                            const aliasSubstr = diffUpdates.commands
                                .substring(aliasStartIndex, aliasEndIndex + 2);
                            const createWithoutAlias = diffUpdates.commands.replace(aliasSubstr, 'aliases none');
                            trans2.push(createWithoutAlias);

                            const path = util.getWideIpPath(diff.path[0]);
                            const modifyWithAlias = `tmsh::modify ${component} ${path} ${aliasSubstr}`;
                            postTrans2.push(modifyWithAlias);
                            gtmModifyAliasPaths.push(diff.path[0]);
                        } else {
                            trans2.push(diffUpdates.commands);
                        }
                    } else if (component.indexOf('gtm topology') > -1) {
                        parseTopologyCommands(context, desiredConfig, trans2, diffUpdates);
                    } else if (component.indexOf('gtm global-settings') > -1) {
                        const commands = diffUpdates.commands.split('\n');
                        const disableLongestMatch = commands.find((c) => c.indexOf('topology-longest-match no') > -1);
                        commands.forEach((cmd) => {
                            if (cmd.indexOf('topology-longest-match yes') === -1 || !disableLongestMatch) {
                                trans.push(cmd.replace('tmsh::create gtm global-settings', 'tmsh::modify gtm global-settings'));
                            }
                        });
                    } else if (diffUpdates.commands.indexOf('security dos profile') > -1) {
                        const app = (((desiredConfig[diff.path[0]] || {}).properties || {})
                            .application || {}).undefined || {};
                        // bot-signatures do not initialize properly when using
                        // tmsh::create, so a secondary tmsh::modify fixes this issue
                        if (app['bot-signatures']) {
                            const modApp = { modify: { undefined: {} } };
                            modApp.modify.undefined['bot-signatures'] = {
                                categories: app['bot-signatures'].categories
                            };
                            postTrans.push(`tmsh::modify ${diff.rhsCommand} ${diff.path[0]}`
                            + ` application${mapCli.stringify(diff.rhsCommand, modApp, true)}`);
                        }
                        trans.push(diffUpdates.commands);
                    } else if (createFirstDeleteLast.indexOf(component) !== -1 && diff.kind !== 'E') {
                        // create partition before transaction, if this is not a modify
                        preTrans.unshift(diffUpdates.commands);
                        // clean up partition when transaction fails.
                        // catch will fail harmlessly if transaction succeeds
                        // Note: Multiple commands are separated by newlines and so those need replaced
                        rollback.push(`catch { tmsh::delete ${
                            diffUpdates.commands.replace(/\n/g, ' ').split(' ').slice(1, 4).join(' ')} } e`);
                    } else if (createSecondDeleteSecondToLast.indexOf(component) > -1) {
                        // create folder second
                        preTrans.push(diffUpdates.commands);
                        // cleanup folder if transaction fails
                        rollback.push(`catch { tmsh::delete ${
                            diffUpdates.commands.split(' ').slice(1, 4).join(' ')} } e`);
                    } else if (diffUpdates.commands.indexOf('mgmt shared service-discovery rpc') > -1) {
                        postTrans.push(diffUpdates.commands);
                    } else if (diffUpdates.commands.indexOf('tmsh::modify ltm virtual') > -1) {
                        const commands = diffUpdates.commands.split('\n');
                        trans.push(commands[0]);
                    } else if (diffUpdates.commands.indexOf('ltm cipher group') > -1
                        && util.versionLessThan(context.target.tmosVersion, '14.0')) {
                        preTrans.push(diffUpdates.commands);
                        rollback.push(`catch { tmsh::delete ${
                            diffUpdates.commands.split(' ').slice(1, 5).join(' ')} } e`);
                    } else if (diff.command === 'ltm virtual-address' && diff.kind === 'E'
                        && diff.path[2] === 'address') {
                        // If editing a virtual-address address, throw error
                        throw new Error(`The Service Address virtualAddress property cannot be modified. Please delete ${diff.path[0]} and recreate it.`);
                    } else {
                        // put all other create commands into the cli transaction
                        trans.push(diffUpdates.commands);
                    }
                // handle delete
                } else if (createFirstDeleteLast.indexOf(component) !== -1) {
                    // delete partition last
                    rollback.unshift(diffUpdates.commands);

                    if (context.host.parser.nodelist.length > 0) {
                        const removeNodes = `tmsh::cd /${partition}\n`
                        + 'foreach {node} [tmsh::get_config /ltm node] {\n'
                        + '  tmsh::delete ltm node [tmsh::get_name $node]\n}\n'
                        + 'tmsh::cd /';
                        postTrans.push(removeNodes);
                    }
                } else if (diffUpdates.commands.indexOf('exec ng_profile') > -1) {
                    postTrans.push(diffUpdates.commands);
                } else if (createSecondDeleteSecondToLast.indexOf(component) !== -1) {
                    // delete folder second-to-last
                    postTrans.push(diffUpdates.commands);
                } else if (diffUpdates.commands.indexOf('tmsh::modify ltm pool') > -1) {
                    const commands = diffUpdates.commands.split('\n');
                    preTrans.push(commands[1]);
                } else if (diffUpdates.commands.indexOf('sys file ssl-') > -1) {
                    const commands = diffUpdates.commands.split('\n');
                    commands.forEach((command) => {
                        if (command.indexOf('modify sys') > -1) {
                            postTrans.push(command);
                        } else if (trans.indexOf(command) < 0) {
                            trans.push(command);
                        }
                    });
                } else if (diffUpdates.commands.indexOf('ltm policy') !== -1) {
                    // ltm policies can be created in a transaction, but cause conflicts
                    // when deleted in one. To avoid problems with references, two
                    // commands are needed to delete a policy
                    const commands = diffUpdates.commands.split('\n');
                    // add modify command to transaction to break references
                    trans.push(commands[0]);

                    // delete ltm policies just after transaction commit
                    // only delete if the delete is on the policy level, and not some other child prop
                    if (diff.path.length === 1) {
                        postTrans.unshift(commands[1]);
                    } else {
                        // these are child prop updates such as remove or rename rules
                        trans.push(commands[1]);
                        trans.push(commands[2]);
                    }
                } else if (diffUpdates.commands.indexOf('pem listener') !== -1
                    || diffUpdates.commands.indexOf('ltm dns zone') !== -1) {
                    // Delete PEM listeners early to avoid problems with virtual server
                    // references in the transaction
                    preTrans.push(diffUpdates.commands);
                } else if (serviceDiscoveryReg.test(diffUpdates.commands)) {
                    // Service discovery cleanup needs to wrap the removal of the
                    // data-group in a catch to avoid the case that the data-group
                    // doesn't exist. This doesn't work in a transaction, so we move
                    // it to the preTrans stage.
                    const commands = diffUpdates.commands.split('\n');
                    commands.forEach((command) => {
                        // delete data-group
                        if (command.indexOf('ltm data-group') > -1) {
                            preTrans.push(`catch { ${command} } err`);
                        } else {
                            // delete icall handler
                            // delete icall script
                            trans.push(command);
                        }
                    });
                } else if (diffUpdates.commands.indexOf('mgmt shared service-discovery rpc') > -1) {
                    preTrans.push(diffUpdates.commands);
                } else {
                    // put all other delete commands into the cli transaction
                    trans.push(diffUpdates.commands);
                }
            }
            if (partitionList.indexOf(partition) === -1) {
                partitionList.push(partition);
                trans.push(`tmsh::modify auth partition ${partition
                } description \\"Updated by AS3 at [clock format [clock seconds] -gmt true -format {%a, %d %b %Y %T %Z}]\\"`);
            }
            // Increment common node ref count on first pass of Common tenant
            if (context.tasks[context.currentIndex].firstPassNoDelete && diff.kind === 'E'
                && isConfigForCommonNode(diff.command, diff.path[0], diff.rhs.properties)) {
                trans.push(diffUpdates.commands);
            }
        }
    });
    /* Add TMSH::MODIFY commands for any Protocol Inspection Profiles to postTrans. Any Profiles that remove 'checks'
    from the Profile's Service block needs additional handling, since a TMSH replace-all-with will not reliably remove
    every Service 'check' from the Profile. */
    const tmshPipCommand = 'security protocol-inspection profile';
    protocolInspectionProfilesToModify.forEach((profileName) => {
        // First, force a Deletion of the whole services block
        postTrans.push(`tmsh::modify ${tmshPipCommand} ${profileName} services delete \\{ all \\}`);
        if (desiredConfig[profileName] && desiredConfig[profileName].properties.services) {
            // 'Mock out' a diff to pass to mapCli.generate() so that it generates the TMSH::CREATE command for us
            const mockedDiff = {
                kind: 'N',
                path: [profileName],
                rhs: {
                    command: tmshPipCommand,
                    properties: {
                        services: desiredConfig[profileName].properties.services
                    },
                    ignore: []
                },
                tags: ['tmsh'],
                command: tmshPipCommand,
                rhsCommand: tmshPipCommand
            };
            const pipConfig = mapCli.generate(context, mockedDiff, desiredConfig, currentConfig);
            const modifyCmd = pipConfig.commands.replace(/^tmsh::create/, 'tmsh::modify');
            // Second, Modify the Profile to re-create our services block
            postTrans.push(modifyCmd);
        }
    });

    trans = updateWildcardMonitorCommands(trans);
    updates.script = preamble.concat(preTrans, trans, commit);
    if (preTrans2.length > 0) {
        updates.script = updates.script.concat(preTrans2);
    }
    if (trans2.length > 1) { // trans2 starts pre-loaded with 'begin_transaction'
        updates.script = updates.script.concat(trans2, commit);
    }
    updates.script = updates.script.concat(postTrans, rollback, finale).join('\n');
    return updates;
}; // tmshUpdateScript()

const postProcessUpdateScript = function (context, updateInfo) {
    const preamble = getPreamble();
    let preTrans = [];
    let trans = [BEGIN_TRANS];
    const commit = [COMMIT_TRANS];
    const postTrans = [];
    let rollback = getRollback();
    const finale = getFinale();

    const updates = {
        script: '',
        iControlCalls: [],
        whitelistFiles: []
    };

    const commands = mapCli.getPostProcessAPMUpdates(context, updateInfo);

    if (Object.keys(commands).length === 0) {
        return null;
    }

    if (commands.preTrans) {
        preTrans = preTrans.concat(commands.preTrans);
    }
    if (commands.trans) {
        trans = trans.concat(commands.trans);
    }
    if (commands.rollback) {
        rollback = rollback.concat(commands.rollback);
    }

    updates.script = preamble.concat(preTrans, trans, commit, postTrans, rollback, finale).join('\n');
    return updates;
};

module.exports = {
    validClassList,
    tenantList,
    getDesiredConfig,
    getBigipConfig,
    getTenantConfig,
    getDiff,
    checkDesiredForReferencedProfiles,
    tmshUpdateScript,
    postProcessUpdateScript,
    isAs3Item,
    gatherAccessProfileItems,
    filterAs3Items, // exported for testing,
    updateAddressesWithRouteDomain, // exported for testing
    pathReferenceLinks, // exported for testing
    getCommonAccessProfiles,
    updateCommonAccessProfiles
};

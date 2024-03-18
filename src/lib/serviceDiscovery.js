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

const path = require('path');
const hashUtil = require('./util/hashUtil');
const util = require('./util/util');

/**
 * Creates a Discovery Worker task config item.
 *
 * @param {Object} sdItem - Service discovery item from declaration.
 * @param {String} tenantId - Tenant that service discovery item is associated with.
 * @param {Object[]} resources - Resource items and path from declaration.
 * @param {Object} resources[].item - Resource item
 * @param {Object} resources[].path - Resource path
 * @returns {Object}
 */
function createTask(sdItem, tenantId, resources) {
    if (['fqdn', 'static', 'event'].indexOf(sdItem.addressDiscovery) > -1) {
        sdItem.updateInterval = 0;
    }
    let task = {
        updateInterval: sdItem.updateInterval,
        resources: resources.map((r) => createTaskResource(r, sdItem))
    };
    if (!(['fqdn', 'static'].indexOf(sdItem.addressDiscovery) > -1)) {
        task.nodePrefix = `/${tenantId}/`;
    }
    task = Object.assign(task, createTaskProvider(sdItem));
    task.metadata = {
        configuredBy: 'AS3'
    };
    task.routeDomain = sdItem.routeDomain || 0;

    // ADD ANY NEW PROPERTIES ABOVE THIS LINE (task ID is a hash of the properties in the task)
    task.altId = generateAltTaskId(util.simpleCopy(task), sdItem);
    task.id = generateTaskId(task, sdItem);
    return task;
}

function createTaskResource(resource, sdItem) {
    let monitor = 'default';
    let type;
    let options;
    const member = sdItem.class === 'Address_Discovery' ? resource.member : sdItem;

    if (typeof member.monitors === 'object' && member.monitors.default === undefined) {
        monitor = `min ${member.minimumMonitors} of \\{ ${Object.keys(member.monitors).join(' ')} \\}`;
    }

    if (resource.item.class === 'Firewall_Address_List') {
        type = 'addressList';
        options = {};
    } else {
        type = 'pool';
        options = {
            servicePort: member.servicePort,
            connectionLimit: member.connectionLimit,
            rateLimit: member.rateLimit,
            dynamicRatio: member.dynamicRatio,
            ratio: member.ratio,
            priorityGroup: member.priorityGroup,
            state: member.state,
            session: member.session,
            monitor
        };
    }

    return {
        type,
        path: resource.path,
        options
    };
}

function createTaskProvider(sdItem) {
    const provObj = {
        provider: sdItem.addressDiscovery,
        providerOptions: {},
        ignore: {}
    };

    if (sdItem.addressDiscovery === 'fqdn' || sdItem.addressDiscovery === 'static') {
        provObj.provider = 'static';
        if (sdItem.bigip) { // BIG-IP Static Node
            provObj.providerOptions.nodes = [{ id: sdItem.bigip }];
        } else if (sdItem.hostname) { // FQDN Node
            provObj.providerOptions.nodes = [{ id: `${path.dirname(sdItem.name)}/${sdItem.hostname}` }];
        } else if (sdItem.name) { // Static Node
            const routeDomain = sdItem.routeDomain ? `%${sdItem.routeDomain}` : '';
            provObj.providerOptions.nodes = (sdItem.serverAddresses || []).map((addr) => ({
                id: `${path.dirname(sdItem.name)}/${addr}${routeDomain}`
            }));
            provObj.providerOptions.nodes = provObj.providerOptions.nodes.concat(
                (sdItem.servers || []).map((server) => ({
                    id: `${path.dirname(sdItem.name)}/${server.name}`
                }))
            );
        } else { // Firewall Address List IP
            provObj.providerOptions.nodes = sdItem.serverAddresses.map((addr) => ({
                id: addr
            }));
        }
    } else if (sdItem.addressDiscovery === 'aws') {
        provObj.providerOptions = {
            tagKey: sdItem.tagKey,
            tagValue: sdItem.tagValue,
            addressRealm: sdItem.addressRealm,
            region: sdItem.region,
            roleARN: sdItem.roleARN,
            externalId: sdItem.externalId,
            accessKeyId: sdItem.accessKeyId,
            secretAccessKey: sdItem.secretAccessKey
        };
        if (!sdItem.credentialUpdate && provObj.providerOptions.secretAccessKey) {
            provObj.ignore.providerOptions = {
                secretAccessKey: provObj.providerOptions.secretAccessKey
            };
        }
    } else if (sdItem.addressDiscovery === 'azure') {
        provObj.providerOptions = {
            tagKey: sdItem.tagKey,
            tagValue: sdItem.tagValue,
            resourceId: sdItem.resourceId,
            resourceType: sdItem.resourceType,
            addressRealm: sdItem.addressRealm,
            resourceGroup: sdItem.resourceGroup,
            subscriptionId: sdItem.subscriptionId,
            useManagedIdentity: sdItem.useManagedIdentity,
            tenantId: sdItem.directoryId,
            clientId: sdItem.applicationId,
            apiAccessKey: sdItem.apiAccessKey,
            environment: sdItem.environment
        };
        if (!sdItem.credentialUpdate) {
            provObj.ignore.providerOptions = { apiAccessKey: provObj.providerOptions.apiAccessKey };
        }
    } else if (sdItem.addressDiscovery === 'gce') {
        provObj.providerOptions = {
            tagKey: sdItem.tagKey,
            tagValue: sdItem.tagValue,
            addressRealm: sdItem.addressRealm,
            region: sdItem.region,
            encodedCredentials: sdItem.encodedCredentials,
            projectId: sdItem.projectId
        };
        if (!sdItem.credentialUpdate) {
            provObj.ignore.providerOptions = {
                encodedCredentials: provObj.providerOptions.encodedCredentials
            };
        }
    } else if (sdItem.addressDiscovery === 'consul') {
        provObj.providerOptions = {
            addressRealm: sdItem.addressRealm,
            uri: sdItem.uri,
            encodedToken: sdItem.encodedToken,
            trustCA: sdItem.trustCA,
            rejectUnauthorized: sdItem.rejectUnauthorized,
            jmesPathQuery: sdItem.jmesPathQuery
        };
        if (!sdItem.credentialUpdate) {
            provObj.ignore.providerOptions = { encodedToken: provObj.providerOptions.encodedToken };
        }
    }

    return provObj;
}

function generateAltTaskId(task, sdItem) {
    const primaryResource = task.resources[0];
    const resourcePath = (primaryResource && sdItem.class !== 'Address_Discovery') ? primaryResource.path : sdItem.path;

    if (task.provider === 'event') {
        return encodeURIComponent(resourcePath.replace(/\//g, '~'));
    }

    const taskCpy = util.simpleCopy(task);

    delete taskCpy.ignore;
    if (taskCpy.provider === 'aws') {
        delete taskCpy.providerOptions.secretAccessKey;
    } else if (taskCpy.provider === 'azure') {
        delete taskCpy.providerOptions.apiAccessKey;
    } else if (taskCpy.provider === 'gce') {
        delete taskCpy.providerOptions.encodedCredentials;
    } else if (taskCpy.provider === 'consul') {
        delete taskCpy.providerOptions.encodedToken;
    }

    const tenant = resourcePath.split('/')[1];
    return encodeURIComponent(util.mcpPath(tenant, null, hashUtil.hashTenant(JSON.stringify(taskCpy)))
        .replace(/\//g, '~'))
        .replace(/['%]/g, '');
}

function generateTaskId(task, sdItem) {
    const resourceHashProperties = [ // These are the property names we use to hash the taskId
        'path',
        'servicePort',
        'routeDomain',
        'provider',
        'uri',
        'jmesPathQuery',
        'region',
        'projectId',
        'resourceGroup',
        'subscriptionId',
        'directoryId',
        'applicationId',
        'tagKey',
        'tagValue',
        'serverAddresses',
        'bigip',
        'hostname',
        'fqdnPrefix',
        'shareNodes',
        'servers',
        'addressFamily',
        'resourceType',
        'resourceId',
        'environment'
    ];

    const flattenObject = function (obj, flattened) { // iterate through task to grab desired property values
        flattened = flattened || {};
        Object.keys(obj).forEach((key) => {
            if (typeof obj[key] === 'object') {
                flattenObject(obj[key], flattened);
            } else if (resourceHashProperties.includes(key) && typeof obj[key] !== 'undefined') {
                flattened[key] = JSON.parse(JSON.stringify(obj[key]));
            }
        });
        return flattened;
    };
    const primaryResource = task.resources[0];
    const resourcePath = (primaryResource && sdItem.class !== 'Address_Discovery') ? primaryResource.path : sdItem.path;

    if (task.provider === 'event') {
        return encodeURIComponent(resourcePath.replace(/\//g, '~'));
    }

    const flattenedObj = flattenObject(task);

    const tenant = resourcePath.split('/')[1];
    return encodeURIComponent(util.mcpPath(tenant, null, hashUtil.hashTenant(JSON.stringify(flattenedObj)))
        .replace(/\//g, '~'))
        .replace(/['%]/g, '');
}

/**
 * Creates a Discovery Worker task config item from TMSH task command object.
 *
 * @param {Object} tmshObj - TMSH task command object.
 * @returns {Object}
 */
function getTaskFromTmsh(tmshObj) {
    const task = util.simpleCopy(tmshObj);

    util.objToArr(task, 'resources');
    if (task.providerOptions.nodes) {
        util.objToArr(task.providerOptions, 'nodes');
    }

    return task;
}

/**
 * Converts arrays in a Discovery Worker task config item to a compatible object for normalize.
 *
 * @param {Object} tmshObj - TMSH task command object.
 * @returns {Object}
 */
function prepareTaskForNormalize(task) {
    task.resources.forEach((r, i) => { r.name = i.toString(); });
    if (task.providerOptions.nodes) {
        task.providerOptions.nodes.forEach((n, i) => { n.name = i.toString(); });
    }

    return task;
}

module.exports = {
    createTask,
    createTaskResource,
    prepareTaskForNormalize,
    getTaskFromTmsh,
    generateTaskId,
    createTaskProvider
};

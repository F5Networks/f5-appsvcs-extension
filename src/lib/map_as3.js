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

const crypto = require('crypto');
const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;
const arrUtil = require('@f5devcentral/atg-shared-utilities').arrayUtils;
const normalize = require('./normalize');
const util = require('./util/util');
const PolicyParser = require('./ltmPolicyParser');
const log = require('./log');
const serviceDiscovery = require('./serviceDiscovery');
const constants = require('./constants');

/**
 * resolve "JWE" object (cryptogram) in declaration
 * to something that we can pass to TMOS.  Return
 * value may be plaintext or SecureVault cryptogram
 *
 * @private
 * @param {object} item
 * @param {string} key - property name like "passphrase"
 * @returns {string}
 */
const secret = function secret(item, key) {
    // TODO: currently assumes mini-JWE
    return ((typeof item[key] !== 'object')
        || !item[key].ciphertext.length) ? ''
        : util.fromBase64(item[key].ciphertext).toString();
}; // secret()

const bigipPathFromSrc = function bigipPathFromSrc(src, dfl) {
    let ppty;
    let path;

    if (typeof src === 'string') {
        path = (src !== '') ? src : dfl;
    } else if ((typeof src !== 'object') || (src === null)) {
        path = dfl;
    } else {
        ppty = (Object.prototype.hasOwnProperty.call(src, 'bigip')) ? 'bigip' : 'use';
        path = (src[ppty] !== '') ? src[ppty] : dfl;
    }
    return path;
};

/**
  * When item[key] is a string (like "generic") that
  * is just our short name for something (like
  * "/Common/ca-bundle.crt") you can usually replace
  * it without calling this function.
  *
  * We often want a path to a bigip config component
  * from the declaration.  That path is in a property,
  * which might be a string or an object with a sub-
  * property (like 'bigip' or 'use') holding the path.
  * Generally a path to a bigip component matches the
  * path to the corresponding declaration object, as
  * /Tenant/Application/Foo => /Partition/Folder/Foo.
  * But sometimes the declaration specifies a bigip
  * component which does not correspond to anything
  * in the declaration (like "/Common/f5-tcp-mobile"),
  * and sometimes one declaration object generates
  * multiple bigip components (such as an AS3 virtual
  * server generating a separate bigip virtual server
  * for each virtualAddress).
  *
  * The parser validates most paths which actually
  * appear in any declaration.  Because declaration-
  * paths and bigip paths have different validation
  * criteria the schema segregates them in properties
  * ('bigip', 'use') so the parser can apply suitable
  * criteria to each.
  *
  * Once we find the basic path here, we can compute
  * the final path according to the type of component
  * expected.
  *
  * @private
  * @param {object} item - declaration object
  * @param {string} key - name of property from which to extract path
  * @param {string|undefined} [dfl=undefined] - return this if no path found
  * @returns {string|undefined}
  */
const bigipPath = function bigipPath(item, key, dfl) {
    const src = item[key];
    return bigipPathFromSrc(src, dfl);
};

/**
 * TODO:
 * ??? replaces short name of BIG-IP profile with reference
 *
 * @private
 * @param {object} item
 * @param {string} key
 * @param {string} context
 * @returns {object}
 */
const profile = function profile(item, key, context, declaration) {
    if (typeof item[key] !== 'undefined' && item[key] !== '') {
        context = context || 'all';
        item.profiles = item.profiles || [];
        if (typeof item[key] === 'string') {
            const n = ((item[key].charAt(0) === '/') ? '' : '/Common/') + item[key];
            if (key === 'serverTLS' || key === 'clientTLS') {
                const path = item[key].split('/');
                if (path.length !== 4) {
                    throw new Error(`Expected '${item[key]}' to be an absolute path.  This may have happened because ${key} was applied to a Service that does not support it.`);
                }
                const profileDef = declaration[path[1]][path[2]][path[3]];
                if (typeof profileDef.ldapStartTLS !== 'undefined' && profileDef.ldapStartTLS !== 'none') {
                    const profName = util.mcpPath(path[1], path[2], `f5_appsvcs_${context}_${profileDef.ldapStartTLS}`);
                    item.profiles.push({ name: profName, context });
                }
                if (key === 'serverTLS' && typeof profileDef.smtpsStartTLS === 'string') {
                    const profName = util.mcpPath(path[1], path[2], `f5_appsvcs_smtps_${profileDef.smtpsStartTLS}`);
                    item.profiles.push({ name: profName, context: 'all' });
                }
            }

            if (key === 'serverTLS') {
                const path = item[key].split('/');
                const profileDef = declaration[path[1]][path[2]][path[3]];
                if (profileDef) {
                    (profileDef.certificates || []).forEach((certObj, i) => {
                        let profName;
                        if (profileDef.namingScheme === 'certificate') {
                            profName = n.replace(/([^/]*)$/, certObj.certificate.split('/').pop());
                        } else {
                            profName = i === 0 ? n : `${n}-${i}-`;
                        }
                        item.profiles.push({ name: profName, context });
                    });
                }
            } else {
                item.profiles.push({ name: n, context });
            }
        } else if (Array.isArray(item[key])) {
            item[key].forEach((profileDef) => {
                let path = bigipPathFromSrc(profileDef);

                if ((key === 'policyIAM' || key === 'profileAccess') && path.split('/').length === 4) {
                    const splitPath = path.split('/');
                    path = `/${splitPath[1]}/${splitPath[3]}`;
                }

                if (path !== undefined) {
                    const profileObj = {};
                    Object.assign(profileObj, item[key]);
                    profileObj.name = path;
                    profileObj.context = context;
                    item.profiles.push(profileObj);
                }
            });
        } else {
            let path = bigipPath(item, key);

            if ((key === 'policyIAM' || key === 'profileAccess') && path.split('/').length === 4) {
                const splitPath = path.split('/');
                path = `/${splitPath[1]}/${splitPath[3]}`;
            }

            if (path !== undefined) {
                item[key].name = path;
                item[key].context = context;
                item.profiles.push(item[key]);
            }
        }
    }
    return item;
};

const createIRule = function createIRule(config) {
    // forgive whitespace bordering the irule definition to make match with MCP
    if (config.ignore.indexOf('api-anonymous') < 0) {
        config.properties['api-anonymous'] = config.properties['api-anonymous']
            .trim()
            .replace(/\r\n/g, '\n') // unix-style line endings
            .replace(/[ \t]+\n/g, '\n') // trim whitespace on every line
            .replace(/\\\n[ \t]+/g, ''); // remove continuation characters
    }
    return { configs: [config] };
};

const createPolicyStringArray = function createPolicyStringArray(array, spec) {
    return array.map(
        (i, index) => ({
            name: `${index}`,
            policyString: PolicyParser.convertAs3ObjectToString(i, spec)
        })
    );
};

const getDefaultRouteDomain = function getDefaultRouteDomain(declaration, tenantId) {
    let defaultRouteDomain = util.getDeepValue(declaration, [tenantId, 'defaultRouteDomain']);
    if (typeof defaultRouteDomain === 'undefined' || defaultRouteDomain === 0) {
        defaultRouteDomain = '';
    } else {
        defaultRouteDomain = `%${defaultRouteDomain}`;
    }
    return defaultRouteDomain;
};

const tagMetadata = function (item) {
    item.metadata = [
        {
            name: 'as3',
            persist: 'true'
        }
    ];
};

const tagDescription = function (item) {
    item.remark = constants.as3ManagedDescription;
};

const parseTopologyMatch = function (item) {
    const parsedItem = {};
    let itemVal;
    if (typeof item.matchValue === 'object') {
        let val = item.matchValue.bigip || item.matchValue.use;
        if (item.matchType === 'region' || item.matchType === 'datacenter') {
            val = val.replace('/Common/Shared', '/Common');
        }
        itemVal = val;
        item.matchValue = val;
    } else if (item.matchType === 'state' || item.matchType === 'geoip-isp') {
        itemVal = `"${item.matchValue}"`;
    } else {
        itemVal = item.matchValue;
    }
    const notPrefix = item.matchOperator === 'not-equals' ? 'not ' : '';
    parsedItem[item.matchType] = item.matchValue;
    parsedItem.not = notPrefix.trim();
    parsedItem.name = `${notPrefix}${item.matchType} ${itemVal}`;
    tagDescription(parsedItem);
    return parsedItem;
};

const parseCertificate = function (item, options, app) {
    let cert = (item[options.srcCertPropName] || 'none');
    if (typeof cert === 'object') {
        if (!util.isEmptyOrUndefined(cert.bigip)) {
            item[options.destCertPropName] = cert.bigip;
            item[options.destKeyPropName] = cert.bigip.replace('.crt', '.key');
            item[options.destPasswrdPropName] = 'none';
            return;
        }
        cert = cert.use;
    }
    cert = cert.replace(/\.crt$/, '');

    // There is some post processing done in the Certificates part of map_as3.translate()
    // as such we format any chainCA bundle with -bundle.crt for later discovery.
    // At which time we convert it to what it needs to be (be it use, bigip, or string).
    // I am not sure why we do that there, but it's likely something to do with transactions not
    // working as intended and this is VERY OLD CODE.
    const certName = cert.replace(/.*\//g, '');
    const tenantCert = app[certName];
    if (tenantCert && tenantCert.chainCA) {
        item.chain = `${cert}-bundle.crt`;
    } else {
        item.chain = item.chain || 'none';
    }
    item[options.destCertPropName] = cert + (cert !== 'none' ? '.crt' : '');
    item[options.destKeyPropName] = cert + (cert !== 'none' ? '.key' : '');

    // check certificate declaration for a passphrase
    if (certName !== 'none') {
        item.ignore = item.ignore || {};
        item[options.destPasswrdPropName] = tenantCert[options.srcPasswrdPropName] || undefined;
        if (typeof item[options.destPasswrdPropName] === 'object') {
            const ignoreChanges = (tenantCert[options.srcPasswrdPropName].ignoreChanges === true);
            item[options.destPasswrdPropName] = secret(item, options.destPasswrdPropName);
            if (ignoreChanges === true) {
                item.ignore[options.destPasswrdPropName] = item[options.destPasswrdPropName];
                tenantCert.ignore = tenantCert.ignore || {};
                tenantCert.ignore[options.destPasswrdPropName] = item[options.destPasswrdPropName];
            }
        } else if (typeof item[options.destPasswrdPropName] === 'string' && tenantCert.ignore
                   && tenantCert.ignore[options.srcPasswrdPropName]) {
            item.ignore[options.destPasswrdPropName] = item[options.destPasswrdPropName];
        }
    }
};

const updateTlsOptions = function (item, context) {
    item.options = [];

    if (!item.insertEmptyFragmentsEnabled) {
        item.options.push('dont-insert-empty-fragments');
    }
    delete item.insertEmptyFragmentsEnabled;

    if (item.singleUseDhEnabled) {
        item.options.push('single-dh-use');
    }
    delete item.singleUseDhEnabled;

    if (!util.versionLessThan(context.target.tmosVersion, '14.0')) {
        if (!item.tls1_3Enabled) {
            item.options.push('no-tlsv1.3');
        }
    }
    delete item.tls1_3Enabled;

    if (!item.tls1_2Enabled) {
        item.options.push('no-tlsv1.2');
    }
    delete item.tls1_2Enabled;

    if (!item.tls1_1Enabled) {
        item.options.push('no-tlsv1.1');
    }
    delete item.tls1_1Enabled;

    if (!item.tls1_0Enabled) {
        item.options.push('no-tlsv1');
    }
    delete item.tls1_0Enabled;

    if (!item.dtlsEnabled) {
        item.options.push('no-dtls');
    }
    delete item.dtlsEnabled;

    if (!item.dtls1_2Enabled) {
        item.options.push('no-dtlsv1.2');
    }
    delete item.dtls1_2Enabled;

    if (!item.sslEnabled) {
        item.options.push('no-ssl');
    }
    delete item.sslEnabled;

    if (!item.ssl3Enabled) {
        item.options.push('no-sslv3');
    }
    delete item.ssl3Enabled;
};

const isInternal = function (item) {
    return item.virtualType === 'internal';
};

const updatePropsIfInternal = function (item) {
    if (isInternal(item)) {
        item.internal = {};

        // internal virtuals allow a source address but destination is
        // always 0.0.0.0 with a port of 'any'
        item.destination = '0.0.0.0:any';
        item.virtualAddresses = ['0.0.0.0'];

        // ICAP should only be on internal virtuals
        item = profile(item, 'profileICAP');
    }
    return item;
};

const updatePropsForSourceAddress = function (item) {
    // 'object' sourceAddress (that is, pointers to address lists) are handled elsewhere
    if (typeof item.sourceAddress === 'string') {
        item.virtualAddresses = item.virtualAddresses.map((virtualAddress) => {
            if (!Array.isArray(virtualAddress)) {
                return [virtualAddress, item.sourceAddress];
            }
            return virtualAddress;
        });
        delete item.sourceAddress;
    }
    return item;
};

const updatePropsIfStateless = function (item) {
    if (item.virtualType === 'stateless') {
        item.stateless = {};
    }
    return item;
};

const normalizeUrl = function (itemUrl) {
    const urlObj = {
        url: itemUrl,
        rejectUnauthorized: true
    };

    if (typeof urlObj.url === 'object') {
        urlObj.url = urlObj.url.url;
        urlObj.rejectUnauthorized = !itemUrl.skipCertificateCheck;

        const auth = itemUrl.authentication;
        if (auth) {
            if (auth.method === 'basic' && typeof auth.passphrase === 'object') {
                auth.passphrase = secret(auth, 'passphrase');
            }
            urlObj.authentication = auth;
        }
    }

    return urlObj;
};

const makeExternalMonitorRequests = function (context, tenantId, appId, itemId, item) {
    const externalMonitorFile = {};
    const path = util.mcpPath(tenantId, appId, itemId);

    // step 1 of 3: upload external monitor script
    externalMonitorFile.iControl_post = {};
    externalMonitorFile.iControl_post.reference = `${path}-external-monitor`;
    const fn = path.replace(/\//g, '_');
    externalMonitorFile.iControl_post.path = `/mgmt/shared/file-transfer/uploads/${fn}`;
    externalMonitorFile.iControl_post.method = 'POST';
    externalMonitorFile.iControl_post.ctype = 'application/octet-stream';
    externalMonitorFile.iControl_post.why = 'upload script file';
    externalMonitorFile.iControl_post.send = item.script;

    // step 2 of 3: configure the variables to be idempotent
    item.script = '';
    item.run = `${path}-script`;

    // step 3 of 3: install
    externalMonitorFile['source-path'] = `file:/var/config/rest/downloads/${fn}`;

    return normalize.actionableMcp(context, externalMonitorFile, 'sys file external-monitor', `${path}-script`);
};

const makeApmPolicyRequests = function (item, itemId, path, settings, classDisplayName) {
    if (item.url) {
        const urlObj = normalizeUrl(item.url);
        const url = urlObj.url;
        const rejectUnauthorized = urlObj.rejectUnauthorized;
        const type = url.includes('.tar.gz') ? '.tar.gz' : '.tar';
        const authentication = urlObj.authentication;

        settings.url = url;

        item.iControl_postFromRemote = {};

        // GET policy
        item.iControl_postFromRemote.get = {};
        item.iControl_postFromRemote.get.path = url;
        item.iControl_postFromRemote.get.method = 'GET';
        item.iControl_postFromRemote.get.rejectUnauthorized = rejectUnauthorized;
        item.iControl_postFromRemote.get.ctype = 'application/octet-stream';
        item.iControl_postFromRemote.get.why = `get ${classDisplayName} ${itemId} from url`;
        item.iControl_postFromRemote.get.authentication = authentication;

        // POST policy to bigip
        item.iControl_postFromRemote.post = {};
        item.iControl_postFromRemote.post.path = `/mgmt/shared/file-transfer/uploads/${path.split('/').pop()}${type}`;
        item.iControl_postFromRemote.post.method = 'POST';
        item.iControl_postFromRemote.post.ctype = 'application/octet-stream';
        item.iControl_postFromRemote.post.why = `upload ${classDisplayName} ${itemId}`;
        item.iControl_postFromRemote.post.settings = settings;

        if (item.ignoreChanges && urlObj.authentication && urlObj.authentication.token) {
            item.ignore.iControl_postFromRemote = {
                get: {
                    authentication: {
                        token: item.iControl_postFromRemote.get.authentication.token
                    }
                }
            };
        }
    }

    if (item.ignoreChanges) {
        delete item.ignoreChanges;
    }

    return item;
};

const makeDataGroupTokenRequests = function (item, itemId, path, settings, classDisplayName) {
    const urlObj = normalizeUrl(item.externalFilePath);
    const url = urlObj.url;
    const rejectUnauthorized = urlObj.rejectUnauthorized;
    const authentication = urlObj.authentication;

    settings.externalFilePath.url = url;
    item.iControl_postFromRemote = {};

    // GET policy
    item.iControl_postFromRemote.get = {};
    item.iControl_postFromRemote.get.path = url;
    item.iControl_postFromRemote.get.method = 'GET';
    item.iControl_postFromRemote.get.rejectUnauthorized = rejectUnauthorized;
    item.iControl_postFromRemote.get.ctype = 'application/octet-stream';
    item.iControl_postFromRemote.get.why = `get ${classDisplayName} ${itemId} from url`;
    item.iControl_postFromRemote.get.authentication = authentication;

    // POST policy to bigip
    item.iControl_postFromRemote.post = {};
    item.iControl_postFromRemote.post.path = `/mgmt/shared/file-transfer/uploads/${path.replace(/\//g, '_')}`;
    item.iControl_postFromRemote.post.method = 'POST';
    item.iControl_postFromRemote.post.ctype = 'application/octet-stream';
    item.iControl_postFromRemote.post.why = `upload ${classDisplayName} ${itemId}`;
    item.iControl_postFromRemote.post.settings = settings;

    return item;
};

const setMonitors = function setMonitors(obj) {
    const monitors = {};
    if (obj.monitors !== undefined && Array.isArray(obj.monitors)) {
        obj.monitors.forEach((mon, idx) => {
            if (typeof mon === 'string') {
                mon = (mon === 'icmp') ? 'gateway_icmp' : mon;
                monitors[`/Common/${mon.replace(/-/g, '_')}`] = {};
            } else {
                monitors[bigipPath(obj.monitors, idx)] = {};
            }
        });
        obj.monitors = monitors;
    }
    return obj;
};

const updateMember = function updateMember(member) {
    if (member.monitors === undefined || Object.keys(member.monitors).length === 0) {
        member.monitors = { default: {} };
    }
    member.minimumMonitors = member.minimumMonitors || 1;

    if (member.rateLimit <= 0) {
        member.rateLimit = 'disabled';
    }

    if (member.adminState) {
        switch (member.adminState) {
        case 'enable':
            member.state = 'user-up';
            member.session = 'user-enabled';
            break;
        case 'disable':
            member.state = 'user-up';
            member.session = 'user-disabled';
            break;
        case 'offline':
            member.state = 'user-down';
            member.session = 'user-disabled';
            break;
        default:
            log.error(`Invalid adminState state: ${member.adminState}`);
        }
    }

    if (member.metadata) {
        Object.keys(member.metadata).forEach((key) => {
            member.metadata[key].persist = member.metadata[key].persist.toString();
        });
    }
};

const addressDiscovery = function addressDiscovery(context, tenantId, newAppId, item, sdRequired, resources, pool) {
    const configs = [];

    const addMember = function addMember(poolItem, def) {
        def.fqdn = {};
        if (def.name) {
            const delimiter = def.name.includes(':') ? '.' : ':';
            def.name += delimiter + def.servicePort;
        }
        if (def.rateLimit === -1) { def.rateLimit = 'disabled'; }
        if (def.addressDiscovery === 'fqdn') {
            def.fqdn.autopopulate = def.autoPopulate;
        } else {
            def.fqdn.autopopulate = 'disabled';
        }

        if (!sdRequired) {
            poolItem.members.push(normalize.actionableMcp(context, def, 'ltm pool members', null).properties);
        }
    };

    if (item.bigip) {
        item.name = item.bigip;
        if (pool) {
            addMember(pool, item);
        }
    } else if (item.addressDiscovery === 'fqdn') {
        let nodeTenant = tenantId;
        let nodeApp = newAppId;
        if (item.shareNodes) {
            nodeTenant = 'Common';
            nodeApp = null;
        }
        const config = this.FQDN_Node(context, nodeTenant, nodeApp, item).configs[0];
        configs.push(config);
        item.name = config.path;
        if (pool) {
            addMember(pool, item);
        }
    } else if (item.addressDiscovery === 'static') {
        const addresses = (item.serverAddresses || []).map((address) => address);
        const serverNames = {};
        (item.servers || []).forEach((server) => {
            addresses.push(server.address);
            const rawAddress = server.address.split('%')[0];
            serverNames[rawAddress] = server.name;
        });
        addresses.forEach((addr) => {
            const rawAddress = addr.split('%')[0];
            if (!addr.includes('%') && item.routeDomain) {
                addr = addr.concat(`%${item.routeDomain}`);
            }
            addr = addr.includes('%') && addr.split('%')[1] === '0' ? addr.split('%')[0] : addr;
            addr = ipUtil.minimizeIP(addr);
            let nodeTenant = tenantId;
            let nodeApp = newAppId;
            if (item.shareNodes) {
                nodeTenant = 'Common';
                nodeApp = null;
            }
            // If it's a named server, use that name. Otherwise, use the address as the name
            const rawName = serverNames[rawAddress] || addr;
            item.name = util.mcpPath(nodeTenant, nodeApp, rawName);
            if (pool) {
                addMember(pool, item);
            }
            configs.push(this.Node(context, nodeTenant, nodeApp, addr, rawName).configs);
        });
    }

    if (sdRequired && !item.addressDiscovery.use) {
        const tenant = (item.shareNodes) ? 'Common' : tenantId;
        const task = serviceDiscovery.createTask(item, tenant, resources);
        const sdPath = util.mcpPath(tenantId, null, task.id);
        serviceDiscovery.prepareTaskForNormalize(task);
        configs.push(normalize.actionableMcp(context, task, 'mgmt shared service-discovery task', sdPath));
    }

    return configs;
};

/**
 * The translate function array handles AS3 class customizations.
 * Schema-validated input is translated to actionable desired config.
 * Returns an object containing an array of config items, and optional
 * additional instructions.
 *
 * @param {string} tenantId
 * @param {string} appId
 * @param {string} itemId
 * @param {object} item
 * @param {object} declaration
 * @returns {(Object|Promise)}
 */
const translate = {

    /**
     * Tenant is the top-level AS3 declaration class.
     */
    Tenant(context, tenantId, item) {
        // do not attempt to create the Common partition
        if (tenantId === 'Common') return { configs: [] };
        return { configs: [normalize.actionableMcp(context, item, 'auth partition', util.mcpPath(tenantId, '', ''))] };
    },

    /**
     * Application is the 2nd-level AS3 declaration class.
     */
    Application(context, tenantId, appId) {
        return { configs: [normalize.actionableMcp(context, {}, 'sys folder', util.mcpPath(tenantId, appId, ''))] };
    },

    /**
     * Defines an ALG_Log_Profile
     */
    ALG_Log_Profile(context, tenantId, appId, itemId, item) {
        ['startControlChannel', 'endControlChannel', 'startDataChannel', 'endDataChannel'].forEach((e) => {
            item[e].elements = (item[e].includeDestination === true) ? { destination: {} } : '';
            delete item[e].includeDestination;
        });
        const config = normalize.actionableMcp(context, item, 'ltm alg-log-profile', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines an iRule
     */
    iRule(context, tenantId, appId, itemId, item) {
        item.ignore = item.ignore || {};
        if (item.iRule.url && item.iRule.url.ignoreChanges) {
            item.ignore.iRule = '';
        }
        const config = normalize.actionableMcp(context, item, 'ltm rule', util.mcpPath(tenantId, appId, itemId));
        return createIRule(config);
    },

    /**
     * Defines an iFile
     */
    iFile(context, tenantId, appId, itemId, item) {
        const configs = [];

        if (item.iFile.bigip) {
            item['file-name'] = item.iFile;
        } else {
            const iFile = {};
            const path = util.mcpPath(tenantId, appId, itemId);

            iFile.iControl_post = {};
            iFile.iControl_post.reference = `${path}-ifile`;
            const fn = path.replace(/\//g, '_');
            iFile.iControl_post.path = `/mgmt/shared/file-transfer/uploads/${fn}`;
            iFile.iControl_post.method = 'POST';
            iFile.iControl_post.ctype = 'application/octet-stream';
            iFile.iControl_post.why = 'upload ifile';
            iFile.iControl_post.send = item.iFile;
            iFile['source-path'] = `file:/var/config/rest/downloads/${fn}`;

            item['file-name'] = `${path}-ifile`;
            configs.push(normalize.actionableMcp(context, iFile, 'sys file ifile', `${path}-ifile`));
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm ifile', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines an Enforcement Policy iRule
     */
    Enforcement_iRule(context, tenantId, appId, itemId, item) {
        const config = normalize.actionableMcp(context, item, 'pem irule', util.mcpPath(tenantId, appId, itemId));
        return createIRule(config);
    },

    /**
     * Defines a WAF Policy
     */
    WAF_Policy(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const settings = util.simpleCopy(item);

        item.ignore = item.ignore || {};
        item.ignoreChanges = item.url && item.url.ignoreChanges ? true : item.ignoreChanges;

        if (typeof item.url !== 'undefined') {
            const urlObj = normalizeUrl(item.url);
            const url = urlObj.url;
            const rejectUnauthorized = urlObj.rejectUnauthorized;
            const authentication = urlObj.authentication;

            settings.url = url;

            item.iControl_postFromRemote = {};

            // get policy
            item.iControl_postFromRemote.get = {};
            item.iControl_postFromRemote.get.path = url;
            item.iControl_postFromRemote.get.method = 'GET';
            item.iControl_postFromRemote.get.rejectUnauthorized = rejectUnauthorized;
            item.iControl_postFromRemote.get.ctype = 'application/octet-stream';
            item.iControl_postFromRemote.get.why = `get asm policy ${itemId} from url`;
            item.iControl_postFromRemote.get.authentication = authentication;

            // post policy to bigip
            item.iControl_postFromRemote.post = {};
            item.iControl_postFromRemote.post.reference = path;
            item.iControl_postFromRemote.post.path = `/mgmt/shared/file-transfer/uploads/${path.split('/').pop()}.xml`;
            item.iControl_postFromRemote.post.method = 'POST';
            item.iControl_postFromRemote.post.ctype = 'application/octet-stream';
            item.iControl_postFromRemote.post.why = `upload asm policy ${itemId}`;
            item.iControl_postFromRemote.post.settings = settings;

            if (item.ignoreChanges && urlObj.authentication && urlObj.authentication.token) {
                item.ignore.iControl_postFromRemote = {
                    get: {
                        authentication: {
                            token: item.iControl_postFromRemote.get.authentication.token
                        }
                    }
                };
            }
        } else if (item.policy || item.file) {
            item.iControl_post = {};
            item.iControl_post.reference = path;
            item.iControl_post.path = `/mgmt/shared/file-transfer/uploads/${itemId}.xml`;
            item.iControl_post.method = 'POST';
            item.iControl_post.ctype = 'application/octet-stream';
            item.iControl_post.why = `upload asm policy ${itemId}`;
            item.iControl_post.send = item.policy || item.file;
            item.iControl_post.settings = settings;
            delete item.file;
        }

        if (item.ignoreChanges) {
            delete item.ignoreChanges;
        }

        // tmsh load policy
        const config = normalize.actionableMcp(context, item, 'asm policy', path);

        return { configs: [config] };
    },

    /**
     * Defines an Access Profile
     */
    Access_Profile(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, '', itemId);
        const settings = util.simpleCopy(item);
        delete settings.enable;

        item.ignore = item.ignore || {};
        item.ignoreChanges = item.url && item.url.ignoreChanges ? true : item.ignoreChanges;
        item = makeApmPolicyRequests(item, itemId, path, settings, 'Access Profile');

        const config = normalize.actionableMcp(context, item, 'apm profile access', path);
        config.properties.enable = item.enable || false;

        return { configs: [config] };
    },

    /**
     * Defines a Per-Request Access Policy
     */
    Per_Request_Access_Policy(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, '', itemId);
        const settings = util.simpleCopy(item);

        item.ignore = item.ignore || {};
        item.ignoreChanges = item.url && item.url.ignoreChanges ? true : item.ignoreChanges;
        item = makeApmPolicyRequests(item, itemId, path, settings, 'Access Policy');

        const config = normalize.actionableMcp(context, item, 'apm policy access-policy', path);
        return { configs: [config] };
    },

    /**
     * Defines a monitor
     */
    Monitor(context, tenantId, appId, itemId, item) {
        const props = {};
        const configs = [];

        item.ignore = item.ignore || {};
        item.remark = item.remark || '';
        // build monitor destination for ipv4 or ipv6 with default value *.*
        item.targetAddress = ipUtil.minimizeIP(item.targetAddress);
        const delimiter = ((item.targetAddress !== undefined)
                            && item.targetAddress.includes(':')) ? '.' : ':';
        item.destination = item.targetAddress || '*';
        item.destination += delimiter + (item.targetPort || '*');
        if ((['https', 'http2', 'sip'].indexOf(item.monitorType) >= 0)) {
            const cert = item.clientCertificate;
            item.clientCertificate = cert ? `${cert}.crt` : 'none';
            item.key = cert ? `${cert}.key` : 'none';
            item.clientTLS = item.clientTLS ? item.clientTLS : 'none';
        }
        if (item.monitorType === 'sip') {
            item.filter = item.filter || 'none';
            item['filter-neg'] = item['filter-neg'] || 'none';
        }
        if (item.monitorType === 'external') {
            // Add default to external monitors for arguments
            item.arguments = item.arguments || 'none';

            if (item.script) {
                configs.push(makeExternalMonitorRequests(context, tenantId, appId, itemId, item));
            }
        }

        // convert codes from an array in AS3 to filter and filter-neg strings
        if (item.codesUp !== undefined) item.codesUp = item.codesUp.join(' ');
        if (item.codesDown !== undefined) item.codesDown = item.codesDown.join(' ');

        ['passphrase', 'secret'].forEach((value) => {
            if (item[value] !== undefined) {
                const ignoreChanges = (item[value].ignoreChanges === true);
                item[value] = secret(item, value);
                if (ignoreChanges === true) {
                    item.ignore[value] = item[value];
                }
            }
        });

        // set adaptive by absolute or percentage
        if (item.adaptiveDivergenceType !== undefined && item.adaptiveDivergenceType === 'absolute') {
            item.adaptiveDivergencePercentage = item.adaptiveDivergenceMilliseconds;
        }

        // quote any arbitrary strings
        if (item.environmentVariables) {
            Object.keys(item.environmentVariables).forEach((envVar) => {
                item.environmentVariables[envVar] = normalize.quoteString(item.environmentVariables[envVar]);
            });
        }

        const config = normalize.actionableMcp(context, item, 'ltm monitor', util.mcpPath(tenantId, appId, itemId));

        // Delete any properties that are not expected for the monitor type
        props.any = ['class', 'description', 'destination', 'interval', 'time-until-up', 'timeout', 'up-interval'];
        props.icmp = props.any.concat(['adaptive', 'adaptive-divergence-type', 'adaptive-divergence-value', 'adaptive-limit', 'adaptive-sampling-timespan', 'transparent']);
        props.tcp = props.icmp.concat(['ip-dscp', 'recv', 'recv-disable', 'reverse', 'send']);
        props.udp = props.tcp;
        props.dns = props.icmp.concat(['accept-rcode', 'answer-contains', 'qname', 'qtype', 'recv', 'reverse']);
        props.http = props.tcp.concat(['password', 'username']);
        props.https = props.http.concat(['cert', 'cipherlist', 'key', 'ssl-profile']);
        props.http2 = props.http.concat(['ssl-profile']);
        props.inband = ['class', 'description', 'failure-interval', 'failures', 'response-time', 'retry-time'];
        props.ldap = props.any.concat(['username', 'password', 'base', 'filter-ldap', 'security', 'mandatory-attributes', 'chase-referrals']);
        props.mysql = props.any.concat(['recv', 'send', 'username', 'password', 'count', 'database', 'recv-column', 'recv-row']);
        props.postgresql = props.mysql;
        props.radius = props.any.concat(['username', 'password', 'secret', 'nas-ip-address']);
        props.sip = props.any.concat(['cert', 'cipherlist', 'filter', 'filter-neg', 'headers', 'key', 'mode', 'request']);
        props.smtp = props.any.concat(['domain']);
        props.external = props.any.concat(['run', 'api-anonymous', 'args', 'user-defined']);
        props.ftp = props.any.concat(['username', 'password', 'debug', 'filename', 'mode']);

        props['tcp-half-open'] = props.any.concat(['transparent']);
        Object.keys(config.properties).forEach((key) => {
            if (props[item.monitorType].indexOf(key) === -1) {
                delete config.properties[key];
            }
        });

        if (['http', 'https', 'http2', 'ldap', 'ftp'].indexOf(item.monitorType) > -1) {
            config.properties.username = config.properties.username || 'none';
        }

        if (['ftp'].indexOf(item.monitorType) > -1) {
            config.properties.filename = config.properties.filename || 'none';
        }

        if (['dns', 'mysql', 'postgresql'].indexOf(item.monitorType) > -1) {
            config.properties.recv = config.properties.recv || 'none';
        }

        if (['ldap'].indexOf(item.monitorType) > -1) {
            config.properties.base = config.properties.base || 'none';
            config.properties['filter-ldap'] = config.properties['filter-ldap'] || 'none';
        }

        if (['ldap', 'mysql', 'postgresql'].indexOf(item.monitorType) > -1) {
            config.properties.password = config.properties.password || 'none';
        }

        if (['mysql', 'postgresql'].indexOf(item.monitorType) > -1) {
            ['database', 'recv-column', 'recv-row', 'send', 'username'].forEach((prop) => {
                config.properties[prop] = config.properties[prop] || 'none';
            });
        }

        config.command += ` ${(item.monitorType === 'icmp') ? 'gateway-icmp' : item.monitorType}`;
        configs.push(config);
        return { configs };
    },

    /**
     * Defines a node (nodes are NOT visible in declaration)
     */
    Node(context, tenantId, appId, addr, name) {
        const def = { address: addr };
        return { configs: normalize.actionableMcp(context, def, 'ltm node', util.mcpPath(tenantId, appId, name)) };
    },

    /**
     * Defines an FQDN node (nodes are NOT visible in declaration)
     */
    FQDN_Node(context, tenantId, appId, item) {
        item.queryInterval = (item.queryInterval === 0) ? 'ttl' : String(item.queryInterval);
        if (item.addressFamily !== undefined) {
            item.addressFamily = item.addressFamily.toLowerCase();
        }
        const tmName = `${item.fqdnPrefix || ''}${item.hostname}`;
        const def = {
            fqdn: util.simpleCopy(item),
            metadata: [{
                name: 'fqdnPrefix',
                value: item.fqdnPrefix,
                persist: true
            }]
        };

        const config = normalize.actionableMcp(context, def, 'ltm node', util.mcpPath(tenantId, appId, tmName));
        return { configs: [config] };
    },

    /**
     * Defines an HTTP profile
     */
    HTTP_Profile(context, tenantId, appId, itemId, item) {
        const supportSustainChunking = !util.versionLessThan(context.target.tmosVersion, '15.0');
        const configs = [];

        item.ignore = item.ignore || {};
        item.allowedResponseHeaders = item.allowedResponseHeaders || [];
        item.encryptCookies = item.encryptCookies || [];
        if (item.cookiePassphrase !== undefined) {
            const ignoreChanges = (item.cookiePassphrase.ignoreChanges === true);
            item.cookiePassphrase = secret(item, 'cookiePassphrase');
            if (ignoreChanges === true) {
                item.ignore.cookiePassphrase = item.cookiePassphrase;
            }
        }

        if (item.proxyType === 'explicit') {
            item.explicitProxy = {
                badRequestMessage: item.badRequestMessage || '',
                badResponseMessage: item.badResponseMessage || '',
                connectErrorMessage: item.connectErrorMessage || '',
                defaultConnectAction: item.defaultConnectAction || '',
                dnsErrorMessage: item.dnsErrorMessage || '',
                doNotProxyHosts: item.doNotProxyHosts || [],
                ipv6: item.ipv6 || false,
                resolver: item.resolver,
                routeDomain: `${item.routeDomain}` || '',
                tunnelName: item.tunnelName || ''
            };

            if (item.explicitProxy.tunnelName.indexOf('/') === -1) {
                item.explicitProxy.tunnelName = `/Common/${item.explicitProxy.tunnelName}`;
            }

            item.explicitProxy.routeDomain = `/Common/${item.explicitProxy.routeDomain}`;
        }

        item.fallbackRedirect = item.fallbackRedirect || '';
        item.fallbackStatusCodes = item.fallbackStatusCodes || [];
        if (typeof item.insertHeader === 'undefined' || typeof item.insertHeader.name === 'undefined'
            || typeof item.insertHeader.value === 'undefined') {
            item.insertHeader = '';
        } else {
            item.insertHeader = `${item.insertHeader.name}: ${item.insertHeader.value}`;
        }
        item.insertHeader = item.insertHeader || '';
        item.otherXFF = item.otherXFF || [];
        item.remark = item.remark || '';
        item.rewriteRedirects = item.rewriteRedirects.replace('addresses', 'nodes');
        item.whiteOutHeader = item.whiteOutHeader || '';
        item.viaHost = item.viaHost || '';
        item.hsts = {};
        item.hsts.insert = item.hstsInsert; // maps to hsts mode
        item.hsts.period = item.hstsPeriod;
        item.hsts.includeSubdomains = item.hstsIncludeSubdomains;
        item.hsts.preload = item.hstsPreload;

        item.enforcement = {
            allowBlankSpaceAfterHeaderName: item.allowBlankSpaceAfterHeaderName,
            enforceRFCCompliance: item.enforceRFCCompliance,
            excessClientHeaders: item.excessClientHeaders,
            excessServerHeaders: item.excessServerHeaders,
            knownMethods: item.knownMethods,
            maxHeaderCount: item.maxHeaderCount,
            maxHeaderSize: item.maxHeaderSize,
            maxRequests: item.maxRequests,
            oversizeClientHeaders: item.oversizeClientHeaders,
            oversizeServerHeaders: item.oversizeServerHeaders,
            pipelineAction: item.pipelineAction,
            truncatedRedirects: item.truncatedRedirects,
            unknownMethodAction: item.unknownMethodAction
        };
        if (Object.keys(item.enforcement).filter((k) => typeof item.enforcement[k] !== 'undefined')
            .length === 0) {
            delete item.enforcement;
        }
        // only BIG-IP 15.0 and newer - 'selective' and 'preserve' chunking was replaced with 'sustain' chunking
        // for both 'response' and 'request'
        if (supportSustainChunking) {
            const obsolete = ['selective', 'preserve'];
            ['responseChunking', 'requestChunking'].forEach((prop) => {
                if (obsolete.indexOf(item[prop]) > -1) {
                    item[prop] = 'sustain';
                }
            });
        // before BIG-IP 15.0 the default value of 'sustain' on newer versions did not exist so replace with the
        // pre 15.0 default value of 'preserve' for requestChunking and 'selective' for responseChunking.
        } else {
            item.requestChunking = item.requestChunking === 'sustain' ? 'preserve' : item.requestChunking;
            item.responseChunking = item.responseChunking === 'sustain' ? 'selective' : item.responseChunking;
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm profile http', util.mcpPath(tenantId, appId, itemId)));

        if (!item.profileWebSocket && item.webSocketsEnabled) {
            // the deprecated method needs to fill out the default values of the new method
            const webSocketProfile = {
                description: 'none',
                masking: item.webSocketMasking
            };
            if (!util.versionLessThan(context.target.tmosVersion, '16.1')) {
                item = profile(item, 'profileIntegratedBotDefense');
                Object.assign(webSocketProfile, {
                    compressMode: 'preserved',
                    compression: true,
                    maximumWindowSize: 10,
                    noDelay: true
                });
            }
            configs.push(normalize.actionableMcp(context, webSocketProfile, 'ltm profile websocket', util.mcpPath(tenantId, appId, `f5_appsvcs_${item.webSocketMasking}`)));
        }

        if (item.proxyConnectEnabled) {
            const proxyConnectProfile = {
                defaultState: true
            };
            configs.push(normalize.actionableMcp(context, proxyConnectProfile, 'ltm profile http-proxy-connect', util.mcpPath(tenantId, appId, `f5_appsvcs_${itemId}_proxyConnect`)));
        }

        return { configs };
    },

    /**
     * Defines an HTTP/2 profile
     */
    HTTP2_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        const config = normalize.actionableMcp(context, item, 'ltm profile http2', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines an Real-Time Streaming Protocol profile
     *
     */
    RTSP_Profile(context, tenantId, appId, itemId, item) {
        return { configs: [normalize.actionableMcp(context, item, 'ltm profile rtsp', util.mcpPath(tenantId, appId, itemId))] };
    },

    /**
     * Defines an Secure Socket (SOCKS) profile
     *
     */
    SOCKS_Profile(context, tenantId, appId, itemId, item) {
        ['routeDomain', 'tunnelName'].forEach((prop) => {
            if (item[prop].toString().indexOf('/') === -1) {
                item[prop] = `/Common/${item[prop]}`;
            }
        });
        return { configs: [normalize.actionableMcp(context, item, 'ltm profile socks', util.mcpPath(tenantId, appId, itemId))] };
    },

    /**
     * Defines a statistics profile
     */
    Statistics_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        for (let i = 1; i < 33; i += 1) {
            const field = `field${i}`;
            item[field] = item[field] || 'none';
        }
        const config = normalize.actionableMcp(context, item, 'ltm profile statistics', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a WebSocket profile
     */
    WebSocket_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        const config = normalize.actionableMcp(context, item, 'ltm profile websocket', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines an HTTP Compression profile
     */
    HTTP_Compress(context, tenantId, appId, itemId, item) {
        item.contentTypeExclude = !item.contentTypeExcludes ? '' : `"${item.contentTypeExcludes.join('" "')}"`;
        item.contentTypeInclude = !item.contentTypeIncludes ? '' : `"${item.contentTypeIncludes.join('" "')}"`;
        item.uriExclude = !item.uriExcludes ? '' : `"${item.uriExcludes.join('" "')}"`;
        item.uriInclude = !item.uriIncludes ? '' : `"${item.uriIncludes.join('" "')}"`;
        item.remark = item.remark || '';
        ['gzipMemory', 'gzipWindowSize'].forEach((value) => {
            if (item[value]) {
                let power = 1;
                while (power < item[value]) {
                    power *= 2;
                }
                item[value] = power;
            }
        });
        const config = normalize.actionableMcp(context, item, 'ltm profile http-compression', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a one-connect profile
     */
    Multiplex_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        item.sourceMask = item.sourceMask || 'any';
        const config = normalize.actionableMcp(context, item, 'ltm profile one-connect', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a server-ssl profile
     */
    TLS_Client(context, tenantId, appId, itemId, item, declaration) {
        const configs = [];
        const tenantDecl = declaration[tenantId];
        item.ignore = item.ignore || {};
        item.remark = item.remark || '';
        item.authenticationFrequency = item.authenticationFrequency
            .replace('one-time', 'once')
            .replace('every-time', 'always');

        if (item.cipherGroup) {
            item.ciphers = 'none';
        }

        item.cipherGroup = item.cipherGroup || 'none';

        const clientCertOpts = {
            srcCertPropName: 'clientCertificate',
            destCertPropName: 'clientCertificate',
            destKeyPropName: 'key',
            srcPasswrdPropName: 'passphrase',
            destPasswrdPropName: 'passphrase'
        };
        parseCertificate(item, clientCertOpts, tenantDecl[appId]);

        if ((item.trustCA === undefined) || (item.trustCA === 'generic')) {
            item.trustCA = '/Common/ca-bundle.crt';
        } else {
            item.trustCA = bigipPath(item, 'trustCA', '/Common/ca-bundle.crt');
        }

        const c3dCAOpts = {
            srcCertPropName: 'c3dCertificateAuthority',
            destCertPropName: 'c3dCACertificate',
            destKeyPropName: 'c3dCAKey',
            srcPasswrdPropName: 'passphrase',
            destPasswrdPropName: 'c3dCAPassphrase'
        };
        parseCertificate(item, c3dCAOpts, tenantDecl[appId]);

        item.crlFile = bigipPath(item, 'crlFile', 'none');

        updateTlsOptions(item, context);

        item.renegotiatePeriod = (item.renegotiatePeriod === 'indefinite') ? 4294967295 : item.renegotiatePeriod;
        item.renegotiateSize = (item.renegotiateSize === 'indefinite') ? 4294967295 : item.renegotiateSize;
        item.handshakeTimeout = (item.handshakeTimeout === 'indefinite') ? 4294967295 : item.handshakeTimeout;

        configs.push(normalize.actionableMcp(context, item, 'ltm profile server-ssl', util.mcpPath(tenantId, appId, itemId)));

        if (item.ldapStartTLS) {
            const serverLdapProfile = {
                activationMode: item.ldapStartTLS
            };
            configs.push(
                normalize.actionableMcp(
                    context,
                    serverLdapProfile,
                    'ltm profile server-ldap',
                    util.mcpPath(tenantId, appId, `f5_appsvcs_serverside_${item.ldapStartTLS}`)
                )
            );
        }

        return { configs };
    },

    /**
     * Defines a client-ssl profile
     */
    TLS_Server(context, tenantId, appId, itemId, item, declaration) {
        const configs = [];

        const genIgnore = function genIgnore(tlsItem, cert, usage) {
            if (util.versionLessThan(context.target.tmosVersion, '14.0') && usage === 'CA') {
                tlsItem.ignore['proxy-ca-passphrase'] = cert.passphrase;
                return;
            }

            tlsItem.ignore.certificates = tlsItem.ignore.certificates || [];
            tlsItem.ignore.certificates.push({
                name: cert.name,
                passphrase: cert.passphrase
            });
        };

        const genCert = function genCert(tlsItem, certPath, usage) {
            // default proxy-ca properties on older BIG-IP versions
            if (util.versionLessThan(context.target.tmosVersion, '14.0') && usage === 'CA') {
                tlsItem['proxy-ca-cert'] = 'none';
                tlsItem['proxy-ca-key'] = 'none';
                tlsItem['proxy-ca-passphrase'] = 'none';
            }

            // skip cert generation if no cert available
            if (!certPath) {
                return;
            }

            const cert = {
                name: `set${tlsItem.certificates.length}`,
                key: `${certPath}.key`,
                certificate: `${certPath}.crt`,
                usage: util.versionLessThan(context.target.tmosVersion, '14.0') ? undefined : usage
            };

            // There is some post processing done in the Certificates part of map_as3.translate()
            // as such we format any chainCA bundle with -bundle.crt for later discovery.
            // At which time we convert it to what it needs to be (be it use, bigip, or string).
            // I am not sure why we do that there, but it's likely something to do with transactions not
            // working as intended and this is VERY OLD CODE.
            const tenantCert = util.getDeepValue(declaration, certPath, '/');
            if (tenantCert && tenantCert.chainCA) {
                cert.chain = `${certPath}-bundle.crt`;
            } else {
                cert.chain = 'none';
            }

            // check certificate declaration for a passphrase
            cert.passphrase = tenantCert.passphrase || undefined;
            if (typeof cert.passphrase === 'object') {
                const ignoreChanges = (tenantCert.passphrase.ignoreChanges === true);
                cert.passphrase = secret(cert, 'passphrase');
                if (ignoreChanges === true) {
                    genIgnore(tlsItem, cert, usage);
                }
            } else if (typeof cert.passphrase === 'string') {
                genIgnore(tlsItem, cert, usage);
            }

            // set proxy-ca properties on older BIG-IP versions
            if (util.versionLessThan(context.target.tmosVersion, '14.0') && usage === 'CA') {
                tlsItem['proxy-ca-cert'] = cert.certificate;
                tlsItem['proxy-ca-key'] = cert.key;
                tlsItem['proxy-ca-passphrase'] = cert.passphrase;
                return;
            }

            tlsItem.certificates.push(cert);
        };

        item.ignore = item.ignore || {};
        item.remark = item.remark || '';
        item.authenticationTrustCA = bigipPath(item, 'authenticationTrustCA', '');
        item.authenticationInviteCA = bigipPath(item, 'authenticationInviteCA', '');
        item.authenticationFrequency = item.authenticationFrequency
            .replace('one-time', 'once')
            .replace('every-time', 'always');
        item.c3dOCSP = bigipPath(item, 'c3dOCSP', 'none');
        item.crlFile = bigipPath(item, 'crlFile', 'none');
        item.forwardProxyBypassAllowlist = item.forwardProxyBypassAllowlist || 'none';

        if (item.cipherGroup) {
            item.ciphers = 'none';
        }
        item.cipherGroup = item.cipherGroup || 'none';

        updateTlsOptions(item, context);

        item.renegotiateMaxRecordDelay = (item.renegotiateMaxRecordDelay === 'indefinite') ? 4294967295 : item.renegotiateMaxRecordDelay;
        item.renegotiatePeriod = (item.renegotiatePeriod === 'indefinite') ? 4294967295 : item.renegotiatePeriod;
        item.renegotiateSize = (item.renegotiateSize === 'indefinite') ? 4294967295 : item.renegotiateSize;
        item.handshakeTimeout = (item.handshakeTimeout === 'indefinite') ? 4294967295 : item.handshakeTimeout;

        // For backward compatibillity with older configs we decided to set
        // first certificate as sniDefault. Unless user decided to explicitly set
        // this property to another certificate. So we need to check it first.
        // Schema default for sniDefault property is false.
        const isSniDefaultSet = item.certificates.find((e) => e.sniDefault);

        item.certificates.forEach((obj, index) => {
            const tlsItem = Object.create(item);

            let itemName;
            if (item.namingScheme === 'certificate') {
                itemName = obj.certificate.split('/').pop();
            } else {
                itemName = index === 0 ? itemId : `${itemId}-${index}-`;
            }
            const path = util.mcpPath(tenantId, appId, itemName);

            tlsItem.certificates = [];
            genCert(tlsItem, obj.certificate, 'SERVER');
            genCert(tlsItem, obj.proxyCertificate, 'CA');

            // Set sniDefault to first certificate if applicable.
            if (index === 0) {
                tlsItem.sniDefault = obj.sniDefault || !isSniDefaultSet;
            } else {
                tlsItem.sniDefault = obj.sniDefault;
            }
            tlsItem.matchToSNI = obj.matchToSNI || 'none';
            tlsItem.mode = obj.enabled;

            configs.push(normalize.actionableMcp(context, tlsItem, 'ltm profile client-ssl', path));
        });

        if (item.ldapStartTLS) {
            const clientLdapProfile = {
                activationMode: item.ldapStartTLS
            };
            configs.push(
                normalize.actionableMcp(
                    context,
                    clientLdapProfile,
                    'ltm profile client-ldap',
                    util.mcpPath(tenantId, appId, `f5_appsvcs_clientside_${item.ldapStartTLS}`)
                )
            );
        }

        if (typeof item.smtpsStartTLS === 'string') {
            const smtpsProfile = {
                activationMode: item.smtpsStartTLS
            };
            configs.push(
                normalize.actionableMcp(
                    context,
                    smtpsProfile,
                    'ltm profile smtps',
                    util.mcpPath(tenantId, appId, `f5_appsvcs_smtps_${item.smtpsStartTLS}`)
                )
            );
        }

        return { configs };
    },

    /**
     * Defines an SSL/TLS certificate
     */
    Certificate(context, tenantId, appId, itemId, item) {
        const configs = [];
        const path = util.mcpPath(tenantId, appId, itemId);
        let updatePath = false;
        const pathUpdates = [];

        const upload = function upload(type, certPath, certItem, contentKey) {
            // step 1 of 2: upload the cert or key
            certItem.iControl_post = {};
            certItem.iControl_post.reference = certPath;
            const fn = certPath.replace(/\//g, '_');
            certItem.iControl_post.path = `/mgmt/shared/file-transfer/uploads/${fn}`;
            certItem.iControl_post.method = 'POST';
            certItem.iControl_post.ctype = 'application/octet-stream';
            certItem.iControl_post.why = `upload ${contentKey} file`;
            certItem.iControl_post.send = certItem[contentKey]
                .replace(/\r\n/g, '\n')
                .replace(/(.{64})/g, '$1\n')
                .replace(/(.{64})\n\n/g, '$1\n');

            // step 2 of 2: install
            const hash = crypto.createHash('sha1');
            hash.update(certItem.iControl_post.send);
            certItem.checksum = `SHA1:${certItem.iControl_post.send.length}:${hash.digest('hex')}`;
            certItem['source-path'] = `file:/var/config/rest/downloads/${fn}`;
            if (type === 'ssl-key') {
                if (typeof certItem.passphrase === 'object') {
                    const ignoreChanges = (certItem.passphrase.ignoreChanges === true);
                    certItem.passphrase = secret(certItem, 'passphrase');
                    if (ignoreChanges === true) {
                        certItem.ignore.passphrase = certItem.passphrase;
                    }
                }
            }

            configs.push(normalize.actionableMcp(context, certItem, `sys file ${type}`, certPath));
        }; // upload()

        item.ignore = item.ignore || {};

        if (item.class === 'Certificate') {
            if (item.staplerOCSP) {
                item['cert-validation-options'] = ['ocsp'];
                item['cert-validators'] = (item.staplerOCSP.bigip) ? [item.staplerOCSP.bigip] : [item.staplerOCSP.use];
            }
            if (item.issuerCertificate) {
                item['issuer-cert'] = bigipPath(item, 'issuerCertificate');
                if (item['issuer-cert'].indexOf('.crt') !== item['issuer-cert'].length - 4) {
                    item['issuer-cert'] = `${item['issuer-cert']}.crt`;
                }
            }
        }

        if (item.pkcs12) {
            const pkcs12Obj = item.pkcs12Options.internalOnly[0];
            if (pkcs12Obj.certificates.length === 1) {
                item.certificate = pkcs12Obj.certificates[0];
            } else {
                item.bundle = pkcs12Obj.certificates.join('\n');
            }
            item.privateKey = pkcs12Obj.privateKey; // gitleaks:allow
            if (item.pkcs12Options.ignoreChanges) {
                item.ignore.checksum = 'checksum';
            }
        }

        if (item.bundle) {
            if (typeof item.bundle === 'string') {
                upload('ssl-cert', path, item, 'bundle');
            } else if (typeof item.bundle === 'object' && typeof item.bundle.bigip === 'string') {
                updatePath = true;
                pathUpdates.push({
                    oldString: `${path}`,
                    newString: `${item.bundle.bigip}`
                });
            }
        }

        if (item.certificate) {
            if (typeof item.certificate === 'string') {
                upload('ssl-cert', `${path}.crt`, item, 'certificate');
            } else if (typeof item.certificate === 'object' && typeof item.certificate.bigip === 'string') {
                // have to correct a path in the object that is referencing this
                updatePath = true;
                pathUpdates.push({
                    oldString: `${path}.crt`,
                    newString: item.certificate.bigip
                });
            }
        }

        // If there is a chainCA we need to update the path to point at the desired CA_Bundle.
        // For chainCAs that are strings, the chainCA will have its cert imported.
        // For chainCAs that are objects (e.g. bigip and use), the chainCA will be updated to
        // point at the object or location it's referencing.
        // The oldString is the name of the ${certificate object}-bundle.crt.
        // The newString is the location on the BIG-IP
        if (item.chainCA) {
            // In case of chainCA there should be no properties listed in propertiesToDelete
            const propertiesToDelete = ['cert-validation-options', 'cert-validators', 'issuer-cert'];
            propertiesToDelete.forEach((prop) => {
                if (prop in item) {
                    delete item[prop];
                }
            });
            if (typeof item.chainCA === 'string') {
                upload('ssl-cert', `${path}-bundle.crt`, item, 'chainCA');
            } else if (typeof item.chainCA === 'object' && (item.chainCA.bigip || item.chainCA.use)) {
                const newString = (item.chainCA.bigip) ? item.chainCA.bigip : item.chainCA.use;

                updatePath = true;
                pathUpdates.push({
                    oldString: `${path}-bundle.crt`,
                    newString
                });
            }
        }

        if (item.privateKey) {
            if (typeof item.privateKey === 'string') {
                upload('ssl-key', `${path}.key`, item, 'privateKey');
            } else if (typeof item.privateKey === 'object' && typeof item.privateKey.bigip === 'string') {
                // have to correct a path in the object that is referencing this
                updatePath = true;
                pathUpdates.push({
                    oldString: `${path}.key`,
                    newString: item.privateKey.bigip
                });
            }
        }
        const configUpdates = {
            configs,
            updatePath,
            pathUpdates
        };

        return configUpdates;
    },

    Certificate_Validator_OCSP(context, tenantId, appId, itemId, item, declaration) {
        const tenantDecl = declaration[tenantId];
        const configs = [];
        if (util.isEmptyOrUndefined(item.signingCertificate)) {
            item.signingCertificate = 'none';
            item.signingPrivateKey = 'none';
            item.signingPassphrase = 'none';
        } else {
            const signerOpts = {
                srcCertPropName: 'signingCertificate',
                destCertPropName: 'signingCertificate',
                destKeyPropName: 'signingPrivateKey',
                srcPasswrdPropName: 'passphrase',
                destPasswrdPropName: 'signingPassphrase'
            };
            parseCertificate(item, signerOpts, tenantDecl[appId]);
        }

        item.signingPassphrase = item.signingPassphrase || 'none';

        configs.push(normalize.actionableMcp(context, item, 'sys crypto cert-validator ocsp', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines an SSL/TLS certificate authority bundle
     */
    CA_Bundle(context, tenantId, appId, itemId, item) {
        return translate.Certificate(context, tenantId, appId, itemId, item);
    },

    /**
     * Defines a DNS Cache
     */
    DNS_Cache(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.localZones = item.localZones || 'none';
        item.forwardZones = item.forwardZones || 'none';

        configs.push(normalize.actionableMcp(context, item, `ltm dns cache ${item.type}`, util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a DNS Logging Profile
     */
    DNS_Logging_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        const config = normalize.actionableMcp(context, item, 'ltm profile dns-logging', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a DNS Nameserver
     */
    DNS_Nameserver(context, tenantId, appId, itemId, item) {
        const configs = [];

        configs.push(normalize.actionableMcp(context, item, 'ltm dns nameserver', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a DNS Profile
     */
    DNS_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.cache = item.cache || 'none';
        item.securityProfile = item.securityProfile || 'none';
        item.remark = item.remark || '';

        if (!item.loggingProfile) {
            item.loggingEnabled = false;
            item.loggingProfile = 'none';
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm profile dns', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a DNS TSIG Key
     */
    DNS_TSIG_Key(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.ignore = item.ignore || {};
        let ignoreChanges;

        if (item.secret !== undefined) {
            ignoreChanges = (item.secret.ignoreChanges === true);
            item.secret = secret(item, 'secret');
            if (ignoreChanges === true) {
                item.ignore.secret = item.secret;
            }
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm dns tsig-key', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a DNS Zone
     */
    DNS_Zone(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.dnsExpressEnabled = (item.dnsExpress) ? item.dnsExpress.enabled : true;
        item.dnsExpressNotifyAction = (item.dnsExpress) ? item.dnsExpress.notifyAction : 'consume';
        item.dnsExpressNotifyTsigVerify = (item.dnsExpress) ? item.dnsExpress.verifyNotifyTsig : true;

        if (item.dnsExpress) {
            item.dnsExpressServer = item.dnsExpress.nameserver;
            item.dnsExpressAllowNotify = item.dnsExpress.allowNotifyFrom;
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm dns zone', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a TCP profile
     */
    TCP_Profile(context, tenantId, appId, itemId, item) {
        item.ignore = item.ignore || {};
        item.remark = item.remark || '';
        if (item.nagle !== 'auto') item.nagle += 'd';
        if (item.mptcp !== 'passthrough') item.mptcp += 'd';
        if (item.md5SignaturePassphrase !== undefined) {
            const ignoreChanges = (item.md5SignaturePassphrase.ignoreChanges === true);
            item.md5SignaturePassphrase = secret(item, 'md5SignaturePassphrase');
            if (ignoreChanges === true) {
                item.ignore.md5SignaturePassphrase = item.md5SignaturePassphrase;
            }
        }
        if (item.closeWaitTimeout === -1) item.closeWaitTimeout = 4294967295;
        if (item.finWaitTimeout === -1) item.finWaitTimeout = 4294967295;
        if (item.finWait2Timeout === -1) item.finWait2Timeout = 4294967295;
        if (item.idleTimeout === -1) item.idleTimeout = 4294967295;
        if (item.timeWaitTimeout === -1) item.timeWaitTimeout = 'indefinite';
        if (item.zeroWindowTimeout === -1) item.zeroWindowTimeout = 4294967295;
        if (item.tcpOptions === undefined) {
            item.tcpOptions = 'none';
        } else {
            item.tcpOptions = item.tcpOptions.map((x) => `{${x.option} ${x.when}}`).join(' ');
        }

        const configUpdates = {
            configs: [normalize.actionableMcp(context, item, 'ltm profile tcp', util.mcpPath(tenantId, appId, itemId))]
        };
        return configUpdates;
    },

    /**
     * Defines a UDP profile
     */
    UDP_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        if (item.idleTimeout === 0) item.idleTimeout = 'immediate';
        else if (item.idleTimeout === -1) item.idleTimeout = 'indefinite';

        const config = normalize.actionableMcp(context, item, 'ltm profile udp', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a IP_Other_Profile
     */
    IP_Other_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        if (item.idleTimeout === 0) item.idleTimeout = 'immediate';
        else if (item.idleTimeout === -1 || item.idleTimeout === 4294967295) {
            item.idleTimeout = 'indefinite';
        }
        const config = normalize.actionableMcp(context, item, 'ltm profile ipother', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
    * Defines a Radius_Profile
    */
    Radius_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        // delete PEM-dependent props that have defaults in the schema
        if (!util.isOneOfProvisioned(context.target, ['pem', 'afm'])) {
            delete item.protocolProfile;
            delete item.subscriberDiscoveryEnabled;
        }
        const config = normalize.actionableMcp(context, item, 'ltm profile radius', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a Classification_Profile
     */
    Classification_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        const config = normalize.actionableMcp(context, item, 'ltm profile classification', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a FIX_Profile
     */
    FIX_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        if (item.senderTagMappingList && item.senderTagMappingList.length > 0) {
            const origList = item.senderTagMappingList;
            item.senderTagMappingList = [];
            origList.forEach((senderTagMap, index) => {
                item.senderTagMappingList[index] = {
                    name: senderTagMap.senderId,
                    senderId: senderTagMap.senderId,
                    tagDataGroup: senderTagMap.tagDataGroup.use || senderTagMap.tagDataGroup.bigip
                };
            });
        } else {
            item.senderTagMappingList = 'none';
        }
        item.messageLogPublisher = item.messageLogPublisher || 'none';
        item.reportLogPublisher = item.reportLogPublisher || 'none';
        item.fullLogonParsingEnabled = item.fullLogonParsingEnabled.toString().toLowerCase();
        item.quickParsingEnabled = item.quickParsingEnabled.toString().toLowerCase();
        item.responseParsingEnabled = item.responseParsingEnabled.toString().toLowerCase();
        const config = normalize.actionableMcp(context, item, 'ltm profile fix', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a L4 profile
     */
    L4_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || 'none';
        if (item.clientTimeout === -1) item.clientTimeout = 86400;
        if (item.idleTimeout === -1) item.idleTimeout = 'indefinite';
        if (item.maxSegmentSize === -1) item.maxSegmentSize = 9162;
        if (item.tcpCloseTimeout === -1) {
            item.tcpCloseTimeout = 'indefinite';
        } else if (item.tcpCloseTimeout === 0) {
            item.tcpCloseTimeout = 'immediate';
        }
        if (item.tcpHandshakeTimeout === -1) {
            item.tcpHandshakeTimeout = 'indefinite';
        } else if (item.tcpHandshakeTimeout === 0) {
            item.tcpHandshakeTimeout = 'immediate';
        }

        const config = normalize.actionableMcp(context, item, 'ltm profile fastl4', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines an Analytics profile
     */
    Analytics_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        item.notifyEmailAddresses = !item.notifyEmailAddresses ? '' : item.notifyEmailAddresses.join(' ');
        if (item.countriesForStatCollection && item.countriesForStatCollection.length > 0) {
            item.countriesForStatCollection = `"${item.countriesForStatCollection.join('" "')}"`;
        }
        if (item.subnetsForStatCollection && item.subnetsForStatCollection.length > 0) {
            item.subnetsForStatCollection = `"${item.subnetsForStatCollection.join('" "')}"`;
        }
        if (item.urlsForStatCollection && item.urlsForStatCollection.length > 0) {
            item.urlsForStatCollection = `"${item.urlsForStatCollection.join('" "')}"`;
        }

        const captureFilter = item.captureFilter;
        if (captureFilter) {
            if (captureFilter.userAgentSubstrings && captureFilter.userAgentSubstrings.length !== 0) {
                item.captureFilter.userAgentSubstrings = `"${item.captureFilter.userAgentSubstrings.join('" "')}"`;
            }
            item.captureFilter = {};
            item.captureFilter.captureForF5Appsvcs = captureFilter;
            if (captureFilter.virtualServers) {
                captureFilter.virtualServers.forEach((element, index) => {
                    if (captureFilter.virtualServers[index].indexOf('/') === -1) {
                        captureFilter.virtualServers[index] = util.mcpPath(tenantId, appId, element);
                    }
                });
            }
            if (captureFilter.nodeAddresses) {
                captureFilter.nodeAddresses.forEach((element, index) => {
                    if (captureFilter.nodeAddresses[index].indexOf('/') === -1) {
                        captureFilter.nodeAddresses[index] = util.mcpPath(tenantId, null, element);
                    }
                });
            }
        }
        const config = normalize.actionableMcp(context, item, 'ltm profile analytics', util.mcpPath(tenantId, appId, itemId));

        // If these collections are explicitly empty instead of deleted tmsh will mistaken them for content and error
        // when created but toggling from 'enabled' to 'disabled' works even when the collections have content.
        if (config.properties['collect-geo'] === 'disabled') {
            delete config.properties['countries-for-stat-collection'];
        }
        if (config.properties['collect-subnets'] === 'disabled') {
            delete config.properties['subnets-for-stat-collection'];
        }
        if (config.properties['collect-url'] === 'disabled') {
            delete config.properties['urls-for-stat-collection'];
        }

        return { configs: [config] };
    },

    /**
     * Define an Analytics TCP profile
     */
    Analytics_TCP_Profile(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';

        const config = normalize.actionableMcp(context, item, 'ltm profile tcp-analytics', util.mcpPath(tenantId, appId, itemId));
        return { configs: [config] };
    },

    /**
     * Defines a persistence profile
     */
    Persist(context, tenantId, appId, itemId, item) {
        item.ignore = item.ignore || {};
        // convert ttl seconds to special bigip hh:mm:ss format
        item.ttl = util.convertTtlToHourMinSec(item.ttl);
        // replace zero value with special bigip string
        if (item.duration === 0) {
            item.duration = 'indefinite';
        }
        // force default values for description and rule (should parser do this?)
        item.remark = item.remark || '';
        // minimize zeroes in IPv4/6 address to match MCP treatment of same
        item.addressMask = ipUtil.minimizeIP(item.addressMask) || '';
        if (item.iRule === undefined) { item.iRule = ''; }
        if (item.passphrase !== undefined) {
            const ignoreChanges = (item.passphrase.ignoreChanges === true);
            item.passphrase = secret(item, 'passphrase');
            if (ignoreChanges === true) {
                item.ignore.passphrase = item.passphrase;
            }
        }
        // replace AS3 method name with bigip method name
        const persistType = item.persistenceMethod
            .replace('destination', 'dest')
            .replace('address', 'addr')
            .replace('tls-session-id', 'ssl')
            .replace('-info', '');

        const config = normalize.actionableMcp(context, item, 'ltm persistence', util.mcpPath(tenantId, appId, itemId));

        // reduce property list to match what belongs to the specified persistence method
        const props = {};
        props.any = ['description', 'match-across-pools', 'match-across-services', 'match-across-virtuals', 'mirror', 'override-connection-limit', 'timeout'];
        props.cookie = props.any.concat(['always-send', 'cookie-name', 'method', 'expiration', 'httponly', 'secure']);
        if (config.properties.method !== undefined) {
            if (config.properties.method === 'hash') {
                props.cookie = props.cookie.concat(['hash-length', 'hash-offset']);
                // schema has 2 values that map to hash-length: count and hashCount.
                // The latter appears only here.
                if (item.hashCount !== undefined) config.properties['hash-length'] = item.hashCount;
            }
            if (config.properties.method === 'insert') {
                props.cookie = props.cookie.concat(['cookie-encryption', 'cookie-encryption-passphrase']);
            }
        }
        props.hash = props.any.concat(['hash-algorithm', 'hash-length', 'hash-buffer-limit', 'hash-offset', 'hash-start-pattern', 'hash-end-pattern', 'rule']);
        props.msrdp = props.any.concat(['has-session-dir']);
        props.sip = props.any.concat(['sip-info']);
        props.ssl = props.any;
        props.universal = props.any.concat(['rule']);
        props['dest-addr'] = props.any.concat(['hash-algorithm', 'mask']);
        props['source-addr'] = props.any.concat(['hash-algorithm', 'mask']);
        Object.keys(config.properties).forEach((key) => {
            if (props[persistType].indexOf(key) === -1) {
                delete config.properties[key];
            }
        });

        config.command += ` ${persistType}`;
        return { configs: [config] };
    },

    Address_Discovery(context, tenantId, appId, itemId, item) {
        let configs = [];
        const newAppId = (tenantId === 'Common') ? 'Shared' : undefined;
        item.resources = item.resources || [];

        item.resources.forEach((resource) => {
            resource.member = setMonitors(resource.member);
            updateMember(resource.member);
        });

        item.path = util.mcpPath(tenantId, appId, itemId);
        configs = configs.concat(addressDiscovery
            .call(this, context, tenantId, newAppId, item, true, item.resources));
        return { configs };
    },

    /**
     * Defines a group of servers to be targeted by a virtual.
     */
    Pool(context, tenantId, appId, itemId, item) {
        let configs = [];
        const path = util.mcpPath(tenantId, appId, itemId);
        const memberDefs = item.members || [];
        const newAppId = (tenantId === 'Common') ? 'Shared' : undefined;

        [['allowNATEnabled', 'allow-nat'], ['allowSNATEnabled', 'allow-snat']].forEach((prop) => {
            if (typeof item[prop[0]] === 'boolean') {
                item[prop[1]] = item[prop[0]] ? 'yes' : 'no';
                delete item[prop[0]];
            }
        });

        if (!item.monitors || item.monitors.length === 0) {
            delete item.monitors;
            delete item.minimumMonitors;
        }

        // convert array of monitors into an object and handle native monitors
        item = setMonitors(item);

        const sdRequired = memberDefs.some((def) => def.addressDiscovery
            && ['static', 'fqdn'].indexOf(def.addressDiscovery) === -1);

        // rebuild item.members: each AS3 member can contain multiple addresses
        item.members = [];
        item.ignore = item.ignore || {};
        memberDefs.forEach((def) => {
            def = setMonitors(def);
            updateMember(def);

            if (def.enable) {
                configs = configs.concat(addressDiscovery
                    .call(this, context, tenantId, newAppId, def, sdRequired, [{ item, path }], item));
            }
        });

        if (sdRequired) {
            // Discovery Worker will handle member assignment, so ignore in AS3 diff
            item.ignore.members = '';
            delete item.members;
        }

        if (item.metadata) {
            Object.keys(item.metadata).forEach((member) => {
                item.metadata[member].persist = item.metadata[member].persist.toString();
            });
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm pool', path));
        return { configs };
    },

    /**
     * Defines a Diameter Endpoint Profile
     */
    Enforcement_Diameter_Endpoint_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        if (item.fatalGraceTime === 0) {
            item.fatalGraceTime = {
                enabled: 'no',
                time: item.fatalGraceTime
            };
        } else {
            item.fatalGraceTime = {
                enabled: 'yes',
                time: item.fatalGraceTime
            };
        }

        configs.push(normalize.actionableMcp(context, item, 'pem profile diameter-endpoint', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a Radius AAA Profile
     */
    Enforcement_Radius_AAA_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.ignore = item.ignore || {};

        if (item.sharedSecret !== undefined) {
            const ignoreChanges = (item.sharedSecret.ignoreChanges === true);
            item.sharedSecret = secret(item, 'sharedSecret');
            if (ignoreChanges === true) {
                item.ignore.sharedSecret = item.sharedSecret;
            }
        }

        if (item.password !== undefined) {
            const ignoreChanges = (item.password.ignoreChanges === true);
            item.password = secret(item, 'password');
            if (ignoreChanges === true) {
                item.ignore.password = item.password;
            }
        }

        configs.push(normalize.actionableMcp(context, item, 'pem profile radius-aaa', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines an Enforcement Format Script
     */
    Enforcement_Format_Script(context, tenantId, appId, itemId, item) {
        item.definition = (item.definition) ? util.escapeTcl(item.definition) : undefined;
        const configs = [];
        configs.push(normalize.actionableMcp(context, item, 'pem reporting format-script', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines an Enforcement Interception Endpoint
     */
    Enforcement_Interception_Endpoint(context, tenantId, appId, itemId, item) {
        const configs = [];
        configs.push(normalize.actionableMcp(context, item, 'pem interception-endpoint', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines an Enforcement Profile
     */
    Enforcement_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        configs.push(normalize.actionableMcp(context, item, 'pem profile spm', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a Subscriber Management Profile
     */
    Enforcement_Subscriber_Management_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        if (!item.dhcpLeaseQuery) {
            item.dhcpLeaseQuery = { enabled: false };
        }

        configs.push(normalize.actionableMcp(context, item, 'pem profile subscriber-mgmt', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a Subscriber Management Profile
     */
    Enforcement_Listener(context, tenantId, appId, itemId, item) {
        const configs = [];

        configs.push(normalize.actionableMcp(context, item, 'pem listener', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a Bandwidth Control Policy
     */
    Bandwidth_Control_Policy(context, tenantId, appId, itemId, item) {
        const unitFactor = {
            bbps: Math.pow(10, 0), // eslint-disable-line no-restricted-properties
            Kbps: Math.pow(10, 3), // eslint-disable-line no-restricted-properties
            Mbps: Math.pow(10, 6), // eslint-disable-line no-restricted-properties
            Gbps: Math.pow(10, 9) // eslint-disable-line no-restricted-properties
        };

        item.maxBandwidth *= unitFactor[item.maxBandwidthUnit];
        item.maxUserBandwidth *= unitFactor[item.maxUserBandwidthUnit];
        item.maxUserPPS *= unitFactor[item.maxUserPPSUnit.replace('pps', 'bps')];

        Object.keys(item.categories || {}).forEach((key) => {
            const cat = item.categories[key];
            if (cat.maxBandwidthUnit === '%') {
                cat.maxCatRatePercentage = cat.maxBandwidth;
                cat.maxBandwidth = 0;
            } else {
                cat.maxCatRatePercentage = 0;
                cat.maxBandwidth *= unitFactor[cat.maxBandwidthUnit];
            }
        });

        const configs = [];
        configs.push(normalize.actionableMcp(context, item, 'net bwc policy', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a snatpool
     */
    SNAT_Pool(context, tenantId, appId, itemId, item) {
        // AS3 comparison engine uses objects, not arrays. Build item.members object.
        item.members = {};
        item.snatAddresses.forEach((addr) => {
            addr = ipUtil.minimizeIP(addr);
            item.members[util.mcpPath(tenantId, undefined, addr)] = {};
            context.request.postProcessing.push(
                {
                    name: `/${tenantId}/${addr}`,
                    snatPoolAddress: addr
                }
            );
        });
        return { configs: [normalize.actionableMcp(context, item, 'ltm snatpool', util.mcpPath(tenantId, appId, itemId))] };
    },

    /**
     * Defines a snat translation
     */
    SNAT_Translation(context, tenantId, appId, itemId, item) {
        if (item.adminState === 'enable') {
            item.enabled = {};
        } else {
            item.disabled = {};
        }
        item.address = ipUtil.minimizeIP(item.address);
        context.request.postProcessing.push(
            {
                name: `/${tenantId}/${item.address}`,
                snatTranslationAddress: item.address
            }
        );
        // set the name to the address
        // The address property is read-only and there can be only 1 copy of the address among all the translations.
        // When BIGIP auto generates a translation it picks the address as the name of the object.
        // For the maintenance of translations moving between auto generated and user specified it is easier to always
        // make the translation names the same as the address.
        return { configs: [normalize.actionableMcp(context, item, 'ltm snat-translation', util.mcpPath(tenantId, undefined, item.address))] };
    },

    /**
     * Defines a virtual-address
     */
    Service_Address(context, tenantId, appId, itemId, item, declaration) {
        // copy item or virtualAddress will chop off netmask in the decl and Service_Core won't be able to find it
        const itemCopy = util.simpleCopy(item);
        const parsedAddress = ipUtil.parseIpAddress(itemCopy.virtualAddress);
        itemCopy.netmask = parsedAddress.netmask;

        // Service_Addresses are added in the root of a tenant so other applications can use them
        let newAppId = (tenantId === 'Common') ? 'Shared' : undefined;
        if (item.shareAddresses) {
            // For global accessibility we put Service_Address in the root of Common
            tenantId = 'Common';
            newAppId = undefined;
        }

        const routeDomain = (parsedAddress.routeDomain !== '')
            ? parsedAddress.routeDomain
            : getDefaultRouteDomain(declaration, tenantId);

        const regexV6 = /^::%/;
        const regexV4 = /^0\.0\.0\.0/;
        // can be wildcard with routedomain
        if (regexV4.test(parsedAddress.ip)) {
            itemCopy.virtualAddress = `any${routeDomain}`;
        } else if (regexV6.test(parsedAddress.ipWithRoute) || parsedAddress.ip === '::') {
            itemCopy.virtualAddress = `any6${routeDomain}`;
        } else {
            itemCopy.virtualAddress = `${parsedAddress.ip}${routeDomain}`;
        }

        itemCopy.icmpEcho = itemCopy.icmpEcho.replace(/able$/, 'abled');
        itemCopy.routeAdvertisement = (itemCopy.routeAdvertisement === undefined) ? 'disabled' : itemCopy.routeAdvertisement.replace(/able$/, 'abled');
        if (itemCopy.trafficGroup === undefined) {
            itemCopy.trafficGroup = 'default';
        }
        const taggedId = `Service_Address-${itemId}`;
        return { configs: [normalize.actionableMcp(context, itemCopy, 'ltm virtual-address', util.mcpPath(tenantId, newAppId, taggedId))] };
    },

    /**
     * Defines the basic properties shared by all virtual server classes
     */
    Service_Core(context, tenantId, appId, itemId, item, declaration) {
        let configs = [];
        let persistType;
        const defaultVsAddr = {
            arp: true,
            icmpEcho: 'enable',
            spanning: false
        };
        item.policies = item.policies || [];

        function checkWebSecurityProfile() {
            if (!item.profileHTTP || !util.isOneOfProvisioned(context.target, ['asm'])) {
                return;
            }
            if (typeof item.profiles === 'undefined') {
                item.profiles = [{ name: '/Common/websecurity', context: 'all' }];
            } else {
                let hasWebSecurity = false;
                item.profiles.forEach((profile1) => {
                    if (profile1.name === '/Common/websecurity') {
                        hasWebSecurity = true;
                    }
                });

                if (hasWebSecurity === false) {
                    item.profiles.push({ name: '/Common/websecurity', context: 'all' });
                }
            }
        }

        if (!item.enable) return { configs: [] };

        item.adminState = item.adminState === 'enable';

        item = updatePropsForSourceAddress(item);

        // support for vlans-disabled, vlans-enabled
        if (item.allowVlans) {
            item.vlans = item.allowVlans;
            item.vlansEnabled = ' ';
        } else if (item.rejectVlans) {
            item.vlans = item.rejectVlans;
            item.vlansDisabled = ' ';
        } else {
            item.vlans = [];
            if (item.internal) {
                // for some reason BIGIP flips this for internal virtuals
                item.vlansEnabled = ' ';
            } else {
                item.vlansDisabled = ' ';
            }
        }

        // NAT policy
        if (item.policyNAT) {
            item.securityNatPolicy = { policy: item.policyNAT };
            delete item.policyNAT;
        }

        // Timer policy
        if (item.policyIdleTimeout) {
            const timerName = item.policyIdleTimeout.bigip || item.policyIdleTimeout.use;
            const servicePolicy = {
                timerPolicy: timerName
            };
            const servicePolicyName = util.mcpPath(tenantId, appId, `f5_appsvcs_${crypto.createHash('md5').update(timerName).digest('hex')}`);
            configs.push(normalize.actionableMcp(context, servicePolicy, 'net service-policy', servicePolicyName));
            item.servicePolicy = servicePolicyName;
            delete item.policyIdleTimeout;
        }

        if (item.policyEndpoint && !Array.isArray(item.policyEndpoint)) {
            item.policyEndpoint = [item.policyEndpoint];
        }
        (item.policyEndpoint || []).forEach((policy) => {
            item.policies.push(policy);

            let policyPath = null;
            if (typeof policy === 'string') {
                policyPath = policy.slice(1);
            } else if (typeof policy === 'object' && policy.use) {
                policyPath = policy.use.slice(1);
            }
            if (!policyPath) {
                checkWebSecurityProfile();
                return;
            }

            const policyDeclaration = util.getDeepValue(declaration, policyPath, '/');
            const rules = policyDeclaration.rules || [];
            rules.forEach((rule) => {
                const actions = rule.actions || [];
                const wafAction = actions.find((action) => (
                    action.type === 'waf'
                    || (action.policyString && action.policyString.startsWith('asm'))
                ));
                if (wafAction) {
                    checkWebSecurityProfile();
                }
            });
        });

        if (item.persistenceMethods !== undefined) {
            item.persistenceMethods.forEach((method, idx) => {
                if ((typeof method === 'string') && (method.charAt(0) !== '/')) {
                    persistType = method
                        .replace('destination', 'dest')
                        .replace('address', 'addr')
                        .replace('tls-session-id', 'ssl')
                        .replace('-info', '')
                        .replace(/-/g, '_');
                    item.persistenceMethods[idx] = { bigip: `/Common/${persistType}` };
                }
                item.persistenceMethods[idx].default = 'no';
            });
            if (item.persistenceMethods.length > 0) {
                // give primacy to first listed persist method
                item.persistenceMethods[0].default = 'yes';
            } else {
                delete item.persistenceMethods;
            }
        }
        if (item.fallbackPersistenceMethod !== undefined) {
            const method = item.fallbackPersistenceMethod;
            if ((typeof method === 'string') && (method.charAt(0) !== '/')) {
                persistType = method
                    .replace('destination', 'dest')
                    .replace('address', 'addr')
                    .replace('tls-session-id', 'ssl')
                    .replace('-info', '')
                    .replace(/-/g, '_');
                item.fallbackPersistenceMethod = `/Common/${persistType}`;
            }
        }

        // unpack lastHop into two MCP properties
        if (item.lastHop === undefined || typeof item.lastHop === 'string') {
            switch (item.lastHop) {
            case 'disable':
                item['auto-lasthop'] = 'disabled';
                item['last-hop-pool'] = 'none';
                break;
            case 'auto':
                item['auto-lasthop'] = 'enabled';
                item['last-hop-pool'] = 'none';
                break;
            case 'default':
            default:
                item['auto-lasthop'] = 'default';
                item['last-hop-pool'] = 'none';
                break;
            }
        } else {
            item['auto-lasthop'] = 'default';
            item['last-hop-pool'] = bigipPath(item, 'lastHop');
        }

        if (item.httpMrfRoutingEnabled) {
            item.httpMrfRoutingEnabled = { bigip: '/Common/httprouter' };
            item = profile(item, 'httpMrfRoutingEnabled');
        }

        item.mirroring = item.mirroring === 'L4';
        item = profile(item, 'serverTLS', 'clientside', declaration);
        item = profile(item, 'clientTLS', 'serverside', declaration);
        item = profile(item, 'profileDiameterEndpoint');
        item = profile(item, 'profileEnforcement', 'clientside');
        item = profile(item, 'profileSubscriberManagement', 'clientside');
        item = profile(item, 'profileIPOther');
        item = profile(item, 'profileClassification', 'clientside');
        item = profile(item, 'profileDNS');
        item = profile(item, 'profileDOS');
        item = profile(item, 'profileStatistics');
        item = profile(item, 'profileTrafficLog');
        item = profile(item, 'profileRewrite');
        item = profile(item, 'profileFPS');
        item = profile(item, 'profileProtocolInspection');
        item = profile(item, 'profileBotDefense');
        item = profile(item, 'profileVdi');

        if (!util.versionLessThan(context.target.tmosVersion, '17.0')) {
            item = profile(item, 'profileIntegratedBotDefense');
        }

        let selfSNAT = false;
        if (item.snat === undefined) {
            item.snat = { type: 'automap' };
        } else if (typeof item.snat === 'string') {
            if (item.snat === 'self') {
                selfSNAT = true;
            } else {
                item.snat = { type: item.snat.replace('auto', 'automap') };
            }
        } else {
            item.snat = { type: 'snat', pool: bigipPath(item, 'snat') };
        }

        if (item.metadata) {
            item.metadata = Object.keys(item.metadata)
                .map((k) => Object.assign({ name: k }, item.metadata[k]));
        }

        if (item.clonePools) {
            item.clonePools = Object.keys(item.clonePools).map((k) => ({
                name: item.clonePools[k],
                context: k === 'ingress' ? 'clientside' : 'serverside'
            }));
        }

        if (util.isOneOfProvisioned(context.target, ['afm'])) {
            item.maximumBandwidth = item.maximumBandwidth || 'infinite';
            if (
                util.versionLessThan(context.target.tmosVersion, '14.0')
                && item.maximumBandwidth === 'infinite'
            ) {
                item.maximumBandwidth = 0;
            }
        }

        if (item.rateLimit <= 0) {
            item.rateLimit = 'disabled';
        }

        // Service_Core array of virtualAddresses splits into multiple virtual servers
        const addrPath = `${util.mcpPath(tenantId, appId, itemId).substring(1).replace(/\//g, '.')}`
            + '.virtualAddresses';
        const metadata = context.tasks[context.currentIndex].metadata;

        let destinationPortList;
        let destinationAddressList;
        let sourceAddressList;
        if (typeof item.virtualPort === 'object') {
            destinationPortList = item.virtualPort;
            item.virtualPort = 0;
        }
        // If we're referencing an Address_List, we want the created traffic-matching-criteria to have a
        // destination-address-inline of 0.0.0.0
        if (!Array.isArray(item.virtualAddresses)) {
            destinationAddressList = item.virtualAddresses;
            item.virtualAddresses = ['0.0.0.0'];
        }
        if (typeof item.sourceAddress === 'object') {
            sourceAddressList = item.sourceAddress;
        }

        item.virtualAddresses.forEach((addr, index) => {
            let dst;
            let src;
            let msk;
            let destIp;
            let destAddr;
            let parsAddr;
            let refMsk;
            let refRouteDomain;
            let routeDomain = getDefaultRouteDomain(declaration, tenantId);
            const alias = itemId + ((index === 0) ? '' : (`-${index}-`));

            // handle both use cases for setting destination
            if (typeof addr === 'object' && !Array.isArray(addr)) {
                if (addr.bigip) {
                    let addrBigip = addr.address || addr.bigip.split('/').slice(1)[1];
                    // In case of referencing destination to an existing virtual address with route domain
                    // we should use IP address instead of reference name.
                    if (!addr.address && context.host) {
                        context.host.parser.virtualAddressList.forEach((address) => {
                            if (address.fullPath.includes(addrBigip)) {
                                addrBigip = address.address;
                            }
                        });
                    }
                    const addrMetadata = util.getDeepValue(metadata, `${addrPath}.${index}`) || {};
                    parsAddr = [ipUtil.parseIpAddress(addrBigip)];
                    destAddr = `/${addr.bigip.split('/')[1]}/${addrBigip}`;
                    delete addr.address;

                    // Gather possible metadata if bigip ref is included
                    refMsk = addrMetadata.mask;
                    refRouteDomain = ipUtil.parseIpAddress(addrMetadata.address).routeDomain;
                } else {
                    const addrUse = addr.use.split('/').slice(1);
                    parsAddr = [ipUtil.parseIpAddress(
                        addrUse.reduce((accum, curr) => accum[curr], declaration).virtualAddress
                    )];
                    destAddr = util.mcpPath(
                        addrUse[0],
                        (addrUse[0] === 'Common') ? 'Shared' : undefined,
                        addrUse[2]
                    );
                }

                routeDomain = (parsAddr[0].routeDomain !== '') ? parsAddr[0].routeDomain : routeDomain;
                routeDomain = refRouteDomain || routeDomain;
                destIp = addr.bigip ? destAddr : `${parsAddr[0].ip}${routeDomain}`;
                src = `${(destIp.includes(':') ? '::' : '0.0.0.0')}${routeDomain}/0`;
                msk = refMsk || parsAddr[0].netmask;
            } else if (Array.isArray(addr) && typeof addr[0] === 'object') {
                // handle cases with ref to Service_Address && source address
                if (addr[0].bigip) {
                    let addrBigip = addr[0].address || addr[0].bigip.split('/').slice(1)[1];
                    // In case of referencing destination to an existing virtual address with route domain
                    // we should use IP address instead of reference name.
                    if (!addr[0].address && context.host) {
                        context.host.parser.virtualAddressList.forEach((address) => {
                            if (address.fullPath.includes(addrBigip)) {
                                addrBigip = address.address;
                            }
                        });
                    }
                    const addrMetadata = util.getDeepValue(metadata, `${addrPath}.${index}.0`) || {};
                    parsAddr = [
                        ipUtil.parseIpAddress(addrBigip),
                        ipUtil.parseIpAddress(arrUtil.ensureArray(addr)[1])
                    ];
                    destAddr = `/${addr[0].bigip.split('/')[1]}/${addrBigip}`;
                    delete addr[0].address;

                    // Gather possible metadata if bigip ref is included
                    refMsk = addrMetadata.mask;
                } else {
                    const addrUse = addr[0].use.split('/').slice(1);
                    parsAddr = [
                        ipUtil.parseIpAddress(
                            addrUse.reduce((accum, curr) => accum[curr], declaration).virtualAddress
                        ),
                        ipUtil.parseIpAddress(arrUtil.ensureArray(addr)[1])
                    ];
                    destAddr = util.mcpPath(
                        addrUse[0],
                        (addrUse[0] === 'Common') ? 'Shared' : undefined,
                        addrUse[2]
                    );
                }

                routeDomain = (parsAddr[0].routeDomain !== '') ? parsAddr[0].routeDomain : routeDomain;
                destIp = addr[0].bigip ? destAddr : `${parsAddr[0].ip}${routeDomain}`;
                msk = refMsk || parsAddr[0].netmask;

                const defaultSourceAddress = `${(destAddr.includes(':') ? '::' : '0.0.0.0')}${routeDomain}/0`;
                src = (arrUtil.ensureArray(addr)[1])
                    ? ipUtil.minimizeIP(arrUtil.ensureArray(addr)[1])
                    : defaultSourceAddress;
                addr[1] = addr[1].split('/')[0];
            } else {
                parsAddr = [
                    ipUtil.parseIpAddress(arrUtil.ensureArray(addr)[0]),
                    ipUtil.parseIpAddress(arrUtil.ensureArray(addr)[1])
                ];
                msk = parsAddr[0].netmask;
                routeDomain = (parsAddr[0].routeDomain !== '') ? parsAddr[0].routeDomain : routeDomain;

                if (item.shareAddresses) {
                    defaultVsAddr.shareAddresses = item.shareAddresses;
                    destAddr = util.mcpPath('Common', undefined, `${parsAddr[0].ip}${routeDomain}`);
                } else {
                    destAddr = util.mcpPath(
                        tenantId,
                        (tenantId === 'Common') ? 'Shared' : undefined,
                        `${parsAddr[0].ip}${routeDomain}`
                    );
                }
                // we need to send addr to translate.Service_Address but addr could be an array or string
                defaultVsAddr.virtualAddress = arrUtil.ensureArray(addr)[0];

                if (item.class === 'Service_Forwarding') {
                    defaultVsAddr.arp = false;
                    defaultVsAddr.icmpEcho = 'disable';
                }

                // For idempotency, the name of the Service_Address should reflect its address
                const convertedIp = parsAddr[0].ip;
                let saName = `${convertedIp}${routeDomain}`;
                const regexSANameV6 = /^::%/;
                const regexSANameV4 = /^0\.0\.0\.0/;
                // can be wildcard with routedomain
                if (regexSANameV4.test(convertedIp)) {
                    saName = `any${routeDomain}`;
                } else if (regexSANameV6.test(parsAddr[0].ipWithRoute) || convertedIp === '::') {
                    saName = `any6${routeDomain}`;
                }
                // Service_Address calculates its own appId, so the passed in one is ignored
                const translatedServiceAddr = translate.Service_Address(
                    context,
                    tenantId,
                    undefined,
                    saName,
                    defaultVsAddr,
                    declaration
                );

                // internal virtuals can't create virtual-addresses because the addresses are all 0.0.0.0
                // which causes an error due to duplicates. For virtuals with a destinationAddressList,
                // our only virtual-address would be 'any' which we don't need as it is covered by the
                // traffic-matching-criteria destination-address-inline
                if (!isInternal(item) && !destinationAddressList) {
                    configs = configs.concat(translatedServiceAddr.configs);
                }
                destIp = translatedServiceAddr.configs[0].properties.address;

                const defaultSourceAddress = `${(destAddr.includes(':') ? '::' : '0.0.0.0')}${routeDomain}/0`;
                src = (arrUtil.ensureArray(addr)[1])
                    ? ipUtil.minimizeIP(arrUtil.ensureArray(addr)[1])
                    : defaultSourceAddress;
                item.virtualAddresses[index] = (Array.isArray(addr))
                    ? [`${parsAddr[0].ip}${routeDomain}`, `${parsAddr[1].ip}${routeDomain}`]
                    : `${parsAddr[0].ip}${routeDomain}`;
            }

            // for AS3 snat="self" feature, must see each virtual
            // address in order to create corresponding pool
            if (selfSNAT) {
                const selfProps = { snatAddresses: [`${parsAddr[0].ip}${routeDomain}`] };
                const selfPool = `${alias}-self`;
                item.snat = {
                    type: 'snat',
                    pool: util.mcpPath(tenantId, appId, selfPool)
                };
                const translatedSnat = translate.SNAT_Pool(context, tenantId, appId, selfPool, selfProps);
                configs = configs.concat(translatedSnat.configs);
            }

            let delimiter = (destAddr.indexOf(':') + 1) ? '.' : ':';

            if (!util.isEmptyOrUndefined(routeDomain) && !destIp.includes('%') && !destIp.startsWith('/')) {
                destIp = `${destIp}${routeDomain}`;
            }
            if (destIp.includes('%')) {
                // tmsh doesn't work with name ref if there is %RD value
                // also note that %RD is implicit for a partition with a defaultRouteDomain
                // so it doesn't show in the address value
                delimiter = ((destIp.indexOf(':') + 1) || (destIp.includes('any6'))) ? '.' : ':';
                if (!destIp.startsWith('/')) {
                    dst = `/${tenantId}/${destIp}${delimiter}${item.virtualPort}`;
                } else dst = `${destIp}${delimiter}${item.virtualPort}`;
            } else {
                dst = `${destAddr}${delimiter}${item.virtualPort}`;
            }

            const regex = /\/::\W/; // destinations have optional %RD and mandatory .PORT
            if (dst.includes('/0.0.0.0')) {
                dst = dst.replace('/0.0.0.0', '/any');
            } else if (regex.test(dst)) {
                dst = dst.replace('::', 'any6');
            }

            // internal virtuals do not get destinations, they are all 0.0.0.0
            if (!isInternal(item)) {
                item.destination = dst;
            }

            item.source = src;
            item.mask = msk;

            item.remark = item.remark || appId;

            if (!util.versionLessThan(context.target.tmosVersion, '14.1')
                && (destinationPortList || destinationAddressList || sourceAddressList)) {
                const parsed = ipUtil.parseIpAddress(item.source);
                const source = `${parsed.ip}/${parsed.netmask}`;

                const tmcObj = {
                    protocol: item.layer4,
                    destinationAddressInline: `${destIp.split('%')[0]}/${msk}`, // strip the route domain
                    destinationAddressList: bigipPathFromSrc(destinationAddressList),
                    destinationPortList: bigipPathFromSrc(destinationPortList),
                    sourceAddressList: bigipPathFromSrc(sourceAddressList),
                    sourceAddressInline: source
                };

                tmcObj.routeDomain = routeDomain ? `/Common/${routeDomain.split('%')[1]}` : 'any';

                item.trafficMatchingCriteria = util.mcpPath(tenantId, appId, `${alias}_VS_TMC_OBJ`);
                delete item.destination;
                delete item.source;

                configs.push(normalize.actionableMcp(
                    context,
                    tmcObj,
                    'ltm traffic-matching-criteria',
                    util.mcpPath(tenantId, appId, `${alias}_VS_TMC_OBJ`)
                ));
            }

            configs.push(normalize.actionableMcp(context, item, 'ltm virtual', util.mcpPath(tenantId, appId, alias)));
        });
        return { configs };
    },

    /**
     * Defines specific properties for HTTP virtual servers.
     * Service_Core properties are assumed.
     */
    Service_HTTP(context, tenantId, appId, itemId, item, declaration) {
        let configs = [];
        // support for IAM policy attachment only
        if (item.policyIAM || item.profileAccess) {
            // add per-session policy's auto-generated apm profile with rba and websso
            let profilePath;

            if (item.policyIAM) {
                item = profile(item, 'policyIAM');
                if (item.policyIAM.use) {
                    profilePath = item.policyIAM.use.split('/');
                }
            }

            if (item.profileAccess) {
                item = profile(item, 'profileAccess');
                if (item.profileAccess.use) {
                    profilePath = item.profileAccess.use.split('/');
                }
            }

            if (profilePath) {
                // profilePath should only be set here in the use-ref scenario
                const profileDef = declaration[profilePath[1]][profilePath[2]][profilePath[3]];
                if (!profileDef.ssloCreated) {
                    item.profiles.push({ name: '/Common/rba', context: 'all' });
                    item.profiles.push({ name: '/Common/websso', context: 'all' });
                }
            } else {
                if (item.policyIAM && item.policyIAM.bigip) {
                    profilePath = item.policyIAM.bigip;
                } else if (item.profileAccess && item.profileAccess.bigip) {
                    profilePath = item.profileAccess.bigip;
                }

                if (profilePath) {
                    let profileDef;
                    if (context.host && context.host.parser && context.host.parser.accessProfileList) {
                        profileDef = context.host.parser.accessProfileList.find((e) => e.fullPath === profilePath);
                    }
                    if (!profileDef || profileDef.type !== 'ssl-orchestrator') {
                        item.profiles.push({ name: '/Common/rba', context: 'all' });
                        item.profiles.push({ name: '/Common/websso', context: 'all' });
                    }
                }
            }

            if (item.policyPerRequestAccess) {
                if (item.policyPerRequestAccess.use && item.policyPerRequestAccess.use.split('/').length === 4) {
                    const splitPath = item.policyPerRequestAccess.use.split('/');
                    item.policyPerRequestAccess.use = `/${splitPath[1]}/${splitPath[3]}`;
                }
            }
        }

        // support for WAF policy attachment only
        // however, this requires an LTM policy to be constructed
        if (item.policyWAF !== undefined && item.policyWAF !== '') {
            item = profile(item, 'policyWAF');
            item.profiles.pop();
            item.profiles.push({ name: '/Common/websecurity', context: 'all' });
            // add ltm policy with WAF controls
            const policy = {
                rules: [{
                    name: 'default',
                    actions: [{
                        type: 'waf',
                        policy: { bigip: item.policyWAF.name }
                    }]
                }],
                strategy: 'first-match'
            };
            const ltmPolicyName = `_WAF_${itemId === 'serviceMain' ? (`_${appId}`) : itemId}`;
            const fullLtmPolicyName = util.mcpPath(tenantId, appId, ltmPolicyName);
            item.policies = item.policies || [];
            item.policies.push(fullLtmPolicyName);
            const endpointStrat = translate.Endpoint_Policy(context, tenantId, appId, ltmPolicyName, policy);
            configs = configs.concat(endpointStrat.configs);
        }
        if (item.profileHTTP === undefined || typeof item.profileHTTP === 'string') {
            item.profileHTTP = { bigip: '/Common/http' };
        }
        if (typeof item.profileHTTPCompression === 'string') {
            item.profileHTTPCompression = {
                bigip: ((item.profileHTTPCompression === 'wan') ? '/Common/wan-optimized-compression' : '/Common/httpcompression')
            };
        }
        if (typeof item.profileMultiplex === 'string') {
            item.profileMultiplex = { bigip: '/Common/oneconnect' };
        }
        if (typeof item.profileHTTPAcceleration === 'string') {
            item.profileHTTPAcceleration = { bigip: '/Common/webacceleration' };
        }
        item = profile(item, 'profileHTTP');
        item = profile(item, 'profileHTML');
        item = profile(item, 'profileHTTPCompression');
        item = profile(item, 'profileHTTPAcceleration');
        item = profile(item, 'profileMultiplex');
        item = profile(item, 'profileNTLM');
        item = profile(item, 'profileAnalytics');
        item = profile(item, 'profileAnalyticsTcp');
        item = profile(item, 'profileConnectivity', 'clientside');
        item = profile(item, 'profileRequestAdapt', 'clientside');
        item = profile(item, 'profileResponseAdapt', 'serverside');
        item = profile(item, 'profileWebSocket');
        if (!util.versionLessThan(context.target.tmosVersion, '14.1')) {
            item = profile(item, 'profileApiProtection');
        }

        if (item.profileConnectivity) {
            item.profiles.push({
                name: '/Common/ppp',
                context: 'all'
            });
        }

        if (item.profileHTTP.use) {
            let profilePath = item.profileHTTP.use;
            profilePath = profilePath.charAt(0) === '/' ? profilePath.substring(1) : profilePath;
            profilePath = profilePath.split('/');
            const httpProfile = declaration[profilePath[0]][profilePath[1]][profilePath[2]];
            if (httpProfile) {
                if (!item.profileWebSocket) {
                    // deprecated method (if) has precedence over older deprecated method (else if)
                    if (httpProfile.profileWebSocket) {
                        item.profileWebSocket = httpProfile.profileWebSocket;
                        item = profile(item, 'profileWebSocket');
                    } else if (httpProfile.webSocketsEnabled) {
                        item.profiles.push({
                            use: `/${profilePath[0]}/${profilePath[1]}/f5_appsvcs_${httpProfile.webSocketMasking}`,
                            name: `/${profilePath[0]}/${profilePath[1]}/f5_appsvcs_${httpProfile.webSocketMasking}`,
                            context: 'all'
                        });
                    }
                }

                if (httpProfile.proxyConnectEnabled) {
                    item.profiles.push({
                        use: `/${profilePath[0]}/${profilePath[1]}/f5_appsvcs_${profilePath[2]}_proxyConnect`,
                        name: `/${profilePath[0]}/${profilePath[1]}/f5_appsvcs_${profilePath[2]}_proxyConnect`,
                        context: 'all'
                    });
                }
            }
        }

        if (!util.versionLessThan(context.target.tmosVersion, '14.1') && item.profileDOS
            && !item.profileDOS.bigip && !item.profileBotDefense && util.isOneOfProvisioned(context.target, ['asm'])) {
            const path = bigipPath(item, 'profileDOS').split('/').slice(0, -1).join('/');
            item.profiles.push({ name: `${path}/f5_appsvcs_${bigipPath(item, 'profileDOS').split('/').pop()}_botDefense`, context: 'all' });
        }

        const serviceTCP = translate.Service_TCP(context, tenantId, appId, itemId, item, declaration);
        configs = configs.concat(serviceTCP.configs);
        return { configs };
    },

    /**
     * Defines specific properties for HTTP virtual servers.
     * Service_Core properties are assumed.
     */
    Service_HTTPS(context, tenantId, appId, itemId, item, declaration) {
        const redirectDef = {
            addressStatus: true,
            enable: item.enable && item.redirect80,
            layer4: 'tcp',
            iRules: [{
                bigip: '/Common/_sys_https_redirect'
            }],
            maxConnections: 0,
            rateLimit: item.rateLimit,
            nat64Enabled: false,
            profileTCP: item.profileTCP,
            serviceDownImmediateAction: 'none',
            translateClientPort: false,
            translateServerAddress: true,
            translateServerPort: true,
            virtualAddresses: util.simpleCopy(item.virtualAddresses),
            virtualPort: 80,
            shareAddresses: item.shareAddresses,
            allowVlans: util.simpleCopy(item.allowVlans),
            rejectVlans: util.simpleCopy(item.rejectVlans),
            adminState: item.adminState
        };

        if (typeof item.profileHTTP2 === 'string') {
            item.profileHTTP2 = { bigip: '/Common/http2' };
        }
        if (item.profileHTTP2 && (item.profileHTTP2.use || item.profileHTTP2.bigip)) {
            item = profile(item, 'profileHTTP2', 'all');
        }
        const profileHttp2Copy = util.simpleCopy(item.profileHTTP2);
        if (profileHttp2Copy && profileHttp2Copy.ingress) {
            item.profileHTTP2 = profileHttp2Copy.ingress;
            item = profile(item, 'profileHTTP2', 'clientside');
        }
        if (profileHttp2Copy && profileHttp2Copy.egress) {
            item.profileHTTP2 = profileHttp2Copy.egress;
            item = profile(item, 'profileHTTP2', 'serverside');
        }

        let configs = translate.Service_HTTP(context, tenantId, appId, itemId, item, declaration).configs;
        configs = configs.concat(translate.Service_HTTP(context, tenantId, appId, `${itemId}${constants.redirectSuffix}`, redirectDef, declaration).configs);
        return { configs };
    },

    /**
     * Defines specific properties for TCP virtual servers.
     * Service_Core properties are assumed.
     */
    Service_TCP(context, tenantId, appId, itemId, item, declaration) {
        const profileCopy = util.simpleCopy(item.profileTCP || 'normal');
        const makeObj = function makeObj(serviceProfile) {
            serviceProfile = serviceProfile || 'normal';
            if (typeof serviceProfile === 'string') {
                serviceProfile = {
                    bigip: `/Common/f5-tcp-${serviceProfile.replace('normal', 'progressive')}`
                };
            }
            return serviceProfile;
        };
        item.profileTCP = makeObj(item.profileTCP);
        if (Object.prototype.hasOwnProperty.call(item.profileTCP, 'use')
            || Object.prototype.hasOwnProperty.call(item.profileTCP, 'bigip')) {
            item = profile(item, 'profileTCP', 'all');
        }
        if (Object.prototype.hasOwnProperty.call(profileCopy, 'ingress')) {
            item.profileTCP = makeObj(profileCopy.ingress);
            item = profile(item, 'profileTCP', 'clientside');
        }
        if (Object.prototype.hasOwnProperty.call(profileCopy, 'egress')) {
            item.profileTCP = makeObj(profileCopy.egress);
            item = profile(item, 'profileTCP', 'serverside');
        }
        item = profile(item, 'profileAnalyticsTcp');
        item = profile(item, 'profileFIX');
        item = profile(item, 'profileSIP');
        item = profile(item, 'profileSOCKS');
        item = profile(item, 'profileSSHProxy');
        item = profile(item, 'profileFTP');
        item = profile(item, 'profilePPTP');
        item = profile(item, 'profileStream');
        item = profile(item, 'profileILX');
        item = profile(item, 'profileRTSP', 'clientside');

        if (item.mqttEnabled) {
            item.mqttEnabled = { bigip: '/Common/mqtt' };
            item = profile(item, 'mqttEnabled');
        } else {
            delete item.mqttEnabled;
        }

        item = updatePropsIfInternal(item);

        const serviceCore = translate.Service_Core(context, tenantId, appId, itemId, item, declaration);
        return { configs: serviceCore.configs };
    },

    /**
     * Defines specific properties for UDP virtual servers.
     * Service_Core properties are assumed.
     */
    Service_UDP(context, tenantId, appId, itemId, item, declaration) {
        if ((item.profileUDP === undefined) || (typeof item.profileUDP === 'string')) {
            item.profileUDP = {
                bigip: '/Common/udp'
            };
        }
        item = profile(item, 'profileUDP');
        item = profile(item, 'profileRADIUS');
        item = profile(item, 'profileSIP');
        item = profile(item, 'profileTFTP');

        item = updatePropsIfInternal(item);
        item = updatePropsIfStateless(item);

        const serviceCore = translate.Service_Core(context, tenantId, appId, itemId, item, declaration);
        return { configs: serviceCore.configs };
    },

    /**
     * Defines specific properties for forwarding virtual servers.
     * Service_Core properties are assumed. ARP and ICMP Echo will be disabled.
     */
    Service_Forwarding(context, tenantId, appId, itemId, item, declaration) {
        if (item.forwardingType === 'ip') {
            item['ip-forward'] = ' ';
        }
        if (item.forwardingType === 'l2') {
            item['l2-forward'] = ' ';
        }

        if ((item.profileL4 === undefined) || (typeof item.profileL4 === 'string')) {
            item.profileL4 = {
                bigip: '/Common/fastL4'
            };
        }

        item = profile(item, 'profileL4');
        const serviceCore = translate.Service_Core(context, tenantId, appId, itemId, item, declaration);
        return { configs: serviceCore.configs };
    },

    /**
     * Defines specific properties for SCTP virtual servers.
     * Service_Core properties are assumed.
     */
    Service_SCTP(context, tenantId, appId, itemId, item, declaration) {
        if ((item.profileSCTP === undefined) || (typeof item.profileSCTP === 'string')) {
            item.profileSCTP = {
                bigip: '/Common/sctp'
            };
        }
        item = profile(item, 'profileSCTP');
        const serviceCore = translate.Service_Core(context, tenantId, appId, itemId, item, declaration);
        return { configs: serviceCore.configs };
    },

    /**
     * Defines specific properties for L4 virtual servers.
     * Service_Core properties are assumed.
     */
    Service_L4(context, tenantId, appId, itemId, item, declaration) {
        if ((item.profileL4 === undefined) || (typeof item.profileL4 === 'string')) {
            item.profileL4 = {
                bigip: '/Common/fastL4'
            };
        }
        item = profile(item, 'profileAnalyticsTcp');
        item = profile(item, 'profileL4');
        item = profile(item, 'profileFIX');
        const serviceCore = translate.Service_Core(context, tenantId, appId, itemId, item, declaration);
        return { configs: serviceCore.configs };
    },

    /**
     * Defines specific properties for generic virtual servers.
     * Service_Core properties are assumed.
     */
    Service_Generic(context, tenantId, appId, itemId, item, tenantDecl) {
        item = profile(item, 'profileAnalyticsTcp');
        const serviceCore = translate.Service_Core(context, tenantId, appId, itemId, item, tenantDecl);
        return { configs: serviceCore.configs };
    },

    /**
     * Defines specific properties for LTM endpoint policies.
     */
    Endpoint_Policy(context, tenantId, appId, itemId, item) {
        if (item.strategy === 'custom') {
            item.strategy = item.customStrategy;
        } else {
            item.strategy = `/Common/${item.strategy}`;
        }
        (item.rules || []).forEach((rule, index) => {
            rule.ordinal = index;
            rule.actions = rule.actions || [];
            rule.conditions = rule.conditions || [];

            // Rename service to virtual for forward actions
            rule.actions.forEach((action) => {
                if (action.type === 'forward' && action.select) {
                    if (action.select.service) {
                        action.select.virtual = bigipPath(action.select, 'service');
                        delete action.select.service;
                    } else if (action.select.pool) {
                        action.select.pool = bigipPath(action.select, 'pool');
                    }
                } else if (action.type === 'waf') {
                    action.type = 'asm';
                    if (action.policy) {
                        action.enable = true;
                        action.policy = bigipPath(action, 'policy');
                    } else {
                        action.disable = true;
                    }
                } else if (action.type === 'botDefense') {
                    if (action.profile) {
                        action.enable = true;
                        action.fromProfile = bigipPath(action, 'profile');
                        delete action.profile;
                    } else {
                        action.disable = true;
                    }
                } else if (action.type === 'drop') {
                    action.type = 'shutdown';
                } else if (action.type === 'httpRedirect') {
                    action.redirect = {
                        location: action.location
                    };
                    delete action.location;
                    action.type = 'httpReply';
                } else if (action.type === 'clientSsl') {
                    action.type = 'serverSsl';
                    if (action.enabled) {
                        action.enable = true;
                    } else if (!action.enabled) {
                        action.disable = true;
                    }
                    delete action.enabled;
                } else if (action.type === 'http') {
                    if (action.enabled) {
                        action.enable = true;
                    } else {
                        action.disable = true;
                    }
                }
            });

            rule.conditions.forEach((condition) => {
                if (condition.type === 'sslExtension') {
                    // Handle default here because AJV will not fill defaults in oneOf lists
                    condition.index = condition.index || 0;
                } else {
                    Object.keys(condition).forEach((key) => {
                        if (condition[key].datagroup) {
                            condition[key].datagroup = condition[key].datagroup.bigip || condition[key].datagroup.use;
                        }
                    });
                }
            });

            rule.actions = createPolicyStringArray(rule.actions, 'action');
            rule.conditions = createPolicyStringArray(rule.conditions, 'condition');
        });
        const config = [normalize.actionableMcp(context, item, 'ltm policy', util.mcpPath(tenantId, appId, itemId))];
        return { configs: config };
    },

    /**
     * Defines specific properties for LTM endpoint strategies.
     */
    Endpoint_Strategy(context, tenantId, appId, itemId, item) {
        let config = [];
        item.operands = createPolicyStringArray(item.operands || [], 'operand');
        config = [normalize.actionableMcp(context, item, 'ltm policy-strategy', util.mcpPath(tenantId, appId, itemId))];
        return { configs: config };
    },

    Protocol_Inspection_Profile(context, tenantId, appId, itemId, item) {
        if (item.services) {
            item.services.forEach((service, index) => {
                if (service.ports) {
                    service.ports.forEach((port, portIndex) => {
                        item.services[index].ports[portIndex] = {
                            name: port
                        };
                    });
                }
            });
        }
        const config = normalize.actionableMcp(context, item, 'security protocol-inspection profile', util.mcpPath(tenantId, appId, itemId));

        // Remove any properties (compliance, signature or even services) that may be appended to the config
        // after normalize.actionableMcp() is called on the object
        const services = config.properties.services;
        Object.keys(services).forEach((serviceKey) => {
            ['compliance', 'signature', 'ports'].forEach((checkType) => {
                if (Object.keys(services[serviceKey][checkType]).length === 0) {
                    delete services[serviceKey][checkType];
                } else if (checkType === 'compliance') {
                    // only compliance checks can have "value" property
                    Object.keys(services[serviceKey].compliance).forEach((checkName) => {
                        const value = services[serviceKey].compliance[checkName].value;
                        if (value) {
                            const isInt = !value.match(/[^0-9]/);
                            if (value === 'none') {
                                // some compliance checks do not accept value but will store 'none' in config
                                delete services[serviceKey].compliance[checkName].value;
                            } else if (!isInt) {
                                services[serviceKey].compliance[checkName].value = util.normalizeProfileOptions(value);
                            }
                        }
                    });
                }
            });
        });
        if (Object.keys(services).length === 0) {
            delete config.properties.services;
        }
        return { configs: [config] };
    },

    Security_Log_Profile(context, tenantId, appId, itemId, item) {
        function extractProperties(subProfile, filterFunc) {
            const properties = {};
            const logKeys = Object.keys(subProfile).filter(filterFunc);
            logKeys.forEach((key) => {
                properties[key] = subProfile[key];
                delete subProfile[key];
            });
            return properties;
        }

        function mapFilter(subProfile) {
            subProfile.filter = extractProperties(subProfile, (key) => key.startsWith('log'));
        }

        function mapRateLimit(subProfile) {
            subProfile.rateLimit = extractProperties(subProfile, (key) => key.startsWith('rateLimit'));
        }

        function mapNatSession(natProfile) {
            natProfile.logStartOutboundSession = { action: natProfile.logStartOutboundSession };
            natProfile.logEndOutboundSession = { action: natProfile.logEndOutboundSession };

            if (natProfile.logStartOutboundSession.action === true) {
                if (natProfile.logStartOutboundSessionDestination === true) {
                    natProfile.logStartOutboundSession.elements = { destination: {} };
                }
            }
            if (natProfile.logEndOutboundSession.action === true) {
                if (natProfile.logEndOutboundSessionDestination === true) {
                    natProfile.logEndOutboundSession.elements = { destination: {} };
                }
            }
        }

        function mapFormat(subProfile, inKey, outKey) {
            inKey = inKey || 'storageFormat';
            outKey = outKey || 'format';
            if (typeof subProfile[inKey] === 'string') {
                subProfile[outKey] = {
                    type: 'user-defined',
                    userDefined: subProfile[inKey]
                };
            } else if (typeof subProfile[inKey] === 'object') {
                subProfile[outKey] = {
                    type: 'field-list',
                    fieldList: subProfile[inKey].fields.map((field) => field.replace(/-/g, '_')),
                    fieldListDelimiter: subProfile[inKey].delimiter
                };
            } else {
                subProfile[outKey] = {
                    type: 'none'
                };
            }
            delete subProfile[inKey];
        }

        function mapApplicationFilter() {
            item.application['logic-operation'] = item.application.storageFilter.logicalOperation;
            item.application.requestType = {
                name: 'request-type',
                values: [item.application.storageFilter.requestType]
            };
            item.application.filter = [item.application.requestType];
            Object.keys(item.application.storageFilter)
                .filter((key) => ['logicalOperation', 'requestType'].indexOf(key) === -1)
                .forEach((key) => {
                    const filter = {};
                    filter.name = {
                        protocols: 'protocol',
                        responseCodes: 'response-code',
                        httpMethods: 'http-method',
                        loginResults: 'login-result'
                    }[key] || item.application.storageFilter.requestContains.searchIn;
                    const valuesSource = item.application.storageFilter[key];
                    if (key === 'requestContains') {
                        filter.values = [item.application.storageFilter.requestContains.value];
                    } else {
                        filter.values = Array.isArray(valuesSource) ? valuesSource : [valuesSource];
                    }
                    item.application.filter.push(filter);
                });
        }

        function mapApplicationFormat() {
            item.application.format = {
                fieldDelimiter: ',',
                type: 'predefined'
            };
            if (item.application.storageFormat && typeof item.application.storageFormat === 'string') {
                item.application.format.type = 'user-defined';
                item.application.format.userString = item.application.storageFormat;
                delete item.application.format.fieldDelimiter;
            } else if (item.application.storageFormat && typeof item.application.storageFormat === 'object') {
                item.application.format.fieldDelimiter = item.application.storageFormat.delimiter;
                item.application.format.fields = [];
                item.application.storageFormat.fields.forEach((field) => {
                    item.application.format.fields.push(field);
                });
            }
        }

        function mapApplicationServers() {
            item.application.servers.forEach((server, index) => {
                if (server.address.includes(':')) {
                    item.application.servers[index].name = `${server.address}.${server.port}`;
                } else {
                    item.application.servers[index].name = `${server.address}:${server.port}`;
                }
                delete item.application.servers[index].address;
                delete item.application.servers[index].port;
            });
        }

        let config = [];
        if (item.application) {
            mapApplicationFilter();
            mapApplicationFormat();

            item.application.maxHeaderSize = item.application.maxHeaderSize ? item.application.maxHeaderSize.toString() : 'any';
            item.application.maxQuerySize = item.application.maxQuerySize ? item.application.maxQuerySize.toString() : 'any';
            item.application.maxRequestSize = item.application.maxRequestSize ? item.application.maxRequestSize.toString() : 'any';

            if (item.application.remoteStorage) {
                item.application.localStorage = false;
                item.application.loggerType = 'remote';
            } else {
                item.application.remoteStorage = 'none';
                item.application.loggerType = 'local';
                item.application.localStorage = true;
            }

            if (item.application.servers) {
                mapApplicationServers();
            }
            item.application = [item.application];
        }
        if (item.botDefense) {
            mapFilter(item.botDefense);
            item.botDefense = [item.botDefense];
        }
        if (item.dosApplication) {
            item.dosApplication = [item.dosApplication];
        }
        if (item.dosNetwork) {
            item.dosNetworkPublisher = item.dosNetwork.publisher;
        }
        if (item.nat) {
            mapRateLimit(item.nat);
            item.nat.format = extractProperties(item.nat, (key) => key.startsWith('format'));
            Object.keys(item.nat.format).forEach((formatKey) => {
                item.nat.format[`in${formatKey}`] = item.nat.format[formatKey];
                mapFormat(item.nat.format, `in${formatKey}`, formatKey);
            });
            mapNatSession(item.nat);
        }
        if (item.network) {
            mapFormat(item.network);
            item.network.filter = extractProperties(
                item.network,
                (key) => key.startsWith('log') || key === 'alwaysLogRegion'
            );
            mapRateLimit(item.network);
            item.network = [item.network];
        }
        if (item.protocolDns) {
            mapFilter(item.protocolDns);
            mapFormat(item.protocolDns);
            item.protocolDns = [item.protocolDns];
        }
        if (item.protocolDnsDos) {
            item.protocolDnsDosPublisher = item.protocolDnsDos.publisher;
        }
        if (item.protocolSip) {
            mapFilter(item.protocolSip);
            mapFormat(item.protocolSip);
            item.protocolSip = [item.protocolSip];
        }
        if (item.protocolSipDos) {
            item.protocolSipDosPublisher = item.protocolSipDos.publisher;
        }
        if (item.protocolTransfer) {
            item.protocolTransfer = [item.protocolTransfer];
        }
        if (item.sshProxy) {
            item.sshProxy.logPublisher = item.sshProxy.publisher;
            delete item.sshProxy.publisher;

            item.sshProxy = [item.sshProxy];
        }

        config = [normalize.actionableMcp(context, item, 'security log profile', util.mcpPath(tenantId, appId, itemId))];
        const networkFormat = util.getDeepValue(config[0].properties, 'network.undefined.format');
        if (networkFormat && networkFormat.type === 'user-defined') {
            delete networkFormat['field-list-delimiter'];
        }
        return { configs: config };
    },

    Log_Publisher(context, tenantId, appId, itemId, item) {
        let config = [];
        item.remark = item.remark || '';
        config = [normalize.actionableMcp(context, item, 'sys log-config publisher', util.mcpPath(tenantId, appId, itemId))];
        return { configs: config };
    },

    Log_Destination(context, tenantId, appId, itemId, item) {
        let config = [];
        if (item.pool) {
            item.poolName = bigipPath(config, 'pool');
        }
        if (item.remoteHighSpeedLog) {
            item.remoteHighSpeedLog = bigipPath(item, 'remoteHighSpeedLog');
        }
        const command = `sys log-config destination ${item.type}`;
        config = [normalize.actionableMcp(context, item, command, util.mcpPath(tenantId, appId, itemId))];
        return { configs: config };
    },

    Firewall_Policy(context, tenantId, appId, itemId, item) {
        const configs = [];

        (item.rules || []).forEach((rule, index) => {
            if (rule.use || rule.bigip) {
                item.rules[index] = {
                    name: bigipPath(item.rules, index).split('/').pop(),
                    ruleList: item.rules[index]
                };
            }
        });
        const path = util.mcpPath(tenantId, appId, itemId);
        configs.push(normalize.actionableMcp(context, item, 'security firewall policy', path));

        (item.routeDomainEnforcement || []).forEach((routeDomain) => {
            const rd = { fwEnforcedPolicy: path };
            configs.push(normalize.actionableMcp(context, rd, 'net route-domain', routeDomain.bigip));
        });

        return { configs };
    },

    /**
     * Defines a Firewall Address List
     */
    Firewall_Address_List(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const serviceDisc = [];
        const configs = [];
        item.ignore = item.ignore || {};

        // pull our service discovery addresses so the rest can be handled as normal
        if (Array.isArray(item.addresses)) {
            for (let i = 0; i < item.addresses.length; i += 1) {
                if (typeof item.addresses[i] === 'object') {
                    serviceDisc.push(item.addresses[i]);
                    item.addresses.splice(i, 1);
                    i -= 1;
                }
            }
        }

        configs.push(normalize.actionableMcp(context, item, 'security firewall address-list', path));

        if (serviceDisc.length > 0) {
            // Discovery Worker will handle address assignment, so ignore in AS3 diff
            configs[configs.length - 1].ignore.push('addresses');

            const tasks = [];
            if (item.addresses.length > 0) {
                tasks.push(serviceDiscovery.createTask({
                    addressDiscovery: 'static',
                    serverAddresses: item.addresses
                }, tenantId, [{ item, path }]));
            }

            serviceDisc.forEach((sdItem) => {
                tasks.push(serviceDiscovery.createTask(sdItem, tenantId, [{ item, path }]));
            });

            tasks.forEach((task) => {
                const sdPath = util.mcpPath(tenantId, null, task.id);
                serviceDiscovery.prepareTaskForNormalize(task);
                configs.push(normalize.actionableMcp(context, task, 'mgmt shared service-discovery task', sdPath));
            });
        }

        return { configs };
    },

    /**
     * Defines a Firewall Port List
     */
    Firewall_Port_List(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const config = [normalize.actionableMcp(context, item, 'security firewall port-list', path)];
        return { configs: config };
    },

    /**
     * Defines a Firewall Rule List
     */
    Firewall_Rule_List(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const config = [normalize.actionableMcp(context, item, 'security firewall rule-list', path)];
        return { configs: config };
    },

    /**
     * Defines a Net Address List
     */
    Net_Address_List(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const configs = [];
        item.ignore = item.ignore || {};

        configs.push(normalize.actionableMcp(context, item, 'net address-list', path));

        return { configs };
    },

    /**
     * Defines a Net Port List
     */
    Net_Port_List(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const configs = [];
        item.ignore = item.ignore || {};

        configs.push(normalize.actionableMcp(context, item, 'net port-list', path));

        return { configs };
    },

    NAT_Policy(context, tenantId, appId, itemId, item) {
        if (item.rules) {
            item.rules.forEach((rule) => {
                if (rule.sourceTranslation) {
                    rule.translation = {};
                    rule.translation.source = rule.sourceTranslation.use;
                }
            });
        }
        const config = [normalize.actionableMcp(context, item, 'security nat policy', util.mcpPath(tenantId, appId, itemId))];
        return { configs: config };
    },

    NAT_Source_Translation(context, tenantId, appId, itemId, item) {
        if (item.type === 'dynamic-pat') {
            if (!item.clientConnectionLimit) {
                item.clientConnectionLimit = 0;
            }
            if (!item.hairpinModeEnabled) {
                item.hairpinModeEnabled = false;
            }
            if (!item.inboundMode) {
                item.inboundMode = 'none';
            }
            if (!item.mapping) {
                item.mapping = {
                    mode: 'address-pooling-paired',
                    timeout: 300
                };
            }
            if (!item.patMode) {
                item.patMode = 'napt';
            }
            if (item.patMode === 'pba' && !item.portBlockAllocation) {
                item.portBlockAllocation = {
                    blockIdleTimeout: 3600,
                    blockLifetime: 0,
                    blockSize: 64,
                    clientBlockLimit: 1,
                    zombieTimeout: 0
                };
            }
        }
        if (item.addresses) {
            item.addresses = item.addresses.map((addr) => ({ name: addr }));
        }
        if (item.ports) {
            item.ports = item.ports.map((port) => ({ name: port }));
        }

        if (Array.isArray(item.excludeAddresses)) {
            const excludeAddress = [];
            const excludeAddressList = [];
            item.excludeAddresses.forEach((addr) => {
                if (typeof addr === 'string') {
                    excludeAddress.push({
                        name: addr
                    });
                } else {
                    excludeAddressList.push({
                        name: addr
                    });
                }
            });
            item.excludeAddresses = excludeAddress;
            item.excludeAddressLists = excludeAddressList;
        }

        // support for egressInterfaces-disabled, egressInterfaces-enabled
        if (item.allowEgressInterfaces) {
            item.egressInterfaces = item.allowEgressInterfaces;
            item.egressInterfacesEnabled = ' ';
        } else if (item.disallowEgressInterfaces) {
            item.egressInterfaces = item.disallowEgressInterfaces;
            item.egressInterfacesDisabled = ' ';
        } else {
            item.egressInterfaces = [];
            item.egressInterfacesDisabled = ' ';
        }
        const config = [normalize.actionableMcp(context, item, 'security nat source-translation', util.mcpPath(tenantId, appId, itemId))];
        return { configs: config };
    },

    Enforcement_Policy(context, tenantId, appId, itemId, item) {
        (item.rules || []).forEach((rule) => {
            if (typeof rule.DTOSTethering !== 'undefined'
                && typeof rule.DTOSTethering.reportDestinationHsl !== 'undefined') {
                rule.DTOSTethering.report = {
                    dest: {
                        reportDestinationHsl: rule.DTOSTethering.reportDestinationHsl
                    }
                };
            }
            (rule.flowInfoFilters || []).forEach((flowFilter) => {
                flowFilter.l2Endpoint = typeof flowFilter.sourceVlan !== 'undefined';
                if (typeof flowFilter.ipAddressType !== 'undefined') {
                    if (flowFilter.ipAddressType === 'ipv4') {
                        flowFilter.ipAddressType = 'IPv4';
                    } else if (flowFilter.ipAddressType === 'ipv6') {
                        flowFilter.ipAddressType = 'IPv6';
                    }
                }
            });
            if (typeof rule.forwarding !== 'undefined') {
                if (rule.forwarding.type === 'endpoint') {
                    rule.forwarding.type = 'pool';
                } else if (rule.forwarding.type === 'http') {
                    rule.httpRedirect = {
                        redirectUrl: rule.forwarding.redirectUrl,
                        fallbackAction: rule.forwarding.fallbackAction
                    };
                    delete rule.forwarding;
                }
            }
            rule.qoeReporting = {
                dest: {
                    qoeReporting: rule.qoeReporting
                }
            };
            if (typeof rule.ranCongestion !== 'undefined') {
                rule.ranCongestion.detect = true;
                rule.ranCongestion.report = {
                    dest: {
                        reportDestinationHsl: rule.ranCongestion.reportDestinationHsl
                    }
                };
            }
            if (typeof rule.usageReporting !== 'undefined') {
                const destType = rule.usageReporting.destination;
                rule.usageReporting.destination = {};
                rule.usageReporting.destination[destType] = rule.usageReporting;
                rule.usageReporting.transaction = {
                    http: rule.usageReporting.transaction
                };
            }
            if (typeof rule.qosBandwidthControllerUplink !== 'undefined') {
                rule.qosBandwidthControllerUplink = `${bigipPath(rule.qosBandwidthControllerUplink, 'policy')
                }->${rule.qosBandwidthControllerUplink.category || ''}`;
            } else {
                rule.qosBandwidthControllerUplink = '->';
            }
            if (typeof rule.qosBandwidthControllerDownlink !== 'undefined') {
                rule.qosBandwidthControllerDownlink = `${bigipPath(rule.qosBandwidthControllerDownlink, 'policy')
                }->${rule.qosBandwidthControllerDownlink.category || ''}`;
            } else {
                rule.qosBandwidthControllerDownlink = '->';
            }
            if (typeof rule.tclFilter !== 'undefined') {
                rule.tclFilter = util.escapeTcl(rule.tclFilter);
            }
        });
        const path = util.mcpPath(tenantId, appId, itemId);
        const config = [normalize.actionableMcp(context, item, 'pem policy', path)];
        return { configs: config };
    },

    /**
     * Defines a Forwarding Endpoint
     */
    Enforcement_Forwarding_Endpoint(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.persistence = {};

        item.persistence.type = item.defaultPersistenceType;
        item.persistence.fallback = item.fallbackPersistenceType;
        item.persistence.hashSettings = item.persistenceHashSettings;

        if (!item.persistence.hashSettings.tclScript) {
            item.persistence.hashSettings.source = 'uri';
        } else {
            item.persistence.hashSettings.source = 'tcl-snippet';
            item.persistence.hashSettings.tclScript = util.escapeTcl(
                item.persistenceHashSettings.tclScript
            );
        }

        configs.push(normalize.actionableMcp(context, item, 'pem forwarding-endpoint', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    /**
     * Defines a Service Chain Endpoint
     */
    Enforcement_Service_Chain_Endpoint(context, tenantId, appId, itemId, item) {
        const configs = [];

        if (item.serviceEndpoints) {
            item.serviceEndpoints.forEach((obj, index) => {
                obj.httpAdaptService = {};
                obj.order = index + 1;

                if (obj.forwardingEndpoint) {
                    obj.forwardingEndpoint.toEndpoint = obj.forwardingEndpoint;
                }

                if (!obj.internalServiceICAPType) {
                    obj.httpAdaptService.internalServiceICAPType = 'none';
                } else {
                    obj.httpAdaptService.internalService = item.internalService;
                    obj.httpAdaptService.internalServiceICAPType = item.internalServiceICAPType;
                }
            });
        }

        configs.push(normalize.actionableMcp(context, item, 'pem service-chain-endpoint', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    HTML_Rule(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        const configs = [];
        item.ignore = item.ignore || {};
        item.remark = item.remark || '';
        // there will be either item.attributeName or item.content but not both
        // properties.json altId will convert this to action {attributeName: item.attributeName}
        item.attributeName = typeof item.attributeName === 'undefined' ? undefined : { attributeName: item.attributeName };
        // properties.json altId will convert this to action {text: item.content}
        item.content = typeof item.content === 'undefined' ? undefined : { text: item.content };
        configs.push(normalize.actionableMcp(context, item, `ltm html-rule ${item.ruleType}`, path));
        return { configs };
    },

    Data_Group(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, itemId);
        let config = {};
        item.ignore = item.ignore || {};
        item.remark = item.remark || '';
        if (item.storageType === 'internal') {
            const itemRecords = [];
            item.records.forEach((record) => {
                let recKey = record.key;
                if (item.keyDataType === 'ip' && record.key.indexOf('/') === -1) {
                    recKey += '/32';
                }

                itemRecords.push({
                    name: recKey,
                    value: record.value === '' ? undefined : record.value
                });
            });
            delete item.storageType;
            item.records = itemRecords;
            config = normalize.actionableMcp(context, item, 'ltm data-group internal', path);
            return { configs: [config] };
        }

        delete item.storageType;
        delete item.records;
        if (item.externalFilePath) {
            if (item.ignoreChanges) {
                item.ignore.dataGroupName = path;
                item.ignore.externalFilePath = item.externalFilePath;
            }
            if (util.getDeepValue(item, 'externalFilePath.authentication.method') === 'bearer-token') {
                const settings = util.simpleCopy(item);
                item = makeDataGroupTokenRequests(item, itemId, path, settings, 'Data Group');
            } else {
                item.externalFilePath = item.externalFilePath.url || item.externalFilePath;
            }
            item.dataGroupName = path;
            config = normalize.actionableMcp(context, item, 'ltm data-group external', path);

            const dataGroupFileConfig = normalize.actionableMcp(context, item, 'sys file data-group', path);

            if (dataGroupFileConfig.properties.iControl_postFromRemote) {
                // Set source-path to uploaded file destination
                config.properties['source-path'] = `file:/var/config/rest/downloads/${path.replace(/\//g, '_')}`;
                dataGroupFileConfig.properties['source-path'] = `file:/var/config/rest/downloads/${path.replace(/\//g, '_')}`;
            }

            return { configs: [config, dataGroupFileConfig] };
        }
        item.ignore.separator = item.separator;
        config = normalize.actionableMcp(context, item, 'ltm data-group external', path);

        return { configs: [config] };
    },

    GSLB_Server(context, tenantId, appId, itemId, item) {
        item.remark = item.remark || '';
        tagMetadata(item);
        item.devices = item.devices.map((device, i) => ({
            name: `${i}`,
            addresses: [{
                name: device.address,
                translation: device.addressTranslation || 'none'
            }]
        }));

        function combineAddressPort(address, port) {
            const minAddress = ipUtil.minimizeIP(address);
            let separator = ':';
            if (minAddress.indexOf(':') > -1) {
                separator = '.';
            }
            return `${minAddress}${separator}${port}`;
        }

        function mapMonitors(source) {
            if (source.monitors.length > 0) {
                source.monitors = source.monitors
                    .map((m, i) => bigipPath(source.monitors, i))
                    .join(' and ');
            } else if (source.serverType === 'bigip') {
                source.monitors = '/Common/bigip';
            }
        }

        let vsMetadata = '';
        (item.virtualServers || []).forEach((vs, i) => {
            vs.destination = combineAddressPort(vs.address, vs.port);
            vsMetadata = `${vsMetadata}${vsMetadata ? '_' : ''}${vs.destination}`;
            vs.name = vs.name || `${i}`;
            vs.addressTranslation = vs.addressTranslation || 'none';
            vs.addressTranslationPort = vs.addressTranslationPort || 0;
            if (vs.monitors) {
                mapMonitors(vs); // Defaults to undefined
            }
        });

        if (vsMetadata) {
            item.metadata.push(
                {
                    name: 'as3-virtuals',
                    value: vsMetadata,
                    persist: 'true'
                }
            );
        }

        mapMonitors(item); // Defaults to undefined or '/Common/bigip ' depending on serverType

        item.serverType = item.serverType || 'bigip';
        item.proberPool = item.proberPool || 'none';

        const path = util.mcpPath(tenantId, '', itemId);
        const config = [normalize.actionableMcp(context, item, 'gtm server', path)];
        return { configs: config };
    },

    GSLB_Data_Center(context, tenantId, appId, itemId, item) {
        tagMetadata(item);
        const path = util.mcpPath(tenantId, '', itemId);
        const config = [normalize.actionableMcp(context, item, 'gtm datacenter', path)];
        return { configs: config };
    },

    GSLB_Domain(context, tenantId, appId, itemId, item) {
        const path = util.mcpPath(tenantId, appId, item.domainName);
        let config = {};
        item.ignore = item.ignore || {};
        item.remark = item.remark || itemId;

        if (item.pools) {
            item.pools = item.pools.map((pool, idx) => ({
                name: pool.use,
                order: idx,
                ratio: pool.ratio
            }));
        }

        config = normalize.actionableMcp(context, item, `gtm wideip ${item.resourceRecordType.toLowerCase()}`, path);

        if (config.properties['last-resort-pool'] !== 'none') {
            config.properties['last-resort-pool'] = `${item.lastResortPoolType
                .toLowerCase()} ${config.properties['last-resort-pool']}`;
        }

        context.request.postProcessing.push(
            {
                domainName: path,
                aliases: config.properties.aliases
            }
        );

        return { configs: [config] };
    },

    GSLB_iRule(context, tenantId, appId, itemId, item) {
        item.ignore = item.ignore || {};
        if (item.iRule.url && item.iRule.url.ignoreChanges) {
            item.ignore.iRule = '';
        }
        const config = normalize.actionableMcp(context, item, 'gtm rule', util.mcpPath(tenantId, appId, itemId));
        return createIRule(config);
    },

    GSLB_Monitor(context, tenantId, appId, itemId, item) {
        const props = {};
        const configs = [];

        item.remark = item.remark || 'none';

        if (item.monitorType === 'https') {
            const cert = item.clientCertificate;
            item.clientCertificate = cert ? `${cert}.crt` : 'none';
            item.key = cert ? `${cert}.key` : 'none';
        }

        if ((['http', 'https'].indexOf(item.monitorType) >= 0)) {
            if (Array.isArray(item.receiveStatusCodes)) {
                item.receiveStatusCodes = item.receiveStatusCodes.join(' ');
            }
            item.receiveStatusCodes = item.receiveStatusCodes || 'none';
        }

        if ((['http', 'https', 'tcp', 'udp'].indexOf(item.monitorType) >= 0)) {
            item.send = item.send || 'none';
            item.receive = item.receive || 'none';
            item.sniServerName = item.sniServerName || 'none';
        }

        if (item.monitorType === 'external') {
            // Add default to external monitors for arguments
            item.arguments = item.arguments || 'none';

            if (item.script) {
                // Only external monitors that references an external script need to set one up
                configs.push(makeExternalMonitorRequests(context, tenantId, appId, itemId, item));
            }
        }

        // quote any arbitrary strings
        if (item.environmentVariables) {
            Object.keys(item.environmentVariables).forEach((envVar) => {
                item.environmentVariables[envVar] = normalize.quoteString(item.environmentVariables[envVar]);
            });
        }

        const config = normalize.actionableMcp(context, item, 'gtm monitor', util.mcpPath(tenantId, appId, itemId));

        props.any = ['class', 'description', 'destination', 'interval', 'timeout', 'probe-timeout', 'ignore-down-response'];
        props.http = props.any.concat(['reverse', 'send', 'recv', 'recv-status-code', 'transparent']);
        props.https = props.http.concat(['cipherlist', 'cert', 'sni-server-name']);
        props['gateway-icmp'] = props.any.concat(['probe-interval', 'probe-attempts', 'send', 'recv', 'transparent']);
        props.tcp = props.http;
        props.udp = props['gateway-icmp'].concat(['debug', 'reverse']);
        props.external = props.any.concat(['run', 'api-anonymous', 'args', 'user-defined']);
        Object.keys(config.properties).forEach((key) => {
            if (props[item.monitorType].indexOf(key) === -1) {
                delete config.properties[key];
            }
        });

        config.command += ` ${item.monitorType}`;
        configs.push(config);
        return { configs };
    },

    GSLB_Topology_Region(context, tenantId, appId, itemId, item) {
        tagDescription(item);
        const path = util.mcpPath(tenantId, '', itemId);
        if (item.members) {
            item.members = item.members.map((itemMember) => parseTopologyMatch(itemMember))
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }
        const config = normalize.actionableMcp(context, item, 'gtm region', path);
        return { configs: [config] };
    },

    GSLB_Topology_Records(context, tenantId, appId, itemId, item) {
        const records = [];
        const recordsPath = `/${tenantId}/${constants.gtmTopologyMockPath}`;
        item.records.forEach((itemRecord, indexAsKey) => {
            // add the order number to path to allow multiple items of same type
            // this path will be stripped of the cli script
            const record = {
                name: `${indexAsKey}`,
                order: indexAsKey + 1,
                weight: itemRecord.weight,
                source: parseTopologyMatch(itemRecord.source).name,
                destination: parseTopologyMatch(itemRecord.destination).name
            };

            tagDescription(record);

            records.push(record);
        });
        item.records = records;

        const settingsItem = { longestMatchEnabled: item.longestMatchEnabled };
        delete item.longestMatchEnabled;

        const lbConfig = normalize.actionableMcp(context, settingsItem, 'gtm global-settings load-balancing', constants.gtmSettingsMockPath);
        const config = normalize.actionableMcp(context, item, 'gtm topology', recordsPath);
        return { configs: [lbConfig, config] };
    },

    DOS_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];
        const botDefenseConfig = {};

        function extractObjectKeys(obj, key, prefix) {
            if (obj[key]) {
                prefix = prefix || '';
                Object.keys(obj[key]).forEach((prop) => {
                    obj[`${prefix}${util.capitalizeString(prop)}`] = obj[key][prop];
                });
            }
        }

        if (item.application) {
            const captcha = item.application.captchaResponse;
            captcha.first = typeof captcha.first === 'undefined' ? { type: 'default' }
                : { type: 'custom', body: captcha.first };
            captcha.failure = typeof captcha.failure === 'undefined' ? { type: 'default' }
                : { type: 'custom', body: captcha.failure };

            const geolocations = [];

            if (item.application.denylistedGeolocations) {
                item.application.denylistedGeolocations.forEach((location) => {
                    geolocations.push({ name: JSON.stringify(location), blackListed: true });
                });
                delete item.application.denylistedGeolocations;
            }
            if (item.application.allowlistedGeolocations) {
                item.application.allowlistedGeolocations.forEach((location) => {
                    geolocations.push({ name: JSON.stringify(location), whiteListed: true });
                });
                delete item.application.allowlistedGeolocations;
            }
            item.application.geolocations = geolocations;

            if (item.application.heavyURLProtection) {
                const heavyUrls = item.application.heavyURLProtection;
                if (heavyUrls.protectList) {
                    // The value of 0 in threshold becomes 'auto'
                    heavyUrls.protectList.forEach((listItem, i) => {
                        listItem.name = `${i}`;
                        listItem.threshold = listItem.threshold || 'auto';
                    });
                }
            }

            if (util.isOneOfProvisioned(context.target, ['afm'])) {
                if (item.application.scrubbingDuration) {
                    item.application.scrubbingEnable = 'enabled';
                } else {
                    // bigip always sets to 600 when disabled.  match it for idempotency.
                    item.application.scrubbingDuration = 600;
                    item.application.scrubbingEnable = 'disabled';
                }

                if (item.application.remoteTriggeredBlackHoleDuration) {
                    item.application.rtbhEnable = 'enabled';
                } else {
                    // bigip always sets to 300 when disabled.  match it for idempotency.
                    item.application.remoteTriggeredBlackHoleDuration = 300;
                    item.application.rtbhEnable = 'disabled';
                }
            }

            if (item.application.botDefense) {
                if (item.application.botDefense.mode === 'off') {
                    item.application.botDefense.mode = 'disabled';
                }
            }

            if (util.versionLessThan(context.target.tmosVersion, '14.1')) {
                if (item.application.botSignatures) {
                    const categories = [];

                    if (item.application.botSignatures.blockedCategories) {
                        item.application.botSignatures.blockedCategories.forEach((category) => {
                            categories.push({
                                name: bigipPath(category, 'bigip'),
                                action: 'block'
                            });
                        });
                    }
                    if (item.application.botSignatures.reportedCategories) {
                        item.application.botSignatures.reportedCategories.forEach((category) => {
                            categories.push({
                                name: bigipPath(category, 'bigip'),
                                action: 'report'
                            });
                        });
                    }
                    item.application.botSignatures.categories = categories;
                }

                if (item.application.mobileDefense) {
                    item.application.mobileDefense.allowAnyAndroidPackage = item
                        .application.mobileDefense.allowAndroidPublishers === undefined;
                    item.application.mobileDefense.allowAnyIosPackage = item
                        .application.mobileDefense.allowIosPackageNames === undefined;

                    if (item.application.mobileDefense.clientSideChallengeMode === 'challenge') {
                        item.application.mobileDefense.clientSideChallengeMode = 'cshui';
                    }

                    if (item.application.mobileDefense.allowAndroidPublishers) {
                        const publishers = [];
                        item.application.mobileDefense.allowAndroidPublishers.forEach((publisher) => {
                            publishers.push({
                                name: bigipPath(publisher, publisher.bigip ? 'bigip' : 'use')
                            });
                        });
                        item.application.mobileDefense.allowAndroidPublishers = publishers;
                    }
                }
            } else {
                botDefenseConfig.singlePageApplication = item.application.singlePageApplicationEnabled || false;
                botDefenseConfig.crossDomainRequests = item.application.botDefense.crossDomainRequests || 'allow-all';
                botDefenseConfig.gracePeriod = item.application.botDefense.gracePeriod || 300;
                if (item.application.botDefense) {
                    botDefenseConfig.classOverrides = [];
                    const browser = {
                        name: 'Browser',
                        verification: { action: '' },
                        mitigation: { action: 'none' }
                    };
                    const unknown = {
                        name: 'Unknown',
                        mitigation: { action: 'tcp-reset' },
                        verification: { action: 'none' }
                    };
                    const suspiciousBrowser = {
                        name: '"Suspicious Browser"',
                        mitigation: { action: 'captcha' },
                        verification: { action: 'none' }
                    };

                    switch (item.application.botDefense.mode) {
                    case 'disabled':
                        browser.verification.action = 'none';
                        botDefenseConfig.dosMitigation = 'enabled';
                        break;
                    case 'always':
                        browser.verification.action = 'browser-verify-before-access';
                        botDefenseConfig.classOverrides.push(unknown);
                        botDefenseConfig.dosMitigation = 'disabled';
                        break;
                    case 'during-attacks':
                        browser.verification.action = 'none';
                        botDefenseConfig.dosMitigation = 'enabled';
                        // TODO: requires DOS protection profile
                        break;
                    default:
                        break;
                    }

                    // the schema defaults are actually mode:off, blockSuspiciousBrowser:true
                    // so ensure here that "off" or disabled mode does not turn on browser verification
                    if (item.application.botDefense.mode !== 'disabled') {
                        // See issue note regarding enforcementMode
                        botDefenseConfig.enforcementMode = 'blocking';
                        if (item.application.botDefense.blockSuspiscousBrowsers) {
                            browser.verification.action = 'browser-verify-before-access';
                            if (item.application.botDefense.issueCaptchaChallenge) {
                                botDefenseConfig.classOverrides.push(suspiciousBrowser);
                            }
                        }
                    } else {
                        botDefenseConfig.enforcementMode = 'transparent';
                    }

                    botDefenseConfig.classOverrides.push(browser);

                    botDefenseConfig.externalDomains = item.application.botDefense.externalDomains;
                    botDefenseConfig.siteDomains = item.application.botDefense.siteDomains;
                    botDefenseConfig.whitelist = [
                        {
                            matchOrder: 1,
                            name: 'favicon_1',
                            url: '/favicon.ico'
                        },
                        {
                            matchOrder: 2,
                            name: 'apple_touch_1',
                            url: '/apple-touch-icon*.png'
                        }
                    ];
                    if (item.application.botDefense.urlAllowlist) {
                        item.application.botDefense.urlAllowlist.forEach((u, index) => {
                            botDefenseConfig.whitelist.push({
                                matchOrder: index + 3,
                                name: `url_${index}`,
                                url: u
                            });
                        });
                    }
                }

                botDefenseConfig.mobileDefense = item.application.mobileDefense;
                botDefenseConfig.mobileDefense.allowAnyAndroidPackage = item
                    .application.mobileDefense.allowAndroidPublishers === undefined;
                botDefenseConfig.mobileDefense.allowAnyIosPackage = item
                    .application.mobileDefense.allowIosPackageNames === undefined;
                if (item.application.mobileDefense.clientSideChallengeMode === 'challenge') {
                    botDefenseConfig.mobileDefense.clientSideChallengeMode = 'cshui';
                }

                if (item.application.botSignatures) {
                    botDefenseConfig.signatureCategoryOverrides = [];
                    botDefenseConfig.signatureOverrides = [];
                    if (item.application.botSignatures.blockedCategories) {
                        item.application.botSignatures.blockedCategories.forEach((category) => {
                            botDefenseConfig.signatureCategoryOverrides.push({
                                name: bigipPath(category, 'bigip'),
                                action: 'block'
                            });
                        });
                    }

                    if (item.application.botSignatures.reportedCategories) {
                        item.application.botSignatures.reportedCategories.forEach((category) => {
                            botDefenseConfig.signatureCategoryOverrides.push({
                                name: bigipPath(category, 'bigip'),
                                action: 'alarm'
                            });
                        });
                    }

                    if (item.application.botSignatures.disabledSignatures) {
                        item.application.botSignatures.disabledSignatures.forEach((signature) => {
                            botDefenseConfig.signatureOverrides.push({
                                name: bigipPath(signature, 'bigip'),
                                action: 'alarm'
                            });
                        });
                        delete item.application.botSignatures.disabledSignatures;
                    }
                }
            }

            if (item.application.rateBasedDetection) {
                const rateBased = item.application.rateBasedDetection;
                extractObjectKeys(rateBased, 'sourceIP', 'ip');
                extractObjectKeys(rateBased, 'deviceID', 'device');
                extractObjectKeys(rateBased, 'geolocation', 'geo');
                extractObjectKeys(rateBased, 'url', 'url');
                extractObjectKeys(rateBased, 'site', 'site');
            }

            if (item.application.stressBasedDetection) {
                const stressBased = item.application.stressBasedDetection;
                extractObjectKeys(stressBased, 'sourceIP', 'ip');
                extractObjectKeys(stressBased, 'deviceID', 'device');
                extractObjectKeys(stressBased, 'geolocation', 'geo');
                extractObjectKeys(stressBased, 'url', 'url');
                extractObjectKeys(stressBased, 'site', 'site');
            }

            item.application = [item.application];
        } else if (!util.versionLessThan(context.target.tmosVersion, '14.1')) {
            botDefenseConfig.dosMitigation = 'enabled';
            botDefenseConfig.enforcementMode = 'transparent';
            botDefenseConfig.whitelist = [
                {
                    matchOrder: 1,
                    name: 'favicon_1',
                    url: '/favicon.ico'
                },
                {
                    matchOrder: 2,
                    name: 'apple_touch_1',
                    url: '/apple-touch-icon*.png'
                }
            ];
            botDefenseConfig.crossDomainRequests = 'allow-all';
            botDefenseConfig.gracePeriod = 300;
            botDefenseConfig.singlePageApplication = false;
            botDefenseConfig.mobileDefense = {
                allowAndroidRootedDevice: false,
                allowAnyAndroidPackage: true,
                allowAnyIosPackage: true,
                allowEmulators: false,
                allowJailbrokenDevices: false,
                clientSideChallengeMode: 'pass'
            };
        }

        function mapToInfinite(source, property) {
            if (source[property] === 4294967295) {
                source[property] = 'infinite';
            }
        }

        function mapVectors(vectors, vectorType) {
            (vectors || []).forEach((vector) => {
                if (vector.type === 'malformed') {
                    vector.type = `${vectorType}-malformed`;
                }

                mapToInfinite(vector, 'autoAttackCeiling');
                mapToInfinite(vector, 'autoAttackFloor');
                mapToInfinite(vector, 'rateLimit');
                mapToInfinite(vector, 'rateThreshold');

                vector.autoThreshold = 'disabled';

                if (vector.badActorSettings) {
                    const settings = vector.badActorSettings;
                    vector.badActor = settings.enabled;
                    vector.perSourceIpDetectionPps = settings.sourceDetectionThreshold;
                    vector.perSourceIpLimitPps = settings.sourceMitigationThreshold;
                    mapToInfinite(vector, ['perSourceIpDetectionPps']);
                    mapToInfinite(vector, ['perSourceIpLimitPps']);
                }

                if (vector.autoDenylistSettings) {
                    const settings = vector.autoDenylistSettings;
                    vector.autoBlacklisting = settings.enabled;
                    vector.blacklistCategory = settings.category;
                    vector.blacklistDetectionSeconds = settings.attackDetectionTime;
                    vector.blacklistDuration = settings.categoryDuration;
                    vector.allowAdvertisement = settings.externalAdvertisementEnabled;
                }
            });
        }
        if (item.network) {
            mapVectors(item.network.vectors, 'network');
            item.network = [item.network];
        }
        if (item.protocolDNS) {
            mapVectors(item.protocolDNS.vectors, 'dns');
            item.protocolDNS = [item.protocolDNS];
        }
        if (item.protocolSIP) {
            mapVectors(item.protocolSIP.vectors, 'sip');
            item.protocolSIP = [item.protocolSIP];
        }

        const config = normalize.actionableMcp(context, item, 'security dos profile', util.mcpPath(tenantId, appId, itemId));

        // Remove 'undefined' properties
        const application = (config.properties.application)
            ? config.properties.application.undefined : config.properties.application;
        if (application && application['bot-signatures'] && application['bot-signatures'].categories) {
            Object.keys(application['bot-signatures'].categories).forEach((key) => {
                delete application['bot-signatures'].categories[key].partition;
                delete application['bot-signatures'].categories[key]['sub-path'];
            });
        }
        if (application && application['mobile-detection']
            && application['mobile-detection']['android-publishers']) {
            Object.keys(application['mobile-detection']['android-publishers']).forEach((key) => {
                delete application['mobile-detection']['android-publishers'][key].partition;
                delete application['mobile-detection']['android-publishers'][key]['sub-path'];
            });
        }

        configs.push(config);
        if (botDefenseConfig && !util.versionLessThan(context.target.tmosVersion, '14.1') && util.isOneOfProvisioned(context.target, ['asm'])) {
            configs.push(normalize.actionableMcp(context, botDefenseConfig, 'security bot-defense profile', util.mcpPath(tenantId, appId, `f5_appsvcs_${itemId}_botDefense`)));
        }

        return { configs };
    },

    GSLB_Pool(context, tenantId, appId, itemId, item, declaration) {
        const props = {};
        const currentTask = context.tasks[context.currentIndex];

        function needsWait(member) {
            if (member.server) {
                // if we're referring to an existing server, we don't have enough information
                // so assume the worst
                if (member.server.bigip) {
                    return true;
                }

                const referencedServer = util.getDeepValue(declaration, member.server.use, '/');
                if (referencedServer
                    && referencedServer.virtualServerDiscoveryMode
                    && referencedServer.virtualServerDiscoveryMode.startsWith('enable')) {
                    return true;
                }
            }
            return false;
        }

        if ((['A', 'AAAA'].indexOf(item.resourceRecordType) >= 0)) {
            if (!item.monitors || item.monitors.length === 0) {
                item.monitors = 'default';
            } else {
                item.monitors = item.monitors.map((m, idx) => bigipPath(item.monitors, idx))
                    .join(' and ');
            }

            item.fallbackIP = item.fallbackIP || 'any';
            item.bpsLimit = item.bpsLimit || 0;
            item.bpsLimitEnabled = item.bpsLimitEnabled || false;
            item.ppsLimit = item.ppsLimit || 0;
            item.ppsLimitEnabled = item.ppsLimitEnabled || false;
            item.connectionsLimit = item.connectionsLimit || 0;
            item.connectionsLimitEnabled = item.connectionsLimitEnabled || false;
            (item.members || []).forEach((member) => {
                if (needsWait(member, declaration)) {
                    currentTask.metadata = currentTask.metadata || {};
                    currentTask.metadata.gslbPool = { needsWait: true };
                }

                if (typeof member.virtualServer === 'object') {
                    member.virtualServer = member.virtualServer.use || member.virtualServer.bigip;
                }

                member.name = `${bigipPath(member, 'server').replace('/Shared', '')}:${member.virtualServer}`;
                if (member.dependsOn && member.dependsOn !== 'none') {
                    member.dependsOn.forEach((dependsOn, index) => {
                        member.dependsOn[index] = dependsOn.replace('/Shared', '');
                    });
                }
            });
        } else {
            (item.members || []).forEach((member) => {
                if (member.domainName.use) {
                    const domainPath = member.domainName.use.replace(/\//g, '.').slice(1);
                    const domain = util.getDeepValue(declaration, domainPath);
                    member.domainName.use = member.domainName.use.replace(/[^/]+$/, domain.domainName);
                }
                member.name = bigipPath(member, 'domainName').replace('/Shared', '');
                // only supports 'a' because the other option 's' requires a SRV wideip which AS3 does not have yet
                // when we add 's' support should be able to derive the flags value
                // 'a' has a A or AAAA wideip, 's' has a SRV wideip
                if (item.resourceRecordType === 'NAPTR') {
                    member.flags = 'a';
                }
            });
        }

        item.qosHitRatio = item.qosHitRatio || 5;
        item.qosHops = item.qosHops || 0;
        item.qosKbps = item.qosKbps || 3;
        item.qosLinkCapacity = item.qosLinkCapacity || 30;
        item.qosPacketRate = item.qosPacketRate || 1;
        item.qosRoundTripTime = item.qosRoundTripTime || 50;
        item.qosTopology = item.qosTopology || 0;
        item.qosVirtualServerCapacity = item.qosVirtualServerCapacity || 0;
        item.qosVirtualServerScore = item.qosVirtualServerScore || 0;

        (item.members || []).forEach((member, index) => {
            member.memberOrder = index;
            if (item.resourceRecordType !== 'CNAME') {
                delete member.isDomainNameStatic;
            }

            if (item.resourceRecordType !== 'MX') {
                delete member.priority;
            }
        });

        const path = util.mcpPath(tenantId, appId, itemId);
        const config = normalize.actionableMcp(context, item, 'gtm pool', path);

        Object.keys(config.properties.members || {}).forEach((member) => {
            // Since the GSLB Pool members all share the same properties.json we need to remove
            // empty depends-on values that will populate in MX and CNAME pool members.
            const memberBody = config.properties.members[member];
            if (memberBody['depends-on'] && Object.keys(memberBody['depends-on']).length === 0) {
                if (item.resourceRecordType === 'A' || item.resourceRecordType === 'AAAA') {
                    memberBody['depends-on'] = 'none';
                } else {
                    delete memberBody['depends-on'];
                }
            }
        });

        config.command += ` ${item.resourceRecordType.toLowerCase()}`;

        props.any = [
            'class', 'dynamic-ratio', 'enabled', 'alternate-mode', 'app-service', 'description', 'ratio', 'fallback-mode',
            'load-balancing-mode', 'manual-resume', 'members', 'metadata', 'qos-hit-ratio',
            'qos-hops', 'qos-kilobytes-second', 'qos-lcs', 'qos-packet-rate', 'qos-rtt',
            'qos-topology', 'qos-vs-capacity', 'qos-vs-score', 'ttl', 'verify-member-availability'
        ];
        props.a = props.any.concat([
            'fallback-ip', 'limit-max-bps', 'limit-max-bps-status', 'limit-max-connections',
            'limit-max-connections-status', 'limit-max-pps', 'limit-max-pps-status',
            'max-answers-returned', 'monitor'
        ]);
        props.aaaa = props.a;
        props.cname = props.any.concat(['monitors']);
        props.mx = props.any.concat(['max-answers-returned']);
        props.naptr = props.mx.concat(['flags']);
        Object.keys(config.properties).forEach((key) => {
            if (props[item.resourceRecordType.toLowerCase()].indexOf(key) === -1) {
                delete config.properties[key];
            }
        });

        return { configs: [config] };
    },

    GSLB_Prober_Pool(context, tenantId, appId, itemId, item) {
        tagDescription(item);
        (item.members || []).forEach((member, index) => {
            member.order = index;
            member.name = `${bigipPath(member, 'server').replace('/Shared', '')}`;
            member.name = member.name.includes('/') ? member.name : `/Common/${member.name}`;
        });
        const path = util.mcpPath(tenantId, '', itemId);
        const config = [normalize.actionableMcp(context, item, 'gtm prober-pool', path)];
        return { configs: config };
    },

    Traffic_Log_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.remark = item.remark || 'none';

        Object.keys(item.requestSettings).forEach((key) => {
            item[key] = item.requestSettings[key];
        });

        item.proxyResponse = item.requestSettings.proxyResponse || 'none';
        item.requestErrorPool = item.requestSettings.requestErrorPool || 'none';
        item.requestErrorTemplate = item.requestSettings.requestErrorTemplate || 'none';
        item.requestPool = item.requestSettings.requestPool || 'none';
        item.requestTemplate = item.requestSettings.requestTemplate || 'none';

        Object.keys(item.responseSettings).forEach((key) => {
            item[key] = item.responseSettings[key];
        });

        item.responseErrorPool = item.responseSettings.responseErrorPool || 'none';
        item.responseErrorTemplate = item.responseSettings.responseErrorTemplate || 'none';
        item.responsePool = item.responseSettings.responsePool || 'none';
        item.responseTemplate = item.responseSettings.responseTemplate || 'none';

        const config = normalize.actionableMcp(context, item, 'ltm profile request-log', util.mcpPath(tenantId, appId, itemId));
        configs.push(config);
        return { configs };
    },

    Rewrite_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.ignore = item.ignore || {};

        item.defaultsFrom = '/Common/rewrite';
        if (item.certificate) {
            const cert = item.certificate;
            item.certificate = cert ? `${cert}.crt` : 'none';
            item.javaSignKey = cert ? `${cert}.key` : 'none';
        } else {
            item.certificate = '/Common/default.crt';
            item.javaSignKey = '/Common/default.key';
        }

        if (item.javaSignKeyPassphrase) {
            const ignoreChanges = (item.javaSignKeyPassphrase.ignoreChanges === true);
            item.javaSignKeyPassphrase = secret(item, 'javaSignKeyPassphrase');
            if (ignoreChanges === true) {
                item.ignore.javaSignKeyPassphrase = item.javaSignKeyPassphrase;
            }
        }

        if (item.setCookieRules) {
            item.setCookieRules.forEach((rule, index) => {
                rule.name = index.toString();
            });
        }

        if (item.uriRules) {
            item.uriRules.forEach((rule, index) => {
                rule.name = index.toString();
            });
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm profile rewrite', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    HTTP_Acceleration_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];
        configs.push(normalize.actionableMcp(context, item, 'ltm profile web-acceleration', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    SSH_Proxy_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.ignore = { sshProfileAuthInfo: {} };
        (item.sshProfileAuthInfo || []).forEach((authItem) => {
            if (authItem.proxyServerAuth && authItem.proxyServerAuth.privateKey) {
                const ignoreChanges = authItem.proxyServerAuth.privateKey.ignoreChanges;
                authItem.proxyServerAuth.privateKey = secret(authItem.proxyServerAuth, 'privateKey');
                if (ignoreChanges === true) {
                    item.ignore.sshProfileAuthInfo[authItem.name] = {
                        'proxy-server-auth': {
                            'private-key': authItem.proxyServerAuth.privateKey
                        }
                    };
                }
            }
            if (authItem.proxyClientAuth && authItem.proxyClientAuth.privateKey) {
                const ignoreChanges = authItem.proxyClientAuth.privateKey.ignoreChanges;
                authItem.proxyClientAuth.privateKey = secret(authItem.proxyClientAuth, 'privateKey');
                if (ignoreChanges === true) {
                    item.ignore.sshProfileAuthInfo[authItem.name] = Object.assign(
                        item.ignore.sshProfileAuthInfo[authItem.name] || {},
                        {
                            'proxy-client-auth': {
                                'private-key': authItem.proxyClientAuth.privateKey
                            }
                        }
                    );
                }
            }
        });
        if (item.sshProfileRuleSet && item.sshProfileRuleSet[0]) {
            item.sshProfileRuleSet[0].sshProfileRuleActions = [item.sshProfileRuleSet[0].sshProfileRuleActions];
        }
        item.sshProfileDefaultActions = [item.sshProfileDefaultActions];
        configs.push(normalize.actionableMcp(context, item, 'security ssh profile', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    Stream_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.remark = item.remark || 'none';
        item.source = item.source || 'none';
        item.target = item.target || 'none';

        if (item.parentProfile.use) {
            item.parentProfile.use = !item.parentProfile.use.includes('/')
                ? `/${tenantId}/${appId}/${item.parentProfile.use}`
                : item.parentProfile.use;
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm profile stream', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    FTP_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.allowFtps = item.ftpsMode !== 'disallow';
        configs.push(normalize.actionableMcp(context, item, 'ltm profile ftp', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    TFTP_Profile(context, tenantId, appId, itemId, item) {
        return { configs: [normalize.actionableMcp(context, item, 'ltm profile tftp', util.mcpPath(tenantId, appId, itemId))] };
    },

    HTML_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.remark = item.remark || 'none';

        configs.push(normalize.actionableMcp(context, item, 'ltm profile html', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    ICAP_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.uri = item.uri || 'none';
        item.fromHeader = item.fromHeader || 'none';
        item.hostHeader = item.hostHeader || 'none';
        item.refererHeader = item.refererHeader || 'none';
        item.userAgentHeader = item.userAgentHeader || 'none';

        configs.push(normalize.actionableMcp(context, item, 'ltm profile icap', util.mcpPath(tenantId, appId, itemId)));

        return { configs };
    },

    Adapt_Profile(context, tenantId, appId, itemId, item) {
        const configs = [];

        item.internalService = item.internalService || 'none';

        if (item.messageType === 'request' || item.messageType === 'request-and-response') {
            const name = item.messageType === 'request-and-response' ? `${itemId}_request` : itemId;
            configs.push(normalize.actionableMcp(context, item, 'ltm profile request-adapt', util.mcpPath(tenantId, appId, name)));
        }
        if (item.messageType === 'response' || item.messageType === 'request-and-response') {
            const name = item.messageType === 'request-and-response' ? `${itemId}_response` : itemId;
            configs.push(normalize.actionableMcp(context, item, 'ltm profile response-adapt', util.mcpPath(tenantId, appId, name)));
        }

        return { configs };
    },

    Cipher_Rule(context, tenantId, appId, itemId, item) {
        const configs = [];

        if (item.cipherSuites) {
            item.cipher = item.cipherSuites.join(':');
        }

        if (item.namedGroups) {
            item.dhGroups = item.namedGroups.join(':');
        }

        if (item.signatureAlgorithms) {
            item.signatureAlgorithms = item.signatureAlgorithms.join(':');
        }

        configs.push(normalize.actionableMcp(context, item, 'ltm cipher rule', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    Cipher_Group(context, tenantId, appId, itemId, item) {
        const configs = [];
        item.remark = item.remark || '';
        configs.push(normalize.actionableMcp(context, item, 'ltm cipher group', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    },

    Idle_Timeout_Policy(context, tenantId, appId, itemId, item) {
        const configs = [];
        if (item.rules) {
            item.rules.forEach((rule) => {
                rule.timers = rule.idleTimeout !== undefined ? { 'flow-idle-timeout': { value: rule.idleTimeout.toString() } } : {};
                delete rule.idleTimeout;
                if (rule.remark) {
                    rule.description = rule.remark;
                    delete rule.remark;
                }
                if (rule.destinationPorts) {
                    rule.destinationPorts = rule.destinationPorts.map((port) => ({ name: (port === 'all-other') ? '0' : port }));
                }
            });
        }
        configs.push(normalize.actionableMcp(context, item, 'net timer-policy', util.mcpPath(tenantId, appId, itemId)));
        return { configs };
    }
};

module.exports = {
    translate
};

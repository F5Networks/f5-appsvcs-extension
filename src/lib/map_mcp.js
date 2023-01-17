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

const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;

const normalize = require('./normalize');
const util = require('./util/util');
const gtmUtil = require('./util/gtmUtil');
const log = require('./log');
const PolicyParser = require('./ltmPolicyParser');
const serviceDiscovery = require('./serviceDiscovery');
const constants = require('./constants');

const pushMonitors = function pushMonitors(obj) {
    if (obj.monitor !== undefined) {
        // yes, iControl really does return "/Common/none " by default
        if (obj.monitor !== '/Common/none ') {
            if (obj.monitor.includes('min') || obj.monitor === 'default') {
                obj.minimumMonitors = Number(obj.monitor.replace(/min ([0-9]) of .*/, '$1')) || 1;
            } else {
                obj.minimumMonitors = 'all';
            }
            obj.monitor = obj.monitor.replace(/.*{/, '').replace(/}/, '');
            obj.monitors = {};
            obj.monitor.split(' ').forEach((word) => {
                word = word.trim();
                if (word !== 'and' && word !== '{' && word !== '}' && word !== '') {
                    obj.monitors[word] = {};
                }
            });
        }
        delete obj.monitor;
    }
    return obj;
};

const pushReferences = function pushReferences(context, obj, referenceConfig, selfLink, kind,
    prop, subprop, deepSubProp) {
    try {
        referenceConfig.forEach((item) => {
            if (item.selfLink.includes(`${selfLink}/`)) {
                if (item.kind === kind) {
                    const newObj = normalize.actionableMcp(context, item, `${prop} ${deepSubProp || subprop}`).properties;
                    obj[subprop] = obj[subprop] || [];
                    obj[subprop].push(newObj);
                }
            }
        });
    } catch (err) {
        log.error({ message: 'malformed iControl reference', response: err });
    }
    return obj;
};

const processLtmPolicyObjects = function processLtmPolicyObjects(reference) {
    return ((reference || {}).items || [])
        .map((item, index) => ({
            name: `${index}`,
            policyString: PolicyParser.convertObjectToString(item)
        }));
};

const processGtmWideIps = function processGtmWideIps(context, obj, resourceRecordType) {
    obj.enabled = util.isEnabledObject(obj);
    delete obj.disabled;
    const poolList = [];
    const poolCnameList = [];
    let pool;

    (obj.aliases || []).forEach((alias, index) => {
        obj.aliases[index] = util.extractValueFromEscapedRestString(alias);
    });

    if (obj.pools) {
        obj.pools.forEach((p) => {
            poolList.push({ name: `/${p.partition}/${p.subPath}/${p.name}`, order: p.order, ratio: p.ratio });
        });
        obj.pools = poolList;
    }

    if (obj.poolsCname) {
        obj.poolsCname.forEach((p) => {
            pool = `/${p.partition}/${p.subPath}/${p.name}`;
            poolCnameList.push(pool);
        });
        obj.poolsCname = poolCnameList;
    }

    return [normalize.actionableMcp(context, obj, `gtm wideip ${resourceRecordType}`, util.mcpPath(obj.partition, obj.subPath, obj.name))];
};

const profile = function profile(context, obj, component, type) {
    obj.description = obj.description || 'none';

    if (obj.tmOptions) {
        obj.options = util.normalizeProfileOptions(obj.tmOptions);
    }

    const mcpPath = util.mcpPath(obj.partition, obj.subPath, obj.name);
    const config = normalize.actionableMcp(context, obj, component, mcpPath);
    config.command = (`${config.command} ${type}`).trim();
    return [config];
};

const profileSSL = function profileSSL(context, obj, component, type, preserveServerName) {
    obj['ca-file'] = obj['ca-file'] || 'none';
    obj['client-cert-ca'] = obj['client-cert-ca'] || 'none';
    obj['authenticate-name'] = obj['authenticate-name'] || 'none';
    if (!preserveServerName) {
        // not sure why this is the default mapping
        obj['server-name'] = obj['authenticate-name'] || 'none';
    } else {
        obj['server-name'] = obj['server-name'] || 'none';
    }

    return profile(context, obj, component, type);
};

const persist = function persist(context, obj, component, type) {
    // persistence duration is usually an integer but returns from iControl in quotes
    if (obj.timeout !== undefined && obj.timeout !== 'indefinite') {
        obj.timeout = parseInt(obj.timeout, 10);
    }
    return profile(context, obj, component, type);
};

const monitor = function monitor(context, obj, component, type) {
    obj.send = obj.send || 'none';
    obj.recv = obj.recv || 'none';
    obj['recv-disable'] = obj['recv-disable'] || 'none';
    return profile(context, obj, component, type);
};

const databaseMonitor = function (context, obj) {
    ['count', 'recvColumn', 'recvRow'].forEach((prop) => {
        if (typeof obj[prop] === 'string') {
            obj[prop] = parseInt(obj[prop], 10);
        }
    });
    ['database', 'password', 'recv', 'recvColumn', 'recvRow', 'send', 'username'].forEach((prop) => {
        obj[prop] = obj[prop] || 'none';
    });
};

const externalMonitor = function externalMonitor(context, obj) {
    obj.args = obj.args || 'none';
    obj['user-defined'] = {};
    Object.keys(obj.apiRawValues || {}).forEach((key) => {
        const value = normalize.quoteString(obj.apiRawValues[key]);
        const cleanedKey = key.replace(/^userDefined /, '');
        obj['user-defined'][cleanedKey] = value;
    });
};

const gslbPool = function gslbPool(context, obj, referenceConfig, type) {
    const path = util.mcpPath(obj.partition, obj.subPath, obj.name).replace(/\//g, '~');
    pushReferences(
        context,
        obj,
        referenceConfig,
        `/mgmt/tm/gtm/pool/${type}/${path}`,
        `tm:gtm:pool:${type}:members:membersstate`,
        'gtm pool',
        'members'
    );
    (obj.members || []).forEach((member) => {
        if (type !== 'cname' && member.name[0] !== '/') {
            member.name = `/Common/${member.name}`;
        }
        member.enabled = util.isEnabledObject(member);
        delete member.disabled;
    });
    obj.enabled = util.isEnabledObject(obj);
    delete obj.disabled;
    const config = normalize.actionableMcp(context, obj, 'gtm pool', obj.fullPath);
    config.command = `gtm pool ${type}`;
    Object.keys(config.properties.members || {}).forEach((member) => {
        // Since the GSLB Pool members all share the same properties.json we need to remove
        // empty depends-on values that will populate in MX and CNAME pool members.
        const memberBody = config.properties.members[member];
        if (memberBody['depends-on'] && Object.keys(memberBody['depends-on']).length === 0) {
            if (type === 'a' || type === 'aaaa') {
                memberBody['depends-on'] = 'none';
            } else {
                delete memberBody['depends-on'];
            }
        }
    });

    return [config];
};

const translate = {
    'tm:auth:partition:partitionstate': function (context, obj) {
        if (obj.fullPath === 'Common') return [];
        return [normalize.actionableMcp(context, obj, 'auth partition', `/${obj.fullPath}/`)];
    },
    'tm:sys:crypto:cert-validator:ocsp:ocspstate': function (context, obj) {
        obj.signingCertificate = obj.signerCert || 'none';
        obj.signingPrivateKey = obj.signerKey || 'none';
        obj.signingPassphrase = obj.signerKeyPassphrase || 'none';
        return [normalize.actionableMcp(context, obj, 'sys crypto cert-validator ocsp', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:alg-log-profile:alg-log-profilestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm alg-log-profile', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:comment-raise-event:comment-raise-eventstate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule comment-raise-event', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:comment-remove:comment-removestate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule comment-remove', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:tag-append-html:tag-append-htmlstate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule tag-append-html', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:tag-prepend-html:tag-prepend-htmlstate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule tag-prepend-html', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:tag-raise-event:tag-raise-eventstate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule tag-raise-event', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:tag-remove:tag-removestate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule tag-remove', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:html-rule:tag-remove-attribute:tag-remove-attributestate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm html-rule tag-remove-attribute', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:sys:file:data-group:data-groupstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys file data-group', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:data-group:external:externalstate': function (context, obj) {
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm data-group external', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:data-group:internal:internalstate': function (context, obj) {
        obj.description = obj.description || 'none';
        //  iControl returns different record structure from tmsh
        obj.records = (obj.records || []).map((record) => ({
            name: record.name,
            data: record.data && record.data !== '' ? `"${record.data}"` : undefined
        }));
        return [normalize.actionableMcp(context, obj, 'ltm data-group internal', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:dns:cache:transparent:transparentstate': function (context, obj) {
        if (obj.localZones) {
            obj.localZones = obj.localZones.reduce((acc, curVal) => {
                const name = curVal.tmName;
                acc[name] = curVal;
                delete acc[name].tmName;
                return acc;
            }, {});
        }
        obj.localZones = obj.localZones || 'none';
        return [normalize.actionableMcp(context, obj, 'ltm dns cache transparent', obj.fullPath)];
    },
    'tm:ltm:dns:nameserver:nameserverstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm dns nameserver', obj.fullPath)];
    },
    'tm:ltm:profile:dns-logging:dns-loggingstate': function (context, obj) {
        return profile(context, obj, 'ltm profile dns-logging', '');
    },
    'tm:ltm:dns:tsig-key:tsig-keystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm dns tsig-key', obj.fullPath)];
    },
    'tm:ltm:dns:zone:zonestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm dns zone', obj.fullPath)];
    },
    'tm:ltm:monitor:dns:dnsstate': function (context, obj) {
        obj.recv = obj.recv || 'none';
        return profile(context, obj, 'ltm monitor', 'dns');
    },
    'tm:ltm:monitor:external:externalstate': function (context, obj) {
        externalMonitor(context, obj);
        return profile(context, obj, 'ltm monitor', 'external');
    },
    'tm:ltm:monitor:ftp:ftpstate': function (context, obj) {
        obj.username = obj.username || 'none';
        obj.filename = obj.filename || 'none';
        return profile(context, obj, 'ltm monitor', 'ftp');
    },
    'tm:ltm:monitor:http:httpstate': function (context, obj) {
        obj.username = obj.username || 'none';
        return monitor(context, obj, 'ltm monitor', 'http');
    },
    'tm:ltm:monitor:https:httpsstate': function (context, obj) {
        obj.username = obj.username || 'none';
        obj.cert = obj.cert || 'none';
        obj.key = obj.key || 'none';
        obj.clientTLS = obj.sslProfile || 'none';
        return monitor(context, obj, 'ltm monitor', 'https');
    },
    'tm:ltm:monitor:http2:http2state': function (context, obj) {
        obj.username = obj.username || 'none';
        obj.clientTLS = obj.sslProfile || 'none';
        return monitor(context, obj, 'ltm monitor', 'http2');
    },
    'tm:ltm:monitor:gateway-icmp:gateway-icmpstate': function (context, obj) { return profile(context, obj, 'ltm monitor', 'gateway-icmp'); },
    'tm:ltm:monitor:inband:inbandstate': function (context, obj) {
        return profile(context, obj, 'ltm monitor', 'inband');
    },
    'tm:ltm:monitor:ldap:ldapstate': function (context, obj) {
        obj.base = obj.base || 'none';
        obj.username = obj.username || 'none';
        obj.password = obj.password || 'none';
        obj.security = obj.security || 'none';
        obj['filter-ldap'] = obj.filter || 'none';
        delete obj.filter;
        return profile(context, obj, 'ltm monitor', 'ldap');
    },
    'tm:ltm:monitor:mysql:mysqlstate': function (context, obj) {
        databaseMonitor(context, obj);
        return profile(context, obj, 'ltm monitor', 'mysql');
    },
    'tm:ltm:monitor:postgresql:postgresqlstate': function (context, obj) {
        databaseMonitor(context, obj);
        return profile(context, obj, 'ltm monitor', 'postgresql');
    },
    'tm:ltm:monitor:radius:radiusstate': function (context, obj) {
        return profile(context, obj, 'ltm monitor', 'radius');
    },
    'tm:ltm:monitor:sip:sipstate': function (context, obj) {
        // iControl does not return these properties when their values are default
        if (obj.headers === undefined) {
            obj.headers = 'none';
        } else {
            obj.headers = obj.headers.replace(/\\"/g, '"');
        }
        if (obj.request === undefined) obj.request = 'none';
        obj.cert = obj.cert || 'none';
        obj.key = obj.key || 'none';
        obj.filter = obj.filter || 'none';
        obj['filter-neg'] = obj['filter-neg'] || 'none';
        // filter from mcp will get mapped into filter for sip and filter-ldap for ldap
        // delete filter-ldap for sip
        const profileSip = profile(context, obj, 'ltm monitor', 'sip');
        delete profileSip[0].properties['filter-ldap'];
        return profileSip;
    },
    'tm:ltm:monitor:smtp:smtpstate': function (context, obj) { return profile(context, obj, 'ltm monitor', 'smtp'); },
    'tm:ltm:monitor:tcp:tcpstate': function (context, obj) { return monitor(context, obj, 'ltm monitor', 'tcp'); },
    'tm:ltm:monitor:tcp-half-open:tcp-half-openstate': function (context, obj) { return profile(context, obj, 'ltm monitor', 'tcp-half-open'); },
    'tm:ltm:monitor:udp:udpstate': function (context, obj) { return monitor(context, obj, 'ltm monitor', 'udp'); },
    'tm:ltm:node:nodestate': function (context, obj) {
        if (obj.ephemeral === 'true') return [];
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushMonitors(obj);
        // iControl returns fqdn properties for non-fqdn nodes
        if (obj.fqdn !== undefined && obj.fqdn.tmName === undefined) {
            delete obj.fqdn;
        } else {
            delete obj.address;
        }
        return [normalize.actionableMcp(context, obj, 'ltm node', path)];
    },
    'tm:ltm:persistence:cookie:cookiestate': function (context, obj) {
        // some properties are superfluously returned by iControl
        if (obj.method !== 'hash') {
            if (typeof obj.hashLength !== 'undefined') delete obj.hashLength;
            if (typeof obj.hashOffset !== 'undefined') delete obj.hashOffset;
        }
        if (obj.method !== 'insert') {
            if (typeof obj.httponly !== 'undefined') delete obj.httponly;
            if (typeof obj.secure !== 'undefined') delete obj.secure;
            if (typeof obj.alwaysSend !== 'undefined') delete obj.alwaysSend;
            if (typeof obj.cookieEncryption !== 'undefined') delete obj.cookieEncryption;
            if (typeof obj.cookieEncryptionPassphrase !== 'undefined') delete obj.cookieEncryptionPassphrase;
        }
        obj['cookie-name'] = obj['cookie-name'] || 'none';
        return persist(context, obj, 'ltm persistence', 'cookie');
    },
    'tm:ltm:persistence:dest-addr:dest-addrstate': function (context, obj) { return persist(context, obj, 'ltm persistence', 'dest-addr'); },
    'tm:ltm:persistence:source-addr:source-addrstate': function (context, obj) { return persist(context, obj, 'ltm persistence', 'source-addr'); },
    'tm:ltm:persistence:hash:hashstate': function (context, obj) {
        obj.rule = obj.rule || 'none';
        // icontrol returns extra backslash escapes for saved mcp values for these
        // get the "actual", unescaped value before passing to normalize, which performs escape
        obj.hashStartPattern = util.extractValueFromEscapedRestString(obj.hashStartPattern);
        obj.hashEndPattern = util.extractValueFromEscapedRestString(obj.hashEndPattern);
        return persist(context, obj, 'ltm persistence', 'hash');
    },
    'tm:ltm:persistence:msrdp:msrdpstate': function (context, obj) { return persist(context, obj, 'ltm persistence', 'msrdp'); },
    'tm:ltm:persistence:sip:sipstate': function (context, obj) { return persist(context, obj, 'ltm persistence', 'sip'); },
    'tm:ltm:persistence:ssl:sslstate': function (context, obj) { return persist(context, obj, 'ltm persistence', 'ssl'); },
    'tm:ltm:persistence:universal:universalstate': function (context, obj) { return persist(context, obj, 'ltm persistence', 'universal'); },
    'tm:ltm:profile:client-ldap:client-ldapstate': function (context, obj) {
        return profile(context, obj, 'ltm profile client-ldap', '');
    },
    'tm:ltm:profile:client-ssl:client-sslstate': function (context, obj) {
        Object.keys(obj.certKeyChain).forEach((setKey) => {
            obj.certKeyChain[setKey].chain = obj.certKeyChain[setKey].chain || 'none';
        });
        obj.crlFile = obj.crlFile || 'none';

        if (util.versionLessThan(context.target.tmosVersion, '14.0')) {
            obj.proxyCaCert = obj.proxyCaCert || 'none';
            obj.proxyCaKey = obj.proxyCaKey || 'none';
            obj.proxyCaPassphrase = obj.proxyCaPassphrase || 'none';
        } else {
            delete obj.proxyCaCert;
            delete obj.proxyCaKey;
            delete obj.proxyCaPassphrase;
        }

        if (obj.data_0rtt) {
            obj['data-0rtt'] = obj.data_0rtt;
            delete obj.data_0rtt;
        }

        if (obj.renegotiateMaxRecordDelay) {
            obj.renegotiateMaxRecordDelay = (obj.renegotiateMaxRecordDelay === 'indefinite') ? 4294967295 : parseInt(obj.renegotiateMaxRecordDelay, 10);
        }
        if (obj.renegotiatePeriod) {
            obj.renegotiatePeriod = (obj.renegotiatePeriod === 'indefinite') ? 4294967295 : parseInt(obj.renegotiatePeriod, 10);
        }
        if (obj.renegotiateSize) {
            obj.renegotiateSize = (obj.renegotiateSize === 'indefinite') ? 4294967295 : parseInt(obj.renegotiateSize, 10);
        }

        return profileSSL(context, obj, 'ltm profile client-ssl', '', true);
    },
    'tm:ltm:profile:dns:dnsstate': function (context, obj) {
        if (obj.dns64Prefix === 'any6') {
            obj.dns64Prefix = '0:0:0:0:0:0:0:0';
        }

        return [normalize.actionableMcp(context, obj, 'ltm profile dns', obj.fullPath)];
    },
    'tm:ltm:profile:fix:fixstate': function (context, obj) {
        if (Array.isArray(obj.senderTagClass) && obj.senderTagClass.length > 0) {
            const newSenderTag = {};
            obj.senderTagClass.forEach((senderTag) => {
                newSenderTag[senderTag.senderId] = {
                    'sender-id': senderTag.senderId,
                    'tag-map-class': senderTag.tagMapClass
                };
            });

            obj.senderTagClass = newSenderTag;
        } else {
            obj.senderTagClass = 'none';
        }
        obj.messageLogPublisher = obj.messageLogPublisher || 'none';
        obj.reportLogPublisher = obj.reportLogPublisher || 'none';

        return profile(context, obj, 'ltm profile fix', '');
    },
    'tm:ltm:profile:ftp:ftpstate': function (context, obj) {
        return profile(context, obj, 'ltm profile ftp', '');
    },
    'tm:ltm:profile:rtsp:rtspstate': function (context, obj) {
        return profile(context, obj, 'ltm profile rtsp', '');
    },
    'tm:ltm:profile:statistics:statisticsstate': function (context, obj) {
        return profile(context, obj, 'ltm profile statistics', '');
    },
    'tm:ltm:profile:tftp:tftpstate': function (context, obj) {
        return profile(context, obj, 'ltm profile tftp', '');
    },
    'tm:ltm:profile:websocket:websocketstate': function (context, obj) {
        return profile(context, obj, 'ltm profile websocket', '');
    },
    'tm:ltm:profile:http-proxy-connect:http-proxy-connectstate': function (context, obj) {
        return profile(context, obj, 'ltm profile http-proxy-connect', '');
    },
    'tm:ltm:profile:html:htmlstate': function (context, obj) {
        return profile(context, obj, 'ltm profile html', '');
    },
    'tm:ltm:profile:http:httpstate': function (context, obj) {
        if (obj.proxyType === 'explicit') {
            obj.explicitProxy.hostNames = obj.explicitProxy.hostNames || [];
        } else {
            delete obj.explicitProxy;
        }

        if (obj.proxyType !== 'transparent') {
            delete obj.enforcement.excessClientHeaders;
            delete obj.enforcement.excessServerHeaders;
            delete obj.enforcement.oversizeClientHeaders;
            delete obj.enforcement.oversizeServerHeaders;
        }

        if (typeof obj.headerInsert !== 'undefined') {
            obj.headerInsert = obj.headerInsert
                .replace(/\\\{/g, '{')
                .replace(/\\\}/g, '}')
                .replace(/\\\\/g, '\\')
                .replace(/\\\?/g, '?')
                .replace(/\\"/g, '"');
        }
        return profile(context, obj, 'ltm profile http', '');
    },
    'tm:ltm:profile:http2:http2state': function (context, obj) {
        return profile(context, obj, 'ltm profile http2', '');
    },
    'tm:ltm:profile:http-compression:http-compressionstate': function (context, obj) {
        // handle 1-off underscore character from iControl
        obj['allow-http-10'] = obj.allowHttp_10;
        // convert numbers to tmsh kilobyte syntax
        obj.gzipMemoryLevel /= 1024;
        obj.gzipWindowSize /= 1024;
        obj.contentTypeExclude = !obj.contentTypeExclude || obj.contentTypeExclude.length === 0
            ? '' : `"${obj.contentTypeExclude.join('" "').replace(/ \| /g, '|')}"`;
        obj.contentTypeInclude = !obj.contentTypeInclude || obj.contentTypeInclude.length === 0
            ? '' : `"${obj.contentTypeInclude.join('" "').replace(/ \| /g, '|')}"`;
        obj.uriExclude = !obj.uriExclude || obj.uriExclude.length === 0
            ? '' : `"${obj.uriExclude.join('" "').replace(/ \| /g, '|')}"`;
        obj.uriInclude = !obj.uriInclude || obj.uriInclude.length === 0
            ? '' : `"${obj.uriInclude.join('" "').replace(/ \| /g, '|')}"`;
        return profile(context, obj, 'ltm profile http-compression', '');
    },
    'tm:ltm:profile:web-acceleration:web-accelerationstate': function (context, obj) {
        return profile(context, obj, 'ltm profile web-acceleration', '');
    },
    'tm:ltm:profile:one-connect:one-connectstate': function (context, obj) {
        if (obj.idleTimeoutOverride === 'disabled') {
            obj.idleTimeoutOverride = 0;
        } else if (obj.idleTimeoutOverride === 'indefinite') {
            obj.idleTimeoutOverride = 4294967295;
        } else {
            obj.idleTimeoutOverride = parseInt(obj.idleTimeoutOverride, 10);
        }
        return profile(context, obj, 'ltm profile one-connect', '');
    },
    'tm:ltm:profile:server-ldap:server-ldapstate': function (context, obj) {
        return profile(context, obj, 'ltm profile server-ldap', '');
    },
    'tm:ltm:profile:server-ssl:server-sslstate': function (context, obj) {
        obj.chain = obj.chain || 'none';
        obj.crlFile = obj.crlFile || 'none';

        if (obj.data_0rtt) {
            obj['data-0rtt'] = obj.data_0rtt;
            delete obj.data_0rtt;
        }

        if (obj.renegotiatePeriod) {
            obj.renegotiatePeriod = (obj.renegotiatePeriod === 'indefinite') ? 4294967295 : parseInt(obj.renegotiatePeriod, 10);
        }
        if (obj.renegotiateSize) {
            obj.renegotiateSize = (obj.renegotiateSize === 'indefinite') ? 4294967295 : parseInt(obj.renegotiateSize, 10);
        }

        const config = profileSSL(context, obj, 'ltm profile server-ssl', '');
        // undo collision: serverName mapped to tmsh authenticate-name while
        // sendSNI is mapped to server-name
        config[0].properties['authenticate-name'] = obj.authenticateName || 'none';
        return config;
    },
    'tm:ltm:profile:smtps:smtpsstate': function (context, obj) {
        return profile(context, obj, 'ltm profile smtps', '');
    },
    'tm:ltm:profile:stream:streamstate': function (context, obj) {
        obj.target = obj.tmTarget || 'none';
        obj.source = obj.source || 'none';
        delete obj.tmTarget;
        return profile(context, obj, 'ltm profile stream', '');
    },
    'tm:ltm:profile:tcp:tcpstate': function (context, obj) {
        obj.tcpOptions = obj.tcpOptions || 'none';
        // handle 1-off underscore character from iControl
        obj['fin-wait-2-timeout'] = obj.finWait_2Timeout;
        return profile(context, obj, 'ltm profile tcp', '');
    },
    'tm:ltm:profile:udp:udpstate': function (context, obj) { return profile(context, obj, 'ltm profile udp', ''); },
    'tm:ltm:profile:sctp:sctpstate': function (context, obj) { return profile(context, obj, 'ltm profile sctp', ''); },
    'tm:ltm:profile:ipother:ipotherstate': function (context, obj) { return profile(context, obj, 'ltm profile ipother', ''); },
    'tm:ltm:profile:radius:radiusstate': function (context, obj) { return profile(context, obj, 'ltm profile radius', ''); },
    'tm:ltm:profile:classification:classificationstate': function (context, obj) { return profile(context, obj, 'ltm profile classification', ''); },
    'tm:ltm:profile:fastl4:fastl4state': function (context, obj) {
        if (obj.keepAliveInterval === 'disabled') {
            obj.keepAliveInterval = '0';
        }
        if (typeof obj.keepAliveInterval !== 'undefined') {
            obj.keepAliveInterval = parseInt(obj.keepAliveInterval, 10);
        }
        return profile(context, obj, 'ltm profile fastl4', '');
    },
    'tm:ltm:profile:analytics:analyticsstate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        const selfLink = `/mgmt/tm/ltm/profile/analytics/${path.replace(/\//g, '~')}`;
        if (referenceConfig[0].userAgentSubstrings && referenceConfig[0].userAgentSubstrings.length !== 0) {
            referenceConfig[0].userAgentSubstrings = `"${referenceConfig[0].userAgentSubstrings.join('" "')}"`;
        }
        obj.notifyEmailAddresses = !obj.notifyEmailAddresses || obj.notifyEmailAddresses.length === 0
            ? '' : `"${obj.notifyEmailAddresses.join('" "')}"`;
        obj.countriesForStatCollection = !obj.countriesForStatCollection || obj.countriesForStatCollection.length === 0
            ? undefined : `"${obj.countriesForStatCollection.join('" "')}"`;
        obj.subnetsForStatCollection = !obj.subnetsForStatCollection || obj.subnetsForStatCollection.length === 0
            ? undefined : `"${obj.subnetsForStatCollection.join('" "')}"`;
        obj.urlsForStatCollection = !obj.urlsForStatCollection || obj.urlsForStatCollection.length === 0
            ? undefined : `"${obj.urlsForStatCollection.join('" "')}"`;
        const config = profile(context, obj, 'ltm profile analytics', '');
        if (config[0].properties['collect-geo'] === 'disabled') {
            delete config[0].properties['countries-for-stat-collection'];
        }
        if (config[0].properties['collect-subnets'] === 'disabled') {
            delete config[0].properties['subnets-for-stat-collection'];
        }
        if (config[0].properties['collect-url'] === 'disabled') {
            delete config[0].properties['urls-for-stat-collection'];
        }

        // merge capture-filter reference
        config[0] = pushReferences(
            context,
            config[0],
            referenceConfig,
            selfLink,
            'tm:ltm:profile:analytics:traffic-capture:traffic-capturestate',
            'ltm profile analytics traffic-capture',
            'traffic-capture',
            'capture-for-f5-appsvcs'
        );
        config[0].properties['traffic-capture'] = {};
        if (config[0]['traffic-capture']) {
            config[0].properties['traffic-capture']['capture-for-f5-appsvcs'] = config[0]['traffic-capture'][0];
        }

        return config;
    },
    'tm:ltm:profile:tcp-analytics:tcp-analyticsstate': function (context, obj) {
        const config = profile(context, obj, 'ltm profile tcp-analytics', '');
        return config;
    },
    'tm:ltm:profile:request-log:request-logstate': function (context, obj) {
        const configs = profile(context, obj, 'ltm profile request-log', '');
        configs.forEach((config) => {
            const templateNames = [
                'request-log-template',
                'request-log-error-template',
                'response-log-template',
                'response-log-error-template'
            ];
            templateNames.forEach((templateName) => {
                config.properties[templateName] = util.unescapeDoubleSlashQuote(config.properties[templateName]);
            });
        });
        return configs;
    },
    'tm:ltm:profile:rewrite:rewritestate': function (context, obj, referenceConfig) {
        const uriRulePath = util.mcpPath(obj.partition, obj.subPath, obj.name).replace(/\//g, '~');
        delete obj.uriRulesReference;
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/ltm/profile/rewrite/${uriRulePath}/uri-rules`,
            'tm:ltm:profile:rewrite:uri-rules:uri-rulesstate',
            'ltm profile rewrite',
            'uri-rules'
        );
        const config = profile(context, obj, 'ltm profile rewrite', '');
        return config;
    },
    'tm:ltm:profile:icap:icapstate': function (context, obj) {
        obj.uri = obj.uri || 'none';
        obj['header-from'] = obj['header-from'] || 'none';
        obj.host = obj.host || 'none';
        obj.referer = obj.referer || 'none';
        obj['user-agent'] = obj['user-agent'] || 'none';
        const config = profile(context, obj, 'ltm profile icap', '');
        return config;
    },
    'tm:ltm:profile:request-adapt:request-adaptstate': function (context, obj) {
        obj['allow-http-10'] = obj.allowHttp_10;
        obj['internal-virtual'] = obj.internalVirtual || 'none';
        return profile(context, obj, 'ltm profile request-adapt', '');
    },
    'tm:ltm:profile:response-adapt:response-adaptstate': function (context, obj) {
        obj['allow-http-10'] = obj.allowHttp_10;
        obj['internal-virtual'] = obj.internalVirtual || 'none';
        return profile(context, obj, 'ltm profile response-adapt', '');
    },
    'tm:ltm:policy:policystate': function (context, obj) {
        if (typeof obj.requires !== 'undefined') delete obj.requires;
        obj.rules = (obj.rulesReference || {}).items || [];
        obj.rules.forEach((rule) => {
            // BIG-IP<v14.0 mcp will return code === 0 but tmsh will not accept code (AT-1504)
            if (rule.actionsReference) {
                (rule.actionsReference.items || []).forEach((item) => {
                    if (item.httpReply && item.redirect && item.code === 0) {
                        delete item.code;
                    }
                });
            }

            rule.conditions = processLtmPolicyObjects(rule.conditionsReference);
            rule.actions = processLtmPolicyObjects(rule.actionsReference);
        });
        const config = [normalize.actionableMcp(context, obj, 'ltm policy', util.mcpPath(obj.partition, obj.subPath, obj.name))];
        return config;
    },
    'tm:ltm:policy-strategy:policy-strategystate': function (context, obj) {
        obj.operands = processLtmPolicyObjects(obj.operandsReference);
        const config = [normalize.actionableMcp(context, obj, 'ltm policy-strategy', util.mcpPath(obj.partition, obj.subPath, obj.name))];
        return config;
    },
    'tm:ltm:pool:poolstate': function (context, obj) {
        const members = [];
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        const isEphemeral = {};
        obj = pushMonitors(obj);
        obj.members = (obj.membersReference || {}).items || [];
        obj.members.forEach((member) => {
            isEphemeral[member.fullPath] = member.ephemeral === 'true';
        });
        if ((typeof obj.members === 'object') && (obj.members !== null)) {
            Object.keys(obj.members).forEach((member) => {
                if (!isEphemeral[obj.members[member].name]) {
                    obj.members[member] = pushMonitors(obj.members[member]);
                    obj.members[member].session = obj.members[member].session.replace('monitor', 'user');
                    if (obj.members[member].state !== 'user-down') {
                        obj.members[member].state = 'user-up';
                    }

                    if (obj.members[member].rateLimit !== undefined && obj.members[member].rateLimit !== 'disabled') {
                        obj.members[member].rateLimit = parseInt(obj.members[member].rateLimit, 10);
                    }
                    members.push(obj.members[member]);
                }
            });
        }
        obj.members = members;
        return [normalize.actionableMcp(context, obj, 'ltm pool', path)];
    },
    'tm:ltm:rule:rulestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm rule', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:cipher:rule:rulestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm cipher rule', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:security:dos:profile:profilestate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        const selfLink = `/mgmt/tm/security/dos/profile/${path.replace(/\//g, '~')}`;
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:dos:profile:application:applicationstate',
            'security dos profile',
            'application'
        );
        const application = (obj.application) ? obj.application[0] : obj.application;
        if (application) {
            const captcha = obj.application[0]['captcha-response'];
            if (captcha.first.type === 'default') {
                delete captcha.first.body;
            } else {
                // Pre-undo part of the normalize "quotedString" operation
                captcha.first.body = captcha.first.body
                    .replace(/\\\\\x0d/g, '\r')
                    .replace(/\\\\\x0a/g, '\n')
                    .replace(/\\\\\x09/g, '\t')
                    .replace(/\\\\\x0c/g, '\f')
                    .replace(/\\\\\x08/g, '\b')
                    .replace(/\\\\\x5c/g, '\\')
                    .replace(/\\\\\x22/g, '\\"')
                    .replace(/\\\\\x3f/g, '?');
            }
            if (captcha.failure.type === 'default') {
                delete captcha.failure.body;
            } else {
                // Pre-undo part of the normalize "quotedString" operation
                captcha.failure.body = captcha.failure.body
                    .replace(/\\\\\x0d/g, '\r')
                    .replace(/\\\\\x0a/g, '\n')
                    .replace(/\\\\\x09/g, '\t')
                    .replace(/\\\\\x0c/g, '\f')
                    .replace(/\\\\\x08/g, '\b')
                    .replace(/\\\\\x5c/g, '\\')
                    .replace(/\\\\\x22/g, '\\"')
                    .replace(/\\\\\x3f/g, '?');
            }
            if (application.geolocations) {
                const geolocations = [];
                Object.keys(application.geolocations).forEach((key) => {
                    if (application.geolocations[key]['black-listed']) {
                        geolocations.push({ name: JSON.stringify(key), blackListed: true });
                    } else {
                        geolocations.push({ name: JSON.stringify(key), whiteListed: true });
                    }
                });
                application.geolocations = geolocations;
            }
            if (application['bot-signatures'] && application['bot-signatures'].categories) {
                const categories = application['bot-signatures'].categories;
                application['bot-signatures'].categories = Object.keys(categories).reduce((newCat, key) => {
                    const c = categories[key];
                    let name = util.mcpPath(c.partition, c['sub-path'], key);
                    name = name.includes(' ') ? `"${name}"` : name;
                    newCat[name] = { action: c.action };
                    return newCat;
                }, {});
            }
            if (application['mobile-detection'] && application['mobile-detection']['android-publishers']) {
                const publishers = application['mobile-detection']['android-publishers'];
                application['mobile-detection']['android-publishers'] = Object.keys(publishers)
                    .reduce((newCat, key) => {
                        const c = publishers[key];
                        let name = util.mcpPath(c.partition, c['sub-path'] || c.subPath, key);
                        name = name.includes(' ') ? `"${name}"` : name;
                        newCat[name] = {};
                        return newCat;
                    }, {});
            }
            pushReferences(
                context,
                application,
                referenceConfig,
                selfLink,
                'tm:ltm:profile:fastl4:fastl4-state',
                'ltm profile fastl4',
                'fastl4-acceleration-profile'
            );
        }
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:dos:profile:dos-network:dos-networkstate',
            'security dos profile',
            'dos-network'
        );
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:dos:profile:protocol-dns:protocol-dnsstate',
            'security dos profile',
            'protocol-dns'
        );
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:dos:profile:protocol-sip:protocol-sipstate',
            'security dos profile',
            'protocol-sip'
        );

        return [normalize.actionableMcp(context, obj, 'security dos profile', path)];
    },
    'tm:security:ssh:profile:profilestate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name).replace(/\//g, '~');
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/ssh/profile/${path}`,
            'tm:security:ssh:profile:rules:rulesstate',
            'security ssh profile',
            'rules'
        );
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/ssh/profile/${path}`,
            'tm:security:ssh:profile:auth-info:auth-infostate',
            'security ssh profile',
            'auth-info'
        );
        return [normalize.actionableMcp(context, obj, 'security ssh profile', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:security:bot-defense:profile:profilestate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        const selfLink = `/mgmt/tm/security/bot-defense/profile/${path.replace(/\//g, '~')}`;
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:bot-defense:profile:external-domains:external-domainsstate',
            'security bot-defense profile',
            'external-domains'
        );
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:bot-defense:profile:signature-category-overrides:signature-category-overridesstate',
            'security bot-defense profile',
            'signature-category-overrides'
        );
        if (obj['signature-category-overrides']) {
            obj['signature-category-overrides'].forEach((category) => {
                category.name = util.mcpPath(category.partition, category['sub-path'], category.name);
                delete category.partition;
                category.name = category.name.includes(' ') ? `"${category.name}"` : category.name;
            });
        }
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:bot-defense:profile:signature-overrides:signature-overridesstate',
            'security bot-defense profile',
            'signature-overrides'
        );
        if (obj['signature-overrides']) {
            obj['signature-overrides'].forEach((signature) => {
                signature.name = util.mcpPath(signature.partition, signature['sub-path'], signature.name);
                delete signature.partition;
                signature.name = signature.name.includes(' ') ? `"${signature.name}"` : signature.name;
            });
        }
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:bot-defense:profile:site-domains:site-domainsstate',
            'security bot-defense profile',
            'site-domains'
        );
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:bot-defense:profile:whitelist:whiteliststate',
            'security bot-defense profile',
            'whitelist'
        );
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            selfLink,
            'tm:security:bot-defense:profile:class-overrides:class-overridesstate',
            'security bot-defense profile',
            'class-overrides'
        );
        if (obj['class-overrides']) {
            obj['class-overrides'].forEach((cl) => {
                cl.name = cl.name.includes(' ') ? `"${cl.name}"` : cl.name;
            });
        }
        if (obj.mobileDetection && obj.mobileDetection.androidPublishers) {
            const publishers = obj.mobileDetection.androidPublishers;
            obj.mobileDetection.androidPublishers = Object.keys(publishers)
                .reduce((newCat, key) => {
                    const c = publishers[key];
                    let name = util.mcpPath(c.partition, c['sub-path'] || c.subPath, c.name);
                    name = name.includes(' ') ? `"${name}"` : name;
                    newCat[name] = {};
                    return newCat;
                }, {});
        }

        return [normalize.actionableMcp(context, obj, 'security bot-defense profile', path)];
    },
    'tm:ltm:snatpool:snatpoolstate': function (context, obj) {
        obj = util.arrToObj(obj, 'members');
        return [normalize.actionableMcp(context, obj, 'ltm snatpool', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:snat-translation:snat-translationstate': function (context, obj) {
        if (obj.enabled === true) {
            obj.enabled = {};
        }
        if (obj.disabled === true) {
            obj.disabled = {};
        }
        if (obj.inheritedTrafficGroup === 'true') {
            obj.trafficGroup = 'default';
        }
        obj.address = ipUtil.minimizeIP(obj.address);
        return [normalize.actionableMcp(context, obj, 'ltm snat-translation', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:ltm:virtual:virtualstate': function (context, obj) {
        obj.enabled = util.isEnabledObject(obj);
        delete obj.disabled;
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);

        obj.profiles = (obj.profilesReference || {}).items || [];
        obj.policies = (obj.policiesReference || {}).items || [];

        if (obj.destination.includes('0.0.0.0')) {
            obj.destination = obj.destination.replace('0.0.0.0', 'any');
        }

        if (obj.internal === true) {
            obj.internal = {};
            obj.destination = '0.0.0.0:any';
        }

        if (obj.stateless === true) {
            obj.stateless = {};
        }

        obj['last-hop-pool'] = obj['last-hop-pool'] || 'none';
        if (obj.persist) {
            obj.persist.forEach((p) => {
                p.name = util.mcpPath(p.partition, p.subPath, p.name);
            });
        }

        if (!obj.vlans) {
            obj.vlans = [];
        }
        ['vlansDisabled', 'vlansEnabled', 'ipForward', 'l2Forward'].forEach((key) => {
            if (obj[key] === true) {
                obj[key] = ' ';
            }
        });

        // remove nat policy information if it is empty
        if (obj.securityNatPolicy && !obj.securityNatPolicy.policy) {
            delete obj.securityNatPolicy;
        }

        // remove auto-generated WAF and ASM profiles before diff
        const profiles = obj.profiles;
        obj.profiles = [];
        profiles.forEach((profile1) => {
            if (!profile1.name.includes('/Common/WAF_') && !profile1.name.includes('/Common/ASM_')
                && !profile1.name.split('/').pop().startsWith('ASM_')) {
                obj.profiles.push(profile1);
            }
        });

        if (obj.clonePools) {
            obj.clonePools.forEach((p) => {
                p.name = util.mcpPath(p.partition, p.subPath, p.name);
            });
        }

        if (obj.rateLimit !== undefined && obj.rateLimit !== 'disabled') {
            obj.rateLimit = parseInt(obj.rateLimit, 10);
        }

        return [normalize.actionableMcp(context, obj, 'ltm virtual', path)];
    },
    'tm:ltm:virtual-address:virtual-addressstate': function (context, obj) {
        const path = obj.fullPath.split('/');
        path[path.length - 1] = `Service_Address-${path[path.length - 1]}`;
        if (obj.inheritedTrafficGroup === 'true') {
            obj.trafficGroup = 'default';
        }

        obj.address = ipUtil.minimizeIP(obj.address);

        return [normalize.actionableMcp(context, obj, 'ltm virtual-address', path.join('/'))];
    },
    'tm:net:bwc:policy:policystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'net bwc policy', obj.fullPath)];
    },
    'tm:net:service-policy:service-policystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'net service-policy', obj.fullPath)];
    },
    'tm:net:timer-policy:timer-policystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'net timer-policy', obj.fullPath)];
    },
    'tm:net:address-list:address-liststate': function (context, obj) {
        if (obj.addresses) {
            obj.addresses = obj.addresses.map((addr) => addr.name);
        }
        if (obj.addressLists) {
            obj.addressLists = obj.addressLists.map((addressList) => util.mcpPath(
                addressList.partition, addressList.subPath, addressList.name
            ));
        }
        return [normalize.actionableMcp(context, obj, 'net address-list', obj.fullPath)];
    },
    'tm:pem:irule:irulestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'pem irule', obj.fullPath)];
    },
    'tm:pem:reporting:format-script:format-scriptstate': function (context, obj) {
        if (obj.definition) {
            obj.definition = util.escapeTcl(obj.definition);
        }
        return [normalize.actionableMcp(context, obj, 'pem reporting format-script', obj.fullPath)];
    },
    'tm:pem:interception-endpoint:interception-endpointstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'pem interception-endpoint', obj.fullPath)];
    },
    'tm:pem:listener:listenerstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'pem listener', obj.fullPath)];
    },
    'tm:pem:profile:diameter-endpoint:diameter-endpointstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'pem profile diameter-endpoint', obj.fullPath)];
    },
    'tm:pem:profile:radius-aaa:radius-aaastate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'pem profile radius-aaa', obj.fullPath)];
    },
    'tm:pem:profile:spm:spmstate': function (context, obj) {
        if (!obj.globalPoliciesHighPrecedence) {
            obj.globalPoliciesHighPrecedence = {};
        }
        if (!obj.globalPoliciesLowPrecedence) {
            obj.globalPoliciesLowPrecedence = {};
        }
        if (!obj.unknownSubscriberPolicies) {
            obj.unknownSubscriberPolicies = {};
        }

        return [normalize.actionableMcp(context, obj, 'pem profile spm', obj.fullPath)];
    },
    'tm:pem:profile:subscriber-mgmt:subscriber-mgmtstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'pem profile subscriber-mgmt', obj.fullPath)];
    },
    'tm:pem:service-chain-endpoint:service-chain-endpointstate': function (context, obj) {
        if (!obj.serviceEndpoints) {
            obj.serviceEndpoints = [];
        }

        return [normalize.actionableMcp(context, obj, 'pem service-chain-endpoint', obj.fullPath)];
    },
    'tm:security:protocol-inspection:profile:profilestate': function (context, obj) {
        const config = normalize.actionableMcp(context, obj, 'security protocol-inspection profile', obj.fullPath);

        // Remove any properties (compliance, signature or even services) that may be appended to the config
        // after normalize.actionableMcp() is called on the object
        const services = config.properties.services;
        Object.keys(services).forEach((serviceKey) => {
            ['compliance', 'signature', 'ports'].forEach((checkType) => {
                if (Object.keys(services[serviceKey][checkType]).length === 0) {
                    delete services[serviceKey][checkType];
                } else if (checkType === 'compliance') {
                    // only compliance checks can have "value" property
                    // if "value" is not integer, coerce it to an object
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
        return [config];
    },
    'tm:security:log:profile:profilestate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name).replace(/\//g, '~');
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/log/profile/${path}`,
            'tm:security:log:profile:network:networkstate',
            'security log profile',
            'network'
        );
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/log/profile/${path}`,
            'tm:security:log:profile:protocol-dns:protocol-dnsstate',
            'security log profile',
            'protocolDns',
            'protocol-dns'
        );
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/log/profile/${path}`,
            'tm:security:log:profile:protocol-sip:protocol-sipstate',
            'security log profile',
            'protocolSip',
            'protocol-sip'
        );
        pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/log/profile/${path}`,
            'tm:security:log:profile:application:applicationstate',
            'security log profile',
            'application'
        );

        if (obj.application && obj.application[0]) {
            if (obj.application[0].format && obj.application[0].format.type === 'user-defined') {
                delete obj.application[0].format['field-delimiter'];
            }
        }

        const config = [normalize.actionableMcp(context, obj, 'security log profile', obj.fullPath)];
        const networkFormat = util.getDeepValue(config[0].properties, 'network.undefined.format');
        if (networkFormat && networkFormat.type === 'user-defined') {
            networkFormat['user-defined'] = util.escapeTcl(networkFormat['user-defined']);
            // We don't want spaces around the braces in user defined strings. Also, the '\' need
            // extra escaping
            networkFormat['user-defined'] = networkFormat['user-defined'].replace(/ \\}/g, '\\\\}');
            networkFormat['user-defined'] = networkFormat['user-defined'].replace(/ \\{/g, '\\\\{');

            delete networkFormat['field-list-delimiter'];
        }
        return config;
    },
    'tm:sys:file:ssl-cert:ssl-certstate': function (context, obj, referenceConfig) {
        const validator = referenceConfig.filter((item) => item.kind.includes('validators'));
        if (validator.length > 0 && validator[0].selfLink.includes(obj.name)) {
            obj.certValidators = [validator[0].fullPath];
        }
        return [normalize.actionableMcp(context, obj, 'sys file ssl-cert', obj.fullPath)];
    },
    'tm:sys:file:ssl-key:ssl-keystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys file ssl-key', obj.fullPath)];
    },
    'tm:sys:file:external-monitor:external-monitorstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys file external-monitor', obj.fullPath)];
    },
    'tm:sys:folder:folderstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys folder', `${obj.fullPath}/`)];
    },
    'tm:sys:log-config:publisher:publisherstate': function (context, obj) {
        if (obj.destinations) {
            obj.destinations = obj.destinations.map(
                (destination) => util.mcpPath(
                    destination.partition,
                    destination.subPath,
                    destination.name
                )
            );
        }
        obj.description = obj.description || 'none';
        return [normalize.actionableMcp(context, obj, 'sys log-config publisher', obj.fullPath)];
    },
    'tm:sys:log-config:destination:management-port:management-portstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys log-config destination management-port', obj.fullPath)];
    },
    'tm:sys:log-config:destination:remote-high-speed-log:remote-high-speed-logstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys log-config destination remote-high-speed-log', obj.fullPath)];
    },
    'tm:sys:log-config:destination:remote-syslog:remote-syslogstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys log-config destination remote-syslog', obj.fullPath)];
    },
    'tm:sys:log-config:destination:splunk:splunkstate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys log-config destination splunk', obj.fullPath)];
    },
    'tm:asm:policies:policystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'asm policy', obj.fullPath)];
    },
    'tm:apm:profile:access:accessstate': function (context, obj) {
        const config = [normalize.actionableMcp(context, obj, 'apm profile access', obj.fullPath)];
        // There is no way to tell if a policy has been applied, so assume it is not for backwards compatibility
        config.forEach((c) => {
            c.properties.enable = false;
        });
        return config;
    },
    'tm:apm:policy:access-policy:access-policystate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'apm policy access-policy', obj.fullPath)];
    },
    'tm:security:firewall:address-list:address-liststate': function (context, obj) {
        if (obj.addresses) {
            obj.addresses = obj.addresses.map((addr) => addr.name);
        }
        if (obj.fqdns) {
            obj.fqdns = obj.fqdns.map((fqdn) => fqdn.name);
        }
        if (obj.geo) {
            obj.geo = obj.geo.map((geo) => geo.name);
        }
        if (obj.addressLists) {
            obj.addressLists = obj.addressLists.map((addressList) => util.mcpPath(addressList.partition, addressList.subPath, addressList.name)); // eslint-disable-line max-len
        }
        return [normalize.actionableMcp(context, obj, 'security firewall address-list', obj.fullPath)];
    },
    'tm:security:firewall:port-list:port-liststate': function (context, obj) {
        if (obj.ports) {
            obj.ports = obj.ports.map((port) => port.name);
        }
        if (obj.portLists) {
            obj.portLists = obj.portLists.map((portList) => util.mcpPath(portList.partition, portList.subPath, portList.name)); // eslint-disable-line max-len
        }
        return [normalize.actionableMcp(context, obj, 'security firewall port-list', obj.fullPath)];
    },
    'tm:security:firewall:rule-list:rule-liststate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/firewall/rule-list/${path.replace(/\//g, '~')}`,
            'tm:security:firewall:rule-list:rules:rulesstate',
            'security firewall rule-list',
            'rules'
        );
        return [normalize.actionableMcp(context, obj, 'security firewall rule-list', obj.fullPath)];
    },
    'tm:security:firewall:policy:policystate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/firewall/policy/${path.replace(/\//g, '~')}`,
            'tm:security:firewall:policy:rules:rulesstate',
            'security firewall policy',
            'rules'
        );
        return [normalize.actionableMcp(context, obj, 'security firewall policy', obj.fullPath)];
    },
    'tm:security:nat:policy:policystate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/security/nat/policy/${path.replace(/\//g, '~')}`,
            'tm:security:nat:policy:rules:rulesstate',
            'security nat policy',
            'rules'
        );
        if (obj.rules) {
            obj.rules.forEach((rule) => {
                if (!rule.translation.source && !rule.translation.destination) {
                    delete rule.translation;
                }
            });
        }
        return [normalize.actionableMcp(context, obj, 'security nat policy', obj.fullPath)];
    },
    'tm:security:nat:source-translation:source-translationstate': function (context, obj) {
        if (obj.type !== 'dynamic-pat') {
            delete obj.patMode;
            delete obj.inboundMode;
            delete obj.mapping;
            delete obj.clientConnectionLimit;
            delete obj.hairpinMode;
            delete obj.portBlockAllocation;
        } else if (obj.patMode !== 'pba') {
            delete obj.portBlockAllocation;
        }
        if (obj.egressInterfacesDisabled === true) {
            obj.egressInterfacesDisabled = ' ';
        }
        if (obj.egressInterfacesEnabled === true) {
            obj.egressInterfacesEnabled = ' ';
        }
        return [normalize.actionableMcp(context, obj, 'security nat source-translation', obj.fullPath)];
    },
    'tm:pem:policy:policystate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/pem/policy/${path.replace(/\//g, '~')}`,
            'tm:pem:policy:rules:rulesstate',
            'pem policy',
            'rules'
        );
        (obj.rules || []).forEach((rule) => {
            if (rule['flow-info-filters']) {
                rule['flow-info-filters'] = [];
            }
            rule = pushReferences(
                context,
                rule,
                referenceConfig,
                `/mgmt/tm/pem/policy/${path.replace(/\//g, '~')}/rules/${rule.name}`,
                'tm:pem:policy:rules:flow-info-filters:flow-info-filtersstate',
                'pem policy rules',
                'flow-info-filters'
            );
            rule['flow-info-filters'].forEach((filter) => {
                if (filter['src-ip-addr']) {
                    filter['src-ip-addr'] = filter['src-ip-addr'].split('/')[0];
                }
                if (filter['dst-ip-addr']) {
                    filter['dst-ip-addr'] = filter['dst-ip-addr'].split('/')[0];
                }
            });
            if (typeof rule['tcl-filter'] !== 'undefined') {
                rule['tcl-filter'] = util.escapeTcl(rule['tcl-filter']);
            }
        });
        return [normalize.actionableMcp(context, obj, 'pem policy', obj.fullPath)];
    },
    'tm:pem:forwarding-endpoint:forwarding-endpointstate': function (context, obj) {
        if (
            obj.persistence
            && obj.persistence.hashSettings
            && obj.persistence.hashSettings.tclValue
        ) {
            const settings = obj.persistence.hashSettings;
            settings.tclValue = util.escapeTcl(settings.tclValue);
        }
        return [normalize.actionableMcp(context, obj, 'pem forwarding-endpoint', obj.fullPath)];
    },
    'tm:gtm:datacenter:datacenterstate': function (context, obj) {
        obj.enabled = util.isEnabledObject(obj);
        delete obj.disabled;
        return [normalize.actionableMcp(context, obj, 'gtm datacenter', obj.fullPath)];
    },
    'tm:gtm:pool:a:astate': function (context, obj, referenceConfig) {
        obj.monitor = obj.monitor.trim() || 'none';
        obj.maxAnswersReturned = obj.maxAnswersReturned || 1;
        return gslbPool(context, obj, referenceConfig, 'a');
    },
    'tm:gtm:pool:aaaa:aaaastate': function (context, obj, referenceConfig) {
        obj.monitor = obj.monitor.trim() || 'none';
        obj.maxAnswersReturned = obj.maxAnswersReturned || 1;
        return gslbPool(context, obj, referenceConfig, 'aaaa');
    },
    'tm:gtm:pool:cname:cnamestate': function (context, obj, referenceConfig) {
        return gslbPool(context, obj, referenceConfig, 'cname');
    },
    'tm:gtm:pool:mx:mxstate': function (context, obj, referenceConfig) {
        obj.maxAnswersReturned = obj.maxAnswersReturned || 1;
        return gslbPool(context, obj, referenceConfig, 'mx');
    },
    'tm:gtm:prober-pool:prober-poolstate': function (context, obj, referenceConfig) {
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/gtm/prober-pool/${path.replace(/\//g, '~')}`,
            'tm:gtm:prober-pool:members:membersstate',
            'gtm prober-pool',
            'members'
        );
        obj.enabled = util.isEnabledObject(obj);
        delete obj.disabled;
        (obj.members || []).forEach((mem) => {
            mem.enabled = util.isEnabledObject(mem);
            delete mem.disabled;
        });
        return [normalize.actionableMcp(context, obj, 'gtm prober-pool', obj.fullPath)];
    },
    'tm:gtm:server:serverstate': function (context, obj, referenceConfig) {
        obj.description = obj.description || 'none';
        obj.product = obj.product || 'bigip';
        const path = util.mcpPath(obj.partition, obj.subPath, obj.name);
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/gtm/server/${path.replace(/\//g, '~')}`,
            'tm:gtm:server:devices:devicesstate',
            'gtm server',
            'devices'
        );
        obj = pushReferences(
            context,
            obj,
            referenceConfig,
            `/mgmt/tm/gtm/server/${path.replace(/\//g, '~')}`,
            'tm:gtm:server:virtual-servers:virtual-serversstate',
            'gtm server',
            'virtual-servers'
        );
        obj.enabled = util.isEnabledObject(obj);
        delete obj.disabled;

        if (obj.monitor) {
            obj.monitor = obj.monitor.trim();
            if (obj.monitor === '/Common/none') {
                delete obj.monitor;
            }
        }

        // filter out any virtuals that AS3 did not create (for example, ones that were discovered)
        const as3VirtualsMetadata = obj.metadata.find((md) => md.name === 'as3-virtuals') || {};
        const as3Virtuals = (as3VirtualsMetadata.value || '').split('_');
        obj['virtual-servers'] = (obj['virtual-servers'] || []).filter((vs) => as3Virtuals.indexOf(vs.destination) > -1);

        (obj['virtual-servers'] || []).forEach((vs) => {
            vs.enabled = util.isEnabledObject(vs);
            if (typeof vs.monitor === 'string') {
                vs.monitor = vs.monitor.trim();
            }
            delete vs.disabled;
        });

        if (!obj.product.endsWith('bigip')) {
            delete obj.iqAllowServiceCheck;
            delete obj.iqAllowPath;
            delete obj.iqAllowSnmp;
        }

        if (obj.product !== 'generic-host') {
            delete obj.limitCpuUsage;
            delete obj.limitCpuUsageStatus;
            delete obj.limitMemAvail;
            delete obj.limitMemAvailStatus;
        }

        if (obj.devices !== undefined) {
            obj.addresses = undefined;
        }

        return [normalize.actionableMcp(context, obj, 'gtm server', obj.fullPath)];
    },
    'tm:gtm:region:regionstate': function (context, obj) {
        if (!util.isEmptyOrUndefined(obj.regionMembers)) {
            obj.regionMembers = obj.regionMembers.map((regionMember) => gtmUtil.parseTopologyItem(regionMember.name));
        }
        return [normalize.actionableMcp(context, obj, 'gtm region', obj.fullPath)];
    },
    'tm:gtm:topology:topologystate': function (context, obj) {
        // the returned path value is same as the name, no partition or key at all
        // Might need to change path value based on whether there will be partitions in the future
        const path = `/Common/${constants.gtmTopologyMockPath}`;
        const item = { records: [] };
        const record = {};
        const itemName = obj.name;
        const ldnsIndex = itemName.indexOf('ldns: ') + 6;
        const serverIndex = itemName.indexOf('server: ');

        record['ldns:'] = gtmUtil.parseTopologyItem(itemName.substring(ldnsIndex, serverIndex).trim()).name;
        record['server:'] = gtmUtil.parseTopologyItem(itemName.substring(serverIndex + 8).trim()).name;

        // subtract 1 from order to match 0 based array index
        record.name = `${obj.order - 1}`;
        record.order = obj.order;
        record.score = obj.score;
        record.description = obj.description;
        item.records.push(record);

        return [normalize.actionableMcp(context, item, 'gtm topology', path)];
    },
    'tm:gtm:global-settings:load-balancing:load-balancingstate': function (context, obj) {
        const path = constants.gtmSettingsMockPath;
        const item = { longestMatchEnabled: obj.topologyLongestMatch || true };
        return [normalize.actionableMcp(context, item, 'gtm global-settings load-balancing', path)];
    },
    'tm:gtm:wideip:a:astate': function (context, obj) {
        return processGtmWideIps(context, obj, 'a');
    },
    'tm:gtm:wideip:aaaa:aaaastate': function (context, obj) {
        return processGtmWideIps(context, obj, 'aaaa');
    },
    'tm:gtm:wideip:cname:cnamestate': function (context, obj) {
        return processGtmWideIps(context, obj, 'cname');
    },
    'tm:gtm:wideip:mx:mxstate': function (context, obj) {
        return processGtmWideIps(context, obj, 'mx');
    },
    'tm:gtm:monitor:http:httpstate': function (context, obj) {
        return monitor(context, obj, 'gtm monitor', 'http');
    },
    'tm:gtm:monitor:https:httpsstate': function (context, obj) {
        obj.cert = obj.cert ? obj.cert : 'none';
        return monitor(context, obj, 'gtm monitor', 'https');
    },
    'tm:gtm:monitor:gateway-icmp:gateway-icmpstate': function (context, obj) {
        return profile(context, obj, 'gtm monitor', 'gateway-icmp');
    },
    'tm:gtm:monitor:tcp:tcpstate': function (context, obj) {
        return monitor(context, obj, 'gtm monitor', 'tcp');
    },
    'tm:gtm:monitor:udp:udpstate': function (context, obj) {
        return monitor(context, obj, 'gtm monitor', 'udp');
    },
    'tm:gtm:monitor:external:externalstate': function (context, obj) {
        externalMonitor(context, obj);
        return profile(context, obj, 'gtm monitor', 'external');
    },
    'tm:gtm:rule:rulestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'gtm rule', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'shared:service-discovery:taskstate': function (context, obj) {
        const partition = decodeURIComponent(obj.id).split(/\/|~/g)[1];
        const sdPath = util.mcpPath(partition, null, obj.id);
        serviceDiscovery.prepareTaskForNormalize(obj);
        return [normalize.actionableMcp(context, obj, 'mgmt shared service-discovery task', sdPath)];
    },
    'tm:ltm:cipher:group:groupstate': function (context, obj) {
        obj.description = obj.description || 'none';
        ['allow', 'exclude', 'require'].forEach((type) => {
            if (obj[type]) {
                const newObj = {};
                obj[type].forEach(((rule) => {
                    const path = util.mcpPath(rule.partition, rule.subPath, rule.name);
                    newObj[path] = {};
                }));
                obj[type] = newObj;
            }
        });
        return [normalize.actionableMcp(context, obj, 'ltm cipher group', obj.fullPath)];
    },
    'tm:ltm:ifile:ifilestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'ltm ifile', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    },
    'tm:sys:file:ifile:ifilestate': function (context, obj) {
        return [normalize.actionableMcp(context, obj, 'sys file ifile', util.mcpPath(obj.partition, obj.subPath, obj.name))];
    }

};

module.exports = {
    translate
};

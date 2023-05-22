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
const log = require('./log');
const util = require('./util/util');
const constants = require('./constants');

const prefix = {
    'ltm alg-log-profile elements': 'replace-all-with',
    'ltm cipher group allow': 'replace-all-with',
    'ltm cipher group exclude': 'replace-all-with',
    'ltm cipher group require': 'replace-all-with',
    'ltm data-group internal records': 'replace-all-with',
    'ltm dns cache transparent records': 'add', // 'add' for this command really means 'replace-all-with'
    'ltm dns cache resolver records': 'add', // 'add' for this command really means 'replace-all-with'
    'ltm dns cache resolver forward-zones': 'replace-all-with',
    'ltm dns cache resolver nameservers': 'replace-all-with',
    'ltm dns cache resolver root-hints': 'replace-all-with',
    'ltm dns cache validating-resolver records': 'add', // 'add' for this command really means 'replace-all-with'
    'ltm dns cache validating-resolver forward-zones': 'replace-all-with',
    'ltm dns cache validating-resolver nameservers': 'replace-all-with',
    'ltm dns cache validating-resolver root-hints': 'replace-all-with',
    'ltm dns cache validating-resolver trust-anchors': 'replace-all-with',
    'ltm dns zone dns-express-allow-notify': 'replace-all-with',
    'ltm dns zone transfer-clients': 'replace-all-with',
    'ltm node metadata': 'replace-all-with',
    'ltm policy actions': 'replace-all-with',
    'ltm policy conditions': 'replace-all-with',
    'ltm policy controls': 'replace-all-with',
    'ltm policy requires': 'replace-all-with',
    'ltm policy rules': 'replace-all-with',
    'ltm policy-strategy operands': 'replace-all-with',
    'ltm pool members': 'replace-all-with',
    'ltm pool metadata': 'replace-all-with',
    'ltm profile analytics countries-for-stat-collection': 'replace-all-with',
    'ltm profile analytics notification-email-addresses': 'replace-all-with',
    'ltm profile analytics subnets-for-stat-collection': 'replace-all-with',
    'ltm profile analytics traffic-capture': 'replace-all-with',
    'ltm profile analytics traffic-capture virtual-servers': 'replace-all-with',
    'ltm profile analytics urls-for-stat-collection': 'replace-all-with',
    'ltm profile client-ssl cert-key-chain': 'replace-all-with',
    'ltm profile client-ssl cert-extension-includes': '',
    'ltm profile html content-selection': 'replace-all-with',
    'ltm profile html rules': 'replace-all-with',
    'ltm profile http encrypt-cookies': 'replace-all-with',
    'ltm profile http host-names': 'replace-all-with',
    'ltm profile http fallback-status-codes': 'replace-all-with',
    'ltm profile http known-methods': 'replace-all-with',
    'ltm profile http response-headers-permitted': 'replace-all-with',
    'ltm profile http xff-alternative-names': 'replace-all-with',
    'ltm profile http-compression content-type-exclude': 'replace-all-with',
    'ltm profile http-compression content-type-include': 'replace-all-with',
    'ltm profile http-compression uri-exclude': 'replace-all-with',
    'ltm profile http-compression uri-include': 'replace-all-with',
    'ltm profile rewrite bypass-list': 'replace-all-with',
    'ltm profile rewrite rewrite-list': 'replace-all-with',
    'ltm profile rewrite set-cookie-rules': 'replace-all-with',
    'ltm profile rewrite uri-rules': 'replace-all-with',
    'ltm profile web-acceleration cache-uri-exclude': 'replace-all-with',
    'ltm profile web-acceleration cache-uri-include': 'replace-all-with',
    'ltm profile web-acceleration cache-uri-include-override': 'replace-all-with',
    'ltm profile web-acceleration cache-uri-pinned': 'replace-all-with',
    'ltm snatpool members': 'replace-all-with',
    'ltm virtual clone-pools': 'replace-all-with',
    'ltm virtual internal': undefined,
    'ltm virtual ip-forward': undefined,
    'ltm virtual l2-forward': undefined,
    'ltm virtual metadata': 'replace-all-with',
    'ltm virtual persist': 'replace-all-with',
    'ltm virtual policies': 'replace-all-with',
    'ltm virtual profiles': 'replace-all-with',
    'ltm virtual rules': '',
    'ltm virtual security-log-profiles': 'replace-all-with',
    'ltm virtual stateless': undefined,
    'ltm virtual vlans': 'replace-all-with',
    'ltm virtual-address metadata': 'replace-all-with',
    'net address-list addresses': 'replace-all-with',
    'net address-list address-lists': 'replace-all-with',
    'net bwc policy categories': 'replace-all-with',
    'net service-policy': 'replace-all-with',
    'net timer-policy': 'replace-all-with',
    'net timer-policy rules': 'replace-all-with',
    'net timer-policy destination-ports': 'replace-all-with',
    'net timer-policy timers': 'replace-all-with',
    'pem listener virtual-servers': 'replace-all-with',
    'pem profile diameter-endpoint supported-apps': 'replace-all-with',
    'pem profile spm global-policies-high-precedence': 'replace-all-with',
    'pem profile spm global-policies-low-precedence': 'replace-all-with',
    'pem profile spm unknown-subscriber-policies': 'replace-all-with',
    'pem service-chain-endpoint service-endpoints': 'replace-all-with',
    'security bot-defense profile android-publishers': 'replace-all-with',
    'security bot-defense profile class-overrides': 'replace-all-with',
    'security bot-defense profile external-domains': 'replace-all-with',
    'security bot-defense profile ios-allowed-packages': 'replace-all-with',
    'security bot-defense profile signature-category-overrides': 'replace-all-with',
    'security bot-defense profile signature-overrides': 'replace-all-with',
    'security bot-defense profile site-domains': 'replace-all-with',
    'security bot-defense profile whitelist': 'replace-all-with',
    'security log profile application': 'replace-all-with',
    'security log profile bot-defense': 'replace-all-with',
    'security log profile elements': 'replace-all-with',
    'security log profile dos-application': 'replace-all-with',
    'security log profile network': 'replace-all-with',
    'security log profile protocol-dns': 'replace-all-with',
    'security log profile protocol-sip': 'replace-all-with',
    'security log profile protocol-transfer': 'replace-all-with',
    'security log profile ssh-proxy': 'replace-all-with',
    'security log profile servers': 'replace-all-with',
    'security log profile values': 'replace-all-with',
    'security dos profile android-publishers': 'replace-all-with',
    'security dos profile application': 'replace-all-with',
    'security dos profile categories': 'replace-all-with',
    'security dos profile disabled-signatures': 'replace-all-with',
    'security dos profile dns-query-vector': 'replace-all-with',
    'security dos profile dos-network': 'replace-all-with',
    'security dos profile exclude': 'replace-all-with',
    'security dos profile external-domains': 'replace-all-with',
    'security dos profile geolocations': 'replace-all-with',
    'security dos profile include-list': 'replace-all-with',
    'security dos profile ios-allowed-package-names': 'replace-all-with',
    'security dos profile network-attack-vector': 'replace-all-with',
    'security dos profile protocol-dns': 'replace-all-with',
    'security dos profile protocol-sip': 'replace-all-with',
    'security dos profile sip-attack-vector': 'replace-all-with',
    'security dos profile site-domains': 'replace-all-with',
    'security dos profile url-whitelist': 'replace-all-with',
    'security firewall address-list addresses': 'replace-all-with',
    'security firewall address-list address-lists': 'replace-all-with',
    'security firewall address-list fqdns': 'replace-all-with',
    'security firewall address-list geo': 'replace-all-with',
    'security firewall policy address-lists': 'replace-all-with',
    'security firewall policy port-lists': 'replace-all-with',
    'security firewall policy rules': 'replace-all-with',
    'security firewall policy vlans': 'replace-all-with',
    'security firewall port-list ports': 'replace-all-with',
    'security firewall port-list port-lists': 'replace-all-with',
    'security firewall rule-list address-lists': 'replace-all-with',
    'security firewall rule-list port-lists': 'replace-all-with',
    'security firewall rule-list rules': 'replace-all-with',
    'security firewall rule-list vlans': 'replace-all-with',
    'security nat policy address-lists': 'replace-all-with',
    'security nat policy port-lists': 'replace-all-with',
    'security nat policy rules': 'replace-all-with',
    'security nat source-translation addresses': 'replace-all-with',
    'security nat source-translation egress-interfaces': 'replace-all-with',
    'security nat source-translation ports': 'replace-all-with',
    'security nat source-translation exclude-addresses': 'replace-all-with',
    'security nat source-translation exclude-address-lists': 'replace-all-with',
    'security protocol-inspection profile services': 'replace-all-with',
    'security protocol-inspection profile compliance': 'replace-all-with',
    'security protocol-inspection profile signature': 'replace-all-with',
    'security protocol-inspection profile ports': 'replace-all-with',
    'security ssh profile actions': 'replace-all-with',
    'security ssh profile auth-info': 'replace-all-with',
    'security ssh profile identity-groups': 'replace-all-with',
    'security ssh profile identity-users': 'replace-all-with',
    'security ssh profile rules': 'replace-all-with',
    'sys log-config publisher destinations': 'replace-all-with',
    'pem policy classification-filters': 'replace-all-with',
    'pem policy flow-info-filters': 'replace-all-with',
    'pem policy flow-reporting-fields': 'replace-all-with',
    'pem policy rules': 'replace-all-with',
    'pem policy session-reporting-fields': 'replace-all-with',
    'pem policy transaction-reporting-fields': 'replace-all-with',
    'pem policy url-categorization-filters': 'replace-all-with',
    'gtm datacenter metadata': 'replace-all-with',
    'gtm pool a members': 'replace-all-with',
    'gtm pool a depends-on': 'replace-all-with',
    'gtm pool aaaa members': 'replace-all-with',
    'gtm pool aaaa depends-on': 'replace-all-with',
    'gtm pool cname members': 'replace-all-with',
    'gtm pool mx members': 'replace-all-with',
    'gtm prober-pool members': 'replace-all-with',
    'gtm region region-members': 'replace-all-with',
    'gtm server addresses': 'replace-all-with',
    'gtm server devices': 'replace-all-with',
    'gtm server metadata': 'replace-all-with',
    'gtm server monitor': 'replace-all-with',
    'gtm server virtual-servers': 'replace-all-with',
    'gtm server virtual-servers monitor': 'replace-all-with',
    'gtm topology records': '',
    'gtm wideip a aliases': 'replace-all-with',
    'gtm wideip a pools': 'replace-all-with',
    'gtm wideip a pools-cname': 'replace-all-with',
    'gtm wideip a rules': '',
    'gtm wideip aaaa aliases': 'replace-all-with',
    'gtm wideip aaaa pools': 'replace-all-with',
    'gtm wideip aaaa pools-cname': 'replace-all-with',
    'gtm wideip aaaa rules': '',
    'gtm wideip cname aliases': 'replace-all-with',
    'gtm wideip cname pools': 'replace-all-with',
    'gtm wideip cname rules': '',
    'gtm wideip mx aliases': 'replace-all-with',
    'gtm wideip mx pools': 'replace-all-with',
    'gtm wideip mx pools-cname': 'replace-all-with',
    'gtm wideip mx rules': ''
};

/**
 * return a TMSH-style string representation of
 * argument obj, optionally with double-quotes (")
 * backslash-escaped
 *
 * @private
 * @param {object} obj
 * @param {boolean} [escapeQuote=false]
 * @returns {string}
 */
const stringify = function (component, obj, escapeQuote) {
    let rval = '';
    let list;
    let prefixKey;
    if ((typeof obj === 'object') && (obj !== null)) {
        Object.keys(obj).forEach((key) => {
            // dont include iControl in tmsh commands
            if (key.startsWith('iControl_')) {
                return;
            }
            if (obj[key] !== undefined) {
                rval += ` ${key}`;
                if ((typeof obj[key] === 'object') && (obj[key] !== null)) {
                    list = stringify(component, obj[key], false);
                    prefixKey = `${component} ${key}`;
                    if (list === '') {
                        rval += prefix[prefixKey] === undefined ? '' : ' none';
                    } else {
                        if (prefix[prefixKey] !== undefined) {
                            rval += ` ${prefix[prefixKey]}`;
                        }
                        rval += ` \\{${stringify(component, obj[key], false)} \\}`;
                    }
                } else {
                    rval += ` ${obj[key]}`;
                }
            }
        });
    } else {
        rval += obj;
    }
    if (escapeQuote) {
        rval = rval.replace(/"/g, '\\"');
    }
    return rval;
}; // stringify()

const adjustPolicyStringObject = function (object) {
    const quoter = function (_match, grp1, grp2) {
        if (grp2.indexOf('"') > -1) {
            return `${grp1}${grp2}`;
        }
        return `${grp1}"${grp2}"`;
    };

    Object.keys(object).forEach((ordinal) => {
        if (object[ordinal].policyString) {
            object[ordinal][''] = object[ordinal].policyString
                .replace(/{/g, '\\{')
                .replace(/}/g, '\\}')
                .replace(/(http-reply [\w-]+ redirect[\w\s]* location )(.+?)$/g, quoter);
            delete object[ordinal].policyString;
        }
    });
};

const areItemsInPolicy = function (items, policy, policyList) {
    return items.some((checkItem) => {
        const checkExp = RegExp(`(^|\\s)${checkItem}($|\\s)`);
        let matchFound = false;
        Object.keys(policy.rules || {}).forEach((ruleKey) => {
            const rule = policy.rules[ruleKey];
            Object.keys(rule[policyList] || {}).forEach((listKey) => {
                const listItem = rule[policyList][listKey][''];
                if (listItem.match(checkExp)) {
                    matchFound = true;
                }
            });
        });
        return matchFound;
    });
};

const getPolicyRequires = function (policy) {
    const requireMap = {
        tcp: ['tcp', 'client-accepted', 'server-connected'],
        'http-connect': ['proxy-connect', 'proxy-response'],
        'http-explicit': ['proxy-request'],
        http: [
            'geoip', 'http-uri', 'http-method', 'http-version', 'http-method', 'http-version',
            'http-status', 'http-host', 'http-header', 'http-referer', 'http-cookie',
            'http-set-cookie', 'http-basic-auth', 'http-user-agent', 'request', 'response'
        ],
        classification: ['classification-detected'],
        'client-ssl': ['client-ssl', 'ssl-client-hello', 'ssl-client-serverhello-send'],
        'server-ssl': ['ssl-server-hello', 'ssl-server-handshake'],
        'ssl-persistence': ['ssl-extension', 'ssl-cert', 'ssl-client-hello'],
        websocket: ['websocket', 'ws-request', 'ws-response']
    };
    const requires = {};

    Object.keys(requireMap).forEach((require) => {
        const operands = requireMap[require];
        if (areItemsInPolicy(operands, policy, 'conditions')) {
            requires[require] = {};
        }
        if (areItemsInPolicy(operands, policy, 'actions')) {
            requires[require] = {};
        }
    });
    return requires;
};

const getPolicyControls = function (policy) {
    const controlMap = {
        forwarding: ['forward', 'http-reply'],
        caching: ['cache'],
        compression: ['compress', 'decompress'],
        classification: ['pem', 'classification'],
        'request-adaptation': ['request-adapt'],
        'response-adaptation': ['response-adapt'],
        'server-ssl': ['server-ssl'],
        persistence: ['persist'],
        acceleration: ['wam'],
        ce: ['ce'],
        asm: ['asm'],
        avr: ['avr'],
        websocket: ['websocket'],
        l7dos: ['l7dos']
    };
    const controls = {};

    Object.keys(controlMap).forEach((control) => {
        const targets = controlMap[control];
        if (areItemsInPolicy(targets, policy, 'actions')) {
            controls[control] = {};
        }
    });
    return controls;
};

/**
 * @param {string} deleteCommand - the literal deleteCommand
 * @param {object} rules - the rules within the object
 * @param {string} cmdType - the type of command this originates from (e.g. 'securityFirewall')
 *
 * @returns {object} A full formed commandObj
 */

const getRuleCommands = function (deleteCommand, rules, cmdType) {
    const commandObj = {
        commands: [deleteCommand]
    };

    function getFirewallRuleCmd(rule, ruleKey) {
        function getListCmd(dir, dirKey, listKeys) {
            if (!dir) { return null; }
            const cmdObj = { preTrans: '', rollback: '' };
            const refListKeys = listKeys.filter((key) => dir[key]);
            refListKeys.forEach((key) => {
                cmdObj.preTrans += ` ${key} none`;
                cmdObj.rollback += ` ${key} replace-all-with \\{${
                    Object.keys(dir[key]).join(' ')} \\}`;
            });
            // return command if needed
            if (cmdObj.preTrans !== '' && cmdObj.rollback !== '') {
                cmdObj.preTrans = ` ${dirKey} \\{${cmdObj.preTrans} \\}`;
                cmdObj.rollback = ` ${dirKey} \\{${cmdObj.rollback} \\}`;
                return cmdObj;
            }
            return null;
        }

        const cmdObj = { preTrans: '', rollback: '' };
        // remove irule reference
        const irule = rule.irule;
        const iruleRate = rule['irule-sample-rate'];
        if (irule) {
            cmdObj.preTrans += ' irule none';
            cmdObj.rollback += ` irule ${irule} irule-sample-rate ${iruleRate}`;
        }
        // remove address-lists and port-lists references
        ['source', 'destination'].forEach((dir) => {
            const listCmd = getListCmd(rule[dir], dir, ['address-lists', 'port-lists', 'vlans']);
            Object.keys(listCmd).forEach((key) => {
                cmdObj[key] += listCmd[key];
            });
        });
        // return command if needed
        if (cmdObj.preTrans !== '' && cmdObj.rollback !== '') {
            cmdObj.preTrans = ` ${ruleKey} \\{${cmdObj.preTrans} \\}`;
            cmdObj.rollback = ` ${ruleKey} \\{${cmdObj.rollback} \\}`;
            return cmdObj;
        }
        return null;
    }

    function getPemRuleCmd(rule, ruleKey) {
        const cmdObj = { preTrans: '', rollback: '' };
        // remove tcp-optimization references
        const tcpOptDownlink = rule['tcp-optimization-downlink'];
        const tcpOptUplink = rule['tcp-optimization-uplink'];
        if (tcpOptDownlink) {
            cmdObj.preTrans += ' tcp-optimization-downlink none';
            cmdObj.rollback += ` tcp-optimization-downlink ${tcpOptDownlink}`;
        }
        if (tcpOptUplink) {
            cmdObj.preTrans += ' tcp-optimization-uplink none';
            cmdObj.rollback += ` tcp-optimization-uplink ${tcpOptUplink}`;
        }
        // return command if needed
        if (cmdObj.preTrans !== '' && cmdObj.rollback !== '') {
            cmdObj.preTrans = ` ${ruleKey} \\{${cmdObj.preTrans} \\}`;
            cmdObj.rollback = ` ${ruleKey} \\{${cmdObj.rollback} \\}`;
            return cmdObj;
        }
        return null;
    }

    const ruleCmds = [];
    Object.keys(rules).forEach((rule) => {
        const ruleCmd = (cmdType === 'securityFirewall') ? getFirewallRuleCmd(rules[rule], rule)
            : getPemRuleCmd(rules[rule], rule);
        if (ruleCmd !== null) {
            ruleCmds.push(ruleCmd);
        }
    });
    if (ruleCmds.length > 0) {
        const prepend = `tmsh::modify ${deleteCommand.split(' ').slice(1, deleteCommand.length).join(' ')}`;
        commandObj.preTrans = [`${prepend} rules modify \\{${
            ruleCmds.reduce((cmd, ruleCmd) => cmd + ruleCmd.preTrans, '')} \\}`];
        commandObj.rollback = [`catch { ${prepend} rules modify \\{${
            ruleCmds.reduce((cmd, ruleCmd) => cmd + ruleCmd.rollback, '')} \\} } e`];
    }
    return commandObj;
};

/**
 * Checks for any APM profiles that have been updated and then updates the virtuals
 * that refer to them
 * @param {object} context - the context object
 * @param {object} updateInfo - object containing the list of profiles that have been referenced
 *                              and the list of APM profiles that have been updated
 */
const getPostProcessAPMUpdates = function (context, updateInfo) {
    const commands = {};

    if (!updateInfo.apmProfileUpdates) {
        return commands;
    }

    commands.preTrans = [];

    function sortProfiles(profilePath, typeToSortLower) {
        if (updateInfo.apmProfileUpdates[profilePath].type === typeToSortLower) {
            return -1;
        }
        return 1;
    }
    function policiesFirst(profilePath) {
        return sortProfiles(profilePath, 'policy');
    }
    function profilesFirst(profilePath) {
        return sortProfiles(profilePath, 'profile');
    }

    // We have to delete APM policies first. Otherwise, if we delete a profile and there
    // is a policy then we get an error. But when we re-attach, we have to go profiles first.
    const profilePaths = Object.keys(updateInfo.apmProfileUpdates);
    profilePaths.sort(policiesFirst);

    commands.preTrans.push('set ::env(USER) $::env(REMOTEUSER)');
    profilePaths.forEach((profilePath) => {
        const profileInfo = updateInfo.apmProfileUpdates[profilePath];
        const tParam = profileInfo.type === 'policy' ? '-t access_policy' : '';
        const tenant = profileInfo.tenant;
        const profileName = profileInfo.oldName;
        const newProfileName = profileInfo.newName;
        const newProfilePath = newProfileName.startsWith('/Common') ? newProfileName : `/${tenant}/${newProfileName}`;

        // Replace the old profile with the new name so we can delete the old one
        if (updateInfo.profileReferences && updateInfo.profileReferences[profilePath]) {
            updateInfo.profileReferences[profilePath].virtuals.forEach((virtualPath) => {
                if (tParam) {
                    commands.preTrans.push(`tmsh::modify ltm virtual ${virtualPath} per-flow-request-access-policy ${newProfilePath}`);
                } else {
                    commands.preTrans.push(`tmsh::modify ltm virtual ${virtualPath} profiles delete \\{ ${profilePath} \\} profiles add \\{ ${newProfilePath} \\}`);
                }
            });

            // Modify the rule to point to the new rule name so that we can delete the old rule
            Object.keys(updateInfo.profileReferences[profilePath].iRules).forEach((iRule) => {
                const ruleText = updateInfo.profileReferences[profilePath].iRules[iRule];
                const ruleNameRegex = new RegExp(profileName, 'g');
                const updatedRule = ruleText.replace(ruleNameRegex, newProfileName);
                commands.preTrans.push(`tmsh::modify ltm rule ${iRule} { ${updatedRule} }`);
            });
        }

        commands.preTrans.push(`exec ng_profile -p ${tenant} ${tParam} -deleteall ${profileName}`);
        commands.preTrans.push(`exec ng_profile -p ${tenant} ${tParam} -copy ${newProfileName} ${profileName}`);

        // Point the rule back to the original name
        if (updateInfo.profileReferences && updateInfo.profileReferences[profilePath]) {
            Object.keys(updateInfo.profileReferences[profilePath].iRules).forEach((iRule) => {
                const ruleText = updateInfo.profileReferences[profilePath].iRules[iRule];
                commands.preTrans.push(`tmsh::modify ltm rule ${iRule} { ${ruleText} }`);
            });
        }
    });

    profilePaths.sort(profilesFirst);
    profilePaths.forEach((profilePath) => {
        const profileInfo = updateInfo.apmProfileUpdates[profilePath];
        const tParam = profileInfo.type === 'policy' ? '-t access_policy' : '';
        const tenant = profileInfo.tenant;
        const newProfileName = profileInfo.newName;
        const newProfilePath = newProfileName.startsWith('/Common') ? newProfileName : `/${tenant}/${newProfileName}`;

        if (updateInfo.profileReferences && updateInfo.profileReferences[profilePath]) {
            updateInfo.profileReferences[profilePath].virtuals.forEach((virtualPath) => {
                if (tParam) {
                    commands.preTrans.push(`tmsh::modify ltm virtual ${virtualPath} per-flow-request-access-policy ${profilePath}`);
                } else {
                    commands.preTrans.push(`tmsh::modify ltm virtual ${virtualPath} profiles delete \\{ ${newProfilePath} \\} profiles add \\{ ${profilePath} \\}`);
                }
            });
        }

        if (profileInfo.enable) {
            commands.preTrans.push(`tmsh::modify apm profile access ${profilePath} generation-action increment`);
        }

        commands.preTrans.push(`exec ng_profile -p ${tenant} ${tParam} -deleteall ${newProfileName}`);
    });

    return commands;
};

const mapEnabledDisabled = function (targetConfig) {
    if (util.isEnabledObject(targetConfig) || (targetConfig.enabled === '' && !targetConfig.disabled)) {
        targetConfig.enabled = '';
        delete targetConfig.disabled;
    } else {
        targetConfig.disabled = '';
        delete targetConfig.enabled;
    }
};

const mapExternalMonitor = function (diff, targetConfig, currentConfig) {
    const userDefined = targetConfig['user-defined'];
    if (typeof userDefined === 'object') {
        const currentMonitor = currentConfig[diff.path[0]];
        if (currentMonitor) {
            const entries = currentMonitor.properties['user-defined'];
            Object.keys(entries).forEach((key) => {
                if (typeof targetConfig['user-defined'][key] === 'undefined') {
                    targetConfig['user-defined'][key] = 'none';
                }
            });
        }

        targetConfig['user-defined'] = Object.keys(userDefined)
            .map((key) => `${key} ${userDefined[key]}`)
            .join(' user-defined ');
    }

    if (targetConfig['user-defined'] === '') {
        delete targetConfig['user-defined'];
    }
};

/**
 * return a TMSH cli-script command object to create a
 * config component
 *
 * @private
 * @param {object} context
 * @param {object} diff
 * @param {object} targetConfig
 * @returns {object} includes preTrans, commands, and rollback <string> arrays
 */
const tmshCreate = function (context, diff, targetConfig, currentConfig) {
    const instruction = `tmsh::create ${diff.rhsCommand}`;

    let escapeQuote = true;
    let regex;
    const commandObj = {
        preTrans: [],
        commands: [],
        postTrans: [],
        rollback: []
    };

    const pushMonitors = function (obj) {
        const objCopy = util.simpleCopy(obj);
        if (typeof objCopy.monitor === 'object') {
            if (objCopy.monitor.default === undefined) {
                if (objCopy.minimumMonitors === 'all') {
                    objCopy.monitor = `${Object.keys(objCopy.monitor).join(' and ')}`;
                } else {
                    objCopy.monitor = `min ${objCopy.minimumMonitors} of \\{ ${Object.keys(objCopy.monitor).join(' ')} \\}`;
                }
            } else {
                delete objCopy.monitor;
            }
        }
        delete objCopy.minimumMonitors;
        return objCopy;
    };

    const getCertValidatorConfig = function () {
        let modifyCommand;
        const issuer = targetConfig['issuer-cert'] || 'none';
        if (diff.kind === 'D' && diff.path.indexOf('issuer-cert') > -1) {
            modifyCommand = `tmsh::modify sys file ssl-cert ${diff.path[0]} issuer-cert none`;
        } else if (diff.kind === 'D' && diff.path.indexOf('cert-validators') > -1) {
            modifyCommand = `tmsh::modify sys file ssl-cert ${diff.path[0]} cert-validation-options none cert-validators none`;
        } else if ((targetConfig['cert-validation-options'] && targetConfig['cert-validators']
        && Object.keys(targetConfig['cert-validation-options']).length > 0) || targetConfig['issuer-cert']) {
            const validators = Object.keys(targetConfig['cert-validators']).length > 0 ? `cert-validators add \\{ ${Object.keys(targetConfig['cert-validators']).join(' ')} \\}` : '';
            const validOpts = Object.keys(targetConfig['cert-validation-options']).length > 0 ? 'cert-validation-options \\{ ocsp \\}' : '';
            modifyCommand = `tmsh::modify sys file ssl-cert ${diff.path[0]} ${validOpts} ${validators} issuer-cert ${issuer}`;
        }

        delete targetConfig.checksum;
        delete targetConfig['cert-validation-options'];
        delete targetConfig['cert-validators'];
        delete targetConfig['issuer-cert'];

        commandObj.commands = [`${instruction} ${diff.path[0]}${stringify(diff.rhsCommand, targetConfig, escapeQuote)}`, modifyCommand];
        return commandObj;
    };

    switch (diff.rhsCommand) {
    case 'auth partition':
        regex = /\//g;
        diff.path[0] = diff.path[0].replace(regex, '');
        if (diff.kind === 'E') {
            commandObj.commands = [`tmsh::modify ${diff.rhsCommand} ${diff.path[0]}${stringify(diff.rhsCommand, targetConfig, escapeQuote)}`];
            return commandObj;
        }
        break;
    case 'ltm data-group external':
        if (targetConfig['external-file-name']) {
            delete targetConfig.type;
        }
        break;
    case 'ltm dns cache transparent':
        if (typeof targetConfig['local-zones'] !== 'string') {
            let localZonesString = '';
            Object.keys(targetConfig['local-zones']).forEach((key) => {
                localZonesString += (`\\{${stringify(diff.rhsCommand, targetConfig['local-zones'][key], false)} \\} `);
            });
            targetConfig['local-zones'] = `\\{ ${localZonesString} \\}`;
        }
        break;
    case 'ltm dns cache resolver':
        if (typeof targetConfig['local-zones'] !== 'string') {
            let localZonesString = '';
            Object.keys(targetConfig['local-zones']).forEach((key) => {
                localZonesString += (`\\{${stringify(diff.rhsCommand, targetConfig['local-zones'][key], false)} \\} `);
            });
            targetConfig['local-zones'] = `\\{ ${localZonesString} \\}`;
        }
        if (targetConfig['forward-zones']) {
            Object.keys(targetConfig['forward-zones']).forEach((key) => {
                delete targetConfig['forward-zones'][key].name;
            });
        }
        break;
    case 'ltm dns cache validating-resolver':
        if (typeof targetConfig['local-zones'] !== 'string') {
            let localZonesString = '';
            Object.keys(targetConfig['local-zones']).forEach((key) => {
                localZonesString += (`\\{${stringify(diff.rhsCommand, targetConfig['local-zones'][key], false)} \\} `);
            });
            targetConfig['local-zones'] = `\\{ ${localZonesString} \\}`;
        }
        if (targetConfig['forward-zones']) {
            Object.keys(targetConfig['forward-zones']).forEach((key) => {
                delete targetConfig['forward-zones'][key].name;
            });
        }
        break;
    case 'ltm monitor ldap':
        if (targetConfig['filter-ldap'] !== undefined) {
            targetConfig.filter = targetConfig['filter-ldap'];
            delete targetConfig['filter-ldap'];
        }
        break;
    case 'ltm monitor sip':
        if (targetConfig.headers !== undefined) {
            targetConfig.headers = targetConfig.headers.replace(/\\\\/g, '\\');
        }
        delete targetConfig['filter-ldap'];
        break;
    case 'ltm monitor external':
        mapExternalMonitor(diff, targetConfig, currentConfig);
        break;
    case 'ltm node':
        // It is best to update metadata with a modify
        if (diff.kind === 'E') {
            // Copy config to avoid modifying objects outside the scope of this function
            const configCopy = util.simpleCopy(targetConfig);
            if (configCopy.fqdn) {
                delete configCopy.fqdn;
            }
            if (configCopy.address) {
                delete configCopy.address;
            }
            commandObj.commands = [`tmsh::modify ltm node ${diff.path[0]}${stringify(diff.rhsCommand, configCopy, escapeQuote)}`];
            return commandObj;
        }

        if (targetConfig.fqdn !== undefined && targetConfig.fqdn.tmName !== undefined) {
            targetConfig.fqdn.name = targetConfig.fqdn.tmName;
            delete targetConfig.fqdn.tmName;
        }
        // newly created /Common node, need to add metadata
        if (targetConfig.metadata === undefined && diff.path[0] === `/Common/${targetConfig.address}`) {
            targetConfig.metadata = {};
            targetConfig.metadata.references = {};
            targetConfig.metadata.references.value = 1;
        }
        break;
    case 'ltm pool':
        targetConfig = pushMonitors(targetConfig);
        // example [ '/tenant/app/pool', 'properties', 'monitor', '/Common/http' ]
        if (diff.path[2] === 'monitor') {
            commandObj.preTrans.push(`tmsh::modify ltm pool ${diff.path[0]} monitor none`);
            const rollbackMonitors = pushMonitors(currentConfig[diff.path[0]].properties).monitor;
            commandObj.rollback.push(`tmsh::modify ltm pool ${diff.path[0]} monitor ${rollbackMonitors}`);
        }
        if ((typeof targetConfig.members === 'object') && (targetConfig.members !== null)) {
            Object.keys(targetConfig.members).forEach((member) => {
                targetConfig.members[member] = pushMonitors(targetConfig.members[member]);
                if (typeof targetConfig.members[member].metadata === 'undefined') {
                    targetConfig.members[member].metadata = { source: { value: 'declaration' } };
                }
            });
        }
        if (diff.kind === 'D' && diff.path.find((p) => p === 'members')) {
            const memberName = diff.path[diff.path.indexOf('members') + 1];
            const currentMember = pushMonitors(currentConfig[diff.path[0]].properties.members[memberName]);
            commandObj.commands = [`tmsh::modify ltm pool ${diff.path[0]} members delete \\{ "${memberName}" \\}`];
            commandObj.rollback.push(`tmsh::modify ltm pool ${diff.path[0]} members add \\{ ${memberName} \\{${stringify(diff.rhsCommand, currentMember, true)} \\} \\}`);
            return commandObj;
        }
        break;
    case 'ltm policy':
        targetConfig.legacy = '';
        Object.keys(targetConfig.rules || {}).forEach((key) => {
            if (targetConfig.rules[key].conditions) {
                adjustPolicyStringObject(targetConfig.rules[key].conditions);
            }
            if (targetConfig.rules[key].actions) {
                adjustPolicyStringObject(targetConfig.rules[key].actions);
            }
        });
        targetConfig.requires = getPolicyRequires(targetConfig);
        targetConfig.controls = getPolicyControls(targetConfig);
        break;
    case 'ltm policy-strategy':
        adjustPolicyStringObject(targetConfig.operands);
        break;
    case 'ltm profile http-compression':
        if (typeof targetConfig['gzip-memory-level'] === 'number') {
            targetConfig['gzip-memory-level'] = `${targetConfig['gzip-memory-level']}k`;
        }
        if (typeof targetConfig['gzip-window-size'] === 'number') {
            targetConfig['gzip-window-size'] = `${targetConfig['gzip-window-size']}k`;
        }
        break;
    case 'ltm profile fix':
        if (typeof targetConfig['sender-tag-class'] === 'string') {
            if (targetConfig['sender-tag-class'] === '' || targetConfig['sender-tag-class'] === 'none') {
                targetConfig['sender-tag-class'] = 'none';
            }
        } else if (targetConfig['sender-tag-class'] === {} || !targetConfig['sender-tag-class'] || ['sender-tag-class'] === []) {
            targetConfig['sender-tag-class'] = 'none';
        } else {
            const keys = Object.keys(targetConfig['sender-tag-class']);
            let senderTagString = '';
            keys.forEach((key) => {
                senderTagString += (`\\{${stringify(diff.rhsCommand, targetConfig['sender-tag-class'][key], escapeQuote)} \\} `);
            });
            targetConfig['sender-tag-class'] = `\\{ ${senderTagString} \\}`;
        }
        break;
    case 'ltm profile tcp': {
        if (targetConfig['tcp-options'] !== 'none' && !targetConfig['tcp-options'].includes('"')) {
            const keyZero = `"${targetConfig['tcp-options']}"`;
            targetConfig['tcp-options'] = keyZero.replace(/{/g, '\\{').replace(/}/g, '\\}');
        }
        break;
    }
    case 'ltm rule':
        escapeQuote = false;
        // If we don't have a newline after the opening curly, leading comments are stripped
        targetConfig = ` {\n${targetConfig['api-anonymous']}\n}`;
        break;
    case 'ltm virtual-address': {
        const path = diff.path[0].split('/');
        path[path.length - 1] = path[path.length - 1].replace('Service_Address-', '');
        diff.path[0] = path.join('/');
        break;
    }
    case 'pem irule':
        escapeQuote = false;
        targetConfig = ` {\n${targetConfig['api-anonymous']}\n}`;
        break;
    case 'pem forwarding-endpoint':
        if (
            targetConfig.persistence
                && targetConfig.persistence['hash-settings']
                && targetConfig.persistence['hash-settings']['tcl-value']
        ) {
            const settings = targetConfig.persistence['hash-settings'];
            if (!settings['tcl-value'].match(/^".*"$/)) {
                settings['tcl-value'] = `"${settings['tcl-value']}"`;
            }
        }
        break;
    case 'pem reporting format-script':
        if (targetConfig.definition) {
            const noSlash = targetConfig.definition.replace(/\\/g, '');
            if (noSlash.charAt(0) !== '{' && noSlash.charAt(noSlash.length - 1) !== '}') {
                targetConfig.definition = `\\{ ${targetConfig.definition} \\}`;
            }
        }
        break;
    case 'sys file ssl-cert':
    case 'sys file ssl-key':
        if ((diff.kind === 'D' && diff.path.indexOf('issuer-cert') > -1)
        || (diff.kind === 'D' && diff.path.indexOf('cert-validators') > -1)
        || (targetConfig['cert-validation-options'] && targetConfig['cert-validators']
        && Object.keys(targetConfig['cert-validation-options']).length > 0) || targetConfig['issuer-cert']) {
            return getCertValidatorConfig();
        }

        delete targetConfig.checksum;
        delete targetConfig['cert-validation-options'];
        delete targetConfig['cert-validators'];
        delete targetConfig['issuer-cert'];

        break;
    case 'sys file data-group':
        if (diff.kind === 'E') {
            const modifyCommand = `tmsh::modify sys file data-group ${diff.path[0]} ${diff.path[diff.path.length - 1]} ${diff.rhs}`;
            commandObj.postTrans.push(modifyCommand);
            return commandObj;
        }
        break;
    case 'security log profile':
        if (targetConfig.application && Object.keys(targetConfig.application)[0]
        && !targetConfig.application[Object.keys(targetConfig.application)[0]]['filter replace-all-with']) {
            const name = Object.keys(targetConfig.application)[0];
            const key = Object.keys(targetConfig.application[name].filter)
                .filter((k) => k.includes('search'));
            const value = targetConfig.application[name].filter[key]
                ? Object.keys(targetConfig.application[name].filter[key].values) : [];
            value.forEach((k) => {
                targetConfig.application[name].filter[key].values[`"${k}"`] = targetConfig.application[name].filter[key].values[k];
                delete targetConfig.application[name].filter[key].values[k];
            });

            /* The replace-all-with is handled here because there are other
            properties for security log profile that have the property name filter
            and are type object whereas this is filter of type objArray */
            targetConfig.application[name]['filter replace-all-with'] = targetConfig.application[name].filter;
            delete targetConfig.application[name].filter;
        }
        break;
    case 'security ssh profile':
        Object.keys(targetConfig.rules || {}).forEach((key) => {
            Object.keys(targetConfig.rules[key]['identity-users'] || {}).forEach((user) => {
                if (!user.match(/^".*"$/)) {
                    targetConfig.rules[key]['identity-users'][`"${user}"`] = {};
                    delete targetConfig.rules[key]['identity-users'][user];
                }
            });
            Object.keys(targetConfig.rules[key]['identity-groups'] || {}).forEach((group) => {
                if (!group.match(/^".*"$/)) {
                    targetConfig.rules[key]['identity-groups'][`"${group}"`] = {};
                    delete targetConfig.rules[key]['identity-groups'][group];
                }
            });
        });
        break;
    case 'security firewall address-list':
        if (Object.keys(targetConfig.addresses || {}).length === 0
            && Object.keys(targetConfig.fqdns || {}).length === 0
            && Object.keys(targetConfig.geo || {}).length === 0
            && Object.keys(targetConfig['address-lists'] || {}).length === 0) {
            targetConfig.addresses = { '::1:5ee:bad:c0de': {} };
        }
        break;
    case 'net address-list':
        if (Object.keys(targetConfig.addresses || {}).length === 0
            && Object.keys(targetConfig.fqdns || {}).length === 0
            && Object.keys(targetConfig.geo || {}).length === 0
            && Object.keys(targetConfig['address-lists'] || {}).length === 0) {
            targetConfig.addresses = { '::1:5ee:bad:c0de': {} };
        }
        break;
    case 'asm policy': {
        let file = `/var/config/rest/downloads/${diff.path[0].split('/').pop()}.xml`;
        if (typeof diff.rhs.properties !== 'undefined' && typeof diff.rhs.properties.file !== 'undefined') {
            file = diff.rhs.properties.file;
        }

        const cmd = [];
        cmd.push(`tmsh::load asm policy ${diff.path[0]} file ${file} overwrite`);
        cmd.push(`tmsh::modify asm policy ${diff.path[0]} active`);
        cmd.push(`tmsh::publish asm policy ${diff.path[0]}`);

        commandObj.commands = cmd;
        return commandObj;
    }
    case 'apm policy access-policy':
    case 'apm profile access': {
        const tParam = (diff.rhsCommand === 'apm policy access-policy') ? ' -t access_policy' : '';
        const cmd = [];
        const path = diff.path[0];
        const partition = path.split('/')[1];
        if (diff.rhs.properties && diff.rhs.properties.iControl_postFromRemote
            && (partition !== 'Common' || (partition === 'Common' && context.tasks[context.currentIndex].firstPassNoDelete))) {
            const profileName = path.split('/').pop();
            const type = diff.rhs.properties.iControl_postFromRemote.get.path.includes('.tar.gz') ? '.tar.gz' : '.tar';
            const file = `/var/config/rest/downloads/${profileName}${type}`;
            const uuid = context.tasks[context.currentIndex].uuid;
            const newName = `${profileName}_${uuid}_appsvcs`;

            // We import twice here. Once so we for sure have a profile name that matches what a virtual wants
            // and again with a known unique suffix. This is because APM post-fixes a counter onto the names
            // if the profile already exists and we need a way to find the right profile in the post all tenant
            // updates. See getPostProcessAPMUpdates()
            cmd.push('set ::env(USER) $::env(REMOTEUSER)');

            const profiles = util.getDeepValue(
                context.tasks[context.currentIndex],
                `metadata.${partition}._apmProfilesAlreadyInTenant`
            ) || [];
            if (profiles.indexOf(profileName) === -1) {
                // If profile is not in the tenant import it into the tenant
                cmd.push(`exec ng_import${tParam} ${file} ${profileName} -p ${partition}`);
            }
            cmd.push(`exec ng_import${tParam} ${file} ${newName} -p ${partition}`);

            const eventInfo = {
                uuid,
                newName,
                oldName: profileName,
                enable: targetConfig.enable,
                tenant: partition,
                type: tParam ? 'policy' : 'profile'
            };
            context.request.eventEmitter.emit(constants.EVENTS.APM_PROFILE_UPDATED, eventInfo);
        }
        if (cmd.length > 0) {
            commandObj.commands = cmd;
        }
        return commandObj;
    }
    case 'sys config merge file': {
        let datagroupName = diff.path[0].split('/');
        datagroupName = `SD_${datagroupName[datagroupName.length - 1]}`;
        commandObj.commands = [
            `tmsh::load sys config merge file ${diff.rhs.properties.filePath}`,
            `tmsh::create ltm data-group internal /Common/${constants.as3CommonFolder}/${datagroupName} description ' ' type string`,
            `tmsh::create ltm data-group internal /Common/${constants.as3CommonFolder}/${datagroupName}_disabled description ' ' type string`,
            `catch { tmsh::create sys folder /Common/${constants.as3CommonFolder} } err`
        ];
        return commandObj;
    }
    case 'pem policy':
        Object.keys(targetConfig.rules || {}).forEach((key) => {
            if (typeof targetConfig.rules[key]['modify-http-hdr'] !== 'undefined'
                    && typeof targetConfig.rules[key]['modify-http-hdr'].tmName !== 'undefined') {
                targetConfig.rules[key]['modify-http-hdr'].name = targetConfig.rules[key]['modify-http-hdr'].tmName;
                delete targetConfig.rules[key]['modify-http-hdr'].tmName;
            }
            if (typeof targetConfig.rules[key]['tcl-filter'] !== 'undefined') {
                targetConfig.rules[key]['tcl-filter'] = `\\{ ${targetConfig.rules[key]['tcl-filter']} \\}`;
            }
        });
        break;
    case 'gtm wideip a':
    case 'gtm wideip aaaa':
    case 'gtm wideip cname':
    case 'gtm wideip mx': {
        if (util.isEmptyOrUndefined(targetConfig.pools)) {
            targetConfig.pools = 'none';
        }

        if (util.isEmptyOrUndefined(targetConfig['last-resort-pool']) || targetConfig['last-resort-pool'] === 'none') {
            delete targetConfig['last-resort-pool'];
        }

        if (util.isEmptyOrUndefined(targetConfig.aliases) || targetConfig.aliases === 'none') {
            targetConfig.aliases = 'none';
        } else {
            const keys = Object.keys(targetConfig.aliases);
            const aliases = {};
            keys.forEach((key) => {
                if (key.indexOf('"') === -1) {
                    aliases[`"${key.replace(/\x3f/g, '\\?').replace(/\x2a/g, '\\*')}"`] = {};
                } else {
                    aliases[key] = {};
                }
            });
            targetConfig.aliases = aliases;
        }

        // gtm has enabled and disabled as separate properties instead of a toggle
        // script expects a string value of enabled or disabled
        mapEnabledDisabled(targetConfig);

        // wideip paths are appended with resourceRecordType to keep from overwriting in the diff
        let path = diff.path[0];
        const pathSplit = path.split(' ');
        if (pathSplit.length === 2) {
            path = pathSplit[0];
        }

        // domain names can contain wildcard chars * ?
        // backslashes must also be escaped
        path = util.getWideIpPath(path);
        commandObj.commands = [`${instruction} ${path}${stringify(diff.rhsCommand, targetConfig, escapeQuote)}`];
        return commandObj;
    }
    case 'gtm region':
        if (util.isEmptyOrUndefined(targetConfig['region-members']) || targetConfig['region-members'] === 'none') {
            targetConfig['region-members'] = 'none';
        } else {
            const parsedMembers = {};
            Object.keys(targetConfig['region-members']).forEach((memberKey) => {
                parsedMembers[memberKey] = '';
            });
            targetConfig['region-members'] = parsedMembers;
        }
        break;
    case 'gtm rule':
        escapeQuote = false;
        // If we don't have a newline after the opening curly, leading comments are stripped
        targetConfig = ` {\n${targetConfig['api-anonymous']}\n}`;
        break;
    case 'gtm topology': {
        const commands = [];
        Object.keys(targetConfig.records).forEach((recordKey) => {
            commands.push(`${instruction} ${stringify('gtm topology records', targetConfig.records[recordKey], escapeQuote)}`);
        });

        context.tasks[context.currentIndex].gtmTopologyProcessed = true;
        commandObj.commands = commands;
        return commandObj;
    }
    case 'gtm global-settings load-balancing': {
        commandObj.commands = [`${instruction} ${stringify(diff.rhsCommand, targetConfig, escapeQuote)}`];
        return commandObj;
    }
    case 'gtm server':
        mapEnabledDisabled(targetConfig);
        Object.keys(targetConfig['virtual-servers'] || {}).forEach((vsKey) => {
            mapEnabledDisabled(targetConfig['virtual-servers'][vsKey]);
        });
        break;
    case 'gtm datacenter':
        mapEnabledDisabled(targetConfig);
        break;
    case 'gtm pool a':
    case 'gtm pool aaaa':
    case 'gtm pool mx':
    case 'gtm pool cname':
        mapEnabledDisabled(targetConfig);
        Object.keys(targetConfig.members || {}).forEach((memKey) => {
            mapEnabledDisabled(targetConfig.members[memKey]);
        });
        break;
    case 'gtm prober-pool':
        Object.keys(targetConfig.members || {}).forEach((memKey) => {
            mapEnabledDisabled(targetConfig.members[memKey]);
        });
        mapEnabledDisabled(targetConfig);
        break;
    case 'gtm monitor external':
        mapExternalMonitor(diff, targetConfig, currentConfig);
        break;
    case 'ltm profile analytics': {
        const captureFilterArrays = ['virtual-servers', 'node-addresses', 'response-codes', 'methods', 'url-path-prefixes', 'user-agent-substrings', 'client-ips'];
        captureFilterArrays.forEach((arr) => {
            if (util.isEmptyObject(targetConfig['traffic-capture']['capture-for-f5-appsvcs'][arr])) {
                targetConfig['traffic-capture']['capture-for-f5-appsvcs'][arr] = 'none';
            }
        });
        const create = [`${instruction} ${diff.path[0]}${stringify(diff.rhsCommand, targetConfig, escapeQuote)}`];
        captureFilterArrays.forEach((arr) => {
            create[0] = create[0].replace(`${arr} \\{`, `${arr} replace-all-with \\{`);
        });
        commandObj.commands = create;
        return commandObj;
    }
    case 'ltm virtual': {
        mapEnabledDisabled(targetConfig);
        break;
    }
    default:
    }

    commandObj.commands = [`${instruction} ${diff.path[0]}${stringify(diff.rhsCommand, targetConfig, escapeQuote)}`];
    return commandObj;
}; // tmshCreate()

/**
 * return a TMSH cli-script command to delete a config
 * component
 *
 * @private
 * @param {object} context
 * @param {object} diff
 * @returns {string[]}
 */
const tmshDelete = function (context, diff, currentConfig) {
    const commandObj = {
        preTrans: [],
        commands: [],
        postTrans: [],
        rollback: []
    };
    let path = diff.path[0];
    const deleteCommand = `tmsh::delete ${diff.lhsCommand} ${path}`;

    switch (diff.lhsCommand) {
    case 'auth partition':
        if (diff.kind === 'E') {
            // Modifies are handled in tmshCreate
            return commandObj;
        }
        commandObj.commands = [`tmsh::delete sys folder ${path}`];
        return commandObj;
    case 'ltm policy':
        commandObj.commands = [
            `tmsh::modify ltm policy ${path} legacy rules none strategy best-match`,
            deleteCommand
        ];
        return commandObj;
    case 'ltm virtual':
        commandObj.commands.push(deleteCommand);

        // If we are deleting a virtual, see if we are modifying a destination from a Common virtual address.
        // If so, attempt to delete that as well. It may be referenced by another virtual, so ignore
        // errors
        if (typeof diff.lhs === 'string' && diff.lhs.startsWith('/Common/')) {
            let fromAddress = ipUtil.splitAddress(diff.lhs.substring('/Common/'.length))[0];
            fromAddress = ipUtil.parseIpAddress(fromAddress);
            const toDelete = context.host.parser.virtualAddressList.find(
                (addr) => {
                    // Only touch virtual addresses that we created
                    if (addr.metadata && addr.metadata.some((md) => md.name === 'references')) {
                        let virtualAddress = ipUtil.splitAddress(addr.fullPath.substring('/Common/'.length))[0];
                        virtualAddress = ipUtil.parseIpAddress(virtualAddress);
                        return fromAddress.ipWithRoute === virtualAddress.ipWithRoute;
                    }
                    return false;
                }
            );
            if (toDelete) {
                commandObj.commands.push(`catch { tmsh::delete ltm virtual-address ${toDelete.fullPath} } e`);
            }
        }
        return commandObj;
    case 'ltm virtual-address':
        path = path.split('/');
        path[path.length - 1] = path[path.length - 1].replace('Service_Address-', '');
        path = path.join('/');
        commandObj.commands = [`tmsh::delete ${diff.lhsCommand} ${path}`];
        return commandObj;
    case 'ltm node':
        if (diff.kind === 'E') {
            // Modifies are handled in tmshCreate
            return commandObj;
        }
        if (diff.kind === 'D' && diff.path.length === 1 && path.split('/')[1] === 'Common'
            && !context.tasks[context.currentIndex].firstPassNoDelete) {
            // A static node can fail to be deleted if an FQDN node has resolved to the
            // pre-existing static node's IP and attached it to a pool. This is only an issue in
            // Common because we handle deletions in a separate pass.
            commandObj.postTrans = [`catch { ${deleteCommand} } e`];
        } else {
            commandObj.commands = [deleteCommand];
        }
        return commandObj;
    case 'security firewall rule-list':
        if (diff.lhs && diff.lhs.properties && diff.lhs.properties.rules) {
            return getRuleCommands(deleteCommand, diff.lhs.properties.rules, 'securityFirewall');
        }
        break;
    case 'pem policy':
        if (diff.lhs && diff.lhs.properties && diff.lhs.properties.rules) {
            return getRuleCommands(deleteCommand, diff.lhs.properties.rules, 'pemPolicy');
        }
        break;
    case 'apm policy access-policy':
    case 'apm profile access': {
        const tParam = (diff.lhsCommand === 'apm policy access-policy') ? ' -t access_policy' : '';
        commandObj.commands = [
            'set ::env(USER) $::env(REMOTEUSER)',
            `exec ng_profile${tParam} -p ${diff.path[0].split('/')[1]} -deleteall ${diff.path[0].split('/').pop()}`
        ];
        return commandObj;
    }
    case 'sys config merge file': {
        path = path.split('/');
        const datagroupName = `SD_${path[path.length - 1]}`;
        path.splice(-1, 1);
        path = path.join('/');
        commandObj.commands = [
            `tmsh::delete sys icall handler periodic ${path}/${diff.lhs.properties.scriptName}`,
            `tmsh::delete sys icall script ${path}/${diff.lhs.properties.scriptName}`,
            `tmsh::delete ltm data-group internal /Common/${constants.as3CommonFolder}/${datagroupName}`,
            `tmsh::delete ltm data-group internal /Common/${constants.as3CommonFolder}/${datagroupName}_disabled`
        ];
        return commandObj;
    }
    case 'sys log-config publisher':
        commandObj.commands = [`tmsh::modify sys log-config publisher ${path} destinations none`];
        if (diff.kind === 'D' && diff.path.length === 1) {
            // Only if deleting the entire publisher, does the delete needs to be in the postTrans
            commandObj.postTrans = [deleteCommand];
        } else {
            // Otherwise it needs to be in the transaction
            commandObj.commands.push(deleteCommand);
        }
        return commandObj;
    case 'sys file data-group':
        if (diff.kind !== 'E') {
            commandObj.commands = [
                deleteCommand,
                `tmsh::delete ltm data-group external ${path}`
            ].join('\n');
            return commandObj;
        }
        return commandObj;
    case 'gtm wideip a':
    case 'gtm wideip aaaa':
    case 'gtm wideip cname':
    case 'gtm wideip mx': {
        const pathSplit = path.split(' ');
        if (pathSplit.length === 2) {
            path = pathSplit[0];
        }
        path = util.getWideIpPath(path);
        commandObj.commands = [`tmsh::delete ${diff.lhsCommand} ${path}`];
        return commandObj;
    }
    case 'gtm region': {
        if (diff.lhs && diff.lhs.properties && Object.keys(diff.lhs.properties['region-members']).some((x) => x.includes('region'))) {
            commandObj.preTrans.push(deleteCommand);
            const desiredConfig = util.simpleCopy(currentConfig[path].properties);
            Object.keys(desiredConfig['region-members']).forEach((prop) => {
                desiredConfig['region-members'][prop] = '';
            });
            const createCommand = `tmsh::create ${diff.lhsCommand} ${path}${stringify(diff.lhsCommand, desiredConfig, true)}`;
            commandObj.rollback.push(createCommand);
        } else {
            commandObj.commands.push(deleteCommand);
        }
        return commandObj;
    }
    case 'gtm topology': {
        // items would need to be reordered whenever there is an update
        // order is read-only so delete them all
        // also reset longest-match to default
        commandObj.commands = [
            `tmsh::delete ${diff.lhsCommand} all`,
            'tmsh::modify gtm global-settings load-balancing topology-longest-match yes'
        ];
        return commandObj;
    }
    case 'gtm global-settings load-balancing':
        // set things back to default
        commandObj.commands = [`tmsh::modify ${diff.lhsCommand} topology-longest-match yes`];
        return commandObj;
    default:
    }
    commandObj.commands = deleteCommand;
    return commandObj;
}; // tmshDelete()

const generateiControl = function (properties) {
    if (typeof properties.iControl_postFromRemote !== 'undefined') {
        return {
            command: 'iControl_postFromRemote',
            properties: properties.iControl_postFromRemote
        };
    }
    if (typeof properties.iControl_post !== 'undefined') {
        return {
            command: 'iControl_post',
            properties: properties.iControl_post
        };
    }
    return null;
};

/*
 * Kind N - indicates a newly added property/element
 * Kind D - indicates a property/element was deleted
 * Kind E - indicates a property/element was edited
 * Kind A - indicates a change occurred within an array
 */

const generate = function (context, diff, desiredConfig, currentConfig) {
    const updates = {
        preTrans: [],
        commands: [],
        postTrans: [],
        rollback: [],
        iControlCalls: [],
        whitelistFiles: []
    };
    let targetConfig;

    function concatCommands(newCommands) {
        // This avoids concatinating undefines or empty strings into the arrays
        if (newCommands.preTrans) {
            updates.preTrans = updates.preTrans.concat(newCommands.preTrans);
        }
        if (newCommands.commands) {
            updates.commands = updates.commands.concat(newCommands.commands);
        }
        if (newCommands.postTrans) {
            updates.postTrans = updates.postTrans.concat(newCommands.postTrans);
        }
        if (newCommands.rollback) {
            updates.rollback = updates.rollback.concat(newCommands.rollback);
        }
    }

    const preCreate = function () {
        targetConfig = desiredConfig[diff.path[0]].properties || {};
        let diffProps = null;
        if (diff.rhs) {
            diffProps = diff.rhs.properties;
            if (!diffProps) {
                const property = diff.path[diff.path.length - 1];
                diffProps = {};
                diffProps[property] = diff.rhs;
            }
        }
        if (diffProps) {
            if (diffProps.iControl_postFromRemote || diffProps.iControl_post) {
                log.debug({ message: 'iControl command', data: diff.path });
                updates.iControlCalls.push(generateiControl(diffProps));
            }
            if (diffProps.filePath) {
                log.debug(`Adding whitelist file: ${diffProps.filePath}`);
                updates.whitelistFiles.push(diffProps.filePath);
            }
            if (diff.rhsCommand === 'sys config merge file' && diffProps.edit) {
                diff.lhsCommand = diff.rhsCommand;
                diff.lhs = diff.rhs;
                concatCommands(tmshDelete(context, diff, currentConfig));
            }
        }
    };

    switch (diff.kind) {
    case 'N':
        if (diff.path.length > 1) {
            concatCommands(tmshDelete(context, diff, currentConfig));
        }
        preCreate();
        concatCommands(tmshCreate(context, diff, targetConfig, currentConfig));
        break;
    case 'D':
        concatCommands(tmshDelete(context, diff, currentConfig));
        if (diff.path.length > 1) {
            preCreate();
            concatCommands(tmshCreate(context, diff, targetConfig, currentConfig));
        }
        break;
    case 'E':
        concatCommands(tmshDelete(context, diff, currentConfig));
        preCreate();
        concatCommands(tmshCreate(context, diff, targetConfig, currentConfig));
        break;
    case 'A':
        concatCommands(tmshDelete(context, diff, currentConfig));
        preCreate();
        concatCommands(tmshCreate(context, diff, targetConfig, currentConfig));
        break;
    default:
    }
    updates.preTrans = updates.preTrans.join('\n');
    updates.commands = updates.commands.join('\n');
    updates.postTrans = updates.postTrans.join('\n');
    updates.rollback = updates.rollback.join('\n');
    return updates;
};

module.exports = {
    generate,
    stringify,
    tmshCreate,
    getRuleCommands,
    getPostProcessAPMUpdates,
    tmshDelete
};

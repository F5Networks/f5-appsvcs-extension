/**
 * Copyright 2022 F5 Networks, Inc.
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

const dns = require('dns');
const log = require('../log');
const util = require('./util');

/**
 * return a promise to check whether the given
 * domain name (hostname) can be resolved to an
 * IP address (using the default resolver).
 * This can often though not certainly distinguish
 * a target host name from a Tenant name.
 * Resolves to an IP address, or empty string
 * upon any failure (this Promise never rejects).
 *
 * @public
 * @param {string} domain
 * @returns {Promise}
 */
const resolveDomainToIp = function (domain) {
    if (typeof domain !== 'string') {
        return Promise.resolve('');
    }
    if (domain.toLowerCase() === 'localhost') {
        // avoid any bad interaction with dns.ADDRCONFIG
        return Promise.resolve('127.0.0.1');
    }
    if (domain.includes(':')
            || domain.match(/^([0-9]{1,3}[.]){3}[0-9]{1,3}(%[0-9]+)?$/)) {
        // exact validity of IP address is checked elsewhere
        return Promise.resolve(domain);
    }

    return new Promise((resolve) => {
        dns.lookup(domain, { hints: dns.ADDRCONFIG }, (err, addr) => {
            if ((err && typeof err === 'object') && (err.code !== '')) {
                resolve('');
                return;
            }
            resolve(addr);
        });
    });
}; // resolveDomainToIp()

const setAuthzToken = function (context) {
    const duration = 1200;
    const task = context.tasks[context.currentIndex];
    let token;
    let millisecs;
    let current;
    let born;
    let timeout;

    if (task.protocol === 'http') {
        return Promise.resolve(true);
    }

    return resolveDomainToIp(task.targetHost)
        .then((ip) => {
            if (ip === '') {
                const e = new Error(`cannot resolve targetHost '${task.targetHost}' to IP address`);
                e.statusCode = 404;
                throw e;
            }

            token = task.targetTokens['X-F5-Auth-Token'];

            const opts = {};
            if ((typeof token !== 'string') || !token.length) {
                opts.path = '/mgmt/shared/authn/login';
                opts.why = 'use basic credentials to get authN token and user info';
                opts.method = 'POST';
                opts.send = JSON.stringify({
                    username: task.targetUsername,
                    password: task.targetPassphrase,
                    loginProviderName: 'tmos'
                });
            } else {
                opts.path = `/mgmt/shared/authz/tokens/${token}`;
                opts.why = 'learn existing authN token age and user info';
                opts.method = 'GET';
            }

            context.control = task;
            return util.iControlRequest(context, opts);
        })
        .then((resp) => {
            const x = resp;
            token = x.token;
            if (typeof token === 'object' && token.token) {
                token = x.token.token;
            }
            task.targetTokens = { 'X-F5-Auth-Token': token };

            // token issue time property is 'iat' on BIG-IQ and 'startTime' on BIG-IP
            born = Math.trunc(Date.parse(x.startTime) / 1000);
            timeout = x.timeout;

            // can start using new token right away
            const opts = {};
            opts.path = '/mgmt/tm/sys/clock';
            opts.why = 'get device current time';
            opts.method = 'GET';
            context.control = task;
            return util.iControlRequest(context, opts);
        })
        .then((resp) => {
            const k = Object.keys(resp.entries);
            millisecs = Date.parse(resp.entries[k[0]].nestedStats.entries.fullDate.description);
            task.timeSlip = millisecs - Date.now();
            current = Math.trunc(millisecs / 1000);

            const age = current - born;
            timeout += 15; // avert trivial extension requests
            if ((timeout - age >= duration) || (born === 0)) {
            // token is young enough for us or from BIG-IQ, which does not allow extension
                return Promise.resolve({ token });
            }

            log.info('extend authz token timeout');
            const opts = {};
            opts.path = `/mgmt/shared/authz/tokens/${token}`;
            opts.why = 'request to extend authN token timeout';
            opts.method = 'PATCH';
            opts.send = JSON.stringify({
                timeout: (duration + age)
            });
            context.control = task;
            return util.iControlRequest(context, opts);
        })
        .then((resp) => {
            if (typeof resp.token !== 'string') {
                const e = new Error(`unrecognized response ${JSON.stringify(resp)}`);
                e.statusCode = 404;
                throw e;
            }
            if (resp.token !== 'none') {
                log.debug(`got token for ${task.targetUsername}@${task.targetHost}`);
            }
            return true;
        })
        .catch((e) => {
            log.info(e);
            return false;
        });
};

module.exports = {
    resolveDomainToIp,
    setAuthzToken
};

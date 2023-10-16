/**
 * Copyright 2023 F5, Inc.
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
const path = require('path');
const u = require('url');
const execFile = require('child_process').execFile;
const net = require('net');

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const log = require('../log');
const DEFAULT_PORT = require('../constants').defaultPort;
const STATUS_CODES = require('../constants').STATUS_CODES;

const tracerTags = require('../tracer').Tags;

// Global cached AS3 version
let as3Version = null;

class Util {
    /**
     * return a copy of a simple object, defined as
     * one that doesn't blow up JSON.stringify()
     *
     * @public
     * @param {object} obj
     * @returns {object}
     */
    static simpleCopy(obj) {
        let cpy;
        try {
            cpy = JSON.parse(JSON.stringify(obj));
        } catch (e) {
            // TODO:  should we throw() here?
            return undefined;
        }
        return cpy;
    } // simpleCopy()

    static shallowCopy(obj) {
        return Object.assign({}, obj);
    }

    static toCamelCase(string) {
        return string.replace(/-[a-z]/g, (x) => x[1].toUpperCase());
    }

    /**
     * return a string wrapped in double quotes if it contains space(s)
     * does not check if already wrapped with double quotes
     * @public
     * @param {string} string
     * @returns {string}
     */
    static wrapStringWithSpaces(string) {
        return (typeof string === 'string' && string.includes(' ') ? `"${string}"` : string);
    }

    /**
     * convert base64 to a Buffer even on older
     * versions of node.js as found on older TMOS
     *
     * @public
     * @param {string|Buffer} input - of base64
     * @returns {Buffer}
     */
    static fromBase64(input) {
        if ((typeof Buffer.from === 'function')
                    && (Buffer.from !== Uint8Array.from)) {
            return Buffer.from(input, 'base64');
        }
        /* eslint-disable-next-line no-buffer-constructor */
        return new Buffer(input, 'base64');
    } // fromBase64()

    /**
     * given a URL redact any obvious password in
     * it to yield a string which should appear in
     * log messages in lieu of the original URL
     *
     * @public
     * @param {string} url - typically a URL which may contain credentials
     * @returns {string} - string to use in log messages rather than url
     */
    static redactURL(url) {
        return url.replace(/(https?:\x2f\x2f[^:]*:)[^@]*@/, '$1XXXXXX@');
    } // redactURL()

    /**
     * given http(s) 'url' and optional 'options' (partly
     * for copying into http.request options), return a
     * promise to perform an HTTP request, perhaps after
     * following redirects.  Options may include 'timeout'
     * (default 5 seconds), 'maxRedirects' (default 5),
     * 'why' (default ""), 'crude' (default false), and
     * 'headers' (defaults: 'Accept-Encoding' = "identity"
     * and 'User-Agent' = "f5-appsvcs/3.0").  Options
     * may also include 'method' (default GET) and 'send'
     * (request-body as string or Buffer, default none);
     * other options are passed to http.request.  Upon
     * 2xx success, if !options.crude then resolves to
     * text response as a string (after charset conversion)
     * or octet-stream as a Buffer; if options.crude then
     * regardless of HTTP status resolves to an object
     * with members 'statusCode', 'statusMessage', 'headers',
     * and 'body'.  Otherwise rejects with an error.  Set
     * 'options.why' to a string like "for /T/A/myrule" to
     * answer the question "why are we making this request?"
     *
     * @public
     * @param {string} url - http(s) URL
     * @param {object} [options] - options
     * @param {string} [options.why=""] - answer to "why are we requesting this?"
     * @param {boolean} [options.crude=false] - if true, return object for any response
     * @param {string} [options.method="GET"] - HTTP method
     * @param {number} [options.timeout=30] - connection timeout (seconds)
     * @param {number} [options.maxRedirects=5] - max HTTP redirects to follow
     * @param {number} [options.retry503=0] - if not 0 treat 503 like 307 plus retry-after delay,
     *                                          value is default delay
     * @param {number} [options.retryNetError=3] - number of times to retry on network error
     *                                             (ECONNREFUSED, etc)
     * @param {number} [options.retryNetErrorDelay=1000] - number of ms to wait between retries on
     *                                                     network error
     * @param {string|Buffer} [options.send=""] - HTTP request body, if any
     * @param {object} [options.headers] - HTTP headers to add to request
     * @param {object} [options.tokens] - authN/Z headers (sent only to first host)
     * @param {boolean} [options.rejectUnauthorized=true] - if false accept any HTTPS cert
     * @param {boolean} [options.range=false] - if true add Content-Range headers to POST/PATCH
     * @returns {Promise} - resolves to [string|Buffer|object], depending
     */
    static httpRequest(url, options) {
        if (typeof url !== 'string') {
            const e = new Error('httpRequest(): url string required');
            e.code = 400;
            return Promise.reject(e);
        }
        if (arguments.length < 2) { options = {}; }
        const opts = this.shallowCopy(options);

        const logurl = this.redactURL(url);

        let why = (Object.prototype.hasOwnProperty.call(opts, 'why') ? opts.why : '').concat('\x20');
        if (why.charAt(0) !== '\x20') { why = '\x20'.concat(why); }

        function retry(resolve, reject, reason, message) {
            const newOptions = this.simpleCopy(opts);
            newOptions.retryNetError = opts.retryNetError - 1;
            log.debug(`request failed due to ${reason} - retrying - ${message}`);
            promiseUtil.delay(opts.retryNetErrorDelay)
                .then(() => this.httpRequest(url, newOptions))
                .then(resolve)
                .catch(reject);
        }

        // return the promised promise
        return new Promise((resolve, reject) => {
            let sendSize = 0;
            let reqOpts;
            let e;

            try {
                reqOpts = u.parse(url);
            } catch (e1) {
                e1.message = `cannot parse url ${logurl}${why
                }(${e1.message})`;
                e1.code = 400;
                reject(e1);
                return;
            }
            const host = reqOpts.host;
            if ((typeof host !== 'string') || (host === '')) {
                e = new Error(`url ${logurl}${why}must include host`);
                e.code = 400;
                reject(e);
                return;
            }
            if ((typeof reqOpts.protocol !== 'string')
                        || !reqOpts.protocol.match(/^https?:/)) {
                e = new Error(`url ${logurl}${why}protocol must be http(s)`);
                e.code = 400;
                reject(e);
                return;
            }

            if (typeof opts.method !== 'string') {
                opts.method = 'GET';
            }
            if ((typeof opts.timeout !== 'number') || !opts.timeout) {
                opts.timeout = 30;
            }
            if (typeof opts.maxRedirects !== 'number') {
                opts.maxRedirects = 5;
            }
            if (typeof opts.retry503 !== 'number') {
                opts.retry503 = 0;
            } else if (opts.maxRedirects < 1) { opts.maxRedirects = 2; }
            if (typeof opts.crude !== 'boolean') {
                opts.crude = false;
            }
            if ((typeof opts.headers !== 'object') || (opts.headers === null)) {
                opts.headers = {};
            }
            if ((typeof opts.tokens !== 'object') || (opts.tokens === null)) {
                opts.tokens = {};
            }
            if ((typeof opts.send !== 'undefined')
                        && (['GET', 'HEAD'].indexOf(opts.method) < 0)) {
                // wish we could use 'instanceOf' here
                sendSize = Buffer.byteLength(opts.send);

                opts.headers['Content-Length'] = sendSize.toString();

                if ((typeof opts.range === 'boolean')
                        && opts.range && (opts.method !== 'PUT')) {
                    opts.headers['Content-Range'] = `0-${sendSize - 1
                    }/${sendSize}`;
                }

                // when opts.send is a Buffer (e.g., to
                // hold binary data like an image) we expect
                // caller to squeeze the air out of it (i.e.,
                // not create Buffer(1024) to store 372 bytes)
            }
            if (typeof opts.headers['Accept-Encoding'] !== 'string') {
                opts.headers['Accept-Encoding'] = 'identity';
            }
            if (typeof opts.headers['User-Agent'] !== 'string') {
                opts.headers['User-Agent'] = 'f5-appsvcs/3.0';
            }
            if (typeof opts.retryNetError !== 'number') {
                opts.retryNetError = 3;
            }
            if (typeof opts.retryNetErrorDelay !== 'number') {
                opts.retryNetErrorDelay = 1000;
            }
            Object.keys(opts).forEach((prop) => {
                if (Object.keys.hasOwnProperty.call(opts, prop)) {
                    if (['send', 'crude', 'why', 'timeout', 'tokens'].indexOf(prop) < 0) {
                        reqOpts[prop] = this.simpleCopy(opts[prop]);
                    }
                }
            });
            Object.keys(opts.tokens).forEach((prop) => {
                if (Object.prototype.hasOwnProperty.call(opts.tokens, prop)) {
                    reqOpts.headers[prop] = opts.tokens[prop];
                }
            });

            reqOpts.agent = false;

            const pkg = (reqOpts.protocol === 'http:') ? require('http') : require('https'); // eslint-disable-line global-require
            const req = pkg.request(reqOpts);

            // the WWW groans under the weight of advice to use
            // req_options.timeout instead of request.setTimeout()
            // but in practice only request.setTimeout() actually
            // works when the server doesn't respond to the initial
            // SYN.  If we use both then something in the mephitic
            // bowels of node.js sets two(!) timers and we get two
            // events, but if we set only req_options.timeout we
            // get zero events.  Timeout is 10 seconds to avoid race
            // conditions between iApp startup and ICR endpoint startup
            // during bigip restarts and reboots [Buries face in hands.]
            //
            req.setTimeout(opts.timeout * 1000);

            req.on('response', (rsp) => {
                const chunks = [];

                rsp.on('data', (chunk) => { chunks.push(chunk); });

                rsp.on('end', () => {
                    let lcn;
                    let redirOpts;
                    let newhost;
                    let sameHost;
                    let pause = 0;
                    let statusCode = (typeof rsp.statusCode === 'number') ? rsp.statusCode : 500;

                    const getRspBody = function () {
                        const ctype = (Object.prototype.hasOwnProperty.call(rsp.headers, 'content-type'))
                            ? rsp.headers['content-type'] : 'application/octet-stream';
                        let body = '';
                        if (chunks.length) {
                            const buffer = Buffer.concat(chunks);

                            if (ctype.match(/charset=iso/i)) {
                                // 'binary' here means 'iso-8859-1' [eyes roll]
                                body = buffer.toString('binary');
                            } else {
                                body = buffer; // NOT a string
                            }
                        }
                        return body;
                    };

                    rsp.headers = rsp.headers || {};

                    if ((statusCode === 503) && opts.retry503) {
                        pause = opts.retry503;
                        if (Object.prototype.hasOwnProperty.call(rsp.headers, 'retry-after')) {
                            pause = parseInt(rsp.headers['retry-after'], 10);
                            if (isNaN(pause) || (pause < 2) || (pause > (opts.retry503 << 2))) { // eslint-disable-line no-restricted-globals, no-bitwise, max-len
                                pause = opts.retry503;
                            }
                        }
                        rsp.headers.location = url;
                        statusCode = 307;
                    }
                    if ([301, 302, 303, 307, 308].indexOf(statusCode) >= 0) {
                        lcn = rsp.headers.location;
                        if ((opts.maxRedirects < 1) || !Object.prototype.hasOwnProperty.call(rsp.headers, 'location')
                            || (lcn === '')) {
                            const e1 = new Error(`got unwanted redirect${why}from ${host}`);
                            e1.code = 400;
                            reject(e1);
                            return;
                        }

                        try {
                            redirOpts = u.parse(lcn);
                        } catch (e1) {
                            e1.message = `got invalid redirect location${why}from ${host} (${e1.message})`;
                            e1.code = 400;
                            reject(e1);
                            return;
                        }
                        if ((typeof redirOpts.protocol === 'string')
                                && !redirOpts.protocol.match(/^https?:/)) {
                            e = new Error(`got non-http(s) redirect${
                                why}from ${host}`);
                            e.code = 400;
                            reject(e);
                            return;
                        }
                        if (typeof redirOpts.protocol !== 'string') {
                            redirOpts.protocol = reqOpts.protocol;
                        }
                        if (typeof redirOpts.host !== 'string') {
                            redirOpts.host = reqOpts.host;
                        }
                        newhost = redirOpts.host.toLowerCase();
                        sameHost = (newhost === '') || (newhost === host.toLowerCase());

                        const newOptions = {};
                        Object.keys(opts).forEach((prop) => {
                            if (Object.prototype.hasOwnProperty.call(opts, prop)) {
                                if (prop === 'tokens' && !sameHost) {
                                    newOptions[prop] = {};
                                } else {
                                    newOptions[prop] = this.simpleCopy(opts[prop]);
                                }
                            }
                        });
                        newOptions.method = (statusCode === 303) ? 'GET' : opts.method;
                        newOptions.maxRedirects = (opts.maxRedirects - 1);
                        newOptions.why = why.trim();

                        const need = ['protocol', 'host'];
                        if (sameHost) { need.push('auth'); }
                        for (let i = 0; i < need.length; i += 1) {
                            if (!Object.prototype.hasOwnProperty.call(redirOpts, need[i])
                                || !redirOpts[need[i]]) {
                                redirOpts[need[i]] = this.simpleCopy(reqOpts[need[i]]);
                            }
                        }

                        let newUrl;
                        try {
                            newUrl = u.format(redirOpts);
                        } catch (e1) {
                            e1.message = `got invalid redirect Location${why}from ${host} (${e1.message})`;
                            e1.code = 400;
                            reject(e1);
                            return;
                        }
                        /** ***
                        log.debug('following ' + statusCode + ' from ' +
                                        logurl + ' to ' + lcn + why);
                        **** */

                        // get another promise for redirect
                        if (pause) {
                            return new Promise((resolve1) => { // eslint-disable-line consistent-return
                                setTimeout(resolve1, (pause << 10)); // eslint-disable-line no-bitwise
                            })
                                .then(() => this.httpRequest(newUrl, newOptions))
                                .then((rslt) => resolve(rslt))
                                .catch((e1) => reject(e1));
                        }
                        return this.httpRequest(newUrl, newOptions) // eslint-disable-line consistent-return
                            .then((rslt) => resolve(rslt))
                            .catch((e1) => reject(e1));
                    } if (!opts.crude
                            && ([200, 201, 202, 203, 204, 206, 207].indexOf(statusCode) < 0)) {
                        // ignore error doc if any
                        e = new Error(`${opts.method}\x20${logurl
                        }${why}response=${statusCode} body=${getRspBody()}`);
                        e.code = 400;
                        reject(e);
                        return;
                    }
                    // otherwise, success (or close enough)

                    const body = getRspBody();

                    if (opts.crude) {
                        const obj = {
                            statusCode,
                            statusMessage: rsp.statusMessage,
                            headers: rsp.headers,
                            body
                        };
                        resolve(obj);
                    } else {
                        resolve(body);
                    }
                });
            });

            req.on('timeout', () => {
                log.info('Received timeout event');

                const timedOutError = new Error('timed out');
                timedOutError.code = STATUS_CODES.GATEWAY_TIMEOUT;

                // req.destroy causes the 'error' event to be emitted, so retry will happen there
                req.destroy(timedOutError);
            });

            req.on('error', (e1) => {
                e1.message = `${opts.method} ${logurl}${why}failed (${e1.message})`;
                log.info(`Received error event: ${e1.message}`);

                if (opts.retryNetError) {
                    retry.call(this, resolve, reject, 'network error', e1.message);
                    return;
                }

                log.error(e1.message);
                reject(e1);
            });

            if (sendSize > 0) {
                req.write(opts.send);
            }

            /** ***
            log.debug("will try to " + opts.method + " " + logurl + why);
            **** */
            req.end(); // now send query
        });
    } // httpRequest()

    /**
     * given a url (either http(s): or file:) and
     * optionally some options, return a promise to
     * load a JSON document (such as a schema).  You
     * don't have to provide options unless you want
     * to control timeout or redirects when loading
     * from an http(s) url (see httpRequest() for
     * details).  However, if possible 'options.why'
     * should be a string like "load AS3 schema" to
     * help answer the question "why are we making
     * this request?"
     *
     * @public
     * @param {string} source - URL/filename from which to load JSON
     * @param {object} [options] - options (see httpRequest() for most)
     * @param {string} [options.why=""] - answer to "why are we fetching this?"
     * @returns {Promise} - resolves to object (parsed from JSON text)
     */
    static loadJSON(source, options) {
        if (arguments.length < 1) {
            const e = new Error('source required as first argument');
            e.code = 400;
            return Promise.reject(e);
        }
        if (arguments.length < 2) { options = {}; }
        const opts = this.simpleCopy(options);

        const logurl = this.redactURL(source);

        let why = (Object.prototype.hasOwnProperty.call(opts, 'why') ? opts.why : '').concat('\x20');
        if (why.charAt(0) !== '\x20') { why = '\x20'.concat(why); }

        let parts;

        try {
            parts = u.parse(source);
        } catch (e) {
            e.message = `cannot parse source/URL ${logurl}${why
            }(${e.message})`;
            e.code = 400;
            return Promise.reject(e);
        }
        if ((parts.protocol === null) && (parts.pathname !== null)) {
            parts.protocol = 'file:';
        } else if ((typeof parts.protocol !== 'string')
                    || !parts.protocol.match(/^(file|https?):/)) {
            const e = new Error(`url${why
            }protocol must be http(s): or file:`);
            e.code = 400;
            return Promise.reject(e);
        }
        if (parts.protocol === 'file:') {
            let raw;
            try {
                raw = fs.readFileSync(parts.pathname, 'utf8');
            } catch (e) {
                e.message = `failed to load JSON from file ${
                    parts.pathname}${why}(${e.message})`;
                e.code = 400;
                return Promise.reject(e);
            }

            /** ***
            log.debug("loaded " + raw.length +
                        " chars of JSON from file " + parts.pathname + why);
            **** */
            let json;
            try {
                json = JSON.parse(raw);
            } catch (e) {
                e.message = `could not parse JSON from file ${
                    parts.pathname}${why}(${e.message})`;
                e.code = 400;
                return Promise.reject(e);
            }
            return Promise.resolve(json);
        }
        if (typeof opts.headers !== 'object') {
            opts.headers = {};
        }
        if (typeof opts.headers.Accept !== 'string') {
            opts.headers.Accept = 'application/json,'
                                                + 'text/plain;q=0.2';
        }
        if (typeof opts.headers['Accept-Charset'] !== 'string') {
            opts.headers['Accept-Charset'] = 'utf-8,us-ascii;q=0.9';
        }
        /** ***
            log.debug("will load JSON from url " + logurl + why);
            **** */

        // httpRequest() promises to do the grunt work
        return this.httpRequest(logurl, opts) // eslint-disable-line consistent-return
            .catch((e) => {
                e.message = `failed to load JSON from url ${
                    logurl}${why}(${e.message})`;
                e.code = 400;
                return Promise.reject(e);
            })
            .then((raw) => {
                /** ***
                log.debug("loaded " + raw.length +
                                " chars of JSON from " + logurl + why);
                **** */
                let json;
                try {
                    json = JSON.parse(raw);
                } catch (e) {
                    e.message = `could not parse JSON from url ${
                        logurl}${why}(${e.message})`;
                    e.code = 400;
                    return Promise.reject(e);
                }
                return json;
            });
    } // loadJSON()

    /**
     * return a promise to make an iControl REST request to
     * a BIG-IP.  Promise resolves to an object representing
     * the JSON reply
     *
     * @public
     * @param {object} context - full AS3 context object
     * @param {object} options - options (NOT the same as httpRequest options!)
     * @param {string} options.path - iControl REST path, NOT including URL prefix
     * @param {string} [options.why=""] - explains this request in logs
     * @param {string} [options.method="GET"] - HTTP method
     * @param {string|Buffer} [options.send=""] - data to send (request body)
     * @param {string} [options.ctype] - overrides controls.headers["Content-Type"]
     * @param {boolean} [crude=false] - make crude httpRequest, pass reply through
     * @returns {Promise} - resolves to object from BIG-IP JSON response
     */
    static iControlRequest(context, options) {
        if ((typeof context !== 'object') || (context === null)) {
            return Promise.reject(new Error('iControlRequest(): argument context required'));
        }
        if ((typeof options !== 'object') || (options === null) || (typeof options.path !== 'string')) {
            return Promise.reject(new Error('iControlRequest(): options.path required'));
        }

        let traceSpan;
        if (context.request && context.request.tracer) {
            traceSpan = context.request.tracer.startChildSpan(
                'util.iControlRequest',
                context.request.rootSpan,
                {
                    tags: {
                        [tracerTags.HTTP.METHOD]: options.method || 'GET',
                        [tracerTags.HTTP.PATH]: options.path
                    }
                }
            );
        }

        const controls = this.simpleCopy(context.control);
        const tokens = this.getTargetTokens(context, context.currentIndex);

        let port = controls.targetPort || DEFAULT_PORT;
        if (context.target && context.target.port) {
            port = context.target.port;
        }

        const reqOpts = {
            rejectUnauthorized: false,
            maxRedirects: 0,
            retry503: 4,
            retryNetError: options.retryNetError,
            retryNetErrorDelay: options.retryNetErrorDelay,
            headers: { 'Content-Type': 'application/json' },
            range: true,
            timeout: (options.targetTimeout || 60),
            crude: false
        };

        let url = context.tasks[context.currentIndex].urlPrefix + options.path;
        const tokenExists = (tokens && typeof tokens['X-F5-Auth-Token'] === 'string');
        // Some users (e.g. LDAP) require the use of a token.
        function isNotSafeAuth() {
            if (port === 8100) return false;
            if (options.path === '/mgmt/shared/authn/login') return false;
            if (options.path.indexOf('/mgmt/shared/authz/tokens') > -1) return false;
            return !tokens['X-F5-Auth-Token'];
        }

        if (isNotSafeAuth()) {
            log.warning('Attempting iControl call without auth token');
        }

        function useAuthToken() {
            const notLocalPort8100 = port !== 8100;
            const isBigIqDeployUrl = url.includes('/mgmt/cm/global/');
            return tokenExists && (notLocalPort8100 || isBigIqDeployUrl);
        }

        function useBasicAuth() {
            // make sure if token is specified, we don't add basic auth headers
            // basicAuth value in that case would be user without password
            return !tokenExists;
        }

        // favor tokens over basic auth (faster)
        if (useAuthToken()) {
            reqOpts.tokens = tokens;
        } else if (useBasicAuth()) {
            reqOpts.headers.Authorization = this.getDeepValue(context, 'request.basicAuth');
        }
        // replace username in url prefix to enable RBAC on BIG-IQ
        if (url.includes('/mgmt/cm/global/')) {
            const targetUsername = this.getDeepValue(context, 'declaration.targetUsername') || controls.targetUsername;
            url = url.replace('admin:@', `${targetUsername}:@`);
        }

        // log.error(`iControl PORT ${controls.targetPort} URL: ${url}
        // HEADER ${JSON.stringify(reqOpts.headers)} TOKEN ${JSON.stringify(reqOpts.tokens)}`);

        ['why', 'method', 'send', 'crude', 'tokens'].forEach((p) => {
            if (typeof options[p] !== 'undefined') {
                reqOpts[p] = options[p];
            }
        });
        if (typeof options.ctype === 'string') {
            reqOpts.headers['Content-Type'] = options.ctype;
        }
        if (options.referer) {
            reqOpts.headers.Referer = options.referer;
        }

        return this.httpRequest(url, reqOpts)
            .then((rslt) => {
                if (reqOpts.crude) {
                    return rslt; // caller will interpret
                }
                if ((typeof rslt === 'string') && (rslt.length === 0)) {
                    return {}; // iCR 'DELETE' returns empty
                }

                let obj;
                try {
                    obj = JSON.parse(rslt);
                } catch (e) {
                    e.message = `cannot parse response from ${
                        this.redactURL(url)} (${e.message})`;
                    if (traceSpan) {
                        traceSpan.logError(e);
                        traceSpan.finish();
                    }
                    throw e;
                }

                // iCR will set 'code' in an unsuccessful response
                if ((obj.code === undefined) || (Math.trunc(obj.code / 100) === 2)) {
                    return obj;
                }
                // otherwise

                // TODO:  perhaps caller would prefer an Error object?
                return Promise.reject(obj);
            })
            .then((result) => {
                if (traceSpan) {
                    traceSpan.finish();
                }
                return result;
            });
    } // iControlRequest()

    /**
     * return a promise to execute a bash command on a BIG-IP.
     *
     * @public
     * @param {object} context - info needed to access target BIG-IP
     * @param {string} command - bash command to execute
     * @param {object} options - options (NOT the same as httpRequest options!)
     * @param {string} [options.why=""] - explains this request in logs
     * @returns {Promise} - resolves to a string containing the command output
     */
    static executeBashCommand(context, command, options) {
        options = options || {};
        options.path = '/mgmt/tm/util/bash';
        options.method = 'POST';
        options.ctype = 'application/json';
        options.why = options.why || 'execute bash command';
        options.send = JSON.stringify({
            command: 'run',
            utilCmdArgs: `-c "${command}"`
        });
        return this.iControlRequest(context, options)
            .then((results) => results.commandResult);
    }

    /**
     * Return a promise to execute a bash command on a BIG-IP using
     * child-process.execFile.  Runs wherever AS3 is running!
     *
     * @public
     * @param {string} command - bash command to execute
     * @returns {Promise} - resolves to a string containing the command output
     */
    static executeBashCommandExec(command) {
        return new Promise((resolve, reject) => {
            const splitCommand = command.split(' ');
            execFile(splitCommand.shift(), splitCommand, (error, stdout) => {
                if (error !== null) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * return a promise to discover all the ltm nodes
     * on a BIG-IP.  Promise resolves to an array
     * (possibly empty) of objects describing nodes,
     * or rejects with error.  The objects in the array
     * all have property 'key' which holds either the
     * IP address or FQDN of the node.  The array is
     * sorted lexicographically on 'key' to enable
     * rapid searching.
     *
     * @public
     * @param {object} controls - info needed to access target BIG-IP
     * @returns {Promise}
     */
    static getNodelist(context) {
        const opts = {
            path: '/mgmt/tm/ltm/node?options=recursive',
            why: 'query target BIG-IP current ltm node list'
        };

        return this.iControlRequest(context, opts)
            .then((resp) => {
                const list = [];

                if (!Object.prototype.hasOwnProperty.call(resp, 'items')
                    || !Array.isArray(resp.items) || (resp.items.length < 1)) {
                    return list;
                }

                resp.items.forEach((item) => {
                    const node = {
                        fullPath: item.fullPath,
                        partition: item.partition,
                        ephemeral: (item.ephemeral === 'true'),
                        metadata: item.metadata,
                        commonNode: item.partition === 'Common' && item.subPath !== 'Shared'
                    };

                    if ((typeof item.fqdn === 'object')
                        && Object.prototype.hasOwnProperty.call(item.fqdn, 'tmName')
                            && (item.fqdn.tmName !== '')) {
                        Object.assign(node, item);
                        node.domain = item.fqdn.tmName;
                        node.ephemeral = (item.ephemeral === 'true');
                        node.key = (node.ephemeral) ? item.address : item.name;
                    } else {
                        node.domain = '';
                        node.key = item.address; // we rely on TMOS to minimizeIP() this
                    }

                    list.push(node);
                });

                list.sort((a, b) => ((a.key < b.key) ? -1 : ((a.key > b.key) ? 1 : 0))); // eslint-disable-line no-nested-ternary, max-len

                return list;
            });
    } // getNodelist()

    /**
     * return a promise to discover all the ltm virtual-address
     * object on a BIG-IP.  Promise resolves to an array
     * (possibly empty) of objects describing virtual-addresses,
     * or rejects with error.
     *
     * virtualAddressObj:
     *      address: "address"
     *      fullPath: "/P/F/N"
     *      partition: "P"
     *
     * @public
     * @param {object} context - info needed to access target BIG-IP
     * @param {string} [tenant] - optional tenant to limit query to
     * @returns {Promise}
     */
    static getVirtualAddressList(context, tenant) {
        const filter = tenant ? `$filter=partition+eq+${tenant}&` : '';
        const opts = {
            path: `/mgmt/tm/ltm/virtual-address?${filter}$select=fullPath,partition,address,metadata`,
            why: 'query target BIG-IP current ltm virtual-address list'
        };

        return this.iControlRequest(context, opts)
            .then((resp) => {
                const list = [];

                if (!Object.prototype.hasOwnProperty.call(resp, 'items')
                    || !Array.isArray(resp.items) || (resp.items.length < 1)) {
                    return list;
                }

                resp.items.forEach((item) => {
                    const virtualAddress = {
                        fullPath: item.fullPath,
                        partition: item.partition,
                        address: item.address,
                        metadata: item.metadata || []
                    };

                    list.push(virtualAddress);
                });

                return list;
            });
    } // getVirtualAddressList()

    /**
     * return a promise to discover all the ltm address-list
     * objects on a BIG-IP.  Promise resolves to an array
     * (possibly empty) of objects describing address-lists,
     * or rejects with error.
     *
     * virtualAddressObj:
     *      address: "address"
     *      fullPath: "/P/F/N"
     *      partition: "P"
     *
     * @public
     * @param {object} context - info needed to access target BIG-IP
     * @param {string} [tenant] - optional tenant to limit query to
     * @returns {Promise}
     */
    static getAddressListList(context, tenant) {
        if (this.versionLessThan(this.getDeepValue(context, 'target.tmosVersion'), '14.1')) {
            return Promise.resolve([]);
        }

        const filter = tenant ? `$filter=partition+eq+${tenant}&` : '';
        const opts = {
            path: `/mgmt/tm/net/address-list?${filter}$select=fullPath,partition,addresses,addressLists`,
            why: 'query target BIG-IP current ltm virtual-address list'
        };

        return this.iControlRequest(context, opts)
            .then((resp) => {
                const list = [];

                if (!Object.prototype.hasOwnProperty.call(resp, 'items')
                    || !Array.isArray(resp.items) || (resp.items.length < 1)) {
                    return list;
                }

                resp.items.forEach((item) => {
                    const addressList = {
                        fullPath: item.fullPath,
                        partition: item.partition,
                        addresses: item.addresses,
                        addressLists: item.addressLists || []
                    };

                    list.push(addressList);
                });

                return list;
            });
    }

    /**
     * return a promise to discover all the apm profile access
     * objects on a BIG-IP.  Promise resolves to an array
     * (possibly only the default /Common/access) describing
     * the profiles or rejects with error.
     *
     * accessProfileObj:
     *      fullPath: "/P/F/N"
     *      partition: "P"
     *      type: "type"
     *
     * @public
     * @param {object} context - info needed to access target BIG-IP
     * @returns {Promise}
     */
    static getAccessProfileList(context) {
        if ((typeof context !== 'object') || (context === null)) {
            return Promise.reject(new Error('getAccessProfileList(): argument context required'));
        }

        if (!this.isOneOfProvisioned(context.target, ['apm'])) {
            return Promise.resolve([]);
        }

        const opts = {
            path: '/mgmt/tm/apm/profile/access?$select=fullPath,partition,type',
            why: 'query target BIG-IP current apm profile access list'
        };

        return this.iControlRequest(context, opts)
            .then((resp) => {
                const list = [];

                if (!Object.prototype.hasOwnProperty.call(resp, 'items')
                    || !Array.isArray(resp.items) || (resp.items.length < 1)) {
                    return list;
                }

                resp.items.forEach((item) => {
                    const accessProfile = {
                        fullPath: item.fullPath,
                        partition: item.partition,
                        type: item.type
                    };

                    list.push(accessProfile);
                });

                return list;
            });
    } // getAccessProfileList()

    /**
     * return a promise to discover all the ltm snatpool
     * objects on a BIG-IP.  Promise resolves to an array
     * (possibly empty) of objects describing snatpools,
     * or rejects with error.
     *
     * @public
     * @param {object} context - info needed to access target BIG-IP
     * @param {string} [tenant] - optional tenant to limit query to
     * @returns {Promise}
     */
    static getSnatPoolList(context, tenant) {
        if ((typeof context !== 'object') || (context === null)) {
            return Promise.reject(new Error('getSnatPoolList(): argument context required'));
        }

        const filter = tenant ? `$filter=partition+eq+${tenant}&` : '';
        const opts = {
            path: `/mgmt/tm/ltm/snatpool?${filter}$select=fullPath,partition,members`,
            why: 'query target BIG-IP current ltm snatpool list'
        };

        return this.iControlRequest(context, opts)
            .then((resp) => {
                const list = [];

                if (!Object.prototype.hasOwnProperty.call(resp, 'items')
                    || !Array.isArray(resp.items) || (resp.items.length < 1)) {
                    return list;
                }

                resp.items.forEach((item) => {
                    const snatPool = {
                        fullPath: item.fullPath,
                        partition: item.partition,
                        members: item.members || []
                    };

                    list.push(snatPool);
                });

                return list;
            });
    }

    /**
     * return a promise to discover all the ltm snat-translation
     * objects on a BIG-IP.  Promise resolves to an array
     * (possibly empty) of objects describing snat-translations,
     * or rejects with error.
     *
     * @public
     * @param {object} context - info needed to access target BIG-IP
     * @param {string} [tenant] - optional tenant to limit query to
     * @returns {Promise}
     */
    static getSnatTranslationList(context, tenant) {
        if ((typeof context !== 'object') || (context === null)) {
            return Promise.reject(new Error('getSnatPoolList(): argument context required'));
        }

        const filter = tenant ? `$filter=partition+eq+${tenant}&` : '';
        const opts = {
            path: `/mgmt/tm/ltm/snat-translation?${filter}$select=fullPath,partition,address`,
            why: 'query target BIG-IP current ltm snatpool list'
        };

        return this.iControlRequest(context, opts)
            .then((resp) => {
                const list = [];

                if (!Object.prototype.hasOwnProperty.call(resp, 'items')
                        || !Array.isArray(resp.items) || (resp.items.length < 1)) {
                    return list;
                }

                resp.items.forEach((item) => {
                    list.push(this.simpleCopy(item));
                });

                return list;
            });
    }

    /**
     * return a promise to query AS3 version info.
     * Fetches version from a cached variable or
     * /var/config/rest/iapps/f5-appsvcs/version file
     * depending if cached or not
     *
     * @public
     * @returns {Promise}
     */
    static getVersionOfAS3() {
        return new Promise((resolve, reject) => {
            if (as3Version === null) {
                fs.readFile(path.join(__dirname, '..', 'version'), 'ascii', (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const dataArray = data.split('-');
                    as3Version = {
                        version: dataArray[0],
                        release: dataArray[1]
                    };
                    resolve(as3Version);
                });
            } else {
                resolve(as3Version);
            }
        });
    } // getVersionOfAS3()

    /**
     * binary-search sorted array 'a', return index of
     * target or -1 if not found.  Caller must supply a
     * comparison function that accepts a single argument
     * ('X' in this discussion) which will be one element
     * of 'a'.  The comparison function must return a
     * number less than zero if the target's sort value
     * is less than that of X, zero if they are equal, or
     * greater than zero if the target has a greater sort
     * value than X.  (The comparison function is assumed
     * to have independent knowledge of the target value.)
     *
     * @public
     * @param {Array} a - array to search, must be sorted
     * @param {function} compare - comparison function(X)
     * @returns {number}
     */
    static binarySearch(a, compare) {
        let lo = 0;
        let hi = a.length - 1;
        let mid;
        let c;

        while (lo <= hi) {
            mid = Math.trunc((lo + hi) / 2);
            c = compare(a[mid]);
            if (c < 0) {
                hi = mid - 1;
            } else if (c > 0) {
                lo = mid + 1;
            } else {
                return mid;
            }
        }
        return -1;
    } // binarySearch()

    /**
     * given an AJV error object, return a message
     * which helps the customer understand the problem
     *
     * TODO: add more special cases, maybe?
     *
     * TODO: internationalization (i18n is a sure cure for ennui!)
     *
     * @public
     * @param {object} err - AJV error object
     * @returns {string}
     */
    static formatAjvErr(err) {
        let msg = typeof err.dataPath === 'undefined' ? 'unknown data path: ' : `${err.dataPath}: `;
        let tmp;

        switch (err.keyword || 'unk') {
        case 'pattern':
            if (Object.prototype.hasOwnProperty.call(err, 'propertyName')) {
                msg += `propertyName ${JSON.stringify(err.propertyName)}`;
            } else {
                msg += `data ${JSON.stringify(err.data)}`;
            }
            msg += ` ${err.message}`;
            break;
        case 'enum':
            msg += `${err.message} ${JSON.stringify(err.params.allowedValues)}`;
            break;
        case 'const':
            msg += `${err.message} ${JSON.stringify(err.params.allowedValue)}`;
            break;
        case 'not':
            tmp = err.schemaPath.split('/');
            if (tmp.length > 1) {
                tmp.pop();
                msg += `${tmp.pop()} is NOT valid`;
                break;
            }
            // otherwise fall-through to...
        default: // eslint-disable-line no-fallthrough
            msg += err.message;
            break;
        }
        return msg;
    } // formatAjvErr()

    /**
     * return the BIG-IP config pathname for some item
     *
     * @public
     * @param {string} tenantId - name of Tenant
     * @param {string} appId - name of Application
     * @param {string} itemId - name of item
     * @returns {string}
     */
    static mcpPath(tenantId, appId, itemId) {
        if (appId) {
            return ['', tenantId, appId, itemId].join('/');
        }

        return ['', tenantId, itemId].join('/');
    }

    /**
     * given an object and the name of one of its properties
     * which is an array, replace that array with a new object
     * having keys equal to the elements of the array.  Return
     * the modified source object
     *
     * @public
     * @param {object} obj
     * @param {string} prop
     * @returns {object}
     */
    static arrToObj(obj, prop) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop)
            || !Array.isArray(obj[prop]) || !obj[prop].length) {
            return obj;
        }

        const newObj = {};
        obj[prop].forEach((item) => {
            newObj[item] = {};
        });
        obj[prop] = newObj;
        return obj;
    } // arrToObj()

    /**
     * given an object and the name of one of its properties
     * which is an object, replace that object with a new array
     * having elements equal to the values of the object.  Return
     * the modified source object
     *
     * @public
     * @param {object} obj
     * @param {string} prop
     * @returns {object}
     */
    static objToArr(obj, prop) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop)
            || typeof obj[prop] !== 'object' || obj[prop] === null) {
            return obj;
        }

        obj[prop] = Object.keys(obj[prop]).map((k) => obj[prop][k]);
        return obj;
    }

    /**
     * Returns true if v1 is less than v2. v1 and v2 should
     * be strings with numbers and periods only.  Will return
     * null if v1 and v2 are not properly formatted strings.
     *
     * @public
     * @param {string} v1
     * @param {string} v2
     * @returns {boolean}
     */
    static versionLessThan(v1, v2) {
        const regex = /([0-9][0-9.]+)/;

        if (typeof v1 !== 'string' || typeof v2 !== 'string'
            || !regex.test(v1) || !regex.test(v2)) {
            log.error('Values passed to versionLessThan must be strings with numbers and periods only!');
            return null;
        }

        const v1Ara = v1.split('.');
        const v2Ara = v2.split('.');

        let i;
        for (i = 0; i < v1Ara.length; i += 1) {
            v1Ara[i] = parseInt(v1Ara[i], 10);
        }
        for (i = 0; i < v2Ara.length; i += 1) {
            v2Ara[i] = parseInt(v2Ara[i], 10);
        }

        return this.versionLessThanRecurse(v1Ara, v2Ara, 0);
    }

    static versionLessThanRecurse(v1Ara, v2Ara, i) {
        if (i >= v1Ara.length) {
            if (i >= v2Ara.length) {
                return false; // equal
            }
            if (v2Ara[i] !== 0) {
                return true; // v1 less than v2
            }
            i += 1;
            return this.versionLessThanRecurse(v1Ara, v2Ara, i);
        }
        if (i >= v2Ara.length) {
            if (v1Ara[i] !== 0) {
                return false; // v1 greater than v2
            }
            i += 1;
            return this.versionLessThanRecurse(v1Ara, v2Ara, i);
        }
        if (v1Ara[i] > v2Ara[i]) {
            return false; // v1 greater than v2
        }
        if (v1Ara[i] < v2Ara[i]) {
            return true; // v1 less than v2
        }
        if (v2Ara[i] === v1Ara[i]) {
            i += 1;
            return this.versionLessThanRecurse(v1Ara, v2Ara, i);
        }
        log.error('Error occurred while comparing bigip versions!');
        return null;
    }

    /**
     * Recursively traverses an object and returns an array of
     * keys in relation to the top of the object. Allows filtering
     * results by optionally including "all", "objects", or "other".
     * Note: Does not include keys with value of "undefined"
     *
     * @public
     * @param {object} obj
     * @param {string} [include=all] - Type of keys to include in results
     * @returns {string[]}
     */
    static getDeepKeys(obj, include) {
        let keys = [];
        const incl = include || 'all';
        Object.keys(obj).forEach((key) => {
            const type = typeof obj[key];
            if (type !== 'undefined' && (incl === 'all' || (type === 'object' && incl === 'objects')
               || (type !== 'object' && incl === 'other'))) {
                keys.push(key);
            }
            if (type === 'object') {
                const subkeys = this.getDeepKeys(obj[key]);
                keys = keys.concat(subkeys.map((subkey) => `${key}.${subkey}`));
            }
        });
        return keys;
    }

    /**
     * Traverses object and returns target value. Arrays are supported.
     * Returns undefined if value cannot be reached.
     *
     * @public
     * @param {object} obj - Object to traverse
     * @param {string|array} propertyPath - period-separated path to property or array of path segments
     * @param {string} pathDelimiter - optional alternative to using periods to separate path segments
     * @returns {*} - target value
     */
    static getDeepValue(obj, propertyPath, pathDelimiter) {
        if (!obj) {
            return undefined;
        }

        let pathComponents;
        if (Array.isArray(propertyPath)) {
            pathComponents = propertyPath;
        } else if (typeof propertyPath === 'string') {
            pathComponents = propertyPath.split(pathDelimiter || '.');
        } else {
            return undefined;
        }

        const nextSource = pathComponents[0] === '' ? obj : obj[pathComponents[0]];

        if (pathComponents.length === 1) {
            return nextSource;
        }

        const nextPath = pathComponents.slice(1);
        return this.getDeepValue(nextSource, nextPath);
    }

    /**
     * Traverses object and creates path structure along the way.
     * Sets last property in the path to target value.
     * Assumes that if any property in the path is a stringified integer,
     * it should create an array for that property instead of an object.
     *
     * @public
     * @param {object} obj - Object to traverse
     * @param {string} propertyPath - dot separated path to property
     * @param {*} val - value to set at end of path
     * @returns {obj} - original object, used for chaining
     */
    static setDeepValue(obj, propertyPath, val) {
        const pathComponents = propertyPath.split('.');

        pathComponents.reduce((subObj, prop, idx, array) => {
            if (typeof subObj[prop] === 'undefined' && idx < pathComponents.length - 1) {
                // create array instead of object if the next property is a positive whole number
                subObj[prop] = /^\d+$/.test(array[idx + 1]) ? [] : {};
            } else if (idx === pathComponents.length - 1) {
                subObj[prop] = val;
            }
            return subObj[prop];
        }, obj);

        return obj;
    }

    /**
     * Gets the names of the objects in a declaration that have a given class
     *
     * @param {object} declaration - The declaration.
     * @param {string} className - The name of the class for which we want the objects (for example, 'Application')
     *
     * @returns {string[]} The list of object names that have the given class.
     */
    static getObjectNameWithClassName(declaration, className) {
        return Object.keys(declaration).find((key) => declaration[key].class === className);
    }

    /**
     * Recursive function to find and replace strings within an
     * object. Modifies the passed in object.
     *
     * @public
     * @param {object} obj Object to traverse
     * @param {string} oldString String to replace
     * @param {string} newString Replacement string
     */
    static stringReplace(obj, oldString, newString) {
        Object.keys(obj).forEach((key) => {
            if (typeof obj[key] === 'object') {
                this.stringReplace(obj[key], oldString, newString);
            } else if (typeof obj[key] === 'string' && obj[key] === oldString) {
                obj[key] = newString;
            }
        });
    }

    static unescapeDoubleSlashCurly(string) {
        return string ? string.replace(/\\\\([{}])/g, '\\$1') : string;
    }

    static unescapeDoubleSlashQuote(string) {
        return string ? string.replace(/\\\\(["])/g, '\\$1') : string;
    }

    static escapeTcl(tclString) {
        const tclCharacters = ['\\$', '\\[', '\\]', '\\{', '\\}', '\\;'];
        const re = new RegExp(`(${tclCharacters.join('|')})`, 'g');
        return tclString.replace(/\n/g, ';')
            .replace(/\s*\}/g, ' }')
            .replace(/\s*\{/g, ' {')
            .replace(re, '\\$1')
            .replace(/  +/g, ' ');
    }

    static convertTtlToHourMinSec(ttl) {
        const d = new Date(1000 * (ttl || 0));
        return (d.getUTCHours() ? `${d.getUTCHours()}:` : '')
                + (d.getUTCHours() || d.getMinutes() ? `${d.getMinutes()}:` : '') + d.getSeconds();
    }

    /**
     * Encode utf8 string to base64
     *
     * @public
     * @param {string} str - utf8 string to encode
     * @returns {string} - base64 encoded string
     */
    static base64Encode(str) {
        // Check if old version of node (4.2) and use deprecated method
        if (Buffer.from === Uint8Array.from) {
            // eslint-disable-next-line no-buffer-constructor
            return new Buffer(str).toString('base64');
        }

        return Buffer.from(str).toString('base64');
    }

    /**
     * Decode base64 string to utf8
     *
     * @public
     * @param {string} base64Str - base64 string to decode
     * @returns {string} - utf8 decoded string
     */
    static base64Decode(base64Str) {
        // Check if old version of node (4.2) and use deprecated method
        if (Buffer.from === Uint8Array.from) {
            // eslint-disable-next-line no-buffer-constructor
            return new Buffer(base64Str, 'base64').toString();
        }

        return Buffer.from(base64Str, 'base64').toString();
    }

    static extractValueFromEscapedRestString(iControlString) {
        return iControlString
            ? iControlString.replace(/(\x5c\x5c)/g, '\\')
                .replace('\\?', '?')
            : 'none';
    }

    static isEmptyObject(obj) {
        return Object.keys(obj).length === 0;
    }

    static _traverseFilter(obj, filter) {
        if (Array.isArray(obj)) {
            const newArray = [];
            obj.forEach((val) => {
                const newVal = this._traverseFilter(val, filter);
                if (newVal !== null) {
                    newArray.push(newVal);
                }
            });
            return newArray.length > 0 ? newArray : null;
        }
        if (typeof obj === 'object' && obj !== null) {
            if (filter(obj)) {
                return this.simpleCopy(obj);
            }
            const newObj = {};
            Object.keys(obj).forEach((key) => {
                const newVal = this._traverseFilter(obj[key], filter);
                if (newVal !== null) {
                    newObj[key] = newVal;
                }
            });
            return this.isEmptyObject(newObj) ? null : newObj;
        }
        return null;
    }

    /**
     * @callback filterFunc
     * @param {object} obj - the object to match against
     * @returns {boolean} - to include object or not

    /**
     * Recursively traverses an object and filters out subobjects that
     * do not match in filter function.
     *
     * @public
     * @param {object} obj
     * @param {filterFunc} filter
     * @returns {object} - returns new filtered object
     */
    static filterObject(obj, filter) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new Error('"obj" parameter must be an object');
        }
        if (typeof filter !== 'function') {
            throw new Error('"filter" parameter must be a function');
        }
        const val = this._traverseFilter(obj, filter);
        return val === null ? {} : val;
    }

    static isEmptyOrUndefined(value) {
        // null has the typeof object so does not fit in the switch
        if (value === null) {
            return true;
        }

        switch (typeof value) {
        case 'undefined':
            return true;
        case 'string':
            return !value.length;
        case 'object':
            if (Array.isArray(value)) {
                return !value.length;
            }
            return this.isEmptyObject(value);
        default:
            return !value;
        }
    }

    /**
     * Some objects have both enabled and disabled properties
     * instead of one prop with boolean value
     * @public
     * @param {object} obj - object that contains the enabled/disabled props
     * @returns {boolean} - true if enabled, otherwise false
     */
    static isEnabledObject(obj) {
        let isEnabled;

        if (typeof obj.enabled === 'boolean') {
            isEnabled = obj.enabled;
        } else if (typeof obj.disabled === 'boolean') {
            isEnabled = !obj.disabled;
        } else if (typeof obj.enabled === 'string') {
            isEnabled = obj.enabled.toLowerCase() === 'true';
        } else if (typeof obj.disabled === 'string') {
            isEnabled = obj.disabled.toLowerCase() === 'false';
        } else {
            isEnabled = true;
        }
        return isEnabled;
    }

    static getWideIpPath(pathValue) {
        return `\\"${pathValue.replace(/\x3f/g, '\\?').replace(/\x2a/g, '\\*').replace(/\x5c/g, '\\\\')}\\"`;
    }

    static capitalizeString(string) {
        return `${string.charAt(0).toUpperCase()}${string.slice(1)}`;
    }

    static getDeviceInfo() {
        const deviceInfoUrl = 'http://127.0.0.1/mgmt/shared/identified-devices/config/device-info';
        const options = {
            why: 'Get device info',
            crude: true,
            method: 'GET',
            retry503: 5,
            host: '127.0.0.1',
            auth: 'admin:',
            port: 8100
        };

        const retryOptions = {
            retries: 5,
            delay: 1000
        };

        const deviceInfoPromise = () => this.httpRequest(deviceInfoUrl, options)
            .then((response) => {
                if (response.statusCode !== 200) {
                    throw new Error(`Failed to get device type with status: ${response.statusCode}`);
                }
                return response;
            });

        return promiseUtil.retryPromise(deviceInfoPromise, retryOptions)
            .then((response) => {
                try {
                    const body = JSON.parse(response.body);
                    return body;
                } catch (e) {
                    log.warning(`Could not parse response body for getting device info. (${e.message})`);
                    throw e;
                }
            });
    }

    /**
     * Gets the management port if the user does not provide
     * @param {string} host
     */
    static getMgmtPort(host) {
        const ports = [443, 8443];

        return promiseUtil.raceSuccess(ports.map((p) => new Promise((resolve, reject) => {
            const socket = net.createConnection(p, host, () => {
                socket.end();
                resolve(p);
            });

            socket.on('error', (e) => {
                socket.destroy();
                reject(e);
            });
        }))).catch((e) => {
            log.error(e);
            log.error('Could not determine device port');
        });
    }

    static getRegkey(context) {
        return this.iControlRequest(context, { path: '/tm/sys/license' })
            .then((response) => {
                const licenseKey = Object.keys(response.entries)
                    .find((e) => e.indexOf('license') > -1);
                return response.entries[licenseKey].nestedStats.entries.registrationKey.description;
            });
    }

    static getTargetTokens(context, index) {
        if (this.getDeepValue(context, 'target.tokens')) {
            return context.target.tokens;
        }

        if (this.getDeepValue(context, 'control.targetTokens')) {
            return context.control.targetTokens;
        }

        // Check for index
        if (!index && index !== 0) {
            return {};
        }

        const declarations = this.getDeepValue(context, 'tasks');
        if (declarations && declarations[index] && declarations[index].targetTokens) {
            return declarations[index].targetTokens;
        }

        return {};
    }

    /**
     * Update the controls with the declaration.
     *
     * @param {Object} controls - controls from declaration
     * @param {Object} declControls - the declaration's controls
     * @returns {void}
     */
    static updateControlsWithDecl(controls, declControls) {
        if (controls.queryParamControls) {
            Object.keys(controls.queryParamControls).forEach((key) => {
                controls[key] = this.simpleCopy(controls.queryParamControls[key]);
            });
        }

        if (typeof declControls === 'object') {
            Object.keys(declControls).forEach((key) => {
                if ((key !== 'class' && !controls.queryParamControls)
                    || (key !== 'class' && !controls.queryParamControls[key])) {
                    controls[key] = this.simpleCopy(declControls[key]);
                }
            });
        }
    }

    /**
     * Normalize profile options
     *
     * @param {Array|string} tmOptions - special handling for options
     * @returns {Object} Objects formatted for tmsh use
     */
    static normalizeProfileOptions(tmOptions) {
        // On some BIG-IP versions (I'm looking at you 14.1), iControl REST returns
        // the options in a pre-stringified version, so we need to turn that into an object
        // On other versions, tmOptions is an array of strings

        function arrayProfileOptionsToObject(opts) {
            return opts.reduce((acc, cur) => {
                acc[cur] = {};
                return acc;
            }, {});
        }

        function stringProfileOptionsToObject(opts) {
            // Input here is like "{ option1 option2 }"
            // and we want to return
            //     {
            //         option1: {},
            //         option2: {}
            //     }
            const arrayOptions = opts.replace('{', '')
                .replace('}', '')
                .trim()
                .split(' ');
            return arrayProfileOptionsToObject(arrayOptions);
        }

        if (typeof tmOptions === 'string') {
            return stringProfileOptionsToObject(tmOptions);
        }
        return arrayProfileOptionsToObject(tmOptions);
    }

    /**
     * Checks if a module is within the target context.
     *
     * @param {Object} targetContext - the context.target object
     * @param {Array} <string> modules - an array of modules to check if any are in the targetContext
     *
     * @returns {boolean} - if any of the modules are in targetContext a true is returned
     */
    static isOneOfProvisioned(targetContext, modules) {
        if (!targetContext) {
            throw new Error('targetContext was not supplied');
        }
        if (!modules || modules.length === 0) {
            return true;
        }

        const provisioned = targetContext.provisionedModules || [];

        return modules.some((module) => provisioned.indexOf(module) !== -1);
    }

    static getExtraHeaders(urlObj) {
        const extraHeaders = {};

        if (urlObj.url.indexOf('windows.net') >= 0) {
            extraHeaders['x-ms-version'] = '2017-11-09';
        }

        return extraHeaders;
    }
}

module.exports = Util;

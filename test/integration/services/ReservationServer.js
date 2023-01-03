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

const fs = require('fs');
const express = require('express');
const https = require('https');
const uuidv4 = require('uuid/v4');
const basicAuth = require('basic-auth');
const bodyParser = require('body-parser');
const path = require('path');
const net = require('net');

const Config = require('./Config');

const app = express();
const base = '/test/v1';

class ReservationServer {
    constructor() {
        this._server = app.listen(8080, () => {
            const host = this._server.address().address;
            const port = this._server.address().port;
            app.use(bodyParser.urlencoded({ extended: false }));
            app.use(bodyParser.json()); // parse application/json
            app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
            app.use((req, res, next) => {
                res.header('Content-Type', 'application/json');
                next();
            });
            console.log(`Cloud Proxy listening at https://${host}:${port}`); // eslint-disable-line no-console
        });

        this.onGet();
        this.onDelete();
        this.onPost();
        this.timeout();
    }

    /**
 * GET endpoint - provides an IP address of an available VE
 *
 * @private
 * returns {null}
 */
    onGet() {
        app.get(`${base}/bigip*`, (req, res) => {
            const parsedURL = path.parse(req.url);
            const urlAra = parsedURL.base.split('bigip');
            let ip = null;
            if (urlAra[urlAra.length - 1]) {
                ip = urlAra[urlAra.length - 1];
            }

            let fdata = null;
            try {
                fdata = fs.readFileSync(Config.DEFAULT_RESOURCE, 'utf8');
            } catch (err) {
                res.status(404);
                res.send(JSON.stringify({ err: `error opening reservation file: ${err}` }));
                return;
            }

            let found = false;
            const resources = JSON.parse(fdata);
            // is this a request to get all info on all servers
            if (ip && ip === 'pool') {
                res.status(200);
                res.send(JSON.stringify({ pool: resources }));
                found = true;
            } else if (ip && (net.isIP(ip) !== 0)) {
                // is this a request for server info
                const matchingBigIp = resources.data.attributes.find((attr) => attr.ip === ip);
                if (matchingBigIp) {
                    res.status(200);
                    res.send(JSON.stringify({ bigip: matchingBigIp }));
                    found = true;
                }
            } else {
                // otherwise this is a request to reserver a server
                // randomly select a server
                let index = Math.floor(Math.random() * (resources.data.attributes.length));
                let bigip = null;
                for (let i = 0; i < resources.data.attributes.length; i += 1) {
                    if (index === resources.data.attributes.length) {
                        index = 0;
                    }
                    bigip = resources.data.attributes[index];
                    if (bigip.available === true
                        && (bigip.version.includes(req.query.version) || !req.query.version)) {
                        bigip.available = false;
                        bigip.user = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                        bigip.time = new Date().toUTCString(Date.now());
                        bigip.lock = req.query.lock === 'true';
                        resources.data.id = uuidv4();
                        fs.writeFileSync(Config.DEFAULT_RESOURCE, JSON.stringify(resources, null, 2), 'utf8');
                        res.status(200);
                        res.send(JSON.stringify({ ip: bigip.ip }));
                        found = true;
                        break;
                    }
                    index += 1;
                }
            }
            if (!found) {
                res.status(404);
                if (ip) {
                    res.send(JSON.stringify({ err: `requested BIGIP resource: ${ip} not found`, detail: resources }));
                } else {
                    res.send(JSON.stringify({ err: `requested BIGIP resource version: ${req.query.version} not available`, detail: resources }));
                }
            }
        });
    }

    /**
 * Post endpoint - provides a means to run tests from the testServer instance
 *
 * @private
 * returns {null}
 */
    onPost() {
        const that = this;

        const setBigIpAttr = function (bigip, resources, req) {
            bigip.available = true;
            bigip.user = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            bigip.time = new Date().toUTCString(Date.now());
            bigip.lock = false;
            resources.data.id = uuidv4();
            fs.writeFileSync(Config.DEFAULT_RESOURCE, JSON.stringify(resources, null, 2), 'utf8');
        };

        app.post(`${base}/selftest*`, (req, res) => {
            const user = basicAuth(req);
            let fdata = null;

            const parsedURL = path.parse(req.url);
            const specificTest = parsedURL.base.split('?')[0]; // [parsedURL.split('selftest').length - 1];

            try {
                fdata = fs.readFileSync(Config.DEFAULT_RESOURCE, 'utf8');
            } catch (err) {
                res.status(404);
                res.send(JSON.stringify({ err: `error opening reservation file: ${err}` }));
                return;
            }
            let found = false;
            let bigip = null;
            const resources = JSON.parse(fdata);
            for (let i = 0; i < resources.data.attributes.length; i += 1) {
                bigip = resources.data.attributes[i];
                if (bigip.available === true && (bigip.version.includes(req.query.version)
                    || !req.query.version)) {
                    bigip.available = false;
                    bigip.user = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                    bigip.time = new Date().toUTCString(Date.now());
                    bigip.lock = req.query.lock === 'true';
                    resources.data.id = uuidv4();
                    fs.writeFileSync(Config.DEFAULT_RESOURCE, JSON.stringify(resources, null, 2), 'utf8');
                    that.sendRequest(
                        specificTest,
                        user.name,
                        user.pass,
                        bigip.ip,
                        res,
                        setBigIpAttr(bigip, resources, req)
                    );
                    found = true;
                    break;
                }
            }
            if (!found) {
                res.status(404);
                res.send(JSON.stringify({ err: `requested BIGIP resource version: ${req.query.version} not available`, detail: resources }));
            }
        });
    }

    /**
 * Delete endpoint - provides a means to free a VE to the pool of avaialble VEs
 *
 * @private
 * returns {null}
 */
    onDelete() {
        app.delete(`${base}/bigip/:ip`, (req, res) => {
            let fdata = null;
            try {
                fdata = fs.readFileSync(Config.DEFAULT_RESOURCE, 'utf8');
            } catch (err) {
                res.status(404);
                res.send(JSON.stringify({ err: `error opening reservation file: ${err}` }));
                return;
            }
            let found = false;
            let bigip = null;
            const resources = JSON.parse(fdata);
            for (let i = 0; i < resources.data.attributes.length; i += 1) {
                bigip = resources.data.attributes[i];
                if (bigip.ip === req.params.ip) {
                    if (bigip.available === true) {
                        bigip.user = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                        bigip.time = new Date().toUTCString(Date.now());
                        bigip.lock = false;
                        resources.data.id = uuidv4();
                        fs.writeFileSync(Config.DEFAULT_RESOURCE, JSON.stringify(resources, null, 2), 'utf8');
                        res.status(400);
                        res.send(JSON.stringify({ err: `requested BIGIP resource: ${req.params.ip} is already available` }));
                        found = true;
                        break;
                    }
                    bigip.available = true;
                    bigip.user = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                    bigip.time = new Date().toUTCString(Date.now());
                    bigip.lock = false;
                    resources.data.id = uuidv4();
                    fs.writeFileSync(Config.DEFAULT_RESOURCE, JSON.stringify(resources, null, 2), 'utf8');
                    res.status(200);
                    res.send(JSON.stringify({ ip: bigip.ip, status: 'free' }));
                    found = true;
                    break;
                }
            }
            if (!found) {
                res.status(404);
                res.send(JSON.stringify({ err: `requested BIGIP resource: ${req.params.ip} not found` }));
            }
        });
    }

    /**
 * timeout - monitors how long a VE has been in use and
 * automatically returns the VE to the free pool after
 * Config.TIMEOUT ms  unless the VE was checked out with "lock"
 *
 * @private
 * returns {null}
 */
    timeout() {
        let fdata = null;
        setTimeout(() => {
            try {
                fdata = fs.readFileSync(Config.DEFAULT_RESOURCE, 'utf8');
            } catch (err) {
                console.log(err); // eslint-disable-line no-console
                this.timeout();
                return;
            }
            const resources = JSON.parse(fdata);
            resources.data.attributes.forEach((resource) => {
                if (((new Date().getTime() - new Date(resource.time).getTime()) > Config.TIMEOUT)
          && resource.lock === false && resource.available === false) {
                    resource.available = true;
                    resource.time = new Date().toUTCString(Date.now());
                    resource.lock = false;
                    resources.data.id = uuidv4();
                    fs.writeFileSync(Config.DEFAULT_RESOURCE, JSON.stringify(resources, null, 2), 'utf8');
                }
            });
            this.timeout();
        }, 10000);
    }

    /**
 * sendRequest - generates an HTTP request to run a selftest
 *
 * @private
 * @param {string} test - the name of the test to run
 * @param {string} user - basic auth user name
 * @param {string} password - basic auth password name
 * @param {string} ip - address of the VE to turn the test
 * @param {object} resProxy - HTTP response from running the test
 * @param {function} cb - callback that executes when test completes
 * returns {null}
 */
    sendRequest(test, user, password, ip, resProxy, cb) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        const keepAliveAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 10,
            keepAliveMsecs: 3000
        });

        let runTest = null;
        if (test === 'selftest') {
            runTest = '';
        } else {
            runTest = `/${test}`;
        }

        const _options = {
            headers: {
                Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            agent: keepAliveAgent,
            hostname: ip,
            port: 443,
            path: `/mgmt/shared/appsvcs/selftest${runTest}`,
            method: 'Post'
        };

        const callback = function (res) {
            let body = [];
            res.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', () => {
                body = Buffer.concat(body).toString();
                cb();
                resProxy.status(res.statusCode);
                resProxy.send(body);
            }).on('error', () => {
                cb();
                resProxy.status(res.statusCode);
                resProxy.send(body);
            });
        };
        const req = https.request(_options, callback);
        req.write('{}');
        req.end();
    }
}

/* eslint-disable-next-line no-new */
new ReservationServer();
module.exports = ReservationServer;

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

/* Borrowed and modified from f5-icontrollx-dev-kit (github.com/f5devcentral/f5-icontrollx-dev-kit) */
/* eslint-disable object-shorthand */

'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const Writable = require('stream').Writable;
const EventEmitter = require('events').EventEmitter;
const util = require('./util');
const constants = require('../constants');

class ResponseBuffer extends Writable {
    constructor(opts) {
        super(opts);
        this.text = '';
    }

    _write(chunk, encoding, callback) {
        this.text += chunk;
        callback();
    }
}
exports.ResponseBuffer = ResponseBuffer;

// utility method to set up HTTP options based on API options argument (i.e. devconfig.json)
const prepareReqOptions = (context, path) => {
    const hostname = context.target.host || constants.defaultHost;
    const port = context.target.port || constants.defaultPort;

    const options = {
        hostname,
        port,
        rejectUnauthorized: false,
        path: path,
        protocol: context.tasks[context.currentIndex].protocol ? `${context.tasks[context.currentIndex].protocol}:`
            : 'https:'
    };
    const tokens = util.getTargetTokens(context);
    if (typeof tokens['X-F5-Auth-Token'] === 'string') {
        options.headers = tokens;
    } else {
        options.headers = {};
        options.headers.Authorization = context.request.basicAuth;
    }
    return options;
};

const checkForHttpError = (res) => {
    if (res.statusCode >= 400) {
        const err = new Error(`Status Code ${res.statusCode}`);
        return err;
    }
    return null;
};

const multipartUpload = (options, filePath, cb) => {
    const opts = util.simpleCopy(options);
    const eventLog = new EventEmitter();
    const fstats = fs.statSync(filePath);
    const CHUNK_SIZE = 1000000;

    opts.method = 'POST';
    const uploadPart = (start, end) => {
        eventLog.emit('progress', `Sending chunk ${start}-${end} of ${fstats.size}...`);
        const requestLib = (opts.protocol === 'https:') ? https : http;
        const req = requestLib.request(opts, (res) => {
            eventLog.emit('progress', `UPLOAD REQUEST STATUS (${start}-${end}): ${res.statusCode}`);
            res.setEncoding('utf8');
            const resbuf = new ResponseBuffer();
            res.pipe(resbuf);
            res.on('end', () => {
                const error = checkForHttpError(res);
                if (error) {
                    error.message = `${error.message} ${opts.method} ${opts.path}\n${resbuf.text}`;
                    if (cb) cb(error);
                    return;
                }

                if (end === fstats.size - 1) {
                    if (cb) cb();
                } else {
                    const nextStart = start + CHUNK_SIZE;
                    const nextEnd = (() => {
                        if (end + CHUNK_SIZE > fstats.size - 1) {
                            return fstats.size - 1;
                        }
                        return end + CHUNK_SIZE;
                    })();
                    uploadPart(nextStart, nextEnd);
                }
            });
        });

        req.on('error', (err) => { if (cb) cb(err); });

        req.setHeader('Content-Type', 'application/octet-stream');
        req.setHeader('Content-Range', `${start}-${end}/${fstats.size}`);
        req.setHeader('Content-Length', (end - start) + 1);
        req.setHeader('Connection', 'keep-alive');

        const fstream = fs.createReadStream(filePath, { start: start, end: end });
        fstream.on('end', () => {
            req.end();
        });
        fstream.pipe(req);
    };

    setImmediate(() => {
        if (CHUNK_SIZE < fstats.size) uploadPart(0, CHUNK_SIZE - 1);
        else uploadPart(0, fstats.size - 1);
    });

    return eventLog;
};

const deletePreviousUpload = (options, cb) => {
    const opts = util.simpleCopy(options);
    const requestLib = (opts.protocol === 'https:') ? https : http;

    opts.method = 'DELETE';
    const req = requestLib.request(opts, (res) => {
        res.setEncoding('utf8');
        const resbuf = new ResponseBuffer();
        res.pipe(resbuf);
        res.on('end', () => {
            const error = checkForHttpError(res);
            if (error) {
                error.message = `${error.message} ${opts.method} ${opts.path}\n${resbuf.text}`;
                if (cb) cb(error);
                return;
            }
            cb();
        });
    });

    req.on('error', (err) => { if (cb) cb(err); });
    req.end();
};

const httpCopyToHost = (context, rpmPath, cb) => {
    const rpmName = rpmPath.split('/').pop();
    const httpOptions = prepareReqOptions(context, `/mgmt/shared/file-transfer/uploads/${rpmName}`);

    deletePreviousUpload(httpOptions, (deleteErr) => {
        if (deleteErr) {
            cb(deleteErr, `/var/config/rest/downloads/${rpmName}`);
            return;
        }

        multipartUpload(httpOptions, rpmPath, (uploadErr) => {
            cb(uploadErr, `/var/config/rest/downloads/${rpmName}`);
        });
    });
};

const copyToHost = httpCopyToHost;
exports.copyToHost = copyToHost;

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
const log = require('../log');
const util = require('./util');
const authHeaderUtil = require('./authHeaderUtil');
const extractUtil = require('./extractUtil');
const expandUtil = require('./expandUtil');

/**
 * given 'data' taken from pointer 'instancePath' in object 'parentData' in declaration, if data
 * is an object like F5string, return a promise to fetch some data from the indicated source and
 * stick it into parentData[parentDataProperty] (which may well replace the parental data).  This
 * is async because it may try to fetch an external url.
 *
 * Note:  usually F5string property "base64" is just a string armored to avoid the hassle of
 * JSON-escaping it.  When there actually is binary inside a base64 (pkcs#12, I'm looking
 * at you!) we have to keep it in base64 armor
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object} fetch - The fetch data that will be processed
 * @param {*} fetch.data - The fetch data from the declaration
 * @param {*} fetch.parentData - The fetch parent data from the declaration
 * @param {string} fetch.instancePath - The json pointer that was used to fetch the data
 * @param {string} fetch.parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when data is processed
 */
function fetchValue(context, declaration, fetch) {
    if (typeof fetch.data !== 'object') {
        return Promise.resolve(); // nothing to fetch
    }

    // look for F5string-style polymorphism
    // (these properties are mutually exclusive)
    const poly = ['base64', 'url', 'copyFrom', 'reuseFrom', 'include', 'text', 'file'];
    let i;
    let morph = '';
    for (i = 0; i < poly.length; i += 1) {
        if (Object.prototype.hasOwnProperty.call(fetch.data, poly[i])) {
            morph = poly[i];
            break;
        }
    }
    if (morph === '') {
        return Promise.resolve(); // nothing to fetch
    }

    let value = '';
    switch (morph) {
    case 'text':
        value = fetch.data[morph];
        break;
    case 'base64':
        value = util.fromBase64(fetch.data[morph]);
        break;

    case 'include':
    case 'copyFrom':
    case 'reuseFrom': {
        const rv = {};
        try {
            extractUtil.getAs3Object(
                fetch.data[morph],
                fetch.instancePath.concat('/', morph),
                fetch.parentData,
                declaration,
                true,
                rv,
                'ptr',
                ((morph === 'copyFrom') ? 'string' : 'object'),
                rv,
                'val'
            );
            if (rv.ptr === '') {
                return Promise.reject(new Error(`${fetch.data[morph]} points nowhere`));
            }
        } catch (e) {
            return Promise.reject(new Error(`contains invalid ${morph} (${e.message})`));
        }
        value = rv.val;
        break;
    }
    case 'file': {
        return new Promise((resolve, reject) => {
            fs.readFile((fetch.data.file), 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                fetch.parentData[fetch.parentDataProperty] = data.toString();
                resolve();
            });
        });
    }
    case 'url': {
        let mtype;
        let cset = '';

        const urlObj = Object.assign(
            { skipCertificateCheck: false },
            typeof fetch.data.url === 'string' ? { url: fetch.data.url } : fetch.data.url
        );

        const splitPath = fetch.instancePath.split('/');
        const prevDecl = context.host.parser.options.previousDeclaration;
        if (urlObj.ignoreChanges && prevDecl && prevDecl[splitPath[1]]
            && prevDecl[splitPath[1]][splitPath[2]] && prevDecl[splitPath[1]][splitPath[2]][splitPath[3]]) {
            if (!fetch.data.ignoreChanges) {
                fetch.parentData.ignoreChanges = true;
            }
            return Promise.resolve();
        }

        switch (fetch.schemaData) {
        case 'string':
            mtype = 'text/plain,'
                            + 'text/csv;q=0.2';
            cset = 'utf-8,us-ascii;q=0.9,iso-8859-1;q=0.2';
            break;

        case 'json':
        case 'object':
            mtype = 'application/json,'
                            + 'text/plain;q=0.2';
            cset = 'utf-8,us-ascii;q=0.9';
            break;

        case 'xml':
            mtype = 'application/xml,'
                            + 'application/xhtml+xml;q=0.5,'
                            + 'text/plain;q=0.2';
            cset = 'utf-8,us-ascii;q=0.9,iso-8859-1;q=0.2';
            break;

        case 'pkcs12':
            mtype = 'application/x-pkcs12,'
                            + 'application/octet-stream';
            break;
        case 'binary':
            mtype = 'application/octet-string';
            break;

        case 'pki-cert':
        case 'pki-bundle':
            mtype = 'application/x-pem-file,'
                            + 'application/pkix-cert;q=0.7,'
                            + 'application/pkcs-mime;q=0.7,'
                            + 'application/x-x509-ca-cert;q=0.7,'
                            + 'application/x-pkcs7-certificates;q=0.5,'
                            + 'application/x-pkcs12;q=0.3,'
                            + 'text/plain;q=0.2,'
                            + 'application/octet-stream;q=0.2';
            break;

        case 'pki-key':
            mtype = 'application/x-pem-file,'
                            + 'application/pkcs8;q=0.5,'
                            + 'application/x-pkcs12;q=0.3,'
                            + 'text/plain;q=0.2,'
                            + 'application/octet-stream;q=0.2';
            break;

        default:
            throw new Error(`unimplemented schema=${fetch.schemaData} in fetchValue()`);
        }

        const hdrs = { Accept: mtype };
        return Promise.resolve()
            .then(() => authHeaderUtil.getAuthHeader(context, urlObj.authentication))
            .then((authHeader) => Object.assign(hdrs, authHeader))
            .then(() => util.getExtraHeaders(urlObj))
            .then((extraHeaders) => Object.assign(hdrs, extraHeaders))
            .then(() => {
                if (cset !== '') {
                    hdrs['Accept-Charset'] = cset;
                }

                const timeout = util.getDeepValue(context, `tasks.${context.currentIndex}.resourceTimeout`);

                const options = {
                    headers: hdrs,
                    timeout,
                    why: (`for ${fetch.instancePath}`),
                    rejectUnauthorized: !urlObj.skipCertificateCheck
                };

                return util.httpRequest(urlObj.url, options);
            })
            .then((body) => {
                switch (fetch.schemaData) {
                case 'string':
                case 'json':
                case 'xml':
                    body = body.toString();
                    break;
                case 'binary':
                    body = body.toString('base64');
                    break;
                case 'object':
                    if (typeof body !== 'object') {
                        try {
                            body = JSON.parse(body);
                        } catch (e) {
                            return Promise.reject(new Error(`source ${fetch.instancePath}/${morph} does not contain JSON object`));
                        }
                    }
                    break;
                case 'pkcs12':
                    return extractUtil.extractPkcs12(context, body.toString('base64'), fetch.parentData)
                        .then((pkcs12) => {
                            fetch.parentData[fetch.parentDataProperty] = pkcs12;
                            return true;
                        });
                case 'pki-cert':
                case 'pki-bundle':
                case 'pki-key':
                    if (typeof body !== 'string') {
                        // TODO:  deal with binary cert/key formats
                        // like pkcs#12, pkcs#7

                        body = body.toString();
                    }
                    break;

                default:
                    return Promise.reject(new Error(`unimplemented schema=${
                        fetch.schemaData} in fetchValue()`));
                }

                if (fetch.schemaData === 'string' && fetch.parentData.expand) {
                    expandUtil.backquoteExpand(
                        body,
                        fetch.instancePath,
                        fetch.parentData,
                        declaration,
                        fetch.parentData,
                        fetch.parentDataProperty
                    );
                } else {
                    fetch.parentData[fetch.parentDataProperty] = body;
                }

                return true;
            })
            .catch((error) => {
                error.message = `Unable to fetch value. ${error.message}`;
                log.error(error.message);
                throw error;
            });
    }
    default:
        // we should not be here
        return Promise.reject(new Error(`contains unsupported polymorphism ${morph}`));
    }

    switch (fetch.schemaData) {
    case 'string':
    case 'json':
    case 'xml':
        value = value.toString();
        break;

    case 'binary':
        value = value.toString('base64');
        break;

    case 'object':
        if (typeof value !== 'object') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                return Promise.reject(new Error(`source ${fetch.instancePath}/${morph} does not contain JSON object`));
            }
        }
        break;

    case 'pkcs12':
        return extractUtil.extractPkcs12(context, value, fetch.parentData)
            .then((pkcs12) => {
                Object.assign(fetch.parentData, pkcs12);
                return true;
            });
    case 'pki-cert':
    case 'pki-bundle':
    case 'pki-key':
        if (typeof value !== 'string') {
            // TODO:  deal with binary cert/key formats
            // like pkcs#12, pkcs#7

            value = value.toString();
        }
        break;

    default:
        return Promise.reject(new Error(`unimplemented schema=${fetch.schemaData} in fetchValue()`));
    }

    if (morph !== 'include') {
        fetch.parentData[fetch.parentDataProperty] = value;
    } else {
        Object.assign(fetch.parentData, value);
    }

    return Promise.resolve();
}

module.exports = {
    fetchValue
};

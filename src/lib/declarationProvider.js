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

const dataGroupUtil = require('./util/dataGroupUtil');
const util = require('./util/util');
const log = require('./log');

// This is a result of refactoring validate.js
// The core logic was preserved with minimal changes (method extractions).
// Some names and variables have been updated for clarity.
// There are also some eslint-related formatting.

// Originally declaration request logic was on the rest handler onDeclare.js
// Then the bulk was moved to validate.js (See commit f8184a0155600cf523e441c7f9ad2aa9dc41698e)
// Subsequent comments are from the original unless otherwise noted.
// - @austria

class DeclarationProvider {
    /**
     * return a promise to fetch a list of declarations
     * (history) stored on target.  Resolves to list
     * sorted most-recent-first (possibly empty), or
     * rejects on error
     *
     * @public
     * @param {object} context
     * @returns {Promise}
     */
    listBigipDeclarations(context) {
        const traceSpan = context.request.tracer.startChildSpan(
            'declarationProvider.listBigipDeclarations',
            context.request.rootSpan
        );

        const opts = {
            path: '/mgmt/tm/ltm/data-group/internal?$select=name&$filter=partition+eq+Common',
            why: 'get stored-declaration list',
            targetTimeout: 30
        };
        const pfx = '____appsvcs_declaration-';
        const list = [];

        return util.iControlRequest(context, opts)
            .then((resp) => {
                let x;

                if ((typeof resp.items === 'object') && Array.isArray(resp.items)) {
                    resp.items.forEach((item) => {
                        if (item.name.indexOf(pfx) !== 0) { return; }

                        item.timestamp = parseInt(item.name.split('-')[1], 10);
                        item.date = (new Date(item.timestamp)).toISOString();

                        if (!list.length) {
                            list.push(item);
                            return;
                        }
                        // so long as max history list is short
                        // (March 2018 limit is 15) it is better
                        // to insert in order here than to call
                        // a general sort routine later
                        x = 0;
                        while ((x < list.length)
                                    && (item.timestamp < list[x].timestamp)) { x += 1; }
                        list.splice(x, 0, item);
                    });

                    // make proper order visible to remote client
                    for (x = 0; x < list.length; x += 1) { list[x].age = x; }
                }

                return list;
            })
            .then((result) => {
                traceSpan.finish();
                return result;
            });
    } // listBigipDeclarations()

    /**
     * return a promise to fetch a copy of a declaration
     * plus if meta==true some metadata from the target.
     * If declaration is found, resolves to declaration
     * or decl+metadata.  If declaration not found, then
     * if meta==true returns an empty declaration with
     * metadata.blocks==0, else rejects with error message
     * Will reject on serious error
     *
     * @public
     * @param {object} context - full AS3 context object
     * @param {number} age - 0 for most recent declaration
     * @param {boolean} includeMetadata - if true, resolves to declaration plus metadata always
     * @returns {Promise}
     */
    getBigipDeclaration(context, age, includeMetadata) {
        const now = Date.now();
        const fakeId = now.toString();

        const iControlOpts = {
            path: '/mgmt/tm/ltm/data-group/internal/~Common~',
            why: 'retrieve stored declaration from BIG-IP',
            crude: true,
            targetTimeout: 30
        };
        const declToReturnOnError = {
            metadata: {
                date: (new Date(now)).toISOString(),
                id: fakeId,
                tenants: [],
                blocks: 0 // blocks==0 tells caller this is fake
            },
            declaration: {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: fakeId
            }
        };

        const records = [];
        let metadata;
        let textDecl = '';
        let declToReturn = '';

        return this.listBigipDeclarations(context)
            .then((list) => {
                if (list.length <= age) {
                    if (includeMetadata) {
                        return declToReturnOnError;
                    }
                    return undefined;
                }
                // otherwise

                iControlOpts.path += list[age].name;
                return util.iControlRequest(context, iControlOpts)
                    .then((resp) => {
                        if (resp.statusCode !== 200) {
                            if (includeMetadata) {
                                return declToReturnOnError;
                            }
                            const e = new Error(`GET ${iControlOpts.path} ${iControlOpts.why} `
                            + `response=${resp.statusCode} body=${resp.body}`);
                            e.statusCode = resp.statusCode;
                            throw e;
                        }
                        // otherwise

                        try {
                            resp = JSON.parse(resp.body);
                        } catch (e) {
                            e.message = `cannot JSON.parse() data-group reply (${e.message})`;
                            log.info(e);
                            if (includeMetadata) {
                                return declToReturnOnError;
                            }
                            throw e;
                        }

                        // when you list an integer data group using tmsh
                        // or iCR you usually get the records in order by
                        // increasing key value, but I don't think we can
                        // rely on that undocumented behavior so we will
                        // just coerce the records into order here
                        resp.records.forEach((r) => {
                            records[r.name] = r;
                        });

                        if (Object.prototype.hasOwnProperty.call(records, '0')) {
                            metadata = {};
                            records[0].data.split('|').forEach((row) => {
                                if (!row.match(/^[A-Za-z0-9_]+[^][^\x00-\x20\x22'<>\x5c`\x7f]+/)) {
                                    return;
                                }
                                const cols = row.split('^');
                                switch (cols[0]) {
                                case 'tenants':
                                    metadata.tenants = cols[1].split(',');
                                    break;
                                case 'blocks':
                                    metadata.blocks = parseInt(cols[1], 10);
                                    break;
                                default:
                                    metadata[cols[0]] = cols[1];
                                    break;
                                }
                            });
                        }
                        if ((metadata === undefined)
                                    || (metadata.blocks !== (records.length - 1))) {
                            const err = new Error('declaration stored on target seems corrupt');
                            log.info(err);
                            if (includeMetadata) {
                                return declToReturnOnError;
                            }
                            throw err;
                        }

                        try {
                            textDecl = dataGroupUtil.recordsToString(records, '', 1);
                        } catch (e) {
                            e.message = `cannot decompress stored declaration (${e.message})`;
                            log.info(e);
                            if (includeMetadata) {
                                return declToReturnOnError;
                            }
                            throw e;
                        }
                        try {
                            declToReturn = JSON.parse(textDecl);
                        } catch (e) {
                            e.message = `cannot JSON.parse() stored declaration (${e.message})`;
                            log.info(e);
                            if (includeMetadata) {
                                return declToReturnOnError;
                            }
                            throw e;
                        }

                        log.debug(`fetched declaration from target, ${metadata.blocks} blocks, ${metadata.tenants.length} Tenants`);
                        return (includeMetadata) ? {
                            metadata,
                            declaration: declToReturn
                        } : declToReturn;
                    });
            });
    } // getBigipDeclaration()

    /**
     * return a promise to trim the collection of
     * declarations stored on target.  Resolves
     * true always, ignoring errors
     *
     * @public
     * @param {object} context
     * @param {number} limit
     */
    trimDeclarations(context, limit) {
        return this.listBigipDeclarations(context)
            .then((list) => {
                const opts = {
                    path: '/mgmt/tm/ltm/data-group/internal/~Common~',
                    why: 'remove an old declaration',
                    method: 'DELETE',
                    crude: true
                };
                const dataGroupItems = [];
                for (let i = limit; i < list.length; i += 1) {
                    const dataGroupItem = util.simpleCopy(opts);
                    dataGroupItem.path += list[i].name;
                    dataGroupItems.push(dataGroupItem);
                }

                return dataGroupItems.reduce((cull, dataGroupItem) => cull.then(
                    () => util.iControlRequest(context, dataGroupItem)
                ), Promise.resolve());
            })
            .then(() => true)
            .catch((e) => {
                e.message = `error while removing old declaration (${e.message})`;
                log.info(e);
                return true;
            });
    } // trimDeclarations()

    /**
     * return a promise to store a copy of a declaration
     * plus some metadata on the target BIG-IP.  Upon
     * success, trim unwanted older declarations from
     * target device (if limit is zero, we won't save any
     * declaration we would just have to delete anyway).
     * Resolves to 'true' upon success, else rejects error.
     *
     * We will store each declaration in an internal
     * data-group of type integer.  Record 0 will hold the
     * metadata and records 1..N will hold 63kB chunks of
     * the declaration zlib-compressed and base64-encoded.
     *
     * We rely on timestamps in our data-group names to
     * order the stored declarations.  We adjust those
     * timestamps (approximately) to the target device's
     * clock to avert misordering if two or more AS3's are
     * used to configure one target.
     *
     * Metadata includes: declaration_id, timestamp,
     * record-count, and a list of Tenants found in the
     * declaration.  We might like to store the metadata
     * as JSON but the necessary quoting is too painful.
     *
     * @public
     * @param {object} context - full AS3 context object
     * @param {object} decl - declaration to store
     * @param {number} limit - limit on declaration history length
     * @returns {Promise}
     */
    storeBigipDeclaration(context, decl, limit) {
        if (!limit || (typeof decl !== 'object') || (decl === null)) {
            log.debug(`purge stored decls in excess of ${limit}`);
            return this.trimDeclarations(context, limit);
        }
        // otherwise

        const tenants = [];
        let textDecl;
        let meta = '';
        const path = '/mgmt/tm/ltm/data-group/internal';
        const dg = '____appsvcs_declaration-';
        const stamp = Date.now() + context.control.timeSlip;
        const opts = {
            path: (`/mgmt/tm/ltm/data-group/internal/~Common~${dg}${stamp}`),
            why: 'store a declaration',
            crude: true
        };

        Object.keys(decl).forEach((k) => {
            if ((typeof decl[k] === 'object')
                        && (decl[k] !== null)
                        && (Object.prototype.hasOwnProperty.call(decl[k], 'class'))
                        && (decl[k].class === 'Tenant')) {
                tenants.push(k);
            }
        });

        try {
            textDecl = JSON.stringify(decl);
        } catch (e) {
            e.message = `cannot stringify declaration (${e.message})`;
            return Promise.reject(e);
        }

        let records = [];
        try {
            records = records.concat(dataGroupUtil.stringToRecords('', textDecl, 1));
        } catch (e) {
            e.message = `cannot prepare declaration for record storage (${e.message})`;
            throw e;
        }

        meta = (`date^${(new Date(stamp)).toISOString()}|`
                + `id^${decl.id}|`
                + `tenants^${tenants.join(',')}|`
                + `blocks^${records.length}`);

        records.unshift({
            name: '0',
            data: meta
        });

        // will datagroup name collide?  (odds are slim, but...)
        // (life would be easier if TMOS had create-or-update)
        log.debug(`store decl on target, blocks=${records.length - 1}`);
        return util.iControlRequest(context, opts)
            .then((resp) => {
                opts.crude = false;

                if (resp.statusCode === 200) {
                // update existing dg
                    opts.method = 'PUT';
                    opts.send = JSON.stringify({
                        records
                    });
                } else {
                // create new dg
                    opts.path = path;
                    opts.method = 'POST';
                    opts.send = JSON.stringify({
                        name: (dg + stamp),
                        partition: 'Common',
                        description: 'f5 AS3 declaration (see info in record 0)',
                        type: 'integer',
                        records
                    });
                }
                return util.iControlRequest(context, opts);
            })
            .then(() => {
                log.debug(`next purge stored decls in excess of ${limit}`);
                return this.trimDeclarations(context, limit, context.control);
            });
    } // storeBigipDeclaration()

    /**
     * return a promise to fetch a copy of a declaration
     * plus if meta==true some metadata from the target.
     * If declaration is found, resolves to declaration
     * or decl+metadata.  If declaration not found, then
     * if meta==true returns an empty declaration with
     * metadata.blocks==0, else rejects with error message
     * Will reject on serious error
     *
     * @public
     * @param {object} context - full AS3 context object
     * @param {boolean} includeMetadata - if true, resolves to declaration plus metadata always
     * @returns {Promise}
     */
    getBigiqDeclaration(context, includeMetadata) {
        const now = Date.now();
        const fakeId = now.toString();
        let declToReturn;
        let target;

        const iControlOpts = {
            path: '/mgmt/cm/global/tenants',
            why: 'retrieve stored declaration from BIG-IQ',
            crude: true
        };
        const metadata = {
            date: (new Date(now)).toISOString(),
            id: fakeId,
            tenants: [],
            blocks: 0 // blocks==0 tells caller this is fake
        };
        const fakeDecl = {
            metadata,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: fakeId
            }
        };
        return util.iControlRequest(context, iControlOpts)
            .then((resp) => {
                if (resp.statusCode !== 200) {
                    if (includeMetadata) {
                        return fakeDecl;
                    }
                    throw new Error(resp);
                }
                try {
                    resp = JSON.parse(resp.body);
                } catch (e) {
                    e.message = `cannot JSON.parse() BIG-IQ reply (${e.message})`;
                    log.info(e);
                    if (includeMetadata) {
                        return fakeDecl;
                    }
                    throw e;
                }
                if (Array.isArray(resp.items) && resp.items.length > 0) {
                    const decls = {};
                    let decl = {};
                    resp.items.forEach((item) => {
                        if (context.control.objectNamesToPatch
                            && context.control.objectNamesToPatch.length > 0
                            && context.control.objectNamesToPatch.indexOf(item.name) === -1) {
                            return;
                        }
                        target = JSON.stringify(item.body.target);

                        metadata.tenants.push(item.name);
                        if (util.isEmptyOrUndefined(decls[target])) {
                            decl = util.simpleCopy(item.body);
                            metadata.blocks = 1;
                            decls[target] = decl;
                        } else {
                            decls[target][item.name] = item.body[item.name];
                        }

                        if (item.body.Common) {
                            if (metadata.tenants.indexOf('Common') === -1) {
                                metadata.tenants.push('Common');
                            }
                            decls[target].Common = item.body.Common;
                        }
                    });
                    const targetSpecified = !util.isEmptyOrUndefined(context.tasks[context.currentIndex].target);
                    if (targetSpecified) {
                        const specTarget = JSON.stringify(context.tasks[context.currentIndex].target);
                        if (!decls[specTarget]) {
                            log.warning(`No previous declaration found for target "${specTarget}"`);
                        }
                        declToReturn = decls[specTarget] || {};
                    } else {
                        declToReturn = Object.keys(decls).map((declItem) => decls[declItem]);
                        if (declToReturn.length === 1) {
                            declToReturn = declToReturn[0];
                        }
                    }
                } else {
                    declToReturn = {};
                }

                const controlsName = util.getObjectNameWithClassName(declToReturn, 'Controls') || 'controls';
                if (declToReturn[controlsName]) {
                    const action = util.getDeepValue(declToReturn[controlsName], 'internalUse.action');
                    if (action === 'dry-run') {
                        declToReturn[controlsName].dryRun = true;
                        if (Object.keys(declToReturn[controlsName].internalUse).length === 1) {
                            delete declToReturn[controlsName].internalUse;
                        } else {
                            log.warning(`Unexpected properties in controls.internalUse: ${JSON.stringify(declToReturn[controlsName].internalUse)}`);
                        }
                    } else {
                        log.warning(`Unexpected action "${action}" in controls`);
                    }
                }

                log.debug(`fetched declaration from target, ${fakeDecl.metadata.blocks} blocks, ${fakeDecl.metadata.tenants.length} Tenants`);

                return (includeMetadata) ? {
                    metadata,
                    declaration: declToReturn
                } : declToReturn;
            });
    } // getBigiqDeclaration
}
module.exports = DeclarationProvider;

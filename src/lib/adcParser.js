/**
 * Copyright 2025 F5, Inc.
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

const AJV = require('ajv');
const log = require('./log');
const myValidator = require('./validator');
const util = require('./util/util');
const PostProcessor = require('./postProcessor');
const PostValidator = require('./postValidator');
const certUtil = require('./util/certUtil');
const declarationUtil = require('./util/declarationUtil');
const SCHEMA_ID = require('./constants').SCHEMA_ID;

class As3Parser {
    constructor(schemaValidator) {
        this.schemaValidator = schemaValidator;
        this.nodelist = [];
        this.virtualAddressList = [];
        this.accessProfileList = [];
        this.options = {};
        this.postProcess = [];
    }

    /**
     * Checks the declaration to ensure that full paths will not
     * exceed the tmsh max length.
     */
    validatePathLength(declaration) {
        const tenants = Object.keys(declaration).filter((key) => declarationUtil.isTenant(declaration[key]));
        tenants.forEach((tenant) => {
            const applications = Object.keys(declaration[tenant]).filter((key) => declarationUtil.isApplication(
                declaration[tenant][key]
            ));
            applications.forEach((application) => {
                Object.keys(declaration[tenant][application]).forEach((item) => {
                    const path = `/${tenant}/${application}/${item}`;
                    if (path.length > 255) {
                        const e = new Error();
                        e.message = `The path /${tenant}/${application
                        }/${item} exceeds the 255 full path character limit`;
                        e.status = 400;
                        throw e;
                    }
                });
            });
        });
    }

    /**
     * given a declaration, return a promise to digest
     * it according to the current schema (chosen with
     * schemaValidator).  Has the HUGE SIDE-EFFECT of
     * modifying declaration!
     *
     * An adcParser needs to know how to contact the
     * target BIG-IP so it can validate BIG-IP config
     * component references and obtain SecureVault
     * cryptograms for customer secrets.  The required
     * info should be in parameter 'context.control'.
     *
     * @public
     * @param {Object} context - full context object containing sub-contexts
     * @param {Object} context.control - control object contained within context
     * @param {Object} declaration - raw declaration to cook (WILL BE MODIFIED)
     * @param {Object} [options] - optional parameters
     * @param {Object} [options.baseDeclaration] - original request declaration with no
     *                                             modifications (WILL BE MODIFIED)
     * @param {Boolean} [options.copySecrets=false] - copy sv cryptograms to baseDeclaration
     * @param {Object} [options.previousDeclaration] - the previous saved declaration
     * @param {Boolean} [options.isPerApp=false] - Validates against per-app && ignores
     *                                             PostProcess step
     * @returns {Promise} - resolves to declaration label+id (declaration is MODIFIED)
     */
    digest(context, declaration, options) {
        const defaultOpts = {
            copySecrets: false,
            baseDeclaration: {},
            previousDeclaration: {},
            isPerApp: false
        };
        this.options = Object.assign(this.options, defaultOpts, options);

        if ((typeof declaration !== 'object') || (declaration === null)) {
            return Promise.reject(new Error('digest() requires declaration'));
        }
        this.context = context;

        return as3Digest.call(this, declaration)
            .then((results) => {
                log.debug('success parsing declaration');
                return results;
            });
    }
}

// We call a reference from one property within a
// declaration to another an "AS3 pointer" and convert it
// to a JSON pointer from the root before dereferencing
// it.  We provide several sweeteners:  a pointer may
// be an absolute or relative JSON pointer; may be
// relative to the /T/A it was found in; may be
// relative to its nearest "classy" ancestor; and
// finally may "pull tokens in" from the pointer to
// the source of the pointer.  That last is easier to
// use than to describe:  when a reference token in
// a pointer is simply '@', we replace it with the
// corresponding (same depth) reference token from
// the pointer to the nominal source of the pointer.
// So if we obtain the pointer "/@/Shared/mypool" from
// the property "/T1/A1/serviceMain" then we convert the
// pointer to "/T1/Shared/mypool" before dereferencing
// it.  Similar uses are also valid.  For example,
// pointer "/Common/@/mypool" from "/T1/A1/serviceMain"
// converts to "/Common/A1/mypool".  Note, however,
// that we forbid any pointer which points outside of
// the /T/A in which it was found except when it
// points into /T/Shared or /Common/Shared.

function validate(declaration) {
    const parserTime = new Date();
    const validator = this.options.isPerApp ? SCHEMA_ID.APP : SCHEMA_ID.ADC;

    let id = declaration.id;
    if (validator === SCHEMA_ID.APP) {
        // Use the transformed declaration id for consistency
        id = this.context.request.body.id;
    }

    // what is the ID of this declaration?
    if (validator === SCHEMA_ID.ADC && (!Object.prototype.hasOwnProperty.call(declaration, 'id')
        || (!id.match(/^[^\x00-\x20\x22'<>\x5c^`|\x7f]{0,255}$/)))) {
        // Per-app declarations do not currently support id
        const error = new Error('declaration lacks valid \'id\' property');
        error.status = 422;
        return Promise.reject(error);
    }
    if (validator === SCHEMA_ID.ADC && (Object.prototype.hasOwnProperty.call(declaration, 'label')
        && (declaration.label.match(/^[^\x00-\x1f\x22#&*<>?\x5b-\x5d`\x7f]{1,48}$/)))) {
        // Per-app declarations do not currently support label
        id = `id ${id}|${declaration.label.replace(/'/g, '.')}`;
    } else {
        id = `id ${id}`;
    }
    log.debug(`validating declaration having ${id}`);

    return Promise.resolve()
        .then(() => {
            const results = this.schemaValidator.validate(validator, declaration);
            if (!results.valid) throw new AJV.ValidationError(results.errors);
            const certErrors = certUtil.validateCertificates(declaration, []);
            if (!util.isEmptyOrUndefined(certErrors)) throw new AJV.ValidationError(certErrors);
            this.postProcess = results.postProcess;
        })
        .then(() => this.validatePathLength(declaration))
        .then(() => {
            const result = myValidator.hasDuplicate(declaration);
            log.notice(`Parser time: ${new Date() - parserTime} milliseconds`);
            if (result.isDuplicate) {
                log.warning({
                    status: 422,
                    message: 'declaration is invalid',
                    errors: `declaration has duplicate values in ${result.propName}`
                });
                const errorMessage = new Error(`declaration has duplicate values in ${result.propName}`);
                errorMessage.status = 422;
                throw errorMessage;
            }
            log.debug('declaration is valid');
            return id;
        });
}

/**
 * Return a promise to digest a declaration using
 * validator() (that is, validating declaration
 * and processing custom keywords, which m have
 * substantial side effects like fetching lots of
 * data from url's in decl).
 * Resolves to ID of expanded declaration, but has
 * a HUGE side-effect of modifying declaration!
 *
 * @param {object} declaration - AS3 declaration to digest, WILL BE MODIFIED!
 * @returns {Promise} - resolves when declaration is digested (declaration is MODIFIED)
 */
function as3Digest(declaration) {
    const originalDeclaration = util.simpleCopy(declaration);
    let getNodelist = Promise.resolve([]);
    let getVirtualAddresses = Promise.resolve([]);
    let getAccessProfileList = Promise.resolve([]);
    let getAddressListList = Promise.resolve([]);
    let getSnatTranslationList = Promise.resolve([]);
    if (!declaration.scratch && !this.options.isPerApp) {
        // per-app validation does NOT require this
        getNodelist = util.getNodelist(this.context);
        getVirtualAddresses = util.getVirtualAddressList(this.context, 'Common');
        getAccessProfileList = util.getAccessProfileList(this.context);
        getAddressListList = util.getAddressListList(this.context, 'Common');
    }
    if (!declaration.scratch) {
        getSnatTranslationList = util.getSnatTranslationList(this.context, 'Common');
    }

    this.postProcess = [];

    const results = {};

    return getNodelist
        .then((nodelist) => { this.nodelist = nodelist; })
        .then(() => getVirtualAddresses)
        .then((virtualAddressList) => { this.virtualAddressList = virtualAddressList; })
        .then(() => getAccessProfileList)
        .then((accessProfileList) => { this.accessProfileList = accessProfileList; })
        .then(() => getAddressListList)
        .then((addressListList) => { this.addressListList = addressListList; })
        .then(() => getSnatTranslationList)
        .then((snatTranslationList) => { this.snatTranslationList = snatTranslationList; })
        .then(() => validate.call(this, declaration))
        .then(() => {
            if (this.options.isPerApp) {
                // We are skipping postProcessing as it will be done after transformation in request context
                return Promise.resolve();
            }
            return PostProcessor.process(this.context, declaration, originalDeclaration, this.postProcess)
                .then((postProcessResults) => {
                    results.warnings = postProcessResults.warnings;
                });
        })
        .then(() => {
            if (this.options.isPerApp) {
                // Without path expansion from postProcess, this step is pointless
                return Promise.resolve();
            }
            return PostValidator.validate(this.context, declaration);
        })
        .then(() => {
            if (this.options.copySecrets && this.options.baseDeclaration) {
                copySecrets(declaration, this.options.baseDeclaration);
            }
        })
        .then(() => results)
        .catch((e) => {
            if (e instanceof AJV.ValidationError) {
                const errs = [];
                let maxerrs = 1; // adjust to show more of error stack

                // TODO:  should we use ajv.errorsText(e) ?
                //
                e.errors.forEach((err) => {
                    maxerrs -= 1;
                    if (maxerrs < 0) {
                        return;
                    }

                    errs.push(util.formatAjvErr(err));
                });

                return Promise.reject(log.warning({
                    status: 422,
                    message: 'declaration is invalid',
                    errors: errs
                }));
            }
            log.warning(`unable to digest declaration. Error: ${e.message}`);
            throw e;
        });
}

/**
 * replace mini-JWE's in object tree d(estination)
 * (typically part of declaration) with the
 * corresponding ones from s(ource).  Return
 * d(estination) (modified in place!)
 * Note: calls itself recursively
 *
 * @public
 * @param {object} s - source object
 * @param {object} d - destination object
 * @returns {undefined}
 */
function copySecrets(s, d) {
    let i;
    let p;

    if ((typeof d !== 'object') || (d === null)
        || (typeof s !== 'object') || (s === null)) {
        return;
    }

    const redacted = '<redacted>';

    if (Object.prototype.hasOwnProperty.call(d, 'method') && d.method === 'bearer-token') {
        d.token = s.token;
        return;
    }

    if (Object.prototype.hasOwnProperty.call(d, 'ciphertext')) {
        d.ciphertext = s.ciphertext;
        d.protected = s.protected;
        d.miniJWE = s.miniJWE;
        return;
    }
    // AWS credentials
    if (Object.prototype.hasOwnProperty.call(d, 'secretAccessKey')) {
        d.secretAccessKey = s.secretAccessKey;
        d.accessKeyId = redacted;
        return;
    }
    // Azure credentials
    if (Object.prototype.hasOwnProperty.call(d, 'apiAccessKey')) {
        d.apiAccessKey = s.apiAccessKey;
        d.resourceGroup = redacted;
        d.subscriptionId = redacted;
        d.directoryId = redacted;
        d.applicationId = redacted;
        return;
    }
    // GCE credentials
    if (Object.prototype.hasOwnProperty.call(d, 'encodedCredentials')) {
        d.encodedCredentials = s.encodedCredentials;
        return;
    }
    // Consul credentials
    if (d.encodedToken) {
        d.encodedToken = s.encodedToken;
        return;
    }
    if (Array.isArray(d)) {
        d.forEach((elem, idx) => {
            if ((typeof elem !== 'object') || (elem === null)
                 || (typeof s[idx] !== 'object') || (s[idx] === null)) {
                return;
            }
            copySecrets(s[idx], d[idx]);
        });
        return;
    }
    const props = Object.keys(d);
    for (i = 0; i < props.length; i += 1) {
        p = props[i];
        if ((typeof d[p] === 'object') && (d[p] !== null)
             && (typeof s[p] === 'object') && (s[p] !== null)) {
            copySecrets(s[p], d[p]);
        }
    }
}

module.exports = As3Parser;

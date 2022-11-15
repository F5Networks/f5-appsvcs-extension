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

const util = require('./util');
const certUtil = require('./certUtil');
const cloudLibUtils = require('./cloudLibUtils');

/**
 * given AS3 pointer 'path' from pointer 'src' in object
 * 'origin' in declaration 'root', check pointer syntax
 * (supplier may have erred) and fix up pointer to an
 * absolute relative JSON pointer ;-).  Upon success
 * return object path points-to (ignoring trailing #),
 * else throw error.  If 'patch', put fixed-up path
 * (if any) into 'dest[dest_ppty]'. If 'fetch' !== "",
 * copy value which fixed-up path points-to (resolving
 * any of our usual polymorphism) into 'val[val_ppty]'
 * (or "(restricted)" if value or ancestor has
 * !allowReuse set).  Word in 'fetch' says whether to
 * copy as "string", decoded from "base64", or whole
 * "object" (JSON-able parts only).  By handling fetch
 * here we save caller the trouble of walking down the
 * pointer from root again, since we (will) already
 * have a handle to desired sub-object
 *
 * @private
 * @param {string} path - path to be fixed-up
 * @param {string} src - JSON pointer to property from which path came
 * @param {object} origin - object from which path came
 * @param {object} root - root (declaration) object of which origin is descendant
 * @param {boolean} patch - if true, put fixed-up path into dest[dest_ppty]
 * @param {object} dest - object which may be patched
 * @param {string} dest_ppty - property of dest which may be patched
 * @param {string} fetch - if non-empty, copy what path points-to to val[val_ppty]
 * @param {object} val - object to which data may be copied
 * @param {string} val_ppty - property of val which may receive copy
 * @returns {object}
 */
function getAs3Object(path, src, origin, root, patch, dest, destPpty, fetch, val, valPpty) {
    if (!path.length) { return origin; }

    const defaultRegex = /^((@|[0-9]+)|(([0-9]*\x2f)?((@|[0-9]+|([A-Za-z_][0-9A-Za-z_.]{0,188}))\x2f)*([0-9]+|([A-Za-z_][0-9A-Za-z_.]{0,188}))))?#?$/;
    const appPropRegex = /^((@|[0-9]+)|(([0-9]*\x2f)?((@|[0-9]+|([A-Za-z_][0-9A-Za-z_.-]{0,188}[0-9A-Za-z_.]*))\x2f)*([0-9]+|([A-Za-z_][0-9A-Za-z_.-]{0,188}[0-9A-Za-z_.]))))?#?$/;
    const isAppLevelProp = src.split('/').length > 4 && origin.class !== 'Constants';

    if (path === '#' || !path.match(isAppLevelProp ? appPropRegex : defaultRegex)) {
        throw new Error('contains an invalid path (invalid character)');
    }

    let sharp = false;
    if (path.endsWith('#')) {
        sharp = true;
        path = path.slice(0, -1); // '#' not part of property name
    }

    // will want 'src' as vector of reference tokens
    const v = src.split('/');
    let p = v[v.length - 1];

    if (['use', 'copyFrom', 'reuseFrom'].indexOf(p) >= 0) {
        // disregard source-property polymorphism
        v.pop();
        if (v.length) { p = v[v.length - 1]; }
    }
    if ((v.length < 2) || (p === '')) {
        // error (this is weird)
        throw new Error('cannot ascertain path property name');
    }

    let obj;
    let i;
    let elems;

    // first char in path indicates "relativeness"
    let cc = path.charCodeAt(0);
    if (cc === 0x40) {
        // leading-@ path wants to proceed from nearest
        // ancestor with "class" (disregarding upstarts)

        obj = root; // root is always classy
        elems = v.slice(0, -1); // leaf is never classy
        for (i = 1; i < elems.length; i += 1) {
            p = elems[i].replace(/~1/g, '/').replace(/~0/g, '~');

            if (!Object.prototype.hasOwnProperty.call(obj[p], 'class')) {
                break;
            }

            obj = obj[p];
        }
        elems = elems.slice(0, i);

        // remove leading @ or @/
        if (path.length > 1) {
            if (path.charAt(1) !== '/') {
                // error (belt-and-suspenders; regex
                // above should have caught this)
                throw new Error('property name in path may not begin with @');
            }
            path = path.substr(1);
        }
        path = path.substr(1);

        // assemble path from root
        if (path.length) { elems = elems.concat(path.split('/')); }
    } else if ((cc >= 0x30) && (cc <= 0x39)) {
        // convert relative JSON pointer to path

        let pfx = (cc - 0x30);
        for (i = 1; ((i < path.length) && (pfx < 100) // eslint-disable-line no-cond-assign
            && ((cc = path.charCodeAt(i)) >= 0x30) && (cc <= 0x39)); i += 1) { // eslint-disable-line no-cond-assign
            // accumulate prefix
            pfx = (pfx * 10) + (cc - 0x30);
        }
        if ((pfx >= v.length) || (pfx > 99)) {
            throw new Error('contains relative JSON pointer with too-big prefix');
        }
        elems = v.slice(0, (v.length - pfx));

        path = path.substr(i);
        if (path.length) {
            if (path.charAt(0) !== '/') {
                throw new Error('contains invalid relative JSON pointer');
            }
            elems = elems.concat(path.substr(1).split('/'));
        }
    } else if (cc !== 0x2f) {
        // path relative to current Application

        if (v.length < 4) {
            throw new Error('contains relative path valid only within /Tenant/Application');
        }
        // assemble path from root
        elems = v.slice(0, 3).concat(path.split('/'));
    } else {
        // cool, an absolute path
        elems = path.split('/');
    }

    // fix up "/@/", reject cross-/T/A and otherwise-bogus ptrs
    let leaf = elems.pop();
    if (elems.length < 2) {
        throw new Error('contains invalid path (cross-/T/A)');
    }

    let target; // will be that which is pointed-to

    let hide = false;
    obj = root;
    if (elems.length < 3) {
        // handle this quickly-- Tenant without Application

        if (leaf === '@') { leaf = v[1]; } else if ((leaf !== v[1]) && (leaf !== 'Common')) {
            throw new Error('contains invalid path (Tenant without application)');
        }

        p = leaf.replace(/~1/g, '/').replace(/~0/g, '~');
        if (!Object.prototype.hasOwnProperty.call(obj, p)) {
            throw new Error(`contains path to non-existent object ${leaf}`);
        }
        hide = (Object.prototype.hasOwnProperty.call(obj, 'allowReuse') && !obj.allowReuse);

        elems.push(leaf);
        target = obj[p];
    } else {
        for (i = 1; i < elems.length; i += 1) {
            if (elems[i] === '@') {
                if (i >= v.length) {
                    throw new Error('contains path with too many @ tokens');
                }
                elems[i] = v[i];
            }

            p = elems[i].replace(/~1/g, '/').replace(/~0/g, '~');
            if (!Object.prototype.hasOwnProperty.call(obj, p) || (typeof obj[p] !== 'object')) {
                throw new Error(`contains path to non-existent object ${elems[i]}`);
            }
            hide = (Object.prototype.hasOwnProperty.call(obj, 'allowReuse') && !obj.allowReuse);

            obj = obj[p];

            if (((i === 1) && (elems[i] !== 'Common') && (elems[i] !== v[i]))
                || ((i === 2) && (elems[i] !== 'Shared') && ((i >= v.length) || (elems[i] !== v[i])))) {
                throw new Error('must contain path pointing into same Application (or /same-Tenant/Shared or /Common/Shared)');
            }
        }

        p = leaf.replace(/~1/g, '/').replace(/~0/g, '~');
        if (!Object.prototype.hasOwnProperty.call(obj, p)) {
            throw new Error(`contains path to non-existent object ${leaf}`);
        }
        hide = (Object.prototype.hasOwnProperty.call(obj, 'allowReuse') && !obj.allowReuse);

        elems.push(leaf);
        target = obj[p];
    }

    // eslint-disable-next-line no-unreachable-loop
    while ((fetch !== '') && (typeof val === 'object') && (valPpty !== '')) {
        // caller wants pointed-to value (transparent
        // to our usual polymorphism)

        if (hide) {
            // touch not mine anointed (1 Chron. 16:22)
            val[valPpty] = '(restricted)';
            break;
        }

        let t = typeof target;
        let value;

        if (sharp) {
            value = p; // property name
        } else if (t === 'string') {
            value = (fetch === 'decode') ? util.fromBase64(target).toString() : target;
        } else if (['number', 'boolean'].indexOf(t) >= 0) {
            value = target.toString();
        } else if ((t === 'object') && (fetch === 'object')) {
            // any code we might put here to scan the object
            // tree would likely be less performant than the
            // engine's hardcoded JSON.foo() functions
            const tmp = JSON.stringify(target, (k, v1) => {
                if (Object.prototype.hasOwnProperty.call(v1, 'allowReuse') && !v1.allowReuse) {
                    return '(restricted)';
                }
                // otherwise
                return v1;
            });
            value = JSON.parse(tmp);
        } else if (t === 'object') {
            let base64 = false;
            let got = null;

            // look for our kind of polymorphism (such as F5string)
            // (these properties are mutually exclusive)
            const poly = ['use', 'bigip', 'base64', 'url', 'copyFrom', 'reuseFrom', 'text'];
            for (i = 0; i < poly.length; i += 1) {
                if (Object.prototype.hasOwnProperty.call(target, poly[i])) {
                    base64 = (poly[i] === 'base64');
                    got = target[poly[i]];
                    break;
                }
            }
            if (got === null) { got = target; }

            // update (do not shortcut this above in case poly property isn't string)
            t = typeof got;
            if (['string', 'number', 'boolean'].indexOf(t) >= 0) {
                if (base64 && (fetch === 'decode')) {
                    got = util.fromBase64(got.toString());
                }
                value = got.toString();
            } else {
                // "object" includes (bleah!) array, null, date. We
                // emit JSON format EXCEPT no quotes around null/date
                // (we also deal with allowReuse on descendants)
                value = JSON.stringify(got, (k, v1) => {
                    if ((v1 !== null) && Object.prototype.hasOwnProperty.call(v1, 'allowReuse') && !v1.allowReuse) {
                        return '(restricted)';
                    }
                    // otherwise
                    return v1;
                });
                if ((value.charCodeAt(0) === 0x22)
                            && (value.charCodeAt(value.length - 1) === 0x22)) {
                    value = value.slice(1, -1);
                }
            }
        } else {
            value = ''; // includes undefined
        }

        val[valPpty] = value;
        break; // avoid infinite loop!
    }

    if (patch) {
        let pointer = elems.join('/');
        if (sharp) { pointer = pointer.concat('#'); }

        dest[destPpty] = pointer;
    }
    return target; // success
} // getAs3Object()

const extractPkcs12 = function (context, value, dest) {
    const pkcs12String = typeof value === 'string' ? value : value.toString('base64');
    return Promise.resolve()
        .then(() => {
            // if this is on a get, don't extract, the orig passphrases will have been replaced
            // problematic when ?show=full or ?show=expanded
            if (context.tasks[context.currentIndex].action === 'retrieve') {
                return Promise.resolve();
            }

            return Promise.resolve()
                .then(() => {
                    if (!dest.passphrase) {
                        return Promise.resolve();
                    }

                    const encryptedPwd = util.fromBase64(dest.passphrase.ciphertext).toString();
                    return cloudLibUtils.decryptFromRemote(context, encryptedPwd);
                })
                .then((plainPwd) => {
                    // if you use openssl press enter on pwd prompt without specifying a value,
                    // it's not "no password" - it's empty file. node-forge expects empty string
                    // users must specify the following passphrase (" ")
                    // "passphrase": {
                    //     "ciphertext": "IA==",
                    //     "protected": "eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0",
                    //     "ignoreChanges": true
                    // }
                    plainPwd = plainPwd === ' ' ? '' : plainPwd;
                    if (plainPwd === '') {
                        delete dest.passphrase;
                    }

                    if (!dest.pkcs12Options) {
                        dest.pkcs12Options = {
                            keyImportFormat: 'pkcs8'
                        };
                    }
                    // we might've already previously extracted
                    if (util.isEmptyOrUndefined(dest.pkcs12Options.internalOnly)) {
                        const options = {
                            keyFormat: dest.pkcs12Options.keyImportFormat,
                            importPassword: plainPwd
                        };
                        const certItem = certUtil.parsePkcs12(pkcs12String, options);
                        dest.pkcs12Options.internalOnly = [
                            certItem
                        ];
                    }
                });
        })
        .then(() => pkcs12String)
        .catch((error) => {
            error.message = `Unable to extract pkcs12 contents. Details: ${error.message}`;
            throw error;
        });
};

module.exports = {
    getAs3Object,
    extractPkcs12
};

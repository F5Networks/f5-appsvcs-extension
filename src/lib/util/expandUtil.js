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

const log = require('../log');
const extractUtil = require('./extractUtil');

/**
 * given string 'str' from source-pointer 'src' in
 * declaration 'root', expand backquote-escapes and
 * place result in 'dest[dest_ppty]'.  Return true
 * on success, else throw error
 *
 * @private
 * @param {string} str - string to expanded per backquote-escapes
 * @param {string} src - pointer to property from which str came
 * @param {object} origin - object from which str came
 * @param {object} root - root (declaration) object of which origin is descendant
 * @param {object} dest - object in which result will be placed
 * @param {string} dest_ppty - property of dest where result will go
 * @returns {boolean}
 */
function backquoteExpand(str, src, origin, root, dest, destPpty) {
    const bq = String.fromCharCode(0x60); // backquote
    let bqStartIndex;
    let bqEndIndex;
    let c;
    let p;
    let q;
    let tag;
    let msg;
    let rv;
    let obj;
    let classname;

    const strLen = str.length;
    bqStartIndex = str.indexOf(bq);
    if (!strLen || (bqStartIndex < 0)) {
        dest[destPpty] = str; // no escapes to expand
        return true;
    }

    // will want src as vector of reference tokens
    const v = src.split('/');
    if ((v.length > 1)
            && (['use', 'copyFrom', 'url'].indexOf(v[v.length - 1]) >= 0)) {
        v.pop();
    }

    // accumulate results as we scan str
    let accum = (bqStartIndex) ? str.slice(0, bqStartIndex) : '';
    str += '||'; // bumper

    while (bqStartIndex < strLen) {
        c = str.charAt(bqStartIndex + 1); // what kind of escape?

        if ('IFTAYMNOPQC'.includes(c)) {
            if (str.charAt(bqStartIndex + 2) !== bq) {
                throw new Error(`${src} \`${c}\` at ${
                    bqStartIndex}missing second backquote`);
            }
            bqStartIndex += 3;

            switch (c) {
            case 'I': // declaration ID
                accum += getValue(root, 'id');
                break;

            case 'F': // declaration Family
                accum += getValue(root, 'family');
                break;

            case 'T': // name of Tenant
                if (v.length > 1) {
                    accum += v[1].replace(/~1/g, '/').replace(/~0/g, '~');
                }
                break;

            case 'A': // name of Application
                if (v.length > 2) {
                    accum += v[2].replace(/~1/g, '/').replace(/~0/g, '~');
                }
                break;

            case 'Y': // tYpe of Application
                if (v.length > 2) {
                    p = v[1].replace(/~1/g, '/').replace(/~0/g, '~');
                    q = v[2].replace(/~1/g, '/').replace(/~0/g, '~');
                    accum += getValue(root[p][q], 'template');
                }
                break;

            case 'M': // name of named Member holding base value
                bqEndIndex = v.length - 1;
                while (v[bqEndIndex].match(/^[0-9]+$/) !== null) bqEndIndex -= 1;
                accum += v[bqEndIndex].replace(/~1/g, '/').replace(/~0/g, '~');
                break;

            case 'N': // Name of base value (as JSON pointer)
                accum += v.join('/'); // path (less trailing "use")
                break;

            case 'O': // nearest classy Object ancestor
            case 'P': // Pointer to O
            case 'Q': // pointer to member of O (may not match M)
            case 'C': // Class name of O
                obj = root; // root is always classy
                classname = 'ADC';

                for (bqEndIndex = 1; bqEndIndex < v.length; bqEndIndex += 1) {
                    p = v[bqEndIndex].replace(/~1/g, '/').replace(/~0/g, '~');

                    if (!Object.prototype.hasOwnProperty.call(obj[p], 'class')) break;

                    classname = getValue(obj[p], 'class');
                    obj = obj[p];
                }
                if (c === 'O') {
                    accum += v[bqEndIndex - 1].replace(/~1/g, '/').replace(/~0/g, '~');
                    break;
                }
                if (c === 'P') {
                    accum += (v.slice(0, (bqEndIndex - 1))).join('/');
                    break;
                }
                if (c === 'Q') {
                    accum += (v.slice(0, bqEndIndex)).join('/');
                    break;
                }
                // otherwise (c === 'C')
                accum += classname;
                break;

            default:
                throw new Error(`unimplemented \`${c}\` in backquoteExpand()`);
            }

            bqEndIndex = str.indexOf(bq, bqStartIndex);
            if (bqEndIndex < 0) {
                bqEndIndex = strLen;
            }
            accum += str.slice(bqStartIndex, bqEndIndex);
            bqStartIndex = bqEndIndex;

            // to next escape or finished
            continue; // eslint-disable-line no-continue
        }

        switch (c) {
        case bq: // one backquote
            accum += bq;
            bqStartIndex += 2;
            break;

        case '~': // elide and stop expanding
            if (str.charAt(bqStartIndex + 2) === bq) {
                dest[destPpty] = accum.concat(str.slice((bqStartIndex + 3), -2));
                return true;
            }
            throw new Error(`${src} \`~\` at ${
                bqStartIndex} missing second backquote`);

        case '!': // emit log message (containing optional tag)
        case '*': // normalized AS3 pointer
        case '=': // value from normalized AS3 pointer
        case '+': // like '=' but decode base64 to string
            bqEndIndex = str.indexOf(bq, (bqStartIndex + 2));
            if (bqEndIndex < 0) {
                throw new Error(`${src} \`${c}\` at ${bqStartIndex} missing second backquote`);
            }
            tag = str.slice((bqStartIndex + 2), bqEndIndex);
            bqStartIndex = bqEndIndex + 1;

            if (c === '!') {
                msg = `alert (${tag}) expanding '${
                    src}' at ${bqStartIndex}`;
                log.notice(msg);
                break;
            }

            if (tag === '') {
                throw new Error(`${src} \`${c}\` at ${bqStartIndex}missing pointer`);
            }

            rv = {};
            try {
                extractUtil.getAs3Object(
                    tag,
                    src,
                    origin,
                    root,
                    true,
                    rv,
                    'ptr',
                    ((c === '+') ? 'decode' : 'string'),
                    rv,
                    'val'
                );
                if (rv.ptr === '') {
                    throw new Error('points nowhere');
                }
            } catch (e) {
                throw new Error(`${src} \`${c}${tag}\` at ${bqStartIndex} ${e.message}`);
            }

            // does caller want path or value it points to?
            if (c === '*') {
                accum += rv.ptr;
            } else {
                accum += rv.val;
            }
            break;

        default:
            throw new Error(`${src}  unrecognized escape \`${c}\` at ${bqStartIndex}`);
        }

        bqEndIndex = str.indexOf(bq, bqStartIndex);
        if (bqEndIndex < 0) {
            bqEndIndex = strLen;
        }
        accum += str.slice(bqStartIndex, bqEndIndex);
        bqStartIndex = bqEndIndex;
    }

    dest[destPpty] = accum;
    return true;
}

/**
 * given object 'obj', property name 'ppty', and
 * default value 'dfl', return value of obj[ppty]
 * if any, else dfl.  Missing dfl is empty string
 *
 * @private
 * @param {object} obj - intended source of value
 * @param {string} ppty - name of obj's property containing value
 * @param {object} [dfl] - value to return if obj[ppty] is undefined
 */
function getValue(obj, ppty, dfl) {
    if (typeof dfl === 'undefined') { dfl = ''; }

    return (Object.prototype.hasOwnProperty.call(obj, ppty)
        && (obj[ppty] !== undefined)) ? obj[ppty] : dfl;
}

module.exports = {
    backquoteExpand
};

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

const forge = require('node-forge');

// PFX (Personal inFormation eXchange)
// - version
// - authSafe: type of data or signed data(pkcs7), usually data
// - macData(optional)

// authSafe is either signed (public key) or MACed (password integrity)
// authSafe contains sequence of ContentInfo which may be plaintext, enveloped, or encrypted

// PFX ::= SEQUENCE {
//     version     INTEGER {v3(3)}(v3,...),
//     authSafe    ContentInfo,
//     macData     MacData OPTIONAL
// }

// MacData ::= SEQUENCE {
//     mac         DigestInfo,
//     macSalt     OCTET STRING,
//     iterations  INTEGER DEFAULT 1
//     -- Note: The default is for historical reasons and its
//     --       use is deprecated.
// }

const contentInfoValidator = {
    name: 'ContentInfo',
    tagClass: forge.asn1.Class.UNIVERSAL,
    type: forge.asn1.Type.SEQUENCE,
    constructed: true,
    value: [{
        name: 'ContentInfo.contentType',
        tagClass: forge.asn1.Class.UNIVERSAL,
        type: forge.asn1.Type.OID,
        constructed: false,
        capture: 'contentType'
    }, {
        name: 'ContentInfo.content',
        tagClass: forge.asn1.Class.CONTEXT_SPECIFIC,
        constructed: true,
        captureAsn1: 'content'
    }]
};

const pfxValidator = {
    name: 'PFX',
    tagClass: forge.asn1.Class.UNIVERSAL,
    type: forge.asn1.Type.SEQUENCE,
    constructed: true,
    value: [{
        name: 'PFX.version',
        tagClass: forge.asn1.Class.UNIVERSAL,
        type: forge.asn1.Type.INTEGER,
        constructed: false,
        capture: 'version'
    },
    contentInfoValidator, {
        name: 'PFX.macData',
        tagClass: forge.asn1.Class.UNIVERSAL,
        type: forge.asn1.Type.SEQUENCE,
        constructed: true,
        optional: true,
        captureAsn1: 'mac',
        value: [{
            name: 'PFX.macData.mac',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.SEQUENCE,
            constructed: true,
            value: [{
                name: 'PFX.macData.mac.digestAlgorithm',
                tagClass: forge.asn1.Class.UNIVERSAL,
                type: forge.asn1.Type.SEQUENCE,
                constructed: true,
                value: [{
                    name: 'PFX.macData.mac.digestAlgorithm.algorithm',
                    tagClass: forge.asn1.Class.UNIVERSAL,
                    type: forge.asn1.Type.OID,
                    constructed: false,
                    capture: 'macAlgorithm'
                }, {
                    name: 'PFX.macData.mac.digestAlgorithm.parameters',
                    tagClass: forge.asn1.Class.UNIVERSAL,
                    captureAsn1: 'macAlgorithmParameters'
                }]
            }, {
                name: 'PFX.macData.mac.digest',
                tagClass: forge.asn1.Class.UNIVERSAL,
                type: forge.asn1.Type.OCTETSTRING,
                constructed: false,
                capture: 'macDigest'
            }]
        }, {
            name: 'PFX.macData.macSalt',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.OCTETSTRING,
            constructed: false,
            capture: 'macSalt'
        }, {
            name: 'PFX.macData.iterations',
            tagClass: forge.asn1.Class.UNIVERSAL,
            type: forge.asn1.Type.INTEGER,
            constructed: false,
            optional: true,
            capture: 'macIterations'
        }]
    }]
};

const KEY_FORMATS = {
    PKCS8: 'pkcs8',
    OPENSSL: 'openssl-legacy'
};

const getPkcs12Asn1 = function (pkcs12Item) {
    const pkcs12Der = forge.util.decode64(pkcs12Item);
    return forge.asn1.fromDer(pkcs12Der);
};

// from node-forge
const decodePkcs7Data = function (data) {
    // handle special case of "chunked" data content: an octet string composed
    // of other octet strings
    if (data.composed || data.constructed) {
        const value = forge.util.createBuffer();
        // eslint-disable-next-line
        for (let i = 0; i < data.value.length; ++i) {
            value.putBytes(data.value[i].value);
        }
        data.composed = false;
        data.constructed = false;
        data.value = value.getBytes();
    }
    return data;
};

const getAlgorithm = function (pkcs12Asn1) {
    // default for forge
    const alg = {
        algorithm: 'aes128'
    };
    let capture = {};
    const errors = [];
    forge.asn1.validate(pkcs12Asn1, pfxValidator, capture, errors);
    const pkcs7 = decodePkcs7Data(capture.content.value[0]);
    const authSafe = forge.asn1.fromDer(pkcs7.value);

    capture = {};
    authSafe.value.forEach((safe) => {
        const contentInfo = safe;
        forge.asn1.validate(contentInfo, contentInfoValidator, capture, errors);
        const data = capture.content.value[0];
        const contentType = forge.asn1.derToOid(capture.contentType);
        if (contentType === forge.pki.oids.encryptedData) {
            capture = {};
            forge.asn1.validate(data, forge.pkcs7.asn1.encryptedDataValidator, capture, errors);
            const algOid = forge.asn1.derToOid(capture.encAlgorithm);
            if (algOid === forge.pki.oids['pbeWithSHAAnd3-KeyTripleDES-CBC']) {
                alg.algorithm = '3des';
            }
        }
    });
    return alg;
};

const getKeyFromPkcs12 = function (pkcs12Obj, options, decrypted) {
    let key;
    let privateKey;
    let bags;
    let keyBags = pkcs12Obj.getBags({ bagType: forge.pki.oids.keyBag });

    // type PrivateKeyInfo, always just one key
    if (keyBags[forge.pki.oids.keyBag][0]) {
        bags = keyBags[forge.pki.oids.keyBag];
        key = bags[0].key;
        if (key === null) {
            key = bags[0].asn1;
            key = forge.asn1.toDer(key).getBytes();
        } else {
            key = forge.pki.privateKeyToPem(key);
        }
        privateKey = key.replace(/\r?\n|\r/g, '\n');
    } else {
        // type EncryptedPrivateKeyInfo, always just one key
        keyBags = pkcs12Obj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        if (keyBags) {
            bags = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
            if (bags && bags[0]) {
                key = bags[0].key;
                // node-forge deserializes private key entirely
                // see https://github.com/digitalbazaar/forge/issues/258#issuecomment-103498711

                if (options.keyFormat === KEY_FORMATS.PKCS8) {
                    // convert node-forge private key to ASN1
                    key = forge.pki.privateKeyToAsn1(key);
                    // convert to ASN1 PrivateKeyInfo then to PEM
                    key = forge.pki.wrapRsaPrivateKey(key);

                    if (options.importPassword && !decrypted) {
                        const alg = getAlgorithm(options.pkcs12Asn1);
                        const encryptedPKInfo = forge.pki.encryptPrivateKeyInfo(key, options.importPassword, alg);
                        key = forge.pki.encryptedPrivateKeyToPem(encryptedPKInfo);
                    } else {
                        key = forge.pki.privateKeyInfoToPem(key);
                    }
                }

                if (options.keyFormat === KEY_FORMATS.OPENSSL) {
                    if (options.importPassword && !decrypted) {
                        const alg = getAlgorithm(options.pkcs12Asn1);
                        alg.legacy = true;
                        key = forge.pki.encryptRsaPrivateKey(key, options.importPassword, alg);
                    } else {
                        key = forge.pki.privateKeyToPem(key);
                    }
                }

                privateKey = key.replace(/\r?\n|\r/g, '\n');
            }
        }
    }
    return privateKey;
};

const getCertFromPkcs12 = function (pkcs12Obj) {
    // Contains X.509 or SDSI certificates
    const certBags = pkcs12Obj.getBags({ bagType: forge.pki.oids.certBag });

    const certs = certBags[forge.pki.oids.certBag].map((bag) => {
        const certObj = bag.cert;
        const cert = forge.pki.certificateToPem(certObj);
        return cert.replace(/\r?\n|\r/g, '\n');
    });

    return certs;
};

const parsePkcs12 = function (pkcs12Item, options) {
    const pkcs12Asn1 = getPkcs12Asn1(pkcs12Item);
    options.pkcs12Asn1 = pkcs12Asn1;

    // we're only handling the common case of file import/export password (integrity)
    // being the same as encrypted private key passphrase (privacy)
    // see -twopass arg for openssl: https://linux.die.net/man/1/pkcs12
    let pkcs12Obj = {};
    if (typeof options.importPassword === 'undefined') {
        pkcs12Obj = forge.pkcs12.pkcs12FromAsn1(pkcs12Asn1);
    } else {
        pkcs12Obj = forge.pkcs12.pkcs12FromAsn1(pkcs12Asn1, options.importPassword);
    }
    return {
        certificates: getCertFromPkcs12(pkcs12Obj),
        privateKey: getKeyFromPkcs12(pkcs12Obj, options)
    };
};

const checkIfSelfSigned = function (cert) {
    const pki = forge.pki;
    const caStore = pki.createCaStore([cert]);
    const addedCert = caStore.listAllCertificates()[0];
    return addedCert.isIssuer(addedCert);
};

const validateCertificates = function (decl, errors) {
    Object.keys(decl).forEach((key) => {
        if (typeof decl[key] === 'object' && decl[key].class === 'Certificate'
        && (decl[key].staplerOCSP || decl[key].issuerCertificate)) {
            const selfSigned = checkIfSelfSigned(decl[key].certificate);
            if (selfSigned) {
                const error = {
                    dataPath: key,
                    message: 'staplerOCSP or issuerCertificate cannot be used with a self-signed certificate'
                };
                errors.push(error);
            }
        } else if (typeof decl[key] === 'object' && decl[key].class) {
            validateCertificates(decl[key], errors);
        }
    });
    return errors;
};

module.exports = {
    parsePkcs12,
    validateCertificates,
    checkIfSelfSigned
};

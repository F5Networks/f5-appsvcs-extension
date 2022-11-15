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

const {
    assertClass,
    getBigIpVersion,
    createExtractSecret,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

const extractFunctions = {
    hashCount(result) {
        return result.hashLength;
    },
    persistenceMethod(result) {
        let method = '';
        const resultKind = result.kind.substring(result.kind.indexOf('persistence:') + 12, result.kind.lastIndexOf(':'));
        switch (resultKind) {
        case 'source-addr':
            method = 'source-address';
            break;
        case 'sip':
            method = 'sip-info';
            break;
        case 'ssl':
            method = 'tls-session-id';
            break;
        case 'dest-addr':
            method = 'destination-address';
            break;
        default:
            method = resultKind;
            break;
        }
        return method;
    },
    iRule(result) {
        return result.rule ? result.rule.name : undefined;
    }
};

const iRules = {
    hashRule: {
        class: 'iRule',
        iRule: {
            base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KICBwZXJzaXN0IGhhc2ggW0hUVFA6OmhlYWRlciBteWhlYWRlcl0NCn0='
        }
    }
};

describe('Persist', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertPersistClass(properties) {
        return assertClass('Persist', properties);
    }

    it('Cookie - insert cookieMethod', () => {
        const secret = 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0';
        let secretExpected = '$M$';
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            secretExpected = true;
        }

        const properties = [
            {
                name: 'remark',
                inputValue: ['none', 'description', 'none'],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'persistenceMethod',
                inputValue: ['cookie'],
                expectedValue: ['cookie'],
                extractFunction: extractFunctions.persistenceMethod
            },
            {
                name: 'matchAcrossPools',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'matchAcrossVirtualPorts',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'matchAcrossVirtualAddresses',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'overrideConnectionLimit',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'duration',
                inputValue: [undefined, 12000, undefined],
                expectedValue: ['indefinite', 12000, 'indefinite']
            },
            {
                name: 'cookieMethod',
                inputValue: [undefined],
                expectedValue: ['insert']
            },
            {
                name: 'cookieName',
                inputValue: [undefined, 'cookie', undefined],
                expectedValue: ['none', 'cookie', 'none'],
                extractFunction: (o) => o.cookieName || 'none'
            },
            {
                name: 'ttl',
                inputValue: [undefined, 100, undefined],
                expectedValue: [0, '1:40', 0]
            },
            {
                name: 'httpOnly',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'secure',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'alwaysSet',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'encrypt',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'required', 'disabled']
            },
            {
                name: 'passphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjU=',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0=',
                        ignoreChanges: true
                    },
                    undefined
                ],
                expectedValue: [
                    false,
                    secretExpected,
                    false
                ],
                extractFunction: createExtractSecret('cookieEncryptionPassphrase', secret)
            }
        ];
        return assertPersistClass(properties);
    });

    it('Cookie - hash cookieMethod', () => {
        const properties = [
            {
                name: 'persistenceMethod',
                inputValue: ['cookie'],
                expectedValue: ['cookie'],
                extractFunction: extractFunctions.persistenceMethod
            },
            {
                name: 'mirror',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'cookieMethod',
                inputValue: ['hash'],
                expectedValue: ['hash']
            },
            {
                name: 'cookieName',
                inputValue: ['name'],
                expectedValue: ['name']
            },
            {
                name: 'startAt',
                inputValue: [undefined, 2000, undefined],
                expectedValue: [0, 2000, 0]
            },
            {
                name: 'hashCount',
                inputValue: [undefined, 1300, undefined],
                expectedValue: [0, 1300, 0],
                extractFunction: (o) => o.hashLength
            }
        ];
        return assertPersistClass(properties);
    });

    it('destination-address', () => {
        const properties = [
            {
                name: 'persistenceMethod',
                inputValue: ['destination-address'],
                expectedValue: ['destination-address'],
                extractFunction: extractFunctions.persistenceMethod
            },
            {
                name: 'hashAlgorithm',
                inputValue: [undefined, 'carp', undefined],
                expectedValue: ['default', 'carp', 'default']
            },
            {
                name: 'addressMask',
                inputValue: [undefined, '255.255.0.0', undefined],
                expectedValue: ['none', '255.255.0.0', 'none']
            }
        ];
        return assertPersistClass(properties);
    });

    it('hash', () => {
        const properties = [
            {
                name: 'persistenceMethod',
                inputValue: ['hash'],
                expectedValue: ['hash'],
                extractFunction: extractFunctions.persistenceMethod
            },
            {
                name: 'startPattern',
                // Note: Input value here is escaped JSON.
                // Actual value: /Chapter (\d+)\.\d*/
                inputValue: [undefined, '/Chapter (\\d+)\\.\\d*/', undefined],
                expectedValue: ['none', '/Chapter (\\\\d+)\\\\.\\\\d*/', 'none'],
                extractFunction: (o) => o.hashStartPattern || 'none'
            },
            {
                name: 'endPattern',
                // Actual value: (^|[ \t])([-+]?(\d+|\.\d+|\d+\.\d*))($|[^+-.])
                // Mcp value would have ? escaped.
                inputValue: [undefined, '(^|[ \\t])([-+]?(\\d+|\\.\\d+|\\d+\\.\\d*))($|[^+-.])', undefined],
                // eslint-disable-next-line no-useless-escape
                expectedValue: ['none', '(^|[ \\\\t])([-+]\\?(\\\\d+|\\\\.\\\\d+|\\\\d+\\\\.\\\\d*))($|[^+-.])', 'none'],
                extractFunction: (o) => o.hashEndPattern || 'none'
            },
            {
                name: 'bufferLimit',
                inputValue: [undefined, 40000, undefined],
                expectedValue: [0, 40000, 0]
            },
            {
                name: 'iRule',
                inputValue: [undefined, 'theRule', { use: 'theRule' }, undefined],
                expectedValue: [undefined, 'theRule', 'theRule', undefined],
                referenceObjects: {
                    theRule: iRules.hashRule
                },
                extractFunction: extractFunctions.iRule
            }
        ];
        return assertPersistClass(properties);
    });

    it('msrdp', () => {
        const properties = [
            {
                name: 'persistenceMethod',
                inputValue: ['msrdp'],
                expectedValue: ['msrdp'],
                extractFunction: extractFunctions.persistenceMethod
            },
            {
                name: 'sessionBroker',
                inputValue: [undefined, false, undefined],
                expectedValue: ['yes', 'no', 'yes']
            }
        ];
        return assertPersistClass(properties);
    });

    it('sip-info', () => {
        const properties = [
            {
                name: 'persistenceMethod',
                inputValue: ['sip-info'],
                expectedValue: ['sip-info'],
                extractFunction: extractFunctions.persistenceMethod
            },
            {
                name: 'header',
                inputValue: ['aHeader', 'newHeader', 'aHeader'],
                expectedValue: ['aHeader', 'newHeader', 'aHeader']
            }
        ];
        return assertPersistClass(properties);
    });
});

/**
 * Copyright 2026 F5, Inc.
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
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const domainAAAA = {
    description: 'AAAA description',
    domainName: 'test.domainAAAA',
    loadBalancingDecisionLogVerbosity:
    [
        'pool-selection',
        'pool-traversal',
        'pool-member-selection',
        'pool-member-traversal'
    ],
    resourceRecordType: 'AAAA',
    aliases: ['*test1.aaaa?', '*test2.aaaa', '?test3.aaaa']
};

const domainCNAME = {
    description: 'CNAME description',
    domainName: 'type.changes',
    resourceRecordType: 'CNAME',
    aliases: ['*.test.cname'],
    poolLbMode: 'global-availability',
    enabled: false
};

const domainMX = {
    description: 'MX description',
    domainName: 'type.changes',
    resourceRecordType: 'MX',
    aliases: ['?.test.mx'],
    poolLbMode: 'ratio',
    enabled: true
};

const domainNAPTR = {
    description: 'NAPTR description',
    domainName: 'type.changes',
    resourceRecordType: 'NAPTR',
    aliases: ['?.test.naptr'],
    poolbMode: 'round-robin',
    enabled: false
};

const extractFunctions = {
    description(result) {
        return result.description;
    },
    domainName(result) {
        return result.name;
    },
    resourceRecordType(result) {
        const startIndex = result.selfLink.indexOf('wideip/') + 7;
        const endIndex = result.selfLink.lastIndexOf('/');
        const recType = result.selfLink.substring(startIndex, endIndex);
        return recType.toUpperCase();
    },
    enabled(result) {
        // values are disabled:true or enabled:true
        if (result.enabled) {
            return true;
        }
        return false;
    },
    aliases(result) {
        if (result.aliases) {
            return result.aliases
                .map((a) => a.replace('\\?', '?'));
        }
        return undefined;
    },
    pools(result) {
        return (result.pools || []).map((p) => ({ name: p.name, order: p.order, ratio: p.ratio }));
    },
    poolsCname(result) {
        return (result.poolsCname || []).map((p) => p.name);
    },
    lastResortPool(result) {
        return result.lastResortPool;
    },
    lastResortPoolType(result) {
        return result.lastResortPool.split(' ')[0];
    },
    iRules(result) {
        const values = [];
        if (result.rules) {
            result.rules.forEach((r) => values.push(r.fullPath));
        }
        return values;
    }
};

describe('GSLB Domain', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    it('All properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [domainAAAA.description],
                expectedValue: [domainAAAA.description],
                extractFunctions: extractFunctions.description
            },
            {
                name: 'domainName',
                inputValue: [domainAAAA.domainName],
                expectedValue: [domainAAAA.domainName],
                extractFunction: extractFunctions.domainName
            },
            {
                name: 'resourceRecordType',
                inputValue: [domainAAAA.resourceRecordType],
                expectedValue: [domainAAAA.resourceRecordType],
                extractFunction: extractFunctions.resourceRecordType
            },
            {
                name: 'enabled',
                inputValue: [undefined, false, undefined],
                expectedValue: [true, false, true],
                extractFunction: extractFunctions.enabled
            },
            {
                name: 'failureRcodeResponse',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: extractFunctions.failureRcodeResponse
            },
            {
                name: 'failureRcode',
                inputValue: [undefined, 'refused', undefined],
                expectedValue: ['noerror', 'refused', 'noerror'],
                extractFunction: extractFunctions.failureRcode
            },
            {
                name: 'failureRcodeTtl',
                inputValue: [undefined, 1000, undefined],
                expectedValue: [0, 1000, 0],
                extractFunction: extractFunctions.failureRcodeTtl
            },
            {
                name: 'loadBalancingDecisionLogVerbosity',
                inputValue: [undefined, domainAAAA.loadBalancingDecisionLogVerbosity, undefined],
                expectedValue: [undefined, domainAAAA.loadBalancingDecisionLogVerbosity, undefined]
            },
            {
                name: 'poolLbMode',
                inputValue: [undefined, 'topology', undefined],
                expectedValue: ['round-robin', 'topology', 'round-robin']
            },
            {
                name: 'aliases',
                inputValue: [undefined, domainAAAA.aliases, undefined],
                expectedValue: [undefined, domainAAAA.aliases, undefined],
                extractFunction: extractFunctions.aliases
            },
            {
                name: 'pools',
                inputValue: [
                    undefined,
                    [{ ratio: 1, use: 'poolAAAA1' }, { ratio: 2, use: 'poolAAAA2' }],
                    [{ ratio: 4, use: 'poolAAAA2' }, { ratio: 3, use: 'poolAAAA1' }]
                ],
                expectedValue: [[],
                    [{ name: 'poolAAAA1', order: 0, ratio: 1 }, { name: 'poolAAAA2', order: 1, ratio: 2 }],
                    [{ name: 'poolAAAA1', order: 1, ratio: 3 }, { name: 'poolAAAA2', order: 0, ratio: 4 }]
                ],
                extractFunction: extractFunctions.pools,
                referenceObjects: {
                    poolAAAA1: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'AAAA'
                    },
                    poolAAAA2: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'AAAA'
                    }
                }
            },
            {
                name: 'poolsCname',
                inputValue: [
                    [{ use: 'poolCNAME1' }, { use: 'poolCNAME2' }],
                    undefined
                ],
                expectedValue: [['poolCNAME1', 'poolCNAME2'], []],
                extractFunction: extractFunctions.poolsCname,
                referenceObjects: {
                    poolCNAME1: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'CNAME'
                    },
                    poolCNAME2: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'CNAME'
                    }
                }
            },
            {
                name: 'iRules',
                inputValue: [
                    undefined,
                    [
                        'theRule2',
                        'theRule1'
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        '/TEST_GSLB_Domain/Application/theRule2',
                        '/TEST_GSLB_Domain/Application/theRule1'
                    ],
                    []
                ],
                extractFunction: (o) => {
                    const values = [];
                    if (o.rules) {
                        o.rules.forEach((r) => values.push(r.fullPath));
                    }
                    return values;
                },
                referenceObjects: {
                    theRule1: {
                        class: 'GSLB_iRule',
                        iRule: 'when DNS_REQUEST { }'
                    },
                    theRule2: {
                        class: 'GSLB_iRule',
                        iRule: 'when DNS_REQUEST { }'
                    }
                }
            },
            {
                name: 'persistenceEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'persistCidrIpv4',
                inputValue: [undefined, 0, undefined],
                expectedValue: [32, 0, 32]
            },
            {
                name: 'persistCidrIpv6',
                inputValue: [undefined, 0, undefined],
                expectedValue: [128, 0, 128]
            },
            {
                name: 'ttlPersistence',
                inputValue: [undefined, 4294967295, undefined],
                expectedValue: [3600, 4294967295, 3600]
            },
            {
                name: 'clientSubnetPreferred',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                minVersion: '14.1'
            }
        ];
        const opts = {
            getMcpObject: {
                itemName: domainAAAA.domainName
            }
        };
        return assertClass('GSLB_Domain', properties, opts);
    });

    it('update - type change', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [domainCNAME.description, domainMX.description, domainNAPTR.description],
                expectedValue: [domainCNAME.description, domainMX.description, domainNAPTR.description],
                extractFunctions: extractFunctions.description
            },
            {
                name: 'domainName',
                inputValue: [domainCNAME.domainName, domainMX.domainName, domainNAPTR.domainName],
                expectedValue: [domainCNAME.domainName, domainMX.domainName, domainNAPTR.domainName],
                extractFunction: extractFunctions.domainName
            },
            {
                name: 'resourceRecordType',
                inputValue: [domainCNAME.resourceRecordType, domainMX.resourceRecordType,
                    domainNAPTR.resourceRecordType],
                expectedValue: [domainCNAME.resourceRecordType, domainMX.resourceRecordType,
                    domainNAPTR.resourceRecordType],
                extractFunction: extractFunctions.resourceRecordType
            },
            {
                name: 'enabled',
                inputValue: [domainCNAME.enabled, domainMX.enabled, domainNAPTR.enabled],
                expectedValue: [domainCNAME.enabled, domainMX.enabled, domainNAPTR.enabled],
                extractFunction: extractFunctions.enabled
            },
            {
                name: 'failureRcodeResponse',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: extractFunctions.failureRcodeResponse
            },
            {
                name: 'failureRcode',
                inputValue: [undefined, 'refused', undefined],
                expectedValue: ['noerror', 'refused', 'noerror'],
                extractFunction: extractFunctions.failureRcode
            },
            {
                name: 'failureRcodeTtl',
                inputValue: [undefined, 1000, undefined],
                expectedValue: [0, 1000, 0],
                extractFunction: extractFunctions.failureRcodeTtl
            },
            {
                name: 'poolLbMode',
                inputValue: [domainCNAME.poolLbMode, domainMX.poolLbMode, domainNAPTR.poolbMode],
                expectedValue: [domainCNAME.poolLbMode, domainMX.poolLbMode, domainNAPTR.poolbMode]
            },
            {
                name: 'aliases',
                inputValue: [domainCNAME.aliases, domainMX.aliases, domainNAPTR.aliases],
                expectedValue: [domainCNAME.aliases, domainMX.aliases, domainNAPTR.aliases],
                extractFunction: extractFunctions.aliases
            },
            {
                name: 'lastResortPool',
                inputValue: [{ use: 'pool1' }, { use: 'pool2' }, { use: 'pool3' }, undefined],
                expectedValue: [
                    'cname /TEST_GSLB_Domain/Application/pool1',
                    'mx /TEST_GSLB_Domain/Application/pool2',
                    'naptr /TEST_GSLB_Domain/Application/pool3',
                    ''
                ],
                extractFunction: extractFunctions.lastResortPool,
                referenceObjects: {
                    pool1: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'CNAME'
                    },
                    pool2: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'MX'
                    },
                    pool3: {
                        class: 'GSLB_Pool',
                        resourceRecordType: 'NAPTR'
                    }
                }
            },
            {
                name: 'lastResortPoolType',
                inputValue: ['CNAME', 'MX', 'NAPTR', undefined],
                expectedValue: ['cname', 'mx', 'naptr', ''],
                extractFunction: extractFunctions.lastResortPoolType
            },
            {
                name: 'iRules',
                inputValue: [
                    [
                        { use: 'theRule1' }
                    ],
                    [
                        { use: 'theRule2' }
                    ],
                    [
                        { use: 'theRule1' }
                    ],
                    undefined
                ],
                expectedValue: [
                    [
                        '/TEST_GSLB_Domain/Application/theRule1'
                    ],
                    [
                        '/TEST_GSLB_Domain/Application/theRule2'
                    ],
                    [
                        '/TEST_GSLB_Domain/Application/theRule1'
                    ],
                    []
                ],
                extractFunction: (o) => {
                    const values = [];
                    if (o.rules) {
                        o.rules.forEach((r) => values.push(r.fullPath));
                    }
                    return values;
                },
                referenceObjects: {
                    theRule1: {
                        class: 'GSLB_iRule',
                        iRule: 'when DNS_REQUEST { }'
                    },
                    theRule2: {
                        class: 'GSLB_iRule',
                        iRule: 'when DNS_REQUEST { }'
                    }
                }
            },
            {
                name: 'persistenceEnabled',
                inputValue: [undefined, true, undefined, true],
                expectedValue: ['disabled', 'enabled', 'disabled', 'enabled']
            },
            {
                name: 'persistCidrIpv4',
                inputValue: [undefined, 0, undefined, 0],
                expectedValue: [32, 0, 32, 0]
            },
            {
                name: 'persistCidrIpv6',
                inputValue: [undefined, 0, undefined, 0],
                expectedValue: [128, 0, 128, 0]
            },
            {
                name: 'ttlPersistence',
                inputValue: [undefined, 4294967295, undefined, 4294967295],
                expectedValue: [3600, 4294967295, 3600, 4294967295]
            },
            {
                name: 'clientSubnetPreferred',
                inputValue: [undefined, true, undefined, true],
                expectedValue: ['disabled', 'enabled', 'disabled', 'enabled'],
                minVersion: '14.1'
            }
        ];
        const opts = {
            getMcpObject: {
                itemName: domainCNAME.domainName
            }
        };
        return assertClass('GSLB_Domain', properties, opts);
    });
});

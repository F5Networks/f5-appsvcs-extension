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

const {
    assertClass,
    assertModuleProvisioned,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('SSH Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertSshProfileClass(properties, options) {
        return assertClass('SSH_Proxy_Profile', properties, options);
    }

    it('All Properties', function () {
        assertModuleProvisioned.call(this, 'afm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'funky', undefined],
                expectedValue: [undefined, 'funky', undefined]
            },
            {
                name: 'sshProfileDefaultActions',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'sshProfileDefaultActions.name',
                inputValue: [undefined, 'action', undefined],
                expectedValue: ['undefined', 'action', 'undefined'],
                extractFunction: (o) => o.actions[0].name
            },
            {
                name: 'sshProfileDefaultActions.agentAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].agentAction.control
            },
            {
                name: 'sshProfileDefaultActions.localForwardAction',
                inputValue: [
                    undefined,
                    {
                        control: 'disallow',
                        log: false
                    },
                    undefined
                ],
                expectedValue: ['allow', 'disallow', 'allow'],
                extractFunction: (o) => o.actions[0].localForwardAction.control
            },
            {
                name: 'sshProfileDefaultActions.otherAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].otherAction.control
            },
            {
                name: 'sshProfileDefaultActions.remoteForwardAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].remoteForwardAction.control
            },
            {
                name: 'sshProfileDefaultActions.rexecAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].rexecAction.control
            },
            {
                name: 'sshProfileDefaultActions.scpUpAction',
                inputValue: [
                    undefined,
                    {
                        control: 'disallow',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'disallow', 'allow'],
                extractFunction: (o) => o.actions[0].scpUpAction.control
            },
            {
                name: 'sshProfileDefaultActions.scpDownAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].scpDownAction.control
            },
            {
                name: 'sshProfileDefaultActions.sftpUpAction',
                inputValue: [
                    undefined,
                    {
                        control: 'disallow',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'disallow', 'allow'],
                extractFunction: (o) => o.actions[0].sftpUpAction.control
            },
            {
                name: 'sshProfileDefaultActions.sftpDownAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].sftpDownAction.control
            },
            {
                name: 'sshProfileDefaultActions.shellAction',
                inputValue: [
                    undefined,
                    {
                        control: 'disallow',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'disallow', 'allow'],
                extractFunction: (o) => o.actions[0].shellAction.control
            },
            {
                name: 'sshProfileDefaultActions.subSystemAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].subSystemAction.control
            },
            {
                name: 'sshProfileDefaultActions.x11ForwardAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['allow', 'terminate', 'allow'],
                extractFunction: (o) => o.actions[0].x11ForwardAction.control
            },
            {
                name: 'sshProfileRuleSet',
                inputValue: [[]],
                skipAssert: true
            },
            {
                name: 'sshProfileRuleSet.0',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'sshProfileRuleSet.0.name',
                inputValue: ['rule', 'rule1', 'rule'],
                expectedValue: ['rule', 'rule1', 'rule'],
                extractFunction: (o) => o.rules[0].name
            },
            {
                name: 'sshProfileRuleSet.0.remark',
                inputValue: [undefined, 'rule1 remark', undefined],
                expectedValue: [undefined, 'rule1 remark', undefined]
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileIdUsers',
                inputValue: [['Test'], ['Good Boy', 'Test'], ['Test']],
                expectedValue: [['Test'], ['Good Boy', 'Test'], ['Test']]
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileIdGroups',
                inputValue: [undefined, ['Group Test', 'TestG'], undefined],
                expectedValue: [undefined, ['Group Test', 'TestG'], undefined]
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions',
                inputValue: [{}],
                skipAssert: true
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.name',
                inputValue: [undefined, 'rulesAction', undefined],
                expectedValue: [undefined, 'rulesAction', undefined],
                extractFunction: (o) => {
                    if (o.rules && o.rules[0] && o.rules[0].actions[0]) {
                        return o.rules[0].actions[0].name;
                    }
                    return undefined;
                }
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.agentAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].agentAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.localForwardAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].localForwardAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.otherAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].otherAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.remoteForwardAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].remoteForwardAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.rexecAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].rexecAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.scpUpAction',
                inputValue: [
                    undefined,
                    {
                        control: 'disallow',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'disallow', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].scpUpAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.scpDownAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].scpDownAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.sftpUpAction',
                inputValue: [
                    undefined,
                    {
                        control: 'disallow',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'disallow', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].sftpUpAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.sftpDownAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].sftpDownAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.shellAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].shellAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.subSystemAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].subSystemAction.control
            },
            {
                name: 'sshProfileRuleSet.0.sshProfileRuleActions.x11ForwardAction',
                inputValue: [
                    undefined,
                    {
                        control: 'terminate',
                        log: true
                    },
                    undefined
                ],
                expectedValue: ['unspecified', 'terminate', 'unspecified'],
                extractFunction: (o) => o.rules[0].actions[0].x11ForwardAction.control
            },
            {
                name: 'timeout',
                inputValue: [undefined, 23, undefined],
                expectedValue: [0, 23, 0]
            },
            {
                name: 'sshProfileAuthInfo',
                inputValue: [undefined, [], undefined],
                skipAssert: true
            },
            {
                name: 'sshProfileAuthInfo.0',
                inputValue: [undefined, { name: 'authInfo1' }, undefined],
                skipAssert: true
            },
            {
                name: 'sshProfileAuthInfo.0.proxyServerAuth',
                inputValue: [
                    undefined,
                    {
                        privateKey: {
                            ciphertext: 'VGhpcyBpcyBhIFNFUlZFUiBwcml2YXRlIGtleQ==',
                            ignoreChanges: true
                        },
                        publicKey: 'This is a SERVER public key'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'This is a SERVER public key',
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.authInfo[0]) {
                        return o.authInfo[0].proxyServerAuth.publicKey;
                    }
                    return undefined;
                }
            },
            {
                name: 'sshProfileAuthInfo.0.proxyClientAuth',
                inputValue: [
                    undefined,
                    {
                        privateKey: {
                            ciphertext: 'VGhpcyBpcyBhIENMSUVOVCBwcml2YXRlIGtleQ==',
                            ignoreChanges: true
                        },
                        publicKey: 'This is a CLIENT public key'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'This is a CLIENT public key',
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.authInfo[0]) {
                        return o.authInfo[0].proxyClientAuth.publicKey;
                    }
                    return undefined;
                }
            },
            {
                name: 'sshProfileAuthInfo.0.realServerAuth',
                inputValue: [
                    undefined,
                    {
                        publicKey: 'This is a REAL SERVER public key'
                    },
                    undefined
                ],
                expectedValue: [
                    undefined,
                    'This is a REAL SERVER public key',
                    undefined
                ],
                extractFunction: (o) => {
                    if (o.authInfo[0]) {
                        return o.authInfo[0].realServerAuth.publicKey;
                    }
                    return undefined;
                }
            }
        ];

        return assertSshProfileClass(properties);
    });
});

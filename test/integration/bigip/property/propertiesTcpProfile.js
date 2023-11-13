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

const {
    assertClass,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const util = require('../../../../src/lib/util/util');

describe('TCP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertTcpProfileClass(properties) {
        return assertClass('TCP_Profile', properties);
    }

    it('All properties', () => {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'abc',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'ackOnPush',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'autoProxyBufferSize',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'autoReceiveWindowSize',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'autoSendBufferSize',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'closeWaitTimeout',
                inputValue: [undefined, 1200, undefined],
                expectedValue: [5, 1200, 5]
            },
            {
                name: 'congestionControl',
                inputValue: [undefined, 'cdg', undefined],
                expectedValue: ['woodside', 'cdg', 'woodside']
            },
            {
                name: 'congestionMetricsCache',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'congestionMetricsCacheTimeout',
                inputValue: [undefined, 100, undefined],
                expectedValue: [0, 100, 0]
            },
            {
                name: 'deferredAccept',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'delayedAcks',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'delayWindowControl',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'dsack',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'earlyRetransmit',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'ecn',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'enhancedLossRecovery',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'fastOpen',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'fastOpenCookieExpiration',
                inputValue: [undefined, 20000, undefined],
                expectedValue: [21600, 20000, 21600]
            },
            {
                name: 'finWaitTimeout',
                inputValue: [undefined, 15, undefined],
                expectedValue: [5, 15, 5]
            },
            {
                name: 'finWait2Timeout',
                inputValue: [undefined, 900, undefined],
                expectedValue: [300, 900, 300],
                extractFunction: (o) => o.finWait_2Timeout
            },
            {
                name: 'idleTimeout',
                inputValue: [undefined, 8000, undefined],
                expectedValue: [300, 8000, 300]
            },
            {
                name: 'initCwnd',
                inputValue: [undefined, 12, undefined],
                expectedValue: [16, 12, 16]
            },
            {
                name: 'initRwnd',
                inputValue: [undefined, 8, undefined],
                expectedValue: [16, 8, 16]
            },
            {
                name: 'ipDfMode',
                inputValue: [undefined, 'preserve', undefined],
                expectedValue: ['pmtu', 'preserve', 'pmtu']
            },
            {
                name: 'ipTosToClient',
                inputValue: [undefined, 240, undefined],
                expectedValue: [0, 240, 0]
            },
            {
                name: 'keepAliveInterval',
                inputValue: [undefined, 4800, undefined],
                expectedValue: [1800, 4800, 1800]
            },
            {
                name: 'limitedTransmit',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'linkQosToClient',
                inputValue: [undefined, 2, undefined],
                expectedValue: [0, 2, 0]
            },
            {
                name: 'maxRetrans',
                inputValue: [undefined, 9, undefined],
                expectedValue: [8, 9, 8]
            },
            {
                name: 'maxSegmentSize',
                inputValue: [undefined, 536, undefined],
                expectedValue: [0, 536, 0]
            },
            {
                name: 'md5Signature',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'md5SignaturePassphrase',
                inputValue: [
                    undefined,
                    {
                        ciphertext: 'ZjU=',
                        protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0=',
                        ignoreChanges: true
                    },
                    undefined
                ],
                expectedValue: [true],
                extractFunction: () => true
            },
            {
                name: 'minimumRto',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [1000, 4000, 1000]
            },
            {
                name: 'mptcp',
                inputValue: [undefined, 'enable', undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'mptcpCsum',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'mptcpCsumVerify',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'mptcpFallback',
                inputValue: [undefined, 'accept', undefined],
                expectedValue: ['reset', 'accept', 'reset']
            },
            {
                name: 'mptcpFastJoin',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'mptcpIdleTimeout',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [300, 4000, 300]
            },
            {
                name: 'mptcpJoinMax',
                inputValue: [undefined, 8, undefined],
                expectedValue: [5, 8, 5]
            },
            {
                name: 'mptcpMakeAfterBreak',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'mptcpNoJoinDssAck',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'mptcpRtoMax',
                inputValue: [undefined, 7, undefined],
                expectedValue: [5, 7, 5]
            },
            {
                name: 'mptcpRetransmitMin',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [1000, 4000, 1000]
            },
            {
                name: 'mptcpSubflowMax',
                inputValue: [undefined, 9, undefined],
                expectedValue: [6, 9, 6]
            },
            {
                name: 'mptcpTimeout',
                inputValue: [undefined, 1300, undefined],
                expectedValue: [3600, 1300, 3600]
            },
            {
                name: 'nagle',
                inputValue: [undefined, 'enable', undefined],
                expectedValue: ['auto', 'enabled', 'auto']
            },
            {
                name: 'pktLossIgnoreBurst',
                inputValue: [undefined, 12, undefined],
                expectedValue: [0, 12, 0]
            },
            {
                name: 'pktLossIgnoreRate',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [0, 4000, 0]
            },
            {
                name: 'proxyBufferHigh',
                inputValue: [undefined, 3000, undefined],
                expectedValue: [262144, 3000, 262144]
            },
            {
                name: 'proxyBufferLow',
                inputValue: [undefined, 2000, undefined],
                expectedValue: [196608, 2000, 196608]
            },
            {
                name: 'proxyMSS',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'proxyOptions',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'pushFlag',
                inputValue: [undefined, 'one', undefined],
                expectedValue: ['auto', 'one', 'auto']
            },
            {
                name: 'ratePace',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'ratePaceMaxRate',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [0, 4000, 0]
            },
            {
                name: 'receiveWindowSize',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [131072, 4000, 131072]
            },
            {
                name: 'resetOnTimeout',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'retransmitThreshold',
                inputValue: [undefined, 6, undefined],
                expectedValue: [3, 6, 3]
            },
            {
                name: 'selectiveAcks',
                inputValue: [undefined, false, undefined, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled', 'enabled']
            },
            {
                name: 'selectiveNack',
                inputValue: [undefined, undefined, true, undefined],
                expectedValue: ['disabled', 'disabled', 'enabled', 'disabled']
            },
            {
                name: 'sendBufferSize',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [262144, 4000, 262144]
            },
            {
                name: 'slowStart',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'synCookieEnable',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'synCookieAllowlist',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'synMaxRetrans',
                inputValue: [undefined, 5, undefined],
                expectedValue: [3, 5, 3]
            },
            {
                name: 'synRtoBase',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [3000, 4000, 3000]
            },
            {
                name: 'tailLossProbe',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'tcpOptions',
                inputValue: [
                    [],
                    undefined,
                    [
                        {
                            option: 58,
                            when: 'first'
                        },
                        {
                            option: 200,
                            when: 'last'
                        }
                    ],
                    undefined
                ],
                expectedValue: ['none', 'none', '{58 first} {200 last}', 'none'],
                extractFunction: (o) => o.tcpOptions || 'none'
            },
            {
                name: 'timestamps',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'timeWaitRecycle',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'timeWaitTimeout',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [2000, 4000, 2000]
            },
            {
                name: 'ttlMode',
                inputValue: [undefined, 'preserve', undefined],
                expectedValue: ['proxy', 'preserve', 'proxy']
            },
            {
                name: 'ttlIPv4',
                inputValue: [undefined, 254, undefined],
                expectedValue: [255, 254, 255]
            },
            {
                name: 'ttlIPv6',
                inputValue: [undefined, 128, undefined],
                expectedValue: [64, 128, 64]
            },
            {
                name: 'verifiedAccept',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'zeroWindowTimeout',
                inputValue: [undefined, 4000, undefined],
                expectedValue: [20000, 4000, 20000]
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('congestionControl', function () {
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        const properties = [
            {
                name: 'congestionControl',
                inputValue: [undefined, 'cdg', undefined],
                expectedValue: ['woodside', 'cdg', 'woodside']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('congestionControl for BBR, only available in 14.1', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        const properties = [
            {
                name: 'congestionControl',
                inputValue: [undefined, 'bbr', undefined],
                expectedValue: ['woodside', 'bbr', 'woodside']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('ipDfMode', function () {
        const properties = [
            {
                name: 'ipDfMode',
                inputValue: ['clear', 'pmtu', 'preserve', 'set'],
                expectedValue: ['clear', 'pmtu', 'preserve', 'set']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('mptcp', () => {
        const properties = [
            {
                name: 'mptcp',
                inputValue: ['disable', 'enable', 'passthrough'],
                expectedValue: ['disabled', 'enabled', 'passthrough']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('mptcpFallback', () => {
        const properties = [
            {
                name: 'mptcpFallback',
                inputValue: ['accept', 'active-accept', 'reset', 'retransmit'],
                expectedValue: ['accept', 'active-accept', 'reset', 'retransmit']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('nagle', () => {
        const properties = [
            {
                name: 'nagle',
                inputValue: ['disable', 'enable', 'auto'],
                expectedValue: ['disabled', 'enabled', 'auto']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('pushFlag', function () {
        const properties = [
            {
                name: 'pushFlag',
                inputValue: ['auto', 'default', 'none', 'one'],
                expectedValue: ['auto', 'default', 'none', 'one']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('ttlMode', function () {
        const properties = [
            {
                name: 'ttlMode',
                inputValue: ['decrement', 'preserve', 'proxy', 'set'],
                expectedValue: ['decrement', 'preserve', 'proxy', 'set']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('booleansGeneric', () => {
        const properties = [
            {
                name: 'abc',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'ackOnPush',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'autoProxyBufferSize',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'autoReceiveWindowSize',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'autoSendBufferSize',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'congestionMetricsCache',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'deferredAccept',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'delayedAcks',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'delayWindowControl',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'dsack',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'earlyRetransmit',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'ecn',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'enhancedLossRecovery',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'fastOpen',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'limitedTransmit',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'md5Signature',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'mptcpCsumVerify',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'mptcpFastJoin',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'mptcpMakeAfterBreak',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'mptcpNoJoinDssAck',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'proxyMSS',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'proxyOptions',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'ratePace',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'resetOnTimeout',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'selectiveAcks',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'selectiveNack',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'slowStart',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'synCookieEnable',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'synCookieAllowlist',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'tailLossProbe',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'timestamps',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            },
            {
                name: 'timeWaitRecycle',
                inputValue: [false, true],
                expectedValue: ['disabled', 'enabled']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('booleansVerifiedAcceptAndFastOpen', () => {
        const properties = [
            {
                name: 'verifiedAccept',
                inputValue: [false, false, true],
                expectedValue: ['disabled', 'disabled', 'enabled']
            },
            {
                name: 'fastOpen',
                inputValue: [false, true, false],
                expectedValue: ['disabled', 'enabled', 'disabled']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('intMinMax', () => {
        const properties = [
            {
                name: 'closeWaitTimeout',
                inputValue: [-1, 3600],
                expectedValue: [4294967295, 3600]
            },
            {
                name: 'congestionMetricsCacheTimeout',
                inputValue: [0, 1000],
                expectedValue: [0, 1000]
            },
            {
                name: 'fastOpenCookieExpiration',
                inputValue: [1, 1000000],
                expectedValue: [1, 1000000]
            },
            {
                name: 'finWaitTimeout',
                inputValue: [-1, 3600],
                expectedValue: [4294967295, 3600]
            },
            {
                name: 'finWait2Timeout',
                inputValue: [-1, 3600],
                expectedValue: [4294967295, 3600],
                extractFunction: (o) => o.finWait_2Timeout
            },
            {
                name: 'idleTimeout',
                inputValue: [1, 86400],
                expectedValue: [1, 86400]
            },
            {
                // schema max is 64, but it is 16 in this decl
                // don't know if min varies depending upon calculation or bigip version
                name: 'initCwnd',
                inputValue: [0, 16],
                expectedValue: [0, 16]
            },
            {
                // schema max is 64, but it is 16 in this decl
                // don't know if min varies depending upon calculation or bigip version
                name: 'initRwnd',
                inputValue: [0, 16],
                expectedValue: [0, 16]
            },
            {
                name: 'ipTosToClient',
                inputValue: [0, 252],
                expectedValue: [0, 252]
            },
            {
                name: 'keepAliveInterval',
                inputValue: [1, 86400],
                expectedValue: [1, 86400]
            },
            {
                name: 'linkQosToClient',
                inputValue: [0, 7],
                expectedValue: [0, 7]
            },
            {
                name: 'maxRetrans',
                inputValue: [0, 12],
                expectedValue: [0, 12]
            },
            {
                // schema says min is 28 but in this case it is 536
                // schema says max is 8960 but in this case it is 1460
                // min/max seems to float based upon MTU
                name: 'maxSegmentSize',
                inputValue: [536, 1460],
                expectedValue: [536, 1460]
            },
            {
                name: 'minimumRto',
                inputValue: [1, 5000],
                expectedValue: [1, 5000]
            },
            {
                name: 'mptcpIdleTimeout',
                inputValue: [1, 86400],
                expectedValue: [1, 86400]
            },
            {
                name: 'mptcpJoinMax',
                inputValue: [1, 20],
                expectedValue: [1, 20]
            },
            {
                // schema max is 20 but 10 is min for this decl
                // don't know if min varies depending upon calculation or bigip version
                name: 'mptcpRtoMax',
                inputValue: [1, 10],
                expectedValue: [1, 10]
            },
            {
                // schema min is 1 but 200 is min for this decl
                // don't know if min varies depending upon calculation or bigip version
                name: 'mptcpRetransmitMin',
                inputValue: [200, 5000],
                expectedValue: [200, 5000]
            },
            {
                name: 'mptcpSubflowMax',
                inputValue: [1, 20],
                expectedValue: [1, 20]
            },
            {
                name: 'mptcpTimeout',
                inputValue: [60, 3600],
                expectedValue: [60, 3600]
            },
            {
                name: 'pktLossIgnoreBurst',
                inputValue: [0, 32],
                expectedValue: [0, 32]
            },
            {
                name: 'pktLossIgnoreRate',
                inputValue: [0, 1000000],
                expectedValue: [0, 1000000]
            },
            {
                name: 'proxyBufferHigh',
                inputValue: [64, 33554432],
                expectedValue: [64, 33554432]
            },
            {
                name: 'proxyBufferLow',
                inputValue: [64, 33554432],
                expectedValue: [64, 33554432]
            },
            {
                name: 'ratePaceMaxRate',
                inputValue: [0, 4294967295],
                expectedValue: [0, 4294967295]
            },
            {
                // schema min is 64 but actually seems to be 536
                // don't know if min varies depending upon calculation or bigip version
                name: 'receiveWindowSize',
                inputValue: [536, 33554432],
                expectedValue: [536, 33554432]
            },
            {
                // schema min is 0 but actually seems to be 3
                // don't know if min varies depending upon calculation or bigip version
                name: 'retransmitThreshold',
                inputValue: [3, 12],
                expectedValue: [3, 12]
            },
            {
                // schema min is 64 but actually seems to be 536
                // don't know if min varies depending upon calculation or bigip version
                name: 'sendBufferSize',
                inputValue: [536, 33554432],
                expectedValue: [536, 33554432]
            },
            {
                name: 'synMaxRetrans',
                inputValue: [0, 12],
                expectedValue: [0, 12]
            },
            {
                name: 'synRtoBase',
                inputValue: [0, 5000],
                expectedValue: [0, 5000]
            },
            {
                name: 'timeWaitTimeout',
                inputValue: [-1, 600000],
                expectedValue: ['indefinite', 600000]
            },
            {
                name: 'ttlIPv4',
                inputValue: [1, 255],
                expectedValue: [1, 255]
            },
            {
                name: 'ttlIPv6',
                inputValue: [1, 255],
                expectedValue: [1, 255]
            },
            {
                name: 'zeroWindowTimeout',
                inputValue: [-1, 86400000],
                expectedValue: [4294967295, 86400000]
            }
        ];

        return assertTcpProfileClass(properties);
    });

    // Any integer that can accept 0 but has not been previously tested for it.
    // Many map to keywords e.g. 'immediate' in tmsh or otherwise have some special meaning
    it('intZero', () => {
        const properties = [
            {
                name: 'closeWaitTimeout',
                inputValue: [0],
                expectedValue: [0]
            },
            {
                name: 'finWaitTimeout',
                inputValue: [0],
                expectedValue: [0]
            },
            {
                name: 'finWait2Timeout',
                inputValue: [0],
                expectedValue: [0],
                extractFunction: (o) => o.finWait_2Timeout
            },
            {
                name: 'timeWaitTimeout',
                inputValue: [0],
                expectedValue: [0]
            },
            {
                name: 'zeroWindowTimeout',
                inputValue: [0],
                expectedValue: [0]
            }
        ];

        return assertTcpProfileClass(properties);
    });

    // Any integer that can accept -1 but has not been previously tested for it.
    // Many map to keywords e.g. 'indefinite' in tmsh or otherwise have some special meaning
    it('intNegativeOne', () => {
        const properties = [
            {
                name: 'idleTimeout',
                inputValue: [-1],
                expectedValue: [4294967295]
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('ipTosToClient', () => {
        const properties = [
            {
                name: 'ipTosToClient',
                inputValue: ['pass-through', 'mimic'],
                expectedValue: ['pass-through', 'mimic']
            }
        ];

        return assertTcpProfileClass(properties);
    });

    it('linkQosToClient', () => {
        const properties = [
            {
                name: 'linkQosToClient',
                inputValue: ['pass-through'],
                expectedValue: ['pass-through']
            }
        ];

        return assertTcpProfileClass(properties);
    });
});

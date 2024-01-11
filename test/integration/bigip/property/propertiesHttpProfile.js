/**
 * Copyright 2024 F5, Inc.
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
const requestUtil = require('../../../common/requestUtilPromise');

describe('HTTP_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertHttpProfileClass(properties, options) {
        return assertClass('HTTP_Profile', properties, options);
    }

    it('All properties', () => {
        let hstsPreloadExpected = [undefined];
        hstsPreloadExpected = ['disabled', 'enabled', 'disabled'];

        const secret = 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0';
        let secretExpected = '$M$';
        if (!util.versionLessThan(getBigIpVersion(), '14.1')) {
            secretExpected = true;
        }

        let selectiveChunking = 'selective';
        let preserveChunking = 'preserve';
        if (!util.versionLessThan(getBigIpVersion(), '15.0')) {
            selectiveChunking = 'sustain';
            preserveChunking = selectiveChunking;
        }

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'An HTTP Profile', undefined],
                expectedValue: ['none', 'An HTTP Profile', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'proxyType',
                inputValue: [undefined, 'transparent', undefined],
                expectedValue: ['reverse', 'transparent', 'reverse']
            },
            {
                name: 'encryptCookies',
                inputValue: [
                    [],
                    ['peanutButter'],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['peanutButter'],
                    []
                ],
                extractFunction: (o) => o.encryptCookies || []
            },
            {
                name: 'cookiePassphrase',
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
                extractFunction: createExtractSecret('encryptCookieSecret', secret)
            },
            {
                name: 'fallbackRedirect',
                inputValue: ['http://example.com', 'http://example.com/fallback.html', undefined],
                expectedValue: ['http://example.com', 'http://example.com/fallback.html', 'none'],
                extractFunction: (o) => o.fallbackHost || 'none'
            },
            {
                name: 'fallbackStatusCodes',
                inputValue: [[], [300, 500], undefined],
                expectedValue: [[], ['300', '500'], []],
                extractFunction: (o) => o.fallbackStatusCodes || []
            },
            {
                name: 'requestChunking',
                inputValue: [undefined, 'selective', undefined],
                expectedValue: [preserveChunking, selectiveChunking, preserveChunking]
            },
            {
                name: 'responseChunking',
                inputValue: [undefined, 'preserve', undefined],
                expectedValue: [selectiveChunking, preserveChunking, selectiveChunking]
            },
            {
                name: 'rewriteRedirects',
                inputValue: [undefined, 'all', undefined],
                expectedValue: ['none', 'all', 'none']
            },
            {
                name: 'multiplexTransformations',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'insertHeader',
                inputValue: [
                    undefined,
                    {
                        name: 'X-Forwarded-IP',
                        value: '[expr { [IP::client_addr] }]:[?"]'
                    },
                    undefined
                ],
                expectedValue: [
                    'none',
                    'X-Forwarded-IP: [expr { [IP::client_addr] }]:[\\?\\"]',
                    'none'
                ],
                extractFunction: (o) => o.headerInsert || 'none'
            },
            {
                name: 'whiteOutHeader',
                inputValue: [undefined, 'WhiteOut', undefined],
                expectedValue: ['none', 'WhiteOut', 'none'],
                extractFunction: (o) => o.headerErase || 'none'
            },
            {
                name: 'allowedResponseHeaders',
                inputValue: [
                    [],
                    ['ThisIsAllowed'],
                    undefined
                ],
                expectedValue: [[], ['ThisIsAllowed'], []],
                extractFunction: (o) => o.responseHeadersPermitted || []
            },
            {
                name: 'xForwardedFor',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled']
            },
            {
                name: 'trustXFF',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled']
            },
            {
                name: 'otherXFF',
                inputValue: [
                    [],
                    ['Alternate'],
                    undefined
                ],
                expectedValue: [
                    [],
                    ['Alternate'],
                    []
                ],
                extractFunction: (o) => o.xffAlternativeNames || []
            },
            {
                name: 'hstsInsert',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.hsts.mode
            },
            {
                name: 'hstsPeriod',
                inputValue: [undefined, 1000000, undefined],
                expectedValue: [7862400, 1000000, 7862400],
                extractFunction: (o) => o.hsts.maximumAge
            },
            {
                name: 'hstsIncludeSubdomains',
                inputValue: [undefined, false, undefined],
                expectedValue: ['enabled', 'disabled', 'enabled'],
                extractFunction: (o) => o.hsts.includeSubdomains
            },
            {
                name: 'hstsPreload',
                inputValue: [undefined, true, undefined],
                expectedValue: hstsPreloadExpected,
                extractFunction: (o) => o.hsts.preload
            },
            {
                name: 'viaRequest',
                inputValue: [undefined, 'preserve', undefined],
                expectedValue: ['remove', 'preserve', 'remove']
            },
            {
                name: 'viaResponse',
                inputValue: [undefined, 'append', undefined],
                expectedValue: ['remove', 'append', 'remove']
            },
            {
                name: 'viaHost',
                inputValue: [undefined, 'example.com', undefined],
                expectedValue: ['none', 'example.com', 'none'],
                extractFunction: (o) => o.viaHostName || 'none'
            },
            {
                name: 'serverHeaderValue',
                inputValue: [undefined, 'HEADER', undefined],
                expectedValue: ['BigIP', 'HEADER', 'BigIP']
            },
            {
                name: 'knownMethods',
                inputValue: [
                    undefined,
                    ['CONNECT', 'DELETE'],
                    undefined
                ],
                expectedValue: [
                    [
                        'CONNECT', 'DELETE', 'GET', 'HEAD',
                        'LOCK', 'OPTIONS', 'POST', 'PROPFIND',
                        'PUT', 'TRACE', 'UNLOCK'
                    ],
                    [
                        'CONNECT', 'DELETE'
                    ],
                    [
                        'CONNECT', 'DELETE', 'GET', 'HEAD',
                        'LOCK', 'OPTIONS', 'POST', 'PROPFIND',
                        'PUT', 'TRACE', 'UNLOCK'
                    ]
                ],
                extractFunction: (o) => o.enforcement.knownMethods
            },
            {
                name: 'unknownMethodAction',
                inputValue: [undefined, 'reject', undefined],
                expectedValue: ['allow', 'reject', 'allow'],
                extractFunction: (o) => o.enforcement.unknownMethod
            },
            {
                name: 'maxRequests',
                inputValue: [undefined, 123456, undefined],
                expectedValue: [0, 123456, 0],
                extractFunction: (o) => o.enforcement.maxRequests
            },
            {
                name: 'pipelineAction',
                inputValue: [undefined, 'reject', undefined],
                expectedValue: ['allow', 'reject', 'allow'],
                extractFunction: (o) => o.enforcement.pipeline
            },
            {
                name: 'profileWebSocket',
                inputValue: [undefined, { use: 'webSocketProfile' }, undefined],
                referenceObjects: {
                    webSocketProfile: {
                        class: 'WebSocket_Profile'
                    }
                },
                skipAssert: true // not used by the BIGIP until the HTTP profile is referenced by a Service
            },
            {
                name: 'maxHeaderCount',
                inputValue: [undefined, 400, undefined],
                expectedValue: [64, 400, 64],
                extractFunction: (o) => o.enforcement.maxHeaderCount
            },
            {
                name: 'maxHeaderSize',
                inputValue: [undefined, 23000, undefined],
                expectedValue: [32768, 23000, 32768],
                extractFunction: (o) => o.enforcement.maxHeaderSize
            },
            {
                name: 'truncatedRedirects',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.enforcement.truncatedRedirects
            },
            {
                name: 'proxyConnectEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: [undefined, 'f5_appsvcs_test.item-foo.567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234_proxyConnect', undefined],
                extractFunction: () => {
                    const RETRY_OPTIONS = {
                        retryCount: 5,
                        retryInterval: 1000,
                        retryIf: (error, response) => response && response.statusCode === 503
                    };
                    const requestOptions = {
                        path: '/mgmt/tm/ltm/profile/http-proxy-connect',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil
                        .get(Object.assign(requestOptions, RETRY_OPTIONS))
                        .then((response) => {
                            const proxyConnect = response.body.items.find((i) => i.name === 'f5_appsvcs_test.item-foo.567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234_proxyConnect');
                            return (proxyConnect) ? proxyConnect.name : proxyConnect;
                        });
                }
            }
        ];
        if (!util.versionLessThan(getBigIpVersion(), '16.1')) {
            properties.push(
                {
                    name: 'allowBlankSpaceAfterHeaderName',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.enforcement.allowWsHeaderName
                }
            );
        }
        if (!util.versionLessThan(getBigIpVersion(), '15.0')) {
            properties.push(
                {
                    name: 'enforceRFCCompliance',
                    inputValue: [undefined, true, undefined],
                    expectedValue: ['disabled', 'enabled', 'disabled'],
                    extractFunction: (o) => o.enforcement.rfcCompliance
                }
            );
        }
        return assertHttpProfileClass(properties);
    });

    it('Request and Response Chunking Mappings', () => {
        // Understanding the mapping --
        //   on 15.1 preserve and selective from 14.1 do not exist and are mapped to the 15.1 default value of sustain
        //   on 14.1 requestChunking does not support the 15.1 default value of sustain so it gets mapped to the 14.1
        //   default value of preserve
        //   on 14.1 responseChunking does not support the 15.1 default value of sustain so it gets mapped to the 14.1
        //   default value of selective

        const properties = [];
        if (util.versionLessThan(getBigIpVersion(), '15.0')) {
            properties.push(
                {
                    name: 'requestChunking',
                    inputValue: [undefined, 'selective', 'sustain', 'rechunk', undefined],
                    expectedValue: ['preserve', 'selective', 'preserve', 'rechunk', 'preserve']
                },
                {
                    name: 'responseChunking',
                    inputValue: [undefined, 'preserve', 'sustain', 'rechunk', undefined],
                    expectedValue: ['selective', 'preserve', 'selective', 'rechunk', 'selective']
                }
            );
        } else {
            properties.push(
                {
                    name: 'requestChunking',
                    inputValue: [undefined, 'rechunk', 'preserve', 'rechunk', undefined],
                    expectedValue: ['sustain', 'rechunk', 'sustain', 'rechunk', 'sustain']
                },
                {
                    name: 'responseChunking',
                    inputValue: [undefined, 'rechunk', 'selective', 'unchunk', undefined],
                    expectedValue: ['sustain', 'rechunk', 'sustain', 'unchunk', 'sustain']
                }
            );
        }

        return assertHttpProfileClass(properties);
    });

    it('Deprecated WebSocket Profile', () => {
        const properties = [
            {
                name: 'webSocketsEnabled',
                inputValue: [undefined, true, undefined],
                skipAssert: true
            },
            {
                name: 'webSocketMasking',
                inputValue: [undefined, 'preserve', undefined],
                expectedValue: [undefined, 'f5_appsvcs_preserve', undefined],
                extractFunction: () => {
                    const RETRY_OPTIONS = {
                        retryCount: 5,
                        retryInterval: 1000,
                        retryIf: (error, response) => response && response.statusCode === 503
                    };
                    const requestOptions = {
                        path: '/mgmt/tm/ltm/profile/websocket',
                        host: process.env.TARGET_HOST || process.env.AS3_HOST
                    };
                    return requestUtil
                        .get(Object.assign(requestOptions, RETRY_OPTIONS))
                        .then((response) => {
                            const mask = response.body.items.find((i) => i.name === 'f5_appsvcs_preserve');
                            return (mask) ? mask.name : mask;
                        });
                }
            }
        ];
        return assertHttpProfileClass(properties);
    });

    it('Transparent Proxy', () => {
        const properties = [
            {
                name: 'proxyType',
                inputValue: ['transparent', 'transparent', 'transparent'],
                expectedValue: ['transparent', 'transparent', 'transparent']
            },
            {
                name: 'excessClientHeaders',
                inputValue: [undefined, 'reject', undefined],
                expectedValue: ['pass-through', 'reject', 'pass-through'],
                extractFunction: (o) => o.enforcement.excessClientHeaders
            },
            {
                name: 'excessServerHeaders',
                inputValue: [undefined, 'reject', undefined],
                expectedValue: ['pass-through', 'reject', 'pass-through'],
                extractFunction: (o) => o.enforcement.excessServerHeaders
            },
            {
                name: 'oversizeClientHeaders',
                inputValue: [undefined, 'reject', undefined],
                expectedValue: ['pass-through', 'reject', 'pass-through'],
                extractFunction: (o) => o.enforcement.oversizeClientHeaders
            },
            {
                name: 'oversizeServerHeaders',
                inputValue: [undefined, 'reject', undefined],
                expectedValue: ['pass-through', 'reject', 'pass-through'],
                extractFunction: (o) => o.enforcement.oversizeServerHeaders
            }
        ];
        return assertHttpProfileClass(properties);
    });

    it('Explicit Proxy with integer routeDomain', () => {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: 'testDnsResolver1',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: 'testDnsResolver2',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: '2500' }
                }
            ]
        };

        const properties = [
            {
                name: 'proxyType',
                inputValue: ['explicit'],
                expectedValue: ['explicit']
            },
            {
                name: 'resolver',
                inputValue: [
                    { bigip: '/Common/testDnsResolver1' },
                    { bigip: '/Common/testDnsResolver2' },
                    { bigip: '/Common/testDnsResolver1' }
                ],
                expectedValue: ['/Common/testDnsResolver1', '/Common/testDnsResolver2', '/Common/testDnsResolver1'],
                extractFunction: (o) => o.explicitProxy.dnsResolver
            },
            {
                name: 'doNotProxyHosts',
                inputValue: [undefined, ['example.com'], undefined],
                expectedValue: [['none'], ['example.com'], ['none']],
                extractFunction: (o) => o.explicitProxy.hostNames
            },
            {
                name: 'tunnelName',
                inputValue: [undefined, 'socks-tunnel', undefined],
                expectedValue: ['/Common/http-tunnel', '/Common/socks-tunnel', '/Common/http-tunnel'],
                extractFunction: (o) => o.explicitProxy.tunnelName
            },
            {
                name: 'defaultConnectAction',
                inputValue: [undefined, 'allow', undefined],
                expectedValue: ['deny', 'allow', 'deny'],
                extractFunction: (o) => o.explicitProxy.defaultConnectHandling
            },
            {
                name: 'routeDomain',
                inputValue: [undefined, 2500, undefined],
                expectedValue: ['/Common/0', '/Common/2500', '/Common/0'],
                extractFunction: (o) => o.explicitProxy.routeDomain
            },
            {
                name: 'connectErrorMessage',
                inputValue: [undefined, '<html><head><title>CONNECT ERROR</title></head></html>', undefined],
                expectedValue: [
                    '<html><head><title>Connection Error</title></head><body><h2>Unable to connect to host in proxy request</h2></body></html>',
                    '<html><head><title>CONNECT ERROR</title></head></html>',
                    '<html><head><title>Connection Error</title></head><body><h2>Unable to connect to host in proxy request</h2></body></html>'
                ],
                extractFunction: (o) => o.explicitProxy.connectErrorMessage
            },
            {
                name: 'dnsErrorMessage',
                inputValue: [undefined, '<html><head><title>DNS ERROR</title></head></html>', undefined],
                expectedValue: [
                    '<html><head><title>DNS Resolution Error</title></head><body><h2>Cannot resolve hostname in proxy request</h2></body></html>',
                    '<html><head><title>DNS ERROR</title></head></html>',
                    '<html><head><title>DNS Resolution Error</title></head><body><h2>Cannot resolve hostname in proxy request</h2></body></html>'
                ],
                extractFunction: (o) => o.explicitProxy.dnsErrorMessage
            },
            {
                name: 'badRequestMessage',
                inputValue: [undefined, '<html><head><title>BAD REQUEST MESSAGE</title></head></html>', undefined],
                expectedValue: [
                    '<html><head><title>Bad Request</title></head><body><h2>Invalid proxy request</h2></body></html>',
                    '<html><head><title>BAD REQUEST MESSAGE</title></head></html>',
                    '<html><head><title>Bad Request</title></head><body><h2>Invalid proxy request</h2></body></html>'
                ],
                extractFunction: (o) => o.explicitProxy.badRequestMessage
            },
            {
                name: 'badResponseMessage',
                inputValue: [undefined, '<html><head><title>BAD RESPONSE MESSAGE</title></head></html>', undefined],
                expectedValue: [
                    '<html><head><title>Bad Response</title></head><body><h2>Proxy request provoked invalid response</h2></body></html>',
                    '<html><head><title>BAD RESPONSE MESSAGE</title></head></html>',
                    '<html><head><title>Bad Response</title></head><body><h2>Proxy request provoked invalid response</h2></body></html>'
                ],
                extractFunction: (o) => o.explicitProxy.badResponseMessage
            },
            {
                name: 'ipv6',
                inputValue: [undefined, true, undefined],
                expectedValue: ['no', 'yes', 'no'],
                extractFunction: (o) => o.explicitProxy.ipv6
            }
        ];
        return assertHttpProfileClass(properties, options);
    });

    it('Explicit Proxy with string routeDomain', () => {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/net/dns-resolver',
                    data: {
                        name: 'testDnsResolver1',
                        partition: 'Common',
                        routeDomain: '/Common/0'
                    }
                },
                {
                    endpoint: '/mgmt/tm/net/route-domain',
                    data: { name: 'testRouteDomain', id: 1 }
                }
            ]
        };

        const properties = [
            {
                name: 'proxyType',
                inputValue: ['explicit'],
                expectedValue: ['explicit']
            },
            {
                name: 'resolver',
                inputValue: [
                    { bigip: '/Common/testDnsResolver1' }
                ],
                expectedValue: ['/Common/testDnsResolver1'],
                extractFunction: (o) => o.explicitProxy.dnsResolver
            },
            {
                name: 'routeDomain',
                inputValue: [undefined, 'testRouteDomain', undefined],
                expectedValue: ['/Common/0', '/Common/testRouteDomain', '/Common/0'],
                extractFunction: (o) => o.explicitProxy.routeDomain
            }
        ];
        return assertHttpProfileClass(properties, options);
    });
});

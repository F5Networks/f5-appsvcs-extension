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

const {
    assertClass,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const defaultRequest = {
    logRequestLoggingErrors: 'no',
    proxyCloseOnError: 'no',
    proxyRespondOnLoggingError: 'no',
    proxyResponse: 'none',
    requestLogErrorPool: 'none',
    requestLogErrorProtocol: 'mds-udp',
    requestLogErrorTemplate: 'none',
    requestLogPool: 'none',
    requestLogProtocol: 'mds-udp',
    requestLogTemplate: 'none',
    requestLogging: 'disabled'
};
const defaultResponse = {
    logResponseByDefault: 'yes',
    logResponseLoggingErrors: 'disabled',
    responseLogErrorPool: 'none',
    responseLogErrorProtocol: 'mds-udp',
    responseLogErrorTemplate: 'none',
    responseLogPool: 'none',
    responseLogProtocol: 'mds-udp',
    responseLogTemplate: 'none',
    responseLogging: 'disabled'
};

describe('Traffic_Log_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertTrafficeLogProfileClass(properties) {
        return assertClass('Traffic_Log_Profile', properties);
    }

    it('All properties', function () {
        /* eslint-disable no-template-curly-in-string, no-useless-escape */
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'A remark', undefined],
                expectedValue: ['none', 'A remark', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'parentProfile',
                inputValue: [undefined, { use: 'trafLog' }, undefined],
                expectedValue: ['request-log', 'trafLog', 'request-log'],
                referenceObjects: {
                    trafLog: {
                        class: 'Traffic_Log_Profile'
                    }
                },
                extractFunction: (o) => o.defaultsFrom.name
            },
            {
                name: 'requestSettings',
                inputValue: [
                    undefined,
                    {
                        requestErrorLoggingEnabled: true,
                        proxyCloseOnErrorEnabled: true,
                        proxyRespondOnLoggingErrorEnabled: true,
                        proxyResponse: 'Proxy Response',
                        requestErrorPool: {
                            use: 'thePool'
                        },
                        requestErrorProtocol: 'mds-tcp',
                        requestErrorTemplate: 'REQUEST ERROR lb_port=$SERVER_PORT host=${host} user_agent="${User-agent}"',
                        requestPool: {
                            use: 'thePool'
                        },
                        requestProtocol: 'mds-tcp',
                        requestTemplate: 'REQUEST lb_port=$SERVER_PORT host=${host} user_agent="${User-agent}"',
                        requestEnabled: true
                    },
                    undefined
                ],
                expectedValue: [
                    defaultRequest,
                    {
                        logRequestLoggingErrors: 'yes',
                        proxyCloseOnError: 'yes',
                        proxyRespondOnLoggingError: 'yes',
                        proxyResponse: 'Proxy Response',
                        requestLogErrorPool: '/TEST_Traffic_Log_Profile/Application/thePool',
                        requestLogErrorProtocol: 'mds-tcp',
                        requestLogErrorTemplate: 'REQUEST ERROR lb_port=$SERVER_PORT host=${host} user_agent=\\"${User-agent}\\"',
                        requestLogPool: '/TEST_Traffic_Log_Profile/Application/thePool',
                        requestLogProtocol: 'mds-tcp',
                        requestLogTemplate: 'REQUEST lb_port=$SERVER_PORT host=${host} user_agent=\\"${User-agent}\\"',
                        requestLogging: 'enabled'
                    },
                    defaultRequest
                ],
                referenceObjects: {
                    thePool: {
                        class: 'Pool'
                    }
                },
                extractFunction: (o) => {
                    const values = {
                        logRequestLoggingErrors: o.logRequestLoggingErrors,
                        proxyCloseOnError: o.proxyCloseOnError,
                        proxyRespondOnLoggingError: o.proxyRespondOnLoggingError,
                        requestLogErrorProtocol: o.requestLogErrorProtocol,
                        requestLogProtocol: o.requestLogProtocol,
                        requestLogging: o.requestLogging
                    };
                    values.proxyResponse = o.proxyResponse || 'none';
                    values.requestLogErrorPool = (o.requestLogErrorPool && o.requestLogErrorPool.fullPath) ? o.requestLogErrorPool.fullPath : 'none';
                    values.requestLogErrorTemplate = o.requestLogErrorTemplate || 'none';
                    values.requestLogPool = (o.requestLogPool && o.requestLogPool.fullPath) ? o.requestLogPool.fullPath : 'none';
                    values.requestLogTemplate = o.requestLogTemplate || 'none';
                    return values;
                }
            },
            {
                name: 'responseSettings',
                inputValue: [
                    undefined,
                    {
                        byDefaultEnabled: false,
                        responseErrorLoggingEnabled: true,
                        responseErrorPool: {
                            use: 'thePool'
                        },
                        responseErrorProtocol: 'mds-tcp',
                        responseErrorTemplate: 'RESPONSE ERROR lb_port=$SERVER_PORT host=${host} user_agent="${User-agent}"',
                        responsePool: {
                            use: 'thePool'
                        },
                        responseProtocol: 'mds-tcp',
                        responseTemplate: 'RESPONSE lb_port=$SERVER_PORT host=${host} user_agent="${User-agent}"',
                        responseEnabled: true
                    },
                    undefined
                ],
                expectedValue: [
                    defaultResponse,
                    {
                        logResponseByDefault: 'no',
                        logResponseLoggingErrors: 'enabled',
                        responseLogErrorPool: '/TEST_Traffic_Log_Profile/Application/thePool',
                        responseLogErrorProtocol: 'mds-tcp',
                        responseLogErrorTemplate: 'RESPONSE ERROR lb_port=$SERVER_PORT host=${host} user_agent=\\"${User-agent}\\"',
                        responseLogPool: '/TEST_Traffic_Log_Profile/Application/thePool',
                        responseLogProtocol: 'mds-tcp',
                        responseLogTemplate: 'RESPONSE lb_port=$SERVER_PORT host=${host} user_agent=\\"${User-agent}\\"',
                        responseLogging: 'enabled'
                    },
                    defaultResponse
                ],
                extractFunction: (o) => {
                    const values = {
                        logResponseByDefault: o.logResponseByDefault,
                        logResponseLoggingErrors: o.logResponseLoggingErrors,
                        responseLogErrorProtocol: o.responseLogErrorProtocol,
                        responseLogProtocol: o.responseLogProtocol,
                        responseLogging: o.responseLogging
                    };
                    values.responseLogErrorPool = (o.responseLogErrorPool && o.responseLogErrorPool.fullPath) ? o.responseLogErrorPool.fullPath : 'none';
                    values.responseLogErrorTemplate = o.responseLogErrorTemplate || 'none';
                    values.responseLogPool = (o.responseLogPool && o.responseLogPool.fullPath) ? o.responseLogPool.fullPath : 'none';
                    values.responseLogTemplate = o.responseLogTemplate || 'none';
                    return values;
                }
            }
        ];
        return assertTrafficeLogProfileClass(properties);
        /* eslint-enable no-template-curly-in-string, no-useless-escape */
    });
});

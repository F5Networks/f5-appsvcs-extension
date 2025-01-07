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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('Class Persist', function () {
    this.timeout(GLOBAL_TIMEOUT);

    afterEach(() => deleteDeclaration());
    let declare;
    beforeEach(() => {
        declare = {
            class: 'AS3',
            action: 'deploy',
            persist: true,
            declaration: {
                class: 'ADC',
                schemaVersion: '3.53.0',
                id: 'fghijkl7890',
                label: 'Sample 1',
                remark: 'HTTP with custom persistence',
                Sample_http_01: {
                    class: 'Tenant',
                    A1: {
                        class: 'Application',
                        service: {
                            class: 'Service_HTTP',
                            virtualAddresses: [
                                '192.0.10.10'
                            ],
                            pool: 'web_pool',
                            persistenceMethods: [{
                                use: 'jsessionid'
                            }]
                        },
                        web_pool: {
                            class: 'Pool',
                            monitors: [
                                'http'
                            ],
                            members: [{
                                servicePort: 80,
                                serverAddresses: [
                                    '192.0.6.10',
                                    '192.0.6.11'
                                ]
                            }]
                        },
                        jsessionid: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'JSESSIONID',
                            ttl: 18
                        },
                        cookieDuration1Day: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'cookieDuration1Day',
                            ttl: 86400
                        },
                        cookieDuration1Day25Seconds: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'cookieDuration1Day25Seconds',
                            ttl: 86425
                        },
                        cookieDuration7Days: {
                            class: 'Persist',
                            persistenceMethod: 'cookie',
                            cookieMethod: 'hash',
                            cookieName: 'cookieDuration7Days',
                            ttl: 604800
                        }
                    }
                }
            }
        };
    });
    it('should handle TTL value properly', () => {
        const Path = '/mgmt/shared/appsvcs/declare/';
        return Promise.resolve()
            .then(() => postDeclaration(declare, { declarationIndex: 0 }, undefined, Path))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~jsessionid'))
            .then((response) => {
                assert.strictEqual(response.expiration, '18');
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration1Day'))
            .then((response) => {
                assert.strictEqual(response.expiration, '1:0:0:0');
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration1Day25Seconds'))
            .then((response) => {
                assert.strictEqual(response.expiration, '1:0:0:25');
            })
            .then(() => getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration7Days'))
            .then((response) => {
                assert.strictEqual(response.expiration, '7:0:0:0');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~Sample_http_01~A1~service'))
            .then((response) => {
                assert.strictEqual(response.persist[0].name, 'jsessionid');
            })
            .then(() => deleteDeclaration(undefined, { path: `${Path}?async=true`, sendDelete: true }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
            })
            .then(() => assert.isRejected(
                getPath('/mgmt/tm/ltm/persistence/cookie/~Sample_http_01~A1~cookieDuration1Day25Seconds'),
                /The requested Persistence Profile \(\/Sample_http_01\/A1\/cookieDuration1Day25Seconds\) was not found/,
                'Persistence cookie should have been deleted'
            ));
    });
});

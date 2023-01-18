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
    assertModuleProvisioned,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');
const util = require('../../../../src/lib/util/util');

describe('API_Protection_Response', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('All Properties', function () {
        if (util.versionLessThan(getBigIpVersion(), '14.1')) {
            this.skip();
        }

        assertModuleProvisioned.call(this, 'apm');

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: [undefined, 'description', undefined]
            },
            {
                name: 'body',
                inputValue: [undefined, 'OAuth status: %{perflow.oauth.scope.status_string}', undefined],
                expectedValue: [undefined, 'OAuth status: %{perflow.oauth.scope.status_string}', undefined]
            },
            {
                name: 'headers',
                inputValue: [
                    undefined,
                    [
                        {
                            headerName: '%{perflow.oauth.scope.auth_hdr_name}',
                            headerValue: '%{perflow.oauth.scope.auth_hdr_value}'
                        },
                        {
                            headerName: 'foo',
                            headerValue: 'bar'
                        }
                    ],
                    undefined
                ],
                expectedValue: [
                    [],
                    [
                        {
                            name: '0',
                            headerName: '%{perflow.oauth.scope.auth_hdr_name}',
                            headerValue: '%{perflow.oauth.scope.auth_hdr_value}'
                        },
                        {
                            name: '1',
                            headerName: 'foo',
                            headerValue: 'bar'
                        }
                    ],
                    []
                ],
                extractFunction: (o) => {
                    o.headers.forEach((h) => {
                        delete h.fullPath;
                        delete h.generation;
                        delete h.kind;
                        delete h.selfLink;
                    });
                    return o.headers;
                }
            },
            {
                name: 'statusCode',
                inputValue: [403, '%{perflow.oauth.scope.status_code}', 403],
                expectedValue: [403, '%{perflow.oauth.scope.status_code}', 403]
            },
            {
                name: 'statusString',
                inputValue: ['Forbidden', '%{perflow.oauth.scope.status_string}', 'Forbidden'],
                expectedValue: ['Forbidden', '%{perflow.oauth.scope.status_string}', 'Forbidden']
            }
        ];

        return assertClass('API_Protection_Response', properties);
    });
});

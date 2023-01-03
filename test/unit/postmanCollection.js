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

const assert = require('assert');

const TestCollection = require('../common/testCollection');

describe('TestCollection', () => {
    const name = 'myCollection';
    const collection = new TestCollection(name);

    it('should have info', () => {
        assert(collection.info, 'info exists');
        assert.equal(collection.info.name, name, 'info has name');
        assert(collection.info.schema, 'info has schema');
    });

    it('should have item', () => {
        assert(Array.isArray(collection.item), 'item is an array');
    });

    it('should allow basic auth', () => {
        const auth = collection.auth;
        assert(auth, 'auth exists');
        assert.equal(auth.type, 'basic', 'auth has correct type');
        const expectedBasic = [
            {
                key: 'password',
                value: '{{password}}',
                type: 'string'
            },
            {
                key: 'username',
                value: '{{username}}',
                type: 'string'
            }
        ];
        assert.deepEqual(auth.basic, expectedBasic, 'auth has basic credentials');
    });

    it('should pre-load item with clean-up', () => {
        const item = collection.item[0];
        assert.equal(item.request.method, 'DELETE');
        assert.equal(item.request.url, 'https://{{host}}/mgmt/shared/appsvcs/declare/');
    });

    it('should generate request item', () => {
        collection.addItem({
            request: {
                endpoint: 'mgmt/shared/appsvcs/info'
            },
            events: {
                test: [
                    'pm.test("Status code is 200", function () {pm.response.to.have.status(200);});'
                ]
            }
        });
        const expectedItem = {
            name: 'Request',
            description: '',
            request: {
                method: 'GET',
                body: {},
                header: undefined,
                url: 'https://{{host}}/mgmt/shared/appsvcs/info'
            },
            event: [{
                listen: 'test',
                script: {
                    type: 'text/javascript',
                    exec: [
                        'pm.test("Status code is 200", function () {pm.response.to.have.status(200);});'
                    ]
                }
            }]
        };
        const item = collection.item[1];
        assert.deepEqual(item, expectedItem, 'item has a request');
    });
});

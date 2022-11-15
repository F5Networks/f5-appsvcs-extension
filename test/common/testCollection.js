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

const CheckLib = require('./checkLib');

class TestCollection {
    constructor(name) {
        this.info = {
            id: 'debug',
            name,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        };
        this.changeCredentials();
        this.item = [];

        this.addDeleteItem('Pre-test');
    }

    changeCredentials() {
        this.auth = {
            type: 'basic',
            basic: [
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
            ]
        };
    }

    /* eslint-disable-next-line class-methods-use-this */
    createRequest(requestOptions) {
        const endpoint = requestOptions.endpoint || '';
        const body = {};
        if (requestOptions.body) {
            body.mode = 'raw';
            body.raw = JSON.stringify(requestOptions.body);
        }
        const request = {
            method: requestOptions.method || 'GET',
            body,
            url: `https://{{host}}/${endpoint}`,
            header: requestOptions.headers
        };
        return request;
    }

    /* eslint-disable-next-line class-methods-use-this */
    createEvents(events) {
        const event = Object.keys(events)
            .map((key) => ({
                listen: key,
                script: {
                    type: 'text/javascript',
                    exec: events[key]
                }
            }));
        return event;
    }

    addItem(_options) {
        const options = _options || {};
        const item = {
            name: options.name || 'Request',
            description: options.description || ''
        };
        item.request = this.createRequest(options.request || {});
        item.event = this.createEvents(options.events || {});
        this.item.push(item);
    }

    addDeleteItem(description) {
        this.addItem({
            name: `${description} delete`,
            request: {
                method: 'DELETE',
                endpoint: 'mgmt/shared/appsvcs/declare/',
                body: {}
            },
            events: {
                test: [
                    'pm.test("Status code is 200", function() {',
                    '    pm.response.to.have.status(200);',
                    '});'
                ]
            }
        });
    }

    addDeclarePostItem(description, body) {
        const item = {
            name: `Test declare POST with ${description}`,
            request: {
                method: 'POST',
                endpoint: 'mgmt/shared/appsvcs/declare',
                body
            },
            events: {}
        };
        CheckLib.addStatusCodeCheck(item.events, 200);
        this.addItem(item);
    }

    addNonSuccessItem(description, body, subpath, method, statusCode, errorMessage, statusCodes) {
        if (!method) {
            method = 'POST';
        }

        subpath = subpath ? `/${subpath}` : '';
        body = method === 'GET' || method === 'DELETE' ? undefined : body;
        const item = {
            name: `Test declare/${subpath} - ${description}`,
            request: {
                method,
                endpoint: `mgmt/shared/appsvcs/declare${subpath}`,
                body,
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/json',
                        type: 'text'
                    }
                ]
            },
            events: {}
        };
        CheckLib.addStatusCodeCheck(item.events, statusCode);

        if (statusCodes) {
            CheckLib.addMultiMessageCheck(item.events, errorMessage, statusCodes);
        } else {
            CheckLib.addMessageCheck(item.events, errorMessage);
        }

        this.addItem(item);
    }

    serialize() {
        return JSON.stringify(this, null, 2);
    }
}

module.exports = TestCollection;

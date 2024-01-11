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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const Context = require('../../../../src/lib/context/context');
const mutex = require('../../../../src/lib/mutex');
const { validateEnvVars } = require('../../../common/checkEnv');

const {
    postDeclaration,
    deleteDeclaration,
    getAuthToken,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');

describe('mutex', function () {
    this.timeout(GLOBAL_TIMEOUT);

    let mutexRefresher = {};
    const [targetHost, portString] = process.env.AS3_HOST.split(':');
    const targetPort = parseInt(portString, 10) || 443;
    const context = Context.build();
    context.tasks[0] = {
        urlPrefix: `https://${targetHost}:${targetPort}`
    };
    context.control.targetPort = targetPort;

    before(() => {
        validateEnvVars(['TEST_RESOURCES_URL']);
    });

    afterEach(() => Promise.resolve()
        .then(() => mutex.releaseMutexLock(context, mutexRefresher))
        .then(() => deleteDeclaration()));

    it('mutex locking', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'urn:uuid:2c54d445-d98b-424e-8818-d291acda5981',
            label: 'Pool Test',
            remark: 'HTTP with pool members',
            controls: {
                class: 'Controls',
                logLevel: 'debug',
                trace: true
            },
            Async_Mutex_Test1: {
                class: 'Tenant',
                A1: {
                    class: 'Application',
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.230'],
                        pool: 'simple_pool'
                    },
                    simple_pool: {
                        class: 'Pool',
                        monitors: ['http']
                    }
                }
            },
            Async_Mutex_Test2: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    wafPolicy: {
                        class: 'WAF_Policy',
                        url: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/wordpress_template_12.0.xml`
                    }
                }
            }
        };

        let promise = Promise.resolve();
        if (process.env.TEST_IN_AZURE === 'true') {
            const creds = `${process.env.AS3_USERNAME}:${process.env.AS3_PASSWORD}`;
            context.request.basicAuth = `Basic ${Buffer.from(creds).toString('base64')}`;
        } else {
            promise = getAuthToken()
                .then((token) => {
                    context.control.targetTokens = {
                        'X-F5-Auth-Token': token
                    };
                });
        }

        return promise
            .then(() => mutex.acquireMutexLock(context))
            .then((refresher) => {
                mutexRefresher = refresher;
                assert.strictEqual(refresher.status, 'success');
            })
            .then(() => postDeclaration(declaration, '?async=true'))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 503);
                assert.strictEqual(response.results[0].message, 'Error: Configuration operation in progress on device localhost, please try again in 2 minutes');
            });
    });
});

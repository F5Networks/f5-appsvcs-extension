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

const assert = require('assert');
const execFile = require('child_process').execFile;

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const cloudLibUtils = require('../../../src/lib/util/cloudLibUtils');
const networkUtil = require('../../../src/lib/util/networkUtil');
const requestUtil = require('../../common/requestUtilPromise');
const Context = require('../../../src/lib/context/context');
const { validateEnvVars } = require('../../common/checkEnv');

describe('Container', function () {
    before(() => {
        validateEnvVars(
            [
                'DOCKER_ID',
                'AS3_HOST',
                'AS3_USERNAME',
                'AS3_PASSWORD'
            ]
        );
    });

    let containerId = process.env.DOCKER_ID;
    let defaultOpts;

    const [targetHost, portString] = process.env.AS3_HOST.split(':');
    const targetPort = parseInt(portString, 10) || 443;
    const targetUsername = process.env.AS3_USERNAME;
    const targetPassphrase = process.env.AS3_PASSWORD;
    process.env.AS3_HOST = 'localhost:9443';
    process.env.AS3_USERNAME = 'admin';
    process.env.AS3_PASSWORD = 'admin';

    const baseUrl = '/mgmt/shared/appsvcs';

    function execPromise(command, options) {
        return new Promise((resolve, reject) => {
            const splitCommand = command.split(' ');
            execFile(splitCommand.shift(), splitCommand, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (stderr) {
                    reject(new Error(stderr));
                    return;
                }

                resolve(stdout);
            });
        });
    }

    before('Start container', function () {
        this.timeout(20000);
        defaultOpts = {
            path: `${baseUrl}/declare`,
            body: {
                class: 'AS3',
                action: 'retrieve',
                targetHost,
                targetPort,
                targetUsername,
                targetPassphrase
            }
        };
        if (containerId) return Promise.resolve();

        const dockerCmd = `docker run --rm -d -p 9443:443 ${process.env.DOCKER_IMAGE}`;
        return execPromise(dockerCmd)
            .then((id) => { containerId = id; })
            .then(() => promiseUtil.delay(15000));
    });

    after('Stop container', function () {
        this.timeout(5000);
        if (process.env.DOCKER_ID || !containerId) return Promise.resolve();

        return execPromise(`docker stop ${containerId}`);
    });

    describe('Endpoints available', () => {
        it('should GET on /info', () => requestUtil.get({ path: `${baseUrl}/info` })
            .then((response) => {
                assert.strictEqual(response.statusCode, 200);
                assert(response.body.version);
                assert(response.body.release);
                assert(response.body.schemaCurrent);
                assert(response.body.schemaMinimum);
            }));

        it('should GET on /task', () => requestUtil.get({ path: `${baseUrl}/task` })
            .then((response) => {
                assert.deepEqual(response.statusCode, 200);
            }));

        it('should forward single retrieve request (AS3) with targetPassphrase', function () {
            this.timeout(20000);
            return requestUtil.post(defaultOpts)
                .then((response) => {
                    assert(response.statusCode < 300, `Status code ${response.statusCode} does not indicate success`);
                    assert.notEqual(response.statusCode, 202, 'Got unexpected async response');
                });
        });

        it('should forward multiple request (AS3 array) with targetPassphrase', function () {
            this.timeout(20000);
            const reqOpts = Object.assign({}, defaultOpts);
            reqOpts.body = [
                defaultOpts.body,
                defaultOpts.body
            ];
            return requestUtil.post(reqOpts)
                .then((response) => {
                    assert(response.statusCode < 300, `Status code ${response.statusCode} does not indicate success`);
                    assert.notEqual(response.statusCode, 202, 'Got unexpected async response');
                });
        });
    });

    describe('Request validation', () => {
        function assertRequiredAS3Class(err) {
            const adcErrorMsg = 'Received unexpected 422 status code: {"code":422,"message":"Requests via containers must be wrapped in an AS3 class with target*** properties"}';
            assert.strictEqual(err.message, adcErrorMsg, 'Should include message requiring AS3 class');
        }

        it('should not allow ADC', function () {
            this.timeout(10000);
            const reqOpts = Object.assign({}, defaultOpts);
            reqOpts.body = {
                class: 'ADC',
                id: 'need-as3-target***-props'
            };
            return requestUtil.post(reqOpts)
                .then((response) => {
                    assert(response.statusCode >= 400, 'Request expected to fail succeeded');
                    assert.notEqual(response.statusCode, 202, 'Got unexpected async response');
                })
                .catch((err) => {
                    assertRequiredAS3Class(err);
                });
        });

        it('should not allow ADC array', function () {
            this.timeout(10000);
            const reqOpts = Object.assign({}, defaultOpts);
            reqOpts.body = [
                {
                    class: 'ADC',
                    id: 'need-as3-target***-props'
                },
                {
                    class: 'ADC',
                    id: 'when-on-container'
                }];
            return requestUtil.post(reqOpts)
                .then((response) => {
                    assert(response.statusCode >= 400, 'Request should not succeed');
                    assert.notEqual(response.statusCode, 202, 'Got unexpected async response');
                })
                .catch((err) => {
                    assertRequiredAS3Class(err);
                });
        });
    });

    describe('Target SD dependencies behavior', function () {
        this.timeout(600000);

        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: 'Container_Test',
            controls: { trace: true, logLevel: 'debug' },
            containerT1: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'http',
                    serviceMain: {
                        class: 'Service_HTTP',
                        virtualAddresses: ['192.0.2.111']
                    }
                }
            }
        };

        function clearRestStorage() {
            return Promise.resolve()
                .then(() => {
                    const reqOpts = {
                        protocol: 'https:',
                        host: `${targetHost}:${targetPort}`,
                        auth: `${targetUsername}:${targetPassphrase}`,
                        path: '/mgmt/tm/util/bash',
                        body: {
                            command: 'run',
                            utilCmdArgs: '-c "bigstart stop restjavad restnoded; rm -rf /var/config/rest/storage; rm -rf /var/config/rest/index; rm -f /var/config/rest/downloads/*.rpm; rm -f /var/config/rest/iapps/RPMS/*.rpm; rm -rf /var/config/rest/iapps/f5-appsvcs; rm -rf /var/config/rest/iapps/f5-service-discovery; bigstart start restjavad restnoded"'
                        },
                        retryCount: 0
                    };
                    return requestUtil.post(reqOpts);
                })
                // endpoint will return 502, which will throw an error
                .catch(() => {})
                .then(() => promiseUtil.delay(60000))
                .then(() => {
                    const reqOpts = {
                        protocol: 'https:',
                        host: `${targetHost}:${targetPort}`,
                        auth: `${targetUsername}:${targetPassphrase}`,
                        path: '/mgmt/shared/iapp/package-management-tasks/available',
                        retryCount: 5,
                        retryInterval: 30000,
                        retryIf: (error, response) => response && response.statusCode === 503
                    };
                    return requestUtil.get(reqOpts);
                })
                .then(() => promiseUtil.delay(2000));
        }

        function uninstallSdIfPresent() {
            const requestContext = {
                targetHost,
                targetPort,
                targetUsername,
                targetPassphrase,
                protocol: 'https',
                host: targetHost,
                port: targetPort,
                urlPrefix: `https://${targetHost}:${targetPort}`,
                targetTokens: {}
            };

            const targetContext = { tokens: {} };

            const context = Context.build(undefined, requestContext, targetContext);
            context.control = {
                host: targetHost,
                port: targetPort,
                targetUsername,
                targetPassphrase,
                urlPrefix: `https://${targetHost}:${targetPort}`
            };

            return Promise.resolve()
                .then(() => networkUtil.setAuthzToken(context, requestContext))
                .then(() => {
                    context.target.tokens = requestContext.targetTokens;
                    return cloudLibUtils.getDiscoveryRpm(context, 'packageName');
                })
                .then((discoveryRpmName) => {
                    if (discoveryRpmName) {
                        return cloudLibUtils.uninstallDiscoveryRpm(context, discoveryRpmName)
                            .then(() => promiseUtil.delay(15000));
                    }
                    return Promise.resolve();
                });
        }

        function post(action, decl, options) {
            const req = {
                path: `${baseUrl}/declare`,
                body: {
                    class: 'AS3',
                    action,
                    targetHost,
                    targetPort,
                    targetUsername,
                    targetPassphrase,
                    declaration: decl
                }
            };
            Object.assign(req, options);
            return requestUtil.post(req);
        }

        // ensure no as3 or SD installed
        before('clearing REST storage', () => clearRestStorage());

        after('uninstalling SD', () => {
            uninstallSdIfPresent();
        });

        it('should go ASYNC and install cloudlibs on target when missing', function () {
            return uninstallSdIfPresent()
                .then(() => post('deploy', declaration))
                .then((response) => {
                    assert(response.statusCode < 300, `Status code ${response.statusCode} does not indicate success`);
                    assert.equal(response.statusCode, 202, 'Expected Async Response');
                    const sdMsg = 'Installing service discovery components. The results of your request may be retrieved by sending a GET request to selfLink provided.';
                    assert.equal(response.body.results[0].message, sdMsg, 'Expected async message to be SD install');
                })
                .then(() => promiseUtil.delay(30000))
                .then(() => post('retrieve', undefined, {
                    retryCount: 9,
                    retryInterval: 30000,
                    retryIf: (error, response) => response && response.statusCode === 204
                }))
                .then((response) => {
                    assert.equal(response.statusCode, 200, 'Expected action=retrieve 200 response');
                    assert.ok(response.body.containerT1);
                });
        });

        it('should remain SYNC and not install cloudlibs on target when already present', function () {
            return post('deploy', declaration)
                .then((response) => {
                    assert(response.statusCode < 300, `Status code ${response.statusCode} does not indicate success`);
                    assert.equal(response.statusCode, 200, 'Expected Sync Response');
                    assert.ok(response.body.results.find((r) => r.message === 'no change' && r.tenant === 'containerT1'));
                })
                .then(() => post('remove'))
                .then(() => post('retrieve'))
                .then((response) => {
                    assert.equal(response.statusCode, 204, 'Expected action=retrieve 204 No Content');
                })
                .then(() => promiseUtil.delay(10000));
        });
    });
});

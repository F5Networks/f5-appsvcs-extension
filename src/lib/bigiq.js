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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const log = require('./log');
const util = require('./util/util');
const fetch = require('./fetch');

/**
 * recursively GET a BIG-IQ job status until complete
 *
 * @public
 * @param {object} context
 * @param {object} options
 * @param {object} wait
 * @returns {Promise}
 */
const waitForCompletion = function (context, options, wait) {
    // set polling interval and recursion timeout in msec
    // note that polling interval starts small and increases to the max value
    wait = wait || {
        interval: 500,
        maxInterval: 4000,
        timeout: 899500 // 15 minutes
    };

    // get status of BIG-IQ template processing
    return util.iControlRequest(context, options)
        .then((res) => {
            if (wait.timeout < 0) {
                res.status = 'FAILED';
                res.message = 'AS3 timed out waiting for BIG-IQ response';
            }

            // BIG-IQ has lots of status values, but they all should resolve to
            // FINISHED, FAILED, or CANCELED
            if (res.status === 'FINISHED') {
                log.debug('BIG-IQ job succeeded');
                res.message = 'success';
                return res;
            }
            if (res.status === 'FAILED' || res.status === 'CANCELED') {
                log.debug({ message: 'BIG-IQ job failed', response: res });
                res.message = res.status.toLowerCase();
                return res;
            }
            // poll BIG-IQ for status until the current job status indicates completion
            // log.debug(`polling BIG-IQ in ${wait.interval / 1000} seconds, timeout in ${wait.timeout / 1000}`);
            return Promise.resolve()
                .then(() => promiseUtil.delay(wait.interval))
                .then(() => {
                    // polling interval increases parametrically to a specified maximum
                    wait.timeout -= wait.interval;
                    wait.interval = (2 * wait.interval > wait.maxInterval)
                        ? wait.maxInterval : (2 * wait.interval);

                    // iterate by recursion
                    return waitForCompletion(context, options, wait);
                });
        });
};

/**
 * deploy tenant declaration to BIG-IQ App Template Interface
 *
 * @public
 * @param {object} context
 * @param {array} tenantId
 * @param {object} declaration
 * @returns {Promise} - resolves to Tenant config response
 */
const deployTenant = function (context, tenantId, declaration) {
    if (declaration.target === undefined) {
        return Promise.resolve(log.error(`Missing target device in Tenant ${tenantId}`));
    }

    const tenantCount = fetch.validClassList(declaration, 'Tenant').length;
    if (tenantId === 'Common' && tenantCount > 1) {
        return Promise.resolve({
            message: 'no change: Common is being processed as part of other tenants',
            tenant: tenantId,
            host: context.target.host
        });
    }

    const payload = {};
    Object.keys(declaration).forEach((obj) => {
        if (
            typeof declaration[obj] !== 'object'
            || declaration[obj].class === undefined
            || declaration[obj].class !== 'Tenant'
            || obj === tenantId
            || obj === 'Common'
        ) {
            payload[obj] = declaration[obj];
        }
    });

    updatePayloadUserAgent(context, payload);
    updatePayloadForDryRun(context, payload);

    // post BIG-IQ template for tenant config on target device
    const options = {
        path: '/mgmt/cm/global/tasks/deploy-app-service',
        why: 'post AS3 declaration to BIG-IQ',
        method: 'POST',
        send: JSON.stringify({ declaration: payload }),
        ctype: 'application/json',
        referer: 'https://localhost/mgmt/shared/appsvcs/declare'
    };
    // BIG-IQ API is async, so no request should take more than a second
    options.targetTimeout = 10;

    return util.iControlRequest(context, options)

        // wait around for BIG-IQ to finish
        .then((postResponse) => {
            options.path = postResponse.selfLink.replace(/^.*localhost/, '');
            options.why = 'check status of BIG-IQ config processing';
            options.method = 'GET';
            return waitForCompletion(context, options, null);
        })

        // record the outcome and return
        .then((res) => ({
            message: (res.status === 'FINISHED') ? 'success' : (res.errorMessage || 'failed'),
            dryRun: context.tasks[context.currentIndex].dryRun,
            resources: res.resources || undefined
        }));
};

function updatePayloadForDryRun(context, payload) {
    if (context.tasks[context.currentIndex].dryRun) {
        let controlsClass = util.getObjectNameWithClassName(payload, 'Controls');
        if (!controlsClass) {
            controlsClass = 'controls';
            payload[controlsClass] = {};
        }
        payload[controlsClass].internalUse = { action: 'dry-run' };
    }
}

function updatePayloadUserAgent(context, payload) {
    const bigIqVersion = context.target.tmosVersion.match(/^([0-9]+)\.([0-9]+)/)[0];
    let controlsClass = util.getObjectNameWithClassName(payload, 'Controls');

    if (!controlsClass) {
        controlsClass = 'controls';
        payload[controlsClass] = {
            class: 'Controls'
        };
    }
    payload[controlsClass].userAgent = `BIG-IQ/${bigIqVersion} Configured by API`;
}

module.exports = {
    deployTenant
};

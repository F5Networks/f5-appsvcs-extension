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

/*
 * Target Context holds the specific information of a sub-declaration's target
 *   machine. These are built configured in declarationHandler.process(), thus
 *   on a per sub-declaration basis.
 *
 * tokens - The sub-declaration's security tokens (e.g. X-F5-Auth-Token).
 * provisionedModules - The modules provisioned on the target machine.
 * tmosVersion - The tmos version on the target machine.
 * deviceType - The device type of the target machine.
 * host - Address of target host.
 * port - Port for target host address.
 */

const util = require('../util/util');
const log = require('../log');
const constants = require('../constants');

const STATUS_CODES = require('../constants').STATUS_CODES;

class TargetContext {
    static get(context) {
        return Promise.resolve()
            .then(() => buildContext(context));
    }
}

function buildContext(initialContext) {
    const targetContext = {};

    // util.iControlRequest is used in both getTargetProvisioning & getTmosVersion
    // context.target is required in util.iControlRequest

    return Promise.resolve()
        .then(() => {
            targetContext.host = util.getDeepValue(initialContext, 'control.targetHost') || constants.defaultHost;
            targetContext.port = util.getDeepValue(initialContext, 'control.targetPort') || constants.defaultPort;
            initialContext.target = initialContext.target || {};

            // set host and port here since we still need other control values from initialContext
            initialContext.target.host = targetContext.host;
            initialContext.target.port = targetContext.port;
        })
        .then(() => {
            targetContext.tokens = util.getTargetTokens(initialContext, initialContext.currentIndex);

            return getTargetProvisioning(initialContext);
        })
        .then((modules) => {
            targetContext.provisionedModules = modules;

            return getDeviceInfo(initialContext);
        })
        .then((ver) => {
            targetContext.tmosVersion = ver.tmosVersion;
            targetContext.deviceType = ver.deviceType;
            return targetContext;
        })
        .catch((err) => {
            if (err.statusCode) {
                throw err;
            }

            // Currently each action has a different expected response
            // currentAction - requires context.tasks[context.currentIndex].action
            // being set within declareHandler.processDeclInArray()
            const currentAction = initialContext.tasks[initialContext.currentIndex].action;
            if (currentAction === 'retrieve') {
                err.message = 'unable to retrieve declaration';
                err.statusCode = STATUS_CODES.NOT_FOUND;
            } else if (currentAction === 'patch') {
                err.message = `patch operation failed - see logs for details. ${err.message}`;
                err.statusCode = STATUS_CODES.BAD_REQUEST;
            } else {
                err.statusCode = err.status || STATUS_CODES.INTERNAL_SERVER_ERROR;
            }
            throw err;
        });
}

function getTargetProvisioning(context) {
    const opts = {
        path: '/mgmt/tm/sys/provision',
        why: 'query target BIG-IP provisioning'
    };

    return util.iControlRequest(context, opts)
        .then((resp) => {
            if (typeof resp === 'undefined' || !Array.isArray(resp.items)) {
                throw new Error('Could not retrieve provisioning of target device');
            }
            const provisionedModules = [];

            resp.items.forEach((item) => {
                if (item.level !== 'none') {
                    provisionedModules.push(item.name);
                }
            });
            log.info(`target modules provision: ${provisionedModules}`);
            return provisionedModules;
        });
}

function getDeviceInfo(context) {
    const opts = {
        path: '/mgmt/shared/identified-devices/config/device-info',
        why: 'query target device TMOS version'
    };

    return util.iControlRequest(context, opts)
        .then((response) => {
            if (typeof response === 'undefined' || !response.slots) {
                const err = `${opts.path} did not return a proper response with a slots array. `
                    + `Response: ${JSON.stringify(response)}`;
                throw new Error(err);
            }

            const activeSlot = response.slots.find((slot) => slot.isActive && slot.product);

            if (activeSlot) {
                const ver = {};
                ver.tmosVersion = `${activeSlot.version}.${activeSlot.build}`;
                ver.deviceType = activeSlot.product;
                log.info(`target device is ${ver.deviceType} version ${ver}`);
                return ver;
            }

            throw new Error('target device has no active slots');
        });
}

module.exports = TargetContext;

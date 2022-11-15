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

const Ajv = require('ajv');
const log = require('./log');
const util = require('./util/util');

const DEVICE_TYPES = require('./constants').DEVICE_TYPES;

const ajv = new Ajv({ useDefaults: true });

const applyOverlay = function (context, declaration) {
    const schemas = {};

    // stop now if not running on BIG-IQ
    if (util.getDeepValue(context, 'target.deviceType') !== DEVICE_TYPES.BIG_IQ) {
        return Promise.resolve(declaration);
    }

    // loop through the applications to get service catalog template names
    Object.keys(declaration).forEach((tenant) => {
        if (declaration[tenant].class === undefined || declaration[tenant].class !== 'Tenant') {
            return;
        }
        Object.keys(declaration[tenant]).forEach((application) => {
            const app = declaration[tenant][application] || {};
            if (app.class === undefined || app.class !== 'Application') {
                return;
            }
            if (app.schemaOverlay === undefined) {
                // force all BIG-IQ applications to use an overlay
                app.schemaOverlay = 'default';
            }
            schemas[app.schemaOverlay] = { additionalProperties: false };
        });
    });

    // stop now if no schema overlays were specified
    if (Object.keys(schemas).length === 0) {
        return Promise.resolve(declaration);
    }

    // retrieve all schemas
    const options = {
        path: '/mgmt/cm/global/appsvcs-templates',
        why: 'get service catalog template',
        method: 'GET'
    };
    return util.iControlRequest(context, options)
        .then((response) => {
            // parse the overlay schemas and add them to the hash
            response.items.forEach((res) => {
                try {
                    schemas[res.name] = res.schemaOverlay;
                } catch (e) {
                    e.message = `could not parse response from service catalog (${e.message})`;
                    throw (e);
                }
            });

            // apply the specified schema to each application
            Object.keys(declaration).forEach((tenant) => {
                if (declaration[tenant].class === undefined || declaration[tenant].class !== 'Tenant') {
                    return;
                }
                Object.keys(declaration[tenant]).forEach((application) => {
                    const app = declaration[tenant][application];
                    if (app.class === undefined || app.class !== 'Application') {
                        return;
                    }
                    log.debug({ message: 'Pre-parsing with', overlay: schemas[app.schemaOverlay] });
                    const isValid = ajv.validate(schemas[app.schemaOverlay], app);
                    log.debug({ message: 'Pre-parsed app declaration', app, valid: isValid });
                    if (!isValid) {
                        const e = new Error(`declaration is invalid according to provided schema overlay: ${ajv.errorsText()}`);
                        e.status = 422;
                        throw (e);
                    }
                    declaration[tenant][application] = util.simpleCopy(app);
                });
            });
            return declaration;
        });
};

module.exports = {
    applyOverlay
};

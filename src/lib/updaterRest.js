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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const util = require('./util/util');
const serviceDiscovery = require('./serviceDiscovery');

class UpdaterRest {
    constructor(context, tenantId) {
        this.tag = 'rest';
        this.tenantId = tenantId;
        this.context = context;
    }

    tagDiff(diff) {
        diff.forEach((entry) => {
            if (entry.command === 'mgmt shared service-discovery task') {
                entry.tags.push(this.tag);
            }
        });
    }

    _generateBody(command, config) {
        let body = util.simpleCopy(config);
        if (command === 'mgmt shared service-discovery task') {
            body = serviceDiscovery.getTaskFromTmsh(config);
        }
        return JSON.stringify(body);
    }

    update(desired, current, diff) {
        if (this.context.tasks[this.context.currentIndex].dryRun === true) {
            return Promise.resolve();
        }

        const hasPatched = {};
        const promises = diff.map((entry) => {
            const xhs = entry.rhs || entry.lhs;
            if (!xhs && (entry.kind === 'N' || entry.kind === 'D')) {
                return () => Promise.resolve();
            }
            const options = {
                path: `/${entry.command.replace(/ /g, '/')}`,
                why: `${entry.command} update`
            };

            if (entry.kind === 'N') {
                options.method = 'POST';
                options.send = this._generateBody(entry.command, xhs.properties);
            } else if (entry.kind === 'D') {
                options.method = 'DELETE';
                options.path += `/${xhs.properties.id}`;
            } else if (entry.kind === 'E') {
                if (hasPatched[entry.path[0]] === true
                    && entry.command === 'mgmt shared service-discovery task') {
                    // Only vetted for "mgmt shared service-discovery task". Might be used
                    // elsewhere if testing is done ahead of time for it.
                    // Do NOT run more than 1 PATCH against the same SD task
                    return () => Promise.resolve();
                }
                hasPatched[entry.path[0]] = true;
                options.method = 'PATCH';
                const properties = desired[entry.path[0]].properties;
                options.path += `/${properties.id}`;
                options.send = this._generateBody(entry.command, properties);
            }

            return () => util.iControlRequest(this.context, options);
        });

        return promiseUtil.series(promises)
            .then(() => {})
            .catch((error) => {
                error.code = 422;
                throw error;
            });
    }

    postProcessUpdate() {
        return Promise.resolve();
    }
}

module.exports = UpdaterRest;

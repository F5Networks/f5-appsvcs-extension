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

const fetch = require('./fetch');
const log = require('./log');
const update = require('./update');

class UpdaterTmsh {
    constructor(context, tenantId) {
        this.tag = 'tmsh';
        this.tenantId = tenantId;
        this.context = context;
    }

    tagDiff(diff) {
        diff.forEach((entry) => {
            if (!entry.command.startsWith('mgmt shared service-discovery')) {
                entry.tags.push(this.tag);
            }
        });
    }

    update(desired, current, diff) {
        const tenantUpdate = fetch.tmshUpdateScript(this.context, desired, current, diff);
        if (this.context.tasks[this.context.currentIndex].traceResponse) {
            this.context.log[`${this.tenantId}Script`] = tenantUpdate.script;
        }
        log.writeTraceFile(this.tenantId, 'script', tenantUpdate.script);
        return update.submit(this.context, tenantUpdate, diff);
    }

    postProcessUpdate(updateInfo) {
        const tenantUpdate = fetch.postProcessUpdateScript(this.context, updateInfo);
        if (!tenantUpdate) {
            return null;
        }

        if (this.context.tasks[this.context.currentIndex].traceResponse) {
            this.context.log[`${this.tenantId}Script`] = tenantUpdate.script;
        }
        log.writeTraceFile(this.tenantId, 'script', tenantUpdate.script);
        return update.submit(this.context, tenantUpdate, 'post process');
    }
}

module.exports = UpdaterTmsh;

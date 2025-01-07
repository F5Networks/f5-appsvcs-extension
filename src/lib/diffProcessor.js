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

class DiffProcessor {
    constructor(diff, desired, current) {
        // Diff is modified and should not be copied
        this.diff = diff;

        // These should probably not be modified
        this.desired = desired;
        this.current = current;
    }

    _initializeTags() {
        this.diff.forEach((entry) => {
            entry.tags = [];
        });
    }

    _normalizeCommands() {
        this.diff.forEach((entry) => {
            const xhs = entry.rhs || entry.lhs;
            if (xhs && xhs.command) {
                entry.command = xhs.command;
                return;
            }

            // Find command in desired
            entry.command = this.desired[entry.path[0]].command;
        });
    }

    process() {
        this._initializeTags();
        this._normalizeCommands();
        return Promise.resolve();
    }

    validate() {
        // Find unsupported renames and throw error
        const renames = this.diff.filter((d) => d.kind === 'R');
        if (renames.length > 0) {
            return Promise.reject(Error(`Renaming ${renames[0].path} to ${renames[0].rhs} is not supported`));
        }

        return Promise.resolve();
    }
}

module.exports = DiffProcessor;

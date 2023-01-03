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

const PolicyGenerator = require('./ltmPolicyGenerator');

function fixOrdinals(list) {
    list.forEach((item, index) => {
        item.ordinal = index;
    });
}

const postRandomizers = {
    Endpoint_Policy: (resource) => {
        if (resource.customStrategy) {
            delete resource.customStrategy;
        }
        if (resource.strategy === 'custom') {
            delete resource.strategy;
        }
        if (resource.rules) {
            fixOrdinals(resource.rules);
            resource.rules.forEach((rule) => {
                if (rule.actions) {
                    rule.actions.forEach((action, index) => {
                        rule.actions[index] = PolicyGenerator.generate('action');
                    });
                }
                if (rule.conditions) {
                    rule.conditions.forEach((action, index) => {
                        rule.conditions[index] = PolicyGenerator.generate('condition');
                    });
                }
            });
        }
        return resource;
    },
    Endpoint_Strategy: (resource) => {
        if (resource.operands) {
            resource.operands = resource.operands.map(() => PolicyGenerator.generate('operand'));
        }
        return resource;
    }
};

module.exports = (name, resource) => {
    const postRandomizer = postRandomizers[name];
    if (!postRandomizer) {
        return resource;
    }

    return postRandomizer(resource);
};

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

const parseTopologyItem = function parseTopologyItem(objString) {
    const parsedItem = {};
    let notPrefix = '';
    let typeAndValue = '';
    if (objString.indexOf('not ') === 0) {
        notPrefix = 'not ';
        typeAndValue = objString.substring(4);
    } else {
        typeAndValue = objString;
    }
    if (typeAndValue.indexOf('isp /Common/') > -1 && typeAndValue.indexOf('geoip-isp') === -1) {
        typeAndValue = typeAndValue.replace('isp /Common/', 'isp ');
    }
    const type = typeAndValue.substring(0, typeAndValue.indexOf(' '));
    let value = typeAndValue.substring(typeAndValue.indexOf(' ') + 1);
    if ((type === 'state' || type === 'geoip-isp') && value.indexOf('"') === -1) {
        value = `"${value}"`;
    }

    parsedItem[type] = value;
    parsedItem.type = type;
    parsedItem.value = value;
    parsedItem.not = notPrefix.trim();
    parsedItem.name = `${notPrefix}${type} ${value}`;
    return parsedItem;
};

module.exports = {
    parseTopologyItem
};

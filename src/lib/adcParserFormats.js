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

const ipUtil = require('@f5devcentral/atg-shared-utilities').ipUtils;

const formats = [
    // "f5pointer" matches AS3 pointers from one part of a
    // declaration to another, including '@' macros, relative
    // JSON pointers, etc.
    {
        name: 'f5pointer',
        check: /^((@|[0-9]+)|(([0-9]*\x2f)?((@|[0-9]+|[A-Za-z][0-9A-Za-z_]{0,63})\x2f)*([0-9]+|([A-Za-z][0-9A-Za-z_]{0,63}))))?#?$/
    },

    // "f5bigip" ought to match names of BIG-IP configuration
    // components.  In fact it merely excludes egregious errors.
    // It does demand absolute pathnames (i.e., starting with /
    // like "/Common/foo") and it forbids space (\x20) in names
    {
        name: 'f5bigip',
        check: /^\x2f[^\x00-\x19\x22#'*<>?\x5b-\x5d\x7b-\x7d\x7f]+$/
    },

    // 'f5ip' matches IPv4 or IPv6 with optional %RD and/or /masklen
    {
        name: 'f5ip',
        check: (address) => address === '' || ipUtil.isIPv4(address) || ipUtil.isIPv6(address)
    },

    // 'f5ipv4' matches IPv4 with optional %RD and/or /masklen
    {
        name: 'f5ipv4',
        check: (address) => address === '' || ipUtil.isIPv4(address)

    },

    // 'f5ipv4' matches IPv6 with optional %RD and/or /masklen
    {
        name: 'f5ipv6',
        check: (address) => address === '' || ipUtil.isIPv6(address)

    }
];

module.exports = formats;

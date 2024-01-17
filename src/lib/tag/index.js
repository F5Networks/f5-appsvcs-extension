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

const LongSecretTag = require('./longSecretTag');
const MinVersionTag = require('./minVersionTag');
const NodeTag = require('./nodeTag');
const SecretTag = require('./secretTag');
const CheckResourceTag = require('./checkResourceTag');
const PointerTag = require('./pointerTag');
const VirtualAddressTag = require('./virtualAddressTag');
const FetchTag = require('./fetchTag');
const CertExtractTag = require('./certExtractTag');
const IncludeTag = require('./includeTag');
const ModuleTag = require('./moduleTag');
const BigComponentTag = require('./bigComponentTag');
const ExpandTag = require('./expandTag');
const ServiceDiscoveryTag = require('./serviceDiscoveryTag');
const AliasesTag = require('./aliasesTag');

module.exports = {
    LongSecretTag,
    MinVersionTag,
    NodeTag,
    SecretTag,
    CheckResourceTag,
    PointerTag,
    VirtualAddressTag,
    FetchTag,
    CertExtractTag,
    IncludeTag,
    ModuleTag,
    BigComponentTag,
    ExpandTag,
    ServiceDiscoveryTag,
    AliasesTag
};

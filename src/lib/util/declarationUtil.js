/**
 * Copyright 2026 F5, Inc.
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

function isClass(obj, className) {
    return (obj || {}).class === className;
}

function isADC(obj) {
    return isClass(obj, 'ADC');
}

function isAS3(obj) {
    return isClass(obj, 'AS3');
}

function isApplication(obj) {
    return isClass(obj, 'Application');
}

function isTenant(obj) {
    return isClass(obj, 'Tenant');
}

function isCertificate(obj) {
    return isClass(obj, 'Certificate');
}

module.exports = {
    isClass,
    isADC,
    isAS3,
    isApplication,
    isTenant,
    isCertificate
};

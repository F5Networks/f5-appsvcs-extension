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

const util = require('../util/util');

const TAG = 'virtualAddress';

/**
 * This tag formats the virtualServer addressList supplied
 *
 * @param {Object} context - The current context object
 * @param {Object} declaration - The current declaration that was validated by AJV
 * @param {Object[]} [virtualAddresses] - The array of virtual-address lists that will be processed
 * @param {*} virtualAddresses[].data - The pointer data from the declaration
 * @param {*} virtualAddresses[].parentData - The virtualAddress's parent data from the declaration
 * @param {string} virtualAddresses[].instancePath - The json pointer that was used to fetch the data
 * @param {string} virtualAddresses[].parentDataProperty - The parent's property name that contains the data
 * @returns {Promise} - Promise resolves when all data is processed
 */
function process(context, declaration, virtualAddresses) {
    if (!context || !declaration || typeof declaration.scratch !== 'undefined') {
        return Promise.resolve();
    }

    if (!virtualAddresses || !Array.isArray(virtualAddresses) || util.isEmptyOrUndefined(virtualAddresses)) {
        return Promise.resolve();
    }

    virtualAddresses.forEach((v) => handleAddressList(context, v));

    return Promise.resolve();
}

function handleAddressList(context, virtualAddress) {
    const data = virtualAddress.data;
    const parentData = virtualAddress.parentData;

    data.forEach((address, index) => {
        function formatDestAddr(virtualAddr) {
            const addressNoMask = virtualAddr.includes(':') ? virtualAddr.split('.')[0] : virtualAddr.split('/')[0];
            const addressOnBigip = context.host.parser.virtualAddressList.find((addr) => (
                (addr.address === addressNoMask)
                || (addr.address.match(/any$|any%/) && addressNoMask.includes('0.0.0.0'))
                || (addr.address.includes('any6') && addressNoMask.match(/::$|::%/)))
                && !(typeof addr.fullPath === 'string' && addr.fullPath.startsWith('/Common/Shared/')));
            if (addressOnBigip) {
                return {
                    bigip: addressOnBigip.fullPath,
                    address: virtualAddr
                };
            }
            return virtualAddr;
        }

        if (typeof address === 'string') {
            parentData.virtualAddresses[index] = formatDestAddr(address);
        } else if (Array.isArray(address) && typeof address[0] === 'string') {
            parentData.virtualAddresses[index][0] = formatDestAddr(address[0]);
        }
    });
    return true;
}

module.exports = {
    process,
    TAG
};

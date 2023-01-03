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

const promiseUtil = require('@f5devcentral/atg-shared-utilities').promiseUtils;
const log = require('./log');
const util = require('./util/util');
const constants = require('./constants');

// Variable to disable mutex lock for fast itteration on a crash causing bug
const MUTEX_DISABLED = false;

/**
 * Returns a promise to acquire a global lock. If it fails to
 * acquire a lock on a first attempt, it will create an object
 * to indicate any service discovery scripts should stop executing,
 * wait 200 milliseconds, and try again. If the second attempt
 * fails, we can assume another AS3 is modifying the tenant.
 *
 * @public
 * @param {object} context - full AS3 context object
 * @returns {Promise}
 */
function acquireMutexLock(context) {
    if (MUTEX_DISABLED) {
        return Promise.resolve(true);
    }

    const options = {
        path: '/mgmt/tm/ltm/data-group/internal',
        method: 'POST',
        ctype: 'application/json',
        why: 'Attempting to acquire global lock',
        send: JSON.stringify({
            name: `/Common/${constants.as3CommonFolder}/____appsvcs_lock`,
            description: Date.now(),
            type: 'string'
        }),
        crude: true
    };

    return acquireLock(context, options)
        .catch((error) => {
            throw { // eslint-disable-line no-throw-literal
                type: 'mutex_failure',
                statusCode: 503,
                message: error.toString()
            };
        });
}

/**
 * Returns a promise to acquire a lock as specified in the options.
 *
 * @param {object} context - full AS3 context object
 * @param {object} options options used for the iControlREST request
 */
function acquireLock(context, options) {
    return util.iControlRequest(context, options)
        .then((results) => {
            if (results.statusCode === 200) {
                log.debug('Acquired global lock');
                return {
                    status: 'success',
                    refresher: lockRefresher(context)
                };
            }
            if (results.statusCode !== 409) { // some error other than its already there
                const message = `Failed to acquire global lock with status: ${results.statusCode}`;
                log.debug(message);
                throw new Error(message);
            }
            // its already locked, check to see if lock is expired
            log.debug('Checking if global lock has expired');
            const checkExpirationOptions = {
                path: `/mgmt/tm/ltm/data-group/internal/~Common~${constants.as3CommonFolder}~____appsvcs_lock`,
                method: 'GET',
                ctype: 'application/json',
                why: 'Checking global mutex timeout',
                crude: true
            };
            return util.iControlRequest(context, checkExpirationOptions)
                .then((expirationResults) => {
                    // some error occured, if it was 404, the lock is gone.  If it was
                    // 503, maybe the bigip is available now.  If it was something else,
                    // may as well go ahead and try again anyways.
                    if (expirationResults.statusCode !== 200) {
                        const message = `Got status code ${expirationResults.statusCode} from global `
                            + 'lock expiration check, will continue attempting to acquire the lock';
                        log.debug(message);
                        return acquireLockHelper(context, options);
                    }
                    const body = JSON.parse(expirationResults.body);
                    // delete lock if it has no description, its description is not a number
                    // or it has expired.
                    if (typeof body.description === 'undefined' || Number.isNaN(body.description)
                        || checkLockExpiration(parseInt(body.description, 10))) {
                        log.debug('Removing expired global lock');
                        const removeMutexOptions = {
                            path: `/mgmt/tm/ltm/data-group/internal/~Common~${constants.as3CommonFolder}~____appsvcs_lock`,
                            method: 'DELETE',
                            ctype: 'application/json',
                            why: 'Deleting expired global lock',
                            crude: true
                        };
                        return util.iControlRequest(context, removeMutexOptions)
                            // we do not really care if it failed.  It may have been removed
                            // by another instance of AS3 or a service discovery script.
                            .then(() => acquireLockHelper(context, options));
                    }
                    // not expired
                    log.debug('Global lock has not expired');
                    throw new Error(`Configuration operation in progress on device ${context.target.host}`
                    + `, please try again in ${constants.mutexTimeoutMinutes} minutes`);
                });
        });
}

// helper for acquireLock. Handles post lock expiration check
function acquireLockHelper(context, options) {
    // ask scripts to stop and try again
    const stopScriptsOptions = {
        path: '/mgmt/tm/ltm/data-group/internal',
        method: 'POST',
        ctype: 'application/json',
        why: 'Requesting scripts stop modifying tenants',
        send: JSON.stringify({
            name: `/Common/${constants.as3CommonFolder}/____appsvcs_scripts_stop`,
            description: Date.now(),
            type: 'string'
        }),
        crude: true
    };
    return util.iControlRequest(context, stopScriptsOptions)
        .then((response) => {
            // if it was a 409 chances are good another AS3 is trying to make changes,
            // but we will race them anyways
            if (!(response.statusCode === 409 || response.statusCode === 200)) {
                const message = 'Failed to request scripts stop running with '
                    + `status: ${response.statusCode}`;
                log.debug(message);
                throw new Error(message);
            } else {
                // wait a moment for the scripts to stop
                return promiseUtil.delay(200);
            }
        })
        .then(() => util.iControlRequest(context, options))
        .then((secondResults) => {
            // still could not get the lock, go ahead and fail out
            if (secondResults.statusCode !== 200) {
                const message = 'Failed to acquire global lock on second attempt with '
                    + `status: ${secondResults.statusCode}`;
                log.debug(message);
                throw new Error(message);
            } else {
                log.debug('Acquired global lock on second attempt');
                const cleanupStopScriptsOptions = {
                    path: `/mgmt/tm/ltm/data-group/internal/~Common~${constants.as3CommonFolder}~____appsvcs_scripts_stop`,
                    method: 'DELETE',
                    ctype: 'application/json',
                    why: 'Cleaning up the request for scripts to stop modifying tenants'
                };
                // fire and forget.  We don't care when this happens since we now have the lock
                util.iControlRequest(context, cleanupStopScriptsOptions);
                return {
                    status: 'success',
                    refresher: lockRefresher(context)
                };
            }
        });
}

/**
 * Checks if a mutex lock has expired.
 * @param {integer} lockSetTime The time the mutex lock was set
 * @returns {boolean} true if it has expired
 */
function checkLockExpiration(lockSetTime) {
    const timeSinceSet = Date.now() - lockSetTime;

    if (timeSinceSet / 1000 / 60 > constants.mutexTimeoutMinutes) {
        return true;
    }
    return false;
}

function releaseMutexLock(context, mutexRefresher) {
    if (MUTEX_DISABLED) {
        return Promise.resolve(true);
    }

    log.debug('stopping refresh of mutex');
    clearInterval(mutexRefresher.refresher);

    log.debug('Queuing release of global lock');
    const options = {
        path: `/mgmt/tm/ltm/data-group/internal/~Common~${constants.as3CommonFolder}~____appsvcs_lock`,
        method: 'DELETE',
        ctype: 'application/json',
        why: 'Attempting to release global lock'
    };

    return util.iControlRequest(context, options);
}

// executes 30 seconds before the mutex is set to timeout to
// refresh the lock in cases of long running requests
function lockRefresher(context) {
    return setInterval(() => {
        log.debug('Refreshing global mutex lock');
        const refreshOptions = {
            path: `/mgmt/tm/ltm/data-group/internal/~Common~${constants.as3CommonFolder}~____appsvcs_lock`,
            method: 'PATCH',
            ctype: 'application/json',
            why: 'Refreshing global lock',
            send: JSON.stringify({
                description: Date.now()
            }),
            crude: true
        };
        util.iControlRequest(context, refreshOptions)
            .then((results) => {
                if (results.statusCode !== 200) {
                    log.error('Failed to refresh global mutex lock');
                }
            });
    }, (constants.mutexTimeoutMinutes - 0.5) * 60 * 1000);
}

module.exports = {
    acquireMutexLock,
    releaseMutexLock
};

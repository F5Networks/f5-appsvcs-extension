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

/* jshint ignore: start */

'use strict';

const atgStorage = require('@f5devcentral/atg-storage');
const log = require('../lib/log');
const restUtil = require('../lib/util/restUtil');
const Config = require('../lib/config');
const DeclareHandler = require('../lib/declareHandler');
const HostContext = require('../lib/context/hostContext');
const RequestContext = require('../lib/context/requestContext');
const Context = require('../lib/context/context');
const SettingsHandler = require('../lib/settingsHandler');

class RestWorker {
    constructor() {
        this.WORKER_URI_PATH = 'shared/appsvcs';
        this.isPassThrough = true;
        this.isPublic = true;
        this.hostContext = {};
        this.declareHandler = new DeclareHandler();
    }

    /**
     * Called by LX framework when as3 is initialized.
     *
     * @public
     * @param {function} success - callback to indicate successful startup
     * @param {function} failure - callback to indicate startup failure
     * @returns {undefined}
     */
    onStart(success) {
        // deps that are handled by framework's availability monitor, does not require user context
        const deviceInfo = this.restHelper.makeRestjavadUri('/shared/identified-devices/config/device-info');
        this.dependencies.push(deviceInfo);
        success();
    }

    /**
     * Recognize readiness to handle AS3 requests.
     * The iControl LX framework calls this method when
     * onStart() work is complete.
     *
     * @public
     * @param {function} success - callback to indicate successful startup
     * @param {function} failure - callback to indicate startup failure
     * @param {object} [state=undefined] - NOT USED: previously-persisted state
     * @param {string} [errMsg=null] - framework's error message if onStart() failed
     * @returns {undefined}
     */
    onStartCompleted(success, failure, loadedState, errMsg, initialHostContext) {
        const hostContext = new HostContext(initialHostContext);

        if ((typeof errMsg === 'string') && (errMsg !== '')) {
            failure(log.error(`onStartCompleted(): framework error =${errMsg}`));
            return;
        }
        hostContext.get()
            .then((context) => {
                this.hostContext = context;
                this.asyncHandler = this.hostContext.asyncHandler;
                this.asyncHandler.updatePending();
            })
            .then(() => {
                const storage = new atgStorage.StorageDataGroup('/Common/appsvcs/accessProfiles');
                return storage.ensureDataGroup();
            })
            .then(() => success())
            .catch((e) => {
                failure(log.error(`Failed to complete startup. ${e.stack}`));
            });
    } // onStartCompleted()

    sendResponse(restOperation, statusCode, message, body) {
        const result = restUtil.buildOpResult(statusCode, message, body);
        restUtil.completeRequest(restOperation, result);
    }

    /**
     * Handle HTTP methods
     * @param {object} restOperation
     * @returns {void}
     */
    onGet(restOperation) {
        this.onPost(restOperation);
    }

    onDelete(restOperation) {
        this.onPost(restOperation);
    }

    onPatch(restOperation) {
        this.onPost(restOperation);
    }

    onPost(restOperation) {
        Config.reloadSettings()
            .then(() => RequestContext.get(restOperation, this.hostContext))
            .then((reqContext) => {
                if (reqContext.error) {
                    this.sendResponse(restOperation, reqContext.errorCode, reqContext.error);
                } else {
                    // Create the initial context object
                    const context = Context.build(
                        this.hostContext,
                        reqContext.request,
                        {},
                        reqContext.tasks
                    );
                    this.continuePost(context, restOperation);
                }
            });
    }

    continuePost(context, restOperation) {
        let result = {};

        this.asyncHandler.cleanRecords(context);

        return Promise.resolve()
            .then(() => {
                switch (context.request.pathName) {
                case 'declare':
                    try {
                        this.declareHandler.process(context, restOperation);
                    } catch (ex) {
                        log.error(`Unhandled exception while processing declaration: ${ex.message} ${ex.stack}`);
                    }
                    break;
                case 'info':
                    result = restUtil.buildOpResult(
                        restUtil.STATUS_CODES.OK,
                        undefined,
                        this.hostContext.as3VersionInfo
                    );
                    restUtil.completeRequest(restOperation, result);
                    break;
                case 'task':
                    this.asyncHandler.getAsyncResponse(restOperation);
                    break;
                case 'settings':
                    SettingsHandler.process(context, restOperation);
                    break;
                default:
                    result = restUtil.buildOpResult(
                        restUtil.STATUS_CODES.BAD_REQUEST,
                        `${restOperation.getUri().href}: Bad Request`
                    );
                    restUtil.completeRequest(restOperation, result);
                    break;
                }
                return Promise.resolve();
            });
    }
}

module.exports = RestWorker;

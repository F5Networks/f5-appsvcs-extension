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

// eslint-disable-next-line import/no-extraneous-dependencies
const express = require('express'); // express is installed in the container

const config = require('./config');
const RestOperation = require('./restOperation');

const RestWorker = require('../nodejs/restWorker');

const restWorker = new RestWorker();

function setupRoutes(app) {
    app.get('/shared/appsvcs/*', (req, res) => {
        try {
            const restOperation = new RestOperation(req, res);
            restWorker.onGet(restOperation);
        } catch (err) {
            res.send(err);
        }
    });

    app.post('/shared/appsvcs/*', (req, res) => {
        try {
            const restOperation = new RestOperation(req, res);
            restWorker.onPost(restOperation);
        } catch (err) {
            res.send(err);
        }
    });
}

function start() {
    const app = express();
    app.use(express.json());

    function onSuccess() {
        setupRoutes(app);
    }

    function onFailure(data) {
        // eslint-disable-next-line no-console
        console.log(`Unable to start f5-appsvcs: ${JSON.stringify(data)}`);
    }

    restWorker.onStartCompleted(onSuccess, onFailure, null, null, config.initialHostContext);
    return app;
}

module.exports = { start };

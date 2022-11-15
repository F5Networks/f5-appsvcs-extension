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

const newman = require('newman');
const path = require('path');
const fs = require('fs');
const logger = require('./Logger');

const DEFAULT_OPTIONS = {
    insecure: true,
    delayRequest: 1000,
    timeout: 600000
};

function createNewmanCallback(callback) {
    return (error, summary) => {
        if (error) {
            callback(error);
            return;
        }
        const failures = summary.run.failures;
        if (failures.length > 0) {
            const errors = failures
                .map((failure) => {
                    const name = failure.source.name;
                    const message = failure.error.message;
                    return `${name}: ${message}`;
                })
                .join('\n');
            callback(new Error(errors));
            return;
        }

        callback();
    };
}

function generateNewmanGlobals(_variables) {
    const variables = Object.assign({
        host: process.env.AS3_HOST,
        username: process.env.AS3_USERNAME,
        password: process.env.AS3_PASSWORD,
        forge_p12: `https://${process.env.TEST_RESOURCES_URL}/certs/forge_p12.p12`,
        policy_12_0: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/wordpress_template_12.0.xml`,
        policy_12_1: `https://${process.env.TEST_RESOURCES_URL}/asm-policy/sharepoint_template_12.1.xml`
    }, _variables);
    const globals = {
        id: 'globals',
        name: 'Postman Globals',
        values: Object.keys(variables)
            .map((key) => ({
                key,
                value: variables[key],
                enabled: true,
                type: 'text'
            }))
    };
    return globals;
}

function runNewman(collection, options, callback) {
    try {
        fs.unlinkSync(path.join(__dirname, `../../test/logs/${collection.info.name}.log`));
    } catch (err) {
        // the file was not found
    }
    logger.remove(logger.transports[1]);
    logger.addTransport(path.join(__dirname, `../../test/logs/${collection.info.name}.log`));
    logger.transports[1].level = process.env.FILE_VERBOSITY || 'verbose';

    if (process.env.CONSOLE_VERBOSITY && process.env.CONSOLE_VERBOSITY !== '') {
        logger.transports[0].level = process.env.CONSOLE_VERBOSITY;
    } else {
        logger.transports[0].silent = true;
    }

    const runner = newman.run({
        collection,
        globals: options.globals || generateNewmanGlobals(),
        insecure: options.insecure || DEFAULT_OPTIONS.insecure,
        delayRequest: options.delayRequest || DEFAULT_OPTIONS.delayRequest,
        timeout: options.timeout || DEFAULT_OPTIONS.timeout
    }, createNewmanCallback(callback));

    runner.on('start', () => {
        logger.info(`Running Collection: ${collection.info.name}`);
    });

    runner.on('beforeItem', (err, obj) => {
        logger.info(`Running Item: ${obj.item.name}`);
    });

    runner.on('beforeRequest', (err, obj) => {
        logger.info(`Request: \n${obj.request.method} ${obj.request.url}`);
        if (obj.request.body.raw) {
            logger.verbose(`Body: \n${obj.request.body.raw}`);
        }
    });

    runner.on('request', (err, obj) => {
        if (err) {
            err.message = `Error recieved in a request: ${err.message}`;
            throw err;
        }

        let response = obj.response;
        if (obj.response && obj.response.stream) {
            response = obj.response.stream;
        }
        try {
            response = JSON.parse(response);
        } catch (e) {
            logger.verbose(`Unable to parse response stream: ${e}`);
            if (response) {
                response = response.toString(); // Convert string or buffer to string
            } else {
                e.message += `Unable to retrieve response stream from request object: ${JSON.stringify(obj)}`;
                throw e;
            }
        }
        logger.info(`Response: \n${JSON.stringify(response.results || response, null, 3)}`);
    });

    runner.on('assertion', (err, obj) => {
        if (err || obj.error) {
            logger.error(`Request Encountered a Test Assertion: \n${JSON.stringify(obj.error.message, null, 3)}`);
        }
    });
    runner.on('console', (err, obj) => {
        logger.info(`Test Log: \n${JSON.stringify(obj.messages, null, 3)}`);
    });
    runner.on('done', () => {
        logger.info(`Completed Running Collection: ${collection.info.name}`);
    });
}

module.exports = {
    createNewmanCallback,
    generateNewmanGlobals,
    runNewman,
    DEFAULT_OPTIONS
};

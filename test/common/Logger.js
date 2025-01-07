/**
 * Copyright 2025 F5, Inc.
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

/**
 * Copyright (c) 2013-2017, F5 Networks, Inc. All rights reserved.
 * No part of this software may be reproduced or transmitted in any
 * form or by any means, electronic or mechanical, for any purpose,
 * without express written permission of F5 Networks, Inc.
 */

/**
 * Based on the Winston logger
 * Returns a singleton logger
 * Local logs are stored to /var/log/appconn.log (default)
 * The format each log entry is : Timestamp Level Message
 * file log levels are :
 *   { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
 * syslog log levels are :
 *   { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7}
 *
 * Syslog transports are also supported.
 */

const mkdirp = require('mkdirp');
const winston = require('winston');
const path = require('path');

const DEFAULT_LOG = path.join(__dirname, '../../test/logs/as3.log');
const LOG_LEVEL = 'info';

function SingletonLogger() {
    //  this.logger = new winston.Logger({
    this.logger = winston.createLogger({
        level: LOG_LEVEL,
        format: winston.format.simple(),
        json: false,
        transports: [
            new winston.transports.Console({
                name: 'console_log',
                level: 'info',
                timestamp() {
                    const d = new Date();
                    return d.toUTCString(Date.now());
                },
                formatter(options) {
                    return `${options.timestamp()} ${options.level.toUpperCase()} ${
                        options.message ? options.message : ''
                    }${options.meta && Object.keys(options.meta).length ? `\n\t${
                        JSON.stringify(options.meta)}` : ''}`;
                }
            }),
            new (winston.transports.File)({
                name: 'file_log',
                filename: `${DEFAULT_LOG}`,
                level: 'info',
                json: false,
                maxFiles: 3,
                maxsize: 10000000,
                timestamp() {
                    const d = new Date();
                    return d.toUTCString(Date.now());
                },
                formatter(options) {
                    return `${options.timestamp()} ${options.level.toUpperCase()} ${
                        options.message ? options.message : ''
                    }${options.meta && Object.keys(options.meta).length ? `\n\t${
                        JSON.stringify(options.meta)}` : ''}`;
                }
            })
        ]
    });

    this.logger.replaceFileTransport = function (newLogger) {
        this.logger = newLogger;
    };

    this.logger.addTransport = function (fileName) {
        mkdirp.sync(fileName.substring(0, fileName.lastIndexOf('/')));
        this.add(new winston.transports.File({
            name: 'file_log',
            filename: fileName,
            level: 'info',
            json: false,
            maxFiles: 3,
            maxsize: 10000000,
            //      handleExceptions: true,
            //      humanReadableUnhandledException: true,
            timestamp() {
                const d = new Date();
                return d.toUTCString(Date.now());
            },
            formatter(options) {
                return `${options.timestamp()} ${options.level.toUpperCase()} ${
                    options.message ? options.message : ''
                }${options.meta && Object.keys(options.meta).length ? `\n\t${
                    JSON.stringify(options.meta)}` : ''}`;
            }
        }));
    };
    return this.logger;
}

let log;
const Logger = (function () {
    if (!log) {
        log = new SingletonLogger();
    }
    return log;
}());

module.exports = Logger;

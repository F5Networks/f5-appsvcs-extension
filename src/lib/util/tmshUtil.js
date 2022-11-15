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

const util = require('./util');
const Context = require('../context/context');

function generateAddFolderCommand(path) {
    return {
        path,
        tmshPath: '/mgmt/tm/sys/folder/',
        command: 'create',
        data: {
            name: path.split('/').pop(),
            fullPath: path
        }
    };
}

function generateAddDataGroupCommand(path) {
    return {
        path,
        tmshPath: '/mgmt/tm/ltm/data-group/internal/',
        command: 'create',
        data: {
            name: path,
            type: 'string'
        }
    };
}

function generateUpdateDataGroupCommand(path, records) {
    const tmshRecords = [];
    records.forEach((record) => {
        tmshRecords.push({
            name: record.name,
            data: record.data
        });
    });
    return {
        path,
        tmshPath: '/mgmt/tm/ltm/data-group/internal/',
        command: 'modify',
        data: {
            records: tmshRecords
        }
    };
}

function generateReadDataGroupCommand(path) {
    return {
        path,
        tmshPath: '/mgmt/tm/ltm/data-group/internal/',
        command: 'list'
    };
}

function generateListFolderCommand(path) {
    return {
        path,
        tmshPath: '/mgmt/tm/sys/folder/',
        command: 'list'
    };
}

function generateListDataGroupCommand(path) {
    return {
        path,
        tmshPath: '/mgmt/tm/ltm/data-group/internal/',
        command: 'list'
    };
}

function executeCommand(command) {
    const requestContext = {
        basicAuth: `Basic ${util.base64Encode('admin:')}`
    };
    const context = Context.build(undefined, requestContext, undefined, [{ protocol: 'http', urlPrefix: 'http://localhost:8100' }]);
    const options = {
        ctype: 'application/json',
        crude: true
    };

    if (command.command === 'list') {
        options.method = 'GET';
        options.path = `${command.tmshPath}${command.path.replace(/\//g, '~')}`;
    } else if (command.command === 'create') {
        options.method = 'POST';
        options.path = `${command.tmshPath}`;
        options.send = JSON.stringify(command.data);
    } else {
        options.method = 'PATCH';
        options.path = `${command.tmshPath}${command.path.replace(/\//g, '~')}`;
        options.send = JSON.stringify(command.data);
    }

    return util.iControlRequest(context, options)
        .then((result) => {
            if (result.statusCode >= 400) {
                const error = new Error();
                error.message = result.body.toString();
                error.code = result.statusCode;
                throw error;
            }
            return JSON.parse(result.body);
        });
}

function addFolder(path) {
    return executeCommand(generateAddFolderCommand(path));
}

function addDataGroup(path) {
    return executeCommand(generateAddDataGroupCommand(path));
}

function updateDataGroup(path, records) {
    return executeCommand(generateUpdateDataGroupCommand(path, records));
}

function readDataGroup(path) {
    return executeCommand(generateReadDataGroupCommand(path));
}

function itemExists(command) {
    return executeCommand(command)
        .then(() => true)
        .catch((err) => {
            if (err && err.code === 404) {
                return false;
            }
            throw err;
        });
}

function folderExists(path) {
    return itemExists(generateListFolderCommand(path));
}

function dataGroupExists(path) {
    return itemExists(generateListDataGroupCommand(path));
}

module.exports = {
    generateAddFolderCommand,
    generateAddDataGroupCommand,
    generateUpdateDataGroupCommand,
    generateReadDataGroupCommand,
    executeCommand,
    addFolder,
    addDataGroup,
    updateDataGroup,
    readDataGroup,
    folderExists,
    dataGroupExists
};

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

const childProcess = require('child_process');
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

function getPrimaryAdminUser() {
    return executeTmshCommand('list sys db systemauth.primaryadminuser')
        .then((result) => {
            if (!result || !result.value) {
                return Promise.reject(new Error('Unable to get primary admin user'));
            }
            const adminUser = result.value.replace(/"/g, '');
            return Promise.resolve(adminUser);
        });
}

function executeCommand(context, command) {
    const adminUser = util.getDeepValue(context, 'host.adminUser');
    const basicAuth = `Basic ${util.base64Encode(`${adminUser}:`)}`;
    const tempRequestContext = { basicAuth };
    const tempContext = Context.build(undefined, tempRequestContext, undefined, [{ protocol: 'http', urlPrefix: 'http://localhost:8100' }]);

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

    return util.iControlRequest(tempContext, options)
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

function parseTmshResponse(response) {
    const keyVals = response.split(/\s+/);
    const result = {};

    // find the parts inside the {}
    const openingBraceIndex = keyVals.indexOf('{');
    const closingBraceIndex = keyVals.lastIndexOf('}');

    for (let i = openingBraceIndex + 1; i < closingBraceIndex - 1; i += 2) {
        result[keyVals[i]] = keyVals[i + 1];
    }

    return result;
}

function executeTmshCommand(command, flags) {
    return new Promise((resolve, reject) => {
        const commandName = '/bin/tmsh';
        const commandArgs = (flags || ['-a']).concat(command.split(' '));
        let result = '';
        let error = '';
        const cp = childProcess.spawn(commandName, commandArgs, { shell: '/bin/bash' });

        cp.stdout.on('data', (data) => {
            result += data;
        });

        cp.stderr.on('data', (data) => {
            error += data;
        });

        cp.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(error));
            }

            resolve(parseTmshResponse(result));
        });
    });
}

function addFolder(context, path) {
    return executeCommand(context, generateAddFolderCommand(path));
}

function addDataGroup(context, path) {
    return executeCommand(context, generateAddDataGroupCommand(path));
}

function updateDataGroup(context, path, records) {
    return executeCommand(context, generateUpdateDataGroupCommand(path, records));
}

function readDataGroup(context, path) {
    return executeCommand(context, generateReadDataGroupCommand(path));
}

function itemExists(context, command) {
    return executeCommand(context, command)
        .then(() => true)
        .catch((err) => {
            if (err && err.code === 404) {
                return false;
            }
            throw err;
        });
}

function folderExists(context, path) {
    return itemExists(context, generateListFolderCommand(path));
}

function dataGroupExists(context, path) {
    return itemExists(context, generateListDataGroupCommand(path));
}

module.exports = {
    generateAddFolderCommand,
    generateAddDataGroupCommand,
    generateUpdateDataGroupCommand,
    generateReadDataGroupCommand,
    getPrimaryAdminUser,
    executeCommand,
    executeTmshCommand,
    addFolder,
    addDataGroup,
    updateDataGroup,
    readDataGroup,
    folderExists,
    dataGroupExists
};

/**
 * Copyright 2023 F5, Inc.
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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

chai.use(chaiAsPromised);
const assert = chai.assert;

const DataGroupDataStore = require('../../../src/lib/DataGroupDataStore');
const TmshUtil = require('../../../src/lib/util/tmshUtil');

describe('DataGroupDataStore', () => {
    let records;
    beforeEach(() => {
        records = undefined;
        sinon.stub(TmshUtil, 'folderExists').resolves(false);
        sinon.stub(TmshUtil, 'dataGroupExists').resolves(false);
        sinon.stub(TmshUtil, 'addFolder').resolves();
        sinon.stub(TmshUtil, 'addDataGroup').resolves();
        sinon.stub(TmshUtil, 'readDataGroup').callsFake(() => Promise.resolve({ records }));
        sinon.stub(TmshUtil, 'updateDataGroup').callsFake((context, _, _records) => {
            records = _records;
            return Promise.resolve();
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should save/load a record', () => {
        const record = {
            key: 'value',
            meta: ['d', 'a', 't', 'a']
        };
        records = undefined;
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return Promise.resolve()
            .then(() => dataStore.save('record', record))
            .then(() => dataStore.load('record'))
            .then((result) => {
                assert.deepEqual(result, record);
            });
    });

    it('should override existing records', () => {
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return Promise.resolve()
            .then(() => dataStore.save('one-fish', 'two fish'))
            .then(() => dataStore.save('red-fish', 'blue fish'))
            .then(() => {
                const recordNames = records.map((r) => r.name);
                assert.deepEqual(recordNames, ['red-fish0']);
            });
    });

    it('should reject if the record does not exist', () => {
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return assert.isRejected(dataStore.load('waldo'), 'The record waldo was not found');
    });

    it('should not reject if data group or folder already exists', () => {
        TmshUtil.folderExists.restore();
        sinon.stub(TmshUtil, 'folderExists').resolves(true);
        TmshUtil.dataGroupExists.restore();
        sinon.stub(TmshUtil, 'dataGroupExists').resolves(true);
        TmshUtil.addDataGroup.restore();
        sinon.stub(TmshUtil, 'addDataGroup').rejects(new Error('data-group already exists'));
        TmshUtil.addFolder.restore();
        sinon.stub(TmshUtil, 'addFolder').rejects(new Error('folder already exists'));

        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return assert.isFulfilled(dataStore.save('name', 'value'));
    });

    it('should reject if the data group cannot be created', () => {
        TmshUtil.addDataGroup.restore();
        const message = 'Apocalypse in progress';
        sinon.stub(TmshUtil, 'addDataGroup').rejects(new Error(message));

        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return assert.isRejected(dataStore.save('name', 'value'), message);
    });

    it('should not add folder if it exists', () => {
        TmshUtil.folderExists.restore();
        sinon.stub(TmshUtil, 'folderExists').resolves(true);
        TmshUtil.addFolder.restore();
        const addFolderSpy = sinon.stub(TmshUtil, 'addFolder').resolves();
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return dataStore.ensureFolder()
            .then(() => {
                assert(addFolderSpy.notCalled);
            });
    });

    it('should add folder if it does not exist', () => {
        TmshUtil.addFolder.restore();
        const addFolderSpy = sinon.stub(TmshUtil, 'addFolder').resolves();
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return dataStore.ensureFolder()
            .then(() => {
                assert(addFolderSpy.calledOnce);
            });
    });

    it('should not add data group if it exists', () => {
        TmshUtil.dataGroupExists.restore();
        sinon.stub(TmshUtil, 'dataGroupExists').resolves(true);
        TmshUtil.addDataGroup.restore();
        const addDataGroupSpy = sinon.stub(TmshUtil, 'addDataGroup').resolves();
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return dataStore.ensureFolder()
            .then(() => {
                assert(addDataGroupSpy.notCalled);
            });
    });

    it('should add data group if it does not exist', () => {
        TmshUtil.addDataGroup.restore();
        const addDataGroupSpy = sinon.stub(TmshUtil, 'addDataGroup').resolves();
        const dataStore = new DataGroupDataStore(null, 'dataStore');
        return dataStore.ensureDataGroup()
            .then(() => {
                assert(addDataGroupSpy.calledOnce);
            });
    });
});

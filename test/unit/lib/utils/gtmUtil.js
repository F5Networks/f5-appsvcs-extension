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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const Context = require('../../../../src/lib/context/context');
const gtmUtil = require('../../../../src/lib/util/gtmUtil');
const util = require('../../../../src/lib/util/util');

describe('gtmUtil', () => {
    let context;
    let emptyDecl;
    let hasTopologyInCommon;
    let hasTopologyInNotCommon;

    beforeEach(() => {
        context = Context.build();
        context.target.tmosVersion = '0.0.0';
        context.currentIndex = 0;
        context.tasks = [{}];

        emptyDecl = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            id: '1706822840529',
            updateMode: 'complete',
            controls: {
                archiveTimestamp: '2024-02-01T21:27:21.048Z'
            }
        };

        const gslbTopologyRecords = {
            class: 'GSLB_Topology_Records',
            property: 'property'
        };

        const baseDecl = {
            class: 'ADC',
            controls: {
                class: 'Controls'
            },
            id: 'id',
            label: 'label',
            remark: 'remark',
            schemaVersion: '3.47.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    TestDC: {
                        class: 'GSLB_Data_Center',
                        property: 'property'
                    }
                }
            },
            NotCommon: {
                class: 'Tenant',
                Application: {
                    class: 'Application',
                    property: 'property'
                },
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    GLB_serviceAddress: {
                        class: 'Service_Address',
                        virtualAddress: '0.0.0.0/0'
                    }
                }
            }
        };

        hasTopologyInCommon = util.simpleCopy(baseDecl);
        hasTopologyInCommon.Common.Shared.TopologyRecords = gslbTopologyRecords;

        hasTopologyInNotCommon = util.simpleCopy(baseDecl);
        hasTopologyInNotCommon.NotCommon.Shared.TopologyRecords = gslbTopologyRecords;
    });

    describe('.getTopologyRecordsTenant', () => {
        it('should handle empty declarations', () => {
            const decl = util.simpleCopy(emptyDecl);
            const previousDecl = util.simpleCopy(emptyDecl);

            gtmUtil.getTopologyRecordsTenant(context, decl, previousDecl);
            assert.strictEqual(context.tasks[context.currentIndex].gslbTopologyRecordsTenant, undefined);
        });

        it('should handle undefined declarations', () => {
            gtmUtil.getTopologyRecordsTenant(context, undefined, undefined);
            assert.strictEqual(context.tasks[context.currentIndex].gslbTopologyRecordsTenant, undefined);
        });

        it('should find in current declaration', () => {
            const decl = util.shallowCopy(hasTopologyInCommon);
            const previousDecl = util.simpleCopy(emptyDecl);

            gtmUtil.getTopologyRecordsTenant(context, decl, previousDecl);
            assert.strictEqual(context.tasks[context.currentIndex].gslbTopologyRecordsTenant, 'Common');
        });

        it('should find in previous declaration', () => {
            const decl = util.simpleCopy(emptyDecl);
            const previousDecl = util.shallowCopy(hasTopologyInNotCommon);

            gtmUtil.getTopologyRecordsTenant(context, decl, previousDecl);
            assert.strictEqual(context.tasks[context.currentIndex].gslbTopologyRecordsTenant, 'NotCommon');
        });
    });

    describe('.parseTopologyItem', () => {
        it('should error if undefined is provided', () => Promise.resolve()
            .then(() => gtmUtil.parseTopologyItem())
            .then(() => assert.fail('This util should have errored if undefined'))
            .catch((err) => {
                assert.match(
                    err.message,
                    /Cannot read propert(y 'indexOf' of undefined|ies of undefined \(reading 'indexOf'\))/
                );
            }));

        it('should return an object with empty values if an empty string is sent in', () => assert.deepStrictEqual(
            gtmUtil.parseTopologyItem(''),
            {
                '': '',
                type: '',
                value: '',
                not: '',
                name: ' '
            }
        ));

        it('should return an object with the provided string', () => assert.deepStrictEqual(
            gtmUtil.parseTopologyItem('notfoo'),
            {
                '': 'notfoo',
                type: '',
                value: 'notfoo',
                not: '',
                name: ' notfoo'
            }
        ));

        it('should return an object with the provided string and parsed not', () => assert.deepStrictEqual(
            gtmUtil.parseTopologyItem('not foo'),
            {
                '': 'foo',
                type: '',
                value: 'foo',
                not: 'not',
                name: 'not  foo'
            }
        ));

        it('should return an object with the provided string and parsed out /Common/', () => assert.deepStrictEqual(
            gtmUtil.parseTopologyItem('isp /Common/foo'),
            {
                isp: 'foo',
                type: 'isp',
                value: 'foo',
                not: '',
                name: 'isp foo'
            }
        ));

        it('should return an object with the provided string and parsed out state', () => assert.deepStrictEqual(
            gtmUtil.parseTopologyItem('state /Common/foo'),
            {
                state: '"/Common/foo"',
                type: 'state',
                value: '"/Common/foo"',
                not: '',
                name: 'state "/Common/foo"'
            }
        ));

        it('should return an object with the provided string and parsed out geoip-isp', () => assert.deepStrictEqual(
            gtmUtil.parseTopologyItem('geoip-isp /Common/foo'),
            {
                'geoip-isp': '"/Common/foo"',
                type: 'geoip-isp',
                value: '"/Common/foo"',
                not: '',
                name: 'geoip-isp "/Common/foo"'
            }
        ));
    });
});

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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const gtmUtil = require('../../../../src/lib/util/gtmUtil');

describe('gtmUtil', () => {
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

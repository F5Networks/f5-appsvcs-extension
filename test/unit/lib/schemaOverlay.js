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

const chai = require('chai');
const nock = require('nock');

const assert = chai.assert;
const schemaOverlay = require('../../../src/lib/schemaOverlay');
const Context = require('../../../src/lib/context/context');
const DEVICE_TYPES = require('../../../src/lib/constants').DEVICE_TYPES;

describe('schemaOverlay', () => {
    const getNoOverlayDec = () => ({
        noTenantClass: {},
        wrongTenantClass: { class: 'OtherClass' },
        noAppClass: { class: 'Tenant', foo: undefined },
        wrongAppClass: { class: 'Tenant', app: { class: 'OtherClass' } }
    });

    const getOverlayDec = () => ({
        noTenantClass: {},
        wrongTenantClass: { class: 'OtherClass' },
        tenant1: {
            class: 'Tenant',
            app: {
                class: 'Application'
            }
        },
        tenant2: {
            class: 'Tenant',
            app: {
                class: 'Application',
                schemaOverlay: 'custom'
            }
        }
    });

    let context;

    beforeEach(() => {
        context = Context.build();
        context.target.deviceType = DEVICE_TYPES.BIG_IQ;
        context.tasks = [{ urlPrefix: 'http://localhost:8100' }];
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('.applyOverlay', () => {
        it('should return declaration if not running on BIG-IQ', () => {
            context.target.deviceType = DEVICE_TYPES.BIG_IP;
            return schemaOverlay.applyOverlay(context, getNoOverlayDec())
                .then((result) => {
                    assert.deepStrictEqual(result, getNoOverlayDec());
                });
        });

        it('should return declaration if no schema overlays are necessary', () => schemaOverlay
            .applyOverlay(context, getNoOverlayDec())
            .then((result) => {
                assert.deepStrictEqual(result, getNoOverlayDec());
            }));

        it('should return declaration with applied schema overlays', () => {
            const schema = {
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object'
            };

            nock('http://localhost:8100')
                .get('/mgmt/cm/global/appsvcs-templates')
                .reply(200, {
                    items: [
                        {
                            name: 'default',
                            schemaOverlay: schema
                        },
                        {
                            name: 'custom',
                            schemaOverlay: schema
                        }
                    ]
                });

            const expected = getOverlayDec();
            expected.tenant1.app.schemaOverlay = 'default';

            return schemaOverlay.applyOverlay(context, getOverlayDec())
                .then((result) => {
                    assert.deepStrictEqual(result, expected);
                });
        });

        it('should error if could not parse response from catalog', () => {
            nock('http://localhost:8100')
                .get('/mgmt/cm/global/appsvcs-templates')
                .reply(200, {
                    items: [null]
                });

            return schemaOverlay.applyOverlay(context, getOverlayDec())
                .catch((err) => {
                    assert.match(
                        err.message,
                        /could not parse response from service catalog \(Cannot read propert(y 'name' of null\)|ies of null \(reading 'name'\))/
                    );
                });
        });

        it('should error if schema overlay validation fails', () => {
            nock('http://localhost:8100')
                .get('/mgmt/cm/global/appsvcs-templates')
                .reply(200, {
                    items: []
                });

            return schemaOverlay.applyOverlay(context, getOverlayDec())
                .catch((err) => {
                    assert.strictEqual(
                        err.message,
                        'declaration is invalid according to provided schema overlay: data should NOT have additional properties'
                    );
                });
        });
    });
});

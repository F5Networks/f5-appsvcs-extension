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

const assert = require('assert');
const Ajv = require('ajv');

const ajv = new Ajv(
    {
        allErrors: false,
        useDefaults: true,
        extendRefs: 'fail'
    }
);
const adcSchema = require('../../../src/schema/latest/adc-schema.json');
const formats = require('../../../src/lib/adcParserFormats');

formats.forEach((customFormat) => {
    ajv.addFormat(customFormat.name, customFormat.check);
});

const validate = ajv
    .compile(adcSchema);

describe('def-dns-schema.json', () => {
    describe('DNS_Cache', () => {
        describe('.localZones', () => {
            function testValue(value, expected) {
                const data = {
                    class: 'ADC',
                    schemaVersion: '3.0.0',
                    id: '',
                    tenant: {
                        class: 'Tenant',
                        application: {
                            class: 'Application',
                            template: 'generic',
                            test: {
                                class: 'DNS_Cache',
                                type: 'transparent',
                                localZones: value
                            }
                        }
                    }
                };

                assert.strictEqual(
                    validate(data),
                    expected,
                    JSON.stringify(validate.errors, null, 2)
                );
            }

            it('should allow SRV record', () => testValue(
                {
                    '_sip._tcp.example.com': {
                        type: 'transparent',
                        records: [
                            '_sip._tcp.example.com 86400 IN SRV 0 5 5060 sipserver.example.com'
                        ]
                    }
                },
                true
            ));
        });
    });

    describe('DNS_Logging_Profile', () => {
        let decl;

        beforeEach(() => {
            decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: '',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        test: {
                            class: 'DNS_Logging_Profile',
                            logPublisher: { use: 'somePublisher' }
                        }
                    }
                }
            };
        });

        it('should validate with minimum values', () => {
            assert.strictEqual(validate(decl), true, JSON.stringify(validate.errors, null, 4));
        });

        it('should validate with all fields populated', () => {
            Object.assign(decl.tenant.application.test, {
                label: 'sample label',
                remark: 'sample remark',
                includeCompleteAnswer: false,
                includeQueryId: true,
                includeSource: false,
                includeTimestamp: false,
                includeView: false,
                logQueriesEnabled: false,
                logResponsesEnabled: true
            });

            assert.strictEqual(validate(decl), true, JSON.stringify(validate.errors, null, 4));
        });
    });

    describe('DNS_Cache_Resolver', () => {
        let decl;

        beforeEach(() => {
            decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: '',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        test: {
                            class: 'DNS_Cache',
                            type: 'resolver',
                            allowedQueryTime: 201,
                            answerDefaultZones: false,
                            messageCacheSize: 1048575,
                            maxConcurrentQueries: 1025,
                            maxConcurrentTcp: 21,
                            maxConcurrentUdp: 8193,
                            msgCacheSize: 10485761,
                            nameserverCacheCount: 16531,
                            randomizeQueryNameCase: false,
                            rootHints: ['10.0.0.1'],
                            rrsetCacheSize: 10485761,
                            rrsetRotates: 'query-id',
                            unwantedQueryReplyThreshold: 1,
                            useIpv4: false,
                            useIpv6: true,
                            useTcp: false,
                            useUdp: true
                        }
                    }
                }
            };
        });

        it('should validate with minimum values', () => {
            assert.strictEqual(validate(decl), true, JSON.stringify(validate.errors, null, 4));
        });
    });

    describe('DNS_Cache_Validating_Resolver', () => {
        let decl;

        beforeEach(() => {
            decl = {
                class: 'ADC',
                schemaVersion: '3.0.0',
                id: '',
                tenant: {
                    class: 'Tenant',
                    application: {
                        class: 'Application',
                        template: 'generic',
                        test: {
                            class: 'DNS_Cache',
                            type: 'validating-resolver',
                            allowedQueryTime: 201,
                            answerDefaultZones: true,
                            dlvAnchors: ['mydomain.local'],
                            ignoreCd: true,
                            keyCacheSize: 1048577,
                            messageCacheSize: 1048577,
                            maxConcurrentQueries: 1025,
                            maxConcurrentTcp: 21,
                            maxConcurrentUdp: 8193,
                            msgCacheSize: 10485761,
                            nameserverCacheCount: 16537,
                            prefetchKey: false,
                            randomizeQueryNameCase: false,
                            rootHints: ['10.0.0.1'],
                            rrsetCacheSize: 10485761,
                            rrsetRotates: 'query-id',
                            trustAnchors: ['domain.local'],
                            unwantedQueryReplyThreshold: 1,
                            useIpv4: false,
                            useIpv6: true,
                            useTcp: false,
                            useUdp: true
                        }
                    }
                }
            };
        });

        it('should validate with minimum values', () => {
            assert.strictEqual(validate(decl), true, JSON.stringify(validate.errors, null, 4));
        });
    });
});

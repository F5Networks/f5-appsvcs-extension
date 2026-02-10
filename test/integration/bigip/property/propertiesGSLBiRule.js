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

const {
    assertClass,
    assertModuleProvisioned,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const iRules = {
    logDnsRequest: {
        base64: 'd2hlbiBETlNfUkVRVUVTVCB7CiAgICBsb2cgbG9jYWwyLiAiR1RNIGlydWxlOiBBIEROUyByZXF1ZXN0IHdhcyBzZWVuIGZvciBbRE5TOjpxdWVzdGlvbiBuYW1lXSBzZWVuIGZyb20gW0lQOjpjbGllbnRfYWRkcl0iCn0='
    },
    interceptDnsRequest: {
        base64: 'd2hlbiBETlNfUkVRVUVTVCB7CiAgICBzZXQgdHlwZQogICAgW0ROUzo6cXVlc3Rpb24gdHlwZV0gaWYgeyR0eXBlIGVxdWFscyAiQSIgfSB7CiAgICAgICAgc2V0IGhvc3QgW0ROUzo6cXVlc3Rpb24gbmFtZV0KICAgICAgICBpZiB7IFtjbGFzcyBtYXRjaCAkaG9zdCBlcXVhbHMgZG5zX0xpc3RfREcgXSB9IHsKICAgICAgICAgICAgRE5TOjphbnN3ZXIgY2xlYXIKICAgICAgICAgICAgRE5TOjphbnN3ZXIgaW5zZXJ0ICJbRE5TOjpxdWVzdGlvbiBuYW1lXS4gMTExIFtETlM6OnF1ZXN0aW9uIGNsYXNzXSBbRE5TOjpxdWVzdGlvbiB0eXBlXSBbY2xhc3MgbWF0Y2ggLXZhbHVlICRob3N0IGVxdWFscyBkbnNfTGlzdF9ERyBdIgogICAgICAgICAgICBETlM6OnJldHVybgogICAgICAgIH0KICAgIH0KfQ=='
    },
    withLeadingComment: {
        base64: 'IyB0aGlzIGlzIGEgbGVhZGluZyBjb21tZW50CndoZW4gRE5TX1JFUVVFU1QgewogICAgbG9nIGxvY2FsMi4gIkdUTSBpcnVsZTogQSBETlMgcmVxdWVzdCB3YXMgc2VlbiBmb3IgW0ROUzo6cXVlc3Rpb24gbmFtZV0gc2VlbiBmcm9tIFtJUDo6Y2xpZW50X2FkZHJdIgp9'
    }
};

const extractFunctions = {
    iRulePath(result) {
        return result.fullPath;
    },
    iRuleValue(result) {
        return JSON.stringify(result.apiAnonymous);
    }
};

const getPlainStringFromB64 = function (b64) {
    let str = Buffer.from(b64, 'base64').toString('ascii');
    // iControl strips some extra chars
    str = JSON.stringify(str.replace(/\r/g, '')
        .replace(/\n \n/g, '\n')
        .replace(/ \n/g, '\n'));
    return str;
};

describe('GSLB_iRule', function () {
    before(function () {
        assertModuleProvisioned.call(this, 'gtm');
    });

    this.timeout(GLOBAL_TIMEOUT);

    it('default - created under correct path', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.logDnsRequest],
                expectedValue: [`/TEST_GSLB_iRule/Application/${getItemName({ tenantName: 'TEST_GSLB_iRule' })}`],
                extractFunction: extractFunctions.iRulePath
            }
        ];

        return assertClass('GSLB_iRule', properties);
    });

    it('default - created with correct text value from base64', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.logDnsRequest],
                expectedValue: [getPlainStringFromB64(iRules.logDnsRequest.base64)],
                extractFunction: extractFunctions.iRuleValue
            }
        ];

        return assertClass('GSLB_iRule', properties);
    });

    it('created with correct text value from base64 with leading comment', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.withLeadingComment],
                expectedValue: [getPlainStringFromB64(iRules.withLeadingComment.base64)],
                extractFunction: extractFunctions.iRuleValue
            }
        ];

        return assertClass('GSLB_iRule', properties);
    });

    it('update', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.logDnsRequest, iRules.interceptDnsRequest],
                expectedValue: [getPlainStringFromB64(iRules.logDnsRequest.base64),
                    getPlainStringFromB64(iRules.interceptDnsRequest.base64)],
                extractFunction: extractFunctions.iRuleValue
            }
        ];

        return assertClass('GSLB_iRule', properties);
    });
});

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

const {
    assertClass,
    getItemName,
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

const iRules = {
    tftpLoadBalance: {
        base64: 'd2hlbiBTRVJWRVJfQ09OTkVDVEVEIHsNCiAgbGlzdGVuIHsNCiAgICBwcm90byAxNw0KICAgIHRpbWVvdXQgNjANCiAgICBiaW5kIFtMSU5LOjp2bGFuX2lkXSBbSVA6OmxvY2FsX2FkZHJdIFtzZXJ2ZXJzaWRlIHtVRFA6OmxvY2FsX3BvcnR9XQ0KICAgIHNlcnZlciBbcGVlciB7Y2xpZW50X2FkZHJ9XSBbcGVlciB7VURQOjpjbGllbnRfcG9ydH1dDQogICAgYWxsb3cgW0lQOjpzZXJ2ZXJfYWRkcl0NCiAgfQ0KfQ=='
    },
    htmlEncode: {
        base64: 'cHJvYyBodG1sX2VuY29kZSB7IHN0ciB9IHsNCiAgc2V0IGVuY29kZWQgIiINCiAgZm9yZWFjaCBjaGFyIFtzcGxpdCAkc3RyICIiXSB7DQogICAgc3dpdGNoICRjaGFyIHsNCiAgICAgICI8IiB7IGFwcGVuZCBlbmNvZGVkICImbHQ7IiB9DQogICAgICAiPiIgeyBhcHBlbmQgZW5jb2RlZCAiJmx0OyIgfQ0KICAgICAgIiciIHsgYXBwZW5kIGVuY29kZWQgIiZhcG9zOyIgfQ0KICAgICAgeyJ9IHsgYXBwZW5kIGVuY29kZWQgIiZxdW90OyIgfQ0KICAgICAgIiYiIHsgYXBwZW5kIGVuY29kZWQgIiZhbXA7IiB9DQogICAgICBkZWZhdWx0IHsgYXBwZW5kIGVuY29kZWQgJGNoYXIgfQ0KICAgIH0NCiAgfQ0KICByZXR1cm4gJGVuY29kZWQNCn0NCiANCiMgQ2FsbCB0aGUgcHJvY2VkdXJlIGZyb20gYW5vdGhlciBpUnVsZSB1c2luZyB0aGUgbmFtZSBvZiB0aGUgaVJ1bGUgd2hlcmUgdGhlIHByb2MgaXMgZGVmaW5lZCBhcyB0aGUgbmFtZXNwYWNlIGFuZCB0aGVuIHRoZSBuYW1lIG9mIHRoZSBwcm9jZWR1cmUgKGxpYnJhcnk6Omh0bWxfZW5jb2RlKTogDQogDQp3aGVuIFJVTEVfSU5JVCB7DQoJIyBpUnVsZSB0aGF0IGNhbGxzIHRoZSBodG1sX2VuY29kZSBwcm9jOg0KCXNldCByYXcge3NvbWUgeHNzOiA8IHNjcmlwdCA+YWxlcnQoZG9jdW1lbnQuY29va2llKTwvc2NyaXB0PiBhbmQgc3FsaTogJyBvciAxPT0xIyAifQ0KIA0KCWxvZyBsb2NhbDAuICJIVE1MIGVuY29kZWQ6IFtjYWxsIGxpYnJhcnk6Omh0bWxfZW5jb2RlICRyYXddIg0KIA0KCSMgTG9nIG91dHB1dA0KCSNIVE1MIGVuY29kZWQ6ICZsdDtzY3JpcHQmbHQ7YWxlcnQoZG9jdW1lbnQuY29va2llKSZsdDsvc2NyaXB0Jmx0OyBhbmQgc3FsaTogJmFwb3M7IG9yIDE9PTEjICZxdW90Ow0KfQ=='
    },
    serverSideSniInjection: {
        base64: 'd2hlbiBIVFRQX1JFUVVFU1Qgew0KCSNTZXQgdGhlIFNOSSB2YWx1ZSAoZS5nLiBIVFRQOjpob3N0KQ0KCXNldCBzbmlfdmFsdWUgW2dldGZpZWxkIFtIVFRQOjpob3N0XSAiOiIgMV0NCn0NCndoZW4gU0VSVkVSU1NMX0NMSUVOVEhFTExPX1NFTkQgew0KIA0KCSMgU05JIGV4dGVuc2lvbiByZWNvcmQgYXMgZGVmaW5lZCBpbiBSRkMgMzU0Ni8zLjENCgkjDQoJIyAtIFRMUyBFeHRlbnNpb24gVHlwZSAgICAgICAgICAgICAgICA9ICBpbnQxNiggMCA9IFNOSSApIA0KCSMgLSBUTFMgRXh0ZW5zaW9uIExlbmd0aCAgICAgICAgICAgICAgPSAgaW50MTYoICRzbmlfbGVuZ3RoICsgNSBieXRlICkNCgkjICAgIC0gU05JIFJlY29yZCBMZW5ndGggICAgICAgICAgICAgID0gIGludDE2KCAkc25pX2xlbmd0aCArIDMgYnl0ZSkNCgkjICAgICAgIC0gU05JIFJlY29yZCBUeXBlICAgICAgICAgICAgID0gICBpbnQ4KCAwID0gSE9TVCApDQoJIyAgICAgICAgICAtIFNOSSBSZWNvcmQgVmFsdWUgTGVuZ3RoICA9ICBpbnQxNiggJHNuaV9sZW5ndGggKQ0KCSMgICAgICAgICAgLSBTTkkgUmVjb3JkIFZhbHVlICAgICAgICAgPSAgICBzdHIoICRzbmlfdmFsdWUgKQ0KCSMNCiANCgkjIENhbGN1bGF0ZSB0aGUgbGVuZ3RoIG9mIHRoZSBTTkkgdmFsdWUsIENvbXB1dGUgdGhlIFNOSSBSZWNvcmQgLyBUTFMgZXh0ZW5zaW9uIGZpZWxkcyBhbmQgYWRkIHRoZSByZXN1bHQgdG8gdGhlIFNFUlZFUlNTTF9DTElFTlRIRUxMTyANCiANCglTU0w6OmV4dGVuc2lvbnMgaW5zZXJ0IFtiaW5hcnkgZm9ybWF0IFNTU2NTYSogMCBbZXhwciB7IFtzZXQgc25pX2xlbmd0aCBbc3RyaW5nIGxlbmd0aCAkc25pX3ZhbHVlXV0gKyA1IH1dIFtleHByIHsgJHNuaV9sZW5ndGggKyAzIH1dIDAgJHNuaV9sZW5ndGggJHNuaV92YWx1ZV0NCiANCn0='
    },
    withConstants: {
        base64: 'd2hlbiBTRVJWRVJfQ09OTkVDVEVECnsKIyBgYElgYCB1bmlxdWUgaWRlbnRpZmllciBvZiBkZWNsYXJhdGlvbgogIHNldCBpZCAiYElgIgojCiMgYGBGYGAgZmFtaWx5IG5hbWUKICBzZXQgZmFtaWx5ICJgRmAiCiMKIyBgYFRgYCBjdXJyZW50IFRlbmFudCBuYW1lCiAgc2V0IHRlbmFudCAiYFRgIgojCiMgYGBBYGAgY3VycmVudCBBcHBsaWNhdGlvbiBuYW1lCiAgc2V0IGFwcGxpY2F0aW9uICJgQWAiCiMKIyBgYFlgYCBhcHBsaWNhdGlvbiB0eXBlCiAgc2V0IGFwcGxpY2F0aW9uX3R5cGUgImBZYCIKIwojIGBgTWBgIG5hbWUgb2YgYmFzZSBwcm9wZXJ0eQogIHNldCBiYXNlX3Byb3BlcnR5ICJgTWAiCiMKIyBgYE5gYCBmdWxsIGJhc2UtcHJvcGVydHkgcGF0aG5hbWUKICBzZXQgYmFzZV9wcm9wZXJ0eV9wYXRobmFtZSAiYE5gIgojCiMgYGBPYGAgb2JqZWN0LW5hbWUgb2YgbmVhcmVzdCBhbmNlc3RvciBvZiBgYE1gYAogIHNldCBhbmNlc3Rvcl9vYmplY3RfbmFtZSAiYE9gIgojCiMgYGBQYGAgcGF0aCBvZiBgYE9gYAogIHNldCBhbmNlc3Rvcl9vYmplY3RfZGlyICJgUGAiCiMKIyBgYFFgYCBwYXRoIG9mIGBgT2BgIG1lbWJlcgogIHNldCBhbmNlc3Rvcl9vYmplY3RfZnVsbHBhdGggImBRYCIKIwojIGBgQ2BgIGNsYXNzIG5hbWUgb2YgYGBPYGAKICBzZXQgYW5jZXN0b3JfY2xhc3NfbmFtZSAiYENgIgojCiMKIyBDb25zdGFudCBSZWY6IGA9L1RFU1RfaVJ1bGUvQXBwbGljYXRpb24vY29uc3RhbnRzL3RyZWF0YAojCiMgQklHSVAgcGF0aDogYCovVEVTVF9pUnVsZS9BcHBsaWNhdGlvbi90ZXN0SXRlbWAK'
    },
    withLeadingComments: {
        base64: 'IyB0aGlzIGlzIGEgdGVzdCBjb21tZW50CndoZW4gSFRUUF9SRVFVRVNUIHsKICAgICAgICBIVFRQOjpoZWFkZXIgcmVwbGFjZSBYLVJlYWxtIHN0YW5kYXJkCn0='
    }
};

// TODO: add constants test - fix base64 value
// const constants = {
//     Application: {
//         class: 'Constants',
//         treat: 'marshmallow'
//     }
// };

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

describe('iRule', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('default - created under correct path', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.tftpLoadBalance],
                expectedValue: [`/TEST_iRule/Application/${getItemName({ tenantName: 'TEST_iRule' })}`],
                extractFunction: extractFunctions.iRulePath
            }
        ];

        return assertClass('iRule', properties);
    });

    it('default - created with correct text value from base64', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.tftpLoadBalance],
                expectedValue: [getPlainStringFromB64(iRules.tftpLoadBalance.base64)],
                extractFunction: extractFunctions.iRuleValue
            }
        ];

        return assertClass('iRule', properties);
    });

    it('created with correct text value from base64 with leading comments', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.withLeadingComments],
                expectedValue: [getPlainStringFromB64(iRules.withLeadingComments.base64)],
                extractFunction: extractFunctions.iRuleValue
            }
        ];

        return assertClass('iRule', properties);
    });

    it('update', () => {
        const properties = [
            {
                name: 'iRule',
                inputValue: [iRules.htmlEncode, iRules.serverSideSniInjection],
                expectedValue: [getPlainStringFromB64(iRules.htmlEncode.base64),
                    getPlainStringFromB64(iRules.serverSideSniInjection.base64)],
                extractFunction: extractFunctions.iRuleValue
            }
        ];

        return assertClass('iRule', properties);
    });
});

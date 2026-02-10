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
const sinon = require('sinon');

chai.use(chaiAsPromised);
const assert = chai.assert;

const secureVault = require('@f5devcentral/atg-shared-utilities').secureVault;
const authHeaderUtil = require('../../../../src/lib/util/authHeaderUtil');
const log = require('../../../../src/lib/log');

describe('getAuthHeader', () => {
    beforeEach(() => {
        sinon.stub(log, 'warning').returns(null);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return undefined if auth is undefined', () => assert.becomes(
        authHeaderUtil.getAuthHeader({}), undefined
    ));

    it('should return error if auth method is not implemented', () => assert.isRejected(
        authHeaderUtil.getAuthHeader({}, { method: 'badMethod' }),
        /unimplemented auth type=badMethod/
    ));

    it('should decrypt passphrase object and return basic auth header', () => {
        const auth = {
            method: 'basic',
            username: 'user',
            passphrase: {
                ciphertext: 'JE0keDgkbTZCUVNucytpem5hbkI1VmlzRUN4QT09',
                protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=',
                miniJWE: true
            }
        };

        sinon.stub(secureVault, 'decrypt').resolves('f5');

        context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

        return assert.becomes(
            authHeaderUtil.getAuthHeader(context, auth),
            { Authorization: 'Basic dXNlcjpmNQ==' }
        );
    });

    it('should decrypt passphrase string and return basic auth header', () => {
        const auth = {
            method: 'basic',
            username: 'user',
            passphrase: '$M$x8$m6BQSns+iznanB5VisECxA=='
        };

        sinon.stub(secureVault, 'decrypt').resolves('f5');

        context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

        return assert.becomes(
            authHeaderUtil.getAuthHeader(context, auth),
            { Authorization: 'Basic dXNlcjpmNQ==' }
        );
    });

    it('should decrypt token object and return bearer token header', () => {
        const auth = {
            method: 'bearer-token',
            token: {
                ciphertext: 'foo'
            }
        };

        sinon.stub(secureVault, 'decrypt').resolves('unencryptedToken');

        context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

        return assert.becomes(
            authHeaderUtil.getAuthHeader(context, auth),
            { Authorization: 'Bearer unencryptedToken' }
        );
    });

    it('should decrypt token string and return bearer token header', () => {
        const auth = {
            method: 'bearer-token',
            token: 'foo'
        };

        sinon.stub(secureVault, 'decrypt').resolves('unencryptedToken');

        context.tasks = [{ urlPrefix: 'https://localhost:8100' }];

        return assert.becomes(
            authHeaderUtil.getAuthHeader(context, auth),
            { Authorization: 'Bearer unencryptedToken' }
        );
    });
});

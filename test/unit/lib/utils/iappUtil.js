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

const nock = require('nock');
const sinon = require('sinon');
const fs = require('fs');
const assert = require('assert');
const Readable = require('stream').Readable;
const iappUtil = require('../../../../src/lib/util/iappUtil');
const Context = require('../../../../src/lib/context/context');

describe('iappUtil', () => {
    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    describe('copyToHost', () => {
        const CHUNK_SIZE = 1000000;
        const FILE_SIZE = 2500000;
        const NUM_UPLOAD_REQS = Math.ceil(FILE_SIZE / CHUNK_SIZE);
        const MOCK_RES_STATUS = {
            OK: 'OK',
            FAIL: 'FAIL',
            ERR: 'ERR'
        };
        let context;
        let deleteHeaders;
        let uploadHeaders;

        beforeEach(() => {
            sinon.stub(fs, 'statSync').returns({
                dev: 2049,
                mode: 33188,
                nlink: 1,
                uid: 1000,
                gid: 1000,
                rdev: 0,
                blksize: 4096,
                ino: 4496252,
                size: FILE_SIZE,
                blocks: 8,
                atimeMs: 1572624258290.0305,
                mtimeMs: 1571934212732.2761,
                ctimeMs: 1571934212732.2761,
                birthtimeMs: 1571934212732.2761,
                atime: new Date('2019-11-01T16:04:18.290Z'),
                mtime: new Date('2019-10-24T16:23:32.732Z'),
                ctime: new Date('2019-10-24T16:23:32.732Z'),
                birthtime: new Date('2019-10-24T16:23:32.732Z')
            });
            sinon.stub(fs, 'createReadStream').callsFake((path, opts) => {
                let size = 1500000;
                if (typeof opts.start !== 'undefined' && typeof opts.end !== 'undefined') {
                    size = opts.end - opts.start;
                }
                const buffer = Buffer.allocUnsafe(size);
                const stream = new Readable();
                stream.push(buffer);
                stream.push(null);
                return stream;
            });

            context = Context.build();
            context.target.tokens = { 'X-F5-Auth-Token': '123abc' };
            context.tasks[0] = { protocol: 'https' };
            context.control = { targetHost: 'localhost' };
            deleteHeaders = [];
            uploadHeaders = [];
        });

        const mockUpload = (hostname, options) => {
            const opts = Object.assign({ delete: MOCK_RES_STATUS.OK, upload: MOCK_RES_STATUS.OK }, options);
            const mockObj = {};

            Object.keys(opts).forEach((key) => {
                let mock;
                let headers;
                if (key === 'delete') {
                    headers = deleteHeaders;
                    mock = nock(hostname)
                        .delete('/mgmt/shared/file-transfer/uploads/foo.bar');
                } else if (key === 'upload') {
                    headers = uploadHeaders;
                    mock = nock(hostname)
                        .post('/mgmt/shared/file-transfer/uploads/foo.bar')
                        .times(NUM_UPLOAD_REQS);
                } else {
                    return;
                }

                if (opts[key] === MOCK_RES_STATUS.ERR) {
                    mock = mock.replyWithError(`connect ECONNREFUSED ${hostname}`);
                } else {
                    mock = mock.reply(function () {
                        headers.push(this.req.headers);
                        return [
                            opts[key] === MOCK_RES_STATUS.OK ? 200 : 400,
                            opts[key] === MOCK_RES_STATUS.OK ? {} : 'Invalid Request'
                        ];
                    });
                }

                mockObj[`${key}Mock`] = mock;
            });

            return mockObj;
        };

        it('should use https request module if not provided', (done) => {
            const uploadMock = mockUpload('https://localhost:8100').uploadMock;
            delete context.tasks[0].protocol;
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                if (err) {
                    assert.fail(err);
                }
                assert.ok(uploadMock.isDone(), 'Failed to upload all file chunks to https endpoint');
                done();
            });
        });

        it('should use specified request module if provided', (done) => {
            const uploadMock = mockUpload('http://localhost:8100').uploadMock;
            context.tasks[0] = { protocol: 'http' };
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                if (err) {
                    assert.fail(err);
                }
                assert.ok(uploadMock.isDone(), 'Failed to upload all file chunks to http endpoint');
                done();
            });
        });

        it('should use specified port if provided', (done) => {
            const uploadMock = mockUpload('https://localhost:8080').uploadMock;
            context.target = { port: 8080 };
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                if (err) {
                    assert.fail(err);
                }
                assert.ok(uploadMock.isDone(), 'Failed to upload all chunks to https endpoint on port 8080');
                done();
            });
        });

        it('should include tokens as headers if X-F5-Auth-Token is provided', (done) => {
            mockUpload('https://localhost:8100');
            context.target.tokens['X-Foo'] = 'bar';
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                if (err) {
                    assert.fail(err);
                }
                deleteHeaders.concat(uploadHeaders).forEach((header) => {
                    assert.strictEqual(header['x-f5-auth-token'], '123abc');
                    assert.strictEqual(header['x-foo'], 'bar');
                });
                done();
            });
        });

        it('should include basicAuth as Authorization header if X-F5-Auth-Token is not provided', (done) => {
            mockUpload('https://localhost:8100');
            context.target.tokens = {};
            context.request.basicAuth = 'admin:';
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                if (err) {
                    assert.fail(err);
                }
                deleteHeaders.concat(uploadHeaders).forEach((header) => {
                    assert.strictEqual(header.authorization, 'admin:');
                });
                done();
            });
        });

        it('should include Content headers defining each file chunk', (done) => {
            mockUpload('https://localhost:8100');
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                if (err) {
                    assert.fail(err);
                }
                uploadHeaders.forEach((header, idx) => {
                    const start = idx * CHUNK_SIZE;
                    let end = start + CHUNK_SIZE - 1;
                    end = end > FILE_SIZE - 1 ? FILE_SIZE - 1 : end;

                    assert.strictEqual(header['content-type'], 'application/octet-stream');
                    assert.strictEqual(header['content-range'], `${start}-${end}/${FILE_SIZE}`);
                    assert.strictEqual(header['content-length'], end - start + 1);
                });
                done();
            });
        });

        it('should call callback with error when DELETE response status code is >=400', (done) => {
            mockUpload('https://localhost:8100', { delete: MOCK_RES_STATUS.FAIL });
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                assert.deepStrictEqual(err, new Error('Status Code 400 DELETE /mgmt/shared/file-transfer/uploads/foo.bar\nInvalid Request'));
                done();
            });
        });

        it('should call callback with error when POST response status code is >=400', (done) => {
            mockUpload('https://localhost:8100', { upload: MOCK_RES_STATUS.FAIL });
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                assert.deepStrictEqual(err, new Error('Status Code 400 POST /mgmt/shared/file-transfer/uploads/foo.bar\nInvalid Request'));
                done();
            });
        });

        it('should catch DELETE request error and call callback with same error', (done) => {
            mockUpload('https://localhost:8100', { delete: MOCK_RES_STATUS.ERR });
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                assert.deepStrictEqual(err, new Error('connect ECONNREFUSED https://localhost:8100'));
                done();
            });
        });

        it('should catch UPLOAD request error and call callback with same error', (done) => {
            mockUpload('https://localhost:8100', { upload: MOCK_RES_STATUS.ERR });
            iappUtil.copyToHost(context, '/tmp/foo.bar', (err) => {
                assert.deepStrictEqual(err, new Error('connect ECONNREFUSED https://localhost:8100'));
                done();
            });
        });
    });
});

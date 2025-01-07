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

const EventEmitter = require('events');

class SocketMock extends EventEmitter {
    constructor(port, host) {
        super();
        this.port = port;
        this.host = host;
    }

    onEnd(callback) {
        this.onEnd = callback;
    }

    onDestroy(callback) {
        this.onDestroy = callback;
    }

    end() {
        this.onEnd();
    }

    destroy() {
        this.onDestroy();
    }

    triggerConnect() {
        this.emit('connect');
    }

    triggerError(e) {
        this.emit('error', e);
    }
}

module.exports = SocketMock;

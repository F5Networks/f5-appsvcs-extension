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

class CheckLib {
    static addStatusCodeCheck(events, statusCode) {
        if (!events.test) {
            events.test = [];
        }

        events.test.push(
            `pm.test("Status code is ${statusCode}", function () {`,
            `        pm.response.to.have.status(${statusCode});`,
            '});\n'
        );
    }

    static addMessageCheck(events, message) {
        if (!events.test) {
            events.test = [];
        }

        events.test.push(
            'pm.test("Response contains error message", function () {',
            `        pm.expect(pm.response.text()).to.include('${message}');`,
            '});\n'
        );
    }

    static addMultiMessageCheck(events, items, statusCodes) {
        if (!events.test) {
            events.test = [];
        }
        events.test.push('const jsonData = pm.response.json();');
        items.forEach((msg, index) => {
            const statusCode = statusCodes[index];
            events.test.push(
                'pm.test("Response contains error message", function () {',
                `        pm.expect(jsonData.items[${index}].message).to.include('${msg}');`,
                '});\n',
                'pm.test("Response contains statusCode", function () {',
                `        pm.expect(jsonData.items[${index}].code).to.eql(${statusCode});`,
                '});\n'
            );
        });
    }
}

module.exports = CheckLib;

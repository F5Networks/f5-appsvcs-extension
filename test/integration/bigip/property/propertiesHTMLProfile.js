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
    GLOBAL_TIMEOUT
} = require('./propertiesCommon');

describe('HTML_Profile', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertHTMLProfile(properties, options) {
        return assertClass('HTML_Profile', properties, options);
    }

    it('All properties', function () {
        const options = {
            bigipItems: [
                {
                    endpoint: '/mgmt/tm/ltm/html-rule/tag-append-html',
                    data: {
                        name: 'rule_bigip',
                        action: {
                            text: 'text'
                        },
                        match: {
                            tagName: 'tag'
                        }
                    }
                }
            ]
        };

        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'contentDetectionEnabled',
                inputValue: [undefined, true, undefined],
                expectedValue: ['disabled', 'enabled', 'disabled'],
                extractFunction: (o) => o.contentDetection
            },
            {
                name: 'contentSelection',
                inputValue: [
                    undefined,
                    [
                        'text/javascript'
                    ],
                    undefined
                ],
                expectedValue: [
                    [
                        'text/html',
                        'text/xhtml'
                    ],
                    [
                        'text/javascript'
                    ],
                    [
                        'text/html',
                        'text/xhtml'
                    ]
                ]
            },
            {
                name: 'rules',
                inputValue: [
                    undefined,
                    [
                        { use: 'rule_comment_raise_event' },
                        { use: 'rule_comment_remove' },
                        { use: 'rule_tag_append_html' },
                        { use: 'rule_tag_prepend_html' },
                        { use: 'rule_tag_raise_event' },
                        { use: 'rule_tag_remove' },
                        { use: 'rule_tag_remove_attribute' },
                        { bigip: '/Common/rule_bigip' }
                    ],
                    undefined
                ],
                referenceObjects: {
                    rule_comment_raise_event: {
                        class: 'HTML_Rule',
                        ruleType: 'comment-raise-event'
                    },
                    rule_comment_remove: {
                        class: 'HTML_Rule',
                        ruleType: 'comment-remove'
                    },
                    rule_tag_append_html: {
                        class: 'HTML_Rule',
                        ruleType: 'tag-append-html',
                        content: 'some content here',
                        match: {
                            tagName: '/tagName'
                        }
                    },
                    rule_tag_prepend_html: {
                        class: 'HTML_Rule',
                        ruleType: 'tag-prepend-html',
                        content: 'some content here',
                        match: {
                            tagName: '/tagName'
                        }
                    },
                    rule_tag_raise_event: {
                        class: 'HTML_Rule',
                        ruleType: 'tag-raise-event',
                        match: {
                            tagName: '/tagName'
                        }
                    },
                    rule_tag_remove: {
                        class: 'HTML_Rule',
                        ruleType: 'tag-remove',
                        match: {
                            tagName: '/tagName'
                        }
                    },
                    rule_tag_remove_attribute: {
                        class: 'HTML_Rule',
                        ruleType: 'tag-remove-attribute',
                        attributeName: 'attribName',
                        match: {
                            tagName: '/tagName',
                            attributeName: 'aName',
                            attributeValue: 'aValue'
                        }
                    }
                },
                expectedValue: [
                    undefined,
                    [
                        'rule_comment_raise_event',
                        'rule_comment_remove',
                        'rule_tag_append_html',
                        'rule_tag_prepend_html',
                        'rule_tag_raise_event',
                        'rule_tag_remove',
                        'rule_tag_remove_attribute',
                        'rule_bigip'
                    ],
                    undefined
                ],
                extractFunction: (o) => {
                    if (typeof o.rules === 'undefined') {
                        return undefined;
                    }
                    if (Array.isArray(o.rules)) {
                        return o.rules.map((x) => x.name);
                    }
                    return o;
                }
            }
        ];

        return assertHTMLProfile(properties, options);
    });
});

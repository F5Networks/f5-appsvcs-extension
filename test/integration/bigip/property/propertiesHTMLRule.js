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

describe('HTML_Rule', function () {
    this.timeout(GLOBAL_TIMEOUT);

    function assertHTMLRule(properties) {
        return assertClass('HTML_Rule', properties);
    }

    it('Comment Raise Event', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['comment-raise-event'],
                skipAssert: true
            }
        ];

        return assertHTMLRule(properties);
    });

    it('Comment Remove', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['comment-remove'],
                skipAssert: true
            }
        ];

        return assertHTMLRule(properties);
    });

    it('Tag Append HTML', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['tag-append-html'],
                skipAssert: true
            },
            {
                name: 'content',
                inputValue: [
                    'do something',
                    '<script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?cache\\"></script> <script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?async\\" async></script>',
                    'do something'],
                expectedValue: [
                    'do something',
                    '<script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?cache\\"></script> <script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?async\\" async></script>',
                    'do something'],
                extractFunction: (o) => o.action.text
            },
            {
                name: 'match',
                inputValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ],
                expectedValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ]
            }
        ];

        return assertHTMLRule(properties);
    });

    it('Tag Prepend HTML', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['tag-prepend-html'],
                skipAssert: true
            },
            {
                name: 'content',
                inputValue: [
                    'do something',
                    '<script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?cache\\"></script> <script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?async\\" async></script>',
                    'do something'],
                expectedValue: [
                    'do something',
                    '<script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?cache\\"></script> <script type=\\"text/javascript\\" src=\\"ShapeProvidedJSPath\\?async\\" async></script>',
                    'do something'],
                extractFunction: (o) => o.action.text
            },
            {
                name: 'match',
                inputValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ],
                expectedValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ]
            }
        ];

        return assertHTMLRule(properties);
    });

    it('Tag Raise Event', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['tag-raise-event'],
                skipAssert: true
            },
            {
                name: 'match',
                inputValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ],
                expectedValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ]
            }
        ];

        return assertHTMLRule(properties);
    });

    it('Tag Remove', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['tag-remove'],
                skipAssert: true
            },
            {
                name: 'match',
                inputValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ],
                expectedValue: [
                    {
                        tagName: 'TagA'
                    },
                    {
                        attributeName: 'AttributeName',
                        attributeValue: 'AttributeValue',
                        tagName: '/title'
                    },
                    {
                        tagName: 'TagA'
                    }
                ]
            }
        ];

        return assertHTMLRule(properties);
    });

    it('Tag Remove Attribute', function () {
        const properties = [
            {
                name: 'remark',
                inputValue: [undefined, 'description', undefined],
                expectedValue: ['none', 'description', 'none'],
                extractFunction: (o) => o.description || 'none'
            },
            {
                name: 'ruleType',
                inputValue: ['tag-remove-attribute'],
                skipAssert: true
            },
            {
                name: 'attributeName',
                inputValue: ['aName', 'anotherName', 'aName'],
                expectedValue: [
                    'aName', 'anotherName', 'aName'],
                extractFunction: (o) => o.action.attributeName
            },
            {
                name: 'match',
                inputValue: [
                    {
                        tagName: 'tagA',
                        attributeName: 'nameA',
                        attributeValue: 'valueA'
                    },
                    {
                        tagName: 'tagB',
                        attributeName: 'nameB',
                        attributeValue: 'valueB'
                    },
                    {
                        tagName: 'tagA',
                        attributeName: 'nameA',
                        attributeValue: 'valueA'
                    }
                ],
                expectedValue: [
                    {
                        tagName: 'tagA',
                        attributeName: 'nameA',
                        attributeValue: 'valueA'
                    },
                    {
                        tagName: 'tagB',
                        attributeName: 'nameB',
                        attributeValue: 'valueB'
                    },
                    {
                        tagName: 'tagA',
                        attributeName: 'nameA',
                        attributeValue: 'valueA'
                    }
                ]
            }
        ];

        return assertHTMLRule(properties);
    });
});

/**
 * Copyright 2023 F5 Networks, Inc.
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

/* eslint-disable max-classes-per-file */

'use strict';

/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */

// NOTE: See standards from pkg 'opentracing'.Tags
const Tags = {
    HTTP: {
        METHOD: 'http.method',
        STATUS_CODE: 'http.status_code',
        URL: 'http.url',
        PATH: 'http.path'
    },
    COMPONENT: 'component',
    SPAN: {
        KIND: 'span.kind',
        KIND_SERVER: 'server'
    },
    DEVICE: {
        VERSION: 'device.version',
        PLATFORM: 'device.platform',
        PLATFORM_NAME: 'device.platform_name',
        BUILD: 'device.build',
        EDITION: 'device.edition',
        PRODUCT: 'device.product'
    },
    APP: {
        VERSION: 'app.version',
        RELEASE: 'app.release',
        COMPONENT: 'app.component'
    },
    ERROR: 'error'
};

/**
 * Defines common functionality for span tracing.
 * Behavior must be overridden by subclasses as methods by default are no-op.
 *
 * @class BaseSpan
 */
class BaseSpan {
    /**
     * Logs a span event
     *
     * @param {Object|String} event - an event object or a string description (will be converted to object)
     * @param {Number} timestamp - use a specific timestamp (ms since Unix Epoch) instead of auto-generated
     *
     * @returns {Void}
     */
    log(event, timestamp) {}

    /**
     * Logs a span error event. Adds an error tag
     *
     * @param {Object|String} err - error object or a string error message (will be converted to object)
     * @param {Number} timestamp - use a specific timestamp (ms since Unix Epoch) instead of auto-generated
     *
     * @returns {Void}
     */
    logError(err, timestamp) {}

    /**
     *  Marks the span as complete
     *
     * @returns {Void}
     */
    finish() {}

    /**
     * Add a single tag to the span
     *
     * @param {String} tagKey - the tag key
     * @param {String} tagValue - the corresponding tag value
     *
     * @returns {Void}
     */
    addTag(tagKey, tagValue) {}

    /**
     * Add multiple tags to the span
     *
     * @param {Object} tags - key-value pair dictionary of tag key and tag values
     *
     * @returns {Void}
     */
    addTags(tags) {}

    /**
     * Add HTTP tag type to the span with the provided status code
     *
     * @param {Integer} code
     *
     * @returns {Void}
     */
    tagHttpCode(code) {}

    /**
     * @public
     * @readonly
     * @returns {Boolean} - whether or not the span has been marked as complete
     */
    get finished() {
        return !!this._finished;
    }

    /**
     * @public
     * @readonly
     * @returns {Boolean} - whether or not an error was encountered while processing span
     */
    get errored() {
        return !!this._errored;
    }
}

/**
 * A basic unit of tracing that contains operation information.
 * May contain references to other spans. A span may have associated events and tags.
 * For more details, see [opentracing specifications](https://opentracing.io/docs/overview/spans/)
 *
 * @class Span
 * @extends {BaseSpan}
 */
class Span extends BaseSpan {
    constructor(span, logger, debug) {
        super();
        Object.defineProperty(this, '_span', { value: span });
        Object.defineProperty(this, '_logger', { value: logger });
        this._errored = false;
        this._finished = false;
        this._debug = debug;
    }

    /**
     * @public
     * @readonly
     * @returns {Array} - logs associated with the span. Each item is a key value pair object
     *              [{ key: 'key', value: 'val'}]
     */
    get logs() {
        return this._span._logs;
    }

    /**
     * @public
     * @readonly
     * @returns {Array} - tags associated with the span. Each item is a key value pair object
     *              [{ key: 'key', value: 'val'}]
     */
    get tags() {
        return this._span._tags;
    }

    /**
     * @public
     * @readonly
     * @returns {String} - The service to which the span belongs to.
     *      This will be the name specified when instantiating the tracer.
     */
    get serviceName() {
        return this._span.serviceName;
    }

    /**
     * @public
     * @returns {String} - The operation the span represents.
     *      For example, an api path (`/shared/project/resource/{resourceId}`)
     */
    get operationName() {
        return this._span.operationName;
    }

    log(event, timestamp) {
        try {
            if (typeof event === 'string') {
                event = { event };
            }
            this._span.log(event, timestamp);
        } catch (e) {
            this._handleException(`Unable to log span event ${JSON.stringify(event)}`, e);
        }
    }

    logError(err, timestamp) {
        try {
            if (typeof err === 'string') {
                err = { message: err };
            }
            this._span.setTag(Tags.ERROR, true);
            this._span.log({
                event: 'error', 'error.object': err, message: err.message, stack: err.stack
            }, timestamp);
        } catch (e) {
            this._handleException(`Unable to tag and log error for span for error ${err.message}`, e);
        }
    }

    finish() {
        try {
            this._span.finish();
        } catch (err) {
            this._handleException('Error while finishing span. ', err);
        }
        this._finished = true;
    }

    tagHttpCode(code) {
        this.addTag(Tags.HTTP.STATUS_CODE, code);
    }

    addTag(tagKey, tagValue) {
        if (!tagKey) {
            this._handleException(`Unable to add tag. Missing tag key for value ${tagValue}`);
        }
        try {
            this._span.setTag(tagKey, tagValue);
        } catch (e) {
            this._handleException(`Unable to add tag ${tagKey}: ${tagValue}`);
        }
    }

    addTags(tags) {
        try {
            this._span.addTags(tags);
        } catch (e) {
            this._handleException(`Unable to add tags: ${JSON.stringify(tags)}`, e);
        }
    }

    _handleException(msgPrefix, err) {
        this._errored = true;
        if (this._debug) {
            const logMsg = err ? `${msgPrefix}: ${err.message} . stack: ${err.stack}` : msgPrefix;
            this._logger.debug(logMsg);
        }
    }
}

/**
 * Provides functionality for tracing. Currently supported: jaeger-client (will only load module if enabled).
 * A disabled tracer will be a no-op implementation.
 *
 * @class Tracer
 */
class Tracer {
    /**
     * Creates an instance of Tracer.
     *
     * @param {String} serviceName - the name of the service to associate the tracer with.
     *      All spans will be grouped under this serviceName
     * @param {Object} options - tracer options
     * @param {Boolean} [options.enabled]  - whether or not tracing is enabled.
     *      If disabled, a tracer instance will still be returned, but methods are no-op.
     * @param {Object} [options.logger]     - a logger instance
     *  @param {String} [options.endpoint]  - endpoint for the tracing service
     * @param {Boolean} [options.debug]     - enables verbose logging
     * @param {Object} [options.tags]     - key-value pairs of tags to associate at the tracer level
     */
    constructor(serviceName, options) {
        if (!serviceName) {
            throw new Error('serviceName is required');
        }

        options = options || {};
        this._enabled = typeof options.enabled !== 'undefined' ? options.enabled : (String(process.env.F5_PERF_TRACING_ENABLED).toLowerCase() === 'true');
        // read-only
        Object.defineProperties(this, {
            serviceName: { value: serviceName },
            _endpoint: { value: options.endpoint || process.env.F5_PERF_TRACING_ENDPOINT },
            _debug: { value: typeof options.debug !== 'undefined' ? options.debug : String(process.env.F5_PERF_TRACING_DEBUG).toLowerCase() === 'true' }
        });
        delete options.enabled;
        delete options.endpoint;
        delete options.debug;
        if (this._debug && !options.logger) {
            // provide default console when no logger present but debug enabled
            options.logger = {
                info: (msg) => {
                    console.log(`INFO: [${serviceName}] ${msg}`);
                },
                error: (msg) => {
                    console.log(`ERROR: [${serviceName}] ${msg}`);
                },
                debug: (msg) => {
                    console.log(`DEBUG: [${serviceName}] ${msg}`);
                }
            };
        }
        Object.defineProperty(this, '_logger', { value: options.logger });
        Object.defineProperty(this, '_tracer', { value: this._initTracer(options) });
    }

    /**
     *  Start tracer span with provided options.
     *
     * @param {String} operation          - name of the operation being performed (e.g. getCache)
     *                 Does not necessarily map to a specific function (could be a generic name for the work being done)
     *                 NOTE: Use startHttpSpan() for endpoint-level spans.
     * @param {Object} options            - span options
     * @param {Object} [options.childOf]  - span for parent/root tracing
     * @param {Object} [options.tags]     - key-value pairs of tags to associate span with
     *
     * @returns {Object} tracer span (no-op if tracer disabled)
     */
    startSpan(operation, options) {
        if (!this._enabled) {
            return new BaseSpan();
        }

        try {
            options = options || {};
            const defaultTags = { [Tags.SPAN.KIND]: Tags.SPAN.KIND_SERVER };
            options.tags = Object.assign(defaultTags, options.tags || {});
            const span = this._tracer.startSpan(operation, options);
            return new Span(span, this._logger, this._debug);
        } catch (e) {
            this._handleException(`Error creating span ${operation}. Returning no-op`, e);
            return new BaseSpan();
        }
    }

    /**
     *  Start tracer span for a HTTP request with default tags and provided options.
     *
     * @param {String} resourcePath       - resource path to group requests under (e.g. api/items/{itemid})
     * @param {String} url                - actual url of HTTP request (e.g. api/items/item1234)
     * @param {String} method             - HTTP method (defaults to GET)
     * @param {Object} options            - span options
     * @param {Object} [options.childOf]  - span for parent/root tracing
     * @param {Object} [options.tags]     - key-value pairs of tags to associate span with
     *
     * @returns {Object} tracer span (no-op if tracer disabled)
     */
    startHttpSpan(resourcePath, url, method, options) {
        if (!this._enabled) {
            return new BaseSpan();
        }

        method = method || 'GET';
        options = options || {};
        const httpTags = {
            [Tags.SPAN.KIND]: Tags.SPAN.KIND_SERVER,
            [Tags.COMPONENT]: 'net/http',
            [Tags.HTTP.METHOD]: method.toUpperCase(),
            [Tags.HTTP.URL]: url
        };
        options.tags = Object.assign(httpTags, options.tags || {});
        return this.startSpan(resourcePath, options);
    }

    /**
     *  Start a tracer span as a child of an existing span. Allows for drilling down and grouping traces.
     *
     * @param {String} opName         - name of the operation being performed
     * @param {Object} parentSpan - the parent span
     * @param {Object} options            - span options
     * @param {Object} [options.tags]     - key-value pairs of tags to associate span with
     *
     * @returns {Object} tracer span (no-op if tracer disabled)
     */
    startChildSpan(opName, parentSpan, options) {
        if (!this._enabled) {
            return new BaseSpan();
        }
        options = options || {};
        options.childOf = parentSpan._span;
        return this.startSpan(opName, options);
    }

    /**
     *  Configure tracer instance. For jaeger instance options, refer to [doc]((https://github.com/jaegertracing/jaeger-client-node/blob/v3.18.1/src/configuration.js#L188)
     *
     * @param {Object} options              - tracer options
     * @param {Object} [options.logger]     - tracer logger
     * @param {Object} [options.tags]       - key-value pairs of tracer level tags
     *
     * @returns {Object} - tracer or undefined if disabled or errored.
     */
    _initTracer(options) {
        let tracer;
        if (!this._enabled) {
            process.env.JAEGER_DISABLED = true;
            return tracer;
        }

        try {
            if (this._debug) {
                this._logger.debug('Initializing Jaeger Client');
            }
            // support for node < v10 drops after jaeger-client 3.18.1 version
            // jaeger client has dependency with packages that do not work in strict mode
            // (package 'error' sets a read-only property name)

            // eslint-disable-next-line global-require
            const JaegerClient = require('jaeger-client');
            const tracerConf = {
                serviceName: this.serviceName,
                sampler: {
                    type: 'const',
                    param: 1
                },
                reporter: {
                    logSpans: true
                }
            };
            process.env.JAEGER_DISABLED = false;
            process.env.JAEGER_ENDPOINT = this._endpoint;
            tracer = JaegerClient.initTracerFromEnv(tracerConf, options);
            if (this._debug) {
                this._logger.debug(`Initialized tracer. enabled: ${this._enabled} api: ${this._endpoint}`);
            }
        } catch (err) {
            this._handleException('Failed to initialize Jaeger Client tracer. Using noop tracer.', err);
            this._enabled = false;
        }
        return tracer;
    }

    /**
     * Closes tracer. NOTE: Best practice to call this once tracer is no longer needed
     *      to flush out spans and other components and avoid leaks.
     *
     * @returns {Void}
     */
    close() {
        if (this._tracer) {
            try {
                if (this._debug) {
                    this._logger.debug('Closing tracer.');
                }
                this._tracer.close();
            } catch (e) {
                this._handleException('Error encountered while attempting to close tracer', e);
            }
        }
    }

    _handleException(msgPrefix, err) {
        if (this._debug) {
            const logMsg = err ? `${msgPrefix}: ${err.message} . stack: ${err.stack}` : msgPrefix;
            this._logger.debug(logMsg);
        }
    }
}

class Util {
    /**
     *  Returns an object of device-related tags from a classic iControl REST response
     *
     * @param {Object} [sysVersionData]     - the JSON object response from endpoint
     *                          `/mgmt/shared/identified-devices/config/device-info`
     *
     * @returns {Object} tracer span
     */
    static buildDeviceTags(deviceInfo) {
        return {
            [Tags.DEVICE.PLATFORM]: deviceInfo.platform,
            [Tags.DEVICE.VERSION]: deviceInfo.version,
            [Tags.DEVICE.BUILD]: deviceInfo.build,
            [Tags.DEVICE.EDITION]: deviceInfo.edition,
            [Tags.DEVICE.PRODUCT]: deviceInfo.product,
            [Tags.DEVICE.PLATFORM_NAME]: deviceInfo.platformName || deviceInfo.platformMarketingName
        };
    }

    static getClassList(tracer, declaration) {
        if (!tracer || !tracer._enabled || !declaration) {
            return [];
        }

        const classes = [];
        function getClasses(subDecl) {
            if (Array.isArray(subDecl)) {
                subDecl.forEach((decl) => getClasses(decl));
                return;
            }
            if (subDecl.class) {
                if (classes.indexOf(subDecl.class) === -1) {
                    classes.push(subDecl.class);
                }
            }
            Object.keys(subDecl)
                .map((prop) => subDecl[prop])
                .filter((value) => typeof value === 'object')
                .forEach((value) => getClasses(value));
        }

        getClasses(declaration);
        return classes;
    }
}

module.exports = {
    Tracer,
    Tags,
    BaseSpan,
    Span,
    Util
};

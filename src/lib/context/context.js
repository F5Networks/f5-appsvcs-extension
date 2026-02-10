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

/*
 * The Context object is central object sent through the AS3 codebase to convey
 * information between different parts of the code. These are the major objects:
 *
 * host - Holds information on the host machine. Set during AS3 startup, and
 *   stored in restworker.
 *
 * request - Holds information regarding the original request. Currently, this
 *   includes the entire request body. This is created per request to AS3. Set
 *   in restworker.onPost().
 *
 * target - Holds sub-declaration specific information on that declaration's
 *   target machine. This is created per subdeclaration in a request. Set in
 *   declarationHandler.process().
 *
 * tasks - An array of subdeclarations and their corresponding values such as
 *   action, showHash, metadata (additional notes below), protocol, urlPrefix etc...
 *
 *   Metadata is stored as a subobject under the same path as the target
 *   property in the declaration. e.g. Metadata for the property
 *   "task.declaration.tenant.application.service" would be found at
 *   "task.metadata.tenant.application.service"
 *
 * control - This is set in declareHandler.processDeclInArray(), which grabs
 *   the current working controls object.
 *
 * currentIndex - This is the current working index primarily used in the tasks
 *   array. This is set in a couple locations:
 *
 *   The first is in declareHandler.getInitialControls(), this way the loop
 *   can know which index to use in the request context arrays.
 *
 *   The second is in declareHandler.processDeclInArray(), before being sent
 *   into declarationHandler.process(). This allows everything in afterwards
 *   to know which array index to reference after that point.
 *
 * log - This is where anything related to logging will be stored. For instance,
 *   this will have the trace files if traceResponse is used in the declaration.
 *
 *   Trace files are currently added in audit.auditTenant() and updaterTmsh.update().
 */

class Context {
    // builds and returns a default Context object (good for testing)
    static build(hostContext, requestContext, targetContext, tasks) {
        // Create defaults in passed in parameters are empty
        const defaultHost = {};
        const defaultRequest = {};
        const defaultTarget = {};
        return {
            host: hostContext || defaultHost,
            request: requestContext || defaultRequest,
            target: targetContext || defaultTarget,
            timeSlip: 0,
            currentIndex: 0,
            log: {},
            tasks: tasks || [],
            control: {
                tokens: []
            }
        };
    }
}

module.exports = Context;

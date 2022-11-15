# AS3 Modularization Proposal

## OVERVIEW

AS3 code is split into 6 modules, each self-contained with well-defined API:

1. /hostContext - Initialize the host system, including installation of service discovery
2. /requestContext - Identify the request particulars, reduce all methods to POST - NO TARGET QUERIES YET
3. /targetContext - Query the target device type, version, provisioning, and prior declarations
4. /schemaProcessor - Read and validate the configuration being deployed - PARSE ONLY - NO CONFIG YET
5. /configProcessor - ALL TARGET CONFIG HAPPENS HERE
6. /responseProcessor - Deliver a consistent response to the user

Modules 2 through 6 represent the sequential flow of an AS3 REST request. Module 1 operates outside that flow.

There are 2 additional folders in the repo:

7. /util - Utility functions to share between modules
8. /schema - JSON schema files

## I/O, JOB LISTS, & EXIT STATES

### 1. Host Context - Initialize the system

   Inputs
   - None

   Jobs
   - Identify the host where AS3 is running, which may be different from the target being configured.
   - Verify f5-service-discovery is installed:
     - If not, initiate installation and return false from restWorker Startup.
       (Installation will restart restnoded and therefore restart AS3.)

   Successful Exit State
   - Host type is determined as BIG-IP, BIG-IQ, or ASG container.
   - f5-service-discovery is installed.

   Successful Outputs
   - as3HostType = enum [BIG-IP, BIG-IQ, ASG]

   Failed Exit State
   - AS3 is down. Log error and return false.

   Failed Outputs
   - N/A

### 2. Request Context (WHERE) - Identify the host, target, and request particulars

   Inputs
   - request:
     - method = enum [GET, POST, PATCH, DELETE]
     - full path url, including query strings
     - body = null | ADC class(es) | AS3 class(es)

   Jobs
   - Assign async UUID.
   - Read URL subpath and query strings (async, age, tenantName).
   - Normalize request body into an AS3 class array:
     - Assign actions according to method (deploy, patch, retrieve, remove).
     - Run AJV to insert AS3 class defaults, but do not validate declaration.
     - Validate uniqueness of targets.

   Successful Exit State
   - Method, query strings, and subpath are normalized into AS3 class properties.
   - Request body is normalized into an AS3 class or class array.

   Sucessful Outputs
   - Request object in the form of an AS3 Class array, each member having:
     - id (assigned by user)
     - uuid (assigned by AS3)
     - declaration = null | object (not otherwise validated)
     - action = retrieve | dry-run | deploy
     - targetHost
     - targetPort
     - age
     - async
     - syncToGroup
     - persist
     - logLevel

   Failed Exit State
   - Context cannot be determined from input given.
   - Request fails. Log error and parent function skips to step 5 after exiting.

   Failed Outputs:
   - error = true
   - message = string describing the error

### 3. Target Context (WHERE) - Obtain the target device context

   Inputs
   - request

   Jobs
   - Contact target device:
     - Obtain auth token.
     - Read:
       - Auth token
       - Provisioned modules
       - Device type (BIG-IQ has 'biq' provisioned)
       - Version number
       - Current or age-appropriate declaration
   - Normalize certain AS3 class actions:
     - Convert action=redeploy to action=deploy with prior declaration.
     - Convert action=patch to action=deploy with modified declaration.
     - Convert action=remove to action=deploy with empty tenant(s).

   Successful Exit State
   - All actions reduced to POST with action = retrieve | dry-run | deploy.
   - If action = retrieve, parent function skips to step 5 after exiting.

   Sucessful Outputs
   - Request object in the form of an AS3 Class array, each member having:
     - id (assigned by user)
     - uuid (assigned by AS3)
     - declaration = null | object (not otherwise validated)
     - action = retrieve | dry-run | deploy
     - targetHost
     - targetPort
     - targetTokens (needed only if targetHost != localhost)
     - targetDeviceType
     - targetVersion
     - targetModules
     - age
     - async
     - syncToGroup
     - persist
     - logLevel

   Failed Exit State
   - Context cannot be determined from input given or device contacted.
   - Request fails. Log error and parent function skips to step 5 after exiting.

   Failed Outputs:
   - error = true
   - message = string describing the error
   
### 4. schemaProcessor (WHAT) - Read and validate the configuration being deployed

   Inputs
   - AS3 class object (member of output array from context) with action = dry-run | deploy

   Jobs
   - Copy declaration or declaration array to working copy.
   - Run AJV to parse the working copy and insert defaults.
   - Run AJV to expand any URL references.

   Successful Exit State
   - Declaration or array is valid and expanded.
   - If action = dry-run, parent function skips to step 5 after exiting.

   Successful Outputs
   - Original declaration or declaration array.
   - Full declaration working copy with defaults added.
   - AS3 class object with validated and expanded declaration working copy.

   Failed Exit State
   - Declaration is invalid.
   - Request fails. Log error and parent function skips to step 5 after exiting.

   Failed Outputs
   - error = true
   - message = string describing the error

### 5. configProcessor (ACT) - Do the transactional work to configure the target

   Inputs
   - Original declaration or declaration array.
   - AS3 class object with validated and expanded declaration working copy.

   Jobs
   - If targetDeviceType = BIG-IP
     - Loop on Tenants
       - Query targetHost for current state.
       - Normalize & diff declared state vs. current state.
       - Construct and execute CLI transaction and additional commands.
   - If successful, store original declaration in targetHost data-group.

   - If targetDeviceType = BIG-IQ
     - Run AJV on schemaOverlay.
     - Forward request to targetHost.

   Successful Exit State
   - Target is configured.

   Successful Outputs
   - A promise that resolves:
     - message = "success" or "no change"

   Failed Exit State
   - Target is reverted to its original state.

   Failed Outputs
   - A promise that resolves:
     - error = true
     - message = string describing the error

### 6. ResponseProcessor - Deliver a response to the user

   Inputs
   - Original declaration or declaration array.
   - Full declaration working copy with defaults added.
   - AS3 class object with validated and expanded declaration working copy.
   - Message returned from deployment.

   Jobs
   - Assemble reply object (handle both async and sync cases).
   - Validate reply against AS3 reply schema.

   Successful Exit State
   - Output is valid.

   Successful Outputs
   - REST response JSON string.

   Failed Exit State
   - Output format violates schema.
   - Log error that will fail build functional tests.
   - Return output normally.

   Failed Outputs
   - REST response JSON string (same as successful output).
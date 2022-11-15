.. _api-details:

BIG-IP AS3 API Reference
========================
This page contains details on the BIG-IP AS3 API and the API methods you can use.

|

.. _apidocs:

OpenAPI Reference
-----------------

To see the API reference in a new browser window, click |api|.

|

API Overview 
------------
The BIG-IP AS3 API supports Create, Read, Update, and Delete (CRUD) actions.  You select specific actions by combinations of HTTP method (such as POST or GET), HTTP URL-path, and properties in request bodies (always JSON).

All BIG-IP AS3 API requests relate to BIG-IP AS3 declarations and to target ADC (BIG-IP) hosts.

.. NOTE:: This section is specific to BIG-IP, for information about BIG-IQ, see the `BIG-IQ page <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/big-iq.html>`_

A client may supply a declaration with a POST request (although not every POST request has to include one).

All other request methods (GET and DELETE) work with declarations previously supplied via POST and retained by AS3.

The default target ADC for every BIG-IP AS3 request (that is, the target selected when a request does not specify any other) is **localhost**.  In the basic case that means the BIG-IP on which BIG-IP AS3 is running.  When BIG-IP AS3 is not running on a BIG-IP, **localhost** is not a valid target.

|

API Methods
-----------

.. _post-ref:

Method POST
```````````

Use POST to deploy a configuration to a target ADC, or for certain other actions, including "retrieve".  You must supply a request document with each POST.  The request document may be a proper request or a ADC-only declaration.  

If your target is something other than localhost, you must use a BIG-IP AS3 request, and specify target options in the body. If you do not specify a target or targetHost, the default target is localhost.  

Return to :ref:`as3class-ref` for information about the available *actions* for POST.

BIG-IP AS3 3.7.0 introduced new behavior for asynchronous mode. Even if you have asynchronous mode set to false, after 45 seconds BIG-IP AS3 sets asynchronous mode to true (API swap), and returns an async response. This allows you to use GET to poll for status (you should see a 202 status until the declaration is complete).  This typically occurs only with very large declarations to BIG-IP or most declarations to BIG-IQ; if the declaration completes in less than 45 seconds, BIG-IP AS3 does not modify asynchronous mode.

Beginning with BIG-IP AS3 3.10.0, an async POST request to the /declare endpoint now returns an async record instead of an object only containing a record ID and success message.  Additionally, while a tenant is being processed by AS3, the message in the async record was changed from **pending** to **in progress**.

.. _tenanturi:

POSTing to a specific tenant 
""""""""""""""""""""""""""""
Starting with BIG-IP AS3 3.14.0, you have the option of using POST to the /declare endpoint with a specific tenant in the URI (for example .../declare/tenant1). This only updates the tenant you specified, even if there are other tenants in the declaration. This can be useful in some automation scenarios involving AS3.

For example, when POSTING to the URI  **/mgmt/shared/appsvcs/declare/tenant1,tenant2**:

- If both tenant1 and tenant2 are in the declaration you are posting, both tenants are updated and BIG-IP AS3 returns both tenants in the response.
- If only tenant1 is present in the declaration you are posting, **only** tenant1 is updated and returned in the response, despite the fact tenant2 is included in the URI.
- If the tenant in the URI and the tenant in the declaration do not match (for example, only tenant3 is present in the declaration), BIG-IP AS3 returns a "no change" response.

|

.. TIP:: To see the query parameters for POST, click |api| (opens in a new window).



Important:  The declaration property **updateMode** has an important effect when you POST with ``action="deploy"``.  When declaration.updateMode is "selective" then BIG-IP AS3 only modifies the Tenants you define in the declaration.  When "updateMode" is "complete" then BIG-IP AS3 removes any Tenant which is not defined in the declaration from the target. 


For example, with request-property action "deploy":

``POST https://192.0.2.10/mgmt/shared/appsvcs/declare``

Deploys the tenants specified in the declaration to target device localhost.  

``POST https://192.0.2.10/mgmt/shared/appsvcs/declare?showHash=true``

Deploys the tenants specified in the declaration to target device localhost, and returns an optimisticLockKey at the bottom of each tenant in the results (for example ``"optimisticLockKey": "MYo3Zf8L1RjHsY761wAROzPES6yzGSgB1pxwN8Xsmfk="``). Future updates to any of the tenants in this declaration must include this optimisticLockKey.

``POST https://192.0.2.10/mgmt/shared/appsvcs/declare/tenant1``

Deploys only tenant1, despite other tenants that may be present in the declaration.  See :ref:`tenanturi` for more information.


.. _actions-ref:


POST Actions
""""""""""""
You can use the following actions with the POST method in the :ref:`as3class-ref` of your declaration. If you include the BIG-IP AS3 class in your declaration, if you do not include an action, it defaults to **deploy**.

.. list-table::
      :widths: 10 100 
      :header-rows: 1

      * - Action
        - Description
        
      * - **deploy** 
        - Deploys the declaration onto the target device. This is the most common action, and is the default if you do not specify an action in BIG-IP AS3 v3.1.0 and later.  

      * - **dry-run**  
        - Similar to the deploy action, dry-run sends the declaration through all validation checks but does not attempt to deploy the configuration on the target device.  This can be useful for testing and debugging declarations.  The body of the results of this action are **"dryRun": true** and **"Message": "success"** if the declaration was successful. 

      * - **patch** 
        - Modifies and re-submits the stored declaration with changes specified according to the JSON Patch standard.  To use patch, you should also include a **"patchBody":** in the BIG-IP AS3 class.  For more information on JSON Patch, see https://datatracker.ietf.org/doc/html/rfc6902. 

      * - **redeploy** 
        - BIG-IP AS3 stores up to 15 declarations in the target device's declaration history, the redeploy action allows you to redeploy one of those previous declarations.  To use redeploy, you should also include a **"redeployAge":** in the BIG-IP AS3 class (under redeploy) that has a value between 0-15.  If you do not include a redeployAge, BIG-IP AS3 defaults to 0, which means the most recently deployed declaration.  You can use GET with **?age=list** at the end of the URI to retrieve a list of the available declarations and their ages (see the GET examples in the following section).

      * - **retrieve**
        - The retrieve action returns the entire declared configuration, which is the same as using the GET method (for localhost, we recommend using GET and not the retrieve action).  The body of your declaration would include only **"class": "AS3",** and **"action": "retrieve"**.

      * - **remove**
        - The remove action removes the entire declared configuration, which is the same as using the DELETE method (for localhost, we recommend using DELETE and not the remove action).  The body of your declaration would include only **"class": "AS3",** and **"action": "remove"**.

|


.. _get-ref:

Method GET
```````````

Use GET to retrieve a declaration (with all or just some Tenants) or an index of stored declarations.  Select the data you want by appending elements to the main BIG-IP AS3 URL path (/mgmt/shared/appsvcs/declare).  By default (GET just the main URL path) GET returns the base declaration for all Tenants on target localhost.  You can also use /mgmt/shared/appsvcs/info to retrieve information on the version and release of BIG-IP AS3 you are using, as well as the current version of the BIG-IP AS3 schema (and minimum required schema version).  If you attempt to use GET, but you do not currently have any AS3-produced configuration on the target device, the system responds with a 204 HTTP status ("The server successfully processed the request and is not returning any content").

In BIG-IP AS3 3.5.0 and later, if you used the *?async=true* query parameter to send a large declaration, you can use a GET request to the /task endpoint (for example /mgmt/shared/appsvcs/task/<record ID>) with the record ID returned by the POST to see the status of the processing (and the results if it is finished).  You cannot use the **async** query parameter with GET, only POST.

.. NOTE:: As of BIG-IP AS3 version 3.10.0, a GET request to the /task endpoint contains the following changes:

          -  Using a GET request to fetch a specific record from the /task endpoint now returns a JSON object instead of an array with one JSON object
          -  Using a GET request to fetch *all* records from the /task endpoint now returns a JSON object with an items property that contains all records instead of a JSON array that contains all records
          -  If no records exist, a GET request to fetch all records will now return a 200 status code with an empty array instead of a 404 status code with an error object
          -  The records returned from GET requests to the /task endpoint have changed to remove several layers of nesting (see :ref:`nest`)
          -  While a tenant is being processed by AS3, the message in the async record was changed from **pending** to **in progress**.
          

.. TIP:: To see the query parameters for GET, click |api| (opens in a new window).

|

Additionally, you can specify the tenant(s) you want BIG-IP AS3 to return, with multiple tenants separated by commas (see the third example in the following list).

**GET examples**

``GET https://192.0.2.10/mgmt/shared/appsvcs/declare``

This returns the most-recently-deployed declaration with all tenants that BIG-IP AS3 knows about.

``GET https://192.0.2.10/mgmt/shared/appsvcs/declare?show=full``

This returns the most-recently-deployed declaration for all tenants with all schema defaults filled in.

``GET https://192.0.2.10/mgmt/shared/appsvcs/declare/T1,T3?show=expanded``

This returns the most-recently-deployed declaration but includes only Tenants T1 and T3, and with the declaration expanded completely.

``GET https://192.0.2.10/mgmt/shared/appsvcs/declare?age=list``

This returns a list of available declarations and their ages.  By default, list only shows the last four declarations. You can configure this using **historyLimit** in the BIG-IP AS3 class, for example, you would add **"historyLimit": 15,** to the BIG-IP AS3 class at the same level as *action*.

``GET https://192.0.2.10/mgmt/shared/appsvcs/declare/T1?show=full&age=1``

This returns a the second-most-recently-deployed declaration for the Tenant T1.

``GET https://192.0.2.10/mgmt/shared/appsvcs/info``

This returns version and release information for the instance of BIG-IP AS3 you are using. It also shows current and minimum required versions of the BIG-IP AS3 schema.

``GET https://192.0.2.10/mgmt/shared/appsvcs/task/8c561063-b0af-4e0b-8115-f6248b76c484``

This returns the status of previously POSTed declaration using the async=true query parameter.  If the declaration has finished processing, BIG-IP AS3 returns the results of the declaration. 

``GET  https://192.0.2.10/mgmt/shared/appsvcs/declare/T1?filterClass=HTTP_Profile``

This returns only items in the declaration that match the HTTP_Profile class.

You can also retrieve declarations or the declaration index using POST instead of GET.  You must POST a request document with action=retrieve. If you would like to retrieve a declaration other than localhost, see the :ref:`post-ref`. For localhost, we recommend using GET to retrieve declarations.

|

.. _delete-ref:

Method DELETE
`````````````

Use DELETE to remove configurations for one or more declared Tenants from the target ADC.  If you do not specify any Tenants, DELETE removes all of them, which is to say, it removes the entire declared configuration.  Indicate the target device and Tenants to remove by appending elements to the main BIG-IP AS3 URL path (/mgmt/shared/appsvcs/declare).  By default (just main URL) DELETE removes all Tenants from target localhost.

.. NOTE:: In BIG-IP AS3 versions prior to 3.11.0, sending a DELETE to the /declare endpoint would clear all declarations from the declaration history (for information on the history and how to retrieve historical declarations, see the **age** query parameter in :ref:`get-ref`). In BIG-IP AS3 3.11.0 and later, the declaration history is not removed, and you can use a GET request with the age query parameter to retrieve previous declarations.  After using DELETE, the DELETE request becomes the declaration at **age=0**, so **age=1** would retrieve the previously POSTed declaration.

.. TIP:: To see the query parameters for DELETE, click |api| (opens in a new window).

|

Additionally, you can specify the tenant(s) you want BIG-IP AS3 to delete, with multiple tenants separated by commas (see the second example in the following list). 

**DELETE examples**:

``DELETE https://192.0.2.10/mgmt/shared/appsvcs/declare``

removes all tenants

``DELETE https://192.0.2.10/mgmt/shared/appsvcs/declare/T1,T2,T5``

removes Tenants T1, T2, and T5 leaving the rest of the most recent declared configuration for localhost in place (assuming there are other Tenants, such as T3 and T4).


You can also remove declarations or particular Tenants using POST instead of DELETE.  You must POST a request document with **action=remove** and a suitable declaration. For localhost, we recommend using DELETE to remove declarations.

|


.. _patch-ref:

Method PATCH
`````````````
Use PATCH to modify an existing declaration without having to resend the entire declaration. For detailed information on JSON PATCH, see https://datatracker.ietf.org/doc/html/rfc6902 (BIG-IP AS3 does not support the **test** operation object).  With PATCH, you use an operation object that tells BIG-IP AS3 what you want to do, and then a path to the object in the original declaration. In some operation objects you include a *value*, in others, you include *from*, see the following table for details.

In the request body, use the following example syntax (see the PATCH operation objects table for examples), as some operations include *from* and do not include *value*:  |br|

.. code-block:: json

   [
       {
           "op": "<operation object>", 
           "path": "<path with JSON pointer>",
           "value": "<value to assign to object in the path>"
        }
    ] 

|br|

.. _patch-ops:

PATCH operation objects
"""""""""""""""""""""""
You can use the following operation objects with the PATCH method. If you include the BIG-IP AS3 class in your declaration, you MUST include an action (in most cases **deploy**).  In the examples in the following table, we condense the examples onto a single line to save space, you may use either a single line or multiple lines when submitting your PATCH, as long as it is valid JSON. You can also see https://datatracker.ietf.org/doc/html/rfc6902#appendix-A for PATCH examples in the RFC.

.. TIP:: For the API reference for PATCH, click |api| (opens in a new window).

|

.. list-table::
      :widths: 10 60 60 
      :header-rows: 1

      * - Operation object
        - Description
        - Example
        
      * - **add**  
        -  Use the **add** operation to add objects to an existing declaration, such as additional servers to a pool.  You must specify the exact path to the object to which you are adding something, including location in an array if applicable.  In the example on the right, our initial declaration included a pool, and included two member items in the **members** array: the first on port 80, and a second on port 8080.  In this case, after **members** we add **/0/** to signify we want to add the server to the first member using port 80. If we wanted to add the server address to the port 8080 member, we'd change /0/ to **/1/**.  |br| |br| For **add** only: |br| *For arrays*: if the order you want to insert the new object is not important, use a **-** (dash) in place of the 0-based index. BIG-IP AS3 adds the new value to the end of the array. Otherwise, if the path points to the index, BIG-IP AS3 inserts the value into the array at the specified index. |br| *For members/properties of an object*: If the target in the path does not exist, BIG-IP AS3 adds that property to the object. If it exists, BIG-IP AS3 replaces the property value.  |br| |br|  In the second example, we use add to modify the Slow Ramp Time from the default of 10 to 20.  See :ref:`patch-add` for additional information.
        - ``[{"op": "add", "path": "/tenant1/app1/pool1/members/0/serverAddresses/-", "value": "10.1.2.3" }]`` |br| ``[{"op": "add", "path": "/tenant1/app1/pool1/slowRampTime", "value": "20" }]``
      
      * - **remove**  
        -  Use the **remove** operation to remove objects from an existing declaration.  Remove does not use a *value*, only the *operation object* and the *path*.  If you do include a *value*, BIG-IP AS3 ignores it; BIG-IP AS3 only removes the object specified in the path.  You must be specific in the path and include the location in the array index (which starts at 0). In the example, BIG-IP AS3 removes the 3rd serverAddress from pool 1.
        - ``[{"op": "remove", "path": "/tenant1/app1/pool1/members/0/serverAddresses/2" }]``
      
      * - **replace**  
        -  Use the **replace** operation to change one value to another.  Use *path* to specify the value you want to change, and *value* to specify the new value.  Again, you must be specific in the path and include the location in the array index if modifying an array member, or the property name if modifying an object member. |br| |br| **IMPORTANT**: When using *replace*, the path must exist (meaning the original declaration MUST include the object in the path). If the property you are attempting to replace is not in the base declaration (use **GET** with **?show=base** at the end of the URI to view the base declaration), you must use **add** and not replace, otherwise you get an error stating the path does not exist.  For example, the pool member property **adminState** does not appear in the base declaration (but defaults to **enable**).  To use PATCH to disallow new connections to a pool member, but still allow existing connections to drain, you can use **add**. For example ``[{"op": "add", "path": "/tenant1/app1/pool1/members/0/adminState", "value": "disable" }]``. |br| |br| In the example, BIG-IP AS3 replaces the existing 4th server address with 10.1.2.5.
        - ``[{"op": "replace", "path": "/tenant1/app1/pool1/members/0/serverAddresses/3", "value": "10.1.2.5" }]``

      * - **move**  
        -  Use the **move** operation to remove the value at a specified location and add it to the target location.  For **move**, you must also include a *from* location in addition to the *path*. Like remove, you do not include a *value*, and if you do, BIG-IP AS3 ignores it. Because move is a *remove* and *add* operation, you can specify a new object in the *path* (but *from* must exist). |br| In the first example, BIG-IP AS3 moves the 4th server address from **pool1** to the 4th server address in **pool1_new**.  |br| In the second example, BIG-IP AS3 renames **pool1_new** to **pool2** (by using move operation which removes pool1_new and adds it back with the new name).
        - ``[{"op": "move", "from": "/tenant1/app1/pool1/members/0/serverAddresses/3", "path": "/tenant1/app1/pool1_new/members/0/serverAddresses/3" }]``  |br| ``[{"op": "move", "from": "/tenant1/app1/pool1_new", "path": "/tenant1/app1/pool2" }]``
        
      * - **copy**  
        -  Use the **copy** operation to copy the value at a specified location to the target location. This operation also does not use a *value*.  In the example, BIG-IP AS3 copies the **pool1_original** pool from **app1** and adds it to **app2** as **pool1_clone**.
        - ``[{"op": "copy", "from": "/tenant1/app1/pool1_original", "path": "/tenant1/app2/pool1_clone" }]``

|

|

.. _patch-add:

Using PATCH to add an application to a tenant
"""""""""""""""""""""""""""""""""""""""""""""
This section attempts to clarify how to use PATCH to add an application. PATCH is dependent on the path property. Everything is relative to the original declaration on that URL (i.e., the "declaration": {...}). It can be helpful to think of PATCH as directly modifying that declaration object tree. 

.. NOTE:: In this first example, we show how you might use PATCH, but not get the results you intend.

In your main URL, GET returns the following configuration syntax:  

``GET {host}/mgmt/shared/appsvcs/declare``

.. code-block:: bash

    "declaration": {
        "tenant1": {
          "app1": { ... },
          "app2": { ... }
        },
        "tenant2": {
          "app1": { ... },
          "app2": { ... }
        }
    }
    
If you use PATCH like the following example:

``PATCH {host}/mgmt/shared/appsvcs/declare``

.. code-block:: bash

    "path": "/tenant1"
    "op": "add",
    "value": { 
        "app3": {
          "class": "Application",
          ... 
        }
    }

You are indicating that you want to replace tenant1 with the value of the app3 object (or create it if it doesn’t exist), per the RFC (see https://datatracker.ietf.org/doc/html/rfc6902#appendix-A.1). However, BIG-IP AS3 expects an object with "class": "Tenant" at the path "/tenant1", so you will get an invalid declaration error: 

.. code-block:: bash

    {
        "code": 422,
        "declarationFullId": "",
        "message": "declaration is invalid",
        "errors": [
            "/tenant1: should have required property 'class'"
        ]
    }

|

In this second example, we show how to use PATCH to add a new app in a particular tenant. 

Starting with our original declaration:

``GET {host}/mgmt/shared/appsvcs/declare``

.. code-block:: bash

    "declaration": {
        "tenant1": {
          "app1": { ... },
          "app2": { ... }
        },
        "tenant2": {
          "app1": { ... },
          "app2": { ... }
        }
    }

If you want to add a 3rd app to tenant1, you would use the following PATCH (compare the *path* and *value* to the earlier example):

``PATCH {host}/mgmt/shared/appsvcs/declare``

.. code-block:: bash

    "path": "/tenant1/app3"
    "op": "add",
    "value": {
        "class": "Application",
        "template": "generic"
        ...
    }

The resulting declaration looks like the following:

``GET {host}/mgmt/shared/appsvcs/declare``

.. code-block:: bash

    "declaration": {
        "tenant1": {
          "app1": { ... }
          "app2": { ... } 
          "app3": {
              "class": "Application",
              "template": "generic"
              ...
          }
        },
        "tenant2": {
          "app1": { ... },
          "app2": { ... }
        }
    }


|

|

.. _nest:

Example of records returned from GET requests to the /task endpoint
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The following is an example of the new record format for GET requests to the /task endpoint.

.. code-block:: json

   {
      "id": "13fa9776-aba2-48b8-853d-bf47687662fa",
      "results": [{
              "message": "success",
              "tenant": "Gather_test",
              "host": "localhost",
              "runTime": 727,
              "code": 200
          }
      ],
  
      "declaration": {
          "class": "ADC",
          "schemaVersion": "3.0.0",
          "id": "basic-ADC-declaration",
          "controls": {
              "class": "Controls",
              "trace": true,
              "logLevel": "debug",
              "archiveTimestamp": "2019-02-25T23:11:04.117Z"
          },
          "Gather_test": {
              "class": "Tenant",
              "Tenant1": {
                  "class": "Application",
                  "template": "http",
                  "serviceMain": {
                      "class": "Service_HTTP",
                      "virtualAddresses": [
                          "10.0.1.20"
                      ],
                      "pool": "web_pool"
                  },
                  "web_pool": {
                      "class": "Pool",
                      "monitors": [
                          "http"
                      ],
                      "members": [{
                              "servicePort": 80,
                              "serverAddresses": [
                                  "192.0.1.20",
                                  "192.0.1.21"
                              ]
                          }
                      ]
                  }
              }
          },
          "updateMode": "selective"
      }
  
  }


|

.. _querycontrol:


Query Parameters for Controls objects
--------------------------------------
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for query parameters for Controls objects is available in BIG-IP AS3 v3.30 and later.

BIG-IP AS3 3.30 introduced the ability to use some Controls objects as query parameters instead. One of the major benefits of this feature is it allows you to see the affect of a PATCH operation before applying it. For example, you could perform a dry-run of a PATCH request and see a diff of the desired and current state (also known as traceResponse).

For information about the Controls objects, see |controls|.

You can use the following as query parameters: ``controls.dryRun``, ``controls.logLevel``, ``controls.trace``, ``controls.traceResponse``, and ``controls.userAgent``.  

You can visit the |api| (opens in a new browser window) for descriptions of each query parameter.

To use a single parameter, use the following syntax: |br| ``https://{{host}}/mgmt/shared/appsvcs/declare?controls.dryRun=true``

If you wanted to use all the Controls query parameters, use the following syntax: |br| ``https://{{host}}/mgmt/shared/appsvcs/declare?controls.dryRun=true&controls.logLevel=info&controls.trace=true&controls.traceResponse=true&controls.userAgent=theUserAgent``

.. IMPORTANT:: Using the Controls query parameter(s) will overwrite any Controls in the ADC class you specified in the declaration. For example, if you had a controls value for **dryRun** of **false** in your declaration, but had the query parameter value set to **true**, BIG-IP AS3 would use a value of **true** for that controls property.


  




.. |br| raw:: html
   
   <br />


.. |api| raw:: html

   <a href="apidocs.html" target="_blank">API documentation</a>

.. |controls| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#adc-controls" target="_blank">ADC_Controls</a>

   
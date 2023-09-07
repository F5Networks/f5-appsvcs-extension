Per-Application Declarations - Beta
===================================

BIG-IP AS3 3.47 introduces a **beta** feature for a *per-application* deployment model, which enables AS3 declarations to include only some tenant applications, leaving other applications in a tenant unaltered. This can greatly simplify updating the BIG-IP AS3 configuration (especially when the initial declaration is very large with many applications), and ease automated deployments.

In previous releases, BIG-IP AS3 only supported a tenant-based model. This meant all applications had to be included in the tenant; if you posted a declaration that did not include existing applications in that tenant, AS3 deleted them. With the per-application deployment model, you send a request to a new endpoint, which includes the tenant as a part of the URI. This allows you post a declaration that contains only one or more applications, and AS3 leaves the other applications in the tenant untouched.  

.. NOTE:: The source of truth for the BIG-IP configuration remains the entire declaration.  This feature allows you to update this declaration without resending the entire declaration, similar to the PATCH method.  |br| You can use this per-application functionality together with traditional AS3 declarations, as long as you keep in mind when you post a traditional (non-per-application) declaration, it is the source of truth and configures the tenant according to the objects contained in that declaration.

If you have feedback on this beta feature, please open a GitHub issue at https://github.com/F5Networks/f5-appsvcs-extension/issues

.. IMPORTANT:: Because this is a beta feature, we strongly recommend carefully testing it in a contained environment before using it in production.


Enabling the per-application feature
------------------------------------

The first task is to enable this beta feature using the new **betaOptions** property on the **/settings** endpoint. For more information about the settings endpoint, see :doc:`settings-endpoint`.  Currently, the only setting available in betaOptions is **perAppDeploymentAllowed**.

To enable per-application deployments, send a POST to ``HTTPS://<BIG-IP IP address>/mgmt/shared/appsvcs/settings`` with the following request body:

.. code-block:: json

   betaOptions: {
      perAppDeploymentAllowed: true
   }


To see the current settings, or verify the per-application feature is enabled, send a GET request to ``HTTPS://<BIG-IP IP address>/mgmt/shared/appsvcs/settings``.


Example per-application declaration
-----------------------------------

A per-application declaration is similar to a traditional declaration, but there is no Tenant class and the per-application declaration uses a different AS3 endpoint. The per-application declaration allows all CRUD operations to a specific tenant and application in the URI path without specifying the tenant in the declaration.  

The following is an example per-application declaration (note the lack of the Tenant class).

.. literalinclude:: ../../examples/declarations/per-app/example-per-app-single-app-object.json
   :language: json



POSTing a per-application
-------------------------

The URI path for POSTing a per-application declaration is ``/appsvcs/declare/<tenant>/applications``.  

For example, you could send the example declaration to: ``POST HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications`` 

This would update the tenant named **ExampleTenant** as specified in the URI, with the application **Application1** as specified in the example declaration.

.. NOTE:: If you send a POST request and use a tenant name in the URI that does not already exist, AS3 creates a tenant with that name, and puts the applications into the tenant.



Using GET to view applications
------------------------------

There are two API paths you can use for GET requests to per-application declarations:

- ``/appsvcs/declare/<tenant>/applications`` <br> 
- ``/appsvcs/declare/<tenant>/applications/[<application>]``

For example:

 ``GET HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications`` retrieves all applications in ExampleTenant.

``GET HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications/applicationName`` retrieves the **applicationName** application only in ExampleTenant.

You can also send a GET request to the /declare endpoint, and the entire declaration is returned.



Deleting a per-application declaration
--------------------------------------

To delete a specific application, you can send a DELETE request to ``/appsvcs/declare/<tenant>/applications/[<application name>]``.  

You must specify the application(s) you want to delete as a part of the URI.  If you delete all of the applications in a tenant, AS3 deletes the tenant as well.

For example, to delete the **Application1** application from the previous example: ``DELETE HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications/Application1``

|

Additional per-application declarations
---------------------------------------

The following are additional example declarations for per-application deployments.


Per-Application example with multiple applications in the declaration
`````````````````````````````````````````````````````````````````````

The following example includes two applications in the per-application declaration.  

.. literalinclude:: ../../examples/declarations/per-app/example-per-app-multiple-apps.json
   :language: json

Per-Application example with a pool
```````````````````````````````````

This example is a per-application declaration that includes an application with only a pool (no virtual service, or other objects).

.. literalinclude:: ../../examples/declarations/per-app/example-per-app-pool.json
   :language: json







.. |br| raw:: html

   <br />


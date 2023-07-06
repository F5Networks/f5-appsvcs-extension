Per-Application Declarations
============================

BIG-IP AS3 3.46 introduces a *per-application* deployment model, which enables declarations to include only applications, leaving other applications in a tenant unaltered.

In previous releases, BIG-IP AS3 only supported a tenant-based model. This meant posting a declaration with a tenant and, by default, AS3 would not modify other tenants. In this case, all applications had to be included in the tenant; if you posted a declaration that did not include existing applications in that tenant, AS3 deleted them. 

Similar to the tenant-based model, the per-application deployment model allows you post a declaration that contains an application in a tenant and have AS3 leave the other applications in that tenant untouched.


Using a per-application declaration
-----------------------------------

Using a per-application declaration is similar to using a traditional declaration, but there is no tenant class in the declaration and the per-application declaration uses a different URI path. The per-application declaration allows all CRUD operations to a specific tenant and application in the URI path without specifying the tenant in the declaration.  

For traditional declarations to a specific tenant, AS3 supports requests to ``/appsvcs/declare/[<tenant>[,<tenant>,...]]``. The tenants in the path indicate to which tenants the declaration deploys. This means you can POST a declaration with several tenants but include one or more comma-separated tenants in the path. In this case AS3 will only create/modify the tenants in the path.

 

The following is an example per-application declaration (note the lack of the Tenant class):

.. literalinclude:: ../examples/declarations/pre-app/example-per-app-single-app-object.json
   :language: json



POSTing a per-application
`````````````````````````

The URI path for POSTing a per-application declaration is ``/appsvcs/declare/<tenant>/applications``.  For example: ``POST HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications`` 



Using GET to view applications
``````````````````````````````

There are two API paths you can use for GET requests to per-application declarations:

- ``/appsvcs/declare/<tenant>/applications`` <br> 
- ``/appsvcs/declare/<tenant>/applications/[<application>]

For example, ``GET HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications`` retrieves all applications.

``GET HTTPS://192.0.2.10/mgmt/shared/appsvcs/declare/ExampleTenant/applications/applicationName`` retrieves the **applicatoinName** application only.







.. |br| raw:: html

   <br />


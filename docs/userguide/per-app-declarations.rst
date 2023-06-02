Per-Application Declarations
============================

BIG-IP AS3 3.46 introduces a "per-application" deployment model, which enables declarations to include only applications, leaving other applications in a tenant unaltered.

In previous releases, BIG-IP AS3 only supported a tenant-based model. This meant posting a declaration with a tenant and, by default, AS3 would not modify other tenants. In this case, all applications had to be included in the tenant; if you posted a declaration that did not include existing applications in that tenant, AS3 deleted them. 

Similar to the tenant-based model, the per-application deployment model allows you post a declaration that contains an application in a tenant and have AS3 leave the other applications in that tenant untouched.


Using a per-application declaration
-----------------------------------

In previous releases of BIG-IP AS3, AS3 supported 
AS3 currently supports requests to

/appsvcs/declare/[<tenant>[,<tenant>,...]]

The tenants in the path indicate which tenants in the declaration AS3 should look at. In other words, you can POST a declaration with several tenants but include one or more comma-separated tenants in the path. In this case AS3 will only create/modify the tenants in the path.

This proposal is to add support to AS3 to allow all CRUD operations to a specific tenant and application in the URI path without specifying the tenant in the declaration.

/appsvcs/declare/<tenant>/applications/[<application>]

Adding applications to the path before the application name allows for more clarity should we later to decide to allow for further component specification by path. Meanwhile, not adding tenants before the tenant name maintains backwards compatibility with the currently supported URIs. Together, this also allows us to be sure that the user is meaning to do a per-app deployment and not simply wanting to restrict the tenants to those listed. 

Although this is a different meaning of tenant in the path, we feel this makes the most sense for the per-app model.

For POST requests, the application name is not included. The application name will be in the declaration.

Beta flag:

As we want to gather user feedback on this feature, we want to leave open the possibility of modifying the API in the future in a backwards breaking manner. Therefore, at initial release this feature will only be accessible via a beta flag in HTTP requests. There are several ways to achieve this as spelled out in MBIPAPPSVC-883. These include

A beta query parameter which can be set to true on any given request
A beta property in the controls object in the declaration which can be set to true in the declaration
A beta setting which can be set to true in the AS3 settings API
Adding beta to the URI path like /appsvcs/beta/declare 
We can support any one of these or even do some or all of them with a defined order of precedence. This is a PM decision.

Decision: We have decided to only support having a beta flag in the AS3 settings. Once the setting is set, it will remain in effect for all subsequent declarations until the setting is changed back. The flag should allow for more fine grained control than just 'beta enabled / beta disabled'. So we will make an object:

betaOptions: {
    perAppDeploymentAllowed: true
}

Schema validation for beta feature
MBIPAPPSVC-883 covers some of schema validation for shared schema classes. However, we will likely need specialized handling for this feature at least for classic in that it changes what the top-level class is. Two options:

Deliver two separate schemas and choose based on the beta flag
Do the per-app validation in code
Either way, once validated, AS3 can wrap the incoming declaration in AS3/ADC classes and set internal flags so it knows that the rest of the handling is per-app

Decision: We have decided to deliver multiple schemas. AS3 already supports loading more than one schema at startup so we just need runtime code to decide which schema to validate against.

Mutex locking
AS3 on classic is currently restricted to handling one declaration at a time. This is achieved by creating an internal data-group of the name ____appsvcs_lock. If this data group exists at the time that AS3 receives a declaration, it returns a 503 status code. The data-group is then deleted at the end of declaration processing.

Assumptions for the initial release:

We will support handling both per-app and standard APIs on the same instance.
Mutex lock is at the tenant level for per-app deployments.
We will not allow a standard deployment while any per-app deployment is running.
We will not allow a per-app deployment while any standard deployment is running.
We will not allow any deployment when a deployment to /Common is running. (added 3/17/2023 after design review with dev team)
We can make one data-group per tenant and mutex lock AS3 at the tenant level. Because some items (namely virtual addresses) are stored at the tenant level, outside an application, we cannot move the mutex lock to the application level. We can either continue to create the same data-group as well as creating one per tenant even in per-app deployments, or just create the tenant based locks in per-app deployments. This is an implementation detail.

Shared items
AS3 supports two types of shared items

/Common/Shared: items are created in /Common and can be shared by applications in any tenant
/Tenant/Shared: items are created in a tenant and can be shared across applications in the tenant
Decision:

For items in /Common/Shared we will need to determine how to clean these up - either through reference counting or examine how we do this today and see if it is applicable to per-app deployments. Need to look at both use pointers and bigip pointers. It may be acceptable to allow the user to manage this but we should see if we can do it in AS3 code.
For items in /Tenant/Shared, it is up to the user to manage this. Shared will be treated no other than any other application.


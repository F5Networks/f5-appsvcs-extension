.. _big-iq:

Using BIG-IP AS3 with BIG-IQ
============================

.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   BIG-IP AS3 is available in BIG-IQ v6.1.0 and later

.. WARNING:: AS3 versions 3.42 and later are NOT compatible with BIG-IQ.  To see the version of AS3 your BIG-IQ device is running, from the BIG-IQ command line, type: **curl http://localhost:8105/shared/appsvcs/info**.  

BIG-IQ v6.1.0 adds BIG-IP AS3 support, which includes BIG-IP AS3 v3.7.0.  When you use BIG-IP AS3 on BIG-IQ, declarations you send through BIG-IQ enable applications to appear in the UI of BIG-IQ (Applications tab > Applications menu), with support for BIG-IQ's analytics and RBAC capabilities.  For information on viewing applications and analytics in the BIG-IQ UI, see the |bigiqui| documentation. You can also see our |bigiqvideo|.

.. IMPORTANT:: If your BIG-IP does not have BIG-IP AS3 installed or if an older version of BIG-IP AS3 is installed, BIG-IQ installs its version of BIG-IP AS3 onto the target BIG-IP system.  This means if you have a BIG-IP running an LTS version of BIG-IP AS3, and use that BIG-IP as a target for BIG-IQ, the LTS version will be overwritten by the BIG-IP AS3 version on BIG-IQ.

With BIG-IQ, declarations can use an *BIG-IP AS3 template* which is defined in BIG-IQ. See :ref:`template` for an example of a BIG-IP AS3 declaration that uses a BIG-IP AS3 template, and the |bigiqapi| for details related to creating BIG-IP AS3 templates.

You use the same method to post a declaration to BIG-IP AS3 on BIG-IQ as for BIG-IP.  To submit a BIG-IP AS3 declaration, use a specialized RESTful API client such as Postman or a universal client such as cURL. To transmit the declaration, you POST the declaration to the URI ``<BIG-IQ IP address>/mgmt/shared/appsvcs/declare``.  
The way you interact with BIG-IP AS3 on BIG-IQ is mostly the same as on BIG-IP, so the instructions on using BIG-IP AS3 apply to both.  The main differences for BIG-IQ are :ref:`updating`, and optionally :ref:`template`. 


This page contains information specific to running BIG-IP AS3 on BIG-IQ.  BIG-IQ is well-documented in the |bigiq| documentation.

.. _compatnote:

Requirements for using BIG-IP AS3 with BIG-IQ
---------------------------------------------
To use BIG-IP AS3 with BIG-IQ, you must perform the following.  For specific instructions on these tasks, see the BIG-IQ online help or documentation (|bigiq|) or the |bigip| documentation.

.. NOTE:: See |compat| for information on BIG-IQ and BIG-IP AS3 compatibility, and how to upgrade BIG-IP AS3 on a BIG-IQ.

- Install BIG-IQ v6.1.0 or later.
- Manage one or more BIG-IP devices in BIG-IQ.  LTM and any other relevant services should be discovered/imported.
- Specify the target BIG-IP in your BIG-IP AS3 declarations on BIG-IQ.  BIG-IQ can manage multiple BIG-IP devices, so declarations must specify the applicable BIG-IP.
- **NOTE**: BIG-IQ does not yet implement dry-run (see :ref:`as3class-ref`), and if you POST with dry-run the changes will not be made. However, if you look at the declaration on BIG-IQ, it will show the new config as though it were applied.

.. IMPORTANT:: When using the BIG-IQ UI to deploy a BIG-IP AS3 application service, the BIG-IQ uses **IP address** to deploy the app service. We have updated the examples on this page to use a target **address** instead of **hostname**

In order to make use of BIG-IQ's analytics capabilities, you must also:

- Connect at least one (data collection device) to BIG-IQ.
- Use BIG-IP version 13.1.0.5 or newer.
- Provision |avr| (Analytics) on BIG-IP.
- Enable stats for the BIG-IP within BIG-IQ.
- Configure an analytics profile for your service in the declaration.

Additionally, we recommend that:

- You use BIG-IP AS3's **asynchronous** mode (by POSTing with the query parameter **?async=true**).  BIG-IP AS3 waits for applications to be configured in BIG-IQ, which can result in timeouts when using BIG-IP AS3's *synchronous* mode.  See :ref:`post-ref` for more information.  |br| |br| **IMPORTANT**: BIG-IP AS3 3.7.0 introduces new behavior for asynchronous mode. Even if you have asynchronous mode set to false, after 45 seconds BIG-IP AS3 sets asynchronous mode to true (API swap), and returns an async response. This allows you to use GET to poll for status (you should see a 202 status until the declaration is complete).  This typically occurs for most declarations to BIG-IQ (and only very large declarations to BIG-IP); if the declaration completes in less than 45 seconds, BIG-IP AS3 does not modify asynchronous mode. |br| |br|

- You only use BIG-IP AS3 running on BIG-IQ.  BIG-IQ does not support cases where BIG-IP AS3 runs externally.

|

To make use of the RBAC capabilities on BIG-IQ:

- Use BIG-IQ's auth token for authentication (see the |bigiqauth| for specific instructions).
- For application creation, add users to a custom *Application Creator* role, with access to any relevant BIG-IP AS3 templates.
- For each application created, a manager and viewer role are created automatically.

|

.. _bigiq-notes:

Other important notes and warnings
----------------------------------

- When using BIG-IP AS3 3.25+ and BIG-IQ 8.0+, creating objects in **/Common/Shared** is supported. |br| If using a previous version of BIG-IP AS3 or BIG-IQ, object creation in **/Common/Shared** is NOT supported.  In that case, we recommend you use a partition other than /Common, such as **/CommonAS3/Shared**, or upgrade BIG-IP AS3 and/or BIG-IQ. |br| See :ref:`Shared<shared-ref>` in the Reference Guide for information on using /Shared in BIG-IP AS3. 

- Currently, the DELETE method is not supported when using BIG-IQ and BIG-IP AS3 with the **target** field.  Additionally, the PATCH method when using BIG-IQ and BIG-IP AS3 with the **target** field is **only** supported using BIG-IQ 7.0 or later and BIG-IP AS3 3.10.0 and later; previous versions are not supported.

- When BIG-IP AS3 is running on BIG-IQ, **dry-run** (see :ref:`Post Actions<actions-ref>`) is not supported.  Also see https://support.f5.com/csp/article/K23452283.

- Sending a GET request to **/mgmt/shared/appsvcs/declare** is supported on BIG-IQ.

|

.. _updating:

Updating declarations to specify the target BIG-IP
``````````````````````````````````````````````````
This example shows specifying the target BIG-IP IP address (the address should be the BIG-IP discovery address).  You can also specify the **hostname** instead of **address**.

.. IMPORTANT:: BIG-IP AS3 declarations deployed via the BIG-IQ web interface, or sent to a device that is a part of an HA cluster will always use the IP address as the target.

.. literalinclude:: ../../examples/userguide/example-updating-declarations-to-specify-target-big-ip.json
   :emphasize-lines: 9-11
   :language: json

.. _delete-iq:

Deleting the configuration on the target BIG-IP device
``````````````````````````````````````````````````````
If you want delete any of the configuration you previously created on the target BIG-IP device, you simply use POST to send the declaration again, but remove the object(s) you want to delete (see the following examples). 

.. NOTE:: Make sure to use the POST method as described in this section, and **not** the DELETE method.

For instance, using the previous example, if you want to use BIG-IP AS3 on BIG-IQ to delete the pool (web_pool) that was created, use the following declaration which sends the declaration without the pool.

.. literalinclude:: ../../examples/userguide/example-delete-pool-big-iq.json
   :language: json


If you want to use BIG-IP AS3 on BIG-IQ to delete everything in the Sample_http_01 tenant, POST the following declaration.

.. literalinclude:: ../../examples/userguide/example-delete-tenant-big-iq.json
   :language: json



.. _template:

Using declarations with BIG-IP AS3 templates
````````````````````````````````````````````
This example shows a declaration that uses a BIG-IP AS3 template (the **schemaOverlay**) which is defined in BIG-IQ.  In this case, all but the `virtualAddress` are defined in the template.  See the |bigiqapi| for details related to creating BIG-IP AS3 templates.

.. literalinclude:: ../../examples/userguide/example-using-declarations-with-as3-templates.json
   :emphasize-lines: 14
   :language: json

|

.. _bigiqpatch:


Using POST with an action of patch and a patchbody
``````````````````````````````````````````````````
This example shows how you can use POST with an *action* of **patch** to include additional configuration objects in an existing tenant on a BIG-IQ device (which would subsequently be pushed out to BIG-IP devices).  Most of the information is in **patchBody**, which contains the target BIG-IQ device information, and an **add** operation with some additional BIG-IP configuration objects.  

When using this feature, the BIG-IQ allows the same tenant on different targets (*bigiqTenant* in this example), but the application in the tenant must be unique.  Using the following example, you could use the same *bigiqTenant* for two different target BIG-IQs, but there can be only one **myapp2** application.

.. IMPORTANT:: This operation is only valid using the POST method, and **not** the PATCH method. 

.. NOTE:: The target *MUST* be the same as the one used in the initial declaration. |br| BIG-IP AS3 declarations deployed via the BIG-IQ web interface, or sent to a device that is a part of an HA cluster will always use the IP address as the target.


See **patchBody** in the |as3class| and |pitem| in the schema reference for details and usage. 

.. literalinclude:: ../../examples/userguide/example-bigiq-post-patchbody.json
   :language: json


Downgrading BIG-IP AS3 on BIG-IQ
--------------------------------
AS3 versions 3.42 and later are NOT compatible with BIG-IQ.  Use the following procedure to downgrade the version of AS3 on your BIG-IQ if you are experiencing issues with application templates on the BIG-IQ. 

.. IMPORTANT:: This should only be necessary if you are running a version of BIG-IQ that uses AS3 3.42 and later. To see the version of AS3 your BIG-IQ device is running, from the BIG-IQ command line, type: **curl http://localhost:8105/shared/appsvcs/info**.

**To downgrade AS3 on BIG-IQ**

1. Download the RPM package for the version of AS3 you want from |release| to a location accessible from your BIG-IQ. We recommend 3.41.

2. Optional: If your BIG-IQ environment has high availability (HA) setup, you should upgrade the AS3 on the Standby unit before upgrading the active unit. The BIG-IQ HA systems are required use the same AS3 version.

3. Use an SCP client to copy the RPM file to the **/shared/tmp** directory of the BIG-IQ system.  For example, you could run ``scp <path to RPM> root@<BIG-IQ IP>:/shared/tmp/.``

4. Log in to the BIG-IQ command line. 

5. Use the following syntax to downgrade AS3: ``rpm -Uv --oldpackage /shared/tmp/f5-appsvcs-<version>.noarch.rpm``.  For example, ``rpm -Uv --oldpackage /shared/tmp/f5-appsvcs-3.41.0-1.noarch.rpm``  

6. Run the following command to restart the associated services: ``tmsh restart /sys service restjavad restnoded``.

7. Verify the downgraded version is now on BIG-IQ using: ``curl http://localhost:8105/shared/appsvcs/info``

8. Optional: If your BIG-IQ environment has high availability (HA) setup, after you upgrade the AS3 on the standby unit, you can repeat this procedure to upgrade the active unit.



.. |avr| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_analytics/manuals/product/analytics-implementations-13-1-0.pdf" target="_blank">Analytics (PDF)</a>

.. |bigip| raw:: html

   <a href="https://support.f5.com/csp/knowledge-center/software/BIG-IP?module=BIG-IP%20LTM" target="_blank">BIG-IP</a>

.. |bigiq| raw:: html

   <a href="https://support.f5.com/csp/knowledge-center/software/BIG-IQ?module=BIG-IQ%20Centralized%20Management" target="_blank">BIG-IQ</a>

.. |br| raw:: html
   
   <br />

.. |bigiqui| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigiq-7-0-0/monitoring-managing-applications-using-big-iq.html" target="_blank">BIG-IQ Monitoring and Managing Application Services</a>



.. |bigiqauth| raw:: html

   <a href="https://clouddocs.f5.com/products/big-iq/mgmt-api/latest/ApiReferences/bigiq_public_api_ref/r_auth_login.html" target="_blank">BIG-IQ auth documentation</a>


.. |bigiqapi| raw:: html

   <a href="https://clouddocs.f5.com/products/big-iq/mgmt-api/latest/ApiReferences/bigiq_public_api_ref/r_as3_template.html" target="_blank">BIG-IQ API documentation</a>

.. |as3class| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#as3" target="_blank">AS3 Class</a>

.. |pitem| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#as3-patch-item" target="_blank">AS3_Patch_Item</a>

.. |bigiqvideo| raw:: html

   <a href="https://www.youtube.com/watch?v=RPmz3IOwqLE&feature=youtu.be" target="_blank">BIG-IQ and BIG-IP AS3 video</a>

.. |compat| raw:: html

   <a href="https://support.f5.com/csp/article/K54909607" target="_blank">K54909607</a>

.. |release| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">AS3 releases on GitHub</a>


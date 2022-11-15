.. _access-examples:

Access-Related declarations
---------------------------
This section contains access-related declarations, typically involving BIG-IP |apm|. You must have BIG-IP APM licensed and provisioned to use these profiles.

.. NOTE:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

Use the index on the right to locate specific examples.

.. IMPORTANT:: BIG-IP AS3 3.24 adds the ability to update APM policies.  Updating Access Policy Management objects can be a slow process and may cause BIG-IP AS3 declarations to take longer to apply.



.. _accessconn:


Referencing existing Access and Connectivity profiles
`````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing existing Access and Connectivity profiles is available in BIG-IP AS3 3.14.0 and later. 

This simple example shows how you reference existing Access and Connectivity profiles in BIG-IP AS3 version 3.14.0 and later.  These profiles must already exist on the BIG-IP system; BIG-IP AS3 does not create these objects.

For detailed information on these profiles, see |connectprof| and the appropriate |apmdocs| for Access profile information.  You can also see |connref| and |accessref| in the Schema Reference for usage options.


This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Example_APM_profiles**.
- A virtual service named **APMprofile_vs**, which references Connectivity and Access profiles on the BIG-IP.


.. literalinclude:: ../../examples/declarations/example-connectivity-access-profiles.json
   :language: json


:ref:`Back to top<access-examples>`

|

.. _apex:

Referencing an external IAM policy using a URL (UPDATED)
````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing .gz files is available in 3.21 and later. |br| Support for the **enable** property is available in BIG-IP AS3 3.23 and later.
   
This example shows how you can reference an external IAM policy (also called an Access Profile) using a URL (see :ref:`iamaccess` for details on these names).

.. NOTE:: In versions *prior* to 3.21, BIG-IP AS3 only supports URLs referencing .tar files. BIG-IP AS3 3.21 adds support for referencing .gz files. |br| |br| The properties **policyIAM** and **profileAccess** in the *Service_HTTP* and *Service_HTTPS* classes are references to the same object; use only one in a declaration. 

For detailed information on Access Profiles, see the |profiledocs| for your version of APM.  You can also see |servhttp| and |servhttps| in the Schema Reference for usage options.

NEW in BIG-IP AS3 3.23
^^^^^^^^^^^^^^^^^^^^^^
BIG-IP AS3 3.23 introduces the **enable** property. When set to **true**, this property effectively "applies" the policy in APM (the equivalent to clicking **Apply** in the BIG-IP UI).  Prior to version 3.23, users had to manually apply the policy outside of BIG-IP AS3.

It is important to understand how the **enable** property works with the **ignoreChanges** property.  The ignoreChanges property determines when a policy is updated. The enable property determines when it is applied.  See the following table for a matrix of options.

+--------------------+----------------------------------------+--------------------------------------------------------------------------------------------------------+
|                    | **ignoreChanges: false**               | **ignoreChanges: true**                                                                                |
+--------------------+----------------------------------------+--------------------------------------------------------------------------------------------------------+
| **enable: false**  | APM policy is updated, but not applied | No action                                                                                              |
+--------------------+----------------------------------------+--------------------------------------------------------------------------------------------------------+
| **enable: true**   | APM policy is updated and applied      | APM policy is not updated (though it may be created), and the policy is applied if it was just created |
+--------------------+----------------------------------------+--------------------------------------------------------------------------------------------------------+



.. IMPORTANT:: In BIG-IP AS3 versions prior to 3.24, if you are updating a policy, you MUST update your virtual server to reference the updated policy. When a policy is updated, the system makes the name unique by incrementing a number on the end of the name. For example, if a policy was named "myAccessPolicy" in the initial declaration, if you update the declaration, the Access policy name is changed to "myAccessPolicy_1".  You must update the virtual server to use the new policy name. |br| In BIG-IP AS3 3.24 and later, this is no longer necessary, however updating Access Policy Management objects can be a slow process and may cause BIG-IP AS3 declarations to take longer to apply.



This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Sample_Access_profile**.
- A virtual service named **APMservice**, which references an Access Profile .tar file via URL, and has both ignoreChanges and enabled set to **true**.


.. literalinclude:: ../../examples/declarations/example-referencing-access-profile-url.json
   :language: json


:ref:`Back to top<access-examples>`

|

.. _perrequest:


Referencing an external Per Request Access policy using a URL
`````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing external per-request policies via URL is available in BIG-IP AS3 3.23 and later. 

This example shows how you can reference an external Per-Request Access policy via URL. You can reference both .tar and .gz files.  

For detailed information on Per-Request policies, see the |profiledocs| for your version.
 
You can also see |request|, as well as |servhttp| and |servhttps| in the Schema Reference for usage options.


This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Sample_Per_Request_Access_Policy**.
- A virtual service named **APMservice**, which references a Per-Request policy and an Access Profile .tar file via URL.


.. literalinclude:: ../../examples/declarations/example-referencing-per-request-access-policy-url.json
   :language: json


:ref:`Back to top<access-examples>`

|

.. _vdi:


Referencing existing VDI profiles
`````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing existing VDI profiles is available in BIG-IP AS3 3.24 and later. |br| You MUST have BIG-IP APM licensed and provisioned to use VDI profiles.

This example shows how you can reference VDI profiles that already exist on your BIG-IP device in BIG-IP AS3 3.24 and later. A VDI profile is a group of settings that you can use to enable and configure VDI services such as Citrix, VMware View and Microsoft RDP, so they work with BIG-IP APM.

For more information on using VDI profiles, see |vdidocs|.  For detailed information on using BIG-IP APM, see the |profiledocs| for your version.
 
You can also see |pvdi|, as well as |servhttp| and |servhttps| in the Schema Reference for usage options.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **VDI_Service_HTTP**.
- An Application named **VDIApp**
- A virtual server named **service** that includes references to existing VDI, Access, and Connectivity profiles.


.. literalinclude:: ../../examples/declarations/example-referencing-vdi-profiles.json
   :language: json


:ref:`Back to top<access-examples>`

|

.. _apmprofiles:


Using multiple APM profiles in a declaration
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for adding and referencing multiple APM profiles is available in BIG-IP AS3 3.25 and later. |br| BIG-IP AS3 3.36 and later adds the **ssloCreated** property.

This example shows how you can add and reference multiple APM (Access) profiles in a single BIG-IP AS3 declaration.  This makes use of the special **Shared** application, which holds objects other applications can share.

**New in BIG-IP AS3 3.36** |br|
BIG-IP AS3 3.36 added the **ssloCreated** property.  This was to correct an issue where you could not attach SSL Orchestrator access profiles because RBA and WEBSSO profiles are automatically attached tot he policy.  You set the **ssloCreate** property to **true** if the profile was created by SSLO.  When set to true, the non-configurable Kerberos Request-Based Authentication (/Common/rba) and WebSSO (/Common/websso) profiles are not automatically attached to Services when this profile is attached.

For detailed information on using BIG-IP APM, including APM Access profiles, see the |profiledocs| for your version.

This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **tenant1a**.
- An Application named **application1a**
- A virtual server named **APMservice** that includes a pointer to an Access profile.
- An Application named **application1b**
- A virtual server named **APMservice** that includes a pointer to an Access profile.
- An Application named **Shared** that uses the **shared** template.
- An Access Profile named **accessProfileTenant1a** that references the profile via URL, and is available for the applications/virtual servers in tenant1a to use.


- A partition (tenant) named **tenant2a**.
- An Application named **application**
- A virtual server named **APMservice** that includes a pointer to an Access profile in /Common/Shared.


- A partition (tenant) named **Common**.
- An Application named **Shared** that uses the **shared** template.
- An Access Profile named **accessProfileCommon** that references the profile via URL, and is available for the application/virtual server in tenant2a to use.

NOTE: If you attempt to use this declaration on a version prior to 3.36, it will fail.  On previous versions, remove the **ssloCreate** lines, highlighted in yellow.

.. literalinclude:: ../../examples/declarations/example-apm-profiles.json
   :language: json
   :emphasize-lines: 38, 67


:ref:`Back to top<access-examples>`

.. |apm| raw:: html

   <a href="https://www.f5.com/products/security/access-policy-manager" target="_blank">Access Policy Manager</a>


.. |connectprof| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-0-0/big-ip-access-policy-manager-network-access-14-0-0/defining-connectivity-options.html" target="_blank">Connectivity profile documentation</a>

.. |apmdocs| raw:: html

   <a href="https://support.f5.com/csp/knowledge-center/software/BIG-IP?module=BIG-IP%20APM&version=14.0.0" target="_blank">APM documentation</a>


.. |connref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-connectivity-profile" target="_blank">Pointer_Connectivity</a>

.. |accessref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-access-profile" target="_blank">Pointer_Access</a>

.. |br| raw:: html

   <br />

.. |servhttp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-http" target="_blank">Service_HTTP</a>

.. |servhttps| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-https" target="_blank">Service_HTTPS</a>


.. |profiledocs| raw:: html

   <a href="https://support.f5.com/csp/knowledge-center/software/BIG-IP?module=BIG-IP%20APM" target="_blank">BIG-IP APM documentation</a>


.. |request| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-per-request-access-policy" target="_blank">Pointer_Per_Request_Access_Policy</a>


.. |vdidocs| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-1-0/big-ip-access-policy-manager-third-party-integration-14-1-0.html" target="_blank">BIG-IP APM Third-Party Integration Guide</a>

.. |pvdi| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-vdi-profile" target="_blank">Pointer_VDI_Profile</a>


.. _pe-examples:

Policy Enforcement
------------------
This section contains example policy enforcement declarations.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.


.. _pemex:

Using BIG-IP PEM in a declaration
`````````````````````````````````
This example shows how you can use BIG-IP Policy Enforcement Manager (PEM) in your BIG-IP AS3 declarations.  BIG-IP PEM helps you deliver high-quality customized services while optimizing your network by efficiently managing the explosion of data and traffic. For more information on BIG-IP PEM, see |PEM| and |PEMsupport|.  Also see the :ref:`Schema Reference<schema-reference>` for usage options for your BIG-IP AS3 declarations.

.. IMPORTANT:: You **must** have the Policy Enforcement Manager (PEM) module licensed and provisioned on your BIG-IP to use these features.

.. NOTE:: The following example declaration includes all of the PEM options currently available. BIG-IP AS3 currently does not create many of the PEM options, so these objects MUST be present on your BIG-IP system and properly referenced in your declaration. The objects that must be present on the BIG-IP include: pem interception-endpoint, pem irule, pem service-chain-endpoint, pem reporting format-script,  pem quota-mgmt rating-group, pem forwarding-endpoint, net bwc policy, net vlan, ltm virtual (internal).  See the |PEMsupport| for information on creating these objects.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_pe_01**.
- Because of the large number of objects created and referenced by this declaration, we do not list them all here.  See the declaration and the :ref:`Schema Reference<schema-reference>` for usage options.

.. literalinclude:: ../../examples/declarations/example-big-ip-pem.json
   :language: json


:ref:`Back to top<pe-examples>`

|

.. _pemirule:

Using BIG-IP PEM iRules in a declaration
````````````````````````````````````````
This example shows how you can use BIG-IP Policy Enforcement Manager (PEM) iRules in your BIG-IP AS3 declarations.

BIG-IP PEM iRules have some differences from typical BIG-IP iRules, see the documentation for details (|pemref| and |pempol|, |PEM| and |PEMsupport|).

Also see |pemirule| for usage options in your BIG-IP AS3 declarations.

.. IMPORTANT:: You **must** have the Policy Enforcement Manager (PEM) module licensed and provisioned on your BIG-IP to use these features.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_pem_irule_01**.
- An Enforcement Policy named **testPemPolicy** which contains rules which point to PEM iRules.
- Two Enforcement (PEM) iRules.

.. literalinclude:: ../../examples/declarations/example-pem-irule.json
   :language: json


:ref:`Back to top<pe-examples>`

|

.. _bandwidthcp:

 

Using a Bandwidth Control policy in a virtual service
`````````````````````````````````````````````````````
This example shows how you can reference a Bandwidth Control policy in a virtual service with the new **policyBandwidthControl** pointer in the Service classes. Bandwidth Control policies allow you to restrict bandwidth usage per subscriber, group of subscribers, per application, and so on.  For more information, see |bwc|. For BIG-IP AS3 usage, see |servgen| or another Service object in the Schema Reference.

.. NOTE:: The policyBandwidthControl property must point to a **static** policy, and not a dynamic policy.  See |bwcp| for usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **myService** that references the bandwidth control policy.
- A bandwidth control policy named **bwcPolicy** that sets maxBandwidth to 10Mbps.

.. literalinclude:: ../../examples/declarations/example-bwc-policy-ref-from-service.json
   :language: json


:ref:`Back to top<pe-examples>`


.. |PEM| raw:: html  
   
   <a href="https://www.f5.com/products/big-ip-services/policy-enforcement-manager" target="_blank">PEM on f5.com</a>

.. |PEMsupport| raw:: html  
   
   <a href="https://support.f5.com/csp/knowledge-center/software/BIG-IP?module=BIG-IP%20PEM&version=13.1.1" target="_blank">PEM on AskF5</a>

.. |pemirule| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#enforcement-irule" target="_blank">Enforcement_iRule</a>

.. |pempol| raw:: html

   <a href="https://clouddocs.f5.com/api/irules/PEM_policy_cmd.html" target="_blank">PEM Policy documentation</a>

.. |pemref| raw:: html

   <a href="https://clouddocs.f5.com/cli/tmsh-reference/latest/modules/pem/pem-irule.html" target="_blank">PEM iRules in the TMSH reference</a>

.. |bwc| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip-pem/manuals/product/pem-implementations-13-1-0/14.html" target="_blank">Configuring Global Application Policies with Bandwidth Control</a>
   
.. |bwcp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#bandwidth-control-policy" target="_blank">Bandwidth_Control_Policy</a>

.. |servgen| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-generic" target="_blank">Service_Generic</a>

.. |br| raw:: html

   <br />



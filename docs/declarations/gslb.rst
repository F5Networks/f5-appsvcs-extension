.. _gslbexamples:

BIG-IP DNS (GTM) and GSLB 
-------------------------
This section contains declarations for Global Server Load Balancing (GSLB) which requires the BIG-IP DNS (formerly GTM) module to be licensed and provisioned.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.


.. _dnsex:


Using BIG-IP DNS features in a declaration
``````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for using a DNS logging profile is available in BIG-IP AS3 v3.41 and later

This example shows how you can use some BIG-IP DNS features (DNS profiles, TSIG keys, DNS Zones, Nameservers) in a BIG-IP AS3 declaration.  The DNS features we use in this declaration are well-documented in the |dnsexpress|, so for specific information, see this documentation.  Also see the :ref:`Schema Reference<schema-reference>` for usage options for using these features in your BIG-IP AS3 declarations.

**New in AS3 3.41** |br|
AS3 3.41 introduced the ability to create a DNS Logging profile, using the new |dnslog| class.  The DNS logging profile enables query or response logging, and defines the
format of messages themselves.  See |dnslog| for available properties, descriptions, and AS3 usage.

This declaration creates the following objects on the BIG-IP:

NOTE: If you attempt to use this declaration on a version prior to 3.41, it will fail.  On previous versions, remove the **DNS_Logging_Profile** lines, highlighted in yellow.

- Partition (tenant) named **Sample_non_http_03**.
- A virtual server named **service**.
- A DNS Zone that uses DNS Express. 
- A DNS Nameserver Zone.
- A DNS TSIG Key using the hmacmd5 algorithm. 
- A DNS Logging profile named **profileDnsLogging**.


.. literalinclude:: ../../examples/declarations/example-big-ip-dns-features.json
   :language: json
   :emphasize-lines: 80-93, 117-120


:ref:`Back to top<gslbexamples>`

|

.. _gslbex:


Using GSLB features in a declaration   
````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for using **ratio** on a pool and GSLB iRules are available in BIG-IP AS3 v3.37 and later

This example shows how you use F5s Global Server Load Balancing (GSLB) features in a declaration. You must have BIG-IP DNS (formerly GTM) provisioned to use these features. See the :ref:`Schema Reference<schema-reference>` for usage options and additional features for GSLB. 

.. WARNING:: When using GSLB features, you must be aware of the items pointed out in :ref:`Warnings<gslbnote>`, notably BIG-IP AS3 completely overwrites non-AS3 topologies when a declaration is submitted.

.. NOTE:: GSLB Pool members reference GSLB virtual servers by name. GSLB virtual servers are given a name based on their order in the list of GSLB virtual servers. The first GSLB virtual server is named **0**, the second is **1**, and the third is **2**. Starting BIG-IP AS3 3.21, GSLB virtual servers can be given a user defined name that overrides the default name.

**New in BIG-IP AS3** |br|
The following list describes changes to this example since it was published:

.. list-table::
      :widths: 25 25 200
      :header-rows: 1

      * - BIG-IP AS3 Version
        - Property
        - Description

      * - 3.46
        - 
        - Added members to the Prober pool in the example declaration. This did not change the functionality of the example. Prober pools are created in /Common.
      
      * - 3.37
        - **ratio**
        - Adds the ability to set a ratio for the pool when using the ratio load balancing method. This ratio allows you to distribute requests among several resources based on a priority level or weight assigned to each resource. For example, you could use ratio to send twice as many connections to a fast, new server, and half as many connections to an older, slower server.  See |gslbdp|.

      * - 
        - **GSLB_iRule**
        - This property specifies or configures an iRule for use in GSLB domains. For additional information and BIG-IP AS3 usage, see |gslbirule| in the Schema Reference. 

|

This declaration creates the following objects on the BIG-IP (**NOTE** If you attempt to use this declaration on a version prior to 3.37, it will fail.  On previous versions, remove the **ratio** lines from the pools and the GSLB iRule, highlighted in yellow):

- Partition (tenant) named **Sample_non_http_05**. 

  - A GSLB wide IP (domain) named **example.edu** with an alias of **another.example**, and references two pools with different ratios.
  - Two GSLB pools named **testPool** and **testPool2** with various properties. Also references a GSLB iRule.
  - A GSLB iRule named **testGSLB_iRule** that includes a base64 encoded iRule.
- A reference to the **Common** partition using the **shared** template.

  - A GSLB data center named **testDataCenter**.
  - A GSLB server named **testServer** with a device and two virtual servers. **Important**: A GSLB_Server must always be in /Common/Shared as shown in the example.


.. literalinclude:: ../../examples/declarations/example-gslb-features.json
   :language: json
   :emphasize-lines: 18, 22, 26-28, 77-82


:ref:`Back to top<gslbexamples>`

|

.. _dnscache:

Creating a DNS cache in a declaration  
`````````````````````````````````````   
This example shows how can create a DNS cache in a declaration (in versions prior to 3.13 you could reference a cache, but not create one). A DNS Cache allows the system to more quickly respond to repeated DNS queries. See the |dnscash| chapter of the BIG-IP DNS Implementation guide for detailed information.

You must have BIG-IP DNS (formerly GTM) provisioned to use these features. 

See |cacheref| in the :ref:`Schema Reference<schema-reference>` for usage options and additional features for DNS Cache.



This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_DNS_Cache**. 
- A DNS Cache object named **DNSCache_example** that contains a number of options. See |cacheref| for details.

.. literalinclude:: ../../examples/declarations/example-dns-cache.json
   :language: json


:ref:`Back to top<gslbexamples>`

|

.. _gslbsd:


Service Discovery for virtual servers in GSLB Servers  
`````````````````````````````````````````````````````
This simple example shows how you can use Service Discovery to automatically discover virtual servers in GSLB Servers. You must have BIG-IP DNS (formerly GTM) provisioned to use these features. See |gslbserver| in the :ref:`Schema Reference<schema-reference>` for usage options and additional features for GSLB. **Important**: A GSLB_Server must always be in /Common/Shared as shown in the example.

.. WARNING:: When using GSLB features, you must be aware of the items pointed out in :ref:`Warnings<gslbnote>`, notably BIG-IP AS3 completely overwrites non-AS3 topologies when a declaration is submitted.

.. IMPORTANT:: In BIG-IP AS3 3.25 and later, you can no longer rename GLSB_Server objects that reside in /Common.  If you need to rename a GSLB_Server, you must first delete the GSLB_Server, and then submit a new declaration with the new name.

This declaration creates the following objects on the BIG-IP (this declaration does not create a tenant, but uses the Common tenant as required for some GSLB features):

- A GSLB data center named **testDataCenter**.
- A GSLB server named **testServer** with one device, **virtualServerDiscoveryMode** set to **enabled-no-delete** (which only allows Service Discovery to add or modify, but not delete), and **exposeRouteDomainsEnabled** set to **true** (which allows virtual servers from all route domains to be auto-discovered).

.. literalinclude:: ../../examples/declarations/example-gslb-discovery.json
   :language: json


:ref:`Back to top<gslbexamples>`

|

.. _gslbservername:

Specifying a GSLB virtual server name in a declaration 
``````````````````````````````````````````````````````
In this example, we show how you can specify a GSLB virtual server name in a declaration.  In versions prior to 3.21, you were able to reference the GSLB virtual name, but the name defaulted to the index when created by AS3. In BIG-IP AS3 3.21, the name field is available field as optional, which allows you to override the name defaulting to the index.

For additional details and BIG-IP AS3 usage, see |gslbvip| in the Schema Reference. **Important**: A GSLB_Server must always be in /Common/Shared as shown in the example.

In BIG-IP AS3 3.25 and later, you can no longer rename GLSB_Server objects that reside in /Common.  If you need to rename a GSLB_Server, you must first delete the GSLB_Server, and then submit a new declaration with the new name.

**New in AS3 3.41** |br|
AS3 3.41 adds the ability to include persistence options to a |gslbdom|. The persistence options were not available in previous versions.

This declaration creates the following objects on the BIG-IP (**NOTE** If you attempt to use this declaration on a version prior to 3.41, it will fail.  On previous versions, remove the persistence properties from the GSLB Domain, highlighted in yellow):

- Partition (tenant) named **Example_Tenant**. 
- A GSLB Domain named **testDomain** that defines domain properties, including persistence options, and references a Pool.
- A GSLB pool named **testPool** which references a virtual server later in the declaration.
- A reference to the **Common** partition, which includes an Application named **shared** and uses the shared template
- A GSLB Data Center named **testDataCenter**.
- A GSLB server named **testServer** that references the data center, and includes a device, and a virtual server named **virtualAddress1** (which is also referenced from the **testPool**)

.. literalinclude:: ../../examples/declarations/example-gslb-custom-server-name.json
   :language: json
   :emphasize-lines: 25-27

:ref:`Back to top<gslbexamples>`

|

.. _gslbpool:

Creating a GSLB pool
````````````````````
In this example, we show how to create GSLB pools in a declaration.  This example shows the minium values creating each of the available GSLB pool types (A, AAAA, CNAME, and MX), as well as the other GSLB objects to create a complete configuration. 

See the |apool| for additional information on GSLB pools.  Also see |bigdns| for your specific version.

For BIG-IP AS3 usage, see |poolref| in the Schema Reference. 

**New in BIG-IP AS3 3.25** |br|
BIG-IP AS3 3.25 and later introduced the **enabled** property on GSLB Pool *members* (previously you could enable the pool itself, not individual members). This allows you to specify whether the pool member and its resources are available for load balancing.  The default is **true**.  For more information and BIG-IP AS3 usage, see the GSLB Pool Member tables in the Schema Reference, for example |poolmember|.

.. IMPORTANT:: In BIG-IP AS3 3.25 and later, you can no longer rename GLSB_Server objects that reside in /Common.  If you need to rename a GSLB_Server, you must first delete the GSLB_Server, and then submit a new declaration with the new name.

|

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **ExampleTenant**. 
- A GSLB Domain named **testDomainAAAA** that defines domain properties and references the AAAA pool.
- A GSLB pool named **testPoolAAAA** which references a GSLB server.
- A GSLB Domain named **testDomainA** that defines domain properties and references the A pool.
- A GSLB pool named **testPoolA** which references the same GSLB server.
- A GSLB Domain named **testDomainCNAME** with a resource record type of CNAME that references the CNAME pool.
- A GSLB pool named **testPoolCNAME** with a resource record type of CNAME.
- A GSLB Domain named **testDomainMX** with a resource record type of MX that references the MX pool.
- A GSLB pool named **testPoolMX** with a resource record type of MX.
- A reference to the **Common** partition, which includes an Application named **shared** and uses the shared template.
- A GSLB Data Center named **testDataCenter**.
- A GSLB server named **testServer** that references the data center, and includes a device, and virtual servers.
- A GSLB Domain named **testDomain** with a domain name and a resource record type of A.

.. IMPORTANT:: This example has been updated with the **enabled** property for pool members in BIG-IP AS3 3.25 and later.  If you attempt to use this declaration in an earlier version, it will fail.  To use this declaration on a version prior to 3.25, remove the **enabled** property lines in the GSLB_Pools (highlighted in yellow).

.. literalinclude:: ../../examples/declarations/example-gslb-pools.json
   :language: json
   :emphasize-lines: 69, 93, 114, 137

:ref:`Back to top<gslbexamples>`

|

.. _dependson:

Using the depends-on property in GSLB pools 
```````````````````````````````````````````
In this example, we show how you can use the **depends-on** property in your GSLB pool declaration. This property allows you to specify the name of the virtual server on which this pool member depends. 

When using **depends-on** to refer to the GSLB server and the associated virtual server, you must use the following syntax (including **/Common/Shared/**):

``/Common/Shared/<NAME_OF_GSLB_SERVER>:<GSLB_SERVER_VIRTUAL>``

.. NOTE:: The system displays an error if you do not use this syntax.

See the |apool| for additional information on GSLB pools. 

For BIG-IP AS3 usage, see |refa| and |refaaaa| in the Schema Reference. 

.. IMPORTANT:: In BIG-IP AS3 3.25 and later, you can no longer rename GLSB_Server objects that reside in /Common.  If you need to rename a GSLB_Server, you must first delete the GSLB_Server, and then submit a new declaration with the new name.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **ExampleTenant**.
- A GSLB Domain named **testDomainA** that defines domain properties and references the pool for A records.
- A GSLB pool named **testPoolA** with a resource type of A and two server members, both referencing the same GSLB server. The first does not reference a virtual server and uses **depends-on** set to **none**, the second references the first two virtual servers in the GSLB Server (defined later in the declaration) and uses the **depends-on** property to specify two virtual servers.
- A GSLB Domain named **testDomainAAAA** that defines domain properties and references the AAAA pool.
- A GSLB pool named **testPoolAAAA** with a resource type of AAAA and two server members, both referencing the same GSLB server. The first references a virtual server and uses the **depends-on** property to specify one virtual server (the second) in the GSLB Server (defined later in the declaration), the second server references on virtual server (the fourth) in the GSLB Server and uses **depends-on** set to **none**
- A reference to the **Common** partition, which includes an Application named **Shared** and uses the Shared template.
- A GSLB Data Center named **testDataCenter**.
- A GSLB server named **testServer** that references the data center, and includes a device, and four virtual servers referenced from the pools.


.. literalinclude:: ../../examples/declarations/example-gslb-depends-on.json
   :language: json

:ref:`Back to top<gslbexamples>`

|

.. _gslbvs:


Service Discovery for virtual servers in GSLB Servers
`````````````````````````````````````````````````````
This simple example shows how you can use Service Discovery to automatically discover virtual servers in GSLB Servers. You must have BIG-IP DNS (formerly GTM) provisioned to use these features. See |gslbserver| in the :ref:`Schema Reference<schema-reference>` for usage options and additional features for GSLB.

.. WARNING:: When using GSLB features, you must be aware of the items pointed out in :ref:`Warnings<gslbnote>`, notably BIG-IP AS3 completely overwrites non-AS3 topologies when a declaration is submitted.  |br| BIG-IP DNS must be licensed and provisioned to use this declaration.

.. IMPORTANT:: In BIG-IP AS3 3.25 and later, you can no longer rename GLSB_Server objects that reside in /Common.  If you need to rename a GSLB_Server, you must first delete the GSLB_Server, and then submit a new declaration with the new name.

This declaration creates the following objects on the BIG-IP (this declaration does not create a tenant, but uses the Common tenant as required for some GSLB features):

- A GSLB data center named **testDataCenter**.
- A GSLB server named **testServer** with one device, **virtualServerDiscoveryMode** set to **enabled-no-delete** (which only allows Service Discovery to add or modify, but not delete), and **exposeRouteDomainsEnabled** set to **true** (which allows virtual servers from all route domains to be auto-discovered).

.. literalinclude:: ../../examples/declarations/example-gslb-discovery.json
   :language: json

:ref:`Back to top<gslbexamples>`

|

.. _gslbpooluse:


Referencing a virtual server in a GSLB pool with a use pointer
``````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing a virtual server with a use pointer in a GSLB pool is available in BIG-IP AS3 v3.44 and later. You must have BIG-IP DNS (formerly GTM) provisioned to use these features.

This example shows how you can reference a virtual server in a GSLB pool with a **use** pointer to a virtual server defined in the declaration. In previous versions, you would have to include the full path to the virtual server on the BIG-IP.  See |poolref| and |useref| in the :ref:`Schema Reference<schema-reference>` for usage options and additional features for GSLB.

.. NOTE:: When using GSLB features, you must be aware of the items pointed out in :ref:`Warnings<gslbnote>`, notably BIG-IP AS3 completely overwrites non-AS3 topologies when a declaration is submitted.  


This declaration creates the following objects on the BIG-IP:

- A GSLB data center named **testDataCenter**.
- A GSLB server named **testServer** with one device and a reference to the data center.
- A tenant named **TEST_GSLB_Pool**.
- An Application named **application**.
- A GSLB pool named **gslbPool** with use pointers to the GSLB server and the virtual server defined below it.
- A virtual server named **virtualServer** referred to in the GSLB pool.

.. literalinclude:: ../../examples/declarations/example-gslb-pool-virtual-server-use-ref.json
   :language: json

:ref:`Back to top<gslbexamples>`


.. |dnsexpress| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-dns-services-implementations-13-1-0.html" target="_blank">BIG-IP DNS Services: Implementations guide</a>


.. |gslbserver| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-server" target="_blank">GSLB Server</a>

.. |dnscash| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-dns-services-implementations-14-1-0/07.html" target="_blank">Configuring DNS Caching</a>


.. |cacheref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dns-cache" target="_blank">DNS_Cache</a>

.. |gslbvip| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-virtual-server" target="_blank">GSLB_Virtual_Server</a>


.. |br| raw:: html

   <br />

.. |apool| raw:: html

   <a href="https://clouddocs.f5.com/cli/tmsh-reference/v15/modules/gtm/gtm_pool_a.html" target="_blank">TMSH reference</a>

.. |refa| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-pool-member-a" target="_blank">GSLB_Pool_Member_A</a>


.. |refaaaa| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-pool-member-aaaa" target="_blank">GSLB_Pool_Member_AAAA</a>

.. |bigdns| raw:: html

   <a href="https://support.f5.com/csp/knowledge-center/software/BIG-IP?module=BIG-IP%20DNS" target="_blank">BIG-IP DNS Documentation</a>

.. |poolref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-pool">GSLB_Pool</a>

.. |useref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-gslb-pool">Pointer_GSLB_Pool</a>

.. |poolmember| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-pool-member-a">GSLB_Pool_Member_A</a>

.. |gslbirule| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-irule">GSLB_iRule</a>

.. |gslbdp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-domain-pools">GSLB_Domain_Pools</a>

.. |gslbdom| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-domain">GSLB_Domain</a>


.. |dnslog| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dns-logging-profile">DNS_Logging_Profile</a>

   
.. _sd-examples:

Service Discovery
-----------------
This section contains declarations that discover pool members automatically or dynamically using Service Discovery. Service discovery enables the BIG-IP system to automatically update members in a load balancing pool based on cloud application hosts. You simply tag your cloud resources with key and value information, and then in the declaration you POST information about your cloud environment, including the cloud tag key and tag value you specified, and the BIG-IP VE programmatically discovers members with those tags (and removes pool members if they do not have the tags).

Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name. 

This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

For information on usage options for Service Discovery, see the schema reference, starting with |awssd|.

.. _sd-changes:

Changes to Service Discovery in BIG-IP AS3 3.28 and later
````````````````````````````````````````````````````````````````
Starting with BIG-IP AS3 3.28, BIG-IP AS3 installs or uninstalls F5 Service Discovery based on whether it is enabled or disabled.

There are two different scenarios:

1. When BIG-IP AS3 starts, it checks to see if Service Discovery is enabled or disabled.

   - If Service Discovery is *enabled*, BIG-IP AS3 installs it on the *local* device if it is not already installed.
   - If Service Discovery is *disabled*, BIG-IP AS3 uninstalls it on the *local* device if it is not already uninstalled.

2. When BIG-IP AS3 receives a declaration that targets a remote BIG-IP, it checks to see if Service Discovery is enabled or disabled.  

   - If Service Discovery is *enabled*, BIG-IP AS3 installs it on the *remote* device if it is not already installed.
   - If Service Discovery is *disabled*, BIG-IP AS3 uninstalls it on the *remote* device if it is not already uninstalled.


BIG-IP AS3 does *not* install or uninstall Service Discovery on the local device when receiving a declaration which targets that local device. This is because installing or uninstalling Service Discovery restarts AS3, which causes a service disruption.

Therefore, BIG-IP AS3 only installs or uninstalls Service Discovery locally when BIG-IP AS3 first starts.  You must be aware of the following scenarios:

1. You disable Service Discovery when it was previously enabled and installed.

   - Service Discovery remains installed until BIG-IP AS3 is restarted.
  
2. You enable Service Discovery when it was previously disabled and uninstalled

   - Service Discovery remains uninstalled until BIG-IP AS3 is restarted. You are not able to use the Service Discovery features of BIG-IP AS3 until BIG-IP AS3 is restarted and Service Discovery is installed. Until then, you will receive an error when trying to use Service Discovery features, stating that ``{declaration item} requires Service Discovery to be installed. Service Discovery will be installed the next time BIG-IP AS3 starts up``.



You can restart BIG-IP AS3 by restarting the **restnoded** service. To restart **restnoded**, use one of the following methods:

- From the BIG-IP command line, use the command ``bigstart restart restnoded``
- POST the following request body to **/mgmt/tm/sys/service**: ``{ "command":"restart", "name":"restnoded" }``
  
|


Requirements for using Service Discovery
````````````````````````````````````````
To use service discovery with AS3, you must:

- Be using BIG-IP version **13.0 or later** to use service discovery. 
- Have properly tagged resources in your cloud environment.  See your cloud provider documentation for instructions on tagging resources.  **Important**: Make sure the tags and IP addresses you use are unique. You should not tag multiple nodes with the same key/tag combination if those nodes use the same IP address.

  - In AWS, you can tag a VM resource or tag a NIC resource. The system first looks for NIC resources with the tags you specify. If it finds NICs with the proper tags, it does not look for VM resources. If it does not find NIC resources, it looks for VM resources with the proper tags. If you tag a VM resource, the BIG-IP will discover the primary public or private IP address for the primary NIC configured for the tagged VM.  If you tag a NIC resource, the BIG-IP will discover the public or private IP address for the tagged NIC.  You should use this option if you want to use the secondary NIC of a VM in the pool.

  - In Google, you tag objects using the **labels** parameter within the virtual machine. The BIG-IP VE will discover the primary public or private IP addresses for the primary NIC configured for the tagged VM.

  - In Azure, you can tag a VM resource, a NIC resource, or a Virtual Machine Scale Set resource.  The system first looks for NIC resources with the tags you specify.  If it finds NICs with the proper tags, it does not look for VM resources. If it does not find NIC resources, it looks for VM resources with the proper tags. In either case, it then looks for Scale Set resources with the proper tags.  If you tag a VM resource, the BIG-IP VE will discover the primary public or private IP addresses for the primary NIC configured for the tagged VM. If you tag a NIC resource, the BIG-IP VE will discover the primary public or private IP addresses for the tagged NIC.  Use this option if you want to use the secondary NIC of a VM in the pool.  If you tag a Virtual Machine Scale Set resource, the BIG-IP VE will discover the primary private IP address for the primary NIC configured for each Scale Set instance.  Note you must select Private IP addresses in BIG-IP AS3 if you are tagging a Scale Set.

- Include the service discovery lines in the pool member section of your declaration as shown in these example declarations.

.. NOTE:: Your cloud resources will not appear in the results of a BIG-IP AS3 GET request, but they are visible in the BIG-IP UI.

|

This section includes declarations that automatically discover members in Cloud deployments, as well as declarations that use an FQDN pool to enable pool member addresses to dynamically follow DNS changes. 

Use the index on the right to locate specific examples.


.. _sdexample:


Using Service Discovery to automatically populate a pool
````````````````````````````````````````````````````````
This example uses the service discovery feature to populate a pool based on tagged resources in AWS. In this example, the pool contains two static members on port 443, and then members in our us-west-1 region in AWS that are tagged with *foo* and *bar*.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_sd_01**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor. The pool members are autodiscovered from AWS.

.. literalinclude:: ../../examples/declarations/example-populate-pool-via-sd.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _sdexamplea:


Using remote Service Discovery to automatically populate a pool with BIG-IP VE anywhere
```````````````````````````````````````````````````````````````````````````````````````
This example uses the remote service discovery feature introduced in v3.4.0 to populate a pool based on tagged resources in AWS, Azure, and Google. Remote service discovery allows your BIG-IP VE to be located anywhere, not necessarily in a specific cloud or region.  In this example, the declaration runs on the local BIG-IP system, see the next example for using a declaration on a remote BIG-IP.  For this feature to work properly, you must provide credentials for your cloud provider as shown in the following example.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_sd_02**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool members are autodiscovered from AWS, Azure, and Google clouds, each on a different port.

**Note**: This example does not include actual credentials for any of the clouds, or IDs for Azure.  You must supply these items from your cloud provider.


.. literalinclude:: ../../examples/declarations/example-populate-pool-via-remote-sd-with-big-ip-ve.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _sdexampleb:

Using remote Service Discovery and sending the declaration to a remote BIG-IP
`````````````````````````````````````````````````````````````````````````````
This example uses the remote service discovery feature to populate a pool based on tagged resources in AWS, Azure, and Google, but in this declaration we are sending the declaration to a remote BIG-IP system. You must use the targetHost, targetUserName, and targetPassphrase parameters to set the information for the target BIG-IP device.

For this feature to work properly, you must provide credentials for your cloud provider as shown in the following example.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_sd_03**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool members are autodiscovered from AWS.

**Note**: This example does not include actual AWS credentials, you must supply these items.


.. literalinclude:: ../../examples/declarations/example-send-declaration-to-remote-big-ip-via-remote-sd.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _fqdnexample:


Using an FQDN pool to identify pool members
```````````````````````````````````````````
This example uses an FQDN pool on the BIG-IP VE, which allows the pool member addresses to dynamically follow DNS changes.  For complete information on FQDN pools, see https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-implementations-13-1-0/22.html.
You *must* have DNS configured on your BIG-IP system before FQDN pools will function properly.  See the |doc| for details.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_sd_04**.
- A virtual server named **service**.
- A pool named **fqdn_pool**.  The pool member addresses are discovered using DNS.



.. literalinclude:: ../../examples/declarations/example-identify-pool-members-via-fqdn-pool.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _event:


Event-Driven Service Discovery
``````````````````````````````
This example uses event-driven service discovery.  With event-driven service discovery, you POST a declaration with the **addressDiscovery** property set to **event**.  This creates a new endpoint which you can use to add nodes that does not require a BIG-IP AS3 declaration, so it can be more efficient than using PATCH or POST to add nodes. This also enables the ability to configure a service (such as AWS Lambda) to use the event endpoint any time it detects instance changes.

When you use the **event** value for addressDiscovery, the system creates the new endpoint with the following syntax:
``https://<host>/mgmt/shared/service-discovery/task/~<tenant name>~<application name>~<pool name>/nodes``.

For example, in the following declaration, assuming 192.0.2.14 is our BIG-IP, the endpoint that is created is: 
``https://192.0.2.14/mgmt/shared/service-discovery/task/~Sample_event_sd~My_app~My_pool/nodes``

Once the endpoint is created, you can use it to add nodes to the BIG-IP pool.

First we show the initial declaration to POST to the BIG-IP system.

.. literalinclude:: ../../examples/declarations/example-event-driven-sd.json
   :language: json

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_event_sd**.
- A pool named **My_pool** that is a part of the **My_app** application.  The pool currently contains one member, 192.0.2.2 on port 8080.

Once the declaration has been sent to the BIG-IP, we send the following code to the BIG-IP endpoint (``https://192.0.2.14/mgmt/shared/service-discovery/task/~Sample_event_sd~My_app~My_pool/nodes``).  Both **id** and **ip** are required (**port** is optional).

.. IMPORTANT:: The optional **port** property in the following example is only available in BIG-IP AS3 3.15.0 and later. 

.. code-block:: json

    [
        {
            "id": "newNode1",
            "ip": "192.0.2.3",
            "port": 8080
        },
        {
            "id": "NewNode2",
            "ip": "192.0.2.4",
            "port": 8080
        }
    ]


This creates two new named nodes in My_pool, **newNode1** and **newNode2** at the specified IP addresses (and port if applicable).

.. NOTE:: The list of nodes for this event-driven task are replaced with the list you post, so you should always include all nodes with each request.


:ref:`Back to top<sd-examples>`

|

.. _consul:


Service Discovery using HashiCorp Consul
````````````````````````````````````````
This example uses Consul (specifically HashiCorp Consul) for service discovery.  For more information HashiCorp Consul, see https://developer.hashicorp.com/consul.
This declaration includes an optional Base64 encoded bearer token required to make requests to the Consul API with the ACL system enabled (stored in the declaration in an encrypted format).


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_consul_SD**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool members are autodiscovered via the Consul API.


.. literalinclude:: ../../examples/declarations/example-sd-via-hashicorp-consul.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _consulca:


Service Discovery using HashiCorp Consul and CA Certificates
````````````````````````````````````````````````````````````
This example is very similar to the previous example, although in this case, it uses Consul for service discovery with a CA Certificate.  See |poolmem| in the Schema Reference for a description of **trustCA** used in this declaration.
This declaration also includes an optional Base64 encoded bearer token required to make requests to the Consul API with the ACL system enabled (stored in the declaration in an encrypted format).


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_Consul_SD_CA**.
- A virtual server named **service**.
- A pool named **web_pool** The pool members are autodiscovered via the Consul API.
- A CA Bundle to validate server certificates (note the CA Bundle in the declaration is not valid and you will receive an error if you use it as is).



.. literalinclude:: ../../examples/declarations/example-sd-consul-ca.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _consulno:


Service Discovery using HashiCorp Consul without certificate validation
```````````````````````````````````````````````````````````````````````
This is another example that uses Consul for service discovery, but in this example, there is no certificate validation.  This declaration uses the **rejectUnauthorized** property set to **false** so the server certificate is not validated. 
This declaration includes an optional Base64 encoded bearer token required to make requests to the Consul API with the ACL system enabled (stored in the declaration in an encrypted format). See |poolmem| in the Schema Reference for a description of **rejectUnauthorized** used in this declaration.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_Consul_SD_no_validation**.
- A virtual server named **service**.
- A pool named **web_pool** The pool members are autodiscovered via the Consul API.
- The **rejectUnauthorized** is set to **false**, so there is no server certificate validation.


.. literalinclude:: ../../examples/declarations/example-sd-consul-no-validation.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _gslbvip:


Service Discovery for virtual servers in GSLB Servers
`````````````````````````````````````````````````````
This simple example shows how you can use Service Discovery to automatically discover virtual servers in GSLB Servers. You must have BIG-IP DNS (formerly GTM) provisioned to use these features. See |gslbserver| in the :ref:`Schema Reference<schema-reference>` for usage options and additional features for GSLB.

.. WARNING:: When using GSLB features, you must be aware of the items pointed out in :ref:`Warnings<gslbnote>`, notably BIG-IP AS3 completely overwrites non-AS3 topologies when a declaration is submitted.  |br| BIG-IP DNS must be licensed and provisioned to use this declaration.

This declaration creates the following objects on the BIG-IP (this declaration does not create a tenant, but uses the Common tenant as required for some GSLB features):

- A GSLB data center named **testDataCenter**.
- A GSLB server named **testServer** with one device, **virtualServerDiscoveryMode** set to **enabled-no-delete** (which only allows Service Discovery to add or modify, but not delete), and **exposeRouteDomainsEnabled** set to **true** (which allows virtual servers from all route domains to be auto-discovered).

.. literalinclude:: ../../examples/declarations/example-gslb-discovery.json
   :language: json

:ref:`Back to top<sd-examples>`


.. _sdboth:


Event-Driven and Static Service Discovery in one declaration
````````````````````````````````````````````````````````````
This simple example shows how you can use Event-Driven and Static Service Discovery in a single declaration. For details on both methods, see :ref:`sdexample` and :ref:`event`.


.. literalinclude:: ../../examples/declarations/example-sd-static-and-event.json
   :language: json

:ref:`Back to top<sd-examples>`

|

.. _consulserv:


Service Discovery using HashiCorp Consul for a specific service
```````````````````````````````````````````````````````````````
This example uses Consul (specifically HashiCorp Consul) for service discovery, but for a specific Consul Service.  For more information HashiCorp Consul Services and Service Definitions, see |consuldocs|.

This declaration is the same as example :ref:`#6<consul>`, but instead of retrieving all nodes in a Consul instance, it uses a URI endpoint that is specific to a Consul service, and only receives nodes in that service.

As with example #6, this declaration includes an optional Base64 encoded bearer token required to make requests to the Consul API with the ACL system enabled (stored in the declaration in an encrypted format).


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_consul_SD**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool members that are part of the **myHTTPservices** Consul service are autodiscovered via the Consul API.


.. literalinclude:: ../../examples/declarations/example-sd-consul-service.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _scaleset:


Referencing a Scale Set for Service Discovery in Azure
``````````````````````````````````````````````````````
This example shows how you can use two new Service Discovery Properties (resourceType and resourceID) to reference Azure virtual machine scale sets.  For information on Azure scale sets, see the |scalesetdocs|.

You can use the **resourceType** property with a value of **scaleSet** to specify a scale set instead of using Tagkeys and TagValues to reference individual VMs. You use the **resourceID** property to specify the name of your existing scale set in Azure. The system then uses that scale set for service discovery.

See |poolmem| in the Schema Reference for descriptions of the new properties and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_scaleset**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool members that are part of the specified scale set are autodiscovered.


.. literalinclude:: ../../examples/declarations/example-populate-pool-via-sd-azure-scaleset.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _sdshare:


Populating multiple pools with Service Discovery results
````````````````````````````````````````````````````````
This example shows how you can use the new |addrsd| class to enable multiple BIG-IP pools to use the members discovered by the Service Discovery process.  This allows BIG-IP AS3 to consolidate the Service Discovery tasks into one object, available for reuse.

Once you define the properties of the Address_Discovery class in a declaration, you can define multiple pools that reference the Address Discovery class in the same declaration, which populates all of those pools with the members that were discovered, on the port you define in the pool.

.. NOTE:: The Address_Discovery class does not currently work well in the **Common** tenant; we recommend you use it only within the same tenant.

See |addrsd| in the Schema Reference for more information and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service**.
- A Address Discovery object that uses Service Discovery to discover members from AWS.
- Two pools (named **pool1** and **pool2**) on different ports which use the members discovered by |addrsd|.


.. literalinclude:: ../../examples/declarations/example-populate-pool-via-shared-sd-results.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _consulport:

Using Service Discovery to find Consul ports
````````````````````````````````````````````
This example shows how you can use the new **jmesPathQuery** property with Consul Service Discovery to query for Consul ports (previously Service Discovery would return only IP addresses). JMESPath is a query language for JSON. For more information and usage instructions, see https://jmespath.org/.

When using this feature, you must use the **/v1/catalog/service/{serviceName}** API for Consul discovery.  In the following example, our **uri** property value is **http://demo.exmample.com:8500/v1/catalog/service/myHTTPservices**.

We are using the **jmesPathQuery** property to query for IP address and port.

See |consulsd| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_consul_SD_service**.
- An Application named **A1**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool member IP addresses and Ports are autodiscovered via the Consul API.

.. literalinclude:: ../../examples/declarations/example-sd-consul-jmespath-ports.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _consulhealth:

Using Service Discovery with the Consul Health API
``````````````````````````````````````````````````
This example is similar to the previous example, but in this case, shows how you can use the **jmesPathQuery** property with Consul Service Discovery to leverage the Consul Health API. This results in BIG-IP AS3 only discovering nodes that pass Consul health checks. For more information on the Consul Health API, see the |consulhealth|.

JMESPath is a query language for JSON. For more information and usage instructions, see https://jmespath.org/.

When using this feature, use the following API syntax **/v1/health/service/{serviceName}?{queryparameter}**. In the following example, we use **http://demo.exmample.com:8500/v1/health/service/myHTTPservices?passing**, which only discovers nodes that are passing health checks.

We are using the **jmesPathQuery** property to query for public and private nodes.

See |consulsd| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_consul_SD_health**.
- An Application named **A2**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  Only healthy nodes are autodiscovered via the Consul API.

.. literalinclude:: ../../examples/declarations/example-sd-consul-jmespath-health.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _managedid:

Using Managed Identities for Azure Service Discovery
````````````````````````````````````````````````````
In this example, we show how you can use Microsoft Managed Identities with Azure service discovery in a BIG-IP AS3 declaration. This feature uses the new **useManagedIdentity** property introduced in BIG-IP AS3 3.25. When using Managed Identities, you do not supply the directoryId, applicationId, or apiAccessKey properties.

For specific information on Managed Identities, see |managedid|.

See |poolmem| in the Schema Reference for a description of the new property and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_managedId**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.  The pool members that are part of the specified scale set are autodiscovered, with **useManagedIdentity** set to true.

.. literalinclude:: ../../examples/declarations/example-populate-pool-via-sd-azure-managed-identity.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _gceprojectid:

Specifying a GCE project for service discovery
``````````````````````````````````````````````
In this example, we show how you can use a Google Cloud Engine (GCE) project ID to discover devices in a specific GCE project. This feature uses the new **projectId** property introduced in BIG-IP AS3 3.27. For more information on Google Cloud project IDs, see the |gcedocs|.

See |gcesd| in the Schema Reference for a description of the new property and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **GCEtenant**.
- A virtual server named **GCEservice**.
- A pool named **web_pool**. The GCE pool members are part of the specified projects (**id-of-first-project** and **id-of-second-project**) are autodiscovered.

.. literalinclude:: ../../examples/declarations/example-address-discovery-gce.json
   :language: json


:ref:`Back to top<sd-examples>`

|

.. _undiscover:

Disabling Service Discovery 
```````````````````````````
In this example, we show how you can disable Service Discovery in a declaration. Once you disable Service Discovery, if you attempt to send a declaration that includes any Service Discovery features, it will fail, until you re-enable it.

To disable Service Discovery, you send a request to the /settings endpoint. To use the /settings endpoint, you can send a POST or GET request to ``https://<BIG-IP>/mgmt/shared/appsvcs/settings``.

- GET returns the current configuration settings.
- POST allows you to change the current settings.  See the following example.

.. IMPORTANT:: If you have any existing Service Discovery tasks, you cannot disable Service Discovery until those tasks are deleted. 


This declaration does not create any configuration on the BIG-IP, it simply disables Service Discovery.  

Remember to use ``https://<BIG-IP>/mgmt/shared/appsvcs/settings``.

.. literalinclude:: ../../examples/declarations/example-disable-service-discovery.json
   :language: json

If you want to re-enable Service Discovery, change the value in the example to **true**.

:ref:`Back to top<sd-examples>`

|

.. _rdpoolmemsd:


Adding a route domain to a discovered pool member
`````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for the **routeDomain** property for Service Discovery pool members is available in BIG-IP AS3 3.31.0 and later.

This example shows how you can use the **routeDomain** property on auto-discovered pool members in BIG-IP AS3 3.31 and later (for static pool members, see :ref:`this example<rdpoolmem>`). 

The **routeDomain** property allows you to control the route domain to which pool members belong. 

For specific information on route domains on the BIG-IP, see the |rddocs|.

.. IMPORTANT:: BIG-IP AS3 does not configure route domains (although |DOrd| does). This property allows you to assign an existing route domain to a pool member.

See |pm| in the Schema Reference for BIG-IP AS3 usage and information.


This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **TEST**.
- An Application named **Application**
- A virtual server named **testVirtual** which references the pool.
- A pool named **testPool** with members auto-discovered from AWS, and assigned to route domain 100.


.. literalinclude:: ../../examples/declarations/example-pool-member-route-domain-sd.json
   :language: json

|

.. _namednode:


Specifying a node name in a declaration
````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for node names for Service Discovery pool members is available in BIG-IP AS3 3.35.0 and later.

This example shows how you can specify a name for static pool members when using address discovery in BIG-IP AS3 3.35 and later. Previously, nodes were only referenced by their IP address.

This feature only works when **addressDiscovery** is set to **static**. The **name** field is optional, however the IP address field is always required.

See |pm| and |pms| in the Schema Reference for BIG-IP AS3 usage and information. 

This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Sample_event_sd**.
- An Application named **My_app**
- A pool named **my_Pool** that uses static address discovery, and defines a name and an IP address for each member.


.. literalinclude:: ../../examples/declarations/example-static-named-pool-members.json
   :language: json
   :emphasize-lines: 21, 25

|

.. |gslbserver| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-server" target="_blank">GSLB Server</a>

.. |doc| raw:: html
  
   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-implementations-13-1-0/22.html#GUID-DFA13C81-4E38-4EAC-A478-376895FEF2CD" target="_blank">BIG-IP documentation</a>

.. |poolmem| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pool-member" target="_blank">Pool Member</a>

.. |awssd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-discovery-aws" target="_blank">Service_Discovery_AWS</a>

.. |br| raw:: html
   
   <br />

.. |consuldocs| raw:: html

   <a href="https://www.consul.io/docs/agent/services.html" target="_blank">Consul Services documentation</a>

.. |scalesetdocs| raw:: html

   <a href="https://docs.microsoft.com/en-us/azure/virtual-machine-scale-sets/overview" target="_blank">Microsoft Documentation</a>

.. |addrsd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#address-discovery" target="_blank">Address_Discovery</a>

.. |consulsd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-discovery-consul" target="_blank">Service_Discovery_Consul</a>

.. |consulhealth| raw:: html

   <a href="https://www.consul.io/api-docs/health" target="_blank">Consul Documentation</a>

.. |managedid| raw:: html

   <a href="https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview" target="_blank">Microsoft documentation</a>

.. |gcedocs| raw:: html

   <a href="https://cloud.google.com/resource-manager/docs/creating-managing-projects" target="_blank">Google Cloud documentation</a>

.. |gcesd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-discovery-gce" target="_blank">Service_Discovery_GCE</a>

.. |DOrd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-declarative-onboarding/latest/composing-a-declaration.html#route-domain-class" target="_blank">Declarative Onboarding</a>

.. |rddocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-1-0/09.html" target="_blank">route domain documentation</a>

.. |pm| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pool-member" target="_blank">Pool_Member</a>

.. |pms| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pool-member-servers" target="_blank">Pool_Member_Servers</a>
   
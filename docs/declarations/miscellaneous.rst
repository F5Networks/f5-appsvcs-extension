.. _misc-examples:

Miscellaneous declarations
--------------------------
This section contains declarations that do not fit into one of the other categories. 

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.



Using PATCH to add a new Application to a Tenant
````````````````````````````````````````````````
This example uses the same declaration as in the :ref:`UDP Example<udp-ex>`, but we use the PATCH method
to add an new Application to the Sample_non_http_01 tenant.

This PATCH creates the following objects on the BIG-IP:

- A new Application named **NewApp**.
- An HTTP service (virtual server) named **service**.
- A pool named **web_poolnew** with two servers monitored by the default *http* health monitor.


If necessary, review the declaration in Example 11 (or first use ``GET https://<BIG-IP>/mgmt/shared/appsvcs/declare/Sample_misc_11``).

Then use ``PATCH https://<BIG-IP>/mgmt/shared/appsvcs/declare`` with the following
body (because this is a new object, we include the new name in the path):

.. literalinclude:: ../../examples/declarations/example-add-application-to-tenant-via-patch.json
   :language: json

After submitting this PATCH, the system returns the following (new application highlighted in yellow):

.. literalinclude:: ../../examples/results/example-add-application-to-tenant-via-patch-full.json
   :language: json
   :emphasize-lines: 47-72

:ref:`Back to top<misc-examples>`

|

.. _genex:


Using the Service_Generic class
```````````````````````````````
This simple example shows how you can use the new Service_Generic class.  This class allows the BIG-IP to accept any L4 protocols without requiring a *fastl4* profile.  For usage options, see https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-generic.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_misc_02**.
- A Generic service named **generic_virtual** on port 8080.

.. literalinclude:: ../../examples/declarations/example-service-generic.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _meta:


Using Metadata in a declaration
```````````````````````````````
This example shows how you can add metadata to a service (virtual server) in a declaration. This can be useful for storing information about the application which could be leveraged by other tools for tasks such as validation or auditing.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_misc_03**.
- A generic virtual service named **testItem** with a metadata entry of **example**.

.. literalinclude:: ../../examples/declarations/example-metadata.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _vlanex:


Virtual service allowing only specific VLANs
````````````````````````````````````````````
This example uses our simple HTTP service in Example 1, but uses a feature
introduced in BIG-IP AS3 version 3.2.0, which enables the ability to allow or deny
client traffic from specific VLANs (**IMPORTANT**: The VLAN objects must already
exist on the BIG-IP system).

In this case, we are using **allowVlans** to allow traffic from specific VLANs
on our BIG-IP system to access our HTTP service, and denying all other traffic
to that service.  If we wanted to deny traffic from specific VLANs, we would use
**rejectVlans** instead. In the **rejectVlans** case, the system would deny traffic from the specified
VLANs, and would allow traffic from any other VLAN on the system.  If you do not use this property, the system allows all VLANs by default.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_misc_04**.
- A virtual server named **service** which is only accessible from the internal-sales and internal-marketing VLANs (which already exist on the BIG-IP system).
- A pool named **web_pool** monitored by the default *http* health monitor.

.. literalinclude:: ../../examples/declarations/example-vs-specific-vlans.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _addressex:


Advertising a route for a Service Address
`````````````````````````````````````````
In this example, we show you how to use the Service Address class to advertise a route in your declaration.  The Service_Address class allows you to add a number of properties to your (virtual) server address.  This declaration shows how you can use the new routeAdvertisement property to advertise routes.  For options and usage, see |sa|. This example uses the Service_Generic class.

..IMPORTANT:: When BIG-IP AS3 creates a Service_Address, it is placed in **/tenant/serviceAddress** (and not **/tenant/app/serviceAddress**) on the BIG-IP system.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_misc_05**.
- A virtual server named **theService** which includes a pointer to the Service_Address class.
- A Service_Address class named **serviceAddress** which includes a number of properties, including routeAdvertisement.

.. literalinclude:: ../../examples/declarations/example-advertising-route-for-service-address.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _cloneex:

Using Clone Pools in a declaration
``````````````````````````````````
BIG-IP AS3 version 3.9.0 adds support for using Clone Pools in a declaration.  You can use a clone pool when you want the BIG-IP system to send traffic to a pool of intrusion detection systems (IDSs) or a sniffer device. You can specify ingress, where the system replicates client-side traffic (prior to address translation) to the specified clone pool, or egress, where the system replicates server-side traffic (after address translation) to the specified clone pool, or both (as shown in this example).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_clone_pool**.
- Two virtual servers named **testService** and **testService-1**. The latter is automatically created because we specify two virtual addresses.  
- A standard pool named **web_pool** monitored by the default HTTP health monitor.
- Two clone pools named **testPoolIngress** and **testPoolEgress**, which replicates ingress and egress traffic respectively.

.. literalinclude:: ../../examples/declarations/example-clone-pools.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _multibigiq:


Sending multiple declarations in a single request (BIG-IQ)
``````````````````````````````````````````````````````````
BIG-IP AS3 version 3.10.0 adds support for sending multiple declarations to different target BIG-IP devices in a single request. In this example, we are using BIG-IP AS3 on BIG-IQ (see :ref:`Using BIG-IP AS3 with BIG-IQ<big-iq>` .  This allows you to configure more than one BIG-IP device using BIG-IQ.

This declaration does the following:

- On the BIG-IP device with IP address **10.10.10.13**: 

  - Partition (tenant) named **bigiqTenant1**.
  - A virtual server named **service**, using the Service_L4 class.
  - A pool named **pool** with a single member on port 8080 monitored by the TCP health monitor on the BIG-IP system.

- On the BIG-IP device with IP address **10.10.10.14**:

  - Partition (tenant) named **bigiqTenant2**.
  - A virtual server named **service**, using the Service_L4 class.
  - A pool named **pool** with a single member on port 8080 monitored by the TCP health monitor on the BIG-IP system.


.. literalinclude:: ../../examples/declarations/example-multiple-declarations-bigiq.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _splunk:


Using Splunk as a log destination
`````````````````````````````````
With BIG-IP AS3 version 3.10.0 and later, you can use Splunk as a log destination.  This enables the BIG-IP to format the logs in a way that can be used by Splunk. For more information, see the |splunklog| chapter of External Monitoring guide.

This declaration creates the following objects on the BIG-IP (note it does not include a virtual server, just a pool and the logging objects):

- Partition (tenant) named **Splunk_Log_Destination**.
- A pool named **logPool** with one member on port 443.
- A log destination of type *remote high speed log*. This is a BIG-IP requirement for logging servers that require data in a specific format.
- A log destination of type *splunk* that forwards to the remote high speed log destination.
- An additional Splunk log destination that forwards to syslog on the BIG-IP device.

.. literalinclude:: ../../examples/declarations/example-logging-splunk.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _sharenodes:


Using shareNodes to reuse nodes across tenants
``````````````````````````````````````````````
The examples in the section show how to use the pool member property **shareNodes**. This property enables you to take an existing node from a previous declaration and use it in a new declaration without getting a conflict. Without using shareNodes, if you attempt to use a node you used in a previous declaration, you receive an error similar to the following:

``{"code":422,"errors":["/new_partition/example_app/web_pool/members: pool member /new_partition/example_app/web_pool/members/0 static address 10.244.1.58 conflicts with bigip node /original_partition/10.244.1.58"],"declarationFullId":"","message":"declaration is invalid"}``

If you do not use shareNodes or have shareNodes set to **false** (the default), the nodes are created in the tenant specified in the declaration (however, see the following Warning note about updating this property)

.. NOTE:: You must have the **shareNodes** property set to **true** in your original declaration.  If you did not, add it to the original declaration and re-POST before attempting to post a new declaration with the node.

.. WARNING:: If you POST a declaration with **shareNodes** set to **true**, and then later update the same declaration with **shareNodes** set to **false**, the declaration returns Success, however BIG-IP AS3 does not move the nodes, and they remain in /Common. To change this behavior, first DELETE the original declaration, and then re-POST the declaration with shareNodes set to **false**.


There are two declarations in this example, the original declaration and a new declaration.

.. original:

Original Declaration
~~~~~~~~~~~~~~~~~~~~
The original declaration is a simple declaration that includes a virtual server, a pool, and a pool member with the IP address of 10.244.1.58 with shareNodes set to true.


- Partition (tenant) named **original_partition**.
- A virtual server named **service**.
- A pool named **web_pool1** with one member (10.244.1.58) with **shareNodes** set to **true**.


.. literalinclude:: ../../examples/declarations/example-sharenodes-first.json
   :language: json


.. newpart:

New Declaration
~~~~~~~~~~~~~~~
This declaration contains two tenants, a new tenant named **new_partition** that uses the IP address of the node in the original declaration.  It also includes the original_partition tenant, with a new node IP address.  This example shows how you can move a node between partitions using shareNodes.

You do not need to include the original declaration unless you want to change the original node value.  As long as **shareNodes** was set to **true** in your original declaration, you can post a new declaration using the node IP address from the original declaration.

- Partition (tenant) named **new_partition**.
- A pool named **web_pool2** with one member (10.244.1.58, the node IP from the original declaration) with **shareNodes** set to **true** (note this example does not contain a virtual service/server).
- A second partition (tenant) named **original_partition**.
- A virtual server named **service**.
- A pool named **web_pool1** with one member (10.244.1.28) with **shareNodes** set to **true**.  Note this changes the node IP address from what was included in the original declaration (this is not required as mentioned in the description of this example).


.. literalinclude:: ../../examples/declarations/example-sharenodes-second.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _include:

Using the include property to reference one section of a declaration in another section
```````````````````````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Using the **include** property to reference one section of a declaration in another is available in BIG-IP AS3 v3.13.0 and later

This example shows how you can use the **include** property to call a section of a declaration from another part of the same declaration. In the following example, we are showing a WAF policy declaration which uses this feature, although you can use **include** with any property. See |incl| in the schema reference for more information and usage.

This declaration creates a WAF policy in /Common using the **shared** template, and then references.


.. literalinclude:: ../../examples/declarations/example-include.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _sourcevs:

Using both a source and destination address for a virtual service
`````````````````````````````````````````````````````````````````
In this example, we show how you can use both a source and destination address for your virtual service (BIG-IP virtual server). For specific information, see the |src|.

The Destination Address is the destination IP address to which the virtual service sends traffic and is required.

The Source Address property is optional, but allows you to specify an IP address or network from which the virtual server accepts traffic. If you include Source Address(es), the virtual server accepts clients only from one of these IP addresses.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **source_example**.
- Two virtual servers named **service** (the BIG-IP names the second **service-1**) using the Service_Generic class. Each virtual has a Destination address (the first IP address in the array) and a Source Address (the second IP address in the array).

.. literalinclude:: ../../examples/declarations/example-source-address-vs.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _internalvs:


Creating an internal virtual service
````````````````````````````````````
In this example, we show how you can create a virtual service (virtual server with a **Type** of **Internal**).  This type of virtual service is useful for conditionally forwarding HTTP requests and HTTP responses to a pool of ICAP servers for modification, before sending a request to a web server or returning a response to the client system. For details on this implementation, see the |internaldocs|.  For information on BIG-IP virtual servers in general, see |kbvip|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_Internal_Virtual**.
- An Application named **Internal_Service**.
- A TCP virtual server named **service** with Type of Internal that references an existing ICAP profile on the BIG-IP.

.. literalinclude:: ../../examples/declarations/example-internal-virtual.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _destsourcefilter:


Configuring virtual address settings while using Source address filtering
`````````````````````````````````````````````````````````````````````````
In this example, we show how you can configure virtual service settings on the destination address (such as disabling ARP and ICMP echo) while still specifying a source IP address to enable source address filtering.  This is similar to :ref:`Example 12 <sourcevs>`, but in this case, we are configuring specific settings for the destination address and then including it in the array.

For specific information, see the |src|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_src_service_address**.
- An Application named **app**.
- A virtual service address with ARP and ICMP echo disabled.
- A generic virtual server named **service** with a destination address that uses the virtual address above, and a source address of 1.2.3.4/32.

.. literalinclude:: ../../examples/declarations/example-service-address-with-source-address.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _refpool:


Referencing pools and iRules in a declaration
`````````````````````````````````````````````
In this example, we show how you can reference pools and iRules (including a persistence iRule) with the **use** pointer in BIG-IP AS3 3.17 and later.  The **use** pointer has been available for other properties in AS3, but this version adds pools, iRules, and persistence Hash iRules.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_pool_irule**.
- An Application named **SampleApp**.
- A virtual server named **service** with a pool, iRules, and persistence method (which also includes an iRule) referenced later in the declaration.
- A pool named **web_pool**.
- Two iRules (non-functional in this example), named **theRule1** and **theRule2**.
- A Hash persistence profile (**persistRuleEx**) that references an iRule (also non-functional) named **ruleForPersis**.

.. literalinclude:: ../../examples/declarations/example-referencing-irules-pool.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _useragent:

Using the userAgent Controls property
`````````````````````````````````````
In this example, we show how you can use the **userAgent** property in the Controls class. The userAgent property allows you to set a unique identifier in usage data.

This declaration creates the following objects on the BIG-IP:

- A Controls class with userAgent set to **BIG-IQ/7.1 Configured by API**.
- Partition (tenant) named **useragentTenant**.
- An Application named **SampleApp**.
- A virtual server named **Stream_service**.


.. literalinclude:: ../../examples/declarations/example-useragent-controls.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _trace:

Using traceResponse to enable traces in AS3 responses
`````````````````````````````````````````````````````
In this example, we show how you can use the **traceResponse** property to enable more visibility into what BIG-IP AS3 is configuring.  This property can be used in the |control| or |adccontrol| classes (links go to the Schema Reference).

BIG-IP AS3 3.20 adds support for using **traceResponse** in *async* mode.

This example shows both the declaration and the response from AS3.  In the **ADC** class, we set traceResponse to **false**, and only set it to **true** on the tenant.  This limits the trace to the tenant only; if you set traceResponse to true at the ADC class level, you would get traces for all tenants in the declaration.  You could also get it to true at the ADC level, and then to false for each tenant you do not want to trace.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **trace_tenant**.
- An Application named **SampleApp**.
- A virtual server named **Sample_service**.


.. literalinclude:: ../../examples/declarations/example-trace-response.json
   :language: json

**Example Response**
Here is the response returned by BIG-IP AS3 from the declaration, showing the trace for the tenant.

.. literalinclude:: ../../examples/results/example-traceresponse-output.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _mgmtlog:

Configuring management port log destinations
````````````````````````````````````````````
In this example, we show how you can configure the BIG-IP to use the management port as a log destination in a BIG-IP AS3 declaration.

For more information and manual configuration, see |logkb|.  For BIG-IP AS3 usage, see |logref| in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Management_Port_Log_Destination**.
- An Application named **SampleApp**.
- A Log Destination named **mgmtLogDest** with a type of **management-port**.


.. literalinclude:: ../../examples/declarations/example-mgmt-port-log-dest.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _shareadd:

Sharing IP addresses between virtual servers
````````````````````````````````````````````
In this example, we show how you can use the **shareAddress** property in a BIG-IP AS3 Service class to easily share IP addresses between virtual servers.

When you use **shareAddress**, BIG-IP AS3 creates virtual-address objects in the **Common** partition/tenant instead of putting those objects into the same tenant as the virtual server. This allows you to use the same virtual IP address for a virtual server in a declaration, as you can see in the following example (both use the IP address 10.10.0.111).

.. IMPORTANT:: While the virtual addresses can be the same, multiple virtual servers cannot share both the same IP address AND port. |br| **shareAddress** must be set to **true** for each service in which you are using the same virtual IP address.

If you do not include **shareAddress**, or set it to **false**, the virtual address(es) are put in the tenant/partition specified in the declaration.

You can find the **shareAddress** property in the Schema Reference in each of the Service classes, for example |servicehttp|.

.. WARNING:: There is currently a known issue with a workaround you could encounter when using **shareAddresses**.  See `GitHub Issue 279 <https://github.com/F5Networks/f5-appsvcs-extension/issues/279>`_


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_Shared1**.
- An Application named **Application1** which includes a virtual server named test.item1 with two virtual addresses on virtual port 8080 and shareAddress set to true.
- An Application named **Application2** which includes a virtual server named test.item2 with two virtual addresses (one of which is the same as item1) on virtual port 8079 and shareAddress set to true.



.. literalinclude:: ../../examples/declarations/example-service-generic-with-shareAddress.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _servdown:

Configuring serviceDownImmediateAction on a virtual
```````````````````````````````````````````````````
In this example, we show how you can use the **serviceDownImmediateAction** property in a BIG-IP AS3 Service class. This property specifies the immediate action the BIG-IP system should respond with upon the receipt of the initial client's SYN packet, if the availability status of the virtual server is Offline or Unavailable.  

This property has the following options:

- **None**: Specifies that the system takes no immediate action if the virtual server is reported Offline or Unavailable. This is the default setting.
- **Reset**: Specifies that the system resets the connections when the virtual server is reported Offline or Unavailable.
- **Drop**: Specifies that the system drops the connections when the virtual server is reported Offline or Unavailable.

While you can specify **none** for all BIG-IP AS3 Service classes, Drop and Reset are only supported for Services using the TCP protocol.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **tcp_service_action**.
- An Application named **app**.
- A TCP virtual server named **service** which has serviceDownImmediateAction set to drop.



.. literalinclude:: ../../examples/declarations/example-service-tcp-with-service-down-action.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _settings:

Using the /settings endpoint
````````````````````````````
In this example, we show how you can use the **/settings** endpoint introduced in BIG-IP AS3 3.23.  This endpoint enables the configuration of certain system-wide settings, such as enabling or disabling :ref:`Burst Handling<burst>` (currently the only supported setting).

To use the /settings endpoint, you can send a POST or GET request to ``https://<BIG-IP>/mgmt/shared/appsvcs/settings``.

- GET returns the current configuration settings.
- POST allows you to change the current settings.  See the following example.

BIG-IP AS3 3.27 introduced the **serviceDiscoveryEnabled** property.  For an example, see :ref:`Disabling Service Discovery<undiscover>`.  

The following example shows how you can enable the burst handling feature when you POST the following declaration to ``https://<BIG-IP>/mgmt/shared/appsvcs/settings``. |br| Also see :ref:`Burst Handling<burst>`

.. literalinclude:: ../../examples/declarations/example-enable-burst-handling.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _snatpool:

Configuring a SNAT pool
```````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for the SNAT Translation class is available in BIG-IP AS3 v3.42 and later. 

In this example, we show how you can configure a SNAT (secure network address translation) pool in a BIG-IP AS3 declaration. A SNAT is an object that maps the source client IP address in a request to a translation address defined on the BIG-IP device.  A SNAT pool represents a pool of translation addresses you configure on the BIG-IP system. The original IP address is then mapped to the entire translation pool (SNAT pool).

.. TIP:: You can also use a pointer to a SNAT Pool that exists on the BIG-IP. See |spp| in the Schema Reference for usage.

For more information on SNAT on the BIG-IP, see |sp|.

**New in BIG-IP AS3 3.42** |br|
BIG-IP AS3 3.42 introduced the **SNAT_Translation** class.  This class allows you to configure explicit SNAT address and configure properties such as IP idle timeout.  See |snatt| for information about specific properties and BIG-IP AS3 usage. 

This declaration creates the following objects on the BIG-IP (**NOTE** If you attempt to use this declaration on a version prior to 3.42, it will fail.  On previous versions, remove the **SNAT_Translation** lines highlighted in yellow, and the comma in line 40)

- Partition (tenant) named **Sample_SNAT_Pool**.
- An Application named **SNAT_app**.
- A virtual server named **SNAT_service** that references the SNAT pool.
- A pool named **web_pool** with two members.
- A SNAT pool named **CreateSnatPool** containing two SNAT addresses.
- A SNAT translation class named **CreateSnatTranslation** with associated properties.

.. literalinclude:: ../../examples/declarations/example-snat-pool.json
   :language: json
   :emphasize-lines: 41-51


:ref:`Back to top<misc-examples>`

|

.. _fqdnprefix:

Using an FQDN prefix for BIG-IP nodes
`````````````````````````````````````
In this example, we show how you use the **fqdnPrefix** property on BIG-IP nodes introduced in BIG-IP AS3 3.24.  This feature is useful for changing the names of nodes created by the FQDN addressDiscovery feature,  allowing you to workaround a TMOS restriction in which nodes cannot start with a number.

If you do not specify an fqdnPrefix, BIG-IP AS3 does not modify the name.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **tenant**.
- An Application named **fqdn_app**.
- A virtual server named **service** that references a pool.
- A pool named **fqdn_pool** with addressDiscovery set to **fqdn** and an **fqdnPrefix** set to **fqdn-**.

.. literalinclude:: ../../examples/declarations/example-fqdnPrefix.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _mqtt:

Enabling a MQTT profile on a TCP service in a declaration
`````````````````````````````````````````````````````````
In this example, we show you how to add an MQTT (Message Queuing Telemetry Transport) profile to a service (virtual server) in a declaration. The MQTT profile optimizes the performance and bandwidth of mobile environments.  

When you enable this profile, BIG-IP AS3 attaches the default MQTT profile found on the BIG-IP. This profile is not configurable in AS3, you simply enable or disable (default) it in your Service_TCP services using the **mqttEnabled** property.  

For more information and manual configuration, see |mqttdoc| in the BIG-IP documentation. 

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **tcp_mqtt_enabled**.
- An Application named **app**.
- A virtual server named **service** that has **mqttEnabled** set to **true**.

.. literalinclude:: ../../examples/declarations/example-service-tcp-mqttEnabled.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _tokenauth:

Retrieving data from URLs that use token-based authentication
`````````````````````````````````````````````````````````````
In this example, we show how you can fetch data from secured URLs that do not use Basic Authentication, using token (bearer token) authentication (OAuth2 in this example).  This is necessary when trying to retrieve data from URLs from locations such as Microsoft Azure Dev Ops, and GitHub (after 11/13/2020) that do not support Basic authentication.

This functionality is enabled by using the new **bearer-token** authentication method introduced in BIG-IP AS3 3.28. Currently, you must provide the token in the declaration.  Future versions may include the ability to retrieve the token.

Your application must be configured appropriately so BIG-IP AS3 can retrieve data from the URLs.  For example, if using Azure Dev Ops, see https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow.  If using GitHub, see the **Basics of Authentication** guide on GitHub. If using other applications, see the appropriate documentation.

See |tokenauth| in the schema reference for more information and BIG-IP AS3 usage.

.. NOTE:: This example retrieves a URL as a part of a WAF policy, but bearer token authentication works with any BIG-IP AS3 class that can retrieve data from a URL.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_WAF_Policy**.
- An Application named **Example_App**.
- A WAF policy named **exampleWAF** that retrieves the policy via URL using bearer token authentication, and the token is included in the declaration.

.. literalinclude:: ../../examples/declarations/example-waf-bearer-token-auth.json
   :language: json


:ref:`Back to top<misc-examples>`


|

.. _ifile:


Referencing an iFile in an iRule declaration
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing iFiles is available in BIG-IP AS3 v3.29 and later.

In this example, we show how you can an reference an iFile in a declaration in BIG-IP AS3 3.29 and later using the new **iFile** class.  An iFile is used by an iRule (based on a specific iRule event). 

With AS3, you can either reference an iFile you have already uploaded to the BIG-IP system, or if you use the **url** pointer, you can call an external file from a URL, and BIG-IP AS3 creates the iFile automatically. 

For more information on iFiles and iRules, see |ifiledoc| of the BIG-IP System iRules Concepts guide.

For BIG-IP AS3 usage, see |ifileref| in the Schema Reference.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_iFile**.
- An Application named **SampleApp**.
- An iFile named **testIFile** which references the file via URL.
- An iRule named **testIRule** which contains a base64 encoded iRule (the unencoded example is shown after the declaration).

.. literalinclude:: ../../examples/declarations/example-ifile.json
   :language: json

|

The iRule is base64 encoded in this example.  This is the unencoded iRule:

.. code-block:: bash

   when HTTP_REQUEST {
       set ifileContent [ifile get "/TEST_iFile/Application/testIFile"]
       HTTP::respond 200 content $ifileContent
       unset ifileContent
    }


:ref:`Back to top<misc-examples>`

|

.. _poolsnat:

Enabling or disabling NAT and SNAT on a pool
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for enabling or disabling NAT or SNAT on a pool is available in BIG-IP AS3 v3.29 and later.

In this example, we show how to enable or disable NAT (network address translation) or SNAT (source network address translation) in a pool in a declaration. 

This feature uses two new pool properties, **allowNATEnabled** and **allowSNATEnabled**.  The default value for both properties is **true**, meaning both are enabled by default.  When set to **true**, NATs and/or SNATs are automatically enabled for any connections using the pool.

For more information and BIG-IP AS3 usage, see |poolref| in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_pool_allow-nat_allow-snat**.
- An Application named **SampleApp**.
- A virtual server named **service** which references a pool.
- A pool named **web_pool** with both **allowNATEnabled** set to **false** and **allowSNATEnabled** set to **true**.

.. literalinclude:: ../../examples/declarations/example-pool-allow-nat-allow-snat.json
   :language: json


:ref:`Back to top<misc-examples>`

|

.. _drypatch:

Using dry-run as an ADC Controls object
```````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for using **dry-run** in the ADC Controls class is available in BIG-IP AS3 v3.30 and later.

In this example, we show how to use **dry-run** as a part of the |adccontrol| class in BIG-IP AS3 3.30 and later (previously it was only an **action** in the |as3class|). 

As a reminder, when you submit a declaration using **dry-run** set to **true**, BIG-IP AS3 does NOT deploy the declaration or make any changes to the configuration, but responds letting you know whether or not it would succeed.  This behavior is the same whether you are using the dry-run **action**, or as an ADC Controls object described here.

Using **dry-run** in the ADC Controls class allows you to use other BIG-IP AS3 actions, enabling you to test these declarations before deploying them.

For more information and BIG-IP AS3 usage, see |as3class| and |adccontrol| in the Schema Reference. 

This declaration:

- Contains an ADC class with **dry-run** set to **true**, meaning this will not deploy the configuration to the BIG-IP, but returns information about changes that would have been made.
- Creates a partition (tenant) named **TEST_DNS_Nameserver**.
- Creates an Application named **Application**.
- Creates a DNS Nameserver named **test.item-foo**.
- Creates a tsigKey named **DNS_TSIG_Key** with a secret.

.. literalinclude:: ../../examples/declarations/example-dry-run-controls.json
   :language: json
   :emphasize-lines: 14


:ref:`Back to top<misc-examples>`

|

.. _htmlrule:

Using the tag-append-html HTML rule in a declaration
````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for using **tag-append-html** is available in BIG-IP AS3 v3.30 and later.

In this example, we show how to use the |htmlrule| **tag-append-html** (part of |contentprofiles|), which adds HTML content to append to the tag delimiter.  This feature is useful when implementing |shape| integration.

For BIG-IP AS3 usage, see |htmlrule| in the Schema Reference. BIG-IP AS3 3.31 added support for the remaining rules (see :ref:`allrules`).

For more information, see |contentprofiles| in the BIG-IP documentation, and |tah| in the API Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_HTML_Rule**.
- An Application named **Application**.
- An HTML rule named **sample1** that contains HTML content (a script) to append to the tag delimiter matching the **tagName** of **/title**.
- A second HTML rule named **sample2** that contains sample HTML content to append to the tag delimiter matching **attributeName** of **pie**, **attributeValue** of **apple**, and **tagName** of **/dessert**.


.. literalinclude:: ../../examples/declarations/example-html-rule.json
   :language: json



:ref:`Back to top<misc-examples>`

|

.. _rdpoolmem:


Adding a route domain to a static pool member
`````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for the **routeDomain** property for static pool members is available in BIG-IP AS3 3.31.0 and later.

This example shows how you can use the **routeDomain** property on static pool members in BIG-IP AS3 3.31 and later (for auto-discovered pool members, see :ref:`this example<rdpoolmemsd>`). 

The **routeDomain** property allows you to control the route domain to which pool members belong. 

For specific information on route domains on the BIG-IP, see the |rddocs|.

.. IMPORTANT:: BIG-IP AS3 does not configure route domains (although |DOrd| does). This property allows you to assign an existing route domain to a pool member.

See |pm| in the Schema Reference for BIG-IP AS3 usage and information.


This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **TEST**.
- An Application named **Application**
- A virtual server named **testVirtual** which references the pool.
- A pool named **testPool** with one member on port 80 assigned to route domain 100.


.. literalinclude:: ../../examples/declarations/example-pool-member-route-domain.json
   :language: json

|

.. _allrules:

Using HTML rules in a declaration
`````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for HTML rules (other than **tag-append-html**) is available in BIG-IP AS3 v3.31 and later.

In this example, we show how to create an HTML profile that uses the rest of the HTML rules (:ref:`tag-append-html<htmlrule>` was added in 3.30). 

The rule types are (links to BIG-IP API reference): |rulecre|, |rulecr|, |tah|, |ruletph|, |ruletre|, |ruletr|, and |ruletra|.

For specific information on these rules, see |contentprofiles| in the BIG-IP documentation.

For BIG-IP AS3 usage, see |htmlrule| in the Schema Reference. 

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_HTML_Profile**.
- An Application named **Application**.
- A virtual server named **service** which references an HTML profile.
- An HTML profile named **htmlProfile** which references multiple HTML rules.
- An example of each type of HTML rules with appropriate properties and values.


.. literalinclude:: ../../examples/declarations/example-html-profile-with-all-rules.json
   :language: json



:ref:`Back to top<misc-examples>`

|

.. _ignorechange:

Using ignoreChanges on resources referenced by URL 
``````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for ignoreChanges on resources referenced by URL is available in BIG-IP AS3 v3.32 and later.

This example shows how you can use the **ignoreChanges** property for resources retrieved from external URLs.  Adding **ignoreChanges** set to **true** is useful when you know the data referenced by URL has not changed, therefore BIG-IP AS3 does not attempt to fetch it again, which can lead to improved response times.

For BIG-IP AS3 usage, see |rurl| in the Schema Reference. 

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **tenant**.
- An Application named **Application**.
- A virtual server named **service** which references an iRule.
- An iRule referenced by URL with both **ignoreChanges** and **skipCertificateCheck** set to true.


.. literalinclude:: ../../examples/declarations/example-resource-url-ignore-changes.json
   :language: json



:ref:`Back to top<misc-examples>`

|

.. _dgurl:

Skipping a certificate check when referencing data groups from external URLs
````````````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for **skipCertificateCheck** for the Data Group class is available in BIG-IP AS3 3.34 and later. 
   
In this example, we show how you can use **skipCertificateCheck** when referencing data groups from an external URL in BIG-IP AS3 3.34 and later.  When set to **true**, BIG-IP AS3 does not verify SSL certificates when you reference data groups. 

The **skipCertificateCheck** property is available in previous BIG-IP AS3 versions, but did not apply to data groups.

For additional details and BIG-IP AS3 usage, see |rurl| in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **tenant**.
- An Application named **app**.
- A client SSL profile (TLS_Server in AS3) that references certificates
- A certificate named **cert** and proxy certificate named **proxyCert**
- A data group named **dataGroup** that references the group via external URL with **skipCertificateCheck** set to true.


.. literalinclude:: ../../examples/declarations/example-data-group-url.json
   :language: json

:ref:`Back to top<misc-examples>`


|

.. _dgtoken:

Referencing a data group from an external URL with token authentication
```````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for data groups using token authentication is available in BIG-IP AS3 3.38 and later. 
   
In this example, we show how you can use bearer-token authentication when referencing data groups from an external URL in BIG-IP AS3 3.38 and later.  In previous BIG-IP AS3 versions, attempting to use token authentication with data groups referenced from a URL would fail.

For more information and BIG-IP AS3 usage, see |tokenauth|, |dg|, and |rurl| in the Schema Reference. Also see :ref:`ignoreChanges<ignorechange>` for another example of fetching external resources.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **testTenant**.
- An Application named **testApp**.
- A data group named **testDG** that references the group via external URL and authentication set to **bearer-token**.


.. literalinclude:: ../../examples/declarations/example-data-group-token.json
   :language: json

:ref:`Back to top<misc-examples>`

|

.. _adminstate:

Using adminState to disable a virtual, but leave the configuration
``````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for adminState on a virtual service is available in BIG-IP AS3 3.39 and later. 
   
In this example, we show how you can use the **adminState** property on a virtual service in BIG-IP AS3 3.39 and later. This is useful when you want to disable a specific service, but want the configuration to remain, allowing it to be quickly renabled if necessary.  Previously, the only option was to use **"enable: false"** on the virtual service, which would remove the service configuration from the BIG-IP (**enable** controls whether the service exists, **adminState** creates the service either way, but disables the service if set to **disable**).



When you set **adminState** to **disable**, the Service no longer accepts new connection requests, but allows current connections to finish processing before going to a down state.

For more information and BIG-IP AS3 usage, see the Service classes in the Schema Reference, for example |servicehttp|. 

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- An Application named **Application**.
- A virtual server named **service** with **adminState** set to **disable**.



.. literalinclude:: ../../examples/declarations/example-service-admin-state.json
   :language: json

:ref:`Back to top<misc-examples>`



.. |mon| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-local-traffic-manager-monitors-reference-13-1-0/3.html#GUID-97A75674-658E-402D-BD54-50CFD83BF0F0" target="_blank">External Monitor documentation</a>


.. |sa| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-address" target="_blank">Schema Reference: Service_Address</a>

.. |clone| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-basics-14-0-0/04.html#GUID-427FCD5A-4AF8-4903-A642-3B9B26F0A268" target="_blank">Clone Pools</a>

.. |rurl| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#resource-url" target="_blank">Resource_URL</a>

.. |redeploy| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/as3-api.html#post-actions" target="_blank">POST Action: redeploy</a>

.. |splunklog| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-external-monitoring-implementations-13-1-0/3.html" target="_blank">Configuring High Speed Remote Logging</a>

.. |incl| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#include" target="_blank">Include</a>

.. |src| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-1-0/big-ip-local-traffic-management-basics-14-1-0/about-virtual-servers.html" target="_blank">Virtual Server documentation</a>


.. |internaldocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-implementations-13-1-0/10.html" target="_blank">Configuring Content Adaptation for HTTP Requests and Response</a>

.. |kbvip| raw:: html

   <a href="https://support.f5.com/csp/article/K15819 " target="_blank">K15819</a>

.. |control| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#controls" target="_blank">Controls</a>

.. |adccontrol| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#adc-controls" target="_blank">ADC_Controls</a>

.. |logkb| raw:: html

   <a href="https://support.f5.com/csp/article/K50040950" target="_blank">K50040950 on AskF5</a>

.. |logref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#log-destination" target="_blank">Log_Destination</a>

.. |servicehttp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-http" target="_blank">Schema Reference: Service_HTTP</a>

.. |br| raw:: html

   <br />

.. |sp| raw:: html

   <a href="https://support.f5.com/csp/article/K7820" target="_blank">Overview of SNAT features</a>

.. |spp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-snat-pool" target="_blank">Pointer_SNAT_Pool</a>

.. |mqttdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-16-0-0/big-ip-local-traffic-management-internet-of-things-administration/configuring-mqtt-functionality.html" target="_blank">Configuring MQTT Functionality</a>

.. |tokenauth| raw:: html

    <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#bearer-token-token" target="_blank">Bearer_Token</a>

.. |ifiledoc| raw:: html

    <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-system-irules-concepts-11-6-0/7.html#conceptid" target="_blank">iFile chapter</a>

.. |ifileref| raw:: html

    <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#ifile" target="_blank">iFile</a>

.. |snatnat| raw:: html

    <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/tmos-routing-administration-13-1-0/8.html" target="_blank">NATs and SNATs</a>

.. |poolref| raw:: html

    <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pool" target="_blank">Pool</a>

.. |as3class| raw:: html

    <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#as3" target="_blank">AS3_Class</a>

.. |contentprofiles| raw:: html

    <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-profiles-reference-13-1-0/3.html" target="_blank">Content Profiles</a>

.. |tah| raw:: html

    <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_tag-append-html.html" target="_blank">tag-append-html</a>
    
.. |shape| raw:: html

    <a href="https://www.shapesecurity.com/" target="_blank">F5 Shape Security</a>

.. |htmlrule| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#html-rule" target="_blank">HTML_Rule</a>

.. |DOrd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-declarative-onboarding/latest/composing-a-declaration.html#route-domain-class" target="_blank">Declarative Onboarding</a>

.. |rddocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-1-0/09.html" target="_blank">route domain documentation</a>

.. |pm| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pool-member" target="_blank">Pool_Member</a>

.. |rulecr| raw:: html

   <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_comment-raise-event.html" target="_blank">comment-remove</a>

.. |ruletph| raw:: html

   <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_tag-prepend-html.html" target="_blank">tag-prepend-html</a>

.. |ruletre| raw:: html

   <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_tag-raise-event.html" target="_blank">tag-raise-event</a>

.. |ruletr| raw:: html

   <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_tag-remove.html" target="_blank">tag-remove</a>

.. |ruletra| raw:: html

   <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_tag-remove-attribute.html" target="_blank">tag-remove-attribute</a>

.. |rulecre| raw:: html

   <a href="https://clouddocs.f5.com/api/icontrol-rest/APIRef_tm_ltm_html-rule_comment-raise-event.html" target="_blank">comment-raise-event</a>
 
.. |rurl| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#resource-url" target="_blank">Resource_URL</a>

.. |dg| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#data-group" target="_blank">Data_Group</a>

.. |snatt| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#snat-translation" target="_blank">SNAT_Translation</a>
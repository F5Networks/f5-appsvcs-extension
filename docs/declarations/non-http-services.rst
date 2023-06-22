.. _tcp-examples:

Non-HTTP Services
-----------------
This section contains examples of declarations that create non-HTTP services or objects, such as TCP, UDP, and so on. Also see :ref:`GSLB examples<gslbexamples>`.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

.. _udp-ex:

UDP virtual service
```````````````````
This example is for a UDP DNS load balancer service, and creates the following objects
on the BIG-IP:

- Partition (tenant) named **Sample_non_http_01**.
- A UDP virtual server named **service** on port 53.
- A pool named **Pool1** monitored by the default *ICMP* health monitor.

.. literalinclude:: ../../examples/declarations/example-udp-virtual-service.json
   :language: json

:ref:`Back to top<tcp-examples>`

|

TCP load-balanced to ICAP with custom monitor
`````````````````````````````````````````````
This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_non_http_02**.
- A TCP virtual server named **service** on port 1344 (called _A1 in the BIG-IP GUI).
- A TCP profile using the mptcp-mobile-optimized parent.
- A pool named **svc_pool** containing two members (also using port 1344).
- A custom TCP health monitor with custom Send and Receive strings for ICAP.

.. literalinclude:: ../../examples/declarations/example-tcp-load-balanced-icap-with-custom-monitor.json
   :language: json

:ref:`Back to top<tcp-examples>`

|

.. _fixex:


Using a FIX profile and data groups in a declaration
````````````````````````````````````````````````````
This example shows how you can create a FIX (Financial Information eXchange) Profile which is commonly used for electronic trading. It also shows how the tag substitution mapping can be configured using data groups.
Note: Some FIX features may require appropriate licensing. For more information, see https://www.f5.com/pdf/solution-profiles/fix-solution-profile.pdf.
This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_non_http_04**.
- A standard TCP service named service with a pool named **poolWeb**.
- A FIX Profile.
- A tag substitution mapping using data groups.
- Three types of referenced data groups: (new) internal, (new) external, and an external data group from an existing data-group file.

.. literalinclude:: ../../examples/declarations/example-using-fix-profile-and-data-groups.json
   :language: json


:ref:`Back to top<tcp-examples>`

.. _tcpoptions:

|

Using tcpOptions in a TCP Profile
`````````````````````````````````
This simple example declaration shows how you use TCP Options for use in a TCP profile.  This allows to specify which of the TCP Header option number fields should be collected and stored for iRules.  First and Last determines if the first or last appearance of the field is stored. For information on TCP Options, see https://www.iana.org/assignments/tcp-parameters/tcp-parameters.xml.  For information on using TCP options in iRules, see https://community.f5.com/t5/technical-articles/accessing-tcp-options-from-irules/ta-p/287183.

- Partition (tenant) named **Sample_non_http_06**. 
- A TCP profile named **pTcpOptions** that uses **tcpOptions**.


.. literalinclude:: ../../examples/declarations/example-tcp-options-in-tcp-profile.json
   :language: json


:ref:`Back to top<tcp-examples>`

|

.. _ftpsip:

Using existing FTP and SIP profiles in a declaration
````````````````````````````````````````````````````
This example shows how you can use existing SIP and FTP profiles in a declaration.  In this example, our BIG-IP system already has **testSIP** and **testFTP** profiles in the Common partition.  See the :ref:`Schema Reference<schema-reference>` for usage options and information.

.. NOTE:: In BIG-IP AS3 3.39 and later, you can also reference a SIP profile from the |serviceudp| class.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_profile_03**.
- Two TCP services (virtual servers) named **service**, with Descriptions of A1 and A2.
- A profileSIP object that references our existing testSIP profile.
- A profileFTP object that references our existing testFTP profile.  

.. literalinclude:: ../../examples/declarations/example-using-ftp-sip-profiles.json
   :language: json


:ref:`Back to top<tcp-examples>`

|

.. _ftpprof:


Creating an FTP profile in a declaration
````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for including an ALG logging profile and log publisher in an FTP profile is available in BIG-IP AS3 3.43 and later. 
   
This example shows how you can create an FTP profile in a declaration (the previous example showed how to use an existing FTP profile).   

See |ftpprofile| in the Schema Reference for more usage options and information.

**New in BIG-IP AS3 3.43** |br|
BIG-IP AS3 3.43 adds the ability to include an :ref:`ALG Log Profile<alglog>` and log publisher to an FTP profile, allowing flexibility when setting logging parameters.

.. IMPORTANT:: In the following example, the **algLogProfile** and **logPublisher** properties require the CGNAT module to be provisioned and BIG-IP version to be 15.1 or higher.

This declaration creates the following objects on the BIG-IP (**NOTE** If you attempt to use this declaration on an AS3 version prior to 3.43, it will fail.  Remove the ALG profile and log publisher for previous versions):

- Partition (tenant) named **TEST_FTP_Profile**.
- An Application named **Application**
- A virtual server named **service** that references the FTP profile
- A FTP profile named **sampleFTPprofile** which includes an ALG Log profile and log publisher.

.. literalinclude:: ../../examples/declarations/example-ftp-profile.json
   :language: json


:ref:`Back to top<tcp-examples>`

|

.. _tftpprof:


Creating a TFTP profile in a declaration
````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for creating a TFTP profile is available in BIG-IP AS3 3.43 and later. 

This updated example shows how you can create a TFTP (Trivial File Transfer Protocol) profile in a declaration using BIG-IP AS3 3.43 and later.  In previous versions of BIG-IP AS3, you could reference an existing profile, but not create one.

The TFTP profile allows you to configure the BIG-IP system to read and write files from or to a remote server. See the |tftpdoc| chapter of the BIG-IP documentation for detailed information.

See |tftpp| in the Schema Reference for information on available properties and AS3 usage options.

.. IMPORTANT:: In the following example, the **algLogProfile** and **logPublisher** properties require the CGNAT module to be provisioned and BIG-IP version to be 15.1 or higher.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_Service_UDP**. 
- An Application named **Application**.
- A virtual service named **service** that references the TFTP profile
- A TFTP profile named **TFTP_profile** with a number of configured properties.
- An :ref:`ALG Log Profile<alglog>` named **ALG_Log_profile** with a number of configured properties.

.. literalinclude:: ../../examples/declarations/example-tftp-profile.json
   :language: json


:ref:`Back to top<tcp-examples>`

|

.. _bbrcc:


Setting BBR Congestion Control in a TCP profile with AS3
````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for BBR Congestion Control is ONLY supported in BIG-IP (TMOS) version 14.1 and later.  
   
This simple example shows how you can now use **bbr** as a Congestion Control option in the TCP profile.  **This feature is only available in BIG-IP versions 14.1 and later**.  When Congestion Control is set to **bbr**, the system uses a TCP algorithm that is optimized to achieve higher bandwidths and lower latencies. See the |bbrtcp| for detailed information.

See |bbrref| in the :ref:`Schema Reference<schema-reference>` for usage options.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_BBR_CC**. 
- A virtual service named **BBRcc** that only creates a TCP Profile with Congestion Control set to **bbr**.

.. literalinclude:: ../../examples/declarations/example-bbr-congestion-control.json
   :language: json


:ref:`Back to top<tcp-examples>`

|

.. _sctpex:


Configuring SCTP services and referencing SCTP profiles in a declaration
````````````````````````````````````````````````````````````````````````
This example shows how you can reference existing SCTP profiles in a BIG-IP AS3 declaration. It also shows the new Service_SCTP class, which creates a virtual service that uses the SCTP protocol.  For information on BIG-IP and the SCTP profile, see |sctpdocs| in the product manual. For AS3, see |servicesctp| for detailed information and usage for the SCTP Class, and |sctpprof| for the SCTP profile.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_sctp_01**. 
- An application named **mySCTP** that uses the sctp template.
- A virtual service named **service** that uses Service_SCTP, and references an existing SCTP profile on the BIG-IP system.

.. literalinclude:: ../../examples/declarations/example-referencing-sctp-profile.json
   :language: json


:ref:`Back to top<tcp-examples>`

|

.. _icapex:


Referencing existing ICAP profiles in a declaration
```````````````````````````````````````````````````
This example shows how you can reference an existing ICA (Internet Content Adaptation Protocol) profile in a declaration.  You can use an ICAP profile when you want to use the BIG-IP content adaptation feature for adapting HTTP requests and responses. This feature allows a BIG-IP virtual server to conditionally forward HTTP requests and HTTP responses to a pool of ICAP servers for modification, before sending a request to a web server or returning a response to the client system. For more information on using the ICAP profile, see the |icapdocs|.

.. IMPORTANT:: ICAP profile must use TCP services and is only supported in |servicetcp|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_ICAP_profile**. 
- An application named **TCP_Service** that uses the tcp template.
- A virtual service named **service** that references an existing ICAP profile on the BIG-IP system.

.. literalinclude:: ../../examples/declarations/example-referencing-icap-profile.json
   :language: json

|

.. _forward:

Using IP or L2 Forwarding in a declaration
``````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing an existing NAT policy is available in BIG-IP AS3 3.31 and later. You must have the BIG-IP AFM module provisioned

In this example, we show how you can use the Service_Forwarding class to create IP or L2 Forwarding virtual services. 

An IP forwarding virtual server accepts traffic that matches the virtual server address and forwards it to the destination IP address that is specified in the request rather than load balancing the traffic to a pool. For more information, see |forwardip|.

A L2 forwarding virtual server does not have pool members to load balance and forwards packets based on routing decisions. For more information and requirements, see |forwardl2|.

**New in BIG-IP AS3 3.31** |br|
BIG-IP AS3 3.31 added support for referencing an existing NAT policy using a BIG-IP AS3 pointer (**use**). AFM NAT policies are ordered lists of NAT rules. You must have the AFM module provisioned to use this feature. For information on NAT policies, see |afmnat|.

|

.. IMPORTANT:: In BIG-IP AS3 3.27 and later, ARP and ICMP Echo are disabled on virtualAddresses by default.

For additional details and BIG-IP AS3 usage, see |forwardservice| in the Schema Reference.

.. WARNING:: This example has been updated to include referencing a NAT policy introduced in BIG-IP AS3 3.31. If you attempt to use this declaration on a previous version, it will fail unless you remove the lines highlighted in yellow (only the comma from line 27).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Forward_tenant**.
- An Application named **SampleApp**.
- A IP Forwarding virtual server named **myService** which uses the |forwardservice| class, and references an existing NAT policy.
- A pointer to a NAT policy that already exists on the BIG-IP.

.. literalinclude:: ../../examples/declarations/example-forwarding-virtual-server.json
   :language: json
   :linenos:
   :emphasize-lines: 13-15, 27-30

:ref:`Back to top<tcp-examples>`

|

.. _fwvips:

Creating multiple forwarding virtual services on different ports
````````````````````````````````````````````````````````````````
In this example, we show how you can create multiple forwarding virtual services (servers) on different ports in a single declaration.  

This example contains three forwarding virtual services, one on a specific port, and the others that use **0** and **any**. 

Both **0** and **any** signify a wildcard (any port) and can be used interchangeably.  

For more information and requirements, see |forwardl2|. For additional details and BIG-IP AS3 usage, see |forwardservice| in the Schema Reference.

.. IMPORTANT:: In BIG-IP AS3 3.27 and later, ARP and ICMP Echo are disabled on virtualAddresses by default.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **FirstAppForwarder**.
- An Application named **SampleApp**.
- A IP Forwarding virtual server named **myService0** which uses the |forwardservice| class, with two virtual addresses and a virtual port of 0 (any port).
- An Application named **SecondAppForwarder**.
- A IP Forwarding virtual server named **myService55000** which uses the |forwardservice| class, with the same two virtual addresses and a virtual port of 55000.
- An Application named **ThirdAppForwarder**.
- A IP Forwarding virtual server named **myServiceAny** which uses the |forwardservice| class, with the same two virtual addresses and a virtual port of Any (any port).


.. literalinclude:: ../../examples/declarations/example-multiple-fwd-vs.json
   :language: json

:ref:`Back to top<tcp-examples>`

|

.. _statelessudp:

Creating a stateless UDP virtual server
```````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for stateless UDP virtual servers is available in BIG-IP AS3 3.40 and later. 


In this example, we show how you can create a stateless UDP virtual server with an AS3 declaration. Using a stateless UDP virtual server can save BIG-IP resources and improve performance when you don't need to use the advanced properties of a UDP virtual server. For more information on stateless virtual servers, see |stateless| on AskF5.

**IMPORTANT** |br|
For a stateless UDP virtual server, you need do the following:

- Set **virtualType** to **stateless**
- Set **translateClientPort** and **translateServerPort** to **false**
- Supply a pool in the declaration.

For additional details and BIG-IP AS3 usage, see |serviceudp| in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- An Application named **Application**.
- A virtual server named **service** using the Service_UDP class and type set to **stateless** and **translateClientPort** and **translateServerPort** to **false**.  It also references an existing pool on the BIG-IP.


.. literalinclude:: ../../examples/declarations/example-service-udp-stateless.json
   :language: json

:ref:`Back to top<tcp-examples>`


|

.. _portlist:

Creating port and address lists for a service
`````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for creating port lists for a virtual service is available in BIG-IP AS3 3.46 and later. |br| You must have BIG-IP v14.1 or later with the AFM module licensed and provisioned.

In this example, we show how you can create address and port lists for a virtual service in AS3 3.46 and later. These objects were already supported in AS3, but not directly on a virtual service. Using address and port lists allows you to define multiple addresses and ports for a single virtual service.

When you include a Firewall_Port_List in the declaration, BIG-IP AS3 creates a traffic-matching-criteria object in the background which defines how traffic is steered towards the virtual service.

Although this example uses both address and port lists, it is not a requirement and either can be used alone. 

For additional details and BIG-IP AS3 usage, see |fwal|, |fwpl|, and |servicetcp| in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- An Application named **Application**.
- Multiple firewall address lists. One is used for source addresses, and the others for destination addresses.
- A firewall port list named **portList** that includes port 8080 and a range of ports from 1-999.
- A virtual server named **service** using the Service_TCP class that references the address lists defined for source and destination, and the port list. 


.. literalinclude:: ../../examples/declarations/example-service-tcp-with-source-destination-lists.json
   :language: json

:ref:`Back to top<tcp-examples>`

 

.. |stateless| raw:: html

   <a href="https://support.f5.com/csp/article/K13675" target="_blank">Overview of the stateless virtual server</a>

.. |tftpp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tftp-profile" target="_blank">TFTP_Profile</a>

.. |tftpdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-0-0/big-ip-cgnat-implementations-14-0-0/using-alg-profiles.html#GUID-EC2E4FDD-C0DF-4336-876B-FDADB8802133" target="_blank">Using the TFTP ALG profile to transfer files</a>


.. |bbrtcp| raw:: html

   <a href="https://support.f5.com/csp/article/K29377715" target="_blank">Overview of the TCP profile (14.x)</a>

.. |bbrref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tcp-profile" target="_blank">TCP_Profile</a>

.. |ftpprofile| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#ftp-profile" target="_blank">FTP_Profile</a>

.. |servicesctp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-sctp" target="_blank">Service_SCTP</a>

.. |sctpprof| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-sctp-profile" target="_blank">Pointer_SCTP_Profile</a>

.. |sctpdocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-profiles-reference-13-0-0/5.html#GUID-E04C4324-97DB-40F0-BE78-6AD994CC0ABE" target="_blank">SCTP Profile Type</a>

.. |servicetcp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-tcp" target="_blank">Service_TCP</a>

.. |icapdocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-profiles-reference-14-1-0/02.html#GUID-68D2C996-7D0C-402C-9C87-6F9349895FD0" target="_blank">BIG-IP documentation</a>

.. |forwardip| raw:: html

   <a href="https://support.f5.com/csp/article/K7595" target="_blank">Overview of IP forwarding virtual servers</a>

.. |forwardl2| raw:: html

   <a href="https://support.f5.com/csp/article/K10371011" target="_blank">Overview of the Forwarding (Layer 2) virtual server</a>

.. |forwardservice| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-forwarding" target="_blank">Service_Forwarding</a>


.. |gslbvip| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-virtual-server" target="_blank">GSLB_Virtual_Server</a>


.. |br| raw:: html

   <br />

.. |afmnat| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-afm-nat.html" target="_blank">BIG-IP AFM: NAT Policies and Implementations</a>

.. |serviceudp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-udp" target="_blank">Service_UDP</a>

.. |fwpl| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#firewall-port-list" target="_blank">Firewall_Port_List</a>

.. |fwal| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#firewall-address-list" target="_blank">Firewall_Address_List</a>



#firewall-port-list




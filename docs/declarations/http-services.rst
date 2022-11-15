.. _http-examples:

HTTP Services
-------------
This section contains examples of declarations that create HTTP and/or HTTP services.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.


HTTP with custom persistence
````````````````````````````
In this example, we create a simple HTTP service, which uses the BIG-IP AS3 pointer *use* to declare a custom persistence profile.
  
This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_01**.
- An HTTP virtual server named **service** (called _A1 in the BIG-IP GUI).
- A pool named **web_pool** containing two members using the HTTP health monitor.
- A custom persistence profile based on cookie persistence for JSESSIONID.

  .. literalinclude:: ../../examples/declarations/example-http-custom-persistence.json
    :language: json


:ref:`Back to top<http-examples>`

|

HTTP with no compression, BIG-IP TCP profile, iRule for pool
`````````````````````````````````````````````````````````````
In this example, we create separate internal and external pools, and use an iRule to direct
traffic based on the IP address of the client.
This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_02**.
- Virtual server (HTTP) named **service** (called _A1 in the BIG-IP GUI).
- A TCP profile using the mptcp-mobile-optimized parent.  This *bigip* keyword exists
  in the TCP profile section schema and tells the system to look for the pathname of an
  existing TCP profile.
- Two pools named **dfl_pool** and **pvt_pool**, each with 2 members monitored by the
  default *HTTP* health monitor.
- An iRule which sends internal users to a private pool based on their IP address.

.. literalinclude:: ../../examples/declarations/example-http-no-compression-tcp-profile-irule-for-pool.json
   :language: json

:ref:`Back to top<http-examples>`



HTTP with additional virtual service for corporate clients
``````````````````````````````````````````````````````````
This example shows how you can create a declaration with two virtual services, one that could be used for clients on the corporate LAN for example.

This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_03**.
- Two HTTP virtual servers named **service** (called _A1 in the BIG-IP GUI) and **pvt_vs**.
- A pool named **web_pool** containing two members using the HTTP health monitor.  Both virtual servers reference this pool.
- A custom persistence profile based on cookie persistence for JSESSIONID.

.. literalinclude:: ../../examples/declarations/example-http-extra-virtual-servers.json
   :language: json

:ref:`Back to top<http-examples>`

|

HTTP and HTTPS virtual services in one declaration
``````````````````````````````````````````````````
This example shows how you can create an HTTP and HTTPS virtual service in the same declaration.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_04**.
- An HTTP virtual server named **service** (called _A1 in the BIG-IP GUI) and an HTTPS virtual server named **A2**.
- A pool named **gce_pool** and a pool named **web_pool**, each containing two members using the HTTP health monitor.
- TLS/SSL profile (that references a Certificate class) named **TLS_Server**.  In the BIG-IP UI, this is a Client SSL profile.

.. literalinclude:: ../../examples/declarations/example-http-https-one-declaration.json
   :language: json

:ref:`Back to top<http-examples>`

|

Two applications sharing a pool
```````````````````````````````
In this example, we show a declaration that creates two applications that use the
same load balancing pool. In this scenario, one of our virtual servers is for HTTP
(port 80) traffic and one for HTTPS (port 443) traffic.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

It creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_05**.
- Three virtual servers, one HTTP and one HTTPS. The names are _A1, _A2, and a _A2-Redirect (created by default to redirect port 80 traffic to 443).
- TLS/SSL profile (including certificate and private key) named **TLS_Server**.  In the BIG-IP UI, this is a Client SSL profile.
- Pool named **dual_pool** with 2 members monitored by the default *HTTP* health monitor. Both virtual servers reference this same pool.

.. literalinclude:: ../../examples/declarations/example-two-applications-share-pool.json
   :language: json

:ref:`Back to top<http-examples>`


|

.. _multiport:

Virtual server listening on multiple ports on the same address
``````````````````````````````````````````````````````````````
This example shows how you can compose a declaration with services using the same virtual IP address, but using multiple ports.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_07**.
- Three virtual servers: **service**, **service_on_port81**, and **service_on_port82**, all using the same IP address (10.1.10.10), but listening on different ports.
- Three pools: **web_pool80**, **web_pool81**, and **web_pool82**, all monitored by the default *http* health monitor.


.. literalinclude:: ../../examples/declarations/example-vs-listening-on-multiple-ports.json
   :language: json


:ref:`Back to top<http-examples>`

|

.. _policyex:


Using a Local Traffic Policy to forward HTTP Requests
`````````````````````````````````````````````````````
This example uses a BIG-IP Local Traffic Policy with URL Routing that forwards any
HTTP requests that have a path containing *example.com* to the pool *web_pool*.  For
more information, see |ltmpolicy| in the BIG-IP documentation.  For usage,
see **Endpoint_Policy** in :ref:`Schema Reference<schema-reference>`.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_08**.
- A virtual server named **service**.
- A pool named **web_pool** monitored by the default *http* health monitor.
- A BIG-IP Local Traffic Policy with a rule that forwards any request for example.com to the web_pool.

.. literalinclude:: ../../examples/declarations/example-local-traffic-policy-to-forward-http-requests.json
   :language: json

:ref:`Back to top<http-examples>`

|

.. _nat64ex:

Enabling NAT64 in a declaration
```````````````````````````````
This example shows how to enable NAT64 in a BIG-IP AS3 declaration.  NAT64 maps IPv6 addresses to IPv4 destinations, and is either enabled or disabled by using **nat64Enabled** property using true or false values (false is the default).  For more information on NAT64, see the |nat64| deployment guide; while this guide was written for older versions of the BIG-IP, the information is still valid.  You can also see the Service classes in the Schema Reference, for example |httpserv|.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **example_NAT64**.
- A virtual server named **service** with an IPv6 address and NAT64 enabled.
- A pool named **web_pool** monitored by the default *http* health monitor.

.. literalinclude:: ../../examples/declarations/example-nat64.json
   :language: json

:ref:`Back to top<http-examples>`

|

.. _httpprofile:

Configuring an HTTP profile with a Proxy Connect profile
````````````````````````````````````````````````````````
This example shows how to configure an |httpprof| with a Proxy Connect profile in BIG-IP AS3 3.32 and later. An HTTP Proxy Connect profile enables a BIG-IP device to connect to a remote, down-stream proxy device. There are no configuration settings, it is either enabled or disabled. 

When you enable the Proxy Connect profile, BIG-IP AS3 uses the following syntax to name the profile: ``f5_appsvcs_<Name of HTTP profile>_proxyConnect``. In the example declaration, the name of the profile is **f5_appsvcs_httpProfile_proxyConnect**. 

For more information on HTTP Proxy Connect profiles and manual configuration instructions, see the |proxyconnect|.

For BIG-IP AS3 usage, see |httpprof|.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- A virtual server named **service** that references an HTTP profile.
- An HTTP profile named **httpProfile** with **proxyConnectEnabled** set to **true**, meaning it is enabled.

.. literalinclude:: ../../examples/declarations/example-http-proxy-connect-profile.json
   :language: json

:ref:`Back to top<http-examples>`

|

.. _httpenforce:

Configuring enforcement properties in an HTTP profile
`````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for the **allowBlankSpaceAfterHeaderName** (requires BIG-IP 16.1+) and **enforceRFCCompliance** (requires BIG-IP 15.0+) properties of the HTTP profile are available in BIG-IP AS3 3.40 and later.

This example shows how create HTTP profiles that include two enforcement properties introduced in AS3 3.40: **allowBlankSpaceAfterHeaderName** and **enforceRFCCompliance**.

The **allowBlankSpaceAfterHeaderName** property requires BIG-IP 16.1 or later, and specifies whether to allow blank space in an HTTP header between the header name and the separator colon in an HTTP request or response. 

The **enforceRFCCompliance** property requires BIG-IP 15.0 or later, and causes the BIG-IP LTM to perform basic RFC compliance checks as described in the latest RFC for the HTTP protocol. If a client request fails these checks, the connection is reset.

The other properties have been a part of AS3 for a number of releases.  See |httpprof| for all available properties and usage.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Enforcement_Tenant**.
- An Application named **Enforcement_Application**.
- A virtual server named **service** that references one of the HTTP profiles.
- Three HTTP profiles representing the three proxy types, all using **allowBlankSpaceAfterHeaderName** and/or **enforceRFCCompliance** along with a number of additional properties.

.. literalinclude:: ../../examples/declarations/example-http-enforcement-properties.json
   :language: json

:ref:`Back to top<http-examples>`

|


.. |ltmpolicy| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-local-traffic-policies-getting-started-13-1-0/1.html" target="_blank">Local Traffic Policy</a>

.. |nat64| raw:: html

   <a href="https://www.f5.com/services/resources/deployment-guides/ip-address-sharing-in-large-scale-networks-dns64na" target="_blank">IP Address Sharing in Large Scale Networks</a>

.. |httpserv| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-http" target="_blank">Service_HTTP class</a>

.. |br| raw:: html

   <br />

.. |httpprof| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#http-profile" target="_blank">HTTP Profile</a>

.. |proxyconnect| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-0-0/big-ip-local-traffic-manager-implementations/configuring-an-explicit-http-proxy-chain.html" target="_blank">BIG-IP documentation</a>




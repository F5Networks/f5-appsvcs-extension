.. _profile-examples:

Profiles
--------
This section contains example declarations that include useful BIG-IP profiles.  This page does not include TLS/SSL profiles, see :doc:`tls-encryption` for TLS/SSL profile examples.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

.. _avrex:


Creating an HTTP Analytics profile in a declaration
```````````````````````````````````````````````````
These examples show how you can use the Application Visibility and Reporting (AVR, or Analytics) module in a declaration as an analytics profile.  The Analytics profile is a set of definitions that determines the circumstances under which the system gathers, logs, notifies, and graphically displays information regarding traffic to an application.  For detailed information on AVR and the Analytics profile, see the |avr| guide and |analytics| in the Schema Reference for information and usage options for using these features in your BIG-IP AS3 declarations.

Important notes for using an Analytics profile:

- You must have AVR provisioned on your BIG-IP system.
- You **cannot** be using a BIG-IP version between 13.1 and 13.1.0.6 to use the Analytics profile. There are certain properties that currently do not work on these versions.
- The notificationBySnmp property set to true requires configuration of SNMP.  BIG-IP AS3 does not support configuration of SNMP.
- The notificationByEmail property set to true requires the configuration of SMTP.  In addition a HTTP Analytics profile inherits this property from the base /Common/analytics profile.  BIG-IP AS3 does not support configuration of SMTP or modification of the base /Common/analytics profile.
- The following properties have recommended values that are different than the default values:

  - **collectClientSideStatistics** - recommended value **true** (default value is false)
  - **collectOsAndBrowser** - recommended value **false** (default value is true)
  - **collectMethod** - recommended value **false** (default value is true)

There are two example declarations, one simple, one more full-featured. Both of the following declarations create the following objects on the BIG-IP:

- Partition (tenant) named **Sample_profile_01**.
- An HTTP service (virtual server) named **serviceHttp**.
- An analytics profile for collecting statistics.  See the schema reference and documentation for details.



a: Simple example of HTTP Analytics profile
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. literalinclude:: ../../examples/declarations/example-analytics-profile-simple.json
   :language: json

|

b: Detailed example of HTTP Analytics profile
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. literalinclude:: ../../examples/declarations/example-analytics-profile.json
   :language: json

:ref:`Back to top<profile-examples>`

|

.. _captureex:


Using an Analytics profile with a Capture filter
````````````````````````````````````````````````
These examples show how you can use the capture filter with the analytics profile to collect application traffic so that you can troubleshoot problems that have become apparent by monitoring application statistics.  For detailed information the Capture filter, see the |capture| documentation and |analytics| in the Schema Reference for information and usage options for using these features in your BIG-IP AS3 declarations.

Important notes for using an Analytics profile:

- You must have AVR provisioned on your BIG-IP system.
- You **cannot** be using a BIG-IP version between 13.1 and 13.1.0.6 to use the Analytics profile. There are certain properties that currently do not work on these versions.

There are two example declarations, one simple, one more full-featured. Both of the following declarations create the following objects on the BIG-IP:

- Partition (tenant) named **Sample_analytics_capture**.
- An HTTP service (virtual server) named **serviceHttp**.
- An analytics profile for collecting statistics with a capture filter.  See the schema reference and documentation for details.


a: Simple example of HTTP Analytics profile with Capture filter
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. literalinclude:: ../../examples/declarations/example-analytics-capture-simple.json
   :language: json

|

b: Detailed example of HTTP Analytics profile with Capture filter
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. literalinclude:: ../../examples/declarations/example-analytics-capture.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _oneconnect:

Using a Multiplex (OneConnect) profile in a declaration
```````````````````````````````````````````````````````
This example shows how you can use a multiplex (called OneConnect on the BIG-IP) profile in your declarations.  See the :ref:`Schema Reference<schema-reference>` for usage options and information.  For more information on the OneConnect profile, see |oneconnect| in the BIG-IP documentation.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_profile_02**.
- An HTTP service (virtual server) named **service**.
- An OneConnect profile named **testMux** for multiplexing connections.

.. literalinclude:: ../../examples/declarations/example-multiplex-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

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


:ref:`Back to top<profile-examples>`

.. _trafficlog:

Using a Traffic Log profile in a declaration
````````````````````````````````````````````
This example shows how you can use a Traffic Log profile in a declaration. The Traffic Log profile in BIG-IP AS3 creates a Request Logging profile on the BIG-IP system, which gives you the ability to configure data within a log file for HTTP requests and responses, in accordance with specified parameters. For more information, see |requestlog|, and the :ref:`Schema Reference<schema-reference>` for BIG-IP AS3 usage options and information.  

This declaration creates the following objects on the BIG-IP:

- Two partitions (tenants) named **Sample_profile_04**, and **tenant2**.
- The Sample_profile_04 tenant includes a detailed Traffic Log profile (see |tl| in the Schema Reference for details and usage) and a pool named "thePool".
- The tenant2 tenant includes a virtual server named **service** and the default Traffic Log profile.

**Note**: This example does not include real certificates, so if you post the following declaration, you will receive an invalid certificate error.  Replace the values of **certificate** and **privateKey** with your own certificates.

.. literalinclude:: ../../examples/declarations/example-traffic-log-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _websocket:


Using a WebSocket profile in a declaration
``````````````````````````````````````````
This example shows how you can use a WebSocket profile in a declaration.  When you assign a WebSocket profile to a virtual server, the virtual server informs clients that a WebSocket virtual server is available to respond to WebSocket requests. WebSocket frames that contain payload data are masked with a 32-bit key. You can determine what the BIG-IP system does with this key by specifying one of the following values: preserve, remask, selective, unmask.  For detailed information on the WebSocket profile, see |socket| and |ws| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_profile_05**.
- An HTTP service (virtual server) named **service**.
- An HTTP profile that includes WebSocket properties.


.. literalinclude:: ../../examples/declarations/example-websocket-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _rewrite:


Using a Rewrite profile in a declaration
````````````````````````````````````````
This example shows how you can use a Rewrite profile in a declaration.  With a Rewrite profile, the BIG-IP system can perform URI scheme, host, port, and path modifications as HTTP traffic passes through the system.  For detailed information, see |rewrite| and |rw| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_profile_06**.
- A Generic service (virtual server) named **virtualServer**.
- A Rewrite profile named **rewriteProf** that includes a number of properties (see |rw| in the Schema Reference for details and usage).

.. literalinclude:: ../../examples/declarations/example-using-rewrite-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _dosexample1:


Using a DoS profile in a declaration
````````````````````````````````````
This example shows how you can use a Denial of Service (DoS) profile in a declaration.  The DoS profile can provide specific attack prevention at a very granular level.  In the following example, we include nearly all of the available features in the DoS profile, with the exception of Mobile Defense, which we show in example 10.
For detailed information on DoS profiles and the features in this declaration, see |dosdocs|.  Also see the :ref:`Schema Reference<schema-reference>` for usage options for using these features in your BIG-IP AS3 declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_dos_01**.
- A DoS profile with denylisted and allowlisted geolocations and address lists, URL protection, bot defense, rate-based protection and more. See the documentation and schema reference for details.


.. literalinclude:: ../../examples/declarations/example-dos-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _dosmobile1:


Using a DoS profile for Mobile Defense
``````````````````````````````````````
This example shows how you can use a Denial of Service (DoS) profile in a declaration specific to mobile protection.  See the :ref:`Schema Reference<schema-reference>` for usage options for using these features in your BIG-IP AS3 declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_dos_02**.
- A DoS profile with mobile defense enabled.


.. literalinclude:: ../../examples/declarations/example-dos-profile-for-mobile-defense.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _accel:

Using a HTTP Acceleration profile in a declaration
``````````````````````````````````````````````````
This example shows how you can use a Web (HTTP) Acceleration profile in a declaration, which helps speed your HTTP traffic.  For detailed information, see |webaccel| and |httpaccel| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_profile_06**.
- A Generic service (virtual server) named **http_accel**.
- A Web Acceleration profile named **testItem** that includes a number of properties (see |httpaccel| in the Schema Reference for details and usage).
-

.. literalinclude:: ../../examples/declarations/example-http-acceleration-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _securitylog:

Using a Security log profile with Application Security
``````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   The Application Security options for the Security Log Profile use the BIG-IP ASM module.

This example shows how you can use a BIG-IP ASM Security Logging profile with application security in a declaration (you must have ASM licensed and provisioned to use this profile). Logging profiles determine where events are logged, and which items (such as which parts of requests, or which type of errors) are logged. For more information on ASM logging profiles, see |securitylog|, and |seclog| in the Schema Reference for BIG-IP AS3 usage options and information.

There are two declarations in this example, one that uses local storage for the logs, and one that uses remote storage.

..local:

Local storage
^^^^^^^^^^^^^
This declaration creates a security log profile that uses local storage (for the remote storage example, click ref:`remote`).  This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Security_Log_Local**.
- A Security Log Profile named **secLogLocal** with Application Security enabled which stores logs locally.


.. literalinclude:: ../../examples/declarations/example-security-log-profile-local.json
   :language: json

|

..remote:

Remote storage
^^^^^^^^^^^^^^
This declaration creates a security log profile that uses remote storage (for the local storage example, click ref:`local`).  This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Security_Log_Remote**.
- A Security Log Profile named **secLogRemote** with Application Security enabled, which sends logs to a remote logging server on port 9876.


.. literalinclude:: ../../examples/declarations/example-security-log-profile-remote.json
   :language: json

:ref:`Back to top<profile-examples>`

|

.. _stream:


Using a Stream profile in a declaration
```````````````````````````````````````
This example shows how you can use a Stream profile in a declaration.  With a Stream profile, the BIG-IP system performs a search and replace procedure for all occurrences of a string in a data stream, such as a TCP connection.  For detailed information, see |streamprofile| and |streamprof| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Stream_tenant**.
- An HTTP service (virtual server) named **Stream_service** on port 100.
- A Stream profile named **Stream_profile** that includes a number of properties (see |streamprof| in the Schema Reference for details and usage). This declaration also includes a default stream profile that is not referenced by the virtual server.


.. literalinclude:: ../../examples/declarations/example-stream-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

Creating an FTP profile in a declaration
````````````````````````````````````````
This example shows how you can create an FTP profile in a declaration (example (#4) showed how to use an existing FTP profile).   See |ftpprofile| in the Schema Reference for more usage options and information.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_FTP_Profile**.
- A FTP profile named **sampleFTPprofile**.

.. literalinclude:: ../../examples/declarations/example-ftp-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _irulelxprof:

Referencing existing iRules LX Profiles
```````````````````````````````````````
This example shows how you can reference an existing iRules LX profile in a BIG-IP virtual server.  An iRules LX profile is a method to associate an LX Plugin to a virtual server.   See the BIG-IP documentation for more information on iRules LX profiles.

There are a few things to note about iRules LX profiles:

- You must be using BIG-IP (TMOS) v13.0 or later.
- You must provision the **iRules Language Extensions (iRulesLX)**.
- BIG-IP AS3 cannot yet create iRules LX Profiles, but can reference them.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_ILX_Profile**.
- A virtual service named **exampleVS**
- A **profileILX** property referencing an existing iRules LX profile on the target BIG-IP.

.. literalinclude:: ../../examples/declarations/example-iruleslx-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _http2-ex:

Using the HTTP/2 profile in a declaration
`````````````````````````````````````````
This example shows how you can create an HTTP/2 profile in a declaration. 

See |http2profile|, and |http2ref| in the Schema Reference for more usage options and information.

See |http2doc| for more information on configuring HTTP/2 Full Proxy support on the BIG-IP.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TENANT_1**.
- An HTTP/2 profile named **http2profile** with a number of properties.
- A Client SSL profile (Server TLS in AS3) referencing a certificate.
- A virtual service named **service** that calls the HTTP/2 profile and SSL profile.

.. literalinclude:: ../../examples/declarations/example-http2.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _rtsp-ex:

Creating an RTSP profile in a declaration
`````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for creating RSTP profiles in a declaration is available in AS3 3.43 and later.

This updated example shows how you can create an RTSP profile in a declaration using BIG-IP AS3 3.43 and later.  In previous versions of BIG-IP AS3, you could reference an existing profile, but not create one. For information on RTSP, see |rtspref|; for information on the RTSP profile, see the |rtspdoc|.  

See |rtsp| in the Schema Reference for AS3 options and usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **example_RTSP**.
- An Application named **App1**.
- A virtual service named **RTSP_vs** which references the RTSP profile
- An RTSP profile named **RTSP_profile** with a number of configured properties.
- An :ref:`ALG Log Profile<alglog>` named **ALG_Log_profile** with a number of configured properties.

.. literalinclude:: ../../examples/declarations/example-rtsp-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _tcpavr:


Creating a TCP Analytics profile in a declaration
`````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You must have AVR provisioned on your BIG-IP system.

This example shows how you can use the Application Visibility and Reporting (AVR, or Analytics) module in a declaration as a TCP analytics profile (for an HTTP Analytics profile, see :ref:`avrex`).  The Analytics profile is a set of definitions that determines the circumstances under which the system gathers, logs, notifies, and graphically displays information regarding traffic to an application.

For detailed information on AVR and the Analytics profile, see |tcpanalytics| in the Schema Reference for information and usage options for using these features in your BIG-IP AS3 declarations, and the |avr| guide.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TcpAnalytics**.
- A TCP service (virtual server) named **serviceHttp**.
- A TCP analytics profile in the virtual service named **myAnalyticsTcp** for collecting statistics.  See |tcpanalytics| in the schema reference and for details on the options.

.. literalinclude:: ../../examples/declarations/example-tcp-analytics.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _pptpex:

Referencing a PPTP profile in a declaration
```````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You must have AVR provisioned on your BIG-IP system.

This example shows how you can reference an existing PPTP profile in a declaration.  The PPTP (point-to-point tunneling protocol) profile enables you to configure the BIG-IP system to support a secure virtual private network (VPN) tunnel that forwards PPTP control and data connections. The PPTP protocol is described in RFC 2637.

.. IMPORTANT:: You cannot combine or use the PPTP Profile with another profile other than a TCP Profile. The PPTP Profile must be used separately and independently.

For detailed information on the PPTP profile, see |pptpref| and |pptpdoc|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_pptp_profile**.
- An TCP service (virtual server) named **service**, which references an existing PPTP profile on the BIG-IP system.


.. literalinclude:: ../../examples/declarations/example-referencing-pptp-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

Configuring SCTP services and referencing SCTP profiles in a declaration
````````````````````````````````````````````````````````````````````````
This example shows how you can reference existing SCTP profiles in a BIG-IP AS3 declaration. It also shows the new Service_SCTP class, which creates a virtual service that uses the SCTP protocol.  For information on BIG-IP and the SCTP profile, see |sctpdocs| in the product manual. For AS3, see |servicesctp| for detailed information and usage for the SCTP Class, and |sctpprof| for the SCTP profile.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_sctp_01**.
- An application named **mySCTP** that uses the sctp template.
- A virtual service named **service** that uses Service_SCTP, and references an existing SCTP profile on the BIG-IP system.

.. literalinclude:: ../../examples/declarations/example-referencing-sctp-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _adaptex:

Referencing Request and Response Adapt profiles in a declaration
````````````````````````````````````````````````````````````````
This example shows how you can reference an existing Request and Response Adapt profiles in a declaration.  These profiles are a part of the BIG-IP content adaptation feature for adapting HTTP requests and responses.

For detailed information on the Adapt profiles, see |adaptdocs| and |adaptref| in the schema reference for usage guidance.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_adapt_profile**.
- A HTTP service (virtual server) named **service**, which references existing Request and Response Adapt profiles on the BIG-IP system.

.. literalinclude:: ../../examples/declarations/example-referencing-adapt-profiles.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _adaptex2:

Creating Request and Response Adapt profiles in a declaration
`````````````````````````````````````````````````````````````
This example shows how you can create Request and Response Adapt profiles in a declaration.  These profiles are a part of the BIG-IP content adaptation feature for adapting HTTP requests and responses.

For detailed information on the Adapt profiles, see |adaptdocs| and |adaptref| in the schema reference for usage guidance.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **tenant**.
- A HTTP service (virtual server) named **service**, which references Request and Response Adapt profiles in the declaration.
- An Adapt request profile named **adaptRequestProfile** which points to an internal service.
- An Adapt response profile named **adaptResponseProfile** which points to the same internal service.
- An internal TCP virtual server named **internalService**.

.. literalinclude:: ../../examples/declarations/example-adapt-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _icap-ref:

Referencing existing ICAP profiles in a declaration
```````````````````````````````````````````````````
This example shows how you can reference an existing ICAP (Internet Content Adaptation Protocol) profile in a declaration.  You can use an ICAP profile when you want to use the BIG-IP content adaptation feature for adapting HTTP requests and responses. This feature allows a BIG-IP virtual server to conditionally forward HTTP requests and HTTP responses to a pool of ICAP servers for modification, before sending a request to a web server or returning a response to the client system. For more information on using the ICAP profile, see the |icapdocs|.

.. IMPORTANT:: ICAP profile must use TCP services and is only supported in |servicetcp|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_ICAP_profile**.
- An application named **TCP_Service** that uses the tcp template.
- A virtual service named **service** that references an existing ICAP profile on the BIG-IP system.

.. literalinclude:: ../../examples/declarations/example-referencing-icap-profile.json
   :language: json

:ref:`Back to top<profile-examples>`

|

.. _icap:

Creating ICAP profiles in a declaration
```````````````````````````````````````
This example shows how you can create an ICAP profile in a declaration.  You can use an ICAP profile when you want to use the BIG-IP content adaptation feature for adapting HTTP requests and responses.  For more information on using the ICAP profile, see the example above, and |icapdocs|.

.. IMPORTANT:: ICAP profile must use TCP services and is only supported in |servicetcp|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_ICAP_profile**.
- An application named **icapApp**.
- A virtual service named **service** that references an ICAP profile in the declaration.
- An ICAP profile named **icapProfile**

.. literalinclude:: ../../examples/declarations/example-icap-profile.json
   :language: json

:ref:`Back to top<profile-examples>`

|

.. _http2:

Configuring an ingress HTTP/2 profile in an HTTPS service
`````````````````````````````````````````````````````````
This example shows how you can configure a separate HTTP/2 profile for ingress (client-side) traffic on an HTTPS service (only). Prior to version 3.20, you could not specify a specific profile for ingress traffic.

HTTP/2 is a major revision to the HTTP protocol, offering both speed and efficiency benefits. See |http2kb| for a detailed explanation of HTTP/2 profiles on the BIG-IP and an overview of the benefits of HTTP/2.

See |http2sr|, |http2prof|, and |svchttps| in the Schema Reference for more detail on BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TENANT_1**.
- An Application named **APPLICATION_1**.
- An HTTP2_Profile named **http2profile** 
- A Client SSL profile (TLS_Server in AS3) named **webtls** that references the certificate and key later in the declaration.
- A virtual server named **service** that references the HTTP/2 profile and specifies **ingress**.


.. literalinclude:: ../../examples/declarations/example-ingress-http2-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _l4:

Configuring a FastL4 profile in a declaration
`````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for configuring the **synCookieEnable** and **synCookieAllowlist** properties is available in 3.31 or later.

This example shows how you can configure a FastL4 profile in a BIG-IP declaration.  You can use the FastL4 profile to manage Layer 4 (L4) traffic on the BIG-IP system. The FastL4 profile can increase virtual server performance and throughput for supported platforms by using the embedded Packet Velocity Acceleration (ePVA) chip to accelerate traffic.  For complete information on the FastL4 profile, see |fl4| on AskF5.

**New in BIG-IP AS3 3.31** |br|
BIG-IP AS3 3.31 introduced two additional properties for the L4 profile: **synCookieEnable** (default **true**) and **synCookieAllowlist** (default **false**). These options allow you to enable syn cookie options. See |fastl4| for descriptions of these properties.

.. IMPORTANT:: If you try to use the following example with a version prior to 3.31, it will fail.  For previous versions, remove the lines in yellow.

See |fastl4| in the Schema Reference for more detail on BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **L4_Tenant**.
- An Application named **L4_App**
- A virtual server named **service** which references the L4 profile.
- A Fast L4 Profile named **l4Profile**, which includes a number of properties, including **synCookieEnable** and **synCookieAllowlist** introduced in 3.31.


.. literalinclude:: ../../examples/declarations/example-l4-profile.json
   :language: json
   :emphasize-lines: 27, 28


:ref:`Back to top<profile-examples>`

|

.. _ntlm:

Referencing an existing NTLM profile in a declaration
`````````````````````````````````````````````````````
This example shows how you can reference an NTLM profile that exists on the BIG-IP system (including the system-supplied default NTLM profile) in declarations for HTTP and HTTPS services. The BIG-IP NTLM profile optimizes network performance when the system is processing NT LAN Manager traffic.

.. IMPORTANT:: To reference an NTLM profile, you must also include a |mp| profile (known as a OneConnect profile on the BIG-IP) for the declaration to succeed.

When both an NTLM profile and a OneConnect profile are associated with a virtual server, the BIG-IP can take advantage of server-side connection pooling for NTLM connections.  See the |ntlmdoc| for more information on NTLM and OneConnect profiles.

See |httpserv| amd |httpsserv| in the Schema Reference for more detail on BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_NTLM**.
- An Application named **NTLM_App**.
- A virtual server named **NTLMvs** which references the default NTLM profile on the BIG-IP system.
- A OneConnect (multiplex) profile named **testMux**, which required when referencing an NTLM profile.


.. literalinclude:: ../../examples/declarations/example-ntlm-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _http2egress:

Configuring an egress HTTP/2 profile in a declaration
`````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You MUST be using BIG-IP v14.1 or later to use these features.

This example shows how to configure an HTTP/2 profile that is specific to egress (server-side) traffic on an HTTPS service (see :ref:`http2` for ingress).

It also shows how you can set the **httpMrfRoutingEnabled** property on a virtual service, which enables the HTTP message routing framework (MRF) functionality, and is necessary for using HTTP/2 profiles in a full proxy configuration.

See |http2kb| for a detailed explanation of HTTP/2 profiles on the BIG-IP and an overview of the benefits of HTTP/2. See |http2doc| for more information on manually configuring HTTP/2 Full Proxy support on the BIG-IP.


See |http2sr|, |http2prof|, and |svchttps| in the Schema Reference for more detail on BIG-IP AS3 usage.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TENANT_1**.
- An Application named **APPLICATION_1**.
- An HTTP2_Profile named **http2profile**.
- A Client SSL profile (TLS_Server in AS3) named **webtls** that references the certificate and key later in the declaration.
- A virtual server named **service** that references the HTTP/2 profile and specifies **engress**, with **httpMrfRoutingEnabled** set to **true**.


.. literalinclude:: ../../examples/declarations/example-egress-http2-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _htmlprofile:

Configuring an HTML profile in a declaration
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for HTML profiles is available in BIG-IP AS3 v3.31 and later. 

This example shows how to configure an HTML profile in a BIG-IP AS3 declaration. HTML profiles allow the system to modify HTML content that passes through the system, according to your specifications. See the |htmlprof| for complete information about HTML profiles and manual configuration.

HTML profiles make use of HTML rules, such as :ref:`tag-append-html<htmlrule>` introduced in BIG-IP AS3 3.30.

See |htmlsr| in the Schema Reference for options and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_HTML_Profile**.
- An Application named **Application**.
- A virtual server named **service** that references the HTML profile defined later in the declaration.
- An HTML Profile named **htmlProfile** which sets content options and references an HTML rule.
- An HTML rule named **htmlRule** of type **tag-append-html** that specifies matching criteria.



.. literalinclude:: ../../examples/declarations/example-html-profile.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _rdstring:

Using a string for the route domain property in an 'explicit' HTTP profile
``````````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for strings in the route domain property in HTTP profiles with proxy type of 'explicit' is available in BIG-IP AS3 v3.35 and later. 

This example shows how you can now use a string for the **routeDomain** property in an HTTP profile with a proxy type of **explicit**.  Previously, only integers were allowed. 

.. IMPORTANT:: BIG-IP AS3 does NOT create route domains, and only references route domains that already exist on the BIG-IP system.

For more information on route domains, see |rddocs|.

See |hpe| in the Schema Reference for options and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **miscTenant**.
- An Application named **Application**.
- An HTTP profile named **httpProfile** with a proxyType of **explicit** and a reference to route domain **routeDomainAlpha**.
- A DNS Nameserver named **DNS_Nameserver** that references a route domain in the Common partition named **3**.

You must update the route domains in the following example to match route domains on your BIG-IP system, otherwise, the example will fail.

.. literalinclude:: ../../examples/declarations/example-route-domain-strings.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _smtps:

Using a SMTPS profile in a declaration
``````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for SMTPS profiles is available in BIG-IP AS3 v3.38 and later. 

This example shows how you can add an SMTPS profile to the TLS_Server class in a declaration using the new **smtpsStartTLS** property.  The SMTPS profile provides a way to add SSL encryption to SMTP traffic quickly and easily.

For the SMTPS profile, you must decide whether you want to **allow**, **disallow**, or **require** STARTTLS activation for SMTP traffic. The STARTTLS extension effectively upgrades a plain-text connection to an encrypted connection on the same port, instead of using a separate port for encrypted communication.

See |tlss| in the Schema Reference for options and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TLS_smtps**.
- An Application named **Application**.
- A virtual server named **smtpsVip** that references a TLS server.
- A Client SSL profile (Server TLS in AS3) named **tlsServer** with **smtpsStartTLS** set to **require**, and reference to a certificate.
- A certificate named **tlsservercert** that includes a certificate and private key.


.. literalinclude:: ../../examples/declarations/example-smtps-starttls.json
   :language: json


:ref:`Back to top<profile-examples>`

|

.. _stats:

Configuring a Statistics profile in a declaration
`````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for Statistics profiles is available in BIG-IP AS3 v3.41 and later. 

This example shows how you can configure a Statistics profile to the TLS_Server class in a declaration using the new **Statistics_Profile** class.

The Statistics profile provides user-defined statistical counters. Each profile contains 32 settings (Field1 through Field32), which define named counters. Using a Tcl-based iRule command, you can use the names to manipulate the counters while processing traffic.  For more information, see |stats1| in the BIG-IP documentation and |stats2| in the TMSH reference.

See |statsref| in the Schema Reference for options and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Statistics_Profile**.
- An Application named **Application**.
- A virtual server named **service** that references a Statistics profile and an iRule.
- A Statistics profile named **statisticsProfile** with 4 fields configured.
- A iRule named **countIrule** that triggers the Statistics profile when a specific URI is visited.


.. literalinclude:: ../../examples/declarations/example-statistics-profile.json
   :language: json


:ref:`Back to top<profile-examples>`



.. |streamprof| raw:: html

   < a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#stream-profile" target="_blank">Stream Profile</a>

.. |streamprofile| raw:: html

   <a href="https://support.f5.com/csp/article/K39394712" target="_blank">Overview of the Stream profile</a>

.. |dosdocs| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip-afm/manuals/product/dos-firewall-implementations-13-1-0.pdf" target="_blank">DoS Protection and Protocol Firewall Implementations (pdf)</a>

.. |oneconnect| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-profiles-reference-14-0-0/09.html#GUID-599CB11D-37E1-4ABC-A077-FDDB0CDA56EA" target="_blank">About OneConnect Profiles</a>

.. |avr| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_analytics/manuals/product/analytics-implementations-13-1-0.html" target="_blank">BIG-IP Analytics: Implementations</a>

.. |requestlog| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/external-monitoring-of-big-ip-systems-implementations-14-0-0/02.html" target="_blank">Request Logging documentation</a>

.. |socket| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-profiles-reference-14-1-0/02.html#GUID-2B723BC5-156C-409A-B9E1-8C64F03DBE94" target="_blank">Websocket documentation</a>

.. |ws| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#http-profile" target="_blank">HTTP Profile class</a>

.. |rewrite| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-profiles-reference-14-1-0/02.html#GUID-2796A036-1977-4659-A237-9608C41ACA00" target="_blank">Rewrite profile documentation</a>

.. |rw| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#rewrite-profile" target="_blank">Rewrite profile</a>


.. |tl| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#traffic-log-profile" target="_blank">Traffic Log profile</a>

.. |webaccel| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip-aam/manuals/product/bigip-acceleration-concepts-13-0-0/2.html" target="_blank">Web Acceleration profile</a>

.. |capture| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_analytics/manuals/product/analytics-implementations-13-1-0/6.html" target="_blank">Capture filter</a>

.. |analytics| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#analytics-profile" target="_blank">Analytics Profile class</a>

.. |httpaccel| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#http-acceleration-profile" target="_blank">HTTP Acceleration Profile class</a>

.. |securitylog| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_asm/manuals/product/asm-implementations-13-1-0/14.html" target="_blank">ASM Logging Profiles</a> section of the ASM documentation.

.. |seclog| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#security-log-profile" target="_blank">Security Log Profile class</a>

.. |starttls| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-client" target="_blank">TLS_Client</a>

.. |ldapdoc| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-system-ssl-administration-14-1-0/13.html" target="_blank">Securing LDAP Traffic</a>

.. |ftpprofile| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#ftp-profile" target="_blank">FTP_Profile</a>

.. |http2profile| raw:: html

   <a href="https://support.f5.com/csp/article/K04412053" target="_blank">Overview of HTTP/2 profile</a>

.. |http2ref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#http2-profile" target="_blank">HTTP2_Profile</a>

.. |rtspref| raw:: html

   <a href="https://www.ietf.org/rfc/rfc2326.txt" target="_blank">RFC 2326</a>

.. |rtspdoc| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-profiles-reference-14-1-0/02.html#GUID-2C8C75A0-1A12-417D-8C92-6943C345403F" target="_blank">RTSP documentation</a>

.. |rtsp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#rtsp-profile" target="_blank">RTSP_Profile</a>

.. |servtcp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-tcp" target="_blank">Service_TCP</a>

.. |tcpanalytics| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#analytics-tcp-profile" target="_blank">TCP Analytics Profile class</a>

.. |tftpdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-0-0/big-ip-cgnat-implementations-14-0-0/using-alg-profiles.html#GUID-EC2E4FDD-C0DF-4336-876B-FDADB8802133" target="_blank">Using the TFTP ALG profile to transfer files</a>

.. |pptpref| raw:: html

   <a href="https://clouddocs.f5.com/cli/tmsh-reference/latest/modules/ltm/ltm-profile-pptp.html" target="_blank">PPTP in the TMSH reference</a>

.. |pptpdoc| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-cgnat-implementations-13-1-0/6.html#GUID-2FB033A4-907A-4AC6-984B-DD90E759A470" target="_blank">PPTP in CGNAT documentation</a>

.. |servicesctp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-sctp" target="_blank">Service_SCTP</a>

.. |sctpprof| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-sctp-profile" target="_blank">Pointer_SCTP_Profile</a>

.. |sctpdocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-profiles-reference-13-0-0/5.html#GUID-E04C4324-97DB-40F0-BE78-6AD994CC0ABE" target="_blank">SCTP Profile Type</a>

.. |adaptdocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/ltm-implementations-13-0-0/10.html" target="_blank">Overview: Configuring HTTP Request Adaptation</a>

.. |adaptref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-request-adapt-profile" target="_blank">Pointer Request Adapt profile</a>

.. |servicetcp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-tcp" target="_blank">Service_TCP</a>

.. |icapdocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-local-traffic-management-profiles-reference-14-1-0/02.html#GUID-68D2C996-7D0C-402C-9C87-6F9349895FD0" target="_blank">BIG-IP documentation</a>

.. |http2kb| raw:: html

   <a href="https://support.f5.com/csp/article/K04412053" target="_blank">K04412053: Overview of the BIG-IP HTTP/2 profile</a>

.. |http2sr| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-https-profilehttp2" target="_blank">Service_HTTPS_profileHTTP2</a>

.. |svchttps| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-https" target="_blank">Service_HTTPS</a>

.. |http2prof| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#http2-profile" target="_blank">HTTP2_Profile</a>

.. |fastl4| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#l4-profile" target="_blank">L4_Profile</a>

.. |br| raw:: html

   <br />

.. |mp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#multiplex-profile" target="_blank">Multplex_Profile</a>

.. |httpserv| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-http" target="_blank">Service_HTTP</a>

.. |httpsserv| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-https" target="_blank">Service_HTTPS</a>

.. |ntlmdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bip-upd-15-1-0-u2/big-ip-local-traffic-management-profiles-reference/other-profiles.html" target="_blank">BIG-IP documentation</a>

.. |http2doc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-http2-full-proxy-configuration/http2-full-proxy-configuring.html" target="_blank">Configuring HTTP/2 Full-proxy Support on the BIG-IP System</a>

.. |htmlprof| raw:: html

   <a href="https://techdocs.f5.com/en-us/bip-upd-15-1-0-u2/big-ip-local-traffic-management-profiles-reference/content-profiles.html" target="_blank">BIG-IP documentation</a>

.. |htmlsr| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#html-profile" target="_blank">HTML_Profile</a>

.. |fl4| raw:: html

   <a href="https://support.f5.com/csp/article/K09948701" target="_blank">Overview of the FastL4 profile</a>

.. |rddocs| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-1-0/big-ip-tmos-routing-administration-14-1-0/route-domains.html#GUID-D0FFED52-8DCA-423B-B4FF-8E51E40025BF" target="_blank">Route Domains in the BIG-IP documentation</a>

.. |tlss| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-server" target="_blank">TLS_Server</a>

.. |hpe| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#http-profile-explicit" target="_blank">HTTP_Profile_Explicit</a>

.. |serviceudp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-udp" target="_blank">Service_UDP</a>

.. |statsref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#statistics-profile" target="_blank">Statistics_Profile</a>

.. |stats1| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-local-traffic-management-profiles-reference/other-profiles.html#GUID-AF7248FE-5E11-4A52-B959-612327AB69A2" target="_blank">Statistics profile</a>

.. |stats2| raw:: html

   <a href="https://clouddocs.f5.com/cli/tmsh-reference/v15/modules/ltm/ltm_profile_statistics.html" target="_blank">ltm profile statistics</a>

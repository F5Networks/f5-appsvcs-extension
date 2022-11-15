.. _hm-examples:

Health Monitors
---------------
This section contains different types of health monitors you can use in your declarations. Some include multiple monitors, so you can include the monitor(s) that best suit your needs.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

.. _ldapex:


Using an LDAP monitor in a declaration
``````````````````````````````````````
This example shows how you use an LDAP monitor in a declaration. This example shows 4 different LDAP monitors that you can use in your declarations.  See the :ref:`Schema Reference<schema-reference>` for usage options and additional features.

- Partition (tenant) named **Sample_monitor_01**.
- A pool named **monitorLDAP_pool** with one member.
- Four LDAP monitors, named **monitorLDAPdefault**, **monitorLDAPsimple**, **monitorLDAPnonDefault1**, and **monitorLDAPnonDefault2**.


.. literalinclude:: ../../examples/declarations/example-ldap-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _dnsmonex:


Using a DNS monitor in a declaration
````````````````````````````````````
This example shows how you use a DNS monitor in a declaration. This example shows two monitors, a simple DNS monitor and a DNS monitor with all available properties that you can use in your declarations.  See the :ref:`Schema Reference<schema-reference>` for usage options and information.

- Partition (tenant) named **Sample_monitor_02**.
- A pool named **monitorDNS_pool** with one member.
- Two monitors attached to the pool: **monitorDNS_simple** and **monitorDNS_AllProperties**.


.. literalinclude:: ../../examples/declarations/example-dns-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _exmon:


Using an external monitor in a declaration
``````````````````````````````````````````
This example shows how you can create an external monitor in a declaration.  An external monitor allows you to use a custom script for monitoring.  In this example, we reference a script located in an external location.  You could also reference a script file already present on the BIG-IP.

**NEW in BIG-IP AS3 3.24** |br|
BIG-IP AS3 3.24 adds the ability to specify environment variables for external monitors using the new **environmentVariables** property. This allows you to define command line parameters required by the external program you reference. |br|
See |extmon| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_monitor_03**.
- A pool named **externalMonitorPool**.
- An external monitor named **mNewExternalMonitorFile**, that uses a script hosted in an external location.

.. WARNING:: The following declaration has been updated to include the **environmentVariables** property introduced in BIG-IP AS3 3.24. If you attempt to use this declaration on a prior version, it will fail unless you remove the environmentVariables property.

.. literalinclude:: ../../examples/declarations/example-external-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _radmon:


Using a RADIUS monitor in a declaration
```````````````````````````````````````
This example shows how you use a RADIUS monitor in a declaration. This example shows 3 different RADIUS monitors that you can use in your declarations.  See |ftpmon| in the Schema Reference for usage options and additional features.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_monitor_04**. 
- A pool named **monitorRADIUS_pool** with one member.
- Three example RADIUS monitors, named **monitorRADIUSdefault**, **monitorRADIUS_nondefault1**, **monitorRADIUS_nondefault2**.

.. literalinclude:: ../../examples/declarations/example-radius-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|


.. _ftpmon:


Using an FTP monitor in a declaration
`````````````````````````````````````
This example shows how you use an FTP monitor in a declaration. This declaration only includes the monitor, and no pool or virtual service, but simply shows how to create an FTP monitor with AS3.  See the :ref:`Schema Reference<schema-reference>` for usage options and additional features.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_FTPMonitor**. 
- An FTP monitor named **sampleFTPmonitor**.

.. literalinclude:: ../../examples/declarations/example-ftp-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _sslmon:


Using certificates in an HTTPS monitor
``````````````````````````````````````
This example shows how you can create an HTTPS monitor that uses a certificate and key. This declaration only includes the monitor and certificates, and no pool or virtual service, but simply shows how to create an HTTPS monitor that uses a certificate with AS3.  See the :ref:`Schema Reference<schema-reference>` for usage options and additional features.

.. IMPORTANT:: The way you compose the declaration depends on whether you are using BIG-IP/TMOS version 13.1 or later (uses the **clientTLS** property), or a version prior to 13.1 (uses the **clientCertificate** property).  Use the appropriate example.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_HTTPSMonitor**. 
- An HTTPS monitor named **sampleHTTPSmonitor**.

**For versions 13.1 and later**

Note in this example, you are also creating a TLS_Client profile (ServerSSL profile in the BIG-IP UI) for the certificate, which is attached to the monitor.

.. literalinclude:: ../../examples/declarations/example-https-monitor.json
   :language: json

|

**For versions prior to 13.1**

In this example, you specify the certificate and key you want to use in the monitor.

.. literalinclude:: ../../examples/declarations/example-https-monitor2.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _mysqlmon:


Creating a mySQL monitor in a declaration
`````````````````````````````````````````
This example shows how you can create a mySQL monitor in a declaration. The mySQL monitor verifies MySQL-based services. For more information, see the |mysqlref|.  You can also refer to this |mysqldc| about monitoring open-source databases with BIG-IP.

See |mysqlsr| and |mysqlpsr| for BIG-IP AS3 options and usage information.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **mySQLTenant**.
- A virtual server named **service** that references the pool.
- A pool named **monitorMySQL_pool** that references the **monitorMySQL_AllProperties** monitor.
- Two monitors, the **monitorMySQL_AllProperties** monitor which contains all available mySQL monitor properties, and a simple monitor (**monitorMySQL_Simple**) that is created by the declaration but not used by the pool.


.. literalinclude:: ../../examples/declarations/example-mysql-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _http2mon:


Creating an HTTP/2 monitor in a declaration
```````````````````````````````````````````
This example shows how you can create an HTTP/2 monitor in a declaration using the new monitor type **http2** and BIG-IP 15.1 or later. This monitor allows you to monitor the health of the HTTP/2 service of your server pools.

See |http2kb| on AskF5 for more information about HTTP/2 monitors.

See |http2mon| for BIG-IP AS3 options and usage information.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_HTTP2Monitor**.
- Application named **Application**.
- An HTTP/2 monitor named **sampleHTTP2monitor** with a number of properties and a reference to a certificate.


.. literalinclude:: ../../examples/declarations/example-http2-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _postgremon:


Creating a PostgreSQL monitor in a declaration
``````````````````````````````````````````````
This example shows how you can create a PostgreSQL monitor in a declaration using the new monitor type **postgresql**. This allows you to monitor the health of your PostgreSQL (Postgres) database servers.

See |postgresqldoc| on AskF5 for more information on PostgreSQL monitors.

See |postgremon| for BIG-IP AS3 options and usage information.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **PostgreSQLTenant**.
- Application named **Application**.
- A virtual server named **service** that references the pool.
- A pool named **monitorPostgreSQL_pool** with two members and a reference to the PostgreSQL monitor.
- A PostgreSQL monitor named **monitorPostgreSQL** with a number of properties and a reference to a certificate.


.. literalinclude:: ../../examples/declarations/example-postgresql-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _exgslbmon:


Using an external GSLB monitor in a declaration
```````````````````````````````````````````````
This example shows how you can create a GLSB external monitor in a declaration.  An external monitor allows you to use a custom script for monitoring.  

In this example, we show two GSLB external monitors, the first references a file that already exists on the BIG-IP as a TMSH **sys file external-monitor** object, and the second which references a script located in an external location.  

See |glsbextmon| in the Schema Reference for BIG-IP AS3 usage. You can also see |gslbextdoc| in the BIG-IP documentation.

The example declaration only contains the GSLB monitors, which can be used as a part of a larger declaration.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_External_GSLB_Monitor**.
- A GSLB external monitor named **pathname_example** which references an existing file on the BIG-IP and uses **environmentVariables** that contains credentials required by the **arg_example** file.
- A second GSLB external monitor named **script_example** which references an external script via URL.

.. literalinclude:: ../../examples/declarations/example-external-gslb-monitor.json
   :language: json

|

.. _tcpudp:


Creating TCP and UDP monitors in a declaration
``````````````````````````````````````````````
This example shows how you can create TCP and UDP health monitors in a declaration. 

In this declaration, we do not use Send or Receive strings in the monitors.  In BIG-IP AS3 version 3.29 and earlier, Send and Receive strings were required.

See |tcpmon| and |udpmon| for BIG-IP AS3 options and usage information.

This declaration creates the following objects on the BIG-IP (this declaration will fail on AS3 versions 3.29 and earlier):

- Partition (tenant) named **TCPTest**.
- Application named **TCP_Monitor_Test**.
- A virtual server named **service** that references the pool.
- A pool named **TCP_Pool** that references TCP and UDP monitors.
- A TCP monitor named **TCP_Monitor**.
- A UDP monitor named **UDP_Monitor**.

.. literalinclude:: ../../examples/declarations/example-tcp-udp-monitors.json
   :language: json


:ref:`Back to top<hm-examples>`

|

.. _inbandmon:


Creating an inband monitor in a declaration
```````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for inband monitors is available in BIG-IP AS3 v3.40 and later.

This example shows how you can create an inband health monitor in a declaration. An inband monitor checks the health of a pool member based on a specified number of connection attempts or data request attempts that occur within a specified time period. If, after the specified number of attempts within the defined interval, the system cannot connect to the server or receive a response, or if the system receives a bad response, the system marks the pool member as down.

See |inband| for BIG-IP AS3 options and usage information.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Inband_Monitor_Example**.
- Application named **Test_Monitor_Inband**.
- An inband monitor named **monitorInband_AllProperties**, which configures all available properties for the monitor.
- A pool named **monitorInband_pool** that references the inband monitor.


.. literalinclude:: ../../examples/declarations/example-inband-monitor.json
   :language: json


:ref:`Back to top<hm-examples>`

|



.. |ftpmon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-ftp" target="_blank">Monitor_FTP</a>

.. |br| raw:: html

   <br />

.. |mysqlref| raw:: html

   <a href="https://clouddocs.f5.com/cli/tmsh-reference/v14/modules/ltm/ltm_monitor_mysql.html" target="_blank">mySQL monitor reference</a>

.. |mysqldc| raw:: html

   <a href="https://devcentral.f5.com/s/articles/monitoring-open-source-databases-with-big-ip" target="_blank">older article on DevCentral</a>

.. |mysqlsr| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-mysql" target="_blank">Monitor_MySQL</a>

.. |inband| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-inband" target="_blank">Monitor_Inband</a>


.. |mysqlpsr| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-mysql-passphrase" target="_blank">Monitor_MySQL_Passphrase</a>

.. |extmon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-external" target="_blank">Monitor_External</a>

.. |http2mon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-http2" target="_blank">Monitor_HTTP2</a>

.. |http2kb| raw:: html

   <a href="https://support.f5.com/csp/article/K29224049" target="_blank">Overview of the BIG-IP HTTP/2 monitor</a>

.. |postgresqldoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-16-0-0/big-ip-local-traffic-manager-monitors-reference/monitors-settings-reference.html#GUID-66CF3FF5-2243-44D7-ACE4-469F6EB850A8" target="_blank">PostgreSQL monitor</a>

.. |postgremon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-postgresql" target="_blank">Monitor_PostgreSQL</a>

.. |gslbextdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-dns-monitors-reference/monitors-settings-reference.html#GUID-97A75674-658E-402D-BD54-50CFD83BF0F0" target="_blank">External monitor settings</a>


.. |glsbextmon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#gslb-monitor-external" target="_blank">GSLB_Monitor_External</a>

.. |tcpmon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-tcp" target="_blank">Monitor_TCP</a>

.. |udpmon| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#monitor-udp" target="_blank">Monitor_UDP</a>


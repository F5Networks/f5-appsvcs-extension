.. _dos-examples:

Denial of Service
-----------------
This section contains declarations that use a Denial of Service (DoS) profile in order to thwart denial of service attacks.

.. NOTE:: In BIG-IP AS3 3.29 (and BIG-IP 14.1 and later), if you submit a declaration that uses a pointer to a DoS profile, but does not include a pointer to a Bot Defense profile, BIG-IP AS3 creates a Bot Defense profile for you.  The auto-generated Bot Defense profile uses the relevant properties from the DoS profile from the declaration. The new BOT Defense profile is named **f5_appsvcs_<DoS profile name>_botDefense**.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.


.. _dosexample:


Using a DoS profile in a declaration
````````````````````````````````````
This example shows how you can use a Denial of Service (DoS) profile in a declaration.  The DoS profile can provide specific attack prevention at a very granular level.  In the following example, we include nearly all of the available features in the DoS profile, with the exception of Mobile Defense, which we show in example 10.
For detailed information on DoS profiles and the features in this declaration, see |dossign| and |dosdocs|.

Also see |dosprof| in the Schema Reference for usage options for using these features in your BIG-IP AS3 declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_dos_01**.
- A DoS profile with denylisted and allowlisted geolocations and address lists, URL protection, bot defense, rate-based protection and more. See the documentation and schema reference for details.


.. literalinclude:: ../../examples/declarations/example-dos-profile.json
   :language: json


:ref:`Back to top<dos-examples>`

|

.. _dosmobile:


Using a DoS profile for Mobile Defense
``````````````````````````````````````
This example shows how you can use a Denial of Service (DoS) profile in a declaration specific to mobile protection.  See |dosprof| in the Schema Reference for usage options for using these features in your BIG-IP AS3 declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_dos_02**.
- A DoS profile with mobile defense enabled.


.. literalinclude:: ../../examples/declarations/example-dos-profile-for-mobile-defense.json
   :language: json


:ref:`Back to top<dos-examples>`

|

.. _dossignature:


Using Accelerated Signatures and TLS Signatures in a DoS profile
````````````````````````````````````````````````````````````````
This example shows how you can use Accelerated Signatures (enables signature detection before the connection establishment) and TLS Signatures (Enables TLS signature detection before the connection establishment) a Denial of Service (DoS) profile in a declaration.  See |dossign| in the AFM documentation for more information on the DoS profile, and |dosbad| in the Schema Reference for AS3 usage options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **DOS_Profile_signatures**.
- A DoS profile with Accelerated Signatures and TLS Signatures enabled.


.. literalinclude:: ../../examples/declarations/example-dos-profile-signatures.json
   :language: json


:ref:`Back to top<dos-examples>`

|

.. _dosvector:


Using Network Vectors in a DoS Profile
``````````````````````````````````````
This example shows how you can use Network Vectors in a DoS profile. The following declarations includes two options introduced in BIG-IP AS3 3.16.0: **ip-low-ttl** and **non-tcp-connection**; you must be using 3.16.0 or later to use these options (see BIG-IP TMOS version requirements in the Version Notice box).

See |netvec| in the Schema Reference for BIG-IP AS3 usage options, and |dossign| in the AFM documentation for more information on the DoS profile.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_DOS_NetVector**.
- A DoS profile named **DOS_NetVector** with a list of Network Vectors, including ip-low-ttl and non-tcp-connection.


.. literalinclude:: ../../examples/declarations/example-dos-profile-network-vectors.json
   :language: json


:ref:`Back to top<dos-examples>`

|

.. _dnsvector:


Using DNS Vectors in a DoS Profile
``````````````````````````````````
This example shows how you can use DNS Vectors in a DoS profile. The following declarations includes two options introduced in BIG-IP AS3 3.16.0: **nxdomain** and **qdcount**; you must be using 3.16.0 or later to use these options.

See |dnsvec| in the Schema Reference for BIG-IP AS3 usage options, and |dossign| in the AFM documentation for more information on the DoS profile.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_DOS_DnsVector**.
- A DoS profile named **DOS_DnsVector** with a list of DNS Vectors, including nxdomain and qdcount.


.. literalinclude:: ../../examples/declarations/example-dos-profile-dns-vectors.json
   :language: json


:ref:`Back to top<dos-examples>`

|

.. _botdef:


Referencing a Bot Defense profile
`````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing Bot Defense profiles is available in TMOS versions 14.1 and later.

This example shows how you can reference an existing Bot Defense profile in a BIG-IP AS3 declaration in BIG-IP 14.1 and later. Previously this functionality was a part of the DoS profile, but was separated out in BIG-IP 14.1.

.. NOTE:: In BIG-IP AS3 3.29 (and BIG-IP 14.1 and later), if you submit a declaration that uses a pointer to a DoS profile, but does not include a pointer to a Bot Defense profile, BIG-IP AS3 creates a Bot Defense profile for you.  The auto-generated Bot Defense profile uses the relevant properties from the DoS profile from the declaration. The new BOT Defense profile is named **f5_appsvcs_<DoS profile name>_botDefense**.

For more information on Bot Defense profiles, see |botdoc| in the ASM Implementations Guide.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_Bot_Def**.
- A virtual service named **test.botDef** the references an existing Bot Defense profile on the BIG-IP.


.. literalinclude:: ../../examples/declarations/example-bot-defense-profile.json
   :language: json


:ref:`Back to top<dos-examples>`


.. |dosdocs| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip-afm/manuals/product/dos-firewall-implementations-13-1-0.pdf" target="_blank">DoS Protection and Protocol Firewall Implementations (pdf)</a>

.. |dossign| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip-afm/manuals/product/big-ip-system-dos-protection-and-protocol-firewall-implementations-14-1-0/02.html" target="_blank">Detecting and Preventing System DoS and DDoS Attacks</a>

.. |dosbad| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dos-profile-application-stress-based-detection-bad-actor" target="_blank">DOS_Profile_Application_Stress_Based_Detection_Bad_Actor</a>

.. |netvec| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dos-network-vector" target="_blank">DOS_Network_Vector</a>


.. |dosprof| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dos-profile" target="_blank">DOS_Profile</a>

.. |dnsvec| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dos-dns-vector" target="_blank">DOS_DNS_Vector</a>

.. |botdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-1-0/big-ip-asm-implementations-14-1-0/configuring-bot-defense.html" target="_blank">Configuring Bot Defense</a>

.. |br| raw:: html

   <br />



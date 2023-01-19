.. _net-sec-examples:


Network Security 
----------------
This section contains declarations that use F5's network security and firewall features.

Use the index on the right to locate specific examples.

.. NOTE:: As of BIG-IP AS3 3.10.0, if the Firewall_Address_List contains zero addresses, a dummy IPv6 address of ::1:5ee:bad:c0de is added in order to maintain a valid Firewall_Address_List. If an address is added to the list, the dummy address is removed.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

.. _firewallex:


Using Firewall Rules, Policies, and logging
```````````````````````````````````````````
This example shows how you can use the BIG-IP Advanced Firewall Manager (AFM) module in a declaration.  |afm| defends against threats to network layers 3-4, stopping them before they reach your data center.

.. IMPORTANT:: To use these features, you must have BIG-IP AFM licensed and provisioned on your BIG-IP system.

In this example, we create firewall rules which are used in our firewall policy.  We also create a security logging profile to define the events we want to log.

The AFM features we use in this declaration are well-documented in the |afmdocs| and |loggingdocs|.  See these manuals for more information on these features.  Also see the :ref:`Schema Reference<schema-reference>` for usage options for your BIG-IP AS3 declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_net_sec_01**.
- A virtual server named **service**.
- A pool named **ex_pool** monitored by the default *gateway_icmp* health monitor.
- A firewall rule list named **fwRuleList**, which references lists of allowed ports (**fwAllowedPortList**) and addresses (**fwAllowedAddressList**).
- A firewall policy named **fwPolicy** which references the firewall rule lists.
- A log publisher (**fwLogPublisher**), high speed logging destination (**fwLowDestinationHsl**) and pool (**hs_pool**), and syslog destination (**fwLogDestinationSyslog**).

.. literalinclude:: ../../examples/declarations/example-using-firewall-rules-policies-logging.json
   :language: json

:ref:`Back to top<net-sec-examples>`

|

.. _cgnatex:

Using Firewall (Carrier Grade) NAT features in a declaration
````````````````````````````````````````````````````````````
This example shows how you can use some Carrier Grade NAT (CGNAT) features (NAT Policy, NAT Source Translation, Firewall lists) in a BIG-IP AS3 declaration.  For more information on CGNAT, see |cgnat|.  Also see the :ref:`Schema Reference<schema-reference>` for usage options for using these features in your BIG-IP AS3 declarations.

**New in BIG-IP AS3 3.20** |br|
In BIG-IP AS3 3.20 and later, you have the ability to add addresses to exclude for NAT source translation.  This allows you to specify a set of addresses excluded from the translation IP addresses available in the pool. The example below has been updated with the new lines highlighted in yellow.  |br| **Important**: Because of this addition, the example declaration will fail in versions prior to 3.20. |br| For more information on usage, see |natexclude| in the schema reference.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_net_sec_02**.
- A Fast L4 virtual server named **service**.
- A NAT Policy (the ability to reference a security logging profile from a NAT rule was added in BIG-IP AS3 3.15, see |natrule| in the Schema Reference).
- A NAT Source Address Translation object (with excludeAddress added in BIG-IP AS3 3.20).
- Port and destination address lists (Firewall Address lists).


.. literalinclude:: ../../examples/declarations/example-using-firewall-nat-features.json
   :emphasize-lines: 88-93, 119-124
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _sshproxyex:


Securing SSH traffic with the SSH Proxy
```````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You **must** have the Advanced Firewall Manager (AFM) module licensed and provisioned on your BIG-IP to use these features.

This example shows how you can use the Advanced Firewall Manager (AFM) SSH Proxy profile in a BIG-IP AS3 declaration.  The SSH Proxy lets network administrators centrally manage the different uses of SSH, determining who can do what on which servers. Additionally, as the feature is a full proxy, terminating both the client and server sides of the connection, it is possible to inspect traffic before passing it on. This prevents attackers from hiding their activities while still providing legitimate users with secure communications. For more information on the SSH Proxy, see |ssh| in the AFM documentation, and |sshproxy| in the Schema Reference for all BIG-IP AS3 usage options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **SSH_Proxy_Profile**.
- An SSH Proxy profile named **sshProxyExample** with actions, rules, and authentication information.


.. literalinclude:: ../../examples/declarations/example-ssh-proxy.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _fwrule:


Using reject and accept-decisively actions and VLAN source in a firewall rule
`````````````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You **must** have the Advanced Firewall Manager (AFM) module licensed and provisioned on your BIG-IP to use these features.

This example shows how you can use the **reject** and **accept-decisively** actions in a Firewall Rule. See the |firewalldocs| for detailed information on these actions.

- *reject*  
   With this action, packets that match the rule are rejected. Using **reject** is a more graceful way to deny packets as it sends a destination unreachable message to the source system.

- *accept-decisively*
   With this action, packets that match the rule are accepted decisively and traverse the system as if the firewall is not present. Packets are not processed by rules in any further context after the accept decisively action applies. See the AFM documentation for detailed information.


**New in BIG-IP AS3 3.15.0** |br|
Starting with BIG-IP AS3 3.15.0, you can use BIG-IP VLANs as sources for firewall Rules.  See the highlighted lines in the following declaration.  See |fwrulesrc| in the schema reference for usage.


See |firewallrule| in the Schema Reference for all BIG-IP AS3 usage options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_Firewall_Rule_List**.
- A Firewall Rule list named **exampleFWRuleList** with two rules, one with an action of **reject** and one of **accept-decisively**.
- The second firewall rule has been updated to use the **external** VLAN on the BIG-IP as the source.


.. literalinclude:: ../../examples/declarations/example-firewall-rule.json
   :language: json
   :emphasize-lines: 27-33


:ref:`Back to top<net-sec-examples>`

|

.. _pipprof:


Creating Protocol Inspection profiles
`````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You **must** have AFM licensed and provisioned AND an Intrusion Prevention System (IPS) subscription add-on license on your BIG-IP to use these features.

This example shows how you can create BIG-IP AFM Protocol Inspection profiles in a BIG-IP AS3 declaration.  A protocol inspection profile collects rules for protocol inspection using pre-installed signatures defined by the Snort project, or custom signatures defined using the Snort syntax.

For detailed information, see |pipdoc|, as well as |pipkb| on AskF5. For BIG-IP AS3 usage options, see |pipref| in the Schema Reference.

BIG-IP AS3 3.20 added the **value** property for Protocol Inspection compliance checks.  If a check accepts enumerable values, the values should be delimited by spaces.  The following example has been updated to show the **value** property.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_PIP**.
- A UDP virtual service named **service** which references the Protocol Inspection profile.
- A Protocol Inspection profile named **DNSInspectionProfile** which is specific to DNS in this example.

  - Example was updated in BIG-IP AS3 3.20 to include the **value** property in the compliance check.  If you are using a BIG-IP AS3 version prior to 3.20, this declaration will fail.



.. literalinclude:: ../../examples/declarations/example-protocol-inspection-profile.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _bandwidth:


Setting Maximum Bandwidth on a virtual with AFM
```````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You **must** have the Advanced Firewall Manager (AFM) module licensed and provisioned.

This example shows how you can set the maximum bandwidth on a virtual server when you are using |afm|. This allows you to set the maximum bandwidth allowed through the virtual service, in Mbps. For more information, see the BIG-IP documentation.

For BIG-IP AS3 usage options, see |maxb| or another Service object in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AFM_Tenant**.
- A virtual server named **AFMvip** with maximum bandwidth set to 10Mbps.


.. literalinclude:: ../../examples/declarations/example-maximumBandwidth.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _timeoutpolicy:

Creating an Idle Timeout policy in a declaration
````````````````````````````````````````````````
This example shows how you can create Idle Timeout policy in a BIG-IP AS3 declaration. The Idle Timeout policy (which is attached to the virtual service as part of a Service policy) allows you to associate timeouts with specific protocols and ports. You can also reference an existing policy on the BIG-IP using the **bigip** pointer.

See |idletimeout| in the schema reference for BIG-IP AS3 usage.  For more information, see |servicepolicy| in the BIG-IP documentation.

.. NOTE:: BIG-IP AS3 does not support the Port Misuse policy in a Service Policy at this time.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **timeoutTenant**.
- A virtual server named **timeoutGeneric** that references the idle timeout policy.
- A Service policy object (which BIG-IP AS3 creates automatically to hold the timeout policy; it is not part of the declaration) that contains the Idle Timeout policy named **my_idle_timeout_policy** that contains a number of rules.


.. literalinclude:: ../../examples/declarations/example-service-policy.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _pilog:


Adding logging for protocol inspection events
`````````````````````````````````````````````
This example shows how you can configure logging for protocol inspection events in a declaration. Logging is performed using a Log Publisher called from a Security Log profile. For detailed information on logging security events, see |seclog|.

For BIG-IP AS3 usage, see |logpub| and |seclogprof| in the Schema Reference.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Security_Log_Protocol_Inspection**.
- A Security Log Profile named **secLogProtocolInspection** calls the log publisher.
- A Log Publisher named **logPub** references a destination on the BIG-IP.


.. literalinclude:: ../../examples/declarations/example-security-log-profile-protocol-inspection.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _piport:


Adding ports to a protocol inspection profile
`````````````````````````````````````````````
This example shows how you can configure the **ports** property (introduced in BIG-IP AS3 3.23) in a protocol inspection profile. In prior versions of AS3, the ports property was not available.

For BIG-IP AS3 usage, see |ports| and |pipref| in the Schema Reference.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_PIP**.
- A virtual server named **service** that references the protocol inspection profile.
- A protocol inspection profile, which includes the **ports** property.


.. literalinclude:: ../../examples/declarations/example-protocol-inspection-profile-ports.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _slbotdef:


Configuring a Security Logging Profile with Bot defense
```````````````````````````````````````````````````````
This example shows how you can use *bot defense* options in a Security Logging profile in BIG-IP 14.1 and later. This example does not create the bot defense configuration, but configures logging for it. Logging is performed using a Log Publisher, which is called from the Security Log profile as shown in the example. 

For more information on F5 bot defense, which can prevent layer 7 DoS attacks, web scraping, and brute force attacks from starting, see the |botdefmanual| chapter of the ASM Implementations guide.

We strongly recommend you visit |slpbd| in the Schema Reference for specific information on the bot defense properties, including **minimum BIG-IP versions for some properties**. Also see |seclogprof| in the Schema Reference.

For detailed information on logging security events, see |seclog|. See |botdefk| for information on manual configuration.


This declaration creates the following objects on the BIG-IP (note the example does not create a virtual service):

- A partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_Application**
- A Security Log Profile named **exampleBotDefense** which includes bot defense.
- Bot defense which includes a log publisher and a number of bot defense properties.


.. literalinclude:: ../../examples/declarations/example-security-log-profile-bot-defense.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _ipintell:


Referencing an IP Intelligence policy in a declaration
``````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for referencing IP Intelligence policies is available in BIG-IP AS3 3.35.0 and later.  |br| You must have an IP Intelligence license to use this feature.

This example shows how you can reference existing IP Intelligence policies in a BIG-IP AS3 declaration. IP Intelligence policies validate traffic against an IP intelligence database, allowing you to perform a number of actions based on the policy.  For detailed information on IP Intelligence policies and how to create them, see |ipinteldocs| in the BIG-IP AFM documentation.

This declaration does not create an IP Intelligence policy, it allows you to reference an existing policy in a declaration.

This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **tenant**.
- An Application named **application**
- A virtual server named **service** that references an existing IP Intelligence policy on the BIG-IP


.. literalinclude:: ../../examples/declarations/example-ip-intelligence-policy-ref.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _netaddrlist:


Using a network address list in a declaration
`````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for the net_address_list class is available in BIG-IP AS3 3.37.0 and later.  |br| You must be using BIG-IP (TMOS) version 14.0 or later.

This example shows how you can use an address list in a declaration when using BIG-IP v14.0 or later.  When you use the |nal| class, you can specify IP addresses or address ranges, and/or use a pointer (or BIG-IP pathname) to a list of address lists.  

This provides a way to specify IP addresses for a DoS profile (for example) without having to use a |fal| which requires that you have BIG-IP AFM licensed and provisioned. 

.. IMPORTANT:: Network address lists and firewall address lists are duplicates of each other (TMOS creates or updates both when either is updated or created). Network address lists are only available in BIG-IP 14.0+, and firewall address lists are only available when AFM is provisioned (or has been provisioned before). However, |fal| has additional properties that |nal| does not. 


This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **TEST_DOS_Profile**
- An Application named **Application**
- A DoS Profile named **exampleDosProfile** with a pointer to an allow list
- An Network Address list named **netAddressList** with both an IP address, and a pointer to the next Address list
- Another Network address list named **otherNetAddressList** with one IP address.


.. literalinclude:: ../../examples/declarations/example-net-address-list.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|

.. _alglog:


Creating an ALG log profile in a declaration
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for ALG logging profiles is available in BIG-IP AS3 3.43.  |br| You must have the CGNAT module licensed and provisioned.

This example shows how you can create an ALG (Application Layer Gateway) logging profile in an AS3 declaration in version 3.43 and later.  

An ALG log profile allows fine grain control of the logging for ALG events.  When attached to a supported ALG profile (NAT, FTP, RTSP, SIP, and PPTP), you can control the events, to log as well as optional elements in the log entry. For more information on ALG profiles, see |algp| in the BIG-IP documentation.

For AS3 options and usage, see |alg|.

.. NOTE:: The following example only creates the ALG logging profile, you need to configure additional objects to be able to use this profile.

This declaration creates only the following objects on the BIG-IP:

- A partition (tenant) named **Tenant**
- An Application named **Application**
- An ALG log profile named **myProfile** with a number of properties.


.. literalinclude:: ../../examples/declarations/example-alg-log-profile.json
   :language: json


:ref:`Back to top<net-sec-examples>`

|


.. |br| raw:: html

   <br />

.. |algp| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-0-0/big-ip-cgnat-implementations/using-alg-profiles.html" target="_blank">Using ALG profiles</a>

.. |alg| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#alg-log-profile" target="_blank">ALG_Log_Profile</a>


.. |pipkb| raw:: html

   <a href="https://support.f5.com/csp/article/K44080215" target="_blank">Configuring protocol inspection profiles</a>

.. |pipdoc| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-0-0/big-ip-network-firewall-policies-and-implementations/afm-protocol-security/about-protocol-anomaly-inspection.html" target="_blank">AFM documentation</a>

.. |loggingdocs| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-external-monitoring-implementations-13-1-0.html" target="_blank">Logging documentation</a>

.. |afmdocs| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip-afm/manuals/product/network-firewall-policies-implementations-13-1-0.html" target="_blank">AFM documentation</a>

.. |afm| raw:: html

   <a href="https://f5.com/products/big-ip/advanced-firewall-manager-afm" target="_blank">BIG-IP AFM</a>

.. |cgnat| raw:: html

   <a href="https://www.f5.com/products/big-ip-services/carrier-grade-nat" target="_blank">Carrier Grade Nat on f5.com</a>

.. |ssh| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip-afm/manuals/product/big-ip-network-firewall-policies-and-implementations-14-1-0/15.html" target="_blank">SSH Proxy</a>

.. |sshproxy| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#ssh-proxy-profile" target="_blank">SSH_Proxy_Profile</a>

.. |firewallrule| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#firewall-rule" target="_blank">Firewall_Rule</a>
   
.. |firewalldocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip-afm/manuals/product/big-ip-network-firewall-policies-and-implementations-14-1-0/05.html#GUID-3E2AE647-8569-4D1E-A692-DB8C79370C93" target="_blank">BIG-IP AFM: Network Firewall Policies and Implementations</a>

.. |natrule| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#nat-rule" target="_blank">NAT_Rule</a>
  
.. |fwrulesrc| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#firewall-rule-source" target="_blank">Firewall_Rule_Source</a>

.. |pipref| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#protocol-inspection-profile" target="_blank">Protocol_Inspection_Profile</a>

.. |maxb| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-generic" target="_blank">Service_Generic</a>

.. |servicepolicy| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip-afm/manuals/product/network-firewall-policies-implementations-13-1-0/15.html" target="_blank">Service Policies</a>

.. |idletimeout| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#idle-timeout-policy" target="_blank">Idle_Timeout_Policy</a>

.. |seclog| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip-afm/manuals/product/big-ip-system-dos-protection-and-protocol-firewall-implementations-14-0-0/15.html" target="_blank">BIG-IP documentation</a>

.. |logpub| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#log-publisher" target="_blank">Log_Publisher</a>

.. |seclogprof| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#security-log-profile" target="_blank">Security_Log_Profile</a>

.. |natexclude| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.htmel#nat-source-translation" target="_blank">NAT_Source_Translation</a>

.. |ports| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.htmel#protocol-inspection-profile-services" target="_blank">Protocol_Inspection_Profile_Services</a>

.. |slpbd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.htmel#security-log-profile-bot-defense" target="_blank">Security_Log_Profile_Bot_Defense</a>

.. |botdefk| raw:: html

   <a href="https://support.f5.com/csp/article/K11412315" target="_blank">K11412315: Configuring Bot Defense logging</a>

.. |botdefmanual| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-0-0/big-ip-asm-implementations/configuring-bot-defense.html" target="_blank">Configuring Bot Defense</a>

.. |DOrd| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-declarative-onboarding/latest/composing-a-declaration.html#route-domain-class" target="_blank">Declarative Onboarding</a>

.. |rddocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-1-0/09.html" target="_blank">route domain documentation</a>

.. |pm| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pool-member" target="_blank">Pool_Member</a>

.. |ipinteldocs| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-network-firewall-policies-and-implementations/configuring-ip-address-intelligence-in-the-network-firewall.html" target="_blank">IP Intelligence chapter</a>

.. |botdefense| raw:: html

   <a href="https://www.f5.com/cloud/products/bot-defense" target="_blank">F5 Distributed Cloud Bot Defense</a>

.. |nal| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.htmel#net-address-list" target="_blank">Net_Address_List</a>

.. |fal| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.htmel#firewall-address-list" target="_blank">Firewall_Address_List</a>

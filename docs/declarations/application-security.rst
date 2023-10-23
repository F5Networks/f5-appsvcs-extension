.. _app-sec-examples:


Application Security
--------------------
This section contains declarations that aim to secure your deployment.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.

**New in BIG-IP AS3 3.34** |br|
BIG-IP AS3 3.34 added support for the **proxy-request** event on the following Endpoint Policy items.

- |tclpa|
- |droppa|
- |httpuricondition|



Virtual service referencing an existing security policy
```````````````````````````````````````````````````````
This example creates an HTTP service, and attaches an existing Web Application
Firewall (WAF) security policy created with the BIG-IP Application Security
Manager (ASM) module.  See the |asm| for information on configuring security policies.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_app_sec_01**.
- A virtual server named **service**.
- A pool named **Pool1** monitored by the default *http* health monitor.
- An LTM policy named **_WAF__HTTP_Service** which references the existing ASM policy named **test-policy**.

.. literalinclude:: ../../examples/declarations/example-referencing-security-policy.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|

.. _asmex:


Virtual service referencing an external security policy
```````````````````````````````````````````````````````
This example creates an HTTP service, and attaches a Web Application Firewall
(WAF) security policy hosted in an external location.  See the |asm|
for information on configuring security policies, and the |export| chapter for
information on exporting policies.

Note the URL in the following declaration does not resolve, you need to use a
valid URL where you have uploaded the ASM policy you exported from a BIG-IP system.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_app_sec_02**.
- A virtual server named **service**.
- A pool named **Pool1** monitored by the default *http* health monitor.
- An LTM policy named **_WAF__HTTP_Service** which references the external ASM policy via URL.

.. literalinclude:: ../../examples/declarations/example-referencing-external-security-policy.json
   :language: json

:ref:`Back to top<app-sec-examples>`



.. _endwaf:


Endpoint policy with default rule to disable WAF
````````````````````````````````````````````````
This example shows an Endpoint policy that includes two rules, one that attempts to match a URI and then enables the WAF policy, and a default rule to disable the Web Application Firewall (WAF) if the first doesn't match.  See the :ref:`Schema Reference<schema-reference>` for usage options and information on Endpoint policies.  You can also see this page for example policy declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_app_sec_03**.
- An Endpoint policy named **testItem**.
- Two rules, one to enable the WAF and the other to disable it.
- A WAF policy named **wafPolicy** which references an external policy (via URL).


.. literalinclude:: ../../examples/declarations/example-endpoint-policy-default-disabled-waf.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _endpoint-sni:


Endpoint policy with SSL SNI Match conditions and HTTP action
`````````````````````````````````````````````````````````````
This example shows an Endpoint policy that includes SSL SNI Match conditions (sslExtension) and the ability to use HTTP actions in a declaration. The SSL extension property inspects SSL extensions being negotiated during the HELLO phase. See |policycond| and |sslex| in the Schema Reference for usage and options.
The HTTP actions property provides the ability to enable or disable the BIG-IP system's HTTP filter processing. See |httppolicy| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_app_sec_04**.
- An Endpoint policy named **test1**.
- An Endpoint policy rule (sni0) which, if during the SSL client HELLO the server name (test1.com) is in the SSL extension, will forward to an existing pool (sni1) on the BIG-IP (with HTTP actions set to false).
- A second rule (sni1) which, if during the SSL client HELLO the server name (test2.com) is in the SSL extension, will forward to an existing pool (sni2) on the BIG-IP (with HTTP actions set to false).
- A default rule that drops the request if neither of the other two rules are matched.



.. literalinclude:: ../../examples/declarations/example-endpoint-policy-ssl-sni-match-with-http-action.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _securitylogapp:


Using a Security log profile with Application Security
``````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   The Application Security options for the Security Log Profile are available in BIG-IP AS3 v3.10.0 and later, and uses the BIG-IP ASM module.

This example shows how you can use a BIG-IP ASM Security Logging profile with application security in a declaration (you must have ASM licensed and provisioned to use this profile). Logging profiles determine where events are logged, and which items (such as which parts of requests, or which type of errors) are logged. For more information on ASM logging profiles, see |securitylog|, and |seclog| in the Schema Reference for BIG-IP AS3 usage options and information.  

There are two declarations in this example, one that uses local storage for the logs, and one that uses remote storage.

.. _local:

Local storage
~~~~~~~~~~~~~~

This declaration creates a security log profile that uses local storage (for the remote storage example, click :ref:`remote`).  This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Security_Log_Local**.
- A Security Log Profile named **secLogLocal** with Application Security enabled which stores logs locally.


.. literalinclude:: ../../examples/declarations/example-security-log-profile-local.json
   :language: json


.. _remote:

Remote storage
~~~~~~~~~~~~~~

This declaration creates a security log profile that uses remote storage (for the local storage example, click :ref:`local`).  This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Security_Log_Remote**.
- A Security Log Profile named **secLogRemote** with Application Security enabled, which sends logs to a remote logging server on port 9876.


.. literalinclude:: ../../examples/declarations/example-security-log-profile-remote.json
   :language: json


:ref:`Back to top<app-sec-examples>`

.. _endpoint-persist:


Using Persist Actions in an Endpoint Policy
```````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   The Persist actions are available in BIG-IP AS3 v3.11.0 and later.
   
This example shows an Endpoint policy that includes Persist actions in a declaration. The Persist actions give you control over how connections are persisted. You can use the following Persist actions: carp, cookie-insert, cookie-rewrite, disable, source-address, cookie-hash, cookie-passive, destination-address, hash, and universal (the example declaration includes an example of each).  See |persist| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_Endpoint_Policy**.
- An Endpoint policy named **testPolicy**.
- An Endpoint policy rule with examples of each Persist action.


.. literalinclude:: ../../examples/declarations/example-endpoint-policy-persist.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _waf-change:


Changing the enforcement mode of a WAF policy retrieved from a URL
``````````````````````````````````````````````````````````````````
This example shows how you can change the enforcement mode of a WAF policy that was retrieved from a URL.  This declaration uses a new property in the WAF_Policy class called **enforcementMode**, which overrides the enforcement mode that is set in the policy itself.  

This can be useful when you want to change the enforcement mode, but do not want to (or cannot) modify the WAF Policy. See |wafp| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_WAF_Policy**.
- A WAF policy named **exampleWAF**, which pulls the policy from a URL.
- The enforcement mode of the policy is set to transparent, which overrides the setting in the policy itself.


.. literalinclude:: ../../examples/declarations/example-change-waf-mode.json
   :language: json

:ref:`Back to top<app-sec-examples>`


.. _fpsprof:


Using an Anti-Fraud (FPS) profile in a declaration
``````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Referencing an existing Anti-Fraud profile is available in BIG-IP AS3 v3.14.0 and later. You must have Fraud Protection Services (FPS) licensed on your BIG-IP system to use this profile.


This example shows how can use an Anti-Fraud profile (part of Fraud Protection Services (FPS)) that already exists on your BIG-IP system in a BIG-IP AS3 declaration.   The Anti-Fraud profile includes logging settings that enable reporting of login attempts to third party platforms such as Splunk. See the |awaf| page on F5.com for information about Fraud Protection Services.

See |pointfps| in the :ref:`Schema Reference<schema-reference>` for usage options.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_FPS**.
- A virtual service named **FPSvs** that references an existing anti-fraud profile on the BIG-IP system.


.. literalinclude:: ../../examples/declarations/example-fps-profile.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _waf-tech:


Defining server technologies in a WAF policy
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Defining server technologies in a WAF policy is available in BIG-IP (TMOS) versions 13.0 and later with ASM licensed and provisioned. 

This example shows how you can define server technologies (such as Java Servlets or Apache Struts) for a WAF policy in a BIG-IP AS3 declaration.  This allows you to assign signatures that specifically apply to the technologies used in the application being protected.

For more information on WAF server technologies, see |waftechdocs| in the ASM manual. See |wafpolicy| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_WAF_Policy**.
- A WAF policy named **exampleWAF**, which pulls the policy from a URL.
- The enforcement mode of the policy is set to transparent, which overrides the setting in the policy itself.
- Two server technologies attached to the policy, Java Servlets/JSP and Apache Struts.


.. literalinclude:: ../../examples/declarations/example-waf-server-technologies.json
   :language: json

:ref:`Back to top<app-sec-examples>`


.. _waf-sig:


Disabling an attack signature in a WAF policy
`````````````````````````````````````````````
This example shows how you can disable an attack signature(s) in a WAF policy which is referenced via a URL.  This can be useful if you have an established WAF policy and don't want to modify it, but want to disable specific signatures for a particular virtual service.

For more information on attack signatures, see |attacksig|. See |wafpolicy| in the Schema Reference for usage and options.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_WAF_Sig_Disable**.
- A WAF policy named **exampleWAF**, which pulls the policy from a URL.
- The enforcement mode of the policy is set to transparent, which overrides the setting in the policy itself.
- Two disabled attack signature IDs.


.. literalinclude:: ../../examples/declarations/example-waf-attack-sig-exceptions.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _negative:


Using negative string conditions in Endpoint policies
`````````````````````````````````````````````````````
This example shows how you can use negative string conditions (such as "is not" or "does not contain") in Endpoint policies (Local Traffic (LTM) policies on the BIG-IP). Use of negative operands has been available when configured directly on the BIG-IP, but added to BIG-IP AS3 in 3.17.0.  For more information, see |ltmpol| in the BIG-IP documentation.

This declaration also shows the **use** pointer for the Endpoint policy, also introduced in BIG-IP AS3 3.17.0.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_negative_op**.
- A virtual service named **EP_Virtual** which references the Endpoint (Local Traffic) policy, as well as a pool and TLS certificate.
- An Endpoint policy named **test_EP**, which contains rules with negative operands.
- A Client SSL profile (TLS_Server in BIG-IP AS3) with a certificate and key.
- A pool named **web_pool** with two members monitored by the default HTTP monitor.


.. literalinclude:: ../../examples/declarations/example-endpoint-policy-negative-operands.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _urlauth:


Adding Basic Auth when retrieving a WAF policy from a URL
`````````````````````````````````````````````````````````
This example shows you can add Basic Authentication when referencing a remote object, such as a WAF policy, from a URL in a BIG-IP AS3 declaration.  This allows you to reference a URL that is protected by Basic Authentication, which was not possible in BIG-IP AS3 versions prior to 3.18.

.. NOTE:: Currently only Basic Authentication is supported, other authentication methods may be added in future releases.

In this example, we are referencing a WAF policy that exists on a BIG-IQ device that is protected by Basic Auth.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_WAF_Policy**.
- A Application named **Example_App**.
- A WAF policy named **exampleWAF** that is retrieved from a URL located on a BIG-IQ behind Basic Authentication.


.. literalinclude:: ../../examples/declarations/example-waf-basic-auth.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _statuscode:


Configuring the status code used during a redirect with an Endpoint policy
``````````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You must be using BIG-IP 14.0 or later to use this feature.

This example shows you can use BIG-IP AS3 to configure the HTTP status code of an LTM Endpoint policy redirect in BIG-IP (TMOS) versions 14.0 and later.

See |policyaction| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- A Application named **AS3_Application**.
- An Endpoint policy named **test_EP** which includes a rule with an HTTP redirect action and an HTTP status code of 300.


.. literalinclude:: ../../examples/declarations/example-endpoint-policy-http-redirect.json
   :language: json

:ref:`Back to top<app-sec-examples>`

.. _tcpendpoint:


Using TCP address and port conditions in an Endpoint policy
```````````````````````````````````````````````````````````
This example shows how you can use TCP address and port conditions in an LTM Endpoint Policy. For more information on LTM Endpoint Policies, see |ltmpol| in the BIG-IP documentation.     

See |tcpcondition| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- A Application named **AS3_Application**.
- A data group named **ipDataGroup**.
- An Endpoint policy named **myPolicy** which includes a rule with multiple TCP conditions.


.. literalinclude:: ../../examples/declarations/example-endpoint-policy-tcp-condition.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|

.. _declarativewaf:


Referencing an Advanced WAF policy in a declaration
```````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You MUST be using BIG-IP 16.0 or later, and have ASM licensed and provisioned to use this feature.

This example shows how you can reference an Advanced Web Application Policy (AWAF) hosted in an external location in a BIG-IP AS3 declaration. The AWAF policies are declarative, JSON files.

In the following example, we reference an Open Web Application Security Project (OWASP) Top Ten protection policy from a URL hosted on GitHub. The OWASP Top 10 defines the most serious web application security risks, and it is a baseline standard for application security.

.. IMPORTANT:: You must be using BIG-IP (TMOS) version 16.0 or later to reference AWAF policies. You must also have the BIG-IP ASM module licensed and provisioned. |br| BIG-IP AS3 does not support overriding policy settings on AWAF policies. You should use the adjustments section of a AWAF policy instead.

For more information on F5 and OWASP, see |owasp|. For more information on F5 AWAF, see |advwaf| on F5.com.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **owaspTenant**.
- A Application named **owaspApp**
- A virtual server named **service** that references a WAF policy.
- An WAF policy named **asmPolicy** which references the OWASP top ten AWAF policy via URL.


.. literalinclude:: ../../examples/declarations/example-declarative-waf.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|


.. _referencewaf:


Embedding a WAF policy in a declaration
```````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You MUST have ASM licensed and provisioned to use this feature.

BIG-IP AS3 3.26 introduced the ability to embed JSON/XML WAF policies directly in a declaration, using the new **policy** property in the **WAF_Policy** class. This example includes three declarations for including WAF policies, one that is base64 encoded, one that text, and one using a URL.  Each of declarations uses the same WAF policy.

See |wafpolicy| for more information and BIG-IP AS3 usage.


All of the declarations create the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- A Application named **Application**
- A virtual server named **service** that references a WAF policy.
- A WAF policy that uses the **policy** property to specify the way the policy is included (options for :ref:`base64<base64ex>`, :ref:`text<textex>`, and :ref:`url<urlex>`).

.. _base64ex:

Base64 example
~~~~~~~~~~~~~~
In this declaration, the WAF policy is embedded in base64 encoding.


.. literalinclude:: ../../examples/declarations/example-waf-policy-base64.json
   :language: json

|

.. _textex:

Text example
~~~~~~~~~~~~
In this declaration, the WAF policy is embedded in text.


.. literalinclude:: ../../examples/declarations/example-waf-policy-text.json
   :language: json

|

.. _urlex:

URL example
~~~~~~~~~~~
In this declaration, the WAF policy is referenced from a URL.


.. literalinclude:: ../../examples/declarations/example-waf-policy-url.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|

.. _apiprotect:


Referencing an API Protection profile in a declaration
```````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   You MUST be using BIG-IP/TMOS 14.1 or later, and have BIG-IP APM licensed and provisioned to use this feature.

This example shows how you can reference an API Protection profile in a BIG-IP AS3 declaration, which safeguards your API servers. Protection profiles define groups of related RESTful APIs used by applications. The protection profile contains a list of paths that may appear in a request, and the system classifies requests and sends them to specific API servers.  

For more information, including how to manually create an API Protection profile that can be referenced in a BIG-IP AS3 declaration, see |apiprotectdocs|. This example does not create an API Protection profile, only references profiles that already exist on the BIG-IP.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **API_Protection_Service_HTTP**.
- A Application named **apiProtectionApp**
- A virtual server named **service** with a virtual address and a reference to an existing API Protection profile named **apiProtectionProfile**.



.. literalinclude:: ../../examples/declarations/example-http-api-protection-profile.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|

.. _tclaction:


Using Tcl set-variable actions in an Endpoint policy
````````````````````````````````````````````````````
This example shows how you use Tcl set-variable actions in an Endpoint policy, which allows you to set a Tcl variable in the runtime environment.  In the declaration, you need to specify the name of variable, and the Tcl expression to evaluate.

For BIG-IP AS3 options and usage, see |tclpasv| and |tclpa|.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- A Application named **AS3_Application**
- A virtual server named **service** with a virtual address and a reference to an Endpoint policy.
- An Endpoint policy named **endpointPolicy** with a rule and an action of type Tcl that sets a variable named **variableName** and an expression to evaluate.


.. literalinclude:: ../../examples/declarations/example-endpoint-policy-tcl-action.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|

Retrieving a WAF Policy from a URL using token-based authentication
```````````````````````````````````````````````````````````````````
In this example, we show how you can retrieve a WAF Policy from secured URLs that do not use Basic Authentication, using token (bearer token) authentication (OAuth2 in this example).  This is necessary when trying to retrieve data from URLs from locations such as Microsoft Azure Dev Ops, and GitHub (after 11/13/2020) that do not support Basic authentication.

This functionality is enabled by using the new **bearer-token** authentication method introduced in BIG-IP AS3 3.28. Currently, you must provide the token in the declaration.  Future versions may include the ability to retrieve the token.

Your application must be configured appropriately so BIG-IP AS3 can retrieve data from the URLs.  For example, if using Azure Dev Ops, see https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow.  If using GitHub, see the **Basics of Authentication** guide on GitHub. If using other applications, see the appropriate documentation.

See |tokenauth| and |wafpolicy| in the Schema Reference for more information and BIG-IP AS3 usage.  

.. NOTE:: This example retrieves a URL as a part of a WAF policy, but bearer token authentication works with any BIG-IP AS3 class that can retrieve data from a URL.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Example_WAF_Policy**.
- An Application named **Example_App**.
- A WAF policy named **exampleWAF** that retrieves the policy via URL using bearer token authentication, and the token is included in the declaration.

.. literalinclude:: ../../examples/declarations/example-waf-bearer-token-auth.json
   :language: json

:ref:`Back to top<app-sec-examples>`

|

.. _httpmeth:

Using the HTTP method condition in an Endpoint policy
`````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for the data group condition is available in 3.32 and later.

In this example, we show how you can use the **httpMethod** condition in your Endpoint policy rules. This allows you to match against any HTTP method.  

For more information on LTM Endpoint Policies, see |ltmpol| in the BIG-IP documentation.

When using **httpMethod**, you must also decide when to evaluate this condition in the request-response cycle. You can specify **request** or **proxy-request**.

**New in BIG-IP AS3 3.32** |br|
BIG-IP AS3 3.32 introduced support for using data groups, allowing you to reference a data group as the match value for an **httpUri** condition.

See |policycond| and |httpmethod| in the schema reference for more information and BIG-IP AS3 usage.  

.. IMPORTANT:: The example declaration has been updated with the BIG-IP AS3 3.32 release to include the data group HTTP URI condition. If you attempt to use this declaration on a previous version, it will fail. If you are using a version prior to 3.32, remove the lines highlighted in yellow (and the comma in line 44).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_Application**.
- An Endpoint policy named **test_EP** that contains rules with actions and the **httpMethod** condition.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-http-method-condition.json
    :language: json
    :emphasize-lines: 45-54

:ref:`Back to top<app-sec-examples>`

|

.. _ep-exists:

Using "exist" and "does not exist" string comparison operands in an Endpoint policy
```````````````````````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    You must be using BIG-IP 15.0 or later.

In this example, we show how you can use the string comparison operands **exists** and **does-not-exist** in Endpoint policy rules. These operands are part of the |policycompare|, which specifies the comparison that the system should perform as a part of the Endpoint policy. 

As their names suggest, **exists** checks if the string being compared exists, and **does-not-exist** checks if it does not exist.

These operands are only supported on BIG-IP 15.0 or later, and do not accept values.

For more information on LTM Endpoint Policies, see |ltmpol| in the BIG-IP documentation.


See |eppolicy| and |policycompare| in the Schema Reference for more information and BIG-IP AS3 usage.  

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_ep_operands**.
- An Application named **Application**.
- A virtual server named **service** that references the Endpoint Policy.
- An Endpoint policy named **endpointPolicy** that contains a rule with two **httpMethod** conditions, one using **exists** and one **does-not-exist**.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-exists-operands.json
    :language: json

:ref:`Back to top<app-sec-examples>`

|

.. _ep-cond:

Configuring TCP Endpoint Policy Conditions in a declaration
```````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for TCP EndPoint policy conditions other than Request and Response are available in BIG-IP AS3 v3.29 and later. Request and Response were always supported.

In this example, we show how you can use the TCP Endpoint Policy Conditions added in BIG-IP AS3 3.29. These event options determine when to evaluate the condition in the request-response cycle. 

**Request** and **Response** were supported in previous versions, BIG-IP AS3 3.29 adds the following conditions:

- classification-detected
- proxy-connect
- proxy-response
- ssl-client-hello
- ssl-server-handshake
- ws-request
- client-accepted
- proxy-request
- server-connected
- ssl-client-serverhello-send
- ssl-server-hello
- ws-response

.. NOTE:: client-accepted, server-connected, proxy-connect, proxy-request, proxy-response, and ssl-client-serverhello-send require BIG-IP v13.1 or later.


See |policycondtcp| in the Schema Reference for more information and BIG-IP AS3 usage.  

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_Application**.
- A virtual server named **tcpItem** that references the Endpoint Policy.
- Seven different Endpoint policies that contain examples of the newly supported events.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-tcp-condition-events.json
    :language: json
    

:ref:`Back to top<app-sec-examples>`

|

.. _ep-log:

Using the log Endpoint Policy Rule action
`````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for the **log** Endpoint policy rule action is available in BIG-IP AS3 v3.34 and later. 

In this example, we show how you can use the **log** Endpoint Policy rule actions introduced in BIG-IP AS3 3.34. This feature writes messages to a local or remote system log, based on the information you provide.

When using the **log** action type, you specify the timing with the log **event** property, which determines when to run this event in the request-response cycle (see |logpa| in the Schema Reference to see a list of the possible **event** values).  The **write** property determines how and where the logs are written (see |logpaw| for the possible options for **write**).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_Application**.
- A virtual server named **service** that references the Endpoint Policy.
- An Endpoint policy rule action of **log** with **event** and **write** properties.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-log-action.json
    :language: json
    

:ref:`Back to top<app-sec-examples>`

|

.. _waffile:

Referencing a WAF policy from a file on the BIG-IP
``````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for overrides when using the file property in a WAF policy is available in BIG-IP AS3 v3.37 and later. 

In this example, we show how you can use the **file** property to reference a WAF policy file that exists on the BIG-IP system.  This must be the absolute file path for the ASM policy stored on the BIG-IP.

In BIG-IP AS3 3.37 and later, any overrides available for the WAF policy (such as **enforcementMode**) are honored when referencing the policy from a file on the BIG-IP.  In previous versions, these overrides were ignored.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **WAF_Policy_File**.
- An Application named **Application**.
- A virtual server named **service** that references the WAF Policy.
- A WAF policy named **wafPolicy** that references a policy file on the BIG-IP.

.. code-block:: json

    {
        "class": "ADC",
        "schemaVersion": "3.37.0",
        "WAF_Policy_File": {
            "class": "Tenant",
            "Application": {
                "class": "Application",
                "service": {
                    "class": "Service_HTTP",
                    "virtualAddresses": [
                        "192.0.2.0"
                    ],
                    "policyWAF": {
                        "use": "wafPolicy"
                    }
                },
                "wafPolicy": {
                    "class": "WAF_Policy",
                    "file": "/path/to/file",
                    "enforcementMode": "transparent"
                }
            }
        }
    }
    

:ref:`Back to top<app-sec-examples>`

|

.. _geoip:

Using GeoIP Conditions in an Endpoint policy
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for the GeoIP Conditions in an Endpoint policy is available in BIG-IP AS3 v3.42 and later. 

In this example, we show how you can use GeoIP Conditions (introduced in BIG-IP AS3 3.42) in an Endpoint Policy. GeoIP Conditions allow you to configure an Endpoint policy to match against specific IP geolocation properties. For more information on LTM Endpoint Policies, see |ltmpol| in the BIG-IP documentation.

See |geoip| in the Schema Reference for available properties, descriptions, and AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_Application**.
- A virtual server named **tcpItem** that references the Endpoint Policy.
- An Endpoint policy named **geoIPPolicy** with a set or rules named **geoIPDefault**
- Multiple rules using the **geoip** type.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-geoip-condition-events.json
    :language: json
    

:ref:`Back to top<app-sec-examples>`

|

.. _slnat:

Configuring Security Log Profile NAT settings
`````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for lsnLegacyMode, logStartOutboundSessionDestination, and logEndOutboundSessionDestination in the Security Log Profile NAT class is available in BIG-IP AS3 v3.43 and later. 

In this example, we show how you can configure Security Log Profile NAT settings in an AS3 declaration. These settings determine how the system logs firewall NAT events.

While the Security Log Profile with NAT settings has long been supported, AS3 3.43 introduced three new properties for the NAT object, related to LSN legacy mode: 

- **lsnLegacyMode**: specifies whether translation events and other NAT events are logged in existing CGNAT/LSN formats (for backward compatibility with LSN events). The following options are applicable only if lsnLegacyMode is enabled (**true**).

  - **logStartOutboundSessionDestination**: includes the destination address and port with the log entry for the *start* of the translation event for a NAT client. 
  - **logEndOutboundSessionDestination**:  includes the destination address and port with log entry for the *end* of the translation event for a NAT client. 

.. IMPORTANT:: If **lsnLegacyMode** is enabled, you cannot set the **rateLimitStartInboundSession**, **rateLimitEndInboundSession**, **rateLimitStartOutboundSession**, or **rateLimitEndOutboundSession** properties.

For more information on the Security Log Profile, see |seclog|. For details on all of the available NAT settings, see |slpnat|.

This declaration creates the following objects on the BIG-IP (if you try to use the following declaration on an AS3 version prior to 3.43, it will fail. On previous versions, remove the new settings, highlighted in yellow):

- Partition (tenant) named **Sample_sec_log_profile_nat**.
- An Application named **A1**.
- A Security Log Profile named **secLogNAT** with a number of settings, including **lsnLegacyMode**, **logStartOutboundSessionDestination**, and **logEndOutboundSessionDestination** introduced in AS3 3.43.

.. literalinclude:: ../../examples/declarations/example-security-log-profile-nat.json
    :language: json
    :emphasize-lines: 22, 24, 25
    

:ref:`Back to top<app-sec-examples>`

|

.. _disablebd:

Enabling and disabling a bot defense profile in an Endpoint policy
``````````````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for disabling a bot defense profile in an Endpoint policy is available in BIG-IP AS3 v3.46 and later. 

In this example, we show how you can enable or disable a bot defense profile in an Endpoint policy using BIG-IP AS3 3.46 or later. This allows you to enable or disable the bot defense profile when specific conditions occur, such as when a particular HTTP URI is called.

For more information, see |eppolicy| and |botdef| in the Schema Reference.

For detailed information on bot defense, see |bdf5| and |configbd|.



This declaration creates the following objects on the BIG-IP

- Partition (tenant) named **Endpoint_Policy_BotDefense**.
- An Application named **Application**.
- A virtual server named **testItem** that references an endpoint policy and a bot defense profile.
- An endpoint policy named **endpointPolicy** with multiple rules that enable or disable the bot defense profile.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-enable-disable-botdefense.json
    :language: json

    

:ref:`Back to top<app-sec-examples>`

|

.. _expand:

Using expand for values in a WAF policy
```````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for expand in a WAF policy is available in BIG-IP AS3 v3.46 and later. 

In this example, we show how you can use the **expand** property in a WAF policy in BIG-IP AS3 3.46 or later. When using expand, BIG-IP AS3 performs string expansion on specified values within the WAF Policy. 

.. NOTE:: To use expand, the WAF Policy must be in JSON format; WAF policies that are not in JSON format are ignored.

The **expand** property accepts an array of JSON pointers that denote which properties in the imported WAF policy should have AS3 string expansion performed on them. AS3 expands the target property values in the WAF policy and overwrites the data before passing it to the BIG-IP. 

For more information, see |wafp| in the Schema Reference.

For more information on BIG-IP AS3 string expansion, see |stringexpand| in the Reference Guide.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- An Application named **Application**.
- A virtual server named **service** that references a WAF policy.
- A WAF policy named **wafPolicy** with a text policy, and the **expand** property that includes a JSON pointer to a value to expand.

.. literalinclude:: ../../examples/declarations/example-waf-policy-string-expansion.json
    :language: json

    

:ref:`Back to top<app-sec-examples>`

|

.. _httphost:

Using the httpHost condition in an Endpoint policy rule
````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for httpHost conditions is available in 3.47 and later.

In this example, we show how you can use the **httpHost** condition in your Endpoint policy rules. This allows you to match the host of an HTTP request, proxy request, or proxy connect.

The options for **httpHost** are:

- **host** - Matches the host name.
- **port** - Matches the port number.
- **all** - Matches the full host header string.

For more information on LTM Endpoint Policies, see |ltmpol| in the BIG-IP documentation.

Also see |hhost| in the Schema Reference.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Tenant**.
- An Application named **Application**.
- A virtual server named **http_host_service**
- An HTTP profile named **httpProfile** 
- A Data Group named **hostnames**
- An Endpoint policy named **http_host_policy** that contains three rules that use the different options for the **httpHost** condition.

.. literalinclude:: ../../examples/declarations/example-endpoint-policy-http-host-condition.json
    :language: json

:ref:`Back to top<app-sec-examples>`

|





.. |hhost| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-http-host" target="_blank">Policy_Condition_HTTP_Host</a>

.. |stringexpand| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/declaration-purpose-function.html#string-expansion-in-urls-irules-and-other-values" target="_blank">String Expansion in URLs, iRules, and Other Values</a>

.. |bdf5| raw:: html

   <a href="https://www.f5.com/cloud/products/bot-defense" target="_blank">Bot defense overview</a>

.. |configbd| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-16-1-0/big-ip-asm-implementations/configuring-bot-defense.html" target="_blank">Configuring Bot defense</a>

.. |asm| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_asm/manuals/product/asm-implementations-13-1-0.html" target="_blank">BIG-IP ASM Implementations Guide</a>

.. |botdef| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#dos-profile-application-bot-defense" target="_blank">DOS_Profile_Application_Bot_Defense</a>  

.. |export| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_asm/manuals/product/asm-implementations-13-1-0/34.html#guid-827de25f-5091-4002-bc1b-342e4451b409" target="_blank">Exporting ASM Policies</a>

.. |httppolicy| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-http" target="_blank">Policy_Action_HTTP</a>  


.. |policycond| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition" target="_blank">Policy_Condition</a>

.. |sslex| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-ssl-extension" target="_blank">Policy_Condition_SSL_extension_HTTP</a>

.. |securitylog| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_asm/manuals/product/asm-implementations-13-1-0/14.html" target="_blank">ASM Logging Profiles</a> 

.. |seclog| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#security-log-profile" target="_blank">Security Log Profile class</a>

.. |persist| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-persist" target="_blank">Policy_Action_Persist</a>

.. |wafp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#waf-policy" target="_blank">WAF_Policy</a>


.. |awaf| raw:: html

   <a href="https://www.f5.com/products/security/websafe-and-mobilesafe" target="_blank">Web Fraud protection</a>

.. |pointfps| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#pointer-fps-profile" target="_blank">Pointer_FPS</a>

.. |wafpolicy| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#waf-policy" target="_blank">WAF_Policy</a>

.. |waftechdocs| raw:: html

   <a href="https://techdocs.f5.com/kb/en-us/products/big-ip_asm/manuals/product/asm-implementations-13-1-0/23.html" target="_blank">Adding Server Technologies to a Policy</a>

.. |attacksig| raw:: html

   <a href="https://support.f5.com/csp/article/K8217" target="_blank">Managing BIG-IP ASM attach signatures</a>

.. |ltmpol| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-local-traffic-management-getting-started-with-policies.html" target="_blank">Local Traffic Policies</a>

.. |policyaction| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action" target="_blank">Policy_Action</a>  

.. |br| raw:: html

   <br />

.. |tcpcondition| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-tcp" target="_blank">Policy_Condition_TCP</a>

.. |owasp| raw:: html

   <a href="https://support.f5.com/csp/article/K52596282" target="_blank">Securing against the OWASP Top 10</a>

.. |advwaf| raw:: html

   <a href="https://www.f5.com/products/security/advanced-waf" target="_blank">Advanced WAF</a>

.. |apiprotectdocs| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-1-0/big-ip-access-policy-manager-api-protection/api-protection-concepts.html#acm-introducing-api-protection" target="_blank">APM API Protection</a>

.. |tclpa| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-tcl" target="_blank">Policy_Action_TCL</a>

.. |tclpasv| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-tcl-setvariable" target="_blank">Policy_Action_TCL_setVariable</a>

.. |httpmethod| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-http-method" target="_blank">Policy_Condition_HTTP_Method</a>

.. |policycompare| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-compare-string" target="_blank">Policy_Compare_String</a>

.. |eppolicy| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#endpoint-policy" target="_blank">Endpoint_Policy</a>   

.. |policycondtcp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-tcp" target="_blank">Policy_Condition_TCP</a>   

.. |tokenauth| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#bearer-token-token" target="_blank">Bearer Token</a>

.. |httpuricondition| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-http-uri" target="_blank">Policy_Condition_HTTP_URI</a>

.. |droppa| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-drop" target="_blank">Policy_Action_Drop</a>

.. |logpa| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-log" target="_blank">Policy_Action_Log</a>

.. |logpaw| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-action-log-write" target="_blank">Policy_Action_Log_Write</a>

.. |geoip| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#policy-condition-geoip" target="_blank">Policy_Condition_GeoIP</a>

.. |slpnat| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#security-log-profile-nat-object" target="_blank">Security_Log_Profile.nat</a>
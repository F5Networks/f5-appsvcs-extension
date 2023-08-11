.. _ck-examples:

TLS Encryption
--------------
This section contains declarations use SSL/TLS certificates and keys.   See the :ref:`FAQ<tlsserver>` for information on why BIG-IP AS3 and the BIG-IP use different naming conventions for Client and Server TLS.

Use the index on the right to locate specific examples.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.



.. _sslexample:


Referencing an existing SSL certificate and key in the Common partition
```````````````````````````````````````````````````````````````````````
This example shows how to reference an SSL certificate and key that exist in the Common partition.  For more information, see our video on referencing existing objects, including SSL certificates and keys, at https://www.youtube.com/watch?v=b55noytozMU.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_cert_01**.
- A virtual server named **service**.
- A pool named **pool** monitored by the default *http* health monitor.
- TLS/SSL profile (which references the default BIG-IP certificate and key in the Common partition) named **pTlsServer_Local**.  In the BIG-IP UI, this is called a Client SSL profile.

.. literalinclude:: ../../examples/declarations/example-reference-ssl-cert-and-key-in-common.json
   :language: json

:ref:`Back to top<ck-examples>`

|

.. _certs:


Using multiple SSL/TLS certificates in a single profile
```````````````````````````````````````````````````````

This simple example shows how you can use multiple SSL/TLS certificates in a single TLS_Server object in BIG-IP AS3 3.7.0 and later.   See the :ref:`Schema Reference<schema-reference>` for usage options for using these features in your BIG-IP AS3 declarations.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate). It has also been updated in 3.44 to include the **sniDefault** property for TLS_Server certificates and TLS_Client. When **sniDefault** is set to **true**, this profile is the default SSL profile when a client connection does not specify a known server name, or does not specify any server name at all. The default value is false.

This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Sample_cert_02**.
- Two certificates named **webcert1** and **webcert2**,
- A client SSL profile for each certificate named **webtls** and **webtls-1-**,



.. literalinclude:: ../../examples/declarations/example-multiple-ssl-tls-certs-in-one-profile.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _sni:


Using matchToSNI with a TLS_Server profile
``````````````````````````````````````````
In this declaration, we add the matchToSNI parameter. When you use matchToSNI with a value of an FQDN, the system ignores all names in the certificate and selects this cert when SNI matches value (or by default).

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Sample_cert_03**.
- A certificate named **webtls**.
- A TLS_Server object (SSL profile on the BIG-IP) containing two certificates and keys (**webcert1** and **webcert2**), the first of which uses matchToSNI.  See the :ref:`FAQ<tlsserver>` for information on why BIG-IP AS3 and the BIG-IP use different naming conventions for Client and Server TLS.



.. literalinclude:: ../../examples/declarations/example-matchtosni-with-tls-server-profile.json
   :language: json


:ref:`Back to top<http-examples>`

|

.. _pkcs:


Using PKCS 12 in a declaration
``````````````````````````````
This example shows how you can use PKCS 12 in your declarations.   See the :ref:`Schema Reference<schema-reference>` for usage options for using these features in your BIG-IP AS3 declarations.

**Important notes about BIG-IP AS3 and PKCS**

- There are two passphrases used for p12/pfx: file protection (import/export integrity) and private key passphrase (encryption). BIG-IP AS3 only supports using the same passphrase for both. The BIG-IP Configuration Utility (GUI) supports using different password values. However, openSSL CLI notes that most software only handles the scenario where both passphrases have the same value. For more information, see |twopass|.

- If you use the OpenSSL CLI to generate the PKCS12 file, and at the passphrase prompt you don't type a passphrase and just press Enter, the system actually creates an empty file (so pressing Enter does not mean there is no password).  To account for this in a declaration, you must add the following to your declaration:
  
  .. code-block:: bash

    "passphrase": { 
        "ciphertext": "IA==",
        "protected": "eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0",
        "ignoreChanges": true
    },

- If you do not expect the PKCS12 value to change on subsequent deployments of the declaration, set the following property to **true**: ``pkcs12Options: { ignoreChanges: true }``.  If you leave this property set to the default of **false** (or omit this property), a diff is detected because of the nature of the encrypted value of the private key.

- For the property **keyImportFormat** (``pkcs12Options: { keyImportFormat: "<pkcs8 or openssl-legacy>" }``, the default value is **pkcs8**, which saves the private key in PEM format: |br| ``(---BEGIN ENCRYPTED PRIVATE KEY---)``. |br| If it is set to **openssl-legacy**, it is saved with headers:
   
  .. code-block:: bash
   
    -----BEGIN RSA PRIVATE KEY----- 
    Proc-Type: 4,ENCRYPTED 
    DEK-Info: AES-128-CBC,D019D34F0792CEAB8CD895E6F29437D6 



This declaration creates the following objects on the BIG-IP:

- A partition (tenant) named **Sample_cert_04**.
- A certificate named **pkcs_crt.crt**.
- In this example, **my_12.p12** contains one cert, so the following objects are created: a certificate named pkcs12_crt_key_encr_url.crt and an encrypted private key named pkcs12_crt_key_encr_url.key, with key password value of "password".
- In this example, **my_pfx.pfx** contains multiple certs, so the following object is created: a cert bundle named pkcs12_crt_key_encr_bundle_url containing multiple certs.



.. literalinclude:: ../../examples/declarations/example-pkcs12.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _serverssl:


Enabling and disabling clientSSL (server SSL profile) from Endpoint policies
````````````````````````````````````````````````````````````````````````````
This simple example shows how you can enable or disable clientSsl (a Server SSL profile to the BIG-IP) from an Endpoint policy (LTM Policy to the BIG-IP) in your declaration.  See the :ref:`FAQ<tlsserver>` for information on why BIG-IP AS3 and the BIG-IP use different naming conventions for Client and Server TLS. The actions for clientSsl and serverSsl follow this same naming convention in AS3.

See the :ref:`Schema Reference<schema-reference>` for usage options and information on Endpoint policies.  You can also see :doc:`application-security` for example policy declarations.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_cert_05**.
- An endpoint policy named **testItem**.
- A rule named **requestRule**.
- An action for clientSsl with a value of **true**. You could use **false** to disable clientSsl (the Server SSL profile).


.. literalinclude:: ../../examples/declarations/example-enable-disable-server-ssl-via-endpoint-policies.json
   :language: json


:ref:`Back to top<ck-examples>`

|

HTTP and HTTPS virtual services in one declaration
``````````````````````````````````````````````````
This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_http_04**.
- An HTTP virtual server named **service** (called _A1 in the BIG-IP GUI) and an HTTPS virtual server named **A2**.
- A pool named **gce_pool** and a pool named **web_pool**, each containing two members using the HTTP health monitor.
- TLS/SSL profile (including certificate and private key) named **TLS_Server**.  In the BIG-IP UI, this is a Client SSL profile.  See the :ref:`FAQ<tlsserver>` for information on why BIG-IP AS3 and the BIG-IP use different naming conventions for Client and Server TLS.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

.. literalinclude:: ../../examples/declarations/example-http-https-one-declaration.json
   :language: json

:ref:`Back to top<ck-examples>`

|


.. _bothtls:


Using a client and server TLS profile in the same declaration
`````````````````````````````````````````````````````````````
This example shows how you can use both a client and server TLS (SSL) profile in your declarations.  See the :ref:`Schema Reference<schema-reference>` for usage options and information.  See the :ref:`FAQ<tlsserver>` for information on why BIG-IP AS3 and the BIG-IP use different naming conventions for Client and Server TLS.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_cert_05**.
- A virtual server named **service**.
- A client TLS profile named **pTlsClient_Local** with a certificate and key.
- A server TLS profile named **pTlsServer_Local** with a certificate and key.


.. literalinclude:: ../../examples/declarations/example-client-and-server-tls-profile-in-one-declaration.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _c3d:


Using Client Certificate Constrained Delegation (C3D) features in a declaration
```````````````````````````````````````````````````````````````````````````````
This example shows how you can use Client Certificate Constrained Delegation (C3D) in a declaration.  C3D is used to support complete end-to-end encryption when interception of SSL traffic in a reverse proxy environment is required and when client certificates are used for mutual authentication.  See the |c3d| and :ref:`Schema Reference<schema-reference>` for usage options and information.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_C3D**.
- An virtual server named **appC3D**.
- A server TLS profile (which creates a BIG-IP Client SSL profile) named **webtls** that uses matchToSNI and multiple certificates, and C3D features enabled.
- A client TLS profile (which creates a BIG-IP Server SSL profile) named **clienttls** with C3D features enabled.


.. literalinclude:: ../../examples/declarations/example-client-and-server-tls-profile-in-one-declaration.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _ldap:


Securing client and server side LDAP traffic
````````````````````````````````````````````
This example shows how you can use STARTTLS encryption in a declaration to secure your LDAP traffic. With AS3, you use the **ldapStartTLS** option to activate the STARTTLS communication protocol that allows or requires STARTTLS encryption. The STARTTLS protocol effectively upgrades a plain-text connection to an encrypted connection on the same port (port 389), instead of using a separate port for encrypted communication.  For detailed information, see the |ldapdoc| chapter of the SSL Administration guide.

The ldapStartTLS property only accepts **none**, **allow** (allows STARTTLS but doesn't require it), and **require**.  See the STARTTLS property in |starttls| in the Schema Reference and the section following that, TLS_Server.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TLS_ldap**.
- A virtual server named **ldapVip**.
- A server TLS profile (which creates a BIG-IP Client SSL profile) named **tlsServer** that requires STARTTLS (a server LDAP profile is also created with the STARTTLS setting) and a certificate and key.
- A client TLS profile (which creates a BIG-IP Server SSL profile) named **tlsClient** that allows STARTTLS (a client LDAP profile is also created with the STARTTLS setting).



.. literalinclude:: ../../examples/declarations/example-ldap-starttls.json
   :language: json


:ref:`Back to top<ck-examples>`

|


.. _oscpsign:


Using OCSP Certificate Validation in a declaration
``````````````````````````````````````````````````
This example shows how you can define an OCSP Certificate Validator. See the |ocspclass| in the Schema Reference.  The DNS resolver referenced in the Certificate_Validator_OCSP class must already exist on the BIG-IP device.

- This example does not include real certificates, so if you post the following declaration, you will receive an invalid certificate error.  Replace the values of **certificate** and **privateKey** with your own certificates.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_Cert_Validator_OCSP**.
- A Certificate Validator OCSP object named **testCertOcsp** that includes a DNS resolver (which must already exist on the target BIG-IP), the **signingHashAlgorithm** set to **sha256** and a reference to the signing certificate.
- A certificate named **testCert** which includes a certificate and key.


.. literalinclude:: ../../examples/declarations/example-ocsp-validator-signing.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _oscpstaple:

Using the staplerOCSP parameter in a certificate
````````````````````````````````````````````````
This example shows in detail how you can use the staplerOCSP parameter in a certificate as a part of a declaration. OCSP stapling is a standard for checking the revocation status of X.509 digital certificates.  See the staplerOCSP property in |certclass| and |ocspclass| in the Schema Reference.

Important notes about this declaration:

- In the certificate you are referencing in TLS_Server, **staplerOCSP** must be set on the certificate, as shown in this declaration.
- For a certificate to be able to use **staplerOCSP**, it cannot be a self-signed certificate.
- In this example, the issuer certificate already exists on the BIG-IP device (you can also use a pointer).
- The DNS resolver referenced in the Certificate_Validator_OCSP class must already exist on the BIG-IP device.
- This example does not include a real certificate, so if you post the following declaration, you will receive an invalid certificate error.  Replace the value of **certificate** with your own certificate.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TLS_Server_OCSP**.
- A server TLS profile (which creates a BIG-IP Client SSL profile) named **testItem**, with staplerOCSPEnabled set to true, and a reference to the certificate.
- A certificate named **cert** which includes references to the certificate validator OCSP object and an issuer certificate that already exists on our BIG-IP system.
- A Certificate Validator OCSP object named **testOcsp** that includes a DNS resolver (which must already exist on the target BIG-IP) and a responder URL (which specifies the absolute URL that overrides the OCSP responder URL obtained from the certificate's AIA extension(s)).


.. literalinclude:: ../../examples/declarations/example-ocsp-stapler.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _skipcrt:

Ignoring validation of certificates when retrieving URI data
````````````````````````````````````````````````````````````
This example shows how BIG-IP AS3 can ignore the verification of TLS/SSL certificates when retrieving data from a URI, using the new **skipCertificateCheck** property set to **true** (the default is **false**).  This prevents BIG-IP AS3 from returning errors when attempting to validate the certificate returned by the server.

See |skipcert| in the Schema Reference for more information and usage.

.. WARNING:: Ignoring certificate validation is insecure and should not be used in production environments; it should be used for test purposes only.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_Certificate**.
- A WAF Policy named **waf_policy_example** which is retrieved from a URL, with **skipCertificateCheck** set to **true** so BIG-IP AS3 does not attempt to validate the certificate returned by the server.

.. literalinclude:: ../../examples/declarations/example-skip-url-cert-check-pkcs12.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _cipher:

Using TLS 1.3 and Cipher rules and groups in a declaration
``````````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Cipher rules and groups are only available in TMOS versions 13.0 and later. TLS 1.3 support is available in TMOS 14.1.0.1 and later.

This example shows how you can use cipher rules and cipher groups to define cipher strings.  With cipher rules and groups, you instruct the BIG-IP system which cipher suites to include and exclude, and the system builds the cipher string for you.

It also shows how to enable TLS 1.3 support in a declaration when using TMOS 14.1.0.1 and later.  See |tls13| for more information, and |servertls| and |starttls| in the Schema Reference for usage.

.. IMPORTANT:: If you are using TLS 1.3, you MUST include a cipher group.  However, using cipher groups and rules does not require TLS 1.3.

See |cipherrule| in the BIG-IP documentation for more information Cipher rules and groups (or |cip14| for v14 and later).  See |ciprule| and |cipgroup| in the Schema Reference for usage options.

.. NOTE:: If you are using a TLS_Client or TLS_Server class to reference a cipher group, you must not use the **ciphers** property: **ciphers** and **cipherGroup** are mutually exclusive in these classes. See |starttls| and |servertls| in the schema reference for usage.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **SampleCipherGroup**.
- A server TLS profile (which creates a BIG-IP Client SSL profile) named **webtls**, with a reference to the certificate and to the cipher group. It also enables TLS 1.3.
- A Cipher Group named **myCipherGroup**, which specifies which cipher rules to allow, exclude, and require.
- Two Cipher rules named **customCipherRule1** and **customCipherRule2** which are referenced in the Cipher Group.

.. literalinclude:: ../../examples/declarations/example-cipher-group.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _multiplessl:

Referencing multiple SSL profiles on a single virtual service
`````````````````````````````````````````````````````````````
This example shows how you can reference multiple client and server SSL (TLS) profiles (that already exist on the BIG-IP) on a single virtual service. This allows for flexibility in implementing different authentication types in a single virtual server.

**IMPORTANT**: When using multiple SSL profiles, you MUST adhere to the following rules:

- The SSL profiles must exist on the BIG-IP device.
- One of the existing client/server SSL profiles must be configured as the SNI default (the **Default SSL Profile for SNI** check box in the BIG-IP Configuration utility).
- When using multiple existing client SSL profiles (serverTLS in AS3), you must set the **server-name** (**Server Name** in the BIG-IP Configuration utility) field, and it must be different in each profile.

To use multiple SSL profiles, you simply create an array of existing SSL profiles referenced with the **bigip** pointer, as shown in the following example.


This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_HTTPS**.
- An Application named **MyHttps**.
- A virtual server named **service** that includes an array of Client and Server SSL profiles.

.. literalinclude:: ../../examples/declarations/example-multiple-client-server-ssl-profiles.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _tlsoption:

Configuring additional TLS options on a virtual
```````````````````````````````````````````````
This example extends the capability introduced in :ref:`#13<cipher>` to include enabling or disabling additional TLS version options.

See |servertls| and |clienttls| in the Schema Reference for usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_TLS_Client**.
- An Application named **TLS_App**.
- A virtual server named **test.item-foo** that includes specific versions of TLS being enabled or disabled.

.. literalinclude:: ../../examples/declarations/example-modifying-tls-options.json
   :language: json
   :emphasize-lines: 17-20


:ref:`Back to top<ck-examples>` 

|

.. _explicit:

Configuring explicit forward proxy settings in SSL (TLS) profiles
`````````````````````````````````````````````````````````````````
This example shows how you can configure explicit proxy settings in Client and Server SSL profiles, specifically enabling the SSL forward proxy and whether or not the BIG-IP should cache certificates by IP address and port number.

SSL forward proxy allows you to encrypt all traffic between a client and the BIG-IP system by using one certificate, and to encrypt all traffic between the BIG-IP system and the server by using a different certificate.  This feature is well documented in the BIG-IP documentation, see |fwdproxydocs|.

See |servertls| and |clienttls| in the Schema Reference for BIG-IP AS3 usage.

.. NOTE:: The example declaration has been updated with the BIG-IP AS3 3.24 release to include a **chainCA** (a bundle of one or more CA certificates in trust-chain from root CA to certificate).

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) with both a certificate and proxy certificate, and certificate caching and forward proxy enabled.
- A Server SSL profile (TLS_Client in AS3) with forward proxy and forward proxy bypass enabled.

.. literalinclude:: ../../examples/declarations/example-tls-server-and-client-forward-proxy.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _cachetimeout:

Configuring a cache timeout in SSL (TLS) profiles
`````````````````````````````````````````````````
This example shows how you can configure a cache timeout in Client and Server SSL profiles (TLS_Client and TLS_Server).  This setting specifies the timeout value (in seconds) of the SSL session cache entries.

See |servertls| and |clienttls| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has a cache timeout value of 1234.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and has a cache timeout value of 4321.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-cache-timeout.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _alerttimeout:

Configuring an alert timeout in SSL (TLS) profiles
``````````````````````````````````````````````````
This example shows how you can configure an alert timeout in Client and Server SSL profiles (TLS_Client and TLS_Server). The SSL alert timeout specifies the duration that the system tries to close an SSL connection by transmitting an alert or initiating an unclean shutdown before resetting the connection.

The default is **indefinite**.  You can also specify **immediate** or a number of seconds.  See |servertls| and |clienttls| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has an alert timeout value of 1234.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and has an alert timeout value of **indefinite**.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-alert-timeout.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _renegotiate:

Configuring the renegotiation property on TLS classes
`````````````````````````````````````````````````````
This example shows how you can enable or disable renegotiation in Client and Server SSL profiles (TLS_Client and TLS_Server) using the **renegotiationEnabled** property. Disabling renegotiation is necessary when using HTTP/2, which breaks both renegotiation and post-handshake authentication because of pipelining.

See |servertls| and |clienttls| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has **renegotiationEnabled** set to **true**, enabling renegotiation.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and has **renegotiationEnabled** set to **false**, disabling renegotiation.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-renegotiation.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _retention:

Configuring the retain certificate property on TLS classes
``````````````````````````````````````````````````````````
This example shows how you can enable or disable retaining certificates in Client and Server SSL profiles (TLS_Client and TLS_Server) using the **retainCertificateEnabled** property. When disabled, the server certificate is not retained in SSL session.

See |servertls| and |clienttls| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has **retainCertificateEnabled** set to **true**, retaining the server certificate in the session.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and has **retainCertificateEnabled** set to **false**, which does not retain the server certificate in the session.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-retain-certificate.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _sslbypass:

Excluding host names from the SSL Forward Proxy Bypass
``````````````````````````````````````````````````````
This example shows how you can add host names to an allow list in a TLS_Server object so they are excluded from the SSL Forward Proxy Bypass. 

To use this feature, you add the new **forwardProxyBypassAllowlist** property to the TLS_Server class (which creates a Client SSL profile on the BIG-IP). The **forwardProxyBypassAllowlist** references a data group with a list of host names.  This data group can either be defined in the declaration as shown in the example, or reference an existing data group on the BIG-IP using the **bigip** pointer.

.. NOTE:: To use **forwardProxyBypassAllowlist**, both the **forwardProxyEnabled** and **forwardProxyBypassEnabled** properties must be set to **true** in the TLS_Server class.

See |servertls| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **TEST_TLS_Server_Tenant**.
- An Application named **AS3_App**.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, has **forwardProxyEnabled** and **forwardProxyBypassEnabled** set to **true**, and a reference to the forward proxy allow list.
- A Data Group named **dataGroupHostnames** which contains two host names that are excluded from the SSL forward proxy bypass.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-server-forwardProxyBypassAllowList.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _namingscheme:

Using certificate names as the SSL profile name
```````````````````````````````````````````````
This example shows how you can configure BIG-IP AS3 to name SSL profiles using the name of the certificate.  This can make it easier to identify SSL profiles from a large list.

To use this feature, you add the new **namingScheme** property set to **certificate** to the TLS_Server class (which creates a Client SSL profile on the BIG-IP). BIG-IP AS3 uses the name of the certificate as the name of the SSL profile, and ignores the name for the TLS_Server you provide in the declaration. The default is **numbered** which uses the name for the profile specified in the declaration.

See |servertls| in the Schema Reference for BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client SSL profile.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has **namingScheme** set to **certificate**. This means on the BIG-IP the Client SSL profile is named **application1.certificate**
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-server-naming-scheme.json
   :language: json


:ref:`Back to top<ck-examples>` 

|

.. _certmode:

Disabling the mode for TLS Server certificates
``````````````````````````````````````````````
This example shows how you can use the new **enabled** property to TLS_Server certificates, which can be used to disable the *mode* of a Client SSL profile on the BIG-IP system.  The Client SSL profile **mode** enables or disables SSL processing, regardless of whether the SSL profile is attached to a virtual server.  Setting **enabled** to **false** in a declaration causes BIG-IP AS3 to set the **mode** to **disabled** on the Client SSL profile.

This feature is commonly used with the SNI default profile, so TLS handshakes with bad SNI values are dropped for security.  BIG-IP AS3 automatically enables the Client SSL profile (TLS_Server in AS3) created from the first item of the **certificates** array to be a default SSL profile for SNI.

See |servertls| in the Schema Reference for BIG-IP AS3 usage.

See |clientsslprof| for more information on Client SSL profiles.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_cert_07**.
- An Application named **A1**.
- A virtual server named **service** that includes a reference to the Client SSL profile (TLS_Server in AS3).
- Two certificates which include the cert, chainCA and key.

.. literalinclude:: ../../examples/declarations/example-disabling-mode-in-tls-server.json
   :language: json

:ref:`Back to top<ck-examples>` 

|

.. _certuse:

Referencing a Chain CA with a 'use' pointer
```````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

    Support for use pointers for chain CA is available in BIG-IP AS3 v3.30 and later.

This example shows how you to include a **use** pointer for a Chain CA in order to reuse a chain CA declaration from /Common. A chainCA is a bundle of one or more CA certificates in trust-chain from root CA to certificate.  

This feature allows chain_CAs to reference CA_Bundles within the declaration as shown in the example declaration. In the example, the first tenant is storing the CA bundle in /Common/Shared, which allows it to be referenced from the second parition defined in the example.

See |cachain| in the Schema Reference for BIG-IP AS3 usage.

This declaration defines or creates the following objects on the BIG-IP:

- Partition (tenant) named **Common** (using the shared application template).
- An Application named **Shared** using the shared template (necessary for the Common tenant), and includes a CA bundle named **ca_example_bundle** referenced later in the declaration.
- A virtual server named **httpsVirtual** that references a client and server TLS profiles, defined later in the declaration.
- Another paritition, named **exampleTenant**, that includes a certificate named **useCert** which references the chainCA defined in the first partition, Client and Server SSL profiles which reference the **useCert** certificate, and a pool with one member.

.. literalinclude:: ../../examples/declarations/example-client-and-server-tls-profile-using-shared-certs.json
    :language: json


:ref:`Back to top<ck-examples>` 


|

.. _disablessl:

Disabling SSL on TLS profiles
`````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for disabling SSL on TLS profiles is available in BIG-IP AS3 v3.33 and later.

This example shows how you can disable SSL on TLS Client and Server profiles using the **sslEnabled** and **ssl3Enabled** properties. These properties enable more granular control over security settings by allowing you to enable or disable SSL or SSL v3 on individual TLS/SSL profiles.  The default for both properties is **true**.  Use **false** if you want to disable SSL or SSLv3.

See |servertls| and |clienttls| in the Schema Reference for more information and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has **sslEnabled** and **ssl3Enabled** set to **true**, enabling SSL and SSLv3.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and has **sslEnabled** and **ssl3Enabled** set to **false**, disabling SSL and SSL v3.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-ssl-protocol.json
   :language: json


:ref:`Back to top<ck-examples>` 


|

.. _proxyssl:

Configuring Client and Server TLS properties
````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for proxySslEnabled, proxySslPassthroughEnabled, secureRenegotiation, uncleanShutdownEnabled, dtlsEnabled, dtls1_2Enabled, certificateExtensions, and nonSslConnectionsEnabled are available in BIG-IP AS3 v3.38 and later.

This example shows how you can use newly supported TLS_Client and TLS_Server properties in a declaration. While the TLS Client and Server classes have long been supported, the following properties were added in BIG-IP AS3 3.38:

- proxySslEnabled
- proxySslPassthroughEnabled
- secureRenegotiation
- uncleanShutdownEnabled
- dtlsEnabled
- dtls1_2Enabled
- certificateExtensions
- nonSslConnectionsEnabled

See |servertls| and |clienttls| in the Schema Reference for specific information and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and uses a number of the newly supported properties.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and uses a number of the newly supported properties.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-proxy-ssl.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _advssl:

Configuring advanced Client and Server TLS properties
`````````````````````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for allowDynamicRecordSizing, dataZeroRoundTripTime, renegotiateMaxRecordDelay, renegotiatePeriod, and renegotiateSize are available in BIG-IP AS3 v3.41 and later.

This example shows how you can use newly supported TLS_Client and TLS_Server properties in a declaration. While the TLS Client and Server classes have long been supported, the following advanced properties were added in BIG-IP AS3 3.41:

- allowDynamicRecordSizing (TLS Server only)
- dataZeroRoundTripTime 
- renegotiateMaxRecordDelay (TLS Server only)
- renegotiatePeriod
- renegotiateSize


See |servertls| and |clienttls| in the Schema Reference for specific information and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and uses a number of the newly supported properties.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and uses a number of the newly supported properties.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-advanced-settings.json
   :language: json


:ref:`Back to top<ck-examples>`

|

.. _sslsign:

Specifying the SSL signature hash type
``````````````````````````````````````
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   Support for the sslSignHash property is available in BIG-IP AS3 v3.47 and later.

This example shows how you can use the **sslSignHash** property in the TLS_Client and TLS_Server classes to specify the SSL signature hash algorithm. Use this property to choose the SSL sign hash algorithm used to sign and verify SSL Server Key Exchange and Certificate Verify messages for the specified SSL profiles.  The options are **any** (default), **sha1**, **sha256**, and **sha384**.

See |servertls| and |clienttls| in the Schema Reference for specific information and BIG-IP AS3 usage.

This declaration creates the following objects on the BIG-IP:

- Partition (tenant) named **AS3_Tenant**.
- An Application named **AS3_App**.
- A virtual server named **service** that includes the Client and Server SSL profiles.
- A Client SSL profile (TLS_Server in AS3) that references a certificate, and has the **sslSignHash** set to **sha256**.
- A Server SSL profile (TLS_Client in AS3) that references a certificate, and has the **sslSignHash** set to **sha256**.
- A certificate which includes the cert and key.

.. literalinclude:: ../../examples/declarations/example-tls-client-and-server-ssl-sign-hash.json
   :language: json


:ref:`Back to top<ck-examples>`



.. |twopass| raw:: html

   <a href="https://linux.die.net/man/1/pkcs12" target="_blank">-twopass arg for openssl</a>


.. |br| raw:: html
   
   <br />

.. |c3d| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-ssl-administration-13-1-0/4.html#GUID-DD842D6D-320F-407E-97C6-B42102590B76" target="_blank">C3D documentation</a>

.. |starttls| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-client" target="_blank">TLS_Client</a>

.. |servertls| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-server" target="_blank">TLS_Server</a>

.. |clienttls| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-client" target="_blank">TLS_Client</a>

.. |ldapdoc| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-system-ssl-administration-14-1-0/13.html" target="_blank">Securing LDAP Traffic</a>

.. |certclass| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#certificate" target="_blank">Certificate class</a>

.. |ocspclass| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#certificate-validator-ocsp" target="_blank">Certificate_Validator_OCSP class</a>

.. |skipcert| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#resource-url" target="_blank">Resource_URL</a>

.. |cipherrule| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-15-0-0/big-ip-ltm-configuring-custom-cipher-string-for-ssl-negotiation/configuring-a-custom-cipher-string-for-ssl-negotiation.html" target="_blank">Configuring a Custom Cipher String for SSL Negotiation</a>

.. |ciprule| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#cipher-rule" target="_blank">Cipher_Rule</a>

.. |cipgroup| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#cipher-group" target="_blank">Cipher_Group</a>

.. |cip14| raw:: html

   <a href="https://support.f5.com/csp/article/K01770517" target="_blank">this AskF5 article</a>

.. |tls13| raw:: html

   <a href="https://support.f5.com/csp/article/K10251520" target="_blank">BIG-IP support for TLS 1.3</a>

.. |fwdproxydocs| raw:: html

   <a href="https://techdocs.f5.com/en-us/bigip-14-0-0/big-ip-system-ssl-administration-14-0-0/implementing-ssl-forward-proxy-on-a-single-big-ip-system.html" target="_blank">Implementing SSL Forward Proxy</a>

.. |clientsslprof| raw:: html

   <a href="https://support.f5.com/csp/article/K14783" target="_blank">Overview of Client SSL profiles</a>

.. |cachain| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#certificate-chainca" target="_blank">Certificate_chainCA</a>

   
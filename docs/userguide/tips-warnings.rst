Warnings, Notes, & Tips
~~~~~~~~~~~~~~~~~~~~~~~

.. _warnings:

Warnings
--------

.. _gslbnote:

.. WARNING:: You should review the following items before using BIG-IP AS3 in production environments.

- **IMPORTANT**: The community-supported solution for BIG-IP AS3 running in a Docker container is being archived as of BIG-IP AS3 3.23.  F5 will no longer provide new versions of BIG-IP AS3 running in a container.

- BIG-IP AS3 3.24 adds the ability to update APM policies.  Updating Access Policy Management objects can be a slow process and may cause BIG-IP AS3 declarations to take longer to apply.

- You must use the **admin** user (and not just a user with administrator privileges) to install BIG-IP AS3.

- In BIG-IP AS3 3.16.0 and later, BIG-IP AS3 now saves the BIG-IP configuration (**tmsh save sys config**) even when the operation result is **no change**, unless **persist** is set to **false** (persist is set to true by default). This could affect performance for BIG-IP devices with a large number of configuration objects.  |br| |br|

- When using :ref:`GSLB features<gslbex>`, you must be aware of the following:

  - Because BIG-IP AS3 manages topology records globally in /Common, it is required that records only be managed through BIG-IP AS3, as it will treat the records declaratively. If a record is added outside of BIG-IP AS3, it will be removed if it is not included in the next BIG-IP AS3 declaration for topology records (BIG-IP AS3 completely overwrites non-BIG-IP AS3 topologies when a declaration is submitted).
  - Likewise, using BIG-IP AS3 to delete a tenant (for example, sending DELETE to the /declare/<TENANT> endpoint) that contains GSLB topologies will completely remove ALL GSLB topologies from the BIG-IP. |br| |br|

- When you are using BIG-IP AS3 on a BIG-IP system that is part of a Device Group for high availability, if you want BIG-IP AS3 on all devices, you must manually install it on each BIG-IP in the group.  Synchronizing the configuration between devices in a Device Group does NOT install BIG-IP AS3 on devices that do not have BIG-IP AS3 installed.  |br| |br|

- When posting a large declaration (hundreds of application services in a single declaration), you may experience a 500 error stating that the **save sys config** operation failed. If you experience this issue, see :ref:`Troubleshooting<trouble>`.  |br| |br|

- The BIG-IP AS3 naming convention for TLS Server and TLS Client differs from traditional BIG-IP terminology to better comply with industry usage, but may be slightly confusing for long-time BIG-IP users. The BIG-IP AS3 **TLS_Server** class is for connections arriving to the BIG-IP, which creates a "client SSL profile" object on the BIG-IP. The BIG-IP AS3 **TLS_Client** class if for connections leaving the BIG-IP, which creates a "server SSL profile" on the BIG-IP.  See |tlsserver| and |tlsclient| in the Schema Reference for more information.  |br| |br|

- Even if you have asynchronous mode set to false, after 45 seconds BIG-IP AS3 sets asynchronous mode to true (API swap), and returns an async response. This allows you to use GET to poll for status (you should see a 202 status until the declaration is complete).  This typically occurs only with very large declarations or most declarations to BIG-IQ; if the declaration completes in less than 45 seconds, BIG-IP AS3 does not modify asynchronous mode.  |br| |br|

- Be sure to review this page, and also check the known issues on GitHub (https://github.com/F5Networks/f5-appsvcs-extension/issues) to review any known issues before you attempt to deploy BIG-IP AS3.  |br| |br|

- When creating a new tenant using BIG-IP AS3, it **must not** use the same name as a
  partition you separately create on the target BIG-IP system. If you use the
  same name and then post the declaration, BIG-IP AS3 overwrites (or removes) the
  existing partition completely, including all configuration objects in that
  partition.  |br| |br|

- After you use BIG-IP AS3 to create a tenant (which creates a BIG-IP partition),
  manually adding configuration objects to the partition created by BIG-IP AS3 can
  have unexpected results. For example:

  #. You post the a declaration using BIG-IP AS3 containing a single Virtual Server.
     You then use the BIG-IP Configuration Utility (GUI) to add another Virtual
     Server and Pool in the same Partition/Tenant manually.  When you delete the
     Tenant using BIG-IP AS3, the system deletes **both** virtual servers.

  #. You post the same declaration, and then use the BIG-IP Configuration
     utility to add a POP3 profile in partition *T1*.  POP3 profiles are not
     currently supported by BIG-IP AS3, therefore when you attempt to use BIG-IP AS3 to
     delete Partition *T1*, it fails with an error such as:

     ``"response":"0107082a:3: You must remove all objects from a partition before removing the partition (T1), type ID (4032)"``

     This scenario fails because BIG-IP AS3 does not support the entire scope of BIG-IP
     operations. It can only act on a subset of configurations.


- If you have not installed BIG-IP AS3, attempts to access it will result in a ``400``
  HTTP Status Code.  If you have just installed BIG-IP AS3, a request for a non-existent
  declaration results in a ``204`` HTTP Status Code.  You may also see other HTTP
  status codes.


.. _notestips:

Notes and Tips
--------------

.. NOTE:: The following are general tips and notes to keep mind when using BIG-IP AS3

- The BIG-IP AS3 naming convention for |ocp| differs from traditional BIG-IP terminology to better comply with industry usage, but may be slightly confusing for long-time BIG-IP users. In BIG-IP AS3, the OneConnect profile is a |mpp|. |br| |br|

- In BIG-IP AS3 3.20 and later, if a declaration includes a destination virtual address that conflicts with an existing virtual-address object in the Common tenant/partition on the target BIG-IP system, BIG-IP AS3 no longer attempts to create a new virtual address and will use the existing address on the BIG-IP. |br| |br|

- The BIG-IP AS3 RPM, Postman collection, and checksum files will no longer be located in the **/dist** directory in the BIG-IP AS3 repository on GitHub.  These files can be found on the |release|, as **Assets**. You can find historical files on GitHub by using the **Branch** drop-down, clicking the **Tags** tab, and then selecting the appropriate release.   |br| |br|

- There are some changes to the way BIG-IP AS3 names BIG-IP objects in BIG-IP AS3 3.16.0 and later.  See :ref:`naming-ref` for details.   |br| |br|

- To disable persistence on an application service, use ``"persistenceMethods": []``.  See :ref:`Troubleshooting<trouble>` for more information.   |br| |br|

- If a Firewall_Address_List contains zero addresses, a dummy IPv6 address of ::1:5ee:bad:c0de is added in order to maintain a valid Firewall_Address_List. If an address is added to the list, the dummy address is removed.  |br| |br|

.. _postcollection:

- The GitHub repository includes a |pmcol| with all of the example declarations. For information on importing this collection and using Postman collections, see the |postmancol|.  |br| |br|

- You can use **/mgmt/shared/appsvcs/declare?async=true** if you have a particularly large declaration which will take a long time to process. BIG-IP AS3 returns a Task ID. You can later use a GET request to the Task ID endpoint to see the status of the processing (and the results if it is finished).  See :ref:`api-details` for more information.   |br| |br|

- If you are using BIG-IP v12.1.x with BIG-IP AS3 version 3.1.0 or later: |br|  BIG-IP AS3 creates a new TCP profile f5_tcp_progressive_12_1, which we designed to imitate one of the improved profiles released with BIG-IP v13.0. BIG-IP AS3 creates this profile in the /Common/Shared directory, so all BIG-IP AS3 tenants can use it.  After submitting a declaration using BIG-IP v12.1.x, in the REST response, you'll notice three Message blocks, two in "tenant" **Common**, and one in the tenant you specified in the declaration.  The two in Common are a result of the new TCP profile, and you can safely ignore them.  If you send a GET with ?show=expanded after submitting the declaration, you can see the settings of this profile. |br| |br|

- We strongly recommend reviewing the *Sizing BIG-IP Virtual Editions* section (page 7) of |sizing| to ensure your BIG-IP system has sufficient CPU and memory for your needs. |br| |br|

- If you are familiar with the BIG-IP system, and generally familiar with REST and using APIs, you can jump right to the :doc:`quick-start` after reading the warnings and reviewing the known issues on GitHub (https://github.com/F5Networks/f5-appsvcs-extension/issues). |br| |br|

- See our BIG-IP AS3 Overview video at https://www.youtube.com/watch?v=cMl3AOtMcUo, and the video on using BIG-IP AS3 at https://www.youtube.com/watch?v=NJjcUUtjnJU. |br| |br|

- For example declarations that you can copy paste, see :doc:`examples` and :ref:`additional-examples`. |br| |br|

- To test whether your system has BIG-IP AS3 installed or not, use GET with the **/mgmt/shared/appsvcs/info** URI. |br| |br|

- BIG-IP AS3 does not on-board a BIG-IP VE system, but works alongside the on-boarding
  functionality found in |Ansible|, |aws|, |arm|, and others. For a declarative method for onboarding a BIG-IP, see |do|. |br| |br|

- JSON (JavaScript Object Notation, |rfc|) is a text-based format. You may
  create and modify BIG-IP AS3 declarations with a JSON editor or a simple text
  editor. |br| |br|

- You may find it more convenient to put multi-line texts such as iRules into BIG-IP AS3 declarations by first |base|. |br| |br|

- To use a bulky configuration resource such as an F5 WAF security policy in a
  declaration, you may want to store it on a webserver under your control then
  put a URL reference to it into the declaration.  For many resource types, BIG-IP AS3
  can "pull in" the actual contents of the resource from a URL source. |br| |br|

- To transmit your BIG-IP AS3 declarations you may use a specialized RESTful API
  client such as |postman| or a universal client such as cURL. |br| |br|

- Currently, no matter your BIG-IP user account name, audit logs show all
  messages from **admin** and not the specific user name. |br| |br|

- From any client external to the BIG-IP, the BIG-IP AS3 RESTful API is only accessible using HTTPS (HTTP over TLS). |br| |br|



.. |ansible| raw:: html

   <a href="https://github.com/F5Networks/f5-ansible" target="_blank">Ansible</a>

.. |aws| raw:: html

   <a href="https://github.com/F5Networks/f5-aws-cloudformation" target="_blank">AWS CloudFormation templates</a>

.. |arm| raw:: html

   <a href="https://github.com/F5Networks/f5-azure-arm-templates" target="_blank">Azure ARM templates</a>

.. |rfc| raw:: html

   <a href="https://tools.ietf.org/html/rfc8259" target="_blank">rfc8259</a>

.. |base| raw:: html

   <a href="https://www.base64encode.org/" target="_blank">encoding them in Base64</a>

.. |postman| raw:: html

   <a href="https://www.getpostman.com/" target="_blank">Postman</a>

.. |sizing| raw:: html

   <a href="https://f5.com/Portals/1/PDF/Solutions/deploying-f5-big-ip-virtual-editions-in-a-hyper-converged-infrastructure.pdf" target="_blank">Deploying BIG-IP VEs in a Hyper-Converged Infrastructure</a>

.. |br| raw:: html

   <br />

.. |valid| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/tree/master/AS3-schema-validator" target="_blank">AS3 Schema Validator</a>

.. |postmancol| raw:: html

   <a href="https://learning.getpostman.com/docs/postman/collections/intro_to_collections/" target="_blank">Postman documentation</a>


.. |pmcol| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/releases/" target="_blank">BIG-IP AS3 Postman collection</a>

.. |tlsclient| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-client" target="_blank">TLS_Client</a>

.. |tlsserver| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-server" target="_blank">TLS_Server</a>

.. |release| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">GitHub Release</a>

.. |ocp| raw:: html

   <a href="https://support.f5.com/csp/article/K7208" target="_blank">OneConnect profile</a>
   
.. |mpp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#multiplex-profile" target="_blank">Muliplex profile</a>

.. |do| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-declarative-onboarding/latest/" target="_blank">Declarative Onboarding</a>

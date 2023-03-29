.. _best-practice: 

BIG-IP AS3 Best Practices
========================
This page contains best practices for using BIG-IP AS3 as well as a brief architectural overview.  
This page is also on DevCentral, where there may be more frequent updates and user interaction, see https://community.f5.com/t5/technical-articles/as3-best-practice/ta-p/287466.

Architecture overview
---------------------
In the TMOS space, the services that BIG-IP AS3 provides are processed by a daemon named **restnoded**. It relies on the existing BIG-IP framework for deploying declarations. The framework consists of **httpd**, **restjavad** and **icrd_child** as depicted in the following image (the numbers in parenthesis are listening TCP port numbers).

.. image:: /images/architecture.png

|

These processes are also used by other services. For example, **restjavad** is a gateway for all the iControl REST requests, and is used by a number of services on BIG-IP and BIG-IQ. When an interaction between any of the processes fails, the BIG-IP AS3 operation fails. The failures stem from lack of resources, timeouts, data exceeding predefined thresholds, resource contention among the services, and more. In order to complete BIG-IP AS3 operations successfully, use the following best practices.



Best Practices
--------------

Your single source of truth is your declaration
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Refrain from overwriting the BIG-IP AS3-deployed BIG-IP configuration by other means such as TMSH, GUI, or iControl REST calls.

If you initially used the BIG-IP AS3 declarative model, the source of truth for your device's configuration is in your declaration, not the BIG-IP configuration files. Although BIG-IP AS3 tries to weigh BIG-IP locally stored configurations as much as it can, any discrepancy between the declaration and the current configuration on BIG-IP may cause the BIG-IP AS3 to perform less efficiently or error unexpectedly. When you want to change a section of a tenant (for example, a pool name change), modify the declaration and submit it.

Keep the number of applications in one tenant to a minimum
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
BIG-IP AS3 processes each tenant separately. Having too many applications (virtual servers) in a single tenant (partition) results in a lengthy poll when determining the current configuration. In extreme cases (thousands of virtual servers), the action may time out. When you want to deploy a thousand or more applications on a single device, consider chunking the work for BIG-IP AS3 by spreading the applications across multiple tenants (say, 100 applications per tenant).

BIG-IP AS3 tenant access behavior is the same as BIG-IP partition behavior. A virtual that is not in the Common partition cannot gain access to a pool in another partition, and in the same way, a BIG-IP AS3 application does not have access to a pool or profile in another tenant. In order to share configurations across tenants, BIG-IP AS3 allows configuration of the "Shared" application within the "Common" tenant (see :ref:`Shared <shared-ref>`). BIG-IP AS3 avoids race conditions while configuring /Common/Shared by processing additions first and deletions last, as shown below. This dual process may cause some additional delay in declaration handling.

.. image:: /images/as3-processing.png

|

Overwrite rather than patching (POSTing is a more efficient practice than PATCHing)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
BIG-IP AS3 is stateless and idempotent. It polls BIG-IP for its full configuration, performs a current-vs-desired state comparison, and generates an optimal set of REST calls to fill the differences. When the initial state of BIG-IP is blank, the poll time is negligible. This is why initial configuration with BIG-IP AS3 is often quicker than subsequent changes, especially when the tenant contains a large number of applications.

BIG-IP AS3 provides the means to partially modify using PATCH (see :ref:`Method:Patch<patch-ref>`), but do not expect PATCH changes to be performant. BIG-IP AS3 processes each PATCH by (1) performing a GET to obtain the last declaration, (2) patching that declaration, and (3) POSTing the entire declaration to itself. A PATCH of one pool member is therefore slower than a POST of your entire tenant configuration. If you decide to use PATCH, make sure that the tenant configuration is a manageable size. 

.. NOTE:: Using PATCH to make a surgical change is convenient, but using PATCH over POST breaks the declarative model. Your declaration should be your single source of truth. If you include PATCH, the source of truth becomes "POST this file, then apply one or more PATCH declarations."

Get the latest version
^^^^^^^^^^^^^^^^^^^^^^
BIG-IP AS3 is evolving rapidly with new features that customers have been wishing for along with fixes for known issues.

Visit the |github|. The |issues| page shows what features and fixes have been incorporated.

Use the administrator role
^^^^^^^^^^^^^^^^^^^^^^^^^^
Use a user with the administrator role when you submit your declaration to a target BIG-IP device. Your may find your role insufficient to manipulate BIG-IP objects that are included in your declaration. Even one authorized item will cause the entire operation to fail and role back. 

.. NOTE:: You must use the **admin** user (and not just a user with administrator privileges) to install BIG-IP AS3.

See the following articles for more on BIG-IP user and role.

`Manual Chapter: User Roles (12.x) <https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-user-account-administration-12-0-0/4.html>`_ |br|
`Manual Chapter: User Roles (13.x) <https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-user-account-administration-13-0-0/3.html>`_ |br|
`Manual Chapter: User Roles (14.x) <https://techdocs.f5.com/en-us/bigip-14-0-0/big-ip-systems-user-account-administration-14-0-0/administrative-partitions.html>`_ |br|
:doc:`prereqs`


Use Basic Authentication for a large declaration
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
You can choose either Basic Authentication (HTTP Authorization header) or Token-Based Authentication (F5 proprietary X-F5-Auth-Token) for accessing BIG-IP. While the Basic Authentication can be used any time, a token obtained for the Token-Based Authentication expires after 1,200 seconds (20 minutes). While BIG-IP AS3 does re-request a new token upon expiry, it requires time to perform the operation, which may cause BIG-IP AS3 to slow down. Also, the number of tokens for a user is limited to 100 (since BIG-IP AS3 13.1), therefore, if you happen to have other iControl REST players (such as BIG-IQ or your custom iControl REST scripts) using the Token-Based Authentication for the same user, BIG-IP AS3 may not be able to obtain the next token, and your request will fail.

See the following articles for more on the Token-Based Authentication.

`Demystifying iControl REST Part 6: Token-Based Authentication (DevCentral article) <https://community.f5.com/t5/technical-articles/demystifying-icontrol-rest-part-6-token-based-authentication/ta-p/286793>`_ |br|
`iControl REST Authentication Token Management (DevCentral article) <https://community.f5.com/t5/technical-articles/icontrol-rest-authentication-token-management/ta-p/287462>`_
:doc:`authentication`

Choose the best window for deployment
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
BIG-IP AS3 (**restnoded** daemon) is a Control Plane process. It competes against other Control Plane processes such as **monpd** and iRules LX (node.js) for CPU/memory resources. BIG-IP AS3 uses the iControl REST framework for manipulating the BIG-IP resources. This implies that its operation is impacted by any processes that use **httpd** (such as the BIG-IP GUI), **restjavad**, **icrd_child** and **mcpd**. If you have resource-hungry processes that run periodically (such as **avrd**), you may want to run your BIG-IP AS3 declaration during some other time window.

See the following K articles for a list of processes:

`K89999342 BIG-IP Daemons (12.x)  <https://support.f5.com/csp/article/K89999342>`_ |br|
`K05645522 BIG-IP Daemons (v13.x) <https://support.f5.com/csp/article/K05645522>`_ |br|
`K67197865 BIG-IP Daemons (v14.x) <https://support.f5.com/csp/article/K67197865>`_ |br|
`K14020: BIG-IP ASM daemons (11.x - 15.x)  <https://support.f5.com/csp/article/K14020>`_ |br|
`K14462: Overview of BIG-IP AAM daemons (11.x - 15.x) <https://support.f5.com/csp/article/K14462>`_ |br|

|

Workarounds
-----------
If you experience issues such as a timeout on **restjavad**, it is possible your BIG-IP AS3 operation had resource issues. After reviewing the guidance on this page you are still unable to alleviate the problem, you may be able to temporarily fix it using the following guidance. 

.. _restjavadmem:

Increase the restjavad memory allocation
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
The memory size of restjavad can be increased by the following tmsh sys db commands.

.. IMPORTANT:: Do not provision more than 2400MB of memory for restjavad. For more information, see `K30042148: Restjavad memory provisioning threshold limit <https://support.f5.com/csp/article/K30042148>`_

``tmsh modify sys db provision.extramb value <value>``

.. NOTE:: BIG-IP AS3 performance testing shows that a value of **256** is a good place to start for extramb. If you are using other iControl LX extensions in addition to BIG-IP AS3, we recommend starting with a value of **512**.

``tmsh modify sys db restjavad.useextramb value true``  

The provision.extramb db key changes the maximum Java heap memory to (192 + <value> * 8 / 10) MB. The default value is 0. After changing the memory size, you need to restart restjavad.

``tmsh restart sys service restjavad``

See `K26427018: Overview of Management provisioning <https://support.f5.com/csp/article/K26427018>`_ for more on the memory allocation.



Request failed errors
^^^^^^^^^^^^^^^^^^^^^
If you receive an error code when submitting a declaration, then REST responses are limited to 2k bytes. This issue has been resolved in TMOS 16.1 and later.

If you are using TMOS 16.0 or earlier and are encountering a response similar to:

.. code-block:: json

    {
        "code": 422,
        "message": "request failed with null exception",
        "referer": "192.168.100.100",
        "restOperationId": "130704167,
        "kind": ":resterrorresponse"
    }


You can either upgrade to TMOS 16.1 or later, or if you have a **controls** section in your declaration with **traceResponse** set to **true**, set it to **false**.



Decrease the verbosity levels of restjavad and icrd_child
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Writing log messages to the file system does take system resources. Writing unnecessarily large amount of messages to files would increase the I/O wait, hence results in slowness of processes. If you have changed the verbosity levels of restjavad and/or icrd_child, consider rolling back the default levels.

See `K15436: Configuring the verbosity for restjavad logs on the BIG-IP system  <https://support.f5.com/csp/article/K15436>`_ for methods to change verbosity level.

.. _restapi:

Increase timeout values if the REST API is timing out
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
If you find that the REST API is timing out, you can increase the timeout values for ircd, restjavad, and restnoded. These timeouts may occur due to large responses, such as when requesting the status of all virtual servers or all Wide-IPs.

.. NOTE:: Not all variables are present in all BIG-IP versions.  See `K94602685 <https://support.f5.com/csp/article/K94602685>`_ and the associated `Bug ID 858189 <https://cdn.f5.com/product/bugtracker/ID858189.html>`_ for information on specific versions.

To increase timeout values, use the following commands (the defaults are all 60 seconds):

- ``tmsh modify sys db icrd.timeout value 180``
- ``tmsh modify sys db restjavad.timeout value 180``
- ``tmsh modify sys db restnoded.timeout value 180``

And then save changes and restart related services:

- ``tmsh save sys config``
- ``tmsh restart sys service restjavad``
- ``tmsh restart sys service restnoded``

See `K94602685: REST API occasionally times out  <https://support.f5.com/csp/article/K94602685>`_ for additional information.




.. |github| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension" target="_blank">F5 BIG-IP AS3 repository on GitHub</a>

.. |issues| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/issues" target="_blank">Issues</a>
   
.. |br| raw:: html

   <br />
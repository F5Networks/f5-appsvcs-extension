.. _composing:


Composing a BIG-IP AS3 Declaration
==================================

The most important part of using BIG-IP AS3 is creating a declaration that includes the BIG-IP objects you want the system to configure.  For a detailed look at the purpose and function of the BIG-IP AS3 declaration, see :ref:`declaration-purpose-function`.  See :ref:`examples`, :ref:`additional-examples` and :ref:`schema-reference` for sample declarations and further information.

To submit a BIG-IP AS3 declaration, use a specialized RESTful API client such as Postman or a universal client such as cURL.

To transmit the declaration, you POST the declaration to the URI ``<BIG-IP IP address>/mgmt/shared/appsvcs/declare``.

Once you submit a declaration, if you want to view it from the BIG-IP Configuration utility, you must select the partition from the **Partition** list in the upper-right portion of the screen.  The partition name is the name you give the tenant in the declaration.

In this section, we break down an example declaration and describe its parts. 

.. TIP:: For a complete list of options in a declaration, see :ref:`schema-reference`.  

If you want to try this sample declaration now, jump to :doc:`quick-start`.

You can use Microsoft Visual Studio Code to :ref:`Validate your BIG-IP AS3 declarations<validate>`.

Sample declaration
~~~~~~~~~~~~~~~~~~

In this scenario, an organization has a simple HTTP-only application running on two web servers and wants to use the BIG-IP system to provide basic load balancing and health monitoring.  On the BIG-IP system, at a minimum, this configuration requires the creation of a virtual server and a load balancing pool, but can include much more.

In the following declaration, we include the virtual server and the pool, and use some default objects like the built-in HTTP health monitor.  We also include some other objects that are necessary for BIG-IP AS3, such as a tenant (which becomes a BIG-IP partition) and an application.

This is our example declaration.  We break down the components in the following sections.

.. code-block:: json
   :linenos:


    {
        "class": "AS3",
        "action": "deploy",
        "persist": true,
        "declaration": {
            "class": "ADC",
            "schemaVersion": "3.0.0",
            "id": "example-declaration-01",
            "label": "Sample 1",
            "remark": "Simple HTTP application with round robin pool",
            "Sample_01": {
                "class": "Tenant",
                "defaultRouteDomain": 0,
                "Application_1": {
                    "class": "Application",
                    "template": "http",
                    "serviceMain": {
                        "class": "Service_HTTP",
                        "virtualAddresses": [
                            "10.0.1.10"
                        ],
                        "pool": "web_pool"
                    },
                    "web_pool": {
                        "class": "Pool",
                        "monitors": [
                            "http"
                        ],
                        "members": [{
                            "servicePort": 80,
                            "serverAddresses": [
                                "192.0.1.10",
                                "192.0.1.11"
                            ]
                        }]
                    }
                }
            }
        }
    }


|

Components of the declaration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The following sections break down the example into parts so you can understand how to compose a declaration. The tables below the examples contains descriptions and options for the parameters included in the example only.  

.. NOTE:: BIG-IP AS3 contains many more options, see :ref:`schema-reference` for details.

.. _as3class-ref:

AS3 Class
`````````
The first few lines of your declaration are a part of the AS3 class and define top-level options.  You can create a declaration without using the AS3 class (called a ADC declaration), however in that case the action or persist parameters are no longer available.

.. code-block:: javascript
   :linenos:


    {
        "class": "AS3",
        "action": "deploy",
        "persist": true,



|
|

+--------------------+----------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options                                      | Description/Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
+====================+==============================================+======================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================================+
| class              | AS3                                          | The class must always be AS3, do not change this value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
+--------------------+----------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| action             | deploy, dry-run, redeploy, retrieve, remove  | The action *deploy* deploys the declaration onto the target device (this is the default and used if you didn't specify an action). *dry-run* does everything deploy does, except attempt to change the configuration of the target device (useful for debugging declarations). *redeploy* redeploys one of the declarations stored in the target device's declaration history without making you GET it then POST it. *retrieve* returns the latest declaration (same as using GET). *remove* deletes the configuration created by the declaration (same as using DELETE). For localhost we recommend using GET and DELETE rather than the retrieve or remove actions. For more information on these actions, see :ref:`actions-ref` |
+--------------------+----------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| persist            | true, false                                  | This value determines when the system saves the configuration to disk.  When set to true, AS3 saves the BIG-IP configuration to disk after change.  When set to false, the system does not save the configuration.  This can be useful when you are experimenting or testing AS3, and may not want the system to save the configuration to disk after each change.                                                                                                                                                                                                                                                                                                                                                                   |
+--------------------+----------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

.. _adc-class-ref:

ADC Class
`````````
The next lines of your declaration are a part of the ADC class and define general settings for the declaration.  If you were to create an ADC declaration (which doesn't use the AS3 Class), you would begin your declaration like the following, omitting *"declaration":* but leaving the opening curly bracket.

.. code-block:: javascript
   :linenos:
   :lineno-start: 5


    "declaration": {
        "class": "ADC",
        "schemaVersion": "3.0.0",
        "id": "example-declaration-01",
        "label": "Sample 1",
        "remark": "Simple HTTP application with round robin pool",
        "updateMode": "selective",


|
|

+--------------------+----------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options              | Description/Notes                                                                                                                                                                                                                                                                                                                                                                                                                              |
+====================+======================+================================================================================================================================================================================================================================================================================================================================================================================================================================================+
| class              | ADC                  | The class for AS3 must always be ADC, do not change this value.                                                                                                                                                                                                                                                                                                                                                                                |
+--------------------+----------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| schemaVersion      | 3.0.0 - latest       | When composing new declarations, you should use the latest schema version. This prevents inadvertently running a declaration on an outdated version of AS3 code. If you do not need this protection, use the value **3.0.0** in perpetuity. This schemaVersion field is for validation only, and does not change AS3 behavior. Over time, we may add to the schema but it is our intention never to remove or alter existing schema properties.|
+--------------------+----------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| id                 | arbitrary            | This value can be anything less than 255 characters.  You may want use something that can be identifiable by a database, such as a ``urn:uuid`` (for example ``urn:uuid:33045210-3ab8-4636-9b2a-c98d22ab915d``)                                                                                                                                                                                                                                |
+--------------------+----------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| label              | arbitrary            | This value can be anything less than 255 characters and simply labels the declaration.                                                                                                                                                                                                                                                                                                                                                         |
+--------------------+----------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| updateMode         | complete, selective  | Complete means that whatever you include in a declaration is authoritative, and AS3 removes any other tenants (known to AS3) on the BIG-IP. Selective means tenants not referenced in the declaration are not modified.                                                                                                                                                                                                                        |
+--------------------+----------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

Tenant Class
````````````

The highest level class is the tenant, which becomes a partition on the BIG-IP.  Each tenant comprises a set of Applications that belong to one authority (system role).  In the following example, *Sample_01* is the name of the tenant. You can also specify a route domain for this tenant.  A route domain isolates network traffic for a particular application on the network. For information on F5 Route Domains, see the **Route Domains** chapter of the *BIG-IP TMOS: Routing Administration* guide (for example: BIG-IP 13.0 https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/tmos-routing-administration-13-0-0/8.html).


.. code-block:: javascript
   :linenos:
   :lineno-start: 12

    "Sample_01": {
        "class": "Tenant",
        "defaultRouteDomain": 0,

|
|

+--------------------+----------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options              | Description/Notes                                                                                                                                                                                                   |
+====================+======================+=====================================================================================================================================================================================================================+
| class              | Tenant               | The class for tenant must always be Tenant, do not change this value.                                                                                                                                               |
+--------------------+----------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| defaultRouteDomain | number               | The default route domain you want to use for this tenant.  This is an optional parameter.                                                                                                                           |
+--------------------+----------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

.. _appclass:

Application Class
`````````````````

The next level is the Application class, which comprises a set of resources used to manage, secure, and enhance the delivery of a simple or complex network-based application. The basic resources are virtual servers, profiles, iRules, pools, pool members, and monitors.  At a minimum, you must include the application type.  In the following example, **A1** is the name of the application.

If you use template with value of **http**, **https**, **tcp**, **udp**, or **l4**, you MUST specify an object with the matching *Service* class **Service_HTTP**, **Service_HTTPS**, **Service_TCP**, **Service_UDP**, or **Service_L4** and name it **serviceMain** as described in the following Service Class section. The **template** parameter with values of http, https, tcp, udp, and l4 only enforce the associated Service class definition for the application's serviceMain, other default (and optional) settings are set by the Service class.

.. IMPORTANT:: In BIG-IP AS3 3.20 and later, if you do not specify a template, BIG-IP AS3 uses the **generic** template by default.   See :ref:`this FAQ entry <servmain-ref>` for complete information on this change.


.. code-block:: javascript
   :linenos:
   :lineno-start: 15

    "A1": {
        "class": "Application",
        "template": "http",

|
|

+--------------------+---------------------------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options                                     | Description/Notes                                                                                                                                                                                                                                                                             |
+====================+=============================================+===============================================================================================================================================================================================================================================================================================+
| class              | Application                                 | The class for application must always be Application, do not change this value.                                                                                                                                                                                                               |
+--------------------+---------------------------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| template           | http, https, tcp, udp, l4, generic, shared  | These application types help the system determine required objects for a particular application type.  If you use generic, the system does not enforce required objects. :ref:`shared<shared-ref>` holds objects other applications can share. In AS3 3.20+, AS3 uses **generic** by default. |
+--------------------+---------------------------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

.. _service-class:

Service class
`````````````

In the Service class, you specify each service and associated virtual IP address (called a virtual server on the BIG-IP system). Clients use the virtual IP address to access resources behind the BIG-IP system (for more information on virtual servers, see the BIG-IP documentation on support.f5.com).  

If the *template* you specified in the Application class is **http**, **https**, **tcp**, **udp**, or **l4**, you MUST specify an object with the matching *service* class **Service_HTTP**, **Service_HTTPS**, **Service_TCP**, **Service_UDP**, or **Service_L4** and name it **serviceMain**.  You may specify additional objects or services in the same Application without the service class or naming requirements.  The **generic** and **shared** templates have no content requirements.

In BIG-IP AS3 3.20 and later, if you did not specify a template, BIG-IP AS3 uses the **generic** template by default.   See :ref:`this FAQ entry <servmain-ref>` for complete information on this change.

.. TIP:: Click the links in the *Options* column to see the default (and optional) values for each service class.

.. code-block:: javascript
   :linenos:
   :lineno-start: 18

    "serviceMain": {
        "class": "Service_HTTP",
        "virtualAddresses": [
            "10.0.1.10"
        ],
        "pool": "web_pool"
    }



|

+--------------------+--------------------------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options                                                | Description/Notes                                                                                                                                                                                                         |
+====================+========================================================+===========================================================================================================================================================================================================================+
| class              | |http|, |https|, |tcp|, |udp|, |l4|, |generic|         | At least one service class must match the application *template* value (unless you used **shared** or **generic**) you specified. For example, if you used the **http** template, you must specify **Service_HTTP** here. |
+--------------------+--------------------------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| virtualAddresses   | IP Address                                             | The virtual IP address you want clients to use to access resources behind the BIG-IP                                                                                                                                      |
+--------------------+--------------------------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+




Pool class
``````````

BIG-IP Pools contain your servers as well as health monitors and load balancing methods and more.  In the following example, our pool is **web_pool**, it's using the default HTTP health monitor, and includes two servers on port 80.

.. code-block:: javascript
   :linenos:
   :lineno-start: 25

    "web_pool": {
        "class": "Pool",
        "monitors": [
            "http"
        ],
        "members": [
            {
                "servicePort": 80,
                "serverAddresses": [
                    "192.0.1.10",
                    "192.0.1.11"
                ]
            }
        ]
    }



+--------------------+-------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options                       | Description/Notes                                                                                                                                                                                                                                                                                           |
+====================+===============================+=============================================================================================================================================================================================================================================================================================================+
| class              | Pool                          | The class must always be Pool, do not change this value.                                                                                                                                                                                                                                                    |
+--------------------+-------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| monitors           | many                          | Monitor is not a required value, but we recommend using a monitor on your pool.  See :ref:`schema-reference` for options.                                                                                                                                                                                   |
+--------------------+-------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| members            | servicePort, serverAddresses  | Members are your servers behind the BIG-IP.  For serverAddresses, specify each of the servers that should be a member of this pool.  You can optionally specify a unique servicePort, if you do not, the system uses a default based on the template you are using (i.e. http template defaults to port 80).|
+--------------------+-------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

| 

.. TIP:: To remove a pool member from service, you can use the *Pool_Member* parameter **adminState**.  By default, the adminState is **enable**, but you can use **disable** to disallow new connections but allow existing connections to drain, or **offline** to force immediate termination of all connections. You must have a separate *ServiceAddress* block for each pool member on which you want to use this parameter. Alternatively, you can just remove the pool member and re-POST the declaration.  


See :doc:`examples` to see the default values BIG-IP AS3 uses behind the scenes, and the Reference section for a list of all possible parameters you can use in your declarations.




.. |http| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-http" target="_blank">Service_HTTP</a>

.. |https| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-https" target="_blank">Service_HTTPS</a>

.. |tcp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-tcp" target="_blank">Service_TCP</a>

.. |udp| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-udp" target="_blank">Service_UDP</a>

.. |l4| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-l4" target="_blank">Service_L4</a>

.. |generic| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#service-generic" target="_blank">Service_Generic</a>

Quick Start
===========

If you are familiar with the BIG-IP system, and generally familiar with REST and
using APIs, this section contains the minimum amount of information to get you
up and running with BIG-IP AS3.

If you are not familiar with the BIG-IP and REST APIs, or want more detailed instructions, continue with :doc:`best-practices`.

#. Download the latest RPM package from |github|.
#. Upload and install the RPM package on the using the BIG-IP GUI:

   - :guilabel:`Main tab > iApps > Package Management LX > Import`
   - Select the downloaded file and click :guilabel:`Upload`
   - For complete instructions see :ref:`installgui-ref` or
     :ref:`installcurl-ref`.

#. Be sure to see the known issues on GitHub (https://github.com/F5Networks/f5-appsvcs-extension/issues)  and :doc:`tips-warnings` pages to review any known issues and other important information before you attempt to use BIG-IP AS3.

#. Provide authorization (basic auth) to the BIG-IP system:  

   - If using a RESTful API client like Postman, in the :guilabel:`Authorization` tab, type the user name and password for a BIG-IP user account with Administrator permissions.
   - If using cURL, see :ref:`installcurl-ref`.

#. Copy one of the :ref:`examples` which best matches the configuration you want
   to use.  Alternatively, you can use the simple "Hello World" example below,
   which is a good start if you don't have an example in mind.

#. Paste the declaration into your API client, and modify names and IP addresses
   as applicable.  See :ref:`schema-reference` for additional options you can
   declare.

#. POST to the URI ``https://<BIG-IP>/mgmt/shared/appsvcs/declare``

Quick start example declaration
-------------------------------

.. IMPORTANT:: This Quick Start example, and most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.


.. code-block:: json
   :linenos:

    {
        "class": "AS3",
        "action": "deploy",
        "persist": true,
        "declaration": {
            "class": "ADC",
            "schemaVersion": "3.0.0",
            "id": "urn:uuid:33045210-3ab8-4636-9b2a-c98d22ab915d",
            "label": "Sample 1",
            "remark": "Simple HTTP Service with Round-Robin Load Balancing",
            "Sample_01": {
                "class": "Tenant",
                "A1": {
                    "class": "Application",
                    "service": {
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
                }
            }
        }
    }


.. |github| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">F5 BIG-IP AS3 Releases GitHub</a>

.. |br| raw:: html

   <br />
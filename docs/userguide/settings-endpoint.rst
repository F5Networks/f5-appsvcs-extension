Settings Endpoint
=================
With the /settings endpoint, certain BIG-IP AS3 system-wide settings are saved in persistent storage on the BIG-IP device. This means the settings apply to all future declarations, unless the settings are modified again. The **/settings** endpoint enables the configuration of these system-wide settings, such as enabling or disabling Service Discovery.

To use the **/settings** endpoint, you can send a POST or GET request to ``HTTPS://<BIG-IP IP address>/mgmt/shared/appsvcs/settings``.

- **Check current settings** |br| Using a GET request returns the current configuration settings and their values. |br| To check the current setting status, send a GET request to ``HTTPS://<BIG-IP IP address>/mgmt/shared/appsvcs/settings``. When the request is successful, you will receive a response like:

  .. code-block:: json
      
       {
          "asyncTaskStorage": "data-group",
          "burstHandlingEnabled": false,
          "performanceTracingEnabled": false,
          "performanceTracingEndpoint": "",
          "serviceDiscoveryEnabled": true
       }


- **Change current settings** |br| Using a POST request allows you to change the current settings by sending a declaration with updated settings in the request body. |br| To change a current setting, send a POST request to ``HTTPS://<BIG-IP IP address>/mgmt/shared/appsvcs/settings``.  For example, to enable burst handling, POST the following declaration body: 

  .. code-block:: json

       {
           "burstHandlingEnabled": true
       }


BIG-IP AS3 should now be running with the burst handling feature enabled.

 
Available options for the settings endpoint
-------------------------------------------
The **/settings** endpoint supports the following (see |apiset| in the API Reference for more information (click to expand **body** on that page)):

- **asyncTaskStorage** |br| Controls where asynchronous tasks are stored. Existing tasks are not transferred when the storage type is changed. Storing tasks in a data group persists the data between restarts, but puts more pressure on the control plane.  Options are **data-group** (default) and **memory**.

- **burstHandlingEnabled** |br| A boolean that controls if BIG-IP AS3 on this BIG-IP system uses the Burst Handling feature (the default is **false**). See :ref:`Burst Handling<burst>` for more information.

- **performanceTracingEnabled** |br| A boolean that controls if BIG-IP AS3 records performance information (the default is **false**). Jaeger client must be installed to enable this property. 

- **performanceTracingEndpoint** |br| Remote endpoint to which performance tracing will send data.

- **serviceDiscoveryEnabled** |br| A boolean that controls if Service Discovery features are enabled (the default is **false**).  See :ref:`Service Discovery examples<sd-examples>`.

- **webhook** |br| *Requires BIG-IP AS3 3.45 or later* - URL to post results to. 

- **serializeFileUploads** |br| *Requires BIG-IP AS3 3.47 or later* - When uploading files to the BIG-IP, this setting enables uploading in serial rather than parallel. See the following section for more information.

- **perAppDeploymentAllowed** |br| *Requires BIG-IP AS3 3.50 or later* - This setting controls whether per-application deployments are allowed or not. See :doc:`per-app-declarations` for more information.

- **encodeDeclarationMetadata** |br| *Requires BIG-IP AS3 3.53 or later* - A boolean parameter that manages the encoding of tenant metadata, with encoding disabled by default. See :ref:`enable-encodeDecl` for more information.


.. _serialize:

Using serializeFileUploads to upload a large number of certificates
-------------------------------------------------------------------
You can use the **serializeFileUploads** setting when you have a large number of files, like SSL/TLS certificates, you need to upload to the BIG-IP system using AS3. 

Use this setting if you are receiving a **Too many open files** error in restjavad when attempting to upload a very large number of files.

In addition to setting **serializeFileUploads** to **true** on the /settings endpoint, we recommend the following:

- Increase the timeouts in the following DB variables. F5 recommends setting these variables to 600.  See :ref:`Best Practices<restapi>` for information on increasing these timeouts. 

  - icrd.timeout
  - restnoded.timeout
  - restjavad.timeout

- Increase memory using these DB variables (see :ref:`Best Practices<restjavadmem>` for information). Note that these variables have changed for some versions of BIG-IP, see `K000133258: Sys DB restjavad.useextramb has been removed after upgrade <https://my.f5.com/manage/s/article/K000133258>`_.

  - provision.extramb
  - restjavad.useextramb

- Do not use the **trace** property in the Controls class
- Use the settings endpoint to set **asyncTaskStorage** to **memory**
- Use async requests (use the query parameter **?async=true**. See the |api| for information on the POST query parameters).


.. |br| raw:: html

   <br />

.. |apiset| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/apidocs.html#tag/Settings" target="_blank">Settings</a>

.. |api| raw:: html

   <a href="../refguide/apidocs.html" target="_blank">API documentation</a>
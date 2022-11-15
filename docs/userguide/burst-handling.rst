.. _burst:

Burst handling
--------------
BIG-IP AS3 v3.23 added support for *burst handling*.  The purpose of burst handling is to manage scenarios where multiple declaration requests are sent to BIG-IP AS3 at the same time (a burst).

Without burst handling, when sending multiple declarations to BIG-IP AS3 simultaneously, it rejects the subsequent requests with a *503 - Service Unavailable* error and a message stating "Error: Configuration operation in progress on device, please try again in 2 minutes."

With burst handling, BIG-IP AS3 processes each declaration one at a time, after the previous request has been completed. This feature queues almost any type of request (DELETE, POST, PATCH) if BIG-IP AS3 is currently busy processing another request. GET requests are the only requests that are designed to bypass the burst handling feature and get the current state of the machine at the moment they are sent; they do not have to go into the queue and wait to be processed along with the other requests.

| 

There are different ways of enabling burst handling and important notes, depending on which version of BIG-IP AS3 you are using.

Burst handling in BIG-IP AS3 v3.23 and later
````````````````````````````````````````````
Burst handling is supported in BIG-IP AS3 3.23 and later. For additional information on how this feature works on BIG-IQ, please see `K81523756 <https://support.f5.com/csp/article/K81523756>`_.

To enable burst handling, POST a simple declaration to the **mgmt/shared/appsvcs/settings** endpoint:

.. code-block:: json

    {
        "burstHandlingEnabled": true
    }

BIG-IP AS3 should now be running with the burst handling feature enabled.

To check the current setting status, submit a GET request to that same endpoint.

.. NOTE:: The burst handling queue has a limit of 10.


Enabling burst handling in BIG-IP AS3 v3.19 - 3.22
``````````````````````````````````````````````````
Burst handling is EXPERIMENTAL in BIG-IP AS3 3.19 - 3.22.

When using a version of BIG-IP AS3 between 3.19 and 3.22, you must modify the BIG-IP AS3 file **/var/config/rest/iapps/f5-appsvcs/lib/config.js** on the BIG-IP and change the line ``"burstHandling: false"`` to ``"burstHandling: true"``.

Once you have modified and saved the file, you need to restart BIG-IP AS3 by restarting restnoded with the command ``bigstart restart restnoded``. 

BIG-IP AS3 should now be running with the burst handling feature enabled.

In versions prior to 3.23, there are a few caveats for using burst handling (we strongly recommend upgrading BIG-IP AS3 to 3.23).

In BIG-IP AS3 versions 3.19 - 3.22:

1.	Querying the **/task** endpoint can partially clear queued request records, resulting in an error when the queued request is processed. It is best to avoid querying this endpoint if you have more than 20 requests waiting to be processed.
2.	The burst handling queue has no limit, so if you accidentally fill it with 1000s of requests, you can restart BIG-IP AS3 by restarting the restnoded service (as shown below) and the queued requests will be cleared and not processed.

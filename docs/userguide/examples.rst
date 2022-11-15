.. _examples:

Example declarations
====================

The following examples show you some BIG-IP AS3 declarations and the BIG-IP LTM objects
they create.  

For many more example declarations, see :ref:`additional-examples` (you can also see all BIG-IP AS3 properties in one declaration in :ref:`all-properties`).

If you missed it, we recommend you first read :doc:`composing-a-declaration` for a
breakdown of some of the components of a declaration.

**Note:** If you do not specify certain parameters in your declaration, the
system supplies default values. For example, if you do not specify a persistence
method (or specify *none*), the system uses Cookie persistence by default.

.. IMPORTANT:: Most of the example declarations have been updated in the documentation for BIG-IP AS3 3.20 to remove any **template** that was specified, and rename any virtual services that used the name **serviceMain** to **service**. In BIG-IP AS3 3.20, the **generic** template is the default, which allows services to use any name.  |br| |br| This also means that many of these declarations on a version prior to 3.20 they will fail unless you add a template.  See :ref:`this FAQ entry <servmain-ref>` and :ref:`this Troubleshooting entry<exampleupdates>` for more information.


Example 1: Simple HTTP application
----------------------------------
Example 1 is the same declaration as in the Composing the Declaration section,
though here you can see the system-supplied default values in the second code
block.  This example creates the following objects on the BIG-IP:

- Partition (tenant) named ``Sample_01``.
- Virtual server (HTTP) named ``service``.
- Pool named ``web_pool`` with 2 members monitored by the default *HTTP* health
  monitor.

.. literalinclude:: ../../examples/userguide/example-simple-http-application.json
   :language: json

This declaration creates a virtual server and a pool.  But if you are familiar
with creating objects on the BIG-IP system you know there are properties
required that are not included in our declaration.  As part of the validation
process, BIG-IP AS3 includes defaults for required values if they are not specified
in the declaration.  For example, the following is the declaration after the
system adds the defaults (you can see these defaults by POSTing to
**/mgmt/shared/appsvcs/declare?show=full** or using GET with ?show=full).

.. literalinclude:: ../../examples/userguide/example-simple-http-application-full.json
   :emphasize-lines: 28-42, 55-62, 64-69, 71, 73-74, 76-81
   :language: json

:ref:`Back to top<examples>`

Example 2: HTTPS application
----------------------------
In this example, the declaration results in the configuration for an HTTPS
application.  It creates the following objects on the BIG-IP:

- Partition (tenant) named ``Sample_02``.
- Virtual server (HTTPS) named ``service``.
- TLS/SSL profile (including certificate and private key) named ``TLS_Server``.  In
  the BIG-IP UI, this is a Client SSL profile.
- Pool named ``web_pool`` using the predictive (node) load balancing method, with 2
  members monitored by the default *HTTP* health monitor.

.. literalinclude:: ../../examples/userguide/example-https-application.json
   :language: json

The following is the declaration after the system adds the defaults (the result of
POSTing with ``?show=full``).

.. literalinclude:: ../../examples/userguide/example-https-application-full.json
   :emphasize-lines: 28-44, 58-65, 67-71, 78-81, 91-93, 96, 98-99, 101-106
   :language: json

:ref:`Back to top<examples>`

Example 3: TCP virtual server to ICAP with custom monitor
---------------------------------------------------------
In this example, we show a declaration that creates a TCP virtual server.  This
virtual server contains a custom health monitor for ICAP.

This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_03**.
- A TCP virtual server named **service** on port 1344.
- A TCP profile using the mptcp-mobile-optimized parent.
- A pool named **svc_pool** containing two members (also using port 1344).
- A custom TCP health monitor with custom Send and Receive strings for ICAP.

.. literalinclude:: ../../examples/userguide/example-tcp-virtual-server-to-icap-with-custom-monitor.json
   :language: json

The following is the declaration after the system adds the defaults.

.. literalinclude:: ../../examples/userguide/example-tcp-virtual-server-to-icap-with-custom-monitor-full.json
   :emphasize-lines: 28-41, 54-61, 63-68, 76-90, 92, 94-95, 97-101
   :language: json

:ref:`Back to top<examples>`


Example 4: Calling resources from a URL source
----------------------------------------------

In this example, we show how BIG-IP AS3 can fetch an external resource value from a URL using
HTTP or HTTPS.  This is useful if you have a bulky configuration resource (such as an F5
WAF security policy (see :ref:`WAF Policy <asmex>`) or an iRule); you can store the resource on a
webserver under your control, then include a URL reference to it in the declaration.  In
this example, our declaration includes an "under maintenance" iRule from a URL
source.  In this example, we also set the historyLimit, which sets the number of
previously-deployed declarations BIG-IP AS3 saves for review using GET (for example using
**?age=list**) and for use with POST *action* **redeploy** and **redeployAge=N.**

.. TIP:: BIG-IP AS3 3.28 adds the ability to retrieve data from a URL that is using bearer token authentication (see :ref:`Bearer Token Auth<tokenauth>`).

This example creates the following objects on the BIG-IP:

- Partition (tenant) named **Sample_04**.
- A HTTP virtual server named **service**, which includes the iRule pulled from an external location.
- A TCP profile using the mptcp-mobile-optimized parent.
- A pool named **web_pool** containing two members.

.. literalinclude:: ../../examples/userguide/example-calling-resources-from-url-source.json
   :language: json

The following is the declaration after the system adds the defaults.  In this example,
we use the GET method with **?show=expanded**, to show the contents of the iRule that
BIG-IP AS3 retrieved.

.. literalinclude:: ../../examples/userguide/example-calling-resources-from-url-source-full.json
   :emphasize-lines: 21-35, 48-55, 57-62, 67, 69, 71-72, 74-78, 80
   :language: json

|
|

Example 4a: Using PATCH to add a new server to the pool
-------------------------------------------------------

Now we use the PATCH method to add a new server address to the load balancing pool we
created using the previous declaration, without having to resend the entire
declaration.  For more information on PATCH, see :doc:`http-methods`.  |br|

In this example, we are adding a single IP address to the **web_pool** we sent in the
previous declaration.  When using PATCH, using the proper path is extremely important,
and you must specify the location in an array where necessary.  In the following, we
use a dash at the end of the path, which means the system adds the new server to the
end of the array (you can also use a number beginning with 0 to specify a specific
location in the array). Members is also an array, so even though there is only one
object in our array, we must use **/0/** to specify this first object.

If necessary, review the declaration in Example 4 (or first use
``GET https://<BIG-IP>/mgmt/shared/appsvcs/declare/TenantA``).

Then use ``PATCH https://<BIG-IP>/mgmt/shared/appsvcs/declare`` with the following body:

.. literalinclude:: ../../examples/userguide/example-add-new-server-to-pool-via-patch.json
   :language: json

After submitting this PATCH, the system returns the following (new server address highlighted):

.. literalinclude:: ../../examples/userguide/example-add-new-server-to-pool-via-patch-full.json
   :language: json
   :emphasize-lines: 36

Again, see :ref:`additional-examples` for more example declarations.

:ref:`Back to top<examples>`

.. |br| raw:: html

   <br />

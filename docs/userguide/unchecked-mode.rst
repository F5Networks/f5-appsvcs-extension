.. _unchecked:

Unchecked mode
==============
BIG-IP AS3 3.26 added Unchecked mode (experimental in 3.26-3.30, supported in 3.31).  Unchecked mode means that BIG-IP AS3 does not check the current BIG-IP state, and assumes the state matches the previous declaration. BIG-IP AS3 has complete and sole control over the configuration of a tenant it is managing.  

This can lead to improved performance when updating large configurations, because BIG-IP AS3 does not have to send a large number of requests to iControl REST endpoints, and the number of requests being sent across the network from BIG-IP AS3 to the BIG-IP is reduced.

.. IMPORTANT:: Be sure to see the following section about the risks associated with Unchecked mode.

Risks with using Unchecked mode
-------------------------------
Because BIG-IP AS3 does not check the current BIG-IP state, there are potential risks with using Unchecked mode.

The main issue you may experience using unchecked mode is that your BIG-IP AS3 declarations can fail if someone makes changes to the BIG-IP configuration without using BIG-IP AS3.  For example, if you create a virtual server using TMSH or the BIG-IP Configuration utility, BIG-IP AS3 would not know this virtual server exists. If you try to POST a declaration with BIG-IP AS3 in Unchecked mode that includes an update to this virtual server, the declaration will fail.  This is because BIG-IP AS3 in Unchecked mode is unaware of the virtual server and tries to create it, and the declaration fails because it already exists. If BIG-IP AS3 was running in its normal/default mode, it would recognize the virtual server based on the current BIG-IP config, and would correctly modify the virtual server as intended. 

Similarly, BIG-IP AS3 in Unchecked mode cannot delete objects it did not create. If you create an object on the BIG-IP without BIG-IP AS3, and then try to delete it using BIG-IP AS3, the object would not be deleted because BIG-IP AS3 does not know it existed in the first place. This could occur when trying to delete individual objects, and can be compounded when trying to delete an entire tenant an object resides in. BIG-IP AS3 in Unchecked mode would attempt to delete the tenant and folder structure, but the declaration would fail because the BIG-IP still has objects in the tenant that it cannot delete because it is unaware of them.



Using Unchecked mode
--------------------
To enable unchecked mode, POST a declaration using the following query parameter: **?unchecked="true"**.  

For example, ``https://192.0.2.35/mgmt/shared/appsvcs/declare?unchecked=true``.


Example of Unchecked mode
-------------------------
For a simple example of Unchecked mode, use the following procedure.

1. POST a declaration using Unchecked mode, such as :ref:`this basic HTTP example declaration<simplehttp>` from the User Guide.

   - When you first POST the declaration, BIG-IP AS3 compares the declaration to any previous declarations, and determines it needs to create the HTTP application.

2. Now, modify the **serverAddresses** value in the declaration to some other IP address.

3. POST the declaration again using Unchecked mode.

   - This time, BIG-IP AS3 compares the current declaration to the one you first posted, and recognizes it needs to update the server address.  It does not have to query the BIG-IP for its current configuration, because it assumes the BIG-IP state matches the previous declaration.


While you may not notice significant performance improvement in this simple example, if the declaration contained hundreds or thousands of objects, the performance improvement is clear.


.. |br| raw:: html

   <br />

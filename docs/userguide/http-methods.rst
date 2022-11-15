.. _httpmethods:

HTTP Methods
------------
This section contains the current HTTP methods available with BIG-IP AS3. For detailed information on each option, click the link at the end of the paragraph.

POST
~~~~
To send your declaration to BIG-IP AS3, use the POST method to the URI
``https://<BIG-IP>/mgmt/shared/appsvcs/declare`` and put your declaration in the
body of the post (after :doc:`authentication <authentication>`).  If successful, you see a success message, and the system
echoes your declaration back to you.  In addition to deploying a declaration,
POST supports more actions, like reporting a previous declaration (useful with
remote targets since GET may only have localhost credentials) or returning the
index of saved declarations.  For more information and usage options (including detailed information on actions), see :ref:`post-ref`

GET
~~~
You can use the GET method to retrieve the declarations you previously sent to
BIG-IP AS3. Use the GET method to the URI
``https://<BIG-IP>/mgmt/shared/appsvcs/declare``.  Only declarations you create
in BIG-IP AS3 return, GET does not return anything that was not created by BIG-IP AS3.
For more information and usage options, see :ref:`get-ref`, including changes in 3.10.0 for the /task endpoint.

DELETE
~~~~~~
You can use the DELETE method to remove declarations you previously posted.  To
delete all tenants you created with BIG-IP AS3, use the DELETE method to the URI
``https://<BIG-IP>/mgmt/shared/appsvcs/declare``.  To delete individual tenants,
use the DELETE method to the URI
``https://<BIG-IP>/mgmt/shared/appsvcs/declare/<tenant name>``. For more
information and usage options, see :ref:`delete-ref`


PATCH
~~~~~
You can use the PATCH method to modify the configuration produced by a previously-sent declaration without having to resend the entire declaration.  For information on PATCH, see https://datatracker.ietf.org/doc/html/rfc6902 (BIG-IP AS3 does not support the **test** operation object).  |br|
Use the PATCH method to the URI ``https://<BIG-IP>/mgmt/shared/appsvcs/declare``.   |br| In the request body, use the following example syntax (see the PATCH operation objects table for examples), as some operations include *from* and do not include *value*, for details be sure to see :ref:`patch-ref` |br|  

.. code-block:: json

   [
       {
           "op": "<operation object>", 
           "path": "<path with JSON pointer>",
           "value": "<value to assign to object in the path>"
        }
    ] 

|br|

For example, to add a server address: |br|

.. code-block:: json

   [
       {
           "op": "add", 
           "path": "/tenant1/app1/pool1/members/0/serverAddresses/3",
           "value": "10.1.2.3"
        }
    ] 


The result?  For a tenant named **tenant1**, within an application named **app1**, for the member of **pool1** (at index 0), this adds a new server IP address with a value of **10.1.2.3**. (as the 4th entry in the **serverAddress** array; use a **-** (dash) in place of a number if order in the array isn't important). |br| 
For more information and usage options (including detailed information on acceptable operation objects), see :ref:`patch-ref`



.. |br| raw:: html
   
   <br />


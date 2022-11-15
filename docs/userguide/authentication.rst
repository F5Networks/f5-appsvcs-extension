Authentication and Authorization
--------------------------------

Authorization to invoke BIG-IP AS3 includes authorization to GET declarations stored in
BIG-IP AS3.

Authorization to deploy a declaration to localhost (which means changing a
BIG-IP configuration) gets subsumed into authorization to invoke BIG-IP AS3.  That is,
if you have administrator credentials for a BIG-IP running BIG-IP AS3 you can use BIG-IP AS3
to configure that BIG-IP.

To deploy a declaration to some other target BIG-IP (not localhost) you must
supply BIG-IP AS3 with some credential (an access token or a name-and-passphrase
combination) BIG-IP AS3 can use to authenticate to the target.  The role
associated with that credential must have authorization to modify the target's
configuration.

Currently, there is no way to supply credentials for targets other than
localhost with GET or DELETE requests, so you may issue POST requests with a
suitable "action" values instead.

Because BIG-IP AS3 is an iControl LX extension, you can authenticate by including one of the following **header** values in your HTTP requests.

Basic Auth
~~~~~~~~~~

To use Basic authentication, add a new request header:  ``Authorization: Basic {Base64encoded value of username:password}``. 
(If using a RESTful API client like Postman, in the :guilabel:`Authorization` tab, type the user name and password for a BIG-IP user account with Administrator permissions, which automatically adds the encoded header.)

.. _token-ref:

Token Auth
~~~~~~~~~~

To use Token Authentication, add a new request header:  ``X-F5-Auth-Token: {tokenValue}``


If you need to create a new token, use the following syntax:

.. code-block:: bash

   
        POST /mgmt/shared/authn/login 
        Host: {{bigip_host}}
        Authorization: Basic {Base64encoded value of username:password}
        Content-Type: application/json
        {
            "username":"{userWithCorrectPerms}",
            "password":"{userPassword}",
            "loginProviderName":"tmos"
        }


By default, the token has an expiration time of 1200 seconds.  To extend this time, use the following syntax:

.. code-block:: bash

   
        PATCH /mgmt/shared/authz/tokens/{{bigip_auth_token}}
        Host: {{bigip_host}}
        Content-Type: application/json
        X-F5-Auth-Token: {{bigip_auth_token}}
        {
            "timeout":"36000" //this is the maximum
        }



For requests that perform the BIG-IP AS3 operation on a remote target BIG-IP
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

You can use either the Basic Auth Header or X-F5-Auth-Token for the request on the local BIG-IP. 

Then, the POST body then must contain one of the following:

If using basic auth:

.. code-block:: json

    {
        "class":"AS3",
        "action": "retrieve",
        "targetUsername": "{userWithCorrectPerms}",
        "targetPassphrase": "{userPassword}",
        "targetHost": "{{remote_bigip_host}}"
    }


If using a token:

.. code-block:: json

    {
        "class":"AS3",
        "action": "retrieve",
        "targetHost": "{{remote_bigip_host}}",
        "targetTokens": {
        "X-F5-Auth-Token": "{{bigip_auth_token}}"
        }
    }
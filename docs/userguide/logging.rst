Logging
-------
BIG-IP AS3 logs to **/var/log/restnoded/restnoded.log** using f5-logger from the framework.  BIG-IP AS3 supports multiple log levels.  The log entries contain a JSON block for easy search & reporting by external tools.  

Example log entry

.. code-block:: bash

  Mon, 25 Dec 2017 08:55:00 GMT - fine: [f5-appsvcs] {"message":"script completed","data":{"kind":"tm:cli:script:runstate","command":"run","name":"f5-appsvcs"}}
  Mon, 25 Dec 2017 08:55:00 GMT - severe: [f5-appsvcs] {"message":"declaration failed","data":"01020036:3: The requested node (/appsvcs_test_basic_ltm/1.0.113.10) was not found."}


For audit logs in **/var/log/audit**, no matter your BIG-IP user account name, audit logs show all messages from **admin** and not the specific user name.
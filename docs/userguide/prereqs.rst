.. _prereqs:

Prerequisites and Requirements
------------------------------

The following are prerequisites for using BIG-IP AS3:


- You must be using BIG-IP version 12.1.x (if using BIG-IP AS3 v3.1.0 through v3.26.1) or v13.1 or later to use BIG-IP AS3.
  BIG-IP AS3 is not intended to work on BIG-IP versions that have reached End of Life.
  See `here <https://support.f5.com/csp/article/K5903>`_ for more information about BIG-IP versions supported by F5.
.. IMPORTANT:: Starting from BIG-IP AS3 version 3.50.0, BIG-IP AS3 no longer supports BIG-IP 13.1 to 14.1.x. However, if you are still using the BIG-IP 13.1 to 14.1.x versions, you can use BIG-IP AS3 3.49.0 or earlier.
- To use BIG-IP AS3, your BIG-IP user account must have the **Administrator**
  role.
- You should be familiar with the F5 BIG-IP and F5 terminology.  For
  general information and documentation on the BIG-IP system, see the
  `F5 Knowledge Center <https://support.f5.com/csp/knowledge-center/software/BIG-IP?module=BIG-IP%20LTM&version=13.1.0>`_.
- You must manually :ref:`install BIG-IP AS3 <installation>` before the BIG-IP AS3 RESTful API is available.

- Disable the **Expect: 100 Continue** feature commonly used with SOAP + XML APIs.  When using cURL, add the option  **-H 'Expect:'**  to your cURL command line (no space after the colon at the end of 'Expect:').  For specific information, refer to the instructions from your client libraries.

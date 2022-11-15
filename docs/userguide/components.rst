Components
----------
The following are the main components of BIG-IP AS3.

BIG-IP AS3 Declaration
~~~~~~~~~~~~~~~~~~~~~~

a BIG-IP AS3 declaration describes the desired configuration of an Application
Delivery Controller (ADC) such as F5 BIG-IP in tenant- and application-oriented
terms. a BIG-IP AS3 tenant comprises a collection of BIG-IP AS3 applications and related
resources responsive to a particular authority (the BIG-IP AS3 tenant becomes a
partition on the BIG-IP system). a BIG-IP AS3 application comprises a collection of
ADC resources relating to a particular network-based business application or
system. BIG-IP AS3 declarations may also include resources shared by Applications in
one Tenant or all Tenants as well as auxiliary resources of different kinds. BIG-IP AS3
processes declarations on a tenant-by-tenant basis, so a declaration containing
configuration for Tenant1 does not affect Tenant2.
For detailed information on BIG-IP AS3 declarations, see :ref:`declaration-purpose-function`.

For example declarations, see :doc:`examples` and :ref:`additional-examples`.

BIG-IP AS3 JSON Schema
~~~~~~~~~~~~~~~~~~~~~~

The |json| schema validates the declaration, and then produces a BIG-IP
configuration.  The JSON Schema document prescribes the syntax of a BIG-IP AS3
declaration. The BIG-IP AS3 declaration schema controls which
objects may appear in a declaration, what name they may or must use, what
properties they may have, which of those you must supply in the declaration, and
which BIG-IP AS3 may fill with default values. The schema also specifies the ranges of
values certain properties may take.  For detailed information on the BIG-IP AS3 schema,
see :ref:`understanding-the-json-schema`.

BIG-IP AS3 contains two modules: a |rest| worker and an audit engine.  The REST worker
provides a |crud| interface for creating and modifying the declaration document.
The audit engine is responsible for aligning BIG-IP configuration with the
declaration document.

Declaration > Schema > Validation > Configuration 

.. image:: /images/BIG-IP AS3-data-flow.png

.. |json| raw:: html

   <a href="https://www.json.org/" target="_blank">JSON</a>

.. |rest| raw:: html

   <a href="https://en.wikipedia.org/wiki/Representational_state_transfer" target="_blank">REST</a>

.. |crud| raw:: html

   <a href="https://en.wikipedia.org/wiki/Create,_read,_update_and_delete" target="_blank">CRUD</a>

BIG-IP AS3 Frequently Asked Questions (FAQ)
-------------------------------------------


**What is BIG-IP AS3?**

See the |intro| for a description of BIG-IP AS3.  This entry contains information on what BIG-IP AS3 is and what it is not.

*BIG-IP AS3 is:*

-  A javascript |ilx| plug-in
-  For configuration of Layer 4-7 Application and Security Services
-  A |declare| interface for |apps| on BIG-IP
-  |idempotent|
-  |support| (see |supportmd| for supported BIG-IP AS3 versions)
-  |atomic| (BIG-IP AS3 declarations)
-  Able to support |multi|
-  Able to support |rd| association with any IP address according to traditional
   BIG-IP syntax, for example ``10.10.10.10%2``

*BUT... it is:*

-  **not** used to on-board or license a BIG-IP device (for onboarding, see |do|)
-  **not** intended for configuring Route Domains, Routes, Self IPs, VLANs, or other Layer 2/3 objects or components
-  **not** a mechanism to provide differential authorization or RBAC
-  **not** an iApp, nor does it configure iApps
-  **not** created to include a graphical interface (see |fast|)
-  **not** a replacement for iWorkflow

|

.. _version13:

**Which TMOS versions does BIG-IP AS3 support?**

BIG-IP AS3 supports TMOS versions 13.x and later (BIG-IP AS3 3.26 was the last version to support 12.1.x).

|

**When is BIG-IP AS3 a good fit and when it is not?**

*BIG-IP AS3 is a good fit where:*
- You require a declarative interface to abstract away the complexity of BIG-IP configuration.
- BIG-IP capabilities focus on LTM, GTM, and Security Policy attachment.
- Organizations need to deploy BIG-IP configs as Infrastructure as Code (IaC) via integration with DevOps pipelines.

*BIG-IP AS3 may not be a good fit where:*
- Declarative interface is not desirable
- Organization is unwilling or unable to deploy iControl Extension RPM on BIG-IP
- Organization wants to continue using imperative interfaces (GUI, TMSH, iControl REST APIs) to configure BIG-IP (not just monitor or troubleshoot).

|

**Why did F5 create iControl LX and BIG-IP AS3 when there are already TCL iApps?**

- TCL iApps are a great solution for templatizing and simplifying specific application service.
- Each TCL iApp focuses on the delivery of a single application service.
- iControl LX gives new flexibility and capabilities not available in traditional TCL iApps.
- iControl LX / iApps LX enables users to do everything they can do with TCL iApps and much more.
- iControl LX enables users to deliver BIG-IP AS3 which provides a single declarative interface to enable a wide variety of BIG-IP configurations, not just a single application service.
- iControl LX enables users to harness the power and flexibility of Node.js to enable new capabilities, 3rd-party integrations, and support DevOps pipelines.

|

**How is BIG-IP AS3 different from Ansible?**

- Ansible is part of a large vendor ecosystem to manage & automate configuration of multiple platform types within the data center.
- Ansible automates via imperative YAML playbooks which require knowledge of which BIG-IP modules need to run and in which order.
- Ansible is great for templatizing BIG-IP configuration tasks via Playbooks and Roles.
- F5 is dependent on Ansible release schedules, whereas F5 controls BIG-IP AS3 release schedule, allowing for a more aggressive release cadence.
- Note: You can use Ansible as a front-end to BIG-IP AS3's declarative API.

|

**How do I get started with BIG-IP AS3?**

See the :doc:`quick-start` to jump right into using BIG-IP AS3.

|

**What is an "BIG-IP AS3 Declaration"?**

For detailed information on BIG-IP AS3 Declarations, see :ref:`declaration-purpose-function`.

- BIG-IP AS3 uses a declarative model, meaning you provide a JSON declaration rather than a set of imperative commands.
- The declaration represents the configuration which BIG-IP AS3 is responsible for creating on a BIG-IP system.
- You do not need to sequence the declaration in a specific order; BIG-IP AS3 will figure out the steps and order of operations for you, making it declarative.
- BIG-IP AS3 is well-defined according to the rules of the JSON Schema, and validates declarations according to the JSON Schema.

|

**What is the BIG-IP AS3 Schema?**

For detailed information on the BIG-IP AS3 Schema, see :ref:`understanding-the-json-schema`.

Briefly:

- The JSON Schema document prescribes the syntax of a BIG-IP AS3 declaration.
- The BIG-IP AS3 declaration schema controls what objects may appear in a declaration, what name they may or must use, what properties they may have, which of those you must supply in the declaration, and which BIG-IP AS3 may fill with default values.
- The schema also specifies the ranges of values which certain properties may take on.

|

.. _servmain-ref:

**Do all of my application services need to be named "ServiceMain"?  UPDATED FOR BIG-IP AS3 3.20**

As of BIG-IP AS3 3.20, if you do not specify a **template** in the :ref:`appclass`, BIG-IP AS3 uses the **generic** template by default. The generic template does not have or enforce any content requirements, so there is no requirement for naming the virtual service **serviceMain**. When using the generic template (either explicitly or by default in 3.20+) you can still use the Class property in the :ref:`Service Class<service-class>` to specify a specific service, such as Service_HTTP or Service_TCP.

In versions prior to 3.20, you can still manually specify the **generic** template to avoid the serviceMain naming requirement. If you do use one of the templates other than **generic** or **shared** (http, https, tcp, udp, l4), for each application service in a tenant you must use the name **serviceMain** for your application service.

.. NOTE:: All of the :ref:`example declarations <additional-examples>` have been updated to remove any **template**, and the virtual service names have been changed to **service**, although you can change this name to suit your configuration. If you attempt to use one of these examples on a version *prior* to 3.20, they will fail.

See :ref:`this Troubleshooting entry<exampleupdates>` for more information and workarounds.

|

**What is the delivery cadence for BIG-IP AS3?**

BIG-IP AS3 is targeted for a 6-week release cycle.

|

**How do I manage "source of truth" with BIG-IP AS3?**

- When you use BIG-IP AS3, the source of truth is the BIG-IP AS3 declaration; **the source of truth is no longer on BIG-IP**
- If you use BIG-IP AS3 to create an app service, you must ALWAYS use BIG-IP AS3 to manage it through its app lifecycle
- When using BIG-IP AS3, do not edit or update your app services configurations outside of BIG-IP AS3 (e.g. via GUI, CLI, iControl REST, TCL iApp)
- The intent of BIG-IP AS3 is to be an orchestration tool where the orchestration system manages the source of truth (e.g. managing declarations in GitHub).

|

**Is there a migration path for BIG-IP AS3 releases?**

F5 intends to ensure all BIG-IP AS3 releases schemas/APIs are backwards compatible, so we recommend migrating to the newest supported version of BIG-IP AS3. Because F5 guarantees BIG-IP AS3 schema backwards-compatibility, upgrades to newer versions of BIG-IP AS3 should be seamless.

|

.. _upgrade-ref:

**What if I upgrade my BIG-IP system, how to I migrate my BIG-IP AS3 configuration?**

When you upgrade your BIG-IP system, you simply install BIG-IP AS3 on the upgraded BIG-IP system and re-deploy your declaration.  For example, you installed BIG-IP AS3 on your BIG-IP running version 12.1.1 and deployed a declaration.  You decide to upgrade your BIG-IP system to 13.1. Once the upgrade to 13.1 is complete, you must install BIG-IP AS3 on the BIG-IP.  After you install BIG-IP AS3, you send the same declaration you used pre-upgrade to the 13.1 BIG-IP system. Your upgraded BIG-IP will then have the same configuration as the previous version.

|

**What happens on the front-end and back-end of BIG-IP AS3?**

- *Front-end*:
  BIG-IP AS3 exposes a declarative iControl LX REST API on the front-end: /mgmt/shared/appsvcs/declare.

- *Back-end*:
  BIG-IP AS3 uses iControl REST APIs on the back-end to communicate with BIG-IP. BIG-IP AS3 can use 3rd party REST APIs to communicate with 3rd party systems, enabling integration opportunities.

|

.. _part:

**Does BIG-IP AS3 support multi-tenancy?**

- Yes, BIG-IP AS3 creates and uses additional partitions to enable multi-tenancy
- BIG-IP AS3 ONLY writes to the Common partition when you specifically use the Common tenant with the Shared application (/Common/Shared); see the next FAQ entry
- BIG-IP AS3 writes to the Common partition as required for some GSLB configurations
- BIG-IP AS3 does NOT have access to tenants/partitions other than those it creates and **/Common**

|

**When does BIG-IP AS3 write to the Common partition for LTM configurations?**

- As noted above, BIG-IP AS3 only writes to the Common partition when you specifically use **/Common/Shared**. Otherwise, BIG-IP AS3 does not write to the Common partition for LTM configurations to ensure there is no impact to an existing device configuration where both BIG-IP AS3 and legacy configuration methods are being used
- While use of separate partitions may be new behavior for some users, F5 has designed BIG-IP AS3 in this manner in order to deliver the safest possible deployment mechanism on BIG-IP
- The use of separate partitions also prevents possible naming collisions and maintains a logical object hierarchy that allows BIG-IP AS3 to deliver stable transactions (atomicity) and idempotency

|

.. _common-ref:

**Which existing objects ca BIG-IP AS3 reference in the Common partition?**

Some properties in BIG-IP AS3 are polymorphic, allowing you to choose among predefined resources selected by name, a declared resource, or a BIG-IP resource defined outside BIG-IP AS3. When a value in this category is an object, it must have exactly one property, either **use** or **bigip**.

**use** indicates a reference to another class object in the declaration.  **bigip** indicates a component pathname to an object that was created outside of BIG-IP AS3 (typically in /Common).

Using the **bigip** clause allows you to specify pre-existing objects, such as pools, SNATs, iRules, HTTP profiles, HTTP Compression profiles, HTTP Acceleration profile, TCP profiles, UDP profiles, Multiplex profiles, WAF policies, IAM policies, Firewall policies, NAT policies, Endpoint policies, Server TLS profiles, client TLS profiles, SSL certificates, and SSL keys.

To reference these objects, you simply include a line in your declaration such as:

.. code-block:: javascript

   "profileTCP": {
      "bigip": "/Common/mptcp-mobile-optimized"
   }

Some of the example declarations in :ref:`additional-examples` contain these references. For more information on referencing objects, see :ref:`the reference documentation<shared-ref>`.  Also see our video about referencing objects on the BIG-IP: https://www.youtube.com/watch?v=b55noytozMU.



|

**Does BIG-IP AS3 replace iWorkflow?**

- BIG-IP AS3 does not replace iWorkflow
- An iWorkflow-like GUI-based Service Catalog is not built into BIG-IP AS3
- You can build GUI-based Service Catalog capabilities with third-party tools like Ansible Tower

|

**Is BIG-IP AS3 backwards-compatible with AS2.x API calls?**

No.

|

**How do I report issues, feature requests, and get help with BIG-IP AS3?**

- You can use GitHub Issues to submit feature requests or problems with BIG-IP AS3.
- Because F5 Networks created and fully tested BIG-IP AS3, it is fully supported by F5. This means you can get assistance if necessary from F5 Technical Support.
- Community Help:
    We encourage you to use our Slack channel for discussion and assistance on BIG-IP AS3 (click the f5-appsvcs-extension channel).
    Some F5 employees are members of this community, and they typically monitor the channel Monday-Friday 9-5 PST and will offer best-effort assistance.
    You should not consider this Slack channel community support as a substitute for F5 Technical Support.
    See the Slack Channel Statement for guidelines on using this channel.

|

**What is the difference between BIG-IP AS3 Selective and Complete updates and why is this important?**

- *Selective* is the default behavior in which tenants not explicitly referenced in declaration rePOSTing are NOT modified.
- When you enable *Complete* update, BIG-IP AS3 WILL delete tenants not explicitly referenced in declaration rePOSTing  (e.g. if the tenant is no longer in the declaration, that is an implicit instruction to delete the tenant so that the resulting config truly represents what you requested).
- It is important to know the difference to prevent you from accidentally deleting tenants if you don't reference them when updating a declaration.  See :ref:`adc-class-ref` for usage.


|

**Does BIG-IP AS3 support token authentication?  This is critical to support remote authentication roles (TACACS).**

- BIG-IP AS3 relies on the iControl LX framework for auth, and takes either Basic Auth credentials or iControl REST tokens (X-F5-Auth-Token) to authenticate to target devices.
- The BIG-IP AS3 user must supply one or the other; BIG-IP AS3 does not convert Basic Auth (name + passphrase) credentials to iControl REST tokens itself.

|

**Given BIG-IP AS3's tenancy model uses administrative partitions, does this mean I need to explicitly specify my SSL certificates and keys in each tenant partition?**

No. While BIG-IP AS3 does not write to the Common partition, has the ability to reference SSL certificates and keys defined in the **clientssl** profile in the **Common** partition. This simplifies your BIG-IP AS3 declarations enabling you to accelerate secure deployments of your app services.

|

**What can I do with the Service Discovery capability?**

BIG-IP AS3 has the ability to use F5's Service Discovery feature for Amazon Web Services (AWS) and Google Cloud Platform. Service Discovery enables the BIG-IP system to automatically update members in a load balancing pool based on cloud application hosts. You simply tag your cloud resources with key and value information, and then in the declaration you POST information about your cloud environment, including the cloud tag key and tag value you specified, and the BIG-IP VE programmatically discovers (or removes) members with those tags.

|

**How do I include Service Discovery in my BIG-IP AS3 declaration?**

See :ref:`Service Discovery Examples<sd-examples>` for information.

|

.. _tlsserver:

**I used a TLS_Server object in my BIG-IP AS3 declaration, why did it create a Client SSL profile on the BIG-IP?**

The BIG-IP AS3 naming convention for TLS Server and TLS Client differs from traditional BIG-IP terminology to better comply with industry usage, but may be slightly confusing for long-time BIG-IP users. The BIG-IP AS3 **TLS_Server** class is for connections arriving to the BIG-IP, which creates a "client SSL profile" object on the BIG-IP. The BIG-IP AS3 **TLS_Client** class if for connections leaving the BIG-IP, which creates a "server SSL profile" on the BIG-IP.  See |tlsserver| and |tlsclient| in the Schema Reference for more information.

|

.. _configsync:

**How do I synchronize configurations (configsync) across BIG-IP devices in a Device Group with BIG-IP AS3?**

To use BIG-IP AS3 to synchronize configurations across BIG-IP devices in an ***existing*** |devicegroup| use the |as3class| with the **syncToGroup** property in your declaration.

The syncToGroup value is the name (such as /Common/my_dg) of the config-sync Device group TO which the system should synchronize the targetHost configuration after (and only if) this request deploys any changes. If you do not use the syncToGroup property, or leave it empty (default), this request will not affect config-sync at all. Leave undefined or empty whenever you use auto-sync or manage configuration synchronization separately.

|

.. _statsinfo:

**Does BIG-IP AS3 collect any usage data?**

The Application Services Extension (BIG-IP AS3) gathers non-identifiable usage data for the purposes of improving the product as outlined in the end user license agreement for BIG-IP. To opt out of data collection, disable BIG-IP system's phone home feature as described in |phone|.

|

.. _contract:

**What is F5's Automation Toolchain API Contract?**

The API Contract for the F5 Automation Toolchain (BIG-IP AS3, Declarative Onboarding, and Telemetry Streaming) is our assurance that we will not make arbitrary breaking changes to our API.  We take this commitment seriously.  We semantically version our declarative API schemas ("xx.yy.zz") and do not make breaking changes within a minor ("yy") or patch ("zz") releases.  For example, early declarations using BIG-IP AS3 schema "3.0.0" are accepted by all subsequent minor releases including "3.16.0."

As of January 2020, no breaking changes have been made to BIG-IP AS3, Declarative Onboarding, or Telemetry Streaming since inception.  None are anticipated at this time.  A breaking change, if any, will be noted by a change to the major release number ("xx").  For example, the BIG-IP AS3 schema version would become "4.0.0."

|

.. _modules:

**What BIG-IP modules does BIG-IP AS3 support?**

As of BIG-IP AS3 3.17.0, BIG-IP AS3 provides feature support for LTM, GTM/DNS, APM, AFM, ASM, and PEM modules.
Please refer to the product documentation (https://support.f5.com/csp/knowledge-center/software) for details on the capabilities supported in these modules.

|

**What is the difference between the BIG-IP AS3 Container and the F5 API Services Gateway?**

**IMPORTANT:** The Community-Supported solution for BIG-IP AS3 running in a Docker container has been archived as of BIG-IP AS3 3.23.  F5 will no longer provide new versions of BIG-IP AS3 running in a container. The container page has been removed from the documentation.

BIG-IP AS3 Container was specifically for BIG-IP AS3 use cases, and the F5 API Services Gateway is specifically for custom iControl LX extension use cases.

|

.. _conflict:

**Can I use the same virtual IP address in a BIG-IP AS3 declaration as an existing virtual address on the target BIG-IP?**

In versions *prior* to 3.20, BIG-IP AS3 would create a new virtual IP address for the address specified in the declaration, even if there was an existing virtual IP address.

In version 3.20 and later, if a declaration includes a virtual address that conflicts with an existing virtual-address object in the **Common** tenant/partition on the target BIG-IP system, BIG-IP AS3 no longer attempts to create a new virtual address and will use the existing address on the BIG-IP.

|

.. _parentProfile:

**Why doesn't BIG-IP AS3 support setting a parent profile in all profiles?**

There was a design decision made that BIG-IP AS3 would not support parent profiles since this could cause confusion and conflicts with regard to the source of truth. When using BIG-IP AS3, the declaration should be the source of truth for the BIG-IP state. A parent profile represents state outside of this source of truth, and could change the state without applying a new declaration.

If you want to create multiple profiles with similar properties in BIG-IP AS3, F5 recommends using templating with tools like |fast|, |mustache|, or |jinja|.

Some profiles were added to BIG-IP AS3 before this decision was made that expose configuration of the parent profile. We do not recommend using any parent profile settings from these older profiles.

|

.. _language:

**Why are some BIG-IP AS3 properties showing as deprecated in the Schema Reference?**

As a part of an initiative to clean up language that can be considered racially-charged, we are adding aliases for some properties.  For example, **synCookieAllowlist** was added in BIG-IP AS3 3.25 as an alias for **synCookieWhitelist**.

.. IMPORTANT:: While some of these properties are being deprecated, the original property names will continue to work in BIG-IP AS3 declarations.

**How much storage is supported for dataGroup record for tenant names in BIGIP?**

AS3 supports dataGroup storage upto 63kb for aggregation of tenant names storage. Beyond this limit, AS3 cannot support the provisioning.


.. |intro| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/3/#introduction" target="_blank">Introduction</a>

.. |ilx| raw:: html

   <a href="https://devcentral.f5.com/Wiki/Default.aspx?Page=HomePage&NS=iControlLX" target="_blank">iControl LX</a>

.. |iapp| raw:: html

   <a href="https://github.com/F5Networks/f5-application-services-integration-iApp" target="_blank">appsvcs_integration iApp</a>

.. |declare| raw:: html

   <a href="https://f5.com/about-us/blog/articles/in-container-land-declarative-configuration-is-king-27226" target="_blank">declarative</a>

.. |apps| raw:: html

   <a href="https://f5.com/resources/white-papers/automating-f5-application-services-a-practical-guide-29792" target="_blank">configuring applications</a>

.. |idempotent| raw:: html

   <a href="https://whatis.techtarget.com/definition/idempotence" target="_blank">idempotent</a>

.. |support| raw:: html

   <a href="https://f5.com/support/support-policies" target="_blank">supported by F5</a>

.. |atomic| raw:: html

   <a href="https://www.techopedia.com/definition/3466/atomic-operation" target="_blank">atomic</a>

.. |multi| raw:: html

   <a href="https://en.wikipedia.org/wiki/Multitenancy" target="_blank">multi-tenancy</a>

.. |rd| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/tmos-routing-administration-13-1-0/9.html#guid-ebe7b3ea-c89f-4abc-976d-9c98755dd566" target="_blank">route domain</a>

.. |tlsclient| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-client" target="_blank">TLS_Client</a>

.. |tlsserver| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#tls-server" target="_blank">TLS_Server</a>

.. |devicegroup| raw:: html

   <a href="https://support.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/bigip-system-device-service-clustering-administration-13-1-0/4.html" target="_blank">Device Group</a>

.. |as3class| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#as3" target="_blank">AS3 Class</a>

.. |phone| raw:: html

   <a href="https://support.f5.com/csp/article/K15000#phone" target="_blank">K15000</a>


.. |supportmd| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/blob/main/SUPPORT.md" target="_blank">Support information on GitHub</a>

.. |fast| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/" target="_blank">F5 Application Services Templates</a>

.. |mustache| raw:: html

   <a href="https://mustache.github.io/" target="_blank">Mustache</a>

.. |jinja| raw:: html

   <a href="https://jinja.palletsprojects.com/en/2.11.x/" target="_blank">Jinja</a>

.. |do| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-declarative-onboarding/latest/" target="_blank">Declarative Onboarding</a>



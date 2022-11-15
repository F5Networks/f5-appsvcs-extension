.. _declaration-purpose-function:

BIG-IP AS3 Declaration Purpose and Function
===========================================

a BIG-IP AS3 declaration describes the desired configuration of an Application Delivery Controller (ADC) such as F5 BIG-IP in tenant- and application-oriented terms. a BIG-IP AS3 tenant comprises a collection of BIG-IP AS3 applications and related resources responsive to a particular authority. a BIG-IP AS3 application comprises a collection of ADC resources relating to a particular network-based business application or system. BIG-IP AS3 declarations may also include resources shared by Applications in one Tenant or all Tenants as well as auxiliary resources of different kinds.

BIG-IP AS3 Declaration Structure
--------------------------------

a BIG-IP AS3 declaration is a data structure representing an N-way tree with some cross-links, expressed in a JSON document. Each node in the tree corresponds to a JSON property. Interior nodes are JSON objects or arrays. The BIG-IP AS3 JSON schema governs the precise contents of a declaration.

Some nodes may have an arbitrary number of descendants of different types (as for example, an application may include multiple virtual servers and pools). The type of any node determines the schema to which it must conform. When BIG-IP AS3 cannot distinguish the type of a node merely by its position in the tree, it distinguishes the type by the value of a *class* property. This is necessary because BIG-IP AS3 lets users give many declaration objects arbitrary names. We often refer to nodes of types that have class properties by their class-property values: an *BIG-IP AS3 Tenant* is a BIG-IP AS3 object (node) having *class=Tenant*.

Some objects in a declaration neither need nor have a "class" property. A few objects have class properties they may not strictly need, either for symmetry or to support future feature extensions.

Although a declaration is a directed acyclic graph, the JSON document layout does not directly represent all of the logical links between its nodes. The system represents some node-to-node relationships using BIG-IP AS3 pointers in string properties of certain nodes.

BIG-IP AS3 Pointers in Declarations
-----------------------------------

a BIG-IP AS3 pointer can identify each node in a BIG-IP AS3 declaration. RFC6901 JSON Pointers and RFC Draft Relative JSON Pointers are the basis for BIG-IP AS3 pointers, but support special relative references which are meaningful only within BIG-IP AS3 declarations.

BIG-IP AS3 often uses BIG-IP AS3 pointers to refer to objects/ properties in declarations. BIG-IP AS3 pointers are analogous to filesystem pathnames so they should be familiar.

An "absolute" BIG-IP AS3 pointer identifying some property in a declaration named *item* looks like (for example) */T/A/item*.

It begins with / (slash) to indicate that it starts from the root of the declaration (which is a JSON object having class=ADC). The next token (tokens are the words between the slashes, "T" in the example) is the name of some property in the root object. Most often "T" will be the name of a BIG-IP AS3 Tenant, which in a declaration is an object (a property of the root object) having class=Tenant. The next token ("A" in the example) is the name of some property of the object named "T". Most often "A" will be the name of a BIG-IP AS3 Application. The final token of the pointer names the property of interest ("item" in the example).

a BIG-IP AS3 pointer may have more or fewer than three tokens. You can identify JSON array elements by numbers (because they do not have names); for example, the pointer **/T/A/pool/members/0/servicePort** would refer to the **servicePort** property of the first object in the *members* array property of an object named *pool* in Application "A" of Tenant "T".

In many cases it is not convenient to specify an absolute BIG-IP AS3 pointer to a declaration object. For example, you declare a virtual server "service" and a pool "mypool" inside a BIG-IP AS3 Application. In service's pool property you will want to refer to "mypool". That reference must be a BIG-IP AS3 pointer. However, if you were to use an absolute pointer like "/mytenant/myapp/mypool" and then later wish to change some name (token) in that pointer—for instance, renaming "mytenant" to "corporate"—you would have to remember to change the pointer in service's "pool" property at the same time (for instance, to "/corporate/myapp/mypool").

To minimize the need to rewrite BIG-IP AS3 pointers when you change the name of some property's ancestor like a Tenant or Application object, BIG-IP AS3 supports relative BIG-IP AS3 pointers. (An example of when this matters would be when you customize a generic BIG-IP AS3 declaration template).

For example, in a property of some object X inside a BIG-IP AS3 Application, a single-word relative pointer "Y" refers to an object named Y in the same Application and Tenant. Rather than putting **/mytenant/myapp/mypool** in the pool property of virtual server **service** as in the previous example, you may simply put **mypool** (no slashes). BIG-IP AS3 imputes the proper prefix **/mytenant/myapp/** (to obtain **/mytenant/myapp/mypool**).

BIG-IP AS3 relative pointers have additional powerful capabilities. See :ref:`pointer-ref` for more.


Overview of the BIG-IP AS3 Declaration
--------------------------------------

To generate any ADC configuration a BIG-IP AS3 declaration must include at least one Tenant which contains at least one Application (that is, one object having class=Tenant which has at least one property which is an object with class=Application).

That Application must contain at least one of a variety of objects representing ADC resources, for example, a Service_TCP object which represents a virtual server for TCP traffic.

Each resource object has some properties. Typically you are only required to supply values for one or a few of those properties. For example, you must supply at least one IP address for a virtual server to listen on. Other resource-object properties have default values suitable in many circumstances. You can always override a default property value by declaring the value you prefer.

You may give nearly all Tenant, Application, and ADC-resource objects names of your choosing (of 1 to 64 alphanumeric characters, starting with a letter). BIG-IP AS3 includes a few reserved names for special objects: The Tenant name **Common** and the Application name **Shared**, the virtual-server name **service**, and the property name **constants** in ADC, Tenant, and Application objects.

.. _shared-ref:

Normally you may only reference resources you define within any Application with other resources within the same Application. However, if you define an Application named **Shared** within any Tenant, then you can reference the resources it contains with objects in other Applications within the same Tenant. You may optionally define an Application named /Common/Shared and then you can reference resources it contains from all Applications in the declaration.

If you have some value (for example, an iRule) that you wish to use in multiple places you may place it in a property of a "constants" object and use a BIG-IP AS3 pointer to refer to it.

In parts of a declaration it makes sense for the value of a property to be one of a short name for some predefined resource, an object with multiple properties, a reference to another object in the declaration, or even a reference to a BIG-IP configuration component defined outside of the declaration.

For example, when you choose a client persistence method for a virtual server, you may choose a simple predefined method such as source-address. You may also declare a customized method such as hash (by declaring a Persistence object with suitable properties). Additionally, you may (although it is not best-practice) use a persistence method defined on the BIG-IP outside of AS3.

Each BIG-IP AS3 virtual-server object has a property named persistenceMethods which is an array. Each element of that array must be either a string indicating the name of a predefined persistence-method, or an object which has only one of two properties: **use** or **bigip**. The value of **use** must be a BIG-IP AS3 pointer naming a Persistence object declaring a customized persistence method. The value of **bigip** must be the full pathname of a BIG-IP configuration component which is a persistence method (ltm persistence xxx).

The three possibilities look like this:

.. code-block:: shell

    "persistenceMethods": [ "source-address" ]

    "persistenceMethods": [ {"use": "mypersist"} ]
    "mypersist": {
        "class": "Persist",
        "persistenceMethod": "cookie",
        "cookieName": "MYCOOKIE"
    }

    "persistenceMethods": [ {"bigip": "/Common/weird-persist"} ]

The elements of the persistenceMethods array are polymorphic properties. That means their values may be of different types such as string and object, not just one (for example, string only).

BIG-IP AS3 has two main categories of polymorphic properties. You can see the first in the preceding example: a polymorphic property to let you choose among a predefined resource selected by name, a declared resource, or a BIG-IP resource defined outside AS3. When a value in this category is an object, it must have exactly one property, either *use* or *bigip*, with the value of a BIG-IP AS3 pointer or a BIG-IP component pathname, respectively. When the value is a string, it is either the name of a predefined resource or a BIG-IP AS3 pointer, depending on the needs of the parent object. The precise requirement for every instance appears in the BIG-IP AS3 ADC JSON schema.

The second main category of polymorphic property lets you use a value from one of several sources: a string value supplied on-the-spot; a value encoded in base64 (to avoid the need to escape certain characters like \ (backslash) in JSON strings, or to input a binary value); a value (string, base64, or binary) identified by a URL retrieved from a resource server at the time you deploy the declaration; a value elsewhere in the declaration, identified by a BIG-IP AS3 pointer; or a BIG-IP configuration component defined outside AS3, identified by component pathname. The BIG-IP AS3 ADC JSON schema defines the polymorphic properties of this category as "F5string" properties.

The critical difference between the first and second categories is that F5string properties represent distinct values, not merely references to shared resources. When an F5string property refers to a resource by URL or BIG-IP AS3 pointer or otherwise, the system copies the value of that resource before further processing and final use. This permits you to use different context-dependent string expansions of values specified by F5string properties in different parts of a declaration. See the iRule Expansion Example for an illustration.  See :ref:`the FAQ<common-ref>` for a list of some of the objects in /Common you can reference using *bigip*.

Secrets in BIG-IP AS3 Declarations
``````````````````````````````````

You can only place Secrets such as passphrases into BIG-IP AS3 declarations within special objects. Those are the Secret (class=Secret) object and the JWE (cryptogram) object. The Secret object is polymorphic, it may itself be a JWE with an actual secret value in it, or it may be a reference (URL or BIG-IP AS3 pointer) to a resource from which the system may fetch a secret value. If and only if the allowReuse property of a Secret object is true, you may reuse the value it holds by referencing it from another Secret object.

a BIG-IP AS3 JWE object is a form of Flattened JWE (Javascript Web Encryption) JSON Serialization object. If the property miniJWE is true we just call the JWE a "miniJWE" and then its protected property contains a JOSE header indicating either that the secret in the ciphertext property is simply encoded in base64 (which is equivalent to plaintext—base64 is not a privacy-protecting encryption scheme), or that the F5 BIG-IP SecureVault feature encrypts the secret (the system encodes the SecureVault cryptogram in base64 before it places it into the ciphertext property). By default, BIG-IP AS3 gives an undeclared protected property the value "eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0" indicating that ciphertext holds a plaintext secret value (in base64), so BIG-IP AS3 only requires the ciphertext property if you simply want to supply a secret in plaintext, for example:

.. code-block:: shell

    "ciphertext": "c2VjcmV0"

(that is the word "secret" in base64).

For the initial release of BIG-IP AS3, you must provide secrets to declarations in plaintext (either fetched from a URL or encoded in base64 within a miniJWE) or as a SecureVault cryptogram previously obtained from the target ADC (BIG-IP device).

When BIG-IP AS3 deploys a declaration containing plaintext secrets (or for which it fetches secrets from URLs) it encrypts those secrets into SecureVault cryptograms by the target ADC (BIG-IP), then discards all plaintext secrets and uses only the SecureVault cryptograms. Because only the ADC which encrypts a SecureVault cryptogram may decrypt it (or another ADC in the same device group), it is not possible copy secret values from one ADC to another by invoking BIG-IP AS3 to GET a copy of a declaration from one ADC and POST it to another.

External resource URLs
``````````````````````

You may fetch an external resource value from a URL using HTTP or HTTPS. You may place HTTP Basic Auth credentials into URLs. BIG-IP AS3 expects resource servers to supply proper Content-Type headers and may not be able to process a binary response without one. All text responses should be in UTF-8 (by preference) or ISO-8859-1. The ASCII subset of either is fine.

BIG-IP AS3 Declarations and BIG-IP Configuration Component Names
----------------------------------------------------------------

BIG-IP AS3 insulates you from classical BIG-IP configuration, but you may still find occasion to refer to BIG-IP configuration components directly in your BIG-IP AS3 declarations (be sure to see :ref:`naming-ref` later in this section).

To refer to an existing BIG-IP configuration component in a BIG-IP AS3 declaration you must use the BIG-IP component's full pathname like "/Common/some-iRule". In most places where a BIG-IP AS3 declaration will accept a reference to a BIG-IP configuration component, you would supply one by setting the value of a BIG-IP AS3 property like "profileHTTP" to a JSON object containing the single property "bigip" having the value of the component's full pathname, for example:

.. code-block:: shell

    "profileHTTP": { "bigip": "/Common/fasthttp" }

Normally AS3 objects refer to other BIG-IP AS3 objects by BIG-IP AS3 pointers. However, there are a few circumstances in which you may wish to refer to some BIG-IP component that BIG-IP AS3 will create when it deploys a declaration. For example, you use BIG-IP AS3 to create a virtual server, some pools, and an iRule which will select one of the pools for each connection to the virtual server. That iRule will need to know the name of the BIG-IP ltm pool component corresponding to each BIG-IP AS3 Pool.

BIG-IP AS3 generally derives BIG-IP configuration component pathnames from declaration BIG-IP AS3 pointers by simply mapping BIG-IP AS3 Tenant name to BIG-IP partition name, BIG-IP AS3 Application name to BIG-IP folder name, and BIG-IP AS3 object name to BIG-IP component name. For instance, BIG-IP AS3 implements a BIG-IP AS3 Pool **/T/A/mypool** as BIG-IP ltm pool **/T/A/mypool**.

Some BIG-IP AS3 declaration objects generate multiple BIG-IP configuration components. For example, BIG-IP AS3 virtual servers are often translated to multiple BIG-IP virtual servers because BIG-IP AS3 virtual servers may have multiple virtualAddresses and BIG-IP virtual servers can only have one destination- address each. In these cases each BIG-IP component corresponds to some "distinguishers" related to the BIG-IP AS3 object, such as individual IP address or service port.

When BIG-IP AS3 generates multiple BIG-IP configuration components from one declaration object it typically gives each a name of the form xxxx-nnn[-mmm] where xxxx is the declaration-object name; nnn represents the order in which BIG-IP AS3 generates BIG-IP components (counting from zero)—derived from the order in which you list primary distinguishers in the declaration; and if present, mmm is an additional distinguisher like L4 port number. BIG-IP AS3 omits **-nnn** when it would be **-0**.

For example, when Application "web" includes an HTTPS virtual server "service" declared with three virtualAddresses [192.0.2.1, 203.0.113.2, 2001:db8::3] plus ""redirect": true", BIG-IP AS3 will create six BIG-IP virtual servers: {_web and _web-80 on IP 192.0.2.1; _web-1 and _web-1-80 on 203.0.113.2; _web-2 and _web-2-80 on 2001:db8::3}. If "service" had only one virtual address, "_web" is still the name of the corresponding (first) BIG-IP virtual server.

.. _naming-ref:

Updates to object naming in BIG-IP AS3 version 3.16.0 and later
```````````````````````````````````````````````````````````````
Beginning with BIG-IP AS3 3.16.0, there are some changes to object naming:

- BIG-IP AS3 3.16.0 introduced changes in how BIG-IP AS3 generates some names, and now allows dots (.) and hyphens (-) in Application property names. 
- BIG-IP AS3 3.17.0 and later allows dots and hyphens in Tenant and Application names. 
- BIG-IP AS3 3.17.0 and later allows names longer than 64 characters, so long as the total character length of tenant name, application name, and item name (along with 3 forward slashes) is less than or equal to 195.

These changes were introduced based on user feedback; use |hubfb| to report issues or leave feedback.

The following is a list of changes:

- BIG-IP AS3 3.16.0 and later allows . and - in Application property names only (child properties of the |application| Class, also see |app-class|)
- BIG-IP AS3 3.17.0 and later allows . and - in Tenant and Application names.
- The hyphen (-) is allowed as long as it is not the last character in a name
- The auto generated suffix has changed for some objects to include a trailing hyphen. For example, previously BIG-IP AS3 would name an object **service-1**, in BIG-IP AS3 3.16.0 and later, the name will be **service-1-**. |br| **Important**: This means any previously deployed application with objects that BIG-IP AS3 auto-generated are updated after upgrading BIG-IP AS3 to 3.16.0 or later, and the next time the declaration is POSTed, the names are updated, even if it is the same declaration. |br| Affected objects include: |br|

  - TLS_Server profiles (when there are multiple certs, BIG-IP AS3 creates additional profiles for each cert)
  - Service_HTTPS redirects (by default redirect80 is true, so BIG-IP AS3 creates a **service-Redirect-** in addition to the virtual)
  - Services with multiple addresses (BIG-IP AS3 creates a new service with each address).

- BIG-IP AS3 3.17.0 and later allows names longer than 64 characters.  This was implemented in part because of user feedback to allow for longer certificate names, but as long as the total character length of tenant name, application name, and item name (along with 3 forward slashes) is less than or equal to 195, the declaration will succeed.

iRule Expansion Example
```````````````````````
You can insert the names of BIG-IP configuration components corresponding to BIG-IP AS3 objects into string resources like iRules using string expansion. For example, you insert the BIG-IP component pathnames of a BIG-IP AS3 Pool named "pvt_pool" into an iRule like this:

.. code-block:: shell

    "choose_pool": {
        "class": "iRule",
        "remark": "choose private pool based on IP",
        "iRule": "when CLIENT_ACCEPTED {\nif {[IP::client_addr] starts_with \"10.\"} {\n pool `*pvt_pool`\n }\n}"
    }

BIG-IP AS3 replaces the `*pvt_pool` sequence in the iRule with something like "/mytenant/myapp/pvt_pool" when the system deploys the iRule.

String Expansion in URLs, iRules, and Other Values
--------------------------------------------------

To simplify declarations and particularly to facilitate the building of declarations from templates and the reuse of resources (such as iRules) inside declarations, BIG-IP AS3 can optionally replace portions of certain string values such as external-resource URLs, iRule definitions, Endpoint policy rows, etc. with context-dependent data.

For example, you declare multiple Applications having virtual servers which will each use an iRule.

Suppose each Application uses a similar iRule, but a web software team maintains each iRule and they are slightly customized to the Application (maybe "test" versus "production"). Rather than embed each iRule into your declaration you would prefer to fetch it from the web software team's resource server whenever you update your ADC configuration.
In that case, you could declare the iRule in each Application (before you attach it to a Service class) like this:

.. code-block:: shell

    "webrule": {
        "class": "iRule",
        "iRule": { "url": "https://repo.webteam.corp.com/irule-`A`.txt" }
    }

BIG-IP AS3 replaces the `A` sequence in the URL with the Application name "test" or "production" before anyone accesses the URL each time you deploy the declaration. The web software team would simply maintain the proper iRules in text files on their server. For example, they could name those files /var/www/html/irule-test.txt and /var/www/html/irule-production.txt.

After BIG-IP AS3 fetches an iRule from a resource server, it will expand string values in that iRule (separately from expanding values in the iRule's URL). See the iRule Expansion Example for an illustration.

The details of BIG-IP AS3 string expansion are as follows:

We scan the target string from left to right, replacing each successive pair of backquotes (ASCII 0x60) along with any text inside it. We do not rescan replacements so no recursion is possible. Except following `~` it is an error for the target to contain an odd number of backquotes. We replace two backquotes having nothing between them `` by a single backquote. We replace `~` (exactly one tilde within backquotes) by the empty string, then stop scanning the target string and make no further replacements. (To avert all backquote replacements in a target string, simply prepend `~` to it.)

Otherwise, the text within two backquotes selects a replacement value. The value often depends upon just where in the declaration BIG-IP AS3 finds the target string; see BIG-IP AS3 POINTER SYNTAX DETAILS.

+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Find         | Replace With                                                                                                                                                                                                                                               |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`\` 	       | one backquote (`)                                                                                                                                                                                                                                          |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`~\`        | empty string, plus cease to replace backquotes                                                                                                                                                                                                             |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`!tag\`     | empty string, plus log a debugging message. If present, any non-backquote characters "tag" will appear in the log message. A tag is optional: `!` is valid.                                                                                                |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`I\`        | unique identifier of declaration (equivalent to `=/id`)                                                                                                                                                                                                    |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`F\`        | family name (equivalent to `=/family`)                                                                                                                                                                                                                     |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`T\`        | current Tenant name (equivalent to `/@#`)                                                                                                                                                                                                                  |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`A\`        | current Application name (equivalent to `/@/@#`)                                                                                                                                                                                                           |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`Y\`        | application type, like "https"                                                                                                                                                                                                                             |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`M\`        | simple name of base property, like "install_cmds"                                                                                                                                                                                                          |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`N\`        | name of (absolute AS3 pointer to) base-property, like "/T/A/ext/install_cmds/0"                                                                                                                                                                            |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`O\`        | object-name of nearest ancestor of `M` with "class", like "ext"                                                                                                                                                                                            |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`P\`        | pointer to `O` like "/T/A/ext"                                                                                                                                                                                                                             |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`Q\`        | absolute AS3 pointer to `O` member, like "/T/A/ext/install_cmds" (rightmost reference-token in `O` may not be `M` if value came from some sub-object of the base property)                                                                                 |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`C\`        | class name of `O`, like "Extensions"                                                                                                                                                                                                                       |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`=pointer\` | property value from AS3 pointer; for example: `=/@/Shared/constants/reposerver` → "repo.example.com" Or for example, when `C` is "Pool", `=@/LB_mode` → round-robin and `=@/label` → "Backup web pool"                                                     |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`+pointer\` | like `=pointer` but base64-decoded                                                                                                                                                                                                                         |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| \`*pointer\` | full pathname of BIG-IP component representing declaration object identified by AS3 pointer (the first BIG-IP object if more than one). For example, given an HTTP virtual-server declaration "/T/A/service", `C` → Service_HTTP and `*@` → "/T/A/_A"      |
+--------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

It is an error if the text within a pair of backquotes is not recognized per the scheme here.



.. _pointer-ref:


BIG-IP AS3 Pointer syntax details
---------------------------------
We call references within a declaration to objects therein BIG-IP AS3 pointers. They are akin to RFC 6901 JSON Pointers and (RFC Draft) Relative JSON Pointers.

For each BIG-IP AS3 pointer we identify a "base property" which is the JSON property from which we got the pointer, disregarding any polymorphism.

When a BIG-IP AS3 pointer does not start with any of /, @, or a digit [0-9] (for example, "mypool"), we prepend "/@/@/" to it before interpreting it further. In most cases that is equivalent to prepending the current "/Tenant/Application/" pointer, thereby obtaining, for example, "/Tenant/Application/myPool". However, "/@/@/" is more general than /Tenant/Application— read down for details.

We interpret any pointer that begins with a digit [0-9] as a Relative JSON Pointer starting from the base property. Suppose we get (from the base property) the pointer "/T/A/sTLS/certificates/1/certificate". If that pointer is "2/0/certificate" we translate that as per Relative JSON Pointer to a pointer to the value of property **/T/A/sTLS/certificates/0/certificate**.

If the BIG-IP AS3 pointer starts with / and does not contain any reference tokens equal to "@" we interpret it as a JSON pointer to a property within the declaration.

If a BIG-IP AS3 pointer begins with "@/" (note: no initial slash) we replace the "@" with a pointer to the nearest ancestor object of the base property that has a property named class. For example, if we get pointer "@/monitors/0" from base property "/T/A/pool/members/0/monitors/0", then since "/T/A/pool" is the nearest ancestor with a class property (class=Pool), we replace the leading "@" with a pointer to that object to obtain the effective pointer "/T/A/pool/monitors/0".

Finally, when BIG-IP AS3 pointer begins with / we treat all reference tokens equal to "@" within it specially—we replace each one with the name of some object along the pointer to the base property. (Note: in BIG-IP AS3 declarations, you can never name an object or property "@".) For as many reference tokens are in the pointer to the base property, we replace each reference-token "@" in the target pointer with the corresponding reference-token from the pointer to the base property. Suppose we get pointer "/@/Shared/@/bundle" from base property "/T/A/pki/ca_chain". We replace the first "@" with "T" from the pointer to the base property. We replace the second "@" with "pki". (We do not replace reference-token "Shared".) The effective pointer is then "/T/Shared/pki/bundle". It is an error if there is no proper reference token available to replace an "@".

(If a BIG-IP AS3 pointer ends in # (pound sign) then it refers to the name rather than the value of the property which it identifies.)

You may use non-[/@0-9] BIG-IP AS3 pointers to simplify Application declarations. For example, you declare a virtual server "service", a pool "myPool", and an iRule "myRule" in the same Application "/mytenant/myapp". Then inside "service" you may set property "pool" to "myPool" rather than "/mytenant/myapp/myPool". (More than that, inside "myRule" you could put "when CLIENT_ACCEPTED { pool `*myPool` }" and BIG-IP AS3 will replace the pointer "myPool" inside the `*pointer` backquote-escape sequence with the appropriate BIG-IP component name, such as "/mytenant/myapp/myPool".)



.. |application| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#application" target="_blank">Application</a>

.. |app-class| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/composing-a-declaration.html#application-class">Application Class</a>

.. |br| raw:: html

   <br />

.. |hubfb| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/issues" target="_blank">GitHub Issues</a>


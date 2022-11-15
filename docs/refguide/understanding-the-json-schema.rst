.. _understanding-the-json-schema:

F5 BIG-IP AS3 JSON Schema
=========================

The JSON Schema document prescribes the syntax of a BIG-IP AS3 declaration. The BIG-IP AS3 declaration schema controls what objects may appear in a declaration, what name they may or must use, what properties they may have, which of those you must supply in the declaration, and which BIG-IP AS3 may fill with default values. The schema also specifies the ranges of values which certain properties may take on.

BIG-IP AS3 uses another—much shorter—JSON schema to specify the format of a BIG-IP AS3 POST request document, which you may use to give BIG-IP AS3 metadata such as access credentials along with a BIG-IP AS3 declaration.

When you successfully deploy a declaration (POST) to an ADC or fetch a copy of a previously-deployed declaration (GET) from an ADC, by default BIG-IP AS3 returns a copy of the declaration which includes just the properties and values that were in it when you submitted it to BIG-IP AS3 (though with secret values encrypted). However, you can see what default properties and values from the schema that BIG-IP AS3 did or will inject during deployment by setting BIG-IP AS3 GET option **show=full** or BIG-IP AS3 POST request option **showValues=full**.

You can use the BIG-IP AS3 JSON schema for declarations as a reference or even to drive a JSON-document editor or JSON-aware automation system. We document (lightly) each element of a declaration in the schema, see the title and description properties for each element (or :ref:`schema-reference`).

The BIG-IP AS3 declaration schema is truly the authoritative statement of declaration syntax because BIG-IP AS3 uses it directly to control the parser which interprets each declaration you supply to BIG-IP AS3.

Most BIG-IP AS3 schema elements have standard meanings. You may refer to the Internet RFC Draft “JSON Schema Validation: A Vocabulary for Structural Validation of JSON” for details.

The BIG-IP AS3 declaration schema also uses multiple custom string-format and validation keywords to implement and control certain validation rules and some BIG-IP AS3-specific parser features. (Other BIG-IP AS3 JSON schemas may also use these.)
BIG-IP AS3 JSON Schema custom string formats

BIG-IP AS3 JSON schemas use the following custom string formats as well as standard JSON-Schema format values:

+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Format Name  | Matches/Validates                                                                                                                                                                                                                      |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5name       | Names allowed for properties in declarations: 1–64 characters, alphanumeric plus underscore ('_'), starting with a letter. Letter-case is significant.                                                                                 |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5pointer    | AS3 pointers from one part of a declaration to another.                                                                                                                                                                                |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5bigip      | BIG-IP configuration component pathnames. They must start with ‘/’ and contain no spaces, double-quotes (") or other characters unwelcome in component names.                                                                          |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5ip 	       | Matches an IPv4 or IPv6 address in standard notation with optional f5 route-domain specifier (%RD) and/or mask-length (CIDR) specifier (/NN).                                                                                          |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5long-id    | Allows 0–255 safe characters, enough for a URL or UUID. You cannot use the following forbidden characters: control-characters, spaces, quotation-marks, angle-brackets, caret, pipe, and backslash.                                    |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5label      | Allows 0–64 characters, excluding control-characters and some others which may cause trouble with string-searching, Javascript, TCL, or HTML interpreters.                                                                             |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| f5remark     | Allows 0–64 characters, excluding only control-characters, double-quote ("), and backslash (\). This is permissive enough that you should worry about cross-site scripting attacks if you try to display declarations in web pages.    |
+--------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+


BIG-IP AS3 JSON Schema custom schema keywords
---------------------------------------------

The BIG-IP AS3 declaration schema also uses some custom schema keywords to control complex parser behavior. Sometimes custom keywords will apply to a single property in a declaration. When this occurs the order in which they apply is important. The following sections contain the BIG-IP AS3 custom keywords in order of priority, which determines their order of application if they appear together in the schema properties for a declaration element. Notice, however, that when one declaration element is a child of another, BIG-IP AS3 applies a custom keyword in the child's schema before a custom keyword in the parent's schema.

Custom keyword f5PostProcess(pointer)
`````````````````````````````````````

This keyword applies to a string property which holds a BIG-IP AS3 pointer that identifies some property in the current declaration (for example, the BIG-IP AS3 pointer **/@/A/serviceMain/virtualPort** might identify the virtualPort property of virtual-server object “serviceMain” in Application “A” of Tenant “T”).

When the parser sees this keyword it interprets the string value in the property as a BIG-IP AS3 pointer (for example, replacing @ symbols in the value). Then the parser checks to see whether that BIG-IP AS3 pointer identifies a property in the declaration which matches the JSON Schema given as the value of the f5PostProcess(pointer) property.

That is how the BIG-IP AS3 declaration schema specifies what sort of object a BIG-IP AS3 pointer ought to identify in a specific context. For example, the schema for the clientCertificate property of a BIG-IP AS3 HTTPS monitor declaration looks like this:

.. code-block:: shell

    "clientCertificate": {
        "title": "Client certificate",
        "description": "BIG-IP AS3 pointer to client Certificate declaration, for TLS authentication (optional)",
        "type": "string",
        "minLength": 1,
        "f5PostProcess": {
            "tag": "pointer",
            "data": {
                "schema": {
                    "properties": {
                        "class": { "const": "Certificate" }
                    },
                    "required": [ "class" ]
                }
            }
        }
    }

Observe that the value of the f5PostProcess(pointer) property (in the JSON schema—not in an actual declaration) is a tiny JSON Schema. It says that the object which the BIG-IP AS3 pointer in the value of the clientCertificate property identifies must have a property named class ("required": ["class"]) with exactly the value ("const":) of “Certificate”. If you accidentally put a BIG-IP AS3 pointer to some other kind of object (for example, a Pool) into the clientCertificate property, the parser will recognize that and refuse to deploy the declaration.

Custom keyword f5fetch
``````````````````````

This keyword fetches data values into a BIG-IP AS3 declaration from anywhere (in the world!). It recognizes F5string-style polymorphism and interprets one of the possible sub-properties url, copyFrom, reuseFrom, base64 or text as the source of some data needed by the declaration.

If the property to which f5fetch applies is a simple string (rather than an object with one of the aforementioned properties) then f5fetch uses that string value directly, subject to interpretation as explained below.

When you give a sub-property url then its value must be a HTTP(S) URL from which f5fetch can request and obtain some data. In all BIG-IP AS3 versions, you may put HTTP Basic Authentication credentials into the URL. BIG-IP AS3 3.28 adds the ability to retrieve data from a URL that is using bearer token authentication (see :ref:`Bearer Token Auth<tokenauth>`).

The value of copyFrom must be a BIG-IP AS3 pointer to a property in the declaration from which you may copy a desired string data value.

The value of reuseFrom must be a BIG-IP AS3 pointer to an object property in the declaration from which you may copy a desired object value. (This is most often used with Secret objects. However, if the allowReuse property of a Secret object is false then f5fetch will not copy it.)

The value of base64 must be some data encoded in (either original or URL-safe) base64 which f5fetch will decode for use.

Finally, the value of sub-property text must be a string. Both of the following fragments would have the same meaning in a declaration if property data were polymorphic and custom keyword f5fetch applied:

.. code-block:: shell

    "data": "some string"

    "data": { "text": "some string" }

The value of the f5fetch keyword indicates the type of data. The possible values are string, object, binary, json, pki-cert, pki-key, and pki-bundle. This value is especially important when f5fetch has to retrieve data from a resource server by requesting a URL: it controls some HTTP(S) request headers such as “Accept” and the interpretation of the response. When the data offered (e.g., by reference) to f5fetch does not match the desired type the BIG-IP AS3 parser may report an error.

When f5fetch retrieves binary data it encodes it in base64 for placement in the declaration. (Whenever you need to include binary data in a declaration, you must encode it in base64, because JSON cannot represent raw binary values.) When BIG-IP AS3 asks f5fetch to retrieve object data from a remote resource server, that server must supply a JSON (i.e., textual) representation of the desired object.

Custom keyword f5expand
```````````````````````

This keyword causes the BIG-IP AS3 string expansion of any string property to which it applies. BIG-IP AS3 string expansion causes the replacement of certain backquote-delimited sequences in the string by information found elsewhere in the declaration. For example, AS# may replace the sequence `A` by the name of the BIG-IP AS3 Application object from which the affected string property descends.

The value of the f5expand keyword may be a boolean (true/false) or an object. If a boolean, it simply controls whether BIG-IP AS3 performs expansion. If an object, it may have properties **when** and/or **to**.

The value (if any) of **when** must be a BIG-IP AS3 pointer to some boolean value in the declaration. That value will control whether BIG-IP AS3 performs expansion.

The value (if any) of to must be a property name. Normally f5fetch puts each expanded string into the same property (source) from which the original string came (that is, the property to which the f5expand keyword applied). If to names another property (destination), f5fetch will put the expanded string into it and leave the source property alone. The destination property must be in the same object as the source property and BIG-IP AS3 will create it if it does not exist.

Custom keywords f5expand and f5fetch are often used together in the BIG-IP AS3 declaration schema. One important case is the expansion of a URL used to fetch some string data which is subsequently expanded. Consider the following (much simplified) example:

.. code-block:: shell

    "expand": {
        "title": "Expand",
        "description": "If true (default), expand backquoted variables in iRule",
        "type": "boolean",
        "default": true
    },
    "iRule": {
        "title": "iRule",
        "description": "text of iRule or URL from which to fetch it",
        "if": { "not": { "type": "string" } },
        "then": {
            "type": "object",
            "properties": {
                "url": {
                    "title": "URL",
                    "description": "URL from which to retrieve iRule",
                    "type": "string",
                    "format": "url",
                    "f5expand": true
                }
            }
        },
        "f5fetch": "string",
        "f5expand": { "when": "1/expand" }
    }

The value of property iRule will ultimately be the text of an iRule.

.. code-block:: shell

    "iRule": "#this is my (meaningless) iRule"

BIG-IP AS3 permits this; the text of the iRule is simply the property value in the declaration. Something like:

.. code-block:: shell

    "iRule": { "url": "http://repo.corp.com/`A`-irule.txt" }

is also acceptable; BIG-IP AS3 fetches the text of the iRule from a remote resource server.

Notice, however, the `A` in the URL used to fetch the iRule. The f5expand keyword in the schema for the **url** property indicates that BIG-IP AS3 should expand the backquote-sequences in the (url) string. BIG-IP AS3 replaces `A` with the name of the Application in which the URL appears, so the effective URL will resemble: .

After BIG-IP AS3 expands the value of **url**, the f5fetch keyword will query the resulting URL for a string and replace the value of iRule (previously an object having property url) with that string:

.. code-block:: shell

    "iRule": "when RULE_INIT { log "Application is `A`" }\n"

But that is not all. Another f5expand keyword applies to the value of iRule. It will check ("when": "1/expand") whether property expand in the same object as property iRule is true (it is by default) and if so, will expand any backquote-sequences in the text of iRule. In our example that will cause the final value for iRule to be:

.. code-block:: shell

    "iRule": "when RULE_INIT { log "Application is webapp" }\n"

Custom keyword f5bigComponent
`````````````````````````````

This keyword tests whether a specified BIG-IP configuration component of the required type exists on the target BIG-IP ADC.

The value of f5bigComponent indicates the required component type (for example, ltm profile http) and the method of testing it, one of query, probe, or asm.

For example, if the (simplified) schema for a property looks like:

.. code-block:: shell

    "profileHTTP": {
        "type": "object",
        "properties": {
            "bigip": {
                "type": "string",
                "format": "f5bigip"
            }
        },
        "f5bigComponent": "query ltm profile http"
    }

and the declaration contains:

.. code-block:: shell

    "profileHTTP": { "bigip": "/Common/http" }

then f5bigComponent will check whether ltm profile http /Common/http exists on the target BIG-IP.

In some cases, to check whether a component named something like “/Common/myMonitor” exists you must know the BIG-IP sub-module in which to look for it, such as (ltm monitor) tcp. The sub-module is not part of the component name, nor can you easily specify it in the BIG-IP AS3 declaration schema. In these cases, you may set the value of f5bigComponent to something like “probe ltm monitor icmp”, specifying just the simplest (in the example, icmp) of the possible sub-modules (such as http, tcp, icmp, et cetera). Using method probe instead of query causes f5bigComponent to test for the existence of the named component by trying to create another component with the same name—if that fails, then the named component exists, otherwise it does not.

Custom keyword f5PostProcess(secret)
````````````````````````````````````

This keyword replaces a plaintext secret value in a declaration with an F5 SecureVault cryptogram.

**f5PostProcess(secret)** only operates against objects which have properties protected and ciphertext. When the value in protected indicates that ciphertext contains the plaintext of a secret (that is, not encrypted but merely encoded in base64), then f5PostProcess(secret) requests the target ADC (typically BIG-IP) to encrypt that secret under the ADCs private key. f5PostProcess(secret) then replaces the plaintext secret in property ciphertext with the cryptogram from the target ADC (encoded in base64) and updates protected to indicate that ciphertext contains a SecureVault cryptogram.

When you deploy the declaration to the target ADC, that device can decrypt any secrets which it previously encrypted in order to use them.
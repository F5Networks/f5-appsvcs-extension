F5 BIG-IP Application Services 3 Extension Documentation
========================================================

Welcome to the F5 BIG-IP Application Services 3 Extension User Guide. This is the documentation for the **latest** version of BIG-IP AS3, if you want to see the documentation for a long term support (LTS) version, use the version selector on the top left (for details, see |supportmd|).

.. NOTE:: The BIG-IP AS3 RPM, Postman collection, and checksum files can be found on the |release|, as **Assets**. You can find historical files on GitHub by using the **Branch** drop-down, clicking the **Tags** tab, and then selecting the appropriate release.

To provide feedback on this documentation, you can file a GitHub Issue, or email us at solutionsfeedback@f5.com.

.. NOTE:: To see what is new in BIG-IP AS3, see the the :ref:`revision-history` or the |relnotes|.

Introduction
------------

The F5 BIG-IP Application Services 3 Extension (referred to as *BIG-IP AS3*) is a flexible, low-overhead mechanism for managing
application-specific configurations on a BIG-IP system. BIG-IP AS3 uses a declarative
model, meaning you provide a JSON declaration rather than a set of imperative
commands. The declaration represents the configuration which BIG-IP AS3 is responsible
for creating on a BIG-IP system. BIG-IP AS3 is well-defined according to the rules of
JSON Schema, and declarations validate according to JSON Schema. BIG-IP AS3 accepts
declaration updates via REST (push), reference (pull), or CLI (flat file
editing).

You can use Microsoft Visual Studio Code to validate your declarations, see :ref:`Validating a Declaration<validate>` for information.

This guide contains information on downloading, installing, and using the Application Services 3 Extension.  Use the navigation panes, and/or the Next and
Previous buttons to explore the documentation.

You can also see our BIG-IP AS3 overview video:

|vid|

And the Using BIG-IP AS3 video:


|video|



.. toctree::
   :maxdepth: 1
   :hidden:
   :glob:


   userguide/index
   refguide/index
   declarations/index
   refguide/apidocs
   refguide/revision-history
   refguide/schema-reference
   refguide/schema-reference-byclass
   refguide/service-discovery-design




.. |video| raw:: html

   <iframe width="560" height="315" src="https://www.youtube.com/embed/NJjcUUtjnJU" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

.. |relnotes| raw:: html

   <a href=" https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">Release Notes on GitHub</a>

.. |vid| raw:: html

   <iframe width="560" height="315" src="https://www.youtube.com/embed/cMl3AOtMcUo" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

.. |supportmd| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/blob/master/SUPPORT.md" target="_blank">Support information on GitHub</a>


.. |release| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">GitHub Release</a>




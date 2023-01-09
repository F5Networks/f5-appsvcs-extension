# Changelog
Changes to this project are documented in this file. More detail (including information on releases before 3.4) and links can be found in the AS3 [Document Revision History](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/revision-history.html).

## 3.43.0

### Added
- AUTOTOOL-3490: ([GitHub Issue 533](https://github.com/F5Networks/f5-appsvcs-extension/issues/533)): Added lsn-legacy-mode & destination address/port properties in Security_Log_Profile_Nat
- AUTOTOOL-3491: ([GitHub Issue 619](https://github.com/F5Networks/f5-appsvcs-extension/issues/619)): ALG_Log_Profile. Currently requires cgnat to be provisioned and minimum BIGIP version to be 15.1

### Fixed
- AUTOTOOL-3517: Shared virtual addresses are not removed when no longer in use

### Changed

### Removed

## 3.42.0

### Added
- AUTOTOOL-975: ([GitHub Issue 156](https://github.com/F5Networks/f5-appsvcs-extension/issues/156)): Add geoip condition to Endpoint_Policy
- AUTOTOOL-3549: ([GitHub Issue 487](https://github.com/F5Networks/f5-appsvcs-extension/issues/487)): SNAT_Translation class (ltm snat-translation)

### Fixed
- AUTOTOOL-2201: ([GitHub Issue 407](https://github.com/F5Networks/f5-appsvcs-extension/issues/407)): Retry on HTTP request timeouts
- AUTOTOOL-3385: ([GitHub Issue 623](https://github.com/F5Networks/f5-appsvcs-extension/issues/623)): Pool member adminState does not match "force offline" behavior in WebUI
- AUTOTOOL-3470: ([GitHub Issue 650](https://github.com/F5Networks/f5-appsvcs-extension/issues/650)): F5 appsvcs throws 404 when the admin user is disabled
- AUTOTOOL-3055: ([GitHub Issue 574](https://github.com/F5Networks/f5-appsvcs-extension/issues/574)): Pool members not rolling back properly on declaration failure

### Changed
- Updated to Service Discovery 1.11.2-1
  - AUTOTOOL-3335: ([GitHub Issue 610](https://github.com/F5Networks/f5-appsvcs-extension/issues/610)): Service Discovery / Consul and jmespathquery to configure priorityGroup for pool members
  - AUTOTOOL-3534: Update packages to latest available versions
- AUTOTOOL-3439: Merge f5-appsvcs-schema into AS3, specifically: Analytics_Profile, Analytics_TCP_Profile, Basic_Auth, Bearer_Token, CA_Bundle, Capture_Filter, Certificate, Certificate_Validator_OCSP, Enum_Country_Analytics, F5_String, JWE, Log_Publisher

### Removed

## 3.41.0

### Added
- AUTOTOOL-3486: ([GitHub Issue 526](https://github.com/F5Networks/f5-appsvcs-extension/issues/526)): Statistics_Profile (ltm profile statistics) and the ability to attach to a Service
- AUTOTOOL-3488: ([GitHub Issue 551](https://github.com/F5Networks/f5-appsvcs-extension/issues/551)): SSL profile: add advanced settings
- AUTOTOOL-3489: ([GitHub Issue 430](https://github.com/F5Networks/f5-appsvcs-extension/issues/430)): DNS_Logging_Profile (ltm profile dns-logging)
- AUTOTOOL-3031: ([GitHub Issue 566](https://github.com/F5Networks/f5-appsvcs-extension/issues/566)): GSLB_Domain missing the persistence option

### Fixed
- AUTOTOOL-3305: ([GitHub Issue 606](https://github.com/F5Networks/f5-appsvcs-extension/issues/606)): Unable to reference existing virtual addresses that exist in Common in route domains
- AUTOTOOL-3336: ([GitHub Issue 613](https://github.com/F5Networks/f5-appsvcs-extension/issues/613)): Unable to use use-references to single-letter Tenants or Applications
- AUTOTOOL-3347: Mapped IPv4 Addresses are not idempotent
- AUTOTOOL-3511: PATCH request fails to add new tenant to existing declaration

### Changed
- AUTOTOOL-3475: Update AS3 documentation for TLS_Server SSL protocols
- Updated to Service Discovery 1.10.15-3
  - AUTOTOOL-3450: ([GitHub Issue 614](https://github.com/F5Networks/f5-appsvcs-extension/issues/614)): Pool Member cannot be assigned to node and errors when nodes  "id" field matches IP address

### Removed

## 3.40.0

### Added
- AUTOTOOL-3448: ([GitHub Issue 562](https://github.com/F5Networks/f5-appsvcs-extension/issues/562)): Inband monitor (Monitor_Inband class). To access, create a Monitor and set 'monitorType' to 'inband'.
- AUTOTOOL-3441: ([GitHub Issue 640](https://github.com/F5Networks/f5-appsvcs-extension/issues/640)): HTTP_Profile properties enforceRFCCompliance and allowBlankSpaceAfterHeaderName.
- AUTOTOOL-3444: ([GitHub Issue 643](https://github.com/F5Networks/f5-appsvcs-extension/issues/643)): Stateless Service_UDP. To use set virtualType property to "stateless".

### Fixed
- AUTOTOOL-3066: ([GitHub Issue 578](https://github.com/F5Networks/f5-appsvcs-extension/issues/578)): Issues with GSLB Pool that refers to a GSLB Server with virtualServerDiscoveryMode enabled.
- AUTOTOOL-3417: Intermittent security profile errors when AFM is not provisioned
- AUTOTOOL-3410: Duplicate APM policies accumulating on POST
- AUTOTOOL-3408: ([GitHub Issue 634](https://github.com/F5Networks/f5-appsvcs-extension/issues/634)): Unable to import ssl certificate with CRLF line endings
- AUTOTOOL-3442: ([GitHub Issue 644](https://github.com/F5Networks/f5-appsvcs-extension/issues/644)): "redirect80: true" is creating a disabled HTTP VIP after upgrading to v3.39.0
- AUTOTOOL-3435: ([GitHub Issue 638](https://github.com/F5Networks/f5-appsvcs-extension/issues/638)): Cannot create multiple websocket profiles
- AUTOTOOL-3440: ([GitHub Issue 641](https://github.com/F5Networks/f5-appsvcs-extension/issues/641)): AS3 assumes .key extension for private key when no extension is listed
- AUTOTOOL-3418: ([GitHub Issue 637](https://github.com/F5Networks/f5-appsvcs-extension/issues/637)): Cannot set GSLB_Server proberPool property to a 'use' reference

### Changed
- AUTOTOOL-3318: f5fetch keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3361: f5certExtract keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3363: f5include keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3360: f5modules keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3317: f5bigComponent keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3359: f5expand keyword replaced by f5PostProcess keyword in the schema
- Updated to Service Discovery 1.10.15-1
  - AUTOTOOL-3358: Switched to atg-shared-utilities for encryption/decryption

### Removed

## 3.39.0

### Added
- AUTOTOOL-3350: Attachment of SIP profile to Service_UDP
- AUTOTOOL-3294: ([GitHub Issue 523](https://github.com/F5Networks/f5-appsvcs-extension/issues/523)): Add control of virtual server admin state

### Fixed
- AUTOTOOL-3303: ([GitHub Issue 605](https://github.com/F5Networks/f5-appsvcs-extension/issues/605)): Service with virtual address of "0.0.0.0" and shareAddresses set to true is not idempotent

### Changed
- AUTOTOOL-3056: f5pointsTo keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3316: f5virtualAddress keyword replaced by f5PostProcess keyword in the schema
- Updated to Service Discovery 1.10.14-1
  - AUTOTOOL-3372: Update packages to latest available versions

### Removed

## 3.38.0

### Added
- AUTOTOOL-3301: ([GitHub Issue 598](https://github.com/F5Networks/f5-appsvcs-extension/issues/598)): Attachment of SMTPS profile to Service_TCP and Servce_UDP classes via TLS_Server smtpsStartTLS property
- AUTOTOOL-3293: ([GitHub Issue 601](https://github.com/F5Networks/f5-appsvcs-extension/issues/601))): Add missing TLS_Server, TLS_Client objects

### Fixed
- AUTOTOOL-3138: ([GitHub Issue 599](https://github.com/F5Networks/f5-appsvcs-extension/issues/599)): Changes still applied despite 422 error for optimisticLockKey
- AUTOTOOL-3111: ([GitHub Issue 586](https://github.com/F5Networks/f5-appsvcs-extension/issues/586)): Unable to create "Data_Group" using "externalFilePath": Failed! exit_code (22)
- AUTOTOOL-2963: ([GitHub Issue 546](https://github.com/F5Networks/f5-appsvcs-extension/issues/546)): Declaration containing a service with an IPv6 address and a custom route domain can fail on a second POST
- AUTOTOOL-3068: ([GitHub Issue 580](https://github.com/F5Networks/f5-appsvcs-extension/issues/580)): Base64 encoded certificates are not uploaded properly
- AUTOTOOL-3139: ([GitHub Issue 596](https://github.com/F5Networks/f5-appsvcs-extension/issues/596)): Handle multiple words in monitor environment variables
- AUTOTOOL-3326: ([GitHub Issue 611](https://github.com/F5Networks/f5-appsvcs-extension/issues/611)): External data group cannot be updated after creation
- AUTOTOOL-3306: ([GitHub Issue 607](https://github.com/F5Networks/f5-appsvcs-extension/issues/607)): Service_Address is not idempotent with any6 address and route domain
- AUTOTOOL-3345: Service_Generic, Service_SCTP, Service_L4, and Service_Forwarding classes fail when virtualAddresses property is not specified
- AUTOTOOL-3341: Cannot add aliases to GSLB_Domain object
- AUTOTOOL-3050: ([GitHub Issue 572](https://github.com/F5Networks/f5-appsvcs-extension/issues/572)): Unable to change Pool member in /Common/Shared from static to FQDN if both members resolve to the same IP

### Changed
- AUTOTOOL 3356: Return a 500, instead of 404, status code when declaration state cannot be fetched from the BIG-IP
- Updated to Service Discovery 1.10.13-1
  - AUTOTOOL-3147: Update packages to latest available versions
- Increased log visibility of some error messages

### Removed

## 3.37.0

### Added
- AUTOTOOL-601: Add support for specifying minimum device version in the schema. Add support for returning warnings
  in the results when properties do not meet the minimum version.
- AUTOTOOL-3094: Add support for DOS_Profile.allowlist without AFM provisioning
- AUTOTOOL-3015: ([GitHub Issue 544](https://github.com/F5Networks/f5-appsvcs-extension/issues/544)): Apply WAF overrides on file property
- AUTOTOOL-3140: ([GitHub Issue 594](https://github.com/F5Networks/f5-appsvcs-extension/issues/594)): Ratio property in GSLB_Domain class pools
- AUTOTOOL-3129: ([GitHub Issue 590](https://github.com/F5Networks/f5-appsvcs-extension/issues/590)): GSLB_iRule class and attachment to GSLB_Domain

### Fixed
- AUTOTOOL-3121: Pool members with duplicate addresses in route domain 0 do not fail validation

### Changed
- Updated to Service Discovery 1.10.12-3
  - AUTOTOOL-3073: Update packages to latest available versions
- AUTOTOOL-3116: f5node keyword replaced by f5PostProcess keyword in the schema

### Removed
- Remove schema source files from build output

## 3.36.1

### Added

### Fixed

### Changed
- Promoted to LTS

### Removed

## 3.36.0

### Added

### Fixed
- AUTOTOOL-3033: SSL Orchestrator access profiles cannot be attached because rba and websso profiles are automatically attached
- AUTOTOOL-3030: SD nodes prevent partition delete
- AUTOTOOL-3053: POST with 'updateMode: complete' fails after a DELETE
- AUTOTOOL-3041: ([GitHub Issue 569](https://github.com/F5Networks/f5-appsvcs-extension/issues/569)): ignoreChanges not working properly in external data-groups
- AUTOTOOL-1105: Cannot use certificates from shared application
- AUTOTOOL-3034: ([GitHub Issue 567](https://github.com/F5Networks/f5-appsvcs-extension/issues/567)): GSLB Topology Records are sometimes lost
- AUTOTOOL-3058: ([GitHub Issue 581](https://github.com/F5Networks/f5-appsvcs-extension/issues/581)): TMSH CLI script can fail under load due to timeout

### Changed
- AUTOTOOL-2936: f5secret keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-2961: f5LongSecret keyword replaced by f5PostProcess keyword in the schema
- AUTOTOOL-3099: Do not store GET requests to /declare in the task history
- Updated to Service Discovery 1.10.11-1
  - AUTOTOOL-3087: SD can fail with 'Invalid status code: 1' due to saving tasks too quickly
  - AUTOTOOL-2987: Update packages to latest available versions
  - AUTOTOOL-3105: Tasks can be lost on restnoded restart

### Removed
- AUTOTOOL-3090: Code and schema description references specific to BIGIP versions 12.1 and 13.0

## 3.35.0

### Added
- AUTOTOOL-602: ([GitHub Issue 137](https://github.com/F5Networks/f5-appsvcs-extension/issues/137)): Reference ip-intelligence policies
- AUTOTOOL-1146: ([GitHub Issue 161](https://github.com/F5Networks/f5-appsvcs-extension/issues/161)): Allow for named nodes
- AUTOTOOL-2843: Attach Integrated Bot Defense Profiles
- AUTOTOOL-2984: Support route-domain names as strings for HTTP Profile Explicit objects

### Fixed
- AUTOTOOL-2937: Does not block on persisting BIG-IP state
- AUTOTOOL-2999: Task can hang while waiting for a script to finish
- AUTOTOOL-2725: ([GitHub Issue 506](https://github.com/F5Networks/f5-appsvcs-extension/issues/506)): URL fetch of certificates results in corrupted files
- AUTOTOOL-2878: ([GitHub Issue 530](https://github.com/F5Networks/f5-appsvcs-extension/issues/530)): AS3 Schema issue where it applies incorrect restriction if serverType is undefined
- AUTOTOOL-3036: Service Discovery secrets are not encrypted on BIG-IQ
- AUTOTOOL-2980: ([GitHub Issue](https://github.com/F5Networks/f5-appsvcs-extension/issues/553)): AS3 fails with unspecific error when an external data group externalFilePath has an invalid HTTP response code

### Changed
- Updated to Service Discovery 1.10.8-1
  - AUTOTOOL-2974: ([GitHub Issue 479](https://github.com/F5Networks/f5-appsvcs-extension/issues/479)): Existing FQDN nodes break Service Discovery
- AUTOTOOL-2787: f5modules for Access_Profile and Per_Request_Access_Policy

### Removed

## 3.34.0

### Added
- AUTOTOOL-2876: ([GitHub Issue 511](https://github.com/F5Networks/f5-appsvcs-extension/issues/511)): Expand external data group URL fetching
- AUTOTOOL-2940: ([GitHub Issue 539](https://github.com/F5Networks/f5-appsvcs-extension/issues/539)): Add proxy request as an event to more LTM policy items
- AUTOTOOL-693: ([GitHub Issue 131](https://github.com/F5Networks/f5-appsvcs-extension/issues/131)): Add support for Endpoint_Policy log action type

### Fixed
- AUTOTOOL-686: ([GitHub 123](https://github.com/F5Networks/f5-appsvcs-extension/issues/123)): Referencing persistence profiles results in mcpd error
- AUTOTOOL-2910: Failure to fetch stored declarations results in incorrect 204 response
- AUTOTOOL-2206: Unchecked mode fails when shareNodes true and declaration moves pool from Tenant/Application to Common/Shared
- AUTOTOOL-2906: ([GitHub 525](https://github.com/F5Networks/f5-appsvcs-extension/issues/525)): Sync settings updates on devices that are in a cluster.
- AUTOTOOL-2203: Unchecked mode fails for several of the GSLB classes when the GSLB object is changed

### Changed
- Updated to Service Discovery 1.10.6-1
  - Switch to atg-storage
  - Update packages to latest available versions

### Removed

## 3.33.0

### Added
- AUTOTOOL-2730: ([GitHub Issue 392](https://github.com/F5Networks/f5-appsvcs-extension/issues/392)): Support disabling of SSL on TLS profiles
- AUTOTOOL-2727: ([GitHub Issue 489](https://github.com/F5Networks/f5-appsvcs-extension/issues/489)): Support SNAT option in LTM policy forward actions
- AUTOTOOL-2729: ([GitHub Issue 462](https://github.com/F5Networks/f5-appsvcs-extension/issues/462)): Expose virtual.rate-limit property

### Fixed
- AUTOTOOL-2782: ([GitHub 514](https://github.com/F5Networks/f5-appsvcs-extension/issues/514)): Redirect server created by setting Service_HTTPS redirect80 true always allows all VLANs
- AUTOTOOL-1513: ([GitHub 252](https://github.com/F5Networks/f5-appsvcs-extension/issues/252)): Leading comment stripped from iRule
- AUTOTOOL-2826: Too many ICR requests when searching for gtm monitors
- AUTOTOOL-2786: ([GitHub 516](https://github.com/F5Networks/f5-appsvcs-extension/issues/516)): HTTP_Profile insertHeader.value is not idempotent with double quotes or question marks
- AUTOTOOL-2883: Unable to Post declaration with service discovery after upgrade from v3.30.0
- AUTOTOOL-2204: Unchecked mode fails when using Service_TCP in /Common/Shared with sharedAddresses true

### Changed
- Updated to Service Discovery 1.10.3-1
  - AUTOTOOL-2848: Service Discovery sometimes fails to delete task with external node
  - AUTOTOOL-2714: Add consul SD integration test
  - AUTOTOOL-2851: Service Discovery tries to delete pre-existing nodes before defaulting to metadata removal
- AUTOTOOL-2630: Remove dependence on Service Discovery for encryption

### Removed

## 3.32.1

### Added

### Fixed
- AUTOTOOL-2883: Unable to Post declaration with service discovery after upgrade from v3.30.0

### Changed

### Removed

## 3.32.0

### Added
- AUTOTOOL-2720: Configure HTTP connect profile
- AUTOTOOL-2726: ([GitHub 478](https://github.com/F5Networks/f5-appsvcs-extension/issues/478)): Support ignoreChanges on Resource_URL
- AUTOTOOL-2799: ([GitHub 364](https://github.com/F5Networks/f5-appsvcs-extension/issues/364)): Expose all protocols in Firewall rules
- AUTOTOOL-2728: ([GitHub Issue 471](https://github.com/F5Networks/f5-appsvcs-extension/issues/471)): Use AS3 to reference a datagroup in a condition in a Local Traffic Policy

### Fixed
- AUTOTOOL-664: Honor the iRules order that is specified in a declaration
- AUTOTOOL-2708: ([GitHub Issue 496](https://github.com/F5Networks/f5-appsvcs-extension/issues/496)): Tenants with names containing periods and non-zero route domains
- AUTOTOOL-2719: ([GitHub Issue 502](https://github.com/F5Networks/f5-appsvcs-extension/issues/502)): Service Discovery can't be disabled if tasks endpoint not available
- AUTOTOOL-2690: ([GitHub Issue 493](https://github.com/F5Networks/f5-appsvcs-extension/issues/493)): controls.dryRun and controls.traceResponse breaking GCP service discovery
- AUTOTOOL-2738: ([GitHub Issue 508](https://github.com/F5Networks/f5-appsvcs-extension/issues/508)): Patch operations do not work with no initial declaration
- AUTOTOOL-2751: Patch action is not properly filtered by path
- AUTOTOOL-2770: State not properly rolled back on shareNodes failure
- AUTOTOOL-2781: ([GitHub 513](https://github.com/F5Networks/f5-appsvcs-extension/issues/513)): Escaping curly brackets in quoted strings

### Changed
- Updated to Service Discovery 1.10.1-1

### Removed

## 3.31.0

### Added
- AUTOTOOL-1242: ([GitHub Issue 226](https://github.com/F5Networks/f5-appsvcs-extension/issues/226)): Add HTML profile
- AUTOTOOL-1895: ([GitHub Issue 330](https://github.com/F5Networks/f5-appsvcs-extension/issues/330)): Support synCookieEnable/Allowlist for L4_Profiles
- AUTOTOOL-1795: ([GitHub Issue 321](https://github.com/F5Networks/f5-appsvcs-extension/issues/321)): OpenAPI documentation for /task endpoint when fetching results of a GET request
- AUTOTOOL-1793: ([GitHub Issue 320](https://github.com/F5Networks/f5-appsvcs-extension/issues/320)): OpenAPI spec is missing properties for results array for /task endpoint
- AUTOTOOL-2681: ([GitHub Issue 479](https://github.com/F5Networks/f5-appsvcs-extension/issues/479)): Pool member route domain (static)
- AUTOTOOL-2678: ([GitHub Issue 485](https://github.com/F5Networks/f5-appsvcs-extension/issues/485)): Add remaining HTML_Rules
- AUTOTOOL-1699: ([GitHub Issue 297](https://github.com/F5Networks/f5-appsvcs-extension/issues/297)): policyNAT now allowed on forwarding services

### Fixed
- AUTOTOOL-1630: ([GitHub Issue 278](https://github.com/F5Networks/f5-appsvcs-extension/issues/278)): Websocket profile is not attached from shared profile
- AUTOTOOL-2635: ([GitHub Issue 482](https://github.com/F5Networks/f5-appsvcs-extension/issues/482)): Respect the order in which Wide IP pools are provided

### Changed
- AUTOTOOL-2682: Update Service_Generic schema description
- Updated to Service Discovery 1.10.0-1
  - AUTOTOOL-2667: ([GitHub Issue 479](https://github.com/F5Networks/f5-appsvcs-extension/issues/479)): Pool member route domain (SD)

### Removed

## 3.30.1

### Added

### Fixed
AUTOTOOL-2707: Task fails due to maxBuffer exceeded

### Changed
- Updated to Service Discovery 1.9.3-3
  - AUTOTOOL-2707: Task fails due to maxBuffer exceeded

### Removed

## 3.30.0

### Added
- AUTOTOOL-2607: Add support for Controls.dryRun
- AUTOTOOL-1571: ([GitHub Issue 259](https://github.com/F5Networks/f5-appsvcs-extension/issues/259)): Support for external GSLB monitors
- AUTOTOOL-2534: ([GitHub Issue 455](https://github.com/F5Networks/f5-appsvcs-extension/issues/455)): Retry on network error (ECONNREFUSED, EAI_AGAIN, etc)
- AUTOTOOL-2608: Controls query parameters
- AUTOTOOL-2575: ([GitHub Issue 453](https://github.com/F5Networks/f5-appsvcs-extension/issues/453)): Add use support for chainCA property in Certificates
- AUTOTOOL-1241: HTML_Rule tag-append-html

### Fixed
- AUTOTOOL-2590: ([GitHub Issue 475](https://github.com/F5Networks/f5-appsvcs-extension/issues/475)): GSLB_Topology_Records fail when referencing GSLB_Pool
- AUTOTOOL-2637: ([GitHub Issue 483](https://github.com/F5Networks/f5-appsvcs-extension/issues/483)): AS3 sometimes tries to remove shared nodes that are in use by Service Discovery
- AUTOTOOL-2620: WAF policy load from file fails when using targetHost
- AUTOTOOL-2617: GSLB_Topology_Records can sometimes fail with "nonexistent pool" message when referencing GSLB_Pool (fixed on BIG-IP version 14.1+)
- AUTOTOOL-2618: GSLB_Topology_Records can sometimes fail with "already exists" message when referencing GSLB_Data_Center (fixed on BIG-IP version 14.1+)
- AUTOTOOL-2625: Tenant filtering does not work on BIG-IQ GET requests

### Changed
- AUTOTOOL-2452: Remove SD dependency for URLs with auth
- Updated to Service Discovery 1.9.2-1
  - AUTOTOOL-2637: Service Discovery removes metadata from nodes that are still in use by other tasks

### Removed

## 3.29.0

### Added
- AUTOTOOL-1055: ([GitHub Issue 184](https://github.com/F5Networks/f5-appsvcs-extension/issues/184)): Add iFile support
- AUTOTOOL-2508: Add Pool allow-nat and allow-snat support
- AUTOTOOL-2559: Add "remark" property to L4_Profile
- AUTOTOOL-2483: ([GitHub Issue 411](https://github.com/F5Networks/f5-appsvcs-extension/issues/411)): Add 'exists' and 'does-not-exist' operands for Endpoint_Policy_Compare_String
- AUTOTOOL-2548: Improve error when using profileBotDefense bigip-pointer on BIG-IPs prior to 14.1
- AUTOTOOL-2545: Add events to Policy_Condition_TCP

### Fixed
- AUTOTOOL-2469: ([GitHub Issue 450](https://github.com/F5Networks/f5-appsvcs-extension/issues/450)): AS3 fails to start due to socket hang-up error
- AUTOTOOL-1837: ([GitHub Issue 324](https://github.com/F5Networks/f5-appsvcs-extension/issues/324)): Error with IPv6 Service_Address on custom route domain
- AUTOTOOL-2377: ([GitHub Issue 436](https://github.com/F5Networks/f5-appsvcs-extension/issues/436)): TCP Monitor remove send/receive requirement to bring it in line with TMSH
- AUTOTOOL-2420: ([GitHub Issue 443](https://github.com/F5Networks/f5-appsvcs-extension/issues/443)): Persist /Common/Shared across multiple declarations
- AUTOTOOL-2514: Shared node logic failing for /Common/Shared
- AUTOTOOL-2522: ([GitHub Issue 461](https://github.com/F5Networks/f5-appsvcs-extension/issues/461)): Service Discovery is not idempotent when AS3 shared nodes overlap
- AUTOTOOL-2499: ([GitHub Issue 457](https://github.com/F5Networks/f5-appsvcs-extension/issues/457)): Tenants sometimes missing in responses and tasks when posting to declare/[Tenant].
- AUTOTOOL-2498: ([GitHub Issue 456](https://github.com/F5Networks/f5-appsvcs-extension/issues/456)): Order of returned tasks changed with 3.26.0
- AUTOTOOL-1871: ([GitHub Issue 332](https://github.com/F5Networks/f5-appsvcs-extension/issues/332)): Optimistic Lock Key breaks with Common tenant

### Changed
- Updated to Service Discovery 1.9.1-1
  - AUTOTOOL-2522: Service Discovery tags pre-existing nodes with metadata that share a discovered IP
  - AUTOTOOL-2441: Updated packages to reflect changes in cloud-libs
  - AUTOTOOL-2558: Fix GCE on BIG-IP 13.0-14.0
- AUTOTOOL-2567: Make ADC.id optional

### Removed

## 3.28.0

### Added
- AUTOTOOL-2378: Add metadata to determine if SD task is from AS3
- AUTOTOOL-2240: ([GitHub Issue 376](https://github.com/F5Networks/f5-appsvcs-extension/issues/376)): Expose hostname-whitelist as forwardProxyBypassAllowlist in TLS_Server
- AUTOTOOL-2264: Setting to disable and uninstall f5-service-discovery
- AUTOTOOL-1382: ([GitHub Issue 240](https://github.com/F5Networks/f5-appsvcs-extension/issues/240)): Add OAuth2 support to URL
- AUTOTOOL-2440: ([GitHub Issue 390](https://github.com/F5Networks/f5-appsvcs-extension/issues/390)): Add HTTP method Endpoint_Policy condition
- AUTOTOOL-2421: ([GitHub Issue 423](https://github.com/F5Networks/f5-appsvcs-extension/issues/423)): New client SSL profile naming scheme
- AUTOTOOL-2430: ([GitHub Issue 442](https://github.com/F5Networks/f5-appsvcs-extension/issues/442)): Option to disable the mode for TLS_Server

### Fixed
- AUTOTOOL-2371: websecurity profile overly being applied
- AUTOTOOL-2291: ([GitHub Issue 419](https://github.com/F5Networks/f5-appsvcs-extension/issues/419)): Declaration fails when shareAddresses is used with redirect80
- AUTOTOOL-2369: APM created nodes cause conflict failures
- AUTOTOOL-2367: ([GitHub Issue 304](https://github.com/F5Networks/f5-appsvcs-extension/issues/304)): clientTLS specified on unsupported Service returns "undefined" error
- AUTOTOOL-2438: Authentication failure on remote target host
- AUTOTOOL-2418: Normalize octal IP addresses into decimal format
- AUTOTOOL-2468: ([GitHub Issue 451](https://github.com/F5Networks/f5-appsvcs-extension/issues/451)): AS3 occasionally fails to start when loading ATG Storage config

### Changed
- Updated to Service Discovery 1.8.2-1
  - AUTOTOOL-2449: Add lastDiscoveryResult property to tasks
  - AUTOTOOL-2463: Fix Firewall_Address_List creation failures
  - AUTOTOOL-2462: Fix GCE on BIG-IP 13.0-14.0
- AUTOTOOL-2447: ([GitHub Issue 445](https://github.com/F5Networks/f5-appsvcs-extension/issues/445)): "code" value in /declare response is not always numeric

### Removed

## 3.27.0

### Added
- AUTOTOOL-252: ([GitHub Issue 85](https://github.com/F5Networks/f5-appsvcs-extension/issues/85)): Add mqttEnabled to Service_TCP
- AUTOTOOL-1151: ([GitHub Issue 210](https://github.com/F5Networks/f5-appsvcs-extension/issues/210)): Expose LTM policy tcl action
- AUTOTOOL-2238: Support projectId in GCE Address Discovery
- AUTOTOOL-2156: ([GitHub Issue 389](https://github.com/F5Networks/f5-appsvcs-extension/issues/389)): Add PostgreSQL monitor
- AUTOTOOL-2302: The option to disable f5-service-discovery (initial work)

### Fixed
- AUTOTOOL-2237: Virtual server missing profile required by iRule with WEBSSO
- AUTOTOOL-1884: ([GitHub Issue 340](https://github.com/F5Networks/f5-appsvcs-extension/issues/340)): /Common/Shared nodes conflict with shared nodes
- AUTOTOOL-2271: ([GitHub Issue 416](https://github.com/F5Networks/f5-appsvcs-extension/issues/416)): Unable to delete shared nodes that use fqdnPrefix property
- AUTOTOOL-2214: ([GitHub Issue 408](https://github.com/F5Networks/f5-appsvcs-extension/issues/408)): Fix handling of escaped quotation mark
- AUTOTOOL-2140: ([GitHub Issue 401](https://github.com/F5Networks/f5-appsvcs-extension/issues/401)): Fix SD error when show=expanded
- AUTOTOOL-2272: ([GitHub Issue 418](https://github.com/F5Networks/f5-appsvcs-extension/issues/418)): Cannot read property 'forEach' of undefined
- AUTOTOOL-2202: ([GitHub Issue 406](https://github.com/F5Networks/f5-appsvcs-extension/issues/406)): Global lock is sometimes released twice
- AUTOTOOL-2294: iRule expansion doesn't work inside iRule imported via URL

### Changed
- AUTOTOOL-1243: ([GitHub Issue 234](https://github.com/F5Networks/f5-appsvcs-extension/issues/234)): Remove f5label and f5remark custom schema formats
- Remove f5base64 and f5long-id custom schema formats
- AUTOTOOL-2265: ([GitHub Issue 325](https://github.com/F5Networks/f5-appsvcs-extension/issues/325)): Service_Forwarding objects should disable ARP and ICMP Echo
- AUTOTOOL-2324: ([GitHub Issue 426](https://github.com/F5Networks/f5-appsvcs-extension/issues/426)): Update schema description for Policy_Action_Persist disable property
- AUTOTOOL-2263: Improve performance of ASM policy fetches

### Removed

## 3.26.1

### Added

### Fixed
- AUTOTOOL-2454: ([GitHub Issue 446](https://github.com/F5Networks/f5-appsvcs-extension/issues/446)): AS3.26 failed installation on 12.1.x. This is just a rebuild with a different rpmbuild version. No functional changes.

### Changed

### Removed

## 3.26.0

### Deprecated
- This release will be the last release to support BIG-IP 12.1

### Added
- AUTOTOOL-577: ([GitHub Issue 270](https://github.com/F5Networks/f5-appsvcs-extension/issues/270)): Adding new botDefense properties to Security_Log_Profile
- AUTOTOOL-2055: ([GitHub Issue 375](https://github.com/F5Networks/f5-appsvcs-extension/issues/375)) Embed JSON/XML WAF policies in AS3 declaration
- AUTOTOOL-1965: ([GitHub Issue 68](https://github.com/F5Networks/f5-appsvcs-extension/issues/68)): API protection profile reference in Service_HTTP(S)

### Fixed
- AUTOTOOL-2087: ([GitHub Issue 391](https://github.com/F5Networks/f5-appsvcs-extension/issues/391)): GET on /info or /declare endpoint cause BIG-IP to go into "Changes Pending" in HA
- AUTOTOOL-1375: Unchecked mode now properly handles iControl_post commands
- AUTOTOOL-2216: ([GitHub Issue 409](https://github.com/F5Networks/f5-appsvcs-extension/issues/409)): FQDN service discovery does not create node in /Common when shareNodes: true
- AUTOTOOL-2217: ([GitHub Issue 410](https://github.com/F5Networks/f5-appsvcs-extension/issues/410)): Fix handling of Certificate chainCA references
- AUTOTOOL-2208: "Cannot convert undefined or null to object" when configuring consul via BIG-IQ
- AUTOTOOL-2247: GSLB Wide IP last-resort-pool now requires a value if in the CLI
- AUTOTOOL-2589: ([GitHub Issue 474](https://github.com/F5Networks/f5-appsvcs-extension/issues/474)): responseTemplate trouble with curly braces

### Changed
- AUTOTOOL-2093: Alias and deprecate various properties in DOS_Profile class
- AUTOTOOL-2065: Improve error message with invalid JWE protected header
- AUTOTOOL-2162: Improve error message around modifying Service Address address

### Removed

## 3.25.0

### Added
- AUTOTOOL-2010: The property synCookieAllowlist as a functionally equivalent and eventual replacement of synCookieWhitelist in the TCP_Profile class
- AUTOTOOL-2064: ([GitHub Issue 374](https://github.com/F5Networks/f5-appsvcs-extension/issues/374)): Add enabled property to GSLB_Pool_Member classes
- AUTOTOOL-1881: Log version on startup
- AUTOTOOL-2102: ([GitHub Issue 381](https://github.com/F5Networks/f5-appsvcs-extension/issues/381)): Add renegotiationEnabled and retainCertificateEnabled properties to TLS_Client and TLS_Server classes
- AUTOTOOL-2103: ([GitHub Issue 380](https://github.com/F5Networks/f5-appsvcs-extension/issues/380)): Add Monitor HTTP/2 class

### Fixed
- Service failure when including reference to Service_Address and SNAT is set to "self"
- AUTOTOOL-864: ([GitHub Issue 172](https://github.com/F5Networks/f5-appsvcs-extension/issues/172)): HTTP2 profiles are not compatible with Service_HTTP
- AUTOTOOL-1572: Service source address does not match route domain of Service_Address on BIG-IP
- AUTOTOOL-2068: Access profiles not updated if they are referenced by an iRule
- AUTOTOOL-2057: ([GitHub Issue 378](https://github.com/F5Networks/f5-appsvcs-extension/issues/378)): Unable to delete string data-group record with port
- AUTOTOOL-1979: Imported Access Profiles leave duplicates in tenant root
- AUTOTOOL-2035: ([GitHub Issue 370](https://github.com/F5Networks/f5-appsvcs-extension/issues/370)): Service in /Common is not idempotent
- AUTOTOOL-2100: Unable to create an Endpoint_Policy when using semi-colons
- AUTOTOOL-638: ([GitHub Issue 122](https://github.com/F5Networks/f5-appsvcs-extension/issues/122)): Data store interactions cause errors in mcpd log

### Changed
- Updated to Service Discovery 1.5.0-3
  - AUTOTOOL-2049: Service Discovery sometimes fails. Fix race condition for event based tasks. (1.4.1-1)
  - AUTOTOOL-1213: Add managed identities support to Azure Service Discovery (1.5.0-1)
  - AUTOTOOL-2088: Use Address field rather than Node field for Consul
  - AUTOTOOL-638: ([GitHub Issue 122](https://github.com/F5Networks/f5-appsvcs-extension/issues/122)) Data store interactions cause errors in mcpd log
- AUTOTOOL-2107: Disallow renaming GSLB_Server in /Common
- Update sending of Common/Shared for BIG-IQ 8.0

### Removed

## 3.24.0

### Added
- AUTOTOOL-1880: AS3 now updates virtuals to point to updated APM access profiles (AS3 Access_Profile class)
- AUTOTOOL-1893: ([GitHub Issue 329](https://github.com/F5Networks/f5-appsvcs-extension/issues/329)): Add support for depends-on property for GSLB Pool members
- AUTOTOOL-1945: Add fqdnPrefix property to Pool_Member
- AUTOTOOL-1919: Validated support for Declarative WAF
- AUTOTOOL-576: ([GitHub Issue 117](https://github.com/F5Networks/f5-appsvcs-extension/issues/117) and [163](https://github.com/F5Networks/f5-appsvcs-extension/issues/163)): allow custom jmesquery to fetch ports for Consul Service Discovery
- Allow configuration of async task storage through /settings
- AUTOTOOL-2044: Add environmentVariables property to Monitor_External class
- AUTOTOOL-2048: ([GitHub Issue 173](https://github.com/F5Networks/f5-appsvcs-extension/issues/173)): Allow $schema property in declarations
- AUTOTOOL-1391: ([GitHub Issue 242](https://github.com/F5Networks/f5-appsvcs-extension/issues/242)): Add support for HTTP MRF Routing on Services
- AUTOTOOL-1603: Add egress option for profileHTTP2
- AUTOTOOL-1053: ([GitHub Issue 153](https://github.com/F5Networks/f5-appsvcs-extension/issues/153)): VDI profile reference

### Fixed
- AUTOTOOL-1787: Unable to overwrite WAF policy settings if URL does not end with '.xml'
- AUTOTOOL-1999: IPv6 source address of `::` is mangled and configured as `:`
- AUTOTOOL-1946: ([GitHub Issue 345](https://github.com/F5Networks/f5-appsvcs-extension/issues/345)): CIDR address not applied to redirect server
- AUTOTOOL-1885: ([GitHub Issue 339](https://github.com/F5Networks/f5-appsvcs-extension/issues/339)): Incorrect Service netmask value from Service_Address on BIG-IP
- AUTOTOOL-1839: ([GitHub Issue 313](https://github.com/F5Networks/f5-appsvcs-extension/issues/313)): Use style pointers do not work across multiple declarations

### Changed
- Updated to Service Discovery 1.4.0-1
  - AUTOTOOL-1751,AUTOTOOL-650,AUTOTOOL-969,AUTOTOOL-780: bulk add/delete nodes
  - create "lock" around issuing tmsh commands (only allow one at a time)
  - distribute tasks across time interval
  - fixes to error handling when update failed
  - avoid unncessary tmsh updates
  - fix error where nodes persisted after deleting task
  - run update as an async process
  - defer saves to DataStore
  - AUTOTOOL-576: allow custom jmesquery to fetch ports
- AUTOTOOL-1853: Update npm packages

### Removed

## 3.23.0

### Added
- AUTOTOOL-1687: Reuse service discovery results with multiple pools.
- AUTOTOOL-1835: Add alertTimeout property to TLS_Client and TLS_Server classes.
- AUTOTOOL-1766: Add ports to Procotol_Inspection_Profile.
- AUTOTOOL-1734: ([GitHub Issue 307](https://github.com/F5Networks/f5-appsvcs-extension/issues/307)): Add keepAliveInterval to L4_Profile
- AUTOTOOL-688: ([GitHub Issue 124](https://github.com/F5Networks/f5-appsvcs-extension/issues/124)): Add support for Per_Request_Access_Policy
- AUTOTOOL-1481: Add /settings endpoint for enabling burstHandling.
- AUTOTOOL-1844: Add 'enable' property to Access_Profile to allow for applying an Access Profile
- AUTOTOOL-1904: Add profileNTLM to Service_HTTP and Service_HTTPS classes
- AUTOTOOL-1714: ([GitHub Issue 301](https://github.com/F5Networks/f5-appsvcs-extension/issues/301)): Add Monitor_MySQL class.
- AUTOTOOL-1439: Finish burst handling feature

### Fixed
- AUTOTOOL-613: Fix GSLB_Topology_Region reference to other GSLB_Topology_Region within a declaration.

### Changed

### Removed

## 3.22.0

### Added
- AUTOTOOL-1708: Allow use of scale set name for service discovery in Azure. Update service discovery version to accept resourceId/resourceType for scale set.

### Fixed
- AUTOTOOL-1588: ([GitHub Issue 273](https://github.com/F5Networks/f5-appsvcs-extension/issues/273)): Duplicate botDefense profiles
- Async data store creation can sometimes error on older BIG-IP versions
- AUTOTOOL-1776: ([GitHub Issue 317](https://github.com/F5Networks/f5-appsvcs-extension/issues/317)): Schema is unreliable if application template is undefined
- AUTOTOOL-1775: ([GitHub Issue 319](https://github.com/F5Networks/f5-appsvcs-extension/issues/319)): Fix Service virtualAddresses idempotency when using 0.0.0.0 and shareAddresses set to true

### Changed
- Updated to Service Discovery 1.3.1-1

### Removed

## 3.21.0

### Added
- AUTOTOOL-207: Add a custom name feature to GSLB Virtual Servers
- AUTOTOOL-836: Access Profile support url that is a .gz file
- AUTOTOOL-548: Add cacheTimeout for TLS_Client and TLS_Server
- AUTOTOOL-1691: Add serviceDownImmediateAction to Services

### Fixed
- AUTOTOOL-1626: ([GitHub Issue 284](https://github.com/F5Networks/f5-appsvcs-extension/issues/284)): Increase maximum value of HTTP_Compress bufferSize to 4294967295
- AUTOTOOL-1625: Incorrect property name in DNS cache example declaration
- AUTOTOOL-1633: ([GitHub Issue 282](https://github.com/F5Networks/f5-appsvcs-extension/issues/282)): Unable to use SRV records in DNS local zones
- AUTOTOOL-1368: Receiving "wrong # args" in cli script error messages
- AUTOTOOL-1436: ([GitHub Issue 246](https://github.com/F5Networks/f5-appsvcs-extension/issues/246)): Access_Profile import fail with garbled response
- AUTOTOOL-1524: ([GitHub Issue 263](https://github.com/F5Networks/f5-appsvcs-extension/issues/263)): Data store memory leak
- AUTOTOOL-1624: [GitHub Issue 110](https://github.com/F5Networks/f5-appsvcs-extension/issues/110)): Unable to delete declaration after pool monitor modification
- AUTOTOOL-1592: Multi-tenant declarations fail when sharing addresses across tenants

### Changed
- Improve reliability of async task clean up
- AUTOTOOL-1525: Update npm packages

### Removed
- AUTOTOOL-1590: Remove slim rpm code

## 3.20.0

### Added
- AUTOTOOL-973: ([GitHub Issue 160](https://github.com/F5Networks/f5-appsvcs-extension/issues/160)): Ability to reference all 'gtm monitor' types with 'bigip' keyword.
- AUTOTOOL-1221: Support traceResponse feature on asynchronous requests
- AUTOTOOL-1365: Adding value property to Protocol_Inspection_Profile service compliance checks
- AUTOTOOL-1366: Adding protocolInspection to Security_Log_Profile
- AUTOTOOL-1504: Adding Endpoint_Policy HTTP Redirect Status Code
- AUTOTOOL-1152: Adding Endpoint_Policy TCP address and port conditions
- AUTOTOOL-1540: Adding support for `use` keyword when referencing FTP_Profile
- AUTOTOOL-1367: Adding support for management-port type Log_Destination
- AUTOTOOL-1301: Re-use virtual address on IP conflict
- AUTOTOOL-1372: NAT translation exclusion addresses
- AUTOTOOL-1302: Added shareAddresses option to services
- AUTOTOOL-1512:([GitHub Issue 255](https://github.com/F5Networks/f5-appsvcs-extension/issues/255)): Add ingress option for profileHTTP2

### Fixed
- Fix Data_Group key validation
- Modify schema to improve compatibility with BIG-IQ 7.0
- [GitHub Issue 258](https://github.com/F5Networks/f5-appsvcs-extension/issues/258): Fix maximum value on hstsPeriod
- AUTOTOOL-1551: `Unexpected json property` message in icrd log when processing declaration

### Changed
- AUTOTOOL-1299: Set userAgent string on declarations sent from BIG-IQ
- AUTOTOOL-978: ([GitHub Issue 251](https://github.com/F5Networks/f5-appsvcs-extension/issues/251)): Make generic the default Application template
- Update @f5devcentral/f5-teem package dependency to 1.4.6

## 3.19.0

### Added
- AUTOTOOL-1278: Add maximumBandwidth to Services
- AUTOTOOL-1234: ([GitHub Issue 233](https://github.com/F5Networks/f5-appsvcs-extension/issues/233)): Added additional TLS options
- AUTOTOOL-1354: Add the option to specify the value of the Service_Core translateClientPort property as a string (as well as a boolean) and added the additional setting 'preserve-strict'.
- AUTOTOOL-1222: Add experimental burst handling feature. This is disabled by default
- AUTOTOOL-1118: Add timer policies ('net timer-policy') to services via policyIdleTimeout property.
- AUTOTOOL-1120: Support the creation of Idle_Timeout_Policy ('net timer-policy').
- AUTOTOOL-1081: ([GitHub Issue 199](https://github.com/F5Networks/f5-appsvcs-extension/issues/199)): Add SSL forward proxy settings to TLS_Server and TLS_Client.
- AUTOTOOL-630: Add support to reference bandwidth control policies from services via policyBandwidthControl property.
- AUTOTOOL-859: Add support to reference virtualAddresses using the `bigip` keyword from Service_Core.

### Fixed
- AUTOTOOL-1244: Wrong netmask can be configured when a Service_Address precedes a Service_Core-derived class in the declaration that refers to the Service_Address with the `use` keyword.
- AUTOTOOL-1485: TLS_Server SSL forward proxy settings are not idempotent on BIG-IP 12.1
- AUTOTOOL-1293: Occasional timeouts waiting for CLI script
- AUTOTOOL-1463: AS3 errors on DOS_Profile when disabling scrubbingEnable and rtbhEnable.
- [GitHub Issue 247](https://github.com/F5Networks/f5-appsvcs-extension/issues/247): Requests to tenant endpoints over-validate

### Changed
- AUTOTOOL-1257: Update service discovery version to no longer delete and then recreate nodes when a task is updated
- AUTOTOOL-1384: Update service discovery version to update nodes if the node prefix changes
- AUTOTOOL-1013: Update AS3 to use the f5-teem 1.4.0 reportRecord() API

### Removed

## 3.18.0

### Added
- AUTOTOOL-752 ([GitHub Issue 147](https://github.com/F5Networks/f5-appsvcs-extension/issues/147)): Enable traces in responses
- AUTOTOOL-409: Implement forwarding service
- AUTOTOOL-1201: Add userAgent to controls for TEEM reports
- AUTOTOOL-603: Basic auth support for url references

### Fixed
- AUTOTOOL-1063: Cannot use malformed DOS vector
- AUTOTOOL-1164: Incorrect word wrapping applied to external monitors
- AUTOTOOL-1182: Path lengths improperly being labeled as too long
- AUTOTOOL-1171: Declarations fail when including Pkcs12 encrypted passphrase
- Possible conflict error when using shareNodes with service discovery
- AUTOTOOL-1181: BIG-IQ doesn't appear to support TLS1.3 through AS3
- [GitHub Issue 232](https://github.com/F5Networks/f5-appsvcs-extension/issues/232): restnoded restarts immediately after posting the declaration

### Changed
- AUTOTOOL-1052 ([GitHub Issue 201](https://github.com/F5Networks/f5-appsvcs-extension/issues/201)): clientTLS and serverTLS can now refer to multiple existing profiles
- Ease restrictions on endpoint policy rule names
- AUTOTOOL-1190: Update service discovery version to not show Azure secrets in restnoded log

### Removed

## 3.17.1

### Added

### Fixed
- AUTOTOOL-1182: Path lengths improperly being labeled as too long

### Changed

### Removed

## 3.17.0

### Added
- AUTOTOOL-871: Add support for enabling tls v1.3 on SSL profiles
- AUTOTOOL-990: Add support for "use" pattern to refer to Pool and iRules from Services, iRule from Persist_Hash
- AUTOTOOL-984: Add support for creating cipher rules
- AUTOTOOL-985: Add support for creating cipher groups and referencing cipher rules
- AUTOTOOL-691: Add support to reference cipher groups from TLS Profiles
- AUTOTOOL-1077: Allow use-style pointers on policyEndpoint property
- AUTOTOOL-758: Add support for negative policy operands
- AUTOTOOL-600: Add support for attaching Bot-Defense Profile to a Service
- AUTOTOOL-879: Add support for creating Protocol Inspection Profiles and attaching Protocol Inspection Profiles to a Service

### Fixed
- AUTOTOOL-1084: Changing a referenced monitor's dest address (to/from wildcard) can cause HA sync issues
- AUTOTOOL-605: Improved idempotency of dns and ldap monitors as well as adding property tests
- AUTOTOOL-618: Fixed used of 'action: dry-run' when running on BIG-IQ
- AUTOTOOL-1080: Fixed regression for cipher rules and cipher groups on 12.1
- AUTOTOOL-1058: Fixed idempotency of GSLB_Pool (A, AAAA) and GSLB_Server on BIG-IP 15+
- AUTOTOOL-1039: FQDN members break deploy in 3.16.0

### Changed
- AUTOTOOL-924: Updated the SD example to include credential fields
- AUTOTOOL-987: Allow for longer names as long as full path `<` 195 characters
- AUTOTOOL-997: Allow dot and dash in tenant and application

### Removed

## 3.16.0

### Added
- AUTOTOOL-549: Add support for PEM iRule
- AUTOTOOL-746: Add ability for virtual servers to reference Service_Address and set source address
- AUTOTOOL-659: Add url reference for Access Profiles
- AUTOTOOL-792: Add ability to create an internal virtual server
- AUTOTOOL-801: Add serverTechnologies override to WAF_Policy
- AUTOTOOL-743: Add ability to create an ICAP profile
- AUTOTOOL-847: Allow "." and "-" in application item names, and change suffix of auto-generated objects from "-{\$index}" to "-{\$index}-"
- AUTOTOOL-745: Add support for request/response Adapt Profiles
- AUTOTOOL-793: Add disabledSignatures override to WAF_Policy
- AUTOTOOL-873: Add ip-low-ttl and non-tcp-connection for DOS_Profile Network vectors
- AUTOTOOL-874: Add nxdomain and qdcount for DOS_Profile DNS vectors
- AUTOTOOL-444: Add ability to disable certificate checking on specific URL

### Fixed
- AUTOTOOL-619: Service_TCP adds 'botDefense' profile when ASM not provisioned on BIG-IP 14.1+
- AUTOTOOL-756: Event-Driven SD: pool members deleted when monitor changed
- AUTOTOOL-750: HTTP_Profile's properties 'responseChunking' and 'requestChunking' are not compatible with BIG-IP 15.0+
- [GitHub Issue 166](https://github.com/F5Networks/f5-appsvcs-extension/issues/166): WAF policy changes are not applied
- AUTOTOOL-715: Stored declaration is not updated in "no change" operations
- AUTOTOOL-808: Fix handling of user defined storage formats in Security_Log_Profile
- AUTOTOOL-872: Expanded declaration is stored by default on BIG-IQ, which causes re-POST and PATCH failures with schema overlay
- AUTOTOOL-878: File upload to BIG-IP can fail if partial upload of file already exists
- AUTOTOOL-754: Error message that could have cert and keys in it. The message will be much more general now.
- AUTOTOOL-911: Error when declaring CA_Bundle with existing cert (certItem[contentKey].replace is not a function)
- AUTOTOOL-923: Incorrect Container device type is assigned instead of actual product (BIG-IQ, BIG-IP)
- AUTOTOOL-860: When declaring multiple GSLB_Domain objects with the same domain only 1 was being created
- AUTOTOOL-942 and AUTOTOOL-952: Improve reliability of Service Discovery installation on remote target
- AUTOTOOL-989: An error can occur if event driven nodes use their ip address as an id
- AUTOTOOL-932: AS3 service discovery does not work after live install upgrade in GCP
- AUTOTOOL-1002: Improved reliability of authorization token collection test
- AUTOTOOL-998 Fix basicAuth and token related failures when submitting iControl requests

### Changed
- AUTOTOOL-749: Improved reliability during AS3 startup
- AUTOTOOL-774: Refactor Declaration.js (declareHandler)
- AUTOTOOL-885: Refactor targetContext (infrastructure)
- AUTOTOOL-888: Refactor targetContext - device type, version, and provisioned modules
- AUTOTOOL-892: Refactor-rename declaration and other classes to match their intent
- AUTOTOOL-732: Update Service Discovery version to support updateInterval `<` 10
- AUTOTOOL-925: Improve reliability of some integration tests
- AUTOTOOL-854: Update packages
- AUTOTOOL-934: Use retry on 503 when running integration collection tests
- AUTOTOOL-950: Clean up unit tests to stub globals and restore properly
- AUTOTOOL-867: Clean up and add new Container integration tests
- AUTOTOOL-898: Add unit testing around mutex locking
- AUTOTOOL-887: Refactor to clean up code in audit

### Removed

## 3.15.0

### Added
- AUTOTOOL-709: Add ability for NAT Policy Rules to reference Security Log Profiles
- AUTOTOOL-706: Add references to PPTP profiles from virtuals
- AUTOTOOL-707: Add VLANs as a source for firewall rules
- AUTOTOOL-731: Add Service_SCTP class and support for referencing SCTP profiles
- AUTOTOOL-742: Add references to request and response adapt profiles
- AUTOTOOL-741: Add reference to ICAP profiles

### Fixed
- AUTOTOOL-627: Semicolon in endpoint policy rule location causes errors
- AUTOTOOL-628: Endpoint policy rule that contains "wam" incorrectly adds "acceleration" to the policy controls object
- AUTOTOOL-711: Unable to remove declaration after posting to service discovery endpoint multiple times
- Reduce log severity when previous declaration is not found on startup
- Fix mis-application of bot-defense when ASM is not provisioned

### Changed
- AUTOTOOL-307: Refactor host context
- AUTOTOOL-308: Refactor request context
- AUTOTOOL-734: Improved performance when querying certain LTM objects on the BIG-IP
- AUTOTOOL-666: Update to new F5 TEEM analytics reporting code
- AUTOTOOL-575: Update Service Discovery version to enable support for event-driven port discovery

### Removed

## 3.14.0

### Added
- AUTOTOOL-370: Allow enabling NAT64 on Virtual Server
- AUTOTOOL-369: Add ability to reference RTSP profiles
- AUTOTOOL-503: Add ability to filter declaration tenants via the URI
- AUTOTOOL-288: Add optimisticLockKey to POST output when showHash=true is used
- AUTOTOOL-393: Add ability to reference connectivity and access profiles
- AUTOTOOL-372: Add ability to reference existing TFTP profiles
- AUTOTOOL-262: Add Analytics TCP profile
- AUTOTOOL-558: Add ability to reference existing FPS Profile
- AUTOTOOL-347: Add support for BBR congestion control. TMOS version 14.1 only

### Fixed
- AUTOTOOL-556: Unable to utilize the bigip keyword with profileDOS in a virtual
- AUTOTOOL-586: Fix possible socket hang up errors with service discovery
- AUTOTOOL-626: Fix issue where invalid properties would not get caught by validation when async=true
- AUTOTOOL-651: Unable to update static pool members when event driven discovery is used
- AUTOTOOL-497: Clean up service discovery tasks when AS3 fails

### Changed

### Removed

## 3.13.0

### Added
- GS-1064: Allow changing the enforcement mode of a WAF policy fetched from a URL
- AUTOTOOL-450: Add ability to attach client TLS to HTTPS Monitor
- Allow for including one section of a declaration in another using the 'include' property.
- AUTOTOOL-291: Add ability to create HTTP2_Profile and attach to Service_HTTPS
- AUTOTOOL-291: Add 'renegotiationEnabled' property to TLS_Server
- AUTOTOOL-447: Add support for reject and accept-decisively Firewall_Rule actions
- AUTOTOOL-264: Add DNS_Cache

### Fixed
- GS-1060: Analytics profile fails after upgrading between AS3 versions
- AUTOTOOL-450: Fix problem where using bigip reference to certificate wouldn't also reference the key
- AUTOTOOL-430: Allow GSLB Virtual Server to accept 0 for port and addressTranslationPort
- Allow for configuration of security log profile when ASM is not provisioned
- AUTOTOOL-404: Cannot reference pre-existing endpoint policies
- AUTOTOOL-436: Allow 'all' value for Pool minimumMonitors
- Fix DOS_Profile's bot defense mode option on BIG-IP 14.1+
- Fix idempotency issues in DOS_Profile on BIG-IP 14.1+
- AUTOTOOL-553: Allow reference to existing policy when ASM is not provisioned

### Changed

### Removed

## 3.12.1

### Added

### Fixed
- GS-1060: Analytics profile fails after upgrading between AS3 versions
- GS-1062: iRules failing due to non-existant object expand, when sending declarations through BIG-IQ
- GS-1065: BIG-IQ request fails when using radius auth token for user

### Changed

### Removed

## 3.12.0

### Added
- GS-844: Allow POST with patchBody target value for BIG-IQ 7.0+
- DNS profiles can point to transparent and validating resolver caches
- AUTOTOOL-331: Added authenticationFrequency to TLS_Client
- AUTOTOOL-223: Allow referenced iRulesLX Profiles in virtual servers (only 13.0+)

### Fixed
- GS-1056: BIG-IQ 6.1 rejects pkcs12Options
- GS-1047: AS3 cannot create IPv6 wildcard fastL4 VS
- GS-1036: Service Discovery nodes created only in /Common/
- GS-1009: schemaOverlay can conflict with defaults during a patch action
- GS-1039: AWS Service Discovery needs to be deployed twice to be successful
- AUTOTOOL-373: SNAT not applied to NAT policy
- AUTOTOOL-358: BIG-IQ can sometimes fail to authorize with X-F5-Auth-Token
- AUTOTOOL-315: Generic GSLB servers can not be created without any monitors
- AUTOTOOL-405: Address that has 'use' which refers to an address of 0.0.0.0 causes wrong mask

### Changed

### Removed

## 3.11.0

### Added
- GS-268: Redeploy history post-DELETE
- GS-932: Support GSLB_Server Virtual Server Auto Discovery and Route Domain Options
- GS-963: Added support for Persist Policy Endpoint
- GS-1003: Expose Certificate_Validator_OCSP signing properties
- GS-1022: Enable "use" property for Pointer_SSL_Certificate
- GS-1002: Implement staplerOCSP property for Certificate and OCSP stapling property for TLS_Server
- GS-887: Consul service discovery support for CA certificates and skipping server certificate validation

### Fixed
- GS-964: HTTP Redirects not working when fetching remote WAF_Policy file
- GS-950: id value of null causes rest framework timeout
- GS-983: Attach LDAP Profile startTLS to virtual server
- GS-951: Missing bot-defense profile properties for 14.1
- GS-1001: /CIDR notation is not working in Service_HTTP
- GS-1014: Deleting tenant, also deleted GSLB topology
- GS-997: Service_L4 declarations failing in TMSH with profileTrafficLogs

### Changed
- GS-822: Increase the character limit of property name, label, and remark form 47 to 64

### Removed

## 3.10.0

### Added
- GS-849: Application section of Security_Log_Profile
- GS-884: Add support for stream profile
- GS-850: Add support for `splunk` type in Log_Destination class
- GS-875: Add support for LDAP Client and Server Profiles
- GS-832: Add support for FTP profile
- GS-833: Add support for FTP Monitors
- GS-910: Add support for sending multiple declarations in a request (declarations array)
- GS-824: Add support for SSH proxy profiles
- GS-886: Add support for acceleratedSignaturesEnabled and tlsSignaturesEnabled properties for DOS_Profile
- GS-924: Add support for /CIDR netmasking

### Fixed
- GS-906: AS3 fails to start if restjavad is not fully ready
- GS-900: Malformed POST body causes restnoded to reboot
- GS-894: ?async=true universally triggers cloud-libs installation
- GS-897: Large declarations report failure
- DNS Profiles with default properties can error on 12.1
- GS-880: POST requests to the /declare endpoint on BIG-IQ always trigger cloud-libs install
- Cloud-libs always installs from Container
- GS-879: Disable non-POST requests for Container
- GS-919: Discovery worker encryption fails on 14.1
- GS-704: Empty array in declaration throws error
- GS-893: Unwanted error messages in /var/log/ltm
- GS-929: Security_Log_Profile declaration produced errors if storageFormat key was not provided
- Radius_Profile not idempotent on Big-IP 13.0
- GS-899: PATCH requests to BIG-IQ are not always applied to the right tenant
- GS-927: PATCH async=true does not work
- GS-610: No addresses in Firewall_Address_List throws error
- GS-878: The /task endpoint does not work when running in a container
- GS-924: authenticationTrustCA not validating in Visual Studio Code
- GS-941: Upgrading AS3 can fail when Telemetry Streaming is already installed
- GS-923: Deleting a large config throws "connection refused" error
- GS-947: Posting to AS3 container can fail querying Service-Discovery config from target device
- GS-948: Cannot add a wildcard virtual address with defaultRouteDomain
- GS-928: Pool members not deleted properly
- GS-968: Multi-declaration posts periodically fail to 'Cannot read property installCloudLibsNeeded of undefined'
- GS-986: Error POSTing declaration with large number of Endpoint_Policy referencing asm policies

### Changed
- GS-930: Improve consistency of async responses

### Removed

## 3.9.0

### Added
- Support remarks on endpoint policies and endpoint policy rules
- Initial work to support for multiple declaration requests (declarations array)
- Add support for specifying clone pools on virtual servers
- Add support for creating HTTP_Acceleration_Profile and attaching to virtual
- Add support for analytics profile capture filter
- Add support for TLS_Server and TLS_Client C3D Features
- Add support for event-driven service discovery
- Improve usability of JSON Schema with VS Code
- Improved /docs/\* example declaration searchability

### Fixed
- GS-761: Unable to update parentProfile for Classification_Profile
- GS-838: Unable to delete Classification_Profile
- GS-835: Unable to update parentProfile for Radius_Profile and IP_Other_Profile
- GS-835: Unable to create Radius_Profile or update other properties when PEM is not provisioned
- Unable to resume declaration if interrupted by cloud-libs installation
- GS-863: Discovery Worker Pool Members not respecting per-member settings
- GS-804: DNS_Zone class not idemtotent
- GSLB_Server declarations are not idempotent
- GSLB_Pools can encounter read-only metadata failure
- GS-840: HTTP_Profile fallbackRedirect: declaration is invalid should match format URL, not Hostname
- GS-831: translateServerAddress for virtuals not set to correct default on 12.1
- GS-851: Unable to use non-default tcp profile on HTTPS services on 12.1
- GS-814: External monitors not created or deleted properly
- GS-834: Idempotence problem with HTTP_Compress
- GS-855: Leftover declaration after POSTing almost empty tenant
- GS-847: Requests may incorrectly return 202 for service discovery component installation
- GS-811: Encryption/secret invalid radius server value on 14.1
- Service discovery pool members set the pool monitor as their per-member monitor
- GS-842: Unable to attach WAF policy to service
- GS-856: AS3 fails to start in container
- GS-872: AS3 sometimes deletes gtm pools from /Common on 12.1
- GS-783: Unable to detect management port 8443 on 1-NIC deployments by default
- GS-859: Endpoint_Strategy operands to do not parse correctly
- GS-860: Enforcement_Radius_AAA_Profile not idempotent
- Enforcement_Service_Chain_Endpoint fails to create service-endpoints
- GS-866: Enforcement_Policy fails to DELETE when using serviceChain
- GS-865: Enforcement Format Script can't ready property 'tclScript' of undefined
- GS-864: Enforcement_Format_Script can't read property 'replace' of undefined
- GS-867: Enforcement_Policy not idempotent with flowInfoFilters
- GS-871: Idempotence problem with Log_Publisher when removing description
- GS-841: insertHeader of HTTP_Profile adds slash
- GS-873: Some remote users could not successfully complete declarations
- GS-881: Unable to POST DNS_Profile without setting loggingEnabled to false

### Changed

### Removed

## 3.8.0

### Added
- Add support for Route Advertisement for Service_Address to be used by Virtual Servers
- Add support for RADIUS health monitor
- Add support for generated id's
- Add data-groups integration for discovery workers
- Update f5-cloud-libs package to v4.6.1
- Add support for Traffic_Log_Profile and to attach to Virtual Servers
- Add Service_TCP support for referencing existing SIP and FTP Profiles
- Fix endpoint policies using waf actions
- Allow a waf action to specify no policy to disable waf
- Support TLS_Server certificate matchToSNI
- Support Multiplex_Profile creation
- Add support for creating Websocket profiles and attaching to virtual servers
- Fixed cloudLibs installation on single nic Big-IPs
- Add support creating Rewrite_Profile and attaching to virtual server
- Add sslExtension conditions to endpoint policies
- Add http actions to endpoint policies
- Improved service discovery through a new Service Discovery worker

### Fixed
- GS-723: chainCA Common reference throws error
- Security_Log_Profile Schema incorrectly contains string values for booleans
- Remark fields do not work on analytics profiles, DNS nameservers, GSLB servers, and multiplex profiles
- GS-790: The tcpOptions for TCP_Profile are not always idempotent
- GS-778: Cannot rename FQDN nodes

### Changed

### Removed

## 3.7.1

### Added
- Add Service_TCP support for referencing existing SIP and FTP Profiles
- Allow a waf action to specify no policy to disable waf
- Support TLS_Server certificate matchToSNI
- Support Multiplex_Profile creation

### Fixed
- Fix endpoint policies using waf actions

### Changed

### Removed

## 3.7.0

### Added
- Add support for importing PKCS#12 certificates (.p12/.pfx)
- Add support for validating a duplicated rules name on each class
- Add selfLink to async responses
- Add support to TCP_Profile for tcp options.
- Add support for arbitrary Metadata in Application objects and Services
- Add support for creating ltm external monitor with existed/new system external monitor file
- Added asynchronous behaviour when about to timeout (45 seconds)
- Add support for Hashicorp Consul service discovery
- Add support for serverSsl endpoint policy action
- GS-686: Add unique hash value for tenants to determine if updated since a GET request was used to get the declaration
- Add trafficGroup property to Service_Address

### Fixed
- GS-672: Creating an Analytics_Profile on BIG-IP 13.1.x.y may throw an error.
- GS-667: Large async requests can cause tmsh errors
- GS-654: AS3 always contains all tenants in response
- GS-654: Special characters in data group keys cause a 500 status code response
- GS-719: Unable to remove LTM policy after loading from UCS file
- GS-733: TLS_Server SNI Multiple Certs error

### Changed
- GS-624: Endpoint Policy rules with duplicate names should fail validation
- Encrypted data goes through the Big-IQ to the Big-IP

### Removed

## 3.6.0

### Added
- Add support for LDAP Monitor
- Add support for reading and writing HTTP headers, URIs, and cookies to Endpoint Policies
- Add Service Discovery support to Firewall_Address_List
- Add filterClass query parameter to declare endpoint to allow filtering of results
- Allow Service Discovery nodes to exist in multiple pools
- Add support for DNS Monitor
- Add support for GSLB Domains
- Add support for GSLB Pools
- Add support for GSLB Servers
- Add support for GSLB Data Centers
- Add support for GSLB Prober Pools
- Add support for GSLB Monitors
- Add support for GSLB Topology Regions
- Add support for GSLB Topology Records
- Add support for L4/L7 DOS Profiles
    -  Firewall DOS Profile
    -  WAF DOS Profile
- Add support for Analytics profile
- Add capability to add multiple ltm policies (Endpoint_Policy)
- GS-421: Add Service Discovery pool members option to be disabled or removed when not detected

### Fixed
- GS-552: Unable to order LTM policy rules
- GS-560: Cannot use bigip when defining pool member
- GS-553: Unable to remove/rename LTM policy rule with POST/PATCH
- GS-573: Cannot reference existing nodes
- GS-526: WAF_Policy fails on re-POST
- GS-528: Fixed Idempotency failures in Monitor HTTP, HTTPS, and SIP
- GS-543: Idempotency failures for TCL strings in LTM Policy conditions/actions
- GS-470: Declaration updateMode causes failures when creating large numbers of tenants
- GS-629: Unable to use AS3 nodes and /Common nodes in AS3 pool
- GS-653: IP addresses with some subnets fail validation

### Changed

### Removed

## 3.5.0

### Added
- Add support for Generic Services
- Add support for FIX Profile for Service_TCP and Service_L4, which includes the ability to configure the following BIG-IP objects
    - Sender Tag Mapping
    - Log Publishers
- Add support for Data Groups, including
    - Internal Data Group
    - External Data Group
    - Existing Data Group File
- Add support for spanning in Service_Address

### Fixed
- GS-439: Pointing to a Service_Address in a declaration can fail
- GS-466: Incorrect validation of declarations wrapped in an AS3 Request object
- GS-483: Multiple conditions or actions in an Endpoint Policy Rule can cause AS3 to lock up
- GS-487: Errors when processing a declaration can cause AS3 to lock up
- HTTP Profile Compression Bugs:
    - GS-475: Extra "glob" characters included in content-type
    - GS-486: Cannot update uri and content-type include/exclude values
- GS-497: Declaration updates that remove a property can silently fail
- GS-507: Enforcement_Listener declarations can not reference Service_Generic declarations
- GS-509: Service_Address and Pool members can have naming conflicts
- GS-505: Persist update not idempotent due to prop with regex value
- GS-521: Success on second POST with Diameter Endpoint Profile
- GS-504: Cannot update certificate properties

### Changed

### Removed

## 3.4.0

### Added
- Service discovery for Azure and remote service discovery for AWS, Azure, and Google Cloud Engine
- Policy enforcement (PEM) support, which includes the ability to configure the following BIG-IP objects
    - PEM Policies
    - Diameter Endpoint Profiles
    - RADIUS-AAA Profiles
    - PEM (spm) Profiles
    - Subscriber Management Profiles
    - Classification Profiles
    - IP Other Profiles
    - RADIUS-LB Profiles
    - Data Plane Listeners
    - Bandwidth Controller Policies
    - Service Chain Endpoints
    - Format Scripts
    - Interception Endpoints
    - Forwarding Endpoints
- DNS support, which includes the ability to configure the following BIG-IP objects
    - DNS Profiles
    - TSIG Keys
    - DNS Zones
    - Nameservers
- Expanded for NAT Source Translation objects using dynamic PAT, which adds support for the following properties
    - clientConnectionLimit
    - hairpinModeEnabled
    - inboundMode
    - patMode
    - portBlockAllocation
    - ports
    - routeAdvertisement

### Fixed
- GS-410: Upgrading from 3.2.0 can cause an error message about creating an existing pool
- GS-413: TCL strings in declarations are not properly escaped
- GS-425: FQDN Pool_Members do not auto populate properly

### Changed

### Removed

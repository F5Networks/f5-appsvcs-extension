# Introduction

This is the top-level documentation which provides notes and information about contributing to this project.

## Overview Pages
- [Code Overview](code_overview.md)
- [What Where Act Reply Model](what-where-act-reply.md)

## Specific Dev Topics
- [Adding New Mappings](adding_new_mappings.md)
- [BIG-IP Licensing](bigip_licensing.md)
- [BIG-IQ Integration](bigiq_integration.md)
- [Ciphertext](ciphertext.md)
- [Debugging](debugging.md)
- [Node Inspector Profiling](node_inspector_profiling_as3.md)

## Test Configuration and Results
- [Coverage](coverage.md)
- [Test Pool Management](test_pool_management.md)
- [HA Setup](ha_setup.md)
- [Sizing Data](sizing_data.md)

## Process Topics
- [Bug Reporting](process_bug_reports.md)
- [Release Process](process_release.md)

## Troubleshooting Topics
- [Accessing Stored Declarations](stored_declarations.md)

---
### GitLab Push Rules

To prevent the releasing of private or sensitive information we automatically prevent certain strings from being included in commit messages.

If modifications are necessary open the GitLab GUI, then Settings -> Repository -> Push Rules -> "Commit message negative match".

When you attempt to push a commit message that contains sensitive information, you will see the following error: `Commit message contains the forbidden pattern`

We check for the following:
- Email addresses
- IP addresses
- Generic credential keywords

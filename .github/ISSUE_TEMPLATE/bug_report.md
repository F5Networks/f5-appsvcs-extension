---
name: Bug report
about: Report a defect in the product
title: ''
labels: bug, untriaged
assignees: ''

---

<!--
Github Issues are consistently monitored by F5 staff, but should be considered
as best effort only and you should not expect to receive the same level of
response as provided by F5 Support. Please open a case
(https://support.f5.com/csp/article/K2633) with F5 if this is a critical issue.

When filing an issue please check to see if an issue already exists that matches your's
-->

### Environment
 * Application Services Version:
 * BIG-IP Version:

### Summary
A clear and concise description of what the bug is.
Please also include information about the reproducibility and the severity/impact of the issue.

### Steps To Reproduce
Steps to reproduce the behavior:
1. Submit the following declaration:
```json
{
    "schemaVersion": "3.14.0",
    "class": "ADC",
    "Tenant": {
        "class": "Tenant",
        "Application": {
            "template": "generic",
            "vip": {
                "class": "Service_HTTP",
                "pool": "web_pool",
                "virtualAddresses": ["192.0.2.0"]
            }
        }
    }
}
```

2. Observe the following error response:
```json
{
    "code": 500,
    "message": "declaration failed",
    "response": "Something bad happened",
    "host": "localhost",
    "tenant": "Tenant",
    "runTime": 5234
}
```

### Expected Behavior
A clear and concise description of what you expected to happen.

### Actual Behavior
A clear and concise description of what actually happens.
Please include any applicable error output.


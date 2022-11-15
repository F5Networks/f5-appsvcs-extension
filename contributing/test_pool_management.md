## Rebuilding existing devices
Test devices are rebuilt every night from the CI/CD schedule 'Rebuild BIG-IPs'. However, should you need to rebuild them at some other time:
1. If you need to make a change, update the file `/src/f5-appsvcs/test/common/env/bigip_stack_pipeline_automated.yaml`.
1. From GitLab, run the CI/CD schedule 'Rebuild BIG-IPs'. This will rebuild the `big-ip-automated` stack.
1. Wait about 20-30 minutes
1. Verify that the systems onboarded correctly
    - Check connectivity to the instance
    - Check module provisioning

## Test Pool Licensing
The test pool licenses are automatically renewed using the following command:
```bash
curl $REAUTH_URL | perl
```

## Requesting Additional Resources
To request an increase to resource limits, Send Tom King a ticket via go/pdlab under Virtualization, and let him know the total of RAM and VCPUs you need.

## Additional Information
Additional information about how the AS3 test pool works can be found on $DOCS_URL.
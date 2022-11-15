# AS3 on BIG-IQ


## Overview

- **NOTE**: We don't currently have the infrastracture for automated testing of AS3 RPMs on BIG-IQ. An initial meeting with some BIG-IQ reps to go over strategy was held, but actual work and/or update from that is pending. This doc is designed to help devs perform some minimum sanity check and manual regression testing.

- BIG-IQ ships AS3 as an iControl extension, so the concept of REST framework remains the same. In addition to the AS3 instance running on the host BIG-IQ, BIG-IQ also triggers the installation of AS3 rpm on the managed device(s).
- The versions of AS3 on a BIG-IQ and on a device are allowed to be different (this will most likely cause issues)


### AS3 target*** vs ADC target

- We need the target*** properties from the AS3 class as context for the AS3 host which performs preliminary processing (e.g schema overlay and interaction with the app deployer service).
- After some preliminary processing by the BIG-IQ host, the declaration is then forwarded to the AS3 instance running on the managed device(ADC.target).
- As a user, you are not required to wrap the ADC declaration inside an AS3 class when posting to BIG-IQ - the AS3.target*** property values are inferred/extracted **if you are using basic auth**.


******************************************************

## Development and Testing

### BIG-IQ instance on VIO

1. You can spin up a new instance on VIO with the BIG-IQ image of your choice.
BIG-IQ 6.1 is the image with AS3 3.7 baked in.
1. Select a BIG-IQ medium or large flavor.
1. Ensure at least one neutron port points to Adminnetwork2 (where your bigip device can be discovered)
1. Once the BIG-IQ instance is up, you can license with sku F5-BIQ-VE-LAB-LIC-DEV.
1. After licensing, ensure basic auth is supported. You can ssh and run `set-basic-auth on`

### Adding managed device

1. Using the GUI, on Devices tab, add the target device (e.g. a BIG-IP).
1. Select the modules (e.g. LTM) that BIG-IQ will need to discover.
1. Once the device is added, click on the device and navigate to Services. You should perform Configuration Import for the service(s).
1. **Important**: Make sure that the device is added properly (green status), otherwise, BIG-IQ will not behave as expected.

### Manually updating the RPM

- To update the version on the BIG-IQ host: `see scripts/dev/install-bigiq-rpm.sh`
- To update the version on the managed device:

1. After downloading the latest RPM, ssh to the BIG-IQ
1. Update the copy of the RPM:

    ```bash
        mount -o remount,rw /usr
        mv /tmp/f5-appsvcs-X.Y.Z-V.noarch.rpm /usr/lib/dco/packages/f5-appsvcs/
        mount -o remount,ro /usr
    ```

1. Update `/var/config/rest/config/restjavad.properties.json` with rpmFilePath value

    ```json
    ...
    "global" :
        ...
        "appSvcs" :
        {
            "appMappingPollingTimeOutSeconds" : 180,
            "rpmFilePath" : "/usr/lib/dco/packages/f5-appsvcs/f5-appsvcs-X.Y.Z-V.noarch.rpm"
        }
    ...
    ```

1. Run `bigstart restart restjavad`
1. If you are seeing issues, you might need to perform `bigstart restart restnoded`

### Sample Collection

1. You can manually run the sample postman collection under test/bigiq
1. Ensure that your environment has `host`, `username`, `password`, `localUser`, `localPwd`, `target1` and `target2` variables
- `localUser` and `localPwd` must be setup on the BIG-IQ

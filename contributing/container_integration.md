# AS3 on Container

## Overview

- AS3 can be installed and run on a container. Configuration can be deployed to a target device without requiring AS3 to be installed on that target device.
- The current default container base image is from `f5devcentral/f5-api-services-gateway`
- For the new container type based off `f5-icontrol-gateway` (currently POC), see `src/app/README.md`
- For rpm `BUILD_TYPES.CLOUD`, the service discovery rpm will be installed on the target device if not present. SD will not be installed on the container itself.
- The default storage for containers is JsonDataStore instead of data-groups.
- GET and DELETE methods are not allowed on the container.

### AS3 target*** vs ADC target

- As a user, you are required to wrap the ADC declaration inside the AS3 class when posting to the container. `AS3.target***` property values are inferred/extracted **if you are using basic auth**.
- Note that target property of schema class ADC is only used in a BIG-IQ context and not related to the container.

******************************************************

## Testing

### Running the integration test

- Requirements:
  - A working Docker installation
  - A target BIG-IP device
- The integration test can be run:
  - Using an existing/running docker instance (requires `DOCKER_ID`). Ensure that the container is reachable on port 9443 (run docker with port mapping if needed, e.g. `docker run --rm -d -p 9443:443 ${imageName}`)

    ``` bash
        AS3_HOST=${ip}:${port} AS3_USERNAME=${targetUsername} AS3_PASSWORD=${targetPassphrase} DOCKER_ID='${containerIdOrName}' mocha '${path/to/src/f5-appsvcs/test/integration/container/test.js}'
    ```

  - Using a new instance, which will be removed after test (requires `DOCKER_IMAGE`)
    - Download the container image if needed
    - Load the container image using `docker load < path/to/f5-as3-container.tar.gz`
    - Make sure that the default 9443 port on your machine is available and not in use

      ``` bash
              AS3_HOST=${ip}:${port} AS3_USERNAME=${targetUsername} AS3_PASSWORD=${targetPassphrase} DOCKER_IMAGE='${imageName}' mocha '${path/to/src/f5-appsvcs/test/integration/container/test.js}'
      ```

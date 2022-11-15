# Using AS3 in the f5-icontrol-gateway container
+ Download the container
+ Install the container on your system
    ```
    docker load --input /path/to/f5-as3-container-fig.tar.gz
    ```
+ Run the container
    ```
    docker run -p 8443:443 --rm --name f5-as3-container f5-as3-container-fig:latest
    ```
+ Create a declaration as you would for AS3 running in the Application Services Gateway container
+ POST the declration. Important, POST to /shared, not /mgmt/shared
    ```
    curl -sku admin:admin -X POST -d @'declaration_file' https://localhost:8443/shared/appsvcs/declare
    ```
+ To login to the shell to explore
    ```
    docker exec -it f5-as3-container /bin/bash
    ```
+ Code is installed in /var/config/rest/iapps/f5-appsvcs as usual
+ Config file is installed to /etc/unit/f5-appsvcs.conf
+ For more information on the f5-icontrol-gateway, see: https://hub.docker.com/r/f5devcentral/f5-icontrol-gateway

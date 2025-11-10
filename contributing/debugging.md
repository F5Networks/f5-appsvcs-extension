# Remote Debugging
## Setup BIG-IP to allow for remote debugging.

You need to run these commands one time on the BIG-IP:
```
/sbin/iptables -I f5default 1 -p tcp --dport 5858 -j ACCEPT
service iptables save
service iptables restart
touch /service/restnoded/debug
bigstart restart restnoded
```

## From vscode
- Create a `launch.json` file with the following content (or add sections to your existing `launch.json`)
```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "inputs": [
        {
            "description": "IP Address of BIG-IP",
            "id": "BIG_IP_ADDR",
            "type": "promptString"
        }
    ],
    "configurations": [
        {
            "type": "node",
            "name": "Attach to BIG-IP",
            "port": 5858,
            "address": "${input:BIG_IP_ADDR}",
            "request": "attach",
            "localRoot": "${workspaceFolder}/src",
            "remoteRoot": "/var/config/rest/iapps/f5-appsvcs",
            "skipFiles": [
                "<node_internals>/**"
            ]
        }
    ]
}
```

- Switch to debug view and select `Attach to BIG-IP`
- Set a breakpoint where you want it
- Send an HTTP request to AS3 on that BIG-IP

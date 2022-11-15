# Profiling AS3 with Node-Inspector

## Steps to Setup Node-Inspector on BIG-IP
1. Login to your BIG-IP device.
2. Next you will want to use the command `touch /service/restnoded/debug` to put restnoded in debug mode.
3.  `bigstart restart restnoded` to restart restnoded with debug mode.
4. `cd /root`
5. `npm install -g node-inspector@0.12.8`
6. `kill -s USR1 $(pidof f5-rest-node)`
7. `f5-rest-node /usr/lib/node_modules/node-inspector/bin/inspector.js --web-port=8080 --web-host=[big-ip-address] &`
8. You will be given a URL to get to the GUI for Node-Inspector. 
Use the first steps in the next section to get an error that will tell you the name of a file that is missing.
9. Next you will need to copy the file inspector_files.tar.gz from sjcdev04:/vol/3/users/paine/ over to the BIG-IP. 
(You will likely have to copy it somewhere other than your BIG-IP first.)
10. Extract the files with `tar xvzf inspector_files.tar.gz`.
11. Find the missing file and copy it over to the directory path that was given in the error message from the Node-Inspector GUI.
12. Kill the process that was started for Node-Inspector earlier.
13. `kill -s USR1 $(pidof f5-rest-node)`
14. `f5-rest-node /usr/lib/node_modules/node-inspector/bin/inspector.js --web-port=8080 --web-host=[big-ip-address] &`

## Using Node-Inspector to Profile AS3
1. Use the URL given to you in the step used to start Node-Inspector in a browser. 
You will likely want to use Chrome as your browser to access the GUI for Node-Inspector. 
(The use of a previous version may be necessary. These steps were all done using version 48 of Chrome.)
2. Once in the GUI for Node-Inspector, you will be in the "Sources" tab and should be able to find the source code of AS3. 
3. For profiling you will want to go to the "Profiles" tab. 
In here you can start a recording using the "Collect JavaScript CPU Profile" option.
4. Upon doing a POST to the declare endpoint of AS3, you can go back to the GUI of Node-Inspector to stop the profile recording. 
5. The data that was recorded should now be displayed on the screen.
6. A search can be done to find a particular function. 
Searching for "appsvcs" will highlight all cases of the AS3 functions that were used.
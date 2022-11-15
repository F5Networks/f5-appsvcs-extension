# Setting Up HA

## Steps for Setup

### What to Create in VIO
* Under Network go to Networks and create a new Network
  * Give the Network a subnet
* Under Network go to Routers and create a new Router
  * Give the Router a type of "centralized/shared"
* Once the Router is created, click on its name and add an Interface
  * Give the Interface the subnet that was given to the Network
  * Give the Interface an IP Address (Probably just increment the subnet address by one)
* Under the created Networks subnet, make sure that the Gateway IP matches the one given to the Interface that was just added to the Router
* Now create two instances
  * Make sure that the BIGIP version matches for both instances
  * Add the Network that you normally use and then add the Network that was just created as the second network (This will make them 2 NIC)
  * Do this for both instances
* Each instance will have an address under each Network added to it
  * The address that is not under the Network that was created should be the address used to access the GUI

### What to do on Big-IP Devices
* Make sure that each device has a unique name
* On each device add a new VLAN
  * This will be the HA VLAN
  * Give it interface 1.1 (untagged)
  * Leave the rest as defaults
* On each device add a new Self IP
  * For VLAN/Tunnel, give it ha
  * For IP Address, give it the IP Address given to the second network under the VIO instance
  * Give the Self IP a Netmask (Such as 255.255.255.0)
  * Make sure that the Traffic Group is "traffic-group-local-only (non-floating)"
* Give each device a Route
  * Give it a Destination and Netmask (0.0.0.0 should be fine for both)
  * Under Resource, give it "Use Gateway..."
  * The Gateway Address should be the address that the Interface created in VIO was given
* On each device go to Device Management->Devices and select the one that says "self"
  * Under the device, set up ConfigSync to be the HA Self IP that was added
  * Next go to Failover Network and click Add
    * Add the HA Self IP, select repeat, add the Management Address, and then select finished
* On one of the devices go to Device Management->Device Trust->Device Trust Members and add a peer
  * Give the IP Address the one used to access the GUI of the other device and enter the credentials for the admin
* On the device that you want to be the stanby device go to Device Management->Device Groups and create a device group
  * Give it a type of "Sync-Failover"
  * Add both devices to the "Inlcudes" of Members
* The devices should now be setup in an HA pair with one "active" and one "standby"

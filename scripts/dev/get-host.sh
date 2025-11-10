#!/bin/bash

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Target machine name is required${NC}"
    exit 1
fi

IP=$(openstack server --insecure show $1 -c addresses -f value | sed -r 's/^AdminNetwork=(.*)$/\1/')

if [ $1 = "as3-bigip-12.1" ]; then
    echo $IP
else
    echo $IP:8443
fi

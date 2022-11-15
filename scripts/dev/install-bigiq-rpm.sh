#!/bin/bash
# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ "$1" == "-h" -o "$1" == "--help" ]; then
    echo "This command will completely remove the previous AS3 files and RPM, then do a fresh install of the new RPM."
    echo "Required fields:"
    echo " - \"target IP address\": the ipaddress for the BIG-IQ (e.g. 10.145.65.126)"
    echo " - \"target user\": User to ssh as (e.g. admin)"
    echo "Optional fields:"
    echo " - \"Path to New RPM\": The path to the RPM to install (e.g. dist/f5-appsvcs-3.12.1-2.noarch.rpm)"
    echo "Should be run from the root of the AS3 repo."
    echo "Example command: ./scripts/dev/install-bigiq-rpm.sh 10.145.65.126 admin dist/f5-appsvcs-3.12.1-2.noarch.rpm"
    exit 0
fi

if [ "$#" -lt 2 ]; then
    echo -e "${RED}Requires \"target IP address\" and \"target user\". To see the help use -h or --help.${NC}"
    exit 0
fi

# Gather the name of the new RPM
if [ "$3" != '' ]; then
    tempPath=$3
elif [ "$BUILD_TYPE" == '' ]; then
    tempPath="dist/f5-appsvcs-3*.rpm"
else
    tempPath="dist/*$BUILD_TYPE*.rpm"
fi
pathRPM="$(ls -v $tempPath 2>/dev/null|tail -1)"
newRPM="$(basename $pathRPM)"

if [ "$newRPM" == '' ]; then
    echo -e "${RED}An RPM could not be found, make sure you are running this script from the root of the AS3 repo.${NC}"
    exit 1
fi

# SCP the newRPM to the target BIG-IQ
TMP_DIR=/var/config/rest/downloads
echo "Copying $pathRPM to $1 in $TMP_DIR"
scp -r $pathRPM $2@$1:$TMP_DIR

# SSH into the BIG-IQ and install the new RPM
RPM_DIR=/usr/lib/dco/packages/f5-appsvcs
echo "SSH into $1 as $2"
ssh $2@$1 <<EOF
bash
rm -rf /var/config/rest/iapps/f5-appsvcs/*
mount -o remount,rw /usr
rm -rf $RPM_DIR/*
mv $TMP_DIR/$newRPM $RPM_DIR
mount -o remount,ro /usr
rpm -Uv --replacepkgs --force --ignoreos $RPM_DIR/$newRPM
bigstart restart restnoded

EOF

echo -e "${RED}"
echo "!!!WARNING!!! Installation is incomplete!"
echo "You must do the following: SSH onto the BIG-IQ, update the restjavad.properties.json, and restart restjavad & restnoded."
echo "ssh $2@$1"
echo "vim /var/config/rest/config/restjavad.properties.json"
echo "Update or add global.appSvcs.rpmFilePath, with this path:"
echo "\"/usr/lib/dco/packages/f5-appsvcs/$newRPM\""
echo -e "bigstart restart restjavad restnoded${NC}"

exit 0

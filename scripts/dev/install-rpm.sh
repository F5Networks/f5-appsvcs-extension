#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color
if [ -z "$1" ]; then
    echo "Target machine is required for installation."
    exit 0
fi

if [ -z "$2" ]; then
    echo "Credentials [username:password] for target machine are required for installation."
    exit 0
fi

TARGET="$1"
CREDS="$2"
TARGET_RPM="$3"

# If no target RPM specified, assume AS3
if [ -z "$TARGET_RPM" ]; then
    TARGET_RPM=$(ls -t dist/f5-appsvcs-3*.rpm 2>/dev/null | head -1)
fi

if [ -z "$TARGET_RPM" ]; then
    echo -e "${RED}Could not find RPM in ./dist folder. Verify that ./dist folder contains" \
        "f5-appsvcs-3*.rpm or provide specific file path to RPM.${NC}"
    exit 0
fi

RPM_NAME=$(basename $TARGET_RPM)
CURL_FLAGS="--silent --write-out \n --insecure -u $CREDS"

poll_task () {
    STATUS="STARTED"
    while [ $STATUS != "FINISHED" ]; do
        sleep 1
        RESULT=$(curl ${CURL_FLAGS} "https://$TARGET/mgmt/shared/iapp/package-management-tasks/$1")
        STATUS=$(echo $RESULT | jq -r .status)
        if [ $STATUS = "FAILED" ]; then
            echo -e "${RED}Failed to" $(echo $RESULT | jq -r .operation) "package:" \
                $(echo $RESULT | jq -r .errorMessage)"${NC}"
            exit 1
        fi
    done
}

check_echo_js_endpoint() {
    ECHO_JS_URL="https://$TARGET/mgmt/shared/echo-js"
    MAX_TRIES=300
    counter=1
    set +e
    INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$ECHO_JS_URL")
    until [[ -n $(echo $INFO | jq -r .stage) || $counter -gt $MAX_TRIES ]]; do
        ((counter++))
        sleep 10
        INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$ECHO_JS_URL")
    done
    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached while waiting for $ECHO_JS_URL${NC}"
        exit 1
    fi
    set -e
}

check_info_endpoint() {
    INFO_URL=$1
    MAX_TRIES=300
    counter=1
    set +e
    INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$INFO_URL")
    until [[ -n $(echo $INFO | jq -r .version) || $counter -gt $MAX_TRIES ]]; do
        ((counter++))
        sleep 1
        INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$INFO_URL")
    done
    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached while waiting for $INFO_URL${NC}"
        exit 1
    fi
    set -e
}

echo "Waiting for REST framework to be available"
check_echo_js_endpoint

# If this is AS3, get list of existing f5-appsvcs packages on target and uninstall them
if echo "$RPM_NAME" | egrep -q '^f5-appsvcs'; then
    echo "Getting list of existing f5-appsvcs packages on target"
    TASK=$(curl $CURL_FLAGS -H "Content-Type: application/json" \
        -X POST https://$TARGET/mgmt/shared/iapp/package-management-tasks -d "{operation: 'QUERY'}")
    poll_task $(echo $TASK | jq -r .id)
    AS3RPMS=$(echo $RESULT | jq -r '.queryResponse[].packageName | select(. | startswith("f5-appsvcs") or startswith("f5-service-discovery"))')

    # Uninstall existing f5-appsvcs packages on target
    for PKG in $AS3RPMS; do
        echo "Uninstalling $PKG on $TARGET"
        DATA="{\"operation\":\"UNINSTALL\",\"packageName\":\"$PKG\"}"
        TASK=$(curl ${CURL_FLAGS} "https://$TARGET/mgmt/shared/iapp/package-management-tasks" \
            --data $DATA -H "Origin: https://$TARGET" -H "Content-Type: application/json;charset=UTF-8")
        poll_task $(echo $TASK | jq -r .id)
    done
fi

#Remove previous RPMs uploaded on target
echo "Removing previous RPMs from target"
curl ${CURL_FLAGS} -X DELETE https://$TARGET/mgmt/shared/file-transfer/uploads/$RPM_NAME

#Upload new RPM to target
echo "Uploading RPM to https://$TARGET/mgmt/shared/file-transfer/uploads/$RPM_NAME"
node scripts/dev/upload-rpm.js $TARGET $CREDS $TARGET_RPM

#Install RPM on target
echo "Installing $RPM_NAME on $TARGET"
DATA="{\"operation\":\"INSTALL\",\"packageFilePath\":\"/var/config/rest/downloads/$RPM_NAME\"}"
TASK=$(curl ${CURL_FLAGS} "https://$TARGET/mgmt/shared/iapp/package-management-tasks" \
    --data $DATA -H "Origin: https://$TARGET" -H "Content-Type: application/json;charset=UTF-8")
poll_task $(echo $TASK | jq -r .id)

# If this is AS3, check availability
if echo "$RPM_NAME" | egrep -q '^f5-appsvcs'; then
    echo "Waiting for appsvcs/info endpoint to be available"
    check_info_endpoint "https://$TARGET/mgmt/shared/appsvcs/info"

    echo "Waiting for service-discovery/info endpoint to be available"
    check_info_endpoint "https://$TARGET/mgmt/shared/service-discovery/info"
fi

echo "Installed $RPM_NAME on $TARGET"

exit 0

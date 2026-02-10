#!/bin/bash

set -e

# Source common utilities
source "scripts/dev/common-utils.sh"

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
CURL_FLAGS="--silent --insecure --connect-timeout 10 --max-time 30 -u $CREDS"

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

check_info_endpoint() {
    INFO_URL=$1
    MAX_TRIES=300
    counter=1
    set +e
    INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$INFO_URL")
    until [[ -n $(echo $INFO | jq -r .version) || $counter -gt $MAX_TRIES ]]; do
        ((counter++))
        # Print progress every 30 seconds
        if (( counter % 30 == 0 )); then
            echo "  Still waiting for $INFO_URL... (attempt $counter/$MAX_TRIES, elapsed: ${counter}s)"
        fi
        sleep 1
        INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$INFO_URL")
    done
    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached (${MAX_TRIES}s elapsed) while waiting for $INFO_URL on $TARGET${NC}"
        echo -e "${RED}Last response: $INFO${NC}"
        exit 1
    fi
    echo "  Endpoint is now available (took ${counter}s)"
    set -e
}

wait_for_curl_response_with_retries() {
    url="https://$TARGET/mgmt/tm/cm/device"
    MAX_TRIES=300
    interval=10
    counter=1

    sleep $interval
    until [[ $counter -gt MAX_TRIES ]]; do
        response=$(curl ${CURL_FLAGS} "$url" | jq -r .items[0].failoverState)

        # Accept active, standby, or forced-offline as valid states
        if [[ "$response" == "active" ]] || [[ "$response" == "standby" ]] || [[ "$response" == "forced-offline" ]]; then
            echo "  $TARGET's MCPD is in $response state (took $((counter * interval))s)"
            return 0  # Success
        fi

        # Print progress every 3 attempts (30 seconds)
        if (( counter % 3 == 0 )); then
            echo "  Waiting for MCPD to be active... (current: $response, attempt $counter/$MAX_TRIES, elapsed: $((counter * interval))s)"
        fi

        counter=$((counter + 1))
        sleep $interval
    done

    echo "${RED}Maximum number of retries ($MAX_TRIES) reached ($((MAX_TRIES * interval))s elapsed). MCPD on $TARGET is in $response state${NC}"
    return 1  # Maximum retries reached
}

echo "[install-rpm.sh] Waiting for REST framework to be available on $TARGET"
check_echo_js_endpoint "$TARGET" "$CURL_FLAGS"

# If this is AS3, get list of existing f5-appsvcs packages on target and uninstall them
if echo "$RPM_NAME" | egrep -q '^f5-appsvcs'; then
    echo "Getting list of existing f5-appsvcs packages on $TARGET"
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
echo "Removing previous RPMs from $TARGET"
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

# If this is AS3, restart restnoded immediately to ensure clean load, then wait for system stability
if echo "$RPM_NAME" | egrep -q '^f5-appsvcs'; then
    # Restart restnoded to ensure AS3 loads cleanly after installation
    echo "Restarting restnoded service on $TARGET to ensure AS3 loads properly..."
    RESTART_RESULT=$(curl ${CURL_FLAGS} -X POST \
        "https://$TARGET/mgmt/tm/sys/service" \
        -H "Content-Type: application/json" \
        -d '{"command":"restart","name":"restnoded"}' 2>/dev/null)

    echo "  Waiting 20 seconds for restnoded to restart and load AS3 worker..."
    sleep 20

    echo "Waiting for $TARGET device's MCPD to reach stable state before checking AS3"
    wait_for_curl_response_with_retries

    # Wait for REST framework to come back online
    echo "  Verifying REST framework is back online..."
    check_echo_js_endpoint "$TARGET" "$CURL_FLAGS"

    # Debug: Check if AS3 files exist
    RESTNODED_STATUS=$(curl ${CURL_FLAGS} "https://$TARGET/mgmt/shared/echo-js/info" 2>/dev/null | jq -r .version || echo "REST unavailable")

    echo "Waiting for appsvcs/info endpoint to be available on $TARGET"
    check_info_endpoint "https://$TARGET/mgmt/shared/appsvcs/info"

    echo "Waiting for service-discovery/info endpoint to be available on $TARGET"
    check_info_endpoint "https://$TARGET/mgmt/shared/service-discovery/info"

    echo "Installed $RPM_NAME on $TARGET"
else
    echo "Installed $RPM_NAME on $TARGET"

    echo "Waiting for $TARGET device's MCPD to be active"
    wait_for_curl_response_with_retries
fi

exit 0

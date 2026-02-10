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

if [ -z "$3" ]; then
    echo "Jaeger collector endpoint is required to enable performance tracing."
    exit 0
fi


TARGET="$1"
CREDS="$2"
JAEGER_ENDPOINT="$3"

CURL_FLAGS="--silent --insecure --connect-timeout 10 --max-time 30 -u $CREDS"

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

echo "[enable-perf-tracing.sh] Waiting for REST framework to be available on $TARGET"
check_echo_js_endpoint "$TARGET" "$CURL_FLAGS"

# Check AS3 availability
echo "Waiting for appsvcs/info endpoint to be available"
check_info_endpoint "https://$TARGET/mgmt/shared/appsvcs/info"

echo "Enabling performance tracing"
SETTINGS_JSON="{\"performanceTracingEnabled\": true, \"performanceTracingEndpoint\": \"$JAEGER_ENDPOINT\"}"
curl ${CURL_FLAGS} -H 'Content-Type: application/json' -X POST -d "$SETTINGS_JSON" https://$TARGET/mgmt/shared/appsvcs/settings

exit 0

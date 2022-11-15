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

if [ -z "$3" ]; then
    echo "Jaeger collector endopint is required to enable performance tracing."
    exit 0
fi


TARGET="$1"
CREDS="$2"
JAEGER_ENDPOINT="$3"

CURL_FLAGS="--silent --write-out \n --insecure -u $CREDS"

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

# Check AS3 availability
echo "Waiting for appsvcs/info endpoint to be available"
check_info_endpoint "https://$TARGET/mgmt/shared/appsvcs/info"

echo "Enabling performance tracing"
SETTINGS_JSON="{\"performanceTracingEnabled\": true, \"performanceTracingEndpoint\": \"$JAEGER_ENDPOINT\"}"
curl ${CURL_FLAGS} -H 'Content-Type: application/json' -X POST -d "$SETTINGS_JSON" https://$TARGET/mgmt/shared/appsvcs/settings

exit 0

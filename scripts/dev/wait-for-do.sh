#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Target machine is required for installation.${NC}"
    exit 0
fi

if [ -z "$2" ]; then
    echo -e "${RED}Credentials [username:password] for target machine are required for installation.${NC}"
    exit 0
fi

TARGET="$1"
CREDS="$2"

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
        echo "INFO $INFO"
    done
    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached while waiting for $ECHO_JS_URL on $TARGET${NC}"
        exit 1
    fi
    set -e
}

get_bigip_version() {
    DEVICE_INFO_URL="https://$TARGET/mgmt/shared/identified-devices/config/device-info"
    MAX_TRIES=300
    counter=1
    set +e
    INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$DEVICE_INFO_URL")
    until [[ -n $(echo $INFO | jq -r .version) || $counter -gt $MAX_TRIES ]]; do
        ((counter++))
        sleep 1
        INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$DEVICE_INFO_URL")
    done
    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached while waiting for $DEVICE_INFO_URL on $TARGET${NC}"
        exit 1
    fi
    version=$(echo $INFO | jq -r .version)
    set -e
    echo $version
}

get_do_status_code() {
    DO_URL="https://$TARGET/mgmt/shared/declarative-onboarding"
    INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$DO_URL")
    echo "$(echo $INFO | jq -r .result.code)"
}

get_do_status_message() {
    DO_URL="https://$TARGET/mgmt/shared/declarative-onboarding"
    INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$DO_URL")
    echo "$(echo $INFO | jq -r .result.message)"
}

wait_for_do() {
    MAX_TRIES=600
    counter=1
    set +e
    code=$(get_do_status_code)
    until [[ $code == 200 || $counter -gt $MAX_TRIES ]]; do
        if [[ $(( $counter % 10 )) == 0 ]]; then
            echo "Current DO status code $code on $TARGET"
        fi
        if [[ $code -ge 400 ]]; then
            message=$(get_do_status_message)
            echo -e "${RED}DO failed. Code: $code, Message: $message on $TARGET${NC}"
            exit 1
        fi
        ((counter++))
        sleep 10
        code=$(get_do_status_code)
    done
    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached while waiting for $DO_URL on $TARGET${NC}"
        exit 1
    fi
    echo "Current DO status code $code on $TARGET"
    set -e
}


wait_for_curl_response_with_retries() {
    url="https://$TARGET/mgmt/tm/util/bash"
    MAX_TRIES=300
    interval=10
    counter=1
    data="{\"command\":\"run\", \"utilCmdArgs\":\"-c 'cat /var/prompt/ps1'\"}"
    content="Content-type: application/json"

    sleep $interval
    until [[ $counter -gt MAX_TRIES ]]; do
        response=$(curl $CURL_FLAGS -X POST -H "$content" -d "$data" "$url" | jq -r .commandResult)

        if [[ "$response" == "Active" ]]; then
            echo -e "Prompt state: $response on $TARGET"
            exit 0  # Success
        fi

        retries=$((retries + 1))
        sleep $interval
    done

    echo -e "${RED}Maximum number of retries ($MAX_TRIES) reached. Instance $TARGET is in $response state.${NC}"
    exit 1  # Maximum retries reached
}

echo "Waiting for REST framework to be available on $TARGET"
check_echo_js_endpoint

echo "Getting BIG-IP version"
version=$(get_bigip_version)
echo "VERSION $version"
major=$(echo $version | cut -d . -f 1)
if [[ $major -lt 13 ]]; then
    echo -e "${RED}DO is not expected on BIG-IP less than version 13${NC}"
    exit 0
fi

echo "Waiting for DO to complete on $TARGET"
wait_for_do
echo "DO is done on $TARGET"

echo "Waiting for $TARGET to reach an active state"
wait_for_curl_response_with_retries

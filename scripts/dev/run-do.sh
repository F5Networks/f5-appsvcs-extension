#!/bin/bash

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [[ -z $1 ]]; then
    echo -e "${RED}Host must be provided${NC}"
    exit 1
fi

if [[ -z $2 ]]; then
    echo -e "${RED}Credentials file must be provided${NC}"
    exit 1
fi

if [[ -z $3 ]]; then
    echo -e "${RED}Declaration file must be provided${NC}"
    exit 1
fi

HOST=$1
CREDS=$2
DECLARATION_FILE=$3

DECLARATION_RENDERED=$(envsubst < "$DECLARATION_FILE")

wait_for_availability() {
    echo "Waiting for DO availablility on $HOST"
    MAX_TRIES=300
    counter=1
    CURL_COMMAND="curl -sku $CREDS --fail --silent https://${HOST}/mgmt/shared/declarative-onboarding/available"
    until [[ "$CURL_COMMAND" || $counter -gt $MAX_TRIES ]]; do
        ((counter++))
        sleep 10
    done
    echo "DO is available on $HOST"
}

post_delcaration() {
    echo "Posting declaration to $HOST"
    curl -sku $CREDS -X POST -H \'Content-Type: application/json\' --data "$DECLARATION_RENDERED" https://${HOST}/mgmt/shared/declarative-onboarding
}

wait_for_availability
post_delcaration
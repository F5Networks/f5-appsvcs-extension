#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$BIGIP_IMAGE" ]; then
    echo -e "${RED}BIGIP_IMAGE is required.${NC}"
    exit 1
fi

if [ -z "$CI_PIPELINE_SOURCE" ]; then
    echo -e "${RED}CI_PIPELINE_SOURCE is required.${NC}"
    exit 1
fi

if [ -z "$CI_PIPELINE_ID" ]; then
    echo -e "${RED}CI_PIPELINE_ID is required.${NC}"
    exit 1
fi

if [ -z "$BIGIPS_ADDRESSES" ]; then
    echo -e "${RED}BIGIPS_ADDRESSES is required.${NC}"
    exit 1
fi

if [ -z "$AS3_USERNAME" ]; then
    echo -e "${RED}AS3_USERNAME is required.${NC}"
    exit 1
fi

if [ -z "$AS3_PASSWORD" ]; then
    echo -e "${RED}AS3_PASSWORD is required.${NC}"
    exit 1
fi

echo '{ "created_by": '\"${BIGIP_IMAGE}-${CI_PIPELINE_SOURCE}-${CI_PIPELINE_ID}\",
echo '"servers": ['
for i in "${BIGIPS_ADDRESSES[@]}"
do
    jq -n \
        --arg ip "$i" \
        --arg admin_username "$AS3_USERNAME" \
        --arg admin_password "$AS3_PASSWORD" \
        '{ ip: $ip,
           username: $admin_username,
           password: $admin_password
         }' | tr -d '\n'
    if [ "$i" != "${BIGIPS_ADDRESSES[${#BIGIPS_ADDRESSES[@]}-1]}" ]
        then echo ','
    fi
done
echo ']}'

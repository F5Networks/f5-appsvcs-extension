#!/bin/bash

set -e

echo '{ "created_by": '\"${BIGIP_IMAGE}-${CI_PIPELINE_SOURCE}-${CI_PIPELINE_ID}\",
echo '"servers": ['
for i in "${BIGIPS_ADDRESSES[@]}"
do
    jq -n \
        --arg ip "$i:8443" \
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

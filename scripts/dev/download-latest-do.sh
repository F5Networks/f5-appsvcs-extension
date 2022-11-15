#!/bin/bash

if [[ -n $1 ]]; then
    DOWNLOAD_DIR=$1
fi

if [[ -n $2 ]]; then
    DO_INTEGRATION_VERSION=$2
fi

RPM_FILE="f5-declarative-onboarding-$DO_INTEGRATION_VERSION.noarch.rpm"
RPM_DOWNLOAD_URL="https://${ARTIFACTORY_URL}/artifactory/f5-automation-toolchain-generic/f5-declarative-onboarding/$DO_INTEGRATION_VERSION/$RPM_FILE"
curl -sLk -o "${DOWNLOAD_DIR}/$RPM_FILE" "$RPM_DOWNLOAD_URL"

echo "${DOWNLOAD_DIR}/${RPM_FILE}"

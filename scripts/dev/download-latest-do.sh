#!/bin/bash

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$ARTIFACTORY_URL" ]; then
    echo -e "${RED}ARTIFACTORY_URL is required.${NC}"
    exit 1
fi

if [[ -n $1 ]]; then
    DOWNLOAD_DIR=$1
fi

if [[ -n $2 ]]; then
    DO_INTEGRATION_VERSION=$2
fi

if [ -z "$DOWNLOAD_DIR" ]; then
    echo -e "${RED}DOWNLOAD_DIR is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$DO_INTEGRATION_VERSION" ]; then
    echo -e "${RED}DO_INTEGRATION_VERSION is required as a parameter.${NC}"
    exit 1
fi

RPM_FILE="f5-declarative-onboarding-$DO_INTEGRATION_VERSION.noarch.rpm"
RPM_DOWNLOAD_URL="https://${ARTIFACTORY_URL}/artifactory/f5-automation-toolchain-generic/f5-declarative-onboarding/$DO_INTEGRATION_VERSION/$RPM_FILE"
curl -sLk -o "${DOWNLOAD_DIR}/$RPM_FILE" "$RPM_DOWNLOAD_URL"

echo "${DOWNLOAD_DIR}/${RPM_FILE}"

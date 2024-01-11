#!/bin/bash

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$ARTIFACTORY_URL" ]; then
    echo -e "${RED}ARTIFACTORY_URL is required.${NC}"
    exit 1
fi

sed -i "/^[ \s]*\"resolved\".*${ARTIFACTORY_URL}/d" ./package-lock.json

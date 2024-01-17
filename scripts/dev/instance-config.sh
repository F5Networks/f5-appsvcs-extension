#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

IP="$1"
CREDS="$2"
DO_RPM_FILE="$3"
ONBOARD_FILE="$4"
RPM_PACKAGE="$5"

if [ -z "$IP" ]; then
    echo -e "${RED}IP is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$CREDS" ]; then
    echo -e "${RED}CREDS is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$DO_RPM_FILE" ]; then
    echo -e "${RED}DO_RPM_FILE is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$ONBOARD_FILE" ]; then
    echo -e "${RED}ONBOARD_FILE is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$RPM_PACKAGE" ]; then
    echo -e "${RED}RPM_PACKAGE is required as a parameter.${NC}"
    exit 1
fi

scripts/dev/install-rpm.sh "$IP" "$CREDS" "$DO_RPM_FILE" && \
scripts/dev/run-do.sh "$IP" "$CREDS" "$ONBOARD_FILE" && \
scripts/dev/wait-for-do.sh "$IP" "$CREDS" && \
scripts/dev/install-rpm.sh "$IP" "$CREDS" "$RPM_PACKAGE"

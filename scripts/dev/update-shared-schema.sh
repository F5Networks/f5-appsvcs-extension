#!/bin/bash

# Check for shared-schema updates.

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$CI_COMMIT_REF_NAME" ]; then
    echo -e "${RED}CI_COMMIT_REF_NAME is required.${NC}"
    exit 1
fi

if [ -z "$AS3_ACCESS_TOKEN" ]; then
    echo -e "${RED}AS3_ACCESS_TOKEN is required.${NC}"
    exit 1
fi

if [ -z "$CI_SERVER_HOST" ]; then
    echo -e "${RED}CI_SERVER_HOST is required.${NC}"
    exit 1
fi

if [ -z "$CI_PROJECT_PATH" ]; then
    echo -e "${RED}CI_PROJECT_PATH is required.${NC}"
    exit 1
fi

if [ -z "$UPDATE_BRANCH_NAME" ]; then
    echo -e "${RED}UPDATE_BRANCH_NAME is required.${NC}"
    exit 1
fi

ncu_output=$(npx npm-check-updates -u --filter @automation-toolchain/f5-appsvcs-schema)
if [ $? -eq 0 ]; then
    echo "Updates available for the package f5-appsvcs-schema:"
    echo "$ncu_output"
    export SHARED_SCHEMA_DIFF=true
    npm i
    npm upgrade

    git config --global user.email "DO_NOT_REPLY@f5.com"
    git config --global user.name "F5 AS3 Pipeline"

    git checkout "$CI_COMMIT_REF_NAME"
    git remote set-url origin https://"$AS3_ACCESS_TOKEN"@"$CI_SERVER_HOST"/"$CI_PROJECT_PATH".git
    git checkout "$UPDATE_BRANCH_NAME" 2>/dev/null || git checkout -b "$UPDATE_BRANCH_NAME";

    ./scripts/dev/filter-package-lock.sh

    git add .
    git status
    git commit -m "Auto-update shared-schema"
    git checkout "$CI_COMMIT_REF_NAME"
else
    echo "No updates available for the package f5-appsvcs-schema."
fi

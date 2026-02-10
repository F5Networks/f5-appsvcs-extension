#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
TOP_DIR=${SCRIPT_DIR}/../..
SRC_DIR=${TOP_DIR}/src
DIST_DIR=${TOP_DIR}/dist

echo "Building RPM"
${SCRIPT_DIR}/buildRpm.sh

echo "Packaging source"
${SCRIPT_DIR}/source-package.sh

echo "Creating examples collection"
node ${SCRIPT_DIR}/create-examples-collection.js

LAST_VERSION=$(ls -t ${DIST_DIR}/*.rpm | head -n1 | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+-[0-9]\+")
VERSION=${1:-$LAST_VERSION}

echo "Updating dist"
mkdir -p ${DIST_DIR}
cp ${SRC_DIR}/lib/properties.json ${DIST_DIR}/as3-properties-latest.json
cp ${SRC_DIR}/schema/latest/as3-schema.json ${DIST_DIR}/as3-schema-${VERSION}.json
cp ${TOP_DIR}/examples/as3.examples.collection.json ${DIST_DIR}/as3-${VERSION}.examples.collection.json
cp ${SRC_DIR}/schema/latest/per-app-schema.json ${DIST_DIR}/per-app-schema-${VERSION}.json

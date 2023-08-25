#!/bin/bash

# Allowed build targets are "cloud", "debug"
BUILD_TARGET=${1:-"cloud"}

set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$ARTIFACTORY_URL" ]; then
    echo -e "${RED}Artifactory URL is required to build RPM.${NC}"
    exit 1
fi

function set_vars() {
    # compute release
    FULL_VERSION=$(node -e "console.log(require('./package.json').version)")
    RELEASE=$(echo $FULL_VERSION | sed 's/[0-9.]*-//')
    VERSION=$(echo $FULL_VERSION | sed 's/-[0-9]*//')
    MAINDIR=$(pwd)
    DISCOVERY_WORKER_VERSION="1.15.0-3"
    DISCOVERY_WORKER_URL="https://${ARTIFACTORY_URL}/artifactory/list/ecosystems-f5-service-discovery-rpm/f5-service-discovery-${DISCOVERY_WORKER_VERSION}.noarch.rpm"
    CLOUDLIBS_VER=$(echo $DISCOVERY_WORKER_VERSION)
}

function build_adc_schema() {
    node scripts/build/schema-build.js
}

function build_versions_file() {
    echo "{
    \"discoveryWorker\": \"$DISCOVERY_WORKER_VERSION\"
}" > src/lib/versions.json
}

function build_common() {
    rpmbuild --quiet -bb \
        --define "main $(pwd)" \
        --define '_topdir %{main}/rpmbuild' \
        --define "_name f5-appsvcs" \
        --define "_version ${VERSION}" \
        --define "_release ${RELEASE}" \
        --define "_cloudver ${CLOUDLIBS_VER}" \
        --define "_build_target ${BUILD_TARGET}" \
        --define "_perf_tracing_enabled ${F5_PERF_TRACING_ENABLED-false}" \
        f5-appsvcs.spec
    cd rpmbuild/RPMS/noarch
    OUTPUT=$(ls -t *.rpm 2>/dev/null | head -1)
    cp ${OUTPUT} ${MAINDIR}/dist
    echo "*** Built RPM: dist/${OUTPUT}"
    cd ${MAINDIR}
}

function build_main_rpm() {
    mkdir -p rpmbuild/cloud-libs
    mkdir -p rpmbuild/pkgs
}

function prep_packages() {
    echo "*** Downloading service-discovery RPM"
    curl -ko "rpmbuild/pkgs/f5-service-discovery-$DISCOVERY_WORKER_VERSION.noarch.rpm" $DISCOVERY_WORKER_URL
}

function build_cloud_rpm() {
    if [ "$BUILD_TARGET" = "cloud" ] || [ "$BUILD_TARGET" = "debug" ]; then
        prep_packages
        build_common
        RPM=$OUTPUT
    fi
}

function create_sha_files() {
    cd dist
    sha256sum "${RPM}" > "${RPM}.sha256"
    cd ..
    echo "*** Created SHA-256 checksum files"
}

function main() {
    build_adc_schema
    set_vars
    build_versions_file

    mkdir -p dist
    echo "*** RPM build starting ..."
    build_main_rpm
    build_cloud_rpm
    echo "*** RPM build finished"

    create_sha_files
    # clean up build directory
    rm -Rf rpmbuild
    rm -Rf pkgs
}

main

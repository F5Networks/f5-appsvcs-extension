#!/bin/bash

set -e

IP="$1"
CREDS="$2"
DO_RPM_FILE="$3"
ONBOARD_FILE="$4"
RPM_PACKAGE="$5"

scripts/dev/install-rpm.sh "$IP" "$CREDS" "$DO_RPM_FILE"
scripts/dev/run-do.sh "$IP" "$CREDS" "$ONBOARD_FILE"
scripts/dev/wait-for-do.sh "$IP" "$CREDS"
scripts/dev/install-rpm.sh "$IP" "$CREDS" "$RPM_PACKAGE"

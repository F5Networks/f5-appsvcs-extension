#!/bin/bash

# Release machines using QRT (Quick Reserve Tool)
# This script will replace terraform destroy for machine cleanup

set -e

echo "Starting machine release using QRT..."

# QRT API endpoint base URL
RESERVATIONS_URL="${QRT_URL}/reservations"  # QRT production URL

# Try to read from harness file first
if [[ -f "qrt_harness_file.json" ]]; then
    echo "Found qrt_harness_file.json, reading reservation info..."
    QRT_RESERVATION_IDS=$(jq -c '.reservation_ids' qrt_harness_file.json)
    TF_VAR_bigip_count=$(jq -r '.machine_count' qrt_harness_file.json)
    export TF_VAR_bigip_count
    echo "Loaded from harness file: $TF_VAR_bigip_count machine(s), reservation IDs: $QRT_RESERVATION_IDS"
fi

# Check if we have reservation IDs to release
if [[ -z "$QRT_RESERVATION_IDS" || "$QRT_RESERVATION_IDS" == "[]" || "$QRT_RESERVATION_IDS" == "" || "$QRT_RESERVATION_IDS" == "null" ]]; then
    echo "QRT_RESERVATION_IDS not provided - attempting to discover reservations..."
    
    # Try to discover reservations using the same pattern as reserve_machines.sh
    PIPELINE_ID="${CI_PIPELINE_IID:-12345}"
    
    # If TF_VAR_bigip_count not set, determine it from PARALLEL and REGRESSION_SCHEDULE
    # (same logic as in .gitlab-ci.yml deploy stage)
    if [[ -z "$TF_VAR_bigip_count" ]]; then
        echo "TF_VAR_bigip_count not set, determining from pipeline variables..."
        if [[ "$PARALLEL" = "true" ]]; then
            export TF_VAR_bigip_count=3
            echo "  PARALLEL=true, setting machine count to 3"
        elif [ "$REGRESSION_SCHEDULE" = "remote" ]; then
            export TF_VAR_bigip_count=2
            echo "  REGRESSION_SCHEDULE=remote, setting machine count to 2"
        else
            export TF_VAR_bigip_count=1
            echo "  Default: setting machine count to 1"
        fi
    fi

    if [[ -z "$TF_VAR_bigip_count" ]]; then
        echo "Warning: Could not determine TF_VAR_bigip_count, cannot discover reservations"
        echo "No machines to release"
        exit 0
    fi
    
    echo "Searching for reservations with pipeline ID: $PIPELINE_ID"
    echo "Expected machine count: $TF_VAR_bigip_count"
    
    DISCOVERED_IDS=()
    
    for ((i=1; i<=TF_VAR_bigip_count; i++)); do
        echo "Searching for machine $i reservation..."

        # Build email to search for
        SEARCH_EMAIL="as3.${PIPELINE_ID}.${i}@f5.com"
        echo "Looking for reservation with email: $SEARCH_EMAIL"

        echo "Querying QRT for all reservations..."
        RESPONSE=$(curl -s -X GET "$RESERVATIONS_URL" \
            -H "Content-Type: application/json")
        CURL_EXIT_CODE=$?

        if [[ $CURL_EXIT_CODE -ne 0 ]]; then
            echo "  Warning: curl failed with exit code $CURL_EXIT_CODE (network/URL issue)"
        elif [[ -n "$RESPONSE" ]]; then
            STATUS=$(echo "$RESPONSE" | jq -r '.status // ""')

            if [[ "$STATUS" == "SUCCEEDED" ]]; then
                # Search through reservations array for matching email
                RESERVATION_ID=$(echo "$RESPONSE" | jq -r --arg email "$SEARCH_EMAIL" \
                    '.reservations[] | select(.email == $email) | .id' | head -n 1)

                if [[ -n "$RESERVATION_ID" && "$RESERVATION_ID" != "null" ]]; then
                    DISCOVERED_IDS+=("\"$RESERVATION_ID\"")
                    echo "  Found reservation: $RESERVATION_ID"
                else
                    echo "  No reservation found for machine $i with email: $SEARCH_EMAIL"
                fi
            else
                echo "  Error: QRT returned status: $STATUS"
            fi
        else
            echo "  Error querying QRT for machine $i"
        fi

        echo "Executed: curl -X GET '$RESERVATIONS_URL'"
    done

    if [[ ${#DISCOVERED_IDS[@]} -gt 0 ]]; then
        QRT_RESERVATION_IDS="[$(IFS=,; echo "${DISCOVERED_IDS[*]}")]"
        export QRT_RESERVATION_IDS
        echo "Discovered ${#DISCOVERED_IDS[@]} reservation(s): $QRT_RESERVATION_IDS"
    else
        echo "No reservations discovered - nothing to release"
        exit 0
    fi
fi

# Parse the reservation IDs (expecting JSON array format)
echo "Parsing reservation IDs..."
RESERVATION_IDS=($(echo "$QRT_RESERVATION_IDS" | jq -r '.[]'))

if [[ ${#RESERVATION_IDS[@]} -eq 0 ]]; then
    echo "Warning: No reservation IDs found in QRT_RESERVATION_IDS"
    echo "No machines to release"
    exit 0
fi

echo "Found ${#RESERVATION_IDS[@]} reservation(s) to release"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_SCRIPT="$SCRIPT_DIR/release_single_reservation.sh"

# Check if the release script exists
if [[ ! -f "$RELEASE_SCRIPT" ]]; then
    echo "ERROR: release_single_reservation.sh not found at: $RELEASE_SCRIPT"
    echo "Please ensure the script exists in the same directory"
    exit 1
fi

# Make sure the script is executable
chmod +x "$RELEASE_SCRIPT"

# Release each machine
FAILED_RELEASES=()
SUCCESSFUL_RELEASES=()

for reservation_id in "${RESERVATION_IDS[@]}"; do
    echo
    echo "Releasing reservation: $reservation_id"
    
    # Call the release script
    set +e  # Temporarily disable exit on error to capture exit code
    "$RELEASE_SCRIPT" "$reservation_id" "$QRT_URL"
    RELEASE_EXIT_CODE=$?
    set -e  # Re-enable exit on error
    
    # Check exit code
    if [[ $RELEASE_EXIT_CODE -eq 0 ]]; then
        echo "Successfully released: $reservation_id"
        SUCCESSFUL_RELEASES+=("$reservation_id")
    else
        echo "Failed to release: $reservation_id (exit code: $RELEASE_EXIT_CODE)"
        FAILED_RELEASES+=("$reservation_id")
    fi
done

# Summary
echo
echo "=== Machine Release Summary ==="
echo "Total reservations processed: ${#RESERVATION_IDS[@]}"
echo "Successful releases: ${#SUCCESSFUL_RELEASES[@]}"
echo "Failed releases: ${#FAILED_RELEASES[@]}"

if [[ ${#SUCCESSFUL_RELEASES[@]} -gt 0 ]]; then
    echo
    echo "Successfully released:"
    for id in "${SUCCESSFUL_RELEASES[@]}"; do
        echo "  - $id"
    done
fi

if [[ ${#FAILED_RELEASES[@]} -gt 0 ]]; then
    echo
    echo "Failed to release:"
    for id in "${FAILED_RELEASES[@]}"; do
        echo "  - $id"
    done
    echo
    echo "WARNING: Some machines may still be reserved in QRT"
    echo "Manual cleanup may be required"
    # Don't exit with error - we want teardown to continue even if some releases fail
fi

echo
echo "Machine release completed"

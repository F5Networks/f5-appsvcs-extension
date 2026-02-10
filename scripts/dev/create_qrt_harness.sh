#!/bin/bash

# Create QRT harness file for passing reservation info between pipeline stages
# Usage: create_qrt_harness.sh <reservation_ids_json> <machine_count> <machines_json>

set -e

if [[ $# -lt 3 ]]; then
    echo "Error: Missing required parameters"
    echo "Usage: $0 <reservation_ids_json> <machine_count> <machines_json>"
    exit 1
fi

RESERVATION_IDS="$1"
MACHINE_COUNT="$2"
MACHINES_JSON="$3"
OUTPUT_FILE="${4:-qrt_harness_file.json}"

echo "Creating QRT harness file: $OUTPUT_FILE"

# Create the JSON structure using jq to properly escape everything
jq -n \
  --argjson reservation_ids "$RESERVATION_IDS" \
  --argjson machine_count "$MACHINE_COUNT" \
  --argjson machines "$MACHINES_JSON" \
  '{
    reservation_ids: $reservation_ids,
    machine_count: $machine_count,
    machines: $machines
  }' > "$OUTPUT_FILE"

if [[ $? -eq 0 ]]; then
    echo "Successfully created $OUTPUT_FILE"
    echo "Contents:"
    cat "$OUTPUT_FILE"
else
    echo "Error: Failed to create $OUTPUT_FILE"
    exit 1
fi

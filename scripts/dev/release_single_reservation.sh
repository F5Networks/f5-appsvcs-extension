#!/bin/bash

# Release a single QRT reservation
# Usage: ./release_single_reservation.sh <reservation_id> [qrt_url]
# 
# Arguments:
#   reservation_id: The QRT reservation ID to release (required)
#   qrt_url: The base QRT URL (optional, defaults to QRT_URL env var)
#
# Environment variables:
#   QRT_URL: Base URL for QRT API (used if qrt_url arg not provided)
#   QRT_PASSPHRASE: Required passphrase for deletion
#
# Exit codes:
#   0: Successfully released
#   1: Invalid arguments or missing required environment variables
#   2: curl command failed (network/connectivity issue)
#   3: QRT API returned an error

# Parse arguments
RESERVATION_ID="$1"
QRT_BASE_URL="${2:-$QRT_URL}"

# Validate inputs
if [[ -z "$RESERVATION_ID" ]]; then
    echo "ERROR: reservation_id is required" >&2
    echo "Usage: $0 <reservation_id> [qrt_url]" >&2
    exit 1
fi

if [[ -z "$QRT_BASE_URL" ]]; then
    echo "ERROR: QRT URL not provided (set QRT_URL env var or pass as second argument)" >&2
    exit 1
fi

if [[ -z "$QRT_PASSPHRASE" ]]; then
    echo "ERROR: QRT_PASSPHRASE environment variable is required" >&2
    exit 1
fi

# Build the API endpoint
RESERVATIONS_URL="${QRT_BASE_URL}/reservations"

echo "Releasing QRT reservation: $RESERVATION_ID"
echo "QRT URL: $RESERVATIONS_URL"

# Build DELETE request body with required passphrase
DELETE_BODY="{\"passphrase\": \"${QRT_PASSPHRASE}\"}"

# Make the DELETE request
# Note: curl waits synchronously for the server to complete deletion and respond
# This typically takes a few seconds as QRT releases the machine
echo "Making DELETE request..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$RESERVATIONS_URL/$RESERVATION_ID" \
    -H "Content-Type: application/json" \
    -d "$DELETE_BODY" 2>&1)
CURL_EXIT_CODE=$?

# Check if curl command itself failed
if [[ $CURL_EXIT_CODE -ne 0 ]]; then
    echo "ERROR: curl failed with exit code $CURL_EXIT_CODE" >&2
    echo "This might be a network connectivity issue or invalid URL" >&2
    exit 2
fi

# Extract HTTP status code (last line) and response body (everything else)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

# Check HTTP status code for success (2xx range)
if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]]; then
    echo "Successfully released reservation: $RESERVATION_ID"
    exit 0
else
    echo "ERROR: QRT API returned non-success status code: $HTTP_CODE" >&2
    
    # Try to parse error message from response if it's JSON
    if command -v jq &> /dev/null && echo "$RESPONSE_BODY" | jq . &> /dev/null; then
        ERROR_MSG=$(echo "$RESPONSE_BODY" | jq -r '.message // .error // "Unknown error"')
        echo "Error message: $ERROR_MSG" >&2
    fi
    
    exit 3
fi

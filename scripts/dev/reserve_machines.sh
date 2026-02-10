#!/bin/bash

# Reserve machines using QRT (Quick Reserve Tool)
# This script will replace terraform for machine provisioning

set -e

echo "Starting machine reservation using QRT..."

# Check if required environment variables are set
if [[ -z "$TF_VAR_bigip_count" ]]; then
    echo "Error: TF_VAR_bigip_count is not set"
    exit 1
fi

if [[ -z "$BIGIP_IMAGE" ]]; then
    echo "Error: BIGIP_IMAGE is not set"
    exit 1
fi

# Use CI_PIPELINE_IID if available, otherwise fallback to a default
PIPELINE_ID="${CI_PIPELINE_IID:-12345}"

echo "Requesting $TF_VAR_bigip_count BIG-IP machine(s)..."
echo "Using BIGIP_IMAGE: $BIGIP_IMAGE"
echo "Using Pipeline ID: $PIPELINE_ID"

# Build QRT requests for each machine
RESERVATIONS_URL="${QRT_URL}/reservations"  # QRT production URL
MACHINE_IPS=()
QRT_MACHINES=()  # Array to store machine info as JSON objects
QRT_RESERVATION_IDS=()  # Array to store reservation IDs for cleanup
ADMIN_USERNAME=""
ADMIN_PASSWORD=""

for ((i=1; i<=TF_VAR_bigip_count; i++)); do
    echo "Building request for machine $i of $TF_VAR_bigip_count..."

    # Build JSON request body
    # ttl (time to live) is set to 5 hours as this should cover testing and overhead, adjust as needed.
    JSON_BODY=$(cat <<EOF
{
  "email": "as3.${PIPELINE_ID}.${i}@f5.com",
  "passphrase": "${QRT_PASSPHRASE}",
  "image": "${BIGIP_IMAGE}",
  "type": "classic",
  "ttl": 5
}
EOF
)

    echo "Request body for machine $i:"
    echo "$JSON_BODY"
    echo

    # Echo the curl command for visibility
    echo "Executing: curl -X POST '$RESERVATIONS_URL' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '$JSON_BODY'"
    echo

    echo "Making QRT reservation request for machine $i..."
    RESPONSE=$(curl -s -X POST "$RESERVATIONS_URL" \
        -H "Content-Type: application/json" \
        -d "$JSON_BODY")
    CURL_EXIT_CODE=$?

    if [[ $CURL_EXIT_CODE -ne 0 ]]; then
        echo "ERROR: curl failed with exit code $CURL_EXIT_CODE"
        echo "This might be a network connectivity issue or invalid URL"
        echo "Response: $RESPONSE"
        exit 1
    fi

    echo "QRT Response for machine $i:"
    echo "$RESPONSE" | jq .

    # Check if request was successful
    STATUS=$(echo "$RESPONSE" | jq -r '.status')
    if [[ "$STATUS" == "FAILED" ]]; then
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
        echo "ERROR: QRT reservation failed for machine $i"
        echo "Status: $STATUS"
        echo "Error: $ERROR_MSG"
        echo "Full Response: $RESPONSE"
        exit 1
    elif [[ "$STATUS" != "SUCCEEDED" ]]; then
        echo "ERROR: QRT reservation returned unexpected status for machine $i"
        echo "Status: $STATUS"
        echo "Full Response: $RESPONSE"
        exit 1
    fi

    # Check if this is a task response (machine being created) or immediate reservation
    TASK_ID=$(echo "$RESPONSE" | jq -r '.task.task_id // ""')
    if [[ -n "$TASK_ID" && "$TASK_ID" != "null" ]]; then
        echo "INFO: Machine not immediately available, task created"
        TASK_RESERVATION_ID=$(echo "$RESPONSE" | jq -r '.task.reservation_id')
        TASK_STAGE=$(echo "$RESPONSE" | jq -r '.task.task_stage')
        TASK_STATUS=$(echo "$RESPONSE" | jq -r '.task.task_status')
        echo "  Task ID: $TASK_ID"
        echo "  Reservation ID: $TASK_RESERVATION_ID"
        echo "  Task Stage: $TASK_STAGE"
        echo "  Task Status: $TASK_STATUS"
        echo ""

        # Poll the reservation endpoint until machine is ready
        echo "Polling for machine creation status..."
        MAX_RETRIES=28 # 28 retries with 7% backoff = up to ~110 minutes (just under 2 hour timeout)
        RETRY_COUNT=0
        POLL_INTERVAL=30  # Start with 30 seconds
        LAST_TASK_STAGE=""
        LAST_TASK_STATUS=""

        while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
            echo "  Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Checking reservation status (polling in ${POLL_INTERVAL}s)..."
            echo "     Waiting for $POLL_INTERVAL seconds before polling..."
            sleep $POLL_INTERVAL
            POLL_INTERVAL=$((POLL_INTERVAL + POLL_INTERVAL / 7))  # Increase interval by ~7% each time, for backoff

            # Poll the tasks endpoint to get task status
            TASKS_URL="${QRT_URL}/tasks"
            POLL_RESPONSE=$(curl -s -X GET "${TASKS_URL}/${TASK_ID}" 2>&1)
            POLL_EXIT=$?

            if [[ $POLL_EXIT -ne 0 ]]; then
                echo "    Warning: Failed to poll reservation (curl exit $POLL_EXIT)"
                RETRY_COUNT=$((RETRY_COUNT + 1))
                continue
            fi

            # Check if we got valid JSON
            if ! echo "$POLL_RESPONSE" | jq . >/dev/null 2>&1; then
                echo "    Warning: Invalid JSON response from polling"
                RETRY_COUNT=$((RETRY_COUNT + 1))
                continue
            fi

            TASK_STAGE=$(echo "$POLL_RESPONSE" | jq -r '.task.task_stage // ""')
            TASK_STATUS=$(echo "$POLL_RESPONSE" | jq -r '.task.task_status // ""')

            # Store for timeout error message
            LAST_TASK_STAGE="$TASK_STAGE"
            LAST_TASK_STATUS="$TASK_STATUS"

            if [[ "$TASK_STAGE" == "RESERVED" && "$TASK_STATUS" == "DONE" ]]; then
                echo "    ✓ Machine is ready!"
                # Fetch the actual reservation details from the reservations endpoint
                echo "    Fetching reservation details..."
                RESPONSE=$(curl -s -X GET "${RESERVATIONS_URL}/${TASK_RESERVATION_ID}" 2>&1)
                if [[ $? -eq 0 ]] && echo "$RESPONSE" | jq . >/dev/null 2>&1; then
                    echo "    Successfully retrieved reservation details"
                else
                    echo "    ERROR: Failed to retrieve reservation details"
                    echo "    Response: $RESPONSE"
                    exit 1
                fi
                break
            elif [[ "$TASK_STATUS" == "FAILED" ]]; then
                ERROR_MSG=$(echo "$POLL_RESPONSE" | jq -r '.error // "Unknown error"')
                echo "ERROR: Machine creation failed for machine $i"
                echo "Task Stage: $TASK_STAGE"
                echo "Task Status: $TASK_STATUS"
                echo "Error: $ERROR_MSG"
                echo "Full Response: $POLL_RESPONSE"
                exit 1
            elif [[ "$TASK_STAGE" == "CREATING" ]]; then
                echo "    Task Stage: $TASK_STAGE, Task Status: $TASK_STATUS"
            else
                echo "    Task Stage: $TASK_STAGE, Task Status: $TASK_STATUS"
            fi

            RETRY_COUNT=$((RETRY_COUNT + 1))
        done

        if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
            echo "ERROR: Timed out waiting for machine $i to be created"
            echo "Last Task Stage: $LAST_TASK_STAGE"
            echo "Last Task Status: $LAST_TASK_STATUS"
            exit 1
        fi

        echo ""
    fi

    # Check if this is a reused reservation
    MESSAGE=$(echo "$RESPONSE" | jq -r '.message // ""')
    if [[ "$MESSAGE" == *"reservation already exists"* ]]; then
        echo "INFO: Reusing existing reservation for machine $i"
        echo "Message: $MESSAGE"
    else
        echo "INFO: New reservation created for machine $i"
    fi

    # Extract login information from response
    MGMT_ADDRESS=$(echo "$RESPONSE" | jq -r '.login_info.mgmt_address')
    MACHINE_USERNAME=$(echo "$RESPONSE" | jq -r '.login_info.admin_username')
    MACHINE_PASSWORD=$(echo "$RESPONSE" | jq -r '.login_info.admin_password')

    MACHINE_IPS+=("$MGMT_ADDRESS")

    # Extract reservation ID for cleanup
    # Always check reservations array first, then fallback to root level fields
    RESERVATION_ID=$(echo "$RESPONSE" | jq -r '.reservations[0].id // .reservation_id // .id // ""')

    if [[ -n "$RESERVATION_ID" && "$RESERVATION_ID" != "null" ]]; then
        QRT_RESERVATION_IDS+=("\"$RESERVATION_ID\"")
        echo "  Reservation ID: $RESERVATION_ID"
    else
        echo "  Warning: No reservation ID found in response"
    fi

    # Create machine info object and add to QRT_MACHINES array
    MACHINE_INFO=$(jq -n \
        --arg ip "$MGMT_ADDRESS" \
        --arg username "$MACHINE_USERNAME" \
        --arg password "$MACHINE_PASSWORD" \
        --arg reservation_id "$RESERVATION_ID" \
        '{ ip: $ip, username: $username, password: $password, reservation_id: $reservation_id }')
    QRT_MACHINES+=("$MACHINE_INFO")

    # Keep first machine credentials for backward compatibility
    if [[ -z "$ADMIN_USERNAME" ]]; then
        ADMIN_USERNAME="$MACHINE_USERNAME"
        ADMIN_PASSWORD="$MACHINE_PASSWORD"
    fi

    echo "Machine $i reserved successfully:"
    echo "  Management Address: $MGMT_ADDRESS"
    echo "  Admin Username: $MACHINE_USERNAME"
    echo "  Admin Password: $MACHINE_PASSWORD"
    echo
done

# Export the same variables that terraform previously provided
echo "Exporting machine connection details..."

# Build JSON array of IP addresses (for backward compatibility)
BIGIPS_JSON=$(printf '%s\n' "${MACHINE_IPS[@]}" | jq -R . | jq -s .)
export BIGIPS_ADDRESSES="$BIGIPS_JSON"

# Export QRT-specific machine data with individual credentials
# Keep credentials ONLY in environment variables for security - do not write to files
QRT_MACHINES_JSON=$(printf '%s\n' "${QRT_MACHINES[@]}" | jq -s .)
export QRT_MACHINES_JSON="$QRT_MACHINES_JSON"

echo "QRT machine credentials stored in environment variable QRT_MACHINES_JSON (not written to file for security)"
echo "Number of machines: $(echo "$QRT_MACHINES_JSON" | jq 'length')"

# Export reservation IDs for cleanup
if [[ ${#QRT_RESERVATION_IDS[@]} -gt 0 ]]; then
    QRT_RESERVATION_IDS_JSON="[$(IFS=,; echo "${QRT_RESERVATION_IDS[*]}")]"
    export QRT_RESERVATION_IDS="$QRT_RESERVATION_IDS_JSON"
    echo "QRT_RESERVATION_IDS: $QRT_RESERVATION_IDS (stored in environment variable only)"
else
    export QRT_RESERVATION_IDS='[]'
    echo "No QRT reservation IDs to track"
fi

# Export first machine credentials for backward compatibility
export ADMIN_USERNAME="$ADMIN_USERNAME"
export ADMIN_PASSWORD="$ADMIN_PASSWORD"

echo "Machine reservation completed successfully"
echo ""
echo "=== Security Notice ==="
echo "Credentials are stored ONLY in environment variables and NOT written to disk."
echo "  - QRT_MACHINES_JSON: Contains IP addresses and credentials (in memory only)"
echo "  - QRT_RESERVATION_IDS: Contains reservation IDs for cleanup"
echo "  - BIGIPS_ADDRESSES: IP addresses array"
echo "  - ADMIN_USERNAME/PASSWORD: First machine credentials (backward compatibility)"
echo ""
echo "Number of machines reserved: $(echo "$QRT_MACHINES_JSON" | jq 'length')"

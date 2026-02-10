#!/bin/bash

# Common utility functions for BIG-IP management scripts
# Source this file in other scripts with: source "$(dirname "$0")/common-utils.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if REST framework is available on either port 443 or 8443
# Usage: check_echo_js_endpoint <target> <curl_flags> [reservation_id]
# Example: check_echo_js_endpoint "10.145.40.111" "--silent --insecure -u admin:pass"
# Example with auto-release: check_echo_js_endpoint "10.145.40.111" "--silent --insecure -u admin:pass" "reservation_abc123"
check_echo_js_endpoint() {
    local TARGET="$1"
    local CURL_FLAGS="$2"
    local RESERVATION_ID="${3:-}"
    local MAX_TRIES=300
    local counter=1
    set +e
    
    # Try both ports 443 and 8443 on each attempt
    for port in 443 8443; do
        local ECHO_JS_URL="https://$TARGET:$port/mgmt/shared/echo-js"
        local INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$ECHO_JS_URL" 2>/dev/null)
        if [[ -n $(echo $INFO | jq -r .stage 2>/dev/null) ]]; then
            echo "  REST framework is available on port $port"
            set -e
            return 0
        fi
    done
    
    # If neither port worked on first try, loop until success or max tries
    until [[ $counter -gt $MAX_TRIES ]]; do
        ((counter++))
        # Print progress every 30 seconds (every 3rd iteration)
        if (( counter % 3 == 0 )); then
            echo "  Still waiting for REST framework... (attempt $counter/$MAX_TRIES, elapsed: $((counter * 10))s)"
        fi

        # At attempt 100 (~1000 seconds), try restarting restnoded
        if [[ $counter -eq 100 ]]; then
            echo -e "${YELLOW}  Attempt 100 reached - attempting to restart restnoded on $TARGET${NC}"

            # Check if sshpass is available, try to install if not
            if ! command -v sshpass &> /dev/null; then
                echo "    sshpass not found, attempting to install..."
                if command -v apk &> /dev/null; then
                    apk add sshpass &> /dev/null && echo "    sshpass installed successfully" || echo "    Warning: failed to install sshpass"
                elif command -v apt-get &> /dev/null; then
                    apt-get update &> /dev/null && apt-get install -y sshpass &> /dev/null && echo "    sshpass installed successfully" || echo "    Warning: failed to install sshpass"
                else
                    echo "    Warning: Cannot install sshpass (no supported package manager found)"
                fi
            fi

            # Try to get SSH credentials from QRT_MACHINES_JSON
            local SSH_USER=""
            local SSH_PASS=""
            if [[ -n "$QRT_MACHINES_JSON" ]]; then
                SSH_USER=$(echo "$QRT_MACHINES_JSON" | jq -r --arg ip "$TARGET" '.[] | select(.ip == $ip) | .username // empty' 2>/dev/null | head -n 1)
                SSH_PASS=$(echo "$QRT_MACHINES_JSON" | jq -r --arg ip "$TARGET" '.[] | select(.ip == $ip) | .password // empty' 2>/dev/null | head -n 1)

                # If password not found for specific machine, use unified password from first machine
                # (machines are unified to same password during prepare_machines.sh)
                if [[ -z "$SSH_PASS" ]]; then
                    SSH_PASS=$(echo "$QRT_MACHINES_JSON" | jq -r '.[0].password // empty' 2>/dev/null)
                    if [[ -n "$SSH_PASS" ]]; then
                        echo "    Using unified password from first machine"
                    fi
                fi

                # If username not found, default to admin
                if [[ -z "$SSH_USER" ]]; then
                    SSH_USER=$(echo "$QRT_MACHINES_JSON" | jq -r '.[0].username // "admin"' 2>/dev/null)
                fi
            fi

            # Try from qrt_harness_file.json if still not found
            if [[ -z "$SSH_USER" || -z "$SSH_PASS" ]] && [[ -f "qrt_harness_file.json" ]]; then
                if [[ -z "$SSH_USER" ]]; then
                    SSH_USER=$(jq -r --arg ip "$TARGET" '.machines[] | select(.ip == $ip) | .username // empty' qrt_harness_file.json 2>/dev/null | head -n 1)
                fi
                if [[ -z "$SSH_PASS" ]]; then
                    SSH_PASS=$(jq -r --arg ip "$TARGET" '.machines[] | select(.ip == $ip) | .password // empty' qrt_harness_file.json 2>/dev/null | head -n 1)
                    # Fall back to first machine's password from harness file
                    if [[ -z "$SSH_PASS" ]]; then
                        SSH_PASS=$(jq -r '.machines[0].password // empty' qrt_harness_file.json 2>/dev/null)
                    fi
                fi
            fi

            if [[ -n "$SSH_USER" && -n "$SSH_PASS" ]]; then
                if command -v sshpass &> /dev/null; then
                    echo "    Executing: bigstart restart restnoded"
                    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=quiet \
                        -o ConnectTimeout=10 "$SSH_USER@$TARGET" 'bigstart restart restnoded' 2>&1 | sed 's/^/    /' || echo "    Warning: restart command may have failed"
                    echo "    Restart initiated, continuing to wait..."
                else
                    echo "    Warning: sshpass not available after installation attempt, cannot restart restnoded"
                fi
            else
                echo "    Warning: SSH credentials not found, cannot restart restnoded"
            fi
        fi

        sleep 10
        
        # Try both ports on each retry
        for port in 443 8443; do
            local ECHO_JS_URL="https://$TARGET:$port/mgmt/shared/echo-js"
            local INFO=$(curl ${CURL_FLAGS} --write-out "" --fail --silent "$ECHO_JS_URL" 2>/dev/null)
            if [[ -n $(echo $INFO | jq -r .stage 2>/dev/null) ]]; then
                echo "  REST framework is now available on port $port (took $((counter * 10))s)"
                set -e
                return 0
            fi
        done
    done
    
    # Max tries reached - report failure
    echo -e "${RED}Max tries reached ($((MAX_TRIES * 10))s elapsed) while waiting for REST framework on $TARGET${NC}"
    echo -e "${RED}Tried both ports 443 and 8443. Last response: $INFO${NC}"

    # Try to find reservation_id if not provided
    if [[ -z "$RESERVATION_ID" || "$RESERVATION_ID" == "null" ]]; then
        # Try to look up from QRT_MACHINES_JSON environment variable
        if [[ -n "$QRT_MACHINES_JSON" ]]; then
            RESERVATION_ID=$(echo "$QRT_MACHINES_JSON" | jq -r --arg ip "$TARGET" '.[] | select(.ip == $ip) | .reservation_id // empty' 2>/dev/null | head -n 1)
            if [[ -n "$RESERVATION_ID" && "$RESERVATION_ID" != "null" ]]; then
                echo "  Found reservation_id from QRT_MACHINES_JSON: $RESERVATION_ID"
            fi
        fi

        # Try to look up from qrt_harness_file.json if still not found
        if [[ -z "$RESERVATION_ID" || "$RESERVATION_ID" == "null" ]] && [[ -f "qrt_harness_file.json" ]]; then
            RESERVATION_ID=$(jq -r --arg ip "$TARGET" '.machines[] | select(.ip == $ip) | .reservation_id // empty' qrt_harness_file.json 2>/dev/null | head -n 1)
            if [[ -n "$RESERVATION_ID" && "$RESERVATION_ID" != "null" ]]; then
                echo "  Found reservation_id from qrt_harness_file.json: $RESERVATION_ID"
            fi
        fi
    fi

    # Attempt to release the machine if reservation_id was provided or found
    if [[ -n "$RESERVATION_ID" && "$RESERVATION_ID" != "null" ]]; then
        local SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        local RELEASE_SCRIPT="$SCRIPT_DIR/release_single_reservation.sh"

        if [[ -f "$RELEASE_SCRIPT" && -n "$QRT_URL" && -n "$QRT_PASSPHRASE" ]]; then
            echo -e "${YELLOW}Attempting to release timed-out machine (reservation: $RESERVATION_ID)...${NC}"
            set -e  # Temporarily re-enable for the release script
            "$RELEASE_SCRIPT" "$RESERVATION_ID" "$QRT_URL" 2>&1 | sed 's/^/  /' || true
            set +e  # Disable again
            echo -e "${YELLOW}Release attempt completed${NC}"
        fi
    else
        echo -e "${YELLOW}No reservation_id available - cannot auto-release machine${NC}"
    fi

    set -e
    return 1
}

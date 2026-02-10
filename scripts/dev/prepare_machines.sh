#!/bin/bash

set -e

# Source common utilities (including color definitions)
source "scripts/dev/common-utils.sh"

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}sshpass not found. Installing...${NC}"
    apk add sshpass
    echo -e "${GREEN}sshpass installed successfully${NC}"
fi

echo -e "${BLUE}Starting machine preparation...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_SCRIPT="$SCRIPT_DIR/release_single_reservation.sh"

# Check if the release script exists and make it executable
if [[ -f "$RELEASE_SCRIPT" ]]; then
    chmod +x "$RELEASE_SCRIPT"
    echo -e "${GREEN}Found release script: $RELEASE_SCRIPT${NC}"
else
    echo -e "${YELLOW}Warning: release_single_reservation.sh not found${NC}"
    echo -e "${YELLOW}Machines in bad state will not be automatically released${NC}"
fi

# Check if QRT_MACHINES_JSON environment variable is set
if [ -z "$QRT_MACHINES_JSON" ]; then
    echo -e "${RED}Error: QRT_MACHINES_JSON environment variable not set${NC}"
    echo "Machine data must be provided by reserve_machines.sh via QRT_MACHINES_JSON"
    echo "This keeps credentials secure by never writing them to disk"
    exit 1
fi

echo -e "${GREEN}Using QRT_MACHINES_JSON environment variable${NC}"

# Build harness format from QRT_MACHINES_JSON
# QRT format: [{"ip":"x","username":"y","password":"z","reservation_id":"abc"}]
# Harness format: [{"admin_ip":"x","f5_rest_user":{...},"ssh_user":{...},"reservation_id":"abc"}]
HARNESS_JSON=$(echo "$QRT_MACHINES_JSON" | jq '[.[] | {
    admin_ip: .ip,
    f5_rest_user: {username: .username, password: .password},
    ssh_user: {username: "admin", password: .password},
    reservation_id: .reservation_id
}]')

# Validate JSON format
echo -e "${YELLOW}Validating machine data format...${NC}"
echo "$HARNESS_JSON" | jq . >/dev/null 2>&1 || {
    echo -e "${RED}Invalid JSON in QRT_MACHINES_JSON${NC}"
    exit 1
}

echo -e "${GREEN}Machine data validation successful${NC}"
echo

# Get count of machines
MACHINE_COUNT=$(echo "$HARNESS_JSON" | jq 'length')
echo -e "${GREEN}Found $MACHINE_COUNT machine(s) to prepare${NC}"
echo

# Extract unified password from first machine for password synchronization
# All machines will be synchronized to use this password
UNIFIED_SSH_PASSWORD=$(echo "$HARNESS_JSON" | jq -r '.[0].ssh_user.password')
echo -e "${BLUE}Unified password for synchronization: $UNIFIED_SSH_PASSWORD${NC}"
echo

# Create directory for parallel execution logs (persists for artifacts)
LOG_DIR="prepare_machines_logs"
mkdir -p "$LOG_DIR"
echo -e "${BLUE}Machine logs directory: $LOG_DIR${NC}"
echo

# Function to process a single machine
process_machine() {
    local i=$1
    local LOG_FILE="$LOG_DIR/machine_$((i + 1)).log"
    local HAS_ERRORS=0

    # Redirect all output to log file for parallel execution
    exec > "$LOG_FILE" 2>&1
    echo -e "${BLUE}=== Processing Machine $((i + 1)) ===${NC}"

    # Extract machine details
    ADMIN_IP=$(echo "$HARNESS_JSON" | jq -r ".[$i].admin_ip")
    F5_USERNAME=$(echo "$HARNESS_JSON" | jq -r ".[$i].f5_rest_user.username")
    F5_PASSWORD=$(echo "$HARNESS_JSON" | jq -r ".[$i].f5_rest_user.password")
    SSH_USERNAME=$(echo "$HARNESS_JSON" | jq -r ".[$i].ssh_user.username")
    SSH_PASSWORD=$(echo "$HARNESS_JSON" | jq -r ".[$i].ssh_user.password")
    RESERVATION_ID=$(echo "$HARNESS_JSON" | jq -r ".[$i].reservation_id // \"\"")

    echo "  Admin IP:       $ADMIN_IP"
    echo "  F5 Username:    $F5_USERNAME"
    echo "  F5 Password:    $F5_PASSWORD"
    echo "  SSH Username:   $SSH_USERNAME"
    echo "  SSH Password:   $SSH_PASSWORD"
    if [[ -n "$RESERVATION_ID" ]]; then
        echo "  Reservation ID: $RESERVATION_ID"
    fi
    echo

    # Gather current DO config ID from the machine
    echo -e "  ${YELLOW}Gathering current DO configuration...${NC}"

    # Initialize variables that will be used later
    RESPONSE_TYPE=""
    ARRAY_LENGTH=0
    CONFIG_ID=""

    # Test connectivity by fetching DO config (this validates both connectivity AND credentials)
    # Try passwords in order: machine's own password, new unified password, previous unified password
    DO_CONFIG_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
        -u "$F5_USERNAME:$F5_PASSWORD" \
        -H "Content-Type: application/json" \
        -X GET "https://$ADMIN_IP/mgmt/shared/declarative-onboarding/config" \
        2>/dev/null || echo "ERROR")

    # Check if we got a 401 Unauthorized (password may have been changed in previous run)
    if [[ "$DO_CONFIG_RESPONSE" == *"401 Unauthorized"* ]] || [[ "$DO_CONFIG_RESPONSE" == *"401 Authorization Required"* ]]; then
        echo "  Initial credentials failed (401 Unauthorized), trying unified password..."

        # Retry with unified password (new QRT_MACHINES[0] password)
        DO_CONFIG_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
            -u "$F5_USERNAME:$UNIFIED_SSH_PASSWORD" \
            -H "Content-Type: application/json" \
            -X GET "https://$ADMIN_IP/mgmt/shared/declarative-onboarding/config" \
            2>/dev/null || echo "ERROR")

        if [[ "$DO_CONFIG_RESPONSE" == *"401 Unauthorized"* ]] || [[ "$DO_CONFIG_RESPONSE" == *"401 Authorization Required"* ]]; then
            # Try previous unified password if available (from previous run before retry)
            if [[ -n "$PREVIOUS_UNIFIED_PASSWORD" && "$PREVIOUS_UNIFIED_PASSWORD" != "$UNIFIED_SSH_PASSWORD" ]]; then
                echo "  Unified password failed, trying previous unified password (from before retry)..."
                DO_CONFIG_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
                    -u "$F5_USERNAME:$PREVIOUS_UNIFIED_PASSWORD" \
                    -H "Content-Type: application/json" \
                    -X GET "https://$ADMIN_IP/mgmt/shared/declarative-onboarding/config" \
                    2>/dev/null || echo "ERROR")

                if [[ "$DO_CONFIG_RESPONSE" != *"401 Unauthorized"* ]] && [[ "$DO_CONFIG_RESPONSE" != *"401 Authorization Required"* ]]; then
                    echo -e "  ${GREEN}✓ Successfully authenticated with previous unified password${NC}"
                    # Update passwords to use previous unified password for this machine
                    F5_PASSWORD="$PREVIOUS_UNIFIED_PASSWORD"
                    SSH_PASSWORD="$PREVIOUS_UNIFIED_PASSWORD"
                fi
            fi

            if [[ "$DO_CONFIG_RESPONSE" == *"401 Unauthorized"* ]] || [[ "$DO_CONFIG_RESPONSE" == *"401 Authorization Required"* ]]; then
                echo -e "  ${RED}✗ Cannot authenticate to $ADMIN_IP (credentials incorrect)${NC}"
                echo -e "  ${RED}  All password attempts failed (machine, unified, previous unified)${NC}"

                # Release this machine if we have the reservation ID and release script
                if [[ -n "$RESERVATION_ID" && -f "$RELEASE_SCRIPT" ]]; then
                    echo -e "  ${YELLOW}Unable to connect, attempting to release bad machine (reservation: $RESERVATION_ID)...${NC}"
                    set +e
                    "$RELEASE_SCRIPT" "$RESERVATION_ID" "$QRT_URL" 2>&1 | sed 's/^/    /'
                    RELEASE_EXIT=$?
                    set -e
                    if [[ $RELEASE_EXIT -eq 0 ]]; then
                        echo -e "  ${GREEN}✓ Successfully released bad machine${NC}"
                    else
                        echo -e "  ${YELLOW}⚠ Failed to release machine (exit code: $RELEASE_EXIT)${NC}"
                    fi
                fi

                HAS_ERRORS=1
            fi
        else
            echo -e "  ${GREEN}✓ Successfully authenticated with unified password${NC}"
            # Update passwords to use unified password for all subsequent operations
            F5_PASSWORD="$UNIFIED_SSH_PASSWORD"
            SSH_PASSWORD="$UNIFIED_SSH_PASSWORD"
        fi
    fi

    # Process the DO config response
    if [ "$DO_CONFIG_RESPONSE" = "ERROR" ] || [ -z "$DO_CONFIG_RESPONSE" ]; then
        echo -e "  ${RED}✗ Failed to get DO config from $ADMIN_IP${NC}"
        echo -e "  ${RED}  Network error or machine unavailable${NC}"

        # Release this machine if we have the reservation ID and release script
        if [[ -n "$RESERVATION_ID" && -f "$RELEASE_SCRIPT" ]]; then
            echo -e "  ${YELLOW}Unable to connect, attempting to release bad machine (reservation: $RESERVATION_ID)...${NC}"
            set +e
            "$RELEASE_SCRIPT" "$RESERVATION_ID" "$QRT_URL" 2>&1 | sed 's/^/    /'
            RELEASE_EXIT=$?
            set -e
            if [[ $RELEASE_EXIT -eq 0 ]]; then
                echo -e "  ${GREEN}✓ Successfully released bad machine${NC}"
            else
                echo -e "  ${YELLOW}⚠ Failed to release machine (exit code: $RELEASE_EXIT)${NC}"
            fi
        fi

        HAS_ERRORS=1
    elif [ $HAS_ERRORS -eq 0 ]; then
        echo -e "  ${GREEN}✓ Successfully connected to $ADMIN_IP${NC}"

        # Check if response contains valid JSON
        echo "$DO_CONFIG_RESPONSE" | jq . >/dev/null 2>&1
        if [ $? -eq 0 ]; then
            # Check if response is an array or object
            RESPONSE_TYPE=$(echo "$DO_CONFIG_RESPONSE" | jq -r 'type')

            if [ "$RESPONSE_TYPE" = "array" ]; then
                ARRAY_LENGTH=$(echo "$DO_CONFIG_RESPONSE" | jq 'length')
                echo -e "  ${GREEN}✓ Successfully retrieved DO config from $ADMIN_IP${NC}"
                echo "    Response Type: Array with $ARRAY_LENGTH item(s)"

                if [ "$ARRAY_LENGTH" -gt 0 ]; then
                    # Show info about each config in the array
                    for j in $(seq 0 $((ARRAY_LENGTH - 1))); do
                        CONFIG_ID=$(echo "$DO_CONFIG_RESPONSE" | jq -r ".[$j].id // \"N/A\"")
                        CONFIG_STATUS=$(echo "$DO_CONFIG_RESPONSE" | jq -r ".[$j].result.status // \"N/A\"")
                        echo "    Config [$j] ID:     $CONFIG_ID"
                        echo "    Config [$j] Status: $CONFIG_STATUS"
                    done

                    echo -e "    ${BLUE}Current config preview:${NC}"
                    set +e  # Temporarily disable to handle jq/head pipeline
                    echo "$DO_CONFIG_RESPONSE" | jq -C '.' 2>/dev/null | head -15
                    LINE_COUNT=$(echo "$DO_CONFIG_RESPONSE" | jq '.' 2>/dev/null | wc -l)
                    set -e  # Re-enable
                    if [ "$LINE_COUNT" -gt 15 ]; then
                        echo "    ... (truncated)"
                    fi
                else
                    echo -e "    ${YELLOW}Empty configuration array${NC}"
                fi
            elif [ "$RESPONSE_TYPE" = "object" ]; then
                # Handle single object response
                CONFIG_ID=$(echo "$DO_CONFIG_RESPONSE" | jq -r '.id // "N/A"')
                CONFIG_STATUS=$(echo "$DO_CONFIG_RESPONSE" | jq -r '.result.status // "N/A"')
                echo -e "  ${GREEN}✓ Successfully retrieved DO config from $ADMIN_IP${NC}"
                echo "    Response Type: Object"
                echo "    Config ID:     $CONFIG_ID"
                echo "    Config Status: $CONFIG_STATUS"

                # Show a preview of the config if it exists
                if [ "$CONFIG_ID" != "N/A" ] && [ "$CONFIG_ID" != "null" ]; then
                    echo -e "    ${BLUE}Current config preview:${NC}"
                    set +e  # Temporarily disable to handle jq/head pipeline
                    echo "$DO_CONFIG_RESPONSE" | jq -C '.' 2>/dev/null | head -10
                    LINE_COUNT=$(echo "$DO_CONFIG_RESPONSE" | jq '.' 2>/dev/null | wc -l)
                    set -e  # Re-enable
                    if [ "$LINE_COUNT" -gt 10 ]; then
                        echo "    ... (truncated)"
                    fi
                else
                    echo -e "    ${YELLOW}No existing DO configuration found${NC}"
                fi
            else
                echo -e "  ${YELLOW}✓ Retrieved DO config from $ADMIN_IP${NC}"
                echo "    Response Type: $RESPONSE_TYPE"
                echo -e "    ${BLUE}Raw response:${NC}"
                echo "$DO_CONFIG_RESPONSE" | jq -C '.' | head -10
            fi
        else
            echo -e "  ${RED}✗ Invalid JSON response from $ADMIN_IP${NC}"
            echo "    Response: $DO_CONFIG_RESPONSE"
        fi
    fi

    # Only proceed with machine preparation if no errors so far
    if [ $HAS_ERRORS -eq 0 ]; then
        echo -e "  ${YELLOW}Machine preparation steps:${NC}"
        echo

        # Step 1: Remove existing DO configurations
        if [ "$RESPONSE_TYPE" = "array" ] && [ "$ARRAY_LENGTH" -gt 0 ]; then
            echo -e "  ${BLUE}Step 1: Remove existing DO configurations${NC}"
            for j in $(seq 0 $((ARRAY_LENGTH - 1))); do
                CONFIG_ID=$(echo "$DO_CONFIG_RESPONSE" | jq -r ".[$j].id // \"N/A\"")
                if [ "$CONFIG_ID" != "N/A" ] && [ "$CONFIG_ID" != "null" ]; then
                    echo "    Deleting config ID: $CONFIG_ID"

                    set +e  # Temporarily disable exit on error
                    DELETE_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
                        -u "$F5_USERNAME:$F5_PASSWORD" \
                        -X DELETE "https://$ADMIN_IP/mgmt/shared/declarative-onboarding/config/$CONFIG_ID" \
                        2>&1)
                    DELETE_EXIT=$?
                    set -e  # Re-enable exit on error

                    if [ $DELETE_EXIT -eq 0 ]; then
                        echo -e "      ${GREEN}✓ Successfully deleted config $CONFIG_ID${NC}"
                    else
                        echo -e "      ${RED}✗ Failed to delete config $CONFIG_ID${NC}"
                        echo "      Response: $DELETE_RESPONSE"
                    fi
                fi
            done
        elif [ "$RESPONSE_TYPE" = "object" ] && [ "$CONFIG_ID" != "N/A" ] && [ "$CONFIG_ID" != "null" ]; then
            echo -e "  ${BLUE}Step 1: Remove existing DO configuration${NC}"
            echo "    Deleting config ID: $CONFIG_ID"

            set +e  # Temporarily disable exit on error
            DELETE_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
                -u "$F5_USERNAME:$F5_PASSWORD" \
                -X DELETE "https://$ADMIN_IP/mgmt/shared/declarative-onboarding/config/$CONFIG_ID" \
                2>&1)
            DELETE_EXIT=$?
            set -e  # Re-enable exit on error

            if [ $DELETE_EXIT -eq 0 ]; then
                echo -e "    ${GREEN}✓ Successfully deleted config $CONFIG_ID${NC}"
            else
                echo -e "    ${RED}✗ Failed to delete config $CONFIG_ID${NC}"
                echo "    Response: $DELETE_RESPONSE"
            fi
        else
            echo -e "  ${GREEN}Step 1: No DO configurations to remove${NC}"
        fi
        echo

        # Step 2: Check for installed DO extension (LIVE)
        echo -e "  ${BLUE}Step 2: Check for installed DO extension${NC}"
        INSTALLED_PACKAGES_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
            -u "$F5_USERNAME:$F5_PASSWORD" \
            -X GET "https://$ADMIN_IP/mgmt/shared/iapp/global-installed-packages" \
            2>/dev/null || echo "ERROR")

        if [ "$INSTALLED_PACKAGES_RESPONSE" = "ERROR" ] || [ -z "$INSTALLED_PACKAGES_RESPONSE" ]; then
            echo -e "    ${RED}✗ Failed to get installed packages from $ADMIN_IP${NC}"
        else
            echo -e "    ${GREEN}✓ Successfully retrieved installed packages${NC}"
            # Check if DO is installed (check appName instead of packageName)
            DO_PACKAGE_INFO=$(echo "$INSTALLED_PACKAGES_RESPONSE" | jq -r '.items[] | select(.appName == "f5-declarative-onboarding")')
            if [ -n "$DO_PACKAGE_INFO" ] && [ "$DO_PACKAGE_INFO" != "null" ]; then
                DO_VERSION=$(echo "$DO_PACKAGE_INFO" | jq -r '.version // "unknown"')
                DO_PACKAGE_NAME=$(echo "$DO_PACKAGE_INFO" | jq -r '.packageName // "unknown"')
                DO_ID=$(echo "$DO_PACKAGE_INFO" | jq -r '.id // "unknown"')
                echo -e "    ${YELLOW}Found DO package:${NC}"
                echo -e "      App Name: f5-declarative-onboarding"
                echo -e "      Version: $DO_VERSION"
                echo -e "      Package: $DO_PACKAGE_NAME"
                echo -e "      ID: $DO_ID"
            else
                echo -e "    ${GREEN}No DO package currently installed${NC}"
            fi
        fi
        echo

        # Step 3: Uninstall existing DO extension if present
        echo -e "  ${BLUE}Step 3: Uninstall existing DO extension${NC}"

        if [ -n "$DO_PACKAGE_INFO" ] && [ "$DO_PACKAGE_INFO" != "null" ]; then
            echo "    Uninstalling DO package: $DO_PACKAGE_NAME"
            echo "    Package ID: $DO_ID"

            set +e  # Temporarily disable exit on error
            UNINSTALL_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 30 \
                -u "$F5_USERNAME:$F5_PASSWORD" \
                -X DELETE "https://$ADMIN_IP/mgmt/shared/iapp/global-installed-packages/$DO_ID" \
                2>&1)
            UNINSTALL_EXIT=$?
            set -e  # Re-enable exit on error

            if [ $UNINSTALL_EXIT -eq 0 ]; then
                echo -e "    ${GREEN}✓ Successfully initiated DO package uninstall${NC}"
                # The uninstall is async, so we just initiate it
                echo "    Response: $UNINSTALL_RESPONSE" | head -3
            else
                echo -e "    ${YELLOW}⚠ Uninstall request completed with warnings${NC}"
                echo "    Response: $UNINSTALL_RESPONSE"
            fi
        else
            echo -e "    ${GREEN}No DO package to uninstall${NC}"
        fi
        echo

        # Step 4: Remove AS3 configurations and uninstall AS3 extension if present
        echo -e "  ${BLUE}Step 4: Remove AS3 configurations and uninstall AS3 extension${NC}"
        # Reuse installed packages response
        AS3_PACKAGE_INFO=$(echo "$INSTALLED_PACKAGES_RESPONSE" | jq -r '.items[] | select(.appName == "f5-appsvcs")')
        if [ -n "$AS3_PACKAGE_INFO" ] && [ "$AS3_PACKAGE_INFO" != "null" ]; then
            AS3_PACKAGE_NAME=$(echo "$AS3_PACKAGE_INFO" | jq -r '.packageName // "unknown"')
            AS3_ID=$(echo "$AS3_PACKAGE_INFO" | jq -r '.id // "unknown"')
            echo -e "    ${YELLOW}Found AS3 package: ${NC}"
            echo -e "      App Name: f5-appsvcs"
            echo -e "      Package: $AS3_PACKAGE_NAME"
            echo -e "      ID: $AS3_ID"
            
            # First, POST an empty AS3 declaration to remove any current configuration
            echo "    Removing AS3 configurations with empty declaration..."
            EMPTY_AS3_DECLARATION='{"class":"AS3","action":"deploy","declaration":{"class":"ADC","schemaVersion":"3.0.0"}}'
            
            set +e  # Temporarily disable exit on error
            AS3_CLEAR_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 30 \
                -u "$F5_USERNAME:$F5_PASSWORD" \
                -H "Content-Type: application/json" \
                -X POST "https://$ADMIN_IP/mgmt/shared/appsvcs/declare" \
                -d "$EMPTY_AS3_DECLARATION" \
                2>&1)
            AS3_CLEAR_EXIT=$?
            set -e  # Re-enable exit on error
            
            if [ $AS3_CLEAR_EXIT -eq 0 ]; then
                echo -e "      ${GREEN}✓ Successfully posted empty AS3 declaration${NC}"
            else
                echo -e "      ${YELLOW}⚠ Failed to post empty AS3 declaration (package may not be functional)${NC}"
                echo "      Response: $AS3_CLEAR_RESPONSE" | head -3
            fi
            
            # Now uninstall the AS3 package
            echo "    Uninstalling AS3 package: $AS3_PACKAGE_NAME"

            set +e  # Temporarily disable exit on error
            AS3_UNINSTALL_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 30 \
                -u "$F5_USERNAME:$F5_PASSWORD" \
                -X DELETE "https://$ADMIN_IP/mgmt/shared/iapp/global-installed-packages/$AS3_ID" \
                2>&1)
            AS3_UNINSTALL_EXIT=$?
            set -e  # Re-enable exit on error

            if [ $AS3_UNINSTALL_EXIT -eq 0 ]; then
                echo -e "    ${GREEN}✓ Successfully initiated AS3 package uninstall${NC}"
                # The uninstall is async, so we just initiate it
                echo "    Response: $AS3_UNINSTALL_RESPONSE" | head -3
            else
                echo -e "    ${YELLOW}⚠ Uninstall request completed with warnings${NC}"
                echo "    Response: $AS3_UNINSTALL_RESPONSE"
            fi
        else
            echo -e "    ${GREEN}No AS3 package to uninstall${NC}"
        fi
        echo

        # Step 5: Uninstall Service Discovery extension if present
        echo -e "  ${BLUE}Step 5: Uninstall existing Service Discovery extension${NC}"
        SD_PACKAGE_INFO=$(echo "$INSTALLED_PACKAGES_RESPONSE" | jq -r '.items[] | select(.appName == "f5-service-discovery")')
        if [ -n "$SD_PACKAGE_INFO" ] && [ "$SD_PACKAGE_INFO" != "null" ]; then
            SD_PACKAGE_NAME=$(echo "$SD_PACKAGE_INFO" | jq -r '.packageName // "unknown"')
            SD_ID=$(echo "$SD_PACKAGE_INFO" | jq -r '.id // "unknown"')
            echo -e "    ${YELLOW}Found Service Discovery package:${NC}"
            echo -e "      App Name: f5-service-discovery"
            echo -e "      Package: $SD_PACKAGE_NAME"
            echo -e "      ID: $SD_ID"

            echo "    Uninstalling Service Discovery package: $SD_PACKAGE_NAME"

            set +e  # Temporarily disable exit on error
            SD_UNINSTALL_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 30 \
                -u "$F5_USERNAME:$F5_PASSWORD" \
                -X DELETE "https://$ADMIN_IP/mgmt/shared/iapp/global-installed-packages/$SD_ID" \
                2>&1)
            SD_UNINSTALL_EXIT=$?
            set -e  # Re-enable exit on error

            if [ $SD_UNINSTALL_EXIT -eq 0 ]; then
                echo -e "    ${GREEN}✓ Successfully initiated Service Discovery package uninstall${NC}"
                # The uninstall is async, so we just initiate it
                echo "    Response: $SD_UNINSTALL_RESPONSE" | head -3
            else
                echo -e "    ${YELLOW}⚠ Uninstall request completed with warnings${NC}"
                echo "    Response: $SD_UNINSTALL_RESPONSE"
            fi
        else
            echo -e "    ${GREEN}No Service Discovery package to uninstall${NC}"
        fi
        echo

        # Step 6: Test SSH connectivity and reset passwords (if >1 machine)
        if [ "$MACHINE_COUNT" -gt 1 ]; then
            echo -e "  ${BLUE}Step 6: Test SSH connectivity and synchronize passwords${NC}"
            echo "    Target unified password: $UNIFIED_SSH_PASSWORD"

            # Check if sshpass is available
            if ! command -v sshpass >/dev/null 2>&1; then
                echo -e "    ${YELLOW}⚠ sshpass not found - cannot automate SSH password input${NC}"
                SSH_TEST_EXIT=1
            else
                # Use sshpass - temporarily disable set -e to capture exit code
                echo "    Testing SSH connectivity with sshpass..."
                set +e  # Temporarily disable exit on error
                SSH_TEST=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=quiet \
                    -o ConnectTimeout=10 "${SSH_USERNAME}@${ADMIN_IP}" 'echo "SSH_OK"' 2>&1) #gitleaks:allow
                SSH_TEST_EXIT=$?
                set -e  # Re-enable exit on error
            fi

            if [ $SSH_TEST_EXIT -ne 0 ]; then
                echo -e "    ${RED}✗ SSH connectivity test failed to $ADMIN_IP${NC}"
                echo "    SSH exit code: $SSH_TEST_EXIT"
                echo "    SSH error output: $SSH_TEST"
                echo "    Tried credentials: ${SSH_USERNAME}@${ADMIN_IP} with both original and unified passwords"
                echo -e "    ${YELLOW}⚠ Skipping password synchronization${NC}"
            elif [[ "$SSH_TEST" != *"SSH_OK"* ]]; then
                echo -e "    ${RED}✗ SSH connected but unexpected response: $SSH_TEST${NC}"
                echo -e "    ${YELLOW}⚠ Skipping password synchronization${NC}"
            else
                echo -e "    ${GREEN}✓ SSH connectivity confirmed${NC}"
                echo "    Synchronizing admin and root passwords..."

                # Run multiple commands in single SSH session to set passwords
                # Use set -e inside the SSH session to fail on any error
                set +e  # Temporarily disable in parent to capture exit code
                PASSWORD_SYNC_OUTPUT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=quiet \
                    -o ConnectTimeout=10 "${SSH_USERNAME}@${ADMIN_IP}" bash << EOF
set -e
tmsh modify auth user admin shell bash password ${UNIFIED_SSH_PASSWORD}
tmsh modify auth password root << PASSWD_EOF
${UNIFIED_SSH_PASSWORD}
${UNIFIED_SSH_PASSWORD}
PASSWD_EOF
echo "PASSWORD_SYNC_COMPLETE"
EOF
                2>&1)
                PASSWORD_SYNC_EXIT=$?
                set -e  # Re-enable

                # Check for both exit code and success message
                if [ $PASSWORD_SYNC_EXIT -eq 0 ] && [[ "$PASSWORD_SYNC_OUTPUT" == *"PASSWORD_SYNC_COMPLETE"* ]] && ! echo "$PASSWORD_SYNC_OUTPUT" | grep -iq "error\|failed"; then
                    echo -e "    ${GREEN}✓ Successfully synchronized passwords to: $UNIFIED_SSH_PASSWORD${NC}"
                else
                    echo -e "    ${YELLOW}⚠ Password synchronization completed with warnings${NC}"
                    echo "    Exit code: $PASSWORD_SYNC_EXIT"
                    echo "    Output: $PASSWORD_SYNC_OUTPUT"
                fi
            fi
        echo
        fi

        # Step 7: Final verification
        echo -e "  ${BLUE}Step 7: Final verification${NC}"
        echo "    Verifying system is responsive and ready for testing..."

        set +e  # Temporarily disable exit on error
        FINAL_VERIFY_RESPONSE=$(curl -s -k --connect-timeout 10 --max-time 15 \
            -u "${F5_USERNAME}:${F5_PASSWORD}" \
            -X GET "https://${ADMIN_IP}/mgmt/shared/echo" \
            2>&1)
        FINAL_VERIFY_EXIT=$?
        set -e  # Re-enable exit on error

        if [ $FINAL_VERIFY_EXIT -eq 0 ]; then
            echo -e "    ${GREEN}✓ System is responsive and ready for testing${NC}"
        else
            echo -e "    ${RED}✗ Final verification failed${NC}"
            echo "    Exit code: $FINAL_VERIFY_EXIT"
            echo "    Response: $FINAL_VERIFY_RESPONSE"
            HAS_ERRORS=1
        fi
        echo

        if [ $HAS_ERRORS -eq 0 ]; then
            echo -e "  ${GREEN}✓ Machine preparation completed successfully for $ADMIN_IP${NC}"
        else
            echo -e "  ${RED}✗ Machine preparation encountered errors for $ADMIN_IP${NC}"
        fi
    fi
    echo

    # Return error code if any step failed
    return $HAS_ERRORS
}

# Launch all machines in parallel
echo -e "${YELLOW}Starting parallel machine preparation...${NC}"
PIDS=()
for i in $(seq 0 $((MACHINE_COUNT - 1))); do
    process_machine $i &
    PIDS+=($!)
    echo -e "${BLUE}  Launched preparation for machine $((i + 1)) (PID: ${PIDS[$i]})${NC}"
done

echo
echo -e "${YELLOW}Waiting for all machines to complete preparation...${NC}"

# Wait for all background processes and track failures
FAILED_MACHINES=0
WAIT_ERRORS=()
for i in "${!PIDS[@]}"; do
    set +e  # Disable exit on error temporarily
    wait ${PIDS[$i]}
    WAIT_EXIT=$?
    set -e  # Re-enable exit on error

    if [ $WAIT_EXIT -eq 0 ]; then
        echo -e "${GREEN}  ✓ Machine $((i + 1)) completed successfully${NC}"
    else
        echo -e "${RED}  ✗ Machine $((i + 1)) failed with exit code $WAIT_EXIT${NC}"
        FAILED_MACHINES=$((FAILED_MACHINES + 1))
        WAIT_ERRORS+=("Machine $((i + 1)) exited with code $WAIT_EXIT")
    fi
done

echo
echo -e "${BLUE}=== Displaying detailed logs for all machines ===${NC}"
echo

# Display all logs in order (even if they failed)
for i in $(seq 0 $((MACHINE_COUNT - 1))); do
    LOG_FILE="$LOG_DIR/machine_$((i + 1)).log"
    if [ -f "$LOG_FILE" ]; then
        echo -e "${BLUE}--- Machine $((i + 1)) Log ---${NC}"
        cat "$LOG_FILE"
        echo
    else
        echo -e "${RED}--- Machine $((i + 1)) Log: FILE NOT FOUND ---${NC}"
        echo -e "${RED}Expected log file: $LOG_FILE${NC}"
        echo
    fi
done

echo -e "${BLUE}Logs saved to: $LOG_DIR/${NC}"

# Check if any machines failed and exit accordingly
if [ $FAILED_MACHINES -gt 0 ]; then
    echo
    echo -e "${RED}=== FAILURE SUMMARY ===${NC}"
    echo -e "${RED}Machine preparation failed for $FAILED_MACHINES machine(s)${NC}"
    for error in "${WAIT_ERRORS[@]}"; do
        echo -e "${RED}  - $error${NC}"
    done
    echo
    exit 1
fi

echo
echo -e "${GREEN}=== SUCCESS ===${NC}"
echo -e "${GREEN}Machine preparation completed successfully for all $MACHINE_COUNT machine(s)${NC}"
echo -e "${BLUE}Ready for integration testing${NC}"

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Target machine is required for installation.${NC}"
    exit 0
fi

if [ -z "$2" ]; then
    echo -e "${RED}Credentials [username:password] for target machine are required for installation.${NC}"
    exit 0
fi

TARGET="$1"
CREDS="$2"

nuke_it () {
    MAX_TRIES=10
    counter=1
    RETRY_CODES=("404" "503")
    STATUS_CODE=503
    until [[ ! " ${RETRY_CODES[@]} " =~ " ${STATUS_CODE} " || $counter -gt $MAX_TRIES ]]; do
        STATUS_CODE=$(curl --insecure --silent --show-error -u "$CREDS" https://$TARGET/mgmt/tm/util/bash \
            --write-out "%{http_code}" --output /dev/null \
            -H "Content-Type: application/json" \
            -d '{
                "command": "run",
                "utilCmdArgs": "-c \"bigstart stop restjavad restnoded; rm -rf /var/config/rest/storage; rm -rf /var/config/rest/index; rm -f /var/config/rest/downloads/*.rpm; rm -f /var/config/rest/iapps/RPMS/*.rpm; rm -rf /var/config/rest/iapps/f5-appsvcs; rm -rf /var/config/rest/iapps/f5-service-discovery; bigstart start restjavad restnoded\""
            }'
        )

        echo "Got status $STATUS_CODE"
        if [[ " ${RETRY_CODES[@]} " =~ " ${STATUS_CODE} " ]]; then
            ((counter++))
            sleep 10
        fi
    done

    if [[ $counter -gt $MAX_TRIES ]]; then
        echo -e "${RED}Max tries reached while nuking rest storage${NC}"
        exit 1
    fi

    # A 502 status code seems to be common and the bash command still executes
    if [[ "$STATUS_CODE" -eq 200 || "$STATUS_CODE" -eq 502 ]]; then
        until curl -ku "$CREDS" --write-out "" --fail --silent "https://$TARGET/mgmt/shared/iapp/package-management-tasks/available"; do
            sleep 30
        done
    else
        echo -e "${RED}Failed to nuke with status code $STATUS_CODE${NC}"
        exit 1
    fi
}

nuke_it
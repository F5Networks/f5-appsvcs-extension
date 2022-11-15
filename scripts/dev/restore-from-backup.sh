# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Target machine is required.${NC}"
    exit 0
fi

if [ -z "$2" ]; then
    echo -e "${RED}Credentials [username:password] for target machine are required.${NC}"
    exit 0
fi

TARGET="$1"
CREDS="$2"

# Load UCS from VIO Onboarding
# Create ucs load task
echo "Creating load ucs task"
TASK_ID=$(curl --silent --insecure -u "$CREDS" https://$TARGET/mgmt/tm/task/sys/ucs \
    -H "Content-Type: application/json" \
    -d '{
        "command": "load",
        "options": [
            {
                "no-license": true
            }
        ],
        "name": "/var/local/ucs/backup.ucs"
    }' | jq -r ._taskId)

# Validate task to initiate loading UCS
echo "Initiating load ucs task"
curl --silent --insecure -u "$CREDS" https://$TARGET/mgmt/tm/task/sys/ucs/$TASK_ID \
    --output /dev/null \
    -H "Content-Type: application/json" \
    -X "PUT" \
    -d '{"_taskState":"VALIDATING"}'

sleep 60

# Confirm UCS load (taskId no longer exists)
# There should be no previous AS3 declarations in data-groups
until [ "$(curl --silent --insecure -u "$CREDS" https://$TARGET/mgmt/tm/ltm/data-group/internal | jq -r '[.items | .[] | select(.name | contains("appsvcs"))] | length' 2>/dev/null)" -eq 0 2>/dev/null ]; do
    sleep 30
done

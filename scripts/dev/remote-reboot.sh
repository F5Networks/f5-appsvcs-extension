# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}Target machine address is required to reboot it.${NC}"
    exit 0
fi

if [ -z "$2" ]; then
    echo -e "${RED}Credentials [username:password] for target machine are required to reboot the machine.${NC}"
    exit 0
fi

TARGET="$1"
CREDS="$2"

curl --insecure -u "$CREDS" https://$TARGET/mgmt/tm/util/bash -H "Content-Type: application/json" \
    -d '{ "command": "run", "utilCmdArgs": "-c reboot" }'

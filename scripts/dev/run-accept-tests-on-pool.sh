#!/bin/bash

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

RELATIVE_PATH="`dirname \"$0\"`"

if [ "$1" == 'all' ]; then
   TEST=""
else
   TEST="$1"
fi

if [[ "$2" ]]; then
  VERSION="$2"
fi

CONSOLE_LOG=${3:-'error'}
FILE_LOG=${4:-'verbose'}

npm install --quiet --no-progress > /dev/null

TARGET=$($RELATIVE_PATH/get-reservation.sh $VERSION)
echo "Running on server: $TARGET with Version: $($RELATIVE_PATH/get-pool-status.sh $TARGET)"

if [ $TARGET == '0.0.0.0' ]; then
  echo -e "${RED}Requested VE resource not available${NC}"
  exit 0
fi

CREDS="admin:admin"

./scripts/dev/install-rpm.sh $TARGET $CREDS
sleep 15

USER=$(echo "$CREDS" | cut -d':' -f1)
PASS=$(echo "$CREDS" | cut -d':' -f2)

AS3_USERNAME=$USER AS3_PASSWORD=$PASS AS3_HOST=$TARGET CONSOLE_VERBOSITY=$CONSOLE_LOG FILE_VERBOSITY=$FILE_LOG npx mocha -- --grep "$TEST" test/integration/bigip

($RELATIVE_PATH/release-reservation.sh $TARGET)

echo "Ran test on " $TARGET $($RELATIVE_PATH/get-pool-status.sh $TARGET)
echo "Ran " $TEST_LIST

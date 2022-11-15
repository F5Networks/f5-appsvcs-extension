#!/usr/bin/env bash

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

set -x

if [ -z "$DOC_IMG" ]; then
    echo -e "${RED}DOC_IMG environmental variable is required. Set it and run again.${NC}"
    exit 1
fi

exec docker run --rm -it \
  -v $PWD:$PWD --workdir $PWD \
  ${DOCKER_RUN_ARGS} \
  $DOC_IMG "$@"

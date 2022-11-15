#!/usr/bin/env bash

set -x

: ${DOC_IMG:=noderpm}

docker build -t noderpm - < "scripts/build/Dockerfile"

exec docker run --rm -it \
  -v $PWD:$PWD --workdir $PWD \
  -e HOME=/tmp \
  -e ARTIFACTORY_URL \
  ${DOCKER_RUN_ARGS} \
  -u $(id -u) \
  ${DOC_IMG} "scripts/build/buildRpm.sh" $1

#!/usr/bin/env bash

set -e
set -x

echo "Building docs with Sphinx"
make clean
make html

echo "Checking grammar and style"
write-good `find ./docs -not \( -path ./docs/drafts -prune \) -name '*.rst'` --passive --so --no-illusion --thereIs --cliches 

echo "Checking links"
make linkcheck

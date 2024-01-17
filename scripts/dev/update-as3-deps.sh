# Update deps to latest using npm-check-updates
# exlude version-pinned deps
# ---------------------------------------------
# Go to the link in '${CONFLUENCE_URL}/display/PDESETEAM/Package+Dependencies+-+Pinned' to see a list

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$CI_COMMIT_REF_NAME" ]; then
    echo -e "${RED}CI_COMMIT_REF_NAME is required.${NC}"
    exit 1
fi

if [ -z "$AS3_ACCESS_TOKEN" ]; then
    echo -e "${RED}AS3_ACCESS_TOKEN is required.${NC}"
    exit 1
fi

if [ -z "$CI_SERVER_HOST" ]; then
    echo -e "${RED}CI_SERVER_HOST is required.${NC}"
    exit 1
fi

if [ -z "$CI_PROJECT_PATH" ]; then
    echo -e "${RED}CI_PROJECT_PATH is required.${NC}"
    exit 1
fi

if [ -z "$UPDATE_BRANCH_NAME" ]; then
    echo -e "${RED}UPDATE_BRANCH_NAME is required.${NC}"
    exit 1
fi

npx npm-check-updates -u -x ajv,semver,nock,sinon,error,eslint,uuid
npm i
npm upgrade


git config --global user.email "DO_NOT_REPLY@f5.com"
git config --global user.name "F5 AS3 Pipeline"

git checkout $CI_COMMIT_REF_NAME
git remote set-url origin https://$AS3_ACCESS_TOKEN@$CI_SERVER_HOST/$CI_PROJECT_PATH.git

if [ -z "$(git status --porcelain)" ]; then
  echo "No AS3 dependency updates detected..."
else
    export AUTOTOOL_DIFF=true
    echo "AS3 dependency updates detected!"

    git checkout $UPDATE_BRANCH_NAME 2>/dev/null || git checkout -b $UPDATE_BRANCH_NAME;

    ./scripts/dev/filter-package-lock.sh

    git add .
    git status
    git commit -m "Auto-update to AS3 deps"
fi

git checkout $CI_COMMIT_REF_NAME

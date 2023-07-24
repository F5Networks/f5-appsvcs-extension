# Update deps to latest using npm-check-updates
# exlude version-pinned deps
# ---------------------------------------------
# Go to the link in '${CONFLUENCE_URL}/display/PDESETEAM/Package+Dependencies+-+Pinned' to see a list
npx npm-check-updates -u -x ajv,semver,nock,sinon,error,eslint,uuid
npm i
npm upgrade


git config --global user.email "DO_NOT_REPLY@f5.com"
git config --global user.name "F5 AS3 Pipeline"

git checkout $CI_BRANCH_NAME
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

git checkout $CI_BRANCH_NAME

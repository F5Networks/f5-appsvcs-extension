# AS3 Release Process

## Release Artifacts
* Each AS3 release has several artifacts:
  * RPM
  * RPM sha256 checksum
  * Source archive
  * Schema
  * Postman collection of examples
* RPM is built in every pipeline run, and is kept in GitLab for one week
* On a Git tag, all artifacts are built and published to Artifactory (f5-automation-toolchain-generic/f5-appsvcs)
* On a release, artifacts are copied from Artifactory to GitHub

## Release Notes
* Release notes, along with some examples, are tracked during development in the contributing directory as markdown
* When doing internal pre-releases, these markdown files are used when creating the release email
  * Web pages copy well into Outlook, so it is useful to convert the markdown to HTML using something like pandoc

## Process for release
### Begin process release at the very beginning of the first sprint of a new release, by performing the following actions
* Create a new release branch using the major version, minor version and patch number as the name (e.g 3.10.0)
  * Using the GitLab UI, create the branch from `develop` to avoid any issues with an out-of-date local repository
* Point the `gitBranch` variable in the AS3 schedule in the atg-build repository at the release branch
* Run the AS3 schedule from the atg-build repository in GitLab. This will:
  * Update and commit build number changes to `package.json` and `package-lock.json`
  * Tag the appropriate branch with the updated `<version>-<build>` (e.g. v3.10.0-4)
  * Upload the build to Artifactory
  * Send an email to the team with build details
* Point the `gitBranch` variable in the AS3 schedule in the atg-build repository back to `develop`
* Download and copy the built schema file to the correct locations
  * From Artifactory f5-automation-toolchain-generic/f5-appsvcs/`<version>-<build>`, download as3-schema-`<version>-<build>`.json
  * git fetch
  * git switch `<release_branch>`
  * mkdir -p schema/`<version>`
  * rm schema/latest/*
  * cp as3-schema-`<version>-<build>`.json schema/latest/
  * cp as3-schema-`<version>-<build>`.json schema/latest/as3-schema.json
  * cp per-app-schema-`<version>-<build>`.json schema/latest/per-app-schema.json
  * cp as3-schema-`<version>-<build>`.json schema/`<version>`/
  * cp as3-schema-`<version>-<build>`.json schema/`<version>`/as3-schema.json
  * cp per-app-schema-`<version>-<build>`.json schema/`<version>`/per-app-schema.json
  * git add schema/latest schema/`<version>`
  * git commit -m 'Update schema files for release'
  * git push
* Prepare the develop branch for the next development cycle
  * Create a new branch off of `develop` like any other development task
  * Update version changes to `package.json` and `package-lock.json`.  The release number of the new version should start at 0 (e.g. 3.10.0-4 would become 3.11.0-0).
  * Update the `info.version` property in `docs/openapi.yaml` to the new AS3 version (e.g. 3.27.0).
  * Update the `schemaVersion.anyOf[1].const` property in `src/schema/latest/core-schema.json` and `src/schema/latest/app-schema.json` using the preexisting format. The `pattern` property should also be updated to allow the new version (e.g. if going from 3.49.0 to 3.50.0, we'll add `|5[0]`).
  * Add a new block to `CHANGELOG.md` with the following content
    ```
    ## <new_version>

    ### Added

    ### Fixed

    ### Changed

    ### Removed

    ```
  * Create a merge request like for any other development task and announce on Teams `AS3-DO General`.

### Perform actions after confirming GO for release
* Clone release branch to `<releaseBranch>-main`
  * eg: 
        * git checkout -b v3.53.0-main original/v3.53.0
        * git push original v3.53.0-main -f
* Clone release branch to `<releaseBranch>-docs`
  * eg: 
        * git checkout -b v3.53.0-docs original/v3.53.0
        * git push original v3.53.0-docs -f
Double check the `CHANGELOG.md` to ensure we do not include internal links or customer names.
Merge the release branch into `develop` and `main` following the steps below for each merge.
* Navigate to the `Merge Requests` page and click on `New merge request` in the upper right corner.
* Select the release branch as the `source branch`.
  * If merging into `develop` select `develop` as the `target branch`.
  * If merging into `main` select `main` as the `target branch`.
* Click on `Compare branches and continue`.
* On the next page:
  * The release branch needs to be preserved in case a `.1` release is needed in the future. Make sure `Delete source branch` is NOT selected.
  * If merging into `develop` do NOT select `Squash commits`.
  * If merging into `main` select `Squash commits`.
* Click on `Submit merge request`.
* Note: If the GUI suggests a rebase, do a merge locally instead. DO NOT TRUST the GUI rebase tool.
  * Make sure that the version numbers in `package.json`, `package-lock.json`, `CHANGELOG.md`, etc... is correct. Rebase can sometimes rebase `develop` into the release branch.
  * Even though the MR was created via the GUI, pushing a local should be reflected in the MR
* Self approve the merge request and merge. It is not uncommon when attempting to merge into `develop` for there to be no changes in the merge request. If this happens close the merge request (optionally commenting that there were no changes to merge) and move on to the merge into `main` merge request.

* Tag `main` with the release version, for example: `v3.27.0` (Note: if you are tagging/re-tagging older releases that may trigger the publish, make sure to cancel the job as it will try to reupload the artifacts).
  * Navigate to the `Repository -> Tags` page.
  * Click on `New Tag`.
  * Name the version tag with the release version but without the build number.  For example `v3.27.0`.
  * Choose the `main` branch from the `Create from` list.
  * Click on `Create Tag`.

* Follow the process for release for f5-service-discovery to prep SD for the next release cycle.

### Release Manager tasks
* Artifacts are copied from `main` to GitHub and Docker Hub by release management
* Add a `released` property with a value of `true` to the released RPM in Artifactory

## Process for LTS release
* Using the GitLab GUI, create a branch from the release branch that we are declaring LTS. Bump the patch version by 1. For example, if we are declaring 3.36.0 to be LTS, then create a 3.36.1 branch from 3.36.0.
* On your local machine, fetch and checkout the LTS branch.
* Create a new local branch from the LTS branch.
* Update the patch version in `package.json` and `package-lock.json`.  The release number of the new version should start at 0 (e.g. 3.36.0-4 would become 3.36.1-0).
* Add a new CHANGELOG section that looks like
    ```
    ## 3.36.1

    ### Added

    ### Fixed

    ### Changed
    - Promoted to LTS

    ### Removed

    ```
* Create an MR for these changes. Important: Remember to set the branch you are merging into to the LTS branch.
* Go to the atg-build project in GitLab
  * Edit the AS3 schedule to set the `gitBranch` variable to the LTS branch.
  * Run the AS3 schedule.
  * After the build completes, edit the AS3 schedule to set the `gitBranch` variable back to `develop`.
* Using the GUI create a tag off the LTS branch (e.g. 3.36.1)
  * In the GUI go to `Repository -> Tags -> New tag`.
  * The name of the tag should be the LTS version with a 'v' at the front (e.g. v3.36.1).
  * Update the `createFrom` to point at the LTS branch.
  * Set the message to: `LTS release v<LTS version>` (e.g. "LTS release v3.36.1")
* Merge the LTS branch (without updating the package version) into `develop` and create an MR for this.
* Merge the LTS branch (only update package version if LTS is latest) into `main` and create an MR for this.

## Documentation Release process
* After the third sprint is finished and the release branch has been created, checkout out the dev release branch and then merge it into **doc-release-branch**.
* Make any additions or modifications to the **doc-release-branch** for items specific to the release.
  * Update the release version in the **conf.py** file.
  * Update the latest version in the **versions.json** files (in doc-release branch and any LTS doc branches (for example **docs-3.36.1**, and **doc-3.32.1**)). Do NOT push the versions.json file for the LTS branches until the release has gone out.
  * Update the support.md file.
  * Make sure the **revision-history.rst** file is up-to-date with all work done and the Issues resolved from the changelog.md file.
* On release day, wait for the announcement that the code has been pushed to Github.
* Checkout out **docs-latest**, and then merge the **doc-release-branch** into docs-latest.
* Push **docs-latest** which starts the publishing process to clouddocs.f5.com.
* Checkout each of the LTS doc branches and push the changes to the **versions.json** files.
* Merge **docs-latest** back into **develop**.

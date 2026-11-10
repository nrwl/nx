---
title: Set the Affected Base Commit in CI
description: How GitHub Actions, CircleCI, GitLab, Azure Pipelines, Jenkins, and Bitbucket Pipelines pass the base and head commits to nx affected.
filter: 'type:Guides'
topics:
  - 'Continuous integration'
---

[`nx affected`](/docs/features/ci-features/affected) compares two commits, `NX_BASE` and `NX_HEAD`, to work out which projects changed.
On a pull request, the base is where the branch left the main branch.
On a push to the main branch, the most useful base is the last commit that passed CI, so every change since then gets checked.
Each CI provider exposes that commit differently.

For complete workflows per provider, see [CI workflow examples](/docs/kb/ci-workflow-examples).

{% tabs syncKey="ci-provider" %}
{% tabitem label="GitHub" %}

The [nrwl/nx-set-shas](https://github.com/marketplace/actions/nx-set-shas) action finds the last successful run on the main branch and sets `NX_BASE` and `NX_HEAD`.
Add it after installing dependencies:

```yaml
// .github/workflows/ci.yml
- uses: nrwl/nx-set-shas@v5
- run: npx nx affected -t lint test build
```

For why the last successful commit matters, see the [action documentation](https://github.com/marketplace/actions/nx-set-shas#background).

{% /tabitem %}
{% tabitem label="CircleCI" %}

The [Nx orb](https://github.com/nrwl/nx-orb) provides `nx/set-shas`.
On pushes, it sets `NX_BASE` to the commit of the last successful run on the main branch.

```yaml
// .circleci/config.yml
orbs:
  nx: nrwl/nx@1.7.0
# ...
- nx/set-shas:
    main-branch-name: 'main'
```

If your repository is private, create an environment variable called `CIRCLE_API_TOKEN` in the project context so the orb can read the CircleCI API.

{% aside type="caution" title="Use a user token" %}
`CIRCLE_API_TOKEN` must be a user token, not a project token.
{% /aside %}

{% /tabitem %}
{% tabitem label="GitLab" %}

GitLab CI/CD has built-in variables for both commits:

```yaml
// .gitlab-ci.yml
- NX_HEAD=$CI_COMMIT_SHA
- NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}
```

On a merge request, `CI_MERGE_REQUEST_DIFF_BASE_SHA` is the merge base.
On a push, `CI_COMMIT_BEFORE_SHA` is the previous commit on the branch.

{% /tabitem %}
{% tabitem label="Azure" %}

Query the [Azure DevOps CLI](https://learn.microsoft.com/en-us/cli/azure/pipelines?view=azure-cli-latest) for the last successful build on the branch, then store it in a `BASE_SHA` variable:

```yaml
// azure-pipelines.yml
- bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
  displayName: 'Set default Azure DevOps organization and project'
- bash: |
    LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
    if [ -z "$LAST_SHA" ]
    then
      echo "Last successful commit not found. Using fallback 'HEAD~1': $BASE_SHA"
    else
      echo "Last successful commit SHA: $LAST_SHA"
      echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
    fi
  displayName: 'Get last successful commit SHA'
  condition: ne(variables['Build.Reason'], 'PullRequest')
  env:
    AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)
```

The query filters by branch (`--branch`), result (`--result succeeded`), and count (`--top 1`), and `--query` extracts the commit with [JMESPath](https://jmespath.org/).
The [custom variable](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/set-variables-scripts?view=azure-devops&tabs=bash) `BASE_SHA` is then passed as `nx affected --base=$(BASE_SHA)`.
Pull requests use `git merge-base` against the target branch instead.

{% /tabitem %}
{% tabitem label="Jenkins" %}

Jenkins has no built-in record of the last successful run on the main branch.
Set the base to `HEAD~1` on pushes and to `origin/${env.CHANGE_TARGET}` on pull requests.
For a more precise base, tag the commit once the main job succeeds and use that tag, as [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) does.

Also set `NX_BRANCH` explicitly:

```groovy
environment {
    NX_BRANCH = env.BRANCH_NAME.replace('PR-', '')
}
```

{% /tabitem %}
{% tabitem label="Bitbucket" %}

Bitbucket Pipelines has no built-in record of the last successful run on the main branch.
Set the base to `HEAD~1` on pushes and to `origin/main` on pull requests.
For a more precise base, tag the commit once the main job succeeds and use that tag, as [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) does.

Also set `NX_BRANCH` explicitly, from `$BITBUCKET_PR_ID` on pull requests and `$BITBUCKET_BRANCH` on branches.

{% /tabitem %}
{% /tabs %}

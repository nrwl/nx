# Nx CLI and CI Access Tokens

{% youtube src="<https://youtu.be/vBokLJ_F8qs>" title="Configure CI access tokens" /%}

The permissions and membership define what developers can access on [nx.app](https://cloud.nx.app?utm_source=nx.dev&utm_medium=docs&utm_campaign=nx-cloud-security), but they don't affect what happens when you run Nx commands in CI. To manage that, you need to provision CI access tokens in your workspace settings, under the `Access Control` tab.
Learn more about [cache security best practices](/ci/concepts/cache-security).

![Access Control Settings Page](/nx-cloud/recipes/access-control-settings.avif)

## Access Types

{% callout type="warning" title="Use Caution With Read-Write Tokens" %}
The `read-write` tokens allow full write access to your remote cache. They should only be used in trusted environments.
{% /callout %}

There are currently two (2) types of CI Access Token for Nx Cloud's runner that you can use with your workspace. Both support distributed task execution and allow Nx Cloud to store metadata about runs.

- `read-only`
- `read-write`

### Read Only Access

The `read-only` access tokens can only read from the global remote cache. Task results produced with this type of access token will be stored in an isolated remote cache accessible _only_ by that specific branch in a CI context, and cannot influence the global shared cache.  
The isolated remote cache produced with a `read-only` token is accessible to all machines or agents in the same CI execution, enabling cache sharing during distributed task execution.

### Read & Write Access

The `read-write` access tokens allow task results to be stored in the remote cache for other machines or CI pipelines to download and replay. This access level should only be used for trusted environments such as protected branches within your CI Pipeline.

## Setting CI Access Tokens

You can configure an access token in CI by setting the `NX_CLOUD_ACCESS_TOKEN` environment variable.

The `NX_CLOUD_ACCESS_TOKEN` takes precedence over any authentication method in your `nx.json`.

We recommend setting up a `read-write` token for you protected branches in CI and a `read-only` token for unprotected branches. You can leverage your CI provider's environment variables management to accomplish this.

### Azure DevOps

Azure DevOps provides various [mechanisms to limit access to secrets](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/secrets?view=azure-devops#limit-access-to-secret-variables). We'll be using _Variable groups_ in this process, but you can achieve the same result leveraging [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview).

1. In your project, navigate to Pipelines > Library.
   ![Variable group settings page](/nx-cloud/recipes/ado-library-start.avif)
2. Create a new _Variable group_ called _protected_.
   - If you already have a variable group for protected environments, we recommend reusing that variable group.
3. Add the `NX_CLOUD_ACCESS_TOKEN` environment variable with the `read-write` token from Nx Cloud.
   ![create protected variable group](/nx-cloud/recipes/ado-protected-var-group.avif)
4. In _Pipeline permissions_, add your current pipeline configuration.
   ![variable group pipeline permission settings](/nx-cloud/recipes/ado-pipeline-permission.avif)
5. In _Approvals and checks_, add a new _Branch control_ check.
   ![variable group branch control settings](/nx-cloud/recipes/ado-add-branch-control.avif)
6. Create the _Branch control_ check with only allowing your protected branches and checking _Verify branch protection_ option.
   ![variable group branch control settings](/nx-cloud/recipes/ado-protected-branch.avif)
7. Create another variable group called _unprotected_.
8. Add the `NX_CLOUD_ACCESS_TOKEN` environment variable with the `read-only` token from Nx Cloud.
9. In _Pipeline permissions_, add your current pipeline configuration.
10. In _Approvals and checks_, add a new _Branch control_ check with the `*` wildcard for branches and leaving _Verify branch protection_ unchecked.
    ![unprotected variable group settings](/nx-cloud/recipes/ado-unprotected-branch.avif)
11. Now you should see 2 _Variable groups_ for _protected_ and _unprotected_ usage.
    ![completed variable group setup](/nx-cloud/recipes/ado-library-end.avif)
12. Update your pipeline to include the 2 variable groups, with conditional access for the _protected_ variable group.

Example usage:

```yaml {% fileName="azure-pipelines.yml" highlightLines=["2-4"] %}
variables:
  - group: unprotected
  - ${{ if eq(variables['Build.SourceBranchName'], 'main') }}:
      - group: protected
```

{% callout type="check" title="Can't someone change the variable group?" %}
Since we use the _Verify branch protection_ option, CI can only read the variable when running in a protected branch. If a developer tries to edit the pipeline to use the _protected_ variable group, the pipeline will error out since permissions require running in on a protected branch.

Take caution though, if you allow team members to have direct write access to a protected branch, then they could modify the pipeline to write to the nx cache without having a code review first.
{%/callout %}

### BitBucket Cloud

BitBucket Cloud supports setting environment variables per environment called _Deployment variables_. You can read the [official BitBucket Pipelines documentation](https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/#Deployment-variables) for more details.

1. In your repository, navigate to the _Repository settings_ > _Deployment_.
2. Select an environment you have configured for protected branches, or create a new one and protect your primary branches.
   - Note: selecting branch protection rules is a premium feature of BitBucket Cloud.
     ![Use deployments variables to provide protected environment variable access](/nx-cloud/recipes/bitbucket-deployment-env.avif)
3. Set the environment variable `NX_CLOUD_ACCESS_TOKEN` with the `read-write` token from Nx Cloud.
4. Navigate to the _Repository settings_ > _Repository variables_ tab and set the variable `NX_CLOUD_ACCESS_TOKEN` with the `read-only` token from Nx Cloud.
   ![add read-only nx cloud access token to bitbucket](/nx-cloud/recipes/bitbucket-repo-vars.avif)
5. Update the `bitbucket-pipelines.yml` file to include the deployment name mentioned in step 2.

Example usage:

```yaml {% fileName="bitbucket-pipelines.yml" highlightLines=[6] %}
pipelines:
  branches:
    main:
      - step:
          name: 'main checks'
          deployment: Production
          ...
```

### CircleCI

Circle CI allows creating _contexts_ and restricting those based on various rules. You can read the [official CircleCI documentation](https://circleci.com/docs/contexts/#restrict-a-context) for more details.

1. In your organization, navigate to _Organization settings_ > _Contexts_ and create a new context.
   - If you already have a context for protected environments, we recommend reusing that context.
     ![create a new context for protected environments](/nx-cloud/recipes/circle-new-context.avif)
2. Click on _Add Expression Restriction_ that restricts the context to protected branches only such as only the `main` branch, e.g., `pipeline.git.branch == "main"`.
   ![restrict context to protected branches](/nx-cloud/recipes/circle-expression-restriction.avif)
3. Click on _Add Environment Variable_ and add the `NX_CLOUD_ACCESS_TOKEN` environment variable with the `read-write` token from Nx Cloud.
4. Back on the organization home page, navigate to your projects, then view the pipeline settings.
5. Navigate to _Environment Variables_ and click _Add Environment Variable_ and add the `NX_CLOUD_ACCESS_TOKEN` environment variable with the `read-only` token from Nx Cloud.
   ![add read-only nx cloud access token to circleci](/nx-cloud/recipes/circle-new-env-var-token.avif)
6. Update your pipeline to include steps where you want to write to the nx cache with the correct contexts.

Example usage:

```yaml {% fileName=".circleci/config.yml" highlightLines=["10-19"] %}
jobs:
  run-tests-protected:
    - ...
  run-tests-prs:
    - ...

workflows:
  my-workflow:
    jobs:
      - run-tests-protected:
          context:
            - protected-branches
          filters:
            branches:
              only: main
      - run-tests-prs:
          filters:
            branches:
              ignore: main
```

### GitHub Actions

GitHub allows specifying different secrets for each environment, where an environment can be on a specific branch.
You can read the [official GitHub Actions documentation](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-an-environment) for more details.

1. In your repository, navigate to Settings tab.
2. Click on "Environments" and create an environment for your protected branches.
   - Typically, organizations already have some kind of 'release' or 'protected' environments that can be leveraged.
   - If you do not have any protected branches, it's recommended to make at least your _default_ branch a protected branch i.e., `main`/`master`.
3. Add a restriction for how the environment will be applied, and apply to all protected branches.
   ![Select protected branches for the environment restriction configuration](/nx-cloud/recipes/github-select-protected-branches.avif)
4. Add the `read-write` access token with the name `NX_CLOUD_ACCESS_TOKEN` to your environment.
5. Click the _Secrets and variables_ > _Actions_ tab in the sidebar.
6. Add the `read-only` access token with the name `NX_CLOUD_ACCESS_TOKEN` to the repository secrets.
7. Now you should see 2 secrets where 1 is a part of the protected environment and the other is the default repository secrets.
   ![overview of GitHub Action secret configuration settings with environments set](/nx-cloud/recipes/github-secrets-settings.avif)

Example usage:

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=["3-4"] %}
name: CI

env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

jobs:
  main:
    runs-on: ubuntu-latest
    steps: ...
```

### GitLab

GitLab allows creating variables scoped to specific environments. You can read the [Official GitLab documentation](https://docs.gitlab.com/ci/environments/#limit-the-environment-scope-of-a-cicd-variable) for more details.

1. In your project, navigate to _Operate_ > _Environments_ and create a new environment. You do not need to fill out the External Url or GitLab agent.
   - Most projects already have a production/protected environments, so we recommend using this one if it's already defined.
     ![define gitlab environment for protected branches](/nx-cloud/recipes/gitlab-new-environment.avif)
2. In your project, navigate to _Settings_ > _CI/CD_ tab and expand the _Variables_ section.
3. Click on _Add variable_ and fill in the following information:
   - Type: _Variable_
   - Environments: _All_
   - Visibility: _Masked and hidden_
   - Flags: uncheck _Protected variable_
   - Description: "read-only token for nx-cloud"
   - Key: `NX_CLOUD_ACCESS_TOKEN`
   - Value: Your `read-only` token from Nx Cloud
4. Click _Add variable_.
   ![add read-only nx cloud access token to gitlab](/nx-cloud/recipes/gitlab-variable-settings-readonly.avif)
5. Click on _Add variable_ again and fill in the following information:
   - Type: _Variable_
   - Environments: Your protected environment created in step 1
   - Visibility: _Masked and hidden_
   - Flags: check _Protected variable_
   - Description: "read-write token for nx-cloud"
   - Key: `NX_CLOUD_ACCESS_TOKEN`
   - Value: Your `read-write` token from Nx Cloud
6. Click _Add variable_.
   ![add read-write nx cloud access token to gitlab](/nx-cloud/recipes/gitlab-variable-settings-readwrite.avif)
7. Now you should see 2 secrets where 1 is a part of the protected & tagged to the environment and the other is not.
   ![GitLab project variable configuration screen](/nx-cloud/recipes/gitlab-variable-setting.avif)
8. Update your pipeline to include steps where you want to write to the nx cache with the correct contexts.

Example usage:

```yaml {% fileName=".gitlab-ci.yml" highlightLines=["2-3"] %}
<job-name>:
  environment:
    name: <environment-name>
```

{% callout type="check" title="Can't someone change the step environment?" %}
Since we use the _Protected variable_ flag, CI can only read the variable when running in a protected branch. If a developer tries to edit the steps to run a PR in the environment with the `read-write` token will, then the token will not be populated in CI since their branch is not marked as protected.

Take caution though, if you allow team members to have direct write access to a protected branch, then they could modify the steps to write to the nx cache without having a code review first.
{%/callout %}

### Jenkins

Jenkins configuration can be quite extensive making each Jenkins instance unique. Because of this we can only provide a minimal viable approach, but there can be multiple ways to provide scoped access tokens to your pipelines. The goal is to create two areas within Jenkins, where one is the _protected_ and the other is the _unprotected_. These specifically map to how you deem your branches should have read/write vs read permissions. We recommend making branches that developers cannot directly push to and require a code review to merge to, as the _protected_ branches, and the rest being _unprotected_.

1. Minimally, this can be achieved via the following Jenkins plugins:
   - [Folders](https://plugins.jenkins.io/cloudbees-folder/), [Credentials](https://plugins.jenkins.io/credentials/), [Credentials Binding](https://plugins.jenkins.io/credentials-binding/)
2. Create a folder for the _unprotected_ and _protected_ pipelines.
   - The names can be anything that makes sense for your organization, such as _releases_ or _PRs_ etc.
3. Go into the _unprotected_ folder and create a credential for `NX_CLOUD_ACCESS_TOKEN` with the `read-only` token from Nx Cloud.
4. Go into the _protected_ folder and create a credential for `NX_CLOUD_ACCESS_TOKEN` with the `read-write` token from Nx Cloud.
5. Use the credential inside your pipeline `Jenkinsfile` with the Credential Binding plugin.

Example usage:

```groovy {% fileName="Jenkinsfile" highlightLines=["6-7"] %}
pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        withCredentials([string(credentialsId: 'NX_CLOUD_ACCESS_TOKEN', variable: 'NX_CLOUD_ACCESS_TOKEN')]) {
          sh 'echo "nx cloud access token is now set in this context"'
        }
      }
    }
  }
}
```

### Legacy methods of setting CI Access Tokens

#### Using CI Access Tokens in nx.json

We **do not recommend** that you commit an access token to your repository but older versions of Nx do support this and if you open your `nx.json`, you may see something like this:

{% tabs %}
{% tab label="Nx >= 17" %}

```json
{
  "nxCloudAccessToken": "SOMETOKEN"
}
```

{% /tab %}
{% tab label="Nx < 17" %}

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "accessToken": "SOMETOKEN"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

{% callout type="warning" title="Nx Cloud authentication is changing" %}
From Nx 19.7 new workspaces are connected to Nx Cloud with a property called `nxCloudId` instead, and we recommend developers use [`nx login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login) to provision their own local [personal access tokens](/ci/recipes/security/personal-access-tokens) for user based authentication.
{% /callout %}

#### Using `nx-cloud.env`

You can set an environment variable locally via the `nx-cloud.env` file. Nx Cloud CLI will look in this file to load custom configuration like `NX_CLOUD_ACCESS_TOKEN`. These environment variables will take precedence over the configuration in `nx.json`.

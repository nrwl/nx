# Nx CLI and CI Access Tokens

{% youtube src="https://youtu.be/vBokLJ_F8qs" title="Configure CI access tokens" /%}

The permissions and membership define what developers can access on nx.app but they don't affect what happens when you run Nx commands in CI. To manage that, you need to provision CI access tokens in your workspace settings, under the `Access Control` tab.

![Access Control Settings Page](/nx-cloud/recipes/access-control-settings.avif)

## Access Types

{% callout type="warning" title="Use Caution With Read-Write Tokens" %}
Read-write tokens allow full write access to your remote cache. They should only be used in trusted environments.
{% /callout %}

There are currently two (2) types of CI Access Token for Nx Cloud's runner that you can use with your workspace. Both support distributed task execution and allow Nx Cloud to store metadata about runs.

- `read-only`
- `read-write`

### Read Only Access

The `read-only` access tokens will only read from the remote cache. New task results will be stored in the remote cache _only_ for that specific branch in a CI context, otherwise they will not be stored in the remote cache.  
Cached results can be downloaded and replayed for other machines or CI pipelines to use. This option provides the benefit of remote cache hits while restricting machines without proper permissions from adding entries into the shared primary remote cache.

### Read & Write Access

The `read-write` access tokens allows task results to be stored in the remote cache for other machines or CI pipelines to download and replay. This access level should only be used for trusted environments, such as protected branches within your CI Pipeline.

## Setting CI Access Tokens

You can configure an access token in CI by setting the `NX_CLOUD_ACCESS_TOKEN` environment variable.

`NX_CLOUD_ACCESS_TOKEN` takes precedence over any authentication method in your `nx.json`.

We recommend setting up a `read-write` and `read-only` in your CI based on protected vs unprotected branches. You can leverage your CI providers.

### GitHub Actions

GitHub allows specifying specific secrets for each environment, where an environment can be on a specific branch.
You can read the [official GitHub Actions documentation](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-an-environment) for more details.

1. In your repository, navigate to Settings tab
2. Click on "Environments" and create an environment for you protected branches.
   - Typically, organizations already have some kind of 'release' or 'protected' environments that can be leveraged.
   - If you do not have any protected branches, it's recommended to make at least your _default_ branch a protected branch i.e. `main`/`master`
3. Add a restriction for how the environment will be applied, and apply to all protected branches.
4. Add the read-write access token with the name `NX_CLOUD_ACCESS_TOKEN` to your environment.
5. Click the _Secrets and variables_ > _Actions_ tab in the sidebar.
6. add the `read-only` access token with the name `NX_CLOUD_ACCESS_TOKEN` to the repository secrets.
7. Now you should see 2 secrets where 1 is a part of the protected environment and the other is the default repository secrets

```yml {% fileName=".github/workflows/ci.yml" highlightLines=["29-32"] %}
name: CI
# ...
env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

jobs:
  main:
    runs-on: ubuntu-latest
    steps: ...
```

### GitLab

GitLab allows creating variables scoped to specific variables. You can read the [Official GitLab documentation](https://docs.gitlab.com/ci/environments/#limit-the-environment-scope-of-a-cicd-variable) for more details.

1. In your project, navigate to _Operate_ > _Environments_ and create a new environment. You do not need to fill out the External Url or GitLab agent.
   - Most projects already have a production/protected environments, so we recommend using this one if it's already defined.
2. In your project, navigate to _Settings_ > _CI/CD_ tab and expand the _Variables_ section.
3. Click on _Add variable_ and fill in the following information
   - Type: _Variable_
   - Environments: _All_
   - Visibility: _Masked and hidden_
   - Flags: uncheck _Protected variable_
   - Description: "read-only token for nx-cloud"
   - Key: `NX_CLOUD_ACCESS_TOKEN`
   - Value: Your read only token from Nx Cloud
4. Click _Add variable_
5. Click on _Add variable_ again and fill in the following information:
   - Type: _Variable_
   - Environments: Your protected environment created in step 1
   - Visibility: _Masked and hidden_
   - Flags: check _Protected variable_
   - Description: "read-write token for nx-cloud"
   - Key: `NX_CLOUD_ACCESS_TOKEN`
   - Value: Your read-write token from Nx Cloud
6. Click _Add variable_
7. Now you should see 2 secrets where 1 is a part of the protected & tagged to the environment and the other is not.
8. Update your pipeline to include steps where you want to write to the nx cache with the

```yaml {% fileName=".gitlab-ci.yml" highlightLines=["2-3"] %}
<job-name>:
  environment:
    name: <environment-name>
```

{% callout type="check" title="Can't someone change the step environment?" %}
You can of course edit the environment a step runs in the pipeline which would make you believe they can use the read-write, but because our read-write token is also marked with the _Protected variable_ flag, CI can only read the variable when running in a protected branch. As long as you perform code reviews and do not allow direct write access to protected branches, then cache integrity can be maintained.
{%/callout %}

### BitBucket Cloud

BitBucket Cloud supports setting a environment variables per environment called _Deployment variables_. You can read the [official BitBucket Pipelines documentation](https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/#Deployment-variables) for more details.

1. In your repository, navigate to the _Repository settings_ > _Deployment_
2. Select an environment you have configured for protected branches, or create a new one and protect your primary branches.
   - Note: selecting branch protection rules is a premium feature of BitBucket Cloud
3. Set the environment variable `NX_CLOUD_ACCESS_TOKEN` with the read-write token from Nx Cloud.
4. Navigate to the _Repository settings_ > _Repository variables_ tab and set the variable `NX_CLOUD_ACCESS_TOKEN` with the read-only token from Nx Cloud.
5. Update the `bitbucket-pipelines.yml` file to include the deployment name mentioned in step 2

```yaml {% fileName="bitbucket-pipelines.yml" highlightLines=[6] %}
pipelines:
  branches:
    main:
      - step:
          name: 'main checks'
          deployment: Production
          ...
```

### Azure Pipelines

### CircleCI

Circle CI allows creating _contexts_ and restricting those based on various rules. You can read the [official CircleCI documentation](https://circleci.com/docs/contexts/#restrict-a-context) for more details.

1. In your organization, navigate to _Organization settings_ > _Contexts_ and create a new context.
   - If you already have a context for protected environments, we recommend reusing that context.
2. Click on _Add Expression Restriction_ that restricts the context to protected branches only such as only the `main` branch.
   - `pipeline.git.branch == "main"`
3. Click on _Add Environment Variable_ and add the `NX_CLOUD_ACCESS_TOKEN` environment variable with the read-write token from Nx Cloud.
4. Back on the organization home page, navigate to your projects, then view the pipeline settings
5. Navigate to _Environment Variables_ and click _Add Environment Variable_ and add the `NX_CLOUD_ACCESS_TOKEN` environment variable with the read-only token from Nx Cloud.
6. Update your pipeline to include steps where you want to write to the nx cache with the correct contexts

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

### Jenkins

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

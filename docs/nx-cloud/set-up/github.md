# Github Integration
## Get Started 
The [Nx Cloud Github App](https://github.com/marketplace/official-nx-cloud-app) lets you access the result of every run—with all its logs and build insights—straight from your PR.

## Nx Public Cloud CI Setup 
Before you install the app, please make sure you have a **valid Nx Cloud `accessToken` in your `nx.json` file**. Nx Cloud reports will not generate properly on your PRs without one. You should already have one if you’re using Nx Cloud, but if you don’t, you can learn how to add one [here](https://nx.app/docs/manage-access).

You can find and install the app from [the GitHub marketplace](https://github.com/marketplace/official-nx-cloud-app).

If you are using CircleCI, TravisCI, GitHub Actions or GitHub, there is nothing else you need to do. If you are using other CI providers, you need to set the NX_BRANCH environment variable in your CI configuration. The variable has to be set to a PR number.

For instance, this is an example of doing it in Azure pipelines.

### Azure Pipelines

```yml
variables:
  NX_BRANCH: $(System.PullRequestNumber)
```

### CircleCI
Make sure [GitHub checks are enabled](https://circleci.com/docs/2.0/enable-checks/#to-enable-github-checks).

### Jenkins
[Install the Jenkins plugin](https://plugins.jenkins.io/github-checks/).

Ensure this step from the plugin instructions is followed:

    Prerequisite: only GitHub App with proper permissions can publish checks, this guide helps you authenticate your Jenkins as a GitHub App.

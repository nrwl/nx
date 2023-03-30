# Enable GitHub PR Integration

## Get Started

The [Nx Cloud GitHub App](https://github.com/marketplace/official-nx-cloud-app) lets you access the result of every run—with all its logs and build insights—straight from your PR.

## Install the App

For the best experience, install the [Nx Cloud GitHub App](https://github.com/marketplace/official-nx-cloud-app). Using the app provides the most seamless authentication experience. This is not required if you wish to authenticate with a personal access token that you generate yourself.

## Connecting Your Workspace

Once you have installed the Nx Cloud GitHub App, you must link your workspace to the installation. To do this, sign in to Nx Cloud and navigate to the VCS Integrations setup page. This page can be found in your workspace settings, you need to be admin of the organization in order to access it.
Once on the VCS Integrations setup page, you can choose what VCS you want to connect to your workspace.

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.webp)

### Choosing an Authentication Method

It is easier to configure the Nx Cloud GitHub Integration to use its GitHub App to authenticate, and this method should be preferred for users on Nx Public Cloud. Advanced users or Nx Enterprise clients may instead wish to generate a personal access token instead.

#### Using the GitHub App

To use the Nx Cloud GitHub App for authentication, select the radio button and then click "Connect".
This will verify that Nx Cloud can connect to your repo. Upon a successful test, your configuration is saved.
Check the "_CI Platform Considerations_" section below and if there are no additional instructions for your platform of choice, setup is complete.

![Use GitHub App for Authentication](/nx-cloud/set-up/use-github-app-auth.webp)

#### Using a Personal Access Token

To use a Personal Access Token for authentication, one must be generated with proper permissions. The minimum required permissions are shown in the screenshot below.

![Minimum GitHub Personal Access Token Permissions](/nx-cloud/set-up/minimal-github-access-token.png)

Once this token is created, select the radio button for providing a personal access token, paste the value, and then click "Connect". This will verify that Nx Cloud can connect to your repo. Upon a successful test, your configuration is saved. Check the "_CI Platform Considerations_" section below, and if there are no additional instructions for your platform of choice, setup is complete.

## CI Platform Considerations

If you are using CircleCI, TravisCI, GitHub Actions or GitHub, there is nothing else you need to do. If you are using other CI providers, you need to set the `NX_BRANCH` environment variable in your CI configuration. The variable has to be set to a PR number.

For instance, this is an example of doing it in Azure pipelines.

### Azure Pipelines

```yml
variables:
  NX_BRANCH: $(System.PullRequest.PullRequestNumber)
```

### CircleCI

Make sure [GitHub checks are enabled](https://circleci.com/docs/2.0/enable-checks/#to-enable-github-checks).

### Jenkins

[Install the Jenkins plugin](https://plugins.jenkins.io/github-checks/).

Ensure this step from the plugin instructions is followed:

    Prerequisite: only GitHub App with proper permissions can publish checks, this guide helps you authenticate your Jenkins as a GitHub App.

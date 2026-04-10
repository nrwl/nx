# GitHub integration

Any CI tool requires tight integration with your existing version control system. Nx Cloud offers first class integration with GitHub in the following ways.

## Easy Onboarding

![Screenshot of Nx Cloud connecting a GitHub repository](/nx-cloud/features/github-onboarding.avif)

Get started with Nx Cloud in no time with our GitHub connection process. Connect your workspace, and Nx Cloud will create a pull request with everything you need. Select your workspace and organization, and Nx Cloud takes care of the rest. User access is automatically connected to GitHub, and a PR is created to connect your workspace. Your repo now has [distributed caching](/ci/features/remote-cache) in less than 5 minutes.

## Pull Request Insights

![Screenshot of Nx Cloud app for GitHub showing pull request insights](/nx-cloud/features/github-pr-bot.avif)

Good CI checks require fast and easy access to results. That's why Nx Cloud will update your PR with the current running status of your tasks and a convenient link to your Nx Cloud results and logs. Take advantage of the enhanced developer experience of structured and searchable logs. Quick insight to PR task progress, so you're not stuck waiting for every task to complete. And with Nx Replay, developers can quickly replay tasks locally to avoid running tasks that CI has already completed.

## Access Control

![Diagram showing users syncing from GitHub to Nx Cloud](/nx-cloud/features/github-user-management.avif)

Nx Cloud organizations can use their existing GitHub access controls to manage Nx Cloud as well. This allows Nx Cloud to fit in to any existing on-boarding or off-boarding process. There's no need to manually manage users separately. Get your engineers Nx Cloud access right alongside their GitHub access so they can get to work fast. Use [personal access tokens](/ci/recipes/security/personal-access-tokens) to further enhance your security.

## Get Started

First, you'll want to connect your Nx Cloud account to GitHub. You can use your regular username and password or log in via Google or GitHub, connecting to GitHub is a separate step.

{% call-to-action title="Connect to GitHub" url="https://cloud.nx.app/profile/vcs-integrations" icon="nxcloud" description="Connect your Nx Cloud account to GitHub via your profile settings" %}
Connect to GitHub
{% /call-to-action %}

## Connect a New Workspace and Organization

1. Visit [Nx Cloud](https://cloud.nx.app) and click **Connect a workspace** at the top.
2. Select **Connect existing repository** from the dropdown.
3. Follow the prompts to select a repo.
4. If that repo is controlled by a GitHub organization, you will be prompted to use that organization.
5. Follow the prompts to create a pull request to complete your connection to Nx Cloud.

{% call-to-action title="Connect a workspace to Nx Cloud" url="https://cloud.nx.app/setup/connect-workspace/github/select" icon="nxcloud" description="Connect an Nx workspace in GitHub to Nx Cloud" %}
Connect an Nx workspace in GitHub to Nx Cloud
{% /call-to-action %}

## Connect an Existing Organization

If you've already created an organization in Nx Cloud, and you'd like to use your GitHub organization to manage access to it:

1. Go to the organization in Nx Cloud while logged in as an admin user.
2. Click on **Settings** in the top menu
3. Go to **Connect GitHub organization in the sidebar**
4. Follow the prompts there to connect to GitHub.

## Connect an Existing Workspace

If you already have a workspace connected to Nx Cloud, and you'd like to connect it to a GitHub repo to enable PR insights, [see our recipe for more details.](/ci/recipes/source-control-integration/github)

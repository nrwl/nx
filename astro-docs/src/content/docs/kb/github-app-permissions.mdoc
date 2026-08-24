---
title: GitHub App Permissions
description: A detailed breakdown of each permission the Nx Cloud GitHub App requires and why.
filter: 'type:Guides'
topics:
  - 'Continuous integration'
---

The Nx Cloud GitHub App requires the following permissions to provide CI/CD integration and setup experiences. Most information is used transiently during operations and not stored in our systems.

If your workspaces use repositories from more than one GitHub organization, see how to [configure a standard Nx Cloud organization with repository-scoped access](/docs/kb/multiple-github-organizations).

{% callout type="note" title="Administration (read & write) permission removed." %}
The Nx Cloud GitHub App no longer requests the `Administration` (read & write) permission. It was previously required to generate new workspaces from the browser; that feature has since been removed, so we've dropped the permission to reduce the access we request.
{% /callout %}

## Required permissions

Most of the permissions below are scoped to individual repositories.
Two are scoped to the organization because the work they support isn't tied to a single repository: checking a user's role in GitHub, and finding the app's installation for the organization.
Organization scope also means you don't have to re-grant access every time a repository is added.

Repository permissions:

- `Checks: Read & Write`
- `Contents: Read & Write`
- `Commit Statuses: Read & Write`
- `Issues: Read & Write`
- `Metadata: Read`
- `Pull requests: Read & Write`
- `Workflows: Read & Write`
- `Actions: Read`

Organization permissions:

- `Administration: Read Only`
- `Members: Read Only`

## Permission details

### Checks (read & write)

**Used for:** Updating CI run statuses so you can see the progress and results of your Nx Cloud pipeline executions directly in GitHub. Also used for Self-Healing CI status check runs in PRs.

**When it's used:** Automatically during CI runs to provide real-time status updates.

### Contents (read & write)

**Used for:**

- **Read:** Detecting your workspace's current Nx version to ensure compatibility. Reading files for Self-Healing CI.
- **Write:** Adding Nx Cloud configuration (`nxCloudId` or access token) to your repository during setup. Creating commits and pushing fixes for Self-Healing CI.

**When it's used:** During initial setup and configuration, and regularly if Self-Healing CI is enabled.

### Commit statuses (read & write)

**Used for:**

- **Read:** Reading the existing statuses on a pull request's head commit so Nx Cloud only re-posts the ones that have changed.
- **Write:** Posting each task's result (passed, failed, or in progress) as a commit status on the pull request, so the outcome of every `nx affected` or `run-many` command shows on the PR. Posted only when the workspace's "Show run status checks in pull requests" setting is enabled.

**When it's used:** During CI pipeline executions on pull request branches.

### Issues (read & write)

**Used for:** PR comments (GitHub uses the Issues API for PR comments - see "Pull requests" below for more detail). Also used to write labels on pull requests, which GitHub exposes through the same Issues API.

**When it's used:** During CI runs and when posting status comments.

### Metadata (read)

**Used for:** Accessing basic repository information (name, description, visibility), and listing the repositories you can pick from when connecting a workspace. This is a required baseline permission for most GitHub App functionality.

### Pull requests (read & write)

**Used for:**

- **Read:** Gathering branch information, SHAs, and metadata necessary for CI pipeline execution and distributed task coordination.
- **Write:** Posting comments on PRs with CI pipeline status, command results, and Self-Healing CI fixes. Creating PRs during initial Nx Cloud setup. Creating demo PRs for optional features like Self-Healing CI (only when you opt in).

**When it's used:** Read operations occur during CI runs. Write operations occur during setup and when posting status comments.

### Workflows (read & write)

**Used for:** Automatically configuring GitHub Actions workflow files when you opt in to features like Self-Healing CI and distributed task execution.

**When it's used:** Only when you explicitly enable these features through the Nx Cloud interface.

### Actions (read)

**Used for:** Retrieving GitHub Action logs so that they can be surfaced on Nx Cloud to help resolve failures before Nx Cloud had a chance to run tasks.

**When it's used:** Only when using Nx Cloud MCP tools to get CI information.

### Administration (organization, read)

**Used for:** Finding the Nx Cloud app's installation for your GitHub organization. Nx Cloud uses the installation to link your GitHub organization to your Nx Cloud organization and to confirm the app is still connected.

**When it's used:** During initial setup, when reconnecting the integration, and when syncing organization members.

### Members (organization, read)

**Used for:** Checking whether the signed-in user has the `admin` role in your GitHub organization.
Nx Cloud reuses that role to decide who can manage the organization's version control connection instead of maintaining a separate list of administrators.

**When it's used:** When loading the organization dashboard for a user whose GitHub membership hasn't been recorded yet.

## Your data and security

Most information accessed through these permissions is used transiently during operations and is not stored. Limited version control metadata (such as branch names, SHAs, and commit information) may be stored as part of your CI pipeline execution records for analytics and debugging purposes.

[Nx Cloud is SOC2 Type II certified](https://security.nx.app). We implement industry-standard security practices including encryption at rest and in transit, access logging, and regular security audits.

You can revoke access to the Nx Cloud GitHub app at any time through your GitHub settings. Write operations (creating repos, posting comments, modifying workflows) only occur when explicitly triggered by your actions or when you opt in to specific features.

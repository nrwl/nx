---
title: GitHub App Permissions
description: A detailed breakdown of each permission the Nx Cloud GitHub App requires and why.
filter: 'type:References'
---

The Nx Cloud GitHub App requires the following permissions to provide CI/CD integration and setup experiences. Most information is used transiently during operations and not stored in our systems.

## Required permissions

Repository permissions:

- `Administration: Read & Write`
- `Checks: Read & Write`
- `Contents: Read & Write`
- `Commit Statuses: Read`
- `Issues: Read & Write`
- `Metadata: Read`
- `Pull requests: Read & Write`
- `Workflows: Read & Write`
- `Actions: Read`

Organization permissions:

- `Administration: Read Only`
- `Members: Read Only`

## Permission details

### Administration (write)

**Used for:** Creating new repositories with a pre-configured Nx workspace during initial onboarding.

**When it's used:** Only when you explicitly choose to create a new workspace through Nx Cloud's setup flow. [Single tenant instances](/docs/enterprise/single-tenant/overview) can safely forego this scope and will only lose the ability to create new workspaces through the app.

### Checks (write)

**Used for:** Updating CI run statuses so you can see the progress and results of your Nx Cloud pipeline executions directly in GitHub. Also used for Self-Healing CI status check runs in PRs.

**When it's used:** Automatically during CI runs to provide real-time status updates.

### Contents (read & write)

**Used for:**

- **Read:** Detecting your workspace's current Nx version to ensure compatibility. Reading files for Self-Healing CI.
- **Write:** Adding Nx Cloud configuration (`nxCloudId` or access token) to your repository during setup. Creating commits and pushing fixes for Self-Healing CI.

**When it's used:** During initial setup and configuration, and regularly if Self-Healing CI is enabled.

### Commit statuses (read)

**Used for:** Reading commit status information to coordinate with other CI tools and provide accurate pipeline context.

**When it's used:** During CI pipeline executions to gather context about your commits.

### Issues (read & write)

**Used for:** PR comments (GitHub uses the Issues API for PR comments — see "Pull requests" below for more detail).

**When it's used:** During CI runs and when posting status comments.

### Metadata (read)

**Used for:** Accessing basic repository information (name, description, visibility). This is a required baseline permission for most GitHub App functionality.

### Pull requests (read & write)

**Used for:**

- **Read:** Gathering branch information, SHAs, and metadata necessary for CI pipeline execution and distributed task coordination.
- **Write:** Posting comments on PRs with CI pipeline status, command results, and Self-Healing CI fixes. Creating PRs during initial Nx Cloud setup. Creating demo PRs for optional features like Self-Healing CI (only when you opt in).

**When it's used:** Read operations occur during CI runs. Write operations occur during setup and when posting status comments.

### Workflows (write)

**Used for:** Automatically configuring GitHub Actions workflow files when you opt in to features like Self-Healing CI and distributed task execution.

**When it's used:** Only when you explicitly enable these features through the Nx Cloud interface.

### Actions (read)

**Used for:** Retrieving GitHub Action logs so that they can be surfaced on Nx Cloud to help resolve failures before Nx Cloud had a chance to run tasks, and for Polygraph support.

**When it's used:** Only when using Polygraph, and Nx Cloud MCP tools to get CI information.

## Your data and security

Most information accessed through these permissions is used transiently during operations and is not stored. Limited version control metadata (such as branch names, SHAs, and commit information) may be stored as part of your CI pipeline execution records for analytics and debugging purposes.

[Nx Cloud is SOC2 Type II certified](https://security.nx.app). We implement industry-standard security practices including encryption at rest and in transit, access logging, and regular security audits.

You can revoke access to the Nx Cloud GitHub app at any time through your GitHub settings. Write operations (creating repos, posting comments, modifying workflows) only occur when explicitly triggered by your actions or when you opt in to specific features.

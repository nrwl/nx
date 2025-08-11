---
title: 'AI-Powered Self-Healing CI'
description: 'Learn how Nx Cloud Self-Healing CI uses AI to automatically detect, analyze, and fix CI failures, eliminating the need to babysit PRs and keeping you focused on building features.'
keywords: [self-healing CI, AI, CI automation]
---

# Self-Healing CI

{% youtube
src="https://youtu.be/JW5Ki3PkRWA"
title="Introducing Self-Healing CI for Nx and Nx Cloud"
/%}

Nx Cloud Self-Healing CI is an **AI-powered system that automatically detects, analyzes, and proposes fixes for CI failures**, offering several key advantages:

- **Improves Time to Green (TTG):** Significantly reduces the time it takes to get your PR merge-ready by automatically proposing fixes when your tasks fail. No more babysitting PRs until they are ready for review.
- **Keeps You in the Flow:** With Nx Console, you get direct notifications in your editor (VS Code, Cursor, or WebStorm) showing failed PRs and proposed fixes. Review, approve, and keep working while the AI handles the rest in the background.
- **Leverages Deep Context:** AI agents understand your workspace structure, project relationships, and build configurations through Nx's project graph and metadata.
- **Non-Invasive Integration:** Works with your existing CI provider and doesn't require overhauling your current setup.

## Enable Self-Healing CI

To enable Self-Healing CI in your workspace, you'll need to connect to Nx Cloud and configure your CI pipeline.

If you haven't already connected to Nx Cloud, run the following command:

```shell
npx nx@latest connect
```

Next, check the Nx Cloud workspace settings in the Nx Cloud web application to ensure that "Self-Healing CI" is enabled (it should be enabled by default).

### Configure your CI pipeline

**Using [Nx Agents](/ci/features/distribute-task-execution):** There's nothing to be done. You're already good to go.

**Not using Nx Agents:** Add the `fix-ci` step to your pipeline. Important: this step must run at the end with `if: always()` to ensure it executes even when previous steps fail:

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=[10,11] %}
name: CI

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      ...
      - run: npx nx affected -t lint test build

      - run: npx nx-cloud fix-ci
        if: always()
```

## How Self-Healing CI works

Here's what happens when you push a PR with Self-Healing CI enabled:

![Self-Healing CI Workflow](/blog/images/articles/self-healing-flow.avif)

### 1. Failure Detection

When you push your PR and tasks fail, Nx Cloud automatically detects the failure and triggers the self-healing process.

### 2. Fix Generation

Nx Cloud starts an AI agent that analyzes the failed tasks and creates an appropriate fix, leveraging the context from Nx and Nx Cloud:

- It has the complete failure context with the exact tasks that ran, including error logs
- Thanks to the [Nx graph](/features/explore-graph), it has vast context about the codebase, including project structure, dependencies, configuration, and runnable tasks

### 3. Notification

Once the fix is available, you'll be notified immediately based on where you're currently working:

**In your editor:** If you have [Nx Console](/getting-started/editor-setup) installed, you'll get a notification directly in your editor:

![Notification in your editor about an AI fix](/blog/images/articles/notification-self-healing-ci.avif)

Clicking the notification will open a dedicated view showing the failed task log, the status of the fix as well as the actual git diff.

![Nx Console view of the automated fix that has been applied to your PR](/blog/images/articles/nx-console-self-healing-fix-applied.avif)

**In your browser:** If you're not currently working in your editor, you will also see the notification about an available fix from Nx Cloud directly in your GitHub PR comments:

![Self-healing CI fix showing up in GitHub comments](/blog/images/articles/self-healing-fix-gh-comment.avif)

### 4. Verification

While you're being notified, Nx Cloud automatically **runs a verification phase** in the background. The purpose is to rerun the failed task with the new fix to make sure it actually solves the issue. This step can be skipped if you see the proposed fix and already know that it is the correct one. However, it is a useful additional step to verify the correctness of the change.

### 5. Review & Apply

You can review the fix and decide whether to apply or reject it:

- **From Nx Console:** Review the git diff directly in your editor
- **From GitHub:** Click "View Fix" to be redirected to the Nx Cloud web application, showing the git diff of the fix that is about to be applied

![Self-healing CI fix showing up in GitHub comments](/blog/images/articles/self-healing-fix-nx-cloud.avif)

If you apply the fix, **Nx Cloud automatically pushes a commit to your original PR**.

## Learn more

Self-Healing CI represents the next evolution in CI automation, moving beyond just speeding up builds to actually fixing them automatically. Learn more about this feature in our blog post: [Introducing Self-Healing CI for Nx and Nx Cloud](/blog/nx-self-healing-ci).

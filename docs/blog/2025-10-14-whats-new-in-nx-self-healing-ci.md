---
title: "What's New in Nx Self-Healing CI"
slug: 'whats-new-in-nx-self-healing-ci'
authors: ['Juri Strumpflohner']
tags: [nx, nx-cloud, self-healing, ai]
cover_image: /blog/images/articles/self-healing-ci-update-blog-hero.avif
description: 'Enhanced GitHub integration, interactive diffs, fine-grained task control, auto-apply fixes, and local fix application—discover the latest improvements to Nx Self-Healing CI.'
---

AI agents and AI-assisted coding are here to stay. Our mission: integrate it with Nx such that it's actually useful for day-to-day developer work. We've been heads-down fine-tuning [Self-Healing CI](/docs/features/ci-features/self-healing-ci), improving its correctness and making sure it shows up when it should without being annoying.

So let me take this occasion to highlight a few things we shipped in the last weeks.

## Enhanced GitHub Integration

We built a dedicated view into [Nx Console](/docs/getting-started/editor-setup) to surface Self-Healing fixes directly in your editor. But sometimes you're jumping straight to GitHub (or whatever VCS you're using) to quickly check your open PRs and see if there's anything new.

We improved the way we integrate into your GitHub PRs by posting a dedicated comment whenever Self-Healing CI finds a fix for a broken CI run:

![Self-Healing CI GitHub Comment](/blog/images/articles/self-healing-ghcomment-dark.avif)

It shows:

- A summary of the reasoning behind the fix
- A diff view with the changes

You then have 2 buttons for directly applying or rejecting the fix, as well as two less prominent actions for applying the fix locally (more below) and viewing the diff in Nx Cloud for a richer interactive diff experience.

Why a comment? Self-Healing goes beyond just commenting on changed files in the PR. You might change an implementation and Self-Healing might adjust your spec files because you forgot to update those as well. So we cannot use review APIs (from GitHub, for example) as common code reviewing tools do.

> **GitLab support is coming.** We already have a working version and are about to release it soon.

## Redesigned Interactive Diff in Nx Cloud

We also completely redesigned the Self-Healing CI view in the Nx Cloud application, making it more compact and easier to parse the most important information together with a richer, GitHub-like interactive diff viewer:

![Self-Healing CI Interactive Diff](/blog/images/articles/self-healing-nx-cloud-diff-dark.avif)

You can reach this page directly via the Nx Cloud run page whenever an AI fix is available, as well as via the dedicated Self-Healing CI GitHub comment (as discussed in the previous section).

## Fine-Grained Control with `--fix-tasks`

{% youtube src="https://youtu.be/KSb48zHbaHg" /%}

Not all tasks need self-healing. You can now specify exactly which tasks should be considered for automatic fixing using the `--fix-tasks` flag:

**Only fix specific tasks:**

```shell
npx nx start-ci-run --fix-tasks="*lint*,*format*"
```

**Exclude specific tasks:**

```shell
npx nx start-ci-run --fix-tasks="!*deploy*,!*test*"
```

Tasks are matched using glob patterns in the format `<project>:<task>:<configuration>`, giving you fine-grained control. Commands recorded with `nx-cloud record --` are matched by their full command string (e.g., `nx-cloud record -- nx format`).

## YOLO Mode with `--auto-apply-fixes`

{% youtube src="https://youtu.be/EmZcENiCG64" /%}

By default, Self-Healing CI identifies broken tasks, leverages AI to develop a fix, and proposes it for approval. You're in the loop to apply, reject, or refine it.

For some simpler tasks though, you might not even want to be bothered—like formatting or linting issues, for example.

You can now use the `--auto-apply-fixes` flag to control which tasks are eligible for being auto-applied:

```shell
npx nx start-ci-run --auto-apply-fixes="*format*,*lint*"
```

**How it works:**

1. AI generates a fix for the failed task
2. Nx Cloud runs a **verification phase** in the background to ensure the fix passes CI
3. If verification succeeds, the fix is **automatically pushed to your PR**—no manual approval needed
4. If you have [Nx Console](/docs/getting-started/editor-setup), you'll get a notification that a commit has been added

You can continue working on other things while the AI handles the fix in the background. Just pull the changes when you're ready.

**Important:** Auto-fixes are only applied after the verification phase passes, ensuring the proposed change actually solves the problem.

## Apply Fixes Locally for Fine-Tuning

{% youtube src="https://youtu.be/37q9O-PYPlY" /%}

Sometimes you see a fix that's 90% there, so you can't quite approve and apply it right away—you need to tweak it slightly first.

For this, we added the ability to apply changes locally. You'll see instructions in the GitHub comment, in Nx Console, and in the Nx Cloud application. What we give you is a command you can run directly in your editor.

![Apply Self-Healing Fixes Locally](/blog/images/articles/self-healing-apply-locally.avif)

If you're currently on a different branch (e.g., `main`), Nx Cloud will detect the correct branch for your PR and offer to check it out automatically before applying the fix.

## Reverting Applied Fixes

If you accidentally applied a Self-Healing CI fix to your PR, you can easily undo it by manually reverting the Git commit. For convenience, we also added a "Revert changes" action to the Self-Healing CI diff viewer in the Nx Cloud application.

![Revert Self-Healing CI Changes](/blog/images/articles/self-healing-ci-revert-changes.png)

Just follow the Nx Cloud GitHub comment on your PR to reach this screen.

## Wrapping Up

You can try Self-Healing CI yourself easily by:

1. Connecting your Nx workspace to Nx Cloud: `npx nx@latest connect`
2. Updating your CI config:

```yaml
name: CI

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      ...
      - run: npx nx affected -t lint test build

      - run: npx nx fix-ci
        if: always()
```

Check out [our docs for the full details on how to configure Self-Healing CI](/docs/features/ci-features/self-healing-ci#enable-self-healing-ci).

Self-Healing CI is available for free on **Hobby, Team, and Enterprise** plans. You can **try it out and see it in action** by [creating a new workspace here](https://cloud.nx.app/get-started/?utm_source=nx-dev&utm_medium=blog) which will allow you to generate a failed PR that "heals itself".

---

Learn more:

- 🧠 [Nx AI Docs](/docs/features/enhance-ai)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)

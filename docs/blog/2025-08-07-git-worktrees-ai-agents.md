---
title: 'How Git Worktrees Changed My AI Agent Workflow'
slug: git-worktrees-ai-agents
authors: ['Juri Strumpflohner']
tags: ['git', 'ai']
cover_image: /blog/images/articles/bg-worktrees-ai-agents.avif
description: 'Learn how Git worktrees enable parallel development with AI agents, eliminating context switching in your workflow.'
youtubeUrl: https://youtu.be/-DTpsDjYKCY
pinned: false
---

Do you know those times when you're working on something, but you also need to carry forward another feature on the side? Obviously, Git allows you to have branches for this specific purpose, but sometimes it's just **easier to have a copy of the repo**, have multiple instances of the editor open and switch back and forth. I've been doing this a lot, and even more so **since AI agents became a daily tool in my development workflow**.

Now guess what, Git has a dedicated feature for that: **Git worktrees**.

{% callout title="Already familiar with worktrees?" type="info" %}

If you're already familiar, make sure you don't miss out on the `@johnlindquist/worktree` CLI. Jump ahead to the [corresponding section later in the article](/blog/git-worktrees-ai-agents#streamlining-worktrees-with-the-worktree-cli).

{% /callout %}

{% toc /%}

## So what's the issue here?

It's tedious. You notice that PR that's failing on CI, meaning you need to switch back to that branch to fix it and re-trigger a run. The result:

- you have to temporarily commit changes or stash whatever you've been currently working on
- switch branches
- potentially re-install node_modules (or whatever package manager you're using)

A lot of ceremony, which is annoying. Now, when it comes to failing PRs in CI, I've actually already got a solution for you: [AI-Powered Self-Healing CI](/blog/nx-self-healing-ci).

But if you want to work on multiple things locally, this will still be an issue.

## Using AI agents made me find Git worktrees

And I'm pretty sure that's how you discovered it too. I'll leave it to you whether it's productive or not to have multiple things going on in parallel, but this has almost become the reality when you start **incorporating AI agents** into your development workflow.

**Why do AI agents matter here?** Here's a concrete use case:

- You have an open issue on GitHub that should be rather straightforward to fix, so you plan to have it handled by an AI agent
- You create a new branch `issue-123` in a worktree `../nx-issue-123`
- You spin up Claude Code or your AI agent of choice, provide instructions and let it work on that branch.
- Since this is in a worktree (i.e., a different folder), you can just switch back in your editor and continue working on what you were doing, while your AI agent keeps working in the background

Such scenarios are when you truly need multiple local copies of your repository. Branches wouldn't work here. Now, you could manually copy the repo, but that's clunky. **Git worktrees** provide a native way to handle exactly this use case.

## Git worktrees 101

**Git worktrees solve this elegantly** by allowing multiple working directories from a single repository, each operating independently while sharing the same Git history.

Each worktree can be checked out to different branches, allowing true parallel development. A possible/common structure can be the following:

```plaintext
working-dir/
├─ nx/                       <<< main repo
├─ nx-feature-a/             <<< worktree for feature a
├─ nx-feature-b/             <<< worktree for feature b
```

I want to keep this short since you can look up all these commands with your LLM or Google them. But here are the main commands:

**Creating a new worktree for a new branch "feature-a"**

```shell
git worktree add ../nx-feature-a -b feature-a
```

This command:

- Creates a new directory `../nx-feature-a`
- Checks out the `feature-a` branch in that directory
- Links it to your main repository's Git history

If you already have an existing branch, just omit the `-b`.

**List all worktrees**

```shell
git worktree list
```

**Remove a worktree**

```shell
git worktree remove ../nx-feature-a
```

The beauty is that **all worktrees share the same Git history**. Changes committed in any worktree are immediately available to all others. You can merge between worktrees just like normal branches because they're all part of the same repository.

Hence you can merge a worktree just as you would normally do. Go back to your main repository and run:

```shell
git merge feature-a
```

(Note, most likely you're not merging directly anyway but rather going via some PR that merges into `main`)

## Streamlining worktrees with the worktree CLI

While Git worktrees are powerful, I highly recommend checking out [John Lindquist's](https://twitter.com/johnlindquist) worktree CLI, which streamlines some of the worktree management.

You can [find out more on the corresponding GitHub repo](https://github.com/johnlindquist/worktree-cli), but here's the TL;DR:

```shell
npm install -g @johnlindquist/worktree@latest
```

This gives you the `wt` command with much simpler workflows:

You can now **create new worktrees** with

```shell
wt new feature-name
```

The tool automatically:

- Generates standardized folder names (`{reponame}-{branch-name}`)
- Creates the worktree
- Opens it in your configured editor

You can also **list existing worktrees**

```shell
wt list
```

Or **open an existing worktree** in your configured editor:

```shell
wt open feature-name
```

And **remove a worktree** when you're done:

```shell
wt remove feature-name
```

### Direct PR checkout

I particularly like this one. Similar to the [GitHub CLI command](https://cli.github.com/) `gh pr checkout <pr-number>` that I use all the time, there's a similar command in the Worktree CLI (in fact, it relies on the GitHub CLI underneath):

```shell
wt pr 1234
```

This checks out a given PR directly into its own worktree, which is really nice if you need to review it locally or just add some minor changes to it.

## Wrapping up

**This isn't just for AI workflows**. Worktrees are valuable anytime you need to work on multiple branches simultaneously and want to quickly jump back and forth—like reviewing PRs or handling urgent fixes without losing your current context.

That's a wrap. Hopefully, with Git worktrees and [Nx Cloud's self-healing CI](/blog/nx-self-healing-ci), I was able to provide you with some neat additions to your developer toolbox.

{% call-to-action title="Not using Nx Cloud yet?" url="https://cloud.nx.app/get-started/?utm_source=nx-dev" icon="nxcloud" description="Get started now for free!" /%}

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🌩️ [Nx Cloud Self-Healing CI](/blog/nx-self-healing-ci)
- 👩‍💻 [John Lindquist's Worktree CLI](https://www.npmjs.com/package/@johnlindquist/worktree)
- 📹 [Git Worktrees Video Walkthrough](https://youtu.be/-DTpsDjYKCY)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)

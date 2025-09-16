---
title: Quickstart with Nx
description: Get up and running with Nx in minutes - install Nx, set up your editor, configure AI assistance, and choose your development path.
---

# Nx Quickstart

Get up and running with Nx in just a few minutes by following these simple steps.

{% steps %}

{% step title="Install the Nx CLI" %}

Installing Nx globally is **optional** - you can use `npx` to run Nx commands without installing it globally, especially if you're working with Node.js projects.

However, if you prefer a global installation, here are some options:

{% tabs %}
{% tab label="npm" %}

```shell
npm add --global nx
```

**Note:** You can also use Yarn, pnpm, or Bun

{% /tab %}
{% tab label="Homebrew (macOS, Linux)" %}

```shell
brew install nx
```

{% /tab %}
{% tab label="Chocolatey (Windows)" %}

```shell
choco install nx
```

{% /tab %}
{% tab label="apt (Ubuntu)" %}

```shell
sudo add-apt-repository ppa:nrwl/nx
sudo apt update
sudo apt install nx
```

{% /tab %}
{% /tabs %}

{% /step %}

{% step title="Start fresh or add to existing project" %}

For JavaScript-based projects you can **start with a new workspace** using the following command:

```shell
npx create-nx-workspace@latest
```

**Add to an existing project: (recommended also for non-JS projects)**

```shell
npx nx@latest init
```

**Get the complete experience:**
For a fully integrated development workflow with AI-powered CI features, [start directly from Nx Cloud](https://cloud.nx.app/get-started).

Learn more: [Start New Project](/getting-started/start-new-project) • [Add to Existing](/getting-started/adding-to-existing) • [Complete Nx Experience](https://cloud.nx.app/get-started)

{% /step %}

{% step title="Run Your First Commands" %}

Nx provides powerful task execution with built-in caching. Here are some essential commands:

**Run a task for a single project:**

```shell
nx build my-app
nx test my-lib
```

**Run tasks for multiple projects:**

```shell
nx run-many -t build test lint
```

Learn more: [Run Tasks](/features/run-tasks) • [Cache Task Results](/features/cache-task-results)

{% /step %}

{% step title="What's next?" %}

Now that you've experienced the Nx basics, choose how you want to continue:

{% cards %}

{% card title="I learn by doing" description="Follow our guided tutorials that teach you from setting up a new project to configuring continuous integration." url="/getting-started/tutorials" /%}

{% card title="I learn better with videos" description="Check out our bite-sized video lessons that teach you about Nx 101, Nx Release and how to incrementally adopt Nx in an existing project." type="documentation" url="/courses" /%}

{% card title="Tell me more about Nx on CI" description="Understand how Nx works on CI, how to configure it and how Nx Cloud helps ensure CI runs fast and efficiently." type="documentation" url="/ci" /%}

{% card title="Is Nx just for JavaScript projects?" description="Explore Nx's technology integrations and how it can support your specific stack. Even beyond just JavaScript-based projects." type="documentation" url="/technologies" icon="CodeBracketIcon" /%}

{% /cards %}

{% /step %}

{% /steps %}

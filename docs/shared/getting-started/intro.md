---
title: Intro to Nx
description: 'Nx is an AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.'
---

# What is Nx?

Nx is a powerful, open source, technology-agnostic build platform designed to efficiently manage codebases of any scale. From small single projects to large enterprise monorepos, Nx provides the platform to **efficiently get from starting a feature in your editor to a green, review-ready PR**.

{% youtube
src="https://www.youtube.com/embed/-_4WMl-Fn0w"
title="What is Nx?"
width="100%" /%}

As teams and codebases grow, productivity bottlenecks multiply: build times increase, CI becomes flaky, and code sharing becomes complex. **Nx reduces friction across your entire development cycle.**

## Start small, extend as you grow

Nx is built in a modular fashion, allowing you to adopt as little or as much as you'd like at any moment in your development lifecycle. You can **start with just the core and add additional capabilities incrementally** as your needs grow and complexity increases.

At the **foundation is Nx Core**, a Rust-based, technology-agnostic task runner. Nx Core creates a knowledge graph of your workspace, understanding project relationships and dependencies. This enables highly optimized and fast task execution regardless of technology stack. It runs `package.json` scripts in [TypeScript monorepos](/technologies/typescript/introduction) or Gradle tasks in [Java projects](/technologies/java/introduction) or [can be extended](/extending-nx/intro/getting-started) to meet your project's specific needs.

{% callout type="deepdive" title="What do you mean by 'running NPM scripts'?" %}

At the very core, Nx is a super fast, intelligent task runner. Let's take the example of an NPM workspace. This could be a project's `package.json`:

```json
{
  "name": "my-project",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
```

Then you can simply add Nx to your root `package.json`:

```json
{
  "devDependencies": {
    "nx": "latest"
  }
}
```

And once that's done, you can run your tasks via Nx.

```shell
nx build my-project
```

This will execute the `build` script from `my-project`'s `package.json`, equivalent to running `npm run build` in that project directory.

Similarly you [can run tasks across all projects](/features/run-tasks), just specific ones or just those from projects you touched.

From there, you can gradually enhance your setup by adding features like [task caching](/features/cache-task-results), adding [plugins](/technologies), optimizing your CI via [task distribution](/ci/features/distribute-task-execution), and many more powerful capabilities as your needs grow.

{% /callout %}

Nx Core provides everything you need to get started and works perfectly on its own. **When you're ready for more, the Nx platform offers additional capabilities you can adopt incrementally**. Extend your setup with [**Nx Cloud**](/ci) for remote caching, distributed task execution, and [**AI-powered self-healing CI**](/ci/features/self-healing-ci) that automatically detects, analyzes, and fixes CI failures. Integrate [**Nx Console**](/getting-started/editor-setup) with your editor for powerful autocomplete, project graph visualization, CI notifications, and an MCP to [make your AI coding assistant smarter](/features/enhance-AI). Add [**Nx Plugins**](/technologies) for technology-specific automation and DX improvements, or build custom platform capabilities using [Nx Devkit](/extending-nx/intro/getting-started).

## Where to go from here?

{% cards %}

{% card title="Nx quickstart" description="Dive right in with our quickstart steps to create your first project or add Nx to your existing one." type="documentation" url="/getting-started" icon="RocketLaunchIcon" /%}

{% card title="Explore Technologies" description="Explore Nx's technology integrations and how it can support your specific stack." type="documentation" url="/technologies" icon="CodeBracketIcon" /%}

{% card title="Step by step with our tutorials" description="Learn more about Nx through hands-on tutorials for different technology stacks." type="documentation" url="/getting-started/tutorials" icon="AcademicCapIcon" /%}

{% card title="Learn with our video courses" description="Dive deeper with comprehensive video courses that walk you through Nx concepts." type="documentation" url="/courses" icon="PlayCircleIcon" /%}

{% card title="Dive deep into Nx features" description="Discover all the powerful features that Nx provides to streamline your workflow." type="documentation" url="/features" icon="SparklesIcon" /%}

{% card title="Understand underlying concepts" description="Improve your understanding of the core concepts of how Nx works under the hood." type="documentation" url="/concepts" icon="LightBulbIcon" /%}

{% /cards %}

**Stay up to date** with our latest news by [⭐️ starring us on Github](https://github.com/nrwl/nx), [subscribing to our Youtube channel](https://www.youtube.com/@nxdevtools), [joining our Discord](https://go.nx.dev/community), [subscribing to our monthly tech newsletter](https://go.nrwl.io/nx-newsletter) or follow us [on X](https://x.com/nxdevtools), [Bluesky](https://bsky.app/profile/nx.dev) and [LinkedIn](https://www.linkedin.com/company/nxdevtools).

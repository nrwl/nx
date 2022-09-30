# Intro to Nx

Nx is a smart, fast and extensible build system with first class monorepo support and powerful integrations.

{% personas %}
{% persona type="javascript" title="New Package-Based Repo" url="/getting-started/package-based-repo-tutorial" %}
Create a monorepo with Yarn, NPM or PNPM. Nx makes it fast, but lets you run things your way.

- [Get started with your package-based repo](/getting-started/package-based-repo-tutorial)

{% /persona %}

{% persona type="integrated" title="New Integrated Repo" url="/getting-started/integrated-repo-tutorial" %}

Get a pre-configured setup. Nx configures your favorite frameworks and lets you focus on shipping features.

- [Get started with your integrated repo](/getting-started/integrated-repo-tutorial)

{% /persona %}

{% persona type="lerna" title="Add to an Existing Monorepo" url="/recipe/adding-to-monorepo" %}

Incrementally add Nx to your repo and enjoy faster CI runs and local development. All without modifying your existing setup.

- [Add Nx to an Existing Monorepo](/recipe/adding-to-monorepo)

{% /persona %}

{% persona type="angular" title="Enter Modern Angular" url="/recipe/migration-angular" %}
Enhance your Angular development experience by leveraging its advanced generators and integrations with modern tooling.

- [Switch from the Angular CLI to Nx](/recipe/migration-angular)

{% /persona %}
{% /personas %}

If you know other tools in the monorepo space, here is how Nx compares:

- [Monorepo.tools](https://monorepo.tools)
- [Nx and Turborepo](/more-concepts/turbo-and-nx)

## Nx Has Two Goals

**Speed up your existing workflow with minimum effort.**

- Never rebuild the same code twice by [caching task results](/core-features/cache-task-results).
- Only [run tasks affected by the current PR](/core-features/run-tasks#run-tasks-affected-by-a-pr).
- [Distribute your task execution](/core-features/distribute-task-execution) across multiple agents in CI.

These features can be enabled without touching your existing workflows if you use Nx with a [package-based repo](/concepts/integrated-vs-package-based).

**Provide a first-rate developer experience no matter the size of the repo:**

- Encode common coding tasks in [code generators](/plugin-features/use-code-generators) to make them easily repeatable.
- Offload the maintenance burden of [updating dependencies and configuration files](/core-features/automate-updating-dependencies) to the Nrwl team.
- [Enforce project boundaries](/core-features/enforce-project-boundaries) based on your own organization structure.

These features and the [integrated repository](/concepts/integrated-vs-package-based) mindset allow large teams to collaborate in a single monorepo without getting in each other's way.

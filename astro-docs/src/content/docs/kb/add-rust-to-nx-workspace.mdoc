---
title: Add a Rust Application to an Nx Workspace
description: 'Add Rust crates to an Nx workspace so Cargo builds, tests, and Clippy runs share the same task graph, cache, and CI distribution as your JavaScript projects.'
filter: 'type:Guides'
topics:
  - 'Extending Nx'
---

Nx integrates your Rust crates into its project and task graph, so they benefit from the same Nx
features as the rest of the workspace: task pipelines, local and remote caching, affected
calculation, and distribution on CI. That's what lets you add a Rust-based application to an
existing monorepo.

{% youtube
src="https://youtu.be/lyHbNUdLQhI"
title="Polyglot Nx Monorepo with Rust and TanStack"
/%}

{% github_repository title="Example repository with JavaScript and Rust projects" url="https://github.com/juristr/nx-polyglot-rust" /%}

{% callout title="Point your agent at this page" %}
This article lists the main building blocks for integrating Rust projects into your Nx monorepo.
Point an AI agent at this page and let it handle the setup.
{% /callout %}

## Install the Rust toolchain

Pin the toolchain in the repository so contributors and CI agents resolve the same `rustc` and
Clippy. [mise](https://mise.jdx.dev/) drives rustup for you and installs the pinned version on
checkout:

```toml
# .mise.toml
[tools]
rust = "1.90.0"
```

Any toolchain manager works. Pick one that also runs in CI, so a Rust task you cache locally and the
same task rebuilt on an agent come out of the same compiler.

## Declare the Cargo workspace

Nx doesn't manage the linking of crates. The root `Cargo.toml` lists the members and centralizes
shared versions, including the path dependencies between local crates:

```toml
# Cargo.toml
[workspace]
resolver = "2"
members = ["apps/api", "packages/domain", "packages/store"]

[workspace.dependencies]
serde = { version = "1.0.228", features = ["derive"] }
domain = { path = "packages/domain" }
```

Individual crates then pick those entries up:

```toml
# packages/store/Cargo.toml
[dependencies]
serde.workspace = true
domain.workspace = true
```

Path dependencies are the Cargo counterpart to `workspace:*` in a pnpm workspace, and they're what
Nx reads to draw edges between Rust projects in the graph.

## Add the Rust plugin

Nx has an [extensibility API](/docs/kb/extending-nx) that lets you develop plugins integrating new
technologies into Nx. This example uses the
[`@monodon/rust`](https://github.com/Cammisuli/monodon) community plugin.

```shell
nx add @monodon/rust
```

This command registers the plugin in `nx.json` and gives you executors that wrap the Cargo commands.
`@monodon/rust:build` runs `cargo build`, `:test` runs `cargo test`, `:lint` runs `cargo clippy`,
and `:run` runs `cargo run`.

Generate a new crate with the targets already wired up:

```shell
nx g @monodon/rust:binary apps/api
nx g @monodon/rust:library packages/domain
```

For a crate that already exists, add a [`project.json`](/docs/reference/project-configuration) next
to its `Cargo.toml`:

```json
// apps/api/project.json
{
  "name": "api",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@monodon/rust:build",
      "outputs": ["{options.target-dir}"],
      "options": { "target-dir": "dist/target/api/build" }
    },
    "test": {
      "executor": "@monodon/rust:test",
      "outputs": ["{options.target-dir}"],
      "options": { "target-dir": "dist/target/api/test" }
    },
    "lint": {
      "executor": "@monodon/rust:lint",
      "outputs": ["{options.target-dir}"],
      "options": { "target-dir": "dist/target/api/lint" }
    },
    "run": {
      "continuous": true,
      "executor": "@monodon/rust:run",
      "outputs": ["{options.target-dir}"],
      "options": { "target-dir": "dist/target/api/run" }
    }
  }
}
```

Copy the per-target `target-dir`. Cargo writes into one shared `target/` directory by default, so
`build`, `test`, `lint`, and `run` overwrite each other's artifacts and the cached outputs stop
matching the task that produced them. Giving each target its own directory under
`dist/target/<project>/<target>` keeps them apart.

{% aside type="note" title="The plugin is optional" %}
Any directory with a `project.json` is an Nx project, so a plain `"command": "cargo build -p api"`
target works without installing anything. See
[multi-language support](/docs/features/multi-language-support) for that form, and
[add language support to Nx](/docs/kb/add-language-support) if you want to build your own plugin
instead.
{% /aside %}

## Cache Rust tasks

Rust tasks cache like any other task once you tell Nx what a Rust build depends on. Define the
toolchain and lockfiles as a [named input](/docs/reference/inputs), then apply it to the executors:

```json
// nx.json
{
  "namedInputs": {
    "rust": [
      "default",
      "{workspaceRoot}/Cargo.toml",
      "{workspaceRoot}/Cargo.lock",
      "{workspaceRoot}/rust-toolchain.toml",
      "{workspaceRoot}/.mise.toml"
    ]
  },
  "targetDefaults": {
    "@monodon/rust:build": {
      "cache": true,
      "inputs": ["rust", "^rust"],
      "dependsOn": ["^build"]
    },
    "@monodon/rust:test": {
      "cache": true,
      "inputs": ["rust", "^rust"],
      "dependsOn": ["^build"]
    },
    "@monodon/rust:lint": { "cache": true, "inputs": ["rust", "^rust"] }
  }
}
```

Miss the toolchain file in that list and a Rust version bump replays stale artifacts.
[How caching works](/docs/concepts/how-caching-works) covers the hashing rules in full.

## Run both stacks from one command

With the crates in the graph, a single run covers Cargo, Vite, `tsc`, and ESLint in dependency order:

```shell
nx run-many -t build lint test typecheck
```

Task pipelines cross the language boundary too, because Nx treats every task the same regardless of
what it shells out to. Starting a JavaScript dev server can start the Rust service it talks to:

```json
// apps/web/package.json
{
  "nx": {
    "targets": {
      "dev": {
        "continuous": true,
        "dependsOn": [{ "projects": ["api"], "target": "run" }]
      }
    }
  }
}
```

`nx dev web` now builds the crate's dependencies, starts `api:run`, and starts the web dev server.
[Task pipeline configuration](/docs/concepts/task-pipeline-configuration) has the rest of the syntax.

## Run Rust tasks in CI

CI needs the Rust toolchain before it can run a Cargo task, and the same mise pin covers it:

```yaml
# .github/workflows/ci.yml
- name: Setup Rust with mise
  uses: jdx/mise-action@v3

- name: Set affected SHAs
  uses: nrwl/nx-set-shas@v5

- name: Run Nx tasks
  run: npx nx affected -t lint test build typecheck
```

[`nx affected`](/docs/features/ci-features/affected) reads the Cargo path dependencies, so a change
to `packages/domain` schedules the crates that depend on it and skips the rest of the repository.

To spread those tasks across machines with
[Nx Agents](/docs/features/ci-features/distribute-task-execution), install the toolchain on the
agents as well. A [launch template](/docs/kb/launch-templates) caches the Cargo registry and warms
the dependency download:

```yaml
# .nx/workflows/agents.yaml
launch-templates:
  linux-medium-polyglot:
    resource-class: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node24.14-v1'
    init-steps:
      - name: Checkout
        uses: 'nrwl/nx-cloud-workflows/v6/workflow-steps/checkout/main.yaml'

      - name: Restore Cargo cache
        uses: 'nrwl/nx-cloud-workflows/v6/workflow-steps/cache/main.yaml'
        inputs:
          key: 'Cargo.lock|rust-toolchain.toml|.mise.toml'
          paths: |
            ~/.cargo/git
            ~/.cargo/registry
          base-branch: 'main'

      - name: Install Rust with mise
        uses: 'nrwl/nx-cloud-workflows/v6/workflow-steps/install-mise/main.yaml'

      - name: Install dependencies
        uses: 'nrwl/nx-cloud-workflows/v6/workflow-steps/install-node-modules/main.yaml'

      - name: Fetch Rust dependencies
        script: cargo fetch --locked
```

Point the pipeline at that template and every agent can take any task, Cargo or JavaScript:

```yaml
# .nx/ci-config.yaml
dte:
  distribute-on: 2 linux-medium-polyglot
lifecycle:
  stop-after:
    - lint
    - test
    - build
    - typecheck
```

The [ci-config reference](/docs/reference/nx-cloud/ci-config) lists the remaining keys.

To release the crates from the same workspace, follow
[using Nx Release with Rust](/docs/kb/publish-rust-crates).

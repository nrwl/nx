---
title: Managing configuration files
description: Learn how workspace, project, and tool configuration combine to define Nx projects and tasks.
sidebar:
  order: 1
filter: 'type:Concepts'
---

An Nx workspace contains configuration for Nx and for the tools used by each project.
Nx plugins read both sources and combine them into resolved project configuration.
You can inspect or override that configuration when a project needs different behavior.

## Kinds of configuration

Configuration varies along two dimensions:

- Type: Nx configuration controls task orchestration and caching, while tool configuration controls
  tools such as Vite, ESLint, and TypeScript.
- Scope: Workspace configuration applies broadly, while project configuration applies to one
  project.

A workspace might contain these files:

| Scope     | Nx configuration               | TypeScript configuration        |
| --------- | ------------------------------ | ------------------------------- |
| Workspace | `/nx.json`                     | `/tsconfig.base.json`           |
| Project   | `/packages/myapp/package.json` | `/packages/myapp/tsconfig.json` |

Projects can store Nx-specific settings in the `nx` section of `package.json`.
`project.json` is also supported for project configuration, but most task settings don't need to be
defined in either file when a plugin can infer them.

## How plugins reduce configuration

1. Abstracting away common tooling configuration settings so that if your project is using the tool in the most common way, you won't need to worry about configuration at all. The default settings for any Nx plugin are intended to work without modification for most projects in the community.
2. Allowing you to [provide `targetDefaults`](/docs/kb/reduce-repetitive-configuration) so that the most common settings for projects in your repo can all be defined in one place. Then, only projects that are exceptions need to overwrite those settings. With the judicious application of this method, larger repositories can actually have less lines of configuration after adding Nx than before.

Use `targetDefaults` in `nx.json` for settings shared by matching targets.
Project-level configuration should contain only exceptions or tasks that no plugin can infer.

If you need to track down the value of a specific configuration property (say `runInBand` for `jest` on the `/apps/my-app` project) you need to look in the following locations. The configuration settings are merged with priority being given to the file higher up in the list.

1. In `/apps/my-app/project.json`, the `options` listed under the `test` target.
2. In `/nx.json`, the `targetDefaults` entries matching the `test` target.
3. One of the `test` target options references `/apps/my-app/jest.config.ts`
4. Which extends `/jest.config.ts`

```text
repo/
├── apps/
│   └── my-app/
│       ├── jest.config.ts
│       └── project.json
├── jest.config.ts
└── nx.json
```

```jsonc title="packages/myapp/package.json"
{
  "name": "myapp",
  "nx": {
    "targets": {
      "build": {
        "inputs": ["production", "^production", "{workspaceRoot}/brand/**"],
      },
    },
  },
}
```

The project-level `inputs` value overrides the corresponding inferred or default value for
`myapp:build`.

## Resolve a target configuration

Nx merges target configuration in this order, from least specific to most specific:

1. Configuration inferred by plugins listed in `nx.json`.
1. Matching `targetDefaults` from `nx.json`.
1. Project configuration from `package.json` or `project.json`.

Tool configuration remains the source of truth for the tool itself.
A plugin translates relevant values from that file into Nx target metadata before Nx applies the
Nx-specific overrides.

Run `nx show target <project>:<target>` to inspect the resolved target.
Add `--verbose` to see which file or plugin contributed each value:

```shell
nx show target myapp:build --verbose
```

{% aside type="tip" title="Learn by doing" %}
Follow the [configuring tasks tutorial](/docs/getting-started/tutorials/configuring-tasks) to inspect
and override inferred configuration.
{% /aside %}

For configuration schemas, see [`nx.json` reference](/docs/reference/nx-json) and
[project configuration](/docs/reference/project-configuration).

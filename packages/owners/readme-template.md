<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo-light.svg">
    <img alt="Nx Logo" src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.svg" width="140">
  </picture>
</p>

{{links}}

<hr>

# Nx: Smart Monorepos · Fast Builds

Get to green PRs in half the time. Nx optimizes your builds, scales your CI, and fixes failed PRs. Built for developers and AI agents.

This package is an [Owners plugin for Nx](https://nx.dev/docs/reference/owners/overview). It lets you configure and maintain code owners for the projects in your workspace.

{{content}}

## Use Case

The atomic unit of code in an Nx workspace is a project. Tasks, module boundaries and the Nx graph all train us to conceptualize the workspace as a collection of projects.
The CODEOWNERS file, however, requires you to switch from a project mental model to a more low-level definition based on the folder structure of your workspace.
The @nx/owners plugin enables you to stay in the mental model that your workspace is a collection of projects as you define the ownership rules for your workspace.
Nx will take care of compiling the project ownership rules into file-based ownership rules that GitHub, Bitbucket or GitLab can understand in the CODEOWNERS file.

## Getting Started

Initialize the plugin in your workspace:

```shell
npx nx g @nx/owners:init
```

This registers the `@nx/owners` plugin in `nx.json`, sets up the sync generator, and infers the correct VCS format from your workspace.

After configuring your ownership patterns (see below), generate or update the CODEOWNERS file:

```shell
npx nx sync
```

## Configuration

Ownership is configured in the `owners` property of `nx.json`. The simplest form enables the feature and delegates entirely to `project.json` files:

```json
{
  "owners": true
}
```

For root-level configuration, provide an object:

```json
{
  "owners": {
    "format": "github",
    "patterns": []
  }
}
```

### Root Config Options

| Property     | Type                                | Default                                     | Description                                           |
| ------------ | ----------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `format`     | `"github"` `"gitlab"` `"bitbucket"` | `"github"`                                  | VCS provider format                                   |
| `outputPath` | `string`                            | Based on format (e.g. `.github/CODEOWNERS`) | Path to the generated CODEOWNERS file                 |
| `prefix`     | `string`                            | —                                           | Prefix applied to all owner strings (e.g. `"@MyOrg"`) |
| `patterns`   | `Array`                             | `[]`                                        | Ownership pattern entries (see below)                 |
| `sections`   | `Array`                             | —                                           | GitLab-only sections with optional approvals          |

## Patterns

Each entry in the `patterns` array defines an ownership rule. There are three pattern types:

### Project Patterns

Assign owners to entire projects using [Nx project name patterns](https://nx.dev/recipes/running-tasks/run-tasks-for-specific-projects).

```json
{
  "owners": {
    "patterns": [
      {
        "projects": ["ui-*"],
        "owners": ["@frontend-team"]
      },
      {
        "projects": ["api-*", "data-*"],
        "owners": ["@backend-team"]
      }
    ]
  }
}
```

Generates entries like:

```
/libs/ui-buttons/ @frontend-team
/libs/ui-dropdown/ @frontend-team
/apps/api-gateway/ @backend-team
```

### File Patterns

Assign owners to files matching glob patterns across the entire workspace.

```json
{
  "owners": {
    "patterns": [
      {
        "files": ["*.ts"],
        "owners": ["@typescript-team"]
      },
      {
        "files": ["**/jest.config.ts", "**/tsconfig*.json"],
        "owners": ["@platform-team"]
      }
    ]
  }
}
```

File patterns use the same matching semantics as the generated CODEOWNERS file (gitignore-style):

- A pattern without a `/` matches at any depth: `*.ts` matches every TypeScript file in the workspace, `jest.config.ts` matches the file in any project.
- A leading `/` anchors the pattern to the workspace root: `/tools/**` only matches files under the top-level `tools` directory.
- A trailing `/` matches a directory and everything in it: `docs/` matches any directory named `docs`.
- Dotfiles are included.

This means `"files": ["*"]` is a catch-all that owns every file, which is the shortest way to define a default owner:

```json
{
  "owners": {
    "patterns": [
      {
        "description": "Default",
        "files": ["*"],
        "owners": ["@default-team"]
      },
      {
        "projects": ["space-travel-*"],
        "owners": ["@space-team"]
      }
    ]
  }
}
```

Generates:

```
# Default
* @default-team

/apps/space-travel-shop/ @space-team
```

Projects covered only by such a catch-all pattern count as owned, including for the `ensure-owners` conformance rule.

### Combined Project + File Patterns

Assign owners to specific files scoped to matched projects. When both `projects` and `files` are provided, the file patterns are evaluated relative to each matched project root instead of the workspace root.

```json
{
  "owners": {
    "patterns": [
      {
        "projects": ["ui-*"],
        "owners": ["@frontend-team"]
      },
      {
        "projects": ["ui-*"],
        "files": ["project.json", "tsconfig.json"],
        "owners": ["@ops-team"]
      }
    ]
  }
}
```

Generates:

```
/libs/ui-buttons/ @frontend-team
/libs/ui-buttons/project.json @ops-team
/libs/ui-buttons/tsconfig.json @ops-team

/libs/ui-dropdown/ @frontend-team
/libs/ui-dropdown/project.json @ops-team
/libs/ui-dropdown/tsconfig.json @ops-team
```

This is useful when you want a team to own specific config files across a set of projects without affecting ownership of the rest of the project.

Glob patterns also work in the `files` array:

```json
{
  "projects": ["ui-*"],
  "files": ["**/*.config.json"],
  "owners": ["@config-team"]
}
```

## Project-Level Configuration

Individual projects can define their own ownership rules in `project.json`. These take precedence over root config for the same file patterns.

```json
{
  "name": "ui-buttons",
  "owners": {
    "**/*": ["@ui-buttons-team"],
    "project.json": ["@project-json-owner"]
  }
}
```

The `**/*` pattern assigns a default owner for the entire project, overriding whatever the root config specifies. Specific file patterns (like `project.json`) further override for those paths.

When combined with root-level combined project + file patterns, project-level entries always win for the same file pattern:

```jsonc
// nx.json
{
  "owners": {
    "patterns": [
      { "projects": ["ui-*"], "files": ["project.json"], "owners": ["@ops-team"] }
    ]
  }
}

// libs/ui-buttons/project.json
{
  "name": "ui-buttons",
  "owners": {
    "project.json": ["@ui-buttons-lead"]
  }
}
```

Result for `ui-buttons`:

```
/libs/ui-buttons/project.json @ui-buttons-lead
```

## Advanced Options

### Owner Prefix

Apply a prefix to all owner strings:

```json
{
  "owners": {
    "prefix": "@MyOrg",
    "patterns": [
      {
        "projects": ["ui-*"],
        "owners": ["frontend-team"]
      }
    ]
  }
}
```

Generates `@MyOrg/frontend-team`. Individual patterns can override the prefix or opt out:

```json
{
  "projects": ["shared-*"],
  "owners": ["platform-team"],
  "prefix": "@DifferentOrg"
}
```

```json
{
  "projects": ["external-*"],
  "owners": ["external-user@example.com"],
  "applyPrefix": false
}
```

### Explicitly Unowned Files

Set `owners` to `false` to mark files or projects as explicitly having no owner. These entries are written last in the CODEOWNERS file:

```json
{
  "files": ["**/generated/**"],
  "owners": false
}
```

> Note: Bitbucket does not support `owners: false`.

### Descriptions

Add a `description` to any pattern to include a comment above the generated entry:

```json
{
  "projects": ["ui-*"],
  "owners": ["@frontend-team"],
  "description": "Frontend team owns all UI libraries"
}
```

### GitLab Sections

When using the `gitlab` format, you can group patterns into sections with optional approval requirements:

```json
{
  "owners": {
    "format": "gitlab",
    "sections": [
      {
        "name": "Frontend",
        "defaultOwners": ["@frontend-team"],
        "patterns": [{ "projects": ["ui-*"], "owners": ["@ui-team"] }]
      },
      {
        "name": "Security",
        "numberOfRequiredApprovals": 2,
        "patterns": [{ "files": ["**/auth/**"], "owners": ["@security-team"] }]
      }
    ],
    "patterns": []
  }
}
```

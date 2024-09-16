---
title: Overview of the Nx powerpack-owners Plugin
description: The Nx Powerpack Owners plugin
---

intro to owners

## Setup

1. Activate Powerpack if you haven't already
2. Install the package

3. Configure ownership

{% tabs %}
{% tab label="GitHub" %}

```jsonc {% fileName="nx.json" %}
{
  "owners": {
    "format": "github", // defaults to "github"
    "outputPath": "tools/CODEOWNERS", // defaults to ".github/CODEOWNERS"
    "patterns": [
      {
        "description": "Joe should double check all changes to rust code",
        "projects": ["tag:rust"],
        "owners": ["@joelovesrust"]
      },
      {
        "description": "The Finance team owns these projects",
        "projects": ["finance-*"],
        "owners": ["@finance-team"]
      },
      {
        "description": "Alice, Bob and Cecil work together on these projects",
        "projects": ["admin", "booking", "cart"],
        "owners": ["@alice", "@bob", "@cecil"]
      },
      {
        "description": "CI Workflows",
        "files": [".github/workflows/**/*"],
        "owners": ["@devops"]
      }
    ]
  }
}
```

```jsonc {% fileName="packages/my-project/project.json" %}
{
  "owners": {
    "**/*": ["@ahmed", "@petra"],
    "package.json": ["@ahmed"],
    "README.md": [{
      "owners": "@jared",
      "description": "Jared is very particular about the README file"
    }]
  },
};
```

{% /tab %}
{% tab label="Bitbucket" %}

```shell
yarn add [package]
nx g [package]:ng-add
```

{% /tab %}
{% tab label="GitLab" %}

```shell
pnpm add [package]
nx g [package]:ng-add
```

{% /tab %}
{% /tabs %}

1. Configure CI

Link to `nx sync` concept page
Add `nx sync:check` to the beginning of the CI process
Add `nx sync` as a git push or commit hook

---
title: 'Define Code Ownership at the Project Level'
description: 'Learn how to use Nx Powerpack owners plugin to manage code ownership at the project level and automatically generate CODEOWNERS files for GitHub, Bitbucket, or GitLab.'
---

# Define Code Ownership at the Project Level

{% youtube src="https://youtu.be/mor6urvw-L0" title="Nx Powerpack Codeowners" /%}

This plugin provides [Nx Powerpack](/powerpack) users the ability to configure and maintain code owners for projects in an Nx workspace. Powerpack is available for Nx version 19.8 and higher.

The atomic unit of code in an Nx workspace is a project. Tasks, module boundaries and the Nx graph all train us to conceptualize the workspace as a collection of projects. The CODEOWNERS file, however, requires you to switch from a project mental model to a more low-level definition based on the folder structure of your workspace. The `@nx/owners` plugin enables you to stay in the mental model that your workspace is a collection of projects as you define the ownership rules for your workspace. Nx will take care of compiling the project ownership rules into file-based ownership rules that [GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [Bitbucket](https://support.atlassian.com/bitbucket-cloud/docs/set-up-and-use-code-owners/) or [GitLab](https://docs.gitlab.com/ee/user/project/codeowners/) can understand in the CODEOWNERS file.

## Setup

The `@nx/owners` plugin requires an Nx Powerpack license to function. [Activating Powerpack](/nx-enterprise/activate-powerpack) is a simple process.

{% call-to-action title="Get a License and Activate Powerpack" icon="nx" description="Unlock all the features of the Nx CLI" url="/nx-enterprise/activate-powerpack" /%}

Then, add the Owners plugin to your workspace.

{% link-card title="Owners" type="Nx Plugin" url="/reference/core-api/owners/overview" icon="UserGroupIcon" /%}

## Project or File-based Configuration

The ownership configuration is defined in the `nx.json` file or in individual project configuration files. Nx then uses a [sync generator](/concepts/sync-generators) to automatically compile those settings into a valid CODEOWNERS file for GitHub, Bitbucket or GitLab. See the [plugin documentation](/reference/core-api/owners) for more details.

{% cards smCols="2" mdCols="2" lgCols="2" %}

**Define Project Owners**

**Nx Generates the CODEOWNERS file**

```json {% fileName="nx.json" %}
{
  "owners": {
    "format": "github",
    "patterns": [
      {
        "description": "Joe's Rust projects",
        "projects": ["tag:rust"],
        "owners": ["@joelovesrust"]
      },
      {
        "description": "Finance projects",
        "projects": ["finance-*"],
        "owners": ["@finance-team"]
      },
      {
        "description": "Alphabet soup",
        "projects": ["admin", "books", "cart"],
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

```yaml {% fileName=".github/CODEOWNERS" %}
# Joe's Rust projects
/packages/rust-api @joelovesrust
/packages/experimental-rust @joelovesrust

# Finance projects
/packages/finance-ui @finance-team
/packages/finance-data @finance-team

# Alphabet soup
/packages/admin @alice @bob @cecil
/packages/books @alice @bob @cecil
/packages/cart @alice @bob @cecil

# CI Workflows
.github/workflows/**/* @devops

/packages/my-project/ @ahmed @petra
/packages/my-project/package.json @ahmed
```

```json {% fileName="packages/my-project/project.json" %}
{
  "owners": {
    "**/*": ["@ahmed", "@petra"],
    "package.json": ["@ahmed"]
  },
};
```

{% /cards %}

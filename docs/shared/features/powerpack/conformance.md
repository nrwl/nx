---
title: 'Run Language-Agnostic Conformance Rules'
description: 'Learn how to use Nx Powerpack and Nx Enterprise conformance rules to enforce organizational standards, maintain consistency, and ensure security across your workspace.'
---

# Run Language-Agnostic Conformance Rules

{% youtube src="https://youtu.be/6wg23sLveTQ" title="Nx Powerpack workspace conformance" /%}

The [`@nx/conformance`](/reference/core-api/conformance) plugin allows [Nx Powerpack](/powerpack) and [Nx Enterprise](/enterprise) users to write and apply rules for your entire workspace that help with **consistency**, **maintainability**, **reliability** and **security**. Powerpack is available for Nx version 19.8 and higher.

The conformance plugin allows you to **encode your own organization's standards** so that they can be enforced automatically. Conformance rules can also **complement linting tools** by enforcing that those tools are configured in the recommended way. The rules are written in TypeScript but can be **applied to any language in the codebase** or focus entirely on configuration files.

The plugin also provides the following pre-written rules:

- **Enforce Project Boundaries**: Similar to the Nx [ESLint Enforce Module Boundaries rule](/features/enforce-module-boundaries), but enforces the boundaries on every project dependency, not just those created from TypeScript imports or `package.json` dependencies.
- **Ensure Owners**: Require every project to have an owner defined for the [`@nx/owners` plugin](/reference/core-api/owners)

## Setup

The `@nx/conformance` plugin requires an Nx Powerpack or [Nx Enterprise license](/enterprise) to function. [Activating Powerpack](/nx-enterprise/activate-powerpack) is a simple process.

{% call-to-action title="Get a License and Activate Powerpack or Nx Enterprise" icon="nx" description="Unlock all the features of the Nx CLI" url="/nx-enterprise/activate-powerpack" /%}

Then, add the Conformance plugin to your workspace.

{% link-card title="Conformance" type="Nx Plugin" url="/reference/core-api/conformance/overview" icon="CheckBadgeIcon" /%}

## Configure Conformance Rules

Conformance rules are configured in the `conformance` property of the `nx.json` file. You can use the pre-defined rules or reference [your own custom rule](/reference/core-api/conformance#custom-conformance-rules). See the [plugin documentation](/reference/core-api/conformance) for more details.

```jsonc {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        "rule": "@nx/conformance/enforce-project-boundaries",
        "options": {
          "depConstraints": [
            {
              "sourceTag": "scope:shared",
              "onlyDependOnProjectsWithTags": ["scope:shared"]
            }
          ]
        }
      },
      {
        "rule": "@nx/conformance/ensure-owners",
        "projects": ["!experimental-app"]
      },
      {
        "rule": "./tools/local-conformance-rule.ts"
      }
    ]
  }
}
```

## Enforce Rules with the `nx conformance` and `nx conformance:check` Commands

The `@nx/conformance` plugin enables the `nx conformance` and `nx conformance:check` commands which check all the configured rules. The difference is that `nx conformance` will invoke any fix generators on a configured rule automatically, whereas `nx conformance:check` will only check the current workspace state and show any violations.

Therefore, `nx conformance` is intended to be run locally while working on a feature branch. `nx conformance:check` should be added to the beginning of your CI process so that the conformance rules are enforced for every PR.

{% tabs %}
{% tab label="Without Nx Cloud" %}

```yaml
- name: Enforce all conformance rules
  run: npx nx conformance:check
```

{% /tab %}
{% tab label="Using Nx Cloud" %}

```yaml
- name: Enforce all conformance rules
  run: npx nx-cloud record -- npx nx conformance:check
```

Use `npx nx-cloud record --` to capture the logs for `nx conformance:check` in the Nx Cloud dashboard.

{% /tab %}
{% tab label="Using Nx Cloud (Organizations on the Enterprise Plan)" %}

```yaml
- name: Enforce all conformance rules
  run: npx nx-cloud record -- npx nx-cloud conformance:check
```

Here we are using the `nx-cloud` CLI to run the `conformance:check` command so that we can hook into the power of Conformance rules configured in your Nx Cloud Enterprise organization. Learn more about [conformance rules in Nx Cloud](/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud).

{% /tab %}
{% /tabs %}

If a valid Powerpack license is not available to the workspace (either locally or via Nx Cloud), the `nx conformance` and `nx conformance:check` commands will fail without checking any rules.

## Taking things further with Nx Cloud Enterprise

Organizations on the Nx Cloud Enterprise plan can [publish custom conformance rules](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud) to their Nx Cloud organization without the friction of a custom registry, and then [configure the rules](/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud) to apply to the workspaces in their organization automatically when `nx-cloud conformance` or `nx-cloud conformance:check` is run (note that the `nx-cloud` CLI is used in this case in order to handle the authentication with Nx Cloud).

The Powerpack license will be applied automatically via Nx Cloud in all contexts, and so there is zero setup required for the end developer.

Simply add an appropriate invocation of the `nx-cloud conformance:check` command to your CI process and all cloud configured rules will be applied and merged with any local rules:

```yaml
- name: Enforce all conformance rules
  run: npx nx-cloud record -- npx nx-cloud conformance:check
```

Learn more about [publishing](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud) and [configuring conformance rules in Nx Cloud](/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud).

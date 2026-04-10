# Run Language-Agnostic Conformance Rules

{% youtube src="https://youtu.be/6wg23sLveTQ" title="Nx Powerpack workspace conformance" /%}

The [`@nx/powerpack-conformance`](/nx-api/powerpack-conformance) plugin allows [Nx Powerpack](/powerpack) users to write and apply rules for your entire workspace that help with **consistency**, **maintainability**, **reliability** and **security**. Powerpack is available for Nx version 19.8 and higher.

The conformance plugin allows you to **encode your own organization's standards** so that they can be enforced automatically. Conformance rules can also **complement linting tools** by enforcing that those tools are configured in the recommended way. The rules are written in TypeScript but can be **applied to any language in the codebase** or focus entirely on configuration files.

The plugin also provides the following pre-written rules:

- **Enforce Project Boundaries**: Similar to the Nx [ESLint Enforce Module Boundaries rule](/features/enforce-module-boundaries), but enforces the boundaries on every project dependency, not just those created from TypeScript imports or `package.json` dependencies.
- **Ensure Owners**: Require every project to have an owner defined for the [`@nx/powerpack-owners` plugin](/nx-api/powerpack-owners)

## Setup

The `@nx/powerpack-conformance` plugin requires an Nx Powerpack license to function. [Activating Powerpack](/recipes/installation/activate-powerpack) is a simple process.

{% call-to-action title="Buy a Powerpack License" icon="nx" description="Unlock all the features of Nx" url="https://cloud.nx.app/powerpack/purchase" /%}

Then, add the Conformance plugin to your workspace.

{% link-card title="Conformance" type="Nx Plugin" url="/nx-api/powerpack-conformance" icon="CheckBadgeIcon" /%}

## Configure Conformance Rules

Conformance rules are configured in the `conformance` property of the `nx.json` file. You can use the pre-defined rules or reference [your own custom rule](/nx-api/powerpack-conformance#custom-conformance-rules). See the [plugin documentation](/nx-api/powerpack-conformance) for more details.

```jsonc {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        "rule": "@nx/powerpack-conformance/enforce-project-boundaries",
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
        "rule": "@nx/powerpack-conformance/ensure-owners",
        "projects": ["!experimental-app"]
      },
      {
        "rule": "./tools/local-conformance-rule.ts"
      }
    ]
  }
}
```

## Enforce Rules with the `nx conformance` Command

The `@nx/powerpack-conformance` plugin enables the `nx conformance` command which checks all the configured rules. This command should be added to the beginning of your CI process so that the conformance rules are enforced for every PR.

{% tabs %}
{% tab label="Without Nx Cloud" %}

```yaml
- name: Enforce all conformance rules
  run: npx nx conformance
```

{% /tab %}
{% tab label="Using Nx Cloud" %}

```yaml
- name: Enforce all conformance rules
  run: npx nx-cloud record -- npx nx conformance
```

Use `npx nx-cloud record --` to capture the logs for `nx conformance` in the Nx Cloud dashboard.

{% /tab %}
{% /tabs %}

If there is not a valid Powerpack license in the workspace, the `nx conformance` command will fail without checking any rules.

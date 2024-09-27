---
title: Overview of the Nx powerpack-conformance Plugin
description: The Nx Powerpack Conformance plugin provides the ability to write and apply rules for your workspace
---

The `@nx/powerpack-conformance` plugin allows [Nx Powerpack](/powerpack) users to write and apply rules for your entire workspace that help with **consistency**, **maintainability**, **reliability** and **security**.

The conformance plugin allows you to encode your own organization's standards so that they can be enforced automatically. Conformance rules can also complement linting tools by enforcing that those tools are configured in the recommended way. The rules are written in TypeScript but can be applied to any language in the codebase or focus entirely on configuration files.

The plugin also provides the following pre-written rules:

- [**Enforce Project Boundaries**](#enforce-project-boundaries): Similar to the Nx [ESLint Enforce Module Boundaries rule](/features/enforce-module-boundaries), but enforces the boundaries on every project dependency, not just those created from TypeScript imports or `package.json` dependencies.
- [**Ensure Owners**](#ensure-owners): Require every project to have an owner defined for the [`@nx/powerpack-owners` plugin](/nx-api/powerpack-owners)

{% callout title="This plugin requires an active Nx Powerpack license" %}
In order to use `@nx/powerpack-conformance`, you need to have an active Powerpack license. If you don't have a license or it has expired, the `nx conformance` command will fail.
{% /callout %}

## Set Up @nx/powerpack-conformance

1. [Activate Powerpack](/recipes/installation/activate-powerpack) if you haven't already
2. Install the package

   ```shell
   nx add @nx/powerpack-conformance
   ```

3. Configure Conformance Rules

   Configure the `@nx/powerpack-conformance` plugin in the `nx.json` file or in individual project configuration files. Consult the [Conformance Configuration Reference](#conformance-configuration-reference) section for more details.

4. Run the `nx conformance` command in CI

Add `nx conformance` to the beginning of the CI process.

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

## Conformance Configuration Reference

```jsonc {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        /**
         * Relative path to a local rule implementation or node_module path.
         */
        "rule": "@nx/powerpack-conformance/enforce-project-boundaries",
        /**
         * Rule specific configuration options. (Optional)
         */
        "options": {},
        /**
         * The projects array allows users to opt in or out of violations for specific projects being reported by the current rule.
         * The array can contain any valid matchers for findMatchingProjects(), by default the implied value is ["*"]. (Optional)
         */
        "projects": ["*"]
      }
    ]
  }
}
```

## Provided Conformance Rules

The following rules are provided by Nx along with the `@nx/powerpack-conformance` plugin.

### Enforce Project Boundaries

This rule is similar to the Nx [ESLint Enforce Module Boundaries rule](/features/enforce-module-boundaries), but enforces the boundaries on every project dependency, not just those created from TypeScript imports or `package.json` dependencies.

Set the `rule` property to: `@nx/powerpack-conformance/enforce-project-boundaries`

```json {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        "rule": "@nx/powerpack-conformance/enforce-project-boundaries",
        "options": {
          // Optional
          // Can be a boolean or an object with an array of buildTargetNames
          "requireBuildableDependenciesForBuildableProjects": {
            // Defaults to ["build"]
            "buildTargetNames": ["build", "compile"]
          },
          // Optional
          "ignoredCircularDependencies": [["projectA", "projectB"]],
          // Optional
          "depConstraints": [
            {
              // Must define either `sourceTag` or `allSourceTags`
              "sourceTag": "string",
              "allSourceTags": ["string"],
              // Optional
              "onlyDependOnProjectsWithTags": [],
              // Optional
              "notDependOnProjectsWithTags": []
            }
          ],
          // Optional
          "checkDynamicDependenciesExceptions": []
        }
      }
    ]
  }
}
```

#### Options

| Property                                         | Type                      | Default | Description                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ignoredCircularDependencies                      | _Array<[string, string]>_ | _[]_    | List of project pairs that should be skipped from `Circular dependencies` checks, including the self-circular dependency check. E.g. `['feature-project-a', 'myapp']`. Project name can be replaced by catch all `*` for more generic matches. |
| checkDynamicDependenciesExceptions               | _Array<string>_           | _[]_    | List of imports that should be skipped for `Imports of lazy-loaded libraries forbidden` checks. E.g. `['@myorg/lazy-project/component/*', '@myorg/other-project']`                                                                             |
| requireBuildableDependenciesForBuildableProjects | _boolean_                 | _false_ | Enable to restrict the buildable projects from importing non-buildable libraries                                                                                                                                                               |
| depConstraints                                   | _Array<object>_           | _[]_    | List of dependency constraints between projects                                                                                                                                                                                                |

#### Dependency constraints

The `depConstraints` is an array of objects representing the constraints defined between source and target projects. A
constraint must include `sourceTag` or `allSourceTags`. The constraints are applied with **AND** logical operation - for
a given `source` project the resulting constraints would be **all** that match its tags.

| Property                     | Type            | Description                                                                        |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| sourceTag                    | _string_        | Tag that source project must contain to match the constraint                       |
| allSourceTags                | _Array<string>_ | List of tags the source project must contain to match the constraint               |
| onlyDependOnProjectsWithTags | _Array<string>_ | The source **can depend only** on projects that contain at least one of these tags |
| notDependOnProjectsWithTags  | _Array<string>_ | The source **can not depend** on projects that contain at least one of these tags  |

### Ensure Owners

This rule requires every project to have an owner defined for the [`@nx/powerpack-owners` plugin](/nx-api/powerpack-owners)

Set the `rule` property to: `@nx/powerpack-conformance/ensure-owners`

```json {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        "rule": "@nx/powerpack-conformance/ensure-owners"
      }
    ]
  }
}
```

## Custom Conformance Rules

To write your own conformance rule, specify a relative path to a TypeScript or JavaScript file as the rule name:

```json {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        "rule": "./tools/local-conformance-rule.ts"
      }
    ]
  }
}
```

The rule definition file should look like this:

```ts {% fileName="tools/local-conformance-rule.ts" %}
import { createConformanceRule } from '@nx/powerpack-conformance';

const rule = createConformanceRule({
  name: 'local-conformance-rule-example',
  category: 'security', // `consistency`, `maintainability`, `reliability` or `security`
  reporter: 'project-reporter', // `project-reporter` or `project-files-reporter`
  implementation: async (context) => {
    const { projectGraph, ruleOptions } = context;
    // Your rule logic goes here
    return {
      severity: 'low', // 'high', 'medium' or 'low'
      details: {
        violations: [
          // Return an empty array if the rule passes
          {
            sourceProject: 'my-project',
            message: 'This is an informative error message.',
          },
        ],
      },
    };
  },
});

export default rule;
```

Note that the severity of the error is defined by the rule author and can be adjusted based on the specific violations that are found.

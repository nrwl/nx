# nameAndDirectoryFormat

As of Nx 17, many generators will prompt you to choose how Nx will calculate where the code should be located. You can choose between `as-provided` and `derived`. `as-provided` will be the default in Nx 18. The following flags are deprecated and will be removed in Nx 18: `--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`.

## `as-provided`

This setting makes generators behave in the following way:

- `nx g component my-component` creates a component in the root.
- `nx g component my-component --directory=apps/nested/my-app` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component apps/nested/my-app/my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder

{% callout type="note" title="Must generate inside a project" %}
If the directory specified is not inside a project, an error will be thrown.
{% /callout %}

## `derived`

Choosing `derived` makes Nx behave the way it did before version 17. Nx will use the deprecated flags (`--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`) to calculate where to generate the code.

This makes generators behave in the following way:

- `nx g component my-component` creates a component in the default project.
- `nx g component my-component --project=my-app` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component apps/nested/my-app/my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder

## Skipping the Prompt

You can skip the prompt in two ways:

1. Specify a flag directly in the terminal `nx g component my-component --directory=apps/my-app --nameAndDirectoryFormat=as-provided`
2. Set a default value for that property for every generator that you use.

```jsonc {% fileName="nx.json" %}
{
  "generators": {
    "@nx/node": {
      "application": {
        "nameAndDirectoryFormat": "as-provided"
      },
      "library": {
        "nameAndDirectoryFormat": "as-provided"
      }
    },
    "@nx/react": {
      "application": {
        "nameAndDirectoryFormat": "as-provided"
      },
      "library": {
        "nameAndDirectoryFormat": "as-provided"
      }
    }
    // etc
  }
}
```

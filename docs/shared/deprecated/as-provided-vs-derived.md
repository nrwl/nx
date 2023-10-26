# as-provided vs. derived

Nx is moving toward a more transparent and predictable way of determining where code will be generated when you run a generator. The new behavior is called `as-provided` and will be the only option in Nx 18. With `as-provided`, Nx places the generated code in the exact folder that you specify. The folder can be specified with a `--directory` flag, a fully specified path (i.e. `libs/shared/my-lib`) or using the current working directory that you run the command from.

The old behavior we're calling `derived`, because we tried to figure out the best place to put code for you. The `derived` approach worked for some people, but there were always people that wanted to generate their code in a slightly different location. Accounting for these variations lead to either (1) people repos with a different structure not being able to use these generators or (2) Nx introducing lots of flags to allow people to tweak where code was generated (flags like `--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`).

Until Nx 18, you will be prompted when running a generator to choose which behavior you want to use:

```{% command="nx g lib my-lib --directory=shared/my-lib" path="~/myorg" %}
✔ Which generator would you like to use? · @nx/node:library

>  NX  Generating @nx/node:library

? What should be the project name and where should it be generated? …
❯ As provided:
    Name: my-lib
    Root: shared/my-lib
  Derived:
    Name: shared-my-lib-my-lib
    Root: packages/shared/my-lib/my-lib
```

There are two different kinds of generators that will prompt you to choose between `as-provided` and `derived`:

- Project Generators (applications and libraries)
- Other Code Generators (components and other code)

## Project Generators

As of Nx 16.8.0, generating a project will prompt you to choose how Nx will calculate where the project should be located. You can choose between `as-provided` and `derived`. `as-provided` will be the default in Nx 18.

### `as-provided`

This setting makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/my-lib` folder
- `cd apps/nested/my-app && nx g app my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g app my-app --directory=apps/nested/my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g lib my-lib --directory=libs/shared/ui/my-lib` creates a new library named `my-lib` in the `/libs/shared/ui/my-lib` folder

### `derived`

Choosing `derived` makes Nx behave the way it did before version 16.8.0. Nx will check the `workspaceLayout` property in `nx.json` to determine how it should calculate the path to the new project.

```json
{
  "workspaceLayout": {
    "appsDir": "demos",
    "libsDir": "packages"
  }
}
```

These settings would store apps in `/demos/` and libraries in `/packages/`. The paths specified are relative to the
workspace root.

This makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/demos/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/packages/my-lib` folder
- `nx g app my-app --directory=nested` creates a new application named `nested-my-app` in the `/demos/nested/my-app` folder
- `nx g lib my-lib --directory=shared/ui` creates a new library named `shared-ui-my-lib` in the `/packages/shared/ui/my-lib` folder

If you accidentally generate a project in the wrong folder, use the [move generator](/nx-api/workspace/generators/move) to move it to the correct location.

## Code Generators

As of Nx 17, many generators will prompt you to choose how Nx will calculate where the code should be located. You can choose between `as-provided` and `derived`. `as-provided` will be the default in Nx 18. The following flags are deprecated and will be removed in Nx 18: `--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`.

### `as-provided`

This setting makes generators behave in the following way:

- `nx g component my-component` creates a component in the root.
- `cd apps/nested/my-app && nx g component my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component my-component --directory=apps/nested/my-app` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component apps/nested/my-app/my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder

{% callout type="note" title="Must generate inside a project" %}
If the directory specified is not inside a project, an error will be thrown.
{% /callout %}

### `derived`

Choosing `derived` makes Nx behave the way it did before version 17. Nx will use the deprecated flags (`--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`) to calculate where to generate the code. This behavior will not be available in Nx 18.

This makes generators behave in the following way:

- `nx g component my-component` creates a component in the default project.
- `nx g component my-component --project=my-app` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component apps/nested/my-app/my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder

## Writing Scripts

If you are using a generator in a script or another environment where it can't have an interactive prompt, you can specify the algorithm to use with a command line flag.

- `--projectNameAndRootFormat=as-provided` for project generators
- `--nameAndDirectoryFormat=as-provided` for code generators

## Using Nx Console

You can use [Nx Console](/core-features/integrate-with-editors) for a more intuitive experience running generators.

1. If you right-click a folder and choose `Nx generate`, the `directory` field will be populated with that folder path.
2. As you fill out the generate form, Nx Console will show you a preview of where the new files will be generated.

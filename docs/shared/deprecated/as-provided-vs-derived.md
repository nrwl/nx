---
title: 'As Provided vs. Derived Generator Path Options'
description: 'Learn about the transition from derived to as-provided path options in Nx generators, improving transparency and predictability in code generation.'
---

# As Provided vs. Derived Generator Path Options

Nx is moving toward a more transparent and predictable way of determining where code will be generated when you run a generator. The new behavior is to take generator options _as provided_ and place the generated code in the exact folder that you specify. Nx will only use the new behavior in Nx version 20. The directory can be specified with a `--directory` flag or use a fully specified path (i.e. `libs/shared/my-lib/src/my-component`). The `--directory` flag will be calculated relative to where you run the command.

In the past, Nx had lots of logic to try and _derive_ the best place to put code for you. This approach worked for some people, but there were always people that wanted to generate their code in a slightly different location. Accounting for these variations lead to either (1) people in repos with a different structure not being able to use these generators or (2) Nx introducing lots of flags to allow people to tweak where code was generated (flags like `--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`). It also caused some confusion when code was not generated in the expected location or frustration when the user did not know how to get Nx to derive the right thing.

Here are some of the issues with the `derived` behavior that are addressed with `as-provided`:

- Some generators had multiple flags for the same thing: `directory`, `path`, etc. Going forward, we only use `--directory` across all generators.
- Generators resolved the directory option inconsistently. Some resolved it relative to the workspace root while others resolved it relative to the project's source root. In the future, all generators will resolve the directory option relative to the current working directory. As such, your terminal's path autocomplete will work as expected and you can also `cd` right into the directory you want.
- Nx transformed the provided names to `kebab-case`. In the future, the name will be taken as provided. This allows for users to deviate from the `kebab-case` directory structure. Nx also included the directory in the project name, which lead to verbose names such as `products-product-detail-page`. Now that Nx takes options as provided, names will be as simple as you would like. You can keep it simple for feature projects (.e.g. `home-page`), or name libraries based on their import path like `@my-org/design-system/buttons`. You can do a mix of both, or deviate from this completely. Note that projects still need to have unique names so you might encounter an error when the name you provide is not valid, but you can resolve the conflict however suits your workspace best.

## Using Nx Console

You can use [Nx Console](/getting-started/editor-setup) for an intuitive experience running generators.

1. If you right-click a folder and choose `Nx generate`, the code generation will be run from that folder.
2. As you fill out the generate form, Nx Console will show you a preview of where the new files will be generated.

## Prompting

To mitigate the impact of this change of direction, Nx will prompt you when running most generators until Nx 20. We know changing these habits may take time so this prompt allows you to choose the previous behavior.

```{% command="nx g lib my-lib --directory=shared/my-lib" path="~/myorg" %}
✔ Which generator would you like to use? · @nx/node:library

NX  Generating @nx/node:library

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

Your intent is your intent. However, the commands you write and run are based on how you think Nx will act. Nx used to derive the location of your code, but Nx will not in the future. In the future for the reasons stated above, Nx will _only_ take options as provided so you should no longer expect Nx to derive the location. We know it will take time to get used to the new way Nx calculates generated code paths and names.

## Project Generators

As of Nx 16.8.0, generating a project will prompt you to choose how Nx will calculate where the project should be located. For now, you can choose between `as-provided` and `derived` but `as-provided` will be the only option in Nx 20. The CLI flag to choose between the two algorithms for project generators is `--projectNameAndRootFormat`.

### Generate Paths and Names `as-provided`

This setting makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/my-lib` folder
- `cd apps/nested/my-app && nx g app my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g app my-app --directory=apps/nested/my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g lib my-lib --directory=libs/shared/ui/my-lib` creates a new library named `my-lib` in the `/libs/shared/ui/my-lib` folder

### Use the Old `derived` Paths and Names

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

If you accidentally generate a project in the wrong folder, use the [move generator](/reference/core-api/workspace/generators/move) to move it to the correct location.

## Code Generators

As of Nx 17, code generators such as `component`, `service`, and others will prompt you to choose whether or not Nx will derive the location based on your options or not. In Nx 20, Nx will take the generator options as provided. The following flags are deprecated and will be removed in Nx 20: `--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`. The CLI flag to choose between the two algorithms for code generators is `--nameAndDirectoryFormat`.

### Generate Paths and Names `as-provided`

This setting makes generators behave in the following way:

- `nx g component my-component` creates a component in the root.
- `cd apps/nested/my-app && nx g component my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component my-component --directory=apps/nested/my-app` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component apps/nested/my-app/my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder

{% callout type="note" title="Must generate inside a project" %}
If the directory specified is not inside a project, an error will be thrown.
{% /callout %}

### Use the Old `derived` Paths and Names

Choosing `derived` makes Nx behave the way it did before version 17. Nx will use the deprecated flags (`--project`, `--flat`, `--pascalCaseFiles`, `--pascalCaseDirectory`, `--fileName`) to calculate where to generate the code. This behavior will not be available in Nx 20.

This makes generators behave in the following way:

- `nx g component my-component` creates a component in the default project.
- `nx g component my-component --project=my-app` creates a new component named `my-component` in the `/apps/nested/my-app` folder
- `nx g component apps/nested/my-app/my-component` creates a new component named `my-component` in the `/apps/nested/my-app` folder

## Writing Scripts

If you are using `nx generate` in a script or another environment where it cannot have an interactive prompt, the command will still behave as it did before. You should opt into the new behavior and change the command with a command line flag.

```diff
- nx g lib lib1 --no-interactive`
+ nx g lib lib1 --directory libs/lib1 --projectNameAndRootFormat as-provided --no-interactive
- nx g c button --project lib1 --no-interactive
+ nx g c button --directory libs/lib1/src/lib/button --nameAndDirectoryFormat as-provided --no-interactive
```

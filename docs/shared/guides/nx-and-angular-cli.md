# Nx and the Angular CLI

{% callout type="check" title="Nx and AngularCLI commands are interchangeable" %}
If you add Nx to an Angular CLI project, `ng` and `nx` are interchangeable (they invoke the same command, which is `nx`). So anywhere you see `"nx build"` or `"nx affected"`, you can also use `"ng build"` or `"ng affected"`.
{% /callout %}

Nx integrates well with the Angular CLI:

- It decorates the Angular CLI. After adding Nx to your workspace, running `ng` will run the wrapped Angular CLI that goes through Nx. Almost everything will work the same way but a lot faster. There are some differences and they are explained below.
- It supports all Angular Devkit builders and schematics.
- It supports using `angular.json` to configure projects and their targets.
- Nx Console works with Angular CLI projects.

This works so well that often folks don't even know they use Nx.

## Angular CLI has some limitations, and Nx addresses them.

### angular.json

Nx supports using `angular.json` to configure projects and their targets, but it comes with a few limitations. For instance, `angular.json` can be many thousands of lines long for large workspaces.

What we recommend instead is to split `angular.json` into multiple `project.json` files (one for each project). This is how you do it:

- Change the version number in `angular.json` to `2`
- Run `nx format`
- Run `nx generate @nrwl/workspace:convert-to-nx-project --all=true`

{% callout type="check" title="Nx and AngularCLI are compatible" %}
But regardless of whether you use `angular.json` or `project.json`, the configuration remains the same. So anything written about `project.json` applies to `angular.json` in the same way. For instance, everything in [project.json](/reference/project-configuration) and [nx.json](/reference/nx-json) applies to `angular.json` in the same way.
{% /callout %}

Note that even though the configuration is split, everything works the same way. All migrations and schematics that expect a single `angular.json` file, will receive a single file. Nx is smart, so it merges all the files in memory to make those migrations and schematics work.

### 'ng update' and 'nx migrate'

If you haven't used Nx before and used the Angular CLI, you probably ran `ng update`. What is the difference?

`nx migrate` is a much improved version of `ng update`. It runs the same migrations, but allows you to:

- Rerun the same migration multiple times.
- Reorder migrations.
- Skip migrations.
- Fix migrations that "almost work".
- Commit a partially migrated state.
- Change versions of packages to match org requirements.

And, in general, it is a lot more reliable for non-trivial workspaces. Why?

`ng update` tries to perform migration in a single go, automatically. This doesn't work for most non-trivial workspaces.

- `ng update` doesn't separate updating `package.json` from updating the source code of the repo. It all happens in a single go. This often fails for non-trivial workspaces or for organizations that have a custom npm registry, where you might want to use a different version of a package.
- `ng update` relies on `peerDependencies` to figure out what needs to be updated. Many third-party plugin don't have `peerDependencies` set correctly.
- When using `ng update` it is difficult to execute one migration at a time. Sometimes you want to patch things up after executing a migration.
- When using `ng update` it's not possible to fix almost-working migrations. We do our best but sometimes we don't account for the specifics of a particular workspace.
- When using `ng update` it's not possible to commit a partially-migrated repo. Migration can take days for a large repo.
- When using `ng update` it's not possible to rerun some of the migrations multiple times. This is required because you can rebase the branch multiple times while migrating.

The Nx core team have gained a lot of experience migrating large workspaces over the last 5 years, and `nx migrate` has been consistently a lot more reliable and easier to use. It has also been a lot easier to implement migrations that work with `nx migrate` comparing to `ng update`. As a result, folks building React and Node applications with Nx have had better experience migrating because Angular folks use `ng update` out of habit, instead of using the command that works better.

**Starting with Nx 11, you can migrate workspaces only using `nx migrate`**. To reiterate: `nx migrate` runs the migrations written by the Angular CLI team the same way `ng update` runs them. So everything should still work. You just get more control over how it works.

If you still want to run `ng update`, you can do it as follows: `FORCE_NG_UPDATE=true nx update mypackage`.

### 'ng add'

`ng add` is not natively supported by Nx. We want to have a consistent package install experience for developers who are working with Angular or non-Angular packages.

Instead, we recommend running:

```shell
npm install [package] && nx g [package]:ng-add
```

Replace `[package]` with the name of the package you're trying to add.

## More Info

If you'd like a better understanding of the similarities, differences and trade-offs, we have a detailed comparison of the two tools here: [Angular CLI and Nx - Why?](https://blog.nrwl.io/angular-cli-and-nx-why-df160946888f)

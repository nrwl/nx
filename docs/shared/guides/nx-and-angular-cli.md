# Nx and the Angular CLI

It is easy to switch from using the Angular CLI to using Nx.

- Nx supports all Angular Devkit builders and schematics.
- Nx automatically splits the `angular.json` file into separate `project.json` files for each project.
- No need to change your existing folder structure.

## angular.json vs. project.json

Nx configures projects and their targets in a format similar to `angular.json`. However, instead of storing the configuration for every project in a single large `angular.json` file at the root, the configuration is split into multiple `project.json` files that are located in each project folder. Smaller, focused config files allow you to quickly find the configuration that is relevant for the project you are working on and editing a single project configuration does not cause the `nx affected` command to re-run all the tests in the repo. This conversion is done for you automatically when you run `nx init`.

Note that even though the configuration is split, everything works the same way. Migrations and schematics written with the Angular devkit that expect a single `angular.json` file, will receive a single file. Nx is smart, so it merges all the files in memory to make those migrations and schematics work.

## 'ng update' vs. 'nx migrate'

If you haven't used Nx before and used the Angular CLI, you probably ran `ng update`. What is the difference?

`nx migrate` is a much improved version of `ng update`. It runs the same migrations, but allows you to:

- Rerun the same migration multiple times.
- Reorder migrations.
- Skip migrations.
- Fix migrations that "almost work".
- Commit a partially migrated state.
- Change versions of packages to match org requirements.
- [Opt out of Angular updates when updating Nx versions](/recipes/other/advanced-update#choosing-optional-package-updates-to-apply) as long as [the Angular version is still supported](/packages/angular/documents/angular-nx-version-matrix)

`nx migrate` does this by splitting the process into two steps. `nx migrate latest` creates a `migrations.json` file with a list of all the migrations that are needed by Nx, Angular and other packages. You then have a chance to modify that file before running `nx migrate --run-migrations` to actually execute those migrations.

To reiterate: `nx migrate` runs the migrations written by the Angular team the same way `ng update` runs them. So everything should still work. You just get more control over how it works.

## 'ng add'

`ng add` is not natively supported by Nx. We want to have a consistent package install experience for developers who are working with Angular or non-Angular packages.

Instead, we recommend running:

```shell
npm install [package] && nx g [package]:ng-add
```

Replace `[package]` with the name of the package you're trying to add.

## Misconception: Nx is Just for Monorepos

Nx can improve your developer experience without rearranging folders in your workspace and without the need to have multiple apps in the same repo. The changes outlined in the previous sections are the only modifications to your existing workflow that are needed, then Nx opens the door to many more DX improvements.

Without any additional changes, Nx provides task caching, automated architecture diagrams and IDE integrations. Then, with some minor configuration, you can add task pipelines, distributed caching and CI improvements. To take full advantage of these features, you can begin to separate your large application into self-contained libraries. For an introduction to this process, complete the [Angular Standalone Tutorial](/tutorials/angular-standalone-tutorial).

## More Info

If you'd like a better understanding of the similarities, differences and trade-offs, we have a detailed comparison of the two tools here: [Angular CLI and Nx - Why?](https://blog.nrwl.io/angular-cli-and-nx-why-df160946888f)

---
title: File Based Versioning (Version Plans)
description: Learn how to use Nx Release's version plans feature to track version bumps in separate files, similar to Changesets or Beachball, allowing for more flexible versioning workflows.
---

# File Based Versioning ("Version Plans")

Tools such as Changesets and Beachball helped popularize the concept of tracking the desired semver version bump in a separate file on disk (which is committed to your repository alongside your code changes). This has the advantage of separating the desired bump from your git commits themselves, which can be very useful if you are not able to enforce that all contributors follow a strict commit message format ([e.g. Conventional Commits](/recipes/nx-release/automatically-version-with-conventional-commits)), or if you want multiple commits to be included in the same version bump and therefore not map commits 1:1 with changelog entries.

Nx release supports file based versioning as a first class use-case through a feature called "version plans". The idea behind the name is that you are creating a _plan_ to version; a plan which will be _applied_ sometime in the future when you actually invoke the `nx release` CLI or programmatic API. Therefore you can think about version plans as having two main processes:

- creating version plans and
- applying version plans.

We will cover both in this recipe, but first we need to enable the feature itself.

## Enable Version Plans

To enable version plans as a feature in your workspace, set `release.versionPlans` to `true` in `nx.json`:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "versionPlans": true
    // other release config such as projects to include in releases etc
    // projects: ["packages/**/*"]
    // ...
  }
}
```

You can also enable or disable this for specific release groups by setting the property at the group level if you don't want to apply it to all matching projects in your workspace.

## Create Version Plans

Version plan files live in the `.nx/version-plans/` directory within your workspace (which needs to be tracked by git, so ensure that you are not ignoring the whole `.nx` directory, and instead only the `.nx/workspace-data` and `.nx/cache` directories).

The files themselves are written in markdown (`.md` files) and contain Front Matter YAML metadata at the top of the file. The Front Matter YAML section is denoted via triple dashes `---` at the start and end of the section. For example:

```md {% fileName=".nx/version-plans/version-plan-1723732065047.md" %}
---
#
# FRONT MATTER YAML HERE
#
---

#

# Regular markdown here

#
```

We leverage the Front Matter YAML section to store a mapping of project or release group names to desired semver bump types. The general markdown section represents the description of the change(s) made that will be used in any relevant `CHANGELOG.md` files that are generated later at release time.

For example, the following Front Matter YAML section specifies that the `my-app` project should have a `minor` version bump and describes the changes (again, note that there are no constraints on the format of the description, it can contain multiple lines, paragraphs etc):

```md {% fileName=".nx/version-plans/version-plan-1723732065047.md" %}
---
my-app: minor
---

This is an awesome change!

A new paragraph describing the change in greater detail. All of this will be included in the CHANGELOG.md. All of this structure within the markdown section is optional and flexible.
```

Any number of different projects and different desired semver bumps can be combined within a single version plan file (which represents one change and therefore changelog entry, if applicable). For example:

```md {% fileName=".nx/version-plans/version-plan-1723732065047.md" %}
---
my-app: minor
my-lib: patch
release-group-a: major
---

One change that affects multiple projects and release groups.
```

The project or release group names specified in the Front Matter YAML section must match the names of the projects and/or release groups in your workspace. If a project or release group is not found, an error will be thrown when applying the version plan as part of running `nx release`.

{% callout type="note" title="Single Version for All Packages" %}

If you use a single version for all your packages (see [Release projects independetly](/recipes/nx-release/release-projects-independently)) your version plan file might look like this:

```md {% fileName=".nx/version-plans/version-plan-1723732065047.md" %}
---
__default__: minor
---

This is an awesome change!
```

While you could still specify the name of the project it is redundant in this case because all projects will be bumped to the same version.

{% /callout %}

Because these are just files, they can be created manually or by any custom scripts you may wish to write. They simply have to follow the guidance above around structure, location (`./.nx/version-plans/`) and naming (`.md` extension). The exact file name does not matter, it just needs to be unique within the `.nx/version-plans/` directory.

To make things easier, Nx release comes with a built in command to help you generate valid version plan files:

```shell
nx release plan
```

When you run this command you will receive a series of interactive prompts which guide you through the process of creating a version plan file. It will generate a unique name for you and ensure it is written to the correct location.

## Apply Version Plans at Release Time

Using version plans does not change how versioning, changelog generation and publishing is invoked, you can still use the `nx release` CLI or programmatic API as you would for any other versioning strategy.

The only difference is that Nx release will know to reference your version plan files as the source of truth for the desired version bumps. You still retain the same control around resolving the current version (disk vs registry vs git tags) however you want, and other configuration options around things like git operations are all still applicable.

When you run `nx release` or use the programmatic API, Nx will look for version plan files in the `.nx/version-plans/` directory and apply the desired version bumps to the projects and release groups specified in the Front Matter YAML section of each file. If a project or release group is not found, an error will be thrown and the release will not proceed. Once a particular version plan has been applied it will be deleted from the `.nx/version-plans/` directory so that it does not inadvertently get applied again in the future. The deleted file will be staged and committed alongside your other changed files that were modified directly as part of the release command (depending on your Nx release configuration).

## Ensure That Version Plans Exist for Relevant Changes

When making changes to your codebase and using version plans as your versioning strategy it is likely that you will want to ensure that a version plan file exists for the changes you are making.

Attempting to keep track of this manually as a part of pull request reviews can be error prone and time consuming, therefore Nx release provides a `nx release plan:check` command which can be used to ensure that a version plan file exists for the changes you are making.

```shell
nx release plan:check
```

Running this command will analyze the changed files (supporting the same options you may be familiar with from `nx affected`, such as `--base`, `--head`, `--files`, `--uncommitted`, etc) and then determine which projects have been "touched" as a result. Note that it is specifically touched projects, and not affected in this case, because only directly changed projects are relevant for versioning. The side-effects of versioning independently released dependents are handled by the release process itself (controllable via the `version.generatorOptions.updateDependents` option).

<!-- Prettier will mess up the end tag of the callout causing it to capture all content that follows it -->
<!-- prettier-ignore-start -->

{% callout type="note" title="Running release plan:check in CI" %}
As mentioned, `nx release plan:check` supports the same options as `nx affected` for determining the range of commits to consider. Therefore, in CI, you must also ensure that the base and head are set appropriately just like you would for `nx affected`.

For GitHub Actions, we provide a utility action to do this for you:

```yaml
# ...other steps
- uses: nrwl/nx-set-shas@v4
# ...other steps including the use of `nx release plan:check`
```

For CircleCI, you can reference our custom orb as a step:

```yaml
# ...other steps
- nx/set-shas
# ...other steps including the use of `nx release plan:check`
```

You can read more about these utilities and why they are needed on their respective READMEs:

- https://github.com/nrwl/nx-set-shas?tab=readme-ov-file#background
- https://github.com/nrwl/nx-orb#background
{% /callout %}
<!-- prettier-ignore-end -->

Nx release will compare the touched projects to the projects and release groups that are specified in the version plan files in the `.nx/version-plans/` directory. If a version plan file does not exist, the command will print an error message and return a non-zero exit code, which can be used to fail CI builds or other automation.

By default, all files that have changed are considered, but you may not want all files under a project to require a version plan be created for them. For example, you may wish to ignore test only files from consideration from this check. The way you can achieve this is by setting version plans to be a configuration object instead of a boolean, and set the `ignorePatternsForPlanCheck` property to an array of glob patterns that should be ignored when checking for version plans. For example:

```jsonc
{
  "release": {
    "versionPlans": {
      "ignorePatternsForPlanCheck": ["**/*.spec.ts"]
    }
  }
}
```

To see more details about the changed files that were detected and the filtering logic that was used to determine the ultimately changed projects behind the scenes, you can pass `--verbose` to the command:

```shell
nx release plan:check --verbose
```

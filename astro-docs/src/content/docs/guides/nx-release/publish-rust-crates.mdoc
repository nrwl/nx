---
title: Using Nx Release with Rust
description: Learn how to version Rust libraries, generate changelogs, and publish Rust crates in a monorepo using Nx Release with a step-by-step guide.
---

# Using Nx Release with Rust

This recipe guides you through versioning Rust libraries, generating changelogs, and publishing Rust crates in a monorepo with Nx Release.

{% github-repository url="https://github.com/JamesHenry/release-js-and-rust" /%}

{% callout type="caution" title="Currently requires legacy versioning" %}
In Nx v21, the implementation details of versioning were rewritten to enhance flexibility and allow for better cross-ecosystem support. An automated migration was provided in Nx v21 to update your configuration to the new format when running `nx migrate`.

During the lifecycle of Nx v21, you can still opt into the old versioning by setting `release.version.useLegacyVersioning` to `true`, which will keep the original configuration structure and behavior. In Nx v22, the legacy versioning implementation will be removed entirely, so this should only be done temporarily to ease the transition.

Importantly, this recipe currently requires the use of legacy versioning, because the `@monodon/rust` plugin does not yet provide the necessary `VersionActions` implementation to support the new versioning behavior. This will be added in a minor release of Nx v21 and this recipe will be updated accordingly.
{% /callout %}

## Initialize Nx Release in Your Workspace

### Install Nx

Ensure that Nx is installed in your monorepo. Check out the [Installation docs](/getting-started/installation) for instructions on created a new Nx workspace or adding Nx to an existing project.

### Add the @monodon/rust plugin

The [`@monodon/rust` package](https://github.com/Cammisuli/monodon) is required for Nx Release to manage and release Rust crates. Add it if it is not already installed:

```shell
nx add @monodon/rust
```

### Configure Projects to Release

Nx Release uses Nx's powerful [Project Graph](/features/explore-graph) to understand your projects and their dependencies.

If you want to release all of the projects in your workspace, such as when dealing with a series of Rust crates, no configuration is required.

If you have a mixed workspace in which you also have some applications, e2e testing projects or other things you don't want to release, you can configure `nx release` to target only the projects you want to release.

Configure which projects to release by adding the `release.projects` property to nx.json. The value is an array of strings, and you can use any of the same specifiers that are supported by `nx run-many`'s [projects filtering](/reference/core-api/nx/documents/run-many), such as explicit project names, Nx tags, directories and glob patterns, including negation using the `!` character.

For example, to release just the projects in the `crates` directory:

```jsonc nx.json
{
  "release": {
    "projects": ["crates/*"],
    "version": {
      // Legacy versioning is currently required for the @monodon/rust plugin, see the note above for more details
      "useLegacyVersioning": true
    }
  }
}
```

## Create the First Release

The first time you release with Nx Release in your monorepo, you will need to use the `--first-release` option. This tells Nx Release not to expect the existence of any git tags, changelog files, or published packages.

{% callout type="info" title="Use the --dry-run option" %}
The `--dry-run` option is useful for testing your configuration without actually creating a release. It is always recommended to run Nx Release once with `--dry-run` first to ensure everything is configured correctly.
{% /callout %}

To preview your first release, run:

```shell
nx release --first-release --dry-run
```

### Pick a New Version

Nx Release will prompt you to pick a version bump for all the crates in the release. By default, all crate versions are kept in sync, so the prompt only needs to be answered one time. If needed, you can [configure Nx to release projects independently](/recipes/nx-release/release-projects-independently).

```text {% command="nx release --first-release --dry-run" %}

NX   Running release version for project: pkg-1

pkg-1 🔍 Reading data for crate "pkg-1" from crates/crates/pkg-1/Cargo.toml
pkg-1 📄 Resolved the current version as 0.1.0 from crates/pkg-1/Cargo.toml
? What kind of change is this for the 3 matched projects(s)? …
❯ major
  premajor
  minor
  preminor
  patch
  prepatch
  prerelease
  Custom exact version
```

### Preview the Results

After this prompt, the command will finish, showing you the preview of changes that would have been made if the `--dry-run` option was not passed.

```text {% command="nx release --first-release --dry-run" %}

NX   Running release version for project: pkg-1

pkg-1 🔍 Reading data for crate "pkg-1" from crates/crates/pkg-1/Cargo.toml
pkg-1 📄 Resolved the current version as 0.1.0 from crates/pkg-1/Cargo.toml
✔ What kind of change is this for the 3 matched projects(s)? · patch
pkg-1 ✍️  New version 0.1.1 written to crates/crates/pkg-1/Cargo.toml

NX   Running release version for project: pkg-2

pkg-2 🔍 Reading data for crate "pkg-2" from crates/crates/pkg-2/Cargo.toml
pkg-2 📄 Resolved the current version as 0.1.0 from crates/pkg-2/Cargo.toml
pkg-2 ✍️  New version 0.1.1 written to crates/crates/pkg-2/Cargo.toml

NX   Running release version for project: pkg-3

pkg-3 🔍 Reading data for crate "pkg-3" from crates/crates/pkg-3/Cargo.toml
pkg-3 📄 Resolved the current version as 0.1.0 from crates/pkg-3/Cargo.toml
pkg-3 ✍️  New version 0.1.1 written to crates/crates/pkg-3/Cargo.toml

UPDATE crates/pkg-1/Cargo.toml [dry-run]

  [package]
  name = "pkg-1"
- version = "0.1.0"
+ version = "0.1.1"
  edition = "2021"


UPDATE crates/pkg-2/Cargo.toml [dry-run]

  [package]
  name = "pkg-2"
- version = "0.1.0"
+ version = "0.1.1"
  edition = "2021"


UPDATE crates/pkg-3/Cargo.toml [dry-run]

  [package]
  name = "pkg-3"
- version = "0.1.0"
+ version = "0.1.1"
  edition = "2021"


NX   Updating Cargo.lock file


NX   Staging changed files with git


NX   Previewing an entry in CHANGELOG.md for v0.1.1


CREATE CHANGELOG.md [dry-run]
+ ## 0.1.1 (2024-02-29)
+
+ This was a version bump only, there were no code changes.


NX   Staging changed files with git


NX   Committing changes with git


NX   Tagging commit with git


NX   Skipped publishing packages.


NOTE: The "dryRun" flag means no changes were made.
```

### Run Without `--dry-run`

If the preview looks good, run the command again without the `--dry-run` option to actually create the release.

```shell
nx release --first-release
```

The command will proceed as before, prompting for a version bump and showing a preview of the changes. However, this time, it will prompt you to publish the crates to the remote registry. If you say no, the publishing step will be skipped. If you say yes, the command will publish the crates to https://crates.io.

```text {% command="nx release --first-release" %}
...

✔ Do you want to publish these versions? (y/N) · true

NX   Running target nx-release-publish for 3 projects:

- pkg-1
- pkg-2
- pkg-3

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

(...cargo publish output here...)

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target nx-release-publish for 3 projects

```

## Manage Git Operations

By default, Nx Release will stage all changes it makes with git. This includes updating `Cargo.toml` files, creating changelog files, and updating the `Cargo.lock` file. After staging the changes, Nx Release will commit the changes and create a git tag for the release.

### Customize the Commit Message and Tag Pattern

The commit message created by Nx Release defaults to 'chore(release): publish {version}', where `{version}` will be dynamically interpolated with the relevant value based on your actual release, but can be customized with the `release.git.commitMessage` property in nx.json.

The structure of the git tag defaults to `v{version}`. For example, if the version is `1.2.3`, the tag will be `v1.2.3`. This can be customized by setting the `release.releaseTagPattern` property in nx.json.

For this same example, if you want the commit message to be 'chore(release): 1.2.3' and the tag to be `release/1.2.3`, you would configure nx.json like this:

```json nx.json
{
  "release": {
    "releaseTagPattern": "release/{version}",
    "git": {
      "commitMessage": "chore(release): {version}"
    }
  }
}
```

When using release groups in which the member projects are versioned together, you can also leverage `{releaseGroupName}` and it will be interpolated appropriately in the commit/tag that gets created for that release group.

## Future Releases

After the first release, the `--first-release` option will no longer be required. Nx Release will expect to find git tags and changelog files for each package.

Future releases will also generate entries in `CHANGELOG.md` based on the changes since the last release. Nx Release will parse the `feat` and `fix` type commits according to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification and sort them into appropriate sections of the changelog. An example of these changelogs can be seen on the [Nx releases page](https://github.com/nrwl/nx/releases).

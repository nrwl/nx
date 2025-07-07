---
title: Get Started with Nx Release
description: Learn how to use Nx Release to version packages, generate changelogs, and publish packages in your JavaScript monorepo with a step-by-step guide.
---

# Get Started with Nx Release

This recipe guides you through versioning packages, generating changelogs, and publishing packages in a JavaScript monorepo with Nx Release.

{% link-card title="Free Course: Versioning and Releasing NPM packages with Nx" type="external" url="https://www.epicweb.dev/tutorials/versioning-and-releasing-npm-packages-with-nx" icon="/documentation/shared/images/nx-release-course-logo.webp" /%}

## Initialize Nx Release in Your Workspace

### Install Nx

Ensure that Nx is installed in your monorepo. Check out the [Installation docs](/getting-started/installation) for instructions on created a new Nx workspace or adding Nx to an existing project.

### Add the JavaScript Plugin

The [`@nx/js` package](/technologies/typescript/introduction) is required for Nx Release to manage and release JavaScript packages. Add it if it is not already installed:

```shell {% skipRescope=true %}
nx add @nx/js
```

### Configure Projects to Release

Nx Release uses Nx's powerful [Project Graph](/features/explore-graph) to understand your projects and their dependencies.

If you want to release all of the projects in your workspace, such as when dealing with a series of npm library packages, no configuration is required.

If you have a mixed workspace in which you also have some applications, e2e testing projects or other things you don't want to release, you can configure `nx release` to target only the projects you want to release.

Configure which projects to release by adding the `release.projects` property to nx.json. The value is an array of strings, and you can use any of the same specifiers that are supported by `nx run-many`'s [projects filtering](/reference/core-api/nx/documents/run-many), such as explicit project names, Nx tags, directories and glob patterns, including negation using the `!` character.

For example, to release just the projects in the `packages` directory:

```json nx.json
{
  "release": {
    "projects": ["packages/*"]
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

Nx Release will prompt you to pick a version bump for all the packages in the release. By default, all package versions are kept in sync, so the prompt only needs to be answered one time. If needed, you can [configure Nx to release projects independently](/recipes/nx-release/release-projects-independently).

```text {% command="nx release --first-release --dry-run" %}
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

pkg-1 📄 Resolved the current version as 0.0.1 from manifest: packages/pkg-1/package.json
pkg-1 ❓ Applied semver relative bump "major", from the prompted specifier, to get new version 1.0.0
pkg-1 ✍️ New version 1.0.0 written to manifest: packages/pkg-1/package.json

 NX   Running release version for project: pkg-2

pkg-2 📄 Resolved the current version as 0.0.1 from manifest: packages/pkg-2/package.json
pkg-2 ❓ Applied version 1.0.0 directly, because the project is a member of a fixed release group containing pkg-1
pkg-2 ✍️ New version 1.0.0 written to manifest: packages/pkg-2/package.json

 NX   Running release version for project: pkg-3

pkg-3 📄 Resolved the current version as 0.0.1 from manifest: packages/pkg-3/package.json
pkg-3 ❓ Applied version 1.0.0 directly, because the project is a member of a fixed release group containing pkg-1
pkg-3 ✍️ New version 1.0.0 written to manifest: packages/pkg-3/package.json

UPDATE packages/pkg-1/package.json [dry-run]

    "name": "@myorg/pkg-1",
-   "version": "0.0.1",
+   "version": "0.0.2",
    "dependencies": {
      "tslib": "^2.3.0",
-     "@myorg/pkg-2": "0.0.1"
+     "@myorg/pkg-2": "0.0.2"
    },

 UPDATE packages/pkg-2/package.json [dry-run]

    "name": "@myorg/pkg-2",
-   "version": "0.0.1",
+   "version": "0.0.2",
    "dependencies": {

 UPDATE packages/pkg-3/package.json [dry-run]

    "name": "@myorg/pkg-3",
-   "version": "0.0.1",
+   "version": "0.0.2",
    "dependencies": {


NX   Updating npm lock file


NX   Staging changed files with git


NOTE: The "dryRun" flag means no changes were made.

NX   Previewing an entry in CHANGELOG.md for v0.0.2


CREATE CHANGELOG.md [dry-run]
+ ## 0.0.2 (2024-01-23)
+
+ This was a version bump only, there were no code changes.

NX   Staging changed files with git


NOTE: The "dryRun" flag means no changelogs were actually created.

NX   Committing changes with git


NX   Tagging commit with git

Skipped publishing packages.
```

### Run Without `--dry-run`

If the preview looks good, run the command again without the `--dry-run` option to actually create the release.

```shell
nx release --first-release
```

The command will proceed as before, prompting for a version bump and showing a preview of the changes. However, this time, it will prompt you to publish the packages to the remote registry. If you say no, the publishing step will be skipped. If you say yes, the command will publish the packages to the npm registry.

```text {% command="nx release --first-release" %}
...

✔ Do you want to publish these versions? (y/N) · true

NX   Running target nx-release-publish for 3 projects:

- pkg-1
- pkg-2
- pkg-3

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

> nx run pkg-1:nx-release-publish


📦  @myorg/pkg-1@0.0.2
=== Tarball Contents ===

233B README.md
277B package.json
53B  src/index.ts
61B  src/lib/pkg-1.ts
=== Tarball Details ===
name:          @myorg/pkg-1
version:       0.0.2
filename:      testorg-pkg-1-0.0.2.tgz
package size:  531 B
unpacked size: 624 B
shasum:        {shasum}
integrity:     {integrity}
total files:   12

Published to https://registry.npmjs.org with tag "latest"

> nx run pkg-2:nx-release-publish


📦  @myorg/pkg-2@0.0.2
=== Tarball Contents ===

233B README.md
277B package.json
53B  src/index.ts
61B  src/lib/pkg-2.ts
=== Tarball Details ===
name:          @myorg/pkg-2
version:       0.0.2
filename:      testorg-pkg-2-0.0.2.tgz
package size:  531 B
unpacked size: 624 B
shasum:        {shasum}
integrity:     {integrity}
total files:   12

Published to https://registry.npmjs.org with tag "latest"

> nx run pkg-3:nx-release-publish


📦  @myorg/pkg-3@0.0.2
=== Tarball Contents ===

233B README.md
277B package.json
53B  src/index.ts
61B  src/lib/pkg-3.ts
=== Tarball Details ===
name:          @myorg/pkg-3
version:       0.0.2
filename:      testorg-pkg-3-0.0.2.tgz
package size:  531 B
unpacked size: 624 B
shasum:        {shasum}
integrity:     {integrity}
total files:   12

Published to https://registry.npmjs.org with tag "latest"

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target nx-release-publish for 3 projects

```

## Manage Git Operations

By default, Nx Release will stage all changes it makes with git. This includes updating `package.json` files, creating changelog files, and updating the `package-lock.json` file. After staging the changes, Nx Release will commit the changes and create a git tag for the release.

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

After the first release, the `--first-release` option will no longer be required. Nx Release will expect to find git tags and changelog files for each package. It will also use `npm view` to look up the current version of packages before publishing, ensuring that the package has not already been published and therefore avoid any conflict errors, meaning you can run the same publish action multiple times without any negative side-effects.

Future releases will also generate entries in `CHANGELOG.md` based on the changes since the last release. Nx Release will parse the `feat` and `fix` type commits according to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification and sort them into appropriate sections of the changelog. An example of these changelogs can be seen on the [Nx releases page](https://github.com/nrwl/nx/releases).

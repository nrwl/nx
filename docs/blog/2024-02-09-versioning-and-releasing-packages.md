---
title: Versioning and Releasing Packages in a Monorepo
slug: 'versioning-and-releasing-packages-in-a-monorepo'
authors: [Juri Strumpflohner]
cover_image: '/blog/images/2024-02-09/featured_img.png'
tags: [nx, nx-cloud, releases, changelog]
---

When it comes to publishing NPM packages, there are a bunch of libraries and utilities out there that help with the process. Many of them are tricky when it comes to properly configuring them in a monorepo.

Nx already has all that knowledge, and it can leverage the information it has about your project dependencies and relationships to optimize your task runs.

Here’s the structure of our current example workspace we’re going to refer to in this article:

![@tuskdesign/demo relies on @tuskdesign/forms and @tuskdesign/buttons, and @tuskdesign/forms also depends on @tuskdesign/buttons](/blog/images/2024-02-09/bodyimg1.webp)

As you can see `@tuskdesign/forms` relies on `@tuskdesign/buttons` and as such has to consider that when running versioning and publishing.

> **Note:** it is worth mentioning that the Nx community has also stepped up in the past and created jscutlery/semver, a package that adds semantic versioning and publishing to your Nx workspace. Make sure to check that out as well.

---

**Prefer a video?**

{% youtube src="https://www.youtube.com/embed/KjZKFGu3_9I?si=L-8oRzy-hV-WF_pS" title="Versioning and Releasing Packages in a Monorepo" /%}

---

## Table Of Contents

- [Adding Nx](#adding-nx)
- [Installing the JavaScript/TypeScript versioning Package](#installing-the-javascripttypescript-versioning-package)
- [Running Nx Release](#running-nx-release)
- [Excluding Packages](#excluding-packages)
- [Running the Versioning and Changelog Generation](#running-the-versioning-and-changelog-generation)
- [Versioning using Conventional Commits](#versioning-using-conventional-commits)
- [Generating a GitHub Release](#generating-a-github-release)
- [Programmatic Mode](#programmatic-mode)
- [Wrapping Up](#wrapping-up)
- [Learn more](#learn-more)

## Adding Nx

You can add Nx to your existing monorepo workspace using the following command:

```shell
pnpm dlx nx@latest init
```

(use `npx nx@latest init` in a NPM workspace)

This brings up a couple of questions including whether to install [Project Crystal plugins](/blog/what-if-nx-plugins-were-more-like-vscode-extensions).

![](/blog/images/2024-02-09/bodyimg2.webp)

It gives you some additional benefits ([you can read more here](/blog/what-if-nx-plugins-were-more-like-vscode-extensions)), but you don’t have to as it is not required for Nx Release.

## Installing the JavaScript/TypeScript versioning Package

Nx Release is made to handle the versioning and publishing of any package. For now, the Nx team provides the JS/TS package publishing approach, which comes with the `@nx/js`. You could provide your own implementation, like for Cargo, NuGet etc.

```shell
pnpm add @nx/js -w
```

_(We use the `-w` flag to install it at the monorepo root level)_

## Running Nx Release

Once you’re set-up, you can already go ahead and run the following command:

```shell
pnpm nx release --dry-run
```

This command will do the versioning, changelog generation, and publishing steps together. Note the `--dry-run` simply simulating a run.

![](/blog/images/2024-02-09/bodyimg3.webp)

You’ll get asked whether you want to release a major, pre-major, minor… release or choose an exact version.

Once this runs through, you might hit the following error:

![Error message that reads: "> NX Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release. releaseTagPattern" property in nx.json to match the structure of your repository's git tags.](/blog/images/2024-02-09/bodyimg4.webp)

Since Nx Release has never been run on this repository, it cannot figure out the historical information, for instance, to generate the changelog starting from previous git tags. Re-run the command with `--first-release`

```shell
pnpm nx release --dry-run --first-release
```

If you inspect the console output, you can see that:

- it would increment the version in the package.json
- update the pnpm (or npm) lockfile
- stage the changes with git
- creates a `CHANGELOG.md` file
- git commits everything
- git tags the commit using the version

The dry-run mode also nicely previews all `package.json` changes in a git diff style:

![](/blog/images/2024-02-09/bodyimg5.png)

Note, if you want to get even more insights into what is happening when running the command, you can use the `--verbose`, which will also print the actual git commands.

## Excluding Packages

If you look closely at the dry-run logs, you may notice that Nx Release bumped the version on all of our packages:

- `@tuskdesign/forms`
- `@tuskdesign/buttons`
- `@tuskdesign/demo`

![](/blog/images/2024-02-09/bodyimg6.png)

While we want to have it bumped on the `forms` and `buttons` packages, the `demo` is just for us to test things in the workspace. In this particular workspace, Nx Release doesn't have a way to distinguish what is an app and what is a library/package. Note, if you're in an Nx-generated workspace that uses Nx Plugins, you'd potentially have that classification in the `project.json` files.

In our particular scenario, let's exclude `@tuskdesign/demo` as follows:

```json {% fileName="nx.json" %}
{
    ...
    "release": {
        "projects": ["*", "!@tuskdesign/demo"]
    }
}
```

You can also explicitly list the packages to be released individually. Or, as shown above, include all (`*`) and exclude the private package.

If you re-run the `nx release` command, you'll see that `@tuskdesign/demo` will be ignored now.

## Running the Versioning and Changelog Generation

Once you have configured the excluded packages, feel free to go ahead and run the command without `--dry-run:`

```
pnpm nx release --first-release
```

You can skip the release part when prompted for now. Check how the workspace got updated, incrementing the `package.json` version property and updating the version on the package dependency definition, i.e. the `@tuskdesign/buttons` version got updated in the `@tuskdesign/forms` package.json.

## Versioning using Conventional Commits

Instead of manually confirming the next version each time, we can use a versioning strategy: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) is a commonly adopted approach for publishing packages.

To configure conventional commits with Nx Release, go to the `nx.json` and adjust it as follows:

```json {% fileName="nx.json" %}
{
    ...
    "release": {
        "projects": ["*", "!@tuskdesign/demo"],
        "version": {
            "conventionalCommits": true
        }
    }
}
```

If you now run...

```shell
pnpm nx release --dry-run
```

... you'll notice that it doesn't pick up any changes because it leverages conventional commit, and we haven't changed anything yet.

![](/blog/images/2024-02-09/bodyimg7.webp)

Let’s go ahead and change something in our `@tuskdesign/buttons` package and then commit it as follows:

```shell
git commit -am 'feat(buttons): add new background shadow'
```

Now re-run the `nx release command` (don't forget the `--dry-run`). You'll see how it chooses `v1.2.0` as our new version (we had `v1.1.0` previously), given we added a new feature (denoted by the `feat(...)` conventional commit).

![](/blog/images/2024-02-09/bodyimg8.webp)

It also generates a nice `CHANGELOG.md` for us:

```shell
## 1.2.0 (2024-02-09)

### 🚀 Features

- **buttons:** add new background shadow

### ❤️  Thank You

- Juri

## 1.1.0 (2024-02-09)

This was a version bump only, there were no code changes.
```

## Generating a GitHub Release

Instead of just generating a `CHANGELOG.md` entry in our repository you can also opt-in for creating a Github release (here's the example of the [Nx repository](https://github.com/nrwl/nx/releases)).

```json {% fileName="nx.json" %}
Use the `createRelease` property and set it to `github`.
{
    ...
    "release": {
        "projects": ["*", "!@tuskdesign/demo"],
        "version": {
            "conventionalCommits": true
        },
        "changelog": {
            "workspaceChangelog": {
                "createRelease": "github"
            }
        }
    }
}
```

To see the working, you need to make sure to:

- push the repo to GitHub
- make some change so you can run the `nx release` command again and get a changelog generated
- now also get a GH release created

Note, you can still use `--dry-run` and it'd show you the URL where the GitHub release would be created. You can also use the `--skip-publish` to skip the NPM publishing.

## Programmatic Mode

As you’ve seen, you can use `nx release` right away with minimal configuration. However, we are very well aware that many real-world scenarios are more complex, you want/need more control over when the version is happening, when the changelog generation kicks in and so on. This is why we also introduced a **programmatic API.**

This approach gives you full control to embed Nx Release into your current release flow. There’s a nice [example script in our docs](/features/manage-releases#using-the-programmatic-api-for-nx-release) that can help you get started.

Create a file — I call it `release.ts` - at the root of my workspace. Nx Release obviously doesn't care how the file is called or where you place it. You can also go with plain JS.

Here’s the [example script from our docs](/features/manage-releases#using-the-programmatic-api-for-nx-release):

```ts
import { releaseChangelog, releasePublish, releaseVersion } from 'nx/release';
import * as yargs from 'yargs';

(async () => {
  const options = await yargs
    .version(false) // don't use the default meaning of version in yargs
    .option('version', {
      description:
        'Explicit version specifier to use, if overriding conventional commits',
      type: 'string',
    })
    .option('dryRun', {
      alias: 'd',
      description:
        'Whether or not to perform a dry-run of the release process, defaults to true',
      type: 'boolean',
      default: true,
    })
    .option('verbose', {
      description:
        'Whether or not to enable verbose logging, defaults to false',
      type: 'boolean',
      default: false,
    })
    .parseAsync();

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    specifier: options.version,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  // The returned number value from releasePublish will be zero if all projects are published successfully, non-zero if not
  const publishStatus = await releasePublish({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });
  process.exit(publishStatus);
})();
```

You can invoke it with [tsx](https://github.com/privatenumber/tsx) or [tsnode](https://www.npmjs.com/package/ts-node).

```
pnpm dlx tsx release.ts
```

Notice by default in the script we have `dry-run` enabled as a more cautious approach to not accidentally publish something as we keep editing and trying our programmatic setup.

From here on you have full control and can pretty much do whatever works best for your workspace setup. Common examples include:

- moving files to a common root-level `dist/` folder and version and release them from there. This is pretty common to avoid messing with your src files and swapping versions there, allowing you to always depend on the latest local packages for instance.
- setting up fully automated releases on CI, including enabling provenance support. Our docs have [more details on how to set that up](/recipes/nx-release/publish-in-ci-cd) or check out the linked talk above which goes through those steps.

## Wrapping Up

With this release of Nx Release it is fully ready to be used. Make sure to check out our docs on [Managing Releases](/features/manage-releases) as well as our [release-related recipes](/recipes/nx-release).

Here are some example repositories already leveraging Nx release:

- [Our own Nx Repo](https://github.com/nrwl/nx/blob/master/scripts/nx-release.ts)
- [RxJS repo](https://github.com/ReactiveX/rxjs/tree/master/scripts)
- [Typescript-eslint](https://github.com/typescript-eslint/typescript-eslint/blob/main/tools/release/release.mts)
- [Watch the live stream](https://www.youtube.com/watch?v=lYNa6Ct4RkY) with [Kent](https://twitter.com/kentcdodds) and [James](https://twitter.com/MrJamesHenry) as they enable Nx Release on the [EpicWeb workshop app repository](https://github.com/epicweb-dev/kcdshop)

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [X / Twitter](https://twitter.com/nxdevtools) — [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](https://nx.app/)

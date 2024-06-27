---
title: 'release - CLI command'
description: 'Orchestrate versioning and publishing of applications and libraries'
---

# release

Orchestrate versioning and publishing of applications and libraries

## Usage

```shell
nx release
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Shared Options

### dry-run

Type: `boolean`

Default: `false`

Preview the changes without updating files/creating releases

### groups

Type: `string`

One or more release groups to target with the current command.

### help

Type: `boolean`

Show help

### projects

Type: `string`

Projects to run. (comma/space delimited project names and/or patterns)

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number

## Subcommands

### Base Command Options

Create a version and release for the workspace, generate a changelog, and optionally publish the packages

```shell
nx release [specifier]
```

#### Options

##### first-release

Type: `boolean`

Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running.

##### help

Type: `boolean`

Show help

##### skip-publish

Type: `boolean`

Skip publishing by automatically answering no to the confirmation prompt for publishing

##### specifier

Type: `string`

Exact version or semver keyword to apply to the selected release group.

##### version

Type: `boolean`

Show version number

##### yes

Type: `boolean`

Automatically answer yes to the confirmation prompt for publishing

### version

Create a version and release for one or more applications and libraries

```shell
nx release version [specifier]
```

#### Options

##### first-release

Type: `boolean`

Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running.

##### git-commit

Type: `boolean`

Whether or not to automatically commit the changes made by this command

##### git-commit-args

Type: `string`

Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the `git commit` command invoked behind the scenes

##### git-commit-message

Type: `string`

Custom git commit message to use when committing the changes made by this command. {version} will be dynamically interpolated when performing fixed releases, interpolated tags will be appended to the commit body when performing independent releases.

##### git-tag

Type: `boolean`

Whether or not to automatically tag the changes made by this command

##### git-tag-args

Type: `string`

Additional arguments to pass to the `git tag` command invoked behind the scenes

##### git-tag-message

Type: `string`

Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself.

##### help

Type: `boolean`

Show help

##### preid

Type: `string`

The optional prerelease identifier to apply to the version. This will only be applied in the case that the specifier argument has been set to `prerelease` OR when conventional commits are enabled, in which case it will modify the resolved specifier from conventional commits to be its prerelease equivalent. E.g. minor -> preminor

##### specifier

Type: `string`

Exact version or semver keyword to apply to the selected release group.

##### stage-changes

Type: `boolean`

Whether or not to stage the changes made by this command. Always treated as true if git-commit is true.

##### version

Type: `boolean`

Show version number

### changelog

Generate a changelog for one or more projects, and optionally push to Github

```shell
nx release changelog [version]
```

#### Options

##### first-release

Type: `boolean`

Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running.

##### from

Type: `string`

The git reference to use as the start of the changelog. If not set it will attempt to resolve the latest tag and use that

##### git-commit

Type: `boolean`

Whether or not to automatically commit the changes made by this command

##### git-commit-args

Type: `string`

Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the `git commit` command invoked behind the scenes

##### git-commit-message

Type: `string`

Custom git commit message to use when committing the changes made by this command. {version} will be dynamically interpolated when performing fixed releases, interpolated tags will be appended to the commit body when performing independent releases.

##### git-remote

Type: `string`

Default: `origin`

Alternate git remote in the form {user}/{repo} on which to create the Github release (useful for testing)

##### git-tag

Type: `boolean`

Whether or not to automatically tag the changes made by this command

##### git-tag-args

Type: `string`

Additional arguments to pass to the `git tag` command invoked behind the scenes

##### git-tag-message

Type: `string`

Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself.

##### help

Type: `boolean`

Show help

##### interactive

Type: `string`

Choices: [all, workspace, projects]

Interactively modify changelog markdown contents in your code editor before applying the changes. You can set it to be interactive for all changelogs, or only the workspace level, or only the project level

##### stage-changes

Type: `boolean`

Whether or not to stage the changes made by this command. Always treated as true if git-commit is true.

##### to

Type: `string`

Default: `HEAD`

The git reference to use as the end of the changelog

##### version

Type: `string`

The version to create a Github release and changelog for

### publish

Publish a versioned project to a registry

```shell
nx release publish
```

#### Options

##### all

Type: `boolean`

Default: `true`

[deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required.

##### exclude

Type: `string`

Exclude certain projects from being processed

##### first-release

Type: `boolean`

Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running.

##### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.

##### help

Type: `boolean`

Show help

##### nxBail

Type: `boolean`

Default: `false`

Stop command execution after the first failed task

##### nxIgnoreCycles

Type: `boolean`

Default: `false`

Ignore cycles in the task graph

##### otp

Type: `number`

A one-time password for publishing to a registry that requires 2FA

##### output-style

Type: `string`

Choices: [dynamic, static, stream, stream-without-prefixes]

Defines how Nx emits outputs tasks logs

| option                  | description                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dynamic                 | use dynamic output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended on your local development environments. |
| static                  | uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments.                                                                         |
| stream                  | nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr                                                                                                                        |
| stream-without-prefixes | nx prefixes the project name the target is running on, use this option remove the project name prefix from output                                                                                                                   |

##### parallel

Type: `string`

Max number of parallel processes [default is 3]

##### projects

Type: `string`

Projects to run. (comma/space delimited project names and/or patterns)

##### registry

Type: `string`

The registry to publish to

##### runner

Type: `string`

This is the name of the tasks runner configured in nx.json

##### skipNxCache

Type: `boolean`

Default: `false`

Rerun the tasks even when the results are available in the cache

##### tag

Type: `string`

The distribution tag to apply to the published package

##### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

##### version

Type: `boolean`

Show version number

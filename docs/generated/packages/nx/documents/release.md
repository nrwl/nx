---
title: 'release - CLI command'
description: '**ALPHA**: Orchestrate versioning and publishing of applications and libraries'
---

# release

**ALPHA**: Orchestrate versioning and publishing of applications and libraries

## Usage

```shell
nx release
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### dryRun

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

### version

Create a version and release for one or more applications and libraries

```shell
nx release version [specifier]
```

#### Options

##### help

Type: `boolean`

Show help

##### preid

Type: `string`

The optional prerelease identifier to apply to the version, in the case that specifier has been set to prerelease.

##### specifier

Type: `string`

Exact version or semver keyword to apply to the selected release group.

##### version

Type: `boolean`

Show version number

### changelog

Generate a changelog for one or more projects, and optionally push to Github

```shell
nx release changelog [version]
```

#### Options

##### from

Type: `string`

The git reference to use as the start of the changelog. If not set it will attempt to resolve the latest tag and use that

##### gitRemote

Type: `string`

Default: `origin`

Alternate git remote in the form {user}/{repo} on which to create the Github release (useful for testing)

##### help

Type: `boolean`

Show help

##### interactive

Type: `string`

Choices: [all, workspace, projects]

Interactively modify changelog markdown contents in your code editor before applying the changes. You can set it to be interactive for all changelogs, or only the workspace level, or only the project level

##### tagVersionPrefix

Type: `string`

Default: `v`

Prefix to apply to the version when creating the Github release tag

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

##### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser.

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

##### output-style

Type: `string`

Choices: [dynamic, static, stream, stream-without-prefixes]

Defines how Nx emits outputs tasks logs

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

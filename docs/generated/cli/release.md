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

Type: `boolean`

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

##### help

Type: `boolean`

Show help

##### registry

Type: `string`

The registry to publish to

##### tag

Type: `string`

The distribution tag to apply to the published package

##### version

Type: `boolean`

Show version number

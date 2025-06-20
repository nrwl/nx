---
title: nx release
description: 'Orchestrate versioning and publishing of applications and libraries.'
---

# `nx release`

Orchestrate versioning and publishing of applications and libraries.

## Aliases

- `v`


## Usage

```bash
nx release [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--access` | string | No description available |  |
| `--base` | string | Base of the current branch (usually main) |  |
| `--dry-run` | boolean | Preview the changes without updating files/creating releases. (alias: `-d`) | `false` |
| `--files` | string | Change the way Nx is calculating the affected command |  |
| `--first-release` | boolean | No description available |  |
| `--from` | string | No description available |  |
| `--git-commit` | boolean | Whether or not to automatically commit the changes made by this command. |  |
| `--git-commit-args` | string | Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the  |  |
| `--git-commit-message` | string | No description available |  |
| `--git-push` | boolean | Whether or not to automatically push the changes made by this command to the remote git repository. |  |
| `--git-push-args` | string | Additional arguments to pass to the  |  |
| `--git-remote` | string | No description available | `'origin'` |
| `--git-tag` | boolean | Whether or not to automatically tag the changes made by this command. |  |
| `--git-tag-args` | string | Additional arguments to pass to the  |  |
| `--git-tag-message` | string | Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself. |  |
| `--groups` | string | No description available |  |
| `--head` | string | Latest commit of the current branch (usually HEAD) |  |
| `--interactive` | string | No description available (alias: `-i`) |  |
| `--message` | string | Custom message to use for the changelog entry. (alias: `-m`) |  |
| `--onlyTouched` | boolean | Only include projects that have been affected by the current changes. | `true` |
| `--otp` | number | No description available |  |
| `--output-style` | string | Defines how Nx emits outputs tasks logs (choices: `dynamic`, `static`, `stream`, `stream-without-prefixes`) | `dynamic` |
| `--preid` | string | The optional prerelease identifier to apply to the version. This will only be applied in the case that the specifier argument has been set to  | `''` |
| `--printConfig` | string | Print the resolved nx release configuration that would be used for the current command and then exit. |  |
| `--projects` | string | Projects to run. (comma/space delimited project names and/or patterns). (alias: `-p`) |  |
| `--registry` | string | No description available |  |
| `--skip-publish` | boolean | No description available |  |
| `--stage-changes` | boolean | Whether or not to stage the changes made by this command. Always treated as true if git-commit is true. |  |
| `--tag` | string | No description available |  |
| `--to` | string | No description available | `'HEAD'` |
| `--uncommitted` | boolean | Uncommitted changes |  |
| `--verbose` | boolean | Enable verbose logging | `false` |
| `--yes` | boolean | No description available (alias: `-y`) |  |




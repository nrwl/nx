---
title: Configuring Version Prefix for Dependencies
description: Learn how to set up custom version prefixes in Nx Release to control how dependency versions are specified in your manifest files (such as package.json, Cargo.toml, etc.), with options for exact, patch, or minor-level compatibility.
---

# Configuring Version Prefix for Dependency Versions

This guide explains how to configure a custom version prefix in Nx Release using the `versionPrefix` option. The version prefix allows you to automatically add a specific prefix format to dependencies, providing control over how dependency versions are specified in your project's manifest files (such as `package.json`, `Cargo.toml`, etc.).

## The `versionPrefix` Option

The `versionPrefix` option controls which prefix is applied to dependency versions during the versioning process. By default, `versionPrefix` is set to `"auto"`, which selects a prefix format (either `""`, `"~"`, `"^"`, or `"="`) by respecting what is already in the manifest file.

For example, having the following `package.json` file as an example manifest:

```json
{
  "name": "my-package",
  "version": "0.1.1",
  "dependencies": {
    "dependency-one": "~1.2.3",
    "dependency-two": "^2.3.4",
    "dependency-three": "3.0.0"
  }
}
```

Then next patch bump will be:

```json
{
  "name": "my-package",
  "version": "0.1.2",
  "dependencies": {
    "dependency-one": "~1.2.4",
    "dependency-two": "^2.3.4",
    "dependency-three": "3.0.0"
  }
}
```

Preserving the prefix for `dependency-one` and `dependency-two` and continuing to use no prefix for `dependency-three`.

### Available Prefix Options

You can set `versionPrefix` to one of the following values:

- `"auto"`: Automatically chooses a prefix based on the existing declaration in the manifest file. This is the default value.
- `""`: Uses the exact version without a prefix.
- `"~"`: Specifies compatibility with patch-level updates.
- `"^"`: Specifies compatibility with minor-level updates.
- `"="`: Locks the version to an exact match (the `=` is not commonly used in the JavaScript ecosystem, but is in others such as Cargo for Rust).

Example configuration:

{% callout type="note" title="Breaking Changes in Nx 21" %}
In Nx v21, the configuration structure has changed. The example below shows the Nx 21 format.

For Nx 20, wrap the `versionPrefix` option inside a `generatorOptions` object.
{% /callout %}

```json
{
  "release": {
    "version": {
      "versionPrefix": "~"
    }
  }
}
```

## Configuring Version Prefix in `nx.json` or `project.json`

To set the versionPrefix option globally or for a specific project, add it to either your `nx.json` or `project.json` configuration files:

```jsonc
{
  "release": {
    "version": {
      "versionPrefix": "^" // or "", "~", "^", "=" depending on your preference
    }
  }
}
```

With the `versionPrefix` option set to `^`, your `package.json` dependencies might look like this:

```json
{
  "name": "my-package",
  "version": "0.1.1",
  "dependencies": {
    "dependency-one": "^1.0.0",
    "dependency-two": "^2.3.4",
    "dependency-three": "^3.0.0"
  }
}
```

This configuration helps enforce a consistent approach to dependency management, allowing flexibility in how updates to dependencies are tracked and managed across your project.

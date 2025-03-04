---
title: 'NPM Scope'
description: 'Learn about the deprecation of npmScope property in nx.json and how to properly configure organization prefixes using package.json name property.'
---

# NPM Scope

The `npmScope` property of the `nx.json` file is deprecated as of version 16.2.0. `npmScope` was used as a prefix for the names of newly created projects. The new recommended way to define the organization prefix is to set the `name` property in the root `package.json` file to `@my-org/root`. Then `@my-org/` will be used as a prefix for all newly created projects.

In Nx 16, if the `npmScope` property is present, it will be used as a prefix. If the `npmScope` property is not present, the `name` property of the root `package.json` file will be used to infer the prefix.

In Nx 17+, the `npmScope` property is ignored.

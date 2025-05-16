---
title: Nx, Node.js and TypeScript Compatibility
description: A reference outlining Nx's support policy and current compatibility matrix for Node.js and TypeScript.
---

# Nx, Node.js and TypeScript Compatibility

## Node.js Compatibility Matrix

Below is a reference table that matches the most recent major versions of Nx to the versions of Node.js that they officially support, and are tested against.

Nx's policy is to support the LTS versions (i.e. actively maintained even numbered versions) of Node.js, but we will only remove support for older versions in a major version of Nx to avoid unexpected disruption. We may add support for newer LTS versions in a minor version of Nx as long as it would not break existing projects.

> _Note: Other versions of Node.js **may** still work without issue for these versions of Nx. Those include versions which are already EOL, or odd version numbers (e.g. 23), which Node.js actively
> discourages using in production._

| Nx Version      | Node Version       |
| --------------- | ------------------ |
| 21.x (current)  | ^22.12.0, ^20.19.0 |
| 20.x (previous) | 22.x, 20.x, 18.x   |
| 19.x            | 22.x, 20.x, 18.x   |
| 18.x            | 20.x, 18.x         |

We intentionally do not include an `"engines"` field in the `package.json` file for Nx in order to allow for user flexibility, but this page should be considered the official compatibility matrix.

## TypeScript Compatibility

Unlike Node.js, TypeScript's policy is not to follow semver conventions around breaking changes only coming in major versions, despite using version numbers that are semver-like. Just like with Node.js, though, we will only remove support for older versions of TypeScript in a major version of Nx to avoid unexpected disruption. We may add support for newer versions in a minor version of Nx as long as it would not break existing projects.

| Nx Version      | TypeScript Version |
| --------------- | ------------------ |
| 21.x (current)  | >= 5.4.2 < 5.9.0   |
| 20.x (previous) | ~5.4.2             |
| 19.x            | ~5.4.2             |
| 18.x            | ~5.4.2             |

This page will be updated from time to time to reflect the latest versions of Node.js and TypeScript that are supported. If you encounter issues with Nx, please make sure you are using a supported version of Node.js and TypeScript before filing an issue.

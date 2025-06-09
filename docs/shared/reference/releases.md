---
title: Nx Release Schedule and Support Policy
description: Information about Nx package releases, including version support timelines, LTS policy, and deprecation guidelines for the nx and @nx/* packages.
---

# Releases of the nx and @nx/\* packages

{% callout type="info" title="Looking for guidance on releasing your projects with Nx Release?" %}
This page covers the releases of the Nx tooling itself. If you are looking for guidance on releasing your project with Nx Release, [see the documentation on managing releases](/features/manage-releases).
{% /callout %}

The `nx` package, and all packages under the `@nx` namespace which live alongside each other in the [https://github.com/nrwl/nx](https://github.com/nrwl/nx) repository, are released together in lockstep. You should always use matching versions of the `nx` package and the `@nx` packages, e.g. `nx@19.2.0` and `@nx/js@19.2.0` should be used together.

Major Nx versions are released as the _latest_ every six months, typically around April and October.
After each major version release, the _previous_ major version moves to long-term support (LTS) for 12 months, after
which it becomes unsupported.
Each major version has 18 total months of support from when it is first released to when it falls out of LTS. Users
should use `nx migrate` to ensure that they stay on a supported version.

### Major, Minor, and Patch Versions

- **Patch** versions include security or bug fixes, and are released as needed.
- **Minor** versions include new features and fixes, and are released less frequently. It is a good idea to regularly
  update to the latest minor version.
- **Major** versions may contain [breaking changes](#breaking-changes-and-migration-path), and are released twice a
  year.

## Supported Versions

The following are the currently supported major versions of Nx.

| Version | Support Type | Release Date |
| :-----: | :----------: | :----------: |
|   v21   |   Current    |  2025-05-05  |
|   v20   |     LTS      |  2024-10-06  |
|   v19   |     LTS      |  2024-05-06  |
|  v18\*  |     LTS      |  2024-02-03  |
|   v17   |     LTS      |  2023-10-19  |

**\*Note:** v18 is a special release and does not fit into the normal release cycle. Thus, v17 continues to be supported
according to schedule.

### Current vs LTS

The current version of Nx will receive new features as well as any fixes to any unintentional behavior.
When a new major version of Nx is released, previous versions will go into LTS.
LTS versions of Nx will receive security patches as well as critical fixes.

## Deprecation Policy

When the Nx team intends to remove an API or feature, it will be marked as _deprecated_. Deprecation warnings can
surface in documentation, terminal output, or in TSDoc. The deprecated API will remain
functional for a whole major version, after which they will be removed.

For example, if a feature is deprecated in v19.1.0, it will be removed in v21.0.0 (two major versions later).

## Breaking Changes and Migration Path

Breaking changes, including the removal of deprecated APIs, will be highlighted under _Breaking Changes_ in
the [changelog](/changelog).

Whenever possible, the Nx team will provide automatic migrations
through [`nx migrate`](/reference/core-api/nx/documents/migrate#migrate).

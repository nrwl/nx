# Releases

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
| ------- | ------------ | ------------ |
| v19     | Current      | 2024-05-06   |
| v18\*   | LTS          | 2024-02-03   |
| v17     | LTS          | 2023-10-19   |
| v16     | LTS          | 2023-04-27   |

**\*Note:** v18 is a special release and does not fit into the normal release cycle. Thus, v16 continues to be supported
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
through [`nx migrate`](/nx-api/nx/documents/migrate#migrate).

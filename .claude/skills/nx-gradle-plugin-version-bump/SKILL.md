---
name: nx-gradle-plugin-version-bump
description: Bump the dev.nx.gradle.project-graph plugin version. Use when updating the Gradle project graph plugin version across the codebase, creating the migration files, and updating migrations.json.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Gradle Plugin Version Bump

Bumps the `dev.nx.gradle.project-graph` plugin to a new version. This is a recurring task that touches 5 files in an identical pattern every time.

## Required Inputs

Collect these values from the master branch before starting:

1. `NEW_VERSION` - the version we want to bump to
   Example: OLD_VERSION: 0.1.15 => NEW_VERSION: 0.1.16
   You can find this value by looking at the `OLD_VERSION` specified in `packages/gradle/project-graph/build.gradle.kts` in the `version` field.  
   The NEW_VERSION will be the `OLD_VERSION` + 1.

2. `NX_MIGRATION_VERSION` - the version of Nx that will trigger our version bump migration
   Example: OLD_VERSION: 22.6.0 => NEW_VERSION: 22.7.0-beta.1
   You can find this value by looking at the `nx` version in `package.json` under `devDependencies`. The NEW_VERSION will be the `OLD_VERSION` + 1.

3. `MIGRATION_FOLDER` - the folder name under `packages/gradle/src/migrations/` that will contain our migration files
   Example: NEW_VERSION: 22.7.0-beta.1 => MIGRATION_FOLDER: 22-7-0
   Take the version and replace all the dots with hyphens and remove the `beta` or `rc` suffix.

## Steps

### 1. Update the version constant

**File:** `packages/gradle/src/utils/versions.ts`

Change `gradleProjectGraphVersion` to the new version:

```ts
export const gradleProjectGraphVersion = 'NEW_VERSION';
```

### 2. Update build.gradle.kts

**File:** `packages/gradle/project-graph/build.gradle.kts`

Update the `version` on line 13:

```kotlin
version = "NEW_VERSION"
```

### 3. Create migration TypeScript file

**File:** `packages/gradle/src/migrations/MIGRATION_FOLDER/change-plugin-version-NEW_VERSION.ts`

Determine the previous version by reading the current `gradleProjectGraphVersion` from `packages/gradle/src/utils/versions.ts` before modifying it.

Template:

```ts
import { Tree, readNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';
import { addNxProjectGraphPlugin } from '../../generators/init/gradle-project-graph-plugin-utils';
import { updateNxPluginVersionInCatalogsAst } from '../../utils/version-catalog-ast-utils';

/* Change the plugin version to NEW_VERSION
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }
  if (!hasGradlePlugin(tree)) {
    return;
  }

  const gradlePluginVersionToUpdate = 'NEW_VERSION';

  // Update version in version catalogs using AST-based approach to preserve formatting
  await updateNxPluginVersionInCatalogsAst(tree, gradlePluginVersionToUpdate);

  // Then update in build.gradle(.kts) files
  await addNxProjectGraphPlugin(tree, gradlePluginVersionToUpdate);
}
```

### 4. Create migration documentation file

**File:** `packages/gradle/src/migrations/MIGRATION_FOLDER/change-plugin-version-NEW_VERSION.md`

Replace `PREV_VERSION` with the version that was current before this bump.

Template:

````md
#### Change dev.nx.gradle.project-graph to version NEW_VERSION

Change dev.nx.gradle.project-graph to version NEW_VERSION in build file

#### Sample Code Changes

##### Before

\```text title="build.gradle"
plugins {
id "dev.nx.gradle.project-graph" version "PREV_VERSION"
}
\```

##### After

\```text title="build.gradle"
plugins {
id "dev.nx.gradle.project-graph" version "NEW_VERSION"
}
\```
````

### 5. Add migration entry to migrations.json

**File:** `packages/gradle/migrations.json`

Add a new entry at the end of the `generators` object (before the closing `}`), following the existing pattern:

```json
"change-plugin-version-NEW_VERSION": {
  "version": "NX_MIGRATION_VERSION",
  "cli": "nx",
  "description": "Change dev.nx.gradle.project-graph to version NEW_VERSION in build file",
  "factory": "./src/migrations/MIGRATION_FOLDER/change-plugin-version-NEW_VERSION"
}
```

The migration key uses the version with hyphens replacing dots (e.g., `0-1-16`).

## Verification

Run:

```bash
nx run-many -t test,build,lint -p gradle
```

## Commit Convention

```
chore(gradle): bump gradle project graph plugin version to NEW_VERSION
```

## Final Verification

Take a look at the most recent Gradle version bump PR and compare your changes to that. You should not be touching more or less files than
the most recent version bump PR. If you do, ask for more information and stop all changes.

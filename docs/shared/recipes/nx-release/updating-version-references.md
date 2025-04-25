---
title: Updating Version References in Manifest Files
description: Learn how to configure Nx Release to update version references in package.json and other manifest files, including strategies for source files, custom dist directories, and local dependency references.
---

# Updating Version References in Manifest Files (e.g. package.json)

The versioning stage of Nx Release is customizable and programming language agnostic, but some of its capabilities are dictated by the tooling you are using. This is particularly true when it comes to updating version references in manifest files, such as `package.json`.

Nx provides the TypeScript/JavaScript (and therefore `package.json`) functionality out of the box, so that is what will be covered in more detail in this recipe. For other ecosystems, please see the documentation of the respective plugins.

An important characteristic of Nx release is that it does not directly manipulate your packages in memory before releasing them. This maintains complete transparency between you and the tooling being leveraged to publish your packages, such as `npm publish` or `pnpm publish`, which are leveraged automatically by Nx Release during its publishing phase. The relevance of this will become clear for [Scenario 4 below](#scenario-4-i-want-to-update-package-versions-directly-in-my-source-files-but-use-local-dependency-references-via-fileworkspace).

{% callout type="note" title="Breaking Changes in Nx v21" %}
In Nx v21, the implementation details of versioning were rewritten to enhance flexibility and allow for better cross-ecosystem support. An automated migration was provided in Nx v21 to update your configuration to the new format when running `nx migrate`.

During the lifecycle of Nx v21, you can still opt into the old versioning by setting `release.version.useLegacyVersioning` to `true`, which will keep the original configuration structure and behavior. In Nx v22, the legacy versioning implementation will be removed entirely, so this should only be done temporarily to ease the transition.

The following examples shows the Nx v21 configuration format, you can view the v20 version of the website to see the legacy format.
{% /callout %}

## Scenario 1: I want to update semantic version numbers directly in my source package.json files

This is the simplest scenario, and default behavior of Nx Release. If you have a TypeScript/JavaScript project which lives at e.g. `packages/my-project` with its package.json at the root of the project, you can run `nx release` or use the programmatic API and it will update the version number and all relevant intra-workspace dependency references in `packages/my-project/package.json` to the new version(s).

For example, with the following project structure:

```
packages/
  my-project/
    package.json
  my-other-project-in-the-monorepo/
    package.json
```

And starting point for package.json sources:

```json {% fileName="packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.1",
  "dependencies": {
    "my-other-project-in-the-monorepo": "0.1.1"
  }
}
```

```json {% fileName="packages/my-other-project-in-the-monorepo/package.json" %}
{
  "name": "my-other-project-in-the-monorepo",
  "version": "0.1.1"
}
```

When running `nx release` and applying a patch release, the following changes will be made to the source package.json files:

```json {% fileName="packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.2",
  "dependencies": {
    "my-other-project-in-the-monorepo": "0.1.2"
  }
}
```

```json {% fileName="packages/my-other-project-in-the-monorepo/package.json" %}
{
  "name": "my-other-project-in-the-monorepo",
  "version": "0.1.2"
}
```

By default, the changes will be staged and committed unless git operations are disabled.

## Scenario 2: I want to publish from a custom dist directory and update references in my both my source and dist package.json files

Nx Release has the concept of a "manifest root", which is different than the project root. The manifest root is the directory from which the project is versioned. By default, the manifest root is the project root detected by Nx as we have seen in Scenario 1 above, but the manifest root can be configured independently to be one or more other locations than the project root.

As of Nx v21, multiple manifest roots can be configured using the `release.version.manifestRootsToUpdate` option, resulting in multiple manifest files (such as `package.json`) being updated at once for a single project during a the versioning phase.

If, for example, we want to build our projects to a centralized `dist/` directory in the Nx workspace, and update both the source and dist package.json files when versioning, we can tell Nx Release to discover it for the versioning and publishing steps by adding the following configuration to the `nx.json` file, or the `project.json` file of relevant projects:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    // Ensure that versioning works in both the source and dist directories
    "version": {
      // path structures for both the source and dist directories, where {projectRoot} and {projectName} are available placeholders that will be interpolated by Nx
      "manifestRootsToUpdate": [
        "{projectRoot}",
        // We use the object form of the manifestRootsToUpdate to specify that we want to update the dist package.json files and not preserve the local dependency references (if not using pnpm or bun)
        {
          "path": "dist/packages/{projectName}",
          "preserveLocalDependencyProtocols": false // (NOT NEEDED WHEN USING pnpm or bun) because we need to ensure our dist package.json files are valid for publishing and the local dependency references such as "workspace:" and "file:" are removed
        }
      ]
    }
  },
  "targetDefaults": {
    // Ensure that publishing works from the dist directory
    // The nx-release-publish target is added implicitly behind the scenes by Nx Release, and we can therefore configure it in targetDefaults
    "nx-release-publish": {
      "options": {
        // the packageRoot property is specific the TS/JS nx-release-publish implementation, other ecosystem plugins may have different options
        "packageRoot": "dist/packages/{projectName}" // path structure for your dist directory, where {projectRoot} and {projectName} are available placeholders that will be interpolated by Nx
      }
    }
  }
}
```

## Scenario 3: I want to publish from a custom dist directory and not update references in my source package.json files

A slight modification of Scenario 2 above, where we want to publish from a custom dist directory and not update references in our source package.json files.

{% callout type="warning" title="The source control tracked package.json files are no longer the source of truth for the package version" %}
Because we are no longer updating the version references in the source package.json files, the source control tracked package.json files are no longer the source of truth for the package version. We need to reference git tags or the latest value in the registry as the source of truth for the package version instead. We will also need to handle intra-workspace dependency references in the source package.json files differently using file/workspace references, which will be covered below.
{% /callout %}

Because our source package.json files are no longer updated during versioning, we will need to handle intra-workspace dependency references in the source package.json files differently. The way to achieve this is by using local `file:` or `workspace:` references in the source package.json files.

For example, using our packages from Scenario 1 above, if we want to reference the `my-other-project-in-the-monorepo` project from `my-project`, we can update the source package.json file as follows:

```jsonc {% fileName="packages/my-project/package.json" %}
{
  "name": "my-project", // note there is no version number in the source package.json file because it will never be updated
  "dependencies": {
    "my-other-project-in-the-monorepo": "workspace:*" // or "file:../my-other-project-in-the-monorepo", depending on your preference and which package manager you are using
  }
}
```

If the package manager we are using is not using pnpm or bun (See Scenario 4 below), we will need to let Nx release know that we want to overwrite the workspace reference with the actual version number when publishing, because since Nx v21 it will preserve them by default. We can do this by setting the `release.version.preserveLocalDependencyProtocols` option to `false` in the `nx.json` file:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    // Ensure that versioning works only in the dist directory
    "version": {
      "manifestRootsToUpdate": ["dist/packages/{projectName}"], // path structure for your dist directory, where {projectRoot} and {projectName} are available placeholders that will be interpolated by Nx
      "currentVersionResolver": "git-tag", // or "registry", because we are no longer referencing our source package.json as the source of truth for the current version
      "preserveLocalDependencyProtocols": false // (NOT NEEDED WHEN USING pnpm or bun) because we need to ensure our dist package.json files are valid for publishing and the local dependency references are removed
    }
  },
  "targetDefaults": {
    // Ensure that publishing works from the dist directory
    // The nx-release-publish target is added implicitly behind the scenes by Nx Release, and we can therefore configure it in targetDefaults
    "nx-release-publish": {
      "options": {
        "packageRoot": "dist/packages/{projectName}" // path structure for your dist directory, where {projectRoot} and {projectName} are available placeholders that will be interpolated by Nx
      }
    }
  }
}
```

After applying a patch version, our dist package.json will therefore ultimately look like this:

```jsonc {% fileName="dist/packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.2", // the version number is applied
  "dependencies": {
    "my-other-project-in-the-monorepo": "0.1.2" // the dependency reference is updated from the workspace reference to the actual version number (if not using pnpm or bun)
  }
}
```

This package.json is now valid and ready to be published to the registry with any package manager.

## Scenario 4: I want to update package versions directly in my source files, but use local dependency references via file/workspace

{% callout type="caution" title="This scenario is currently only fully supported when your package manager is pnpm or bun" %}
pnpm and bun are the only package managers that provide a publish command that both supports dynamically swapping the `file:` and `workspace:*` references with the actual version number at publish time, and provides the customization needed for us to wrap it. `yarn npm publish` does support the replacements but is very limited on customization options.
{% /callout %}

This is a more advanced scenario because it removes the clean separation of concerns between versioning and publishing. The reason for this is that the `file:` and `workspace:*` references simply have to be replaced with actual version numbers before they are written to the registry, otherwise they will break when a user tries to install the package. If versioning does not replace them, publishing needs to.

As mentioned at the start of this recipe, Nx Release intentionally does not manipulate your packages in memory during publishing, so this scenario is only supported when your package manager provides publishing functionality which dynamically swaps the local references. **Currently this is only supported by pnpm and bun.**

As of Nx v21, by default, `release.version.preserveLocalDependencyProtocols` is set to `true`, which means that `file:` and `workspace:*` references are preserved.

For example, using this source package.json file, when applying a patch release:

```jsonc {% fileName="packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.2",
  "dependencies": {
    "my-other-project-in-the-monorepo": "workspace:*"
  }
}
```

Nx release will see this and update the "version" number to `0.1.3`, and leave the `workspace:*` reference alone:

```jsonc {% fileName="packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.3", // our version number is updated as expected
  "dependencies": {
    // our workspace dependency reference is preserved
    "my-other-project-in-the-monorepo": "workspace:*"
  }
}
```

Again, this is not in a valid state to be published to the registry, and so the publishing step will need to handle this. **This is only supported by pnpm and bun**, in which case Nx Release invokes `pnpm publish` or `bun publish` instead of `npm publish` behind the scenes during publishing, and you will receive a clear error if you attempt to use such a package.json with npm or yarn.

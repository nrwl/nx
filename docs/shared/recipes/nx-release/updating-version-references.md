# Updating Version References in Manifest Files (e.g. package.json)

The versioning stage of Nx Release is customizable and programming language agnostic, but some of its capabilities are dictated by the tooling you are using. This is particularly true when it comes to updating version references in manifest files, such as `package.json`.

Nx provides the TypeScript/JavaScript (and therefore `package.json`) functionality out of the box, so that is what will be covered in more detail in this recipe. For other ecosystems, please see the documentation of the respective plugins.

An important characteristic of Nx release is that it does not manipulate your packages in memory before releasing them. This maintains complete transparency between you and the tooling being leveraged to publish your packages, such as `npm publish` or `pnpm publish`, which are leveraged automatically by Nx Release during its publishing phase. The relevance of this will become clear for [Scenario 3 below](#scenario-3-i-want-to-update-package-versions-directly-in-my-source-files-but-use-local-dependency-references-via-fileworkspace).

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

## Scenario 2: I want to publish from a custom dist directory and not update references in my source package.json files

Nx Release has the concept of a "package root", which is different than the project root. The package root is the directory from which the package is versioned and published. By default, the package root is the project root detected by Nx as we have seen in Scenario 1 above, but the package root can be configured independently for the versioning and publishing steps.

If we want to build our projects to a centralized `dist/` directory in the Nx workspace, we can tell Nx Release to discover it for the versioning and publishing steps by adding the following configuration to the `nx.json` file, or the `project.json` file of relevant projects:

{% callout type="warning" title="The source control tracked package.json files are no longer the source of truth for the package version" %}
Because we are no longer updating the version references in the source package.json files, the source control tracked package.json files are no longer the source of truth for the package version. We need to reference git tags or the latest value in the registry as the source of truth for the package version instead. We will also need to handle intra-workspace dependency references in the source package.json files differently using file/workspace references, which will be covered below.
{% /callout %}

```jsonc {% fileName="nx.json" %}
{
  "release": {
    // Ensure that versioning works from the dist directory
    "version": {
      "generatorOptions": {
        "packageRoot": "dist/packages/{projectName}", // path structure for your dist directory, where {projectRoot} and {projectName} are available placeholders that will be interpolated by Nx
        "currentVersionResolver": "git-tag" // or "registry", because we are no longer referencing our source package.json as the source of truth for the current version
      }
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

This reference will never need to change when versioning is carried out and the package manager will reliably link the two packages together (and tools like TypeScript can follow these references for import resolution etc).

Our dist package.json will therefore ultimately look like this:

```jsonc {% fileName="dist/packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.2", // the version number is applied
  "dependencies": {
    "my-other-project-in-the-monorepo": "0.1.2" // the dependency reference is updated from the workspace reference to the actual version number
  }
}
```

This package.json is now valid and ready to be published to the registry.

## Scenario 3: I want to update package versions directly in my source files, but use local dependency references via file/workspace

{% callout type="caution" title="This scenario is only supported when your package manager is pnpm" %}
pnpm is the only package manager that provides a publish command that supports dynamically swapping the `file:` and `workspace:*` references with the actual version number at publish time.
{% /callout %}

This is a more advanced scenario because it removes the clean separation of concerns between versioning and publishing. The reason for this is that the `file:` and `workspace:` references simply have to be replaced with actual version numbers before they are written to the registry, otherwise they will break when a user tries to install the package. If versioning does not replace them, publishing needs to.

As mentioned at the start of this recipe, Nx Release intentionally does not manipulate your packages in memory during publishing, so this scenario is only supported when your package manager provides publishing functionality which dynamically swaps the local references. **Currently this is only supported by pnpm.**

Let's first look at the default behavior of Nx Release, which is to update the all version references in the source package.json files with the new version number.

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

Nx release will see this and update the "version" number to `0.1.3`, and want to replace the `workspace:*` reference with the actual version number of the dependency - also `0.1.3`. This cleanly prepares the package.json ready to be published:

```jsonc {% fileName="packages/my-project/package.json" %}
{
  "name": "my-project",
  "version": "0.1.3",
  "dependencies": {
    // whilst this is now ready to publish, it is not really what we wanted to happen,
    // because we have now hardcoded the version number in the source package.json file
    // and we have lost the evergreen "workspace:*" reference
    "my-other-project-in-the-monorepo": "0.1.3"
  }
}
```

Now Nx release can publish this and your package will work for all its consumers, but you have the side-effect of having hardcoded the version number in the source package.json file. This is exactly what we covered in [Scenario 1 above](#scenario-1-i-want-to-update-semantic-version-numbers-directly-in-my-source-packagejson-files).

To instead configure Nx Release to not update the dependency references in the source package.json files, you can set the "preserveLocalDependencyProtocols" version generator option to `true`:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "version": {
      "generatorOptions": {
        "preserveLocalDependencyProtocols": true
      }
    }
  }
}
```

Now, that same patch release to the source package.json file will result in the following:

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

Again, this is not in a valid state to be published to the registry, and so the publishing step will need to handle this. **This is only supported by pnpm**, in which case Nx Release invokes `pnpm publish` instead of `npm publish` behind the scenes during publishing, and you will receive a clear error if you attempt to use such a package.json with another package manager.

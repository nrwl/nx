# Publish a Custom Dist Directory

This recipe guides you through configuring Nx Release to version and publish packages that are built to a custom `dist` directory instead of their source project root. This is often the case when using Nx generators or custom builders that output to a centralized `dist` directory at the workspace root.

## The Package Root

Nx Release has the concept of a "package root", which is different than the project root. The package root is the directory from which the package is versioned and published. By default, the package root is the project root detected by Nx. Due to the modular nature of Nx Release, the package root can be configured independently for the version and publish steps.

## Strategies for Tracking Dependencies

Nx Release supports two out-of-the-box methods of tracking dependencies for js packages.

### Use Explicit Version Numbers and Track Versions in Source Control

Keep all version numbers in the source package.json file and use semantic versions when specifying dependencies. This is the default behavior. In this case, a package.json file will look like this:

```json
{
  "name": "my-package",
  "version": "0.1.1",
  "dependencies": {
    "my-other-package": "^0.1.1",
    "my-other-package-2": "1.2.0"
  }
}
```

Nx Release will read the current version (0.1.1) from the source package.json file, update it to the new version, and update all dependencies in this package.json file. Changes to the package.json file will be staged and committed unless git operations are disabled. In this case, the `packageRoot` is the same as the Nx project root.

### Use File or Workspace References and Do Not Track Versions in Source Control

Keep all version numbers in the dist package.json file and use file or workspace references for specifying dependencies. This is done by specifying an alternate `packageRoot` for the version and publish commands. In this case, the source package.json file looks like this:

```json
{
  "name": "my-package",
  "dependencies": {
    "my-other-package": "file:../my-other-package",
    "my-other-package-2": "workspace:*"
  }
}
```

and the dist package.json file, which will actually be published in the publish step, looks like this:

```json
{
  "name": "my-package",
  "version": "0.1.1",
  "dependencies": {
    "my-other-package": "0.1.1",
    "my-other-package-2": "1.2.0"
  }
}
```

Note that the version number is not present in the source package.json file. This is because the source package.json file is never updated in the versioning process; its data is instead written to the dist package.json file. To ensure the correct version number is used in the dist package.json file, `"release.version.generatorOptions.currentVersionResolver"` should be set to something other than the default value of `"disk"`. To pick the current version from git tags, set it to `"git-tag"`. To look up the current version from the remote registry, set it to `"registry"`.

Configure this behavior by adding the following configuration to the `nx.json` file, or the `project.json` file of relevant projects:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "version": {
      "generatorOptions": {
        "packageRoot": "dist/packages/{projectName}", // path structure for your dist directory
        "currentVersionResolver": "git-tag" // or "registry"
      }
    }
  },
  "targetDefaults": {
    "nx-release-publish": {
      "options": {
        "packageRoot": "dist/packages/{projectName}" // path structure for your dist directory
      }
    }
  }
}
```

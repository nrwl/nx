#### Nx Release Version Config Changes

In Nx v21, the implementation details of versioning were rewritten to massively enhance flexibility and lay the groundwork for future features.

As part of this, some elements of the release configuration were updated. During the lifecycle of Nx v21, you can still opt into the old versioning by setting `release.version.useLegacyVersioning` to `true`, in which case the release configuration should remain unchanged.

In Nx v22, the legacy versioning implementation will be removed entirely and the configuration will have to be updated to match what this migration does for you.

#### Sample Code Changes

"generatorOptions" is longer exists and most non-ecosystem specific options have moved to the top level of "version" and are therefore fully documented on the JSON schema as a core option.

"packageRoot: string" has been replaced by the more flexible concept of "manifestRootsToUpdate: string[]", allowing for multiple manifest files (such as `package.json` in the JS/TS ecosystem)
to be updated in a single versioning run.

Ecosystem specific options, such as "skipLockFileUpdate", which is specific to the JS/TS ecosystem, are available via the new "versionActionsOptions" object, which is so named because of the new `VersionActions` abstraction introduced in Nx v21,
which allows for different ecosystems and use-cases to be supported via very minimal implementation effort.

"preserveLocalDependencyProtocols" changed from `false` by default to `true` by default in Nx v21, so it can simply be removed from the configuration when set to true.

The migration will also update release groups version configuration, as well as project.json and package.json version configuration, if applicable.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "release": {
    "version": {
      "generatorOptions": {
        "packageRoot": "build/packages/{projectName}",
        "currentVersionResolver": "registry",
        "skipLockFileUpdate": true,
        "preserveLocalDependencyProtocols": true
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "release": {
    "version": {
      "manifestRootsToUpdate": ["build/packages/{projectName}"],
      "currentVersionResolver": "registry",
      "versionActionsOptions": {
        "skipLockFileUpdate": true
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

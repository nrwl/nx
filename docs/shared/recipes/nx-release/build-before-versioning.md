---
title: Build Before Versioning
description: Learn how to configure Nx Release to build your projects before applying version updates, ensuring that distribution files are properly generated before publishing.
---

# Build Before Versioning

In order to ensure that projects are built before the new version is applied to their package manifest, you can use the `preVersionCommand` property in `nx.json`:

```json {% fileName="nx.json" %}
{
  "release": {
    "version": {
      "preVersionCommand": "npx nx run-many -t build"
    }
  }
}
```

This command will run the `build` target for all projects before the version step of Nx Release. Any command can be specified, including non-nx commands. This step is often required when [publishing from a custom dist directory](/recipes/nx-release/updating-version-references#scenario-2-i-want-to-publish-from-a-custom-dist-directory-and-update-references-in-my-both-my-source-and-dist-packagejson-files), as the dist directory must be built before the version is applied to the dist directory's package manifest.

When using release groups in which the member projects are versioned together, you can use `groupPreVersionCommand` and it will be executed before the versioning step for that release group.

```json {% fileName="nx.json" %}
{
  "release": {
    "groups": {
      "my-group": {
        "projects": ["my-lib-one", "my-lib-two"],
        "version": {
          "groupPreVersionCommand": "npx nx run-many -t build -p my-lib-one,my-lib-two"
        }
      }
    }
  }
}
```

The `groupPreVersionCommand` will run in addition to the global `preVersionCommand`.

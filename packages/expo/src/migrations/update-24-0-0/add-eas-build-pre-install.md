#### Add the EAS Build pre-install script to Expo apps

Nx 24 removes the `@nx/expo:build` executor. In a workspace without package manager workspaces, that executor copied the root `dependencies`, `devDependencies`, `overrides` (or `resolutions`) and lock file into the app before running `eas build`, then restored the app's files. Without that step, EAS installs the app's `"*"` dependencies at whatever versions are latest.

The migration adds an `eas-build-pre-install` script to the `package.json` of every project with an `eas.json`, and writes `tools/scripts/eas-build-pre-install.mjs`. EAS Build runs the script on the build machine before installing dependencies, and it does the same copy there, so your own files are never modified. It also copies the root `pnpm` settings, and with Yarn it gives the app the root package name, because EAS installs with a frozen lock file and both package managers check those against it. A workspace with pnpm `patchedDependencies` still fails to install, because the patch paths resolve from the app directory. With package manager workspaces enabled, the script exits without changes.

A project that already defines `eas-build-pre-install` keeps its script and is listed in the migration's next steps, so you can add the new command to it.

#### Sample code changes

##### Before

```json title="apps/mobile/package.json"
{
  "name": "mobile",
  "scripts": {
    "eas-build-post-install": "cd ../../ && node tools/scripts/eas-build-post-install.mjs . apps/mobile"
  }
}
```

##### After

```json title="apps/mobile/package.json"
{
  "name": "mobile",
  "scripts": {
    "eas-build-post-install": "cd ../../ && node tools/scripts/eas-build-post-install.mjs . apps/mobile",
    "eas-build-pre-install": "cd ../../ && node tools/scripts/eas-build-pre-install.mjs . apps/mobile"
  }
}
```

# @nrwl/expo:build-android

Build and sign a standalone APK or App Bundle for the Google Play Store

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### clearCredentials

Alias(es): c

Type: `boolean`

Clear all credentials stored on Expo servers.

### keystoreAlias

Type: `string`

Keystore Alias

### keystorePath

Type: `string`

Path to your Keystore: \*.jks.

### noPublish

Type: `boolean`

Disable automatic publishing before building.

### noWait

Type: `boolean`

Exit immediately after scheduling build.

### publicUrl

Type: `string`

The URL of an externally hosted manifest (for self-hosted apps).

### releaseChannel

Type: `string`

Pull from specified release channel.

### skipWorkflowCheck

Type: `boolean`

Skip warning about build service bare workflow limitations.

### type

Alias(es): t

Type: `string`

Possible values: `app-bundle`, `apk`

Type of build: [app-bundle⎮apk].

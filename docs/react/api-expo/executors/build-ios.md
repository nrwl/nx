# @nrwl/expo:build-ios

Build and sign a standalone IPA for the Apple App Store

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### appleId

Type: `string`

Apple ID username (please also set the Apple ID password as EXPO_APPLE_PASSWORD environment variable).

### clearCredentials

Alias(es): c

Type: `boolean`

Clear all credentials stored on Expo servers.

### clearDistCert

Type: `boolean`

Remove Distribution Certificate stored on Expo servers.

### clearProvisioningProfile

Type: `boolean`

Remove Provisioning Profile stored on Expo servers.

### clearPushCert

Type: `boolean`

Remove Push Notifications Certificate stored on Expo servers. Use of Push Notifications Certificates is deprecated.

### clearPushKey

Type: `boolean`

Remove Push Notifications Key stored on Expo servers.

### distP12Path

Type: `string`

Path to your Distribution Certificate P12 (set password as EXPO_IOS_DIST_P12_PASSWORD environment variable).

### noPublish

Type: `boolean`

Disable automatic publishing before building.

### noWait

Type: `boolean`

Exit immediately after scheduling build.

### provisioningProfilePath

Type: `string`

Path to your Provisioning Profile.

### publicUrl

Type: `string`

The URL of an externally hosted manifest (for self-hosted apps).

### pushP8Path

Type: `string`

Path to your Push Key .p8 file.

### releaseChannel

Type: `string`

Pull from specified release channel.

### revokeCredentials

Alias(es): r

Type: `boolean`

Revoke credentials on developer.apple.com, select appropriate using --clear-\* options.

### skipCredentialsCheck

Type: `boolean`

Skip checking credentials.

### skipWorkflowCheck

Type: `boolean`

Skip warning about build service bare workflow limitations.

### sync

Default: `true`

Type: `boolean`

Syncs npm dependencies to package.json (for React Native autolink). Always true when --install is used.

### teamId

Type: `string`

Apple Team ID.

### type

Alias(es): t

Type: `string`

Possible values: `archive`, `simulator`

Type of build: [archive⎮simulator].

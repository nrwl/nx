# @nrwl/expo:run

Run the Android app binary locally or run the iOS app binary locally

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### platform (_**required**_)

Default: `ios`

Type: `string`

Possible values: `ios`, `android`

Platform to run for (ios, android).

### bundler

Default: `true`

Type: `boolean`

Whether to skip starting the Metro bundler. True to start it, false to skip it.

### device

Alias(es): d

Type: `string`

Device name or UDID to build the app on. The value is not required if you have a single device connected.

### port

Alias(es): p

Default: `8081`

Type: `number`

Port to start the Metro bundler on

### scheme

Type: `string`

(iOS) Explicitly set the Xcode scheme to use

### sync

Default: `true`

Type: `boolean`

Syncs npm dependencies to package.json (for React Native autolink). Always true when --install is used.

### variant

Default: `debug`

Type: `string`

(Android) Specify your app's build variant (e.g. debug, release).

### xcodeConfiguration

Default: `Debug`

Type: `string`

(iOS) Xcode configuration to use. Debug or Release

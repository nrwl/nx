# @nrwl/react-native:run-ios

Runs iOS application.

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### device

Type: `string`

Explicitly set device to use by name. The value is not required if you have a single device connected.

### install

Default: `true`

Type: `boolean`

Runs 'pod install' for native modules before building iOS app.

### packager

Default: `true`

Type: `boolean`

Starts the packager server

### port

Default: `8081`

Type: `number`

The port where the packager server is listening on.

### resetCache

Default: `false`

Type: `boolean`

Resets metro cache

### scheme

Type: `string`

Explicitly set the Xcode scheme to use

### simulator

Default: `iPhone X`

Type: `string`

Explicitly set simulator to use. Optionally include iOS version between parenthesis at the end to match an exact version: "iPhone X (12.1)"

### sync

Default: `true`

Type: `boolean`

Syncs npm dependencies to package.json (for React Native autolink). Always true when --install is used.

### terminal

Type: `string`

Launches the Metro Bundler in a new window using the specified terminal path.

### xcodeConfiguration

Default: `Debug`

Type: `string`

Explicitly set the Xcode configuration to use

# @nrwl/expo:start

Start a local dev server for the app or start a Webpack dev server for the web app

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### android

Alias(es): a

Type: `boolean`

Opens your app in Expo Go on a connected Android device

### clear

Alias(es): c

Type: `boolean`

Clear the Metro bundler cache

### dev

Type: `boolean`

Turn development mode on or off

### devClient

Type: `boolean`

Experimental: Starts the bundler for use with the expo-development-client

### host

Alias(es): m

Type: `string`

lan (default), tunnel, localhost. Type of host to use. "tunnel" allows you to view your link on other networks

### https

Type: `boolean`

To start webpack with https or http protocol

### ios

Alias(es): i

Type: `boolean`

Opens your app in Expo Go in a currently running iOS simulator on your computer

### lan

Type: `boolean`

Same as --host lan

### localhost

Type: `boolean`

Same as --host localhost

### maxWorkers

Type: `number`

Maximum number of tasks to allow Metro to spawn

### minify

Type: `boolean`

Whether or not to minify code

### offline

Type: `boolean`

Allows this command to run while offline

### port

Alias(es): p

Default: `19000`

Type: `number`

Port to start the native Metro bundler on (does not apply to web or tunnel)

### scheme

Type: `string`

Custom URI protocol to use with a development build

### sentTo

Alias(es): s

Type: `string`

An email address to send a link to

### tunnel

Type: `boolean`

Same as --host tunnel

### webpack

Type: `boolean`

Start a Webpack dev server for the web app.

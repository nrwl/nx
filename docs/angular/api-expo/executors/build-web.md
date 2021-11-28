# @nrwl/expo:build-web

Build the web app for production

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### clear

Alias(es): c

Type: `boolean`

Clear all cached build files and assets.

### dev

Type: `boolean`

Turns dev flag on before bundling

### noPwa

Type: `boolean`

Prevent webpack from generating the manifest.json and injecting meta into the index.html head.

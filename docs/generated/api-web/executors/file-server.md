---
title: '@nrwl/web:file-server executor'
description: 'Serve a web application from a folder'
---

# @nrwl/web:file-server

Serve a web application from a folder

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### buildTarget (_**required**_)

Type: `string`

Target which builds the application

### host

Default: `localhost`

Type: `string`

Host to listen on.

### maxParallel

Type: `number`

Max number of parallel jobs

### parallel

Default: `true`

Type: `boolean`

Build the target in parallel

### port

Default: `4200`

Type: `number`

Port to listen on.

### proxyUrl

Type: `string`

URL to proxy unhandled requests to.

### ssl

Default: `false`

Type: `boolean`

Serve using HTTPS.

### sslCert

Type: `string`

SSL certificate to use for serving HTTPS.

### sslKey

Type: `string`

SSL key to use for serving HTTPS.

### ~~withDeps~~

Default: `false`

Type: `boolean`

**Deprecated:** "withDeps" is deprecated and it will be removed in v14. Configure target dependencies instead: https://nx.dev/configuration/projectjson.

Build the target and all its deps
